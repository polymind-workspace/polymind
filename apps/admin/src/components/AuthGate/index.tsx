import { WalletOutlined } from '@ant-design/icons';
import { useModel } from '@umijs/max';
import { Button, Typography } from 'antd';
import { type ReactNode } from 'react';

const shorten = (a: string) =>
  a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;

export default function AuthGate({ children }: { children: ReactNode }) {
  const { address, isAdmin, authing, connect, disconnect, signIn } =
    useModel('wallet');

  if (address && isAdmin) return <>{children}</>;

  let title: string;
  let body: ReactNode;
  let primary: ReactNode;

  if (!address) {
    title = 'Connect wallet to continue';
    body = 'PolyMind admin actions require a wallet on the admin list.';
    primary = (
      <Button
        type="primary"
        size="large"
        icon={<WalletOutlined />}
        loading={authing}
        onClick={async () => {
          try {
            const a = await connect();
            await signIn(a);
          } catch {}
        }}
      >
        Connect & sign in
      </Button>
    );
  } else {
    title = 'Sign in to verify wallet';
    body = (
      <>
        Connected as <Typography.Text code>{shorten(address)}</Typography.Text>.
        Sign a one-time message so the backend can issue a session token.
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
          Sign in
        </Button>
        <Button type="link" onClick={() => disconnect()}>
          Disconnect
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
