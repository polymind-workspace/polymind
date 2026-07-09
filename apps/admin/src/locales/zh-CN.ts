import activities from './zh-CN/activities';
import campaigns from './zh-CN/campaigns';
import adminAccounts from './zh-CN/admin-accounts';
import adminEvents from './zh-CN/admin-events';
import bets from './zh-CN/bets';
import component from './zh-CN/component';
import config from './zh-CN/config';
import dashboard from './zh-CN/dashboard';
import disputes from './zh-CN/disputes';
import events from './zh-CN/events';
import field from './zh-CN/field';
import globalHeader from './zh-CN/globalHeader';
import imagePicker from './zh-CN/image-picker';
import importPm from './zh-CN/import';
import invitations from './zh-CN/invitations';
import leaderboard from './zh-CN/leaderboard';
import market from './zh-CN/market';
import markets from './zh-CN/markets';
import myQueue from './zh-CN/my-queue';
import push from './zh-CN/push';
import rewards from './zh-CN/rewards';
import signer from './zh-CN/signer';
import wallet from './zh-CN/wallet';
import invite from './zh-CN/invite';
import roles from './zh-CN/roles';
import tags from './zh-CN/tags';
import users from './zh-CN/users';
import menu from './zh-CN/menu';
import network from './zh-CN/network';
import pages from './zh-CN/pages';
import settingDrawer from './zh-CN/settingDrawer';
import settings from './zh-CN/settings';

export default {
  'navBar.lang': '语言',
  'layout.user.link.help': '帮助',
  'layout.user.link.privacy': '隐私',
  'layout.user.link.terms': '条款',
  'app.preview.down.block': '下载此页面到本地项目',
  'common.exportCsv': '导出 CSV',
  ...pages,
  ...globalHeader,
  ...menu,
  ...settingDrawer,
  ...settings,
  ...network,
  ...component,
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
