import { Network } from '@endlesslab/endless-ts-sdk';
import {
  EndlessJsSdk,
  UserResponseStatus,
  type EndlessSignAndSubmitTransactionInput,
} from '@endlesslab/endless-web3-sdk';

const NETWORK_KEY = 'polymind_admin_network';

export type NetworkChoice = 'mainnet' | 'testnet' | 'devnet';

const NETWORK_MAP: Record<NetworkChoice, Network> = {
  mainnet: Network.MAINNET,
  testnet: Network.TESTNET,
  devnet: Network.DEVNET,
};

const ENV_NETWORK = process.env.POLYMIND_NETWORK as NetworkChoice | undefined;

const DEFAULT_NETWORK: NetworkChoice =
  ENV_NETWORK && ENV_NETWORK in NETWORK_MAP
    ? ENV_NETWORK
    : process.env.NODE_ENV === 'production'
      ? 'mainnet'
      : 'testnet';

export function getNetwork(): NetworkChoice {
  return (localStorage.getItem(NETWORK_KEY) as NetworkChoice) || DEFAULT_NETWORK;
}

export function setNetworkPref(n: NetworkChoice) {
  localStorage.setItem(NETWORK_KEY, n);
}

let _sdk: EndlessJsSdk | null = null;

export function getSdk(): EndlessJsSdk {
  if (_sdk) return _sdk;
  _sdk = new EndlessJsSdk({
    network: NETWORK_MAP[getNetwork()],
    colorMode: 'dark',
  });
  return _sdk;
}

export async function connectWallet(): Promise<string> {
  const res = await getSdk().connect();
  if (res.status !== UserResponseStatus.APPROVED) {
    throw new Error(('message' in res && res.message) || 'Wallet connect rejected');
  }
  return res.args.account.toString();
}

export async function disconnectWallet() {
  await getSdk().disconnect();
}

export async function getCurrentAddress(): Promise<string | null> {
  try {
    const res = await getSdk().getAccount();
    if (res.status === UserResponseStatus.APPROVED) {
      return res.args.account.toString();
    }
  } catch {}
  return null;
}

export interface SignedMessage {
  fullMessage: string;
  publicKey: string;
  signature: string;
}

export async function signMessage(message: string, nonce: string): Promise<SignedMessage> {
  const res = await getSdk().signMessage({ message, nonce });
  if (res.status !== UserResponseStatus.APPROVED) {
    throw new Error(('message' in res && res.message) || 'Sign rejected');
  }
  const out = res.args as unknown as {
    fullMessage: string;
    publicKey: string;
    signature: { toString(): string } | string;
  };
  return {
    fullMessage: out.fullMessage,
    publicKey: out.publicKey,
    signature: typeof out.signature === 'string' ? out.signature : out.signature.toString(),
  };
}

async function submitEntry(
  fn: string,
  args: unknown[],
): Promise<string> {
  const safeArgs = args.map((a) => {
    if (a === null || a === undefined) return '';
    if (typeof a === 'boolean') return a;
    if (Array.isArray(a)) return a.map(String);
    return String(a);
  });
  const txData: EndlessSignAndSubmitTransactionInput = {
    payload: {
      function: fn as `${string}::${string}::${string}`,
      functionArguments: safeArgs as unknown as never,
    },
  };

  console.log('[wallet] submitEntry:', fn, 'args count:', safeArgs.length, 'first arg:', safeArgs[0]);

  // 30 秒超时，避免 SDK 卡住导致 UI 无限 loading
  const timeoutMs = 30000;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('钱包签名超时（30秒），请检查钱包插件是否响应')), timeoutMs),
  );

  const res = await Promise.race([
    getSdk().signAndSubmitTransaction(txData),
    timeout,
  ]);

  console.log('[wallet] signAndSubmitTransaction result status:', res.status);
  if (res.status !== UserResponseStatus.APPROVED) {
    const msg = ('message' in res && res.message) || `Transaction rejected (status=${res.status})`;
    console.error('[wallet] rejected:', msg);
    throw new Error(msg);
  }
  console.log('[wallet] tx hash:', res.args.hash);
  return res.args.hash;
}
export const V3_OUTCOME = { YES: 1, NO: 2, VOID: 3 } as const;
export const V3_SIDE = { YES: 0, NO: 1 } as const;

export async function v3AdminCreateEventWithMarket(addr: string, args: {
  question: string;
  description: string;
  title: string;
  labelYes: string;
  labelNo: string;
  deadline: number;
  seedSide: 0 | 1;
  seedAmount: bigint;
  externalSource: number;
  externalMarketId: string;
  externalAuxId: number;
  platformFeeBps: number;
  platformFeeMax: bigint;
  creatorRewardBps: number;
  creatorRewardMax: bigint;
  disputeWindowSecs: number;
  adminTimeoutSecs: number;
  creatorProposeTimeoutSecs: number;
  expiredProposeMode: number;
  singleSideOnly: boolean;
}) {
  return submitEntry(`${addr}::market::admin_create_event_with_market`, [
    args.question, args.description, args.title, args.labelYes, args.labelNo,
    String(args.deadline), String(args.seedSide), args.seedAmount.toString(),
    String(args.externalSource), args.externalMarketId || '', String(args.externalAuxId || 0),
    String(args.platformFeeBps || 0), args.platformFeeMax.toString(),
    String(args.creatorRewardBps || 0), args.creatorRewardMax.toString(),
    String(args.disputeWindowSecs || 0), String(args.adminTimeoutSecs || 0),
    String(args.creatorProposeTimeoutSecs || 0), String(args.expiredProposeMode || 0),
    args.singleSideOnly,
  ]);
}

export async function v3AddMarket(addr: string, args: {
  eventId: number;
  title: string;
  labelYes: string;
  labelNo: string;
  deadline: number;
  seedSide: 0 | 1;
  seedAmount: bigint;
  externalSource: number;
  externalMarketId: string;
  externalAuxId: number;
}) {
  return submitEntry(`${addr}::market::add_market`, [
    String(args.eventId), args.title, args.labelYes, args.labelNo,
    String(args.deadline), String(args.seedSide), args.seedAmount.toString(),
    String(args.externalSource), args.externalMarketId || '', String(args.externalAuxId || 0),
  ]);
}

export async function v3AdminAddMarket(addr: string, args: {
  eventId: number;
  title: string;
  labelYes: string;
  labelNo: string;
  deadline: number;
  seedSide: 0 | 1;
  seedAmount: bigint;
  externalSource: number;
  externalMarketId: string;
  externalAuxId: number;
  platformFeeBps: number;
  platformFeeMax: bigint;
  creatorRewardBps: number;
  creatorRewardMax: bigint;
  disputeWindowSecs: number;
  adminTimeoutSecs: number;
  creatorProposeTimeoutSecs: number;
  expiredProposeMode: number;
  singleSideOnly: boolean;
}) {
  return submitEntry(`${addr}::market::admin_add_market`, [
    String(args.eventId), args.title, args.labelYes, args.labelNo,
    String(args.deadline), String(args.seedSide), args.seedAmount.toString(),
    String(args.externalSource), args.externalMarketId || '', String(args.externalAuxId || 0),
    String(args.platformFeeBps || 0), args.platformFeeMax.toString(),
    String(args.creatorRewardBps || 0), args.creatorRewardMax.toString(),
    String(args.disputeWindowSecs || 0), String(args.adminTimeoutSecs || 0),
    String(args.creatorProposeTimeoutSecs || 0), String(args.expiredProposeMode || 0),
    args.singleSideOnly,
  ]);
}

export async function v3ProposeOutcome(addr: string, eventId: number,
                                       marketIdx: number, outcome: 1 | 2 | 3) {
  return submitEntry(`${addr}::market::propose_outcome`,
    [String(eventId), String(marketIdx), outcome]);
}

export async function v3FinalizeProposed(addr: string, eventId: number,
                                         marketIdx: number) {
  return submitEntry(`${addr}::market::finalize_proposed`,
    [String(eventId), String(marketIdx)]);
}

export async function v3AdminFinalize(addr: string, eventId: number,
                                      marketIdx: number, outcome: 1 | 2 | 3,
                                      adminReason: string) {
  return submitEntry(`${addr}::market::admin_finalize`,
    [String(eventId), String(marketIdx), outcome, adminReason]);
}

export async function v3EmergencyVoid(addr: string, eventId: number,
                                      marketIdx: number) {
  return submitEntry(`${addr}::market::emergency_void`,
    [String(eventId), String(marketIdx)]);
}

export async function v3ExpireUnproposed(addr: string, eventId: number,
                                          marketIdx: number) {
  return submitEntry(`${addr}::market::expire_unproposed`,
    [String(eventId), String(marketIdx)]);
}

export async function v3AdminResolve(addr: string, eventId: number,
                                     marketIdx: number, disputer: string,
                                     resolvedOutcome: 1 | 2 | 3,
                                     adminReason: string) {
  return submitEntry(`${addr}::dispute::admin_resolve`,
    [String(eventId), String(marketIdx), disputer, resolvedOutcome, adminReason]);
}

export async function v3UpdateConfig(addr: string, args: {
  creatorSeedMin: bigint;
  disputeWindowSecs: number;
  adminTimeoutSecs: number;
  platformFeeBps: number;
  platformFeeMax: bigint;
  creatorRewardBps: number;
  creatorRewardMax: bigint;
  creatorProposeTimeoutSecs: number;
  expiredProposeMode: number;
  singleSideOnly: boolean;
}) {
  return submitEntry(`${addr}::market::update_config`, [
    args.creatorSeedMin.toString(),
    String(args.disputeWindowSecs),
    String(args.adminTimeoutSecs),
    args.platformFeeBps,
    args.platformFeeMax.toString(),
    args.creatorRewardBps,
    args.creatorRewardMax.toString(),
    String(args.creatorProposeTimeoutSecs),
    args.expiredProposeMode,
    args.singleSideOnly,
  ]);
}

export async function v3SetMinBet(addr: string, minBetBase: bigint) {
  return submitEntry(`${addr}::market::set_min_bet`, [minBetBase.toString()]);
}

export async function v3InitBetParams(addr: string) {
  return submitEntry(`${addr}::market::init_bet_params`, []);
}

export async function v3WithdrawPlatformBalance(
  addr: string,
  amount: bigint,
  to: string,
) {
  return submitEntry(`${addr}::market::withdraw_platform_balance`,
    [amount.toString(), to]);
}

export interface MarketSponsorFlags {
  createEvent:      boolean;
  addMarket:        boolean;
  bet:              boolean;
  propose:          boolean;
  finalize:         boolean;
  emergencyVoid:    boolean;
  expireUnproposed: boolean;
}

export async function v3UpdateMarketSponsorFlags(addr: string, f: MarketSponsorFlags) {
  return submitEntry(`${addr}::market::update_sponsor_flags`, [
    f.createEvent, f.addMarket, f.bet, f.propose,
    f.finalize, f.emergencyVoid, f.expireUnproposed,
  ]);
}

export async function v3UpdateDisputeBondAmount(addr: string, newAmount: bigint) {
  return submitEntry(`${addr}::dispute::update_bond_amount`,
    [newAmount.toString()]);
}

export async function v3UpdateDisputeSponsorFlags(addr: string, fileDispute: boolean) {
  return submitEntry(`${addr}::dispute::update_sponsor_flags`, [fileDispute]);
}

export async function v3AddAdmin(addr: string, newAdmin: string) {
  return submitEntry(`${addr}::admin::add_admin`, [newAdmin]);
}

export async function v3Claim(addr: string, eventId: number, marketIdx: number) {
  return submitEntry(`${addr}::market::claim`,
    [String(eventId), String(marketIdx)]);
}

export async function v3ClaimCreatorReward(addr: string) {
  return submitEntry(`${addr}::market::claim_creator_reward`, []);
}

export async function v3RemoveAdmin(addr: string, target: string) {
  return submitEntry(`${addr}::admin::remove_admin`, [target]);
}

export async function v3AddCreator(addr: string, newAddr: string) {
  return submitEntry(`${addr}::admin::add_creator`, [newAddr]);
}

export async function v3RemoveCreator(addr: string, target: string) {
  return submitEntry(`${addr}::admin::remove_creator`, [target]);
}

export async function v3AddDistributor(addr: string, newAddr: string) {
  return submitEntry(`${addr}::admin::add_distributor`, [newAddr]);
}

export async function v3RemoveDistributor(addr: string, target: string) {
  return submitEntry(`${addr}::admin::remove_distributor`, [target]);
}


export async function adminEventCreate(addr: string, args: {
  slug:        string;
  question:    string;
  answers:     string[];
  startTime:   number;
  endTime:     number;
  minBetBase:  bigint;
  prizeBase:   bigint;
}) {
  const slugBytes = Array.from(new TextEncoder().encode(args.slug));
  return submitEntry(`${addr}::adminevent::create_event`, [
    slugBytes,
    args.question,
    args.answers,
    String(args.startTime),
    String(args.endTime),
    args.minBetBase.toString(),
    args.prizeBase.toString(),
  ]);
}
export async function adminEventFinalize(addr: string, args: {
  slug:          string;
  correctAnswer: string;
}) {
  const slugBytes = Array.from(new TextEncoder().encode(args.slug));
  return submitEntry(`${addr}::adminevent::finalize_event`, [
    slugBytes,
    args.correctAnswer,
  ]);
}

export async function adminEventWithdrawBets(addr: string, slug: string) {
  const slugBytes = Array.from(new TextEncoder().encode(slug));
  return submitEntry(`${addr}::adminevent::withdraw_collected_bets`, [slugBytes]);
}

export async function adminEventAddAdmin(addr: string, newAddr: string) {
  return submitEntry(`${addr}::adminevent::add_admin`, [newAddr]);
}

export async function adminEventRemoveAdmin(addr: string, target: string) {
  return submitEntry(`${addr}::adminevent::remove_admin`, [target]);
}

export async function championCreateCampaign(addr: string, args: {
  slug:       string;
  question:   string;
  options:    string[];
  startTime:  number;
  endTime:    number;
  minBetBase: bigint;
}) {
  const slugBytes = Array.from(new TextEncoder().encode(args.slug));
  return submitEntry(`${addr}::champion::create_campaign`, [
    slugBytes,
    args.question,
    args.options,
    String(args.startTime),
    String(args.endTime),
    args.minBetBase.toString(),
  ]);
}

export async function championFinalize(addr: string, args: {
  slug:          string;
  winningOption: number;
  prizeBase:     bigint;
}) {
  const slugBytes = Array.from(new TextEncoder().encode(args.slug));
  return submitEntry(`${addr}::champion::finalize_campaign`, [
    slugBytes,
    String(args.winningOption),
    args.prizeBase.toString(),
  ]);
}

function championSlug(slug: string) {
  return Array.from(new TextEncoder().encode(slug));
}
export async function championUpdateQuestion(addr: string, slug: string, question: string) {
  return submitEntry(`${addr}::champion::update_question`, [championSlug(slug), question]);
}
export async function championUpdateStartTime(addr: string, slug: string, startTime: number) {
  return submitEntry(`${addr}::champion::update_start_time`, [championSlug(slug), String(startTime)]);
}
export async function championUpdateEndTime(addr: string, slug: string, endTime: number) {
  return submitEntry(`${addr}::champion::update_end_time`, [championSlug(slug), String(endTime)]);
}
export async function championUpdateMinBet(addr: string, slug: string, minBetBase: bigint) {
  return submitEntry(`${addr}::champion::update_min_bet`, [championSlug(slug), minBetBase.toString()]);
}
export async function championUpdateOptions(addr: string, slug: string, options: string[]) {
  return submitEntry(`${addr}::champion::update_options`, [championSlug(slug), options]);
}
export async function championCancel(addr: string, slug: string) {
  return submitEntry(`${addr}::champion::cancel_campaign`, [championSlug(slug)]);
}
export async function championAddAdmin(addr: string, target: string) {
  return submitEntry(`${addr}::champion::add_admin`, [target]);
}
export async function championRemoveAdmin(addr: string, target: string) {
  return submitEntry(`${addr}::champion::remove_admin`, [target]);
}

// ── reward_vault ────────────────────────────────────────────────────────────

export async function rewardVaultCreatePayout(
  addr: string,
  name: string,
  tag: string,
  deadline: number,
) {
  return submitEntry(`${addr}::reward_vault::create_payout`, [
    name,
    tag || '',
    String(deadline),
  ]);
}

export async function rewardVaultAddRewards(
  addr: string,
  payoutId: number,
  recipients: string[],
  amounts: string[],
) {
  return submitEntry(`${addr}::reward_vault::add_rewards`, [
    String(payoutId),
    recipients,
    amounts,
  ]);
}
