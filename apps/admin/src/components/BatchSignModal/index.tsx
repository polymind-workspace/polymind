import { Modal, Steps, Button, Alert, Result } from 'antd';
import { useState, useEffect } from 'react';

export interface SignStep {
  title: string;
  description: React.ReactNode;
  onSign: () => Promise<string>;
}

interface Props {
  open: boolean;
  steps: SignStep[];
  onDone: () => void;
  onCancel: (progress: { completed: number; total: number }) => void;
}

export default function BatchSignModal({ open, steps, onDone, onCancel }: Props) {
  const [current, setCurrent] = useState(0);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSign = async () => {
    if (current >= steps.length) return;
    setSigning(true);
    setError(null);
    try {
      await steps[current].onSign();
      setCurrent((c) => c + 1);
    } catch (e) {
      const raw = (e as Error).message || '';
      if (/reject|cancel|denied/i.test(raw)) {
        setError('交易已取消');
      } else {
        setError((e as Error).message || '签名失败');
      }
    } finally {
      setSigning(false);
    }
  };

  useEffect(() => {
    if (current < steps.length || steps.length === 0) return undefined;
    const timer = setTimeout(onDone, 1500);
    return () => clearTimeout(timer);
  }, [current, steps.length, onDone]);

  useEffect(() => {
    if (open) {
      setCurrent(0);
      setSigning(false);
      setError(null);
    }
  }, [open]);

  const allDone = current >= steps.length && steps.length > 0;

  return (
    <Modal
      open={open}
      width={620}
      footer={null}
      onCancel={signing || allDone ? undefined : () => onCancel({ completed: current, total: steps.length })}
      closable={!signing && !allDone}
      maskClosable={!signing && !allDone}
      title={allDone ? undefined : '创建官方事件'}
    >
      <Steps
        size="small"
        current={current}
        items={steps.map((s, i) => ({
          title: s.title,
          status: i < current ? 'finish' : i === current ? 'process' : 'wait',
        }))}
      />

      <div
        style={{
          marginTop: 24,
          padding: 24,
          background: '#f6f6f6',
          borderRadius: 8,
          minHeight: 180,
        }}
      >
        {allDone ? (
          <Result
            status="success"
            title="全部完成"
            subTitle="所有交易已签名，正在跳转..."
          />
        ) : (
          <>
            <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.6 }}>
              {steps[current]?.description}
            </div>
            {error && (
              <Alert
                type="error"
                message={error}
                style={{ marginBottom: 16 }}
                closable
                onClose={() => setError(null)}
              />
            )}
            <Button
              type="primary"
              loading={signing}
              onClick={handleSign}
              disabled={signing}
              size="large"
              block
            >
              {signing ? '等待钱包签名…' : '签名确认'}
            </Button>
          </>
        )}
      </div>

      {!allDone && (
        <div
          style={{
            marginTop: 12,
            textAlign: 'center',
            color: '#999',
            fontSize: 12,
          }}
        >
          共 {steps.length} 个步骤，每个步骤都需要钱包签名
        </div>
      )}
    </Modal>
  );
}
