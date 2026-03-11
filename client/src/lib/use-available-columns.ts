import { useMemo } from 'react';
import { useAppStore } from '@/store';

export interface SheetColumnInfo {
  columns: string[];
  /** Total E_ rows linked across all contracts */
  entryCount: number;
  /** Number of distinct parent contracts that have E_ data for this sheet */
  contractCount: number;
}

/**
 * Scans loaded data and returns a Map of sheetType → column info
 * detected from all E_ specialized sheet entries.
 */
export function useAvailableColumns(): Map<string, SheetColumnInfo> {
  const consolidated = useAppStore((s) => s.consolidated);

  return useMemo(() => {
    const colSets = new Map<string, Set<string>>();
    const entryCounts = new Map<string, number>();
    const contractSets = new Map<string, Set<string>>();

    for (const contract of consolidated) {
      for (const item of contract.items) {
        for (const entry of item.specializedData) {
          const type = entry.sheetType.toLowerCase();

          if (!colSets.has(type)) {
            colSets.set(type, new Set());
            entryCounts.set(type, 0);
            contractSets.set(type, new Set());
          }

          entryCounts.set(type, entryCounts.get(type)! + 1);
          contractSets.get(type)!.add(contract.contractId);

          for (const key of Object.keys(entry.data)) {
            colSets.get(type)!.add(key);
          }
        }
      }
    }

    const result = new Map<string, SheetColumnInfo>();
    for (const [type, cols] of colSets) {
      result.set(type, {
        columns: [...cols].sort(),
        entryCount: entryCounts.get(type) ?? 0,
        contractCount: contractSets.get(type)?.size ?? 0,
      });
    }
    return result;
  }, [consolidated]);
}
