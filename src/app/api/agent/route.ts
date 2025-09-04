import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

// Node.js runtime is fine here; Edge would also work if desired.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { message, model, mode } = await req.json();
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
        ? 'You are the API Flow Tester agent. Give concise, actionable output (ideally <= 120 words). Prefer bullets, avoid long explanations unless asked. '
        : 'You are the API Flow Tester assistant. Provide a clear, readable explanation. Use short paragraphs and compact code blocks.';

    const result = await streamText({
      model: provider(modelName),
      messages: [
        { role: 'system', content: instructions },
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
