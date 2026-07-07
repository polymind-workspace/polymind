import { useTranslation } from "react-i18next"
import { TrendingUp, PlusCircle, ChevronRight, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { trendingTopics } from "@/lib/mock"
import { formatNumber } from "@/lib/date"
import { cn } from "@/lib/utils"

export function HomeSidebar({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <aside className={cn("flex flex-col gap-4", className)}>
      <Card className="overflow-hidden p-0">
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-4">
          <div className="mb-1 text-xs font-medium text-primary">NEW</div>
          <h3 className="text-base font-semibold">{t("sidebar.promoTitle")}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("sidebar.promoSub")}</p>
          <Button size="sm" className="mt-3">
            {t("sidebar.explore")}
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{t("sidebar.createCombo")}</h3>
          <PlusCircle className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          Combine multiple predictions into one combo for bigger payouts.
        </p>
        <Button variant="outline" size="sm" className="mt-3 w-full">
          Start
        </Button>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{t("sidebar.trendingTopics")}</h3>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-2">
          {trendingTopics.map((topic) => (
            <button
              key={topic.label}
              className="flex items-center justify-between rounded-lg p-2 text-left transition-colors hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold"
                >
                  {topic.rank}
                </span>
                <span className="text-sm font-medium">{topic.label}</span>
              </div>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                {formatNumber(topic.volume)}
              </span>
            </button>
          ))}
        </div>
      </Card>
    </aside>
  )
}
