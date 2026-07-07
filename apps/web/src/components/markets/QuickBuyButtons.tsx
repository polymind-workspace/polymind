import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface QuickBuyButtonsProps {
  onBuyYes?: () => void
  onBuyNo?: () => void
  className?: string
}

export function QuickBuyButtons({ onBuyYes, onBuyNo, className }: QuickBuyButtonsProps) {
  const { t } = useTranslation()
  return (
    <div className={cn("flex gap-2", className)}>
      <Button
        size="sm"
        className="flex-1 bg-yes text-white hover:bg-yes/90"
        onClick={onBuyYes}
      >
        {t("market.buyYes")}
      </Button>
      <Button
        size="sm"
        className="flex-1 bg-no text-white hover:bg-no/90"
        onClick={onBuyNo}
      >
        {t("market.buyNo")}
      </Button>
    </div>
  )
}
