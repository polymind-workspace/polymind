import {
  Avatar, Card, Descriptions, Drawer, Row, Col, Space, Spin, Statistic, Table, Tag, Typography,
} from 'antd';
import { useIntl } from '@umijs/max';
import { useEffect, useMemo, useState } from 'react';
import type { ColumnsType } from 'antd/es/table';
import { polymindApi, type InviteRelationRow, type InviteRewardRow, type UserDetail } from '@/services/polymind';
import { resolveAvatar } from '@/utils/avatar';
import { formatDate } from '@/utils/format';

const { Text } = Typography;
const EDS = 1e8;
const fmtEds = (b: string | number) => (Number(b) / EDS).toFixed(4);
const shortAddr = (a: string) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

interface Props {
  open: boolean;
  row: InviteRelationRow | null;
  onClose: () => void;
}

export default function InviteeDrawer({ open, row, onClose }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [rewards, setRewards] = useState<InviteRewardRow[]>([]);
  const [rewardTotal, setRewardTotal] = useState(0);

  useEffect(() => {
    if (!open || !row) {
      setDetail(null);
      setRewards([]);
      setRewardTotal(0);
      return;
    }

    setLoading(true);
    Promise.allSettled([
      polymindApi.getUser(row.invitee_luffa_id),
      polymindApi.inviteRewards({ invitee_luffa_id: row.invitee_luffa_id, limit: 500 }),
    ]).then(([detailRes, rewardsRes]) => {
      if (detailRes.status === 'fulfilled') setDetail(detailRes.value);
      if (rewardsRes.status === 'fulfilled') {
        const data = rewardsRes.value.data || [];
        setRewards(data);
        setRewardTotal(rewardsRes.value.total || 0);
      }
    }).finally(() => setLoading(false));
  }, [open, row]);

  const stats = useMemo(() => {
    if (!row) return null;
    const pending = Number(row.pending_base || 0);
    const paid = Number(row.paid_base || 0);
    return {
      pendingEds: (pending / EDS).toFixed(4),
      paidEds: (paid / EDS).toFixed(4),
      rewardCount: row.reward_count,
      betCount: row.bet_count,
      totalWageredEds: row.total_wagered_eds.toFixed(4),
    };
  }, [row]);

  const rewardColumns: ColumnsType<InviteRewardRow> = useMemo(() => [
    {
      title: t('invite.detail.inviter'),
      dataIndex: 'inviter_luffa_id',
      ellipsis: true,
    },
    {
      title: t('invite.detail.bet'),
      dataIndex: 'bet_amount_base',
      width: 120,
      align: 'right' as const,
      render: (v: string) => `${fmtEds(v)} EDS`,
    },
    {
      title: t('invite.detail.reward'),
      dataIndex: 'reward_base',
      width: 120,
      align: 'right' as const,
      render: (v: string) => (
        <Tag color="green">{fmtEds(v)} EDS</Tag>
      ),
    },
    {
      title: t('invite.detail.market'),
      width: 140,
      render: (_, r) => `event #${r.onchain_event_id} · m${r.market_idx}`,
    },
    {
      title: t('invite.detail.status'),
      dataIndex: 'status',
      width: 100,
      render: (v: string) => (
        v === 'paid'
          ? <Tag color="green">{t('invitations.reward.paid')}</Tag>
          : <Tag color="orange">{t('invitations.reward.pending')}</Tag>
      ),
    },
    {
      title: t('invite.detail.when'),
      dataIndex: 'created_at',
      width: 170,
      render: (v: string) => formatDate(v),
    },
  ], [t]);

  const avatarUrl = detail ? resolveAvatar(detail) : null;
  const title = detail
    ? `${detail.nickname || row?.invitee_luffa_id || ''} · ${shortAddr(row?.invitee_luffa_id || '')}`
    : (row ? shortAddr(row.invitee_luffa_id) : 'Invitee Details');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      width={780}
      styles={{ body: { padding: '16px 20px' } }}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {row && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
              {avatarUrl ? (
                <Avatar src={avatarUrl} size={56} />
              ) : (
                <Avatar size={56} style={{ fontSize: 22, background: '#1677ff' }}>
                  {(detail?.nickname || row.invitee_nickname || row.invitee_luffa_id || '?').slice(0, 1).toUpperCase()}
                </Avatar>
              )}
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}>
                  {detail?.nickname || row.invitee_nickname || <Text type="secondary">—</Text>}
                </div>
                <Text type="secondary" copyable={{ text: row.invitee_luffa_id }} style={{ fontSize: 12 }}>
                  {row.invitee_luffa_id}
                </Text>
              </div>
            </div>

            {/* quick stats */}
            {stats && (
              <Row gutter={[12, 12]} style={{ marginBottom: 8 }}>
                {([
                  [t('invitations.col.rewardCount'), stats.rewardCount, '#722ed1'],
                  [t('invitations.reward.pending'), `${stats.pendingEds} EDS`, '#fa8c16'],
                  [t('invitations.reward.paid'), `${stats.paidEds} EDS`, '#52c41a'],
                  [t('invitations.col.betCount'), stats.betCount, '#13c2c2'],
                  [t('invitations.col.totalWagered'), `${stats.totalWageredEds} EDS`, '#1677ff'],
                ] as [string, string | number, string][]).map(([label, value, color]) => (
                  <Col key={label} span={6}>
                    <Card size="small" styles={{ body: { padding: '10px 14px' } }} style={{ borderRadius: 8 }}>
                      <Statistic
                        title={<span style={{ fontSize: 11, color: '#8c8c8c' }}>{label}</span>}
                        value={value}
                        valueStyle={{ fontSize: 16, fontWeight: 700, color }}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}

            {/* identity */}
            <Card size="small" title={t('invitations.col.invitee')}>
              <Descriptions column={1} size="small" labelStyle={{ width: 120, color: '#8c8c8c' }}>
                <Descriptions.Item label={t('invitations.col.inviter')}>
                  <Text code copyable={{ text: row.inviter_luffa_id }} style={{ fontSize: 11 }}>
                    {row.inviter_luffa_id}
                  </Text>
                  {row.inviter_nickname && (
                    <Text type="secondary" style={{ marginLeft: 8 }}>({row.inviter_nickname})</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t('users.profile.address')}>
                  {row.invitee_address ? (
                    <Text copyable style={{ wordBreak: 'break-all', fontSize: 12 }}>
                      {row.invitee_address}
                    </Text>
                  ) : (
                    <Text type="secondary">—</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t('invitations.col.boundAt')}>
                  {formatDate(row.bound_at, { unix: true })}
                </Descriptions.Item>
                <Descriptions.Item label={t('invitations.col.joined')}>
                  {formatDate(row.joined_at)}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* reward details */}
            <Card size="small" title={`${t('invite.detail.title')} (${rewardTotal})`}>
              <Table
                rowKey="id"
                size="small"
                loading={loading}
                dataSource={rewards}
                columns={rewardColumns}
                scroll={{ x: 'max-content' }}
                pagination={false}
                locale={{ emptyText: t('invite.detail.empty') }}
              />
            </Card>
          </Space>
        )}
      </Spin>
    </Drawer>
  );
}
