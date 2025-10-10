import { create } from "zustand";

export interface ProxyStatus {
  is_running: boolean;
  port: number;
  requests_captured: number;
}

interface ProxyState {
  status: ProxyStatus | null;
  setStatus: (status: ProxyStatus) => void;
}

export const useProxyStore = create<ProxyState>((set) => ({
  status: null,
  setStatus: (status) => set({ status }),
}));
