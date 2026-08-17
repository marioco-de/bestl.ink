#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://127.0.0.1:8080";
mkdirSync("/workspace/screenshots", { recursive: true });
const stamp = Date.now();
const email = `qa-${stamp}@bestl.ink`;

const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

async function clickFirstDialogAction(exclude = /abbrechen|schließen|bulk|kopieren/i) {
  const modalBtns = page.locator('[role="dialog"] button');
  const count = await modalBtns.count();
  for (let i = 0; i < count; i++) {
    const t = (await modalBtns.nth(i).innerText()).trim();
    if (!t || exclude.test(t)) continue;
    await modalBtns.nth(i).click();
    return t;
  }
  return "";
}

async function readDialogUrl() {
  const text = await page.locator('[role="dialog"]').innerText();
  const m = text.match(/https?:\/\/\S*\/api\/cards\/\S+/);
  if (m) return m[0].replace(/[)\s]+$/, "");
  const inputs = page.locator('[role="dialog"] input');
  const ic = await inputs.count();
  for (let i = 0; i < ic; i++) {
    const v = await inputs.nth(i).inputValue();
    if (v.includes("/api/cards/")) return v;
  }
  return "";
}

try {
  await page.goto(`${base}/signup`, { waitUntil: "networkidle", timeout: 45000 });
  await page.getByRole("heading", { name: /workspace erstellen/i }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  const su = page.locator("form input");
  await su.nth(0).fill("QA User");
  await su.nth(1).fill("QA GmbH");
  await su.nth(2).fill(`qa${stamp}`);
  await su.nth(3).fill(email);
  await su.nth(4).fill("QaTest2026!");
  await page.getByRole("button", { name: "Account anlegen" }).click();
  try {
    await page.waitForURL(/\/control/, { timeout: 25000 });
  } catch (err) {
    console.log("after signup url", page.url());
    console.log((await page.locator("body").innerText()).slice(0, 800));
    throw err;
  }

  await page.goto(`${base}/control/links?tab=events`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/workspace/screenshots/events-tab.png" });

  await page.getByRole("button", { name: /^Termin$/ }).first().click();
  await page.locator("#ev-title").fill("Kickoff Q3");
  await page.locator("#ev-location").fill("Augsburg");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "/workspace/screenshots/event-created.png" });
  if (!(await page.getByText("Kickoff Q3").count())) {
    throw new Error("Event not listed after save");
  }

  await page.getByRole("button", { name: "Link generieren" }).first().click();
  await page.waitForTimeout(400);
  const clicked = await clickFirstDialogAction();
  if (!clicked) throw new Error("No generate action");
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "/workspace/screenshots/event-link.png" });
  const fileUrl = await readDialogUrl();
  console.log("event fileUrl", fileUrl);
  if (!fileUrl) throw new Error("No event file URL");

  const res = await page.request.get(fileUrl);
  const ics = await res.text();
  writeFileSync("/workspace/screenshots/kickoff.ics", ics);
  console.log("ics status", res.status(), "ctype", res.headers()["content-type"]);
  if (res.status() !== 200 || !ics.includes("BEGIN:VCALENDAR") || !ics.includes("SUMMARY:Kickoff Q3")) {
    throw new Error(`Bad ICS: ${res.status()} ${ics.slice(0, 240)}`);
  }

  await page.goto(`${base}/control/links?tab=contacts`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Kontakt$/ }).first().click();
  await page.locator("#ct-name").fill("Mario Kempter");
  await page.locator("#ct-title").fill("Gründer");
  await page.locator("#ct-company").fill("bestl.ink");
  await page.locator("#ct-email").fill("mario@bestl.ink");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "/workspace/screenshots/contact-created.png" });
  if (!(await page.getByText("Mario Kempter").count())) {
    throw new Error("Contact not listed");
  }

  await page.getByRole("button", { name: "Link generieren" }).first().click();
  await page.waitForTimeout(400);
  await clickFirstDialogAction();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "/workspace/screenshots/contact-link.png" });
  const vcfUrl = await readDialogUrl();
  console.log("contact fileUrl", vcfUrl);
  if (!vcfUrl) throw new Error("No contact file URL");
  const res2 = await page.request.get(vcfUrl);
  const vcf = await res2.text();
  writeFileSync("/workspace/screenshots/mario.vcf", vcf);
  console.log("vcf status", res2.status(), "ctype", res2.headers()["content-type"]);
  if (res2.status() !== 200 || !vcf.includes("BEGIN:VCARD") || !vcf.includes("FN:Mario Kempter")) {
    throw new Error(`Bad VCF: ${res2.status()} ${vcf.slice(0, 240)}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/control/links?tab=events`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "/workspace/screenshots/events-mobile.png" });

  const realErrors = errors.filter(
    (e) => !/favicon|Download the React DevTools/i.test(e),
  );
  if (realErrors.length) console.log("console", realErrors.slice(0, 8));
  console.log("E2E OK");
} catch (e) {
  await page.screenshot({ path: "/workspace/screenshots/cards-e2e-fail.png" }).catch(() => {});
  console.error("E2E FAIL", e);
  process.exit(1);
} finally {
  await browser.close();
}
