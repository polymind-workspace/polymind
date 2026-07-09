import { Avatar, Button, Drawer, Input, Space, Table, Tag, Typography } from 'antd';
import { useIntl } from '@umijs/max';
import { useEffect, useState } from 'react';
import { polymindApi, type UserRow } from '@/services/polymind';
import { resolveAvatar } from '@/utils/avatar';

const { Text } = Typography;

interface Props {
  open: boolean;
  initialSelected?: string[];   // luffa_ids
  onClose: () => void;
  onConfirm: (luffaIds: string[]) => void;
}

export default function UserPickerDrawer({ open, initialSelected = [], onClose, onConfirm }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>(initialSelected);

  useEffect(() => {
    if (!open) return;
    setSelected(initialSelected);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    polymindApi.listUsers({ q: q || undefined, limit: 50 })
      .then((res) => setRows(res.data || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open, q]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={680}
      title={t('push.picker.title')}
      destroyOnClose
      extra={
        <Button type="primary" onClick={() => onConfirm(selected)}>
          {t('push.picker.done', { n: selected.length })}
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Input.Search
          placeholder={t('push.picker.search')}
          allowClear
          onSearch={setQ}
        />
        <Table<UserRow>
          rowKey="luffa_id"
          loading={loading}
          dataSource={rows}
          size="small"
          pagination={{ pageSize: 20 }}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys as string[]),
            preserveSelectedRowKeys: true,
          }}
          columns={[
            {
              title: t('users.col.user'),
              dataIndex: 'luffa_id',
              ellipsis: true,
              render: (_, row) => {
                const url = resolveAvatar(row);
                return (
                  <Space>
                    {url
                      ? <Avatar src={url} size={28} />
                      : <Avatar size={28}>{(row.nickname || '?').slice(0, 1)}</Avatar>}
                    <Space direction="vertical" size={0} style={{ minWidth: 0 }}>
                      <Text>{row.nickname || <Text type="secondary">—</Text>}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{row.luffa_id}</Text>
                    </Space>
                  </Space>
                );
              },
            },
            {
              title: t('users.col.isPro'),
              dataIndex: 'is_pro',
              width: 70,
              render: (_, row) => row.is_pro
                ? <Tag color="gold">Pro</Tag>
                : <Text type="secondary">—</Text>,
            },
          ]}
        />
      </Space>
    </Drawer>
  );
}
