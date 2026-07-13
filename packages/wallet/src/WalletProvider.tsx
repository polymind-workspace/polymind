"use client";

import type { SolanaClientConfig, WalletConnector } from "@solana/client";
import {
  SolanaProvider,
  useWalletConnection,
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

export const MOCK_CONNECTOR_ID = "__mock__";
export const isMockConnectorId = (connectorId: string) =>
  connectorId === MOCK_CONNECTOR_ID;

const MOCK_ADDRESS = "MockUser111111111111111111111111111111111111";

export type WalletStatus = "connected" | "connecting" | "disconnected";

export type WalletContextValue = {
  status: WalletStatus;
  address: string | null;
  isMock: boolean;
  /** Wallet Standard connectors detected in the browser. */
  connectors: readonly WalletConnector[];
  /** True once the SDK has finished client-side hydration and wallet detection. */
  isReady: boolean;
  /** Current connector id, if connected. */
  connectorId?: string;
  connect: (connectorId: string) => Promise<string | undefined>;
  disconnect: () => void;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signMessageBase58: (message: string | Uint8Array) => Promise<string>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

function WalletContextProvider({ children }: { children: ReactNode }) {
  const {
    connectors,
    connect,
    disconnect,
    status: sdkStatus,
    isReady,
    wallet,
    currentConnector,
  } = useWalletConnection();
  const session = useWalletSession();
  const [mockAddress, setMockAddress] = useState<string | null>(null);

  const isMock = Boolean(mockAddress);

  const address = useMemo(() => {
    if (mockAddress) return mockAddress;
    return wallet?.account.address.toString() ?? null;
  }, [mockAddress, wallet]);

  const status: WalletStatus = useMemo(() => {
    if (isMock) return "connected";
    if (sdkStatus === "connected") return "connected";
    if (sdkStatus === "connecting") return "connecting";
    return "disconnected";
  }, [isMock, sdkStatus]);

  const connectWrapped = useCallback(
    async (connectorId: string) => {
      if (isMockConnectorId(connectorId)) {
        setMockAddress(MOCK_ADDRESS);
        return MOCK_ADDRESS;
      }
      const session = await connect(connectorId);
      return session.account.address.toString();
    },
    [connect]
  );

  const disconnectWrapped = useCallback(() => {
    if (mockAddress) {
      setMockAddress(null);
      return;
    }
    disconnect();
  }, [mockAddress, disconnect]);

  const signMessage = useCallback(
    async (message: Uint8Array) => {
      if (isMock) {
        // Mock signature: deterministic fake bytes for dev/testing.
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
    () => ({
      status,
      address,
      isMock,
      connectors,
      isReady,
      connectorId: currentConnector?.id,
      connect: connectWrapped,
      disconnect: disconnectWrapped,
      signMessage,
      signMessageBase58,
    }),
    [
      status,
      address,
      isMock,
      connectors,
      isReady,
      currentConnector?.id,
      connectWrapped,
      disconnectWrapped,
      signMessage,
      signMessageBase58,
    ]
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
  useWalletConnection,
} from "@solana/react-hooks";
