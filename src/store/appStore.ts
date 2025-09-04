import { create } from 'zustand';

type RunStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface RunStep {
  id: string;
  idx: number;
  type: 'llm' | 'tool' | 'http' | 'assert';
  status: RunStatus;
  title?: string;
}

interface AppState {
  // UI toggles
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;

  isEnvOpen: boolean;
  setIsEnvOpen: (open: boolean) => void;

  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;

  isChatOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;

  chatMessage: string;
  setChatMessage: (v: string) => void;

  selectedModel: string;
  setSelectedModel: (v: string) => void;

  // Context side panel
  isContextOpen: boolean;
  openContext: () => void;
  closeContext: () => void;
  contextText: string;
  setContextText: (t: string) => void;
  contextMessage: string;
  setContextMessage: (t: string) => void;

  // Agent/run state (placeholder for future integration)
  activeRunId?: string;
  setActiveRunId: (id?: string) => void;
  runStatus: RunStatus;
  setRunStatus: (s: RunStatus) => void;
  steps: RunStep[];
  setSteps: (steps: RunStep[]) => void;
  upsertStep: (step: RunStep) => void;
  resetRun: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // UI
  isMenuOpen: false,
  setIsMenuOpen: (open) => set({ isMenuOpen: open }),

  isEnvOpen: false,
  setIsEnvOpen: (open) => set({ isEnvOpen: open }),

  isHistoryOpen: false,
  setIsHistoryOpen: (open) => set({ isHistoryOpen: open }),

  isChatOpen: false,
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),

  chatMessage: '',
  setChatMessage: (v) => set({ chatMessage: v }),

  selectedModel: 'gemini-2.5-flash',
  setSelectedModel: (v) => set({ selectedModel: v }),

  isContextOpen: false,
  openContext: () => set({ isContextOpen: true }),
  closeContext: () => set({ isContextOpen: false }),
  contextText: '',
  setContextText: (t) => set({ contextText: t }),
  contextMessage: '',
  setContextMessage: (t) => set({ contextMessage: t }),

  // Run state
  activeRunId: undefined,
  setActiveRunId: (id) => set({ activeRunId: id }),
  runStatus: 'idle',
  setRunStatus: (s) => set({ runStatus: s }),
  steps: [],
  setSteps: (steps) => set({ steps }),
  upsertStep: (step) => {
    const { steps } = get();
    const idx = steps.findIndex((s) => s.id === step.id);
    if (idx === -1) set({ steps: [...steps, step] });
    else set({ steps: steps.map((s) => (s.id === step.id ? step : s)) });
  },
  resetRun: () => set({ activeRunId: undefined, runStatus: 'idle', steps: [] }),
}));

export default useAppStore;
