import { PageContainer } from '@ant-design/pro-components';
import { Alert, App, Button, Descriptions, Form, Modal, Tag, Typography } from 'antd';
import type { Dayjs } from 'dayjs';
import { history, useIntl, useModel } from '@umijs/max';
import { useState } from 'react';
import { polymindApi } from '@/services/polymind';
import { championCreateCampaign } from '@/wallet/endless';
import { useChampionTx } from '@/hooks/useChampionTx';
import SignerStatusCard from '@/components/SignerStatusCard';
import { generateSlug } from '@/utils/slug';
import {
  buildLangs, CampaignFormFields, FORM_DEFAULTS, LANGS, type CampaignFormValues,
} from '@/pages/Campaigns/form';

const { Text, Link } = Typography;
const EDS = 1e8;

export default function CampaignCreatePage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const { championContractAddr, isChampionAdmin } = useModel('wallet');
  const championTx = useChampionTx();
  const [form] = Form.useForm<CampaignFormValues>();
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<{ v: CampaignFormValues; options: string[]; cid: string } | null>(null);
  const [result, setResult] = useState<{ cid: string; share_urls: Record<string, string> } | null>(null);

  const openConfirm = async () => {
    let v: CampaignFormValues;
    try { v = await form.validateFields(); } catch { return; }
    const targetCid = (v.cid || '').trim() || generateSlug(v.en?.title || '');
    const options = (v.options || []).map((o) => o?.en?.trim()).filter(Boolean) as string[];
    if (options.length < 2) { message.error(t('campaigns.toast.needOptions')); return; }
    if (new Set(options).size !== options.length) { message.error(t('campaigns.toast.dupOptions')); return; }
    const now = Math.floor(Date.now() / 1000);
    const start = v.start_time ? Math.floor(v.start_time.valueOf() / 1000) : 0;
    const end = v.end_time ? Math.floor(v.end_time.valueOf() / 1000) : 0;
    if (!start || start <= now) { form.setFields([{ name: 'start_time', errors: [t('campaigns.toast.startFuture')] }]); return; }
    if (end <= start) { form.setFields([{ name: 'end_time', errors: [t('campaigns.toast.badWindow')] }]); return; }
    if (!v.min_bet_eds || v.min_bet_eds <= 0) { message.error(t('campaigns.toast.badMinBet')); return; }
    setPreview({ v, options, cid: targetCid });
    setConfirm(true);
  };

  const create = async () => {
    if (!preview) return;
    const { v, options, cid: targetCid } = preview;
    setConfirm(false);
    await championTx.run({
      name: 'create_campaign',
      call: (addr) => championCreateCampaign(addr, {
        slug: targetCid,
        question: v.en?.title || targetCid,
        options,
        startTime: Math.floor((v.start_time as Dayjs).valueOf() / 1000),
        endTime: Math.floor((v.end_time as Dayjs).valueOf() / 1000),
        minBetBase: BigInt(Math.round((v.min_bet_eds || 0) * EDS)),
      }),
      onDone: async () => {
        try {
          const d = await polymindApi.upsertCampaignMeta(targetCid, buildLangs(v));
          setResult({ cid: targetCid, share_urls: d.share_urls });
        } catch (e) {
          message.error((e as Error).message || t('campaigns.toast.saveFailed'));
        }
      },
    });
  };

  return (
    <PageContainer header={{ title: t('campaigns.modal.new'), onBack: () => history.push('/workspace/campaigns') }}>
      <SignerStatusCard role="champion" style={{ marginBottom: 16 }} />

      <Form form={form} layout="vertical" disabled={championTx.busy} initialValues={FORM_DEFAULTS}>
        <CampaignFormFields isEdit={false} />
        <Button type="primary" loading={championTx.busy} disabled={!championTx.canRun || !isChampionAdmin}
          title={!championTx.canRun || !isChampionAdmin ? t('campaigns.onchain.connectHint') : undefined} onClick={openConfirm}>
          {t('campaigns.btn.review')}
        </Button>
      </Form>

      {result && (
        <Alert
          style={{ marginTop: 24 }} type="success" showIcon
          message={t('campaigns.toast.created')}
          description={
            <div>
              <div><Text strong>{t('campaigns.col.cid')}:</Text> <Text code>{result.cid}</Text></div>
              {LANGS.map((l) => (
                <div key={l}>
                  <Text strong>{l.toUpperCase()}:</Text>{' '}
                  <Link href={result.share_urls[l]} target="_blank">{result.share_urls[l]}</Link>
                </div>
              ))}
              <Button size="small" style={{ marginTop: 12 }} onClick={() => history.push('/workspace/campaigns')}>
                {t('campaigns.btn.viewAll')}
              </Button>
            </div>
          }
        />
      )}

      {preview && (
        <Modal
          open={confirm}
          title={t('campaigns.confirm.title')}
          okText={t('campaigns.btn.createOnchain')}
          onOk={create}
          onCancel={() => setConfirm(false)}
          confirmLoading={championTx.busy}
          width={520}
        >
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label={t('campaigns.field.cid')}><Text code>{preview.cid}</Text></Descriptions.Item>
            <Descriptions.Item label={t('campaigns.field.title')}>{preview.v.en?.title || '—'}</Descriptions.Item>
            <Descriptions.Item label={t('campaigns.field.startTime')}>{preview.v.start_time?.format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label={t('campaigns.field.endTime')}>{preview.v.end_time?.format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label={t('campaigns.field.minBet')}>{preview.v.min_bet_eds} EDS</Descriptions.Item>
            <Descriptions.Item label={t('campaigns.section.options')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {preview.options.map((a, i) => <Tag key={a}>{i + 1}. {a}</Tag>)}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label={t('campaigns.field.contract')}>
              <Text code style={{ fontSize: 11 }}>{championContractAddr || '—'}</Text>
            </Descriptions.Item>
          </Descriptions>
        </Modal>
      )}
    </PageContainer>
  );
}