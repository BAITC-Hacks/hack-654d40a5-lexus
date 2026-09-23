import { translator } from "./i18n";

const messages: Record<string, string> = {
  "Internal server error": "Сервер не смог выполнить запрос. Повторите действие через несколько секунд. Если ошибка повторяется, сохраните код запроса для диагностики.",
  "Access denied": "Это действие недоступно вашему аккаунту.",
  "Please sign in to continue": "Войдите в аккаунт, чтобы продолжить.",
  "Not found": "Материал не найден или больше недоступен.",
  "Method not allowed": "Это действие не поддерживается.",
  "The draft changed in another tab. Reload before saving.": "Черновик изменился в другой вкладке. Скопируйте свои правки и обновите страницу перед сохранением.",
  "Requirements changed. Review the new version.": "Потребность изменилась. Ознакомьтесь с новой версией перед отправкой.",
  "Team must update its proposal to the current requirements": "Команда должна подтвердить отклик для текущей версии потребности.",
  "Review the changed requirements first": "Сначала ознакомьтесь с изменениями потребности.",
  "Review the current requirements first": "Сначала подтвердите актуальную версию потребности.",
  "Review and approve the preview": "Просмотрите и подтвердите предпросмотр перед публикацией.",
  "Only pending proposals can be decided": "Этот отклик уже обработан. Обновите страницу.",
  "Proposal is closed": "Работа с этим откликом уже завершена.",
  "Already reviewed": "Вы уже оставили отзыв по этому результату.",
  "Provide a rating from 1 to 5 and a review": "Выберите оценку от 1 до 5 и напишите отзыв.",
  "Provide an idea, plan, deadline and valid http(s) link": "Заполните идею, план, срок и корректную ссылку, начинающуюся с https:// или http://.",
  "Describe the final result (10–5000 characters)": "Опишите итоговый результат: от 10 до 5000 символов.",
  "Daily demo API limit reached (40 requests)": "Достигнут дневной лимит: 40 обращений к платным API. Можно продолжить работу вручную или с локальным помощником.",
  "AI is unavailable. Retry or use the local assistant.": "ИИ сейчас недоступен. Попробуйте позже или выберите локальный помощник.",
  "Speech recognition requires an API key. Text input remains available.": "Распознавание речи пока не подключено. Вы можете ввести текст вручную.",
  "Speech recognition is unavailable": "Не удалось распознать запись. Попробуйте позже или введите текст вручную.",
  "No speech recognized. Try a clearer recording.": "Речь не распознана. Попробуйте записать ещё раз в более тихом месте.",
  "Audio upload limit is 20 MB": "Аудиофайл должен быть не больше 20 МБ.",
  "Audio file required": "Выберите аудиофайл.",
  "Use MP3, WAV, M4A, WebM, OGG, FLAC or MP4": "Поддерживаются MP3, WAV, M4A, WebM, OGG, FLAC и MP4.",
  "Audio generation requires an API key": "Озвучивание через API пока не подключено.",
  "Voice generation unavailable": "Сервис озвучивания временно недоступен. Попробуйте позже.",
  "Audio text limit: 4000 characters": "Для озвучивания используйте текст до 4000 символов.",
  "Microphone recording is unavailable. Upload an audio file.": "Запись с микрофона недоступна. Вы можете загрузить аудиофайл.",
  "Image generation requires Pro": "Для генерации обложки нужен тариф Pro. Загрузка своего фото доступна бесплатно.",
  "Daily cover limit reached (4 images)": "Сегодня уже созданы 4 обложки. Выберите готовую или загрузите своё фото.",
  "Image generation is unavailable. Upload a photo instead": "Генерация обложек пока не подключена. Загрузите своё фото.",
  "Image provider did not respond. Please try again": "Генератор обложек не ответил. Попробуйте позже или загрузите фото.",
  "Image provider could not generate this cover. Check model access or upload a photo": "Не удалось создать обложку. Проверьте доступ к модели в настройках API или загрузите своё фото.",
  "Image provider returned an invalid image": "Генератор вернул повреждённую картинку. Попробуйте позже или загрузите фото.",
  "Image provider returned invalid data": "Не удалось прочитать ответ генератора. Попробуйте позже или загрузите фото.",
  "Upload a JPEG or PNG image": "Выберите изображение в формате JPEG или PNG.",
  "Upload a JPEG or PNG image up to 8 MB": "Выберите JPEG или PNG не больше 8 МБ.",
  "Image must be at most 8 MB": "Изображение должно быть не больше 8 МБ.",
  "Image must be at least 64px and at most 16 megapixels": "Минимальная сторона изображения — 64 пикселя; максимальный размер — 16 мегапикселей.",
  "Image could not be decoded": "Изображение повреждено или имеет неподдерживаемый формат.",
  "Choose an image": "Выберите изображение.",
  "Describe your task before generating a cover": "Сначала опишите потребность для генерации обложки.",
  "Sana Pro is required for video generation": "Для генерации видео нужен тариф Pro.",
  "The brief changed. Create a preview from the current version.": "Задача изменилась. Создайте предпросмотр по текущей версии.",
  "Watch and approve the rendered preview first": "Сначала посмотрите и подтвердите пробный ролик.",
  "Only failed jobs can be retried": "Повторить можно только генерацию, завершившуюся ошибкой.",
  "Please wait for your current video to finish": "Дождитесь завершения текущего видео.",
  "Video not found": "Видео не найдено.",
  "Use the current published version": "Выберите текущую опубликованную версию задачи.",
  "Approve language, narration, voice and storyboard": "Подтвердите язык, сценарий, голос и раскадровку.",
  "Voice generation requires an API key": "Озвучивание пока не подключено. Можно создать видео без голоса.",
  "Video script must contain 20–1800 characters": "Сценарий должен содержать от 20 до 1800 символов.",
  "Use at most 6 paragraphs for the 6 scenes": "Разделите сценарий максимум на 6 абзацев для 6 сцен.",
  "Each paragraph must be at most 400 characters. Split long paragraphs with a blank line.": "Каждый абзац — до 400 символов. Разделите длинные абзацы пустой строкой.",
  "Demo media storage limit reached": "Достигнут лимит видеохранилища MVP. Обратитесь к администратору.",
  "Role cannot change while this user owns projects": "У пользователя есть задачи. Сменить роль без переноса задач нельзя; тариф менять можно.",
  "Role cannot change while this team has proposals": "У команды есть отклики. Сменить роль без переноса работ нельзя; тариф менять можно.",
  "You cannot change your own administrator role": "Нельзя снять роль администратора у собственного аккаунта.",
  "The user must finish registration first": "Пользователь должен сначала завершить регистрацию.",
};

export function errorText(value: unknown): string {
  const raw = String(value).replace(/^(Error|TypeError): /, "");
  if (messages[raw]) return messages[raw];
  if (/^(Failed to fetch|Load failed|NetworkError)/.test(raw))
    return "Нет соединения с сервером. Проверьте подключение и повторите действие. Не закрывайте форму, чтобы сохранить введённый текст.";
  if (/Permission denied|NotAllowedError/.test(raw))
    return "Браузер не разрешил доступ к микрофону. Разрешите доступ или загрузите аудиофайл.";
  const upstream = raw.match(/^AI provider returned (\d+)/);
  if (upstream) return `Сервис ИИ вернул ошибку ${upstream[1]}. Можно продолжить с локальным помощником. Администратору: проверьте ключ, доступ к модели и лимиты API.`;
  if (/^(Invalid AI response|AI returned invalid structured data|AI field validation failed|AI did not provide)/.test(raw))
    return "ИИ вернул ответ, который не прошёл проверку. Ваши поля не заменены. Повторите запрос или используйте локальный помощник.";
  return translator("ru")(raw);
}

export async function responseJSON<T = any>(response: Response): Promise<T> {
  const value = await response.json().catch(() => null);
  if (response.ok && value !== null) return value as T;
  const fallback: Record<number, string> = {
    400: "Проверьте заполненные поля и повторите действие.",
    401: "Please sign in to continue",
    403: "Access denied",
    404: "Not found",
    409: "Данные изменились. Скопируйте правки и обновите страницу перед повтором.",
    413: "Размер файла превышает допустимый лимит.",
    429: "Слишком много запросов. Подождите немного перед повтором.",
    500: "Internal server error",
    502: "Внешний сервис временно недоступен. Повторите позже или продолжите вручную.",
    503: "Сервис временно недоступен. Повторите действие позже.",
    504: "Сервис не ответил вовремя. Попробуйте позже.",
  };
  const message = errorText(value?.error || fallback[response.status] || "Сервер вернул неожиданный ответ. Попробуйте позже.");
  const requestId = response.headers.get("X-Request-ID") || value?.requestId;
  const trace = typeof requestId === "string" && /^[a-f0-9]{32}$/.test(requestId) ? ` Код запроса: ${requestId}.` : "";
  throw new Error(`${message}${response.ok ? "" : ` (HTTP ${response.status})`}${response.status >= 500 ? trace : ""}`);
}
