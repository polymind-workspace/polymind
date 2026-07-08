import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { WalletModal } from "./WalletModal";
import { cn } from "@/lib/utils";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const { t } = useTranslation();
  const { status, address } = useWallet();
  const [open, setOpen] = useState(false);

  const display =
    status === "connected" && address
      ? `${address.slice(0, 4)}...${address.slice(-4)}`
      : t("common.connectWallet");

  return (
    <>
      <Button
        variant={status === "connected" ? "outline" : "default"}
        className={cn("gap-2", className)}
        onClick={() => setOpen(true)}
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden sm:inline">{display}</span>
        <span className="sm:hidden">
          {status === "connected" ? "..." : t("common.connectWallet")}
        </span>
      </Button>
      <WalletModal open={open} onOpenChange={setOpen} />
    </>
  );
}
