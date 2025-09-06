import { NextRequest } from 'next/server';
import getSupabaseServer from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    if (!supabase) return new Response('Supabase not configured', { status: 200 });
    const { conversationId, title, model, user, assistant, type } = await req.json();
    const convType = (type === 'context' || type === 'agent') ? type : 'context';
    let id = conversationId as string | undefined;
    if (!id) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({ title: title ?? null, model: model ?? null, type: convType })
        .select('id')
        .single();
      if (error || !data) return new Response('Conversation create failed', { status: 500 });
      id = data.id as string;
    }
    const payload = [] as Array<{ conversation_id: string; role: 'user'|'assistant'; content: string }>;
    if (user) payload.push({ conversation_id: id!, role: 'user', content: String(user) });
    if (assistant) payload.push({ conversation_id: id!, role: 'assistant', content: String(assistant) });
    if (payload.length > 0) await supabase.from('conv_messages').insert(payload);
    return Response.json({ conversationId: id });
  } catch {
    return new Response('Conversation error', { status: 500 });
  }
}
