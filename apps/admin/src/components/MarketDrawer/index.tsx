import {
  Alert, Badge, Button, Card, Descriptions, Drawer, Input,
  Modal, Space, Spin, Tag, Tooltip, Typography,
} from 'antd';
import { useIntl, useModel } from '@umijs/max';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { polymindApi, type MarketConfig, type MarketState } from '@/services/polymind';
import { formatDate } from '@/utils/format';
import {
  v3AdminFinalize, v3Claim, v3EmergencyVoid, v3ExpireUnproposed,
  v3FinalizeProposed, v3ProposeOutcome,
} from '@/wallet/endless';
import { useAdminTx } from '@/hooks/useAdminTx';
import {
  computeStage, STAGE_TONE, type Stage,
} from '@/pages/Events/MarketDetail/stage';
import SignerStatusCard from '@/components/SignerStatusCard';

const EDS = 1e8;
const fmtEds = (b: string | number) => (Number(b) / EDS).toFixed(2);

const SOURCE_TAG_MAP: Record<string, { color: string; key: string }> = {
  official:   { color: 'purple', key: 'source.official'   },
  admin:      { color: 'purple', key: 'source.official'   },
  polymarket: { color: 'blue',   key: 'source.polymarket' },
  user:       { color: 'green',  key: 'source.user'       },
};

function SourceTag({ source }: { source?: string }) {
  const intl = useIntl();
  const cfg = SOURCE_TAG_MAP[source ?? 'user'] ?? SOURCE_TAG_MAP.user;
  return <Tag color={cfg.color}>{intl.formatMessage({ id: cfg.key })}</Tag>;
}
const fmtPct = (a: string, b: string) => {
  const x = Number(a);
  const y = Number(b);
  const total = x + y;
  return total > 0 ? ((x / total) * 100).toFixed(1) : '0';
};

interface PolymarketResult {
  outcome: number | null;
  outcome_name: string;
  closed: boolean;
  confidence: string;
}

function PolymarketResultBadge({ result, tr }: { result: PolymarketResult | null | undefined; tr: (id: string, values?: Record<string, string | number>) => string }) {
  // undefined (not fetched yet) or null (fetch returned nothing) both show "loading"
  if (result === undefined || result === null) {
    return (
      <Tag color="default">
        {tr('market.polymarketResult.loading')}
      </Tag>
    );
  }
  const { outcome, outcome_name, closed } = result;
  if (!closed) {
    return (
      <Tag color="default">
        {tr('market.polymarketResult.open')}
      </Tag>
    );
  }
  if (outcome === null || outcome === 0) {
    return (
      <Tag color="orange">
        {tr('market.polymarketResult.closedUnknown', { name: outcome_name || '—' })}
      </Tag>
    );
  }
  const colorMap: Record<number, string> = { 1: 'green', 2: 'red', 3: 'default' };
  return (
    <Tag color={colorMap[outcome] || 'default'} style={{ fontSize: 14, padding: '2px 8px' }}>
      {tr(`market.outcome.${outcome}`)} {outcome_name ? `(${outcome_name})` : ''}
    </Tag>
  );
}

interface Props {
  open: boolean;
  marketSlug: string | null;
  onClose: () => void;
  onTxDone?: () => void;
  hideAdminOverride?: boolean;
}

export default function MarketDrawer({
  open, marketSlug, onClose, onTxDone, hideAdminOverride,
}: Props) {
  const intl = useIntl();
  const tr = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const outcomeLabel = (n: number) => tr(`market.outcome.${n}`);
  const { address, signerMatches, isContractAdmin } = useModel('wallet');
  const [state, setState] = useState<MarketState | null>(null);
  const [globalCfg, setGlobalCfg] = useState<Record<string, unknown> | null>(null);
  const [marketCfg, setMarketCfg] = useState<MarketConfig | null>(null);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [reload, setReload] = useState(0);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideOutcome, setOverrideOutcome] = useState<1 | 2 | 3>(1);
  const [overrideReason, setOverrideReason] = useState('');
  const adminTx = useAdminTx();

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    polymindApi.getConfig().then(setGlobalCfg).catch(() => {});
  }, [open]);

  useEffect(() => {
    setMarketCfg(null);
    setState(null);
  }, [marketSlug]);

  useEffect(() => {
    if (!open || !marketSlug) return;
    let cancelled = false;
    const loadState = () =>
      polymindApi.marketState(marketSlug).then((s) => {
        if (!cancelled) setState(s);
      }).catch(() => {});
    const loadCfg = () =>
      polymindApi.marketConfig(marketSlug).then((c) => {
        if (!cancelled) setMarketCfg(c);
      }).catch(() => {});
    loadState();
    loadCfg();
    const t = setInterval(() => { loadState(); loadCfg(); }, 15_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [open, marketSlug, reload]);

  const cfg = useMemo<Record<string, unknown> | null>(() => {
    if (!globalCfg && !marketCfg) return null;
    return { ...(globalCfg || {}), ...(marketCfg || {}) };
  }, [globalCfg, marketCfg]);

  const stage = useMemo<Stage>(() => computeStage(state, cfg, now), [state, cfg, now]);

  const isEventCreator = useMemo(
    () => signerMatches(state?.event_creator),
    [state?.event_creator, signerMatches],
  );

  const bumpReload = useCallback(() => {
    [0, 1200, 4000].forEach((ms) =>
      setTimeout(() => {
        setReload((r) => r + 1);
        onTxDone?.();
      }, ms),
    );
  }, [onTxDone]);

  const handleProposeOutcome = (outcome: 1 | 2 | 3) =>
    adminTx.run({
      name: tr('market.tx.propose', { outcome: outcomeLabel(outcome) }),
      call: (addr) => v3ProposeOutcome(addr, state!.event_id, state!.market_idx, outcome),
      confirm: { title: tr('market.confirm.propose.title', { outcome: outcomeLabel(outcome) }) },
      onDone: bumpReload,
    });

  const [claimable, setClaimable] = useState<string>('0');
  useEffect(() => {
    if (!open || !marketSlug || !address) {
      setClaimable('0');
      return;
    }
    let cancelled = false;
    polymindApi.claimPreview(marketSlug, address)
      .then((r) => { if (!cancelled) setClaimable(r.amount || '0'); })
      .catch(() => { if (!cancelled) setClaimable('0'); });
    return () => { cancelled = true; };
  }, [open, marketSlug, address, reload]);

  const handleClaim = () =>
    adminTx.run({
      name: tr('market.tx.claim'),
      call: (addr) => v3Claim(addr, state!.event_id, state!.market_idx),
      confirm: { title: tr('market.confirm.claim.title', { amount: fmtEds(claimable) }) },
      onDone: bumpReload,
    });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      title={
        state ? (
          <Space>
            <span>{state.title || `Market #${state.market_idx}`}</span>
            <Badge status={STAGE_TONE[stage]} text={tr(`market.stage.${stage}`)} />
          </Space>
        ) : (
          tr('market.loading')
        )
      }
      destroyOnClose
    >
      <Spin spinning={!state}>
        {state && cfg && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <SignerStatusCard targetAddress={state.event_creator} compact />

            <Card size="small" title={tr('market.section.claim')}>
              <Space wrap>
                <Tag color={Number(claimable) > 0 ? 'green' : 'default'}
                     style={{ fontSize: 14, padding: '2px 8px' }}>
                  {fmtEds(claimable)} EDS
                </Tag>
                <Button
                  type="primary"
                  loading={adminTx.busy}
                  disabled={!adminTx.canRun || Number(claimable) <= 0}
                  onClick={handleClaim}
                >
                  {Number(claimable) > 0
                    ? tr('market.action.claim', { amount: fmtEds(claimable) })
                    : tr('market.action.claimEmpty')}
                </Button>
              </Space>
            </Card>

            {isEventCreator && (
              <ActionCard
                stage={stage}
                busy={adminTx.busy}
                polymarketResult={state.polymarket_result}
                onPropose={handleProposeOutcome}
                onFinalize={() =>
                  adminTx.run({
                    name: tr('market.tx.finalize'),
                    call: (addr) => v3FinalizeProposed(addr, state!.event_id, state!.market_idx),
                    confirm: { title: tr('market.confirm.finalize.title') },
                    onDone: bumpReload,
                  })
                }
                onEmergencyVoid={() =>
                  adminTx.run({
                    name: tr('market.tx.emergencyVoid'),
                    call: (addr) => v3EmergencyVoid(addr, state!.event_id, state!.market_idx),
                    confirm: {
                      title:   tr('market.confirm.emergencyVoid.title'),
                      content: tr('market.confirm.emergencyVoid.content'),
                      danger: true,
                    },
                    onDone: bumpReload,
                  })
                }
                onExpireUnproposed={() =>
                  adminTx.run({
                    name: tr('market.tx.expireUnproposed'),
                    call: (addr) => v3ExpireUnproposed(addr, state!.event_id, state!.market_idx),
                    confirm: {
                      title:   tr('market.confirm.expire.title'),
                      content: tr('market.confirm.expire.content'),
                      danger: true,
                    },
                    onDone: bumpReload,
                  })
                }
              />
            )}

            {isContractAdmin && !hideAdminOverride && (
              <AdminCard
                stage={stage}
                busy={adminTx.busy}
                onAdminOverride={() => setOverrideOpen(true)}
              />
            )}


            <Card title={tr('market.section.state')}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label={tr('market.field.eventId')}>{state.event_id}</Descriptions.Item>
                <Descriptions.Item label={tr('market.field.marketIdx')}>{state.market_idx}</Descriptions.Item>
                <Descriptions.Item label={tr('source.createdBy')}>
                  <SourceTag source={state.event_source} />
                </Descriptions.Item>
                <Descriptions.Item label={tr('market.field.deadline')}>
                  {formatDate(state.deadline, { unix: true })}
                  {stage === 'betting' && state.deadline > 0 && (() => {
                    const remain = state.deadline - now;
                    if (remain <= 0) return null;
                    if (remain > 600) return null;
                    const m = Math.floor(remain / 60);
                    const s = remain % 60;
                    return (
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        {tr('market.field.proposeIn', { time: `${m}:${String(s).padStart(2, '0')}` })}
                      </Tag>
                    );
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label={tr('market.field.stage')}>
                  <Tag>{tr(`market.stage.${stage}`)}</Tag>
                  {(() => {
                    let end = 0;
                    let key = '';
                    if (stage === 'betting' && state.deadline) {
                      end = state.deadline;
                      key = 'market.countdown.deadline';
                    } else if (stage === 'awaiting_proposal' && state.deadline && marketCfg) {
                      end = state.deadline + (marketCfg.creator_propose_timeout_secs ?? 0);
                      key = 'market.countdown.proposeExpiry';
                    } else if (stage === 'in_review' && state.proposed_at && marketCfg) {
                      end = state.proposed_at + (marketCfg.dispute_window_secs ?? 0);
                      key = 'market.countdown.disputeEnd';
                    } else if (stage === 'dispute_pending' && state.proposed_at && marketCfg) {
                      end = state.proposed_at + (marketCfg.admin_timeout_secs ?? 0);
                      key = 'market.countdown.adminTimeout';
                    }
                    if (!end || !key) return null;
                    const remain = end - now;
                    if (remain <= 0) return null;
                    const h = Math.floor(remain / 3600);
                    const m = Math.floor((remain % 3600) / 60);
                    const s = remain % 60;
                    const time = h > 0
                      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                      : `${m}:${String(s).padStart(2, '0')}`;
                    return (
                      <Tag color="orange" style={{ marginLeft: 8 }}>
                        {tr(key, { time })}
                      </Tag>
                    );
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label={tr('market.field.yesPool')}>
                  {fmtEds(state.yes_pool)} EDS ({fmtPct(state.yes_pool, state.no_pool)}%)
                </Descriptions.Item>
                <Descriptions.Item label={tr('market.field.noPool')}>
                  {fmtEds(state.no_pool)} EDS ({fmtPct(state.no_pool, state.yes_pool)}%)
                </Descriptions.Item>
                <Descriptions.Item label={tr('market.field.bonusPool')}>{fmtEds(state.bonus_pool)} EDS</Descriptions.Item>
                <Descriptions.Item label={tr('market.field.proposed')}>
                  {state.proposed_outcome ? outcomeLabel(state.proposed_outcome) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label={tr('market.field.proposedBy')} span={2}>
                  {state.proposed_by || '—'}
                </Descriptions.Item>
                <Descriptions.Item label={tr('market.field.finalized')}>
                  {state.finalized ? outcomeLabel(state.finalized_outcome) : '—'}
                </Descriptions.Item>
                <Descriptions.Item label={tr('market.field.disputeActive')}>
                  {tr(state.dispute_active ? 'market.bool.true' : 'market.bool.false')}
                </Descriptions.Item>
                {state.admin_reason && (
                  <Descriptions.Item label={tr('market.field.adminReason')} span={2}>
                    {state.admin_reason}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {!!state.external_source && (
              <Card title={tr('market.section.external')}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label={tr('events.create.field.externalSource')}>
                    {tr(`events.create.field.externalSource.opt${state.external_source}`)}
                  </Descriptions.Item>
                  <Descriptions.Item label={tr('events.create.field.externalMarketId')}>
                    {state.external_market_id || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={tr('events.create.field.externalAuxId')}>
                    {state.external_aux_id || '—'}
                  </Descriptions.Item>
                  {state.polymarket_url && (
                    <Descriptions.Item label={tr('market.field.polymarketLink')} span={2}>
                      <Typography.Link href={state.polymarket_url} target="_blank">
                        {state.polymarket_url}
                      </Typography.Link>
                    </Descriptions.Item>
                  )}
                  {state.external_source === 1 && (
                    <Descriptions.Item label={tr('market.field.polymarketResult')} span={2}>
                      <PolymarketResultBadge result={state.polymarket_result} tr={tr} />
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            )}

            <Card title={tr('market.section.rake')}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label={tr('market.field.creatorPerformed')}>
                  {tr(state.creator_performed ? 'market.bool.true' : 'market.bool.false')}
                </Descriptions.Item>
                <Descriptions.Item label={tr('market.field.platformRake')}>{fmtEds(state.platform_rake)} EDS</Descriptions.Item>
                <Descriptions.Item label={tr('market.field.creatorReward')}>{fmtEds(state.creator_reward)} EDS</Descriptions.Item>
                <Descriptions.Item label={tr('market.field.distributablePool')}>{fmtEds(state.distributable_pool)} EDS</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title={tr('market.section.cfg')}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label={tr('field.platformFeeBps')}>{marketCfg?.platform_fee_bps ?? '—'}</Descriptions.Item>
                <Descriptions.Item label={tr('field.creatorRewardBps')}>{marketCfg?.creator_reward_bps ?? '—'}</Descriptions.Item>
                <Descriptions.Item label={tr('field.disputeWindowSecs')}>{marketCfg?.dispute_window_secs ?? '—'}</Descriptions.Item>
                <Descriptions.Item label={tr('field.adminTimeoutSecs')}>{marketCfg?.admin_timeout_secs ?? '—'}</Descriptions.Item>
                <Descriptions.Item label={tr('field.creatorProposeTimeoutSecs')}>{marketCfg?.creator_propose_timeout_secs ?? '—'}</Descriptions.Item>
                <Descriptions.Item label={tr('field.expiredProposeMode')}>
                  {marketCfg?.expired_propose_mode == null
                    ? '—'
                    : tr(`field.expiredProposeMode.opt${marketCfg.expired_propose_mode}`)}
                </Descriptions.Item>
                <Descriptions.Item label={tr('field.singleSideOnly')}>
                  {tr(marketCfg?.single_side_only ? 'market.bool.true' : 'market.bool.false')}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Space>
        )}
      </Spin>

      <Modal
        title={tr('market.override.title')}
        open={overrideOpen}
        okText={tr('market.override.ok')}
        okButtonProps={{ danger: true, disabled: !overrideReason.trim() }}
        onCancel={() => setOverrideOpen(false)}
        onOk={() => {
          adminTx.run({
            name: tr('market.tx.adminFinalize'),
            call: (addr) =>
              v3AdminFinalize(addr, state!.event_id, state!.market_idx, overrideOutcome, overrideReason.trim()),
            onDone: () => {
              bumpReload();
              setOverrideOpen(false);
              setOverrideReason('');
            },
          });
        }}
      >
        <Space direction="vertical" style={{ width: '100%', paddingBottom: 24 }}>
          <Space>
            <span>{tr('market.override.outcomeLabel')}</span>
            {([1, 2, 3] as const).map((v) => (
              <Button
                key={v}
                type={overrideOutcome === v ? 'primary' : 'default'}
                onClick={() => setOverrideOutcome(v)}
              >
                {outcomeLabel(v)}
              </Button>
            ))}
          </Space>
          <Input.TextArea
            rows={3}
            placeholder={tr('market.override.reasonPlaceholder')}
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            maxLength={1000}
            showCount
          />
        </Space>
      </Modal>
    </Drawer>
  );
}

interface ActionCardProps {
  stage: Stage;
  busy: boolean;
  polymarketResult?: PolymarketResult | null;
  onPropose: (outcome: 1 | 2 | 3) => void;
  onFinalize: () => void;
  onEmergencyVoid: () => void;
  onExpireUnproposed: () => void;
}

const PROPOSE_STAGES:    Stage[] = ['awaiting_proposal'];
const FINALIZE_STAGES:   Stage[] = ['ready_finalize'];
const EXPIRE_STAGES:     Stage[] = ['expired_voidable'];
const EMERGENCY_STAGES:  Stage[] = ['emergency_voidable'];
const OVERRIDE_FORBIDDEN: Stage[] = ['settled', 'dispute_pending'];

function ActionCard({
  stage, busy, polymarketResult,
  onPropose, onFinalize, onEmergencyVoid, onExpireUnproposed,
}: ActionCardProps) {
  const intl = useIntl();
  const tr = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const stageLabel = tr(`market.stage.${stage}`);
  const reason = (allowed: Stage[]) =>
    tr('market.action.disabledReason', {
      current: stageLabel,
      allowed: allowed.map((s) => tr(`market.stage.${s}`)).join(' / '),
    });

  const proposeOk  = PROPOSE_STAGES.includes(stage);
  const finalizeOk = FINALIZE_STAGES.includes(stage);
  const expireOk   = EXPIRE_STAGES.includes(stage);
  const emergencyOk = EMERGENCY_STAGES.includes(stage);

  const wrap = (ok: boolean, allowed: Stage[], node: React.ReactElement) =>
    ok ? node : <Tooltip title={reason(allowed)}>{node}</Tooltip>;

  const banner =
    stage === 'settled' ? (
      <Alert type="success" showIcon style={{ marginBottom: 12 }}
             message={tr('market.alert.settled')} />
    ) : stage === 'dispute_pending' ? (
      <Alert type="warning" showIcon style={{ marginBottom: 12 }}
             message={tr('market.alert.disputePending')}
             description={tr('market.alert.disputeHint')} />
    ) : stage === 'expired_takeover' ? (
      <Alert type="error" showIcon style={{ marginBottom: 12 }}
             message={tr('market.alert.expiredTakeover')} />
    ) : null;

  return (
    <Card title={tr('market.section.actions')} size="small">
      {banner}
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Space wrap>
            {wrap(proposeOk, PROPOSE_STAGES,
              <Button loading={busy} disabled={!proposeOk}
                      onClick={() => onPropose(1)}>{tr('market.action.proposeYes')}</Button>)}
            {wrap(proposeOk, PROPOSE_STAGES,
              <Button loading={busy} disabled={!proposeOk}
                      onClick={() => onPropose(2)}>{tr('market.action.proposeNo')}</Button>)}
            {wrap(proposeOk, PROPOSE_STAGES,
              <Button loading={busy} disabled={!proposeOk}
                      onClick={() => onPropose(3)}>{tr('market.action.proposeVoid')}</Button>)}
            {proposeOk && polymarketResult?.outcome != null && polymarketResult.outcome >= 1 && polymarketResult.outcome <= 3 && (
              <Button
                type="primary"
                loading={busy}
                onClick={() => onPropose(polymarketResult.outcome as 1 | 2 | 3)}
              >
                {tr('market.action.proposePolymarket', { outcome: tr(`market.outcome.${polymarketResult.outcome}`) })}
              </Button>
            )}
          </Space>
          {proposeOk && polymarketResult?.outcome != null && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 8 }}
              message={tr('market.alert.polymarketResultHint', { outcome: tr(`market.outcome.${polymarketResult.outcome}`) })}
            />
          )}
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            {tr('market.action.propose.desc')}
          </Typography.Text>
        </div>
        <div>
          {wrap(finalizeOk, FINALIZE_STAGES,
            <Button type="primary" loading={busy} disabled={!finalizeOk}
                    onClick={onFinalize}>{tr('market.action.finalize')}</Button>)}
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            {tr('market.action.finalize.desc')}
          </Typography.Text>
        </div>
        <div>
          {wrap(expireOk, EXPIRE_STAGES,
            <Button danger loading={busy} disabled={!expireOk}
                    onClick={onExpireUnproposed}>{tr('market.action.expireSlash')}</Button>)}
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            {tr('market.action.expireSlash.desc')}
          </Typography.Text>
        </div>
        <div>
          {wrap(emergencyOk, EMERGENCY_STAGES,
            <Button danger loading={busy} disabled={!emergencyOk}
                    onClick={onEmergencyVoid}>{tr('market.action.emergencyVoid')}</Button>)}
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
            {tr('market.action.emergencyVoid.desc')}
          </Typography.Text>
        </div>
      </Space>
    </Card>
  );
}

interface AdminCardProps {
  stage: Stage;
  busy: boolean;
  onAdminOverride: () => void;
}

function AdminCard({ stage, busy, onAdminOverride }: AdminCardProps) {
  const intl = useIntl();
  const tr = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const overrideOk = !OVERRIDE_FORBIDDEN.includes(stage);
  const allowed: Stage[] = [
    'betting', 'awaiting_proposal', 'expired_takeover', 'expired_voidable',
    'in_review', 'ready_finalize', 'emergency_voidable',
  ];
  const stageLabel = tr(`market.stage.${stage}`);
  const reason = tr('market.action.disabledReason', {
    current: stageLabel,
    allowed: allowed.map((s) => tr(`market.stage.${s}`)).join(' / '),
  });
  const btn = (
    <Button danger ghost loading={busy} disabled={!overrideOk}
            onClick={onAdminOverride}>
      {tr('market.action.adminOverride')}
    </Button>
  );
  return (
    <Card title={tr('market.section.adminActions')} size="small">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message={tr('market.admin.hint')}
      />
      <Space wrap>
        {overrideOk ? btn : <Tooltip title={reason}>{btn}</Tooltip>}
      </Space>
    </Card>
  );
}
