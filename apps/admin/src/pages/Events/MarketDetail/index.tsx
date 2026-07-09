import { PageContainer } from '@ant-design/pro-components';
import { Alert, Badge, Button, Card, Descriptions, Input, Modal, Space, Spin, Tag } from 'antd';
import { useIntl, useParams } from '@umijs/max';
import { useEffect, useMemo, useState } from 'react';
import {
  polymindApi,
  type MarketState,
  type MarketConfig,
} from '@/services/polymind';
import { formatDate } from '@/utils/format';
import {
  v3AdminFinalize,
  v3EmergencyVoid,
  v3ExpireUnproposed,
  v3FinalizeProposed,
  v3ProposeOutcome,
} from '@/wallet/endless';
import { useAdminTx } from '@/hooks/useAdminTx';
import { computeStage, STAGE_LABEL, STAGE_TONE, type Stage } from './stage';

const EDS = 1e8;
const OUTCOME = ['—', 'YES', 'NO', 'VOID'];

const fmtEds = (base: string | number) => (Number(base) / EDS).toFixed(2);
const fmtPct = (a: string, b: string) => {
  const x = Number(a);
  const y = Number(b);
  const total = x + y;
  return total > 0 ? ((x / total) * 100).toFixed(1) : '0';
};

export default function MarketDetailPage() {
  const intl = useIntl();
  const tr = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  const { slug = '', idx = '0' } = useParams();
  const marketIdx = Number(idx);
  const [state, setState] = useState<MarketState | null>(null);
  const [globalCfg, setGlobalCfg] = useState<Record<string, unknown> | null>(null);
  const [marketCfg, setMarketCfg] = useState<MarketConfig | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [eventOnchainId, setEventOnchainId] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  const [adminOverrideOpen, setAdminOverrideOpen] = useState(false);
  const [overrideOutcome, setOverrideOutcome] = useState<1 | 2 | 3>(1);
  const [overrideReason, setOverrideReason] = useState('');
  const [err, setErr] = useState('');
  const adminTx = useAdminTx();

  const [marketSlug, setMarketSlug] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    polymindApi
      .eventDetail(slug)
      .then((d) => {
        if (!cancelled) {
          setEventOnchainId(d.onchain_event_id ?? null);
          const m = (d.markets || []).find((x) => x.market_idx === marketIdx);
          setMarketSlug(m?.slug || null);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, marketIdx]);

  useEffect(() => {
    polymindApi.getConfig().then(setGlobalCfg).catch(() => {});
  }, []);

  useEffect(() => {
    setMarketCfg(null);
  }, [marketSlug]);

  useEffect(() => {
    if (!marketSlug) return;
    let cancelled = false;
    const loadState = () =>
      polymindApi
        .marketState(marketSlug)
        .then((s) => {
          if (!cancelled) setState(s);
        })
        .catch((e: Error) => {
          if (!cancelled) setErr(e.message);
        });
    const loadCfg = () =>
      polymindApi
        .marketConfig(marketSlug)
        .then((c) => {
          if (!cancelled) setMarketCfg(c);
        })
        .catch(() => {});
    loadState();
    loadCfg();
    const t = setInterval(() => {
      loadState();
      loadCfg();
    }, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [eventOnchainId, marketIdx, reload]);

  const bumpReload = () => {
    [0, 1200, 4000].forEach((ms) =>
      setTimeout(() => setReload((r) => r + 1), ms),
    );
  };

  const cfg = useMemo<Record<string, unknown> | null>(() => {
    if (!globalCfg && !marketCfg) return null;
    return { ...(globalCfg || {}), ...(marketCfg || {}) };
  }, [globalCfg, marketCfg]);

  const stage = useMemo(() => computeStage(state, cfg, now), [state, cfg, now]);

  return (
    <PageContainer
      title={state?.title || `Market #${marketIdx}`}
      tags={<Badge status={STAGE_TONE[stage]} text={STAGE_LABEL[stage]} />}
    >
      {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 16 }} />}
      <Spin spinning={!state}>
        {state && cfg && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card title="State">
              <Descriptions column={2}>
                <Descriptions.Item label="Event id">{eventOnchainId}</Descriptions.Item>
                <Descriptions.Item label="Market idx">{marketIdx}</Descriptions.Item>
                {state.external_source === 1 && (
                  <Descriptions.Item label={tr('market.field.polymarketResult')} span={2}>
                    {state.polymarket_result ? (
                      <Tag
                        color={
                          state.polymarket_result.outcome === 1 ? 'green' :
                          state.polymarket_result.outcome === 2 ? 'red' :
                          state.polymarket_result.outcome === 3 ? 'default' :
                          'orange'
                        }
                        style={{ fontSize: 14, padding: '2px 8px' }}
                      >
                        {state.polymarket_result.outcome
                          ? `${OUTCOME[state.polymarket_result.outcome]}${state.polymarket_result.outcome_name ? ` (${state.polymarket_result.outcome_name})` : ''}`
                          : state.polymarket_result.closed
                            ? tr('market.polymarketResult.closedUnknown', { name: state.polymarket_result.outcome_name || '—' })
                            : tr('market.polymarketResult.open')
                        }
                      </Tag>
                    ) : (
                      <Tag>{tr('market.polymarketResult.loading')}</Tag>
                    )}
                    {state.polymarket_url && (
                      <a href={state.polymarket_url} target="_blank" rel="noreferrer" style={{ marginLeft: 12 }}>
                        {tr('market.field.polymarketLink')} ↗
                      </a>
                    )}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Deadline">
                  {formatDate(state.deadline, { unix: true })}
                </Descriptions.Item>
                <Descriptions.Item label="Stage">
                  <Tag>{stage}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="YES pool">
                  {fmtEds(state.yes_pool)} EDS ({fmtPct(state.yes_pool, state.no_pool)}%)
                </Descriptions.Item>
                <Descriptions.Item label="NO pool">
                  {fmtEds(state.no_pool)} EDS ({fmtPct(state.no_pool, state.yes_pool)}%)
                </Descriptions.Item>
                <Descriptions.Item label="Bonus pool">
                  {fmtEds(state.bonus_pool)} EDS
                </Descriptions.Item>
                <Descriptions.Item label="Proposed">
                  {state.proposed_outcome ? OUTCOME[state.proposed_outcome] : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Proposed by" span={2}>
                  {state.proposed_by || '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Finalized">
                  {state.finalized ? OUTCOME[state.finalized_outcome] : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Dispute active">
                  {state.dispute_active ? 'YES' : 'no'}
                </Descriptions.Item>
                {state.admin_reason && (
                  <Descriptions.Item label="Admin reason" span={2}>
                    {state.admin_reason}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            <Card title="Rake (post-finalize)">
              <Descriptions column={2}>
                <Descriptions.Item label="Creator performed">
                  {state.creator_performed ? 'true' : 'false'}
                </Descriptions.Item>
                <Descriptions.Item label="Platform rake">
                  {fmtEds(state.platform_rake)} EDS
                </Descriptions.Item>
                <Descriptions.Item label="Creator reward">
                  {fmtEds(state.creator_reward)} EDS
                </Descriptions.Item>
                <Descriptions.Item label="Distributable pool">
                  {fmtEds(state.distributable_pool)} EDS
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Market config (per-market snapshot)">
              <Descriptions column={2}>
                <Descriptions.Item label="platform_fee_bps">
                  {marketCfg?.platform_fee_bps ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="creator_reward_bps">
                  {marketCfg?.creator_reward_bps ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="dispute_window_secs">
                  {marketCfg?.dispute_window_secs ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="admin_timeout_secs">
                  {marketCfg?.admin_timeout_secs ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="creator_propose_timeout_secs">
                  {marketCfg?.creator_propose_timeout_secs ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="expired_propose_mode">
                  {marketCfg?.expired_propose_mode ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="single_side_only">
                  {marketCfg?.single_side_only ? 'true' : 'false'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <ActionCard
              stage={stage}
              busy={adminTx.busy}
              polymarketResult={state.polymarket_result}
              onPropose={(outcome) =>
                adminTx.run({
                  name: `Propose ${['—', 'YES', 'NO', 'VOID'][outcome]}`,
                  call: (addr) => v3ProposeOutcome(addr, state.event_id, state.market_idx, outcome),
                  confirm: {
                    title: `Propose ${['—', 'YES', 'NO', 'VOID'][outcome]} as outcome?`,
                  },
                  onDone: bumpReload,
                })
              }
              onFinalize={() =>
                adminTx.run({
                  name: 'Finalize',
                  call: (addr) => v3FinalizeProposed(addr, state.event_id, state.market_idx),
                  confirm: { title: 'Finalize proposed outcome?' },
                  onDone: bumpReload,
                })
              }
              onEmergencyVoid={() =>
                adminTx.run({
                  name: 'Emergency void',
                  call: (addr) => v3EmergencyVoid(addr, state.event_id, state.market_idx),
                  confirm: {
                    title: 'Emergency VOID this market?',
                    content: 'All bets refunded. This cannot be undone.',
                    danger: true,
                  },
                  onDone: bumpReload,
                })
              }
              onExpireUnproposed={() =>
                adminTx.run({
                  name: 'Expire unproposed',
                  call: (addr) => v3ExpireUnproposed(addr, state.event_id, state.market_idx),
                  confirm: {
                    title: 'Expire unproposed + slash creator?',
                    content: 'Creator seed is forfeited to bonus pool. Market is VOIDed.',
                    danger: true,
                  },
                  onDone: bumpReload,
                })
              }
              onAdminOverride={() => setAdminOverrideOpen(true)}
            />
          </Space>
        )}
      </Spin>

      <Modal
        title="Admin finalize (override)"
        open={adminOverrideOpen}
        okText="Submit"
        okButtonProps={{ danger: true }}
        onCancel={() => setAdminOverrideOpen(false)}
        onOk={() => {
          if (!overrideReason.trim() || !state) return;
          adminTx.run({
            name: 'Admin finalize',
            call: (addr) =>
              v3AdminFinalize(addr, state.event_id, state.market_idx, overrideOutcome, overrideReason.trim()),
            onDone: () => {
              bumpReload();
              setAdminOverrideOpen(false);
              setOverrideReason('');
            },
          });
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <span>Outcome:</span>
            {[
              { v: 1 as const, l: 'YES' },
              { v: 2 as const, l: 'NO' },
              { v: 3 as const, l: 'VOID' },
            ].map((o) => (
              <Button
                key={o.v}
                type={overrideOutcome === o.v ? 'primary' : 'default'}
                onClick={() => setOverrideOutcome(o.v)}
              >
                {o.l}
              </Button>
            ))}
          </Space>
          <Input.TextArea
            rows={3}
            placeholder="Admin reason (required, ≤ 1000 chars)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            maxLength={1000}
            showCount
          />
        </Space>
      </Modal>
    </PageContainer>
  );
}

interface ActionCardProps {
  stage: Stage;
  busy: boolean;
  polymarketResult?: {
    outcome: number | null;
    outcome_name: string;
    closed: boolean;
    confidence: string;
  } | null;
  onPropose: (outcome: 1 | 2 | 3) => void;
  onFinalize: () => void;
  onEmergencyVoid: () => void;
  onExpireUnproposed: () => void;
  onAdminOverride: () => void;
}

function ActionCard({
  stage, busy, polymarketResult,
  onPropose, onFinalize, onEmergencyVoid, onExpireUnproposed, onAdminOverride,
}: ActionCardProps) {
  if (stage === 'settled') {
    return (
      <Alert type="success" showIcon message="Settled — no further actions" />
    );
  }
  if (stage === 'dispute_pending') {
    return (
      <Alert
        type="warning"
        showIcon
        message="Dispute active — resolve via Disputes page"
        description="admin_resolve auto-finalizes the market."
      />
    );
  }
  return (
    <Card title="Admin actions">
      <Space wrap>
        {['awaiting_proposal', 'expired_takeover'].includes(stage) && (
          <>
            <Button loading={busy} onClick={() => onPropose(1)}>Propose YES</Button>
            <Button loading={busy} onClick={() => onPropose(2)}>Propose NO</Button>
            <Button loading={busy} onClick={() => onPropose(3)}>Propose VOID</Button>
            {polymarketResult?.outcome != null && polymarketResult.outcome >= 1 && polymarketResult.outcome <= 3 && (
              <Button
                type="primary"
                loading={busy}
                onClick={() => onPropose(polymarketResult.outcome as 1 | 2 | 3)}
              >
                Propose {OUTCOME[polymarketResult.outcome]} (match Polymarket)
              </Button>
            )}
          </>
        )}
        {stage === 'ready_finalize' && (
          <Button type="primary" loading={busy} onClick={onFinalize}>
            Finalize proposed
          </Button>
        )}
        {stage === 'expired_voidable' && (
          <Button danger loading={busy} onClick={onExpireUnproposed}>
            Expire unproposed + slash
          </Button>
        )}
        {(stage === 'emergency_voidable' ||
          stage === 'expired_voidable' ||
          stage === 'expired_takeover' ||
          stage === 'awaiting_proposal') && (
          <Button danger loading={busy} onClick={onEmergencyVoid}>
            Emergency void
          </Button>
        )}
        <Button danger ghost loading={busy} onClick={onAdminOverride}>
          Admin finalize (override)
        </Button>
      </Space>
    </Card>
  );
}
