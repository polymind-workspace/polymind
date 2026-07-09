import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, Descriptions, Progress, Spin, Tabs, Tag, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useIntl } from '@umijs/max';
import dayjs from 'dayjs';
import { polymindApi } from '@/services/polymind';
import type { PayoutRow, PayoutItemRow } from '@/services/polymind';
import useWalletModel from '@/models/wallet';
import {
  rewardVaultCreatePayout,
  rewardVaultAddRewards,
  getCurrentAddress,
} from '@/wallet/endless';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: '待上链', color: 'default' },
  creating:   { label: '上链中', color: 'processing' },
  claimable:  { label: '已发放', color: 'success' },
  closed:     { label: '已关闭', color: 'error' },
};

const ITEM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: '待发放', color: 'default' },
  available:  { label: '待领取', color: 'processing' },
  claimed:    { label: '已领取', color: 'success' },
  cancelled:  { label: '已取消', color: 'error' },
};

export default function RewardsDetailPage() {
  const { id } = useParams<{ id: string }>();
  const payoutId = Number(id);
  const navigate = useNavigate();
  const intl = useIntl();
  const { message, modal } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [payout, setPayout] = useState<PayoutRow | null>(null);
  const [items, setItems] = useState<PayoutItemRow[]>([]);
  const [activeTab, setActiveTab] = useState('items');
  const [busy, setBusy] = useState(false);

  const { address, connect, contractAddr } = useWalletModel();
  const autoSyncRef = useRef(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await polymindApi.getPayout(payoutId);
      if (res.ret === 200 && res.data) {
        setPayout(res.data.payout);
        setItems(res.data.items);
        // 如果处于 creating 状态且已有 create_tx_hash 但还没有 chain_payout_id，自动轮询链上确认
        if (
          res.data.payout.status === 'creating' &&
          res.data.payout.create_tx_hash &&
          !res.data.payout.chain_payout_id &&
          !autoSyncRef.current
        ) {
          autoSyncCreate(res.data.payout.create_tx_hash);
        }
      } else {
        message.error((res as any).msg || '加载失败');
      }
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const autoSyncCreate = async (txHash: string) => {
    if (autoSyncRef.current) return;
    autoSyncRef.current = true;
    try {
      for (let attempt = 1; attempt <= 10; attempt++) {
        const res = await polymindApi.syncCreatePayout(payoutId, {
          create_tx_hash: txHash,
        });
        if (!res.pending) {
          message.success('链上确认成功');
          await fetchData();
          return;
        }
        // pending 中，等 3 秒再试
        await new Promise((r) => setTimeout(r, 3000));
      }
      message.warning('链上确认超时，请手动点击"上链发奖"重试');
    } catch (e: any) {
      message.error(`自动确认失败: ${e.message}`);
    } finally {
      autoSyncRef.current = false;
    }
  };

  useEffect(() => {
    fetchData();
  }, [payoutId]);

  const statusInfo = useMemo(() => {
    if (!payout) return null;

    // creating 状态细分：
    // - 无 chain_payout_id → 上链中（create_payout 还在确认）
    // - 有 chain_payout_id 但无 distribute_tx_hash → 分发中（add_rewards 还没完成）
    if (payout.status === 'creating') {
      if (payout.chain_payout_id && !payout.distribute_tx_hash) {
        return { label: '分发中', color: 'processing' };
      }
      return { label: '上链中', color: 'processing' };
    }

    return STATUS_MAP[payout.status] || { label: payout.status, color: 'default' };
  }, [payout]);

  const handleDistribute = async () => {
    setBusy(true);
    try {
      // 1. 连接钱包
      console.log('[payout] handleDistribute start, address from model:', address);
      let walletAddr = address || (await getCurrentAddress());
      console.log('[payout] walletAddr after getCurrentAddress:', walletAddr);
      if (!walletAddr) {
        message.loading({ content: '请连接钱包...', key: 'payout', duration: 0 });
        try {
          console.log('[payout] calling connect()...');
          await connect();
          await new Promise((r) => setTimeout(r, 500)); // 等 SDK 状态同步
          walletAddr = await getCurrentAddress();
          console.log('[payout] walletAddr after connect:', walletAddr);
        } catch (e: any) {
          console.error('[payout] connect failed:', e);
          walletAddr = null;
        }
      }
      if (!walletAddr) {
        message.destroy('payout');
        message.error('钱包连接失败，请确保钱包已安装并授权');
        setBusy(false);
        return;
      }
      if (!contractAddr) {
        throw new Error('合约地址未配置');
      }

      // 2. 创建链上 payout（钱包签名），如果已有 chain_payout_id 则跳过
      let createTxHash = payout!.create_tx_hash || '';
      let chainPayoutId = payout!.chain_payout_id || 0;
      console.log('[payout] chainPayoutId from payout:', chainPayoutId);

      if (!chainPayoutId) {
        message.loading({ content: '第1步/3：创建发奖池，请签名...', key: 'payout', duration: 0 });
        createTxHash = await rewardVaultCreatePayout(
          contractAddr,
          payout!.name,
          payout!.tag || '',
          payout!.claim_deadline,
        );

        // 3. 等链上确认后再同步
        message.loading({ content: '第1步/3：交易已提交，等待链上确认...', key: 'payout', duration: 0 });
        await new Promise((r) => setTimeout(r, 3000));

        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const syncRes = await polymindApi.syncCreatePayout(payoutId, {
              create_tx_hash: createTxHash,
            });
            if (syncRes.pending) {
              // 链上还在确认中，继续等待
              if (attempt === 5) {
                throw new Error('链上确认超时，已保存交易哈希，请刷新页面后自动继续');
              }
              message.loading({
                content: `第1步/3：链上确认中（${attempt}/5）...`,
                key: 'payout',
                duration: 0,
              });
              await new Promise((r) => setTimeout(r, 3000));
              continue;
            }
            chainPayoutId = syncRes.chain_payout_id || 0;
            if (!chainPayoutId) {
              throw new Error('sync-create 返回了空的 chain_payout_id');
            }
            break;
          } catch (e: any) {
            if (attempt === 5) throw e;
            message.loading({
              content: `第1步/3：链上确认中（${attempt}/5）...`,
              key: 'payout',
              duration: 0,
            });
            await new Promise((r) => setTimeout(r, 3000));
          }
        }
      }

      // 4. 准备 recipients 和 amounts，分批 add_rewards
      // 只用 is_valid_address 的项，且用 address_hex（0x...）因为 endless-web3-sdk 只接受 hex 地址
      const validItems = items.filter((i) => i.is_valid_address && i.address_hex);
      const invalidCount = items.length - validItems.length;
      if (invalidCount > 0) {
        message.warning(`${invalidCount} 个地址格式无效，已跳过`);
      }
      if (validItems.length === 0) {
        throw new Error('没有有效的获奖地址，请检查名单');
      }
      const recipients = validItems.map((i) => i.address_hex);
      const amounts = validItems.map((i) => String(Math.round(i.amount_eds * 1e8)));

      const batchSize = 100;
      let addTxHash = '';
      const batchCount = Math.ceil(recipients.length / batchSize);
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batchIdx = Math.floor(i / batchSize) + 1;
        message.loading({
          content: `第2步/3：添加获奖人（${batchIdx}/${batchCount}批），请签名...`,
          key: 'payout',
          duration: 0,
        });
        const batchRecipients = recipients.slice(i, i + batchSize);
        const batchAmounts = amounts.slice(i, i + batchSize);
        console.log('[payout] calling rewardVaultAddRewards, chainPayoutId=', chainPayoutId, 'recipients=', batchRecipients.length);
        addTxHash = await rewardVaultAddRewards(
          contractAddr,
          chainPayoutId,
          batchRecipients,
          batchAmounts,
        );
        console.log('[payout] rewardVaultAddRewards returned, txHash=', addTxHash);
      }

      // 5. 确认到后端
      message.loading({ content: '第3步/3：确认上链状态...', key: 'payout', duration: 0 });
      await polymindApi.confirmPayout(payoutId, {
        create_tx_hash: createTxHash,
        add_tx_hash: addTxHash,
      });

      message.destroy('payout');
      message.success('上链发奖成功');
      fetchData();
    } catch (e) {
      message.destroy('payout');
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    modal.confirm({
      title: '确认回收资金',
      content: (
        <div>
          <p>发奖名称: {payout?.name}</p>
          <p>未领取金额: {(payout?.total_amount_eds ?? 0) - (payout?.claimed_amount_eds ?? 0)} EDS</p>
          <p style={{ color: '#ff4d4f' }}>回收后未领取资金将退回合约账户</p>
        </div>
      ),
      okText: '确认回收',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setBusy(true);
        try {
          const res = await polymindApi.closePayout(payoutId);
          message.success(`回收成功: ${res.tx_hash.slice(0, 16)}...`);
          fetchData();
        } catch (e) {
          message.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const itemColumns: ProColumns<PayoutItemRow>[] = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '地址',
      dataIndex: 'address',
      width: 260,
      ellipsis: true,
      render: (_, row) => (
        <span style={{ color: row.is_valid_address ? 'inherit' : '#ff4d4f' }}>
          {row.address || '-'}
          {!row.is_valid_address && <Tag color="error" style={{ marginLeft: 4, fontSize: 10 }}>无效</Tag>}
        </span>
      ),
    },
    { title: '金额 (EDS)', dataIndex: 'amount_eds', width: 120, align: 'right' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (_, row) => {
        const s = ITEM_STATUS_MAP[row.status] || { label: row.status, color: 'default' };
        return <Tag color={s.color}>{s.label}</Tag>;
      },
    },
    {
      title: '领取时间',
      dataIndex: 'claimed_at',
      width: 180,
      render: (_, row) => {
        if (!row.claimed_at) return '-';
        return dayjs(row.claimed_at).format('YYYY-MM-DD HH:mm:ss');
      },
    },
    {
      title: 'TX Hash',
      dataIndex: 'claim_tx_hash',
      width: 220,
      ellipsis: true,
      render: (_, row) => {
        const hash = row.claim_tx_hash || '';
        if (!hash || hash.length < 16) return '-';
        const short = `${hash.slice(0, 8)}…${hash.slice(-8)}`;
        return (
          <Typography.Text code style={{ fontSize: 12 }} copyable={{ text: hash }}>
            {short}
          </Typography.Text>
        );
      },
    },
  ];

  const claimedItems = useMemo(() => items.filter(i => i.status === 'claimed'), [items]);
  const claimRate = useMemo(() => {
    if (!payout || payout.recipient_count === 0) return 0;
    return Math.round((payout.claimed_count / payout.recipient_count) * 100);
  }, [payout]);

  if (loading) {
    return (
      <PageContainer title="发奖详情">
        <div style={{ padding: 100, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </PageContainer>
    );
  }

  if (!payout) {
    return (
      <PageContainer title="发奖详情">
        <Card>加载失败</Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={`发奖详情 #${payout.id}`}
      onBack={() => navigate('/ops/rewards')}
      extra={
        <div>
          {(payout.status === 'pending' || payout.status === 'creating') && (
            <Button type="primary" loading={busy} onClick={handleDistribute}>
              {payout.status === 'creating' ? '继续上链发奖' : '上链发奖'}
            </Button>
          )}
          {payout.status === 'claimable' && (
            (() => {
              const nowSec = Math.floor(Date.now() / 1000);
              const canClose = payout.claim_deadline ? nowSec > payout.claim_deadline : false;
              return canClose ? (
                <Button danger loading={busy} onClick={handleClose} style={{ marginLeft: 8 }}>
                  回收资金
                </Button>
              ) : null;
            })()
          )}
        </div>
      }
    >
      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={4}>
          <Descriptions.Item label="名称">{payout.name}</Descriptions.Item>
          <Descriptions.Item label="标签">{payout.tag || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusInfo?.color}>{statusInfo?.label}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="领取截止">
            {payout.claim_deadline
              ? new Date(payout.claim_deadline * 1000).toLocaleString()
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="总人数">{payout.recipient_count}</Descriptions.Item>
          <Descriptions.Item label="已领取">{payout.claimed_count}</Descriptions.Item>
          <Descriptions.Item label="总金额">{payout.total_amount_eds} EDS</Descriptions.Item>
          <Descriptions.Item label="已领取金额">{payout.claimed_amount_eds} EDS</Descriptions.Item>
        </Descriptions>
        {payout.status !== 'pending' && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={claimRate} status={claimRate === 100 ? 'success' : 'active'} />
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              领取进度: {payout.claimed_count}/{payout.recipient_count} ({claimRate}%)
            </div>
          </div>
        )}
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <Tabs.TabPane tab="名单管理" key="items">
          <ProTable<PayoutItemRow>
            rowKey="id"
            columns={itemColumns}
            dataSource={items}
            pagination={{ defaultPageSize: 50, showSizeChanger: true }}
            search={false}
            scroll={{ x: 'max-content' }}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab="领取进度" key="claimed">
          <ProTable<PayoutItemRow>
            rowKey="id"
            columns={itemColumns}
            dataSource={claimedItems}
            pagination={{ defaultPageSize: 50, showSizeChanger: true }}
            search={false}
            scroll={{ x: 'max-content' }}
          />
        </Tabs.TabPane>
      </Tabs>
    </PageContainer>
  );
}
