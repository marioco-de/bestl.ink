import type { LucideIcon } from "lucide-react";
import { Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

export const TOGGLE_OFF = "#a1a1aa";
export const TOGGLE_ON = "#16a34a";
export const TOGGLE_ORANGE = "#ea580c";

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  onColor,
  offColor,
  onIcon: OnIcon,
  offIcon: OffIcon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  onColor?: string;
  offColor?: string;
  onIcon?: LucideIcon;
  offIcon?: LucideIcon;
}) {
  const track = checked
    ? onColor?.trim() || TOGGLE_ON
    : offColor?.trim() || TOGGLE_OFF;
  const Icon = checked ? OnIcon : OffIcon;

  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint && <span className="block text-[11px] text-fg-subtle">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative inline-flex h-7 w-12 shrink-0 items-center overflow-hidden rounded-full p-0.5 transition-colors duration-300"
        style={{ backgroundColor: track }}
      >
        <span
          className={cn(
            "inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1.2,0.36,1)]",
            checked ? "translate-x-5" : "translate-x-0",
          )}
        >
          {Icon ? <Icon className="h-3 w-3" strokeWidth={2.4} style={{ color: track }} /> : null}
        </span>
      </button>
    </label>
  );
}

export function RequestAccessToggle({
  checked,
  onChange,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  const t = useT();
  return (
    <Toggle
      label={checked ? t("short.requestOn") : t("short.requestOff")}
      hint={hint}
      checked={checked}
      onChange={onChange}
      onColor={TOGGLE_ORANGE}
      offColor={TOGGLE_OFF}
      onIcon={Lock}
      offIcon={LockOpen}
    />
  );
}
