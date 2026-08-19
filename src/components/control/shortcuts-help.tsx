const ROWS: { keys: string; label: string }[] = [
  { keys: "C", label: "Neuen Link kürzen" },
  { keys: "⌘ K", label: "Befehlspalette" },
  { keys: "/", label: "Suche / Palette" },
  { keys: "T", label: "Theme wechseln" },
  { keys: "?", label: "Diese Hilfe" },
  { keys: "Esc", label: "Schließen" },
  { keys: "G H", label: "Übersicht" },
  { keys: "G L", label: "Links · URLs" },
  { keys: "G D", label: "Links · Dokumente" },
  { keys: "G P", label: "Parameter" },
  { keys: "G R", label: "Anfragen" },
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-fg/30 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Schließen"
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-bg-elevated p-4 shadow-2xl">
        <h2 className="font-display text-lg font-semibold">Tastenkürzel</h2>
        <p className="mt-1 text-sm text-fg-muted">Tastenkürzel, ohne die Seite neu zu laden.</p>
        <ul className="mt-4 space-y-1.5">
          {ROWS.map((r) => (
            <li key={r.keys} className="flex items-center justify-between text-sm">
              <span className="text-fg-muted">{r.label}</span>
              <kbd className="rounded-md border border-border bg-bg-subtle px-1.5 py-0.5 font-mono text-[11px]">
                {r.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
