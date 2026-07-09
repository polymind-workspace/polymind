import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Select, Tag, Tooltip } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useIntl, useSearchParams } from '@umijs/max';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadCsv, polymindApi, type DisputeRow } from '@/services/polymind';
import DisputeDrawer from '@/components/DisputeDrawer';

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

export default function DisputeListPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const outcomeLabel = (n: number) => t(`market.outcome.${n}`);

  const [searchParams, setSearchParams] = useSearchParams();
  const [openId, setOpenId] = useState<number | null>(null);
  const [filterSource, setFilterSource] = useState<string | undefined>(undefined);
  const tableRef = useRef<ActionType | undefined>(undefined);
  const searchParamsRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    const v = searchParams.get('dispute');
    setOpenId(v ? Number(v) : null);
  }, [searchParams]);

  const openRow = (id: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('dispute', String(id));
    setSearchParams(next, { replace: false });
  };

  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('dispute');
    setSearchParams(next, { replace: false });
  };

  const handleExport = async () => {
    const params = searchParamsRef.current;
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status as string);
    if (filterSource) qs.set('source', filterSource);
    qs.set('download', '1');
    try {
      await downloadCsv(`/api/v1/disputes?${qs.toString()}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  useEffect(() => {
    tableRef.current?.reload();
  }, [filterSource]);

  const columns = useMemo<ProColumns<DisputeRow>[]>(() => [
    {
      title: t('disputes.col.id'),
      dataIndex: 'id',
      width: 70,
      render: (_, row) => <a>#{row.id}</a>,
      search: false,
    },
    {
      title: t('disputes.col.event'),
      dataIndex: 'event_question',
      ellipsis: true,
      search: false,
      render: (_, row) => (
        <span title={row.event_question}>
          {row.event_question || (
            <span style={{ color: '#999' }}>
              {t('disputes.placeholder.event', { id: row.onchain_event_id })}
            </span>
          )}
        </span>
      ),
    },
    {
      title: t('source.createdBy'),
      dataIndex: 'event_source',
      width: 120,
      search: false,
      render: (_, row) => <SourceTag source={row.event_source} />,
    },
    {
      title: t('disputes.col.market'),
      dataIndex: 'market_title',
      ellipsis: true,
      width: 220,
      search: false,
      render: (_, row) => (
        <span>{row.market_title || '—'}</span>
      ),
    },
    {
      title: t('disputes.col.claim'),
      dataIndex: 'claimed_outcome',
      width: 90,
      render: (_, row) => <Tag>{outcomeLabel(row.claimed_outcome)}</Tag>,
      search: false,
    },
    {
      title: t('disputes.col.status'),
      dataIndex: 'status',
      width: 120,
      valueEnum: {
        pending:   { text: t('disputes.status.pending'),   status: 'Warning' },
        resolved:  { text: t('disputes.status.resolved'),  status: 'Success' },
        dismissed: { text: t('disputes.status.dismissed'), status: 'Default' },
      },
    },
    {
      title: t('disputes.col.filed'),
      dataIndex: 'filed_at',
      valueType: 'dateTime',
      width: 170,
      search: false,
    },
  ], [intl.locale]);

  return (
    <PageContainer>
      <ProTable<DisputeRow>
        actionRef={tableRef}
        rowKey="id"
        columns={columns}
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
          const res = await polymindApi.listDisputes({
            status: params.status as string | undefined,
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
        pagination={{ pageSize: 20 }}
        scroll={{ x: 'max-content' }}
        onRow={(row) => ({
          onClick: () => openRow(row.id),
          style: { cursor: 'pointer' },
        })}
      />

      <DisputeDrawer
        open={openId != null}
        disputeId={openId}
        onClose={closeDrawer}
        onTxDone={() => tableRef.current?.reload()}
      />
    </PageContainer>
  );
}
