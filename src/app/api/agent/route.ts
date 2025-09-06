import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { httpRequest } from '@/lib/httpRequest';
import saveRun, { StepRecord } from '@/lib/persistence';

// Node.js runtime is fine here; Edge would also work if desired.
export const runtime = 'nodejs';

function sseEncode(event: string, data: string) {
  return `event: ${event}\ndata: ${data}\n\n`;
}

function extractActionsFromText(text: string): unknown[] | null {
  try {
    const markerIdx = text.lastIndexOf('ACTIONS:');
    if (markerIdx !== -1) {
      const after = text.slice(markerIdx + 'ACTIONS:'.length);
      const cleaned = after.replace(/```(?:json)?/g, '').trim();
      const start = cleaned.indexOf('[');
      const end = cleaned.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        const json = cleaned.slice(start, end + 1);
        const arr = JSON.parse(json);
        return Array.isArray(arr) ? arr : null;
      }
    }
    const m = text.match(/<actions>([\s\S]*?)<\/actions>/i);
    if (m) {
      const json = m[1].trim();
      const arr = JSON.parse(json);
      return Array.isArray(arr) ? arr : null;
    }
  } catch {}
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { message, model, mode, messages, tool, canvasContext } = await req.json();
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return new Response(
        'Missing GOOGLE_GENERATIVE_AI_API_KEY. Set it in Vercel env or .env.local.',
        { status: 500 }
      );
    }

    const provider = createGoogleGenerativeAI({ apiKey });
    const modelName: string = (model || 'gemini-2.5-flash').toString();
    const userPrompt: string = (message || '').toString();

    if (!userPrompt.trim()) {
      return new Response('Empty message', { status: 400 });
    }

    const instructions =
      mode === 'agent'
        ? [
            'You are the API Flow Tester agent. Keep replies concise and actionable (<= 120 words).',
            'When asked to operate on the canvas, propose concrete actions using the schema below.',
            'At the end of your reply, append an ACTIONS: marker followed by a pure JSON array of actions. Do not include prose after the array.',
            'Schema (types):',
            '{"type":"create_request_node","name?":"string","position?":{"x?":number,"y?":number},"request?":{"url?":"string","method?":"GET|POST|PUT|DELETE|PATCH","headers?":Record<string,string>,"body?":unknown,"queryParams?":{"key":"string","value":"string"}[]}}',
            '{"type":"update_request","nodeId":"string","patch":{"url?":"string","method?":"GET|POST|PUT|DELETE|PATCH","headers?":Record<string,string>,"body?":unknown,"queryParams?":Array}}',
            '{"type":"send_request","nodeId":"string"}',
            '{"type":"connect_nodes","sourceId":"string","targetId":"string"}',
            '{"type":"rename_node","nodeId":"string","name":"string"}',
            '{"type":"delete_node","nodeId":"string"}',
            '{"type":"add_assertion","nodeId":"string","assertion": {"type":"status","equals":number} | {"type":"bodyContains","text":"string"} | {"type":"headerContains","header":"string","text":"string"}}',
            '{"type":"remove_assertion","nodeId":"string","assertionId?":"string","match?":{"type":"status"|"bodyContains"|"headerContains"}}',
          ].join('\n')
        : 'You are the API Flow Tester assistant. Maintain conversation context, be clear and structured. Use short paragraphs and compact code blocks.';

    const history: Array<{ role: string; content: string }> = Array.isArray(messages)
      ? (messages as Array<{ role: string; content: string }>)
      : [];
    const trimmedHistory = history
      .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
      .slice(-16); // keep last 16 turns for context

    // If not agent mode, keep simple text streaming for compatibility (Context Panel)
    if (mode !== 'agent') {
      const normalizedHistory = trimmedHistory.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }));
      const result = await streamText({
        model: provider(modelName),
        messages: [
          { role: 'system', content: instructions },
          ...(canvasContext ? [{ role: 'system' as const, content: `Canvas Context (JSON):\n${JSON.stringify(canvasContext)}` }] : []),
          ...normalizedHistory,
          { role: 'user', content: userPrompt },
        ],
      });
      return result.toTextStreamResponse();
    }

    // Agent mode: emit SSE with step events and tokens
    const encoder = new TextEncoder();
    const llmStepId = `llm-${Date.now()}`;
    const stepRecords: StepRecord[] = [];
    const nowIso = () => new Date().toISOString();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // Optional tool call (http_request) before LLM
          if (tool && tool.name === 'http_request') {
            const toolStepId = `http-${Date.now()}`;
            controller.enqueue(encoder.encode(sseEncode('step_start', JSON.stringify({ id: toolStepId, type: 'http', title: 'HTTP Request', status: 'running' }))));
            const httpStart = nowIso();
            try {
              const result = await httpRequest(tool.args || {});
              controller.enqueue(encoder.encode(sseEncode('step_end', JSON.stringify({ id: toolStepId, status: 'succeeded' }))));
              const summary = `HTTP ${result.status} in ${result.responseTime}ms`;
              controller.enqueue(encoder.encode(sseEncode('token', summary)));
              stepRecords.push({
                id: toolStepId,
                type: 'http',
                status: 'succeeded',
                title: 'HTTP Request',
                started_at: httpStart,
                ended_at: nowIso(),
                meta: { status: result.status, responseTime: result.responseTime, url: result.url, fromCache: result.fromCache },
              });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              controller.enqueue(encoder.encode(sseEncode('step_end', JSON.stringify({ id: toolStepId, status: 'failed', error: msg }))));
              stepRecords.push({ id: toolStepId, type: 'http', status: 'failed', title: 'HTTP Request', started_at: httpStart, ended_at: nowIso(), meta: { error: msg } });
            }
          }

          controller.enqueue(encoder.encode(sseEncode('step_start', JSON.stringify({ id: llmStepId, type: 'llm', title: `Model: ${modelName}`, status: 'running' }))));
          const llmStart = nowIso();

          const normalizedHistory2 = trimmedHistory.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
            content: m.content,
          }));
          const result = await streamText({
            model: provider(modelName),
            messages: [
              { role: 'system', content: instructions },
              ...(canvasContext ? [{ role: 'system' as const, content: `Canvas Context (JSON):\n${JSON.stringify(canvasContext)}` }] : []),
              ...normalizedHistory2,
              { role: 'user', content: userPrompt },
            ],
          });
          const base = result.toTextStreamResponse();
          const reader = base.body!.getReader();
          const decoder = new TextDecoder();
          let assistantText = '';
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              const chunk = decoder.decode(value, { stream: true });
              if (chunk) {
                controller.enqueue(encoder.encode(sseEncode('token', chunk)));
                assistantText += chunk;
              }
            }
          }
          // Try to parse actions and emit them
          try {
            const actions = extractActionsFromText(assistantText);
            if (actions && Array.isArray(actions)) {
              for (const a of actions) {
                controller.enqueue(encoder.encode(sseEncode('action', JSON.stringify(a))));
              }
            }
          } catch {}
          controller.enqueue(encoder.encode(sseEncode('step_end', JSON.stringify({ id: llmStepId, status: 'succeeded' }))));
          stepRecords.push({ id: llmStepId, type: 'llm', status: 'succeeded', title: `Model: ${modelName}`, started_at: llmStart, ended_at: nowIso() });
          controller.enqueue(encoder.encode(sseEncode('done', '')));
          try {
            await saveRun({ model: modelName, mode: String(mode || 'agent'), userPrompt, assistantText, steps: stepRecords });
          } catch {}
          controller.close();
        } catch (e: unknown) {
          try {
            const msg = e instanceof Error ? e.message : String(e);
            controller.enqueue(encoder.encode(sseEncode('step_end', JSON.stringify({ id: llmStepId, status: 'failed', error: msg }))));
            stepRecords.push({ id: llmStepId, type: 'llm', status: 'failed', title: `Model: ${modelName}` });
            controller.enqueue(encoder.encode(sseEncode('done', '')));
            try { await saveRun({ model: modelName, mode: String(mode || 'agent'), userPrompt, assistantText: '', steps: stepRecords }); } catch {}
          } finally {
            controller.close();
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('Agent route error:', err);
    return new Response('Agent error', { status: 500 });
  }
}
