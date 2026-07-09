import { useCallback, useEffect, useRef, useState } from 'react';
// Static API: model container is above antd <App> provider.
import { message } from 'antd';
import { useWallet } from '@polymind/wallet';
import { addrStore, polymindApi, tokenStore } from '@/services/polymind';

const IDLE_TIMEOUT_MS = 60 * 60 * 1000;

function normalizeAddress(addr: string | null | undefined): string {
  return (addr || '').trim();
}

async function runAuthHandshake(address: string, signMessageBase58: (msg: string) => Promise<string>): Promise<string> {
  const { nonce, message: msg } = await polymindApi.authNonce(address);
  const signature = await signMessageBase58(msg);
  const out = await polymindApi.authVerify({
    address,
    nonce,
    message: msg,
    signature,
  });
  return out.token;
}

export default function useWalletModel() {
  const {
    status,
    address: solanaAddress,
    connect: connectSolana,
    disconnect: disconnectSolana,
    signMessageBase58,
  } = useWallet();

  const [address, setAddress] = useState<string | null>(() => addrStore.get());
  const [admins, setAdmins] = useState<string[]>([]);
  const [contractAdmins, setContractAdmins] = useState<string[]>([]);
  const [contractCreators, setContractCreators] = useState<string[]>([]);
  const [contractDistributors, setContractDistributors] = useState<string[]>([]);
  const [rolesReady, setRolesReady] = useState(false);
  const [isAdminEventAdmin, setIsAdminEventAdmin] = useState(false);
  const [isAdminEventAdminReady, setIsAdminEventAdminReady] = useState(false);
  const [adminEventAdmins, setAdminEventAdmins] = useState<string[]>([]);
  const [championAdmins, setChampionAdmins] = useState<string[]>([]);
  const [isChampionAdmin, setIsChampionAdmin] = useState(false);
  const [isChampionAdminReady, setIsChampionAdminReady] = useState(false);
  const [contractAddr, setContractAddr] = useState<string>('');
  const [adminEventContractAddr, setAdminEventContractAddr] = useState<string>('');
  const [championContractAddr, setChampionContractAddr] = useState<string>('');
  const [token, setToken] = useState<string | null>(() => tokenStore.get());
  const [authedAddr, setAuthedAddr] = useState<string | null>(null);
  const [authedHex, setAuthedHex] = useState<string | null>(null);
  const [authing, setAuthing] = useState(false);

  // Sync connected Solana address into model state and localStorage.
  const latestAddressRef = useRef<string | null>(addrStore.get());
  useEffect(() => {
    latestAddressRef.current = address;
    if (address) {
      addrStore.set(address);
    } else if (status === 'disconnected') {
      addrStore.clear();
    }
  }, [address, status]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      polymindApi
        .authAdmins()
        .then((list) => {
          if (!cancelled) setAdmins(list || []);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      polymindApi
        .listAllRoles()
        .then((r) => {
          if (cancelled) return;
          setContractAdmins(r.admins || []);
          setContractCreators(r.creators || []);
          setContractDistributors(r.distributors || []);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setRolesReady(true);
        });
    load();
    const t = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [token]);

  useEffect(() => {
    polymindApi.meta().then((m) => {
      setContractAddr(m.contract_addr || '');
      setAdminEventContractAddr(m.adminevent_addr || '');
      setChampionContractAddr(m.champion_addr || '');
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!address) {
      setIsAdminEventAdmin(false);
      setIsAdminEventAdminReady(true);
      return;
    }
    let cancelled = false;
    setIsAdminEventAdminReady(false);
    polymindApi
      .adminEventIsAdmin(address)
      .then((ok) => {
        if (!cancelled) {
          setIsAdminEventAdmin(ok);
          setIsAdminEventAdminReady(true);
        }
      })
      .catch(() => { if (!cancelled) setIsAdminEventAdminReady(true); });
    return () => { cancelled = true; };
  }, [address]);

  useEffect(() => {
    if (!address) {
      setIsChampionAdmin(false);
      setIsChampionAdminReady(true);
      return;
    }
    let cancelled = false;
    setIsChampionAdminReady(false);
    polymindApi
      .championIsAdmin(address)
      .then((ok) => {
        if (!cancelled) {
          setIsChampionAdmin(ok);
          setIsChampionAdminReady(true);
        }
      })
      .catch(() => { if (!cancelled) setIsChampionAdminReady(true); });
    return () => { cancelled = true; };
  }, [address]);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      polymindApi
        .listAdminEventAdmins()
        .then((list) => { if (!cancelled) setAdminEventAdmins(list || []); })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      polymindApi
        .listChampionAdmins()
        .then((list) => { if (!cancelled) setChampionAdmins(list || []); })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!token) {
      setAuthedAddr(null);
      setAuthedHex(null);
      return;
    }
    polymindApi
      .authMe()
      .then((m) => {
        setAuthedAddr(m.address);
        setAuthedHex(m.address);
      })
      .catch(() => {
        tokenStore.clear();
        setToken(null);
        setAuthedAddr(null);
        setAuthedHex(null);
      });
  }, [token]);

  const reSigningRef = useRef(false);
  const cooldownUntilRef = useRef(0);

  const signIn = useCallback(async (addr: string) => {
    setAuthing(true);
    try {
      const t = await runAuthHandshake(addr, signMessageBase58);
      tokenStore.set(t);
      setToken(t);
      setAuthedAddr(addr);
      setAuthedHex(addr);
      message.success('Signed in');
      return t;
    } catch (e) {
      const msg = (e as Error).message || 'Sign-in failed';
      if (!/reject|cancel|denied/i.test(msg)) message.error(msg);
      throw e;
    } finally {
      setAuthing(false);
    }
  }, [message, signMessageBase58]);

  useEffect(() => {
    const handler = () => {
      setToken(null);
      setAuthedAddr(null);
      setAuthedHex(null);
      if (!address) return;                          // no wallet to re-sign with
      if (reSigningRef.current) return;              // already mid-flight
      if (Date.now() < cooldownUntilRef.current) return;  // in user-reject cooldown
      reSigningRef.current = true;
      message.warning('Session expired, re-signing…');
      signIn(address)
        .catch((e: Error) => {
          const m = e?.message || '';
          if (/reject|cancel|denied/i.test(m)) {
            cooldownUntilRef.current = Date.now() + 30_000;
          }
        })
        .finally(() => {
          reSigningRef.current = false;
        });
    };
    window.addEventListener('polymind-admin-401', handler);
    return () => window.removeEventListener('polymind-admin-401', handler);
  }, [address, signIn, message]);

  const connect = useCallback(async () => {
    // Default connector list mirrors web-app: Phantom, Solflare, Backpack.
    const connectors = [
      'wallet-standard:phantom',
      'wallet-standard:solflare',
      'wallet-standard:backpack',
    ];
    let lastError: Error | undefined;
    for (const id of connectors) {
      try {
        await connectSolana(id);
        // The Solana hook updates state asynchronously; wait briefly for it.
        for (let i = 0; i < 40; i++) {
          const latest = latestAddressRef.current;
          if (latest) return latest;
          await new Promise((r) => setTimeout(r, 50));
        }
        const fallback = latestAddressRef.current || addrStore.get();
        if (fallback) return fallback;
      } catch (e) {
        lastError = e as Error;
      }
    }
    throw lastError || new Error('No Solana wallet available');
  }, [connectSolana]);

  const disconnect = useCallback(async () => {
    disconnectSolana();
    tokenStore.clear();
    addrStore.clear();
    setToken(null);
    setAuthedAddr(null);
    setAuthedHex(null);
    setAddress(null);
  }, [disconnectSolana]);

  const isAdmin = !!authedAddr;
  const signerHex = normalizeAddress(address);

  const _signerInList = (list: string[]) => {
    if (!signerHex) return false;
    return list.some((a) => normalizeAddress(a) === signerHex);
  };
  const isContractAdmin       = _signerInList(contractAdmins);
  const isContractCreator     = _signerInList(contractCreators);
  const isContractDistributor = _signerInList(contractDistributors);

  const signerDiffersFromAuth = !!(
    address && authedHex && signerHex && signerHex !== normalizeAddress(authedHex)
  );

  const signerMatches = useCallback(
    (raw: string | null | undefined): boolean => {
      if (!signerHex || !raw) return false;
      return normalizeAddress(raw) === signerHex;
    },
    [signerHex],
  );

  const openWalletPicker = useCallback(async () => {
    try {
      disconnectSolana();
      await connectSolana('wallet-standard:phantom');
      for (let i = 0; i < 40; i++) {
        const latest = latestAddressRef.current;
        if (latest) {
          setAddress(latest);
          addrStore.set(latest);
          return;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    } catch (e) {
      const msg = (e as Error).message || 'Wallet not ready';
      if (!/reject|cancel|denied/i.test(msg)) message.error(msg);
    }
  }, [connectSolana, disconnectSolana, message]);

  useEffect(() => {
    if (!token) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        tokenStore.clear();
        setToken(null);
        setAuthedAddr(null);
        setAuthedHex(null);
        message.info('Signed out due to inactivity');
      }, IDLE_TIMEOUT_MS);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [token, message]);

  // Backwards-compatible helpers for Endless-era callers.
  const toCanonicalHex = useCallback(async (addr: string): Promise<string> => {
    return normalizeAddress(addr);
  }, []);

  return {
    address,
    admins,
    contractAdmins,
    contractCreators,
    contractDistributors,
    rolesReady,
    isAdmin,
    isContractAdmin,
    isContractCreator,
    isContractDistributor,
    isAdminEventAdmin,
    isAdminEventAdminReady,
    adminEventAdmins,
    championAdmins,
    isChampionAdmin,
    isChampionAdminReady,
    signerHex,
    signerDiffersFromAuth,
    authing,
    token,
    authedAddr,
    authedHex,
    contractAddr,
    adminEventContractAddr,
    championContractAddr,
    connect,
    disconnect,
    signIn,
    openWalletPicker,
    signerMatches,
    toCanonicalHex,
  };
}
