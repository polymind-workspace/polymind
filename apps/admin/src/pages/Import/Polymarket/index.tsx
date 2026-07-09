import { PageContainer } from '@ant-design/pro-components';
import {
  Alert, App, Button, Card, DatePicker, Drawer, Empty, Form, Input,
  InputNumber, List, Modal, Radio, Segmented, Select, Space, Spin,
  Switch, Tag, Typography,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl, useModel } from '@umijs/max';
import {
  polymindApi,
  type PolymarketCategory,
  type PolymarketEvent,
  type PolymarketMarket,
} from '@/services/polymind';
import { v3AdminCreateEventWithMarket, v3AddMarket } from '@/wallet/endless';
import { syncEventTx } from '@/wallet/syncEvent';
import { useAdminTx } from '@/hooks/useAdminTx';
import SignerStatusCard from '@/components/SignerStatusCard';
import styles from './index.module.css';

const EDS = 1e8;

interface ImportFormValues {
  question: string;
  description: string;
  title: string;
  labelYes: string;
  labelNo: string;
  deadline: Dayjs;
  seedSide: 0 | 1;
  seedAmount: number;
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

function fmtVolume(v: number) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export default function ImportPolymarketPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const [categories, setCategories] = useState<PolymarketCategory[]>([]);
  const [category, setCategory] = useState<string>('');
  const [q, setQ] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [events, setEvents] = useState<PolymarketEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 24;
  const [openEvent, setOpenEvent] = useState<PolymarketEvent | null>(null);
  const [picked, setPicked] = useState<PolymarketMarket | null>(null);
  const [cfgDefaults, setCfgDefaults] = useState<Record<string, unknown> | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [form] = Form.useForm<ImportFormValues>();
  const adminTx = useAdminTx();
  const wallet = useModel('wallet');

  const [sortBy, setSortBy]       = useState<string>('volume');
  const [ascending, setAscending] = useState(false);
  const [days, setDays]           = useState<number | undefined>(undefined);

  // Apply per-category default sort when category or category list changes
  useEffect(() => {
    const cat = categories.find((c) => c.key === category);
    setSortBy(cat?.default_order ?? 'volume');
    setAscending(cat?.default_ascending ?? false);
  }, [category, categories]);

  // Single source of truth for all polymarketEvents call sites
  const buildApiParams = useCallback(
    (offset: number, overrideLimit?: number) => ({
      category:  category || undefined,
      q:         q || undefined,
      active:    activeOnly,
      closed:    !activeOnly,
      order:     sortBy,
      ascending,
      days,
      limit:     overrideLimit ?? PAGE_SIZE,
      offset,
    }),
    [category, q, activeOnly, sortBy, ascending, days],
  );

  const seedMinEds = useMemo(() => {
    const raw = Number((cfgDefaults || {}).creator_seed_min ?? 0);
    return raw > 0 ? raw / EDS : 5;
  }, [cfgDefaults]);
  const isAddMarketPath =
    !!openEvent?.onchain_event_id || (openEvent?.imported_count || 0) > 0;
  const seedFloor = isAddMarketPath ? seedMinEds : 0;

  useEffect(() => {
    polymindApi.polymarketCategories().then(setCategories).catch(() => {});
    polymindApi.getConfig().then(setCfgDefaults).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setHasMore(true);
    polymindApi
      .polymarketEvents(buildApiParams(0))
      .then((res) => {
        const data = res.data || [];
        setEvents(data);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => { setEvents([]); setHasMore(false); })
      .finally(() => setLoading(false));
  }, [category, q, activeOnly, sortBy, ascending, days, buildApiParams]);

  // Sync openEvent when events list refreshes so onchain_event_id is up-to-date.
  // Only update the linking fields; preserve markets state to avoid overwriting
  // already_imported flags before the indexer has caught up.
  useEffect(() => {
    if (!openEvent) return;
    const updated = events.find((ev) => ev.id === openEvent.id);
    if (updated && updated.onchain_event_id !== openEvent.onchain_event_id) {
      setOpenEvent({
        ...openEvent,
        onchain_event_id: updated.onchain_event_id,
        onchain_event_creator: updated.onchain_event_creator,
      });
    }
  }, [events, openEvent]);

  const loadMore = () => {
    setLoadingMore(true);
    polymindApi
      .polymarketEvents(buildApiParams(events.length))
      .then((res) => {
        const data = res.data || [];
        setEvents((prev) => [...prev, ...data]);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  };

  const visibleEvents = useMemo(() => {
    if (!activeOnly) return events;
    const now = Date.now();
    return events.filter((ev) => {
      if (ev.closed) return false;
      if (!ev.end_date) return true;
      return dayjs(ev.end_date).valueOf() > now;
    });
  }, [events, activeOnly]);

  const drawerMarkets = useMemo(() => {
    if (!openEvent) return [];
    const now = Date.now();
    return openEvent.markets.filter((m) => {
      if (m.closed) return false;
      if (!m.end_date) return true;
      return dayjs(m.end_date).valueOf() > now;
    });
  }, [openEvent]);

  const adminBlockReason = !wallet.address
    ? t('import.adminBlock.connect')
    : !wallet.contractAddr
    ? t('import.adminBlock.loading')
    : !wallet.isAdmin
    ? t('import.adminBlock.notAdmin', { addr: wallet.address.slice(0, 10) })
    : null;

  const isCreatorMismatch =
    !!openEvent?.onchain_event_id &&
    !!openEvent.onchain_event_creator &&
    !!wallet.address &&
    !wallet.signerMatches(openEvent.onchain_event_creator);

  const drawerCanImport =
    adminTx.canRun && !!openEvent && !isCreatorMismatch && !isLinking;

  useEffect(() => {
    if (!picked) return;
    const endTs = picked.end_date ? dayjs(picked.end_date) : dayjs().add(7, 'day');
    const c = cfgDefaults || {};
    const eventTitle = openEvent?.title || picked.question;
    const eventDesc = openEvent?.description || picked.description || picked.question;
    const marketTitle = picked.group_item_title || picked.question;
    form.setFieldsValue({
      question: eventTitle,
      description: eventDesc,
      title: marketTitle.slice(0, 80),
      labelYes: 'YES',
      labelNo: 'NO',
      deadline: endTs,
      seedSide: 0,
      seedAmount: seedFloor,
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
  }, [picked, openEvent, cfgDefaults, form]);

  const submitImport = async () => {
    if (!picked || !openEvent) return;
    const v = await form.validateFields();
    const deadlineSec = Math.floor(v.deadline.valueOf() / 1000);
    if (deadlineSec <= Math.floor(Date.now() / 1000)) {
      form.setFields([{ name: 'deadline', errors: [t('field.deadlineFuture')] }]);
      return;
    }
    if (isAddMarketPath && v.seedAmount < seedMinEds) {
      form.setFields([{
        name: 'seedAmount',
        errors: [t('events.detail.add.seedMinErr', { min: seedMinEds })],
      }]);
      return;
    }
    const pmEventIdNum = Number.parseInt(openEvent.id, 10);
    const externalAuxId = Number.isFinite(pmEventIdNum) ? pmEventIdNum : 0;
    const externalMarketId = picked.condition_id || picked.id;
    const existingEventId = openEvent.onchain_event_id;

    if (isAddMarketPath && !existingEventId) {
      message.warning(t('import.error.eventAlreadyImported'));
      return;
    }

    adminTx.run({
      name: existingEventId ? t('import.tx.add') : t('import.tx.import'),
      call: (addr) => {
        if (existingEventId) {
          return v3AddMarket(addr, {
            eventId: existingEventId,
            title: v.title,
            labelYes: v.labelYes,
            labelNo: v.labelNo,
            deadline: deadlineSec,
            seedSide: v.seedSide,
            seedAmount: BigInt(Math.round(v.seedAmount * EDS)),
            externalSource: 1,
            externalMarketId,
            externalAuxId,
          });
        }
        return v3AdminCreateEventWithMarket(addr, {
          question: v.question,
          description: v.description,
          title: v.title,
          labelYes: v.labelYes,
          labelNo: v.labelNo,
          deadline: deadlineSec,
          seedSide: v.seedSide,
          seedAmount: BigInt(Math.round(v.seedAmount * EDS)),
          externalSource: 1,
          externalMarketId,
          externalAuxId,
          platformFeeBps: v.platformFeeBps,
          platformFeeMax: BigInt(Math.round(v.platformFeeMax * EDS)),
          creatorRewardBps: v.creatorRewardBps,
          creatorRewardMax: BigInt(Math.round(v.creatorRewardMax * EDS)),
          disputeWindowSecs: v.disputeWindowSecs,
          adminTimeoutSecs: v.adminTimeoutSecs,
          creatorProposeTimeoutSecs: v.creatorProposeTimeoutSecs,
          expiredProposeMode: v.expiredProposeMode,
          singleSideOnly: v.singleSideOnly,
        });
      },
      confirm: existingEventId
        ? {
            title:   t('import.confirm.addTitle', { id: existingEventId }),
            content: t('import.confirm.addContent', { title: v.title, id: existingEventId }),
          }
        : {
            title:   t('import.confirm.createTitle'),
            content: t('import.confirm.createContent', { question: picked.question }),
          },
      onDone: async (hash) => {
        // Block further imports while we fetch the on-chain event id.
        if (!existingEventId) {
          setIsLinking(true);
        }

        // Immediately update onchain_event_id via syncEventTx so the drawer
        // stays current for subsequent imports of the same Polymarket event.
        try {
          const data = await syncEventTx(hash, {
            source:      'polymarket',
            description: existingEventId ? undefined : v.description,
          });
          if (data?.onchain_event_id && openEvent) {
            setOpenEvent({ ...openEvent, onchain_event_id: data.onchain_event_id });
          }
        } catch (err) {
          console.error('[Import/Polymarket] source tag failed:', err);
        } finally {
          setIsLinking(false);
        }

        const cid = picked.condition_id;
        setPicked(null);
        setEvents((prev) =>
          prev.map((ev) => {
            let bumped = 0;
            const ms = ev.markets.map((m) => {
              if (m.condition_id === cid && !m.already_imported) {
                bumped = 1;
                return { ...m, already_imported: true };
              }
              return m;
            });
            return bumped
              ? { ...ev, markets: ms, imported_count: ev.imported_count + 1 }
              : ev;
          }),
        );
        setOpenEvent((ev) => {
          if (!ev) return ev;
          const ms = ev.markets.map((m) =>
            m.condition_id === cid ? { ...m, already_imported: true } : m,
          );
          const inc = ev.markets.some(
            (m) => m.condition_id === cid && !m.already_imported,
          )
            ? 1
            : 0;
          return { ...ev, markets: ms, imported_count: ev.imported_count + inc };
        });
        setTimeout(() => {
          polymindApi
            .polymarketEvents(buildApiParams(0, 100))
            .then((res) => setEvents(res.data || []))
            .catch(() => {});
        }, 4000);
      },
    });
  };

  const categoryOptions = useMemo(
    () => [{ key: '', label: t('import.filter.all') }, ...categories],
    [categories, intl.locale],
  );

  return (
    <PageContainer content={t('import.subtitle')}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {adminBlockReason && (
          <Alert type="warning" showIcon message={adminBlockReason} />
        )}

        <Card size="small">
          <Space wrap>
            <Space>
              <span>{t('import.filter.category')}</span>
              <Radio.Group
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                {categoryOptions.map((c) => (
                  <Radio.Button key={c.key} value={c.key}>
                    {c.label}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </Space>

            <Space>
              <span style={{ fontSize: 13, color: '#666' }}>{t('import.filter.activity')}</span>
              <Segmented
                value={sortBy}
                onChange={(v) => { setSortBy(v as string); setAscending(false); }}
                options={[
                  { value: 'volume',     label: t('import.filter.activity.allTime') },
                  { value: 'volume24hr', label: t('import.filter.activity.today')   },
                  { value: 'volume1wk',  label: t('import.filter.activity.week')    },
                  { value: 'volume1mo',  label: t('import.filter.activity.month')   },
                  { value: 'breaking',   label: t('import.filter.activity.breaking') },
                ]}
              />
            </Space>

            <Space>
              <span style={{ fontSize: 13, color: '#666' }}>{t('import.filter.expires')}</span>
              <Select
                value={days ?? null}
                placeholder={t('import.filter.expires.all')}
                allowClear
                style={{ width: 120 }}
                onChange={(v: number | null) => setDays(v ?? undefined)}
                onClear={() => setDays(undefined)}
                options={[
                  { value: 1,  label: t('import.filter.expires.daily')   },
                  { value: 7,  label: t('import.filter.expires.weekly')  },
                  { value: 30, label: t('import.filter.expires.monthly') },
                ]}
              />
            </Space>

            <Input.Search
              placeholder={t('import.filter.search')}
              allowClear
              style={{ width: 220 }}
              onSearch={setQ}
            />
            <Space size={6}>
              <Switch
                size="small"
                checked={activeOnly}
                onChange={setActiveOnly}
              />
              <span style={{ fontSize: 13 }}>{t('import.filter.activeOnly')}</span>
            </Space>
          </Space>
        </Card>

        <Spin spinning={loading}>
          {visibleEvents.length === 0 && !loading ? (
            <Empty description={t('import.empty')} />
          ) : (
            <>
              <List
                grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 3, xxl: 4 }}
                dataSource={visibleEvents}
                renderItem={(ev) => (
                  <EventCard
                    ev={ev}
                    onOpen={() => setOpenEvent(ev)}
                    showVol24h={sortBy === 'volume24hr'}
                    showPriceChange={sortBy === 'breaking'}
                  />
                )}
                className={styles.pmEventGrid}
              />
              {hasMore && (
                <div style={{ textAlign: 'center', marginTop: 16 }}>
                  <Button onClick={loadMore} loading={loadingMore}>
                    {t('import.loadMore')}
                  </Button>
                </div>
              )}
            </>
          )}
        </Spin>
      </Space>

      <Drawer
        open={!!openEvent}
        onClose={() => setOpenEvent(null)}
        width={680}
        title={null}
        destroyOnClose
        styles={{ body: { padding: 0 } }}
      >
        {openEvent && (
          <div>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
              <Space align="start" size={14} style={{ width: '100%' }}>
                <ImgWithFallback src={openEvent.icon || openEvent.image} size={64} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginBottom: 6 }}>
                    {openEvent.title}
                  </div>
                  <Space size={6} wrap style={{ fontSize: 12, color: '#666' }}>
                    <span>{fmtVolume(openEvent.volume)} Vol</span>
                    <span>·</span>
                    <span>{t('import.card.markets', { count: openEvent.market_count })}</span>
                    {openEvent.end_date && (
                      <>
                        <span>·</span>
                        <span>{t('import.card.ends', { date: dayjs(openEvent.end_date).format('MMM D, YYYY') })}</span>
                      </>
                    )}
                  </Space>
                </div>
              </Space>
              {openEvent.description && (
                <Typography.Paragraph
                  type="secondary"
                  ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}
                  style={{ marginTop: 12, marginBottom: 0, fontSize: 13 }}
                >
                  {openEvent.description}
                </Typography.Paragraph>
              )}
              {openEvent.onchain_event_id && (
                <Alert
                  type={isCreatorMismatch ? 'warning' : 'info'}
                  showIcon
                  style={{ marginTop: 12 }}
                  message={
                    isCreatorMismatch
                      ? t('import.drawer.linkedMismatch', {
                          id: openEvent.onchain_event_id,
                          addr: openEvent.onchain_event_creator?.slice(0, 10) || '',
                        })
                      : t('import.drawer.linkedInfo', { id: openEvent.onchain_event_id })
                  }
                />
              )}
              {isLinking && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 12 }}
                  message={t('import.drawer.linking')}
                />
              )}
            </div>

            <div style={{ padding: '8px 24px 24px' }}>
              {drawerMarkets.length ? (
                drawerMarkets.map((m) => (
                  <DrawerMarketRow
                    key={m.condition_id || m.id}
                    m={m}
                    canImport={drawerCanImport}
                    addMode={isAddMarketPath}
                    eventOnchainId={openEvent?.onchain_event_id ?? null}
                    isLinking={isLinking}
                    onImport={() => setPicked(m)}
                  />
                ))
              ) : (
                <Empty description={t('import.drawer.noActive')} />
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        title={
          picked
            ? openEvent?.onchain_event_id
              ? t('import.modal.titleAdd', { id: openEvent.onchain_event_id })
              : t('import.modal.titleCreate')
            : ''
        }
        open={!!picked}
        width={760}
        onCancel={() => setPicked(null)}
        onOk={submitImport}
        okText={openEvent?.onchain_event_id ? t('import.modal.okAdd') : t('import.modal.okCreate')}
        okButtonProps={{ loading: adminTx.busy, disabled: !wallet.isContractCreator }}
        destroyOnClose
      >
        {picked && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={
                <Space>
                  <span>{t('import.modal.source')}</span>
                  <a
                    href={`https://polymarket.com/event/${openEvent?.slug || picked.slug}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('import.modal.open')}
                  </a>
                </Space>
              }
              description={t('import.modal.conditionId', { id: picked.condition_id || '—' })}
            />
            <SignerStatusCard role="creator" compact style={{ marginBottom: 16 }} />
            <Form form={form} layout="vertical" disabled={adminTx.busy}>
              {!openEvent?.onchain_event_id && (
                <>
                  <Form.Item name="question"    label={t('field.question')}    rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="description" label={t('field.description')} rules={[{ required: true }]}>
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </>
              )}
              <Space size="middle" style={{ display: 'flex' }}>
                <Form.Item name="title"    label={t('field.title')}    rules={[{ required: true }]} style={{ flex: 1 }}>
                  <Input />
                </Form.Item>
                <Form.Item name="deadline" label={t('field.deadline')} rules={[{ required: true }]}>
                  <DatePicker showTime style={{ width: 220 }} />
                </Form.Item>
              </Space>
              <Space size="middle" style={{ display: 'flex' }}>
                <Form.Item name="labelYes"  label={t('field.labelYes')}>
                  <Input style={{ width: 120 }} />
                </Form.Item>
                <Form.Item name="labelNo"   label={t('field.labelNo')}>
                  <Input style={{ width: 120 }} />
                </Form.Item>
                <Form.Item name="seedSide"  label={t('field.seedSide')}>
                  <Radio.Group>
                    <Radio.Button value={0}>YES</Radio.Button>
                    <Radio.Button value={1}>NO</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                <Form.Item
                  name="seedAmount"
                  label={t('field.seedAmount')}
                  extra={isAddMarketPath ? t('events.detail.add.seedMinHint', { min: seedMinEds }) : undefined}
                >
                  <InputNumber min={seedFloor} step={0.1} style={{ width: 140 }} />
                </Form.Item>
              </Space>
              {!openEvent?.onchain_event_id && (
                <>
                  <Space size="middle" style={{ display: 'flex' }}>
                    <Form.Item name="platformFeeBps"   label={t('field.platformFeeBps')}>
                      <InputNumber min={0} max={10000} style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item name="platformFeeMax"   label={t('field.platformFeeMax')}>
                      <InputNumber min={0} step={0.1} style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item name="creatorRewardBps" label={t('field.creatorRewardBps')}>
                      <InputNumber min={0} max={10000} style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item name="creatorRewardMax" label={t('field.creatorRewardMax')}>
                      <InputNumber min={0} step={0.1} style={{ width: 180 }} />
                    </Form.Item>
                  </Space>
                  <Space size="middle" wrap style={{ display: 'flex' }}>
                    <Form.Item name="disputeWindowSecs"         label={t('field.disputeWindowSecs')}>
                      <InputNumber min={60} style={{ width: 180 }} />
                    </Form.Item>
                    <Form.Item name="adminTimeoutSecs"          label={t('field.adminTimeoutSecs')}>
                      <InputNumber min={3600} style={{ width: 200 }} />
                    </Form.Item>
                    <Form.Item name="creatorProposeTimeoutSecs" label={t('field.creatorProposeTimeoutSecs')}>
                      <InputNumber min={0} style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item name="expiredProposeMode"        label={t('field.expiredProposeMode')}>
                      <Select
                        style={{ width: 220 }}
                        options={[
                          { value: 0, label: t('field.expiredProposeMode.opt0') },
                          { value: 1, label: t('field.expiredProposeMode.opt1') },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name="singleSideOnly" label={t('field.singleSideOnly')} valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Space>
                </>
              )}
            </Form>
          </>
        )}
      </Modal>
    </PageContainer>
  );
}

const PLACEHOLDER_BG = 'linear-gradient(135deg, #eef2ff, #ddd6fe)';

function ImgWithFallback({ src, size }: { src?: string; size: number }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div style={{ width: size, height: size, borderRadius: 8, flexShrink: 0, background: PLACEHOLDER_BG }} />;
  }
  return (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
      onError={() => setFailed(true)}
    />
  );
}

interface EventCardProps {
  ev: PolymarketEvent;
  onOpen: () => void;
  showVol24h?: boolean;
  showPriceChange?: boolean;
}

function topMarkets(ev: PolymarketEvent, n: number) {
  const withPrice = ev.markets
    .map((m) => ({ m, p: m.yes_price ?? -1 }))
    .filter((x) => x.p >= 0)
    .sort((a, b) => b.p - a.p);
  return withPrice.slice(0, n).map((x) => x.m);
}

function inlineLabel(m: PolymarketMarket): string {
  if (m.group_item_title) return m.group_item_title;
  return m.question.length > 40 ? `${m.question.slice(0, 40)}…` : m.question;
}

function pct(p: number | null): string {
  if (p == null) return '—';
  return `${Math.round(p * 100)}%`;
}

function EventCard({ ev, onOpen, showVol24h, showPriceChange }: EventCardProps) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const isBinary = ev.markets.length === 1 && ev.markets[0]?.yes_price != null;
  const top = topMarkets(ev, 3);
  const fullyImported = ev.market_count > 0 && ev.imported_count >= ev.market_count;

  return (
    <List.Item>
      <Card
        hoverable
        onClick={onOpen}
        className={styles.eventCard}
        style={{ opacity: fullyImported ? 0.65 : 1 }}
      >
        <Space align="start" size={12} style={{ width: '100%' }}>
          <ImgWithFallback src={ev.icon || ev.image} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography.Paragraph
              strong
              ellipsis={{ rows: 2, tooltip: ev.title }}
              style={{ fontSize: 15, lineHeight: 1.35, marginBottom: 0 }}
            >
              {ev.title}
            </Typography.Paragraph>
            {isBinary && top[0] && (
              <div style={{ marginTop: 6, fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
                {pct(top[0].yes_price)}
                <span style={{ fontSize: 12, fontWeight: 400, color: '#888', marginLeft: 6 }}>
                  {t('import.card.chance')}
                </span>
              </div>
            )}
          </div>
        </Space>

        <div style={{ flex: 1, marginTop: 14 }}>
          {!isBinary && top.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {top.map((m) => (
                <InlineMarketRow key={m.condition_id || m.id} m={m} />
              ))}
              {ev.market_count > top.length && (
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {t('import.card.more', { n: ev.market_count - top.length })}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#666',
            fontSize: 12,
          }}
        >
          <Space size={4}>
            <span>{fmtVolume(ev.volume)} Vol</span>
            {showVol24h && (ev.volume24hr ?? 0) > 0 && (
              <Tag color="orange" style={{ margin: 0 }}>
                {t('import.card.vol24h', { v: fmtVolume(ev.volume24hr) })}
              </Tag>
            )}
            {showPriceChange && (ev.price_change_24h ?? 0) !== 0 && (() => {
              const chg = ev.price_change_24h;
              const pct = Math.round(Math.abs(chg) * 100);
              const up = chg > 0;
              return (
                <Tag color={up ? 'green' : 'red'} style={{ margin: 0 }}>
                  {up ? '↑' : '↓'}{pct}%
                </Tag>
              );
            })()}
          </Space>
          <Space size={6}>
            {ev.imported_count > 0 && (
              <Tag color={fullyImported ? 'green' : 'orange'} style={{ margin: 0 }}>
                {fullyImported ? t('import.card.allImported') : `${ev.imported_count}/${ev.market_count}`}
              </Tag>
            )}
            {ev.closed && <Tag color="red" style={{ margin: 0 }}>{t('import.card.closed')}</Tag>}
          </Space>
        </div>
      </Card>
    </List.Item>
  );
}

function InlineMarketRow({ m }: { m: PolymarketMarket }) {
  const p = m.yes_price ?? 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: 13,
          color: '#1a1a1a',
          opacity: m.already_imported ? 0.5 : 1,
        }}
      >
        {inlineLabel(m)}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 110, justifyContent: 'flex-end' }}>
        <div
          style={{
            width: 48,
            height: 4,
            borderRadius: 2,
            background: '#eee',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0, top: 0, bottom: 0,
              width: `${Math.max(2, Math.min(100, p * 100))}%`,
              background: '#1677ff',
            }}
          />
        </div>
        <span style={{ fontWeight: 600, fontSize: 13, minWidth: 36, textAlign: 'right' }}>
          {pct(m.yes_price)}
        </span>
      </div>
    </div>
  );
}

interface DrawerMarketRowProps {
  m: PolymarketMarket;
  canImport: boolean;
  addMode: boolean;
  eventOnchainId: number | null;
  isLinking: boolean;
  onImport: () => void;
}

function DrawerMarketRow({ m, canImport, addMode, eventOnchainId, isLinking, onImport }: DrawerMarketRowProps) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const p = m.yes_price ?? 0;
  const hasPrice = m.yes_price != null;
  const isSynced = eventOnchainId != null && eventOnchainId > 0;
  const waitingSync = addMode && !isSynced;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 0',
        borderBottom: '1px solid #f5f5f5',
        opacity: m.already_imported ? 0.55 : 1,
      }}
    >
      <ImgWithFallback src={m.icon || m.image} size={36} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            lineHeight: 1.35,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={m.question}
        >
          {inlineLabel(m)}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
          {fmtVolume(m.volume)} Vol
          {m.end_date && ` · ${t('import.row.endsShort', { date: dayjs(m.end_date).format('MMM D') })}`}
          {m.closed && ` · ${t('import.row.closed')}`}
        </div>
      </div>

      {hasPrice && (
        <div
          style={{
            minWidth: 56,
            textAlign: 'right',
            fontSize: 18,
            fontWeight: 700,
            color: p >= 0.5 ? '#16a34a' : '#dc2626',
          }}
        >
          {pct(m.yes_price)}
        </div>
      )}

      <Button
        type={m.already_imported ? 'default' : 'primary'}
        size="small"
        disabled={m.already_imported || !canImport || isLinking || waitingSync}
        onClick={onImport}
      >
        {m.already_imported
          ? t('import.row.imported')
          : isLinking || waitingSync
            ? t('import.row.linking')
            : addMode
              ? t('import.row.add')
              : t('import.row.import')}
      </Button>
    </div>
  );
}
