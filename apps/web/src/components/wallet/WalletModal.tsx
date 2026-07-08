import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { cn } from "@/lib/utils";

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONNECTORS = [
  { id: "wallet-standard:phantom", label: "Phantom" },
  { id: "wallet-standard:solflare", label: "Solflare" },
  { id: "wallet-standard:backpack", label: "Backpack" },
];

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { t } = useTranslation();
  const { status, address, isMock, connect, disconnect } = useWallet();

  const handleConnect = async (connectorId: string) => {
    await connect(connectorId);
    onOpenChange(false);
  };

  const handleDisconnect = () => {
    disconnect();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("wallet.title")}</DialogTitle>
          <DialogDescription>
            {status === "connected"
              ? t("wallet.connected")
              : t("wallet.installPrompt")}
          </DialogDescription>
        </DialogHeader>

        {status === "connected" ? (
          <div className="flex flex-col gap-3 py-2">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <div className="text-muted-foreground">Address</div>
              <div className="mt-1 break-all font-medium">
                {address}
                {isMock && (
                  <span className="ml-2 text-xs text-amber-500">(Mock)</span>
                )}
              </div>
            </div>
            <Button variant="outline" onClick={handleDisconnect}>
              {t("common.disconnect")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 py-2">
            {CONNECTORS.map((connector) => (
              <Button
                key={connector.id}
                variant="outline"
                className={cn(
                  "h-auto justify-start gap-3 px-3 py-2.5 text-left"
                )}
                onClick={() => void handleConnect(connector.id)}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs">
                  {connector.label[0]}
                </div>
                <span className="font-medium">{connector.label}</span>
              </Button>
            ))}
            {import.meta.env.DEV && (
              <Button
                variant="secondary"
                className="h-auto justify-start gap-3 px-3 py-2.5 text-left"
                onClick={() => void handleConnect("__mock__")}
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
  );
}
