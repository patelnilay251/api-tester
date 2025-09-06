import getSupabaseServer from '@/lib/supabase';

export type RunStatus = 'running' | 'succeeded' | 'failed' | 'canceled' | 'idle';

export interface StepRecord {
  id: string;
  type: 'llm' | 'http' | 'tool' | 'assert';
  status: RunStatus;
  title?: string;
  started_at?: string; // ISO
  ended_at?: string;   // ISO
  meta?: Record<string, unknown>;
}

export async function saveRun(opts: {
  model: string;
  mode: string;
  userPrompt: string;
  assistantText: string;
  steps: StepRecord[];
}): Promise<string | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  try {
    const overall: RunStatus = opts.steps.some((s) => s.status === 'failed')
      ? 'failed'
      : 'succeeded';

    const { data: runRow, error: runErr } = await supabase
      .from('runs')
      .insert({ model: opts.model, mode: opts.mode, status: overall })
      .select('id')
      .single();
    if (runErr || !runRow) return null;
    const runId: string = runRow.id;

    // messages: user + assistant
    const messagesPayload = [
      { run_id: runId, role: 'user', content: opts.userPrompt },
      { run_id: runId, role: 'assistant', content: opts.assistantText },
    ];
    await supabase.from('messages').insert(messagesPayload);

    // steps
    if (opts.steps.length > 0) {
      const stepsPayload = opts.steps.map((s) => ({
        id: s.id,
        run_id: runId,
        type: s.type,
        status: s.status,
        title: s.title ?? null,
        started_at: s.started_at ?? null,
        ended_at: s.ended_at ?? null,
        meta: s.meta ?? null,
      }));
      await supabase.from('steps').insert(stepsPayload);
    }
    return runId;
  } catch {
    return null;
  }
}

export default saveRun;

