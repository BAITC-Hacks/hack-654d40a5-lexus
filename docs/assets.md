# Ассеты и источники

## Баннер

- Файл: `web/public/assets/quest-world.png`.
- Создан встроенным инструментом **imagegen**, не CLI и не через пользовательский API-ключ.
- Исходное изображение: 2172×724, собственная генерация для Sana Quest. Сторонние игровые sprites, бренды и персонажи не копировались.
- Финальный промпт:

```text
Use case: stylized-concept. Asset type: wide pixel-art illustration banner for Sana Quest, a platform connecting university student teams with real business challenges. Original polished isometric 32-bit pixel art miniature floating island, welcoming green university town and collaborative invention workshop, tiny explorers with laptops, an illuminated turquoise portal, small golden flags, pine trees, mountain silhouettes. Warm cream sky, forest green, turquoise, peach and golden amber palette. Wide panoramic composition, visual detail mainly right two thirds, left third quiet pale mint sky for HTML text overlay. Crisp intentionally pixelated edges, intricate high quality videogame environment, soft atmospheric light, charming optimistic adventure, sophisticated not childish. No text, no letters, no logos, no watermarks. Aspect ratio 3:1.
```

## Интерфейс и видео

- Lucide React — иконки, ISC: https://github.com/lucide-icons/lucide/blob/main/LICENSE
- React — MIT; Vite — MIT; pgx — MIT. Лицензии зависимостей сохраняются в npm/Go packages.
- Emoji — системный набор браузера, отдельные чужие sprite sheets не загружались.
- `renderer/src/vendor/DotFieldBg.tsx` скопирован без изменения; `types.ts` сокращён до используемого BgSpec. Оба происходят из [anything2explainer](https://github.com/Vincentwei1021/anything2explainer). Copyright (c) 2026 Vincent Wei. Required Notice и PolyForm Noncommercial находятся в `renderer/ANYTHING2EXPLAINER-LICENSE`.
- Остальные сцены адаптера созданы для платформы. Video workflow следует подтверждению сценария/языка/голоса, pilot и полному рендеру из skill; runtime получает JSON, не пользовательский программный код.
- Remotion: https://www.remotion.dev/license. Условия toolkit и Remotion не подменяются лицензиями React/TypeScript.
- Шрифт видео: DejaVu Sans из системного пакета контейнера; поддерживает кириллицу и казахские буквы. Интерфейс использует системные шрифты, без внешних font CDN.

## Документация API

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI speech-to-text](https://developers.openai.com/api/docs/guides/speech-to-text)
- [OpenAI text-to-speech](https://developers.openai.com/api/docs/guides/text-to-speech)
- [ElevenLabs models](https://elevenlabs.io/docs/overview/models)
- [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/)

Источники помогают выбрать интерфейс и интеграции; их наличие не означает сертификацию продукта или коммерческое разрешение на toolkit.

## Обложки категорий

`web/public/assets/cover-{coffee,city,learn,data,green,tech}.svg` — оригинальные векторные иллюстрации, созданные в коде для этого проекта. Сторонние фотографии, логотипы и нелицензированные текстуры не используются. Это тематические заглушки, а не результаты AI-провайдера. Пользовательская загрузка или явная Pro-генерация заменяет заглушку в опубликованной версии.
