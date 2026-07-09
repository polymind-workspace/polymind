import {
  PageContainer, ProTable,
  type ActionType, type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Select, Space, Tag, Tooltip } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useIntl, useSearchParams } from '@umijs/max';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadCsv, polymindApi, type MarketListRow } from '@/services/polymind';
import { formatDate } from '@/utils/format';
import MarketDrawer from '@/components/MarketDrawer';
import BetsDrawer from '@/components/BetsDrawer';

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

const EDS = 1e8;
const fmtEds = (b: string | number) => (Number(b) / EDS).toFixed(2);

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

const STAGE_ORDER: MarketListRow['stage'][] = [
  'disputed', 'in_review', 'awaiting', 'betting', 'settled',
];

export default function MarketsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, any>) => intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const coarseLabel = (s: MarketListRow['stage']) => t(`markets.coarse.${s}`);
  const fineLabel = (s: string) => t(`market.stage.${s}`);

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const tableRef = useRef<ActionType | null>(null);
  const searchParamsRef = useRef<Record<string, unknown>>({});
  const [searchParams] = useSearchParams();
  const initialStages = useMemo(() => {
    const raw = searchParams.get('stage');
    if (!raw) return undefined;
    return raw.split(',').filter(Boolean);
  }, [searchParams]);
  const [filterSource, setFilterSource] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<{
    slug: string;
  } | null>(null);
  const [betsOpen, setBetsOpen] = useState(false);
  const [betsSel, setBetsSel] = useState<{
    slug: string;
  } | null>(null);

  useEffect(() => {
    tableRef.current?.reload();
  }, [filterSource]);

  const handleExport = async () => {
    const params = searchParamsRef.current;
    const qs = new URLSearchParams();
    const raw = params.stage as unknown;
    if (Array.isArray(raw)) qs.set('stage', raw.join(','));
    else if (typeof raw === 'string' && raw) qs.set('stage', raw);
    if (filterSource) qs.set('source', filterSource);
    if (params.q) qs.set('q', params.q as string);
    qs.set('download', '1');
    try {
      await downloadCsv(`/api/v1/markets?${qs.toString()}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const openRow = (row: MarketListRow) => {
    setSelected({ slug: row.slug });
    setOpen(true);
  };

  const openBets = (row: MarketListRow) => {
    setBetsSel({ slug: row.slug });
    setBetsOpen(true);
  };

  const columns = useMemo<ProColumns<MarketListRow>[]>(() => [
    {
      title: t('markets.col.stage'),
      dataIndex: 'stage',
      width: 130,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        STAGE_ORDER.map((s) => [s, { text: coarseLabel(s) }]),
      ),
      fieldProps: {
        mode: 'multiple',
        placeholder: t('markets.filter.placeholder'),
      },
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
        <Space direction="vertical" size={2}>
          <a onClick={() => openRow(row)}>{row.question || t('markets.untitled')}</a>
          {row.title && row.title !== row.question && (
            <span style={{ fontSize: 12, color: '#888' }}>{row.title}</span>
          )}
        </Space>
      ),
    },
    {
      title: t('source.createdBy'),
      dataIndex: 'source',
      width: 120,
      search: false,
      render: (_, row) => <SourceTag source={row.source} />,
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
      width: 160,
      fixed: 'right',
      search: false,
      render: (_, row) => (
        <Space size={0}>
          <Button size="small" type="link" onClick={() => openRow(row)}>
            {t('markets.actions.open')}
          </Button>
          <Button size="small" type="link" onClick={() => openBets(row)}>
            {t('markets.actions.bets')}
          </Button>
        </Space>
      ),
    },
  ], [intl.locale, now]);

  return (
    <PageContainer>
      <ProTable<MarketListRow>
        actionRef={tableRef}
        rowKey={(r) => `${r.onchain_event_id}-${r.market_idx}`}
        columns={columns}
        pagination={{ pageSize: 50 }}
        form={initialStages ? { initialValues: { stage: initialStages } } : undefined}
        scroll={{ x: 'max-content' }}
        toolBarRender={() => [
          <Select
            key="source-filter"
            allowClear
            placeholder={t('source.createdBy')}
            value={filterSource}
            onChange={(v) => setFilterSource(v as string | undefined)}
            style={{ minWidth: 140 }}
            options={[
              { label: t('source.official'),   value: 'official,admin' },
              { label: t('source.polymarket'),  value: 'polymarket' },
              { label: t('source.user'),        value: 'user' },
            ]}
          />,
          <Tooltip title={t('common.exportCsv')} key="export">
            <Button type="text" icon={<ExportOutlined />} onClick={handleExport} />
          </Tooltip>,
        ]}
        request={async (params) => {
          searchParamsRef.current = params;
          let stageParam: string | undefined;
          const raw = params.stage as unknown;
          if (Array.isArray(raw)) stageParam = raw.join(',');
          else if (typeof raw === 'string' && raw) stageParam = raw;
          const res = await polymindApi.listMarkets({
            stage: stageParam,
            q: params.q as string | undefined,
            source: filterSource || undefined,
            page: params.current,
            limit: params.pageSize,
          });
          return {
            data: res.data || [],
            total: res.total ?? 0,
            success: res.ret === 200,
          };
        }}
      />

      <MarketDrawer
        open={open}
        marketSlug={selected?.slug ?? null}
        onClose={() => setOpen(false)}
        onTxDone={() => tableRef.current?.reload()}
      />

      <BetsDrawer
        open={betsOpen}
        marketSlug={betsSel?.slug ?? null}
        onClose={() => setBetsOpen(false)}
      />
    </PageContainer>
  );
}
