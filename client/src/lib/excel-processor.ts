import * as XLSX from 'xlsx';

// ============================================================
// Sheet Name Aliases: maps canonical names to known internal aliases
// ============================================================
const SHEET_NAME_ALIASES: Record<string, string[]> = {
  contratos:        ['Contratos', '1Contratos'],
  pagos:            ['Pago', '4Pago'],              // Pago = pagos ya realizados
  programacion:     ['SAP', '2SAP'],                // SAP = programacion de pagos del proximo mes
  provisiones:      ['Av&Provision', '3Av&Provision', 'Provision'],
  garantias:        ['Garantia', '5Garantia', 'Garantias'],
  custodia:         ['C_Ent_Fin', 'Custodia'],
  ordenes_servicio: ['OS.r.SAP'],
  ordenes_cambio:   [],
  avance_semanal:   [],
  con_sap:          ['Con.SAP'],
};

// Anchor headers per sheet type for auto-detecting the header row
const SHEET_ANCHOR_HEADERS: Record<string, string[]> = {
  contratos:        ['CONTRATO', 'ADENDA', 'MONTO'],
  pagos:            ['CONTRATO', 'ADENDA', 'VALOR'],
  provisiones:      ['CONTRATO', 'ADENDA', 'PROVISIO'],
  programacion:     ['CONTRATO', 'ADENDA'],
  garantias:        ['CONTRATO', 'CARTA FIANZA'],
  custodia:         ['CONTRATO', 'ADENDA'],
  ordenes_servicio: ['CONTRATO', 'ORDEN'],
  ordenes_cambio:   ['CONTRATO', 'CAMBIO'],
  avance_semanal:   ['CONTRATO', 'AVANCE'],
  con_sap:          ['CONTRATO'],
};

// ============================================================
// Workbook Preprocessing: resolve sheet names + detect header rows
// ============================================================

function resolveSheetName(
  canonicalName: string,
  sheetNames: string[]
): string | undefined {
  // 1. Exact match
  const exact = sheetNames.find(s => s === canonicalName);
  if (exact) return exact;

  // 2. Case-insensitive match on canonical name
  const caseInsensitive = sheetNames.find(
    s => s.toLowerCase().trim() === canonicalName.toLowerCase()
  );
  if (caseInsensitive) return caseInsensitive;

  // 3. Alias match (case-insensitive)
  const aliases = SHEET_NAME_ALIASES[canonicalName] || [];
  for (const alias of aliases) {
    const match = sheetNames.find(
      s => s.toLowerCase().trim() === alias.toLowerCase().trim()
    );
    if (match) return match;
  }

  return undefined;
}

function detectHeaderRow(
  sheet: XLSX.WorkSheet,
  canonicalName: string,
  maxScanRows = 30
): number {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const anchors = (SHEET_ANCHOR_HEADERS[canonicalName] || [])
    .map(a => a.toUpperCase());

  // Pass 1: anchor-based detection
  for (let i = 0; i < Math.min(rawRows.length, maxScanRows); i++) {
    const row = rawRows[i];
    if (!row) continue;

    const cellValues = row
      .map((cell: any) => (cell != null ? String(cell).trim().toUpperCase() : ''))
      .filter((v: string) => v.length > 0);

    if (anchors.length > 0) {
      const matchCount = anchors.filter(anchor =>
        cellValues.some((val: string) => val.includes(anchor))
      ).length;
      const threshold = Math.min(2, anchors.length);
      if (matchCount >= threshold) return i;
    }
  }

  // Pass 2: density heuristic - first row with 4+ non-empty string cells
  for (let i = 0; i < Math.min(rawRows.length, maxScanRows); i++) {
    const row = rawRows[i];
    if (!row) continue;
    const nonEmpty = row.filter((cell: any) => cell != null && String(cell).trim() !== '');
    if (nonEmpty.length >= 4) return i;
  }

  return 0;
}

function extractSheetData(
  sheet: XLSX.WorkSheet,
  headerRow: number
): Record<string, any>[] {
  if (headerRow === 0) {
    return XLSX.utils.sheet_to_json(sheet);
  }
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
  range.s.r = headerRow;
  return XLSX.utils.sheet_to_json(sheet, { range });
}

interface SheetResolution {
  canonicalName: string;
  actualName: string;
  headerRow: number;
}

function normalizeWorkbook(workbook: XLSX.WorkBook): {
  workbook: XLSX.WorkBook;
  resolutions: SheetResolution[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const resolutions: SheetResolution[] = [];
  const newWorkbook = XLSX.utils.book_new();

  const allCanonical = Object.keys(SHEET_NAME_ALIASES);

  for (const canonical of allCanonical) {
    const actualName = resolveSheetName(canonical, workbook.SheetNames);
    if (!actualName) continue;

    const sheet = workbook.Sheets[actualName];
    const headerRow = detectHeaderRow(sheet, canonical);

    if (headerRow > 0) {
      warnings.push(
        `Hoja "${actualName}" (${canonical}): datos detectados desde fila ${headerRow + 1}`
      );
    }

    const data = extractSheetData(sheet, headerRow);
    const newSheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, canonical);

    resolutions.push({ canonicalName: canonical, actualName, headerRow });
  }

  // Warn about unmapped sheets (distinguish E_ specialized sheets)
  for (const name of workbook.SheetNames) {
    const alreadyMapped = resolutions.some(r => r.actualName === name);
    if (!alreadyMapped) {
      if (/^E_/i.test(name)) {
        warnings.push(`Hoja especializada "${name}" detectada (se procesara como datos adicionales).`);
      } else {
        warnings.push(`Hoja "${name}" no tiene mapeo conocido, ignorada.`);
      }
    }
  }

  return { workbook: newWorkbook, resolutions, warnings };
}

export interface PaymentRecord {
  valorizacion: string;
  descripcion: string;
  monto: number;
  factura: string;
  fechaContabilizacion: string;
  retencion: number;
  amortizacionAdelanto: number;
  isAdelanto: boolean; // true when VALORIZACION starts with "A"
}

export interface GuaranteeRecord {
  monto: number;
  detalle: string;
  entidad: string;
  nroCarta: string;
  fechaEmision: string;
  fechaVencimiento: string;
}

export interface ProvisionRecord {
  monto: number;
}

export interface SpecializedSheetEntry {
  sheetType: string;          // e.g., "obras", "arrendamiento"
  sheetLabel: string;         // Human-readable label
  data: Record<string, any>;  // All columns as key-value pairs (excluding CONTRATO)
}

export interface ContractData {
  contractId: string; // N° CONTRATO
  addendumId: string; // ADENDA (0, 1, 2...)
  key: string; // CONTRATO + ADENDA
  
  // From 'contratos' sheet
  description?: string;
  chineseDescription?: string;
  contractDate?: string;
  startDate?: string;
  endDate?: string;
  executionTerm?: string;
  extensionTerm?: string;
  responsible?: string;
  company?: string;
  observaciones?: string; // OBSERVACIONES from 1Contratos
  
  amount: number;
  deductivo: number; // DEDUCTIVO Y MAYORES METRADOS US$ (SIN IGV)
  amountNet: number; // CONTRATADO - DEDUCTIVO = valor real del contrato
  currency?: string;
  state?: string;
  type?: string; // Tipo de contrato
  contractClass?: string; // Clase de contrato (New)
  investmentType?: string; // Tipo de inversión
  investmentGroup?: string; // GRUPO INVERSION
  
  // Computed/Aggregated
  payments: number;
  scheduledPayments: number; // Programacion: pagos planificados para el mes siguiente
  provisions: number;
  serviceOrders: number;
  changeOrders: number;
  guarantees: number;
  retention: number; // RETENCION FG Y FC US$
  adelantoContrato: number; // Adelanto de contrato (pagos con VALORIZACION que empieza con A)
  amortizacionAdelanto: number; // Amortizacion del adelanto
  adelantoPorAmortizar: number; // Adelanto - Amortizacion
  progress: number; // Avance
  balance: number; // Saldo
  saldoPorPagar: number; // Saldo por pagar
  
  // SAP registration tracking
  registeredInSap: boolean; // From Con.SAP sheet

  // Raw records for drill-down
  paymentsList: PaymentRecord[];
  guaranteesList: GuaranteeRecord[];
  provisionsList: ProvisionRecord[];

  records: Record<string, any>[];
  comments: string[]; // Aggregated comments

  // Specialized sheet data (E_obras, E_arrendamiento, etc.)
  specializedData: SpecializedSheetEntry[];
}

export interface ConsolidatedContract {
  contractId: string;
  totalAmount: number;
  totalExecuted: number;
  totalPaid: number;
  progressPercent: number;
  totalBalance: number;
  totalRetention: number;
  totalGuarantees: number; // New field
  state: string; // Derived from items
  items: ContractData[]; // The addendums belonging to this contract
}

export interface ProcessingResult {
  contracts: ContractData[];
  consolidated: ConsolidatedContract[];
  errors: string[];
}

const NORMALIZE_HEADERS = (row: any) => {
  const newRow: any = {};
  Object.keys(row).forEach(key => {
    // Aggressive normalization: 
    // 1. Trim whitespace from ends
    // 2. Replace multiple spaces with single space
    // 3. maintain original casing for value, but we need a standard key for lookup
    // Actually, let's keep the key standard: UPPERCASE, TRIMMED, SINGLE SPACES
    const cleanKey = key.trim().replace(/\s+/g, ' ').toUpperCase();
    newRow[cleanKey] = row[key];
    // Also keep original just in case
    newRow[key] = row[key];
  });
  return newRow;
};

export const processExcelFile = async (file: File): Promise<ProcessingResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const rawWorkbook = XLSX.read(data, { type: 'array' });

        // Preprocess: resolve sheet names + detect header rows
        const normalized = normalizeWorkbook(rawWorkbook);
        const workbook = normalized.workbook;
        const sheetNames = workbook.SheetNames;

        console.log('Sheet resolutions:', normalized.resolutions);
        if (normalized.warnings.length > 0) {
          console.warn('Normalization warnings:', normalized.warnings);
        }
        const result: ProcessingResult = {
          contracts: [],
          consolidated: [],
          errors: []
        };

        // Helper to parse numbers safely
        const parseNumber = (val: any) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            if (typeof val === 'string') {
              const clean = val.replace(/,/g, '').trim();
              const num = parseFloat(clean);
              return isNaN(num) ? 0 : num;
            }
            return 0;
        };

        // Helper to parse Excel dates to DD/MM/YYYY
        const parseExcelDate = (val: any) => {
          if (!val) return '-';
          if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            if (isNaN(date.getTime())) return '-';
            const d = date.getUTCDate().toString().padStart(2, '0');
            const m = (date.getUTCMonth() + 1).toString().padStart(2, '0');
            const y = date.getUTCFullYear();
            return `${d}/${m}/${y}`;
          }
          return String(val);
        };

        // 1. Validate mandatory sheet (already normalized to canonical name)
        const contratosSheetName = sheetNames.find(s => s === 'contratos');
        
        if (!contratosSheetName) {
          result.errors.push("Falta la hoja obligatoria 'contratos'.");
          resolve(result);
          return;
        }

        // 2. Read 'contratos' (Base)
        const contractsSheet = workbook.Sheets[contratosSheetName];
        const rawContracts = XLSX.utils.sheet_to_json(contractsSheet);
        
        const contractsMap = new Map<string, ContractData>();
        const hasPagosSheet = sheetNames.includes('pagos');

        console.log("Raw headers found:", rawContracts.length > 0 ? Object.keys(rawContracts[0] as object) : "No rows");

        rawContracts.forEach((row: any) => {
          const r = NORMALIZE_HEADERS(row);
          
          // Debug: print normalized keys for first row
          if (contractsMap.size === 0) {
             console.log("Normalized keys sample:", Object.keys(r));
          }

          // Key: CONTRATO + ADENDA
          // Try multiple variations
          const contractId = r['N° CONTRATO'] || r['CONTRATO'] || r['N CONTRATO'] || r['NO CONTRATO']; 
          const addendumId = r['ADENDA'];
          
          if (!contractId || addendumId === undefined) {
            // console.warn("Skipping row missing keys:", r);
            return; 
          }

          const key = `${contractId}-${addendumId}`;
          
          // Specific column mappings
          // We normalized keys to UPPERCASE with SINGLE SPACES
          const amount = parseNumber(
            r['MONTO CONTRATADO US$ (SIN IGV)'] || 
            r['MONTO CONTRATADO US$'] || 
            r['MONTO CONTRATADO'] || 
            r['MONTO'] || 
            r['IMPORTE']
          );
          
          const payments = hasPagosSheet ? 0 : parseNumber(
            r['PAGADO US$ (SIN IGV)'] || 
            r['PAGADO US$'] || 
            r['PAGADO'] || 
            r['MONTO PAGADO']
          );
          
          const retention = hasPagosSheet ? 0 : parseNumber(
            r['RETENCION FG Y FC US$'] || 
            r['RETENCION FG Y FC'] || 
            r['RETENCION'] || 
            r['FONDO GARANTIA'] ||
            r['RETENCION FG'] ||
            r['RETENCION FC'] ||
            r['RETENCION TOTAL']
          );

          const deductivo = parseNumber(
            r['DEDUCTIVO Y MAYORES METRADOS US$ (SIN IGV)'] ||
            r['DEDUCTIVO Y MAYORES METRADOS'] ||
            r['DEDUCTIVO'] || 0
          );

          contractsMap.set(key, {
            contractId: String(contractId),
            addendumId: String(addendumId),
            key,
            description: r['DESCRIPCION CONTRATO'] || r['DESCRIPCION'] || r['OBJETO'] || r['NOMBRE'] || '',
            chineseDescription: r['CONTRATO EN CHINO'] || '',
            contractDate: parseExcelDate(r['FECHA SUSCRIPCIÓN DE CONTRATO'] || r['FECHA SUSCRIPCION'] || r['FECHA CONTRATO']),
            startDate: parseExcelDate(r['FECHA ACTA DE INICIO DE OBRA2'] || r['FECHA INICIO'] || r['INICIO']),
            executionTerm: String(r['PLAZO DE EJECUCION / FABRICACION'] || r['PLAZO'] || '-'),
            extensionTerm: String(r['Z AMPLIACIÓN DE PLAZO'] || r['AMPLIACION'] || '-'),
            endDate: parseExcelDate(r['FECHA RECEPCIÓN PROVISIONAL / FIN SEGÚN CONTRATO (ULTIMA)'] || r['FECHA FIN'] || r['FIN']),
            responsible: String(r['RESPONSABLE (ADMINISTRADOR DE CONTRATO)'] || r['RESPONSABLE'] || '-'),
            company: String(r['EMPRESA'] || r['CONTRATISTA'] || '-'),
            observaciones: r['OBSERVACIONES'] || '',
            amount: amount,
            deductivo: deductivo,
            amountNet: amount - deductivo,
            state: r['ESTADO'] || 'Activo',
            type: r['TIPO_CONTRATO'] || 'General',
            contractClass: r['CLASE CONTRATO'] || r['CLASE'] || 'Sin Clase',
            investmentType: r['TIPO_INVERSION'] || r['TIPO INVERSION'] || 'Capex',
            investmentGroup: r['GRUPO INVERSION'] || r['GRUPO'] || 'Sin Grupo',
            payments: payments,
            scheduledPayments: 0,
            provisions: 0,
            serviceOrders: 0,
            changeOrders: 0,
            guarantees: 0,
            retention: retention,
            adelantoContrato: 0,
            amortizacionAdelanto: 0,
            adelantoPorAmortizar: 0,
            progress: 0,
            balance: 0,
            saldoPorPagar: 0,
            registeredInSap: false,
            paymentsList: [],
            guaranteesList: [],
            provisionsList: [],
            records: [],
            comments: r['COMENTARIOS'] ? [r['COMENTARIOS']] : [],
            specializedData: []
          });
        });

        // 3. Process Secondary Sheets
        const secondarySheets = [
          { name: 'pagos', field: 'payments', valCol: 'MONTO' },
          { name: 'programacion', field: 'scheduledPayments', valCol: 'MONTO' },
          { name: 'provisiones', field: 'provisions', valCol: 'MONTO' },
          { name: 'ordenes_servicio', field: 'serviceOrders', valCol: 'MONTO' },
          { name: 'ordenes_cambio', field: 'changeOrders', valCol: 'MONTO' },
          { name: 'garantias', field: 'guarantees', valCol: 'CARTA FIANZA (US$)' },
          { name: 'custodia', field: 'retention', valCol: 'MONTO' },
        ];

        secondarySheets.forEach(conf => {
          if (sheetNames.includes(conf.name)) {
            const sheet = workbook.Sheets[conf.name];
            const rows = XLSX.utils.sheet_to_json(sheet);
            
            rows.forEach((row: any) => {
              const r = NORMALIZE_HEADERS(row);
              
              const contractId = r['CONTRATO'] || r['N° CONTRATO'] || r['N CONTRATO'];
              const addendumId = r['ADENDA'];
              
              if (contractId && addendumId !== undefined) {
                 const key = `${contractId}-${addendumId}`;
                 const contract = contractsMap.get(key);
                 
                 if (contract) {
                   // Calculate main value to aggregate
                   let val = 0;
                   if (conf.name === 'garantias') {
                      val = parseNumber(
                        r['CARTA FIANZA (US$)'] || 
                        r['CARTA FIANZA'] || 
                        r['MONTO']
                      );
                   } else if (conf.name === 'provisiones') {
                      val = parseNumber(
                        r['SALDO DE PROVISIONES (SIN IGV US$)'] ||
                        r['SALDO PROVISIONES'] ||
                        r['MONTO']
                      );
                   } else if (conf.name === 'pagos') {
                      val = parseNumber(
                        r['VALOR SIN IGV 付款金额（不含税）'] ||
                        r['VALOR SIN IGV'] ||
                        r['MONTO']
                      );
                   } else {
                      val = Number(r[conf.valCol] || 0);
                   }

                   (contract as any)[conf.field] += val;
                   
                   // Store detailed records for "Historial" block
                   if (conf.name === 'pagos') {
                      const retVal = parseNumber(
                        r['RETENCION FG Y FC US$'] ||
                        r['RETENCION FG Y FC'] ||
                        r['RETENCION'] ||
                        r['RETENCION TOTAL']
                      );
                      if (retVal) {
                        contract.retention += retVal;
                      }

                      const valorizacionId = String(r['VALORIZACIÓN #'] || r['VALORIZACION'] || r['N° VALORIZACION'] || '-').trim();
                      const isAdelanto = /^A/i.test(valorizacionId);
                      const amortAdelanto = parseNumber(
                        r['AMORTIZACION DEL ADELANTO'] ||
                        r['AMORTIZACION ADELANTO'] ||
                        r['AMORT. ADELANTO'] || 0
                      );

                      if (isAdelanto) {
                        contract.adelantoContrato += val;
                      }
                      if (amortAdelanto) {
                        contract.amortizacionAdelanto += amortAdelanto;
                      }

                      contract.paymentsList.push({
                        valorizacion: valorizacionId,
                        descripcion: r['VAL DESCRIPCION'] || r['DESCRIPCION'] || '-',
                        monto: val,
                        factura: r['FACTURA'] || '-',
                        fechaContabilizacion: parseExcelDate(r['FECHA CONTABILIZACION'] || r['FECHA PAGO']),
                        retencion: retVal || 0,
                        amortizacionAdelanto: amortAdelanto,
                        isAdelanto,
                      });
                   } else if (conf.name === 'garantias') {
                      contract.guaranteesList.push({
                        monto: val,
                        detalle: r['DETALLE DE LA CARTA'] || r['DETALLE'] || '-',
                        entidad: r['ENTIDAD FINANCIERA'] || r['BANCO'] || '-',
                        nroCarta: r['NRO. DE CARTA FIANZA'] || r['CARTA FIANZA NRO'] || '-',
                        fechaEmision: parseExcelDate(r['F. EMISIÓN'] || r['FECHA EMISION']),
                        fechaVencimiento: parseExcelDate(r['FECHA DE VENCIMIENTO DE LAS CARTAS FIANZA O POLIZAS DE SEGURO.'] || r['FECHA VENCIMIENTO'])
                      });
                   } else if (conf.name === 'provisiones') {
                      contract.provisionsList.push({
                        monto: val
                      });
                   }

                   if (r['COMENTARIOS']) {
                     contract.comments.push(`[${conf.name}]: ${r['COMENTARIOS']}`);
                   }
                 }
              }
            });
          }
        });

        // Special handling for 'avance_semanal' if it exists
        // Assuming it provides a percentage or amount for 'progress'
        if (sheetNames.includes('avance_semanal')) {
           const sheet = workbook.Sheets['avance_semanal'];
           const rows = XLSX.utils.sheet_to_json(sheet);
           rows.forEach((row: any) => {
             const r = NORMALIZE_HEADERS(row);
             const contractId = r['CONTRATO'];
             const addendumId = r['ADENDA'];
             const key = `${contractId}-${addendumId}`;
             const contract = contractsMap.get(key);
             if (contract) {
               // Assuming AVANCE is a percentage 0-100 or 0-1
               // Or is it an amount? Let's assume percentage for now, or look for 'VALORIZACION' for amount
               // Let's use 'AVANCE' column
               contract.progress = Math.max(contract.progress, Number(r['AVANCE'] || 0));
             }
           });
        }

        // Process 'con_sap' to mark contracts registered in SAP
        if (sheetNames.includes('con_sap')) {
          const sheet = workbook.Sheets['con_sap'];
          const rows = XLSX.utils.sheet_to_json(sheet);
          const sapContractIds = new Set<string>();
          rows.forEach((row: any) => {
            const r = NORMALIZE_HEADERS(row);
            const contractId = r['CONTRATO'] || r['N° CONTRATO'] || r['N CONTRATO'];
            if (contractId) sapContractIds.add(String(contractId));
          });
          contractsMap.forEach(c => {
            if (sapContractIds.has(c.contractId)) {
              c.registeredInSap = true;
            }
          });
        }

        // 3b. Process Specialized Sheets (E_obras, E_arrendamiento, etc.)
        // These are discovered from the RAW workbook since normalizeWorkbook discards unmapped sheets.
        const eSheetNames = rawWorkbook.SheetNames.filter(name => /^E_/i.test(name));

        for (const eSheetName of eSheetNames) {
          const sheetType = eSheetName.replace(/^E_/i, '').toLowerCase();
          const sheetLabel = sheetType.charAt(0).toUpperCase() + sheetType.slice(1);

          const rawSheet = rawWorkbook.Sheets[eSheetName];
          const eHeaderRow = detectHeaderRow(rawSheet, eSheetName);
          const eRows = extractSheetData(rawSheet, eHeaderRow);

          console.log(`Hoja especializada "${eSheetName}" detectada: ${eRows.length} filas, header en fila ${eHeaderRow + 1}`);

          eRows.forEach((row: any) => {
            const r = NORMALIZE_HEADERS(row);
            const contractId = r['CONTRATO'] || r['N° CONTRATO'] || r['N CONTRATO'];
            if (!contractId) return;

            // Build data object from all non-identifier columns (use only uppercase keys to avoid dupes)
            const data: Record<string, any> = {};
            const skipKeys = new Set(['CONTRATO', 'N° CONTRATO', 'N CONTRATO', 'ADENDA']);
            const seenKeys = new Set<string>();

            for (const [key, value] of Object.entries(r)) {
              const upperKey = key.trim().toUpperCase().replace(/\s+/g, ' ');
              if (skipKeys.has(upperKey)) continue;
              if (seenKeys.has(upperKey)) continue;
              seenKeys.add(upperKey);
              if (value !== null && value !== undefined && String(value).trim() !== '') {
                data[upperKey] = value;
              }
            }

            // Attach to addendum 0 (primary), fallback to first matching addendum
            const primaryKey = `${contractId}-0`;
            const primaryContract = contractsMap.get(primaryKey);
            if (primaryContract) {
              primaryContract.specializedData.push({ sheetType, sheetLabel, data });
            } else {
              // Fallback: find any addendum for this contract
              let found = false;
              contractsMap.forEach((c) => {
                if (!found && c.contractId === String(contractId)) {
                  c.specializedData.push({ sheetType, sheetLabel, data });
                  found = true;
                }
              });
            }
          });
        }

        // 4. Calculate Balances
        // Saldo = Monto Contractual - Pagos (usually) or Monto - Ejecutado?
        // User said: "Saldo" in Detail view.
        // Let's assume Saldo = Amount - Payments for now, or Amount - Provisions?
        // Let's stick to Amount - Payments as a safe default for "financial balance".
        
        contractsMap.forEach(c => {
          c.balance = c.amount - c.payments;
          c.adelantoPorAmortizar = c.adelantoContrato - c.amortizacionAdelanto;
          c.saldoPorPagar = c.amountNet - c.payments;
        });

        result.contracts = Array.from(contractsMap.values());

        // 5. Aggregate for Consolidated View
        const consolidatedMap = new Map<string, ConsolidatedContract>();
        
        result.contracts.forEach(c => {
          if (!consolidatedMap.has(c.contractId)) {
            consolidatedMap.set(c.contractId, {
              contractId: c.contractId,
              totalAmount: 0,
              totalExecuted: 0, // Using provisions or progress? Let's use payments for now or provisions if available
              totalPaid: 0,
              progressPercent: 0,
              totalBalance: 0,
              totalRetention: 0,
              totalGuarantees: 0,
              state: 'Activo', // Default
              items: []
            });
          }
          
          const master = consolidatedMap.get(c.contractId)!;
          master.items.push(c);
          master.totalAmount += c.amount;
          master.totalPaid += c.payments;
          master.totalBalance += c.balance;
          master.totalRetention += c.retention;
          master.totalGuarantees += c.guarantees;
          // Executed might be provisions?
          master.totalExecuted += c.provisions;
          
          // Determine state from main contract (adenda 0 usually holds the state)
          if (c.addendumId === '0' && c.state) {
            master.state = c.state;
          }
        });

        // Calculate weighted progress for consolidated?
        // Simple average for now or weighted by amount
        consolidatedMap.forEach(m => {
          if (m.totalAmount > 0) {
             // Weighted progress
             const weightedProgress = m.items.reduce((acc, item) => acc + (item.progress * item.amount), 0);
             m.progressPercent = weightedProgress / m.totalAmount;
          } else {
             m.progressPercent = 0;
          }
        });

        result.consolidated = Array.from(consolidatedMap.values());

        resolve(result);

      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
};
