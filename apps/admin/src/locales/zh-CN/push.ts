export default {
  // tabs
  'push.tab.compose': '撰写发送',
  'push.tab.history': '推送历史',

  // recipient
  'push.recipient.section':      '推送目标',
  'push.recipient.everyone':     '全员推送',
  'push.recipient.personal':     '指定用户',
  'push.recipient.pickerOpen':   '从用户列表选',
  'push.recipient.manualHint':   '可直接粘贴 luffa_id；或点右侧按钮从用户表里选',
  'push.recipient.selected':     '已选 {n} 个接收人',
  'push.recipient.removeAll':    '全部清空',
  'push.recipient.required':     '请至少添加一个接收人',

  // user picker drawer
  'push.picker.title':           '选择接收人',
  'push.picker.search':          '搜索 luffa_id / 昵称 / 历史地址',
  'push.picker.done':            '确定（{n}）',

  // section titles
  'push.section.title':    '顶部 (title)',
  'push.section.header':   '头部 (header)',
  'push.section.content':  '内容 (content)',
  'push.section.actions':  '底部按钮 (actions)',

  // title fields
  'push.title.icon':        '应用图标 (icon)',
  'push.title.text':        '应用名 (text)',
  'push.title.text.hint':   '最长 30 字节 (UTF-8)',
  'push.title.link':        '点击跳转链接 (可选)',

  // header
  'push.header.type':        '头部样式 (type)',
  'push.header.type.opt1':   '1 文本居中',
  'push.header.type.opt2':   '2 文本左对齐',
  'push.header.type.opt3':   '3 大图',
  'push.header.type.opt4':   '4 小图',
  'push.header.title':       '主标题 (title)',
  'push.header.title.hint':  '最长 60 字节',
  'push.header.subTitle':    '副标题 (subTitle)',
  'push.header.subTitle.hint': '最长 160 字节',
  'push.header.titleOrSubtitle.required': 'title / subTitle 至少填一个',
  'push.header.source':      '辅助内容 (source)',
  'push.header.source.status':     '状态图标',
  'push.header.source.status.opt0':'0 成功',
  'push.header.source.status.opt1':'1 失败',
  'push.header.source.status.opt2':'2 警告',
  'push.header.source.text':       '状态文案',
  'push.header.source.text.hint':  '最长 160 字节',
  'push.header.source.url':        '头图 URL (310x110)',
  'push.header.source.link':       '头图点击链接',

  // content
  'push.content.title':       '内容标题',
  'push.content.title.hint':  '最长 80 字节',
  'push.content.subTitle':    '内容副标题',
  'push.content.subTitle.hint':'最长 160 字节',
  'push.content.items':       '明细项 (≤6 组)',
  'push.content.item.title':  '项标题',
  'push.content.item.title.hint': '最长 15 字节',
  'push.content.item.type':   '类型',
  'push.content.item.type.opt0': '0 文本',
  'push.content.item.type.opt1': '1 跳转',
  'push.content.item.type.opt2': '2 复制',
  'push.content.item.type.opt3': '3 图片',
  'push.content.item.text':   '文本',
  'push.content.item.text.hint': '最长 80 字节',
  'push.content.item.url':    'URL',
  'push.content.item.copytext':'复制内容',
  'push.content.item.color':  '颜色',
  'push.content.item.color.opt1': '默认',
  'push.content.item.color.opt2': '提醒 (红)',
  'push.content.addItem':     '添加明细项',

  // actions
  'push.actions.title':  '按钮文案',
  'push.actions.title.hint':'最长 60 字节',
  'push.actions.url':    '按钮链接',
  'push.actions.add':    '添加按钮',
  'push.actions.max':    '最多 3 个',

  // JSON mode
  'push.json.toggle':   'JSON 模式',
  'push.json.label':    '完整 message_content（粘贴覆盖）',
  'push.json.invalid':  'JSON 解析失败：{err}',
  'push.json.applied':  '已套用 JSON',

  // submit + confirm
  'push.submit.send':    '发送',
  'push.submit.sending': '发送中…',
  'push.confirm.everyone.title':   '确认推送给全部订阅用户？',
  'push.confirm.everyone.content': '这条消息会立刻广播到所有已订阅的用户，无法撤销。',
  'push.confirm.personal.title':   '确认推送给 {n} 个用户？',
  'push.confirm.personal.content': '逐一调用上游 API，可能耗时几秒。',

  // result — push is now async (BackgroundTasks)
  'push.result.queued':      '已加入推送队列（{n} 条），实际状态请在「推送历史」查看',
  'push.result.gotoHistory': '查看历史',

  // history
  'push.history.col.id':         'ID',
  'push.history.col.time':       '时间',
  'push.history.col.type':       '类型',
  'push.history.col.recipient':  '接收人',
  'push.history.col.headerTitle':'卡片标题',
  'push.history.col.status':     '状态',
  'push.history.col.sentBy':     '发送人',
  'push.history.col.actions':    '操作',
  'push.history.type.broadcast': '全员',
  'push.history.type.personal':  '指定',
  'push.history.status.pending': '排队中',
  'push.history.status.ok':      '成功',
  'push.history.status.failed':  '失败',
  'push.history.btn.view':       '查看',
  'push.history.btn.copy':       '复制为新草稿',
  'push.history.filter.typeAll':  '类型：全部',
  'push.history.filter.typeBroadcast': '类型：全员',
  'push.history.filter.typePersonal':  '类型：指定',
  'push.history.filter.statusAll':    '状态：全部',
  'push.history.filter.statusPending':'状态：排队中',
  'push.history.filter.statusOk':     '状态：成功',
  'push.history.filter.statusFail':   '状态：失败',
  'push.history.search':         '搜索 luffa_id / sent_by / trace_id',

  // detail drawer
  'push.detail.title':         '推送详情',
  'push.detail.section.meta':  '元信息',
  'push.detail.section.preview': '卡片预览',
  'push.detail.section.json':  '原始 JSON',
  'push.detail.copyToCompose': '复制为新草稿',

  // empty preview
  'push.preview.empty':  '左侧填好后这里实时预览',

  // mini-program link picker
  'miniapp.btn':                    '小程序',
  'miniapp.action':                 '动作',
  'miniapp.id':                     'ID',
  'miniapp.id.event':               '事件 slug',
  'miniapp.id.draft':               '草稿 ID',
  'miniapp.id.event.placeholder':   '选择或输入事件 slug',
  'miniapp.id.draft.placeholder':   '输入草稿 ID',
  'miniapp.loading':                '加载中…',
  'miniapp.noEvents':               '无事件',
  'miniapp.cancel':                 '取消',
  'miniapp.insert':                 '插入',
  'miniapp.action.buy-shares':      '事件详情 (buy-shares)',
  'miniapp.action.create-event':    '创建事件 (create-event)',
  'miniapp.action.confirm-event':   '确认事件草稿 (confirm-event)',
  'miniapp.action.open-pro':        'Pro 页 (open-pro)',
  'miniapp.action.default':         '小程序首页',
};
