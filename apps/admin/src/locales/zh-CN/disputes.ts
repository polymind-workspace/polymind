export default {
  // list columns
  'disputes.col.id':     '编号',
  'disputes.col.event':  '事件',
  'disputes.col.market': '市场',
  'disputes.col.claim':  '诉求',
  'disputes.col.status': '状态',
  'disputes.col.filed':  '发起时间',

  'disputes.status.pending':   '待裁决',
  'disputes.status.resolved':  '已通过',
  'disputes.status.dismissed': '已驳回',

  'disputes.placeholder.event':  '事件 {id}',
  'disputes.placeholder.market': '市场 {idx}',

  // drawer header
  'disputes.detail.idLabel':      '争议 #{id}',
  'disputes.detail.eventFallback':'事件 {id} · 市场 {idx}',

  // descriptions
  'disputes.field.status':         '状态',
  'disputes.field.market':         '所属市场',
  'disputes.field.disputer':       '发起人',
  'disputes.field.claimed':        '诉求结果',
  'disputes.field.bond':           '冻结押金',
  'disputes.field.reason':         '理由',
  'disputes.field.filed':          '发起时间',
  'disputes.field.resolved':       '裁决时间',
  'disputes.field.resolvedOutcome':'最终结果',
  'disputes.field.eventId':         '事件编号',
  'disputes.field.eventDescription':'事件描述',
  'disputes.field.deadline':        '事件结束时间',
  'disputes.field.marketSuffix':   '（事件 {id} · 市场 {idx}）',
  'disputes.placeholder.noDeadline': '无截止时间',

  // resolve card
  'disputes.resolve.cardTitle': '裁决',
  'disputes.resolve.alert.message': 'admin_resolve 会自动 finalize 该市场',
  'disputes.resolve.alert.agree':   '同意：',
  'disputes.resolve.alert.agreeDesc':   '裁决为发起人诉求 ({outcome})，押金退还，市场 finalize 到该结果。',
  'disputes.resolve.alert.dismiss': '驳回：',
  'disputes.resolve.alert.dismissDesc': '裁决为非诉求且非 VOID 的结果，押金罚没归入平台。',
  'disputes.resolve.alert.void':    'VOID：',
  'disputes.resolve.alert.voidDesc':    '全部资金池退款，押金也退还。',

  'disputes.btn.agree':   '同意（{outcome}）',
  'disputes.btn.resolve': '裁决为 {outcome}',

  'disputes.resolvedAlert':       '该争议已 {status}',
  'disputes.resolvedAlert.txHash':'tx: {hash}',

  // tx + modal
  'disputes.tx.resolve':         '裁决：{outcome}',
  'disputes.modal.title':        '裁决为 {outcome}',
  'disputes.modal.ok':           '提交',
};
