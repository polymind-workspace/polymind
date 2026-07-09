export default {
  'import.subtitle': '浏览 Polymarket 的事件并将选中的市场镜像到 PolyMind 合约',
  'import.loadMore': '加载更多',

  'import.adminBlock.connect':   '请连接钱包以启用导入',
  'import.adminBlock.loading':   '正在加载合约地址…',
  'import.adminBlock.notAdmin':  '钱包 {addr}… 不在管理员白名单内',

  'import.filter.category':   '分类：',
  'import.filter.all':        '全部',
  'import.filter.search':     '搜索关键字',
  'import.filter.activeOnly': '仅显示进行中',

  'import.empty': '没有匹配的事件',

  'import.card.chance':       '概率',
  'import.card.more':         '另外 {n} 项',
  'import.card.allImported':  '已全部导入',
  'import.card.closed':       '已关闭',
  'import.card.ends':         '截止 {date}',
  'import.card.markets':      '{count} 个市场',

  'import.drawer.linkedInfo':     '已关联链上 event #{id}。后续导入将通过 add_market 追加到该 event。',
  'import.drawer.linkedMismatch': '已关联链上 event #{id}。只有原创建者钱包 {addr}… 才能向其追加市场。',

  'import.drawer.linking': '正在关联链上 event，请稍候…',
  'import.drawer.noActive': '该事件下暂无进行中的市场',

  'import.row.imported': '已导入',
  'import.row.add':      '追加',
  'import.row.import':   '导入',
  'import.row.linking':  '关联中…',
  'import.row.endsShort':'截止 {date}',
  'import.row.closed':   '已关闭',

  'import.modal.titleAdd':    '追加市场到链上 event #{id}',
  'import.modal.titleCreate': '将该市场导入 PolyMind',
  'import.modal.okAdd':       '签名并追加',
  'import.modal.okCreate':    '签名并创建',
  'import.modal.source':      'Polymarket 原始页面',
  'import.modal.open':        '打开 ↗',
  'import.modal.conditionId': 'condition_id：{id}',

  'import.tx.add':    '追加市场',
  'import.tx.import': '导入 Polymarket 市场',

  'import.confirm.addTitle':      '将该市场追加到链上 event #{id}？',
  'import.confirm.addContent':    '{title} → add_market(event_id={id})；继承该 event 已有的配置。',
  'import.confirm.createTitle':   '导入该 Polymarket 市场？',
  'import.confirm.createContent': '{question} → admin_create_event_with_market（externalSource=1）',

  'import.filter.activity':           '活跃度：',
  'import.filter.activity.allTime':   '全部时间',
  'import.filter.activity.today':     '今日',
  'import.filter.activity.week':      '本周',
  'import.filter.activity.month':     '本月',
  'import.filter.activity.breaking':  '突发新闻',
  'import.filter.expires':            '到期：',
  'import.filter.expires.all':        '全部',
  'import.filter.expires.daily':      '今日到期',
  'import.filter.expires.weekly':     '本周内',
  'import.filter.expires.monthly':    '本月内',
  'import.card.vol24h':              '24h：{v}',

  // Form labels are shared with Events/Create — see locales/zh-CN/field.ts
};
