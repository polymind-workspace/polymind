import { HeadContent, Scripts, createRootRoute, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import { TanStackDevtools } from "@tanstack/react-devtools"
import { useEffect, useMemo, useState } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { I18nProvider } from "@/lib/i18n/I18nProvider"
import { ThemeProvider } from "@/lib/theme/ThemeProvider"
import { WalletProvider } from "@polymind/wallet"
import { AuthModal } from "@/components/auth/AuthModal"

import appCss from "../styles.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PolyMind" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
    scripts: [
      {
        children: `
          (function(){
            try {
              const theme = localStorage.getItem('polymind-theme') || 'system';
              const resolved = theme === 'system'
                ? 'dark'
                : theme;
              if (resolved !== 'dark') document.documentElement.classList.remove('dark');
              else document.documentElement.classList.add('dark');
            } catch(e){}
          })();
        `,
      },
    ],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    const handler = () => setAuthOpen(true)
    window.addEventListener("polymind-web-401", handler)
    return () => window.removeEventListener("polymind-web-401", handler)
  }, [])

  const config = useMemo(
    () => ({
      cluster: import.meta.env.VITE_SOLANA_CLUSTER ?? "devnet",
      rpc: import.meta.env.VITE_SOLANA_RPC ?? "https://api.devnet.solana.com",
      websocket:
        import.meta.env.VITE_SOLANA_WS ?? "wss://api.devnet.solana.com",
    }),
    []
  )

  return (
    <ThemeProvider>
      <I18nProvider>
        <WalletProvider config={config}>
          <TooltipProvider>
            <SidebarProvider defaultOpen={false}>
              <SidebarInset className="relative min-h-screen overflow-hidden">
                <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
                  <div className="absolute -left-[20%] -top-[10%] h-[50%] w-[50%] rounded-full bg-primary/5 blur-[120px]" />
                  <div className="absolute -right-[20%] top-[20%] h-[40%] w-[40%] rounded-full bg-primary/3 blur-[100px]" />
                </div>
                <Outlet />
              </SidebarInset>
              <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
            </SidebarProvider>
          </TooltipProvider>
        </WalletProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{ position: "bottom-right" }}
            plugins={[{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> }]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
