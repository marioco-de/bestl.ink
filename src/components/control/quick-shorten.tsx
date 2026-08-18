  return (
    <form
      onSubmit={(e) => void quick(e)}
      className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-1.5 shadow-sm @min-[36rem]/app:flex-row @min-[36rem]/app:items-center"
    >
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={t("short.placeholder")}
        className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => {
            openCreate(url.trim());
            setUrl("");
          }}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-sm text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden @min-[24rem]/app:inline">{t("short.options")}</span>
        </button>
        <Button type="submit" className="h-11" disabled={busy}>
          {busy ? t("common.loading") : t("short.quick")}
        </Button>
      </div>
    </form>
  );