import { errorText, responseJSON } from "./http-errors";
import { languageFor } from "./Language";
import { useRef, useState } from "react";
import {
  Paperclip,
  Download,
  Trash2,
  FileText,
  LoaderCircle,
} from "lucide-react";
import type { Attachment, Data, Lang } from "./types";
export function AttachmentList({ ids, data }: { ids?: string[]; data: Data }) {
  if (!ids?.length) return null;
  return (
    <ul className="attachment-list">
      {ids.map((id) => {
        const f = data.attachments?.find((f) => f.id === id);
        return f ? (
          <li key={id}>
            <FileText size={19} />
            <a href={"/files/" + f.id} download={f.name}>
              <strong>{f.name}</strong>
              <small>{formatSize(f.size)}</small>
            </a>
            <Download size={16} />
          </li>
        ) : null;
      })}
    </ul>
  );
}
const formatSize = (n: number) =>
  n >= 1024 * 1024
    ? (n / 1024 / 1024).toFixed(1) + " МБ"
    : Math.max(1, Math.ceil(n / 1024)) + " КБ";
export function AttachmentEditor({
  ids,
  data,
  locale = "ru",
  onChange,
  refresh,
}: {
  ids: string[];
  data: Data;
  locale?: Lang;
  onChange: (ids: string[]) => void;
  refresh: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState<Attachment[]>([]);
  const files = ids
    .map(
      (id) =>
        uploaded.find((f) => f.id === id) ||
        data.attachments?.find((f) => f.id === id),
    )
    .filter(Boolean) as Attachment[];
  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error("Файл должен быть не больше 20 МБ");
      const form = new FormData();
      form.append("file", file);
      form.append("locale", locale);
      const r = await fetch("/api/attachments", { method: "POST", body: form });
      const value = await responseJSON(r);
      setUploaded((prev) => [...prev, value]);
      onChange([...ids, value.id]);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <div className="attachment-editor">
      <div className="attachment-editor-heading">
        <strong>
          <Paperclip size={16} /> Файлы и материалы
        </strong>
        <span>{ids.length}/5</span>
      </div>
      <p className="micro muted">
        PDF, DOCX, XLSX, CSV, TXT, PNG, JPG, ZIP · до 20 МБ на файл
      </p>
      <ul className="attachment-list">
        {files.map((f) => (
          <li key={f.id}>
            <FileText size={19} />
            <div>
              <a href={"/files/" + f.id} download={f.name}>
                <strong>{f.name}</strong>
              </a>
              <small>
                {formatSize(f.size)}
                {languageFor(f.audit, locale).warning
                  ? " · проверьте язык"
                  : f.auditScope === "manual"
                    ? " · содержимое требует ручной проверки"
                    : " · автопроверка выполнена"}
              </small>
            </div>
            <button
              type="button"
              className="icon-btn"
              disabled={busy}
              aria-label={"Убрать файл " + f.name}
              onClick={() => onChange(ids.filter((id) => id !== f.id))}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>
      <input
        type="file"
        hidden
        ref={input}
        accept=".pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.zip"
        aria-label="Прикрепить файл"
        onChange={(e) => {
          if (e.target.files?.[0]) void upload(e.target.files[0]);
        }}
      />
      <button
        type="button"
        className="soft-btn"
        disabled={busy || ids.length >= 5}
        onClick={() => input.current?.click()}
      >
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : (
          <Paperclip size={16} />
        )}{" "}
        {busy ? "Загружаем…" : "Прикрепить файл"}
      </button>
      <p className="attachment-note">
        Файлы станут доступны вместе с опубликованной задачей или отправленным
        откликом. Автопроверка языка анализирует доступный текст; сканы и архивы
        проверьте вручную.
      </p>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </div>
  );
}
