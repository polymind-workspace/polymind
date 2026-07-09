import {
  PageContainer, ProTable,
  type ActionType, type ProColumns,
} from '@ant-design/pro-components';
import { Alert, Empty, Space, Tag } from 'antd';
import { useIntl } from '@umijs/max';
import { useMemo, useRef, useState } from 'react';
import { polymindApi, type EventListItem } from '@/services/polymind';
import EventDrawer from '@/components/EventDrawer';

const ADMIN_SOURCES = 'official,polymarket';

export default function MyQueueEventsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  const tableRef = useRef<ActionType | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const columns = useMemo<ProColumns<EventListItem>[]>(() => [
    {
      title: t('events.col.question'),
      dataIndex: 'question',
      ellipsis: true,
      search: { transform: (v) => ({ q: v }) },
      render: (_, row) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <a onClick={() => setOpenSlug(row.slug)}>{row.question}</a>
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
      title: t('events.col.markets'),
      dataIndex: 'market_count',
      width: 90,
      align: 'right',
      search: false,
    },
    {
      title: t('events.col.status'),
      dataIndex: 'status',
      width: 120,
      search: false,
      render: (_, row) => <Tag>{row.status || '—'}</Tag>,
    },
    {
      title: t('events.col.created'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 180,
      search: false,
    },
  ], [intl.locale]);

  return (
    <PageContainer
      content={
        <Alert
          type="info"
          showIcon
          message={t('myQueueEvents.subtitle')}
        />
      }
    >
      <ProTable<EventListItem>
        actionRef={tableRef}
        rowKey="slug"
        columns={columns}
        pagination={{ pageSize: 20 }}
        request={async (params) => {
          const res = await polymindApi.listEvents({
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
        onRow={(row) => ({
          onClick: () => setOpenSlug(row.slug),
          style: { cursor: 'pointer' },
        })}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: <Empty description={t('myQueueEvents.empty')} /> }}
      />

      <EventDrawer
        open={openSlug != null}
        slug={openSlug}
        onClose={() => setOpenSlug(null)}
        onTxDone={() => tableRef.current?.reload()}
      />
    </PageContainer>
  );
}
