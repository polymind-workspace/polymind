import { useIntl } from '@umijs/max';
import { Tag, Tooltip } from 'antd';
import { getNetwork } from '@/wallet/endless';

export default function EnvBadge({ collapsed }: { collapsed?: boolean }) {
  const intl = useIntl();
  const net = getNetwork();
  const isProd = net === 'mainnet';
  const label = intl.formatMessage({ id: isProd ? 'app.env.prod' : 'app.env.test' });
  const color = isProd ? 'green' : 'orange';

  if (collapsed) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <Tooltip title={`${label} · ${net}`} placement="right">
          <Tag color={color} style={{ margin: 0 }}>
            {net.charAt(0).toUpperCase()}
          </Tag>
        </Tooltip>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', padding: '8px 16px' }}>
      <Tag color={color} style={{ margin: 0 }}>
        {label} · {net}
      </Tag>
    </div>
  );
}