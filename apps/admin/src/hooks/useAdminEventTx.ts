import { App } from 'antd';
import { useModel } from '@umijs/max';
import { useCallback, useState } from 'react';
import { parseTxError } from '@/wallet/txError';

interface RunOpts {
  name: string;
  call: (contractAddr: string) => Promise<string>;
  onDone?: (hash: string) => void;
}

export function useAdminEventTx() {
  const { address, isAdminEventAdmin, adminEventContractAddr } = useModel('wallet');
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (opts: RunOpts) => {
      if (!address) {
        message.warning('Connect wallet first');
        return;
      }
      if (!isAdminEventAdmin) {
        message.error('Wallet is not an AdminEvent admin');
        return;
      }

      setBusy(true);
      try {
        const hash = await opts.call(adminEventContractAddr);
        message.success(`${opts.name}: ${hash.slice(0, 10)}…`);
        opts.onDone?.(hash);
      } catch (e) {
        const raw = (e as Error).message || '';
        if (/reject|cancel|denied/i.test(raw)) return;
        message.error(parseTxError(e));
      } finally {
        setBusy(false);
      }
    },
    [address, isAdminEventAdmin, adminEventContractAddr, message],
  );

  return { busy, run, canRun: !!address && isAdminEventAdmin };
}
