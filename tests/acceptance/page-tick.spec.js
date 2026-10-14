// REQ-004: tick done with undo. 4 s undo window, then exactly one db write (tickedAt).
// Time is controlled by Playwright's clock (page.clock.runFor); "now" is 2026-10-14 12:00 Europe/Bratislava.
import { expect, test } from "@playwright/test";
import { NOW, dbState, openPage, pending, seedTodos } from "../../test/page-helpers.js";

const openItems = (page) => page.getByTestId("open-list").getByTestId("todo-item");
const doneSection = (page) => page.getByTestId("done-section");
const seed = () =>
  seedTodos([
    ["aaa1", { title: "Pay invoice" }],
    ["bbb2", { title: "Other" }],
  ]);

test.describe("REQ-004 tick done with undo", () => {
  pending(test, "T-004")(
    "REQ-004: tick and wait 5 s writes tickedAt and the item is in the done section",
    async ({ page }) => {
      await openPage(page, { seed: seed() });
      await openItems(page).filter({ hasText: "Pay invoice" }).getByTestId("tick").click();
      // immediately: out of the open list, Undo is offered, nothing written yet
      await expect(openItems(page).filter({ hasText: "Pay invoice" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
      expect((await dbState(page)).attempts).toEqual([]);

      await page.clock.runFor(5000);

      await expect.poll(async () => (await dbState(page)).writes.length).toBe(1);
      const state = await dbState(page);
      expect(state.writes[0].op).toBe("update");
      expect(state.writes[0].path).toBe("todos/aaa1");
      const tickedAt = state.dump["todos/aaa1"].tickedAt;
      expect(typeof tickedAt).toBe("string");
      expect(Date.parse(tickedAt)).toBeGreaterThanOrEqual(NOW.getTime());
      expect(Date.parse(tickedAt)).toBeLessThan(NOW.getTime() + 60_000);
      expect(Object.keys(state.writes[0].data)).toEqual(["tickedAt"]);

      await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);
      await expect(doneSection(page).locator("summary")).toHaveText(/Done \(1\)/);
      await doneSection(page).locator("summary").click();
      await expect(
        doneSection(page).getByTestId("done-item").filter({ hasText: "Pay invoice" }),
      ).toBeVisible();
    },
  );

  pending(test, "T-004")(
    "REQ-004: Undo within 4 s writes nothing and restores the item",
    async ({ page }) => {
      await openPage(page, { seed: seed() });
      await openItems(page).filter({ hasText: "Pay invoice" }).getByTestId("tick").click();
      await page.clock.runFor(2000);
      await page.getByRole("button", { name: "Undo" }).click();
      await page.clock.runFor(5000);

      await expect(openItems(page).filter({ hasText: "Pay invoice" })).toHaveCount(1);
      const state = await dbState(page);
      expect(state.attempts).toEqual([]);
      expect(state.writes).toEqual([]);
      expect(state.dump["todos/aaa1"].tickedAt).toBeUndefined();
    },
  );

  pending(test, "T-004")("REQ-004: done items have no control to un-tick", async ({ page }) => {
    await openPage(page, {
      seed: seedTodos([
        ["aaa1", { title: "Status done", status: "done", doneAt: "2026-10-13" }],
        ["bbb2", { title: "Ticked in page", tickedAt: "2026-10-14T08:00:00Z" }],
      ]),
    });
    await doneSection(page).locator("summary").click();
    await expect(doneSection(page).getByTestId("done-item")).toHaveCount(2);
    await expect(doneSection(page).getByRole("button")).toHaveCount(0);
    await expect(doneSection(page).getByRole("checkbox")).toHaveCount(0);
  });

  pending(test, "T-004")(
    "REQ-004: a failed write returns the item to the open list with an error message",
    async ({ page }) => {
      await openPage(page, { seed: seed(), failWrites: true });
      await openItems(page).filter({ hasText: "Pay invoice" }).getByTestId("tick").click();
      await page.clock.runFor(5000);

      await expect(page.getByRole("alert")).toBeVisible();
      await expect(openItems(page).filter({ hasText: "Pay invoice" })).toHaveCount(1);
      const state = await dbState(page);
      expect(state.attempts).toHaveLength(1);
      expect(state.writes).toEqual([]);
      expect(state.dump["todos/aaa1"].tickedAt).toBeUndefined();
    },
  );
});
