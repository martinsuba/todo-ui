// REQ-001, REQ-002, REQ-003, REQ-005: the page's lists, marks, done section, live state and footer.
// Runs against dist/todo.html (npm run build) with test/fake-claude.js injected and a fixed clock:
// "now" is 2026-10-14 12:00 Europe/Bratislava. DOM contract: docs/TESTS.md.
import { expect, test } from "@playwright/test";
import { NOW, openPage, pending, seedTodos } from "../../test/page-helpers.js";

const openItems = (page) => page.getByTestId("open-list").getByTestId("todo-item");
const titles = (page) => openItems(page).getByTestId("title").allTextContents();
const doneSection = (page) => page.getByTestId("done-section");

test.describe("REQ-001 open list", () => {
  test("REQ-001: open items sorted by due date, undated last", async ({ page }) => {
    await openPage(page, {
      seed: seedTodos([
        ["aaa1", { title: "A", due: "2026-10-20" }],
        ["bbb2", { title: "B" }],
        ["ccc3", { title: "C", due: "2026-10-15" }],
      ]),
    });
    await expect(openItems(page)).toHaveCount(3);
    expect(await titles(page)).toEqual(["C", "A", "B"]);
  });

  test("REQ-001: ties keep file order", async ({ page }) => {
    await openPage(page, {
      seed: seedTodos([
        ["aaa1", { title: "first undated" }],
        ["bbb2", { title: "second same day", due: "2026-10-18" }],
        ["ccc3", { title: "third undated" }],
        ["ddd4", { title: "first same day", due: "2026-10-18" }],
      ]),
    });
    await expect(openItems(page)).toHaveCount(4);
    // order field = file order: bbb2 (1) comes before ddd4 (3)
    expect(await titles(page)).toEqual([
      "second same day",
      "first same day",
      "first undated",
      "third undated",
    ]);
  });

  test("REQ-001: titles are listed", async ({ page }) => {
    await openPage(page, { seed: seedTodos([["aaa1", { title: "Plan weekend trip" }]]) });
    await expect(openItems(page)).toHaveCount(1);
    await expect(openItems(page).first().getByTestId("title")).toHaveText("Plan weekend trip");
  });

  test("REQ-001: due date is shown for dated items", async ({ page }) => {
    await openPage(page, {
      seed: seedTodos([
        ["aaa1", { title: "Dated", due: "2026-10-20" }],
        ["bbb2", { title: "Undated" }],
      ]),
    });
    const items = openItems(page);
    await expect(items.filter({ hasText: "Dated" }).first().getByTestId("due")).toContainText(
      "2026-10-20",
    );
    await expect(items.filter({ hasText: "Undated" }).getByTestId("due")).toHaveCount(0);
  });

  test("REQ-001: HTML in a title is shown literally, not injected", async ({ page }) => {
    await openPage(page, {
      seed: seedTodos([["aaa1", { title: "<b>x</b>", meta: "<img src=x onerror=alert(1)>" }]]),
    });
    await expect(openItems(page)).toHaveCount(1);
    await expect(openItems(page).first().getByTestId("title")).toHaveText("<b>x</b>");
    await expect(page.locator("main b, main img")).toHaveCount(0);
  });

  test("REQ-001: meta text appears under the title and is not a link", async ({ page }) => {
    await openPage(page, {
      seed: seedTodos([["aaa1", { title: "Laptop", meta: "remind 13:00 · details: laptop.md" }]]),
    });
    const item = openItems(page).first();
    await expect(item.getByTestId("meta")).toHaveText("remind 13:00 · details: laptop.md");
    await expect(item.locator("a")).toHaveCount(0);
    const title = await item.getByTestId("title").boundingBox();
    const meta = await item.getByTestId("meta").boundingBox();
    expect(meta.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
  });
});

test.describe("REQ-002 overdue and due-today marks", () => {
  const mark = (page, title) => openItems(page).filter({ hasText: title }).first();

  test("REQ-002: overdue item is marked overdue with an accessible label", async ({ page }) => {
    await openPage(page, { seed: seedTodos([["aaa1", { title: "Late", due: "2026-10-13" }]]) });
    const item = mark(page, "Late");
    await expect(item).toHaveAttribute("data-due-state", "overdue");
    await expect(item.getByTestId("badge")).toHaveAttribute("aria-label", /overdue/i);
  });

  test("REQ-002: item due today is marked due today, not overdue", async ({ page }) => {
    await openPage(page, { seed: seedTodos([["aaa1", { title: "Today", due: "2026-10-14" }]]) });
    const item = mark(page, "Today");
    await expect(item).toHaveAttribute("data-due-state", "today");
    await expect(item.getByTestId("badge")).toHaveAttribute("aria-label", /due today/i);
    await expect(item.getByTestId("badge")).not.toHaveAttribute("aria-label", /overdue/i);
  });

  test("REQ-002: today is the viewer's local date (00:30 local is still the previous day in UTC)", async ({
    page,
  }) => {
    await openPage(page, {
      now: new Date("2026-10-14T00:30:00+02:00"),
      seed: seedTodos([
        ["aaa1", { title: "Local today", due: "2026-10-14" }],
        ["bbb2", { title: "Local yesterday", due: "2026-10-13" }],
      ]),
    });
    await expect(mark(page, "Local today")).toHaveAttribute("data-due-state", "today");
    await expect(mark(page, "Local yesterday")).toHaveAttribute("data-due-state", "overdue");
  });

  test("REQ-002: future or undated items have neither mark", async ({ page }) => {
    await openPage(page, {
      seed: seedTodos([
        ["aaa1", { title: "Soon", due: "2026-10-15" }],
        ["bbb2", { title: "Whenever" }],
      ]),
    });
    for (const title of ["Soon", "Whenever"]) {
      const item = mark(page, title);
      await expect(item).toHaveAttribute("data-due-state", "none");
      await expect(item.getByTestId("badge")).toHaveCount(0);
    }
  });
});

test.describe("REQ-003 done section", () => {
  test("REQ-003: collapsed Done (2) header; expanding lists both, newest first", async ({
    page,
  }) => {
    await openPage(page, {
      seed: seedTodos([
        ["aaa1", { title: "Older", status: "done", doneAt: "2026-10-12" }],
        ["bbb2", { title: "Newer", status: "done", doneAt: "2026-10-13" }],
      ]),
    });
    const section = doneSection(page);
    await expect(section.locator("summary")).toHaveText(/Done \(2\)/);
    await expect(section.getByTestId("done-item")).toHaveCount(2);
    await expect(section.getByTestId("done-item").first()).toBeHidden();
    await expect(section.getByTestId("done-item").last()).toBeHidden();

    await section.locator("summary").click();
    await expect(section.getByTestId("done-item").first()).toBeVisible();
    expect(await section.getByTestId("title").allTextContents()).toEqual(["Newer", "Older"]);
  });

  test("REQ-003: items done more than 7 days ago are not shown anywhere", async ({ page }) => {
    await openPage(page, {
      seed: seedTodos([
        ["aaa1", { title: "Ancient news", status: "done", doneAt: "2026-10-06" }],
        ["bbb2", { title: "Fresh news", status: "done", doneAt: "2026-10-13" }],
      ]),
    });
    // the recent item proves the done section rendered; the old one must be absent
    await expect(doneSection(page).locator("summary")).toHaveText(/Done \(1\)/);
    await expect(page.getByText("Ancient news")).toHaveCount(0);
  });
});

test.describe("REQ-005 live state, freshness, empty and error states", () => {
  test("REQ-005: the list updates without reload when the db changes", async ({ page }) => {
    await openPage(page, { seed: seedTodos([["aaa1", { title: "Before" }]]) });
    await expect(openItems(page)).toHaveCount(1);
    await page.evaluate(() => {
      window.__fakeClaude.externalSet("todos/bbb2", {
        title: "Added by HAL sync",
        due: null,
        meta: null,
        status: "open",
        doneAt: null,
        order: 5,
      });
    });
    await expect(openItems(page)).toHaveCount(2);
    await expect(page.getByText("Added by HAL sync")).toBeVisible();
    await page.evaluate(() => window.__fakeClaude.externalDelete("todos/aaa1"));
    await expect(openItems(page)).toHaveCount(1);
  });

  pending(test, "T-004")(
    "REQ-005: footer shows how long ago the last sync was",
    async ({ page }) => {
      const syncedAt = new Date(NOW.getTime() - 2 * 3600 * 1000).toISOString();
      await openPage(page, {
        seed: seedTodos([["aaa1", { title: "Something" }]], { "meta/sync": { syncedAt } }),
      });
      await expect(page.getByTestId("sync-footer")).toHaveText(/Synced 2 h ago/);
    },
  );

  test("REQ-005: empty db shows the ask-HAL message", async ({ page }) => {
    await openPage(page, { seed: {} });
    await expect(page.getByText("No todos yet — ask HAL to sync todos")).toBeVisible();
    await expect(openItems(page)).toHaveCount(0);
  });

  test("REQ-005: db unavailable (use('db') is null) shows a sign-in message and no list", async ({
    page,
  }) => {
    await openPage(page, { dbNull: true, seed: seedTodos([["aaa1", { title: "Hidden" }]]) });
    await expect(page.getByText(/claude\.ai/i)).toBeVisible();
    await expect(page.getByText(/signed in/i)).toBeVisible();
    await expect(page.getByTestId("open-list")).toHaveCount(0);
    await expect(page.getByText("Hidden")).toHaveCount(0);
  });
});
