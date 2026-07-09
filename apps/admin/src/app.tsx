import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { Link, SelectLang } from '@umijs/max';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import React from 'react';

dayjs.extend(relativeTime);
dayjs.extend(utc);

import { EnvBadge, ErrorBoundary, Footer, OfflineBanner } from '@/components';
import AuthGate from '@/components/AuthGate';
import WalletWidget from '@/components/WalletWidget';
import { WalletProvider } from '@polymind/wallet';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

const isDev = process.env.NODE_ENV === 'development';

export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
}> {
  return { settings: defaultSettings as Partial<LayoutSettings> };
}

export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  return {
    menuItemRender: (item, dom) =>
      item.path ? <Link to={item.path} prefetch>{dom}</Link> : dom,
    actionsRender: () => [
      <WalletWidget key="wallet" />,
      <SelectLang key="lang" />,
    ],
    avatarProps: undefined,
    footerRender: () => <Footer />,
    menuFooterRender: (props) => <EnvBadge collapsed={props?.collapsed} />,
    ErrorBoundary,
    menuHeaderRender: undefined,
    childrenRender: (children) => <AuthGate>{children}</AuthGate>,
    ...initialState?.settings,
  };
};

/**
 * @name request 配置，可以配置错误处理
 * 它基于 axios 提供了一套统一的网络请求和错误处理方案。
 * @doc https://umijs.org/docs/max/request#配置
 */
export const request: RequestConfig = {
  baseURL: '',
  ...errorConfig,
};

export function rootContainer(container: React.ReactNode) {
  return (
    <WalletProvider>
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </WalletProvider>
  );
}
