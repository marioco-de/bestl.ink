import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Plus, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagColor, DEFAULT_TAG_COLOR } from "@/lib/docbay/tags";
import { ColorPicker } from "./color-picker";
import { useT } from "@/lib/i18n";

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
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border py-0.5 pl-2 pr-0.5 text-[11px] transition-colors",
        on
          ? "border-transparent text-primary-fg"
          : "border-border bg-bg text-fg-muted hover:text-fg",
        onClick && "cursor-pointer",
      )}
      style={on ? { background: color, borderColor: color } : undefined}
    >
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? "currentColor" : color }} />
        {name}
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label="Entfernen"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/15"
        >
          <X className="h-3 w-3" strokeWidth={2.6} />
        </button>
      )}
    </span>
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
  alwaysOpen,
}: {
  catalog: { id: string; name: string; color: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  onCreate?: (name: string, color: string) => void;
  alwaysOpen?: boolean;
}) {
  const t = useT();
  const [draft, setDraft] = useState("");
  const [color] = useState<string>(DEFAULT_TAG_COLOR);
  const [open, setOpen] = useState(Boolean(alwaysOpen));
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = draft.trim().toLowerCase();
  const suggestions = useMemo(() => {
    return catalog
      .filter((t) => !value.includes(t.name) && (!q || t.name.includes(q)))
      .slice(0, 8);
  }, [catalog, value, q]);
  const canCreate = Boolean(q) && !value.includes(q) && !catalog.some((t) => t.name === q);
  const items = useMemo(() => {
    const list: { kind: "pick" | "create"; name: string }[] = suggestions.map((s) => ({
      kind: "pick",
      name: s.name,
    }));
    if (canCreate) list.push({ kind: "create", name: q });
    return list;
  }, [suggestions, canCreate, q]);

  useEffect(() => {
    setHi(0);
  }, [q]);

  function commit(name: string) {
    const n = name.trim().toLowerCase();
    if (!n) return;
    if (!value.includes(n)) onChange([...value, n]);
    if (!catalog.some((t) => t.name === n)) onCreate?.(n, color);
    setDraft("");
    setHi(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (items.length) setHi((i) => (i + 1) % items.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length) setHi((i) => (i - 1 + items.length) % items.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = items[hi];
      if (hit) commit(hit.name);
      else if (q) commit(q);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setDraft("");
    }
  }

  const field = (
    <div className="relative w-full">
      <input
        ref={inputRef}
        autoFocus={alwaysOpen}
        className="h-9 w-full rounded-md border border-border bg-bg px-2.5 text-sm outline-none"
        placeholder={t("short.tagPh")}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
      />
      {(q || alwaysOpen) && items.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-md border border-border bg-bg-elevated py-1 shadow-lg">
          {items.map((item, i) => (
            <li key={`${item.kind}-${item.name}`}>
              <button
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => commit(item.name)}
                className={cn(
                  "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm",
                  i === hi ? "bg-bg-subtle" : "hover:bg-bg-subtle",
                )}
              >
                {item.kind === "create" ? (
                  <>
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    {t("short.tagCreate", { name: item.name })}
                  </>
                ) : (
                  <>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: tagColor(item.name, catalog) }}
                    />
                    {item.name}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", alwaysOpen && "w-full")}>
      {value.map((n) => (
        <TagChip
          key={n}
          name={n}
          color={tagColor(n, catalog)}
          on
          onRemove={() => onChange(value.filter((x) => x !== n))}
        />
      ))}
      {alwaysOpen ? (
        <div className="w-full">{field}</div>
      ) : (
        <div className="relative inline-flex">
          <button
            type="button"
            title="Tags"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-md border text-fg-muted hover:text-fg",
              open ? "border-fg/30 bg-bg-muted text-fg" : "border-border",
            )}
          >
            <Tag className="h-3.5 w-3.5" />
          </button>
          {open && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-20"
                aria-label="close"
                onClick={() => setOpen(false)}
              />
              <div className="absolute left-0 top-full z-30 mt-1 w-64 space-y-2 rounded-md border border-border bg-bg-elevated p-2 shadow-lg">
                {field}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
