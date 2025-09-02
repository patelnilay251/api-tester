'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export interface HistoryItem {
  id: string;
  timestamp: number;
  method: string;
  url: string;
  status?: number;
  responseTime?: number;
  success: boolean;
  request: {
    url: string;
    method: string;
    headers: Record<string, string>;
    data: unknown;
    queryParams?: { key: string; value: string }[];
    usedBearer?: boolean;
  };
}

interface HistoryContextType {
  items: HistoryItem[];
  add: (item: HistoryItem) => void;
  clear: () => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);
const LS_KEY = 'api-tester:history';
const MAX_ITEMS = 50;

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const add = (item: HistoryItem) => {
    setItems((prev) => [item, ...prev].slice(0, MAX_ITEMS));
  };

  const clear = () => setItems([]);

  return (
    <HistoryContext.Provider value={{ items, add, clear }}>
      {children}
    </HistoryContext.Provider>
  );
}

export function useHistoryLog() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error('useHistoryLog must be used within HistoryProvider');
  return ctx;
}

