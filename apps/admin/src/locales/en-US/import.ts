export default {
  'import.subtitle': 'Browse Polymarket events and mirror selected markets into the PolyMind contract.',
  'import.loadMore': 'Load more',

  'import.adminBlock.connect':   'Connect a wallet to enable import.',
  'import.adminBlock.loading':   'Loading contract address…',
  'import.adminBlock.notAdmin':  'Wallet {addr}… is not in the admin allow-list.',

  'import.filter.category':   'Category:',
  'import.filter.all':        'All',
  'import.filter.search':     'Search keyword',
  'import.filter.activeOnly': 'Active only',

  'import.empty': 'No events found',

  'import.card.chance':       'chance',
  'import.card.more':         '+{n} more',
  'import.card.allImported':  'All imported',
  'import.card.closed':       'Closed',
  'import.card.ends':         'Ends {date}',
  'import.card.markets':      '{count} markets',

  'import.drawer.linkedInfo':     'Linked to on-chain event #{id}. Subsequent imports are appended via add_market under this event.',
  'import.drawer.linkedMismatch': 'Linked to on-chain event #{id}. Only the original creator wallet {addr}… may add new markets here.',

  'import.error.eventAlreadyImported': 'This event already has imported markets but the on-chain link is missing. Please refresh the page and use Add.',

  'import.drawer.linking': 'Linking to on-chain event, please wait…',
  'import.drawer.noActive': 'No in-progress markets in this event',

  'import.row.imported': 'Imported',
  'import.row.add':      'Add',
  'import.row.import':   'Import',
  'import.row.linking':  'Linking…',
  'import.row.endsShort':'Ends {date}',
  'import.row.closed':   'Closed',

  'import.modal.titleAdd':    'Add market to on-chain event #{id}',
  'import.modal.titleCreate': 'Import market to PolyMind',
  'import.modal.okAdd':       'Sign & add',
  'import.modal.okCreate':    'Sign & create',
  'import.modal.source':      'Polymarket source',
  'import.modal.open':        'open ↗',
  'import.modal.conditionId': 'condition_id: {id}',

  'import.tx.add':    'Add market',
  'import.tx.import': 'Import Polymarket market',

  'import.confirm.addTitle':      'Add market to on-chain event #{id}?',
  'import.confirm.addContent':    '{title} → add_market(event_id={id}). Inherits the existing event config.',
  'import.confirm.createTitle':   'Import this Polymarket market?',
  'import.confirm.createContent': '{question} → admin_create_event_with_market (externalSource=1).',

  'import.filter.activity':           'Activity:',
  'import.filter.activity.allTime':   'All Time',
  'import.filter.activity.today':     'Today',
  'import.filter.activity.week':      'This Week',
  'import.filter.activity.month':     'This Month',
  'import.filter.activity.breaking':  'Breaking',
  'import.filter.expires':            'Expires:',
  'import.filter.expires.all':        'All',
  'import.filter.expires.daily':      'Today',
  'import.filter.expires.weekly':     'This Week',
  'import.filter.expires.monthly':    'This Month',
  'import.card.vol24h':              '24h: {v}',

  // Form labels are shared with Events/Create — see locales/en-US/field.ts
};
