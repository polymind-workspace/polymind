import { Alert, Button, Card, DatePicker, Form, Input, InputNumber, Space, Tabs, Typography } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useIntl } from '@umijs/max';
import type { CampaignLangMeta } from '@/services/polymind';

const { Text } = Typography;
export const LANGS = ['en', 'zh'] as const;
export type Lang = (typeof LANGS)[number];

export interface OptRow { en: string; zh: string }
export interface LangCopy {
  title?: string; description?: string; window_label?: string;
  pick_label?: string;
}
export interface CampaignFormValues {
  cid?: string;
  start_time?: Dayjs;
  end_time?: Dayjs;
  min_bet_eds?: number;
  options: OptRow[];
  en: LangCopy;
  zh: LangCopy;
}

export interface OnchainOrig {
  question: string;
  start: number;
  end: number;
  min_bet: number;
  options: string[];
  has_bets: boolean;
}

export const FORM_DEFAULTS = {
  min_bet_eds: 0.1,
  options: [{ en: '', zh: '' }, { en: '', zh: '' }],
  en: {},
  zh: {},
};

export function buildLangs(v: CampaignFormValues): Record<string, CampaignLangMeta> {
  const rows = (v.options || []).filter((o) => o?.en?.trim());
  const en = rows.map((o) => o.en.trim());
  const zh = rows.map((o) => (o.zh?.trim() || o.en.trim()));
  const pack = (l: Lang, labels: string[]): CampaignLangMeta => ({
    title: v[l]?.title || '',
    description: v[l]?.description || '',
    window_label: v[l]?.window_label || '',
    pick_label: v[l]?.pick_label || '',
    option_labels: labels,
  });
  return { en: pack('en', en), zh: pack('zh', zh) };
}

export function CampaignFormFields({
  isEdit, cid, optionsLocked,
}: { isEdit: boolean; cid?: string; optionsLocked?: boolean }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  const langCopy = (l: Lang) => (
    <>
      <Form.Item name={[l, 'title']} label={t('campaigns.field.title')} style={{ marginBottom: 10 }}>
        <Input maxLength={255} placeholder={t('campaigns.ph.title')} />
      </Form.Item>
      <Form.Item name={[l, 'description']} label={t('campaigns.field.description')} style={{ marginBottom: 10 }}>
        <Input.TextArea rows={3} maxLength={600} showCount placeholder={t('campaigns.ph.description')} />
      </Form.Item>
      <Space size="middle" style={{ display: 'flex', flexWrap: 'wrap' }} align="start">
        <Form.Item name={[l, 'window_label']} label={t('campaigns.field.windowLabel')}>
          <Input style={{ width: 220 }} placeholder={t('campaigns.ph.windowLabel')} />
        </Form.Item>
        <Form.Item name={[l, 'pick_label']} label={t('campaigns.field.pickLabel')}>
          <Input style={{ width: 160 }} placeholder={t('campaigns.ph.pickLabel')} />
        </Form.Item>
      </Space>
    </>
  );

  return (
    <>
      <Card title={t('campaigns.section.onchain')} style={{ marginBottom: 16 }}>
        {isEdit && (
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">{t('campaigns.col.cid')}: </Text><Text code>{cid}</Text>
          </div>
        )}
        <Space size="middle" style={{ display: 'flex', flexWrap: 'wrap' }} align="start">
          <Form.Item name="start_time" label={t('campaigns.field.startTime')} rules={[{ required: true }]}>
            <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: 200 }}
              disabledDate={isEdit ? undefined : (d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="end_time" label={t('campaigns.field.endTime')} rules={[{ required: true }]}>
            <DatePicker showTime={{ format: 'HH:mm' }} format="YYYY-MM-DD HH:mm" style={{ width: 200 }}
              disabledDate={isEdit ? undefined : (d) => d.isBefore(dayjs(), 'day')} />
          </Form.Item>
          <Form.Item name="min_bet_eds" label={t('campaigns.field.minBet')} rules={[{ required: true }]}>
            <InputNumber min={0.01} step={1} style={{ width: 140 }} addonAfter="EDS" />
          </Form.Item>
        </Space>
        {isEdit && <Text type="secondary" style={{ fontSize: 12 }}>{t('campaigns.section.onchainEditHint')}</Text>}
      </Card>

      <Card title={t('campaigns.section.options')} style={{ marginBottom: 16 }}>
        {optionsLocked && (
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('campaigns.section.optionsLocked')} />
        )}
        <Space style={{ marginBottom: 8, paddingLeft: 28 }}>
          <Text type="secondary" style={{ width: 240, display: 'inline-block', fontSize: 12 }}>{t('campaigns.field.optEn')}</Text>
          <Text type="secondary" style={{ width: 240, display: 'inline-block', fontSize: 12 }}>{t('campaigns.field.optZh')}</Text>
        </Space>
        <Form.List name="options">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...rest }, i) => (
                <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                  <span style={{ width: 20, color: '#8c8c8c', fontWeight: 600 }}>{i + 1}.</span>
                  <Form.Item {...rest} name={[name, 'en']}
                    rules={[{ required: !isEdit, message: t('campaigns.toast.needOptions') }]} style={{ marginBottom: 0 }}>
                    <Input placeholder="France" style={{ width: 240 }} disabled={optionsLocked} />
                  </Form.Item>
                  <Form.Item {...rest} name={[name, 'zh']} style={{ marginBottom: 0 }}>
                    <Input placeholder="法国" style={{ width: 240 }} />
                  </Form.Item>
                  {fields.length > 2 && !optionsLocked && (
                    <DeleteOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f', cursor: 'pointer' }} />
                  )}
                </Space>
              ))}
              {!optionsLocked && (
                <Button type="dashed" onClick={() => add({ en: '', zh: '' })} icon={<PlusOutlined />}
                  disabled={fields.length >= 20} style={{ marginTop: 4 }}>
                  {t('campaigns.btn.addOption')}
                </Button>
              )}
            </>
          )}
        </Form.List>
      </Card>

      <Card title={t('campaigns.section.display')} style={{ marginBottom: 16 }}>
        <Tabs items={LANGS.map((l) => ({ key: l, label: l.toUpperCase(), children: langCopy(l) }))} />
      </Card>
    </>
  );
}
