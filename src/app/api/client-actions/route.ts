import { NextRequest } from 'next/server';
import getSupabaseServer from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    if (!supabase) return new Response('Supabase not configured', { status: 200 });
    const { type, flowId, runId, payload } = await req.json();
    if (!type) return new Response('Missing type', { status: 400 });
    await supabase.from('client_actions').insert({
      type,
      flow_id: flowId ?? null,
      run_id: runId ?? null,
      payload: payload ?? null,
    });
    return new Response('OK');
  } catch {
    return new Response('Log error', { status: 500 });
  }
}
