import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { type BrowserContext, expect, test } from "@playwright/test";
import { releaseEnvironment } from "../../scripts/release-environment";
import type { AppRouter } from "../../src/server/orpc/router";

const { baseURL } = releaseEnvironment();
const password = "Synthetic-release-fixture-2026!";

function client(context: BrowserContext): RouterClient<AppRouter> {
  return createORPCClient(
    new RPCLink({
      url: `${baseURL}/api/rpc`,
      headers: async () => ({
        cookie: (await context.cookies()).map(({ name, value }) => `${name}=${value}`).join("; "),
      }),
    }),
  );
}

async function register(context: BrowserContext) {
  const email = `release-${crypto.randomUUID()}@example.invalid`;
  const response = await context.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: "Release fixture" },
    headers: { origin: baseURL },
  });
  expect(response.ok(), "Synthetic account registration must succeed").toBe(true);
  return email;
}

test("accounts created before the issuer cleanup still sign in", async ({ context }) => {
  const email = "legacy-release@example.invalid";
  const response = await context.request.post("/api/auth/sign-in/email", {
    data: { email, password },
    headers: { origin: baseURL },
  });
  expect(response.ok(), "Existing credential account must survive the migration").toBe(true);
});

test("production readiness and unauthenticated access", async ({ page, context }) => {
  const health = await page.request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Anmelden", exact: true })).toBeVisible();
  const stylesheets = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href));
  expect(stylesheets.length).toBeGreaterThan(0);
  for (const url of stylesheets) {
    const response = await page.request.get(url);
    expect(response.status(), `Missing login stylesheet: ${new URL(url).pathname}`).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/css");
    expect((await response.body()).length).toBeGreaterThan(0);
  }
  await expect(client(context).devices.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});

test("login, sensor persistence, account isolation and completion", async ({
  page,
  context,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`Server error: ${new URL(response.url()).pathname}`);
    if (
      response.status() >= 400 &&
      ["script", "stylesheet", "image", "font"].includes(response.request().resourceType())
    ) {
      errors.push(`Broken asset: ${new URL(response.url()).pathname}`);
    }
  });
  const email = await register(context);
  const logout = await context.request.post("/api/auth/sign-out", {
    data: {},
    headers: { origin: baseURL },
  });
  expect(logout.ok()).toBe(true);

  await page.goto("/login");
  await page.getByLabel("E-Mail", { exact: true }).fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Aktive Geräte" })).toBeVisible();

  await page.getByRole("button", { name: "Neues Gerät", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Neues Gerät" });
  await dialog.getByRole("combobox").nth(1).click();
  await page.getByRole("option", { name: "Bauch links", exact: true }).click();
  const lot = `release-${crypto.randomUUID()}`;
  await dialog.getByLabel("Sensor-Lotnummer").fill(lot);
  await dialog.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText(`Lot ${lot}`, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(`Lot ${lot}`, { exact: true })).toBeVisible();

  const owner = client(context);
  const devices = await owner.devices.list({});
  const device = devices.find((entry) => entry.lotNumber === lot);
  expect(device).toBeDefined();
  expect(device!.plannedDurationHours).toBe(240);
  expect(device!.plannedEndTime.getTime() - device!.startTime.getTime()).toBe(240 * 3_600_000);

  const other = await browser.newContext({ baseURL });
  try {
    await register(other);
    const outsider = client(other);
    expect(await outsider.devices.list({})).toEqual([]);
    await expect(outsider.devices.get({ id: device!.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(outsider.devices.remove({ id: device!.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await owner.devices.get({ id: device!.id })).status).toBe("active");
  } finally {
    await other.close();
  }

  await page.getByRole("button", { name: "Aktionen", exact: true }).click();
  await page.getByRole("menuitem", { name: "Wechsel abschließen" }).click();
  await expect(page.getByText("Keine aktiven Geräte.")).toBeVisible();
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "Verlauf" })).toBeVisible();
  expect((await owner.devices.get({ id: device!.id })).status).toBe("completed");
  for (const path of ["/statistics", "/settings"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(client(context).devices.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
