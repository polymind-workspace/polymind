import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface BetPanelProps {
  yesProbability: number
  noProbability: number
  yesPool: number
  noPool: number
  onBet: (side: "yes" | "no", amount: number) => void
  className?: string
}

export function BetPanel({
  yesProbability,
  noProbability,
  yesPool,
  noPool,
  onBet,
  className,
}: BetPanelProps) {
  const { t } = useTranslation()
  const [side, setSide] = useState<"yes" | "no">("yes")
  const [amount, setAmount] = useState("")

  const value = Number.parseFloat(amount) || 0
  const pool = side === "yes" ? yesPool : noPool
  const probability = side === "yes" ? yesProbability : noProbability
  const payout = value > 0 && pool > 0
    ? value * (1 / (probability / 100))
    : 0

  return (
    <div className={cn("rounded-xl bg-card p-4 ring-1 ring-border", className)}>
      <h3 className="mb-3 font-semibold">{t("market.bet")}</h3>
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={side === "yes" ? "default" : "outline"}
          className={side === "yes" ? "bg-yes text-white hover:bg-yes/90" : ""}
          onClick={() => setSide("yes")}
        >
          {t("market.buyYes")}
        </Button>
        <Button
          type="button"
          variant={side === "no" ? "default" : "outline"}
          className={side === "no" ? "bg-no text-white hover:bg-no/90" : ""}
          onClick={() => setSide("no")}
        >
          {t("market.buyNo")}
        </Button>
      </div>

      <label className="mb-1 block text-sm text-muted-foreground">
        {t("market.amount")} (USDC)
      </label>
      <Input
        type="number"
        min={0}
        step={0.1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        className="mb-3"
      />

      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{t("market.payout")}</span>
        <span className="font-medium">{payout.toFixed(2)} USDC</span>
      </div>

      <Button
        className="w-full"
        disabled={value <= 0}
        onClick={() => onBet(side, value)}
      >
        {side === "yes" ? t("market.buyYes") : t("market.buyNo")}
      </Button>
    </div>
  )
}
