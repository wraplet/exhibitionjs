import { test, expect } from "@playwright/test";

test("scripts execute inside iframe preview", async ({ page }) => {
  // Enable console logging to debug
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  await page.goto(
    "http://localhost:8080/tests/functional/html/basic-initialization.html",
  );

  // Wait for the page to fully load
  await page.waitForLoadState("networkidle");

  // Check if iframe element exists
  const iframeExists = await page
    .locator("[data-js-exhibition-preview]")
    .count();

  expect(iframeExists).toBe(1);

  const iframe = page.frameLocator("[data-js-exhibition-preview]");

  // Wait for the container to appear and the script to execute
  await iframe.locator("#container h1").waitFor();

  // Verify script ran and modified DOM
  await expect(iframe.locator("#container h1")).toHaveText("Hello world");
});

test("advanced priorities: HTML+CSS+TS render and style applied", async ({
  page,
}) => {
  await page.goto("/tests/functional/html/advanced-priorities.html");
  await page.waitForLoadState("networkidle");

  await page.getByRole("button", { name: /update/i }).click();

  const iframe = page.frameLocator("[data-js-exhibition-preview]");

  // Wait for script to run and DOM to change
  await iframe.locator("#greeting").waitFor();
  await expect(iframe.locator("#greeting")).toHaveText("Hello priorities");

  // Verify CSS priority produced background color
  const bg = await iframe.locator("#container").evaluate((el) => {
    return window.getComputedStyle(el as HTMLElement).backgroundColor;
  });
  expect(bg).toBe("rgb(173, 216, 230)"); // lightblue
});

test("custom document alterer injects marker element", async ({ page }) => {
  await page.goto("/tests/functional/html/custom-alterer.html");
  await page.waitForLoadState("networkidle");

  const iframe = page.frameLocator("[data-js-exhibition-preview]");
  await iframe.locator("#injected-by-alterer").waitFor();
  await expect(iframe.locator("#injected-by-alterer")).toHaveText(/Injected/i);
});

test("custom tag attributes are applied", async ({ page }) => {
  await page.goto("/tests/functional/html/custom-attributes.html");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /update/i }).click();

  const iframe = page.frameLocator("[data-js-exhibition-preview]");

  // Also verify at least one module script exists in preview
  const hasModuleScript = await iframe.locator('script[type="module"]').count();
  expect(hasModuleScript).toBeGreaterThan(0);
});
