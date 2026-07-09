import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchLeaderboard, type LeaderboardEntry } from "@/lib/api/leaderboard"
import { PageLayout } from "@/components/layout/PageLayout"
import { LeaderboardTabs, type LeaderboardType } from "@/components/leaderboard/LeaderboardTabs"
import { TopThreePodium } from "@/components/leaderboard/TopThreePodium"
import { LeaderboardRow } from "@/components/leaderboard/LeaderboardRow"
import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/leaderboard")({
  component: Leaderboard,
})

function Leaderboard() {
  const { t } = useTranslation()
  const [type, setType] = useState<LeaderboardType>("invite")
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchLeaderboard(type)
      .then((data) => setEntries(data))
      .finally(() => setLoading(false))
  }, [type])

  return (
    <PageLayout>
      <h1 className="mb-4 text-2xl font-bold">{t("leaderboard.title")}</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <LeaderboardTabs active={type} onSelect={setType} />
        <div className="flex gap-2">
          <Button variant="outline" size="sm">{t("leaderboard.thisWeek")}</Button>
          <Button variant="ghost" size="sm">{t("leaderboard.lastWeek")}</Button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center">{t("common.loading")}</div>
      ) : (
        <>
          <TopThreePodium entries={entries.slice(0, 3)} />
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[2rem_1fr_auto] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>{t("leaderboard.rank")}</span>
              <span>{t("leaderboard.user")}</span>
              <span className="text-right">{t("leaderboard.score")}</span>
            </div>
            {entries.map((entry) => (
              <LeaderboardRow key={`${entry.rank}-${entry.address}`} entry={entry} />
            ))}
          </div>
        </>
      )}
    </PageLayout>
  )
}
