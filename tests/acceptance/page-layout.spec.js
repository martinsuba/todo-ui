// REQ-006: mobile-first layout, light and dark theme.
import { expect, test } from "@playwright/test";
import { openPage, seedTodos } from "../../test/page-helpers.js";

const seed = () =>
  seedTodos([
    [
      "aaa1",
      {
        title:
          "A fairly long todo title that has to wrap on a narrow phone screen without overflow",
        due: "2026-10-13",
        meta: "remind 13:00 · details: some-very-long-file-name-for-details.md",
      },
    ],
    ["bbb2", { title: "Short", due: "2026-10-14" }],
    [
      "ccc3",
      { title: "Averyveryveryveryveryveryveryverylongsingleworddoesnotbreakanywhereinthetitle" },
    ],
    ["ddd4", { title: "Done one", status: "done", doneAt: "2026-10-13" }],
  ]);

const backgroundLuminance = (page) =>
  page.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    const [r, g, b] = (bg.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });

test.describe("REQ-006 layout and theme", () => {
  test("REQ-006: at 375x812 there is no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openPage(page, { seed: seed() });
    await expect(page.getByTestId("open-list").getByTestId("todo-item")).toHaveCount(3);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("REQ-006: tick targets are at least 44x44 px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openPage(page, { seed: seed() });
    const ticks = page.getByTestId("tick");
    await expect(ticks).toHaveCount(3);
    for (const tick of await ticks.all()) {
      const box = (await tick.boundingBox()) ?? { width: 0, height: 0 };
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("REQ-006: system dark uses the dark theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await openPage(page, { seed: seed() });
    await expect(page.getByTestId("todo-item").first()).toBeVisible();
    expect(await backgroundLuminance(page)).toBeLessThan(0.3);
  });

  test("REQ-006: system light uses the light theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openPage(page, { seed: seed() });
    await expect(page.getByTestId("todo-item").first()).toBeVisible();
    expect(await backgroundLuminance(page)).toBeGreaterThan(0.7);
  });

  test("REQ-006: the body background changes between light and dark", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openPage(page, { seed: seed() });
    await expect(page.getByTestId("todo-item").first()).toBeVisible();
    const light = await backgroundLuminance(page);
    await page.emulateMedia({ colorScheme: "dark" });
    expect(await backgroundLuminance(page)).not.toBe(light);
  });
});
