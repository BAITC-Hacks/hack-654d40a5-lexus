import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const password = "Pass1234!";
const foreign =
  "We need a simple application to help customers schedule appointments and manage their daily orders in a local coffee shop.";
const russian =
  "Нужно приложение для клиентов кофейни, чтобы они могли заранее заказывать напитки и отслеживать готовность заказа.";

test("language audit tolerates technical terms and offers a non-destructive acknowledgement", async ({
  page,
  context,
}) => {
  await context.request.post("/api/auth/login", {
    data: { email: "customer@alemhack.ai", password },
  });
  await page.goto("/#new");
  const source = page.getByLabel("Что нужно изменить", { exact: true });
  await source.fill(
    "Нужен сайт на React и TypeScript для кофейни. Backend на Go, база PostgreSQL, запуск через Docker и REST API.",
  );
  await expect(
    page.getByRole("button", { name: "Помочь сформулировать", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".language-warning")).toHaveCount(0);
  await source.fill(foreign);
  await expect(page.locator(".language-warning")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Помочь сформулировать", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Да, я проверил текст и хочу продолжить", { exact: true })
    .check();
  await expect(
    page.getByRole("button", { name: "Помочь сформулировать", exact: true }),
  ).toBeEnabled();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await source.fill(russian);
  await expect(page.locator(".language-warning")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Помочь сформулировать", exact: true }),
  ).toBeEnabled();
});

test("published language adjustment is acknowledged, versioned and reversible; file locale cannot bypass it", async ({
  request,
  playwright,
}) => {
  await request.post("/api/auth/login", {
    data: { email: "customer@alemhack.ai", password },
  });
  const files = await request.post("/api/attachments", {
    multipart: {
      locale: "en",
      file: {
        name: "requirements.txt",
        mimeType: "text/plain",
        buffer: Buffer.from(foreign),
      },
    },
  });
  expect(files.status()).toBe(200);
  const file = await files.json();
  expect(file.audit.detected).toBe("latin");
  expect(file.audit.warning).toBe(false);
  const anon = await playwright.request.newContext({
    baseURL: process.env.SANA_URL || "http://localhost:8080",
  });
  expect((await anon.get("/files/" + file.id)).status()).toBe(404);
  const fields: Record<string, string> = {
    title: "Проверка языка и материалов",
    need: russian,
    context: "Сейчас сотрудники считают остатки вручную.",
    users: "Сотрудники и клиенты кофейни.",
    data: "Описание процесса в приложенном файле.",
    constraints: "Прототип за три недели.",
    result: "Рабочее приложение и инструкция запуска.",
    success: "Сокращение списаний на двадцать процентов.",
    contact: "demo@example.org",
    interaction: "Обсуждение проекта раз в неделю.",
  };
  let c = await (
    await request.post("/api/challenges", {
      data: { fields, category: "Retail", locale: "ru" },
    })
  ).json();
  c = await (
    await request.post("/api/challenges/" + c.id, {
      data: {
        revision: c.revision,
        fields,
        confirm: Object.keys(fields),
        attachmentIds: [file.id],
      },
    })
  ).json();
  expect(c.languageAudit.warning).toBe(true);
  expect(c.score).toBe(100);
  expect(
    (
      await request.post("/api/challenges/" + c.id + "/publish", {
        data: { revision: c.revision, previewApproved: true },
      })
    ).status(),
  ).toBe(400);
  c = await (
    await request.post("/api/challenges/" + c.id + "/publish", {
      data: {
        revision: c.revision,
        previewApproved: true,
        acceptLanguageMismatch: true,
      },
    })
  ).json();
  expect(c.score).toBe(95);
  expect(c.languagePenalty).toBe(5);
  const download = await anon.get("/files/" + file.id);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-disposition"]).toContain("attachment");
  expect(await download.text()).toBe(foreign);
  c = await (
    await request.post("/api/challenges/" + c.id, {
      data: {
        revision: c.revision,
        fields,
        confirm: ["data"],
        attachmentIds: [],
      },
    })
  ).json();
  expect(c.languagePenalty).toBe(0);
  expect(c.score).toBe(100);
  c = await (
    await request.post("/api/challenges/" + c.id + "/publish", {
      data: { revision: c.revision, previewApproved: true },
    })
  ).json();
  expect(c.versions[0].languagePenalty).toBe(5);
  expect(c.versions[1].languagePenalty).toBe(0);
  expect(c.versions[0].attachmentIds).toEqual([file.id]);
  // Old attachments remain available from historical published versions.
  expect((await anon.get("/files/" + file.id)).status()).toBe(200);
  await anon.dispose();
});

test("attachments reject executable formats and are private within a team proposal", async ({
  request,
  playwright,
}) => {
  await request.post("/api/auth/login", {
    data: { email: "student@alemhack.ai", password },
  });
  expect(
    (
      await request.post("/api/attachments", {
        multipart: {
          file: {
            name: "attack.html",
            mimeType: "text/html",
            buffer: Buffer.from("<script>alert(1)</script>"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/attachments", {
        multipart: {
          file: {
            name: "broken.pdf",
            mimeType: "application/pdf",
            buffer: Buffer.from("not a real PDF"),
          },
        },
      })
    ).status(),
  ).toBe(400);
  const f = await (
    await request.post("/api/attachments", {
      multipart: {
        file: {
          name: "план.txt",
          mimeType: "text/plain",
          buffer: Buffer.from(
            "План реализации: интервью, анализ данных, разработка, тестирование и демонстрация готового решения.",
          ),
        },
      },
    })
  ).json();
  expect(f.id).toBeTruthy();
  const p = await request.post("/api/proposals", {
    data: {
      challengeId: "q1",
      version: 1,
      idea: "Изучим процесс работы кофейни и построим прогноз.",
      plan: "Проведём интервью, подготовим данные, создадим приложение.",
      deadline: "21 день",
      link: "",
      attachmentIds: [f.id],
    },
  });
  expect(p.status()).toBe(200);
  const other = await playwright.request.newContext({
    baseURL: process.env.SANA_URL || "http://localhost:8080",
  });
  expect((await other.get("/files/" + f.id)).status()).toBe(404);
  await other.post("/api/auth/login", {
    data: { email: "pro@alemhack.ai", password },
  });
  expect((await other.get("/files/" + f.id)).status()).toBe(404);
  await other.post("/api/auth/login", {
    data: { email: "business@alemhack.ai", password },
  });
  expect((await other.get("/files/" + f.id)).status()).toBe(200);
  await other.dispose();
});

test("customer reviews a foreign attachment in the publication preview and sees the score adjustment", async ({
  page,
  context,
}) => {
  await context.request.post("/api/auth/login", {
    data: { email: "customer@alemhack.ai", password },
  });
  const fields = {
    title: "Предпросмотр иностранного материала",
    need: russian,
    context: "Текущие остатки считают вручную.",
    users: "Клиенты и сотрудники кофейни.",
    data: "Примеры процесса в приложенном документе.",
    constraints: "Три недели на прототип.",
    result: "Приложение и инструкция запуска.",
    success: "Снизить списания на двадцать процентов.",
    contact: "demo@example.org",
    interaction: "Еженедельный созвон с командой.",
  };
  let c = await (
    await context.request.post("/api/challenges", {
      data: { fields, category: "Retail", locale: "ru" },
    })
  ).json();
  c = await (
    await context.request.post("/api/challenges/" + c.id, {
      data: { revision: c.revision, fields, confirm: Object.keys(fields) },
    })
  ).json();
  await page.goto("/#edit/" + c.id);
  await page.locator(".group-tabs button").nth(1).click();
  await page
    .locator(".attachment-editor input[type=file]")
    .setInputFiles({
      name: "requirements.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(foreign),
    });
  await expect(page.locator(".attachment-list")).toContainText(
    "requirements.txt",
  );
  await page
    .getByRole("button", {
      name: "Сохранить и подтвердить раздел",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Предпросмотр", exact: true })
    .last()
    .click();
  await expect(page.locator(".language-warning")).toBeVisible();
  await page
    .getByLabel(
      "Я понимаю предупреждение и согласен опубликовать материал с поправкой к рейтингу",
      { exact: true },
    )
    .check();
  await expect(page.locator(".score-big")).toHaveText("95/100");
  await page
    .getByLabel("Я проверил карточку и хочу опубликовать именно эту версию")
    .check();
  await page
    .getByRole("button", { name: "Опубликовать задачу", exact: true })
    .click();
  await page.waitForURL("**/#quest/" + c.id);
  await expect(page.locator(".language-public-note")).toContainText("−5");
  await expect(page.locator(".attachment-list")).toContainText(
    "requirements.txt",
  );
});
