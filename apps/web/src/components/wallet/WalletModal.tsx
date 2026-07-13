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
import { runAuthHandshake, webSiwsApi, tokenStore } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { MOCK_CONNECTOR_ID } from "@polymind/wallet";

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { t } = useTranslation();
  const {
    status,
    address,
    isMock,
    connectors,
    isReady,
    connect,
    disconnect,
    signMessageBase58,
  } = useWallet();
  const [signingIn, setSigningIn] = useState(false);

  const handleConnect = async (connectorId: string) => {
    try {
      setSigningIn(true);
      const connectedAddress = await connect(connectorId);
      if (connectorId === MOCK_CONNECTOR_ID || isMock) {
        onOpenChange(false);
        return;
      }
      if (!connectedAddress) {
        throw new Error("Wallet did not return an address");
      }
      if (!signMessageBase58) {
        throw new Error("Wallet does not support message signing");
      }
      const token = await runAuthHandshake(
        connectedAddress,
        signMessageBase58,
        webSiwsApi
      );
      tokenStore.set(token);
      onOpenChange(false);
    } catch (e) {
      const msg = (e as Error).message || "Wallet connection failed";
      if (!/reject|cancel|denied/i.test(msg)) {
        // eslint-disable-next-line no-console
        console.error(msg);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleDisconnect = () => {
    tokenStore.clear();
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
            {!isReady ? (
              <div className="text-muted-foreground text-sm">{t("wallet.connecting")}</div>
            ) : connectors.length === 0 ? (
              <div className="text-muted-foreground text-sm">{t("wallet.installPrompt")}</div>
            ) : (
              connectors.map((connector) => (
                <Button
                  key={connector.id}
                  variant="outline"
                  className={cn(
                    "h-auto justify-start gap-3 px-3 py-2.5 text-left"
                  )}
                  disabled={signingIn}
                  onClick={() => void handleConnect(connector.id)}
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs">
                    {connector.name?.[0] ?? "W"}
                  </div>
                  <span className="font-medium">{connector.name}</span>
                </Button>
              ))
            )}
            {import.meta.env.DEV && (
              <Button
                variant="secondary"
                className="h-auto justify-start gap-3 px-3 py-2.5 text-left"
                disabled={signingIn}
                onClick={() => void handleConnect(MOCK_CONNECTOR_ID)}
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
