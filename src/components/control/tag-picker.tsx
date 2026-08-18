import { useState } from "react";
import { Plus, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagColor, DEFAULT_TAG_COLOR } from "@/lib/docbay/tags";
import { ColorPicker } from "./color-picker";

export function TagChip({
  name,
  color,
  on,
  onClick,
  onRemove,
}: {
  name: string;
  color: string;
  on?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
        on
          ? "border-transparent text-primary-fg"
          : "border-border bg-bg text-fg-muted hover:text-fg",
      )}
      style={on ? { background: color, borderColor: color } : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "currentColor" : color }} />
      {name}
      {onRemove && (
        <span
          role="presentation"
          className="text-[10px] opacity-70"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </span>
      )}
    </button>
  );
}

export function ColorDots({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return <ColorPicker value={value} onChange={onChange} />;
}

export function TagPicker({
  catalog,
  value,
  onChange,
  onCreate,
  iconOnly,
}: {
  catalog: { id: string; name: string; color: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  onCreate?: (name: string, color: string) => Promise<void> | void;
  iconOnly?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [color, setColor] = useState<string>(DEFAULT_TAG_COLOR);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  function toggle(name: string) {
    onChange(value.includes(name) ? value.filter((x) => x !== name) : [...value, name]);
  }

  async function addDraft() {
    const name = draft.trim().toLowerCase();
    if (!name) return;
    if (!catalog.some((t) => t.name === name) && onCreate) {
      setBusy(true);
      try {
        await onCreate(name, color);
      } finally {
        setBusy(false);
      }
    }
    if (!value.includes(name)) onChange([...value, name]);
    setDraft("");
  }

  const panel = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {catalog.map((t) => (
          <TagChip
            key={t.id}
            name={t.name}
            color={t.color}
            on={value.includes(t.name)}
            onClick={() => toggle(t.name)}
          />
        ))}
        {value
          .filter((n) => !catalog.some((t) => t.name === n))
          .map((n) => (
            <TagChip
              key={n}
              name={n}
              color={tagColor(n, catalog)}
              on
              onRemove={() => onChange(value.filter((x) => x !== n))}
            />
          ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1.5 text-sm outline-none"
          placeholder="Neues Tag…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addDraft();
            }
          }}
        />
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => void addDraft()}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-[11px] text-fg-muted hover:text-fg disabled:opacity-40"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      {draft.trim() && <ColorDots value={color} onChange={setColor} />}
    </div>
  );

  if (!iconOnly) return panel;

  return (
    <div className="relative inline-flex items-center">
      {value.length > 0 && (
        <span className="mr-1 text-[10px] tabular text-fg-subtle">{value.length}</span>
      )}
      <button
        type="button"
        title="Tags"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-md border text-fg-muted hover:text-fg",
          open || value.length ? "border-fg/30 bg-bg-muted text-fg" : "border-border",
        )}
      >
        <Tag className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-20" aria-label="close" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-border bg-bg-elevated p-2 shadow-lg">
            {panel}
          </div>
        </>
      )}
    </div>
  );
}
