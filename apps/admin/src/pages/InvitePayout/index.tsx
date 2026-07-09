import {
  PageContainer, ProTable,
  type ActionType, type ProColumns,
} from '@ant-design/pro-components';
import {
  App, Avatar, Button, Collapse, Drawer, Empty, Input, List, Modal, Space, Tag, Tooltip, Typography,
} from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  downloadCsv,
  polymindApi,
  type InviteInviteeRow,
  type InviteRewardRow,
  type InviteSummaryRow,
} from '@/services/polymind';
import { useModel } from '@umijs/max';
import { v3WithdrawPlatformBalance } from '@/wallet/endless';
import { formatDate } from '@/utils/format';
import { useAdminTx } from '@/hooks/useAdminTx';
import SignerStatusCard from '@/components/SignerStatusCard';
import { Alert, Card, InputNumber } from 'antd';

const { Text } = Typography;
const EDS = 1e8;
const fmtEds = (b: string | number) => (Number(b) / EDS).toFixed(4);
const shortAddr = (a: string) => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);

export default function InvitePayoutPage() {
  const intl = useIntl();
  const tr = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message, modal } = App.useApp();
  const tableRef = useRef<ActionType | null>(null);
  const adminTx = useAdminTx();
  const { isContractDistributor } = useModel('wallet');

  const [opsWallet, setOpsWallet] = useState<{
    address: string; balance_base: string; configured: boolean;
  } | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<number>(100);

  const reloadOps = () => {
    polymindApi.inviteOpsWallet()
      .then(setOpsWallet)
      .catch(() => setOpsWallet(null));
  };
  useEffect(() => { reloadOps(); }, []);

  const topUp = () => {
    if (!opsWallet?.address) {
      message.error(tr('invite.ops.notConfigured'));
      return;
    }
    if (!topUpAmount || topUpAmount <= 0) {
      message.warning(tr('invite.ops.amountInvalid'));
      return;
    }
    adminTx.run({
      name: tr('invite.ops.txName', { amount: topUpAmount }),
      call: (addr) => v3WithdrawPlatformBalance(
        addr,
        BigInt(Math.round(topUpAmount * EDS)),
        opsWallet.address,
      ),
      confirm: {
        title: tr('invite.ops.confirm.title', { amount: topUpAmount }),
        content: tr('invite.ops.confirm.content', { addr: opsWallet.address }),
      },
      onDone: () => {
        setTopUpOpen(false);
        [0, 2000, 5000].forEach((ms) => setTimeout(reloadOps, ms));
      },
    });
  };

  const [drawer, setDrawer] = useState<InviteSummaryRow | null>(null);
  const [drawerRows, setDrawerRows] = useState<InviteRewardRow[]>([]);
  const [drawerInvitees, setDrawerInvitees] = useState<InviteInviteeRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [txHash, setTxHash] = useState('');
  const [busy, setBusy] = useState(false);

  const reloadDrawer = (uid: string) => {
    setDrawerLoading(true);
    Promise.all([
      polymindApi.inviteRewards({ inviter_luffa_id: uid, status: 'pending', limit: 500 }),
      polymindApi.inviteInvitees(uid),
    ])
      .then(([rewardsRes, invitees]) => {
        setDrawerRows(rewardsRes.data || []);
        setDrawerInvitees(invitees || []);
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => setDrawerLoading(false));
  };

  useEffect(() => {
    if (!drawer) {
      setDrawerRows([]);
      setDrawerInvitees([]);
      setSelectedIds([]);
      setTxHash('');
      return;
    }
    reloadDrawer(drawer.inviter_luffa_id);
  }, [drawer]);

  const columns = useMemo<ProColumns<InviteSummaryRow>[]>(() => [
    {
      title: tr('invite.col.inviter'),
      dataIndex: 'inviter_luffa_id',
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.inviter_nickname || row.inviter_luffa_id}</Text>
          {row.inviter_nickname && (
            <Text type="secondary" code style={{ fontSize: 11 }}>
              {row.inviter_luffa_id}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: tr('invite.col.address'),
      dataIndex: 'inviter_address',
      width: 220,
      render: (_, row) => row.inviter_address
        ? <Text code copyable={{ text: row.inviter_address }}>{shortAddr(row.inviter_address)}</Text>
        : <Text type="warning">{tr('invite.address.missing')}</Text>,
    },
    {
      title: tr('invite.col.pending'),
      dataIndex: 'pending_base',
      width: 140,
      render: (_, row) => (
        <Tag color="green" style={{ fontSize: 13 }}>
          {fmtEds(row.pending_base)} EDS
        </Tag>
      ),
    },
    {
      title: tr('invite.col.count'),
      dataIndex: 'pending_count',
      width: 90,
    },
    {
      title: tr('invite.col.lastAt'),
      dataIndex: 'last_reward_at',
      width: 170,
      render: (_, row) => formatDate(row.last_reward_at),
    },
    {
      title: tr('invite.col.actions'),
      width: 130,
      render: (_, row) => (
        <Button
          type="primary"
          size="small"
          disabled={!row.inviter_address}
          onClick={() => setDrawer(row)}
        >
          {tr('invite.action.payout')}
        </Button>
      ),
    },
  ], [intl.locale]);

  const selectedTotal = useMemo(
    () => drawerRows
      .filter((r) => selectedIds.includes(r.id))
      .reduce((sum, r) => sum + Number(r.reward_base || 0), 0),
    [drawerRows, selectedIds],
  );

  const _markPaidApi = (ids: number[], hash: string | undefined, onDone?: () => void) => {
    if (!drawer) return;
    setBusy(true);
    polymindApi
      .inviteMarkPaid({ ids, tx_hash: hash })
      .then((r) => {
        message.success(tr('invite.markPaid.done', {
          n: r.flipped, skipped: r.skipped,
        }));
        setSelectedIds([]);
        setTxHash('');
        reloadDrawer(drawer.inviter_luffa_id);
        tableRef.current?.reload();
        onDone?.();
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => setBusy(false));
  };

  const markPaidManual = () => {
    if (!drawer) return;
    if (selectedIds.length === 0) {
      message.warning(tr('invite.markPaid.noSelection'));
      return;
    }
    modal.confirm({
      title: tr('invite.markPaid.confirm.title', {
        n: selectedIds.length,
        amount: fmtEds(selectedTotal),
      }),
      content: tr('invite.markPaid.confirm.content', {
        addr: drawer.inviter_address,
        tx: txHash || tr('invite.markPaid.txMissing'),
      }),
      okText: tr('invite.markPaid.ok'),
      onOk: () => _markPaidApi(selectedIds, txHash || undefined),
    });
  };

  const payFromContract = () => {
    if (!drawer) return;
    if (selectedIds.length === 0) {
      message.warning(tr('invite.markPaid.noSelection'));
      return;
    }
    if (!drawer.inviter_address) {
      message.error(tr('invite.payContract.noAddress'));
      return;
    }
    const amount = selectedTotal;
    if (amount <= 0) {
      message.error(tr('invite.payContract.zeroAmount'));
      return;
    }
    const idsSnapshot = [...selectedIds];
    adminTx.run({
      name: tr('invite.payContract.txName', { amount: fmtEds(amount) }),
      call: (addr) =>
        v3WithdrawPlatformBalance(addr, BigInt(amount), drawer.inviter_address),
      confirm: {
        title: tr('invite.payContract.confirm.title', {
          n: idsSnapshot.length, amount: fmtEds(amount),
        }),
        content: tr('invite.payContract.confirm.content', {
          addr: drawer.inviter_address,
        }),
      },
      onDone: (hash) => {
        _markPaidApi(idsSnapshot, hash);
      },
    });
  };

  const detailColumns: ProColumns<InviteRewardRow>[] = [
    { title: tr('invite.detail.invitee'), dataIndex: 'invitee_luffa_id', ellipsis: true },
    {
      title: tr('invite.detail.bet'),
      dataIndex: 'bet_amount_base',
      width: 120,
      render: (_, r) => `${fmtEds(r.bet_amount_base)} EDS`,
    },
    {
      title: tr('invite.detail.reward'),
      dataIndex: 'reward_base',
      width: 120,
      render: (_, r) => (
        <Tag color="green">{fmtEds(r.reward_base)} EDS</Tag>
      ),
    },
    {
      title: tr('invite.detail.market'),
      width: 140,
      render: (_, r) => `event #${r.onchain_event_id} · m${r.market_idx}`,
    },
    {
      title: tr('invite.detail.when'),
      dataIndex: 'created_at',
      width: 170,
      render: (_, r) => formatDate(r.created_at),
    },
  ];

  return (
    <PageContainer content={tr('invite.subtitle')}>
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message={tr('invite.ops.notConfigured')}
        description={tr('invite.ops.notConfiguredHint')}
      />
      {opsWallet && (
        <Card size="small" style={{ marginBottom: 16, display: "none" }}
              title={tr('invite.ops.cardTitle')}
              extra={
                <Button type="primary"
                        disabled={!opsWallet.configured}
                        onClick={() => setTopUpOpen(true)}>
                  {tr('invite.ops.topUpBtn')}
                </Button>
              }>
          {!opsWallet.configured ? (
            <Alert type="warning" showIcon
                   message={tr('invite.ops.notConfigured')}
                   description={tr('invite.ops.notConfiguredHint')} />
          ) : (
            <Space size="middle" wrap>
              <Text type="secondary">{tr('invite.ops.address')}</Text>
              <Text code copyable={{ text: opsWallet.address }}>
                {shortAddr(opsWallet.address)}
              </Text>
              <Text type="secondary">{tr('invite.ops.balance')}</Text>
              <Tag color={Number(opsWallet.balance_base) > 0 ? 'green' : 'red'}
                   style={{ fontSize: 14, padding: '2px 10px' }}>
                {fmtEds(opsWallet.balance_base)} EDS
              </Tag>
            </Space>
          )}
        </Card>
      )}

      <ProTable<InviteSummaryRow>
        actionRef={tableRef}
        rowKey="inviter_luffa_id"
        columns={columns}
        search={false}
        scroll={{ x: 'max-content' }}
        toolBarRender={() => [
          <Tooltip title={tr('common.exportCsv')} key="export">
            <Button type="text" icon={<ExportOutlined />} onClick={async () => {
              try {
                await downloadCsv('/api/v1/invite/rewards?download=1');
              } catch (e) {
                message.error((e as Error).message);
              }
            }} />
          </Tooltip>,
        ]}
        request={async () => {
          const data = await polymindApi.inviteSummary();
          return { data, total: data.length, success: true };
        }}
      />

      <Drawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={drawer ? tr('invite.drawer.title', {
          name: drawer.inviter_nickname || drawer.inviter_luffa_id,
        }) : ''}
        width={820}
        destroyOnClose
      >
        {drawer && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space direction="vertical" size={4}>
              <Text>
                {tr('invite.drawer.toAddr')}{' '}
                <Text code copyable={{ text: drawer.inviter_address }}>
                  {drawer.inviter_address}
                </Text>
              </Text>
              <Text>
                {tr('invite.drawer.pendingTotal')}{' '}
                <Tag color="green">{fmtEds(drawer.pending_base)} EDS</Tag>
                <Text type="secondary"> ({drawer.pending_count} {tr('invite.drawer.rows')})</Text>
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {tr('invite.drawer.workflow')}
              </Text>
            </Space>

            <Collapse
              size="small"
              items={[{
                key: 'invitees',
                label: tr('invite.drawer.inviteesHead', { n: drawerInvitees.length }),
                children: drawerInvitees.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={tr('invite.drawer.noInvitees')}
                  />
                ) : (
                  <List
                    size="small"
                    dataSource={drawerInvitees}
                    renderItem={(it) => (
                      <List.Item>
                        <List.Item.Meta
                          avatar={
                            <Avatar src={it.avatar || undefined}>
                              {(it.nickname || it.luffa_id || '?').slice(0, 1).toUpperCase()}
                            </Avatar>
                          }
                          title={
                            <Space size={6} wrap>
                              <Text strong>{it.nickname || it.luffa_id}</Text>
                              <Text type="secondary" code style={{ fontSize: 11 }}>
                                {it.luffa_id}
                              </Text>
                            </Space>
                          }
                          description={
                            <Space size={12} wrap>
                              {it.reward_count > 0
                                ? <Text type="secondary">
                                    {tr('invite.drawer.inviteeRewards', {
                                      n: it.reward_count,
                                      amount: fmtEds(
                                        Number(it.pending_base) + Number(it.paid_base),
                                      ),
                                    })}
                                  </Text>
                                : <Text type="secondary">{tr('invite.drawer.inviteeNoReward')}</Text>
                              }
                              {Number(it.pending_base) > 0 && (
                                <Tag color="orange" style={{ margin: 0 }}>
                                  {tr('invite.drawer.inviteePending', {
                                    amount: fmtEds(it.pending_base),
                                  })}
                                </Tag>
                              )}
                              {Number(it.paid_base) > 0 && (
                                <Tag color="green" style={{ margin: 0 }}>
                                  {tr('invite.drawer.inviteePaid', {
                                    amount: fmtEds(it.paid_base),
                                  })}
                                </Tag>
                              )}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                ),
              }]}
            />

            <div style={{ maxHeight: 360, overflowY: 'auto',
                          border: '1px solid #f0f0f0', borderRadius: 8 }}>
              <ProTable<InviteRewardRow>
                search={false}
                toolBarRender={false}
                loading={drawerLoading}
                dataSource={drawerRows}
                columns={detailColumns}
                rowKey="id"
                pagination={false}
                scroll={{ x: 'max-content' }}
                rowSelection={{
                  selectedRowKeys: selectedIds,
                  onChange: (keys) => setSelectedIds(keys.map((k) => Number(k))),
                }}
              />
            </div>

            <Space>
              <Button onClick={() => setSelectedIds(drawerRows.map((r) => r.id))}>
                {tr('invite.drawer.selectAll')}
              </Button>
              <Text type="secondary">
                {tr('invite.drawer.selectionSummary', {
                  n: selectedIds.length, amount: fmtEds(selectedTotal),
                })}
              </Text>
            </Space>

            <SignerStatusCard role="distributor" compact />

            <Button
              type="primary"
              size="large"
              block
              loading={adminTx.busy}
              disabled={selectedIds.length === 0 || !adminTx.canRun
                        || !drawer.inviter_address || !isContractDistributor}
              onClick={payFromContract}
            >
              {tr('invite.payContract.btn', {
                n: selectedIds.length, amount: fmtEds(selectedTotal),
              })}
            </Button>

            <Collapse
              size="small"
              items={[{
                key: 'manual',
                label: tr('invite.drawer.manualHead'),
                children: (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {tr('invite.drawer.manualHint')}
                    </Text>
                    <Input
                      placeholder={tr('invite.drawer.txPlaceholder')}
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      allowClear
                    />
                    <Button
                      loading={busy}
                      disabled={selectedIds.length === 0}
                      onClick={markPaidManual}
                    >
                      {tr('invite.drawer.markBtn', {
                        n: selectedIds.length,
                        amount: fmtEds(selectedTotal),
                      })}
                    </Button>
                  </Space>
                ),
              }]}
            />
          </Space>
        )}
      </Drawer>

      <Modal
        title={tr('invite.ops.topUpTitle')}
        open={topUpOpen}
        onCancel={() => setTopUpOpen(false)}
        onOk={topUp}
        okText={tr('invite.ops.topUpOk')}
        okButtonProps={{ loading: adminTx.busy,
                         disabled: !adminTx.canRun || !isContractDistributor }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{tr('invite.ops.topUpHint', { addr: opsWallet?.address || '' })}</Text>
          <SignerStatusCard role="distributor" compact />
          <InputNumber
            min={0.01}
            step={10}
            value={topUpAmount}
            onChange={(v) => setTopUpAmount(Number(v) || 0)}
            style={{ width: '100%' }}
            addonAfter="EDS"
          />
        </Space>
      </Modal>
    </PageContainer>
  );
}
