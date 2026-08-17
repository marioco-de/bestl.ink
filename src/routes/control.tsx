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
  GitBranch,
  Link2,
  Globe2,
  Inbox,
  Mail,
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
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { signOut } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/control/command-palette";
import { ShortcutsHelp } from "@/components/control/shortcuts-help";
import { CreateLinkModal } from "@/components/control/create-link-modal";
import { WorkspaceSwitcher } from "@/components/control/workspace-switcher";
import { useTheme } from "@/lib/theme";

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
  to: "/control" | "/control/links" | "/control/parameters" | "/control/requests";
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  hue: string;
}[] = [
  { to: "/control", label: "Übersicht", icon: LayoutDashboard, exact: true, hue: "teal" },
  { to: "/control/links", label: "Links", icon: Link2, hue: "azure" },
  { to: "/control/parameters", label: "Parameter", icon: GitBranch, hue: "amber" },
  { to: "/control/requests", label: "Anfragen", icon: Inbox, hue: "ruby" },
];

const settingsNav: {
  to:
    | "/control/domain"
    | "/control/email"
    | "/control/integrations"
    | "/control/audit"
    | "/control/customers";
  label: string;
  icon: typeof Globe2;
  superOnly?: boolean;
  hue: string;
}[] = [
  { to: "/control/customers", label: "Kunden", icon: Users, superOnly: true, hue: "violet" },
  { to: "/control/domain", label: "Domains", icon: Globe2, hue: "lime" },
  { to: "/control/email", label: "E-Mail", icon: Mail, hue: "amber" },
  { to: "/control/integrations", label: "Integrationen", icon: Webhook, hue: "azure" },
  { to: "/control/audit", label: "Audit", icon: ScrollText, hue: "violet" },
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
  { id: "urls", label: "URLs", icon: Link2, hue: "azure" },
  { id: "docs", label: "Dokumente", icon: FileText, hue: "violet" },
  { id: "pages", label: "Seiten", icon: Globe2, hue: "lime" },
  { id: "events", label: "Termine", icon: CalendarDays, hue: "amber" },
  { id: "contacts", label: "Kontakte", icon: Contact, hue: "ruby" },
  { id: "shared", label: "Geteilt", icon: Share2, hue: "teal" },
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
    <div className="@container/app flex min-h-dvh bg-bg">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-bg-elevated/80 @min-[52rem]/app:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="metal flex h-8 w-8 items-center justify-center rounded-md">
            <span className="font-display text-xs font-semibold">bl</span>
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold tracking-tight">
              bestl.ink
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
              <Plus className="h-3.5 w-3.5" /> Kürzen
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
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.to === "/control/requests" &&
                  data.stats.pending_requests > 0 && (
                    <span className="rounded-full bg-warning/20 px-1.5 text-[10px] text-warning tabular">
                      {data.stats.pending_requests}
                    </span>
                  )}
              </Link>
            );
          })}
          <p className="mt-4 px-2.5 pb-1 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            Einstellungen
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
                  {item.label}
                </Link>
              );
            })}
        </nav>
        <div className="space-y-1 border-t border-border p-3">
          {data.isSuperAdmin && (
            <p className="flex items-center gap-1.5 px-2 text-[11px] text-fg-muted">
              <Building2 className="h-3 w-3" /> Platform
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
            Theme: {pref === "system" ? "System" : pref === "light" ? "Hell" : "Dunkel"}
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg-subtle transition-colors hover:bg-bg-subtle hover:text-fg"
            onClick={() => setHelp(true)}
          >
            <Keyboard className="h-3.5 w-3.5" /> Kürzel
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-fg-subtle transition-colors hover:bg-bg-subtle hover:text-fg"
            onClick={() => void signOut("/login")}
          >
            <LogOut className="h-3.5 w-3.5" /> Abmelden
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 @min-[52rem]/app:px-6">
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
              <span className="hidden flex-1 @min-[28rem]/app:inline">Suchen…</span>
              <kbd className="hidden rounded border border-border px-1 font-mono text-[10px] @min-[28rem]/app:inline">
                ⌘K
              </kbd>
            </button>
          </div>
          <Button type="button" size="sm" className="h-10" onClick={() => openCreate()}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden @min-[24rem]/app:inline">Kürzen</span>
          </Button>
        </header>
        <main key={pathname} className="page-in flex-1 px-4 py-6 @min-[52rem]/app:px-8 @min-[52rem]/app:py-8">
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
              <p className="font-display font-semibold">bestl.ink</p>
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
                    <Icon className="h-4 w-4" />
                    {item.label}
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
                      {item.label}
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
        <span className="flex-1">Links</span>
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
                  <span className="flex-1 truncate">{item.label}</span>
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
