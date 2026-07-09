import { Button, Drawer, List, Space, Tag, Typography } from 'antd';
import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { polymindApi, type MarketBet } from '@/services/polymind';
import { formatDate } from '@/utils/format';

const EDS = 1e8;
const PAGE = 25;
const fmtEds = (b: string | number) => (Number(b) / EDS).toFixed(2);
const shortAddr = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

interface Props {
  open: boolean;
  marketSlug: string | null;
  onClose: () => void;
}

export default function BetsDrawer({ open, marketSlug, onClose }: Props) {
  const intl = useIntl();
  const tr = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [bets, setBets] = useState<MarketBet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !marketSlug) {
      setBets([]);
      setTotal(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    polymindApi
      .marketBets(marketSlug, PAGE, 0)
      .then((r) => {
        if (!cancelled) {
          setBets(r.items || []);
          setTotal(r.total || 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBets([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, marketSlug]);

  const loadMore = useCallback(() => {
    if (!marketSlug || loading) return;
    setLoading(true);
    polymindApi
      .marketBets(marketSlug, PAGE, bets.length)
      .then((r) => setBets((prev) => [...prev, ...(r.items || [])]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [marketSlug, bets.length, loading]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={520}
      title={tr('market.section.bettors', { n: total })}
      destroyOnClose
    >
      <List
        size="small"
        loading={loading && bets.length === 0}
        dataSource={bets}
        locale={{ emptyText: tr('market.bettors.empty') }}
        loadMore={
          bets.length < total ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <Button size="small" loading={loading} onClick={loadMore}>
                {tr('market.bettors.loadMore')}
              </Button>
            </div>
          ) : null
        }
        renderItem={(b) => (
          <List.Item>
            <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start">
              <Space direction="vertical" size={2}>
                <Typography.Text copyable={{ text: b.address }} style={{ fontFamily: 'monospace' }}>
                  {shortAddr(b.address)}
                </Typography.Text>
                {b.luffa_id ? (
                  <span style={{ fontSize: 12, color: '#888' }}>{b.luffa_id}</span>
                ) : (
                  <Tag color="orange" style={{ margin: 0 }}>{tr('market.bettors.noLuffa')}</Tag>
                )}
              </Space>
              <Space size="small">
                <Tag color={b.side === 'YES' ? 'green' : 'red'} style={{ margin: 0 }}>
                  {b.side}
                </Tag>
                <span>{fmtEds(b.amount)} EDS</span>
                <span style={{ color: '#999', fontSize: 12 }}>
                  {formatDate(b.time, { unix: true })}
                </span>
              </Space>
            </Space>
          </List.Item>
        )}
      />
    </Drawer>
  );
}
