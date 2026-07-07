import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"

export const Route = createFileRoute("/create")({
  component: CreateMarket,
})

function CreateMarket() {
  const { t } = useTranslation()
  return (
    <PageLayout>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold">{t("nav.create")}</h1>
        <p className="mb-6 text-muted-foreground">
          Create a new prediction market. This is a UI placeholder for Phase 1.
        </p>

        <form className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-border"
          onSubmit={(e) => {
            e.preventDefault()
            // placeholder
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="title">Market question</Label>
            <Input id="title" placeholder="Will...?" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={4} placeholder="Resolution criteria..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <Input id="category" placeholder="crypto, politics, sports..." />
          </div>
          <Button type="submit" className="mt-2">{t("common.confirm")}</Button>
        </form>
      </div>
    </PageLayout>
  )
}
