import { PageContainer } from '@ant-design/pro-components';
import {
  App, Button, Card, Col, Form, InputNumber, Row, Spin, Switch, Typography,
} from 'antd';
import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { polymindApi } from '@/services/polymind';

const { Text } = Typography;
const EDS = 1e8;

interface ConfigValues {
  reward_bps: number;
  min_claim_eds: number;
  max_per_user: number;
  champion_reward_bps: number;
  lopsided_threshold_pct: number;
  time_progress_pct: number;
  restrict_lopsided: boolean;
}

export default function InviteConfigPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const [form] = Form.useForm<ConfigValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      polymindApi.listDbConfigs('invite.'),
      polymindApi.listDbConfigs('betting.'),
    ])
      .then(([inviteRes, bettingRes]) => {
        if (inviteRes.ret !== 200) {
          message.error(t('invite.config.loadError'));
          return;
        }
        const map: Record<string, unknown> = {};
        (inviteRes.data || []).forEach((c) => { map[c.key] = c.value; });
        (bettingRes.data || []).forEach((c) => { map[c.key] = c.value; });
        form.setFieldsValue({
          reward_bps:      Number(map['invite.reward_bps'] || 40),
          min_claim_eds:   Number(map['invite.min_claim_base'] || 0) / EDS,
          max_per_user:    Number(map['invite.max_per_user'] || 0),
          champion_reward_bps: Number(map['invite.champion_reward_bps'] || 0),
          lopsided_threshold_pct: Number(map['betting.lopsided_threshold_pct'] || 90),
          time_progress_pct:      Number(map['betting.time_progress_pct'] || 60),
          restrict_lopsided:      String(map['betting.restrict_lopsided'] || 'true') === 'true',
        });
      })
      .catch(() => message.error(t('invite.config.loadError')))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { reload(); }, []);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await Promise.all([
        polymindApi.updateConfig('invite.reward_bps', { value: String(v.reward_bps) }),
        polymindApi.updateConfig('invite.min_claim_base', { value: String(Math.round(v.min_claim_eds * EDS)) }),
        polymindApi.updateConfig('invite.max_per_user', { value: String(v.max_per_user) }),
        polymindApi.updateConfig('invite.champion_reward_bps', { value: String(Math.max(0, Math.min(10000, Math.round(v.champion_reward_bps)))) }),
        polymindApi.updateConfig('betting.lopsided_threshold_pct', { value: String(v.lopsided_threshold_pct) }),
        polymindApi.updateConfig('betting.time_progress_pct', { value: String(v.time_progress_pct) }),
        polymindApi.updateConfig('betting.restrict_lopsided', { value: String(v.restrict_lopsided) }),
      ]);
      message.success(t('invite.config.saveSuccess'));
    } catch (e) {
      message.error(t('invite.config.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <Spin spinning={loading}>
        {!loading && (
          <>
            <Card title={t('invite.config.cardTitle')} size="small" style={{ marginBottom: 24 }}>
              <Form<ConfigValues> form={form} layout="vertical" disabled={saving}>
                <Row gutter={24}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="reward_bps"
                      label={t('invite.config.rewardBps.label')}
                      extra={t('invite.config.rewardBps.extra')}
                      rules={[{ required: true, type: 'number', min: 0, max: 10000 }]}
                    >
                      <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="min_claim_eds"
                      label={t('invite.config.minClaimEds.label')}
                      extra={t('invite.config.minClaimEds.extra')}
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber step={0.01} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="max_per_user"
                      label={t('invite.config.maxPerUser.label')}
                      extra={t('invite.config.maxPerUser.extra')}
                      rules={[{ required: true, type: 'number', min: 0 }]}
                    >
                      <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>

            <Card title={t('config.championReward.cardTitle')} size="small" style={{ marginBottom: 24 }}>
              <Form<ConfigValues> form={form} layout="vertical" disabled={saving}>
                <Row gutter={24}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="champion_reward_bps"
                      label={t('config.championReward.bps.label')}
                      extra={t('config.championReward.bps.extra')}
                      rules={[{ required: true, type: 'number', min: 0, max: 10000 }]}
                    >
                      <InputNumber style={{ width: '100%' }} min={0} max={10000} addonAfter="bps" />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>

            <Card title={t('invite.config.betting.cardTitle')} size="small" style={{ marginBottom: 24 }}>
              <Form<ConfigValues> form={form} layout="vertical" disabled={saving}>
                <Row gutter={24}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="lopsided_threshold_pct"
                      label={t('invite.config.betting.thresholdPct.label')}
                      extra={t('invite.config.betting.thresholdPct.extra')}
                      rules={[{ required: true, type: 'number', min: 50, max: 100 }]}
                    >
                      <InputNumber style={{ width: '100%' }} min={50} max={100} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="time_progress_pct"
                      label={t('invite.config.betting.timeProgressPct.label')}
                      extra={t('invite.config.betting.timeProgressPct.extra')}
                      rules={[{ required: true, type: 'number', min: 0, max: 100 }]}
                    >
                      <InputNumber style={{ width: '100%' }} min={0} max={100} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="restrict_lopsided"
                      label={t('invite.config.betting.restrict.label')}
                      extra={t('invite.config.betting.restrict.extra')}
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>

            <div style={{ marginTop: 16 }}>
              <Button type="primary" onClick={submit} loading={saving}>
                {t('invite.config.submit')}
              </Button>
              <Button onClick={reload} disabled={saving} style={{ marginLeft: 12 }}>
                {t('invite.config.reset')}
              </Button>
            </div>
          </>
        )}
      </Spin>
    </PageContainer>
  );
}
