import { create } from 'zustand';

type RunStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'canceled';

export interface RunStep {
  id: string;
  idx: number;
  type: 'llm' | 'tool' | 'http' | 'assert';
  status: RunStatus;
  title?: string;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
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

  // Context chat history
  contextMessages: ChatMessage[];
  setContextMessages: (msgs: ChatMessage[]) => void;
  addContextMessage: (msg: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearContextMessages: () => void;

  // General chat (AgentChatBar) minimal history
  messages: { role: 'user' | 'assistant'; content: string }[];
  appendMessage: (msg: { role: 'user' | 'assistant'; content: string }) => void;
  clearMessages: () => void;

  // Persistence ids
  activeFlowId?: string;
  setActiveFlowId: (id?: string) => void;
  contextConversationId?: string;
  setContextConversationId: (id?: string) => void;

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

  contextMessages: [],
  setContextMessages: (msgs) => set({ contextMessages: msgs }),
  addContextMessage: (msg) => set((s) => ({ contextMessages: [...s.contextMessages, msg] })),
  updateLastAssistantMessage: (content) => set((s) => {
    const msgs = s.contextMessages.slice();
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant') {
        msgs[i] = { ...msgs[i], content };
        break;
      }
    }
    return { contextMessages: msgs };
  }),
  clearContextMessages: () => set({ contextMessages: [] }),

  // General chat history for the chat bar
  messages: [],
  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  clearMessages: () => set({ messages: [] }),

  // Persistence ids
  activeFlowId: undefined,
  setActiveFlowId: (id) => set({ activeFlowId: id }),
  contextConversationId: undefined,
  setContextConversationId: (id) => set({ contextConversationId: id }),

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
