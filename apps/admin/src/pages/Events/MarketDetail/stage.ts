import type { MarketState, MarketConfig } from '@/services/polymind';

export type Stage =
  | 'loading'
  | 'betting'
  | 'awaiting_proposal'
  | 'expired_takeover'
  | 'expired_voidable'
  | 'in_review'
  | 'ready_finalize'
  | 'dispute_pending'
  | 'settled'
  | 'emergency_voidable';

export interface MergedCfg {
  creator_propose_timeout_secs?: number;
  expired_propose_mode?: number;
  dispute_window_secs?: number;
  admin_timeout_secs?: number;
  [k: string]: unknown;
}

export function computeStage(
  m: MarketState | null,
  cfg: MergedCfg | null,
  now: number,
): Stage {
  if (!m || !cfg) return 'loading';
  if (m.finalized) return 'settled';
  if (m.dispute_active) return 'dispute_pending';
  if (m.proposed_outcome === 0) {
    if (now < m.deadline) return 'betting';
    const proposeEnd = m.deadline + (cfg.creator_propose_timeout_secs || 0);
    if (now < proposeEnd) return 'awaiting_proposal';
    return Number(cfg.expired_propose_mode) === 1
      ? 'expired_voidable'
      : 'expired_takeover';
  }
  const windowEnd = m.proposed_at + (cfg.dispute_window_secs || 0);
  const adminTimeoutEnd = m.proposed_at + (cfg.admin_timeout_secs || 0);
  if (now >= adminTimeoutEnd) return 'emergency_voidable';
  if (now >= windowEnd) return 'ready_finalize';
  return 'in_review';
}

export const STAGE_LABEL: Record<Stage, string> = {
  loading:             'Loading',
  betting:             'Betting open',
  awaiting_proposal:   'Awaiting creator propose',
  expired_takeover:    'Open to participants',
  expired_voidable:    'Expired (creator slash)',
  in_review:           'In review',
  ready_finalize:      'Ready to finalize',
  dispute_pending:     'Disputed',
  emergency_voidable:  'Emergency voidable',
  settled:             'Settled',
};

export const STAGE_TONE: Record<Stage, 'default' | 'processing' | 'success' | 'warning' | 'error'> = {
  loading:             'default',
  betting:             'success',
  awaiting_proposal:   'warning',
  expired_takeover:    'warning',
  expired_voidable:    'error',
  in_review:           'processing',
  ready_finalize:      'success',
  dispute_pending:     'error',
  emergency_voidable:  'error',
  settled:             'default',
};
