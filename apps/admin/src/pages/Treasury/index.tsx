import { PageContainer } from '@ant-design/pro-components';
import {
  App, Button, Card, Descriptions, Form, Input, InputNumber,
  Space, Spin, Statistic, Tag,
} from 'antd';
import { useIntl, useModel } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { polymindApi } from '@/services/polymind';
import { v3WithdrawPlatformBalance } from '@/wallet/endless';
import { useAdminTx } from '@/hooks/useAdminTx';
import SignerStatusCard from '@/components/SignerStatusCard';

const EDS = 1e8;
const fmtEds = (base: string | number) => (Number(base) / EDS).toFixed(2);

interface WithdrawValues { amount: number; to: string; }

export default function TreasuryPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawForm] = Form.useForm<WithdrawValues>();
  const adminTx = useAdminTx();
  const { isContractDistributor } = useModel('wallet');
  const canMutate = adminTx.canRun && isContractDistributor;

  const reload = useCallback(() => {
    setLoading(true);
    polymindApi
      .getConfig()
      .then((c) => {
        setCfg(c);
        withdrawForm.resetFields();
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [withdrawForm, message]);

  useEffect(() => { reload(); }, [reload]);

  const submitWithdraw = async () => {
    const v = await withdrawForm.validateFields();
    adminTx.run({
      name: t('config.tx.withdraw'),
      call: (addr) =>
        v3WithdrawPlatformBalance(addr, BigInt(Math.round(v.amount * EDS)), v.to),
      confirm: {
        title:   t('config.confirm.withdraw.title', { amount: v.amount, to: v.to.slice(0, 10) }),
        content: t('config.confirm.withdraw.content'),
        danger: true,
      },
      onDone: () => setTimeout(reload, 2000),
    });
  };

  return (
    <PageContainer>
      <Spin spinning={loading}>
        <SignerStatusCard role="distributor" style={{ marginBottom: 16 }} />
        {cfg && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card size="small">
              <Statistic
                title={t('config.treasury.balanceTitle')}
                value={fmtEds(cfg.platform_balance as string)}
                suffix="EDS"
              />
            </Card>

            <Card title={t('config.treasury.withdrawCardTitle')} size="small">
              <Form<WithdrawValues> form={withdrawForm} layout="vertical" disabled={adminTx.busy}>
                <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <Form.Item
                    name="amount"
                    label={t('config.treasury.withdraw.amount.label')}
                    extra={t('config.treasury.withdraw.amount.extra', {
                      max: fmtEds(cfg.platform_balance as string),
                    })}
                    rules={[{ required: true, type: 'number', min: 0.00000001 }]}
                  >
                    <InputNumber min={0} step={0.1} style={{ width: 220 }} />
                  </Form.Item>
                  <Form.Item
                    name="to"
                    label={t('config.treasury.withdraw.to.label')}
                    extra={t('config.treasury.withdraw.to.extra')}
                    rules={[{
                      required: true,
                      message: t('config.treasury.withdraw.to.required'),
                    }]}
                    style={{ minWidth: 380, flex: 1 }}
                  >
                    <Input placeholder="0x… / base58" />
                  </Form.Item>
                </Space>
                <Button danger type="primary" onClick={submitWithdraw} loading={adminTx.busy} disabled={!canMutate}>
                  {t('config.treasury.withdraw.submit')}
                </Button>
              </Form>
            </Card>

            <Card title={t('config.treasury.lookupCardTitle')} size="small">
              <CreatorRewardLookup />
            </Card>
          </Space>
        )}
      </Spin>
    </PageContainer>
  );
}

function CreatorRewardLookup() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ address: string; balance: string } | null>(null);

  const query = async () => {
    const a = addr.trim();
    if (!a) {
      message.warning(t('config.treasury.lookup.required'));
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await polymindApi.creatorRewardBalance(a);
      setResult(r);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space.Compact style={{ width: '100%', maxWidth: 720 }}>
        <Input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder={t('config.treasury.lookup.placeholder')}
          onPressEnter={query}
        />
        <Button type="primary" onClick={query} loading={busy}>{t('config.treasury.lookup.submit')}</Button>
      </Space.Compact>
      {result && (
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label={t('config.treasury.lookup.address')}>
            <span style={{ wordBreak: 'break-all' }}>{result.address}</span>
          </Descriptions.Item>
          <Descriptions.Item label={t('config.treasury.lookup.balance')}>
            <Tag color={Number(result.balance) > 0 ? 'green' : 'default'}>
              {fmtEds(result.balance)} EDS
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      )}
    </Space>
  );
}
