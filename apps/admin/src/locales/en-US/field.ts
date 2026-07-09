// Shared contract-field labels reused by Events/Create + Import/Polymarket
// and other forms that mirror admin_create_event_with_market.
export default {
  'field.question':    'Event question',
  'field.description': 'Event description',
  'field.title':       'Market title',
  'field.deadline':    'Deadline',
  'field.deadlineFuture': 'Deadline must be in the future',

  'field.labelYes':    'YES label',
  'field.labelNo':     'NO label',
  'field.seedSide':    'Initial seed side',
  'field.seedAmount':  'Initial seed amount (EDS)',

  'field.platformFeeBps':            'Platform fee (bps)',
  'field.platformFeeMax':            'Platform fee cap (EDS)',
  'field.platformFeeMax.noCap':      'Platform fee cap (EDS, 0 = no cap)',
  'field.creatorRewardBps':          'Creator reward (bps)',
  'field.creatorRewardMax':          'Creator reward cap (EDS)',
  'field.creatorRewardMax.noCap':    'Creator reward cap (EDS, 0 = no cap)',
  'field.disputeWindowSecs':         'Dispute window (seconds)',
  'field.adminTimeoutSecs':          'Emergency-void wait (seconds)',
  'field.creatorProposeTimeoutSecs': 'Creator priority window (seconds)',
  'field.expiredProposeMode':        'After priority window',
  'field.expiredProposeMode.opt0':   'Participants take over',
  'field.expiredProposeMode.opt1':   'Expire & slash seed',
  'field.singleSideOnly':            'Lock each user to one side',
};
