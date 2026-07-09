import { App, Button, Drawer, Form } from 'antd';
import dayjs from 'dayjs';
import { useIntl, useModel } from '@umijs/max';
import { useEffect, useState } from 'react';
import { polymindApi } from '@/services/polymind';
import {
  championUpdateEndTime, championUpdateMinBet, championUpdateOptions,
  championUpdateQuestion, championUpdateStartTime,
} from '@/wallet/endless';
import { useChampionTx } from '@/hooks/useChampionTx';
import { parseTxError } from '@/wallet/txError';
import SignerStatusCard from '@/components/SignerStatusCard';
import {
  buildLangs, CampaignFormFields, FORM_DEFAULTS,
  type CampaignFormValues, type OnchainOrig, type OptRow,
} from '@/pages/Campaigns/form';

const EDS = 1e8;

interface Props {
  open: boolean;
  cid: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function CampaignEditDrawer({ open, cid, onClose, onSaved }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const { championContractAddr } = useModel('wallet');
  const championTx = useChampionTx();
  const [form] = Form.useForm<CampaignFormValues>();
  const [saving, setSaving] = useState(false);
  const [orig, setOrig] = useState<OnchainOrig | null>(null);

  useEffect(() => {
    if (!open || !cid) return;
    form.resetFields();
    setOrig(null);
    polymindApi.getCampaign(cid).then((d) => {
      const en = d.meta.en, zh = d.meta.zh, oc = d.onchain;
      const enLabels = en?.option_labels || [];
      const zhLabels = zh?.option_labels || [];
      const n = Math.max(enLabels.length, zhLabels.length, 2);
      const options: OptRow[] = Array.from({ length: n }, (_, i) => ({ en: enLabels[i] || '', zh: zhLabels[i] || '' }));
      form.setFieldsValue({
        cid,
        options,
        start_time: oc.start_time ? dayjs(oc.start_time * 1000) : undefined,
        end_time: oc.end_time ? dayjs(oc.end_time * 1000) : undefined,
        min_bet_eds: oc.min_bet_eds || undefined,
        en: en ? { ...en } : {},
        zh: zh ? { ...zh } : {},
      });
      setOrig({
        question: oc.question || en?.title || '',
        start: oc.start_time || 0,
        end: oc.end_time || 0,
        min_bet: oc.min_bet_eds || 0,
        options: enLabels.filter(Boolean),
        has_bets: oc.has_bets,
      });
    }).catch(() => {});
  }, [open, cid, form]);

  const runChainOps = async (ops: Array<{ label: string; fn: (addr: string) => Promise<string> }>) => {
    for (const op of ops) {
      try {
        const hash = await op.fn(championContractAddr);
        message.success(`${op.label}: ${hash.slice(0, 10)}…`);
      } catch (e) {
        if (/reject|cancel|denied/i.test((e as Error).message || '')) throw new Error('cancelled');
        throw new Error(parseTxError(e));
      }
    }
  };

  const save = async () => {
    if (!cid) return;
    let v: CampaignFormValues;
    try { v = await form.validateFields(); } catch { return; }
    const langs = buildLangs(v);
    const ops: Array<{ label: string; fn: (addr: string) => Promise<string> }> = [];
    if (orig) {
      const enTitle = (v.en?.title || '').trim();
      if (enTitle && enTitle !== orig.question)
        ops.push({ label: 'update_question', fn: (a) => championUpdateQuestion(a, cid, enTitle) });
      const ns = v.start_time ? Math.floor(v.start_time.valueOf() / 1000) : 0;
      const ne = v.end_time ? Math.floor(v.end_time.valueOf() / 1000) : 0;
      if (ns && ns !== orig.start) ops.push({ label: 'update_start_time', fn: (a) => championUpdateStartTime(a, cid, ns) });
      if (ne && ne !== orig.end) ops.push({ label: 'update_end_time', fn: (a) => championUpdateEndTime(a, cid, ne) });
      const nmb = v.min_bet_eds || 0;
      if (nmb > 0 && nmb !== orig.min_bet)
        ops.push({ label: 'update_min_bet', fn: (a) => championUpdateMinBet(a, cid, BigInt(Math.round(nmb * EDS))) });
      const newOpts = (v.options || []).map((o) => o?.en?.trim()).filter(Boolean) as string[];
      if (!orig.has_bets && newOpts.length >= 2 && JSON.stringify(newOpts) !== JSON.stringify(orig.options))
        ops.push({ label: 'update_options', fn: (a) => championUpdateOptions(a, cid, newOpts) });
    }

    setSaving(true);
    try {
      if (ops.length) {
        if (!championContractAddr) { message.error(t('campaigns.onchain.notConfigured')); return; }
        await runChainOps(ops);
      }
      await polymindApi.upsertCampaignMeta(cid, langs);
      message.success(t('campaigns.toast.saved'));
      onSaved();
    } catch (e) {
      if ((e as Error).message !== 'cancelled') message.error((e as Error).message || t('campaigns.toast.saveFailed'));
    } finally { setSaving(false); }
  };

  const busy = saving || championTx.busy;

  return (
    <Drawer
      title={t('campaigns.modal.edit')}
      open={open}
      onClose={onClose}
      width={720}
      destroyOnHidden
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button type="primary" loading={busy} disabled={!championTx.canRun} onClick={save}>
            {t('campaigns.btn.saveUpdate')}
          </Button>
        </div>
      }
    >
      <SignerStatusCard role="champion" style={{ marginBottom: 16 }} />
      <Form form={form} layout="vertical" disabled={busy} initialValues={FORM_DEFAULTS}>
        <CampaignFormFields isEdit cid={cid ?? ''} optionsLocked={!!orig?.has_bets} />
      </Form>
    </Drawer>
  );
}