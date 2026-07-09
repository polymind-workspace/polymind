export default {
  'campaigns.col.cid':          '活动 ID',
  'campaigns.col.campaign':     '活动',
  'campaigns.col.title':        '标题',
  'campaigns.col.status':       '状态',
  'campaigns.col.options':      '选项',
  'campaigns.col.startTime':    '开始时间',
  'campaigns.col.endTime':      '截止时间',
  'campaigns.col.participants': '参与人数',
  'campaigns.col.stake':        '用户下注',
  'campaigns.col.visibility':   '显示状态',
  'campaigns.col.actions':      '操作',

  'campaigns.status.draft':     '草稿',
  'campaigns.status.betting':   '进行中',
  'campaigns.status.settled':   '已结算',
  'campaigns.status.cancelled': '已取消',
  'campaigns.status.noOnchain': '链上未创建',

  'campaigns.search.placeholder':       '搜索标题或活动 ID',
  'campaigns.search.statusPlaceholder': '全部状态',

  'campaigns.visibility.all':     '全部',
  'campaigns.visibility.visible': '正常',
  'campaigns.visibility.hidden':  '已隐藏',

  'campaigns.tag.hidden':       '已隐藏',
  'campaigns.btn.cancel':       '取消活动',

  'champBets.title':      '参与记录',
  'champBets.export':     '导出 CSV',
  'champBets.col.user':   '用户',
  'champBets.col.team':   '所押选项',
  'champBets.col.amount': '下注金额',
  'champBets.col.time':   '时间',
  'campaigns.btn.hide':         '隐藏',
  'campaigns.btn.unhide':       '取消隐藏',

  'campaigns.confirm.cancel':     '取消该活动？',
  'campaigns.confirm.cancelDesc': '链上 cancel_campaign：作废活动并全员退还本金，不可撤销。',

  'campaigns.toast.hidden':       '已隐藏',
  'campaigns.toast.unhidden':     '已取消隐藏',

  'campaigns.btn.new':          '新建活动',
  'campaigns.btn.viewAll':      '查看全部活动',
  'campaigns.btn.links':        '分享链接',
  'campaigns.btn.delete':       '删除',
  'campaigns.btn.save':         '保存',
  'campaigns.btn.copy':         '复制',
  'campaigns.btn.open':         '打开',
  'campaigns.btn.createOnchain':'上链创建',
  'campaigns.btn.connect':      '连接钱包',
  'campaigns.btn.finalize':     '结算开奖',

  'campaigns.modal.new':      '新建活动',
  'campaigns.modal.edit':     '编辑活动配置',
  'campaigns.modal.links':    '分享链接与预览',
  'campaigns.modal.finalize': '结算开奖',

  'campaigns.btn.addOption':  '添加选项',
  'campaigns.btn.review':     '预览并上链',
  'campaigns.btn.saveUpdate': '保存并更新链',

  'campaigns.onchain.notConfigured':   '未配置 champion 合约地址',
  'campaigns.section.onchainEditHint': '修改时间 / 最低下注 / 标题会发起对应的链上更新交易（每改一项一笔签名）。',
  'campaigns.section.optionsLocked':   '已有用户下注，链上选项已锁定，这里只能改展示名称。',

  'campaigns.section.onchain':         '链上设置',
  'campaigns.section.options':         '选项',
  'campaigns.section.optionsEditHint': '编辑仅改展示名称，不改变链上选项数量与顺序。',
  'campaigns.section.display':         '展示文案',

  'campaigns.field.optEn':    'EN（链上选项）',
  'campaigns.field.optZh':    'ZH（仅展示）',
  'campaigns.field.contract': '合约地址',

  'campaigns.confirm.title':     '确认上链创建',
  'campaigns.toast.dupOptions':  '选项不能重复',
  'campaigns.toast.startFuture': '开始时间须晚于当前时间',

  'campaigns.onchain.connectHint': '上链创建需要连接管理员钱包（右上角），且该钱包须为 champion 合约管理员。',

  'campaigns.field.startTime':    '开始时间',
  'campaigns.field.endTime':      '截止时间',
  'campaigns.field.minBet':       '最低下注',
  'campaigns.field.optionOnchainHint': 'EN 选项即链上选项（vector<String>），顺序固定，须至少 2 个；其余语言仅用于展示',
  'campaigns.field.winningOption':'获胜选项',
  'campaigns.field.winningOptionPlaceholder': '选择夺冠选项',
  'campaigns.field.prize':        '官方注入金额',
  'campaigns.field.prizeHint':    '结算时官方一次性注入奖池，与用户彩池一起按本金比例分给赢家（可填 0）',

  'campaigns.finalize.hint': '确定结果后，调用合约 finalize_campaign，赢家可领奖。该操作不可撤销。',

  'campaigns.toast.created':      '已上链创建',
  'campaigns.toast.needOptions':  'EN 选项至少需要 2 个',
  'campaigns.toast.badWindow':    '截止时间须晚于开始时间',
  'campaigns.toast.badMinBet':    '最低下注须大于 0',

  'campaigns.field.cid':         '活动 ID',
  'campaigns.field.cidPlaceholder': '留空自动生成',
  'campaigns.field.cidAutoHint': '留空时根据 EN 标题自动生成；填写则须与链上 create_campaign 的 slug 一致',
  'campaigns.field.title':       '标题',
  'campaigns.field.description': '描述',
  'campaigns.field.windowLabel': '周期文案',
  'campaigns.field.pickLabel':   '选择区标题',

  'campaigns.ph.title':       '如：2026 世界杯冠军竞猜',
  'campaigns.ph.description': '展示在 H5 顶部的活动说明',
  'campaigns.ph.windowLabel': '如：投注截止 6/12 24:00',
  'campaigns.ph.pickLabel':   '如：选择你支持的球队',

  'campaigns.field.optionLabels':'选项名称（每行一个，顺序与链上选项一致）',
  'campaigns.field.optionHint':  '行数须与链上选项数一致',

  'campaigns.links.hint': '把对应语言的链接填入小程序 banner 的详情链接即可。',

  'campaigns.toast.saved':        '已保存',
  'campaigns.toast.saveFailed':   '保存失败',
  'campaigns.toast.deleted':      '已删除',
  'campaigns.toast.deleteFailed': '删除失败',
  'campaigns.toast.copied':       '已复制',
  'campaigns.confirm.delete':     '删除此活动的所有配置？',
  'campaigns.confirm.deleteDesc': '仅删除展示配置，不影响链上数据',
};
