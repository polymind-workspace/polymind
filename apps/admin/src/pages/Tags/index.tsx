import { PageContainer } from '@ant-design/pro-components';
import {
  App, Button, Card, Form, Input, InputNumber, Modal, Popconfirm,
  Select, Space, Switch, Table, Tag as AntTag, Typography,
} from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { polymindApi, type EventListItem, type PmTagRow } from '@/services/polymind';

const { Text } = Typography;

type TabKey = 'dictionary' | 'bulk';

export default function TagsPage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const [tab, setTab] = useState<TabKey>('dictionary');

  return (
    <PageContainer
      tabList={[
        { key: 'dictionary', tab: t('tags.tab.dictionary') },
        { key: 'bulk',       tab: t('tags.tab.bulk') },
      ]}
      tabActiveKey={tab}
      onTabChange={(k) => setTab(k as TabKey)}
    >
      {tab === 'dictionary' ? <Dictionary /> : <BulkTagging />}
    </PageContainer>
  );
}

function Dictionary() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const [rows, setRows] = useState<PmTagRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PmTagRow | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    polymindApi.listTags()
      .then(setRows)
      .catch((e: Error) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [message]);

  useEffect(() => { reload(); }, [reload]);

  const remove = async (row: PmTagRow) => {
    const refCount = row.ref_count ?? 0;
    if (refCount > 0) {
      message.warning(t('tags.cannotDelete', { n: refCount }));
      return;
    }
    try {
      await polymindApi.deleteTag(row.slug);
      message.success(t('tags.toast.deleted'));
      reload();
    } catch (e) {
      message.error((e as Error).message || t('tags.toast.deleteFailed'));
    }
  };

  const toggle = async (slug: string, field: 'is_active' | 'is_pinned', val: boolean) => {
    try {
      await polymindApi.updateTag(slug, { [field]: val });
      reload();
    } catch (e) {
      message.error((e as Error).message || t('tags.toast.updateFailed'));
    }
  };

  return (
    <>
      <Card
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); setModalOpen(true); }}>
            {t('tags.btn.new')}
          </Button>
        }
      >
        <Table<PmTagRow>
          rowKey="slug"
          loading={loading}
          dataSource={rows}
          pagination={false}
          columns={[
            {
              title: t('tags.col.displayName'),
              dataIndex: 'name',
              render: (v: string, row: PmTagRow) => (
                <Space>
                  <AntTag color={row.is_pinned ? 'gold' : 'default'}>{v || row.display_name || row.slug}</AntTag>
                </Space>
              ),
            },
            { title: t('tags.col.slug'), dataIndex: 'slug', render: (v) => <Text code>{v}</Text> },
            { title: t('tags.col.sortOrder'), dataIndex: 'sort_order', width: 80 },
            {
              title: t('tags.col.active'),
              dataIndex: 'is_active',
              width: 90,
              render: (_, row) => (
                <Switch
                  size="small"
                  checked={Boolean(row.is_active)}
                  onChange={(v) => toggle(row.slug, 'is_active', v)}
                />
              ),
            },
            {
              title: t('tags.col.pinned'),
              dataIndex: 'is_pinned',
              width: 90,
              render: (_, row) => (
                <Switch
                  size="small"
                  checked={Boolean(row.is_pinned)}
                  onChange={(v) => toggle(row.slug, 'is_pinned', v)}
                />
              ),
            },
            {
              title: t('tags.col.refCount'),
              dataIndex: 'ref_count',
              width: 110,
              render: (v: number | undefined) => v && v > 0 ? <AntTag color="blue">{v}</AntTag> : <Text type="secondary">0</Text>,
            },
            {
              title: t('tags.col.actions'),
              width: 130,
              fixed: 'right',
              render: (_, row) => {
                const refCount = row.ref_count ?? 0;
                return (
                  <Space>
                    <Button
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => { setEditing(row); setModalOpen(true); }}
                    >
                      {t('tags.btn.edit')}
                    </Button>
                    <Popconfirm
                      title={t('tags.confirm.delete')}
                      description={
                        refCount > 0
                          ? t('tags.cannotDelete', { n: refCount })
                          : t('tags.confirm.deleteDesc')
                      }
                      okButtonProps={{ danger: true, disabled: refCount > 0 }}
                      onConfirm={() => remove(row)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} disabled={refCount > 0} />
                    </Popconfirm>
                  </Space>
                );
              },
            },
          ]}
        />
      </Card>

      <TagFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); reload(); }}
      />
    </>
  );
}

interface TagFormProps {
  open: boolean;
  initial: PmTagRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function TagFormModal({ open, initial, onClose, onSaved }: TagFormProps) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const [form] = Form.useForm<{
    name: string;
    slug?: string;
    sort_order: number;
    is_active: boolean;
    is_pinned: boolean;
  }>();
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?.slug;

  const onAfterOpen = (isOpen: boolean) => {
    if (!isOpen) return;
    form.setFieldsValue({
      name:         initial?.name ?? initial?.display_name ?? '',
      slug:         initial?.slug ?? '',
      sort_order:   initial?.sort_order ?? 0,
      is_active:    Boolean(initial?.is_active ?? true),
      is_pinned:    Boolean(initial?.is_pinned ?? false),
    });
  };

  const submit = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      const body = {
        name: v.name,
        slug: (v.slug?.trim() || v.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '')).slice(0, 64),
        sort_order: v.sort_order ?? 0,
        is_active: v.is_active,
        is_pinned: v.is_pinned,
      };
      if (isEdit) {
        await polymindApi.updateTag(initial!.slug, body);
        message.success(t('tags.toast.updated'));
      } else {
        await polymindApi.createTag(body);
        message.success(t('tags.toast.created'));
      }
      onSaved();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return;
      message.error((err as Error).message || t('tags.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isEdit ? t('tags.modal.edit') : t('tags.modal.new')}
      open={open}
      onOk={submit}
      onCancel={onClose}
      okText={isEdit ? t('tags.btn.save') : t('tags.btn.create')}
      confirmLoading={saving}
      afterOpenChange={onAfterOpen}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={t('tags.field.displayName')}
          rules={[{ required: true, message: t('tags.field.displayNameRequired') }]}
        >
          <Input placeholder={t('tags.field.displayNamePlaceholder')} maxLength={64} />
        </Form.Item>
        <Form.Item
          name="slug"
          label={t('tags.field.slug')}
          extra={t('tags.field.slugHint')}
        >
          <Input placeholder={t('tags.field.slugPlaceholder')} maxLength={48} />
        </Form.Item>
        <Form.Item name="sort_order" label={t('tags.field.sortOrder')}>
          <InputNumber min={0} style={{ width: 120 }} />
        </Form.Item>
        <Space size="large">
          <Form.Item name="is_active" label={t('tags.field.active')} valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
          <Form.Item name="is_pinned" label={t('tags.field.pinned')} valuePropName="checked" style={{ marginBottom: 0 }}>
            <Switch />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
}

function BulkTagging() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const [tags, setTags] = useState<PmTagRow[]>([]);
  const [selectedTagSlug, setSelectedTagSlug] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    polymindApi.listTags().then(setTags).catch(() => {});
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await polymindApi.listEvents({ q: q || undefined, limit: 50 });
      setEvents(res.data || []);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, message]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const apply = async (attach: boolean) => {
    if (selectedTagSlug == null) {
      message.warning(t('tags.bulk.selectTagPlaceholder'));
      return;
    }
    if (selected.length === 0) return;
    setBusy(true);
    try {
      if (attach) {
        const r = await polymindApi.bulkAttachTag(selectedTagSlug, selected);
        message.success(t('tags.bulk.attachResult', {
          n: r.changed.length, skipped: (r.skipped_existing || []).length,
        }));
      } else {
        const r = await polymindApi.bulkDetachTag(selectedTagSlug, selected);
        if (r.changed.length === 0) {
          message.info(t('tags.bulk.nothingChanged'));
        } else {
          message.success(t('tags.bulk.detachResult', { n: r.changed.length }));
        }
      }
      setSelected([]);
      loadEvents();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tagOptions = useMemo(
    () => tags.map((tg) => ({
      label: `${tg.name || tg.display_name || tg.slug}  (${tg.slug})`,
      value: tg.slug,
    })),
    [tags],
  );

  return (
    <Card>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t('tags.bulk.selectTagPlaceholder')}
          options={tagOptions}
          value={selectedTagSlug}
          onChange={(v) => setSelectedTagSlug(v as string | undefined)}
          style={{ width: 320 }}
        />
        <Input.Search
          placeholder={t('tags.bulk.eventSearch')}
          allowClear
          style={{ width: 280 }}
          onSearch={setQ}
        />
        <Button
          type="primary"
          disabled={selectedTagSlug == null || selected.length === 0}
          loading={busy}
          onClick={() => apply(true)}
        >
          {t('tags.bulk.attach')}
        </Button>
        <Button
          danger
          disabled={selectedTagSlug == null || selected.length === 0}
          loading={busy}
          onClick={() => apply(false)}
        >
          {t('tags.bulk.detach')}
        </Button>
        {selected.length > 0 && (
          <Text type="secondary">{t('tags.bulk.selectedCount', { n: selected.length })}</Text>
        )}
      </Space>

      <Table<EventListItem>
        rowKey="slug"
        loading={loading}
        dataSource={events}
        pagination={{ pageSize: 20 }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: (keys) => setSelected(keys as string[]),
          preserveSelectedRowKeys: true,
        }}
        columns={[
          {
            title: t('markets.col.questionMarket'),
            dataIndex: 'question',
            ellipsis: true,
            render: (v: string, row) => (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {v ? <Text>{v}</Text> : <Text type="secondary">—</Text>}
                {row.tags && row.tags.length > 0 && (
                  <Space size={[4, 4]} wrap>
                    {row.tags.map((tg) => (
                      <AntTag
                        key={tg.id}
                        color={tg.slug === selectedTagSlug ? 'green' : 'default'}
                      >
                        {tg.display_name}
                      </AntTag>
                    ))}
                  </Space>
                )}
              </Space>
            ),
          },
          { title: 'Slug', dataIndex: 'slug', width: 200, ellipsis: true,
            render: (v: string) => <Text code>{v}</Text>,
          },
          {
            title: t('tags.bulk.statusCol'),
            dataIndex: 'attached',
            width: 130,
            render: (_, row) => selectedTagSlug != null && (row.tags || []).some((tg) => tg.slug === selectedTagSlug)
              ? <AntTag color="green">{t('tags.bulk.attached')}</AntTag>
              : <Text type="secondary">{t('tags.bulk.notAttached')}</Text>,
          },
        ]}
      />
    </Card>
  );
}
