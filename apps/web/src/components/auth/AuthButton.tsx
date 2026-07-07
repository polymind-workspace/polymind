import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/lib/wallet"
import { AuthModal } from "./AuthModal"

export function AuthButton() {
  const { t } = useTranslation()
  const { connected, publicKey } = useWallet()
  const [open, setOpen] = useState(false)

  const label = connected
    ? `${publicKey?.slice(0, 4)}...${publicKey?.slice(-4)}`
    : t("auth.login")

  return (
    <>
      <Button
        variant={connected ? "outline" : "default"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <AuthModal open={open} onOpenChange={setOpen} />
    </>
  )
}
