import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("catalog, languages, keyboard navigation and responsive layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".quest-card").first()).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await expect(page.locator(".quest-card").first()).toBeVisible();
  for (const lang of ["ru", "kk", "en"]) {
    await page.locator(".lang-select select").selectOption(lang);
    await expect(page.locator("html")).toHaveAttribute("lang", lang);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBeTruthy();
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  }
  expect(errors).toEqual([]);
});
test("core pages expose labels and sufficient text contrast", async ({
  page,
  context,
}) => {
  await context.request.post("/api/session", { data: { userId: "b1" } });
  for (const route of ["teams", "plans", "quest/q1", "edit/q1", "workspace"]) {
    await page.goto("/#" + route);
    await page.waitForFunction(
      () => document.querySelector(".page-heading,.detail-heading") !== null,
    );
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations, route).toEqual([]);
  }
});
