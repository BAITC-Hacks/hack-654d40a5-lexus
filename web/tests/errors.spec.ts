import { test, expect } from "@playwright/test";

test("HTML 500 becomes a Russian recoverable error with request ID", async ({ page }) => {
  await page.route("**/api/bootstrap", route => route.fulfill({
    status: 500,
    contentType: "text/html",
    headers: { "X-Request-ID": "abcdef0123456789abcdef0123456789" },
    body: "<html>Internal proxy failure</html>",
  }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Сервер не смог выполнить запрос");
  await expect(page.getByRole("alert")).toContainText("HTTP 500");
  await expect(page.getByRole("alert")).toContainText("abcdef0123456789abcdef0123456789");
  await expect(page.getByRole("alert")).not.toContainText("Unexpected token");
  await page.unroute("**/api/bootstrap");
  await page.reload();
  await expect(page.locator(".quest-card").first()).toBeVisible();
});

test("network loss does not leave the UI with an untranslated fetch error", async ({ page }) => {
  await page.route("**/api/bootstrap", route => route.abort("failed"));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Нет соединения с сервером");
  await page.unroute("**/api/bootstrap");
  await page.reload();
  await expect(page.locator(".quest-card").first()).toBeVisible();
});
