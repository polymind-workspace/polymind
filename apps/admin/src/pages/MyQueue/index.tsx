import {
  PageContainer, ProTable,
  type ActionType, type ProColumns,
} from '@ant-design/pro-components';
import { Alert, Button, Empty, Space, Tag, Tooltip } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadCsv, polymindApi, type MarketListRow } from '@/services/polymind';
import { formatDate } from '@/utils/format';
import MarketDrawer from '@/components/MarketDrawer';

const EDS = 1e8;
const fmtEds = (b: string | number) => (Number(b) / EDS).toFixed(2);

const ADMIN_SOURCES = 'official,polymarket';

const STAGE_COLOR: Record<string, string> = {
  betting:             'green',
  awaiting_proposal:   'orange',
  expired_takeover:    'orange',
  expired_voidable:    'orange',
  in_review:           'blue',
  ready_finalize:      'cyan',
  dispute_pending:     'red',
  emergency_voidable:  'red',
  settled:             'default',
  awaiting:            'orange',
  disputed:            'red',
};

export default function MyQueuePage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const coarseLabel = (s: MarketListRow['stage']) => t(`markets.coarse.${s}`);
  const fineLabel = (s: string) => t(`market.stage.${s}`);

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const tableRef = useRef<ActionType | null>(null);
  const searchParamsRef = useRef<Record<string, unknown>>({});
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{
    slug: string;
  } | null>(null);

  const openRow = (row: MarketListRow) => {
    setSelected({ slug: row.slug });
    setOpen(true);
  };

  const handleExport = async () => {
    const params = searchParamsRef.current;
    const qs = new URLSearchParams();
    qs.set('source', ADMIN_SOURCES);
    if (params.q) qs.set('q', params.q as string);
    qs.set('download', '1');
    await downloadCsv(`/api/v1/markets?${qs.toString()}`);
  };

  const columns = useMemo<ProColumns<MarketListRow>[]>(() => [
    {
      title: t('markets.col.stage'),
      dataIndex: 'stage',
      width: 130,
      search: false,
      render: (_, row) => {
        const remain = row.deadline ? row.deadline - now : 0;
        const countdown = remain > 0 && remain <= 600 && row.stage_fine === 'betting';
        return (
          <Space size={4} direction="vertical">
            <Tag color={STAGE_COLOR[row.stage_fine] ?? STAGE_COLOR[row.stage] ?? 'default'}>
              {fineLabel(row.stage_fine)}
            </Tag>
            {countdown && (
              <span style={{ fontSize: 11, color: '#fa8c16' }}>
                {t('market.field.proposeIn', { time: `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, '0')}` })}
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: t('markets.col.questionMarket'),
      dataIndex: 'question',
      ellipsis: true,
      search: { transform: (v) => ({ q: v }) },
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <a onClick={() => openRow(row)}>{row.question || t('markets.untitled')}</a>
          {row.title && row.title !== row.question && (
            <span style={{ fontSize: 12, color: '#888' }}>{row.title}</span>
          )}
        </Space>
      ),
    },
    {
      title: t('markets.col.pools'),
      dataIndex: 'yes_pool',
      width: 160,
      search: false,
      render: (_, row) => (
        <Space size={4}>
          <Tag color="green">YES {fmtEds(row.yes_pool)}</Tag>
          <Tag color="red">NO {fmtEds(row.no_pool)}</Tag>
        </Space>
      ),
    },
    {
      title: t('markets.col.deadline'),
      dataIndex: 'deadline',
      width: 170,
      search: false,
      render: (_, row) => formatDate(row.deadline, { unix: true }),
    },
    {
      title: t('markets.col.actions'),
      width: 110,
      search: false,
      render: (_, row) => (
        <Button size="small" type="link" onClick={() => openRow(row)}>
          {t('markets.actions.open')}
        </Button>
      ),
    },
  ], [intl.locale, now]);

  return (
    <PageContainer
      content={
        <Alert
          type="info"
          showIcon
          message={t('myQueue.subtitle')}
        />
      }
    >
      <ProTable<MarketListRow>
        actionRef={tableRef}
        rowKey={(r) => `${r.onchain_event_id}-${r.market_idx}`}
        columns={columns}
        pagination={{ pageSize: 50 }}
        toolBarRender={() => [
          <Tooltip title={t('common.exportCsv')} key="export">
            <Button type="text" icon={<ExportOutlined />} onClick={handleExport} />
          </Tooltip>,
        ]}
        request={async (params) => {
          searchParamsRef.current = params;
          const res = await polymindApi.listMarkets({
            source: ADMIN_SOURCES,
            q: params.q as string | undefined,
            page: params.current,
            limit: params.pageSize,
          });
          return {
            data: res.data || [],
            total: res.total ?? 0,
            success: res.ret === 200,
          };
        }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description={t('myQueue.empty')} /> }}
      />

      <MarketDrawer
        open={open}
        marketSlug={selected?.slug ?? null}
        onClose={() => setOpen(false)}
        onTxDone={() => tableRef.current?.reload()}
        hideAdminOverride
      />
    </PageContainer>
  );
}
