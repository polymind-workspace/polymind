import {
  Alert, Button, Card, Descriptions, Drawer, Input, Modal, Space, Spin, Tag, Typography,
} from 'antd';
import { useIntl, useModel } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { polymindApi, type DisputeRow } from '@/services/polymind';
import { formatDate } from '@/utils/format';
import { v3AdminResolve } from '@/wallet/endless';
import { useAdminTx } from '@/hooks/useAdminTx';
import SignerStatusCard from '@/components/SignerStatusCard';

const EDS = 1e8;

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

interface Props {
  open: boolean;
  disputeId: number | null;
  onClose: () => void;
  onTxDone?: () => void;
}

export default function DisputeDrawer({ open, disputeId, onClose, onTxDone }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const outcomeLabel = (n: number) => t(`market.outcome.${n}`);
  const statusLabel = (s: string) => t(`disputes.status.${s}`);

  const [data, setData] = useState<DisputeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pendingOutcome, setPendingOutcome] = useState<1 | 2 | 3>(1);
  const [reason, setReason] = useState('');
  const { isContractAdmin } = useModel('wallet');
  const adminTx = useAdminTx();

  const reload = useCallback(() => {
    if (disputeId == null) return;
    setLoading(true);
    polymindApi
      .disputeDetail(disputeId)
      .then((d) => { setData(d); setErr(''); })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [disputeId]);

  useEffect(() => {
    if (!open || disputeId == null) return;
    setData(null);
    setErr('');
    reload();
  }, [open, disputeId, reload]);

  const openResolve = (outcome: 1 | 2 | 3) => {
    setPendingOutcome(outcome);
    setReason('');
    setReasonOpen(true);
  };

  const submitResolve = () => {
    if (!data || !reason.trim()) return;
    adminTx.run({
      name: t('disputes.tx.resolve', { outcome: outcomeLabel(pendingOutcome) }),
      call: (addr) =>
        v3AdminResolve(
          addr,
          data.onchain_event_id,
          data.market_idx,
          data.disputer,
          pendingOutcome,
          reason.trim(),
        ),
      onDone: () => {
        setReasonOpen(false);
        setData((prev) => prev ? {
          ...prev,
          status: pendingOutcome === prev.claimed_outcome ? 'resolved' : 'dismissed',
          resolved_outcome: pendingOutcome,
          resolved_at: new Date().toISOString(),
        } : prev);
        onTxDone?.();
      },
    });
  };

  const isPending = data?.status === 'pending';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={680}
      title={
        data ? (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 400 }}>
              {t('disputes.detail.idLabel', { id: data.id })}
              {data.market_title && <> · {data.market_title}</>}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={data.event_question}
            >
              {data.event_question || t('disputes.detail.eventFallback', {
                id: data.onchain_event_id,
                idx: data.market_idx,
              })}
            </div>
          </div>
        ) : (
          t('market.loading')
        )
      }
      destroyOnClose
    >
      <Spin spinning={loading && !data}>
        {err && <Alert type="error" message={err} />}
        {data && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card size="small">
              <Descriptions column={2} size="small">
                <Descriptions.Item label={t('disputes.field.status')}>
                  <Tag color={isPending ? 'orange' : data.status === 'resolved' ? 'green' : 'default'}>
                    {statusLabel(data.status)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('source.createdBy')}>
                  <SourceTag source={data.event_source} />
                </Descriptions.Item>
                <Descriptions.Item label={t('disputes.field.market')} span={2}>
                  {data.market_title || '—'}
                  <br />
                  <span style={{ color: '#999' }}>
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label={t('disputes.field.eventId')}>
                  <Typography.Text strong>Event #{data.onchain_event_id}</Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('disputes.field.deadline')}>
                  {data.deadline
                    ? formatDate(data.deadline, { unix: true })
                    : t('disputes.placeholder.noDeadline')}
                </Descriptions.Item>
                <Descriptions.Item label={t('disputes.field.disputer')} span={2}>
                  <Typography.Text code copyable={{ text: data.disputer }} style={{ fontSize: 12 }}>
                    {data.disputer.length > 14
                      ? `${data.disputer.slice(0, 8)}...${data.disputer.slice(-6)}`
                      : data.disputer}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label={t('disputes.field.claimed')}>
                  <Tag>{outcomeLabel(data.claimed_outcome)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('disputes.field.bond')}>
                  {(Number(data.bond_amount) / EDS).toFixed(2)} EDS
                </Descriptions.Item>
                <Descriptions.Item label={t('disputes.field.reason')} span={2}>{data.reason}</Descriptions.Item>
                {data.event_description && (
                  <Descriptions.Item label={t('disputes.field.eventDescription')} span={2}>
                    <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>
                      {data.event_description}
                    </Typography.Text>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label={t('disputes.field.filed')}>{data.filed_at}</Descriptions.Item>
                {data.resolved_at && (
                  <Descriptions.Item label={t('disputes.field.resolved')}>{data.resolved_at}</Descriptions.Item>
                )}
                {data.resolved_outcome != null && (
                  <Descriptions.Item label={t('disputes.field.resolvedOutcome')}>
                    <Tag>{outcomeLabel(data.resolved_outcome)}</Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {isPending && isContractAdmin ? (
              <Card title={t('disputes.resolve.cardTitle')} size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Alert
                    type="info"
                    showIcon
                    message={t('disputes.resolve.alert.message')}
                    description={
                      <>
                        <b>{t('disputes.resolve.alert.agree')}</b>
                        {' '}
                        {t('disputes.resolve.alert.agreeDesc', {
                          outcome: outcomeLabel(data.claimed_outcome),
                        })}
                        <br />
                        <b>{t('disputes.resolve.alert.dismiss')}</b>
                        {' '}
                        {t('disputes.resolve.alert.dismissDesc')}
                        <br />
                        <b>{t('disputes.resolve.alert.void')}</b>
                        {' '}
                        {t('disputes.resolve.alert.voidDesc')}
                      </>
                    }
                  />
                  <Space wrap>
                    <Button
                      type="primary"
                      loading={adminTx.busy}
                      onClick={() => openResolve(data.claimed_outcome as 1 | 2 | 3)}
                    >
                      {t('disputes.btn.agree', { outcome: outcomeLabel(data.claimed_outcome) })}
                    </Button>
                    {[1, 2, 3]
                      .filter((o) => o !== data.claimed_outcome)
                      .map((o) => (
                        <Button
                          key={o}
                          danger={o !== 3}
                          loading={adminTx.busy}
                          onClick={() => openResolve(o as 1 | 2 | 3)}
                        >
                          {t('disputes.btn.resolve', { outcome: outcomeLabel(o) })}
                        </Button>
                      ))}
                  </Space>
                </Space>
              </Card>
            ) : isPending ? (
              <SignerStatusCard role="admin" compact />
            ) : (
              <Alert
                type="success"
                showIcon
                message={t('disputes.resolvedAlert', { status: statusLabel(data.status) })}
                description={
                  data.resolved_tx_hash
                    ? t('disputes.resolvedAlert.txHash', { hash: data.resolved_tx_hash })
                    : undefined
                }
              />
            )}
          </Space>
        )}
      </Spin>

      <Modal
        title={t('disputes.modal.title', { outcome: outcomeLabel(pendingOutcome) })}
        open={reasonOpen}
        okText={t('disputes.modal.ok')}
        okButtonProps={{ disabled: !reason.trim(), danger: true }}
        onCancel={() => setReasonOpen(false)}
        onOk={submitResolve}
        width={520}
      >
        <Input.TextArea
          rows={4}
          placeholder={t('market.override.reasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          showCount
          style={{ marginBottom: 24 }}
        />
      </Modal>
    </Drawer>
  );
}
