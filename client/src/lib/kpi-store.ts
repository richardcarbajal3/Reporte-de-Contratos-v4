import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { EXECUTIVE_KPIS, type ExecutiveKpiDef } from './specialized-sheets-config';

interface KpiConfigState {
  customKpis: ExecutiveKpiDef[] | null;
  addKpi: (kpi: ExecutiveKpiDef) => void;
  updateKpi: (index: number, kpi: ExecutiveKpiDef) => void;
  removeKpi: (index: number) => void;
  resetToDefaults: () => void;
}

export const useKpiConfigStore = create<KpiConfigState>()(
  persist(
    (set, get) => ({
      customKpis: null,

      addKpi: (kpi) =>
        set((s) => ({
          customKpis: [...(s.customKpis ?? [...EXECUTIVE_KPIS]), kpi],
        })),

      updateKpi: (index, kpi) =>
        set((s) => {
          const list = [...(s.customKpis ?? [...EXECUTIVE_KPIS])];
          list[index] = kpi;
          return { customKpis: list };
        }),

      removeKpi: (index) =>
        set((s) => {
          const list = [...(s.customKpis ?? [...EXECUTIVE_KPIS])];
          list.splice(index, 1);
          return { customKpis: list };
        }),

      resetToDefaults: () => set({ customKpis: null }),
    }),
    { name: 'kpi-config' }
  )
);

/** Returns the user's custom KPIs or the built-in defaults */
export function getEffectiveKpis(state: KpiConfigState): ExecutiveKpiDef[] {
  return state.customKpis ?? EXECUTIVE_KPIS;
}
