import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Users, Coins, Clock } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/lib/wallet";
import { fetchReferrals, type ReferralSummary } from "@/lib/api/referrals";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invite")({
  component: Invite,
});

function Invite() {
  const { t } = useTranslation();
  const { address } = useWallet();
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<ReferralSummary | null>(null);

  const referralCode = summary?.code ?? (address ? `PM-${address.slice(0, 8).toUpperCase()}` : "");
  const [referralLink, setReferralLink] = useState("");

  useEffect(() => {
    fetchReferrals().then(setSummary);
  }, []);

  useEffect(() => {
    if (referralCode) {
      setReferralLink(`${window.location.origin}?ref=${referralCode}`);
    }
  }, [referralCode]);

  const handleCopy = async () => {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <PageLayout>
      <div className="mx-auto max-w-xl space-y-6 py-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t("invite.title")}</h1>
          <p className="text-muted-foreground">{t("invite.subtitle")}</p>
        </div>

        {address ? (
          <>
            <div className="rounded-xl bg-card p-5 ring-1 ring-border">
              <div className="mb-3 text-sm font-medium text-muted-foreground">
                {t("invite.yourCode")}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 rounded-lg bg-muted px-4 py-3 font-mono text-lg">
                  {referralCode}
                </div>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => void handleCopy()}
                >
                  <Copy className="h-4 w-4" />
                  {copied ? t("invite.copied") : t("invite.copyLink")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={Users}
                label={t("invite.totalInvited")}
                value={String(summary?.invitee_count ?? 0)}
              />
              <StatCard
                icon={Coins}
                label={t("invite.totalRewards")}
                value={`$${(summary?.paid_rewards ?? 0).toFixed(2)}`}
              />
              <StatCard
                icon={Clock}
                label={t("invite.pendingRewards")}
                value={`$${(summary?.pending_rewards ?? 0).toFixed(2)}`}
              />
            </div>

            <div className="rounded-xl bg-card p-6 text-center ring-1 ring-border">
              <h3 className="font-semibold">{t("invite.emptyTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("invite.emptySub")}
              </p>
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-card p-8 text-center ring-1 ring-border">
            <p className="text-muted-foreground">
              Connect your wallet to view your referral link.
            </p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  className?: string;
}

function StatCard({ icon: Icon, label, value, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl bg-card p-4 ring-1 ring-border",
        className
      )}
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
