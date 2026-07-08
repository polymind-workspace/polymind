import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Chrome, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useWallet } from "@/lib/wallet";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONNECTORS = [
  { id: "wallet-standard:phantom", label: "Phantom" },
  { id: "wallet-standard:solflare", label: "Solflare" },
  { id: "wallet-standard:backpack", label: "Backpack" },
];

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const { t } = useTranslation();
  const { status, address, isMock, connect, disconnect } = useWallet();
  const [email, setEmail] = useState("");

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
        <DialogHeader className="text-center">
          <DialogTitle>{t("auth.title")}</DialogTitle>
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
          <div className="flex flex-col gap-3 py-2">
            <Button className="w-full gap-2" variant="outline">
              <Chrome className="h-4 w-4" />
              {t("auth.continueWithGoogle")}
            </Button>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{t("auth.or")}</span>
              <Separator className="flex-1" />
            </div>

            <div className="flex gap-2">
              <Input
                type="email"
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1"
              />
              <Button disabled={!email}>{t("auth.continue")}</Button>
            </div>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{t("auth.wallets")}</span>
              <Separator className="flex-1" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CONNECTORS.map((connector) => (
                <Button
                  key={connector.id}
                  variant="outline"
                  className="h-auto justify-start gap-2 px-2 py-2"
                  onClick={() => void handleConnect(connector.id)}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px]">
                    {connector.label[0]}
                  </div>
                  <span className="text-xs font-medium">{connector.label}</span>
                </Button>
              ))}
              {import.meta.env.DEV && (
                <Button
                  variant="secondary"
                  className="h-auto justify-start gap-2 px-2 py-2"
                  onClick={() => void handleConnect("__mock__")}
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px]">
                    M
                  </div>
                  <span className="text-xs font-medium">Mock</span>
                </Button>
              )}
              {CONNECTORS.length === 0 && !import.meta.env.DEV && (
                <div className="col-span-2 flex items-center gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground"
                >
                  <Wallet className="h-4 w-4" />
                  {t("wallet.noWallets")}
                </div>
              )}
            </div>

            <p className="text-center text-[10px] text-muted-foreground">
              {t("auth.terms")} · {t("auth.privacy")}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
