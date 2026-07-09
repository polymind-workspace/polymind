const ERROR_MESSAGES: Record<string, string> = {
  E_NOT_ADMIN:              'Admin only',
  E_ALREADY_INITIALIZED:    'Contract already initialized',
  E_INVALID_OUTCOME:        'Invalid outcome',
  E_REASON_TOO_LONG:        'Reason text is too long',
  E_SPONSOR_DISABLED:       'Sponsored entry is disabled by admin',
  E_NOT_PARTICIPANT:        'Only people with a position in this market can do this',
  E_NOT_CREATOR:            'Only the event creator can do this',
  E_EVENT_NOT_FOUND:        'Event not found',
  E_MARKET_NOT_FOUND:       'Market not found',
  E_DEADLINE_PASSED:        'The deadline has already passed',
  E_DEADLINE_NOT_PASSED:    'The deadline has not passed yet',
  E_ZERO_AMOUNT:            'Amount must be greater than zero',
  E_INVALID_SIDE:           'Invalid side — must be YES or NO',
  E_SEED_TOO_LOW:           'Seed amount is below the minimum required',
  E_ALREADY_PROPOSED:       'An outcome has already been proposed',
  E_NOT_PROPOSED:           'No outcome has been proposed yet',
  E_DISPUTE_ACTIVE:         'A dispute is currently active',
  E_WINDOW_NOT_PASSED:      'Dispute window has not elapsed yet',
  E_TIMEOUT_NOT_REACHED:    'Admin timeout has not been reached',
  E_ALREADY_FINALIZED:      'This market is already finalized',
  E_NOT_FINALIZED:          'This market is not yet finalized',
  E_ALREADY_CLAIMED:        'You have already claimed your payout',
  E_NO_POSITION:            'You have no position in this market',
  E_INVALID_CONFIG:         'Invalid configuration value',
  E_OVERFLOW:               'Numeric overflow',
  E_INSUFFICIENT_FEES:      'Not enough fees collected for this action',
  E_PROPOSE_WINDOW_EXPIRED: 'Your propose window expired — anyone can step in now',
  E_CONFIG_STORE_MISSING:   'Contract upgrade not finalized — admin must call init_config_store first',
  E_DISPUTED_REQUIRES_ADMIN:'This market was disputed and can only be finalized by an admin',
  E_NO_CREATOR_REWARD:      'No creator reward to withdraw',
  E_OPPOSITE_SIDE_NOT_ALLOWED:'You can only place a bet on one side',
  E_DUPLICATE_DISPUTE:      'You have already filed a dispute on this market',
  E_NO_DISPUTE:             'No dispute exists to act on',
  E_INVALID_AMOUNT:         'Invalid bond amount',
  E_INSUFFICIENT_BALANCE:   'Insufficient balance for the dispute bond',
  E_ALREADY_RESOLVED:       'This dispute has already been resolved',
  E_EMPTY_REASON:           'Reason cannot be empty',
  E_ALREADY_ADMIN:          'Address is already an admin',
  E_ADMIN_NOT_FOUND:        'Address is not an admin',
  E_LAST_ADMIN:             'Cannot remove the last admin',
};

const MARKET_ABORT_NAMES: (string | null)[] = [
  null,
  'E_NOT_ADMIN', 'E_ALREADY_INITIALIZED', 'E_NOT_CREATOR', 'E_EVENT_NOT_FOUND',
  'E_MARKET_NOT_FOUND', 'E_DEADLINE_PASSED', 'E_DEADLINE_NOT_PASSED', 'E_ZERO_AMOUNT',
  'E_INVALID_SIDE', 'E_INVALID_OUTCOME', 'E_SEED_TOO_LOW', 'E_ALREADY_PROPOSED',
  'E_NOT_PROPOSED', 'E_DISPUTE_ACTIVE', 'E_WINDOW_NOT_PASSED', 'E_TIMEOUT_NOT_REACHED',
  'E_ALREADY_FINALIZED', 'E_NOT_FINALIZED', 'E_ALREADY_CLAIMED', 'E_NO_POSITION',
  'E_INVALID_CONFIG', 'E_OVERFLOW', 'E_REASON_TOO_LONG', 'E_INSUFFICIENT_FEES',
  'E_SPONSOR_DISABLED', 'E_PROPOSE_WINDOW_EXPIRED', 'E_NOT_PARTICIPANT',
  'E_CONFIG_STORE_MISSING', 'E_DISPUTED_REQUIRES_ADMIN',
  'E_NO_CREATOR_REWARD', 'E_OPPOSITE_SIDE_NOT_ALLOWED',
];

const DISPUTE_ABORT_NAMES: (string | null)[] = [
  null,
  'E_NOT_ADMIN', 'E_ALREADY_INITIALIZED', 'E_DUPLICATE_DISPUTE', 'E_NO_DISPUTE',
  'E_INVALID_AMOUNT', null, 'E_INVALID_OUTCOME', 'E_REASON_TOO_LONG',
  'E_ALREADY_RESOLVED', 'E_EMPTY_REASON', 'E_SPONSOR_DISABLED', 'E_NOT_PARTICIPANT',
];

const ADMIN_ABORT_NAMES: (string | null)[] = [
  null,
  'E_ALREADY_INITIALIZED', 'E_NOT_ADMIN', 'E_ALREADY_ADMIN',
  'E_ADMIN_NOT_FOUND', 'E_LAST_ADMIN',
];

const WALLET_ERROR_MESSAGES: Record<string, string> = {
  WALLET_REJECTED:    'Transaction was rejected in the wallet.',
  WALLET_ERROR:       'The wallet could not submit this transaction. Please try again.',
  WALLET_EMPTY_HASH:  'The wallet did not return a transaction hash. Please try again.',
  WALLET_BRIDGE_FAIL: 'Could not reach the wallet. Please check the wallet and try again.',
};

function tableForMessage(msg: string): (string | null)[] | null {
  if (/::market\b/.test(msg))  return MARKET_ABORT_NAMES;
  if (/::dispute\b/.test(msg)) return DISPUTE_ABORT_NAMES;
  if (/::admin\b/.test(msg))   return ADMIN_ABORT_NAMES;
  return null;
}

export function parseTxError(err: unknown): string {
  const msg =
    (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : '') || String(err || '');

  const named = msg.match(/E_[A-Z_]+/);
  if (named && ERROR_MESSAGES[named[0]]) return ERROR_MESSAGES[named[0]];
  if (named) return named[0];

  const table = tableForMessage(msg);

  const dec = msg.match(/error\s*code\s*[:=]?\s*(\d+)/i);
  const hex = msg.match(/\((0x[0-9a-fA-F]+)\)/);
  const code = dec ? parseInt(dec[1], 10)
             : hex ? parseInt(hex[1], 16)
             : NaN;

  if (Number.isFinite(code)) {
    const name = table ? table[code] : null;
    if (name && ERROR_MESSAGES[name]) return ERROR_MESSAGES[name];
    if (!table) {
      const hits = [MARKET_ABORT_NAMES, DISPUTE_ABORT_NAMES, ADMIN_ABORT_NAMES]
        .map((tbl) => tbl[code])
        .filter((n): n is string => !!n && !!ERROR_MESSAGES[n]);
      if (hits.length === 1) return ERROR_MESSAGES[hits[0]];
    }
    return `Move abort code ${code}`;
  }

  if (err && typeof err === 'object' && 'code' in err) {
    const c = (err as { code: unknown }).code;
    if (typeof c === 'string' && WALLET_ERROR_MESSAGES[c]) {
      return WALLET_ERROR_MESSAGES[c];
    }
  }

  if (/reject|cancel|denied/i.test(msg)) return WALLET_ERROR_MESSAGES.WALLET_REJECTED;

  return msg.trim() || 'Transaction failed. Please try again.';
}
