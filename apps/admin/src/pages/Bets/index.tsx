import {
  PageContainer, ProTable,
  type ActionType, type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, DatePicker, Space, Tag, Tooltip, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { useRef } from 'react';
import type { Dayjs } from 'dayjs';
import {
  downloadCsv,
  polymindApi,
  type BetRow,
} from '@/services/polymind';
import { formatDate } from '@/utils/format';

const { Text } = Typography;

const shortAddr = (a: string) =>
  a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;

/** 根据金额大小动态显示精度，大金额加千分位 */
const fmtEds = (v: number) => {
  if (v >= 1000) {
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
};

export default function BetsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const tableRef = useRef<ActionType | undefined>(undefined);
  const lastParamsRef = useRef<Record<string, unknown>>({});

  const handleExport = async () => {
    const p = lastParamsRef.current;
    const qs = new URLSearchParams();
    if (p.q) qs.set('q', p.q as string);
    if (p.luffa_id) qs.set('luffa_id', p.luffa_id as string);
    if (p.is_buy !== undefined) qs.set('is_buy', String(p.is_buy));
    if (p.bet_start) qs.set('bet_start', p.bet_start as string);
    if (p.bet_end) qs.set('bet_end', p.bet_end as string);
    qs.set('download', '1');
    try {
      await downloadCsv(`/api/v1/trades?${qs.toString()}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns: any[] = [
    {
      title: t('bets.col.event'),
      key: 'q',
      width: 260,
      ellipsis: true,
      search: { transform: (v: string) => ({ q: v }) },
      render: (_: unknown, row: BetRow) => (
        <Space direction="vertical" size={0} style={{ minWidth: 0, maxWidth: 240 }}>
          <Tooltip title={row.event_question || t('bets.unknown')}>
            <Text ellipsis style={{ fontSize: 13, width: '100%' }}>
              {row.event_question || <Text type="secondary">{t('bets.unknown')}</Text>}
            </Text>
          </Tooltip>
          {row.market_title && (
            <Tooltip title={row.market_title}>
              <Text ellipsis type="secondary" style={{ fontSize: 11, width: '100%' }}>
                {row.market_title}
              </Text>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: t('bets.col.user'),
      dataIndex: 'luffa_id',
      width: 140,
      ellipsis: true,
      search: { transform: (v: string) => ({ luffa_id: v }) },
      render: (v: string, row: BetRow) => (
        <Space direction="vertical" size={0}>
          <Text code style={{ fontSize: 11 }}>{shortAddr(v)}</Text>
          {row.user_address && (
            <Text type="secondary" style={{ fontSize: 11 }}>{shortAddr(row.user_address)}</Text>
          )}
        </Space>
      ),
    },
    {
      title: t('bets.col.side'),
      dataIndex: 'is_buy',
      width: 80,
      align: 'center',
      valueType: 'select',
      valueEnum: {
        1: { text: t('bets.side.yes') },
        0: { text: t('bets.side.no') },
      },
      search: { transform: (v: string) => ({ is_buy: Number(v) }) },
      render: (v: number) =>
        v === 1
          ? <Tag color="green" style={{ margin: 0 }}>{t('bets.side.yes')}</Tag>
          : <Tag color="red" style={{ margin: 0 }}>{t('bets.side.no')}</Tag>,
    },
    {
      title: t('bets.col.amount'),
      dataIndex: 'amount_eds',
      width: 120,
      align: 'right',
      search: false,
      sorter: true,
      render: (v: number) => <Text strong>{fmtEds(v)}</Text>,
    },
    {
      title: t('bets.col.outcome'),
      key: 'outcome',
      width: 90,
      align: 'center',
      search: false,
      render: (_: unknown, row: BetRow) => {
        if (!row.event_resolved) return <Tag>{t('bets.outcome.pending')}</Tag>;
        if (row.event_outcome === 3) return <Tag>{t('bets.outcome.void')}</Tag>;
        if (row.event_outcome === 0) return <Tag color="warning">{t('bets.outcome.unknown')}</Tag>;
        const won = (row.is_buy === 1 && row.event_outcome === 1)
          || (row.is_buy === 0 && row.event_outcome === 2);
        return won
          ? <Tag color="success">{t('bets.outcome.win')}</Tag>
          : <Tag color="error">{t('bets.outcome.loss')}</Tag>;
      },
    },
    {
      title: t('bets.col.date'),
      dataIndex: 'created_at',
      width: 160,
      search: false,
      sorter: true,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {formatDate(v)}
        </Text>
      ),
    },
    {
      title: t('bets.col.date'),
      dataIndex: 'dateRange',
      hideInTable: true,
      search: {
        transform: (value: unknown) => {
          if (!value || !Array.isArray(value)) return {};
          const arr = value as [Dayjs | string, Dayjs | string];
          const fmt = (v: Dayjs | string | undefined) => {
            if (v == null) return '';
            if (typeof v === 'string') return v;
            return v.format('YYYY-MM-DD');
          };
          return {
            bet_start: fmt(arr[0]),
            bet_end: fmt(arr[1]),
          };
        },
      },
      renderFormItem: () => (
        <DatePicker.RangePicker
          size="small"
          placeholder={[t('bets.dateStart'), t('bets.dateEnd')]}
          style={{ width: 220 }}
        />
      ),
    },
  ];

  return (
    <PageContainer title={t('bets.title')}>
      <ProTable<BetRow>
        actionRef={tableRef}
        columns={columns}
        rowKey="id"
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        scroll={{ x: 1000 }}
        toolbar={{
          actions: [
            <Tooltip title={t('common.exportCsv')} key="export">
              <Button type="text" icon={<ExportOutlined />} onClick={handleExport} />
            </Tooltip>,
          ],
        }}
        request={async (params, sort) => {
          lastParamsRef.current = params;
          const { current = 1, pageSize = 20, ...rest } = params;
          const sortField = Object.keys(sort || {})[0];
          const sortOrder = sortField ? (sort as Record<string, string>)[sortField] : undefined;

          const apiParams: Record<string, unknown> = {
            ...rest,
            sort_by: sortField,
            sort_order: sortOrder === 'ascend' ? 'asc' : sortOrder === 'descend' ? 'desc' : undefined,
            page: current,
            limit: pageSize,
          };
          // is_buy 从 select 出来是字符串，转成 number
          if (apiParams.is_buy !== undefined && apiParams.is_buy !== '') {
            apiParams.is_buy = Number(apiParams.is_buy);
          }

          const res = await polymindApi.listBets(apiParams as any);
          return {
            data: res.data || [],
            success: res.ret === 200,
            total: res.total || 0,
          };
        }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
      />
    </PageContainer>
  );
}
