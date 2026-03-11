import { create } from 'zustand';
import { ContractData, ConsolidatedContract, SpecializedSheetLog } from './lib/excel-processor';

interface AppState {
  contracts: ContractData[];
  consolidated: ConsolidatedContract[];
  specializedSheetLogs: SpecializedSheetLog[];
  lastUpdated: Date | null;
  setData: (contracts: ContractData[], consolidated: ConsolidatedContract[], specializedSheetLogs?: SpecializedSheetLog[]) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  contracts: [],
  consolidated: [],
  specializedSheetLogs: [],
  lastUpdated: null,
  setData: (contracts, consolidated, specializedSheetLogs = []) =>
    set({ contracts, consolidated, specializedSheetLogs, lastUpdated: new Date() }),
  reset: () => set({ contracts: [], consolidated: [], specializedSheetLogs: [], lastUpdated: null }),
}));
