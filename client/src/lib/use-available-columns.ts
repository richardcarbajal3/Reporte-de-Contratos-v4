import { useMemo } from 'react';
import { useAppStore } from '@/store';

/**
 * Scans loaded data and returns a Map of sheetType → column names[]
 * detected from all E_ specialized sheet entries.
 */
export function useAvailableColumns(): Map<string, string[]> {
  const consolidated = useAppStore((s) => s.consolidated);

  return useMemo(() => {
    const map = new Map<string, Set<string>>();

    for (const contract of consolidated) {
      for (const item of contract.items) {
        for (const entry of item.specializedData) {
          const type = entry.sheetType.toLowerCase();
          if (!map.has(type)) map.set(type, new Set());
          const cols = map.get(type)!;
          for (const key of Object.keys(entry.data)) {
            cols.add(key);
          }
        }
      }
    }

    // Convert Sets to sorted arrays
    const result = new Map<string, string[]>();
    for (const [type, cols] of map) {
      result.set(type, [...cols].sort());
    }
    return result;
  }, [consolidated]);
}
