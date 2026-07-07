import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { apiGet } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { ProfileHeader } from "@/components/profile/ProfileHeader"
import { ProfileStats } from "@/components/profile/ProfileStats"
import { ProfileMenu } from "@/components/profile/ProfileMenu"
import { LanguageSwitcher } from "@/components/language-switcher"
import type { UserProfile } from "@/types"

export const Route = createFileRoute("/profile")({
  component: Profile,
})

interface ProfileResponse {
  ret: number
  msg: string
  data: UserProfile
}

function Profile() {
  const { t } = useTranslation()
  const [user, setUser] = useState<UserProfile | null>(null)

  useEffect(() => {
    apiGet("/profile")
      .then((r) => r.json())
      .then((payload: ProfileResponse) => {
        if (payload.ret === 200) setUser(payload.data)
      })
  }, [])

  if (!user) {
    return (
      <PageLayout>
        <div className="py-12 text-center">{t("common.loading")}</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout>
      <ProfileHeader user={user} className="mb-6" />
      <ProfileStats stats={user.stats} className="mb-6" />
      <ProfileMenu onLanguage={() => { /* language switcher handled globally */ }} />

      <div className="mt-6 rounded-xl bg-card p-4 ring-1 ring-border">
        <h3 className="mb-3 font-semibold">{t("common.language")}</h3>
        <LanguageSwitcher />
      </div>
    </PageLayout>
  )
}
