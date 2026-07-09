import { PageContainer, ProTable, type ProColumns } from '@ant-design/pro-components';
import { App, Button, Card, DatePicker, Form, Radio, Space, Switch, Tabs, Tag, Tooltip, Typography } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
  downloadCsv,
  polymindApi,
  type LeaderboardInviteRow,
  type LeaderboardBetRow,
  type LeaderboardTopicRow,
} from '@/services/polymind';
import GoToPayoutButton from '@/components/GoToPayoutButton';
import type { ConfigRow } from '@/services/polymind';

const { Text } = Typography;

const shortAddr = (a: string) =>
  a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;

const fmtEds = (v: number) => {
  if (v >= 1000) {
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  if (v >= 1) return v.toFixed(4);
  return v.toFixed(6);
};

/** Get the Monday 00:00 of the ISO week in UTC for API parameters. */
function getMondayUTC(d: Dayjs): Dayjs {
  const utc = d.utc();
  const day = utc.day(); // 0=Sun, 1=Mon, ..., 6=Sat (UTC)
  const diff = day === 0 ? 6 : day - 1;
  return utc.subtract(diff, 'day').startOf('day');
}

type WeekOption = { label: string; value: number };

const WEEK_OPTIONS: WeekOption[] = [
  { label: 'leaderboard.week.thisWeek', value: 0 },
  { label: 'leaderboard.week.lastWeek', value: -1 },
  { label: 'leaderboard.week.twoWeeksAgo', value: -2 },
];

type TabKey = 'invite' | 'bet' | 'topic';

export default function LeaderboardPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();

  const [activeTab, setActiveTab] = useState<TabKey>('invite');
  const [weekOffset, setWeekOffset] = useState<number>(-1);
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(() => {
    const start = getMondayUTC(dayjs()).add(-1, 'week');
    const end = start.add(1, 'week').subtract(1, 'millisecond');
    return [start, end];
  });

  const [inviteData, setInviteData] = useState<LeaderboardInviteRow[]>([]);
  const [betData, setBetData] = useState<LeaderboardBetRow[]>([]);
  const [topicData, setTopicData] = useState<LeaderboardTopicRow[]>([]);
  const [requireLuffaId, setRequireLuffaId] = useState(true);
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const [lbSwitchLoading, setLbSwitchLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const inviteRef = useRef<any>(null);
  const betRef = useRef<any>(null);
  const topicRef = useRef<any>(null);

  const buildParams = useCallback(() => {
    const params: { week_offset?: number; week_start?: string; week_end?: string; limit: number; require_luffa_id?: number } = { limit: 10 };
    if (customRange) {
      // 向后端传 UTC 时间，格式为 YYYY-MM-DD HH:mm。后端会把结束时间补到该分钟最后一秒。
      params.week_start = customRange[0].utc().format('YYYY-MM-DD HH:mm');
      params.week_end = customRange[1].utc().format('YYYY-MM-DD HH:mm');
    } else {
      params.week_offset = weekOffset;
    }
    if (requireLuffaId) {
      params.require_luffa_id = 1;
    }
    return params;
  }, [weekOffset, customRange, requireLuffaId]);

  const fetchData = useCallback(async (tab: TabKey) => {
    setLoading(true);
    try {
      const params = buildParams();
      let res;
      switch (tab) {
        case 'invite':
          res = await polymindApi.leaderboardInvite(params);
          setInviteData(res || []);
          break;
        case 'bet':
          res = await polymindApi.leaderboardBet(params);
          setBetData(res || []);
          break;
        case 'topic':
          res = await polymindApi.leaderboardTopic(params);
          setTopicData(res || []);
          break;
      }
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [buildParams, message]);

  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab, weekOffset, customRange, requireLuffaId, fetchData]);



  useEffect(() => {
    polymindApi.listDbConfigs('leaderboard')
      .then((res) => {
        const rows: ConfigRow[] = (res as any).data || [];
        const row = rows.find((r: ConfigRow) => r.key === 'leaderboard.visible');
        setLeaderboardVisible(row ? row.value !== 'false' : true);
      })
      .catch(() => setLeaderboardVisible(true));
  }, []);

  const handleToggleLeaderboard = async (checked: boolean) => {
    setLbSwitchLoading(true);
    try {
      await polymindApi.updateConfig('leaderboard.visible', {
        value: checked ? 'true' : 'false',
      });
      setLeaderboardVisible(checked);
      message.success(checked ? '排行榜入口已开启' : '排行榜入口已关闭');
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLbSwitchLoading(false);
    }
  };

  const handleExport = async (tab: TabKey) => {
    const params = buildParams();
    const qs = new URLSearchParams();
    qs.set('download', '1');
    qs.set('limit', '100');
    if (params.week_start) {
      qs.set('week_start', params.week_start);
      qs.set('week_end', params.week_end!);
    } else {
      qs.set('week_offset', String(params.week_offset));
    }
    if (params.require_luffa_id) {
      qs.set('require_luffa_id', '1');
    }
    try {
      await downloadCsv(`/api/v1/leaderboard/${tab}?${qs.toString()}`);
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  const inviteColumns: ProColumns<LeaderboardInviteRow>[] = [
    {
      title: t('leaderboard.col.rank'),
      dataIndex: 'rank',
      width: 60,
      align: 'center',
      search: false,
    },
    {
      title: t('leaderboard.col.user'),
      key: 'user',
      width: 220,
      ellipsis: true,
      search: false,
      render: (_, r) => (
        <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
          <Text style={{ fontWeight: 500 }}>{r.nickname || <Text type="secondary">—</Text>}</Text>
          <Text code style={{ fontSize: 11 }} copyable={{ text: r.luffa_id }}>
            {shortAddr(r.luffa_id)}
          </Text>
        </Space>
      ),
    },
    {
      title: t('leaderboard.col.address'),
      dataIndex: 'address',
      width: 160,
      ellipsis: true,
      search: false,
      render: (_, r: LeaderboardInviteRow) => (
        <Text type="secondary" style={{ fontSize: 12 }} copyable={r.address ? { text: r.address } : false}>{shortAddr(r.address)}</Text>
      ),
    },
    {
      title: t('leaderboard.col.inviteeCount'),
      dataIndex: 'invitee_count',
      width: 120,
      align: 'right',
      search: false,
    },
  ];

  const betColumns: ProColumns<LeaderboardBetRow>[] = [
    {
      title: t('leaderboard.col.rank'),
      dataIndex: 'rank',
      width: 60,
      align: 'center',
      search: false,
    },
    {
      title: t('leaderboard.col.user'),
      key: 'user',
      width: 220,
      ellipsis: true,
      search: false,
      render: (_, r) => (
        <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
          <Text style={{ fontWeight: 500 }}>{r.nickname || <Text type="secondary">—</Text>}</Text>
          <Text code style={{ fontSize: 11 }} copyable={{ text: r.luffa_id }}>
            {shortAddr(r.luffa_id)}
          </Text>
        </Space>
      ),
    },
    {
      title: t('leaderboard.col.address'),
      dataIndex: 'address',
      width: 160,
      ellipsis: true,
      search: false,
      render: (_, r: LeaderboardBetRow) => (
        <Text type="secondary" style={{ fontSize: 12 }} copyable={r.address ? { text: r.address } : false}>{shortAddr(r.address)}</Text>
      ),
    },
    {
      title: t('leaderboard.col.eventCount'),
      dataIndex: 'event_count',
      width: 120,
      align: 'right',
      search: false,
    },
    {
      title: t('leaderboard.col.entryCount'),
      dataIndex: 'entry_count',
      width: 120,
      align: 'right',
      search: false,
    },
    {
      title: t('leaderboard.col.totalWagered'),
      dataIndex: 'total_wagered_eds',
      width: 160,
      align: 'right',
      search: false,
      render: (_, r: LeaderboardBetRow) => <Text strong>{fmtEds(r.total_wagered_eds)}</Text>,
    },
  ];

  const topicColumns: ProColumns<LeaderboardTopicRow>[] = [
    {
      title: t('leaderboard.col.rank'),
      dataIndex: 'rank',
      width: 60,
      align: 'center',
      search: false,
    },
    {
      title: t('leaderboard.col.user'),
      key: 'user',
      width: 200,
      ellipsis: true,
      search: false,
      render: (_, r) => (
        <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
          <Text style={{ fontWeight: 500 }}>{r.nickname || <Text type="secondary">—</Text>}</Text>
          <Text code style={{ fontSize: 11 }} copyable={{ text: r.luffa_id }}>
            {shortAddr(r.luffa_id)}
          </Text>
        </Space>
      ),
    },
    {
      title: t('leaderboard.col.address'),
      dataIndex: 'address',
      width: 140,
      ellipsis: true,
      search: false,
      render: (_, r: LeaderboardTopicRow) => (
        <Text type="secondary" style={{ fontSize: 12 }} copyable={r.address ? { text: r.address } : false}>{shortAddr(r.address)}</Text>
      ),
    },
    {
      title: t('leaderboard.col.event'),
      key: 'event',
      ellipsis: true,
      search: false,
      render: (_, r: LeaderboardTopicRow) => (
        <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
          <Text style={{ fontWeight: 500 }}>{r.event_question || <Text type="secondary">—</Text>}</Text>
          <Text code style={{ fontSize: 11 }} copyable={{ text: r.event_id }}>
            {r.event_id}
          </Text>
        </Space>
      ),
    },
    {
      title: t('leaderboard.col.heatScore'),
      dataIndex: 'heat_score',
      width: 120,
      align: 'right',
      search: false,
      render: (_, r: LeaderboardTopicRow) => <Tag color="purple">{r.heat_score.toFixed(4)}</Tag>,
    },
  ];

  return (
    <PageContainer title={t('leaderboard.title')}>
      <Card style={{ marginBottom: 16 }}>
        <Form layout="inline">
          <Form.Item label={t('leaderboard.week.label')}>
            <Space align="center">
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                size="small"
                value={weekOffset}
                onChange={(e) => {
                  const v = e.target.value as number;
                  setWeekOffset(v);
                  const start = getMondayUTC(dayjs()).add(v, 'week');
                  const end = start.add(1, 'week').subtract(1, 'millisecond');
                  setCustomRange([start, end]);
                }}
              >
                <Radio.Button value={0}>{t('leaderboard.week.thisWeek')}</Radio.Button>
                <Radio.Button value={-1}>{t('leaderboard.week.lastWeek')}</Radio.Button>
                <Radio.Button value={-2}>{t('leaderboard.week.twoWeeksAgo')}</Radio.Button>
              </Radio.Group>
              <DatePicker.RangePicker
                size="small"
                format="YYYY-MM-DD HH:mm"
                showTime={{
                  format: 'HH:mm',
                  defaultValue: [
                    dayjs().utc().hour(0).minute(0).second(0).millisecond(0),
                    dayjs().utc().hour(23).minute(59).second(0).millisecond(0),
                  ],
                }}
                placeholder={[t('bets.dateStart'), t('bets.dateEnd')]}
                value={customRange}
                onChange={(dates) => {
                  setCustomRange(dates as [Dayjs, Dayjs] | null)
                }}
              />
            </Space>
          </Form.Item>
          <Form.Item>
            <Space align="center">
              <span style={{ fontSize: 12, color: '#666' }}>{t('leaderboard.filter.requireLuffaId')}</span>
              <Switch size="small" checked={requireLuffaId} onChange={setRequireLuffaId} />
            </Space>
          </Form.Item>
          <Form.Item>
            <Space align="center">
              <span style={{ fontSize: 12, color: '#666' }}>小程序排行榜入口</span>
              <Switch
                size="small"
                checked={leaderboardVisible}
                loading={lbSwitchLoading}
                onChange={handleToggleLeaderboard}
              />
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(k: string) => setActiveTab(k as TabKey)}
          items={[
            {
              key: 'invite',
              label: t('leaderboard.tab.invite'),
              children: (
                <ProTable<LeaderboardInviteRow>
                  actionRef={inviteRef}
                  columns={inviteColumns}
                  dataSource={inviteData}
                  rowKey="rank"
                  search={false}
                  pagination={false}
                  loading={loading}
                  scroll={{ x: 600 }}
                  options={{
                    reload: () => {
                      console.log('[leaderboard] refresh clicked, tab=invite');
                      return fetchData('invite');
                    },
                  }}
                  toolbar={{
                    actions: [
                      <GoToPayoutButton
                        key="payout"
                        items={inviteData
                          .filter(r => r.address)
                          .map(r => ({ address: r.address }))}
                      />,
                      <Tooltip title={t('common.exportCsv')} key="export">
                        <Button type="text" icon={<ExportOutlined />} onClick={() => handleExport('invite')} />
                      </Tooltip>,
                    ],
                  }}
                  locale={{ emptyText: t('leaderboard.empty') }}
                />
              ),
            },
            {
              key: 'bet',
              label: t('leaderboard.tab.bet'),
              children: (
                <ProTable<LeaderboardBetRow>
                  actionRef={betRef}
                  columns={betColumns}
                  dataSource={betData}
                  rowKey="rank"
                  search={false}
                  pagination={false}
                  loading={loading}
                  scroll={{ x: 900 }}
                  options={{
                    reload: () => {
                      console.log('[leaderboard] refresh clicked, tab=bet');
                      return fetchData('bet');
                    },
                  }}
                  toolbar={{
                    actions: [
                      <GoToPayoutButton
                        key="payout"
                        items={betData
                          .filter(r => r.address)
                          .map(r => ({ address: r.address }))}
                      />,
                      <Tooltip title={t('common.exportCsv')} key="export">
                        <Button type="text" icon={<ExportOutlined />} onClick={() => handleExport('bet')} />
                      </Tooltip>,
                    ],
                  }}
                  locale={{ emptyText: t('leaderboard.empty') }}
                />
              ),
            },
            {
              key: 'topic',
              label: t('leaderboard.tab.topic'),
              children: (
                <ProTable<LeaderboardTopicRow>
                  actionRef={topicRef}
                  columns={topicColumns}
                  dataSource={topicData}
                  rowKey="rank"
                  search={false}
                  pagination={false}
                  loading={loading}
                  scroll={{ x: 1000 }}
                  options={{
                    reload: () => {
                      console.log('[leaderboard] refresh clicked, tab=topic');
                      return fetchData('topic');
                    },
                  }}
                  toolbar={{
                    actions: [
                      <GoToPayoutButton
                        key="payout"
                        items={topicData
                          .filter(r => r.address)
                          .map(r => ({ address: r.address }))}
                      />,
                      <Tooltip title={t('common.exportCsv')} key="export">
                        <Button type="text" icon={<ExportOutlined />} onClick={() => handleExport('topic')} />
                      </Tooltip>,
                    ],
                  }}
                  locale={{ emptyText: t('leaderboard.empty') }}
                />
              ),
            },
          ]}
        />
      </Card>
    </PageContainer>
  );
}
