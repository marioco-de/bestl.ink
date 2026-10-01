import { getSql } from "@/lib/db";
import { uid } from "./id";

const PALETTE = [
  "#e11d48",
  "#f97316",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#0284c7",
  "#4f46e5",
  "#9333ea",
  "#db2777",
  "#65a30d",
  "#0891b2",
  "#c026d3",
  "#dc2626",
  "#2563eb",
  "#059669",
  "#d97706",
];

export type PagePin = {
  id: string;
  selector: string;
  color: string;
  label: string;
  note: string;
  email: string;
  name: string;
};

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}
function normName(n: string): string {
  return n.trim().replace(/\s+/g, " ");
}

export async function colorForVisitor(
  resourceId: string,
  email: string,
  name: string,
): Promise<string> {
  const em = normEmail(email);
  const nm = normName(name);
  if (!em) throw new Error("E-Mail erforderlich");
  const sql = await getSql();
  const existing = (
    await sql`
      select color from db_page_pin_visitors
      where resource_id = ${resourceId} and email = ${em} and name = ${nm}
      limit 1
    `
  )[0] as { color?: string } | undefined;
  if (existing?.color) return String(existing.color);
  const used = (
    await sql`select color from db_page_pin_visitors where resource_id = ${resourceId}`
  ) as { color?: string }[];
  const taken = new Set(used.map((r) => String(r.color)));
  const color = PALETTE.find((c) => !taken.has(c)) || PALETTE[Math.floor(Math.random() * PALETTE.length)]!;
  await sql`
    insert into db_page_pin_visitors (resource_id, email, name, color)
    values (${resourceId}, ${em}, ${nm}, ${color})
    on conflict (resource_id, email, name) do nothing
  `;
  const row = (
    await sql`
      select color from db_page_pin_visitors
      where resource_id = ${resourceId} and email = ${em} and name = ${nm}
      limit 1
    `
  )[0] as { color?: string } | undefined;
  return String(row?.color || color);
}

export async function listPagePins(resourceId: string): Promise<PagePin[]> {
  const sql = await getSql();
  const rows = await sql`
    select id, selector, color, note, email, name
    from db_page_pins
    where resource_id = ${resourceId}
    order by created_at asc
    limit 400
  `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    selector: String(r.selector),
    color: String(r.color),
    note: String(r.note || ""),
    email: String(r.email || ""),
    name: String(r.name || ""),
    label: String(r.name || r.email || ""),
  }));
}

export async function placePagePin(input: {
  resourceId: string;
  tenantId: string;
  linkId?: string | null;
  email: string;
  name: string;
  selector: string;
  note?: string;
}): Promise<PagePin> {
  const em = normEmail(input.email);
  const nm = normName(input.name);
  const selector = input.selector.trim().slice(0, 800);
  if (!em) throw new Error("E-Mail erforderlich");
  if (!selector) throw new Error("Kein Element");
  const color = await colorForVisitor(input.resourceId, em, nm);
  const sql = await getSql();
  const id = uid("pin");
  await sql`
    insert into db_page_pins (
      id, tenant_id, resource_id, link_id, email, name, color, selector, note
    ) values (
      ${id}, ${input.tenantId}, ${input.resourceId}, ${input.linkId || null},
      ${em}, ${nm}, ${color}, ${selector}, ${input.note?.trim().slice(0, 280) || ""}
    )
  `;
  return {
    id,
    selector,
    color,
    note: input.note?.trim() || "",
    email: em,
    name: nm,
    label: nm || em,
  };
}
