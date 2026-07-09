export default {
  'campaigns.col.cid':          'Campaign ID',
  'campaigns.col.campaign':     'Campaign',
  'campaigns.col.title':        'Title',
  'campaigns.col.status':       'Status',
  'campaigns.col.options':      'Options',
  'campaigns.col.startTime':    'Starts',
  'campaigns.col.endTime':      'Ends',
  'campaigns.col.participants': 'Players',
  'campaigns.col.stake':        'User stake',
  'campaigns.col.visibility':   'Visibility',
  'campaigns.col.actions':      'Actions',

  'campaigns.status.draft':     'Draft',
  'campaigns.status.betting':   'Live',
  'campaigns.status.settled':   'Settled',
  'campaigns.status.cancelled': 'Cancelled',
  'campaigns.status.noOnchain': 'Not on-chain',

  'campaigns.search.placeholder':       'Search title or campaign ID',
  'campaigns.search.statusPlaceholder': 'All statuses',

  'campaigns.visibility.all':     'All',
  'campaigns.visibility.visible': 'Visible',
  'campaigns.visibility.hidden':  'Hidden',

  'campaigns.tag.hidden':       'Hidden',
  'campaigns.btn.cancel':       'Cancel',

  'champBets.title':      'Participants',
  'champBets.export':     'Export CSV',
  'champBets.col.user':   'User',
  'champBets.col.team':   'Backed',
  'champBets.col.amount': 'Amount',
  'champBets.col.time':   'Time',
  'campaigns.btn.hide':         'Hide',
  'campaigns.btn.unhide':       'Unhide',

  'campaigns.confirm.cancel':     'Cancel this campaign?',
  'campaigns.confirm.cancelDesc': 'On-chain cancel_campaign: voids the campaign and refunds every stake. Cannot be undone.',

  'campaigns.toast.hidden':       'Hidden',
  'campaigns.toast.unhidden':     'Unhidden',

  'campaigns.btn.new':          'New campaign',
  'campaigns.btn.viewAll':      'View all campaigns',
  'campaigns.btn.links':        'Share links',
  'campaigns.btn.delete':       'Delete',
  'campaigns.btn.save':         'Save',
  'campaigns.btn.copy':         'Copy',
  'campaigns.btn.open':         'Open',
  'campaigns.btn.createOnchain':'Create on-chain',
  'campaigns.btn.connect':      'Connect wallet',
  'campaigns.btn.finalize':     'Finalize',

  'campaigns.modal.new':      'New campaign (on-chain)',
  'campaigns.modal.edit':     'Edit campaign config',
  'campaigns.modal.links':    'Share links & preview',
  'campaigns.modal.finalize': 'Finalize campaign',

  'campaigns.btn.addOption':  'Add option',
  'campaigns.btn.review':     'Review & create on-chain',
  'campaigns.btn.saveUpdate': 'Save & update on-chain',

  'campaigns.onchain.notConfigured':   'Champion contract address not configured',
  'campaigns.section.onchainEditHint': 'Changing times / min bet / title fires the matching on-chain update tx (one signature per changed field).',
  'campaigns.section.optionsLocked':   'Bets placed — on-chain options are locked; only display names can change here.',

  'campaigns.section.onchain':         'On-chain settings',
  'campaigns.section.options':         'Options',
  'campaigns.section.optionsEditHint': 'Editing only changes display names; the on-chain option count and order are unchanged.',
  'campaigns.section.display':         'Display copy',

  'campaigns.field.optEn':    'EN (on-chain option)',
  'campaigns.field.optZh':    'ZH (display only)',
  'campaigns.field.contract': 'Contract',

  'campaigns.confirm.title':     'Confirm on-chain create',
  'campaigns.toast.dupOptions':  'Options must be unique',
  'campaigns.toast.startFuture': 'Start time must be in the future',

  'campaigns.onchain.connectHint': 'Creating on-chain needs a connected admin wallet (top-right) that is a champion contract admin.',

  'campaigns.field.startTime':    'Start time',
  'campaigns.field.endTime':      'End time',
  'campaigns.field.minBet':       'Min bet',
  'campaigns.field.optionOnchainHint': 'EN options ARE the on-chain options (vector<String>), order is fixed, need ≥2; other languages are display-only',
  'campaigns.field.winningOption':'Winning option',
  'campaigns.field.winningOptionPlaceholder': 'Pick the champion',
  'campaigns.field.prize':        'Official injection',
  'campaigns.field.prizeHint':    'Seeded into the pool at settlement and split among winners along with the user pool (0 is fine)',

  'campaigns.finalize.hint': 'Once the result is known, calls finalize_campaign so winners can claim. This cannot be undone.',

  'campaigns.toast.created':      'Created on-chain',
  'campaigns.toast.needOptions':  'Need at least 2 EN options',
  'campaigns.toast.badWindow':    'End time must be after start time',
  'campaigns.toast.badMinBet':    'Min bet must be greater than 0',

  'campaigns.field.cid':         'Campaign ID',
  'campaigns.field.cidPlaceholder': 'Leave blank to auto-generate',
  'campaigns.field.cidAutoHint': 'Auto-generated from the EN title when blank; if set, must match the on-chain create_campaign slug',
  'campaigns.field.title':       'Title',
  'campaigns.field.description': 'Description',
  'campaigns.field.windowLabel': 'Window label',
  'campaigns.field.pickLabel':   'Pick section title',

  'campaigns.ph.title':       'e.g. 2026 World Cup Champion',
  'campaigns.ph.description': 'Intro shown at the top of the H5 page',
  'campaigns.ph.windowLabel': 'e.g. Betting closes Jun 12',
  'campaigns.ph.pickLabel':   'e.g. Pick your team',
  'campaigns.field.optionLabels':'Option labels (one per line, ordered to match on-chain options)',
  'campaigns.field.optionHint':  'Line count must equal the on-chain option count',

  'campaigns.links.hint': 'Paste the link for the matching language into the mini-program banner detail URL.',

  'campaigns.toast.saved':        'Saved',
  'campaigns.toast.saveFailed':   'Failed to save',
  'campaigns.toast.deleted':      'Deleted',
  'campaigns.toast.deleteFailed': 'Delete failed',
  'campaigns.toast.copied':       'Copied',
  'campaigns.confirm.delete':     'Delete all config for this campaign?',
  'campaigns.confirm.deleteDesc': 'Only removes display config; on-chain data is untouched',
};
