import * as XLSX from 'xlsx';

export interface PaymentRecord {
  valorizacion: string;
  descripcion: string;
  monto: number;
  factura: string;
  fechaContabilizacion: string;
  retencion: number;
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
  
  amount: number;
  currency?: string;
  state?: string;
  type?: string; // Tipo de contrato
  contractClass?: string; // Clase de contrato (New)
  investmentType?: string; // Tipo de inversión
  investmentGroup?: string; // GRUPO INVERSION
  
  // Computed/Aggregated
  payments: number;
  provisions: number;
  serviceOrders: number;
  changeOrders: number;
  guarantees: number;
  retention: number; // RETENCION FG Y FC US$
  progress: number; // Avance
  balance: number; // Saldo
  
  // Raw records for drill-down
  paymentsList: PaymentRecord[];
  guaranteesList: GuaranteeRecord[];
  provisionsList: ProvisionRecord[];
  
  records: Record<string, any>[];
  comments: string[]; // Aggregated comments
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
        const workbook = XLSX.read(data, { type: 'array' });
        
        const sheetNames = workbook.SheetNames;
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

        // 1. Validate mandatory sheet
        // Check case-insensitive
        const contratosSheetName = sheetNames.find(s => s.toLowerCase().trim() === 'contratos');
        
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
            amount: amount,
            state: r['ESTADO'] || 'Activo',
            type: r['TIPO_CONTRATO'] || 'General',
            contractClass: r['CLASE CONTRATO'] || r['CLASE'] || 'Sin Clase',
            investmentType: r['TIPO_INVERSION'] || r['TIPO INVERSION'] || 'Capex',
            investmentGroup: r['GRUPO INVERSION'] || r['GRUPO'] || 'Sin Grupo',
            payments: payments, 
            provisions: 0,
            serviceOrders: 0,
            changeOrders: 0,
            guarantees: 0,
            retention: retention,
            progress: 0,
            balance: 0,
            paymentsList: [],
            guaranteesList: [],
            provisionsList: [],
            records: [],
            comments: r['COMENTARIOS'] ? [r['COMENTARIOS']] : []
          });
        });

        // 3. Process Secondary Sheets
        const secondarySheets = [
          { name: 'pagos', field: 'payments', valCol: 'MONTO' }, // Will add to existing payments
          { name: 'provisiones', field: 'provisions', valCol: 'MONTO' },
          { name: 'ordenes_servicio', field: 'serviceOrders', valCol: 'MONTO' },
          { name: 'ordenes_cambio', field: 'changeOrders', valCol: 'MONTO' },
          { name: 'garantias', field: 'guarantees', valCol: 'CARTA FIANZA (US$)' }, // Changed from MONTO to specific column
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

                      contract.paymentsList.push({
                        valorizacion: r['VALORIZACIÓN #'] || r['VALORIZACION'] || r['N° VALORIZACION'] || '-',
                        descripcion: r['VAL DESCRIPCION'] || r['DESCRIPCION'] || '-',
                        monto: val,
                        factura: r['FACTURA'] || '-',
                        fechaContabilizacion: parseExcelDate(r['FECHA CONTABILIZACION'] || r['FECHA PAGO']),
                        retencion: retVal || 0
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

        // 4. Calculate Balances
        // Saldo = Monto Contractual - Pagos (usually) or Monto - Ejecutado?
        // User said: "Saldo" in Detail view.
        // Let's assume Saldo = Amount - Payments for now, or Amount - Provisions?
        // Let's stick to Amount - Payments as a safe default for "financial balance".
        
        contractsMap.forEach(c => {
          c.balance = c.amount - c.payments;
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
