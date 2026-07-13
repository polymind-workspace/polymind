import { WalletOutlined } from '@ant-design/icons';
import { useModel, useIntl } from '@umijs/max';
import { Button, Typography } from 'antd';
import { type ReactNode } from 'react';
import { shortenAddress } from '@/utils/address';

export default function AuthGate({ children }: { children: ReactNode }) {
  const intl = useIntl();
  const tr = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { address, isAdmin, authing, isReady, connectors, connect, disconnect, signIn } =
    useModel('wallet');

  if (address && isAdmin) return <>{children}</>;

  const hasWallet = isReady && connectors.length > 0;

  let title: string;
  let body: ReactNode;
  let primary: ReactNode;

  if (!address) {
    title = tr('auth.connect.title');
    body = hasWallet
      ? tr('auth.connect.body.hasWallet')
      : tr('auth.connect.body.noWallet');
    primary = (
      <Button
        type="primary"
        size="large"
        icon={<WalletOutlined />}
        loading={authing}
        disabled={!hasWallet}
        onClick={async () => {
          try {
            const a = await connect();
            await signIn(a);
          } catch {}
        }}
      >
        {hasWallet ? tr('auth.connect.signIn') : tr('auth.connect.noWalletButton')}
      </Button>
    );
  } else {
    title = tr('auth.verify.title');
    body = (
      <>
        {tr('auth.verify.body', { address: shortenAddress(address) })}
      </>
    );
    primary = (
      <>
        <Button
          type="primary"
          size="large"
          loading={authing}
          onClick={() => signIn(address).catch(() => {})}
        >
          {tr('auth.verify.signIn')}
        </Button>
        <Button type="link" onClick={() => disconnect()}>
          {tr('auth.verify.disconnect')}
        </Button>
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 200px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          padding: '40px 32px',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 6px 24px rgba(0,0,0,0.06)',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
          {title}
        </div>
        {body && (
          <div style={{ color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
            {body}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {primary}
        </div>
      </div>
    </div>
  );
}
