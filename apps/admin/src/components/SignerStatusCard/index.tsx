import { Alert, Button, Card, Space, Spin, Tag, Typography } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import { history, useIntl, useModel } from '@umijs/max';

const { Text, Link } = Typography;
const shorten = (a: string) => (a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export type SignerRole = 'admin' | 'creator' | 'distributor' | 'adminevent' | 'champion';

interface Props {
  role?: SignerRole;
  targetAddress?: string;
  targetLabel?: string;
  compact?: boolean;
  style?: React.CSSProperties;
}

export default function SignerStatusCard({ role = 'admin', targetAddress, targetLabel, compact, style }: Props) {
  const intl = useIntl();
  const t = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const {
    address, openWalletPicker, signerMatches,
    contractAdmins, contractCreators, contractDistributors,
    isContractAdmin, isContractCreator, isContractDistributor,
    isAdminEventAdmin, isAdminEventAdminReady, adminEventAdmins,
    isChampionAdmin, isChampionAdminReady, championAdmins,
    rolesReady,
  } = useModel('wallet');

  const isTargetMode = !!targetAddress;
  const targetMatch = isTargetMode && signerMatches(targetAddress!);

  const ready = isTargetMode ? true
    : role === 'adminevent' ? isAdminEventAdminReady
    : role === 'champion' ? isChampionAdminReady
    : rolesReady;

  const allowed = isTargetMode ? [targetAddress!]
    : role === 'creator' ? contractCreators
    : role === 'distributor' ? contractDistributors
    : role === 'adminevent' ? adminEventAdmins
    : role === 'champion' ? championAdmins
    : contractAdmins;
  const ok = isTargetMode ? targetMatch
    : role === 'creator' ? isContractCreator
    : role === 'distributor' ? isContractDistributor
    : role === 'adminevent' ? isAdminEventAdmin
    : role === 'champion' ? isChampionAdmin
    : isContractAdmin;

  const labelKey = (k: string) => isTargetMode ? `signer.target.${k}` : `signer.${role}.${k}`;

  const inner = (
    <>
      <Space size="middle" wrap>
        <Text type="secondary">{t('signer.label')}</Text>
        <Text code copyable={{ text: address || '' }}>
          {address ? shorten(address) : '—'}
        </Text>
        {!isTargetMode && !ready ? (
          <Tag color="default"><Spin size="small" /> {t('signer.checking')}</Tag>
        ) : (
          <Tag color={ok ? 'green' : 'red'}>
            {ok ? t(labelKey('ok')) : t(labelKey('notAllowed'))}
          </Tag>
        )}
        <Button size="small" icon={<SwapOutlined />} onClick={openWalletPicker}>
          {t('signer.switch')}
        </Button>
      </Space>
      {(isTargetMode || ready) && !ok && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 10 }}
          message={t(labelKey('notAllowedMsg'))}
          description={
            allowed.length > 0 ? (
              <div style={{ marginTop: 6 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t(labelKey('allowedList'))}
                </Text>
                <ul style={{ margin: '6px 0 0 0', paddingLeft: 18 }}>
                  {allowed.map((a) => (
                    <li key={a} style={{ marginBottom: 2 }}>
                      <Text code copyable={{ text: a }} style={{ fontSize: 12 }}>
                        {a}
                      </Text>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <span style={{ fontSize: 12 }}>
                {role === 'adminevent' ? (
                  <>
                    {t(labelKey('allowedEmpty'))}{' '}
                    <Link onClick={() => history.push('/settings/operators')} style={{ cursor: 'pointer' }}>
                      Go to Settings → Operators
                    </Link>
                    {' '}to add one.
                  </>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>{t(labelKey('allowedEmpty'))}</Text>
                )}
              </span>
            )
          }
        />
      )}
    </>
  );

  if (compact) {
    return <div style={style}>{inner}</div>;
  }
  return (
    <Card size="small" title={t(labelKey('title'))} style={style}>
      {inner}
    </Card>
  );
}
