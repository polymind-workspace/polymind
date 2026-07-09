import { PageContainer } from '@ant-design/pro-components';
import {
  Alert, App, Button, Card, DatePicker, Form, Input, InputNumber, Radio, Select, Space, Switch,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { history, useIntl, useModel } from '@umijs/max';
import { useEffect, useState } from 'react';
import { polymindApi } from '@/services/polymind';
import { v3AdminCreateEventWithMarket, v3AdminAddMarket } from '@/wallet/endless';
import { syncEventTx } from '@/wallet/syncEvent';
import { useAdminTx } from '@/hooks/useAdminTx';
import SignerStatusCard from '@/components/SignerStatusCard';
import BatchSignModal, { type SignStep } from '@/components/BatchSignModal';

const EDS = 1e8;

interface MarketFormValues {
  title: string;
  labelYes: string;
  labelNo: string;
  deadline: Dayjs;
  seedSide: 0 | 1;
  seedAmount: number;
}

interface FormValues {
  question: string;
  description: string;
  markets: MarketFormValues[];
  externalSource: number;
  externalMarketId: string;
  externalAuxId: number;
  platformFeeBps: number;
  platformFeeMax: number;
  creatorRewardBps: number;
  creatorRewardMax: number;
  disputeWindowSecs: number;
  adminTimeoutSecs: number;
  creatorProposeTimeoutSecs: number;
  expiredProposeMode: 0 | 1;
  singleSideOnly: boolean;
}

const DEFAULT_MARKET: MarketFormValues = {
  title: '',
  labelYes: 'YES',
  labelNo: 'NO',
  deadline: dayjs().add(7, 'day'),
  seedSide: 0,
  seedAmount: 0,
};

export default function EventCreatePage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [form] = Form.useForm<FormValues>();
  const adminTx = useAdminTx();
  const { isContractCreator } = useModel('wallet');
  const { modal: appModal } = App.useApp();
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchSteps, setBatchSteps] = useState<SignStep[]>([]);

  useEffect(() => {
    polymindApi
      .getConfig()
      .then((c) => {
        form.setFieldsValue({
          platformFeeBps: Number(c.platform_fee_bps ?? 100),
          platformFeeMax: Number(c.platform_fee_max ?? 0) / EDS,
          creatorRewardBps: Number(c.creator_reward_bps ?? 200),
          creatorRewardMax: Number(c.creator_reward_max ?? 0) / EDS,
          disputeWindowSecs: Number(c.dispute_window_secs ?? 86400),
          adminTimeoutSecs: Number(c.admin_timeout_secs ?? 604800),
          creatorProposeTimeoutSecs: Number(c.creator_propose_timeout_secs ?? 259200),
          expiredProposeMode: (Number(c.expired_propose_mode ?? 0) as 0 | 1),
          singleSideOnly: Boolean(c.single_side_only ?? true),
        });
        setDefaultsLoaded(true);
      })
      .catch(() => setDefaultsLoaded(true));
  }, [form]);

  const addMarket = () => {
    const markets = form.getFieldValue('markets') || [];
    form.setFieldsValue({ markets: [...markets, { ...DEFAULT_MARKET }] });
  };

  const removeMarket = (index: number) => {
    const markets = form.getFieldValue('markets') || [];
    if (markets.length <= 1) return;
    form.setFieldsValue({
      markets: markets.filter((_: unknown, i: number) => i !== index),
    });
  };

  const buildSteps = (v: FormValues, markets: MarketFormValues[]): SignStep[] => {
    const first = markets[0];
    const config = {
      externalSource: v.externalSource,
      externalMarketId: v.externalMarketId,
      externalAuxId: v.externalAuxId,
      platformFeeBps: v.platformFeeBps,
      platformFeeMax: BigInt(Math.round(v.platformFeeMax * EDS)),
      creatorRewardBps: v.creatorRewardBps,
      creatorRewardMax: BigInt(Math.round(v.creatorRewardMax * EDS)),
      disputeWindowSecs: v.disputeWindowSecs,
      adminTimeoutSecs: v.adminTimeoutSecs,
      creatorProposeTimeoutSecs: v.creatorProposeTimeoutSecs,
      expiredProposeMode: v.expiredProposeMode,
      singleSideOnly: v.singleSideOnly,
    };

    const steps: SignStep[] = [];
    let eventId: number | undefined;

    // Step 1: Create event + first market
    steps.push({
      title: t('events.create.step.createEvent'),
      description: (
        <div>
          <div><strong>{t('events.create.step.event')}</strong> {v.question}</div>
          <div><strong>{t('events.create.step.market')}</strong> {first.title}</div>
          {markets.length > 1 && (
            <div style={{ marginTop: 8, color: '#666' }}>
              {t('events.create.step.moreMarkets', { count: markets.length - 1 })}
            </div>
          )}
        </div>
      ),
      onSign: async () => {
        const hash = await adminTx.execute({
          name:
            markets.length === 1
              ? t('events.create.tx.name')
              : t('events.create.tx.nameMulti', { count: markets.length }),
          call: (addr) =>
            v3AdminCreateEventWithMarket(addr, {
              question: v.question,
              description: v.description,
              title: first.title,
              labelYes: first.labelYes,
              labelNo: first.labelNo,
              deadline: Math.floor(first.deadline.valueOf() / 1000),
              seedSide: first.seedSide,
              seedAmount: BigInt(Math.round(first.seedAmount * EDS)),
              ...config,
            }),
        });
        const data = await syncEventTx(hash, { source: 'official', description: v.description });
        eventId = data?.onchain_event_id;
        return hash;
      },
    });

    // Steps 2..N: Add remaining markets
    for (let i = 1; i < markets.length; i++) {
      const m = markets[i];
      steps.push({
        title: t('events.create.step.addMarket', { idx: i + 1 }),
        description: (
          <div>
            <div><strong>{t('events.create.step.marketTitle')}</strong> {m.title}</div>
            <div><strong>{t('events.create.step.marketDeadline')}</strong> {m.deadline.format('YYYY-MM-DD HH:mm')}</div>
          </div>
        ),
        onSign: async () => {
          const id = eventId;
          if (!id) throw new Error('Event ID not available');
          const hash = await adminTx.execute({
            name: t('events.create.tx.addMarket', { idx: i, title: m.title }),
            call: (addr) =>
              v3AdminAddMarket(addr, {
                eventId: id,
                title: m.title,
                labelYes: m.labelYes,
                labelNo: m.labelNo,
                deadline: Math.floor(m.deadline.valueOf() / 1000),
                seedSide: m.seedSide,
                seedAmount: BigInt(Math.round(m.seedAmount * EDS)),
                externalSource: config.externalSource,
                externalMarketId: config.externalMarketId,
                externalAuxId: config.externalAuxId,
                platformFeeBps: config.platformFeeBps,
                platformFeeMax: config.platformFeeMax,
                creatorRewardBps: config.creatorRewardBps,
                creatorRewardMax: config.creatorRewardMax,
                disputeWindowSecs: config.disputeWindowSecs,
                adminTimeoutSecs: config.adminTimeoutSecs,
                creatorProposeTimeoutSecs: config.creatorProposeTimeoutSecs,
                expiredProposeMode: config.expiredProposeMode as 0 | 1,
                singleSideOnly: config.singleSideOnly,
              }),
          });
          syncEventTx(hash, { source: 'official' }).catch(() => {});
          return hash;
        },
      });
    }

    return steps;
  };

  const submit = async () => {
    if (batchModalOpen) return;

    const v = await form.validateFields();
    const markets: MarketFormValues[] = v.markets || [];
    if (markets.length === 0) {
      form.setFields([{ name: 'markets', errors: [t('events.create.validate.minMarkets')] }]);
      return;
    }

    // Validate all deadlines
    const now = Math.floor(Date.now() / 1000);
    for (let i = 0; i < markets.length; i++) {
      const d = Math.floor(markets[i].deadline.valueOf() / 1000);
      if (d <= now) {
        form.setFields([{ name: ['markets', i, 'deadline'], errors: [t('field.deadlineFuture')] }]);
        return;
      }
    }

    const steps = buildSteps(v, markets);
    setBatchSteps(steps);
    setBatchModalOpen(true);
  };

  return (
    <PageContainer
      content={
        <Alert
          type="info"
          showIcon
          message={t('events.create.headerTitle')}
          description={t('events.create.headerHint')}
        />
      }
    >
      <SignerStatusCard role="creator" style={{ marginBottom: 16 }} />
      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            markets: [{ ...DEFAULT_MARKET }],
            externalSource: 0,
            externalMarketId: '',
            externalAuxId: 0,
            singleSideOnly: true,
          }}
          disabled={!defaultsLoaded || adminTx.busy || batchModalOpen}
        >
          <h3>{t('events.create.section.event')}</h3>
          <Form.Item name="question" label={t('field.question')} rules={[{ required: true }]}>
            <Input placeholder={t('events.create.field.question.placeholder')} />
          </Form.Item>
          <Form.Item name="description" label={t('field.description')} rules={[{ required: true }]}>
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 16 }} />
          </Form.Item>

          <Form.List name="markets">
            {(fields) => (
              <>
                {fields.map(({ key, name, ...rest }, index) => (
                  <Card
                    key={key}
                    size="small"
                    title={t('events.create.marketTitle', { idx: index + 1 })}
                    extra={
                      fields.length > 1 && (
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => removeMarket(index)}
                        >
                          {t('common.delete')}
                        </Button>
                      )
                    }
                    style={{ marginBottom: 16 }}
                  >
                    <Form.Item {...rest} name={[name, 'title']} label={t('field.title')} rules={[{ required: true }]}>
                      <Input placeholder={t('events.create.field.title.placeholder')} />
                    </Form.Item>
                    <Space size="middle" wrap>
                      <Form.Item {...rest} name={[name, 'labelYes']} label={t('field.labelYes')} rules={[{ required: true }]}>
                        <Input style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'labelNo']} label={t('field.labelNo')} rules={[{ required: true }]}>
                        <Input style={{ width: 160 }} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'deadline']} label={t('field.deadline')} rules={[{ required: true }]}>
                        <DatePicker showTime style={{ width: 240 }} disabledDate={(d) => d.isBefore(dayjs())} />
                      </Form.Item>
                    </Space>
                    <Space size="middle" wrap style={{ marginTop: 12 }}>
                      <Form.Item {...rest} name={[name, 'seedSide']} label={t('field.seedSide')}>
                        <Radio.Group>
                          <Radio.Button value={0}>YES</Radio.Button>
                          <Radio.Button value={1}>NO</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                      <Form.Item {...rest} name={[name, 'seedAmount']} label={t('field.seedAmount')}>
                        <InputNumber min={0} step={0.1} style={{ width: 220 }} />
                      </Form.Item>
                    </Space>
                  </Card>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={addMarket} icon={<PlusOutlined />} block>
                    {t('events.create.btn.addMarket')}
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <h3>{t('events.create.section.external')}</h3>
          <Space size="middle" wrap>
            <Form.Item name="externalSource" label={t('events.create.field.externalSource')}>
              <Select style={{ width: 180 }} options={[
                { value: 0, label: t('events.create.field.externalSource.opt0') },
                { value: 1, label: t('events.create.field.externalSource.opt1') },
                { value: 2, label: t('events.create.field.externalSource.opt2') },
              ]}/>
            </Form.Item>
            <Form.Item name="externalMarketId" label={t('events.create.field.externalMarketId')} style={{ flex: 1 }}>
              <Input placeholder={t('events.create.field.externalMarketId.placeholder')} />
            </Form.Item>
            <Form.Item name="externalAuxId" label={t('events.create.field.externalAuxId')}>
              <InputNumber min={0} style={{ width: 140 }} />
            </Form.Item>
          </Space>

          <h3 style={{ marginTop: 16 }}>{t('events.create.section.config')}</h3>
          <Space size="middle" wrap>
            <Form.Item name="platformFeeBps" label={t('field.platformFeeBps')} rules={[{ required: true }]}>
              <InputNumber min={0} max={10000} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="platformFeeMax" label={t('field.platformFeeMax.noCap')} rules={[{ required: true }]}>
              <InputNumber min={0} step={0.1} style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="creatorRewardBps" label={t('field.creatorRewardBps')} rules={[{ required: true }]}>
              <InputNumber min={0} max={10000} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="creatorRewardMax" label={t('field.creatorRewardMax.noCap')} rules={[{ required: true }]}>
              <InputNumber min={0} step={0.1} style={{ width: 240 }} />
            </Form.Item>
          </Space>
          <Space size="middle" wrap>
            <Form.Item name="disputeWindowSecs" label={t('field.disputeWindowSecs')} rules={[{ required: true }]}>
              <InputNumber min={60} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="adminTimeoutSecs" label={t('field.adminTimeoutSecs')} rules={[{ required: true }]}>
              <InputNumber min={3600} style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="creatorProposeTimeoutSecs" label={t('field.creatorProposeTimeoutSecs')} rules={[{ required: true }]}>
              <InputNumber min={0} style={{ width: 240 }} />
            </Form.Item>
            <Form.Item name="expiredProposeMode" label={t('field.expiredProposeMode')}>
              <Select style={{ width: 220 }} options={[
                { value: 0, label: t('field.expiredProposeMode.opt0') },
                { value: 1, label: t('field.expiredProposeMode.opt1') },
              ]}/>
            </Form.Item>
            <Form.Item name="singleSideOnly" label={t('field.singleSideOnly')} valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>

          <Button
            type="primary"
            onClick={submit}
            loading={adminTx.busy || batchModalOpen}
            disabled={!adminTx.canRun || !isContractCreator}
            style={{ marginTop: 16 }}
          >
            {t('events.create.submit')}
          </Button>
        </Form>
      </Card>

      <BatchSignModal
        open={batchModalOpen}
        steps={batchSteps}
        onDone={() => {
          setBatchModalOpen(false);
          form.resetFields();
          history.push('/events/list');
        }}
        onCancel={({ completed, total }) => {
          if (completed > 0 && completed < total) {
            // 有进度但未完成 —— 提醒用户
            appModal.confirm({
              title: t('events.create.cancelConfirm.title'),
              content: t('events.create.cancelConfirm.content', { completed, total }),
              okText: t('events.create.cancelConfirm.okText'),
              cancelText: t('events.create.cancelConfirm.cancelText'),
              onOk: () => {
                setBatchModalOpen(false);
                history.push('/events/list');
              },
            });
          } else {
            setBatchModalOpen(false);
          }
        }}
      />
    </PageContainer>
  );
}
