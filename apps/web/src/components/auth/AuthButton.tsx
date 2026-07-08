import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { AuthModal } from "./AuthModal";

export function AuthButton() {
  const { t } = useTranslation();
  const { status, address } = useWallet();
  const [open, setOpen] = useState(false);

  const label =
    status === "connected" && address
      ? `${address.slice(0, 4)}...${address.slice(-4)}`
      : t("auth.login");

  return (
    <>
      <Button
        variant={status === "connected" ? "outline" : "default"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <AuthModal open={open} onOpenChange={setOpen} />
    </>
  );
}
