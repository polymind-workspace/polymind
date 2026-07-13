import { useModel, useIntl } from '@umijs/max';
import { App, Button, Dropdown, Tag, Typography } from 'antd';
import { WalletOutlined, SwapOutlined, GiftOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useState } from 'react';
import { polymindApi } from '@/services/polymind';
import { v3ClaimCreatorReward } from '@/wallet/endless';
import { useAdminTx } from '@/hooks/useAdminTx';
import { shortenAddress } from '@/utils/address';

const { Text } = Typography;
const EDS = 1e8;
const fmtEds = (b: string | number) => (Number(b) / EDS).toFixed(2);

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
    connectors,
    isReady,
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

  const hasWallet = isReady && connectors.length > 0;

  const handleConnect = async () => {
    try {
      if (!hasWallet) {
        message.error(tr('wallet.connect.noWalletDetected'));
        return;
      }
      const a = await connect();
      try {
        await signIn(a);
      } catch {}
    } catch (e) {
      message.error((e as Error).message || tr('wallet.connect.connectFailed'));
    }
  };

  if (!address && !authedAddr) {
    return (
      <Button
        type="primary"
        icon={<WalletOutlined />}
        loading={authing}
        disabled={!hasWallet}
        onClick={handleConnect}
      >
        {hasWallet ? tr('wallet.connect.connectWallet') : tr('wallet.connect.noWalletDetectedButton')}
      </Button>
    );
  }

  const primary = authedAddr || address || '';
  const hasReward = Number(creatorReward) > 0;

  const walletItems = connectors.map((c) => ({
    key: `connect-${c.id}`,
    label: tr('wallet.connect.connectWith', { name: c.name }),
    onClick: async () => {
      const a = await openWalletPicker(c.id);
      if (a) await signIn(a).catch(() => {});
    },
  }));

  return (
    <Dropdown
      menu={{
        items: [
          {
            key: 'copy-auth',
            label: tr('wallet.copy.login', { address: shortenAddress(primary) }),
            onClick: () => {
              navigator.clipboard.writeText(primary);
              message.success(tr('wallet.copy.copied'));
            },
          },
          ...(address && signerDiffersFromAuth
            ? [{
                key: 'copy-signer',
                label: tr('wallet.copy.signer', { address: shortenAddress(address) }),
                onClick: () => {
                  navigator.clipboard.writeText(address);
                  message.success(tr('wallet.copy.copied'));
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
            label: tr('wallet.switchSigner'),
            icon: <SwapOutlined />,
            onClick: () => openWalletPicker(),
          },
          ...(!isAdmin && address
            ? [{
                key: 'signin',
                label: tr('wallet.signInCurrent'),
                onClick: () => signIn(address).catch(() => {}),
              }]
            : []),
          ...(signerDiffersFromAuth && address
            ? [{
                key: 'rebind',
                label: tr('wallet.reloginCurrent'),
                onClick: () => signIn(address).catch(() => {}),
              }]
            : []),
          ...(walletItems.length > 0
            ? [
                { type: 'divider' as const },
                ...walletItems,
              ]
            : []),
          { type: 'divider' as const },
          {
            key: 'disconnect',
            label: tr('wallet.disconnect'),
            danger: true,
            onClick: () => disconnect(),
          },
        ],
      }}
    >
      <Button loading={authing}>
        <WalletOutlined />
        {shortenAddress(primary)}
        <Tag color={isAdmin ? 'green' : 'red'} style={{ marginLeft: 8 }}>
          {isAdmin ? tr('wallet.admin') : tr('wallet.notSignedIn')}
        </Tag>
        {signerDiffersFromAuth && address && (
          <Tag color="orange" style={{ marginLeft: 0 }}>
            <Text style={{ fontSize: 11 }}>{tr('wallet.signerLabel', { address: shortenAddress(address) })}</Text>
          </Tag>
        )}
      </Button>
    </Dropdown>
  );
}
