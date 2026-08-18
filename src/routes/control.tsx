import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { getState } from "@/lib/docbay/api";
import type { FullState } from "@/lib/docbay/types";
import { ControlProvider, useControl } from "@/lib/docbay/control-store";
import {
  LayoutDashboard,
  Gauge,
  GitBranch,
  Link2,
  Globe2,
  Inbox,
  Mail,
  MessageSquare,
  Menu,
  X,
  Webhook,
  ScrollText,
  LogOut,
  Building2,
  Users,
  Plus,
  Search,
  Keyboard,
  Sun,
  Moon,
  Monitor,
  FileText,
  CalendarDays,
  Contact,
  Share2,
  ChevronDown,
  Shield,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/control/command-palette";
import { ShortcutsHelp } from "@/components/control/shortcuts-help";
import { CreateLinkModal } from "@/components/control/create-link-modal";
import { WorkspaceSwitcher } from "@/components/control/workspace-switcher";
import { NotificationBell } from "@/components/control/notification-bell";
import { useTheme } from "@/lib/theme";
import { useI18n, useT } from "@/lib/i18n";
import { brandVars, hueStyle, TAB_HUES } from "@/lib/docbay/palette";

type ControlSearch = { tenant?: string };

export const Route = createFileRoute("/control")({
  validateSearch: (s: Record<string, unknown>): ControlSearch => {
    const out: ControlSearch = {};
    if (typeof s.tenant === "string" && s.tenant) out.tenant = s.tenant;
    return out;
  },
  loaderDeps: ({ search }) => ({ tenant: search.tenant }),
  shouldReload: false,
  staleTime: 60_000,
  loader: async ({ deps }): Promise<FullState> => {
    try {
      return (await getState({
        data: { tenant_id: deps.tenant },
      })) as FullState;
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: ControlLayout,
});

const primaryNav: {
  to: "/control" | "/control/stats" | "/control/links" | "/control/parameters" | "/control/requests" | "/control/chat";
  labelKey: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  hue: string;
}[] = [
  { to: "/control", labelKey: "nav.dashboard", icon: LayoutDashboard, exact: true, hue: "teal" },
  { to: "/control/stats", labelKey: "nav.overview", icon: Gauge, hue: "lime" },
  { to: "/control/links", labelKey: "nav.links", icon: Link2, hue: "azure" },
  { to: "/control/parameters", labelKey: "nav.parameters", icon: GitBranch, hue: "amber" },
  { to: "/control/requests", labelKey: "nav.requests", icon: Inbox, hue: "ruby" },
  { to: "/control/chat", labelKey: "nav.chat", icon: MessageSquare, hue: "violet" },
];

const settingsNav: {
  to:
    | "/control/workspace"
    | "/control/domain"
    | "/control/email"
    | "/control/integrations"
    | "/control/audit"
    | "/control/customers";
  labelKey: string;
  icon: typeof Globe2;
  superOnly?: boolean;
  hue: string;
  beta?: boolean;
}[] = [
  { to: "/control/workspace", labelKey: "nav.workspace", icon: Building2, hue: "teal" },
  { to: "/control/customers", labelKey: "nav.customers", icon: Users, superOnly: true, hue: "violet" },
  { to: "/control/domain", labelKey: "nav.domains", icon: Globe2, hue: "lime" },
  { to: "/control/email", labelKey: "nav.email", icon: Mail, hue: "amber", beta: true },
  { to: "/control/integrations", labelKey: "nav.integrations", icon: Webhook, hue: "azure", beta: true },
  { to: "/control/audit", labelKey: "nav.audit", icon: ScrollText, hue: "violet" },
];

const hueActive: Record<string, string> = {
  teal: "bg-hue-teal/12 text-hue-teal",
  azure: "bg-hue-azure/12 text-hue-azure",
  amber: "bg-hue-amber/14 text-hue-amber",
  ruby: "bg-hue-ruby/12 text-hue-ruby",
  violet: "bg-hue-violet/12 text-hue-violet",
  lime: "bg-hue-lime/14 text-hue-lime",
};

const LINK_TABS = [
  { id: "urls", labelKey: "nav.urls", icon: Link2, hue: "azure" },
  { id: "docs", labelKey: "nav.docs", icon: FileText, hue: "violet" },
  { id: "pages", labelKey: "nav.pages", icon: Globe2, hue: "lime" },
  { id: "events", labelKey: "nav.events", icon: CalendarDays, hue: "amber" },
  { id: "contacts", labelKey: "nav.contacts", icon: Contact, hue: "ruby" },
  { id: "shared", labelKey: "nav.shared", icon: Share2, hue: "teal" },
] as const;

type LinksTab = (typeof LINK_TABS)[number]["id"];

function readLinksTab(search: unknown, searchStr: string): LinksTab {
  const fromObj =
    search && typeof search === "object" && "tab" in search
      ? String((search as { tab?: unknown }).tab ?? "")
      : "";
  const q = new URLSearchParams(
    searchStr.startsWith("?") ? searchStr.slice(1) : searchStr,
  );
  const raw = fromObj || q.get("tab") || "urls";
  return LINK_TABS.some((t) => t.id === raw) ? (raw as LinksTab) : "urls";
}

function ControlLayout() {
  const data = Route.useLoaderData();
  return (
    <ControlProvider initial={data}>
      <ControlShell />
    </ControlProvider>
  );
}

function ControlShell() {
  const { data, openCreate } = useControl();
  const t = useT();
  const { locale, setLocale } = useI18n();
  const search = Route.useSearch();
  const location = useRouterState({ select: (s) => s.location });
  const pathname = location.pathname;
  const linksTab = readLinksTab(location.search, location.searchStr);
  const navigate = useNavigate();
  const [drawer, setDrawer] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [help, setHelp] = useState(false);
  const { pref, cycle } = useTheme();

  const searchBag = {
    ...(search.tenant ? { tenant: search.tenant } : {}),
  } as ControlSearch;

  const openCreateRef = useRef(openCreate);
  const cycleRef = useRef(cycle);
  const navigateRef = useRef(navigate);
  const searchBagRef = useRef(searchBag);
  openCreateRef.current = openCreate;
  cycleRef.current = cycle;
  navigateRef.current = navigate;
  searchBagRef.current = searchBag;

  useEffect(() => {
    const g = { pending: false, timer: 0 };
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setCmd(true);
        return;
      }
      if (e.key === "Escape") {
        setCmd(false);
        setHelp(false);
        setDrawer(false);
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        setCmd(true);
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "?")) {
        e.preventDefault();
        setHelp(true);
        return;
      }
      if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openCreateRef.current();
        return;
      }
      if (e.key.toLowerCase() === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        cycleRef.current();
        return;
      }
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        g.pending = true;
        window.clearTimeout(g.timer);
        g.timer = window.setTimeout(() => {
          g.pending = false;
        }, 800);
        return;
      }
      if (g.pending) {
        const k = e.key.toLowerCase();
        g.pending = false;
        const bag = searchBagRef.current;
        if (k === "h") void navigateRef.current({ to: "/control", search: bag });
        if (k === "s") void navigateRef.current({ to: "/control/stats", search: bag });
        if (k === "l")
          void navigateRef.current({
            to: "/control/links",
            search: { tab: "urls" } as never,
          });
        if (k === "d")
          void navigateRef.current({
            to: "/control/links",
            search: { tab: "docs" } as never,
          });
        if (k === "p")
          void navigateRef.current({ to: "/control/parameters", search: bag });
        if (k === "r")
          void navigateRef.current({ to: "/control/requests", search: bag });
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const ThemeIcon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;

  const linkCounts: Record<LinksTab, number> = {
    urls: data.shorts.length,
    docs: data.resources.filter((r) => r.type === "document").length,
    pages: data.resources.filter((r) => r.type === "page").length,
    events: data.resources.filter((r) => r.type === "event").length,
    contacts: data.resources.filter((r) => r.type === "contact").length,
    shared: data.links.length,
  };

  return (
    <div className="@container/app flex min-h-dvh bg-bg" style={brandVars(data.tenant.brand_color)}>
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-bg-elevated/80 @min-[52rem]/app:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="metal flex h-8 w-8 items-center justify-center rounded-md">
            <Shield className="h-3.5 w-3.5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold tracking-tight">
              BESTL.INK
            </p>
            <p className="truncate text-[11px] text-fg-subtle">{data.tenant.public_host}</p>
          </div>
        </div>
        <div className="px-3 pb-1">
          <WorkspaceSwitcher data={data} />
        </div>
        <div className="px-3 pb-3">
          <Button
            type="button"
            className="h-10 w-full justify-between text-xs"
            onClick={() => openCreate()}
          >
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {t("short.newLink")}
            </span>
            <kbd className="rounded border border-primary-fg/20 px-1 font-mono text-[10px] opacity-70">
              C
            </kbd>
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2">
          {primaryNav.map((item) => {
            if (item.to === "/control/links") {
              return (
                <LinksNav
                  key={item.to}
                  open={pathname.startsWith("/control/links")}
                  tab={linksTab}
                  searchBag={searchBag}
                  counts={linkCounts}
                />
              );
            }
            const active = item.exact
              ? pathname === item.to || pathname === `${item.to}/`
              : pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                search={searchBag}
                preload="intent"
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-[background,color] duration-150 ease-out",
                  active
                    ? hueActive[item.hue]
                    : "text-fg-muted hover:bg-bg-subtle/70 hover:text-fg",
                )}
              >
                <span className="relative">
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.to === "/control/chat" && data.stats.unread_chat > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-hue-violet" />
                  )}
                </span>
                <span className="flex-1">{t(item.labelKey)}</span>
                {item.to === "/control/requests" &&
                  data.stats.pending_requests > 0 && (
                    <span className="rounded-full bg-warning/20 px-1.5 text-[10px] text-warning tabular">
                      {data.stats.pending_requests}
                    </span>
                  )}
                {item.to === "/control/chat" && data.stats.unread_chat > 0 && (
                  <span className="rounded-full bg-hue-violet/20 px-1.5 text-[10px] text-hue-violet tabular">
                    {data.stats.unread_chat}
                  </span>
                )}
              </Link>
            );
          })}
          <p className="mt-4 px-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            {t("nav.settings")}
          </p>
          {settingsNav
            .filter((item) => !item.superOnly || data.isSuperAdmin)
            .map((item) => {
              const active =
                pathname === item.to || pathname.startsWith(`${item.to}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  search={searchBag}
                  preload="intent"
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
                    active
                      ? hueActive[item.hue]
                      : "text-fg-muted hover:bg-bg-subtle/70 hover:text-fg",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                  {item.beta && <BetaBadge />}
                </Link>
              );
            })}
        </nav>
        <div className="space-y-1 border-t border-border p-3">
          {data.isSuperAdmin && (
            <p className="flex items-center gap-1.5 px-2 text-[11px] text-fg-muted">
              <Building2 className="h-3 w-3" /> {t("common.platform")}
            </p>
          )}
          <p className="truncate px-2 font-mono text-[10px] text-fg-subtle">
            {data.tenant.public_host}
          </p>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg-subtle transition-colors hover:bg-bg-subtle hover:text-fg"
            onClick={cycle}
          >
            <ThemeIcon className="h-3.5 w-3.5" />
            {t("nav.theme", {
              value:
                pref === "system"
                  ? t("nav.themeSystem")
                  : pref === "light"
                    ? t("nav.themeLight")
                    : t("nav.themeDark"),
            })}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg-subtle transition-colors hover:bg-bg-subtle hover:text-fg"
            onClick={() => setLocale(locale === "de" ? "en" : "de")}
          >
            <Globe2 className="h-3.5 w-3.5" />
            {t("nav.language")}: {locale.toUpperCase()}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg-subtle transition-colors hover:bg-bg-subtle hover:text-fg"
            onClick={() => setHelp(true)}
          >
            <Keyboard className="h-3.5 w-3.5" /> {t("nav.shortcuts")}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg-subtle transition-colors hover:bg-bg-subtle hover:text-fg"
            onClick={() => void signOut("/login")}
          >
            <LogOut className="h-3.5 w-3.5" /> {t("nav.signOut")}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border py-2.5 pl-4 pr-2.5 @min-[52rem]/app:pl-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border @min-[52rem]/app:hidden"
              onClick={() => setDrawer(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setCmd(true)}
              className="flex h-9 min-w-0 items-center gap-2 rounded-md border border-border bg-bg-subtle/60 px-3 text-left text-sm text-fg-subtle transition-colors hover:bg-bg-subtle @min-[28rem]/app:min-w-[200px]"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden flex-1 @min-[28rem]/app:inline">{t("common.search")}</span>
              <kbd className="hidden rounded border border-border px-1 font-mono text-[10px] @min-[28rem]/app:inline">
                ⌘K
              </kbd>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <Button type="button" size="sm" className="h-10" onClick={() => openCreate()}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden @min-[24rem]/app:inline">{t("short.newLink")}</span>
            </Button>
          </div>
        </header>
        <main
          key={pathname}
          className="page-in flex-1 px-4 py-6 @min-[52rem]/app:px-8 @min-[52rem]/app:py-8"
          style={
            pathname.startsWith("/control/links")
              ? hueStyle(TAB_HUES[linksTab] || "azure")
              : undefined
          }
        >
          <Outlet />
        </main>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-40 @min-[52rem]/app:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-fg/40 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col bg-bg-elevated">
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <p className="font-display font-semibold">BESTL.INK</p>
              <button type="button" className="flex h-11 w-11 items-center justify-center" onClick={() => setDrawer(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-border px-3 py-2">
              <WorkspaceSwitcher data={data} compact />
            </div>
            <nav className="flex flex-col gap-0.5 p-3">
              {primaryNav.map((item) => {
                if (item.to === "/control/links") {
                  return (
                    <LinksNav
                      key={item.to}
                      open
                      tab={linksTab}
                      searchBag={searchBag}
                      counts={linkCounts}
                      onNavigate={() => setDrawer(false)}
                      compact={false}
                    />
                  );
                }
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    search={searchBag}
                    onClick={() => setDrawer(false)}
                    className="flex min-h-11 items-center gap-2.5 rounded-md px-3 py-3 text-sm text-fg-muted"
                  >
                    <span className="relative">
                      <Icon className="h-4 w-4" />
                      {item.to === "/control/chat" && data.stats.unread_chat > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-hue-violet" />
                      )}
                    </span>
                    {t(item.labelKey)}
                  </Link>
                );
              })}
              {settingsNav
                .filter((i) => !i.superOnly || data.isSuperAdmin)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      search={searchBag}
                      onClick={() => setDrawer(false)}
                      className="flex min-h-11 items-center gap-2.5 rounded-md px-3 py-3 text-sm text-fg-muted"
                    >
                      <Icon className="h-4 w-4" />
                      <span className="min-w-0 flex-1 truncate">{t(item.labelKey)}</span>
                      {item.beta && <BetaBadge />}
                    </Link>
                  );
                })}
            </nav>
          </div>
        </div>
      )}

      <CommandPalette
        open={cmd}
        onOpenChange={setCmd}
        onCreate={() => openCreate()}
        onShortcuts={() => setHelp(true)}
        isSuper={data.isSuperAdmin}
      />
      {help && <ShortcutsHelp onClose={() => setHelp(false)} />}
      <CreateLinkModal />
    </div>
  );
}

function LinksNav({
  open,
  tab,
  searchBag,
  counts,
  onNavigate,
  compact = true,
}: {
  open: boolean;
  tab: LinksTab;
  searchBag: ControlSearch;
  counts: Record<LinksTab, number>;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <div>
      <Link
        to="/control/links"
        search={{ ...searchBag, tab: "urls" } as never}
        preload="intent"
        onClick={onNavigate}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 text-sm transition-[background,color] duration-200 ease-out",
          compact ? "py-2" : "min-h-11 px-3 py-3",
          open
            ? hueActive.azure
            : "text-fg-muted hover:bg-bg-subtle/70 hover:text-fg",
        )}
      >
        <Link2 className="h-4 w-4 shrink-0" />
        <span className="flex-1">{t("nav.links")}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200 ease-out",
            open && "rotate-180",
          )}
        />
      </Link>
      <div className="nav-fold" data-open={open ? "true" : undefined}>
        <div className="nav-fold-inner" inert={!open}>
          <div className="mt-0.5 ml-3 space-y-0.5 border-l border-border pl-1.5">
            {LINK_TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <Link
                  key={item.id}
                  to="/control/links"
                  search={{ ...searchBag, tab: item.id } as never}
                  preload="intent"
                  onClick={onNavigate}
                  tabIndex={open ? 0 : -1}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 text-sm transition-colors duration-150",
                    compact ? "py-1.5" : "min-h-11 py-2.5",
                    active
                      ? hueActive[item.hue]
                      : "text-fg-muted hover:bg-bg-subtle/70 hover:text-fg",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex-1 truncate">{t(item.labelKey)}</span>
                  <span className="tabular text-[11px] text-fg-subtle">{counts[item.id]}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function BetaBadge() {
  const t = useT();
  return (
    <span className="shrink-0 rounded-sm bg-fg/8 px-1 py-px text-[9px] font-semibold uppercase tracking-[0.08em] text-fg-subtle ring-1 ring-fg/12">
      {t("nav.beta")}
    </span>
  );
}
