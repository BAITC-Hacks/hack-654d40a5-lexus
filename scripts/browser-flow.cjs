const { chromium } = require("../web/node_modules/playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_EXECUTABLE
      ? { executablePath: process.env.CHROME_EXECUTABLE }
      : {},
  );
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.SANA_URL || "http://localhost:8080");
  async function login(name) {
    await page.locator(".profile-button").click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(name) })
      .click();
    await page
      .getByRole("dialog", { name: "Выберите свою роль", exact: true })
      .waitFor({ state: "hidden" });
  }
  await login("Alem Coffee");
  await page
    .locator(".section-heading")
    .getByRole("button", { name: "Создать задачу" })
    .click();
  await page
    .getByLabel("Что нужно изменить", { exact: true })
    .fill("У кофейни остаётся выпечка к вечеру. Хотим сократить списания.");
  const local = page.getByRole("button", {
    name: "Локальный помощник",
    exact: true,
  });
  if (await local.isVisible()) await local.click();
  else
    await page
      .getByRole("button", { name: "Помочь сформулировать", exact: true })
      .click();
  await page.locator(".question-list>div").nth(2).waitFor();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page
    .getByLabel("Название задачи", { exact: true })
    .fill("UI QA: прогноз для кофейни");
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
  await page
    .getByLabel("Я проверил карточку и хочу опубликовать именно эту версию")
    .check();
  await page
    .getByRole("button", { name: "Опубликовать задачу", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "UI QA: прогноз для кофейни", exact: true })
    .waitFor();
  await page.waitForURL(/#quest\//);
  const questHash = await page.evaluate(() => location.hash);
  assert.equal(
    await page.locator(".detail-sidebar .score-big").innerText(),
    "0/100",
  );
  await login("Pixel Pioneers");
  await page.getByRole("button", { name: "Откликнуться", exact: true }).click();
  await page
    .getByLabel("Идея решения", { exact: true })
    .fill("Проверим продажи и построим простой прогноз спроса.");
  await page
    .getByLabel("План работы", { exact: true })
    .fill("Интервью с бариста, анализ таблицы, разработка и тестирование.");
  await page.getByLabel("Срок выполнения", { exact: true }).fill("21 день");
  await page
    .getByRole("button", { name: "Отправить предложение", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await login("Alem Coffee");
  await page
    .getByRole("button", { name: "Дополнить задачу", exact: true })
    .click();
  await page
    .getByLabel("Что происходит сейчас", { exact: true })
    .fill("Бариста вручную записывают остатки в конце смены.");
  await page
    .getByRole("button", {
      name: "Сохранить и подтвердить раздел",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Для кого решение", { exact: true })
    .fill("Бариста и управляющий кофейней.");
  await page
    .getByLabel("Данные и материалы", { exact: true })
    .fill("Обезличенная таблица продаж за три месяца.");
  await page
    .getByRole("button", {
      name: "Сохранить и подтвердить раздел",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Ожидаемый результат", { exact: true })
    .fill("Локально запускаемый прототип прогноза спроса.");
  await page
    .getByLabel("Критерии успеха", { exact: true })
    .fill("Уменьшить списания на 20 процентов в пилоте.");
  await page
    .getByRole("button", {
      name: "Сохранить и подтвердить раздел",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Сроки и ограничения", { exact: true })
    .fill("21 день; все данные обезличены.");
  await page.getByLabel("Контакт", { exact: true }).fill("demo@example.org");
  await page
    .getByLabel("Формат обратной связи", { exact: true })
    .fill("Созвон во вторник, ответы в течение двух дней.");
  await page
    .getByRole("button", {
      name: "Сохранить и подтвердить раздел",
      exact: true,
    })
    .click();
  await page.waitForFunction(
    () => document.querySelector(".score-big")?.textContent === "100/100",
  );
  await page
    .getByRole("button", { name: "Предпросмотр", exact: true })
    .last()
    .click();
  await page
    .getByLabel("Я проверил карточку и хочу опубликовать именно эту версию")
    .check();
  await page
    .getByRole("button", { name: "Опубликовать изменения", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "UI QA: прогноз для кофейни", exact: true })
    .waitFor();
  await login("Pixel Pioneers");
  await page
    .getByRole("dialog", { name: "Потребность изменилась", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Ознакомился с изменениями" }).click();
  await page
    .locator(".detail-tabs")
    .getByRole("button", { name: /Отклики/ })
    .click();
  await page
    .getByRole("button", { name: "Мой отклик учитывает новую версию" })
    .click();
  await page.waitForTimeout(200);
  await login("Alem Coffee");
  await page
    .getByRole("button", { name: "Выбрать команду", exact: true })
    .click();
  await page.getByRole("button", { name: "Подтвердить этап · +50 XP" }).click();
  await login("Pixel Pioneers");
  await page
    .getByRole("button", { name: "Отправить результат", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Ожидаемый результат", { exact: true })
    .fill(
      "Прототип готов: https://example.org/forecast. Критерии проверены на обезличенных данных.",
    );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Отправить результат", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await login("Alem Coffee");
  await page
    .getByRole("button", { name: "Принять результат и оценить" })
    .click();
  await page
    .getByLabel("Что получилось хорошо? Что команда может улучшить?")
    .fill("Понятный прогноз и отличная инструкция для сотрудников.");
  await page
    .getByRole("button", { name: "Подтвердить результат · +150 XP" })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.locator(".proposal-card .badge.completed").waitFor();
  for (const lang of ["kk", "en", "ru"]) {
    await page.locator(".lang-select select").selectOption(lang);
    assert.equal(await page.locator("html").getAttribute("lang"), lang);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      await page.waitForTimeout(250);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `overflow ${lang} ${width}`,
      );
    }
  }
  console.log({
    result: "PASS",
    scenario:
      "draft 0 → proposal → published 100 → diff → acceptance → delivery → review",
    errors,
    questHash,
  });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
