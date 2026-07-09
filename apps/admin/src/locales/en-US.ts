import activities from './en-US/activities';
import campaigns from './en-US/campaigns';
import adminAccounts from './en-US/admin-accounts';
import adminEvents from './en-US/admin-events';
import bets from './en-US/bets';
import component from './en-US/component';
import config from './en-US/config';
import dashboard from './en-US/dashboard';
import disputes from './en-US/disputes';
import events from './en-US/events';
import field from './en-US/field';
import globalHeader from './en-US/globalHeader';
import imagePicker from './en-US/image-picker';
import importPm from './en-US/import';
import invitations from './en-US/invitations';
import leaderboard from './en-US/leaderboard';
import market from './en-US/market';
import markets from './en-US/markets';
import myQueue from './en-US/my-queue';
import push from './en-US/push';
import rewards from './en-US/rewards';
import signer from './en-US/signer';
import wallet from './en-US/wallet';
import invite from './en-US/invite';
import roles from './en-US/roles';
import tags from './en-US/tags';
import users from './en-US/users';
import menu from './en-US/menu';
import network from './en-US/network';
import pages from './en-US/pages';
import settingDrawer from './en-US/settingDrawer';
import settings from './en-US/settings';

export default {
  'navBar.lang': 'Languages',
  'layout.user.link.help': 'Help',
  'layout.user.link.privacy': 'Privacy',
  'layout.user.link.terms': 'Terms',
  'app.preview.down.block': 'Download this page to your local project',
  'common.exportCsv': 'Export CSV',
  ...globalHeader,
  ...menu,
  ...settingDrawer,
  ...settings,
  ...network,
  ...component,
  ...pages,
  ...config,
  ...dashboard,
  ...adminAccounts,
  ...adminEvents,
  ...bets,
  ...importPm,
  ...invitations,
  ...leaderboard,
  ...field,
  ...events,
  ...market,
  ...markets,
  ...myQueue,
  ...disputes,
  ...activities,
  ...campaigns,
  ...imagePicker,
  ...tags,
  ...users,
  ...push,
  ...rewards,
  ...signer,
  ...wallet,
  ...invite,
  ...roles,
};
