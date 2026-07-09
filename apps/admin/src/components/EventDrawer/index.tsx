import {
  Alert, App, Button, DatePicker, Descriptions, Drawer, Form, Input, InputNumber,
  List, Modal, Radio, Select, Space, Spin, Switch, Tag, Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useIntl, useModel } from '@umijs/max';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  polymindApi,
  type EventMarketSummary,
  type MarketState,
  type PmTagRow,
} from '@/services/polymind';
import MarketDrawer from '@/components/MarketDrawer';
import SignerStatusCard from '@/components/SignerStatusCard';
import { v3AddMarket, v3AdminAddMarket } from '@/wallet/endless';
import { syncEventTx } from '@/wallet/syncEvent';
import { useAdminTx } from '@/hooks/useAdminTx';

const OUTCOME = ['—', 'YES', 'NO', 'VOID'];
const EDS = 1e8;

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

function PolymarketResultTag({ result }: { result?: MarketState['polymarket_result'] }) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) => intl.formatMessage({ id }, values);
  // undefined (not fetched yet) or null (fetch returned nothing) both show "loading"
  if (result === undefined || result === null) {
    return <Tag style={{ margin: 0 }}>{t('market.polymarketResult.loading')}</Tag>;
  }
  if (!result.closed) {
    return <Tag style={{ margin: 0 }}>{t('market.polymarketResult.open')}</Tag>;
  }
  if (result.outcome === null || result.outcome === 0) {
    return <Tag color="orange" style={{ margin: 0 }}>{t('market.polymarketResult.closedUnknown', { name: result.outcome_name || '—' })}</Tag>;
  }
  const colorMap: Record<number, string> = { 1: 'green', 2: 'red', 3: 'default' };
  return (
    <Tag color={colorMap[result.outcome] || 'default'} style={{ margin: 0 }}>
      {t(`market.outcome.${result.outcome}`)}
      {result.outcome_name ? ` (${result.outcome_name})` : ''}
    </Tag>
  );
}

type EventDetail = Awaited<ReturnType<typeof polymindApi.eventDetail>>;

interface AddMarketValues {
  title: string;
  labelYes: string;
  labelNo: string;
  deadline: Dayjs;
  seedSide: 0 | 1;
  seedAmount: number;
  externalSource: number;
  externalMarketId: string;
  externalAuxId: number;
  platformFeeBps: number;
  platformFeeMax: number;
  creatorRewardBps: number;
  creatorRewardMax: number;
  disputeWindowSecs: number;
  adminTimeoutSecs: number;
  creatorProposeTimeoutSecs: number;
  expiredProposeMode: 0 | 1;
  singleSideOnly: boolean;
}


interface Props {
  open: boolean;
  slug: string | null;
  onClose: () => void;
  onTxDone?: () => void;
}

export default function EventDrawer({ open, slug, onClose, onTxDone }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const { signerMatches, isContractCreator } = useModel('wallet');
  const adminTx = useAdminTx();

  const [data, setData] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [marketDrawerSlug, setMarketDrawerSlug] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm<AddMarketValues>();
  // Polymarket result reference per market (keyed by market_idx)
  const [pmResults, setPmResults] = useState<Record<number, MarketState['polymarket_result']>>({});

  const [seedMinEds, setSeedMinEds] = useState(5);
  useEffect(() => {
    if (!open) return;
    polymindApi.getConfig()
      .then((c) => {
        const raw = Number((c as Record<string, unknown>).creator_seed_min ?? 0);
        if (raw > 0) setSeedMinEds(raw / EDS);
      })
      .catch(() => {});
  }, [open]);

  const [allTags, setAllTags] = useState<PmTagRow[]>([]);
  const [eventTagIds, setEventTagIds] = useState<number[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsSaving, setTagsSaving] = useState(false);

  const loadTags = useCallback(() => {
    if (!slug) return;
    setTagsLoading(true);
    Promise.all([
      polymindApi.listTags(),
      polymindApi.eventTags(slug),
    ])
      .then(([all, mine]) => {
        setAllTags(all);
        setEventTagIds(mine.map((t) => t.id).filter((id): id is number => id != null));
      })
      .catch(() => {})
      .finally(() => setTagsLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!open || !slug) return;
    loadTags();
  }, [open, slug, loadTags]);

  const saveTags = async () => {
    if (!slug) return;
    setTagsSaving(true);
    try {
      await polymindApi.setEventTags(slug, eventTagIds);
      message.success(t('tags.event.saved'));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setTagsSaving(false);
    }
  };

  const reload = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    polymindApi
      .eventDetail(slug)
      .then((d) => { setData(d); setErr(''); })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!open || !slug) return;
    setData(null);
    setErr('');
    setPmResults({});
    reload();
  }, [open, slug, reload]);

  // Fetch Polymarket result reference for each market when event detail loads
  useEffect(() => {
    if (!data || data.source !== 'polymarket' || !data.onchain_event_id) return;
    let cancelled = false;
    const loadResults = async () => {
      const results: Record<number, MarketState['polymarket_result']> = {};
      await Promise.all(
        (data.markets || []).map(async (m) => {
          try {
            const state = await polymindApi.marketState(m.slug || '');
            if (!cancelled && state?.polymarket_result) {
              results[m.market_idx] = state.polymarket_result;
            }
          } catch {
            // ignore per-market fetch errors
          }
        }),
      );
      if (!cancelled) setPmResults(results);
    };
    loadResults();
    return () => { cancelled = true; };
  }, [data]);

  const isCreator = useMemo(
    () => signerMatches(data?.creator),
    [data?.creator, signerMatches],
  );

  const openAdd = () => {
    form.setFieldsValue({
      title: '',
      labelYes: 'YES',
      labelNo: 'NO',
      deadline: dayjs().add(7, 'day'),
      seedSide: 0,
      seedAmount: isContractCreator ? 0 : seedMinEds,
      externalSource: 0,
      externalMarketId: '',
      externalAuxId: 0,
    });
    if (isContractCreator) {
      polymindApi.getConfig()
        .then((c) => {
          form.setFieldsValue({
            platformFeeBps: Number(c.platform_fee_bps ?? 100),
            platformFeeMax: Number(c.platform_fee_max ?? 0) / EDS,
            creatorRewardBps: Number(c.creator_reward_bps ?? 200),
            creatorRewardMax: Number(c.creator_reward_max ?? 0) / EDS,
            disputeWindowSecs: Number(c.dispute_window_secs ?? 86400),
            adminTimeoutSecs: Number(c.admin_timeout_secs ?? 604800),
            creatorProposeTimeoutSecs: Number(c.creator_propose_timeout_secs ?? 259200),
            expiredProposeMode: (Number(c.expired_propose_mode ?? 0) as 0 | 1),
            singleSideOnly: Boolean(c.single_side_only ?? true),
          });
        })
        .catch(() => {});
    }
    setAddOpen(true);
  };

  const submitAdd = async () => {
    if (!data) return;
    const v = await form.validateFields();
    const deadlineSec = Math.floor(v.deadline.valueOf() / 1000);
    if (deadlineSec <= Math.floor(Date.now() / 1000)) {
      form.setFields([{ name: 'deadline', errors: [t('field.deadlineFuture')] }]);
      return;
    }
    if (!isContractCreator && v.seedAmount < seedMinEds) {
      form.setFields([{
        name: 'seedAmount',
        errors: [t('events.detail.add.seedMinErr', { min: seedMinEds })],
      }]);
      return;
    }
    const callFn = isContractCreator
      ? (addr: string) => v3AdminAddMarket(addr, {
          eventId: data.onchain_event_id!,
          title: v.title,
          labelYes: v.labelYes,
          labelNo: v.labelNo,
          deadline: deadlineSec,
          seedSide: v.seedSide,
          seedAmount: BigInt(Math.round(v.seedAmount * EDS)),
          externalSource: v.externalSource,
          externalMarketId: v.externalMarketId,
          externalAuxId: v.externalAuxId,
          platformFeeBps: v.platformFeeBps,
          platformFeeMax: BigInt(Math.round(v.platformFeeMax * EDS)),
          creatorRewardBps: v.creatorRewardBps,
          creatorRewardMax: BigInt(Math.round(v.creatorRewardMax * EDS)),
          disputeWindowSecs: v.disputeWindowSecs,
          adminTimeoutSecs: v.adminTimeoutSecs,
          creatorProposeTimeoutSecs: v.creatorProposeTimeoutSecs,
          expiredProposeMode: v.expiredProposeMode,
          singleSideOnly: v.singleSideOnly,
        })
      : (addr: string) => v3AddMarket(addr, {
          eventId: data.onchain_event_id!,
          title: v.title,
          labelYes: v.labelYes,
          labelNo: v.labelNo,
          deadline: deadlineSec,
          seedSide: v.seedSide,
          seedAmount: BigInt(Math.round(v.seedAmount * EDS)),
          externalSource: v.externalSource,
          externalMarketId: v.externalMarketId,
          externalAuxId: v.externalAuxId,
        });
    adminTx.run({
      name: t('events.detail.addTx.name'),
      call: callFn,
      confirm: {
        title:   t('events.detail.addConfirm.title'),
        content: t('events.detail.addConfirm.content'),
      },
      onDone: (hash) => {
        void syncEventTx(hash);
        setAddOpen(false);
        [800, 3000, 6000].forEach((ms) =>
          setTimeout(() => { reload(); onTxDone?.(); }, ms),
        );
      },
    });
  };

  const addDisabled = !adminTx.canRun || !isCreator;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={760}
      title={
        data ? (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
              event #{data.onchain_event_id}
            </div>
            <Typography.Text
              strong
              ellipsis={{ tooltip: data.question }}
              style={{ display: 'block', fontSize: 15, maxWidth: 580 }}
            >
              {data.question}
            </Typography.Text>
          </div>
        ) : (
          'Loading…'
        )
      }
      extra={
        <Button type="primary" onClick={openAdd} disabled={addDisabled}>
          {t('events.detail.addMarket')}
        </Button>
      }
      destroyOnClose
    >
      <Spin spinning={loading && !data}>
        {err && <Alert type="error" showIcon message={err} style={{ marginBottom: 16 }} />}

        {data && (
          <SignerStatusCard
            targetAddress={data.creator}
            compact
            style={{ marginBottom: 16 }}
          />
        )}

        {data && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Slug">{data.slug}</Descriptions.Item>
              <Descriptions.Item label="Created">{data.created_at}</Descriptions.Item>
              <Descriptions.Item label={t('source.createdBy')}>
                <SourceTag source={data.source} />
              </Descriptions.Item>
              <Descriptions.Item label="Creator" span={2}>
                <span style={{ wordBreak: 'break-all' }}>{data.creator}</span>
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                {data.description}
              </Descriptions.Item>
            </Descriptions>

            <div>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>
                {t('tags.event.section')}
              </div>
              <Space.Compact style={{ width: '100%' }}>
                <Select
                  mode="multiple"
                  allowClear
                  loading={tagsLoading}
                  placeholder={t('tags.event.placeholder')}
                  style={{ flex: 1 }}
                  value={eventTagIds}
                  onChange={(v) => setEventTagIds(v as number[])}
                  optionFilterProp="label"
                  options={allTags.map((tg) => ({
                    label: `${tg.display_name} (${tg.slug})${tg.is_active ? '' : ' [inactive]'}`,
                    value: tg.id,
                  }))}
                />
                <Button type="primary" loading={tagsSaving} onClick={saveTags}>
                  {t('tags.event.save')}
                </Button>
              </Space.Compact>
            </div>

            <VisibilityCard
              data={data}
              onToggle={() => { reload(); onTxDone?.(); }}
            />

            <List
              header={<b>Markets · {data.markets?.length ?? 0}</b>}
              bordered
              dataSource={data.markets || []}
              locale={{ emptyText: t('events.detail.noMarkets') }}
              renderItem={(m: EventMarketSummary) => (
                <List.Item
                  actions={[
                    <a key="open" onClick={() => setMarketDrawerSlug(m.slug || '')}>
                      {t('events.detail.openMarket')}
                    </a>,
                  ]}
                >
                  <List.Item.Meta
                    title={m.title || `Market #${m.market_idx}`}
                    description={
                      <Space size="small" wrap>
                        <Tag>YES: {m.yes_pool}</Tag>
                        <Tag>NO: {m.no_pool}</Tag>
                        {m.resolved && (
                          <Tag color="green">Settled: {OUTCOME[m.outcome ?? 0]}</Tag>
                        )}
                        {m.dispute_active && <Tag color="red">Disputed</Tag>}
                        {data?.source === 'polymarket' && (
                          <PolymarketResultTag result={pmResults[m.market_idx]} />
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Space>
        )}
      </Spin>

      <MarketDrawer
        open={marketDrawerSlug != null}
        marketSlug={marketDrawerSlug}
        onClose={() => setMarketDrawerSlug(null)}
        onTxDone={() => { reload(); onTxDone?.(); }}
      />

      <Modal
        title={t('events.detail.addModal.title')}
        open={addOpen}
        width={720}
        onCancel={() => setAddOpen(false)}
        onOk={submitAdd}
        okText={t('events.detail.addModal.submit')}
        okButtonProps={{ loading: adminTx.busy, disabled: addDisabled }}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={t('events.detail.addModal.hint')}
        />
        <Form form={form} layout="vertical" disabled={adminTx.busy}>
          <Form.Item name="title" label={t('field.title')} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space size="middle" style={{ display: 'flex' }}>
            <Form.Item name="labelYes" label={t('field.labelYes')} rules={[{ required: true }]}>
              <Input style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="labelNo" label={t('field.labelNo')} rules={[{ required: true }]}>
              <Input style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="deadline" label={t('field.deadline')} rules={[{ required: true }]}>
              <DatePicker showTime style={{ width: 240 }} disabledDate={(d) => d.isBefore(dayjs())} />
            </Form.Item>
          </Space>
          <Space size="middle" style={{ display: 'flex' }}>
            <Form.Item name="seedSide" label={t('field.seedSide')}>
              <Radio.Group>
                <Radio.Button value={0}>YES</Radio.Button>
                <Radio.Button value={1}>NO</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item
              name="seedAmount"
              label={t('field.seedAmount')}
              rules={[{ required: true }]}
              extra={isContractCreator ? undefined : t('events.detail.add.seedMinHint', { min: seedMinEds })}
            >
              <InputNumber min={isContractCreator ? 0 : seedMinEds} step={0.1} style={{ width: 220 }} />
            </Form.Item>
          </Space>
          <Space size="middle" style={{ display: 'flex' }}>
            <Form.Item name="externalSource" label={t('events.create.field.externalSource')}>
              <Radio.Group>
                <Radio.Button value={0}>{t('events.create.field.externalSource.opt0')}</Radio.Button>
                <Radio.Button value={1}>{t('events.create.field.externalSource.opt1')}</Radio.Button>
                <Radio.Button value={2}>{t('events.create.field.externalSource.opt2')}</Radio.Button>
              </Radio.Group>
            </Form.Item>
            <Form.Item name="externalMarketId" label={t('events.create.field.externalMarketId')} style={{ flex: 1 }}>
              <Input placeholder={t('events.create.field.externalMarketId.placeholder')} />
            </Form.Item>
            <Form.Item name="externalAuxId" label={t('events.create.field.externalAuxId')}>
              <InputNumber min={0} style={{ width: 140 }} />
            </Form.Item>
          </Space>
          {isContractCreator && (
            <>
              <h4 style={{ marginTop: 16 }}>{t('events.create.section.config')}</h4>
              <Space size="middle" style={{ display: 'flex' }}>
                <Form.Item name="platformFeeBps" label={t('field.platformFeeBps')} rules={[{ required: true }]}>
                  <InputNumber min={0} max={10000} style={{ width: 160 }} />
                </Form.Item>
                <Form.Item name="platformFeeMax" label={t('field.platformFeeMax.noCap')} rules={[{ required: true }]}>
                  <InputNumber min={0} step={0.1} style={{ width: 200 }} />
                </Form.Item>
                <Form.Item name="creatorRewardBps" label={t('field.creatorRewardBps')} rules={[{ required: true }]}>
                  <InputNumber min={0} max={10000} style={{ width: 160 }} />
                </Form.Item>
                <Form.Item name="creatorRewardMax" label={t('field.creatorRewardMax.noCap')} rules={[{ required: true }]}>
                  <InputNumber min={0} step={0.1} style={{ width: 200 }} />
                </Form.Item>
              </Space>
              <Space size="middle" style={{ display: 'flex' }}>
                <Form.Item name="disputeWindowSecs" label={t('field.disputeWindowSecs')} rules={[{ required: true }]}>
                  <InputNumber min={60} style={{ width: 200 }} />
                </Form.Item>
                <Form.Item name="adminTimeoutSecs" label={t('field.adminTimeoutSecs')} rules={[{ required: true }]}>
                  <InputNumber min={3600} style={{ width: 200 }} />
                </Form.Item>
                <Form.Item name="creatorProposeTimeoutSecs" label={t('field.creatorProposeTimeoutSecs')} rules={[{ required: true }]}>
                  <InputNumber min={0} style={{ width: 200 }} />
                </Form.Item>
              </Space>
              <Space size="middle" style={{ display: 'flex' }}>
                <Form.Item name="expiredProposeMode" label={t('field.expiredProposeMode')}>
                  <Select style={{ width: 220 }} options={[
                    { value: 0, label: t('field.expiredProposeMode.opt0') },
                    { value: 1, label: t('field.expiredProposeMode.opt1') },
                  ]}/>
                </Form.Item>
                <Form.Item name="singleSideOnly" label={t('field.singleSideOnly')} valuePropName="checked">
                  <Switch />
                </Form.Item>
              </Space>
            </>
          )}
        </Form>
      </Modal>
    </Drawer>
  );
}

/* ── Visibility controls (trending / flagged) ────────────────────────────── */

interface VisibilityCardProps {
  data: EventDetail | null;
  onToggle?: () => void;
}

function VisibilityCard({ data, onToggle }: VisibilityCardProps) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();

  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [flagReason, setFlagReason] = useState('');

  if (!data) return null;

  const update = async (
    key: 'is_trending' | 'is_flagged' | 'can_share' | 'can_bet' | 'pinned',
    value: number | null,
    extra?: { flagged_reason?: string },
  ) => {
    setSavingKey(key);
    try {
      const body: Record<string, unknown> =
        key === 'is_trending' ? { is_trending: value } :
        key === 'is_flagged' ? { is_flagged: value } :
        key === 'can_share' ? { can_share: value } :
        key === 'can_bet' ? { can_bet: value } :
        { pinned: value };
      if (extra?.flagged_reason !== undefined) {
        body.flagged_reason = extra.flagged_reason;
      }
      await polymindApi.updateEventVisibility(data.slug, body);
      message.success(t('events.visibility.saved'));
      onToggle?.();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setSavingKey(null);
    }
  };

  const handleFlagChange = (checked: boolean) => {
    if (checked) {
      setFlagReason(data.flagged_reason || '');
      setFlagModalOpen(true);
    } else {
      update('is_flagged', 0);
    }
  };

  const confirmFlag = () => {
    if (!flagReason.trim()) {
      message.warning(t('events.visibility.flaggedReasonRequired'));
      return;
    }
    setFlagModalOpen(false);
    update('is_flagged', 1, { flagged_reason: flagReason.trim() });
  };

  const cancelFlag = () => {
    setFlagModalOpen(false);
    setFlagReason('');
  };

  return (
    <div style={{ padding: 16, border: '1px solid #f0f0f0', borderRadius: 8, background: '#fafafa' }}>
      <div style={{ marginBottom: 12, fontWeight: 600 }}>{t('events.visibility.title')}</div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('events.visibility.pinned')}</span>
          <Switch
            checked={data.pinned === 1}
            onChange={(checked) => update('pinned', checked ? 1 : 0)}
            checkedChildren={t('events.visibility.on')}
            unCheckedChildren={t('events.visibility.off')}
            loading={savingKey === 'pinned'}
          />
        </div>
        {data.status !== 'resolved' && data.status !== 'ended' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('events.visibility.trending')}</span>
            <Switch
              checked={data.is_trending === 1}
              onChange={(checked) => update('is_trending', checked ? 1 : 0)}
              checkedChildren={t('events.visibility.on')}
              unCheckedChildren={t('events.visibility.off')}
              loading={savingKey === 'is_trending'}
            />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('events.visibility.flagged')}</span>
          <Switch
            checked={data.is_flagged === 1}
            onChange={handleFlagChange}
            checkedChildren={t('events.visibility.on')}
            unCheckedChildren={t('events.visibility.off')}
            loading={savingKey === 'is_flagged'}
          />
        </div>
        {data.is_flagged === 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{t('events.visibility.canShare')}</span>
            <Switch
              checked={data.can_share === 1}
              onChange={(checked) => update('can_share', checked ? 1 : 0)}
              checkedChildren={t('events.visibility.on')}
              unCheckedChildren={t('events.visibility.off')}
              loading={savingKey === 'can_share'}
            />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('events.visibility.canBet')}</span>
          <Switch
            checked={data.can_bet !== 0}
            onChange={(checked) => update('can_bet', checked ? 1 : 0)}
            checkedChildren={t('events.visibility.on')}
            unCheckedChildren={t('events.visibility.off')}
            loading={savingKey === 'can_bet'}
          />
        </div>
      </Space>

      <Modal
        title={t('events.visibility.flaggedModalTitle')}
        open={flagModalOpen}
        onOk={confirmFlag}
        onCancel={cancelFlag}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        confirmLoading={savingKey === 'is_flagged'}
      >
        <p style={{ marginBottom: 12 }}>{t('events.visibility.flaggedModalDesc')}</p>
        <Input.TextArea
          rows={4}
          value={flagReason}
          onChange={(e) => setFlagReason(e.target.value)}
          placeholder={t('events.visibility.flaggedReasonPlaceholder')}
          maxLength={500}
          showCount
          style={{ marginBottom: 24 }}
        />
      </Modal>
    </div>
  );
}
