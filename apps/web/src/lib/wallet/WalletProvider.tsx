"use client";

import type { SolanaClientConfig } from "@solana/client";
import {
  SolanaProvider,
  useConnectWallet as useSolanaConnect,
  useDisconnectWallet as useSolanaDisconnect,
  useWallet as useSolanaWallet,
} from "@solana/react-hooks";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const config: SolanaClientConfig = {
  cluster: import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet",
  rpc: import.meta.env.VITE_SOLANA_RPC ?? "https://api.devnet.solana.com",
  websocket:
    import.meta.env.VITE_SOLANA_WS ?? "wss://api.devnet.solana.com",
};

const MOCK_ADDRESS = "MockUser111111111111111111111111111111111111";

export type WalletStatus = "connected" | "connecting" | "disconnected";

export type WalletContextValue = {
  status: WalletStatus;
  address: string | null;
  isMock: boolean;
  connect: (connectorId: string) => Promise<void>;
  disconnect: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function WalletContextProvider({ children }: { children: ReactNode }) {
  const solana = useSolanaWallet();
  const connectSolana = useSolanaConnect();
  const disconnectSolana = useSolanaDisconnect();
  const [mockAddress, setMockAddress] = useState<string | null>(null);

  const isMock = Boolean(mockAddress);

  const address = useMemo(() => {
    if (mockAddress) return mockAddress;
    if (solana.status === "connected" && solana.session) {
      return solana.session.account.address.toString();
    }
    return null;
  }, [mockAddress, solana]);

  const status: WalletStatus = useMemo(() => {
    if (isMock || solana.status === "connected") return "connected";
    if (solana.status === "connecting") return "connecting";
    return "disconnected";
  }, [isMock, solana.status]);

  const connect = useCallback(
    async (connectorId: string) => {
      if (connectorId === "__mock__") {
        setMockAddress(MOCK_ADDRESS);
        return;
      }
      await connectSolana(connectorId, { autoConnect: true });
    },
    [connectSolana]
  );

  const disconnect = useCallback(() => {
    if (mockAddress) {
      setMockAddress(null);
      return;
    }
    disconnectSolana();
  }, [mockAddress, disconnectSolana]);

  const value = useMemo(
    () => ({ status, address, isMock, connect, disconnect }),
    [status, address, isMock, connect, disconnect]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <SolanaProvider config={config}>
      <WalletContextProvider>{children}</WalletContextProvider>
    </SolanaProvider>
  );
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return ctx;
}

// Re-export official hooks for advanced use cases.
export {
  useSolanaWallet as useRawSolanaWallet,
  useSolanaConnect as useConnectWallet,
  useSolanaDisconnect as useDisconnectWallet,
};
