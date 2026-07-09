// 共享合约字段标签。被 Events/Create + Import/Polymarket 等表单复用，
// 改一次到处生效。
export default {
  'field.question':    '事件名',
  'field.description': '事件描述',
  'field.title':       '市场标题',
  'field.deadline':    '截止时间',
  'field.deadlineFuture': '截止时间必须在未来',

  'field.labelYes':    'YES 标签',
  'field.labelNo':     'NO 标签',
  'field.seedSide':    '初始下注方向',
  'field.seedAmount':  '初始下注金额 (EDS)',

  'field.platformFeeBps':            '平台抽成 (bps)',
  'field.platformFeeMax':            '平台抽成上限 (EDS)',
  'field.platformFeeMax.noCap':      '平台抽成上限 (EDS，0 = 不设上限)',
  'field.creatorRewardBps':          '创建者奖励 (bps)',
  'field.creatorRewardMax':          '创建者奖励上限 (EDS)',
  'field.creatorRewardMax.noCap':    '创建者奖励上限 (EDS，0 = 不设上限)',
  'field.disputeWindowSecs':         '争议窗口 (秒)',
  'field.adminTimeoutSecs':          '紧急作废等待 (秒)',
  'field.creatorProposeTimeoutSecs': '创建者优先提议期 (秒)',
  'field.expiredProposeMode':        '优先期过期后',
  'field.expiredProposeMode.opt0':   '参与者接管',
  'field.expiredProposeMode.opt1':   '作废并罚没 seed',
  'field.singleSideOnly':            '禁止用户双边下注',
};
