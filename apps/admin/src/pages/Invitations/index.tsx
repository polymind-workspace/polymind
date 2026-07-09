import {
  PageContainer, ProTable,
  type ActionType, type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Space, Tag, Tooltip, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { useRef, useState } from 'react';
import {
  downloadCsv,
  polymindApi,
  type InviteRelationRow,
} from '@/services/polymind';
import { formatDate } from '@/utils/format';
import InviteeDrawer from '@/components/InviteeDrawer';

const { Text } = Typography;

const shortAddr = (a: string) =>
  a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;

const fmtEds = (b: number) => (Number(b) / 1).toFixed(4);

export default function InvitationsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const tableRef = useRef<ActionType | undefined>(undefined);
  const searchParamsRef = useRef<Record<string, unknown>>({});
  const [drawerRow, setDrawerRow] = useState<InviteRelationRow | null>(null);
  const [showHasBetFilter, setShowHasBetFilter] = useState(false);

  const handleExport = async () => {
    const params = searchParamsRef.current;
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q as string);
    if (params.query_role) qs.set('query_role', params.query_role as string);
    if (params.has_bet !== undefined && params.has_bet !== '') {
      qs.set('has_bet', String(params.has_bet));
    }
    qs.set('download', '1');
    try {
      await downloadCsv(`/api/v1/users/invitations?${qs.toString()}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns: ProColumns<InviteRelationRow>[] = [
    {
      title: t('invitations.col.invitee'),
      tooltip: t('invitations.tooltip.invitee'),
      dataIndex: 'invitee_luffa_id',
      key: 'invitee_q',
      width: 220,
      ellipsis: true,
      search: { transform: (v) => ({ q: v, query_role: 'invitee' }) },
      render: (_, row) => (
        <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
          <Text style={{ fontWeight: 500 }}>{row.invitee_nickname || <Text type="secondary">—</Text>}</Text>
          <Text code style={{ fontSize: 11 }} copyable={{ text: row.invitee_luffa_id }}>
            {shortAddr(row.invitee_luffa_id)}
          </Text>
        </Space>
      ),
    },
    {
      title: t('invitations.col.inviter'),
      dataIndex: 'inviter_luffa_id',
      key: 'inviter_q',
      width: 220,
      ellipsis: true,
      search: { transform: (v) => ({ q: v, query_role: 'inviter' }) },
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontWeight: 500 }}>{row.inviter_nickname || <Text type="secondary">—</Text>}</Text>
          <Text code style={{ fontSize: 11 }} copyable={{ text: row.inviter_luffa_id }}>
            {shortAddr(row.inviter_luffa_id)}
          </Text>
        </Space>
      ),
    },
    {
      title: t('invitations.col.rewards'),
      key: 'rewards',
      width: 180,
      align: 'right' as const,
      search: false,
      render: (_, row) => (
        <Space direction="vertical" size={0} style={{ textAlign: 'right' }}>
          <Tag color="orange" style={{ margin: 0 }}>
            {t('invitations.reward.pending')} {fmtEds(Number(row.pending_base) / 1e8)} EDS
          </Tag>
          <Tag color="green" style={{ margin: 0 }}>
            {t('invitations.reward.paid')} {fmtEds(Number(row.paid_base) / 1e8)} EDS
          </Tag>
        </Space>
      ),
    },
    {
      title: t('invitations.col.rewardCount'),
      dataIndex: 'reward_count',
      width: 100,
      align: 'right' as const,
      search: false,
    },
    {
      title: t('invitations.col.hasBet'),
      tooltip: t('invitations.tooltip.hasBet'),
      dataIndex: 'bet_count',
      width: 150,
      valueType: 'select',
      valueEnum: {
        '1': { text: t('invitations.filter.hasBet'), status: 'Success' },
        '0': { text: t('invitations.filter.noBet'), status: 'Default' },
      },
      search: { transform: (v: string) => ({ has_bet: Number(v) }) },
      // @ts-ignore renderFormItem is supported by ProTable at runtime
      renderFormItem: (_: unknown, config: { defaultRender?: (schema: unknown) => JSX.Element | null }, _form: unknown) => {
        if (!showHasBetFilter) {
          return null;
        }
        return config.defaultRender?.(_);
      },
      render: (_: unknown, row: InviteRelationRow) => (
        row.bet_count > 0
          ? <Tag color="green">{t('invitations.hasBet.yes')}</Tag>
          : <Tag>{t('invitations.hasBet.no')}</Tag>
      ),
    },
    {
      title: t('invitations.col.betCount'),
      tooltip: t('invitations.tooltip.betCount'),
      dataIndex: 'bet_count',
      width: 180,
      align: 'right' as const,
      search: false,
      sorter: true,
      render: (_, row) => (row.bet_count > 0 ? row.bet_count : <Text type="secondary">—</Text>),
    },
    {
      title: t('invitations.col.totalWagered'),
      tooltip: t('invitations.tooltip.totalWagered'),
      dataIndex: 'total_wagered_eds',
      width: 190,
      align: 'right' as const,
      search: false,
      sorter: true,
      render: (_, row) => (row.total_wagered_eds > 0 ? `${fmtEds(row.total_wagered_eds)} EDS` : <Text type="secondary">—</Text>),
    },
    {
      title: t('invitations.col.lastBetAt'),
      dataIndex: 'last_bet_at',
      width: 160,
      search: false,
      sorter: true,
      render: (_, row) => (
        row.last_bet_at ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatDate(row.last_bet_at)}
          </Text>
        ) : <Text type="secondary">—</Text>
      ),
    },
    {
      title: t('invitations.col.boundAt'),
      dataIndex: 'bound_at',
      width: 160,
      search: false,
      sorter: true,
      render: (_, row) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(row.bound_at, { unix: true })}
        </Text>
      ),
    },
    {
      title: t('invitations.col.joined'),
      dataIndex: 'joined_at',
      width: 160,
      search: false,
      sorter: true,
      render: (_, row) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(row.joined_at)}
        </Text>
      ),
    },
  ];

  return (
    <PageContainer title={t('invitations.title')}>
      <ProTable<InviteRelationRow>
        actionRef={tableRef}
        columns={columns}
        rowKey="invitee_luffa_id"
        search={{ labelWidth: 'auto' }}
        form={{
          onValuesChange: (changedValues: Record<string, unknown>) => {
            if ('invitee_luffa_id' in changedValues) {
              const value = changedValues.invitee_luffa_id;
              setShowHasBetFilter(Boolean(value && String(value).trim().length > 0));
            }
          },
        }}
        scroll={{ x: 1200 }}
        toolbar={{
          actions: [
            <Tooltip title={t('common.exportCsv')} key="export">
              <Button type="text" icon={<ExportOutlined />} onClick={handleExport} />
            </Tooltip>,
          ],
        }}
        request={async (params, sort) => {
          searchParamsRef.current = params;
          const { current = 1, pageSize = 20, q, query_role, has_bet } = params;
          const payload: Record<string, unknown> = {
            page: current,
            limit: pageSize,
          };
          if (q) payload.q = q;
          if (query_role) payload.query_role = query_role;
          if (has_bet !== undefined && has_bet !== '') payload.has_bet = Number(has_bet);

          // ProTable sorter
          const sortField = Object.keys(sort || {})[0];
          if (sortField && sort?.[sortField]) {
            payload.sort_by = sortField;
            payload.sort_dir = sort[sortField] === 'ascend' ? 'asc' : 'desc';
          }

          const res = await polymindApi.allInvitations(payload);
          return {
            data: res.data || [],
            success: res.ret === 200,
            total: res.total || 0,
          };
        }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        onRow={(row) => ({
          onClick: () => setDrawerRow(row),
          style: { cursor: 'pointer' },
        })}
      />
      <InviteeDrawer
        open={!!drawerRow}
        row={drawerRow}
        onClose={() => setDrawerRow(null)}
      />
    </PageContainer>
  );
}
