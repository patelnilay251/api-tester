"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Copy, Send, X } from 'lucide-react';
import useAppStore, { ChatMessage } from '@/store/appStore';

export default function ContextPanel() {
  const isContextOpen = useAppStore((s) => s.isContextOpen);
  const openContext = useAppStore((s) => s.openContext);
  const closeContext = useAppStore((s) => s.closeContext);
  const setContextText = useAppStore((s) => s.setContextText);
  const contextMessage = useAppStore((s) => s.contextMessage);
  const setContextMessage = useAppStore((s) => s.setContextMessage);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const messages = useAppStore((s) => s.contextMessages);
  const addMessage = useAppStore((s) => s.addContextMessage);
  const updateLastAssistant = useAppStore((s) => s.updateLastAssistantMessage);
  const clearMessages = useAppStore((s) => s.clearContextMessages);
  const conversationId = useAppStore((s) => s.contextConversationId);
  const setConversationId = useAppStore((s) => s.setContextConversationId);

  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const lastAssistantText = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].content;
    }
    return '';
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (isContextOpen) setTimeout(() => inputRef.current?.focus(), 150);
  }, [isContextOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, isStreaming, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const content = contextMessage.trim();
    if (!content || isStreaming) return;

    const prevHistory = messages.map((m) => ({ role: m.role, content: m.content }));

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      createdAt: Date.now(),
    };
    addMessage(userMsg);
    openContext();
    setIsStreaming(true);
    setContextMessage('');

    const assistantMsg: ChatMessage = {
      id: `a-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      createdAt: Date.now() + 1,
    };
    addMessage(assistantMsg);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          model: selectedModel,
          mode: 'context',
          messages: prevHistory,
        }),
      });

      if (!res.ok || !res.body) {
        updateLastAssistant('Error: Failed to stream response.');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let running = '';
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          running += chunk;
          updateLastAssistant(running);
          setContextText(running);
        }
      }
      // Persist the conversation turn (user + assistant)
      try {
        const saveRes = await fetch('/api/conversation', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, title: messages[0]?.content?.slice(0, 64) || 'Context Chat', model: selectedModel, user: content, assistant: running, type: 'context' })
        });
        const saved = await saveRes.json().catch(() => null);
        if (saved?.conversationId && !conversationId) setConversationId(saved.conversationId);
      } catch {}
    } catch (e) {
      console.error('Context stream error', e);
      updateLastAssistant('Error: Unable to reach assistant.');
    } finally {
      setIsStreaming(false);
    }
  }, [contextMessage, isStreaming, messages, addMessage, openContext, selectedModel, updateLastAssistant, setContextMessage, setContextText, conversationId, setConversationId]);

  const bubbleVariants = {
    initial: { opacity: 0, y: 8, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
  } as const;

  return (
    <AnimatePresence>
      {isContextOpen && (
        <motion.div
          key="context-panel"
          initial={{ x: 40, y: 20, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          exit={{ x: 40, y: 20, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="fixed right-6 bottom-6 z-[9998] w-[min(36rem,calc(100vw-3rem))] h-[60vh]"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="h-full glass-themed rounded-2xl flex flex-col origin-bottom-right"
            style={{ background: 'var(--node-bg)', borderColor: 'var(--node-border)', boxShadow: 'var(--shadow-lg)' }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--node-border)' }}>
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4" style={{ color: 'var(--node-text-muted)' }} />
                <div className="text-sm font-semibold" style={{ color: 'var(--node-text)' }}>
                  Context Chat
                </div>
                <div className="text-[11px] px-2 py-0.5 rounded-lg" style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text-muted)', border: '1px solid var(--node-border)' }}>
                  {selectedModel}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  className="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg:white/5"
                  style={{ color: 'var(--node-text)' }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      await navigator.clipboard.writeText(lastAssistantText || '');
                    } catch {}
                  }}
                  title="Copy last answer"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  className="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg:white/5"
                  style={{ color: 'var(--node-text)' }}
                  onClick={(e) => { e.stopPropagation(); clearMessages(); }}
                  title="Clear chat"
                >
                  Clear
                </button>
                <button
                  className="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg:white/5"
                  style={{ color: 'var(--node-text)' }}
                  onClick={(e) => { e.stopPropagation(); closeContext(); }}
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-2" style={{ background: 'var(--node-header-bg)' }}>
              <AnimatePresence initial={false}>
                {messages.length === 0 && (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.7 }}
                    exit={{ opacity: 0 }}
                    className="text-xs"
                    style={{ color: 'var(--node-text-muted)' }}
                  >
                    No conversation yet. Ask a question to get started.
                  </motion.div>
                )}
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    variants={bubbleVariants}
                    initial="initial"
                    animate="animate"
                    exit={{ opacity: 0, scale: 0.98 }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className="max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm"
                      style={
                        m.role === 'user'
                          ? {
                              backgroundColor: 'var(--button-primary-bg)',
                              color: 'var(--button-primary-text)',
                              border: '1px solid var(--node-border)',
                            }
                          : {
                              backgroundColor: 'var(--node-input-bg)',
                              color: 'var(--node-text)',
                              border: '1px solid var(--node-border)',
                            }
                      }
                    >
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    </div>
                  </motion.div>
                ))}
                {isStreaming && (
                  <motion.div
                    key="typing"
                    variants={bubbleVariants}
                    initial="initial"
                    animate="animate"
                    className="flex justify-start"
                  >
                    <div
                      className="rounded-2xl px-3 py-2 text-sm shadow-sm flex items-center gap-1"
                      style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', border: '1px solid var(--node-border)' }}
                    >
                      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--node-text-muted)' }} />
                      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--node-text-muted)', animationDelay: '150ms' }} />
                      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--node-text-muted)', animationDelay: '300ms' }} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t p-3 sticky bottom-0" style={{ borderColor: 'var(--node-border)', background: 'var(--node-bg)' }}>
              <div className="flex items-end gap-2">
                <textarea
                  rows={2}
                  placeholder="Ask for a contextual explanation..."
                  value={contextMessage}
                  onChange={(e) => setContextMessage(e.target.value)}
                  ref={inputRef}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1 px-3 py-2 rounded-xl border-0 focus:ring-0 text-sm"
                  style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', border: '1px solid var(--node-border)' }}
                  disabled={isStreaming}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleSend(); }}
                  className="px-3 py-2 rounded-xl"
                  disabled={!contextMessage.trim() || isStreaming}
                  style={{ backgroundColor: contextMessage.trim() ? 'var(--button-primary-bg)' : 'var(--node-input-bg)', color: contextMessage.trim() ? 'var(--button-primary-text)' : 'var(--node-text-muted)', border: '1px solid var(--node-border)' }}
                  title="Send"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
