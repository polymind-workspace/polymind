import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useWallets } from "@wallet-standard/react"
import {
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
} from "@wallet-standard/features"
import type { StandardEventsChangeProperties } from "@wallet-standard/features"
import { getWalletFeature } from "@wallet-standard/ui-features"
import type { UiWallet, UiWalletAccount } from "@wallet-standard/ui"

const STORAGE_KEY = "polymind-wallet"

export type WalletAccount = {
  address: string
  publicKey?: Uint8Array
  label?: string
}

type WalletContextValue = {
  wallets: readonly UiWallet[]
  account: WalletAccount | null
  publicKey: string | null
  connected: boolean
  isConnecting: boolean
  connect: (name: string) => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error("useWallet must be used within WalletProvider")
  return ctx
}

function hasFeature(wallet: UiWallet, feature: string): boolean {
  return wallet.features.includes(feature as never)
}

function toWalletAccount(
  uiAccount: Pick<UiWalletAccount, "address" | "publicKey" | "label">
): WalletAccount {
  return {
    address: uiAccount.address,
    publicKey: uiAccount.publicKey as Uint8Array | undefined,
    label: uiAccount.label,
  }
}

type ConnectFeature = {
  connect: (input?: { silent?: boolean }) => Promise<{
    accounts: readonly Pick<UiWalletAccount, "address" | "publicKey" | "label">[]
  }>
}

type DisconnectFeature = {
  disconnect: () => Promise<void>
}

type EventsFeature = {
  on: (
    event: "change",
    listener: (properties: StandardEventsChangeProperties) => void
  ) => () => void
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useWallets()
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const activeWalletRef = useRef<UiWallet | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const cleanup = useCallback(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    activeWalletRef.current = null
  }, [])

  const disconnect = useCallback(() => {
    const wallet = activeWalletRef.current
    if (wallet && hasFeature(wallet, StandardDisconnect)) {
      try {
        const feature = getWalletFeature(
          wallet,
          StandardDisconnect
        ) as DisconnectFeature
        void feature.disconnect()
      } catch {
        // ignore
      }
    }
    cleanup()
    setAccount(null)
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [cleanup])

  const setActiveAccount = useCallback(
    (
      wallet: UiWallet,
      uiAccount: Pick<UiWalletAccount, "address" | "publicKey" | "label"> | undefined
    ) => {
      activeWalletRef.current = wallet
      setAccount(uiAccount ? toWalletAccount(uiAccount) : null)
      if (uiAccount && typeof localStorage !== "undefined") {
        localStorage.setItem(STORAGE_KEY, wallet.name)
      }
    },
    []
  )

  const subscribeToWallet = useCallback(
    (wallet: UiWallet) => {
      if (!hasFeature(wallet, StandardEvents)) return
      try {
        const feature = getWalletFeature(wallet, StandardEvents) as EventsFeature
        unsubscribeRef.current = feature.on("change", (properties) => {
          if (properties.accounts) {
            const next = properties.accounts[0]
            if (next) {
              setActiveAccount(wallet, next as UiWalletAccount)
            } else {
              disconnect()
            }
          }
        })
      } catch {
        // ignore
      }
    },
    [disconnect, setActiveAccount]
  )

  const connect = useCallback(
    async (name: string) => {
      if (name === "__mock__") {
        cleanup()
        setAccount({ address: "MockUser111111111111111111111111111111111111" })
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(STORAGE_KEY, "__mock__")
        }
        return
      }

      const wallet = wallets.find((w) => w.name === name)
      if (!wallet || !hasFeature(wallet, StandardConnect)) return

      setIsConnecting(true)
      try {
        const feature = getWalletFeature(wallet, StandardConnect) as ConnectFeature
        const output = await feature.connect()
        cleanup()
        subscribeToWallet(wallet)
        const firstAccount = output.accounts[0]
        setActiveAccount(wallet, firstAccount)
      } finally {
        setIsConnecting(false)
      }
    },
    [wallets, cleanup, subscribeToWallet, setActiveAccount]
  )

  // Auto-reconnect on mount.
  useEffect(() => {
    if (typeof localStorage === "undefined") return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    if (saved === "__mock__") {
      setAccount({ address: "MockUser111111111111111111111111111111111111" })
      return
    }
    const wallet = wallets.find((w) => w.name === saved)
    if (!wallet) return
    connect(wallet.name).catch(() => {
      localStorage.removeItem(STORAGE_KEY)
    })
  }, [wallets, connect])

  const publicKey = useMemo(() => account?.address ?? null, [account])

  const value = useMemo(
    () => ({
      wallets,
      account,
      publicKey,
      connected: !!account,
      isConnecting,
      connect,
      disconnect,
    }),
    [wallets, account, publicKey, isConnecting, connect, disconnect]
  )

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  )
}
