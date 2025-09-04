import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Node.js runtime is fine here; Edge would also work if desired.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { message, model, mode, messages } = await req.json();
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
        ? 'You are the API Flow Tester agent. Keep replies concise and actionable (<= 120 words). Prefer compact bullets; avoid verbosity unless asked.'
        : 'You are the API Flow Tester assistant. Maintain conversation context, be clear and structured. Use short paragraphs and compact code blocks.';

    const history = Array.isArray(messages) ? messages : [];
    const trimmedHistory = history
      .filter((m) => m && typeof m.role === 'string' && typeof m.content === 'string')
      .slice(-16); // keep last 16 turns for context

    const result = await streamText({
      model: provider(modelName),
      messages: [
        { role: 'system', content: instructions },
        ...trimmedHistory,
        { role: 'user', content: userPrompt },
      ],
    });

    // Stream plain text chunks for simple client handling
    return result.toTextStreamResponse();
  } catch (err) {
    console.error('Agent route error:', err);
    return new Response('Agent error', { status: 500 });
  }
}
