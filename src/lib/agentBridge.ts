import type { CanvasContextPayload, CanvasAction } from '@/types/agent';

type CtxProvider = () => CanvasContextPayload | null;
type ActionApplier = (action: CanvasAction) => Promise<void> | void;

let ctxProvider: CtxProvider | null = null;
let actionApplier: ActionApplier | null = null;

export function setAgentContextProvider(fn: CtxProvider) {
  ctxProvider = fn;
}

export function getAgentContext(): CanvasContextPayload | null {
  return ctxProvider ? ctxProvider() : null;
}

export function setAgentActionApplier(fn: ActionApplier) {
  actionApplier = fn;
}

export async function applyAgentAction(action: CanvasAction) {
  if (!actionApplier) return;
  await actionApplier(action);
}

