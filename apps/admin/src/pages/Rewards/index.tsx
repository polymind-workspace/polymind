import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Tag } from 'antd';
import { useRef } from 'react';
import { useNavigate, useIntl } from '@umijs/max';
import { polymindApi } from '@/services/polymind';
import type { PayoutRow } from '@/services/polymind';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: '待上链', color: 'default' },
  creating:   { label: '上链中', color: 'processing' },
  claimable:  { label: '已发放', color: 'success' },
  closed:     { label: '已关闭', color: 'error' },
};

export default function RewardsListPage() {
  const navigate = useNavigate();
  const intl = useIntl();
  const { message } = App.useApp();
  const tableRef = useRef<ActionType>(null);

  const t = (id: string) => intl.formatMessage({ id });

  const columns: ProColumns<PayoutRow>[] = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 60,
      search: false,
    },
    {
      title: t('rewards.col.name') || '名称',
      dataIndex: 'name',
      width: 200,
    },
    {
      title: t('rewards.col.tag') || '标签',
      dataIndex: 'tag',
      width: 120,
      search: false,
      render: (_, row) => row.tag || '-',
    },
    {
      title: t('rewards.col.status') || '状态',
      dataIndex: 'status',
      width: 100,
      valueType: 'select',
      valueEnum: {
        pending:   { text: t('rewards.status.pending') || '待上链' },
        creating:  { text: t('rewards.status.creating') || '上链中' },
        claimable: { text: t('rewards.status.claimable') || '已发放' },
        closed:    { text: t('rewards.status.closed') || '已关闭' },
      },
      render: (_, row) => {
        const s = STATUS_MAP[row.status] || { label: row.status, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: t('rewards.col.recipients') || '领取人',
      width: 100,
      search: false,
      render: (_, row) => `${row.claimed_count}/${row.recipient_count}`,
    },
    {
      title: t('rewards.col.totalAmount') || '总金额 (EDS)',
      dataIndex: 'total_amount_eds',
      width: 140,
      align: 'right',
      search: false,
    },
    {
      title: t('rewards.col.claimedAmount') || '已领取 (EDS)',
      dataIndex: 'claimed_amount_eds',
      width: 140,
      align: 'right',
      search: false,
    },
    {
      title: t('rewards.col.createdAt') || '创建时间',
      dataIndex: 'created_at',
      width: 180,
      search: false,
      valueType: 'dateTime',
    },
    {
      title: t('rewards.col.action') || '操作',
      width: 120,
      fixed: 'right',
      search: false,
      render: (_, row) => (
        <div>
          <Button type="link" size="small" onClick={() => navigate(`/ops/rewards/${row.id}`)}>
            {t('rewards.action.detail') || '详情'}
          </Button>
          {row.status === 'pending' && (
            <Popconfirm
              title="确认删除"
              description={`删除发奖 "${row.name}"？此操作不可恢复。`}
              onConfirm={async () => {
                try {
                  await polymindApi.deletePayout(row.id);
                  message.success('删除成功');
                  tableRef.current?.reload();
                } catch (e: any) {
                  message.error(e.message || '删除失败');
                }
              }}
              okText="删除"
              okButtonProps={{ danger: true }}
              cancelText="取消"
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer title={t('rewards.title') || '发奖中心'}>
      <ProTable<PayoutRow>
        actionRef={tableRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        request={async (params) => {
          const res = await polymindApi.listPayouts({
            status: params.status as string,
            page: params.current,
            limit: params.pageSize,
          });
          return {
            data: res.data || [],
            total: res.total ?? 0,
            success: res.ret === 200,
          };
        }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
      />
    </PageContainer>
  );
}
