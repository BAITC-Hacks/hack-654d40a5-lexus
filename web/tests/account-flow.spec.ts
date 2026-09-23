import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const password = "Pass1234!";

test("registration chooses role after credentials, student profile survives sign out and sign in", async ({
  page,
}) => {
  const email = `student-${Date.now()}@example.org`;
  await page.goto("/");
  await page.locator(".profile-button").click();
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await page.getByLabel("Электронная почта", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByLabel("Повторите пароль", { exact: true }).fill(password);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Как вы хотите участвовать?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Ученик или студент/ }).click();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.getByLabel("Как вас зовут").fill("Тестовый студент");
  await page.getByLabel("Учебное заведение").fill("AITU");
  await page.getByLabel("Ваши навыки через запятую").fill("Go, React");
  await page
    .getByLabel("Название команды · необязательно")
    .fill("New Builders");
  await page.getByRole("button", { name: "Готово, начнём" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".profile-button").click();
  await page.getByRole("button", { name: "Выйти", exact: true }).click();
  await page.locator(".profile-button").click();
  await page.getByLabel("Электронная почта", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.locator(".profile-copy strong")).toHaveText(
    "Тестовый студент",
  );
  const data = await (await page.request.get("/api/bootstrap")).json();
  expect(data.user.role).toBe("student");
  expect(data.user.plan).toBe("free");
  expect(data.teams.find((t: any) => t.id === data.user.teamId).skills).toEqual(
    ["Go", "React"],
  );
  await page.reload();
  await expect(page.locator(".profile-copy strong")).toHaveText(
    "Тестовый студент",
  );
});

test("assistant presents one editable question, preserves back navigation and prepares a reviewed brief", async ({
  page,
  context,
}) => {
  await context.request.post("/api/auth/login", {
    data: { email: "customer@alemhack.ai", password },
  });
  await page.goto("/#new");
  await page
    .getByLabel("Что нужно изменить", { exact: true })
    .fill("Кофейне нужен прогноз продаж и сокращение списаний.");
  await page
    .getByRole("button", { name: "Помочь сформулировать", exact: true })
    .click();
  await expect(page.locator(".current-question")).toBeVisible();
  await expect(page.locator(".question-flow textarea")).toHaveCount(1);
  const firstQuestion = await page.locator(".current-question").innerText();
  await page
    .locator(".question-flow textarea")
    .fill("Решением будет пользоваться управляющий кофейни.");
  await page.getByRole("button", { name: "Следующий вопрос" }).click();
  await expect(page.locator(".question-flow textarea")).toHaveValue("");
  await page
    .locator(".question-flow textarea")
    .fill("Есть таблица продаж за три месяца.");
  await page
    .locator(".question-navigation")
    .getByRole("button", { name: "Назад", exact: true })
    .click();
  await expect(page.locator(".current-question")).toHaveText(firstQuestion);
  await expect(page.locator(".question-flow textarea")).toHaveValue(
    "Решением будет пользоваться управляющий кофейни.",
  );
  await page.getByRole("button", { name: "Следующий вопрос" }).click();
  await expect(page.locator(".question-flow textarea")).toHaveValue(
    "Есть таблица продаж за три месяца.",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: "/tmp/sana-v2-question.png", fullPage: true });
  while (await page.locator(".current-question").isVisible())
    await page
      .getByRole("button", { name: "Пока не знаю", exact: true })
      .click();
  await expect(page.locator("progress")).toHaveJSProperty(
    "value",
    await page.locator("progress").getAttribute("max").then(Number),
  );
  await page
    .getByRole("button", { name: "Собрать карточку", exact: true })
    .click();
  await expect(
    page.getByLabel("Название задачи", { exact: true }),
  ).toBeVisible();
  await page.locator(".cover-editor summary").click();
  await expect(
    page.getByRole("button", { name: /Создать с AI/ }),
  ).toBeDisabled();
});

test("authorization rejects role spoofing, legacy demo access and self-issued subscriptions", async ({
  request,
}) => {
  const anonymous = await (await request.get("/api/bootstrap")).json();
  expect(anonymous.accounts).toBeUndefined();
  expect(anonymous.profiles).toBeUndefined();
  expect(anonymous.user).toBeNull();
  expect(
    (
      await request.post("/api/session", { data: { userId: "admin" } })
    ).status(),
  ).toBe(404);
  expect((await request.get("/api/admin/users")).status()).toBe(401);
  const email = `business-${Date.now()}@example.org`;
  expect(
    (
      await request.post("/api/auth/register", {
        data: { email, password, confirmPassword: password, role: "admin" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/register", {
        data: { email, password, confirmPassword: "different" },
      })
    ).status(),
  ).toBe(400);
  const reg = await request.post("/api/auth/register", {
    data: { email, password, confirmPassword: password },
  });
  expect(reg.status()).toBe(200);
  const user = await reg.json();
  expect(user.role).toBe("pending");
  expect(
    (
      await request.post("/api/auth/onboard", {
        data: { role: "admin", name: "Admin" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/auth/onboard", {
        data: {
          role: "business",
          name: "API test customer",
          description: "Test business",
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.post("/api/auth/onboard", {
        data: {
          role: "student",
          name: "Role switch",
          organization: "A",
          skills: "Go",
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.post("/api/subscription", { data: { plan: "pro" } })
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.post("/api/admin/users", {
        data: { userId: user.id, role: "admin", plan: "pro" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/covers/generate", {
        data: { title: "Cover", need: "A new local customer need", result: "" },
      })
    ).status(),
  ).toBe(403);
  expect((await request.post("/api/auth/logout", { data: {} })).status()).toBe(
    200,
  );
  expect((await (await request.get("/api/bootstrap")).json()).user).toBeNull();
  expect(
    (
      await request.post("/api/auth/login", {
        data: { email, password: "WrongPass!" },
      })
    ).status(),
  ).toBe(401);
});

test("administrator grants and revokes Pro without changing readiness", async ({
  page,
  context,
}) => {
  await context.request.post("/api/auth/login", {
    data: { email: "admin@alemhack.ai", password },
  });
  await page.goto("/#admin");
  await expect(
    page.getByRole("heading", { name: "Пользователи и доступ" }),
  ).toBeVisible();
  const row = page
    .locator(".admin-user")
    .filter({ hasText: "customer@alemhack.ai" });
  await row.getByLabel("Подписка", { exact: true }).selectOption("pro");
  await row.getByRole("button", { name: "Сохранить доступ" }).click();
  await expect(
    row.getByRole("button", { name: "Сохранить доступ" }),
  ).toBeDisabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: "/tmp/sana-v2-admin.png", fullPage: true });
  await row.getByLabel("Подписка", { exact: true }).selectOption("free");
  await row.getByRole("button", { name: "Сохранить доступ" }).click();
  await expect(
    row.getByRole("button", { name: "Сохранить доступ" }),
  ).toBeDisabled();
  const result = await (await context.request.get("/api/admin/users")).json();
  expect(
    result.users.find((u: any) => u.email === "customer@alemhack.ai").plan,
  ).toBe("free");
  expect(result.events.length).toBeGreaterThanOrEqual(2);
  expect(JSON.stringify(result)).not.toContain("passwordHash");
});

test("cover upload stays private until publication and cannot be reused by another owner", async ({
  page,
  context,
  playwright,
}) => {
  await context.request.post("/api/auth/login", {
    data: { email: "customer@alemhack.ai", password },
  });
  await page.goto("/#new");
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const x = c.getContext("2d")!;
    x.fillStyle = "#9fb59b";
    x.fillRect(0, 0, 640, 360);
    return c.toDataURL("image/png").split(",")[1];
  });
  const upload = await context.request.post("/api/covers", {
    multipart: {
      image: {
        name: "photo.png",
        mimeType: "image/png",
        buffer: Buffer.from(image, "base64"),
      },
    },
  });
  expect(upload.status()).toBe(200);
  const cover = await upload.json();
  const anon = await playwright.request.newContext({
    baseURL: process.env.SANA_URL || "http://localhost:8080",
  });
  expect((await anon.get(cover.url)).status()).toBe(404);
  expect((await context.request.get(cover.url)).headers()["content-type"]).toBe(
    "image/jpeg",
  );
  expect(
    (
      await context.request.post("/api/covers", {
        multipart: {
          image: {
            name: "fake.png",
            mimeType: "image/png",
            buffer: Buffer.from('<svg onload="alert(1)"></svg>'),
          },
        },
      })
    ).status(),
  ).toBe(400);
  const fields = {
    title: "Cover privacy test",
    need: "A clear need for a local test business",
  };
  let c = await (
    await context.request.post("/api/challenges", {
      data: { fields, category: "Retail", locale: "en" },
    })
  ).json();
  c = await (
    await context.request.post("/api/challenges/" + c.id, {
      data: {
        revision: c.revision,
        fields,
        confirm: ["need"],
        coverId: cover.id,
      },
    })
  ).json();
  expect((await anon.get(cover.url)).status()).toBe(404);
  c = await (
    await context.request.post("/api/challenges/" + c.id + "/publish", {
      data: { revision: c.revision, previewApproved: true },
    })
  ).json();
  expect(c.versions[0].coverId).toBe(cover.id);
  expect(c.score).toBe(0);
  expect((await anon.get(cover.url)).status()).toBe(200);
  // Removing a draft cover must not remove the cover of the published snapshot.
  c = await (
    await context.request.post("/api/challenges/" + c.id, {
      data: { revision: c.revision, fields, coverId: "" },
    })
  ).json();
  expect(c.coverId).toBe("");
  const pub = await (await anon.get("/api/bootstrap")).json();
  expect(pub.challenges.find((v: any) => v.id === c.id).coverId).toBe(cover.id);
  await context.request.post("/api/auth/login", {
    data: { email: "pro@alemhack.ai", password },
  });
  let other = await (
    await context.request.post("/api/challenges", {
      data: { fields, category: "Retail", locale: "en" },
    })
  ).json();
  expect(
    (
      await context.request.post("/api/challenges/" + other.id, {
        data: { revision: other.revision, fields, coverId: cover.id },
      })
    ).status(),
  ).toBe(403);
  await anon.dispose();
});
