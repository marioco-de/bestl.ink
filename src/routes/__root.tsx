import type { ReactNode } from "react";
import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "sonner";
import { CreatedWithGrokBanner } from "@/components/created-with-grok-banner";
import { ThemeProvider, THEME_BOOT_SCRIPT, useTheme } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import appCss from "@/styles.css?url";

import { AppErrorComponent } from "@/lib/error-component";

export const Route = createRootRoute({
  errorComponent: AppErrorComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "bestl.ink – Der Link sagt alles" },
      {
        name: "description",
        content:
          "bestl.ink: Kurzlinks, gated Documents und Attribution. Inhalte, die nicht offen im Netz liegen.",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Sans:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <ThemeProvider>
        <I18nProvider>
          <CreatedWithGrokBanner />
          <Outlet />
          <ThemedToaster />
        </I18nProvider>
      </ThemeProvider>
    </RootDocument>
  );
}

function ThemedToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      toastOptions={{ className: "border-border bg-bg-elevated text-fg" }}
    />
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(location.hostname==='bestl.ink'){location.replace('https://www.bestl.ink'+location.pathname+location.search+location.hash);}}catch(e){}})();",
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
