import { polymindApi } from '@/services/polymind';

interface Opts {
  source?: 'official' | 'polymarket' | 'user';
  description?: string;
  attempts?: number;
  delayMs?: number;
}

export async function syncEventTx(signature: string, opts: Opts = {}) {
  const attempts = opts.attempts ?? 10;    // 10 × 0.5s ≈ RPC catchup window
  const delayMs  = opts.delayMs ?? 500;
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await polymindApi.syncEvent({
        signature,
        source:      opts.source,
        description: opts.description,
      });
      if (r.ret === 200) return r.data;
      if (r.ret !== 404) {
        throw new Error(r.msg || `syncEvent ret=${r.ret}`);
      }
    } catch (e) {
      lastErr = e;
    }
    await new Promise((res) => setTimeout(res, delayMs));
  }
  throw new Error(
    `syncEvent timed out after ${attempts} attempts (signature=${signature.slice(0, 12)}…): ` +
    (lastErr instanceof Error ? lastErr.message : String(lastErr ?? '404 from backend')),
  );
}
