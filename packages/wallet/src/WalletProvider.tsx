"use client";

import type { SolanaClientConfig } from "@solana/client";
import {
  SolanaProvider,
  useConnectWallet as useSolanaConnect,
  useDisconnectWallet as useSolanaDisconnect,
  useWallet as useSolanaWallet,
  useWalletSession,
} from "@solana/react-hooks";
import bs58 from "bs58";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type { SolanaClientConfig } from "@solana/client";

const MOCK_ADDRESS = "MockUser111111111111111111111111111111111111";

export type WalletStatus = "connected" | "connecting" | "disconnected";

export type WalletContextValue = {
  status: WalletStatus;
  address: string | null;
  isMock: boolean;
  connect: (connectorId: string) => Promise<void>;
  disconnect: () => void;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signMessageBase58: (message: string | Uint8Array) => Promise<string>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function WalletContextProvider({ children }: { children: ReactNode }) {
  const solana = useSolanaWallet();
  const session = useWalletSession();
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

  const signMessage = useCallback(
    async (message: Uint8Array) => {
      if (isMock) {
        // Mock signature: deterministic fake bytes for dev/testing.
        // In a real mock you might use a seeded keypair; this is enough for UI dev.
        return new Uint8Array(64).fill(0x42);
      }
      if (!session?.signMessage) {
        throw new Error("Connected wallet does not support signMessage");
      }
      return session.signMessage(message);
    },
    [isMock, session]
  );

  const signMessageBase58 = useCallback(
    async (message: string | Uint8Array) => {
      const bytes =
        typeof message === "string" ? new TextEncoder().encode(message) : message;
      const signature = await signMessage(bytes);
      return bs58.encode(signature);
    },
    [signMessage]
  );

  const value = useMemo(
    () => ({ status, address, isMock, connect, disconnect, signMessage, signMessageBase58 }),
    [status, address, isMock, connect, disconnect, signMessage, signMessageBase58]
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}

export type WalletProviderProps = {
  children: ReactNode;
  config?: SolanaClientConfig;
};

export function WalletProvider({
  children,
  config,
}: WalletProviderProps) {
  const resolvedConfig: SolanaClientConfig = config ?? {
    cluster: "devnet",
    rpc: "https://api.devnet.solana.com",
    websocket: "wss://api.devnet.solana.com",
  };

  return (
    <SolanaProvider config={resolvedConfig}>
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
  useWallet as useRawSolanaWallet,
  useConnectWallet,
  useDisconnectWallet,
  useWalletSession,
} from "@solana/react-hooks";
