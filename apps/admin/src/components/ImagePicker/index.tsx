import {
  Button, Modal, Pagination, Popconfirm, Space, Spin, Typography, Upload,
  App,
} from 'antd';
import {
  DeleteOutlined, PictureOutlined, UploadOutlined,
} from '@ant-design/icons';
import { useIntl } from '@umijs/max';
import { useState } from 'react';
import { polymindApi, type MediaImage } from '@/services/polymind';

const { Text } = Typography;

export interface ImagePickerProps {
  value?: string;
  onChange?: (url: string) => void;
  folder?: 'activities' | 'push' | 'misc';
}

function formatBytes(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_MB = 5;

export default function ImagePicker({ value, onChange, folder }: ImagePickerProps) {
  const intl = useIntl();
  const t = (id: string) => intl.formatMessage({ id });
  const { message } = App.useApp();

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [images, setImages] = useState<MediaImage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const loadImages = async (p = 1) => {
    setLoading(true);
    try {
      const res = await polymindApi.listMediaImages(p, 20);
      setImages(res.data || []);
      setTotal(res.total || 0);
      setPage(p);
    } catch {
      message.error(t('imagePicker.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const openLibrary = () => { setLibraryOpen(true); loadImages(1); };
  const pick = (url: string) => { onChange?.(url); setLibraryOpen(false); };

  const removeFromLibrary = async (img: MediaImage) => {
    try {
      await polymindApi.deleteMediaImage(img.id);
      message.success(t('imagePicker.deleted'));
      if (value === img.url) onChange?.('');
      loadImages(page);
    } catch (err) {
      const msg = (err as Error).message || t('imagePicker.deleteFailed');
      if (msg.includes('still used')) {
        Modal.warning({ title: t('imagePicker.cannotDelete'), content: msg });
        return;
      }
      message.error(msg);
    }
  };

  const beforeUpload = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      message.error(t('imagePicker.typeError'));
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      message.error(t('imagePicker.sizeError'));
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const handleUpload = async (options: { file: File; onSuccess?: (r: unknown) => void; onError?: (e: Error) => void }) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    try {
      const res = await polymindApi.uploadMediaImage(file, folder);
      onChange?.(res.url);
      message.success(t('imagePicker.uploaded'));
      onSuccess?.(res);
      if (libraryOpen) loadImages(1);
    } catch (err) {
      const e = err as Error;
      message.error(e.message || t('imagePicker.uploadFailed'));
      onError?.(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }}>
        {value ? (
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img
              src={value}
              alt="cover"
              style={{
                width: 240, height: 90, objectFit: 'contain',
                borderRadius: 6, border: '1px solid #d9d9d9', display: 'block',
                background: '#fafafa',
              }}
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
            />
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onChange?.('')}
              style={{
                position: 'absolute', top: 4, right: 4,
                background: 'rgba(0,0,0,0.5)', color: '#fff',
                border: 'none', borderRadius: 4,
              }}
            />
          </div>
        ) : (
          <div style={{
            width: 240, height: 90, border: '1px dashed #d9d9d9', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#bbb', background: '#fafafa',
          }}>
            <PictureOutlined style={{ fontSize: 28 }} />
          </div>
        )}

        <Space>
          <Upload
            accept="image/jpeg,image/png,image/gif,image/webp"
            showUploadList={false}
            beforeUpload={beforeUpload as never}
            customRequest={handleUpload as never}
            multiple={false}
          >
            <Button icon={<UploadOutlined />} loading={uploading} size="small">
              {t('imagePicker.upload')}
            </Button>
          </Upload>
          <Button icon={<PictureOutlined />} onClick={openLibrary} size="small">
            {t('imagePicker.chooseLibrary')}
          </Button>
        </Space>
      </Space>

      <Modal
        title={t('imagePicker.libraryTitle')}
        open={libraryOpen}
        onCancel={() => setLibraryOpen(false)}
        footer={null}
        width={860}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        <Spin spinning={loading}>
          <div style={{ marginBottom: 16 }}>
            <Upload
              accept="image/jpeg,image/png,image/gif,image/webp"
              showUploadList={false}
              beforeUpload={beforeUpload as never}
              customRequest={handleUpload as never}
              multiple={false}
            >
              <Button icon={<UploadOutlined />} loading={uploading}>
                {t('imagePicker.uploadNew')}
              </Button>
            </Upload>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {images.map((img) => (
              <div
                key={img.id}
                onMouseEnter={() => setHoveredId(img.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  position: 'relative',
                  border: `2px solid ${hoveredId === img.id ? '#1677ff' : '#f0f0f0'}`,
                  borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                  transition: 'border-color 0.15s', background: '#fafafa',
                }}
              >
                <img
                  src={img.url}
                  alt={img.filename}
                  onClick={() => pick(img.url)}
                  style={{
                    width: '100%',
                    height: 80,
                    objectFit: 'contain',
                    display: 'block',
                  }}
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                />
                <div style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text ellipsis style={{ fontSize: 11, color: '#666', flex: 1, minWidth: 0 }} title={img.filename}>
                    {img.filename}
                  </Text>
                  <Popconfirm
                    title={t('imagePicker.deleteConfirm')}
                    onConfirm={() => removeFromLibrary(img)}
                    okText={t('imagePicker.delete')}
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text" danger size="small"
                      icon={<DeleteOutlined />}
                      style={{ flexShrink: 0, padding: '0 2px' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
                {img.size ? (
                  <div style={{ padding: '0 6px 4px', fontSize: 10, color: '#aaa' }}>
                    {formatBytes(img.size)}
                  </div>
                ) : null}
              </div>
            ))}

            {images.length === 0 && !loading && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#bbb', padding: '40px 0' }}>
                <PictureOutlined style={{ fontSize: 40, marginBottom: 8, display: 'block' }} />
                {t('imagePicker.empty')}
              </div>
            )}
          </div>

          {total > 20 && (
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Pagination
                current={page}
                total={total}
                pageSize={20}
                size="small"
                onChange={loadImages}
              />
            </div>
          )}
        </Spin>
      </Modal>
    </>
  );
}
