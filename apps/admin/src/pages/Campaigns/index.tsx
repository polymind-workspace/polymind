import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import {
  Alert, App, Button, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Tabs, Tag, Typography,
} from 'antd';
import {
  CopyOutlined, EyeInvisibleOutlined, EyeOutlined,
  FlagOutlined, LinkOutlined, PlusOutlined, StopOutlined,
} from '@ant-design/icons';
import { history, useIntl, useModel } from '@umijs/max';
import { useMemo, useRef, useState } from 'react';
import { polymindApi, type CampaignListItem } from '@/services/polymind';
import { championCancel, championFinalize } from '@/wallet/endless';
import { useChampionTx } from '@/hooks/useChampionTx';
import SignerStatusCard from '@/components/SignerStatusCard';
import ParticipantsDrawer from '@/components/ParticipantsDrawer';
import CampaignEditDrawer from '@/components/CampaignEditDrawer';
import { formatDate } from '@/utils/format';

const { Text } = Typography;

const LANGS = ['en', 'zh'] as const;
type Lang = (typeof LANGS)[number];
const EDS = 1e8;
const STATUS_COLOR: Record<string, string> = {
  draft: 'default', betting: 'green', settled: 'blue', cancelled: 'volcano',
};

function FinalizeDrawer({
  open, row, onClose, onDone,
}: { open: boolean; row: CampaignListItem | null; onClose: () => void; onDone: () => void }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const championTx = useChampionTx();
  const { isChampionAdmin } = useModel('wallet');
  const [labels, setLabels] = useState<string[]>([]);
  const [winning, setWinning] = useState<number | undefined>(undefined);
  const [prize, setPrize] = useState<number>(0);

  const onAfterOpen = async (isOpen: boolean) => {
    if (!isOpen || !row) return;
    setWinning(undefined); setPrize(0); setLabels([]);
    try {
      const d = await polymindApi.getCampaign(row.campaign_id);
      const en = d.meta.en?.option_labels?.length ? d.meta.en.option_labels : d.meta.zh?.option_labels || [];
      setLabels(en);
    } catch { }
  };

  const submit = async () => {
    if (!row || winning == null) return;
    await championTx.run({
      name: 'finalize_campaign',
      call: (addr) => championFinalize(addr, {
        slug: row.campaign_id,
        winningOption: winning,
        prizeBase: BigInt(Math.round((prize || 0) * EDS)),
      }),
      onDone,
    });
  };

  const opts = (labels.length ? labels : Array.from({ length: row?.option_count || 0 }, (_, i) => `Option ${i + 1}`))
    .map((name, idx) => ({ label: `${idx + 1}. ${name}`, value: idx }));

  return (
    <Drawer
      title={t('campaigns.modal.finalize')}
      open={open}
      onClose={onClose}
      width={560}
      destroyOnHidden
      afterOpenChange={onAfterOpen}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button type="primary" loading={championTx.busy}
            disabled={!championTx.canRun || !isChampionAdmin || winning == null} onClick={submit}>
            {t('campaigns.btn.finalize')}
          </Button>
        </div>
      }
    >
      <SignerStatusCard role="champion" style={{ marginBottom: 12 }} />
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        {t('campaigns.finalize.hint')}
      </Typography.Paragraph>
      <Form layout="vertical">
        <Form.Item label={t('campaigns.field.winningOption')} required>
          <Select placeholder={t('campaigns.field.winningOptionPlaceholder')} options={opts}
            value={winning} onChange={setWinning} />
        </Form.Item>
        <Form.Item label={t('campaigns.field.prize')} extra={t('campaigns.field.prizeHint')}>
          <InputNumber min={0} step={100} style={{ width: '100%' }} addonAfter="EDS"
            value={prize} onChange={(v) => setPrize(Number(v) || 0)} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

function CancelDrawer({
  open, row, onClose, onDone,
}: { open: boolean; row: CampaignListItem | null; onClose: () => void; onDone: () => void }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const championTx = useChampionTx();
  const { isChampionAdmin } = useModel('wallet');

  const submit = async () => {
    if (!row) return;
    await championTx.run({ name: 'cancel_campaign', call: (addr) => championCancel(addr, row.campaign_id), onDone });
  };

  return (
    <Drawer
      title={t('campaigns.btn.cancel')}
      open={open}
      onClose={onClose}
      width={560}
      destroyOnHidden
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button danger type="primary" loading={championTx.busy} disabled={!championTx.canRun || !isChampionAdmin} onClick={submit}>
            {t('campaigns.btn.cancel')}
          </Button>
        </div>
      }
    >
      <SignerStatusCard role="champion" style={{ marginBottom: 12 }} />
      <Alert type="warning" showIcon message={t('campaigns.confirm.cancelDesc')} />
    </Drawer>
  );
}

function LinksDrawer({
  open, row, onClose,
}: { open: boolean; row: CampaignListItem | null; onClose: () => void }) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const [lang, setLang] = useState<Lang>('zh');
  const url = row ? row.share_urls[lang] : '';

  const copy = () => { navigator.clipboard?.writeText(url); message.success(t('campaigns.toast.copied')); };

  return (
    <Drawer title={t('campaigns.modal.links')} open={open} onClose={onClose} width={460} destroyOnHidden>
      <Tabs activeKey={lang} onChange={(k) => setLang(k as Lang)} items={LANGS.map((l) => ({ key: l, label: l.toUpperCase() }))} />
      <Space.Compact style={{ width: '100%', marginBottom: 8 }}>
        <Input readOnly value={url} />
        <Button icon={<CopyOutlined />} onClick={copy}>{t('campaigns.btn.copy')}</Button>
        <Button type="primary" onClick={() => window.open(url, '_blank')}>{t('campaigns.btn.open')}</Button>
      </Space.Compact>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>{t('campaigns.links.hint')}</Typography.Paragraph>
      {url && (
        <div style={{ display: 'flex', justifyContent: 'center', background: '#F5F3FF', borderRadius: 8, padding: 10 }}>
          <iframe title="preview" src={url} style={{ width: 390, height: 560, border: '1px solid #E9E5F5', borderRadius: 12, background: '#fff' }} />
        </div>
      )}
    </Drawer>
  );
}

export default function CampaignsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | null>(null);
  const [linksRow, setLinksRow] = useState<CampaignListItem | null>(null);
  const [finalizeRow, setFinalizeRow] = useState<CampaignListItem | null>(null);
  const [cancelRow, setCancelRow] = useState<CampaignListItem | null>(null);
  const [betsRow, setBetsRow] = useState<CampaignListItem | null>(null);
  const [editRow, setEditRow] = useState<CampaignListItem | null>(null);

  const reload = () => actionRef.current?.reload();

  const remove = async (cid: string) => {
    try {
      await polymindApi.deleteCampaign(cid);
      message.success(t('campaigns.toast.deleted'));
      reload();
    } catch (err) {
      message.error((err as Error).message || t('campaigns.toast.deleteFailed'));
    }
  };

  const setHidden = async (cid: string, hidden: boolean) => {
    try {
      await polymindApi.setCampaignHidden(cid, hidden);
      message.success(t(hidden ? 'campaigns.toast.hidden' : 'campaigns.toast.unhidden'));
      reload();
    } catch (err) {
      message.error((err as Error).message || t('campaigns.toast.saveFailed'));
    }
  };

  const rowActions = (r: CampaignListItem) => {
    const a = [];
    if (r.status === 'betting') {
      a.push(<a key="fin" onClick={() => setFinalizeRow(r)}><FlagOutlined /> {t('campaigns.btn.finalize')}</a>);
    }
    a.push(<a key="links" onClick={() => setLinksRow(r)}><LinkOutlined /> {t('campaigns.btn.links')}</a>);
    if (r.hidden) {
      a.push(<a key="unhide" onClick={() => setHidden(r.campaign_id, false)}><EyeOutlined /> {t('campaigns.btn.unhide')}</a>);
    } else if (r.status === 'betting') {
      a.push(<a key="cancel" style={{ color: '#fa541c' }} onClick={() => setCancelRow(r)}><StopOutlined /> {t('campaigns.btn.cancel')}</a>);
    } else if (!r.has_onchain) {
      a.push(
        <Popconfirm key="del" title={t('campaigns.confirm.delete')} description={t('campaigns.confirm.deleteDesc')}
          okButtonProps={{ danger: true }} onConfirm={() => remove(r.campaign_id)}>
          <a style={{ color: '#ff4d4f' }}>{t('campaigns.btn.delete')}</a>
        </Popconfirm>,
      );
    } else {
      a.push(<a key="hide" onClick={() => setHidden(r.campaign_id, true)}><EyeInvisibleOutlined /> {t('campaigns.btn.hide')}</a>);
    }
    return a;
  };

  const columns = useMemo<ProColumns<CampaignListItem>[]>(() => [
    {
      title: t('campaigns.col.campaign'), dataIndex: 'title', width: 200,
      search: { transform: (v) => ({ keyword: v }) },
      fieldProps: { placeholder: t('campaigns.search.placeholder') },
      render: (_, r) => (
        <div style={{ minWidth: 0 }}>
          <a style={{ fontWeight: 500, fontSize: 13, wordBreak: 'break-word' }} onClick={() => setEditRow(r)}>
            {r.title || r.campaign_id}
          </a>
          {r.hidden && <Tag style={{ marginLeft: 4 }}>{t('campaigns.tag.hidden')}</Tag>}
          <div><Text type="secondary" style={{ fontSize: 11, wordBreak: 'break-all' }} copyable={{ text: r.campaign_id }}>{r.campaign_id}</Text></div>
        </div>
      ),
    },
    {
      title: t('campaigns.col.options'), dataIndex: 'options', width: 230, hideInSearch: true,
      render: (_, r) => (
        (r.options || []).length > 0 ? (
          <Space size={[4, 4]} wrap>
            {r.options.map((o) => <Tag key={o} style={{ fontSize: 11, margin: 0 }}>{o}</Tag>)}
          </Space>
        ) : <Text type="secondary">{r.option_count || '—'}</Text>
      ),
    },
    {
      title: t('campaigns.col.startTime'), dataIndex: 'start_time', width: 150, hideInSearch: true,
      render: (_, r) => (r.start_time
        ? <Text style={{ fontSize: 12 }}>{formatDate(r.start_time, { unix: true })}</Text>
        : <Text type="secondary">—</Text>),
    },
    {
      title: t('campaigns.col.endTime'), dataIndex: 'end_time', width: 150, hideInSearch: true,
      render: (_, r) => (r.end_time
        ? <Text style={{ fontSize: 12 }}>{formatDate(r.end_time, { unix: true })}</Text>
        : <Text type="secondary">—</Text>),
    },
    {
      title: t('campaigns.col.participants'), dataIndex: 'participants', width: 80, align: 'center', hideInSearch: true,
      render: (_, r) => (
        r.has_onchain && r.participants > 0
          ? <a onClick={() => setBetsRow(r)}>{r.participants}</a>
          : r.participants || 0
      ),
    },
    {
      title: t('campaigns.col.stake'), dataIndex: 'total_stake_eds', width: 120, align: 'right', hideInSearch: true,
      render: (_, r) => `${r.total_stake_eds.toLocaleString()} EDS`,
    },
    {
      title: t('campaigns.col.status'), dataIndex: 'status', width: 110,
      valueType: 'select',
      valueEnum: {
        draft: { text: t('campaigns.status.draft') },
        betting: { text: t('campaigns.status.betting') },
        settled: { text: t('campaigns.status.settled') },
        cancelled: { text: t('campaigns.status.cancelled') },
      },
      fieldProps: { placeholder: t('campaigns.search.statusPlaceholder') },
      render: (_, r) => (
        <Space size={4} direction="vertical">
          <Tag color={STATUS_COLOR[r.status] ?? 'default'}>{t(`campaigns.status.${r.status}`)}</Tag>
          {!r.has_onchain && <Tag color="warning" style={{ fontSize: 11 }}>{t('campaigns.status.noOnchain')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('campaigns.col.visibility'), dataIndex: 'visibility', hideInTable: true,
      valueType: 'select', initialValue: 'visible',
      valueEnum: {
        all: { text: t('campaigns.visibility.all') },
        visible: { text: t('campaigns.visibility.visible') },
        hidden: { text: t('campaigns.visibility.hidden') },
      },
    },
    {
      title: t('campaigns.col.actions'), width: 110, hideInSearch: true,
      render: (_, r) => <Space direction="vertical" size={2}>{rowActions(r)}</Space>,
    },
  ], [intl.locale]);

  return (
    <PageContainer>
      <ProTable<CampaignListItem>
        actionRef={actionRef}
        rowKey="campaign_id"
        columns={columns}
        search={{ labelWidth: 'auto' }}
        pagination={false}
        request={async (params) => {
          const res = await polymindApi.listCampaigns(1);
          let data = res.data;
          const kw = ((params.keyword as string) || '').trim().toLowerCase();
          if (kw) {
            data = data.filter((r) =>
              (r.title || '').toLowerCase().includes(kw) || r.campaign_id.toLowerCase().includes(kw));
          }
          if (params.status) data = data.filter((r) => r.status === params.status);
          const vis = (params.visibility as string) || 'visible';
          if (vis === 'visible') data = data.filter((r) => !r.hidden);
          else if (vis === 'hidden') data = data.filter((r) => r.hidden);
          return { data, success: true, total: data.length };
        }}
        toolBarRender={() => [
          <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => history.push('/workspace/event-creation/campaign')}>
            {t('campaigns.btn.new')}
          </Button>,
        ]}
      />
      <FinalizeDrawer open={!!finalizeRow} row={finalizeRow} onClose={() => setFinalizeRow(null)} onDone={() => { setFinalizeRow(null); reload(); }} />
      <CancelDrawer open={!!cancelRow} row={cancelRow} onClose={() => setCancelRow(null)} onDone={() => { setCancelRow(null); reload(); }} />
      <LinksDrawer open={!!linksRow} row={linksRow} onClose={() => setLinksRow(null)} />
      <ParticipantsDrawer open={!!betsRow} row={betsRow} onClose={() => setBetsRow(null)} />
      <CampaignEditDrawer open={!!editRow} cid={editRow?.campaign_id ?? null}
        onClose={() => setEditRow(null)} onSaved={() => { setEditRow(null); reload(); }} />
    </PageContainer>
  );
}
