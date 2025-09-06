'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, ChevronDown, X } from 'lucide-react';
import useAppStore from '@/store/appStore';
import { getAgentContext, applyAgentAction } from '@/lib/agentBridge';

export default function AgentChatBar() {
  const isChatOpen = useAppStore((s) => s.isChatOpen);
  const openChat = useAppStore((s) => s.openChat);
  const closeChat = useAppStore((s) => s.closeChat);
  const chatMessage = useAppStore((s) => s.chatMessage);
  const setChatMessage = useAppStore((s) => s.setChatMessage);
  const selectedModel = useAppStore((s) => s.selectedModel);
  const setSelectedModel = useAppStore((s) => s.setSelectedModel);
  const appendMessage = useAppStore((s) => s.appendMessage);
  const messages = useAppStore((s) => s.messages);
  const runStatus = useAppStore((s) => s.runStatus);
  const setRunStatus = useAppStore((s) => s.setRunStatus);
  const upsertStep = useAppStore((s) => s.upsertStep);
  const [isAssistantStreaming, setIsAssistantStreaming] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Focus input when chat opens
  useEffect(() => {
    if (isChatOpen) {
      const t = setTimeout(() => chatInputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [isChatOpen]);

  const handleSendAgentMessage = useCallback(async () => {
    const msg = chatMessage.trim();
    if (!msg || isAssistantStreaming) return;

    try {
      setIsAssistantStreaming(true);
      setRunStatus('running');
      // Append user message to minimal history
      appendMessage({ role: 'user', content: msg });

      const canvasContext = getAgentContext();
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, model: selectedModel, mode: 'agent', messages, canvasContext }),
      });

      if (!res.ok || !res.body) {
        setIsAssistantStreaming(false);
        setRunStatus('idle');
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let running = '';
      let buffer = '';
      const flushEvent = async (raw: string) => {
        // Parse minimal SSE: event: <name>\n data: <json or text>\n\n
        const lines = raw.split('\n');
        let ev = 'message';
        const dataLines: string[] = [];
        for (const line of lines) {
          if (line.startsWith('event:')) ev = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        const dataRaw = dataLines.join('\n');
        if (ev === 'token') {
          running += dataRaw;
        } else if (ev === 'step_start') {
          try {
            const d = JSON.parse(dataRaw);
            upsertStep({ id: d.id, idx: 0, type: d.type || 'llm', status: 'running', title: d.title });
          } catch {}
        } else if (ev === 'step_end') {
          try {
            const d = JSON.parse(dataRaw);
            upsertStep({ id: d.id, idx: 0, type: 'llm', status: d.status || 'succeeded', title: '' });
          } catch {}
        } else if (ev === 'action') {
          try {
            const action = JSON.parse(dataRaw);
            await applyAgentAction(action);
          } catch (e) {
            console.error('Failed to apply action from stream', e);
          }
        } else if (ev === 'done') {
          // handled after loop
        } else {
          // Fallback: treat as text token for plain text streams
          running += dataRaw;
        }
      };

      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          if (contentType.includes('text/event-stream')) {
            buffer += chunk;
            let idx;
            while ((idx = buffer.indexOf('\n\n')) !== -1) {
              const eventChunk = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              if (eventChunk.trim()) await flushEvent(eventChunk);
            }
          } else {
            running += chunk;
          }
        }
      }
      if (buffer.trim()) await flushEvent(buffer);
      if (running.trim()) appendMessage({ role: 'assistant', content: running });
    } catch (e) {
      console.error('Agent stream error', e);
    } finally {
      setIsAssistantStreaming(false);
      setRunStatus('idle');
      setChatMessage('');
    }
  }, [chatMessage, selectedModel, isAssistantStreaming, setChatMessage, setRunStatus, appendMessage, messages, upsertStep]);

  // Expose a way to programmatically open chat and focus
  useEffect(() => {
    // if someone called openChat() externally, we already handle focus above
    // ensure function is referenced to avoid tree-shaking when imported solely for side effects
    void openChat;
  }, [openChat]);

  return (
    <motion.div
      initial={false}
      animate={isChatOpen ? { opacity: 1, y: 0 } : { opacity: 0, y: 80 }}
      transition={{ duration: 0.25, ease: [0.4, 0.0, 0.2, 1], opacity: { duration: 0.15 } }}
      className={`fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[9999] w-full max-w-4xl px-6 chat-overlay ${isChatOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      style={{ willChange: 'transform, opacity' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-3 glass-themed rounded-2xl chat-bar"
        style={{ background: 'var(--node-bg)', borderColor: 'var(--node-border)', boxShadow: 'var(--node-shadow)' }}
        onMouseDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Model Selection */}
        <div className="relative">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="appearance-none px-3 py-2.5 pr-7 text-xs rounded-xl border-0 focus:ring-0"
            style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', cursor: 'pointer', border: '1px solid var(--node-border)' }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--node-text-muted)' }} />
        </div>

        {/* Assistant typing indicator (compact) */}
        {isAssistantStreaming && (
          <div className="flex-none">
            <div
              className="px-2 py-2 text-xs rounded-xl relative flex items-center gap-2"
              style={{
                backgroundColor: 'var(--node-input-bg)',
                color: 'var(--node-text)',
                border: '1px solid var(--node-border)'
              }}
              title="Assistant typing"
            >
              <div className="flex items-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--node-text-muted)' }} />
                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--node-text-muted)', animationDelay: '150ms' }} />
                <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--node-text-muted)', animationDelay: '300ms' }} />
              </div>
              <span>Assistant typing…</span>
            </div>
          </div>
        )}

        {/* Chat Input */}
        <div className="flex-1">
          <input
            type="text"
            placeholder="Ask AI about API testing, debugging, automation..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendAgentMessage();
              }
            }}
            ref={chatInputRef}
            className="w-full px-4 py-2.5 rounded-xl border-0 focus:ring-0 text-sm"
            style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', cursor: 'text', border: '1px solid var(--node-border)' }}
            disabled={isAssistantStreaming}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Action Buttons + Status */}
        <div className="flex gap-1">
          {/* Optional run status pill */}
          <div
            className="px-2 py-2 rounded-xl text-[11px] hidden md:block"
            style={{
              backgroundColor: 'var(--node-input-bg)',
              color: runStatus === 'running' ? 'var(--button-primary-bg)' : 'var(--node-text-muted)',
              border: '1px solid var(--node-border)'
            }}
            title={`Run status: ${runStatus}`}
          >
            {runStatus === 'running' ? 'Running' : 'Idle'}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); handleSendAgentMessage(); }}
            onMouseDown={(e) => e.stopPropagation()}
            disabled={!chatMessage.trim() || isAssistantStreaming}
            className="px-3 py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: chatMessage.trim() ? 'var(--button-primary-bg)' : 'var(--node-input-bg)', color: chatMessage.trim() ? 'var(--button-primary-text)' : 'var(--node-text-muted)', cursor: chatMessage.trim() ? 'pointer' : 'not-allowed', border: '1px solid var(--node-border)' }}
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); closeChat(); }}
            onMouseDown={(e) => e.stopPropagation()}
            className="px-3 py-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text-muted)', cursor: 'pointer', border: '1px solid var(--node-border)' }}
            title="Close Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
