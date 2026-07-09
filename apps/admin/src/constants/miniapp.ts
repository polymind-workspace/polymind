// Mirrors api/utils/miniapp.py + api/routers/config.py ROUTE_MAP.
// URL format: `${SCHEME}://applet/?appId=${APP_ID}&params=${action}-${id}`.
// Action -> in-app path is resolved on the mini-program client; admin only
// needs to build the right `{action}-{id}` token.
//
// Overridable at build time via UMI_APP_MINIAPP_SCHEME / UMI_APP_MINIAPP_APP_ID.

const ENV_SCHEME = (process.env as Record<string, string | undefined>).UMI_APP_MINIAPP_SCHEME;
const ENV_APP_ID = (process.env as Record<string, string | undefined>).UMI_APP_MINIAPP_APP_ID;

export const MINIAPP_SCHEME = ENV_SCHEME || 'tcmppn3u4by5l18';
export const MINIAPP_APP_ID = ENV_APP_ID || 'mpt6chr8hq3rmgej';

export type MiniAppAction =
  | 'buy-shares'
  | 'create-event'
  | 'confirm-event'
  | 'open-pro'
  | 'default';

export interface MiniAppActionDef {
  key: MiniAppAction;
  // i18n id for the label shown in the picker dropdown.
  labelId: string;
  // If false, no id input — `params` becomes just the action (or empty for default).
  needsId: boolean;
  // For id-bearing actions, hint shown under the id input.
  idHintId?: string;
}

export const MINIAPP_ACTIONS: MiniAppActionDef[] = [
  { key: 'buy-shares',    labelId: 'miniapp.action.buy-shares',    needsId: true,  idHintId: 'miniapp.id.event' },
  { key: 'create-event',  labelId: 'miniapp.action.create-event',  needsId: true,  idHintId: 'miniapp.id.event' },
  { key: 'confirm-event', labelId: 'miniapp.action.confirm-event', needsId: true,  idHintId: 'miniapp.id.draft' },
  { key: 'open-pro',      labelId: 'miniapp.action.open-pro',      needsId: false },
  { key: 'default',       labelId: 'miniapp.action.default',       needsId: false },
];

export function buildMiniAppUrl(action: MiniAppAction, id?: string): string {
  if (action === 'default') {
    return `${MINIAPP_SCHEME}://applet/?appId=${MINIAPP_APP_ID}`;
  }
  const params = action === 'open-pro' || !id ? action : `${action}-${id}`;
  return `${MINIAPP_SCHEME}://applet/?appId=${MINIAPP_APP_ID}&params=${params}`;
}

// Action key needs an event slug (vs draft id or none).
export function actionUsesEventSlug(action: MiniAppAction): boolean {
  return action === 'buy-shares' || action === 'create-event';
}
