export default {
  'roles.subtitle': 'On-chain role registries. Three independent lists with no implicit hierarchy — admins manage all three.',

  'roles.tab.admin':       'Admins',
  'roles.tab.creator':     'Creators',
  'roles.tab.distributor': 'Distributors',

  'roles.desc.admin':       'Meta-role. Manages all three role lists; gates admin_finalize, admin_resolve, set_dispute_active, update_config, role mutations. Cannot be empty.',
  'roles.desc.creator':     'Gates admin_create_event_with_market only. Independent from admin — a creator wallet cannot finalize or withdraw.',
  'roles.desc.distributor': 'Gates withdraw_platform_balance only. Used to top up the invite-reward ops wallet (and any future platform-fee redistribution).',

  'roles.btn.add':     'Add {role}',
  'roles.btn.remove':  'Remove',
  'roles.lastAdmin':   'last admin — cannot remove',

  'roles.add.title':       'Add {role}',
  'roles.add.ok':          'Add',
  'roles.add.placeholder': '0x... or base58 wallet address',
  'roles.add.txName':      'Add {role}',
  'roles.add.confirm.title':   'Grant {role} role?',
  'roles.add.confirm.content': '{addr} will be added to the {role}s list and auto-registered in the backend admin allow-list (so this wallet can also log into the dashboard to sign role-specific txs).',
  'roles.add.backendFailed':   'Backend admin registration failed: {msg}',

  'roles.remove.txName':         'Remove {role}',
  'roles.remove.confirm.title':  'Revoke {role} role?',
  'roles.remove.confirm.content':'{addr} will lose this role. Cannot undo without re-adding.',
  'roles.remove.popconfirm.title':  'Remove this {role}?',
  'roles.remove.popconfirm.desc':   'Cannot undo without re-adding.',

  'roles.empty':  'No {role}s on chain — until you add one, the corresponding action is locked.',
  'roles.youTag': 'This is you',

  'roles.tab.champion': 'Campaign Admins',

  'roles.champion.desc': 'Campaign contract admins. These wallets can create, finalize, and cancel prediction campaigns on the champion contract. Cannot be empty.',

  'roles.champion.add.txName':    'Add campaign admin',
  'roles.champion.remove.txName': 'Remove campaign admin',

};
