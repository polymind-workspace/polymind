import { PageContainer } from '@ant-design/pro-components';
import {
  Alert, App, Button, Card, Form, Modal, Select,
  Space, Spin, Table, Tag, Tooltip, Typography,
} from 'antd';
import { ExportOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { history, useIntl } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { downloadCsv, polymindApi, type AdminEventRow } from '@/services/polymind';
import { formatDate } from '@/utils/format';
import { adminEventFinalize, adminEventWithdrawBets } from '@/wallet/endless';
import { useAdminEventTx } from '@/hooks/useAdminEventTx';

const { Text, Link } = Typography;

interface EventStats {
  participant_count: number;
  collected_bets:    number;
  min_bet_amount:    number;
}

function fmtEds(base: number): string {
  return `${(base / 1e8).toFixed(base % 1e8 === 0 ? 0 : 2)} EDS`;
}

function StatusTag({ row }: { row: AdminEventRow }) {
  const intl = useIntl();
  if (row.status === 'resolved') return <Tag color="purple">{intl.formatMessage({ id: 'adminEvents.list.status.resolved' })}</Tag>;
  if (row.ended) return <Tag color="orange">{intl.formatMessage({ id: 'adminEvents.list.status.ended' })}</Tag>;
  return <Tag color="green">{intl.formatMessage({ id: 'adminEvents.list.status.open' })}</Tag>;
}

function FinalizeButton({ row, onDone }: { row: AdminEventRow; onDone: () => void }) {
  const { message } = App.useApp();
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const adminEventTx = useAdminEventTx();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ correct_answer: string }>();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (row.status === 'resolved' || row.ended) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [row.status, row.ended]);

  const isTimeUp = row.end_time ? (now / 1000) >= row.end_time : false;
  const isEnded  = row.ended || isTimeUp;

  if (row.status === 'resolved') return null;

  if (!isEnded) {
    return (
      <Tooltip title={t('adminEvents.list.finalize.afterEnd')}>
        <Button size="small" disabled>{t('adminEvents.list.finalize.btn')}</Button>
      </Tooltip>
    );
  }

  const handleOk = async () => {
    const v = await form.validateFields();
    setOpen(false);

    adminEventTx.run({
      name: t('adminEvents.list.finalize.txName'),
      call: (contractAddr) =>
        adminEventFinalize(contractAddr, {
          slug:          row.slug,
          correctAnswer: v.correct_answer,
        }),
      onDone: async (hash) => {
        try {
          await polymindApi.finalizeAdminEvent(row.slug, {
            tx_hash:        hash,
            correct_answer: v.correct_answer,
          });
          message.success(intl.formatMessage(
            { id: 'adminEvents.list.finalize.success' },
            { winner: v.correct_answer },
          ));
          onDone();
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
    <>
      <Button size="small" type="primary" onClick={() => setOpen(true)}>
        {t('adminEvents.list.finalize.btn')}
      </Button>
      <Modal
        open={open}
        title={intl.formatMessage({ id: 'adminEvents.list.finalize.modalTitle' }, { question: row.question })}
        onOk={handleOk}
        onCancel={() => setOpen(false)}
        confirmLoading={adminEventTx.busy}
        okText={t('adminEvents.list.finalize.submit')}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary">{t('adminEvents.list.finalize.answersLabel')}</Text>
          <ul style={{ margin: '8px 0 16px', paddingLeft: 20 }}>
            {(row.answers as string[]).map((text, i) => (
              <li key={text}>
                <Text strong>{String.fromCharCode(65 + i)}.</Text> {text}
              </li>
            ))}
          </ul>
        </div>
        <Form form={form} layout="vertical">
          <Form.Item
            name="correct_answer"
            label={t('adminEvents.list.finalize.correctAnswer')}
            rules={[{ required: true, message: t('adminEvents.create.required') }]}
          >
            <Select style={{ width: 280 }}>
              {(row.answers as string[]).map((text, i) => (
                <Select.Option key={text} value={text}>
                  {String.fromCharCode(65 + i)}. {text}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function WithdrawButton({
  row, stats, statsLoading, onDone,
}: { row: AdminEventRow; stats: EventStats | undefined; statsLoading: boolean; onDone: () => void }) {
  const { message } = App.useApp();
  const intl = useIntl();
  const adminEventTx = useAdminEventTx();

  if (row.status !== 'resolved') return null;

  const hasBalance   = stats != null && stats.collected_bets > 0;
  const isDisabled   = statsLoading || (!statsLoading && stats != null && stats.collected_bets === 0);
  const tooltipTitle = statsLoading
    ? intl.formatMessage({ id: 'adminEvents.list.withdraw.loading' })
    : hasBalance
      ? intl.formatMessage({ id: 'adminEvents.list.withdraw.tooltip' }, { amount: fmtEds(stats!.collected_bets) })
      : intl.formatMessage({ id: 'adminEvents.list.withdraw.none' });

  const handleWithdraw = () => {
    adminEventTx.run({
      name: intl.formatMessage({ id: 'adminEvents.list.withdraw.txName' }),
      call: (contractAddr) => adminEventWithdrawBets(contractAddr, row.slug),
      onDone: async () => {
        message.success(intl.formatMessage({ id: 'adminEvents.list.withdraw.success' }, { slug: row.slug }));
        onDone();
      },
    });
  };

  return (
    <Tooltip title={tooltipTitle}>
      <Button
        size="small"
        onClick={handleWithdraw}
        loading={adminEventTx.busy}
        disabled={isDisabled}
      >
        {intl.formatMessage({ id: 'adminEvents.list.withdraw.btn' })}
      </Button>
    </Tooltip>
  );
}

const COLUMNS = (
  reload: () => void,
  statsMap: Record<string, EventStats>,
  statsLoading: boolean,
  intl: ReturnType<typeof useIntl>,
): ColumnsType<AdminEventRow> => [
  {
    title: intl.formatMessage({ id: 'adminEvents.list.col.question' }),
    dataIndex: 'question',
    render: (v: string, row) => (
      <div style={{ minWidth: 200 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{v}</div>
        <Text type="secondary" style={{ fontSize: 11 }}>{row.slug}</Text>
      </div>
    ),
  },
  {
    title: intl.formatMessage({ id: 'adminEvents.list.col.answers' }),
    dataIndex: 'answers',
    width: 200,
    render: (answers: string[]) => (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(answers || []).map(a => (
          <Tag key={a} style={{ fontSize: 11 }}>{a}</Tag>
        ))}
      </div>
    ),
  },
  {
    title: intl.formatMessage({ id: 'adminEvents.list.col.endTime' }),
    dataIndex: 'end_time',
    width: 160,
    render: (v: number) =>
      <Text style={{ fontSize: 12 }}>{formatDate(v, { unix: true })}</Text>,
  },
  {
    title: intl.formatMessage({ id: 'adminEvents.list.col.participants' }),
    key: 'participants',
    width: 100,
    align: 'center' as const,
    render: (_: unknown, row) => {
      if (statsLoading) return <Spin size="small" />;
      const s = statsMap[row.slug];
      return s != null
        ? <Text style={{ fontSize: 13 }}>{s.participant_count}</Text>
        : <Text type="secondary">—</Text>;
    },
  },
  {
    title: intl.formatMessage({ id: 'adminEvents.list.col.collected' }),
    key: 'collected',
    width: 150,
    align: 'center' as const,
    render: (_: unknown, row) => {
      if (statsLoading) return <Spin size="small" />;
      const s = statsMap[row.slug];
      if (!s) return <Text type="secondary">—</Text>;

      // Free event — no bets collected
      if (s.min_bet_amount === 0) {
        return <Tag color="default" style={{ fontSize: 11 }}>{intl.formatMessage({ id: 'adminEvents.list.tag.free' })}</Tag>;
      }

      // No participants yet
      if (s.participant_count === 0) {
        return <Text type="secondary" style={{ fontSize: 12 }}>{intl.formatMessage({ id: 'adminEvents.list.tag.noBets' })}</Text>;
      }

      // Bets still in contract
      if (s.collected_bets > 0) {
        return (
          <div style={{ textAlign: 'center' }}>
            <Tag color="orange" style={{ fontSize: 11, marginBottom: 2 }}>{intl.formatMessage({ id: 'adminEvents.list.tag.pendingWithdrawal' })}</Tag>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{fmtEds(s.collected_bets)}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {s.participant_count} × {fmtEds(s.min_bet_amount)}
            </Text>
          </div>
        );
      }

      // collected_bets == 0 but participants > 0 → already withdrawn
      return (
        <div style={{ textAlign: 'center' }}>
          <Tag color="green" style={{ fontSize: 11, marginBottom: 2 }}>{intl.formatMessage({ id: 'adminEvents.list.tag.withdrawn' })}</Tag>
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {intl.formatMessage({ id: 'adminEvents.list.tag.participants' }, { count: s.participant_count })}
            </Text>
          </div>
        </div>
      );
    },
  },
  {
    title: intl.formatMessage({ id: 'adminEvents.list.col.status' }),
    key: 'status',
    width: 100,
    align: 'center' as const,
    render: (_: unknown, row) => <StatusTag row={row} />,
  },
  {
    title: intl.formatMessage({ id: 'adminEvents.list.col.h5' }),
    dataIndex: 'h5_url',
    width: 80,
    align: 'center' as const,
    render: (v: string) =>
      v ? <Link href={v} target="_blank" style={{ fontSize: 12 }}>{intl.formatMessage({ id: 'adminEvents.list.col.h5open' })}</Link>
        : <Text type="secondary">—</Text>,
  },
  {
    title: intl.formatMessage({ id: 'adminEvents.list.col.created' }),
    dataIndex: 'created_at',
    width: 140,
    render: (v: string | null) =>
      <Text type="secondary" style={{ fontSize: 12 }}>{formatDate(v)}</Text>,
  },
  {
    title: intl.formatMessage({ id: 'adminEvents.list.col.action' }),
    key: 'action',
    width: 140,
    align: 'center' as const,
    render: (_: unknown, row) => (
      <Space size={4}>
        <FinalizeButton row={row} onDone={reload} />
        <WithdrawButton
          row={row}
          stats={statsMap[row.slug]}
          statsLoading={statsLoading}
          onDone={reload}
        />
      </Space>
    ),
  },
];

export default function AdminEventListPage() {
  const intl = useIntl();
  const [rows,         setRows]         = useState<AdminEventRow[]>([]);
  const [total,        setTotal]        = useState(0);
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState('');
  const [statsMap,     setStatsMap]     = useState<Record<string, EventStats>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  const loadStats = useCallback((slugs: string[]) => {
    if (slugs.length === 0) return;
    setStatsLoading(true);
    Promise.allSettled(slugs.map((slug) => polymindApi.getAdminEventStats(slug).then((s) => ({ slug, s }))))
      .then((results) => {
        const map: Record<string, EventStats> = {};
        for (const r of results) {
          if (r.status === 'fulfilled') map[r.value.slug] = r.value.s;
        }
        setStatsMap(map);
      })
      .finally(() => setStatsLoading(false));
  }, []);

  const handleExport = useCallback(async () => {
    await downloadCsv('/api/v1/admin-events?download=1');
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    polymindApi
      .listAdminEvents({ limit: 100 })
      .then((res) => {
        if (res.ret !== 200) { setErr(res.msg || `ret=${res.ret}`); return; }
        const rows = res.data || [];
        setRows(rows);
        setTotal(res.total || 0);
        loadStats(rows.map((r) => r.slug));
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [loadStats]);

  useEffect(() => { load(); }, [load]);

  return (
    <PageContainer
      extra={[
        <Button
          key="create"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => history.push('/workspace/event-creation/special')}
        >
          {intl.formatMessage({ id: 'adminEvents.list.btn.newSpecial' })}
        </Button>,
        <Tooltip title={intl.formatMessage({ id: 'common.exportCsv' })} key="export">
          <Button icon={<ExportOutlined />} onClick={handleExport} loading={loading} />
        </Tooltip>,
        <Button key="reload" icon={<ReloadOutlined />} onClick={load} loading={loading} />,
      ]}
    >
      {err && <Alert type="error" message={err} style={{ marginBottom: 16 }} />}
      <Card>
        <Table<AdminEventRow>
          rowKey="slug"
          size="small"
          loading={loading}
          dataSource={rows}
          columns={COLUMNS(load, statsMap, statsLoading, intl)}
          pagination={{ total, pageSize: 100, size: 'small', showTotal: (n) => intl.formatMessage({ id: 'adminEvents.list.totalEvents' }, { n }) }}
          locale={{ emptyText: intl.formatMessage({ id: 'adminEvents.list.empty' }) }}
          scroll={{ x: 1100 }}
        />
      </Card>
    </PageContainer>
  );
}
