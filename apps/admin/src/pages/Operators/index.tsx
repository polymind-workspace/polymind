import { PageContainer } from '@ant-design/pro-components';
import {
  Alert, App, Button, Card, Input, List, Modal, Popconfirm,
  Space, Spin, Tabs, Tag, Typography,
} from 'antd';
import { useIntl, useModel } from '@umijs/max';
import { useCallback, useEffect, useState } from 'react';
import { polymindApi } from '@/services/polymind';
import {
  v3AddAdmin, v3AddCreator, v3AddDistributor,
  v3RemoveAdmin, v3RemoveCreator, v3RemoveDistributor,
  championAddAdmin, championRemoveAdmin,
} from '@/wallet/endless';
import { useAdminTx } from '@/hooks/useAdminTx';
import { useChampionTx } from '@/hooks/useChampionTx';
import SignerStatusCard from '@/components/SignerStatusCard';

type Role = 'admin' | 'creator' | 'distributor' | 'champion';

interface RoleConfig {
  key:    'admin' | 'creator' | 'distributor';
  add:    (caller: string, addr: string) => Promise<string>;
  remove: (caller: string, addr: string) => Promise<string>;
}

const ROLE_CONFIG: RoleConfig[] = [
  { key: 'admin',       add: v3AddAdmin,       remove: v3RemoveAdmin       },
  { key: 'creator',     add: v3AddCreator,     remove: v3RemoveCreator     },
  { key: 'distributor', add: v3AddDistributor, remove: v3RemoveDistributor },
];

export default function OperatorsPage() {
  const intl = useIntl();
  const tr = (id: string, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
  const { message } = App.useApp();
  const { authedHex, isContractAdmin, isChampionAdmin } = useModel('wallet');
  const adminTx    = useAdminTx();
  const championTx = useChampionTx();

  const [active, setActive] = useState<Role>('admin');

  const [lists, setLists] = useState<
    Record<'admin' | 'creator' | 'distributor' | 'champion', string[]>
  >({
    admin: [],
    creator: [],
    distributor: [],
    champion: [],
  });
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newAddr, setNewAddr] = useState('');

  const isChampionTab = active === 'champion';

  const canMutate = isChampionTab
    ? championTx.canRun && isChampionAdmin
    : adminTx.canRun && isContractAdmin;

  const reload = useCallback(() => {
    setLoading(true);
    Promise.all([
      polymindApi.listAllRoles(),
      polymindApi.listChampionAdmins(),
    ])
      .then(([r, ch]) => {
        setLists({
          admin:       r.admins       || [],
          creator:     r.creators     || [],
          distributor: r.distributors || [],
          champion:    ch             || [],
        });
      })
      .catch((err) => {
        console.error('Failed to reload operators:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const me = authedHex || '';
  const cfg = ROLE_CONFIG.find((r) => r.key === active) ?? ROLE_CONFIG[0];
  const current = lists[active as keyof typeof lists] || [];
  const roleLabel = isChampionTab
    ? tr('roles.tab.champion')
    : tr(`roles.tab.${active}`);

  const addOne = async () => {
    const target = newAddr.trim();
    if (!target) return;

    if (isChampionTab) {
      championTx.run({
        name: tr('roles.champion.add.txName'),
        call: (contractAddr) => championAddAdmin(contractAddr, target),
        onDone: async () => {
          try {
            const confirmed = await polymindApi.championIsAdmin(target);
            if (confirmed) {
              await polymindApi.addAdminAccount({ address: target, label: 'champion' });
            } else {
              message.warning('On-chain add succeeded but is_admin view returned false — backend not updated');
            }
          } catch {}
          setAddOpen(false);
          setNewAddr('');
          [0, 1500, 4500].forEach((ms) => setTimeout(reload, ms));
        },
      });
      return;
    }

    try {
      await polymindApi.addAdminAccount({ address: target, label: cfg.key });
    } catch (e) {
      const msg = (e as Error).message || '';
      if (!/already exists|409/i.test(msg)) {
        message.error(tr('roles.add.backendFailed', { msg }));
        return;
      }
    }

    adminTx.run({
      name: tr('roles.add.txName', { role: roleLabel }),
      call: (addr) => cfg.add(addr, target),
      confirm: {
        title:   tr('roles.add.confirm.title',   { role: roleLabel }),
        content: tr('roles.add.confirm.content', { role: roleLabel, addr: target }),
      },
      onDone: () => {
        setAddOpen(false);
        setNewAddr('');
        [0, 1500, 4500].forEach((ms) => setTimeout(reload, ms));
      },
    });
  };

  const removeOne = (target: string) => {
    if (isChampionTab) {
      championTx.run({
        name: tr('roles.champion.remove.txName'),
        call: (contractAddr) => championRemoveAdmin(contractAddr, target),
        onDone: () => {
          [0, 1500, 4500].forEach((ms) => setTimeout(reload, ms));
        },
      });
      return;
    }

    adminTx.run({
      name: tr('roles.remove.txName', { role: roleLabel }),
      call: (addr) => cfg.remove(addr, target),
      confirm: {
        title:   tr('roles.remove.confirm.title',   { role: roleLabel }),
        content: tr('roles.remove.confirm.content', { role: roleLabel, addr: target }),
        danger: true,
      },
      onDone: () => {
        [0, 1500, 4500].forEach((ms) => setTimeout(reload, ms));
      },
    });
  };

  const descKey = isChampionTab ? 'roles.champion.desc' : `roles.desc.${active}`;

  const isLastItem     = !isChampionTab && active === 'admin' && current.length <= 1;
  const isLastChampion = isChampionTab && current.length <= 1;

  return (
    <PageContainer
      content={tr('roles.subtitle')}
      extra={[
        <Button
          key="add"
          type="primary"
          onClick={() => setAddOpen(true)}
          disabled={!canMutate}
        >
          {tr('roles.btn.add', { role: roleLabel })}
        </Button>,
      ]}
    >
      <SignerStatusCard
        role={isChampionTab ? 'champion' : 'admin'}
        style={{ marginBottom: 12 }}
      />

      <Tabs
        activeKey={active}
        onChange={(k) => setActive(k as Role)}
        items={[
          ...ROLE_CONFIG.map((r) => ({ key: r.key, label: tr(`roles.tab.${r.key}`) })),
          { key: 'champion', label: tr('roles.tab.champion') },
        ]}
      />

      <Card style={{ marginTop: 12 }}>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={tr(descKey)}
        />
        <Spin spinning={loading}>
          <List
            dataSource={current}
            renderItem={(addr) => (
              <List.Item
                actions={
                  isLastItem || isLastChampion
                    ? [<span key="lock" style={{ color: '#999', fontSize: 12 }}>
                        {tr('roles.lastAdmin')}
                      </span>]
                    : [
                        <Popconfirm
                          key="remove"
                          title={tr('roles.remove.popconfirm.title', { role: roleLabel })}
                          description={tr('roles.remove.popconfirm.desc')}
                          okButtonProps={{ danger: true }}
                          onConfirm={() => removeOne(addr)}
                          disabled={!canMutate}
                        >
                          <Button danger size="small" disabled={!canMutate}>
                            {tr('roles.btn.remove')}
                          </Button>
                        </Popconfirm>,
                      ]
                }
              >
                <Space>
                  <Typography.Text copyable>{addr}</Typography.Text>
                  {me && addr.toLowerCase() === me && (
                    <Tag color="green">{tr('roles.youTag')}</Tag>
                  )}
                </Space>
              </List.Item>
            )}
            locale={{
              emptyText: (
                <Alert
                  type="warning"
                  message={tr('roles.empty', { role: roleLabel })}
                />
              ),
            }}
          />
        </Spin>
      </Card>

      <Modal
        title={tr('roles.add.title', { role: roleLabel })}
        open={addOpen}
        okText={tr('roles.add.ok')}
        okButtonProps={{ disabled: !newAddr.trim() }}
        onCancel={() => { setAddOpen(false); setNewAddr(''); }}
        onOk={addOne}
      >
        <Input
          placeholder={tr('roles.add.placeholder')}
          value={newAddr}
          onChange={(e) => setNewAddr(e.target.value)}
          onPressEnter={addOne}
        />
      </Modal>
    </PageContainer>
  );
}