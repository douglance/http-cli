import { create } from "zustand";
import type { NetworkEvent } from "../lib/httpClient.js";

interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  events?: NetworkEvent[];
  timings?: {
    dnsLookup?: number;
    tcpConnection?: number;
    tlsHandshake?: number;
    firstByte?: number;
    total?: number;
  };
}

interface RequestState {
  isLoading: boolean;
  response: HttpResponse | null;
  networkEvents: NetworkEvent[];
  setLoading: (loading: boolean) => void;
  setResponse: (response: HttpResponse | null) => void;
  addNetworkEvent: (event: NetworkEvent) => void;
  clearNetworkEvents: () => void;
}

export const useRequestStore = create<RequestState>((set) => ({
  isLoading: false,
  response: null,
  networkEvents: [],
  setLoading: (loading) => set({ isLoading: loading }),
  setResponse: (response) => set({ response }),
  addNetworkEvent: (event) => set((state) => ({ networkEvents: [...state.networkEvents, event] })),
  clearNetworkEvents: () => set({ networkEvents: [] }),
}));
