import { useModel, useIntl } from '@umijs/max';
import { App, Button, Dropdown, Tag, Typography } from 'antd';
import { WalletOutlined, SwapOutlined, GiftOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { polymindApi } from '@/services/polymind';
import { v3ClaimCreatorReward } from '@/wallet/endless';
import { useAdminTx } from '@/hooks/useAdminTx';

const { Text } = Typography;
const EDS = 1e8;
const fmtEds = (b: string | number) => (Number(b) / EDS).toFixed(2);

const shorten = (a: string) =>
  a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

export default function WalletWidget() {
  const intl = useIntl();
  const tr = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const {
    address,
    authedAddr,
    isAdmin,
    authing,
    signerDiffersFromAuth,
    connect,
    disconnect,
    signIn,
    openWalletPicker,
  } = useModel('wallet');
  const { message } = App.useApp();
  const adminTx = useAdminTx();

  const [creatorReward, setCreatorReward] = useState<string>('0');
  const refreshReward = useCallback(() => {
    if (!address) { setCreatorReward('0'); return; }
    polymindApi.creatorRewardBalance(address)
      .then((r) => setCreatorReward(r.balance || '0'))
      .catch(() => setCreatorReward('0'));
  }, [address]);
  useEffect(() => { refreshReward(); }, [refreshReward]);

  const claimReward = () => {
    adminTx.run({
      name: tr('wallet.creatorReward.tx', { amount: fmtEds(creatorReward) }),
      call: (addr) => v3ClaimCreatorReward(addr),
      confirm: {
        title: tr('wallet.creatorReward.confirm.title', { amount: fmtEds(creatorReward) }),
      },
      onDone: () => {
        [0, 1500, 4500].forEach((ms) => setTimeout(refreshReward, ms));
      },
    });
  };

  if (!address && !authedAddr) {
    return (
      <Button
        type="primary"
        icon={<WalletOutlined />}
        loading={authing}
        onClick={async () => {
          try {
            const a = await connect();
            try {
              await signIn(a);
            } catch {}
          } catch (e) {
            message.error((e as Error).message || 'Connect failed');
          }
        }}
      >
        Connect wallet
      </Button>
    );
  }

  const primary = authedAddr || address || '';
  const hasReward = Number(creatorReward) > 0;

  return (
    <Dropdown
      menu={{
        items: [
          {
            key: 'copy-auth',
            label: `Copy login: ${shorten(primary)}`,
            onClick: () => {
              navigator.clipboard.writeText(primary);
              message.success('Copied');
            },
          },
          ...(address && signerDiffersFromAuth
            ? [{
                key: 'copy-signer',
                label: `Copy signer: ${shorten(address)}`,
                onClick: () => {
                  navigator.clipboard.writeText(address);
                  message.success('Copied');
                },
              }]
            : []),
          { type: 'divider' as const },
          {
            key: 'creator-reward',
            label: hasReward
              ? tr('wallet.creatorReward.claim', { amount: fmtEds(creatorReward) })
              : tr('wallet.creatorReward.empty'),
            icon: <GiftOutlined />,
            disabled: !hasReward || adminTx.busy,
            onClick: () => { if (hasReward) claimReward(); },
          },
          { type: 'divider' as const },
          {
            key: 'switch-signer',
            label: 'Switch signer wallet',
            icon: <SwapOutlined />,
            onClick: () => openWalletPicker(),
          },
          ...(!isAdmin && address
            ? [{
                key: 'signin',
                label: 'Sign in with current signer',
                onClick: () => signIn(address).catch(() => {}),
              }]
            : []),
          ...(signerDiffersFromAuth && address
            ? [{
                key: 'rebind',
                label: 'Re-login as current signer',
                onClick: () => signIn(address).catch(() => {}),
              }]
            : []),
          { type: 'divider' as const },
          {
            key: 'disconnect',
            label: 'Disconnect',
            danger: true,
            onClick: () => disconnect(),
          },
        ],
      }}
    >
      <Button loading={authing}>
        <WalletOutlined />
        {shorten(primary)}
        <Tag color={isAdmin ? 'green' : 'red'} style={{ marginLeft: 8 }}>
          {isAdmin ? 'Admin' : 'Not signed in'}
        </Tag>
        {signerDiffersFromAuth && address && (
          <Tag color="orange" style={{ marginLeft: 0 }}>
            <Text style={{ fontSize: 11 }}>Signer: {shorten(address)}</Text>
          </Tag>
        )}
      </Button>
    </Dropdown>
  );
}
