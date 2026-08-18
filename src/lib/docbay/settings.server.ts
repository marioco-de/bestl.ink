import { getSql } from "@/lib/db";

export async function getSetting(key: string): Promise<string> {
  try {
    const sql = await getSql();
    const row = (
      await sql`select value from db_settings where key = ${key} limit 1`
    )[0] as { value?: string } | undefined;
    return String(row?.value ?? "");
  } catch {
    return "";
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into db_settings (key, value, updated_at)
    values (${key}, ${value}, ${new Date().toISOString()})
    on conflict (key) do update set
      value = excluded.value,
      updated_at = excluded.updated_at
  `;
}
