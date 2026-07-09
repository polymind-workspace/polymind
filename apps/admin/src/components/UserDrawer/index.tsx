import {
  Alert, Avatar, Button, Card, Col, DatePicker, Descriptions, Drawer,
  message, Row, Spin, Statistic, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd';
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  downloadCsv,
  polymindApi,
  type UserDetail,
  type UserDetailStats,
  type UserInviteRelations,
  type UserTxRow,
} from '@/services/polymind';
import { resolveAvatar } from '@/utils/avatar';
import { formatDate } from '@/utils/format';

const { Text, Paragraph } = Typography;

interface Props {
  open: boolean;
  luffaId: string | null;
  onClose: () => void;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtUnix = (ts: number | null | undefined) => formatDate(ts, { unix: true });

const fmtIso = (s: string | null | undefined) => formatDate(s);

const shortAddr = (a: string) =>
  a.length > 20 ? `${a.slice(0, 10)}…${a.slice(-8)}` : a;

// ── transactions table ────────────────────────────────────────────────────────

const TXN_PAGE = 10;

function TransactionsTab({ luffaId }: { luffaId: string }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [rows,    setRows]    = useState<UserTxRow[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(false);
  // tick triggers a fetch; filterRef always holds the latest date filter
  const [tick,    setTick]    = useState(0);
  const [pgTick,  setPgTick]  = useState<{ page: number; tick: number }>({ page: 1, tick: 0 });
  const filterRef = useRef<{ start?: string; end?: string }>({});
  const reqId     = useRef(0);

  const txnCols = useMemo<ColumnsType<UserTxRow>>(() => [
    {
      title: t('users.tx.col.event'),
      key: 'event',
      render: (_, row) => (
        <div style={{ minWidth: 160 }}>
          <Paragraph
            ellipsis={{ rows: 2 }}
            style={{ marginBottom: 0, fontSize: 13 }}
            title={row.event_question}
          >
            {row.event_question || <Text type="secondary">Unknown event</Text>}
          </Paragraph>
          {row.market_title && (
            <Text type="secondary" style={{ fontSize: 11 }}>{row.market_title}</Text>
          )}
        </div>
      ),
    },
    {
      title: t('users.tx.col.side'),
      dataIndex: 'is_buy',
      width: 65,
      align: 'center' as const,
      render: (v: number) =>
        v === 1
          ? <Tag color="green"  style={{ margin: 0 }}>{t('bets.side.yes')}</Tag>
          : <Tag color="red"    style={{ margin: 0 }}>{t('bets.side.no')}</Tag>,
    },
    {
      title: t('users.tx.col.amount'),
      dataIndex: 'amount_eds',
      width: 110,
      align: 'right' as const,
      render: (v: number) => <Text strong>{parseFloat(v.toFixed(4)).toString()}</Text>,
    },
    {
      title: t('users.tx.col.outcome'),
      key: 'outcome',
      width: 85,
      align: 'center' as const,
      render: (_, row) => {
        if (!row.event_resolved) return <Tag>{t('bets.outcome.pending')}</Tag>;
        if (row.event_outcome === 3) return <Tag>{t('bets.outcome.void')}</Tag>;
        const won = (row.is_buy === 1 && row.event_outcome === 1)
          || (row.is_buy === 0 && row.event_outcome === 2);
        return won ? <Tag color="success">{t('bets.outcome.win')}</Tag> : <Tag color="error">{t('bets.outcome.loss')}</Tag>;
      },
    },
    {
      title: t('users.tx.col.date'),
      dataIndex: 'created_at',
      width: 150,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{fmtIso(v)}</Text>
      ),
    },
  ], [t]);

  const fetch = useCallback((p: number) => {
    const id = ++reqId.current;
    const { start, end } = filterRef.current;
    setLoading(true);
    polymindApi
      .userTransactions({ luffa_id: luffaId, bet_start: start, bet_end: end, page: p, limit: TXN_PAGE })
      .then((res) => {
        if (id !== reqId.current) return;
        setRows(res.data || []); setTotal(res.total || 0); setPage(p);
      })
      .catch(() => {})
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [luffaId]);

  // fires on mount, on filter change (tick), and on page change (pgTick)
  useEffect(() => { fetch(pgTick.page); }, [pgTick, fetch]);
  useEffect(() => { setPgTick({ page: 1, tick }); }, [tick]);

  const handleDateChange = (_: unknown, strings: string[]) => {
    filterRef.current = {
      start: strings?.[0] || "",
      end:   strings?.[1] || "",
    };
    setTick(t => t + 1);
  };

  const handleExport = async () => {
    const { start, end } = filterRef.current;
    const qs = new URLSearchParams();
    qs.set('luffa_id', luffaId);
    if (start) qs.set('bet_start', start);
    if (end) qs.set('bet_end', end);
    qs.set('download', '1');
    try {
      await downloadCsv(`/api/v1/users/transactions?${qs.toString()}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
        <DatePicker.RangePicker
          size="small"
          placeholder={['Start date', 'End date']}
          onChange={handleDateChange}
          style={{ width: 240 }}
        />
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => setTick(t => t + 1)}
          loading={loading}
        />
        <Tooltip title={t('common.exportCsv')}>
          <Button size="small" icon={<ExportOutlined />} onClick={handleExport} />
        </Tooltip>
      </div>
      <Table<UserTxRow>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={rows}
        columns={txnCols}
        scroll={{ x: 600 }}
        pagination={{
          current: page, total, pageSize: TXN_PAGE, size: 'small',
          showTotal: (n) => `${n} entries`,
          onChange: (p) => setPgTick(pt => ({ page: p, tick: pt.tick })),
        }}
        locale={{ emptyText: t('users.tx.empty') }}
      />
    </>
  );
}

// ── profile tab ───────────────────────────────────────────────────────────────

function ProfileTab({ detail, stats, inviteRel }: {
  detail: UserDetail;
  stats: UserDetailStats | null;
  inviteRel: UserInviteRelations | null;
}) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const proExpired = detail.pro_expires_at ? detail.pro_expires_at * 1000 < Date.now() : false;
  const avatarUrl  = resolveAvatar(detail);

  return (
    <>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        {avatarUrl
          ? <Avatar src={avatarUrl} size={56} />
          : <Avatar size={56} style={{ fontSize: 22, background: '#1677ff' }}>
              {(detail.nickname || '?').slice(0, 1).toUpperCase()}
            </Avatar>}
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>
            {detail.nickname || <Text type="secondary">{t('users.profile.noNickname')}</Text>}
          </div>
          <Text type="secondary" copyable={{ text: detail.luffa_id }} style={{ fontSize: 12 }}>
            {detail.luffa_id}
          </Text>
          <div style={{ marginTop: 6 }}>
            {detail.is_pro
              ? <Tag color={proExpired ? 'orange' : 'gold'}>
                  {proExpired ? t('users.profile.proExpired') : t('users.profile.pro')}
                </Tag>
              : <Tag>{t('users.profile.free')}</Tag>}
          </div>
        </div>
      </div>

      {/* quick stats */}
      {stats && (
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          {([
            [t('users.profile.volume'), stats.total_wagered_eds.toFixed(2), '#1677ff'],
            [t('users.profile.events'), stats.event_count,                  '#722ed1'],
            [t('users.profile.bets'),   stats.bet_count,                    '#13c2c2'],
            [t('users.profile.invitees'), stats.invitee_count,              '#52c41a'],
          ] as [string, string | number, string][]).map(([label, value, color]) => (
            <Col key={label} span={6}>
              <Card
                size="small"
                styles={{ body: { padding: '10px 14px' } }}
                style={{ borderRadius: 8 }}
              >
                <Statistic
                  title={<span style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</span>}
                  value={value}
                  valueStyle={{ fontSize: 18, fontWeight: 700, color }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* identity */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Descriptions column={1} size="small" labelStyle={{ width: 120, color: '#8c8c8c' }}>
          <Descriptions.Item label={t('users.profile.address')}>
            {detail.address
              ? <Text copyable style={{ wordBreak: 'break-all', fontSize: 12 }}>{detail.address}</Text>
              : <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label={t('users.profile.registered')}>{fmtIso(detail.created_at)}</Descriptions.Item>
          {stats?.last_bet_at && (
            <Descriptions.Item label={t('users.profile.lastActive')}>{fmtIso(stats.last_bet_at)}</Descriptions.Item>
          )}
          {detail.cid && (
            <Descriptions.Item label={t('users.profile.cid')}>
              <Text code copyable style={{ fontSize: 11 }}>{detail.cid}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* pro details — only shown if pro */}
      {detail.is_pro ? (
        <Card size="small" style={{ marginBottom: 12 }}>
          <Descriptions column={1} size="small" labelStyle={{ width: 120, color: '#8c8c8c' }}>
            <Descriptions.Item label={t('users.profile.proExpires')}>{fmtUnix(detail.pro_expires_at)}</Descriptions.Item>
            {detail.pro_tx_hash && (
              <Descriptions.Item label={t('users.profile.proTx')}>
                <Text code copyable style={{ wordBreak: 'break-all', fontSize: 11 }}>
                  {detail.pro_tx_hash}
                </Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      ) : null}

      {/* invite details */}
      <Card
        size="small"
        title={
          <span>
            {t('users.profile.inviteTitle')}
            <Tag color="blue" style={{ marginLeft: 8 }}>
              {stats ? stats.invitee_count : (inviteRel ? inviteRel.total_invitees : 0)} {t('users.profile.referred')}
            </Tag>
          </span>
        }
        style={{ marginBottom: 12 }}
      >
        <Descriptions column={1} size="small" labelStyle={{ width: 120, color: '#8c8c8c' }}>
          <Descriptions.Item label={t('users.profile.myCode')}>
            {detail.invite_code
              ? <Text code copyable>{detail.invite_code}</Text>
              : <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label={t('users.profile.source')}>
            {detail.invite_source
              ? <Tag>{detail.invite_source}</Tag>
              : <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label={t('users.profile.invitedBy')}>
            {detail.inviter_id || inviteRel?.inviter
              ? <Text code copyable style={{ fontSize: 11 }}>
                  {inviteRel?.inviter?.nickname || detail.inviter_id}
                </Text>
              : <Text type="secondary">—</Text>}
          </Descriptions.Item>
          <Descriptions.Item label={t('users.profile.rewards')}>
            {stats ? (
              <span>
                <Tag color="orange" style={{ marginRight: 4 }}>
                  {t('users.profile.pending')} {parseFloat(stats.pending_rewards_eds.toFixed(4)).toString()} EDS
                </Tag>
                <Tag color="green">
                  {t('users.profile.paid')} {parseFloat(stats.paid_rewards_eds.toFixed(4)).toString()} EDS
                </Tag>
              </span>
            ) : <Text type="secondary">—</Text>}
          </Descriptions.Item>
        </Descriptions>

        {/* invitee list */}
        {inviteRel && inviteRel.invitees.length > 0 && (
          <Table
            rowKey="luffa_id"
            size="small"
            pagination={inviteRel.total_invitees > inviteRel.invitees.length
              ? { pageSize: inviteRel.invitees.length, total: inviteRel.total_invitees, size: 'small' }
              : false}
            dataSource={inviteRel.invitees}
            style={{ marginTop: 10 }}
            columns={[
              {
                title: t('users.profile.inviteeCol'),
                dataIndex: 'nickname',
                render: (v: string, row) => (
                  <span>
                    <Text style={{ fontWeight: 500 }}>{v || <Text type="secondary">—</Text>}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{row.luffa_id}</Text>
                  </span>
                ),
              },
              {
                title: t('users.profile.joinedCol'),
                dataIndex: 'created_at',
                width: 140,
                render: (v: string | null) =>
                  <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(v)}</Text>,
              },
            ]}
          />
        )}
      </Card>

      {/* linked addresses */}
      <Card size="small" title={`${t('users.profile.linkedAddresses')} (${detail.addresses?.length ?? 0})`}>
        {detail.addresses && detail.addresses.length > 0 ? (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={detail.addresses}
            columns={[
              {
                title: t('users.profile.addressCol'),
                dataIndex: 'address',
                render: (v: string) => (
                  <Text copyable style={{ wordBreak: 'break-all', fontSize: 12 }}>{v}</Text>
                ),
              },
              {
                title: t('users.profile.firstSeenCol'),
                dataIndex: 'created_at',
                width: 160,
                render: (v: string | null) =>
                  <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(v)}</Text>,
              },
            ]}
          />
        ) : (
          <Text type="secondary">{t('users.profile.noLinkedAddresses')}</Text>
        )}
      </Card>
    </>
  );
}

// ── drawer ────────────────────────────────────────────────────────────────────

export default function UserDrawer({ open, luffaId, onClose }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const [detail,    setDetail]    = useState<UserDetail | null>(null);
  const [stats,     setStats]     = useState<UserDetailStats | null>(null);
  const [inviteRel, setInviteRel] = useState<UserInviteRelations | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [err,       setErr]       = useState('');

  useEffect(() => {
    if (!open || !luffaId) return;
    setDetail(null);
    setStats(null);
    setInviteRel(null);
    setErr('');
    setLoading(true);

    Promise.allSettled([
      polymindApi.getUser(luffaId),
      polymindApi.userDetailStats(luffaId),
      polymindApi.userInviteRelations(luffaId),
    ]).then(([detailRes, statsRes, inviteRes]) => {
      if (detailRes.status === 'fulfilled') setDetail(detailRes.value);
      else setErr((detailRes.reason as Error).message ?? 'Failed to load user');
      if (statsRes.status   === 'fulfilled') setStats(statsRes.value);
      if (inviteRes.status  === 'fulfilled') setInviteRel(inviteRes.value);
    }).finally(() => setLoading(false));
  }, [open, luffaId]);

  const title = detail
    ? detail.nickname
      ? `${detail.nickname} · ${shortAddr(detail.luffa_id)}`
      : shortAddr(detail.luffa_id)
    : 'User Details';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={780}
      title={title}
      styles={{ body: { padding: '16px 20px' } }}
      destroyOnClose
    >
      <Spin spinning={loading && !detail}>
        {err && <Alert type="error" message={err} style={{ marginBottom: 16 }} />}
        {detail && (
          <Tabs
            defaultActiveKey="profile"
            size="small"
            items={[
              {
                key: 'profile',
                label: t('users.tab.profile'),
                children: <ProfileTab detail={detail} stats={stats} inviteRel={inviteRel} />,
              },
              {
                key: 'transactions',
                label: t('users.tab.transactions'),
                children: <TransactionsTab luffaId={luffaId!} />,
              },
            ]}
          />
        )}
      </Spin>
    </Drawer>
  );
}
