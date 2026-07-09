import {
  CheckCircleFilled, CloseCircleFilled, CopyOutlined, ExclamationCircleFilled,
  LinkOutlined,
} from '@ant-design/icons';
import { Typography } from 'antd';
import { useIntl } from '@umijs/max';
import type { CSSProperties } from 'react';
import type { CardMessageContent } from '@/services/polymind';

const { Text } = Typography;

interface Props {
  content?: CardMessageContent | null;
  width?: number;
}

const COLOR_BG = '#1f2336';
const COLOR_PANEL = '#262a3d';
const COLOR_BORDER = '#3a3f55';
const COLOR_TEXT = '#e8eaf0';
const COLOR_MUTED = '#9aa1b3';
const COLOR_ALERT = '#ff7a7a';
const COLOR_LINK = '#7aa6ff';

function statusIcon(s?: 0 | 1 | 2) {
  switch (s) {
    case 0: return <CheckCircleFilled style={{ color: '#52c41a' }} />;
    case 1: return <CloseCircleFilled style={{ color: COLOR_ALERT }} />;
    case 2: return <ExclamationCircleFilled style={{ color: '#faad14' }} />;
    default: return null;
  }
}

export default function CardPreview({ content, width = 320 }: Props) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });

  if (!content || !content.header) {
    return (
      <div
        style={{
          width,
          minHeight: 200,
          borderRadius: 14,
          background: COLOR_BG,
          color: COLOR_MUTED,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          fontSize: 12,
        }}
      >
        {t('push.preview.empty')}
      </div>
    );
  }

  const headerType = content.header.type;
  const titleAlign: CSSProperties['textAlign'] = headerType === 2 ? 'left' : 'center';

  return (
    <div
      style={{
        width,
        borderRadius: 14,
        background: COLOR_BG,
        color: COLOR_TEXT,
        overflow: 'hidden',
        boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
        fontSize: 13,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderBottom: `1px solid ${COLOR_BORDER}`,
      }}>
        {content.title?.icon ? (
          <img
            src={content.title.icon}
            alt=""
            style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
          />
        ) : (
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: COLOR_PANEL }} />
        )}
        <span style={{ fontWeight: 500, flex: 1, fontSize: 12 }}>
          {content.title?.text || '—'}
        </span>
        {content.title?.link && (
          <LinkOutlined style={{ color: COLOR_MUTED, fontSize: 12 }} />
        )}
      </div>

      <div style={{ padding: '12px 14px' }}>
        {(headerType === 3 || headerType === 4) && content.header.source?.url && (
          <img
            src={content.header.source.url}
            alt=""
            style={{
              width: '100%',
              height: headerType === 3 ? 110 : 56,
              objectFit: 'cover',
              borderRadius: 8,
              marginBottom: 8,
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
          />
        )}
        {content.header.title && (
          <div style={{ textAlign: titleAlign, fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>
            {content.header.title}
          </div>
        )}
        {content.header.subTitle && (
          <div style={{
            textAlign: titleAlign, color: COLOR_MUTED,
            fontSize: 12, marginTop: 4, lineHeight: 1.5,
          }}>
            {content.header.subTitle}
          </div>
        )}
        {(headerType === 1 || headerType === 2) && content.header.source && (
          <div style={{
            marginTop: 10, padding: '8px 10px',
            background: COLOR_PANEL, borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12,
          }}>
            {statusIcon(content.header.source.status)}
            <span>{content.header.source.text || ''}</span>
          </div>
        )}
      </div>

      {content.content && (
        <div style={{
          padding: '4px 14px 12px',
          borderTop: `1px solid ${COLOR_BORDER}`,
          paddingTop: 12,
        }}>
          {content.content.title && (
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
              {content.content.title}
            </div>
          )}
          {content.content.subTitle && (
            <div style={{ color: COLOR_MUTED, fontSize: 12, marginBottom: 10 }}>
              {content.content.subTitle}
            </div>
          )}
          {(content.content.items || []).map((it, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '6px 0', borderTop: idx > 0 ? `1px dashed ${COLOR_BORDER}` : 'none',
                fontSize: 12,
              }}
            >
              <span style={{ flexShrink: 0, color: COLOR_MUTED, minWidth: 70 }}>
                {it.title || ''}
              </span>
              <span style={{ flex: 1, minWidth: 0, wordBreak: 'break-all' }}>
                {renderItemContent(it.content)}
              </span>
            </div>
          ))}
        </div>
      )}

      {content.actions && content.actions.length > 0 && (
        <div style={{
          padding: '8px 14px 12px', borderTop: `1px solid ${COLOR_BORDER}`,
          display: 'flex', gap: 6, flexDirection: content.actions.length > 1 ? 'row' : 'column',
        }}>
          {content.actions.map((a, i) => (
            <button
              key={i}
              type="button"
              style={{
                flex: 1,
                padding: '8px 10px',
                background: COLOR_LINK + '22',
                color: COLOR_LINK,
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'default',
              }}
            >
              {a.title || '(button)'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function renderItemContent(c: import('@/services/polymind').CardItemContent) {
  if (!c) return null;
  switch (c.type) {
    case 0:
      return (
        <Text style={{ color: c.color === 2 ? COLOR_ALERT : COLOR_TEXT, fontSize: 12 }}>
          {c.text || ''}
        </Text>
      );
    case 1:
      return (
        <Text style={{ color: COLOR_LINK, fontSize: 12 }}>
          <LinkOutlined style={{ marginRight: 4 }} />{c.text || c.url || ''}
        </Text>
      );
    case 2:
      return (
        <Text style={{ color: COLOR_LINK, fontSize: 12 }}>
          <CopyOutlined style={{ marginRight: 4 }} />
          {c.text || ''}
          {c.copytext && (
            <Text style={{ color: COLOR_MUTED, marginLeft: 4, fontSize: 11 }}>
              ({c.copytext})
            </Text>
          )}
        </Text>
      );
    case 3:
      return c.url ? (
        <img
          src={c.url}
          alt=""
          style={{ maxWidth: '100%', borderRadius: 4 }}
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
        />
      ) : null;
    default:
      return null;
  }
}
