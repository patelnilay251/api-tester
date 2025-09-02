'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type EnvVars = Record<string, string>;

interface EnvironmentContextType {
  baseUrl: string;
  token: string;
  vars: EnvVars;
  setBaseUrl: (v: string) => void;
  setToken: (v: string) => void;
  setVar: (key: string, value: string) => void;
  removeVar: (key: string) => void;
  resolveString: (input: string) => string;
  resolveDeep: <T>(input: T) => T;
}

const EnvContext = createContext<EnvironmentContextType | undefined>(undefined);

const LS_KEY = 'api-tester:env';

export function EnvironmentProvider({ children }: { children: React.ReactNode }) {
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [vars, setVars] = useState<EnvVars>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setBaseUrl(parsed.baseUrl || '');
        setToken(parsed.token || '');
        setVars(parsed.vars || {});
      }
    } catch {}
  }, []);

  useEffect(() => {
    const payload = { baseUrl, token, vars };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {}
  }, [baseUrl, token, vars]);

  const allVars: Record<string, string> = useMemo(() => ({ ...vars, baseUrl, token }), [vars, baseUrl, token]);

  const resolveString = (input: string) => {
    if (!input) return input;
    return input.replace(/\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g, (_, key: string) => {
      const v = allVars[key];
      return v != null ? String(v) : '';
    });
  };

  const resolveDeep = <T,>(input: T): T => {
    if (typeof input === 'string') return resolveString(input) as unknown as T;
    if (Array.isArray(input)) return input.map((v) => resolveDeep(v)) as unknown as T;
    if (input && typeof input === 'object') {
      const out: Record<string, unknown> = {};
      Object.entries(input as Record<string, unknown>).forEach(([k, v]) => {
        out[k] = resolveDeep(v as unknown as T);
      });
      return out as unknown as T;
    }
    return input;
  };

  const value: EnvironmentContextType = {
    baseUrl,
    token,
    vars,
    setBaseUrl,
    setToken,
    setVar: (key: string, value: string) => setVars((prev) => ({ ...prev, [key]: value })),
    removeVar: (key: string) => setVars((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    }),
    resolveString,
    resolveDeep,
  };

  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>;
}

export function useEnv() {
  const ctx = useContext(EnvContext);
  if (!ctx) throw new Error('useEnv must be used within EnvironmentProvider');
  return ctx;
}
