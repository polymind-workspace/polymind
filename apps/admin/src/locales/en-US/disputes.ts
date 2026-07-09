export default {
  'disputes.col.id':     'ID',
  'disputes.col.event':  'Event',
  'disputes.col.market': 'Market',
  'disputes.col.claim':  'Claim',
  'disputes.col.status': 'Status',
  'disputes.col.filed':  'Filed',

  'disputes.status.pending':   'Pending',
  'disputes.status.resolved':  'Resolved',
  'disputes.status.dismissed': 'Dismissed',

  'disputes.placeholder.event':  'event {id}',
  'disputes.placeholder.market': 'idx {idx}',

  'disputes.detail.idLabel':      'Dispute #{id}',
  'disputes.detail.eventFallback':'event {id} · market {idx}',

  'disputes.field.status':         'Status',
  'disputes.field.market':         'Market',
  'disputes.field.disputer':       'Disputer',
  'disputes.field.claimed':        'Claimed',
  'disputes.field.bond':           'Bond',
  'disputes.field.reason':         'Reason',
  'disputes.field.filed':          'Filed',
  'disputes.field.resolved':       'Resolved',
  'disputes.field.resolvedOutcome':'Resolved outcome',
  'disputes.field.eventId':         'Event ID',
  'disputes.field.eventDescription':'Event description',
  'disputes.field.deadline':        'Deadline',
  'disputes.field.marketSuffix':   '(event {id} · idx {idx})',
  'disputes.placeholder.noDeadline': 'No deadline',

  'disputes.resolve.cardTitle': 'Resolve',
  'disputes.resolve.alert.message': 'admin_resolve auto-finalizes the market',
  'disputes.resolve.alert.agree':   'Agree:',
  'disputes.resolve.alert.agreeDesc':   "resolve to the disputer's claim ({outcome}). Bond refunded, market finalized to the claim.",
  'disputes.resolve.alert.dismiss': 'Dismiss:',
  'disputes.resolve.alert.dismissDesc': 'resolve to any non-claim, non-VOID outcome. Bond slashed.',
  'disputes.resolve.alert.void':    'VOID:',
  'disputes.resolve.alert.voidDesc':    'all pools refunded; bond is also refunded.',

  'disputes.btn.agree':   'Agree ({outcome})',
  'disputes.btn.resolve': 'Resolve {outcome}',

  'disputes.resolvedAlert':       'Dispute {status}',
  'disputes.resolvedAlert.txHash':'tx: {hash}',

  'disputes.tx.resolve':         'Resolve {outcome}',
  'disputes.modal.title':        'Resolve to {outcome}',
  'disputes.modal.ok':           'Submit',
};
