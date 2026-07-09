import { PageContainer } from '@ant-design/pro-components';
import {
  Alert, App, Button, Card, Form, Input, InputNumber, Select,
  Space, Spin, Switch,
} from 'antd';
import { useIntl, useModel } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { polymindApi } from '@/services/polymind';
import {
  v3UpdateConfig,
  v3UpdateDisputeBondAmount,
  v3UpdateDisputeSponsorFlags,
  v3UpdateMarketSponsorFlags,
  v3SetMinBet,
  type MarketSponsorFlags,
} from '@/wallet/endless';
import { useAdminTx } from '@/hooks/useAdminTx';
import SignerStatusCard from '@/components/SignerStatusCard';

const EDS = 1e8;
const fmtEds = (base: string | number) => (Number(base) / EDS).toFixed(2);

interface FormValues {
  creatorSeedMin:            number;
  disputeWindowSecs:         number;
  adminTimeoutSecs:          number;
  platformFeePct:            number;
  platformFeeMax:            number;
  creatorRewardPct:          number;
  creatorRewardMax:          number;
  creatorProposeTimeoutSecs: number;
  expiredProposeMode:        0 | 1;
  singleSideOnly:            boolean;
}
interface DisputeValues  { bondEds: number; sponsorFileDispute: boolean; }
interface BettingValues  { minBetEds: number; }

type TabKey = 'market' | 'dispute' | 'sponsor' | 'betting';

export default function ConfigPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number | boolean>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const [cfg, setCfg] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('market');
  const [form] = Form.useForm<FormValues>();
  const [sponsorForm] = Form.useForm<MarketSponsorFlags>();
  const [disputeForm] = Form.useForm<DisputeValues>();
  const [bettingForm] = Form.useForm<BettingValues>();
  const adminTx = useAdminTx();
  const { isContractAdmin } = useModel('wallet');
  const canMutate = adminTx.canRun && isContractAdmin;

  const reload = useCallback(() => {
    setLoading(true);
    polymindApi.getConfig()
      .then((c) => {
        setCfg(c);
        form.setFieldsValue({
          creatorSeedMin:            Number(c.creator_seed_min || 0) / EDS,
          disputeWindowSecs:         Number(c.dispute_window_secs || 0),
          adminTimeoutSecs:          Number(c.admin_timeout_secs || 0),
          platformFeePct:            Number(c.platform_fee_bps || 0) / 100,
          platformFeeMax:            Number(c.platform_fee_max || 0) / EDS,
          creatorRewardPct:          Number(c.creator_reward_bps || 0) / 100,
          creatorRewardMax:          Number(c.creator_reward_max || 0) / EDS,
          creatorProposeTimeoutSecs: Number(c.creator_propose_timeout_secs || 0),
          expiredProposeMode:        (Number(c.expired_propose_mode || 0) as 0 | 1),
          singleSideOnly:            Boolean(c.single_side_only),
        });
        const sf = (c.sponsor_flags || {}) as Record<string, boolean>;
        sponsorForm.setFieldsValue({
          createEvent:      Boolean(sf.create_event),
          addMarket:        Boolean(sf.add_market),
          bet:              Boolean(sf.bet),
          propose:          Boolean(sf.propose),
          finalize:         Boolean(sf.finalize),
          emergencyVoid:    Boolean(sf.emergency_void),
          expireUnproposed: Boolean(sf.expire_unproposed),
        });
        disputeForm.setFieldsValue({
          bondEds:            Number(c.dispute_bond_amount || 0) / EDS,
          sponsorFileDispute: Boolean(c.sponsor_file_dispute),
        });
        bettingForm.setFieldsValue({
          minBetEds: Number(c.min_bet || 0) / EDS,
        });
      })
      .catch((e: Error) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [form, sponsorForm, disputeForm, bettingForm, message]);

  useEffect(() => { reload(); }, [reload]);

  const submitMarket = async () => {
    const v = await form.validateFields();
    adminTx.run({
      name: t('config.tx.updateMarket'),
      call: (addr) => v3UpdateConfig(addr, {
        creatorSeedMin:    BigInt(Math.round(v.creatorSeedMin * EDS)),
        disputeWindowSecs: v.disputeWindowSecs,
        adminTimeoutSecs:  v.adminTimeoutSecs,
        platformFeeBps:    Math.round(v.platformFeePct * 100),
        platformFeeMax:    BigInt(Math.round(v.platformFeeMax * EDS)),
        creatorRewardBps:  Math.round(v.creatorRewardPct * 100),
        creatorRewardMax:  BigInt(Math.round(v.creatorRewardMax * EDS)),
        creatorProposeTimeoutSecs: v.creatorProposeTimeoutSecs,
        expiredProposeMode: v.expiredProposeMode,
        singleSideOnly:     v.singleSideOnly,
      }),
      confirm: {
        title:   t('config.confirm.market.title'),
        content: t('config.confirm.market.content'),
      },
      onDone: () => [800, 3000, 6000].forEach((ms) => setTimeout(reload, ms)),
    });
  };

  const submitDispute = async () => {
    const v = await disputeForm.validateFields();
    const currentEds = Number(cfg?.dispute_bond_amount || 0) / EDS;
    const currentSponsor = Boolean(cfg?.sponsor_file_dispute);
    const bondChanged = Math.abs(v.bondEds - currentEds) > 1e-9;
    const sponsorChanged = v.sponsorFileDispute !== currentSponsor;
    if (!bondChanged && !sponsorChanged) {
      message.info(t('config.dispute.noChange'));
      return;
    }
    if (bondChanged) {
      adminTx.run({
        name: t('config.tx.updateDisputeBond'),
        call: (addr) => v3UpdateDisputeBondAmount(addr, BigInt(Math.round(v.bondEds * EDS))),
        confirm: { title: t('config.confirm.disputeBond', { amount: v.bondEds }) },
        onDone: () => [800, 3000].forEach((ms) => setTimeout(reload, ms)),
      });
    }
    if (sponsorChanged) {
      adminTx.run({
        name: t('config.tx.updateDisputeSponsor'),
        call: (addr) => v3UpdateDisputeSponsorFlags(addr, v.sponsorFileDispute),
        confirm: {
          title: t(v.sponsorFileDispute
            ? 'config.confirm.disputeSponsor.on'
            : 'config.confirm.disputeSponsor.off'),
        },
        onDone: () => [800, 3000].forEach((ms) => setTimeout(reload, ms)),
      });
    }
  };

  const submitBetting = async () => {
    const v = await bettingForm.validateFields();
    const currentEds = Number(cfg?.min_bet || 0) / EDS;
    if (Math.abs(v.minBetEds - currentEds) < 1e-9) {
      message.info(t('config.betting.noChange'));
      return;
    }
    adminTx.run({
      name: t('config.tx.updateMinBet'),
      call: (addr) => v3SetMinBet(addr, BigInt(Math.round(v.minBetEds * EDS))),
      confirm: { title: t('config.confirm.minBet', { amount: v.minBetEds }) },
      onDone: () => {
        polymindApi.updateConfig('betting.min_bet_eds', { value: String(v.minBetEds) })
          .catch(() => {});
        [800, 3000].forEach((ms) => setTimeout(reload, ms));
      },
    });
  };

  const submitSponsorFlags = async () => {
    const v = await sponsorForm.validateFields();
    adminTx.run({
      name: t('config.tx.updateSponsorFlags'),
      call: (addr) => v3UpdateMarketSponsorFlags(addr, v),
      confirm: { title: t('config.confirm.sponsor.title') },
      onDone: () => [800, 3000].forEach((ms) => setTimeout(reload, ms)),
    });
  };

  return (
    <PageContainer
      content={t('config.subtitle')}
      tabList={[
        { key: 'market',   tab: t('config.tab.market') },
        { key: 'betting',  tab: t('config.tab.betting') },
        { key: 'dispute',  tab: t('config.tab.dispute') },
        { key: 'sponsor',  tab: t('config.tab.sponsor') },
      ]}
      tabActiveKey={tab}
      onTabChange={(k) => setTab(k as TabKey)}
      extra={<Button onClick={reload} disabled={loading}>{t('config.refresh')}</Button>}
    >
      <SignerStatusCard role="admin" style={{ marginBottom: 12 }} />

      <Spin spinning={loading && !cfg}>
        {!loading && !cfg && <Alert type="error" message={t('config.loadError')} />}

        {cfg && tab === 'market' && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card title={t('config.market.cardTitle')} size="small">
              <Form<FormValues> form={form} layout="vertical" disabled={adminTx.busy}>
                <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <Form.Item
                    name="creatorSeedMin"
                    label={t('config.market.creatorSeedMin.label')}
                    extra={t('config.market.creatorSeedMin.extra')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} step={0.1} style={{ width: 220 }} />
                  </Form.Item>

                  <Form.Item
                    name="disputeWindowSecs"
                    label={t('config.market.disputeWindowSecs.label')}
                    extra={t('config.market.disputeWindowSecs.extra')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={60} style={{ width: 220 }} />
                  </Form.Item>

                  <Form.Item
                    name="adminTimeoutSecs"
                    label={t('config.market.adminTimeoutSecs.label')}
                    extra={t('config.market.adminTimeoutSecs.extra')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={3600} style={{ width: 220 }} />
                  </Form.Item>
                </Space>

                <Space size="large" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 8 }}>
                  <Form.Item
                    name="platformFeePct"
                    label={t('config.market.platformFeePct.label')}
                    extra={t('config.market.platformFeePct.extra')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} max={100} step={0.5} style={{ width: 200 }} />
                  </Form.Item>

                  <Form.Item
                    name="platformFeeMax"
                    label={t('config.market.platformFeeMax.label')}
                    extra={t('config.market.platformFeeMax.extra')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} step={0.1} style={{ width: 200 }} />
                  </Form.Item>

                  <Form.Item
                    name="creatorRewardPct"
                    label={t('config.market.creatorRewardPct.label')}
                    extra={t('config.market.creatorRewardPct.extra')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} max={100} step={0.5} style={{ width: 200 }} />
                  </Form.Item>

                  <Form.Item
                    name="creatorRewardMax"
                    label={t('config.market.creatorRewardMax.label')}
                    extra={t('config.market.creatorRewardMax.extra')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} step={0.1} style={{ width: 200 }} />
                  </Form.Item>
                </Space>

                <Space size="large" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 8 }}>
                  <Form.Item
                    name="creatorProposeTimeoutSecs"
                    label={t('config.market.creatorProposeTimeoutSecs.label')}
                    extra={t('config.market.creatorProposeTimeoutSecs.extra')}
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={0} style={{ width: 240 }} />
                  </Form.Item>

                  <Form.Item
                    name="expiredProposeMode"
                    label={t('config.market.expiredProposeMode.label')}
                    extra={t('config.market.expiredProposeMode.extra')}
                    rules={[{ required: true }]}
                  >
                    <Select style={{ width: 280 }} options={[
                      { value: 0, label: t('config.market.expiredProposeMode.opt0') },
                      { value: 1, label: t('config.market.expiredProposeMode.opt1') },
                    ]} />
                  </Form.Item>

                  <Form.Item
                    name="singleSideOnly"
                    label={t('config.market.singleSideOnly.label')}
                    extra={t('config.market.singleSideOnly.extra')}
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Space>

                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" onClick={submitMarket} loading={adminTx.busy} disabled={!canMutate}>
                    {t('config.submit')}
                  </Button>
                  <Button onClick={reload} disabled={adminTx.busy}>{t('config.reset')}</Button>
                </Space>
              </Form>
            </Card>
          </Space>
        )}

        {cfg && tab === 'betting' && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card title={t('config.betting.cardTitle')} size="small">
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={t('config.betting.summary', { amount: fmtEds(cfg.min_bet as string) })}
              />
              <Form<BettingValues> form={bettingForm} layout="vertical" disabled={adminTx.busy}>
                <Form.Item
                  name="minBetEds"
                  label={t('config.betting.minBetEds.label')}
                  extra={t('config.betting.minBetEds.extra')}
                  rules={[{ required: true, type: 'number', min: 0.00000001 }]}
                >
                  <InputNumber min={0} step={0.1} style={{ width: 240 }} addonAfter="EDS" />
                </Form.Item>
                <Space style={{ marginTop: 16 }}>
                  <Button type="primary" onClick={submitBetting} loading={adminTx.busy} disabled={!canMutate}>
                    {t('config.submitChanges')}
                  </Button>
                  <Button onClick={reload} disabled={adminTx.busy}>{t('config.reset')}</Button>
                </Space>
              </Form>
            </Card>
          </Space>
        )}

        {cfg && tab === 'dispute' && (
          <Card title={t('config.dispute.cardTitle')} size="small">
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('config.dispute.summary', {
                bond: fmtEds(cfg.dispute_bond_amount as string),
                sponsor: t(cfg.sponsor_file_dispute ? 'config.dispute.sponsor.on' : 'config.dispute.sponsor.off'),
              })}
            />
            <Form<DisputeValues> form={disputeForm} layout="vertical" disabled={adminTx.busy}>
              <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
                <Form.Item
                  name="bondEds"
                  label={t('config.dispute.bondEds.label')}
                  extra={t('config.dispute.bondEds.extra')}
                  rules={[{ required: true, type: 'number', min: 0.00000001 }]}
                >
                  <InputNumber min={0} step={0.1} style={{ width: 240 }} />
                </Form.Item>
                <Form.Item
                  name="sponsorFileDispute"
                  label={t('config.dispute.sponsor.label')}
                  extra={t('config.dispute.sponsor.extra')}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
              </Space>
              <Space style={{ marginTop: 16 }}>
                <Button type="primary" onClick={submitDispute} loading={adminTx.busy} disabled={!canMutate}>
                  {t('config.submitChanges')}
                </Button>
                <Button onClick={reload} disabled={adminTx.busy}>{t('config.reset')}</Button>
              </Space>
            </Form>
          </Card>
        )}

        {cfg && tab === 'sponsor' && (
          <Card title={t('config.sponsor.cardTitle')} size="small">
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('config.sponsor.intro')}
            />
            <Form<MarketSponsorFlags> form={sponsorForm} layout="vertical" disabled={adminTx.busy}>
              <Space size="large" wrap style={{ rowGap: 8 }}>
                <Form.Item name="createEvent"      label={t('config.sponsor.createEvent')}      valuePropName="checked" style={{ marginBottom: 0 }}><Switch /></Form.Item>
                <Form.Item name="addMarket"        label={t('config.sponsor.addMarket')}        valuePropName="checked" style={{ marginBottom: 0 }}><Switch /></Form.Item>
                <Form.Item name="bet"              label={t('config.sponsor.bet')}              valuePropName="checked" style={{ marginBottom: 0 }}><Switch /></Form.Item>
                <Form.Item name="propose"          label={t('config.sponsor.propose')}          valuePropName="checked" style={{ marginBottom: 0 }}><Switch /></Form.Item>
                <Form.Item name="finalize"         label={t('config.sponsor.finalize')}         valuePropName="checked" style={{ marginBottom: 0 }}><Switch /></Form.Item>
                <Form.Item name="emergencyVoid"    label={t('config.sponsor.emergencyVoid')}    valuePropName="checked" style={{ marginBottom: 0 }}><Switch /></Form.Item>
                <Form.Item name="expireUnproposed" label={t('config.sponsor.expireUnproposed')} valuePropName="checked" style={{ marginBottom: 0 }}><Switch /></Form.Item>
              </Space>
            </Form>
            <Space style={{ marginTop: 20 }}>
              <Button type="primary" onClick={submitSponsorFlags} loading={adminTx.busy} disabled={!canMutate}>
                {t('config.submit')}
              </Button>
              <Button onClick={reload} disabled={adminTx.busy}>{t('config.reset')}</Button>
            </Space>
          </Card>
        )}

      </Spin>
    </PageContainer>
  );
}
