// ============================================================
// Specialized Sheets Configuration Module
// ============================================================
// Defines which fields to extract and how to aggregate them
// for each specialized sheet type (E_obras, E_arrendamiento, etc.)
//
// Aggregation types:
//   sum   - Sum of all values in the group
//   max   - Maximum value in the group
//   min   - Minimum value in the group
//   avg   - Average of all values in the group
//   count - Count of non-empty values
//   first - First non-empty value (useful for text fields)

/** Strip accents/diacritics: "ÁREA" → "AREA", "Descripción" → "Descripcion" */
const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export type AggregationType = 'sum' | 'max' | 'min' | 'avg' | 'count' | 'first';

export interface SpecializedFieldDef {
  column: string;         // Column name in the Excel sheet (UPPERCASE, normalized)
  label: string;          // Display label in the UI
  aggregation: AggregationType;
  format?: 'number' | 'currency' | 'percent' | 'text'; // Display format (default: 'number')
  decimals?: number;      // Decimal places for number formatting (default: 2)
}

export interface SpecializedSheetConfig {
  sheetType: string;      // Derived from sheet name minus "E_" prefix, lowercased
  label: string;          // Human-readable label for the UI section
  fields: SpecializedFieldDef[];
}

// ============================================================
// Sheet Configurations
// ============================================================
// Add new specialized sheet types here. The sheetType must match
// the sheet name pattern: E_{sheetType} (case-insensitive).
// Column names should be UPPERCASE with single spaces.

export const SPECIALIZED_SHEET_CONFIGS: SpecializedSheetConfig[] = [
  {
    sheetType: 'arrendamiento',
    label: 'Uso de Terreno / Arrendamiento',
    fields: [
      { column: 'PLAZO ANOS',        label: 'Plazo Años',       aggregation: 'max',   format: 'number', decimals: 1 },
      { column: 'VIGENCIA2',        label: 'Vigencia',         aggregation: 'max',   format: 'text' },
      { column: 'PAGO ANUAL (US$)', label: 'Pago Anual (US$)', aggregation: 'sum',   format: 'currency' },
      { column: 'AREA (M2)',        label: 'Area (m2)',        aggregation: 'sum',   format: 'number', decimals: 2 },
      { column: 'AREA (HA)',        label: 'Area (Ha)',        aggregation: 'avg',   format: 'number', decimals: 4 },
      { column: 'USD/HA',           label: 'USD/ha',           aggregation: 'avg',   format: 'currency' },
    ],
  },
  {
    sheetType: 'obras',
    label: 'Obras',
    fields: [
      { column: 'M2',              label: 'M2',              aggregation: 'sum',   format: 'number', decimals: 2 },
      { column: 'TIPO OBRA',       label: 'Tipo Obra',       aggregation: 'first', format: 'text' },
    ],
  },
];

// ============================================================
// Lookup helper
// ============================================================

const configIndex = new Map<string, SpecializedSheetConfig>();
SPECIALIZED_SHEET_CONFIGS.forEach(c => configIndex.set(c.sheetType.toLowerCase(), c));

/**
 * Find the config for a given sheet type. Falls back to auto-generating
 * a config from the raw data columns if no explicit config is defined.
 */
export function getSheetConfig(sheetType: string): SpecializedSheetConfig | undefined {
  return configIndex.get(sheetType.toLowerCase());
}

/**
 * Auto-generate a config for an unknown E_ sheet by treating all
 * numeric columns as 'sum' and text columns as 'first'.
 */
export function autoGenerateConfig(
  sheetType: string,
  sampleRow: Record<string, any>
): SpecializedSheetConfig {
  const fields: SpecializedFieldDef[] = [];
  const skipKeys = new Set(['CONTRATO', 'N° CONTRATO', 'N CONTRATO', 'ADENDA', 'CONTRATO + ADENDA', 'ITEM']);

  for (const [key, value] of Object.entries(sampleRow)) {
    const upperKey = stripAccents(key.trim().toUpperCase().replace(/\s+/g, ' '));
    if (skipKeys.has(upperKey)) continue;
    // Skip duplicate lowercase keys (NORMALIZE_HEADERS creates both)
    if (key !== upperKey && sampleRow[upperKey] !== undefined) continue;

    const isNumeric = typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value.replace(/,/g, ''))));
    fields.push({
      column: upperKey,
      label: key.trim(),
      aggregation: isNumeric ? 'sum' : 'first',
      format: isNumeric ? 'number' : 'text',
    });
  }

  return {
    sheetType: sheetType.toLowerCase(),
    label: sheetType.charAt(0).toUpperCase() + sheetType.slice(1),
    fields,
  };
}

// ============================================================
// Aggregation Engine
// ============================================================

export interface AggregatedField {
  label: string;
  value: number | string;
  format: 'number' | 'currency' | 'percent' | 'text';
  decimals: number;
}

export interface AggregatedSheetData {
  sheetType: string;
  label: string;
  fields: AggregatedField[];
}

/**
 * Aggregate specialized data entries for a group of contracts
 * according to the field definitions in the config.
 */
export function aggregateSpecializedData(
  entries: { sheetType: string; data: Record<string, any> }[],
  parseNumber: (val: any) => number = defaultParseNumber
): AggregatedSheetData[] {
  // Group entries by sheetType
  const byType = new Map<string, Record<string, any>[]>();
  for (const entry of entries) {
    const key = entry.sheetType.toLowerCase();
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(entry.data);
  }

  const results: AggregatedSheetData[] = [];

  byType.forEach((rows, type) => {
    let config = getSheetConfig(type);
    if (!config && rows.length > 0) {
      config = autoGenerateConfig(type, rows[0]);
    }
    if (!config) return;

    const aggregatedFields: AggregatedField[] = [];

    for (const fieldDef of config.fields) {
      const strippedColumn = stripAccents(fieldDef.column);
      const values = rows
        .map((r: Record<string, any>) => {
          // Try exact match first
          let val = r[fieldDef.column];
          // Try accent-stripped key (E_ sheet data already has stripped keys)
          if (val === undefined) val = r[strippedColumn];
          // Fallback: search all keys with accent stripping
          if (val === undefined) {
            const key = Object.keys(r).find(k =>
              stripAccents(k.trim().toUpperCase().replace(/\s+/g, ' ')) === strippedColumn
            );
            if (key) val = r[key];
          }
          return val;
        })
        .filter((v: any) => v !== undefined && v !== null && String(v).trim() !== '');

      let result: number | string;

      if (fieldDef.format === 'text' || fieldDef.aggregation === 'first') {
        result = computeTextAggregation(fieldDef.aggregation, values);
      } else {
        const nums = values.map((v: any) => parseNumber(v));
        result = computeNumericAggregation(fieldDef.aggregation, nums);
      }

      aggregatedFields.push({
        label: fieldDef.label,
        value: result,
        format: fieldDef.format || 'number',
        decimals: fieldDef.decimals ?? 2,
      });
    }

    results.push({
      sheetType: type,
      label: config.label,
      fields: aggregatedFields,
    });
  });

  return results;
}

function computeNumericAggregation(agg: AggregationType, nums: number[]): number {
  if (nums.length === 0) return 0;
  switch (agg) {
    case 'sum':   return nums.reduce((a, b) => a + b, 0);
    case 'max':   return Math.max(...nums);
    case 'min':   return Math.min(...nums);
    case 'avg':   return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'count': return nums.length;
    case 'first': return nums[0] ?? 0;
    default:      return 0;
  }
}

function computeTextAggregation(agg: AggregationType, values: any[]): string {
  if (values.length === 0) return '-';
  switch (agg) {
    case 'first': return String(values[0]);
    case 'count': return String(values.length);
    case 'max':   return String(values.sort().pop());
    case 'min':   return String(values.sort()[0]);
    default:      return String(values[0]);
  }
}

// ============================================================
// Executive KPI Definitions
// ============================================================
// Configure which fields from E_ sheets appear as KPI cards
// in the Executive view. Only KPIs with actual data will render.
// To add new KPIs, simply add entries to EXECUTIVE_KPIS array.

export interface ExecutiveKpiDef {
  sheetType: string;           // which E_ sheet (lowercase, e.g. 'arrendamiento')
  column: string;              // column to aggregate (UPPERCASE)
  label: string;               // display label
  aggregation: AggregationType;
  format: 'number' | 'currency' | 'percent' | 'text';
  decimals?: number;
}

export const EXECUTIVE_KPIS: ExecutiveKpiDef[] = [
  { sheetType: 'arrendamiento', column: 'PAGO ANUAL (US$)', label: 'Pago Anual Arrend.', aggregation: 'sum', format: 'currency' },
  { sheetType: 'arrendamiento', column: 'AREA (HA)',        label: 'Área Total (Ha)',    aggregation: 'sum', format: 'number', decimals: 2 },
  { sheetType: 'arrendamiento', column: 'USD/HA',           label: 'Prom. USD/ha',       aggregation: 'avg', format: 'currency' },
  { sheetType: 'obras',         column: 'M2',               label: 'M2 Total Obras',     aggregation: 'sum', format: 'number', decimals: 2 },
];

export interface ComputedKpi {
  label: string;
  value: number | string;
  format: 'number' | 'currency' | 'percent' | 'text';
  decimals: number;
}

/**
 * Compute executive KPIs from specialized sheet entries.
 * Returns only KPIs that have actual data.
 */
export function computeExecutiveKpis(
  entries: { sheetType: string; data: Record<string, any> }[],
  kpiDefs: ExecutiveKpiDef[] = EXECUTIVE_KPIS,
  parseNumber: (val: any) => number = defaultParseNumber
): ComputedKpi[] {
  // Group entries by sheetType
  const byType = new Map<string, Record<string, any>[]>();
  for (const entry of entries) {
    const key = entry.sheetType.toLowerCase();
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(entry.data);
  }

  const results: ComputedKpi[] = [];
  for (const def of kpiDefs) {
    const rows = byType.get(def.sheetType.toLowerCase());
    if (!rows || rows.length === 0) continue;

    const strippedColumn = stripAccents(def.column);
    const values = rows
      .map(r => {
        // Try exact match first
        let val = r[def.column];
        // Try accent-stripped key (E_ sheet data already has stripped keys)
        if (val === undefined) val = r[strippedColumn];
        // Fallback: search all keys with accent stripping
        if (val === undefined) {
          const key = Object.keys(r).find(k =>
            stripAccents(k.trim().toUpperCase().replace(/\s+/g, ' ')) === strippedColumn
          );
          if (key) val = r[key];
        }
        return val;
      })
      .filter(v => v !== undefined && v !== null && String(v).trim() !== '');

    if (values.length === 0) continue;

    const nums = values.map(v => parseNumber(v));
    const result = computeNumericAggregation(def.aggregation, nums);

    results.push({
      label: def.label,
      value: result,
      format: def.format,
      decimals: def.decimals ?? 2,
    });
  }
  return results;
}

function defaultParseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  if (typeof val === 'string') {
    const clean = val.replace(/,/g, '').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}
