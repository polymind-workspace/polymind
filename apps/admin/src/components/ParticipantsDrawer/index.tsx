import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { App, Button, Drawer, Space, Tag, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useIntl } from '@umijs/max';
import { downloadCsv, polymindApi, type CampaignListItem, type ChampionBetRow } from '@/services/polymind';

const { Text } = Typography;
const shortAddr = (a: string) => (a && a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const fmtEds = (v: number) => (v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 4 }) : v.toFixed(4));

interface Props {
  open: boolean;
  row: CampaignListItem | null;
  onClose: () => void;
}

export default function ParticipantsDrawer({ open, row, onClose }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const cid = row?.campaign_id || '';

  const handleExport = async () => {
    try {
      await downloadCsv(`/api/v1/campaigns/${encodeURIComponent(cid)}/bets?download=1`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const columns: ProColumns<ChampionBetRow>[] = [
    {
      title: t('champBets.col.user'), dataIndex: 'user', width: 200,
      render: (_, b) => (
        <Space direction="vertical" size={0}>
          <Text code copyable={{ text: b.user }} style={{ fontSize: 11 }}>{shortAddr(b.user)}</Text>
          {b.name && <Text type="secondary" style={{ fontSize: 11 }}>{b.name}</Text>}
        </Space>
      ),
    },
    {
      title: t('champBets.col.team'), dataIndex: 'team', width: 150, search: false,
      render: (_, b) => <Tag color="purple">{b.option_idx + 1}. {b.team}</Tag>,
    },
    {
      title: t('champBets.col.amount'), dataIndex: 'amount_eds', width: 120, align: 'right', search: false,
      render: (_, b) => <Text strong>{fmtEds(b.amount_eds)} EDS</Text>,
    },
    {
      title: t('champBets.col.time'), dataIndex: 'ts', width: 160, search: false,
      render: (_, b) => (b.ts ? dayjs.unix(b.ts).format('YYYY-MM-DD HH:mm') : '—'),
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      destroyOnHidden
      title={
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t('champBets.title')}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{row?.title || cid}</Text>
        </div>
      }
      extra={
        <Button size="small" icon={<ExportOutlined />} onClick={handleExport}>
          {t('champBets.export')}
        </Button>
      }
    >
      {open && (
        <ProTable<ChampionBetRow>
          key={cid}
          rowKey="id"
          columns={columns}
          search={false}
          options={false}
          toolBarRender={false}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          request={async (p) => {
            const res = await polymindApi.championBets(cid, {
              page: p.current || 1,
              limit: p.pageSize || 20,
            });
            return { data: res.data, success: true, total: res.total };
          }}
        />
      )}
    </Drawer>
  );
}