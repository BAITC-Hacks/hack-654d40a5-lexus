import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { Fields, Lang, LanguageAudit } from "./types";
export function useLanguageAudit(input: string | Fields, locale: Lang = "ru") {
  const serialized = JSON.stringify(input);
  const [audit, setAudit] = useState<LanguageAudit | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    setAccepted(false);
    setAudit(null);
    if (serialized.length < 25) {
      setChecking(false);
      return;
    }
    setChecking(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const value = JSON.parse(serialized);
        const r = await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(typeof value === "string"
              ? { text: value }
              : { fields: value }),
            locale,
          }),
          signal: controller.signal,
        });
        if (r.ok) {
          const value = await r.json();
          if (!controller.signal.aborted) setAudit(value);
        }
      } catch {
      } finally {
        if (!controller.signal.aborted) setChecking(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [serialized, locale]);
  return {
    audit,
    accepted,
    setAccepted,
    checking,
    blocked: !!audit?.warning && !accepted,
  };
}
export function LanguageWarning({
  audit,
  accepted,
  onAccept,
  penalty = false,
}: {
  audit: LanguageAudit | null | undefined;
  accepted: boolean;
  onAccept: (v: boolean) => void;
  penalty?: boolean;
}) {
  if (!audit?.warning) return null;
  const language =
    audit.expected === "kk"
      ? "казахским"
      : audit.expected === "en"
        ? "английским"
        : "русским";
  return (
    <div className="language-warning" role="status">
      <div>
        <AlertTriangle size={19} />
        <strong>Проверьте язык материала</strong>
      </div>
      <p>
        Значительная часть текста может не совпадать с {language} языком задачи.
        Это подсказка, а не точный вердикт: названия и технические термины можно
        оставить.
      </p>
      {penalty && (
        <p>
          <strong>
            При публикации с этим расхождением: −5 баллов готовности.
          </strong>{" "}
          После исправления текста или замены файла баллы восстановятся.
        </p>
      )}
      <label className="language-consent">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAccept(e.target.checked)}
        />
        <span>
          {penalty
            ? "Я понимаю предупреждение и согласен опубликовать материал с поправкой к рейтингу"
            : "Да, я проверил текст и хочу продолжить"}
        </span>
      </label>
    </div>
  );
}

export function languageFor(a: LanguageAudit, expected: string): LanguageAudit {
  const warning =
    expected === "ru"
      ? ["kk", "latin", "other"].includes(a.detected)
      : expected === "en"
        ? ["ru", "kk", "other"].includes(a.detected)
        : ["latin", "other"].includes(a.detected);
  return { ...a, expected, warning };
}
