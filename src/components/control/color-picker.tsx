import { PALETTE, normalizeHex } from "@/lib/docbay/palette";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const hex = normalizeHex(value);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => onChange(c)}
            className={cn(
              "h-6 w-6 rounded-full border-2",
              hex === c ? "border-fg" : "border-transparent",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-[11px] text-fg-muted">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
        />
        Eigene Farbe
      </label>
    </div>
  );
}
