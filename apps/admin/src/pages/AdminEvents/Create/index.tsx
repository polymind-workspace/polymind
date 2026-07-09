import { PageContainer } from '@ant-design/pro-components';
import {
  Alert, App, Button, Card, DatePicker, Descriptions, Form, Input,
  InputNumber, Modal, Space, Tag, Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { history, useIntl, useModel } from '@umijs/max';
import { useState } from 'react';
import { polymindApi } from '@/services/polymind';
import { adminEventCreate} from '@/wallet/endless';
import { useAdminEventTx } from '@/hooks/useAdminEventTx';
import SignerStatusCard from '@/components/SignerStatusCard';
import { generateSlug } from '@/utils/slug';

const { Text, Link } = Typography;

interface FormValues {
  question:    string;
  slug:        string;
  start_time:  Dayjs;
  end_time:    Dayjs;
  min_bet_eds: number;
  prize_eds:   number;
  answers:     Array<{ text: string }>;
}

export default function AdminEventCreatePage() {
  const { message } = App.useApp();
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const adminEventTx = useAdminEventTx();
  const { adminEventContractAddr } = useModel('wallet');
  const [form]    = Form.useForm<FormValues>();
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<{
    values: FormValues; answers: string[]; slug: string;
  } | null>(null);
  const [result, setResult] = useState<{ slug: string; h5_url: string; tx_hash: string } | null>(null);

  const openConfirm = async () => {
    let v: FormValues;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }

    const now      = Math.floor(Date.now() / 1000);
    const startSec = Math.floor(v.start_time.valueOf() / 1000);
    const endSec   = Math.floor(v.end_time.valueOf()   / 1000);

    if (startSec <= now) {
      form.setFields([{ name: 'start_time', errors: [t('adminEvents.create.validate.startFuture')] }]);
      return;
    }
    if (endSec <= startSec) {
      form.setFields([{ name: 'end_time', errors: [t('adminEvents.create.validate.endAfterStart')] }]);
      return;
    }

    const answers = (v.answers || []).map(a => a?.text?.trim()).filter((a): a is string => Boolean(a));
    if (answers.length < 2) {
      message.error(t('adminEvents.create.validate.minAnswers'));
      return;
    }
    const dupes = answers.filter((a, i) => answers.indexOf(a) !== i);
    if (dupes.length > 0) {
      message.error(intl.formatMessage(
        { id: 'adminEvents.create.validate.duplicate' },
        { list: [...new Set(dupes)].join(', ') },
      ));
      return;
    }

    const slug = v.slug?.trim() || generateSlug(v.question);
    setPreview({ values: v, answers, slug });
    setConfirm(true);
  };

  const submit = async () => {
    if (!preview) return;
    const { values: v, answers, slug } = preview;
    setConfirm(false);

    const startSec    = Math.floor(v.start_time.valueOf() / 1000);
    const endSec      = Math.floor(v.end_time.valueOf()   / 1000);
    const minBetBase  = BigInt(Math.round((v.min_bet_eds || 0) * 1e8));
    const prizeBase   = BigInt(Math.round((v.prize_eds   || 1) * 1e8));

    adminEventTx.run({
      name: t('adminEvents.create.tx.name'),
      call: (contractAddr) =>
        adminEventCreate(contractAddr, {
          slug,
          question:   v.question.trim(),
          answers,
          startTime:  startSec,
          endTime:    endSec,
          minBetBase,
          prizeBase,
        }),
      onDone: async (hash) => {
        try {
          const res = await polymindApi.createAdminEvent({
            tx_hash:    hash,
            slug,
            question:   v.question.trim(),
            answers,
            start_time: startSec,
            end_time:   endSec,
            min_bet_eds: v.min_bet_eds || 0,
            prize_eds:   v.prize_eds   || 1,
          });
          form.resetFields();
          setResult(res);
        } catch (err: unknown) {
          message.error(intl.formatMessage(
            { id: 'adminEvents.create.toast.dbSyncFailed' },
            { error: err instanceof Error ? err.message : String(err) },
          ));
        }
      },
    });
  };

  return (
    <PageContainer>
      <SignerStatusCard role="adminevent" style={{ marginBottom: 16 }} />

      <Card>
        <Form
          form={form}
          layout="vertical"
          disabled={adminEventTx.busy}
          initialValues={{ min_bet_eds: 0, prize_eds: 10, answers: [{ text: '' }, { text: '' }] }}
        >
          <h3 style={{ marginBottom: 16 }}>{t('adminEvents.create.section.event')}</h3>

          <Form.Item
            name="question"
            label={t('adminEvents.create.label.question')}
            rules={[{ required: true, message: t('adminEvents.create.question.required') }]}
          >
            <Input placeholder={t('adminEvents.create.ph.question')} />
          </Form.Item>

          <Form.Item name="slug" label={t('adminEvents.create.label.slug')}>
            <Input placeholder={t('adminEvents.create.ph.slug')} style={{ maxWidth: 360 }} />
          </Form.Item>

          <Space size="middle" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item
              name="start_time"
              label={t('adminEvents.create.label.bettingOpens')}
              rules={[{ required: true, message: t('adminEvents.create.required') }]}
            >
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                style={{ width: 200 }}
                disabledDate={(d) => d.isBefore(dayjs(), 'day')}
                placeholder={t('adminEvents.create.ph.datetime')}
              />
            </Form.Item>
            <Form.Item
              name="end_time"
              label={t('adminEvents.create.label.bettingCloses')}
              rules={[{ required: true, message: t('adminEvents.create.required') }]}
            >
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                style={{ width: 200 }}
                disabledDate={(d) => d.isBefore(dayjs(), 'day')}
                placeholder={t('adminEvents.create.ph.datetime')}
              />
            </Form.Item>
            <Form.Item name="min_bet_eds" label={t('adminEvents.create.label.minBet')}>
              <InputNumber min={0} step={0.01} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="prize_eds" label={t('adminEvents.create.label.prize')} rules={[{ required: true }]}>
              <InputNumber min={0.01} step={1} style={{ width: 140 }} />
            </Form.Item>
          </Space>

          <h3 style={{ marginBottom: 12 }}>{t('adminEvents.create.section.answers')}</h3>
          <Form.List name="answers">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }, i) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <span style={{ width: 24, color: '#8c8c8c', fontWeight: 600 }}>
                      {String.fromCharCode(65 + i)}.
                    </span>
                    <Form.Item
                      {...rest}
                      name={[name, 'text']}
                      rules={[{ required: true, message: t('adminEvents.create.required') }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder={t('adminEvents.create.ph.answer')} style={{ width: 300 }} />
                    </Form.Item>
                    {fields.length > 2 && (
                      <DeleteOutlined
                        onClick={() => remove(name)}
                        style={{ color: '#ff4d4f', cursor: 'pointer' }}
                      />
                    )}
                  </Space>
                ))}
                <Form.Item style={{ marginTop: 4 }}>
                  <Button
                    type="dashed"
                    onClick={() => add({ text: '' })}
                    icon={<PlusOutlined />}
                    disabled={fields.length >= 8}
                  >
                    {t('adminEvents.create.btn.addAnswer')}
                  </Button>
                </Form.Item>
              </>
            )}
          </Form.List>

          <Button
            type="primary"
            onClick={openConfirm}
            loading={adminEventTx.busy}
            disabled={!adminEventTx.canRun}
            style={{ marginTop: 8 }}
            title={!adminEventTx.canRun ? t('adminEvents.create.tip.connectWallet') : undefined}
          >
            {t('adminEvents.create.btn.review')}
          </Button>
        </Form>

        {result && (
          <Alert
            style={{ marginTop: 24 }}
            type="success"
            showIcon
            message={t('adminEvents.create.result.success')}
            description={
              <div>
                <div><Text strong>{t('adminEvents.create.label.slugShort')}:</Text> <Text code>{result.slug}</Text></div>
                <div>
                  <Text strong>{t('adminEvents.create.label.h5url')}:</Text>{' '}
                  <Link href={result.h5_url} target="_blank">{result.h5_url}</Link>
                </div>
                <div><Text strong>{t('adminEvents.create.label.txhash')}:</Text> <Text code copyable>{result.tx_hash}</Text></div>
                <Button size="small" style={{ marginTop: 12 }} onClick={() => history.push('/workspace/admin-events')}>
                  {t('adminEvents.create.btn.viewAll')}
                </Button>
              </div>
            }
          />
        )}
      </Card>

      {preview && (
        <Modal
          open={confirm}
          title={t('adminEvents.create.confirm.title')}
          okText={t('adminEvents.create.confirm.ok')}
          onOk={submit}
          onCancel={() => setConfirm(false)}
          confirmLoading={adminEventTx.busy}
          width={520}
        >
          <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label={t('adminEvents.create.label.question')}>{preview.values.question}</Descriptions.Item>
            <Descriptions.Item label={t('adminEvents.create.label.slugShort')}><Text code>{preview.slug}</Text></Descriptions.Item>
            <Descriptions.Item label={t('adminEvents.create.label.bettingOpens')}>
              {preview.values.start_time.format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label={t('adminEvents.create.label.bettingCloses')}>
              {preview.values.end_time.format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label={t('adminEvents.create.label.prizeShort')}>{preview.values.prize_eds} EDS</Descriptions.Item>
            {preview.values.min_bet_eds > 0 && (
              <Descriptions.Item label={t('adminEvents.create.label.minBetShort')}>{preview.values.min_bet_eds} EDS</Descriptions.Item>
            )}
            <Descriptions.Item label={t('adminEvents.create.section.answers')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {preview.answers.map((a, i) => (
                  <Tag key={a}>{String.fromCharCode(65 + i)}. {a}</Tag>
                ))}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label={t('adminEvents.create.label.contract')}>
              <Text code style={{ fontSize: 11 }}>{adminEventContractAddr}</Text>
            </Descriptions.Item>
          </Descriptions>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {intl.formatMessage(
              { id: 'adminEvents.create.confirm.depositNote' },
              { amount: <strong>{preview.values.prize_eds} EDS</strong> },
            )}
          </Text>
        </Modal>
      )}
    </PageContainer>
  );
}
