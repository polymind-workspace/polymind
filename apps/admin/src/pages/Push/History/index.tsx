import {
  PageContainer, ProTable,
  type ActionType, type ProColumns,
} from '@ant-design/pro-components';
import {
  App, Button, Card, Descriptions, Drawer, Select, Space, Spin, Tag,
  Tooltip, Typography,
} from 'antd';
import { useIntl } from '@umijs/max';
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadCsv, polymindApi, type PushHistoryRow } from '@/services/polymind';
import { ExportOutlined } from '@ant-design/icons';

const { Text } = Typography;

export default function PushHistoryPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const tableRef = useRef<ActionType | undefined>(undefined);

  const [typeFilter, setTypeFilter] = useState<'all' | '1' | '2'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'ok' | 'failed'>('all');
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PushHistoryRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (openId == null) { setDetail(null); return; }
    setDetailLoading(true);
    // New API has no detail endpoint; detail drawer is disabled for MVP.
    setDetail(null);
    setDetailLoading(false);
  }, [openId]);

  useEffect(() => {
    tableRef.current?.reload();
  }, [typeFilter, statusFilter]);

  const [hasPending, setHasPending] = useState(false);
  useEffect(() => {
    if (!hasPending) return;
    const t = setInterval(() => tableRef.current?.reload(), 3000);
    return () => clearInterval(t);
  }, [hasPending]);

  const columns = useMemo<ProColumns<PushHistoryRow>[]>(() => [
    { title: t('push.history.col.id'), dataIndex: 'id', width: 70, search: false },
    {
      title: t('push.history.col.time'),
      dataIndex: 'created_at',
      width: 170,
      search: false,
    },
    {
      title: t('push.history.col.type'),
      dataIndex: 'recipient_address',
      width: 100,
      search: false,
      render: (_, row) => row.recipient_address
        ? <Tag color="blue">{t('push.history.type.personal')}</Tag>
        : <Tag color="purple">{t('push.history.type.broadcast')}</Tag>,
    },
    {
      title: t('push.history.col.recipient'),
      dataIndex: 'recipient_address',
      ellipsis: true,
      render: (_, row) => row.recipient_address
        ? <Text code style={{ fontSize: 11 }}>{row.recipient_address}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: t('push.history.col.headerTitle'),
      dataIndex: 'title',
      ellipsis: true,
      search: false,
    },
    {
      title: t('push.history.col.status'),
      dataIndex: 'status',
      width: 90,
      search: false,
      render: (_, row) => {
        if (row.status === 'pending') return <Tag color="orange">{t('push.history.status.pending')}</Tag>;
        if (row.status === 'sent')    return <Tag color="green">{t('push.history.status.ok')}</Tag>;
        return <Tag color="red">{t('push.history.status.failed')}</Tag>;
      },
    },
    {
      title: t('push.history.col.actions'),
      width: 90,
      fixed: 'right',
      search: false,
      render: (_, row) => (
        <a onClick={() => setOpenId(row.id)}>{t('push.history.btn.view')}</a>
      ),
    },
  ], [intl.locale]);

  return (
    <PageContainer>
      <ProTable<PushHistoryRow>
        actionRef={tableRef}
        rowKey="id"
        columns={columns}
        toolBarRender={() => [
          <Select
            key="type"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all', label: t('push.history.filter.typeAll') },
              { value: '1',   label: t('push.history.filter.typeBroadcast') },
              { value: '2',   label: t('push.history.filter.typePersonal') },
            ]}
          />,
          <Select
            key="status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 160 }}
            options={[
              { value: 'all',     label: t('push.history.filter.statusAll') },
              { value: 'pending', label: t('push.history.filter.statusPending') },
              { value: 'ok',      label: t('push.history.filter.statusOk') },
              { value: 'failed',  label: t('push.history.filter.statusFail') },
            ]}
          />,
          <Tooltip title={t('common.exportCsv')} key="export">
            <Button
              type="text"
              icon={<ExportOutlined />}
              onClick={() => downloadCsv('/api/v1/push?download=1')}
            />
          </Tooltip>,
        ]}
        request={async (params) => {
          const res = await polymindApi.pushHistory({
            page: params.current,
            limit: params.pageSize,
            status: statusFilter === 'all' ? undefined : statusFilter,
          });
          const rows = res.data || [];
          setHasPending(rows.some((r) => r.status === 'pending'));
          return {
            data: rows,
            total: res.total ?? 0,
            success: res.ret === 200,
          };
        }}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20 }}
      />

      <Drawer
        open={openId != null}
        onClose={() => setOpenId(null)}
        width={780}
        title={t('push.detail.title')}
        destroyOnClose
      >
        <Spin spinning={detailLoading && !detail}>
          {detail && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Card size="small" title={t('push.detail.section.meta')}>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label={t('push.history.col.time')}>
                    {detail.created_at}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('push.history.col.type')}>
                    {detail.recipient_address
                      ? t('push.history.type.personal')
                      : t('push.history.type.broadcast')}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('push.history.col.recipient')} span={2}>
                    {detail.recipient_address || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('push.history.col.status')}>
                    {detail.status === 'pending'
                      ? <Tag color="orange">{t('push.history.status.pending')}</Tag>
                      : detail.status === 'sent'
                        ? <Tag color="green">{t('push.history.status.ok')}</Tag>
                        : <Tag color="red">{t('push.history.status.failed')}</Tag>}
                  </Descriptions.Item>
                  {detail.error && (
                    <Descriptions.Item label="error" span={2}>
                      <Text type="danger">{detail.error}</Text>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            </Space>
          )}
        </Spin>
      </Drawer>
    </PageContainer>
  );
}
