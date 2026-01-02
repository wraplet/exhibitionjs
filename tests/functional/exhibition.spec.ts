import { test, expect } from "@playwright/test";

test("basic exhibition initialization", async ({ page }) => {
  // Enable console logging to debug
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  await page.goto(
    "http://localhost:8080/tests/functional/html/initialization-basic.html",
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

test("exhibition initialization with editor manually added beforehand", async ({
  page,
}) => {
  // Enable console logging to debug
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  await page.goto(
    "http://localhost:8080/tests/functional/html/initialization-with-manually-added-editors.html",
  );

  // Wait for the page to fully load
  await page.waitForLoadState("networkidle");

  // Check if iframe element exists
  const iframeExists = await page
    .locator("[data-js-exhibition-preview]")
    .count();

  expect(iframeExists).toBe(1);

  const iframe = page.frameLocator("[data-js-exhibition-preview]");

  //await page.waitForTimeout(100000);

  // Wait for the container to appear.
  await iframe.locator("#container").waitFor();
  // Wait for the script to execute.
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

  const iframeElement = page.locator("[data-js-exhibition-preview]");
  const iframe = page.frameLocator("[data-js-exhibition-preview]");

  await expect(iframeElement).toHaveAttribute("src", /^blob:/);

  // Also verify at least one module script exists in preview
  const scripts = iframe.locator('script[type="module"]');
  await expect(scripts).toHaveCount(1);
});
