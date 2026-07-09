import { PageContainer } from '@ant-design/pro-components';
import { Line } from '@ant-design/plots';
import { ArrowDownOutlined, ArrowUpOutlined, InfoCircleOutlined, MinusOutlined } from '@ant-design/icons';
import { Card, Col, Row, Segmented, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useIntl } from '@umijs/max';
import { useEffect, useState } from 'react';
import {
  polymindApi,
  type BetStats,
  type DashboardStats,
  type InviteStats,
  type TopBetRow,
  type TopUserRow,
  type TrendPoint,
  type UserStats,
} from '@/services/polymind';

const { Text, Title } = Typography;

type Translate = (id: string, values?: any) => string;

// ── colour palettes ───────────────────────────────────────────────────────────
// Colours are keyed off stable identifiers (not display labels) so translating
// the chart series names never breaks the domain→range mapping.
const C_NEW_USERS    = '#1677ff';
const C_ACTIVE_USERS = '#06d6a0';
const C_NEW_EVENTS   = '#9b5de5';
const C_BETS_PLACED  = '#f77f00';

// ── shared helpers ────────────────────────────────────────────────────────────

function Trend({ pct }: { pct: number }) {
  const intl = useIntl();
  const label = (n: number) => intl.formatMessage({ id: 'dashboard.trend.vsPrevWeek' }, { pct: n });
  if (pct > 0) return <Tag color="success"  icon={<ArrowUpOutlined />}>{label(pct)}</Tag>;
  if (pct < 0) return <Tag color="error"    icon={<ArrowDownOutlined />}>{label(Math.abs(pct))}</Tag>;
  return              <Tag color="default"  icon={<MinusOutlined />}>{label(0)}</Tag>;
}

function DistBar({ label, value, pct, color, tooltip }: { label: string; value: number; pct: number; color: string; tooltip?: string }) {
  const labelNode = tooltip ? (
    <Space size={4}>
      <Text>{label}</Text>
      <Tooltip title={tooltip}>
        <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
      </Tooltip>
    </Space>
  ) : <Text>{label}</Text>;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        {labelNode}
        <Text type="secondary">{value.toLocaleString()} ({pct}%)</Text>
      </div>
      <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: 6, width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function StatCard({ title, value, suffix, precision, valueStyle, loading, to, extra, tooltip }: {
  title: string; value: number; suffix?: string; precision?: number;
  valueStyle?: React.CSSProperties; loading: boolean; to?: string; extra?: React.ReactNode;
  tooltip?: string;
}) {
  const titleNode = tooltip ? (
    <Space size={4}>
      {title}
      <Tooltip title={tooltip}>
        <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
      </Tooltip>
    </Space>
  ) : title;
  const inner = (
    <Card loading={loading} hoverable={!!to} style={{ height: '100%' }}>
      <Statistic title={titleNode} value={value} suffix={suffix} precision={precision} valueStyle={valueStyle} />
      {extra && <div style={{ marginTop: 8 }}>{extra}</div>}
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

// ── line chart ────────────────────────────────────────────────────────────────

type LongPoint = { date: string; value: number; category: string };

function toLong(data: TrendPoint[], fields: [keyof TrendPoint, string][]): LongPoint[] {
  return data.flatMap(d =>
    fields.map(([key, label]) => ({ date: d.date, value: Number(d[key]), category: label }))
  );
}

function TrendChart({ data, fields, colorMap, height = 240 }: {
  data: TrendPoint[];
  fields: [keyof TrendPoint, string][];
  colorMap: Record<string, string>;
  height?: number;
}) {
  const domain = fields.map(([, label]) => label);
  const range  = domain.map(label => colorMap[label] ?? '#8c8c8c');
  return (
    <Line
      data={toLong(data, fields)}
      xField="date"
      yField="value"
      colorField="category"
      smooth
      style={{ height }}
      scale={{ color: { domain, range } } as any}
      legend={{ position: 'top-right' } as any}
      interaction={{ tooltip: { shared: true } } as any}
      axis={{ x: { label: { autoRotate: true } } } as any}
    />
  );
}

// ── period toggle ─────────────────────────────────────────────────────────────

function PeriodToggle({ value, onChange }: { value: 7 | 30; onChange: (v: 7 | 30) => void }) {
  const intl = useIntl();
  return (
    <Segmented
      size="small"
      options={[
        { label: intl.formatMessage({ id: 'dashboard.period.7d' }),  value: 7 },
        { label: intl.formatMessage({ id: 'dashboard.period.30d' }), value: 30 },
      ]}
      value={value}
      onChange={v => onChange(v as 7 | 30)}
    />
  );
}

// ── overview cards ────────────────────────────────────────────────────────────

interface OverviewDef {
  title: string; getValue: (s: DashboardStats) => number;
  to?: string; suffix?: string; precision?: number; valueStyle?: React.CSSProperties;
  tooltip?: string;
}

// Colours for active-user split
const C_ACTIVE_POLY     = '#06d6a0';
const C_ACTIVE_CONTRACT = '#bfbfbf';

const overviewCards = (t: Translate): OverviewDef[] => [
  { title: t('dashboard.card.pendingDisputes'),   getValue: s => s.pending_disputes,   to: '/markets?stage=disputed',                    valueStyle: { color: '#ff4d4f' }, tooltip: t('dashboard.tooltip.pendingDisputes') },
  { title: t('dashboard.card.totalMarkets'),      getValue: s => s.total_markets,      to: '/markets',                                   valueStyle: { color: '#faad14' } },
  { title: t('dashboard.card.totalUsers'),        getValue: s => s.total_users,        to: '/users' },
  { title: t('dashboard.card.totalBetAmount'),    getValue: s => Number(s.total_bet_amount) || 0, suffix: 'USDC', precision: 2,            tooltip: t('dashboard.tooltip.totalBetAmount') },
  { title: t('dashboard.card.totalClaimAmount'),  getValue: s => Number(s.total_claim_amount) || 0, suffix: 'USDC', precision: 2,          tooltip: t('dashboard.tooltip.totalClaimAmount') },
  { title: t('dashboard.card.totalDisputes'),     getValue: s => s.total_disputes,                                                   tooltip: t('dashboard.tooltip.totalDisputes') },
];

// ── table column defs ─────────────────────────────────────────────────────────

const topEventsCols = (t: Translate): ColumnsType<TopBetRow> => [
  {
    title: t('dashboard.col.event'), dataIndex: 'question',
    render: (q: string, r) => (
      <Link to={`/events/${r.id}`}>{q.length > 60 ? q.slice(0, 60) + '…' : q}</Link>
    ),
  },
  {
    title: t('dashboard.col.status'), dataIndex: 'status', width: 100,
    render: (s: string, r) => (
      <Tag color={r.resolved ? 'default' : s === 'draft' ? 'orange' : 'green'}>
        {r.resolved ? t('dashboard.status.resolved') : s}
      </Tag>
    ),
  },
  { title: t('dashboard.col.markets'), dataIndex: 'market_count', width: 80, align: 'right' as const },
  {
    title: t('dashboard.col.volumeEds'), dataIndex: 'total_pool_eds', width: 140, align: 'right' as const,
    render: (v: number) => v.toFixed(2),
    sorter: (a: TopBetRow, b: TopBetRow) => a.total_pool_eds - b.total_pool_eds,
    defaultSortOrder: 'descend' as const,
  },
];

const topUsersCols = (t: Translate): ColumnsType<TopUserRow> => [
  {
    title: t('dashboard.col.user'), key: 'user',
    render: (_: unknown, r) => (
      <div>
        {r.nickname || (
          <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {r.identity.slice(0, 16)}…
          </Text>
        )}
      </div>
    ),
  },
  { title: t('dashboard.col.bets'),    dataIndex: 'bet_count',   width: 80, align: 'right' as const },
  { title: t('dashboard.col.entries'), dataIndex: 'entry_count', width: 80, align: 'right' as const },
  {
    title: t('dashboard.col.volumeEds'), dataIndex: 'total_wagered_eds', width: 140, align: 'right' as const,
    render: (v: number) => v.toFixed(2),
    sorter: (a: TopUserRow, b: TopUserRow) => a.total_wagered_eds - b.total_wagered_eds,
    defaultSortOrder: 'descend' as const,
  },
];

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab({ data, trend, loading }: { data: UserStats | null; trend: TrendPoint[]; loading: boolean }) {
  const intl = useIntl();
  const t = (id: string, values?: any) => intl.formatMessage({ id } as any, values);
  const [days, setDays] = useState<7 | 30>(30);
  const slice = days === 7 ? trend.slice(-7) : trend;

  const lNew         = t('dashboard.users.chart.newUsers');
  const lNewMarkets  = t('dashboard.events.chart.newEvents');

  return (
    <>
      <Title level={5} style={{ marginBottom: 12 }}>{t('dashboard.users.breakdown')}</Title>
      <Row gutter={[16, 16]}>
        {([
          { title: t('dashboard.users.totalUsers'),  val: data?.total_users,  color: undefined, suffix: undefined },
          { title: t('dashboard.users.proUsers'),    val: data?.pro_users,    color: '#1677ff',   suffix: undefined },
          { title: t('dashboard.users.freeUsers'),   val: data?.free_users,   color: undefined,   suffix: undefined },
          { title: t('dashboard.users.proRate'),     val: data?.pro_rate_pct,  color: '#1677ff',   suffix: '%',        tooltip: t('dashboard.tooltip.users.proRate') },
          {
            title: t('dashboard.users.activeToday'),
            val: data?.active_today,
            color: '#52c41a',
            suffix: undefined,
            tooltip: t('dashboard.tooltip.users.activeToday'),
            extra: data ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('dashboard.active.poly')} {data.active_today_polymind} · {t('dashboard.active.contract')} {data.active_today_contract}
              </Text>
            ) : null,
          },
          {
            title: t('dashboard.users.activeWeek'),
            val: data?.active_week,
            color: '#52c41a',
            suffix: undefined,
            tooltip: t('dashboard.tooltip.users.activeWeek'),
            extra: data ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('dashboard.active.poly')} {data.active_week_polymind} · {t('dashboard.active.contract')} {data.active_week_contract}
              </Text>
            ) : null,
          },
        ]).map(item => (
          <Col key={item.title} xs={24} sm={12} md={8} lg={4}>
            <StatCard
              title={item.title}
              value={item.val ?? 0}
              loading={loading}
              precision={item.suffix === '%' ? 1 : undefined}
              suffix={item.suffix}
              valueStyle={item.color ? { color: item.color } : undefined}
              tooltip={item.tooltip}
              extra={item.extra}
            />
          </Col>
        ))}
      </Row>

      <Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>{t('dashboard.users.growth')}</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <StatCard title={t('dashboard.users.newToday')} value={data?.new_today ?? 0} loading={loading} />
        </Col>
        <Col xs={24} sm={12} md={8}>
          <StatCard title={t('dashboard.users.newWeek')} value={data?.new_week ?? 0} loading={loading}
            extra={data ? <Trend pct={data.new_week_change_pct} /> : null} />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <StatCard title={t('dashboard.users.newMonth')} value={data?.new_month ?? 0} loading={loading} />
        </Col>
      </Row>

      {slice.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>{t('dashboard.users.trend')}</Title>
            <PeriodToggle value={days} onChange={setDays} />
          </div>
          <Card>
            <TrendChart
              data={slice}
              fields={[['new_users', lNew], ['new_markets', lNewMarkets]]}
              colorMap={{ [lNew]: C_NEW_USERS, [lNewMarkets]: C_NEW_EVENTS }}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 24 }}>
              <Text type="secondary"><span style={{ color: C_NEW_USERS,    fontWeight: 600 }}>■</span> {t('dashboard.users.chart.newUsersLegend')}</Text>
              <Text type="secondary"><span style={{ color: C_NEW_EVENTS,  fontWeight: 600 }}>■</span> {t('dashboard.events.chart.newEventsLegend')}</Text>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

// ── Events tab ────────────────────────────────────────────────────────────────

const STATUS_COLORS  = ['#52c41a', '#faad14', '#1677ff', '#8c8c8c'];
const OUTCOME_COLORS = ['#52c41a', '#ff4d4f', '#8c8c8c'];

function EventsTab({ data, trend, loading }: {
  data: BetStats | null; trend: TrendPoint[]; loading: boolean;
}) {
  const intl = useIntl();
  const t = (id: string, values?: any) => intl.formatMessage({ id } as any, values);
  const [days, setDays] = useState<7 | 30>(30);
  const slice = days === 7 ? trend.slice(-7) : trend;

  const lNewEvents = t('dashboard.events.chart.newEvents');
  const lBets      = t('dashboard.events.chart.betsPlaced');

  return (
    <>
      <Title level={5} style={{ marginBottom: 12 }}>{t('dashboard.events.counts')}</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={5}>
          <StatCard title={t('dashboard.events.totalMarkets')}    value={data?.total_markets    ?? 0} loading={loading} to="/markets"
            tooltip={t('dashboard.tooltip.events.totalMarkets')} />
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <StatCard title={t('dashboard.events.resolvedMarkets')} value={data?.resolved_markets ?? 0} loading={loading}
            tooltip={t('dashboard.tooltip.events.resolvedMarkets')} />
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <StatCard title={t('dashboard.events.totalVolume')}     value={data?.total_volume_eds ?? 0} loading={loading} suffix="USDC" precision={2}
            tooltip={t('dashboard.tooltip.events.totalVolume')} />
        </Col>
        <Col xs={24} sm={12} md={8} lg={5}>
          <StatCard title={t('dashboard.events.totalEntries')}    value={data?.total_entries    ?? 0} loading={loading} />
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <StatCard
            title={t('dashboard.events.uniquePlayers')}
            value={data?.unique_players   ?? 0}
            loading={loading}
            tooltip={t('dashboard.tooltip.events.uniquePlayers')}
            extra={data ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('dashboard.active.poly')} {data.unique_players_polymind} · {t('dashboard.active.contract')} {data.unique_players_contract}
              </Text>
            ) : null}
          />
        </Col>
      </Row>

      {/* Activity chart */}
      {slice.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 }}>
            <Title level={5} style={{ margin: 0 }}>{t('dashboard.events.activityTrend')}</Title>
            <PeriodToggle value={days} onChange={setDays} />
          </div>
          <Card>
            <TrendChart
              data={slice}
              fields={[['new_markets', lNewEvents], ['bet_amount', lBets]]}
              colorMap={{ [lNewEvents]: C_NEW_EVENTS, [lBets]: C_BETS_PLACED }}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 24 }}>
              <Text type="secondary"><span style={{ color: C_NEW_EVENTS,  fontWeight: 600 }}>■</span> {t('dashboard.events.chart.newEventsLegend')}</Text>
              <Text type="secondary"><span style={{ color: C_BETS_PLACED, fontWeight: 600 }}>■</span> {t('dashboard.events.chart.betsPlacedLegend')}</Text>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

// ── Invites tab ───────────────────────────────────────────────────────────────

function InvitesTab({ data, loading }: { data: InviteStats | null; loading: boolean }) {
  const intl = useIntl();
  const t = (id: string, values?: any) => intl.formatMessage({ id } as any, values);

  return (
    <>
      <Title level={5} style={{ marginBottom: 12 }}>{t('dashboard.invites.overview')}</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <StatCard
            title={t('dashboard.invites.totalInviters')}
            value={data?.total_inviters ?? 0}
            loading={loading}
            tooltip={t('dashboard.tooltip.invites.totalInviters')}
          />
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <StatCard
            title={t('dashboard.invites.totalInvitees')}
            value={data?.total_invitees ?? 0}
            loading={loading}
            tooltip={t('dashboard.tooltip.invites.totalInvitees')}
          />
        </Col>
      </Row>
    </>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const intl = useIntl();
  const t = (id: string, values?: any) => intl.formatMessage({ id } as any, values);
  const [overview,  setOverview]  = useState<DashboardStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [betStats,  setBetStats]  = useState<BetStats  | null>(null);
  const [inviteStats, setInviteStats] = useState<InviteStats | null>(null);
  const [trend,     setTrend]     = useState<TrendPoint[]>([]);
  const [topEvents, setTopEvents] = useState<TopBetRow[]>([]);
  const [topUsers,  setTopUsers]  = useState<TopUserRow[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      polymindApi.dashboardStats(),
      polymindApi.userStats(),
      polymindApi.betStats(),
      polymindApi.inviteStats(),
      polymindApi.dashboardTrend(30),
      polymindApi.topBets(10),
      polymindApi.topUsers(10),
    ]).then(([ovRes, usRes, bsRes, invRes, trendRes, topEvRes, topUsRes]) => {
      if (cancelled) return;
      if (ovRes.status    === 'fulfilled') setOverview(ovRes.value);
      if (usRes.status    === 'fulfilled') setUserStats(usRes.value);
      if (bsRes.status    === 'fulfilled') setBetStats(bsRes.value);
      if (invRes.status   === 'fulfilled') setInviteStats(invRes.value);
      if (trendRes.status === 'fulfilled') setTrend(trendRes.value);
      if (topEvRes.status === 'fulfilled') setTopEvents(topEvRes.value);
      if (topUsRes.status === 'fulfilled') setTopUsers(topUsRes.value);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <PageContainer>
      {/* ── overview ── */}
      <Row gutter={[16, 16]}>
        {overviewCards(t).map(def => (
          <Col key={def.title} xs={24} sm={12} md={8} lg={4}>
            <StatCard
              title={def.title}
              value={overview ? def.getValue(overview) : 0}
              to={def.to}
              suffix={def.suffix}
              precision={def.precision}
              valueStyle={def.valueStyle}
              loading={loading}
              tooltip={def.tooltip}
            />
          </Col>
        ))}
      </Row>

      {/* ── main tabs ── */}
      <Card style={{ marginTop: 24 }} styles={{ body: { paddingTop: 0 } }}>
        <Tabs
          defaultActiveKey="users"
          size="large"
          items={[
            {
              key: 'users',
              label: t('dashboard.tab.users'),
              children: <UsersTab data={userStats} trend={trend} loading={loading} />,
            },
            {
              key: 'events',
              label: t('dashboard.tab.events'),
              children: <EventsTab data={betStats} trend={trend} loading={loading} />,
            },
            {
              key: 'invites',
              label: t('dashboard.tab.invites'),
              children: <InvitesTab data={inviteStats} loading={loading} />,
            },
            {
              key: 'top-events',
              label: t('dashboard.tab.topEvents'),
              children: (
                <Table<TopBetRow>
                  dataSource={topEvents}
                  columns={topEventsCols(t)}
                  rowKey="id"
                  size="small"
                  pagination={false}
                  loading={loading}
                />
              ),
            },
            {
              key: 'top-users',
              label: t('dashboard.tab.topUsers'),
              children: (
                <Table<TopUserRow>
                  dataSource={topUsers}
                  columns={topUsersCols(t)}
                  rowKey="identity"
                  size="small"
                  pagination={false}
                  loading={loading}
                />
              ),
            },
          ]}
        />
      </Card>
    </PageContainer>
  );
}
