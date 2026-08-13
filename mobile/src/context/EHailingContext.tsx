// src/context/EHailingContext.tsx
/**
 * Optional global context — use this if you want eHailing state
 * accessible from multiple screens (e.g. a persistent status bar,
 * notification badge, or history screen).
 *
 * Wrap your <EHailingNavigator /> (or root navigator) with
 * <EHailingProvider> inside App.tsx.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RequestRecord = {
  id: string;
  service_type: string;
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled";
  created_at: string;
  completed_at?: string;
  driver?: {
    driver_name: string;
    driver_phone: string;
    driver_vehicle: string;
  };
};

type EHailingContextType = {
  // Shared state
  activeRequestId: string | null;
  history: RequestRecord[];

  // Setters
  setActiveRequestId: (id: string | null) => void;
  addToHistory: (record: RequestRecord) => void;
  updateHistoryRecord: (id: string, updates: Partial<RequestRecord>) => void;
  clearHistory: () => void;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const EHailingContext = createContext<EHailingContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function EHailingProvider({ children }: { children: ReactNode }) {
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [history, setHistory] = useState<RequestRecord[]>([]);

  const addToHistory = useCallback((record: RequestRecord) => {
    setHistory((prev) => [record, ...prev]);
  }, []);

  const updateHistoryRecord = useCallback(
    (id: string, updates: Partial<RequestRecord>) => {
      setHistory((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      );
    },
    []
  );

  const clearHistory = useCallback(() => setHistory([]), []);

  return (
    <EHailingContext.Provider
      value={{
        activeRequestId,
        history,
        setActiveRequestId,
        addToHistory,
        updateHistoryRecord,
        clearHistory,
      }}
    >
      {children}
    </EHailingContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useEHailing() {
  const ctx = useContext(EHailingContext);
  if (!ctx) throw new Error("useEHailing must be used inside <EHailingProvider>");
  return ctx;
}
