import { App } from 'antd';
import { useModel } from '@umijs/max';
import { useCallback, useState } from 'react';
import { parseTxError } from '@/wallet/txError';

interface RunOpts {
  name: string;
  call: (contractAddr: string) => Promise<string>;
  confirm?: { title: string; content?: React.ReactNode; danger?: boolean };
  onDone?: (hash: string) => void;
}

export function useAdminTx() {
  const { address, isAdmin, contractAddr } = useModel('wallet');
  const { message, modal } = App.useApp();
  const [busy, setBusy] = useState(false);

  const execute = useCallback(
    async (opts: Pick<RunOpts, 'name' | 'call' | 'onDone'>) => {
      if (!address) {
        message.warning('Connect wallet first');
        throw new Error('Connect wallet first');
      }
      if (!isAdmin) {
        message.error('Connected wallet is not in admin list');
        throw new Error('Not admin');
      }
      if (!contractAddr) {
        message.error('Contract address not loaded yet');
        throw new Error('Contract address not loaded');
      }

      setBusy(true);
      try {
        const hash = await opts.call(contractAddr);
        message.success(`${opts.name}: ${hash.slice(0, 10)}…`);
        opts.onDone?.(hash);
        return hash;
      } catch (e) {
        const raw = (e as Error).message || '';
        if (/reject|cancel|denied/i.test(raw)) {
          throw e;
        }
        message.error(parseTxError(e));
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [address, isAdmin, contractAddr, message],
  );

  const run = useCallback(
    async (opts: RunOpts) => {
      if (opts.confirm) {
        const ok = await new Promise<boolean>((resolve) => {
          modal.confirm({
            title: opts.confirm!.title,
            content: opts.confirm!.content,
            okButtonProps: { danger: opts.confirm!.danger },
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!ok) return;
      }
      try {
        await execute(opts);
      } catch {
        // execute already shows error message
      }
    },
    [execute, modal],
  );

  return { busy, run, execute, canRun: !!address && isAdmin && !!contractAddr };
}
