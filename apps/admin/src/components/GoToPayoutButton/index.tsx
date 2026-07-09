import { App, Button, DatePicker, Form, Input, Modal, Spin } from 'antd';
import { GiftOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from '@umijs/max';
import dayjs from 'dayjs';
import { polymindApi } from '@/services/polymind';

export interface QueryParams {
  query_type?: string;
  reg_start?: string;
  reg_end?: string;
  bet_start?: string;
  bet_end?: string;
  min_bet?: string;
  random_sample?: number;
  q?: string;
  is_pro?: number;
}

interface PayoutItem {
  address: string;
}

interface Props {
  getQueryParams?: () => QueryParams;
  items?: PayoutItem[];
}

export default function GoToPayoutButton({ getQueryParams, items }: Props) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ total: number } | null>(null);

  const amountEdsValue = Form.useWatch('amount_eds', form);
  const amountEds = Number(amountEdsValue) || 10;
  const totalEds = (preview?.total ?? 0) * amountEds;

  const showModal = async () => {
    setOpen(true);
    setPreview(null);
    form.resetFields();
    form.setFieldsValue({
      amount_eds: 10,
      claim_deadline: dayjs().add(30, 'day'),
    });

    if (items) {
      setPreview({ total: items.length });
      return;
    }

    if (!getQueryParams) {
      setPreview({ total: 0 });
      return;
    }

    setBusy(true);
    try {
      const qp = getQueryParams();
      const res = await polymindApi.createPayoutFromQuery({
        name: '预览',
        tag: '',
        claim_deadline: Math.floor(Date.now() / 1000) + 86400,
        query_type: qp.query_type || 'manual',
        reg_start: qp.reg_start,
        reg_end: qp.reg_end,
        bet_start: qp.bet_start,
        bet_end: qp.bet_end,
        min_bet: qp.min_bet || '0.1',
        random_sample: qp.random_sample,
        amount_eds: 10,
        limit: 1000,
      });
      setPreview({ total: res.total });
    } catch {
      setPreview({ total: 0 });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const name = values.name as string;
    const tag = values.tag as string;
    const claimDeadline = Math.floor(values.claim_deadline.valueOf() / 1000);

    setBusy(true);
    try {
      if (items) {
        const validItems = items.filter((i) => i.address?.trim());
        if (validItems.length === 0) {
          message.error('没有有效的发奖地址');
          return;
        }
        const res = await polymindApi.createPayout({
          name,
          tag,
          claim_deadline: claimDeadline,
          items: validItems.map((i) => ({
            address: i.address.trim(),
            amount_eds: amountEds,
          })),
        });
        message.success(`创建成功 #${res.id}`);
        setOpen(false);
        navigate(`/ops/rewards/${res.id}`);
        return;
      }

      if (!getQueryParams) {
        message.error('缺少查询条件');
        return;
      }

      const qp = getQueryParams();
      const res = await polymindApi.createPayoutFromQuery({
        name,
        tag,
        claim_deadline: claimDeadline,
        query_type: qp.query_type || 'manual',
        reg_start: qp.reg_start,
        reg_end: qp.reg_end,
        bet_start: qp.bet_start,
        bet_end: qp.bet_end,
        min_bet: qp.min_bet || '0.1',
        amount_eds: amountEds,
        random_sample: qp.random_sample,
        limit: 1000,
      });
      message.success(`创建成功 #${res.id}`);
      setOpen(false);
      navigate(`/ops/rewards/${res.id}`);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button type="primary" icon={<GiftOutlined />} onClick={showModal}>
        去发奖
      </Button>
      <Modal
        title="创建发奖任务"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        okButtonProps={{ loading: busy }}
        cancelButtonProps={{ disabled: busy }}
        destroyOnClose
      >
        {busy && !preview ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin tip="加载预览..." />
          </div>
        ) : (
          <Form form={form} layout="vertical">
            <Form.Item
              name="name"
              label="发奖名称"
              rules={[{ required: true, message: '请输入发奖名称' }]}
            >
              <Input placeholder="如：排行榜奖励6.12" />
            </Form.Item>
            <Form.Item name="tag" label="标签">
              <Input placeholder="如：6月运营" />
            </Form.Item>
            <Form.Item
              name="amount_eds"
              label="每人金额 (EDS)"
              rules={[{ required: true, message: '请输入金额' }]}
            >
              <Input type="number" min={0.01} step={0.01} />
            </Form.Item>
            <Form.Item
              name="claim_deadline"
              label="领取截止日期"
              rules={[{ required: true, message: '请选择截止日期' }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }}>
              <p style={{ margin: 0 }}>
                <strong>预计人数:</strong> {preview?.total ?? '-'} 人
              </p>
              <p style={{ margin: '8px 0 0 0' }}>
                <strong>预计总额:</strong> {totalEds.toFixed(4)} EDS
              </p>
            </div>
          </Form>
        )}
      </Modal>
    </>
  );
}
