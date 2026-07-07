import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet"
import { cn } from "@/lib/utils"

interface WalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { t } = useTranslation()
  const { wallets, connected, account, publicKey, connect, disconnect } = useWallet()
  const showMock = import.meta.env.DEV && wallets.length === 0 && !connected

  const handleConnect = async (name: string) => {
    await connect(name)
    onOpenChange(false)
  }

  const handleDisconnect = () => {
    disconnect()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("wallet.title")}</DialogTitle>
          <DialogDescription>
            {connected
              ? t("wallet.connected")
              : wallets.length === 0
                ? t("wallet.noWallets")
                : t("wallet.installPrompt")}
          </DialogDescription>
        </DialogHeader>

        {connected ? (
          <div className="flex flex-col gap-3 py-2">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="text-muted-foreground">Address</div>
              <div className="mt-1 break-all font-medium">{account?.address ?? publicKey}</div>
            </div>
            <Button variant="outline" onClick={handleDisconnect}>
              {t("common.disconnect")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-2">
            {wallets.map((wallet) => (
              <Button
                key={wallet.name}
                variant="outline"
                className={cn(
                  "h-auto justify-start gap-3 px-3 py-2.5 text-left"
                )}
                onClick={() => handleConnect(wallet.name)}
              >
                <img
                  src={wallet.icon}
                  alt={wallet.name}
                  className="h-6 w-6 rounded-md"
                />
                <span className="font-medium">{wallet.name}</span>
              </Button>
            ))}
            {showMock && (
              <Button
                variant="secondary"
                className="h-auto justify-start gap-3 px-3 py-2.5 text-left"
                onClick={() => handleConnect("__mock__")}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs">
                  M
                </div>
                <span className="font-medium">Mock Wallet</span>
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
