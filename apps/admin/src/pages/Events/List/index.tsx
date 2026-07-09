import {
  PageContainer,
  ProTable,
  type ActionType,
  type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Select, Space, Tag, Tooltip } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { Link, useIntl, useSearchParams } from '@umijs/max';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadCsv, polymindApi, type EventListItem, type PmTagRow } from '@/services/polymind';
import EventDrawer from '@/components/EventDrawer';

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

export default function EventListPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();

  const [searchParams, setSearchParams] = useSearchParams();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const tableRef = useRef<ActionType | undefined>(undefined);

  const [tagDict, setTagDict] = useState<PmTagRow[]>([]);
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [filterSource, setFilterSource] = useState<string | undefined>(undefined);
  const searchParamsRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    polymindApi.listTags().then(setTagDict).catch(() => {});
  }, []);

  useEffect(() => {
    const v = searchParams.get('event');
    setOpenSlug(v || null);
  }, [searchParams]);

  useEffect(() => {
    tableRef.current?.reload();
  }, [filterTagIds]);

  useEffect(() => {
    tableRef.current?.reload();
  }, [filterSource]);

  const openRow = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('event', slug);
    setSearchParams(next, { replace: false });
  };
  const closeDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('event');
    setSearchParams(next, { replace: false });
  };

  const handleExport = async () => {
    const params = searchParamsRef.current;
    const qs = new URLSearchParams();
    if (params.question) qs.set('q', params.question as string);
    if (filterTagIds.length) qs.set('tag_ids', filterTagIds.join(','));
    if (filterSource) qs.set('source', filterSource);
    qs.set('download', '1');
    try {
      await downloadCsv(`/api/v1/events?${qs.toString()}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const tagOptions = useMemo(
    () => tagDict.map((tg) => ({
      label: `${tg.display_name} (${tg.slug})`,
      value: tg.id,
    })),
    [tagDict],
  );

  const columns = useMemo<ProColumns<EventListItem>[]>(() => [
    {
      title: t('events.list.col.question'),
      dataIndex: 'question',
      ellipsis: true,
      render: (_, row) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <a>{row.question}</a>
          {row.tags && row.tags.length > 0 && (
            <Space size={[4, 4]} wrap>
              {row.tags.map((tg) => (
                <Tag key={tg.id} color="blue" style={{ margin: 0 }}>
                  {tg.display_name}
                </Tag>
              ))}
            </Space>
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
    { title: t('events.list.col.creator'), dataIndex: 'creator', ellipsis: true, copyable: true, width: 180 },
    {
      title: t('events.list.col.markets'),
      dataIndex: 'market_count',
      width: 90,
      align: 'right',
      search: false,
    },
    {
      title: t('events.list.col.status'),
      dataIndex: 'status',
      width: 120,
      render: (_, row) => <Tag>{row.status || '—'}</Tag>,
    },
    {
      title: t('events.list.col.visibility'),
      width: 140,
      search: false,
      render: (_, row) => (
        <Space size={[0, 4]} direction="vertical" style={{ fontSize: 12 }}>
          {row.pinned === 1 && <Tag color="gold" style={{ margin: 0 }}>Pinned</Tag>}
          {row.is_trending === 1 && <Tag color="blue" style={{ margin: 0 }}>Trending</Tag>}
          {row.is_flagged === 1 && <Tag color="red" style={{ margin: 0 }}>Flagged</Tag>}
        </Space>
      ),
    },
    {
      title: t('events.list.col.created'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 180,
      search: false,
    },
  ], [intl.locale]);

  return (
    <PageContainer
      extra={[
        <Link key="create" to="/events/create">
          <Button type="primary">{t('events.list.create')}</Button>
        </Link>,
      ]}
    >
      <ProTable<EventListItem>
        actionRef={tableRef}
        rowKey="slug"
        columns={columns}
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
          <Select
            key="tag-filter"
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('tags.event.section')}
            options={tagOptions}
            value={filterTagIds}
            onChange={(v) => setFilterTagIds(v as number[])}
            style={{ minWidth: 240, maxWidth: 480 }}
          />,
          <Tooltip title={t('common.exportCsv')} key="export">
            <Button type="text" icon={<ExportOutlined />} onClick={handleExport} />
          </Tooltip>,
        ]}
        request={async (params) => {
          searchParamsRef.current = params;
          const res = await polymindApi.listEvents({
            q: params.question as string | undefined,
            tag_ids: filterTagIds.length ? filterTagIds.join(',') : undefined,
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
        onRow={(row) => ({
          onClick: () => openRow(row.slug),
          style: { cursor: 'pointer' },
        })}
      />

      <EventDrawer
        open={openSlug != null}
        slug={openSlug}
        onClose={closeDrawer}
        onTxDone={() => tableRef.current?.reload()}
      />
    </PageContainer>
  );
}
