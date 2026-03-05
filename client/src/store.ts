import { create } from 'zustand';
import { ContractData, ConsolidatedContract } from './lib/excel-processor';

interface AppState {
  contracts: ContractData[];
  consolidated: ConsolidatedContract[];
  lastUpdated: Date | null;
  setData: (contracts: ContractData[], consolidated: ConsolidatedContract[]) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  contracts: [],
  consolidated: [],
  lastUpdated: null,
  setData: (contracts, consolidated) => set({ contracts, consolidated, lastUpdated: new Date() }),
  reset: () => set({ contracts: [], consolidated: [], lastUpdated: null }),
}));
