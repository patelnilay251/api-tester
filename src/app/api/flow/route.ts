import { NextRequest } from 'next/server';
import getSupabaseServer from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    if (!supabase) return new Response('Supabase not configured', { status: 200 });

    const { id, name, content } = await req.json();
    if (!content) return new Response('Missing content', { status: 400 });

    if (id) {
      const { data, error } = await supabase
        .from('flows')
        .update({ name: name ?? null, content, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .single();
      if (error) return new Response('Update failed', { status: 500 });
      return Response.json({ id: data.id });
    }

    const { data, error } = await supabase
      .from('flows')
      .insert({ name: name ?? null, content })
      .select('id')
      .single();
    if (error) return new Response('Insert failed', { status: 500 });
    return Response.json({ id: data.id });
  } catch {
    return new Response('Flow save error', { status: 500 });
  }
}
