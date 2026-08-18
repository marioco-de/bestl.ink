import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import {
  Link2,
  FileText,
  Globe,
  LayoutDashboard,
  GitBranch,
  Inbox,
  Settings,
  Sun,
  LogOut,
  Plus,
  Keyboard,
  CalendarDays,
  Contact,
  Gauge,
  Building2,
} from "lucide-react";
import { signOut } from "@/lib/auth/client";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n";

export function CommandPalette({
  open,
  onOpenChange,
  onCreate,
  onShortcuts,
  isSuper,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: () => void;
  onShortcuts: () => void;
  isSuper?: boolean;
}) {
  const navigate = useNavigate();
  const { cycle } = useTheme();
  const t = useT();
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  function go(to: string, search?: Record<string, string>) {
    onOpenChange(false);
    void navigate({ to, search: search as never });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-label={t("common.close")}
      />
      <Command
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-2xl"
        label={t("cmd.label")}
      >
        <Command.Input
          value={q}
          onValueChange={setQ}
          placeholder={t("cmd.placeholder")}
          className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-fg-subtle"
        />
        <Command.List className="max-h-80 overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-6 text-center text-sm text-fg-muted">
            {t("cmd.empty")}
          </Command.Empty>
          <Command.Group heading={t("cmd.actions")} className="px-1 py-1 text-[11px] text-fg-subtle">
            <Row
              icon={Plus}
              label={t("cmd.newLink")}
              kbd="C"
              onSelect={() => {
                onOpenChange(false);
                onCreate();
              }}
            />
            <Row
              icon={Sun}
              label={t("cmd.theme")}
              kbd="T"
              onSelect={() => {
                cycle();
                onOpenChange(false);
              }}
            />
            <Row
              icon={Keyboard}
              label={t("cmd.shortcuts")}
              kbd="?"
              onSelect={() => {
                onOpenChange(false);
                onShortcuts();
              }}
            />
          </Command.Group>
          <Command.Group heading={t("cmd.go")} className="px-1 py-1 text-[11px] text-fg-subtle">
            <Row icon={LayoutDashboard} label={t("nav.dashboard")} kbd="G H" onSelect={() => go("/control")} />
            <Row icon={Gauge} label={t("nav.overview")} kbd="G S" onSelect={() => go("/control/stats")} />
            <Row icon={Link2} label={t("nav.urls")} kbd="G L" onSelect={() => go("/control/links", { tab: "urls" })} />
            <Row icon={FileText} label={t("nav.docs")} onSelect={() => go("/control/links", { tab: "docs" })} />
            <Row icon={Globe} label={t("nav.pages")} onSelect={() => go("/control/links", { tab: "pages" })} />
            <Row icon={CalendarDays} label={t("nav.events")} onSelect={() => go("/control/links", { tab: "events" })} />
            <Row icon={Contact} label={t("nav.contacts")} onSelect={() => go("/control/links", { tab: "contacts" })} />
            <Row icon={Link2} label={t("nav.shared")} onSelect={() => go("/control/links", { tab: "shared" })} />
            <Row icon={GitBranch} label={t("nav.parameters")} onSelect={() => go("/control/parameters")} />
            <Row icon={Inbox} label={t("nav.requests")} onSelect={() => go("/control/requests")} />
            <Row icon={Building2} label={t("nav.workspace")} onSelect={() => go("/control/workspace")} />
            <Row icon={Settings} label={t("nav.domains")} onSelect={() => go("/control/domain")} />
              {isSuper && (
              <Row icon={Settings} label={t("nav.customers")} onSelect={() => go("/control/customers")} />
              )}
          </Command.Group>
          <Command.Group heading={t("cmd.account")} className="px-1 py-1 text-[11px] text-fg-subtle">
            <Row
              icon={LogOut}
              label={t("nav.signOut")}
              onSelect={() => {
                onOpenChange(false);
                void signOut("/login");
              }}
            />
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  kbd,
  onSelect,
}: {
  icon: typeof Link2;
  label: string;
  kbd?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-fg data-[selected=true]:bg-bg-subtle"
    >
      <Icon className="h-4 w-4 text-fg-muted" />
      <span className="flex-1">{label}</span>
      {kbd && (
        <kbd className="rounded-md border border-border px-1.5 font-mono text-[10px] text-fg-subtle">
          {kbd}
        </kbd>
      )}
    </Command.Item>
  );
}
