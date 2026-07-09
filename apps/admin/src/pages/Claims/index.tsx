import {
  PageContainer, ProTable,
  type ActionType, type ProColumns,
} from '@ant-design/pro-components';
import { App, Button, Popconfirm, Space, Tag, Tooltip } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useIntl, useModel } from '@umijs/max';
import { useMemo, useRef } from 'react';
import { downloadCsv, polymindApi, type ClaimRow } from '@/services/polymind';
import { v3WithdrawPlatformBalance } from '@/wallet/endless';
import { useAdminTx } from '@/hooks/useAdminTx';
import SignerStatusCard from '@/components/SignerStatusCard';

const EDS = 1e8;
const fmtEds = (base: string | number) => (Number(base) / EDS).toFixed(2);

export default function ClaimsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const adminTx = useAdminTx();
  const { isContractDistributor } = useModel('wallet');
  const tableRef = useRef<ActionType | null>(null);
  const searchParamsRef = useRef<Record<string, unknown>>({});

  const handleExport = async () => {
    const params = searchParamsRef.current;
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status as string);
    qs.set('download', '1');
    try {
      await downloadCsv(`/api/v1/invite/claims?${qs.toString()}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const handleExecute = (row: ClaimRow) => {
    adminTx.run({
      name: t('treasury.claims.tx', { id: row.id }),
      call: (addr) =>
        v3WithdrawPlatformBalance(addr, BigInt(row.amount_base), row.user_address),
      confirm: {
        title: t('treasury.claims.confirm.title'),
        content: t('treasury.claims.confirm.content', {
          amount: fmtEds(row.amount_base),
          addr: row.user_address.slice(0, 12),
          nickname: row.nickname || row.uid,
        }),
        danger: true,
      },
      onDone: (hash) => {
        polymindApi.confirmClaim(row.id, hash)
          .then(() => { message.success(t('treasury.claims.done')); tableRef.current?.reload(); })
          .catch((e: Error) => message.error(e.message));
      },
    });
  };

  const handleReject = async (row: ClaimRow) => {
    try {
      await polymindApi.failClaim(row.id, 'rejected by admin');
      message.success(t('treasury.claims.rejected'));
      tableRef.current?.reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns = useMemo<ProColumns<ClaimRow>[]>(() => [
    { title: 'ID', dataIndex: 'id', width: 70, search: false },
    {
      title: t('treasury.claims.col.user'),
      dataIndex: 'nickname',
      width: 140,
      search: false,
      render: (_, row) => row.nickname || row.uid,
    },
    {
      title: t('treasury.claims.col.address'),
      dataIndex: 'user_address',
      width: 160,
      search: false,
      ellipsis: true,
    },
    {
      title: t('treasury.claims.col.amount'),
      dataIndex: 'amount_base',
      width: 120,
      search: false,
      render: (_, row) => `${fmtEds(row.amount_base)} EDS`,
    },
    {
      title: t('treasury.claims.col.status'),
      dataIndex: 'status',
      width: 100,
      valueEnum: {
        pending:    { text: t('treasury.claims.status.pending'),    status: 'Warning' },
        processing: { text: t('treasury.claims.status.processing'), status: 'Processing' },
        done:       { text: t('treasury.claims.status.done'),       status: 'Success' },
        failed:     { text: t('treasury.claims.status.failed'),     status: 'Error' },
      },
    },
    {
      title: t('treasury.claims.col.time'),
      dataIndex: 'created_at',
      valueType: 'dateTime',
      width: 170,
      search: false,
    },
    {
      title: t('treasury.claims.col.actions'),
      width: 160,
      search: false,
      render: (_, row) => {
        if (row.status !== 'pending') return row.tx_hash ? <Tag>{row.tx_hash.slice(0, 10)}...</Tag> : null;
        return (
          <Space size={4}>
            <Button
              type="primary"
              size="small"
              loading={adminTx.busy}
              disabled={!isContractDistributor}
              onClick={() => handleExecute(row)}
            >
              {t('treasury.claims.btn.execute')}
            </Button>
            <Popconfirm
              title={t('treasury.claims.reject.confirm')}
              onConfirm={() => handleReject(row)}
            >
              <Button size="small" danger>{t('treasury.claims.btn.reject')}</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ], [intl.locale, adminTx.busy, isContractDistributor]);

  return (
    <PageContainer>
      <SignerStatusCard role="distributor" compact style={{ marginBottom: 16 }} />
      <ProTable<ClaimRow>
        actionRef={tableRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          searchParamsRef.current = params;
          const res = await polymindApi.listClaims({
            status: params.status as string | undefined,
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
        search={{ filterType: 'light' }}
        toolBarRender={() => [
          <Tooltip title={t('common.exportCsv')} key="export">
            <Button type="text" icon={<ExportOutlined />} onClick={handleExport} />
          </Tooltip>,
        ]}
      />
    </PageContainer>
  );
}
