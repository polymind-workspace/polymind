import { LinkOutlined } from '@ant-design/icons';
import { AutoComplete, Button, Form, Input, Popover, Select, Space, Typography } from 'antd';
import { useIntl } from '@umijs/max';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MINIAPP_ACTIONS,
  actionUsesEventSlug,
  buildMiniAppUrl,
  type MiniAppAction,
} from '@/constants/miniapp';
import { polymindApi, type EventListItem } from '@/services/polymind';

const { Text } = Typography;

interface Props {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
}

export default function LinkPickerInput({ value, onChange, placeholder }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<MiniAppAction>('buy-shares');
  const [id, setId] = useState('');
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open || !actionUsesEventSlug(action)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      polymindApi
        .listEvents({ page: 1, limit: 20, q: search.trim() || undefined })
        .then((res) => setEvents(res.data || []))
        .catch(() => setEvents([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, action, search]);

  const def = useMemo(
    () => MINIAPP_ACTIONS.find((a) => a.key === action)!,
    [action],
  );

  const eventOptions = useMemo(
    () => events.map((e) => ({
      value: e.slug,
      label: (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
          <Text style={{ fontSize: 13 }} ellipsis>{e.question}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {e.slug} · {e.status}
          </Text>
        </div>
      ),
    })),
    [events],
  );

  const insert = () => {
    const url = buildMiniAppUrl(action, def.needsId ? id.trim() : undefined);
    onChange?.(url);
    setOpen(false);
  };

  const content = (
    <div style={{ width: 360 }}>
      <Form layout="vertical" size="small">
        <Form.Item label={t('miniapp.action')} style={{ marginBottom: 8 }}>
          <Select
            value={action}
            onChange={(v: MiniAppAction) => {
              setAction(v);
              setId('');
            }}
            options={MINIAPP_ACTIONS.map((a) => ({
              value: a.key,
              label: t(a.labelId),
            }))}
          />
        </Form.Item>
        {def.needsId && (
          <Form.Item
            label={t(def.idHintId || 'miniapp.id')}
            style={{ marginBottom: 8 }}
          >
            {actionUsesEventSlug(action) ? (
              <AutoComplete
                value={id}
                onChange={(v) => { setId(v); setSearch(v); }}
                onSelect={(v) => setId(v as string)}
                options={eventOptions}
                placeholder={t('miniapp.id.event.placeholder')}
                filterOption={false}
                notFoundContent={loading ? t('miniapp.loading') : t('miniapp.noEvents')}
                popupMatchSelectWidth={420}
              />
            ) : (
              <Input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder={t('miniapp.id.draft.placeholder')}
              />
            )}
          </Form.Item>
        )}
        <Text type="secondary" style={{ fontSize: 11, wordBreak: 'break-all' }}>
          {buildMiniAppUrl(action, def.needsId ? id.trim() : undefined)}
        </Text>
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <Space>
            <Button size="small" onClick={() => setOpen(false)}>
              {t('miniapp.cancel')}
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={insert}
              disabled={def.needsId && !id.trim() && action !== 'open-pro'}
            >
              {t('miniapp.insert')}
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
      />
      <Popover
        content={content}
        trigger="click"
        open={open}
        onOpenChange={setOpen}
        placement="bottomRight"
        destroyTooltipOnHide
      >
        <Button icon={<LinkOutlined />}>{t('miniapp.btn')}</Button>
      </Popover>
    </Space.Compact>
  );
}
