import {
  PageContainer, ProTable,
  type ActionType, type ProColumns,
} from '@ant-design/pro-components';
import { App, Avatar, Button, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useIntl, useSearchParams } from '@umijs/max';
import { useEffect, useRef, useState } from 'react';
import {
  downloadCsv,
  polymindApi,
  type TradingStatsRow,
  type UserRow,
} from '@/services/polymind';
import UserDrawer from '@/components/UserDrawer';
import GoToPayoutButton from '@/components/GoToPayoutButton';
import { resolveAvatar } from '@/utils/avatar';
import { formatDate } from '@/utils/format';

const { Text } = Typography;

const shortAddr = (a: string) =>
  a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;

function UserCell({ row, onClick }: {
  row: { luffa_id: string; nickname: string; avatar?: string };
  onClick?: () => void;
}) {
  const url = resolveAvatar(row as UserRow);
  return (
    <Space>
      {url
        ? <Avatar src={url} size={28} />
        : <Avatar size={28}>{(row.nickname || '?').slice(0, 1)}</Avatar>}
      <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
        <a onClick={onClick} style={{ fontWeight: 500 }}>
          {row.nickname || <Text type="secondary">—</Text>}
        </a>
        <Text
          type="secondary"
          style={{ fontSize: 11 }}
          copyable={{ text: row.luffa_id }}
        >
          {row.luffa_id.length > 20 ? `${row.luffa_id.slice(0, 18)}…` : row.luffa_id}
        </Text>
      </Space>
    </Space>
  );
}

/** Format a dayjs/moment/Date/string to YYYY-MM-DD */
function fmtDate(d: unknown): string {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d && typeof (d as any).format === 'function') return (d as any).format('YYYY-MM-DD');
  return String(d).slice(0, 10);
}

export default function UsersPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const [openLuffaId,    setOpenLuffaId]    = useState<string | null>(null);
  const [rewardFilter, setRewardFilter] = useState('');
  const [tableLoading, setTableLoading] = useState(false);
  const [columnStateMap, setColumnStateMap] = useState<Record<string, { show: boolean }>>({});
  const [tableData, setTableData] = useState<TradingStatsRow[]>([]);
  const tableRef = useRef<ActionType>(null);
  const searchParamsRef = useRef<Record<string, unknown>>({});

  useEffect(() => { setOpenLuffaId(searchParams.get('user')); }, [searchParams]);
  useEffect(() => {
    setTableLoading(true);
    tableRef.current?.reloadAndRest?.()?.finally(() => setTableLoading(false));
  }, [rewardFilter]);

  // 切换 select 时自动调整表格列显示
  useEffect(() => {
    if (rewardFilter === 'first_bet') {
      // 首单模式：只保留身份、首单、注册相关列
      setColumnStateMap({
        event_count: { show: false },
        bet_count: { show: false },
        last_bet_at: { show: false },
        total_wagered_eds: { show: false },
        inviter_id: { show: false },
      });
    } else if (rewardFilter === 'invite_3plus') {
      // 邀请模式：只保留身份、邀请人数、注册相关列
      setColumnStateMap({
        event_count: { show: false },
        bet_count: { show: false },
        last_bet_at: { show: false },
        total_wagered_eds: { show: false },
        first_bet_at: { show: false },
        first_bet_amount_eds: { show: false },
        inviter_id: { show: false },
      });
    } else {
      // 清空：显示所有列
      setColumnStateMap({});
    }
  }, [rewardFilter]);

  const openRow = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('user', id);
    setSearchParams(next, { replace: false });
  };

  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('user');
    setSearchParams(next, { replace: false });
  };

  const handleExport = async () => {
    const params = searchParamsRef.current;
    const qs = new URLSearchParams();

    if (params.q) qs.set('q', params.q as string);

    const is_pro = params.is_pro;
    if (is_pro !== undefined && is_pro !== '' && is_pro !== null) {
      qs.set('is_pro', String(is_pro));
    }

    const dateFilterType = (params.dateFilterType as string) || 'order';
    const dateRange = params.dateRange as unknown[] | undefined;
    if (dateRange && Array.isArray(dateRange) && dateRange[0]) {
      const start = fmtDate(dateRange[0]);
      const end = fmtDate(dateRange[1]);
      if (dateFilterType === 'order') {
        qs.set('bet_start', start);
        qs.set('bet_end', end);
      } else {
        qs.set('reg_start', start);
        qs.set('reg_end', end);
      }
    }

    if (rewardFilter) {
      qs.set('query_type', rewardFilter);
      if (rewardFilter === 'first_bet') {
        qs.set('min_bet', '0.1');
      }
      if (rewardFilter === 'invite_3plus') {
        qs.set('random_sample', '100');
      }
    }

    qs.set('download', '1');
    try {
      await downloadCsv(`/api/v1/users/trading-stats?${qs.toString()}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns: ProColumns<TradingStatsRow>[] = [
    // 1 — identity, sticky
    {
      title: t('users.col.user'),
      key: 'q',
      width: 220,
      ellipsis: true,
      fieldProps: { placeholder: t('users.searchPlaceholder') },
      search: { transform: (v) => ({ q: v }) },
      render: (_, row) => <UserCell row={row} onClick={() => openRow(row.luffa_id)} />,
    },
    {
      title: t('users.col.address'),
      dataIndex: 'address',
      width: 160,
      search: false,
      render: (_, row) =>
        row.address
          ? <Text code copyable={{ text: row.address }} style={{ fontSize: 12 }} title={row.address}>{shortAddr(row.address)}</Text>
          : <Text type="secondary">—</Text>,
    },
    // 2 — pro badge (search form only)
    {
      title: 'Pro 状态',
      dataIndex: 'is_pro',
      valueType: 'select',
      hideInTable: true,
      initialValue: '',
      fieldProps: {
        options: [
          { label: '全部', value: '' },
          { label: 'Pro', value: '1' },
          { label: 'Free', value: '0' },
        ],
        allowClear: false,
      },
    },
    // 3 — date filter type (search form only)
    {
      title: '日期类型',
      dataIndex: 'dateFilterType',
      valueType: 'select',
      hideInTable: true,
      initialValue: 'order',
      fieldProps: {
        options: [
          { label: '下单时间', value: 'order' },
          { label: '注册时间', value: 'reg' },
        ],
        allowClear: false,
      },
    },
    // 4 — date range (search form only)
    {
      title: '日期范围',
      dataIndex: 'dateRange',
      valueType: 'dateRange',
      hideInTable: true,
      fieldProps: {
        placeholder: ['开始日期', '结束日期'],
      },
    },
    // 5 — pro badge in table
    {
      title: t('users.col.isPro'),
      dataIndex: 'is_pro',
      width: 90,
      search: false,
      render: (_, row) => {
        if (!row.is_pro) return <Text type="secondary">Free</Text>;
        const expired = row.pro_expires_at != null && row.pro_expires_at * 1000 < Date.now();
        return <Tag color={expired ? 'orange' : 'gold'}>{expired ? t('users.pro.expired') : t('users.pro.on')}</Tag>;
      },
    },
    // 6 — events entered
    {
      title: t('users.col.events'),
      dataIndex: 'event_count',
      width: 80,
      align: 'right',
      search: false,
      render: (v: unknown) =>
        (v as number) > 0
          ? <Tag color="purple" style={{ margin: 0 }}>{v as number}</Tag>
          : <Text type="secondary">0</Text>,
    },
    {
      title: t('users.col.orders'),
      dataIndex: 'bet_count',
      width: 80,
      align: 'right',
      search: false,
      render: (v: unknown) =>
        (v as number) > 0 ? String(v) : <Text type="secondary">0</Text>,
    },
    {
      title: t('users.col.lastOrder'),
      dataIndex: 'last_bet_at',
      width: 160,
      search: false,
      render: (v: unknown) => <Text>{formatDate(v as string)}</Text>,
    },
    {
      title: t('users.col.volume'),
      dataIndex: 'total_wagered_eds',
      width: 130,
      align: 'right',
      search: false,
      render: (v: unknown) => {
        const n = v as number;
        return n > 0
          ? <Text strong style={{ color: '#1677ff' }}>{n.toFixed(2)}</Text>
          : <Text type="secondary">—</Text>;
      },
    },
    {
      title: '首单时间',
      dataIndex: 'first_bet_at',
      width: 160,
      search: false,
      render: (v: unknown) => v ? <Text>{formatDate(v as string)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: '首单金额(EDS)',
      dataIndex: 'first_bet_amount_eds',
      width: 130,
      align: 'right',
      search: false,
      render: (v: unknown) => {
        const n = v as number;
        return n > 0 ? <Text strong style={{ color: '#52c41a' }}>{n.toFixed(2)}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: '邀请人数',
      dataIndex: 'invitee_count',
      width: 100,
      align: 'right',
      search: false,
      render: (v: unknown) => {
        const n = v as number;
        return n > 0 ? <Tag color="blue" style={{ margin: 0 }}>{n}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    // who referred them
    {
      title: t('users.col.inviter'),
      dataIndex: 'inviter_id',
      width: 150,
      ellipsis: true,
      search: false,
      render: (_, row) =>
        row.inviter_id
          ? <Text code style={{ fontSize: 11 }}>{shortAddr(row.inviter_id)}</Text>
          : <Text type="secondary">—</Text>,
    },
    {
      title: t('users.col.createdAt'),
      dataIndex: 'created_at',
      width: 160,
      search: false,
      render: (v: unknown) => <Text>{formatDate(v as string)}</Text>,
    },
  ];

  return (
    <PageContainer>
      <ProTable<TradingStatsRow>
        actionRef={tableRef}
        rowKey="luffa_id"
        columns={columns}
        scroll={{ x: 1360 }}
        params={{ rewardFilter }}
        loading={tableLoading}
        columnsState={{
          value: columnStateMap,
        }}
        toolBarRender={() => [
          <Select
            key="rewardFilter"
            style={{ width: 180 }}
            placeholder="奖励活动"
            allowClear
            value={rewardFilter || undefined}
            onChange={(v) => setRewardFilter(v || '')}
            options={[
              { label: '前500首单用户', value: 'first_bet' },
              { label: '邀请大于3人', value: 'invite_3plus' },
            ]}
          />,
          <GoToPayoutButton
            key="goToPayout"
            getQueryParams={() => {
              const params = searchParamsRef.current;
              const dateRange = params.dateRange as unknown[] | undefined;
              const dateFilterType = (params.dateFilterType as string) || 'order';
              return {
                query_type: rewardFilter || undefined,
                reg_start:
                  dateRange && dateRange[0] && dateFilterType === 'reg'
                    ? fmtDate(dateRange[0])
                    : undefined,
                reg_end:
                  dateRange && dateRange[1] && dateFilterType === 'reg'
                    ? fmtDate(dateRange[1])
                    : undefined,
                bet_start:
                  dateRange && dateRange[0] && dateFilterType === 'order'
                    ? fmtDate(dateRange[0])
                    : undefined,
                bet_end:
                  dateRange && dateRange[1] && dateFilterType === 'order'
                    ? fmtDate(dateRange[1])
                    : undefined,
                min_bet: rewardFilter === 'first_bet' ? '0.1' : undefined,
                random_sample: rewardFilter === 'invite_3plus' ? 100 : undefined,
                q: params.q as string | undefined,
                is_pro:
                  params.is_pro != null
                    ? parseInt(String(params.is_pro))
                    : undefined,
              };
            }}
          />,
          <Tooltip title={t('common.exportCsv')} key="export">
            <Button type="text" icon={<ExportOutlined />} onClick={handleExport} />
          </Tooltip>,
        ]}
        search={{
          labelWidth: 'auto',
          optionRender: (_, formProps) => [
            <Button
              key="reset"
              onClick={() => {
                setRewardFilter('');
                formProps.form?.resetFields();
                tableRef.current?.reloadAndRest?.();
              }}
            >
              重置
            </Button>,
            <Button key="search" type="primary" onClick={() => formProps.form?.submit?.()}>
              查询
            </Button>,
          ],
        }}
        request={async (params) => {
          setTableLoading(true);
          try {
            searchParamsRef.current = params;
            const is_pro_raw = params.is_pro;
            const is_pro = (is_pro_raw === '' || is_pro_raw == null) ? undefined : parseInt(String(is_pro_raw));
            const dateFilterType = (params.dateFilterType as string) || 'order';

            let rangeStart: string | undefined;
            let rangeEnd: string | undefined;
            const dateRange = params.dateRange as unknown[] | undefined;
            if (dateRange && Array.isArray(dateRange) && dateRange[0]) {
              rangeStart = fmtDate(dateRange[0]);
              rangeEnd = fmtDate(dateRange[1]);
            }

            const res = await polymindApi.tradingStats({
              q:         (params.q as string | undefined)?.trim() || undefined,
              is_pro,
              bet_start: dateFilterType === 'order' ? rangeStart : undefined,
              bet_end:   dateFilterType === 'order' ? rangeEnd   : undefined,
              reg_start: dateFilterType === 'reg'   ? rangeStart : undefined,
              reg_end:   dateFilterType === 'reg'   ? rangeEnd   : undefined,
              query_type: rewardFilter || undefined,
              min_bet:   rewardFilter === 'first_bet' ? '0.1' : undefined,
              random_sample: rewardFilter === 'invite_3plus' ? 100 : undefined,
              page:      params.current,
              limit:     params.pageSize,
            });
            const data = res.data || [];
            setTableData(data);
            return { data, total: res.total ?? 0, success: res.ret === 200 };
          } finally {
            setTableLoading(false);
          }
        }}
        pagination={{ pageSize: 20 }}
        onRow={(row) => ({
          onClick: () => openRow(row.luffa_id),
          style: { cursor: 'pointer' },
        })}
      />

      <UserDrawer open={openLuffaId != null} luffaId={openLuffaId} onClose={closeDrawer} />
    </PageContainer>
  );
}
