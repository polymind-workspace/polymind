import { PageContainer } from '@ant-design/pro-components';
import {
  App, Button, Card, Collapse, Form, Input, InputNumber, Modal, Radio,
  Select, Space, Switch, Tag, Typography,
} from 'antd';
import {
  CloseOutlined, DeleteOutlined, PlusOutlined, UserOutlined,
} from '@ant-design/icons';
import { useIntl, useLocation, useNavigate } from '@umijs/max';
import { useEffect, useMemo, useState } from 'react';
import { polymindApi, type CardMessageContent } from '@/services/polymind';
import CardPreview from '@/components/CardPreview';
import ImagePicker from '@/components/ImagePicker';
import LinkPickerInput from '@/components/LinkPickerInput';
import UserPickerDrawer from '@/components/UserPickerDrawer';

const { Text } = Typography;

const enc = new TextEncoder();
const byteLen = (s: string | undefined | null) => (s ? enc.encode(s).length : 0);

interface ComposeState {
  pushType: 1 | 2;
  recipients: string[];
  content: CardMessageContent;
  jsonMode: boolean;
  jsonText: string;
}

const DEFAULT_APP_ICON = 'https://polymind-assets.yournpc.ai/polymind/logo-icon.png';

const EMPTY_CONTENT: CardMessageContent = {
  title:  { icon: DEFAULT_APP_ICON, text: 'PolyMind', link: '' },
  header: { type: 1, title: '', subTitle: '' },
};

function ByteHint({ value, max }: { value: string | undefined; max: number }) {
  const n = byteLen(value);
  const danger = n > max;
  return (
    <Text type={danger ? 'danger' : 'secondary'} style={{ fontSize: 11 }}>
      {n} / {max} bytes
    </Text>
  );
}

export default function PushComposePage() {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const initial = (location.state as { draft?: CardMessageContent } | null)?.draft;
  const [state, setState] = useState<ComposeState>({
    pushType: 1,
    recipients: [],
    content: initial ?? EMPTY_CONTENT,
    jsonMode: false,
    jsonText: '',
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!state.jsonMode) {
      setState((s) => ({ ...s, jsonText: JSON.stringify(s.content, null, 2) }));
    }
  }, [state.content, state.jsonMode]);

  const patchContent = (patch: Partial<CardMessageContent>) =>
    setState((s) => ({ ...s, content: { ...s.content, ...patch } }));

  const patchHeader = (patch: Partial<CardMessageContent['header']>) =>
    setState((s) => ({
      ...s,
      content: { ...s.content, header: { ...s.content.header, ...patch } },
    }));

  const patchContentBlock = (patch: Partial<NonNullable<CardMessageContent['content']>>) =>
    setState((s) => ({
      ...s,
      content: {
        ...s.content,
        content: { ...(s.content.content || {}), ...patch },
      },
    }));

  const applyJson = () => {
    try {
      const parsed = JSON.parse(state.jsonText) as CardMessageContent;
      setState((s) => ({ ...s, content: parsed, jsonMode: false }));
      message.success(t('push.json.applied'));
    } catch (e) {
      message.error(t('push.json.invalid', { err: (e as Error).message }));
    }
  };

  const removeRecipient = (id: string) =>
    setState((s) => ({ ...s, recipients: s.recipients.filter((r) => r !== id) }));

  const send = () => {
    if (state.pushType === 2 && state.recipients.length === 0) {
      message.warning(t('push.recipient.required'));
      return;
    }
    const doSend = () => {
      setSending(true);
      const c = state.content;
      const body = c.content?.items?.map((i) => i.content.text).filter(Boolean).join('\n') || '';
      polymindApi
        .pushSend({
          title: c.title.text,
          body,
          recipient_address: state.pushType === 1 ? undefined : state.recipients[0],
          action_url: c.actions?.[0]?.url,
        })
        .then((res) => {
          message.success({
            content: (
              <span>
                {t('push.result.queued', { n: res.queued_count })}
                {'  '}
                <a onClick={() => navigate('/ops/push/history')}>
                  {t('push.result.gotoHistory')}
                </a>
              </span>
            ),
            duration: 6,
          });
        })
        .catch((e: Error) => message.error(e.message))
        .finally(() => setSending(false));
    };
    if (state.pushType === 1) {
      Modal.confirm({
        title:   t('push.confirm.everyone.title'),
        content: t('push.confirm.everyone.content'),
        okButtonProps: { danger: true },
        onOk: doSend,
      });
    } else {
      Modal.confirm({
        title:   t('push.confirm.personal.title', { n: state.recipients.length }),
        content: t('push.confirm.personal.content'),
        onOk: doSend,
      });
    }
  };

  const c = state.content;
  const headerType = c.header.type;

  return (
    <PageContainer>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Card
          size="small"
          style={{ flex: 1, minWidth: 0 }}
          extra={
            <Space>
              <Text type="secondary" style={{ fontSize: 12 }}>{t('push.json.toggle')}</Text>
              <Switch
                size="small"
                checked={state.jsonMode}
                onChange={(v) => setState((s) => ({ ...s, jsonMode: v }))}
              />
              <Button type="link" onClick={() => navigate('/ops/push/history')}>
                {t('push.tab.history')}
              </Button>
            </Space>
          }
        >
          {state.jsonMode ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary">{t('push.json.label')}</Text>
              <Input.TextArea
                rows={20}
                value={state.jsonText}
                onChange={(e) => setState((s) => ({ ...s, jsonText: e.target.value }))}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <Button type="primary" onClick={applyJson}>{t('push.json.applied')}</Button>
            </Space>
          ) : (
            <Collapse defaultActiveKey={['recipient', 'title', 'header', 'content', 'actions']} ghost>
              <Collapse.Panel header={t('push.recipient.section')} key="recipient">
                <Radio.Group
                  value={state.pushType}
                  onChange={(e) => setState((s) => ({ ...s, pushType: e.target.value }))}
                  style={{ marginBottom: 12 }}
                >
                  <Radio.Button value={1}>{t('push.recipient.everyone')}</Radio.Button>
                  <Radio.Button value={2}>{t('push.recipient.personal')}</Radio.Button>
                </Radio.Group>
                {state.pushType === 2 && (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space.Compact style={{ width: '100%' }}>
                      <Input
                        placeholder="luffa_id"
                        onPressEnter={(e) => {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v && !state.recipients.includes(v)) {
                            setState((s) => ({ ...s, recipients: [...s.recipients, v] }));
                            (e.target as HTMLInputElement).value = '';
                          }
                        }}
                      />
                      <Button icon={<UserOutlined />} onClick={() => setPickerOpen(true)}>
                        {t('push.recipient.pickerOpen')}
                      </Button>
                    </Space.Compact>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {t('push.recipient.manualHint')}
                    </Text>
                    {state.recipients.length > 0 && (
                      <Space wrap>
                        {state.recipients.map((id) => (
                          <Tag
                            key={id}
                            closable
                            onClose={() => removeRecipient(id)}
                          >
                            {id}
                          </Tag>
                        ))}
                        <Button size="small" type="link"
                          onClick={() => setState((s) => ({ ...s, recipients: [] }))}>
                          {t('push.recipient.removeAll')}
                        </Button>
                      </Space>
                    )}
                  </Space>
                )}
              </Collapse.Panel>

              <Collapse.Panel header={t('push.section.title')} key="title">
                <Form.Item label={t('push.title.icon')}>
                  <ImagePicker
                    folder="push"
                    value={c.title.icon}
                    onChange={(url) => patchContent({ title: { ...c.title, icon: url } })}
                  />
                </Form.Item>
                <Form.Item
                  label={t('push.title.text')}
                  extra={<ByteHint value={c.title.text} max={30} />}
                >
                  <Input
                    value={c.title.text}
                    onChange={(e) => patchContent({ title: { ...c.title, text: e.target.value } })}
                  />
                </Form.Item>
                <Form.Item label={t('push.title.link')}>
                  <LinkPickerInput
                    value={c.title.link}
                    onChange={(v) => patchContent({ title: { ...c.title, link: v } })}
                  />
                </Form.Item>
              </Collapse.Panel>

              <Collapse.Panel header={t('push.section.header')} key="header">
                <Form.Item label={t('push.header.type')}>
                  <Radio.Group
                    value={headerType}
                    onChange={(e) => patchHeader({ type: e.target.value })}
                  >
                    <Radio.Button value={1}>{t('push.header.type.opt1')}</Radio.Button>
                    <Radio.Button value={2}>{t('push.header.type.opt2')}</Radio.Button>
                    <Radio.Button value={3}>{t('push.header.type.opt3')}</Radio.Button>
                    <Radio.Button value={4}>{t('push.header.type.opt4')}</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                <Form.Item label={t('push.header.title')} extra={<ByteHint value={c.header.title} max={60} />}>
                  <Input
                    value={c.header.title}
                    onChange={(e) => patchHeader({ title: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label={t('push.header.subTitle')} extra={<ByteHint value={c.header.subTitle} max={160} />}>
                  <Input.TextArea
                    rows={2}
                    value={c.header.subTitle}
                    onChange={(e) => patchHeader({ subTitle: e.target.value })}
                  />
                </Form.Item>

                {(headerType === 1 || headerType === 2) && (
                  <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                    <Text type="secondary">{t('push.header.source')}</Text>
                    <Form.Item label={t('push.header.source.status')}>
                      <Select
                        allowClear
                        style={{ width: 200 }}
                        value={c.header.source?.status}
                        onChange={(v) => patchHeader({
                          source: { ...(c.header.source || {}), status: v as 0 | 1 | 2 | undefined },
                        })}
                        options={[
                          { value: 0, label: t('push.header.source.status.opt0') },
                          { value: 1, label: t('push.header.source.status.opt1') },
                          { value: 2, label: t('push.header.source.status.opt2') },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item label={t('push.header.source.text')} extra={<ByteHint value={c.header.source?.text} max={160} />}>
                      <Input
                        value={c.header.source?.text}
                        onChange={(e) => patchHeader({
                          source: { ...(c.header.source || {}), text: e.target.value },
                        })}
                      />
                    </Form.Item>
                  </Space>
                )}

                {(headerType === 3 || headerType === 4) && (
                  <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                    <Form.Item label={t('push.header.source.url')}>
                      <ImagePicker
                        folder="push"
                        value={c.header.source?.url || ''}
                        onChange={(url) => patchHeader({
                          source: { ...(c.header.source || {}), url },
                        })}
                      />
                    </Form.Item>
                    <Form.Item label={t('push.header.source.link')}>
                      <LinkPickerInput
                        value={c.header.source?.link}
                        onChange={(v) => patchHeader({
                          source: { ...(c.header.source || {}), link: v },
                        })}
                      />
                    </Form.Item>
                  </Space>
                )}
              </Collapse.Panel>

              <Collapse.Panel header={t('push.section.content')} key="content">
                <Form.Item label={t('push.content.title')} extra={<ByteHint value={c.content?.title} max={80} />}>
                  <Input
                    value={c.content?.title}
                    onChange={(e) => patchContentBlock({ title: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label={t('push.content.subTitle')} extra={<ByteHint value={c.content?.subTitle} max={160} />}>
                  <Input.TextArea
                    rows={2}
                    value={c.content?.subTitle}
                    onChange={(e) => patchContentBlock({ subTitle: e.target.value })}
                  />
                </Form.Item>
                <Text type="secondary">{t('push.content.items')}</Text>
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(c.content?.items || []).map((it, idx) => (
                    <Card
                      size="small"
                      key={idx}
                      title={`#${idx + 1}`}
                      extra={
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            const next = [...(c.content?.items || [])];
                            next.splice(idx, 1);
                            patchContentBlock({ items: next });
                          }}
                        />
                      }
                    >
                      <Form.Item label={t('push.content.item.title')} extra={<ByteHint value={it.title} max={15} />}>
                        <Input
                          value={it.title}
                          onChange={(e) => {
                            const next = [...(c.content?.items || [])];
                            next[idx] = { ...it, title: e.target.value };
                            patchContentBlock({ items: next });
                          }}
                        />
                      </Form.Item>
                      <Form.Item label={t('push.content.item.type')}>
                        <Radio.Group
                          value={it.content.type}
                          onChange={(e) => {
                            const next = [...(c.content?.items || [])];
                            next[idx] = { ...it, content: { ...it.content, type: e.target.value } };
                            patchContentBlock({ items: next });
                          }}
                        >
                          <Radio.Button value={0}>{t('push.content.item.type.opt0')}</Radio.Button>
                          <Radio.Button value={1}>{t('push.content.item.type.opt1')}</Radio.Button>
                          <Radio.Button value={2}>{t('push.content.item.type.opt2')}</Radio.Button>
                          <Radio.Button value={3}>{t('push.content.item.type.opt3')}</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                      {it.content.type !== 3 && (
                        <Form.Item label={t('push.content.item.text')} extra={<ByteHint value={it.content.text} max={80} />}>
                          <Input
                            value={it.content.text}
                            onChange={(e) => {
                              const next = [...(c.content?.items || [])];
                              next[idx] = { ...it, content: { ...it.content, text: e.target.value } };
                              patchContentBlock({ items: next });
                            }}
                          />
                        </Form.Item>
                      )}
                      {it.content.type === 1 && (
                        <Form.Item label={t('push.content.item.url')}>
                          <LinkPickerInput
                            value={it.content.url}
                            onChange={(v) => {
                              const next = [...(c.content?.items || [])];
                              next[idx] = { ...it, content: { ...it.content, url: v } };
                              patchContentBlock({ items: next });
                            }}
                          />
                        </Form.Item>
                      )}
                      {it.content.type === 3 && (
                        <Form.Item label={t('push.content.item.url')}>
                          <Input
                            value={it.content.url}
                            onChange={(e) => {
                              const next = [...(c.content?.items || [])];
                              next[idx] = { ...it, content: { ...it.content, url: e.target.value } };
                              patchContentBlock({ items: next });
                            }}
                          />
                        </Form.Item>
                      )}
                      {it.content.type === 2 && (
                        <Form.Item label={t('push.content.item.copytext')}>
                          <Input
                            value={it.content.copytext}
                            onChange={(e) => {
                              const next = [...(c.content?.items || [])];
                              next[idx] = { ...it, content: { ...it.content, copytext: e.target.value } };
                              patchContentBlock({ items: next });
                            }}
                          />
                        </Form.Item>
                      )}
                      {it.content.type === 0 && (
                        <Form.Item label={t('push.content.item.color')}>
                          <Radio.Group
                            value={it.content.color ?? 1}
                            onChange={(e) => {
                              const next = [...(c.content?.items || [])];
                              next[idx] = { ...it, content: { ...it.content, color: e.target.value } };
                              patchContentBlock({ items: next });
                            }}
                          >
                            <Radio.Button value={1}>{t('push.content.item.color.opt1')}</Radio.Button>
                            <Radio.Button value={2}>{t('push.content.item.color.opt2')}</Radio.Button>
                          </Radio.Group>
                        </Form.Item>
                      )}
                    </Card>
                  ))}
                  <Button
                    block
                    icon={<PlusOutlined />}
                    disabled={(c.content?.items || []).length >= 6}
                    onClick={() => patchContentBlock({
                      items: [...(c.content?.items || []), { title: '', content: { type: 0, text: '', color: 1 } }],
                    })}
                  >
                    {t('push.content.addItem')}
                  </Button>
                </div>
              </Collapse.Panel>

              <Collapse.Panel header={t('push.section.actions')} key="actions">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(c.actions || []).map((a, idx) => (
                    <Card
                      size="small"
                      key={idx}
                      title={`#${idx + 1}`}
                      extra={
                        <Button
                          size="small"
                          danger
                          icon={<CloseOutlined />}
                          onClick={() => {
                            const next = [...(c.actions || [])];
                            next.splice(idx, 1);
                            patchContent({ actions: next });
                          }}
                        />
                      }
                    >
                      <Form.Item label={t('push.actions.title')} extra={<ByteHint value={a.title} max={60} />}>
                        <Input
                          value={a.title}
                          onChange={(e) => {
                            const next = [...(c.actions || [])];
                            next[idx] = { ...a, title: e.target.value };
                            patchContent({ actions: next });
                          }}
                        />
                      </Form.Item>
                      <Form.Item label={t('push.actions.url')}>
                        <LinkPickerInput
                          value={a.url}
                          onChange={(v) => {
                            const next = [...(c.actions || [])];
                            next[idx] = { ...a, url: v };
                            patchContent({ actions: next });
                          }}
                        />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button
                    block
                    icon={<PlusOutlined />}
                    disabled={(c.actions || []).length >= 3}
                    onClick={() => patchContent({
                      actions: [...(c.actions || []), { title: '', url: '' }],
                    })}
                  >
                    {t('push.actions.add')}
                  </Button>
                </div>
              </Collapse.Panel>
            </Collapse>
          )}

          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button
              type="primary"
              size="large"
              loading={sending}
              onClick={send}
              danger={state.pushType === 1}
            >
              {sending ? t('push.submit.sending') : t('push.submit.send')}
            </Button>
          </div>
        </Card>

        <div
          style={{
            flexShrink: 0,
            position: 'sticky',
            top: 80,
            alignSelf: 'flex-start',
            maxHeight: 'calc(100vh - 104px)',
            overflowY: 'auto',
          }}
        >
          <CardPreview content={c} />
        </div>
      </div>

      <UserPickerDrawer
        open={pickerOpen}
        initialSelected={state.recipients}
        onClose={() => setPickerOpen(false)}
        onConfirm={(ids) => {
          setState((s) => ({ ...s, recipients: ids }));
          setPickerOpen(false);
        }}
      />
    </PageContainer>
  );
}
