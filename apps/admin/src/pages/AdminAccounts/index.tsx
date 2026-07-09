import { PageContainer } from '@ant-design/pro-components';
import { CopyOutlined } from '@ant-design/icons';
import {
  Alert, App, Button, Card, Form, Input, Modal, Popconfirm, Table, Tag, Tooltip, Typography,
} from 'antd';
import { useIntl } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { polymindApi, type AdminAccountRow } from '@/services/polymind';

export default function AdminAccountsPage() {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();
  const [rows, setRows] = useState<AdminAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm<{ address: string; label?: string }>();

  const reload = useCallback(() => {
    setLoading(true);
    polymindApi
      .listAdminAccounts()
      .then(setRows)
      .catch((e: Error) => message.error(e.message))
      .finally(() => setLoading(false));
  }, [message]);

  useEffect(() => { reload(); }, [reload]);

  const submitAdd = async () => {
    const v = await form.validateFields();
    setBusy(true);
    try {
      await polymindApi.addAdminAccount({
        address: v.address.trim(),
        label: v.label?.trim() || undefined,
      });
      message.success(t('adminAccounts.toast.added'));
      setAddOpen(false);
      form.resetFields();
      reload();
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await polymindApi.deleteAdminAccount(id);
      message.success(t('adminAccounts.toast.removed'));
      reload();
    } catch (e) {
      message.error((e as Error).message);
    }
  };

  return (
    <PageContainer
      content={t('adminAccounts.subtitle')}
      extra={
        <Button type="primary" onClick={() => setAddOpen(true)}>
          {t('adminAccounts.add')}
        </Button>
      }
    >
      <Card>
        {rows.length === 1 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={t('adminAccounts.lastOne')}
          />
        )}
        <Table<AdminAccountRow>
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={false}
          scroll={{ x: true }}
          columns={[
            { title: t('adminAccounts.col.id'), dataIndex: 'id', width: 70 },
            {
              title: t('adminAccounts.col.address'),
              dataIndex: 'address',
              width: 350,
              render: (v: string) => (
                <Tooltip title={v}>
                  <span style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {v.length > 20 ? v.slice(0, 20) + '...' : v}
                    <CopyOutlined
                      style={{ marginLeft: 6, color: '#1890ff' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(v);
                        message.success('Copied');
                      }}
                    />
                  </span>
                </Tooltip>
              ),
            },
            {
              title: t('adminAccounts.col.label'),
              dataIndex: 'label',
              width: 180,
              render: (v: string) => v ? <Tag>{v}</Tag> : <span style={{ color: '#aaa' }}>—</span>,
            },
            {
              title: t('adminAccounts.col.addedBy'),
              dataIndex: 'added_by',
              width: 220,
              ellipsis: true,
              render: (v: string) => v || <span style={{ color: '#aaa' }}>—</span>,
            },
            { title: t('adminAccounts.col.createdAt'), dataIndex: 'created_at', width: 180 },
            {
              title: t('adminAccounts.col.actions'),
              width: 90,
              fixed: 'right',
              render: (_, row) => (
                <Popconfirm
                  title={t('adminAccounts.removeConfirm')}
                  description={t('adminAccounts.removeConfirmDesc')}
                  okButtonProps={{ danger: true }}
                  disabled={rows.length <= 1}
                  onConfirm={() => remove(row.id)}
                >
                  <Button danger size="small" disabled={rows.length <= 1}>
                    {t('adminAccounts.remove')}
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={t('adminAccounts.modal.title')}
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={submitAdd}
        okText={t('adminAccounts.modal.ok')}
        okButtonProps={{ loading: busy }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="address"
            label={t('adminAccounts.field.address')}
            rules={[{ required: true, message: t('adminAccounts.field.address.required') }]}
          >
            <Input placeholder={t('adminAccounts.field.address.placeholder')} />
          </Form.Item>
          <Form.Item name="label" label={t('adminAccounts.field.label')}>
            <Input
              placeholder={t('adminAccounts.field.label.placeholder')}
              maxLength={64}
            />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
}
