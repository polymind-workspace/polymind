export default {
  'roles.subtitle': '链上角色管理。三个独立角色，无层级关系——管理员是唯一可以增删任一角色的角色。',

  'roles.tab.admin':       '管理员',
  'roles.tab.creator':     '创建者',
  'roles.tab.distributor': '分发者',

  'roles.desc.admin':       '元角色。管理三个角色列表；控制 admin_finalize / admin_resolve / set_dispute_active / 全局参数 / 角色增删。不能为空（不能删最后一个）。',
  'roles.desc.creator':     '只控制 admin_create_event_with_market。与管理员独立——创建者钱包不能 finalize 或提取平台费。',
  'roles.desc.distributor': '只控制 withdraw_platform_balance（提取合约平台费）。用于给"邀请奖励 ops 钱包"充值，以及未来其他平台费分发场景。',

  'roles.btn.add':     '添加{role}',
  'roles.btn.remove':  '移除',
  'roles.lastAdmin':   '最后一个管理员——不能删',

  'roles.add.title':    '添加{role}',
  'roles.add.ok':       '添加',
  'roles.add.placeholder': '0x... 或 base58 钱包地址',
  'roles.add.txName':   '添加{role}',
  'roles.add.confirm.title':   '授予{role}角色？',
  'roles.add.confirm.content': '{addr} 将被加入{role}列表，并自动注册到后台管理员列表（这样这个钱包才能登录管理后台、从这里签发对应角色的链上 tx）。',
  'roles.add.backendFailed':   '后台管理员列表注册失败：{msg}',

  'roles.remove.txName':         '移除{role}',
  'roles.remove.confirm.title':  '撤销{role}角色？',
  'roles.remove.confirm.content':'{addr} 将失去该角色。撤销后只能重新添加，无法 undo。',
  'roles.remove.popconfirm.title':  '移除该{role}？',
  'roles.remove.popconfirm.desc':   '撤销后只能重新添加。',

  'roles.empty':  '链上还没有任何{role}——在添加之前对应操作会被锁住。',
  'roles.youTag': '这是你',

  'roles.tab.champion': '竞猜活动管理员',

  'roles.champion.desc': '竞猜活动合约管理员。这些钱包可以在竞猜活动合约上创建、结算、取消竞猜活动。不能为空（不能删最后一个）。',

  'roles.champion.add.txName':    '添加竞猜活动管理员',
  'roles.champion.remove.txName': '移除竞猜活动管理员',

};
