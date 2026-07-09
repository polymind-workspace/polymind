import { PageContainer, ProTable, type ActionType, type ProColumns } from '@ant-design/pro-components';
import {
  App, Button, Form, Input, InputNumber, Modal, Popconfirm, Select, Space,
  Switch, Tag, Tooltip, Typography,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, ExportOutlined, LinkOutlined, PlusOutlined,
  PushpinFilled, PushpinOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { useMemo, useRef, useState } from 'react';
import { downloadCsv, polymindApi, type ActivityRow } from '@/services/polymind';
import ImagePicker from '@/components/ImagePicker';

const { Text } = Typography;

const PRESET_TAGS: Array<{ name: string; color: string }> = [
  { name: 'Event',    color: 'blue'   },
  { name: 'News',     color: 'green'  },
  { name: 'Activity', color: 'orange' },
  { name: 'Campaign', color: 'purple' },
  { name: 'Tutorial', color: 'cyan'   },
  { name: 'Airdrop',  color: 'gold'   },
];
const PRESET_COLOR: Record<string, string> = Object.fromEntries(
  PRESET_TAGS.map((p) => [p.name, p.color]),
);

interface FormValues {
  title: string;
  description?: string;
  tags: string[];
  cover_image_url?: string;
  detail_url?: string;
  open_in_luffa: boolean;
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
}

interface FormProps {
  open: boolean;
  initial?: ActivityRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function ActivityFormModal({ open, initial, onClose, onSaved }: FormProps) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const sortOrder = Form.useWatch('sort_order', form);
  const isPinned = sortOrder === 0;
  const isEdit = !!initial?.id;

  const submit = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      const payload = {
        title: v.title,
        description: v.description || null,
        tags: v.tags?.length ? v.tags : ['Event'],
        cover_image_url: v.cover_image_url || null,
        detail_url: v.detail_url || null,
        open_in_luffa: v.open_in_luffa ? 1 : 0,
        is_featured: v.is_featured ? 1 : 0,
        sort_order: v.sort_order ?? 0,
        is_active: v.is_active ? 1 : 0,
      };
      if (isEdit) {
        await polymindApi.updateActivity(initial!.id, payload as never);
        message.success(t('activities.toast.updated'));
      } else {
        await polymindApi.createActivity(payload as never);
        message.success(t('activities.toast.created'));
      }
      onSaved();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return;
      message.error((err as Error).message || t('activities.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onAfterOpen = (isOpen: boolean) => {
    if (!isOpen) return;
    form.setFieldsValue({
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      tags: Array.isArray(initial?.tags) && initial.tags.length ? initial.tags : ['Event'],
      cover_image_url: initial?.cover_image_url ?? '',
      detail_url: initial?.detail_url ?? '',
      open_in_luffa: (initial?.open_in_luffa ?? 0) === 1,
      is_featured: (initial?.is_featured ?? 0) === 1,
      sort_order: initial?.sort_order ?? 0,
      is_active: (initial?.is_active ?? 1) === 1,
    });
  };

  return (
    <Modal
      title={isEdit ? t('activities.modal.edit') : t('activities.modal.new')}
      open={open}
      onOk={submit}
      onCancel={onClose}
      okText={isEdit ? t('activities.btn.save') : t('activities.btn.create')}
      confirmLoading={saving}
      afterOpenChange={onAfterOpen}
      width={580}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
        <Form.Item
          name="title"
          label={t('activities.field.title')}
          rules={[{ required: true, message: t('activities.field.titleRequired') }]}
          style={{ marginBottom: 10 }}
        >
          <Input placeholder={t('activities.field.titlePlaceholder')} maxLength={255} showCount />
        </Form.Item>

        <Form.Item name="description" label={t('activities.field.description')} style={{ marginBottom: 10 }}>
          <Input.TextArea placeholder={t('activities.field.descriptionPlaceholder')} rows={2} maxLength={500} showCount />
        </Form.Item>

        <Form.Item
          name="tags"
          label={t('activities.field.tags')}
          rules={[{ required: true, message: t('activities.field.tagsRequired') }]}
          style={{ marginBottom: 6 }}
        >
          <Select
            mode="tags"
            placeholder={t('activities.field.tagsPlaceholder')}
            tokenSeparators={[',']}
            options={PRESET_TAGS.map((p) => ({ label: p.name, value: p.name }))}
            tagRender={({ label, value, closable, onClose: tagClose }) => (
              <Tag
                color={PRESET_COLOR[String(value)] ?? 'default'}
                closable={closable}
                onClose={tagClose}
                style={{ marginRight: 3 }}
              >
                {label}
              </Tag>
            )}
          />
        </Form.Item>

        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>
            {t('activities.field.presets')}
          </span>
          {PRESET_TAGS.map((p) => (
            <Tag
              key={p.name}
              color={p.color}
              style={{ cursor: 'pointer', margin: 0 }}
              onClick={() => {
                const current: string[] = form.getFieldValue('tags') || [];
                if (!current.includes(p.name)) form.setFieldsValue({ tags: [...current, p.name] });
              }}
            >
              {p.name}
            </Tag>
          ))}
        </div>

        <Form.Item name="cover_image_url" label={t('activities.field.cover')} style={{ marginBottom: 10 }}>
          <ImagePicker folder="activities" />
        </Form.Item>

        <Form.Item name="detail_url" label={t('activities.field.detailUrl')} style={{ marginBottom: 10 }}>
          <Input placeholder={t('activities.field.detailUrlPlaceholder')} />
        </Form.Item>

        <Form.Item
          name="open_in_luffa"
          label={t('activities.field.openInLuffa')}
          valuePropName="checked"
          extra={t('activities.field.openInLuffaHint')}
          style={{ marginBottom: 10 }}
        >
          <Switch checkedChildren={t('activities.toggle.yes')} unCheckedChildren={t('activities.toggle.no')} />
        </Form.Item>

        <Form.Item label={t('activities.field.visibility')} style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#888' }}>{t('activities.field.banner')}</span>
              <Form.Item name="is_featured" valuePropName="checked" noStyle>
                <Switch checkedChildren={t('activities.toggle.yes')} unCheckedChildren={t('activities.toggle.no')} />
              </Form.Item>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#888' }}>{t('activities.field.active')}</span>
              <Form.Item name="is_active" valuePropName="checked" noStyle>
                <Switch checkedChildren={t('activities.toggle.on')} unCheckedChildren={t('activities.toggle.off')} />
              </Form.Item>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: '#888' }}>
                {t('activities.field.sortOrder')}{' '}
                <Text type="secondary" style={{ fontSize: 11 }}>{t('activities.field.sortHint')}</Text>
              </span>
              <Space.Compact>
                <Form.Item name="sort_order" noStyle>
                  <InputNumber min={0} style={{ width: 80 }} />
                </Form.Item>
                <Tooltip title={isPinned ? t('activities.pin.pinned') : t('activities.pin.pinToTop')}>
                  <Button
                    type={isPinned ? 'primary' : 'default'}
                    icon={isPinned ? <PushpinFilled /> : <PushpinOutlined />}
                    onClick={() => form.setFieldsValue({ sort_order: isPinned ? 10 : 0 })}
                  >
                    {isPinned ? t('activities.pin.pinned') : t('activities.pin.pin')}
                  </Button>
                </Tooltip>
              </Space.Compact>
            </div>
          </div>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default function ActivitiesPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const actionRef = useRef<ActionType | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ActivityRow | null>(null);
  const [counts, setCounts] = useState({ banner: 0, active: 0 });
  const [bannerFilter, setBannerFilter] = useState<'all' | 'on' | 'off'>('all');
  const [activeFilter, setActiveFilter] = useState<'all' | 'on' | 'off'>('all');

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (row: ActivityRow) => { setEditing(row); setModalOpen(true); };
  const onSaved = () => { setModalOpen(false); actionRef.current?.reload(); };

  const remove = async (id: number) => {
    try {
      await polymindApi.deleteActivity(id);
      message.success(t('activities.toast.deleted'));
      actionRef.current?.reload();
    } catch (err) {
      message.error((err as Error).message || t('activities.toast.deleteFailed'));
    }
  };

  const toggle = async (id: number, field: 'is_featured' | 'is_active' | 'open_in_luffa', val: boolean) => {
    try {
      await polymindApi.updateActivity(id, { [field]: val ? 1 : 0 } as never);
      actionRef.current?.reload();
    } catch (err) {
      message.error((err as Error).message || t('activities.toast.updateFailed'));
    }
  };

  const columns = useMemo<ProColumns<ActivityRow>[]>(() => [
    { title: 'ID', dataIndex: 'id', width: 60, search: false },
    {
      title: t('activities.col.cover'),
      dataIndex: 'cover_image_url',
      width: 96,
      search: false,
      render: (_, row) =>
        row.cover_image_url ? (
          <img
            src={row.cover_image_url}
            alt="cover"
            style={{ width: 72, height: 40, objectFit: 'cover', borderRadius: 4 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: t('activities.col.title'),
      dataIndex: 'title',
      width: 220,
      ellipsis: true,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{row.title}</Text>
          {row.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {row.description.length > 60 ? `${row.description.slice(0, 60)}…` : row.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('activities.col.tags'),
      dataIndex: 'tags',
      width: 130,
      search: false,
      render: (_, row) => (
        <Space size={[4, 4]} wrap>
          {(row.tags || []).map((tg) => (
            <Tag key={tg} color={PRESET_COLOR[tg] ?? 'default'}>{tg}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('activities.col.detailUrl'),
      dataIndex: 'detail_url',
      width: 160,
      search: false,
      render: (_, row) =>
        row.detail_url ? (
          <Tooltip title={row.detail_url}>
            <a href={row.detail_url} target="_blank" rel="noreferrer">
              <LinkOutlined />{' '}
              {row.detail_url.length > 30 ? `…${row.detail_url.slice(-28)}` : row.detail_url}
            </a>
          </Tooltip>
        ) : <Text type="secondary">—</Text>,
    },
    {
      title: (
        <Tooltip title={t('activities.col.openInLuffaTooltip')}>
          <span style={{ whiteSpace: 'nowrap' }}>{t('activities.col.openInLuffa')}</span>
        </Tooltip>
      ),
      dataIndex: 'open_in_luffa',
      width: 112,
      search: false,
      render: (_, row) => (
        <Switch
          size="small"
          checked={row.open_in_luffa === 1}
          onChange={(val) => toggle(row.id, 'open_in_luffa', val)}
        />
      ),
    },
    {
      title: (
        <Tooltip title={t('activities.col.bannerTooltip')}>
          <span style={{ whiteSpace: 'nowrap' }}>{t('activities.col.banner')} ({counts.banner})</span>
        </Tooltip>
      ),
      dataIndex: 'is_featured',
      width: 112,
      search: false,
      render: (_, row) => (
        <Switch
          size="small"
          checked={row.is_featured === 1}
          onChange={(val) => toggle(row.id, 'is_featured', val)}
        />
      ),
    },
    {
      title: <span style={{ whiteSpace: 'nowrap' }}>{t('activities.col.active')} ({counts.active})</span>,
      dataIndex: 'is_active',
      width: 108,
      search: false,
      render: (_, row) => (
        <Switch
          size="small"
          checked={row.is_active === 1}
          onChange={(val) => toggle(row.id, 'is_active', val)}
        />
      ),
    },
    { title: t('activities.col.order'), dataIndex: 'sort_order', width: 70, search: false },
    {
      title: t('activities.col.created'),
      dataIndex: 'created_at',
      width: 120,
      search: false,
      render: (val) => val ? String(val).slice(0, 10) : '—',
    },
    {
      title: t('activities.col.actions'),
      width: 120,
      fixed: 'right',
      search: false,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
            {t('activities.btn.edit')}
          </Button>
          <Popconfirm
            title={t('activities.confirm.delete')}
            description={t('activities.confirm.deleteDesc')}
            onConfirm={() => remove(row.id)}
            okText={t('activities.btn.delete')}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ], [intl.locale, counts.banner, counts.active]);

  return (
    <PageContainer>
      <ProTable<ActivityRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        params={{ bannerFilter, activeFilter }}
        request={async (params) => {
          const { current: page = 1, pageSize: page_size = 20, tag } = params as {
            current?: number; pageSize?: number; tag?: string;
          };
          const is_featured = bannerFilter === 'all' ? undefined : bannerFilter === 'on' ? 1 : 0;
          const is_active = activeFilter === 'all' ? undefined : activeFilter === 'on' ? 1 : 0;
          const res = await polymindApi.listActivities({
            page, page_size, tag, is_featured, is_active,
          });
          setCounts({ banner: res.banner_count ?? 0, active: res.active_count ?? 0 });
          return {
            data: res.data ?? [],
            total: res.total ?? 0,
            success: res.ret === 200,
          };
        }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        toolBarRender={() => [
          <div
            key="toolbar"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}
          >
            <Space wrap>
              <Select
                value={bannerFilter}
                onChange={setBannerFilter}
                style={{ width: 150 }}
                options={[
                  { label: t('activities.filter.bannerAll'), value: 'all' },
                  { label: t('activities.filter.bannerOn'),  value: 'on'  },
                  { label: t('activities.filter.bannerOff'), value: 'off' },
                ]}
              />
              <Select
                value={activeFilter}
                onChange={setActiveFilter}
                style={{ width: 150 }}
                options={[
                  { label: t('activities.filter.activeAll'), value: 'all' },
                  { label: t('activities.filter.activeOn'),  value: 'on'  },
                  { label: t('activities.filter.activeOff'), value: 'off' },
                ]}
              />
            </Space>
            <Tooltip title={t('common.exportCsv')} key="export">
              <Button icon={<ExportOutlined />} onClick={() => downloadCsv('/api/v1/activities?download=1')} />
            </Tooltip>,
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('activities.btn.new')}
            </Button>
          </div>,
        ]}
        scroll={{ x: 'max-content' }}
        search={{ labelWidth: 'auto' }}
      />

      <ActivityFormModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />
    </PageContainer>
  );
}
