import { errorText, responseJSON } from "./http-errors";
import { useState, useRef } from "react";
import {
  ImagePlus,
  Sparkles,
  Upload,
  Trash2,
  LoaderCircle,
  Check,
} from "lucide-react";
import { api, type Fields, type Data } from "./types";
import type { T } from "./i18n";
import { Modal } from "./components";
export function CoverEditor({
  coverId,
  fields,
  data,
  t,
  onChange,
}: {
  coverId: string;
  fields: Fields;
  data: Data;
  t: T;
  onChange: (id: string) => void;
}) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [candidate, setCandidate] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  async function upload(f: File) {
    setBusy("upload");
    setError("");
    try {
      if (f.size > 8 * 1024 * 1024) throw new Error(t("imageLimit"));
      const form = new FormData();
      form.append("image", f);
      const r = await fetch("/api/covers", { method: "POST", body: form });
      const value = await responseJSON(r);
      setCandidate(value);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
      if (file.current) file.current.value = "";
    }
  }
  async function generate() {
    setBusy("ai");
    setError("");
    try {
      setCandidate(
        await api("/covers/generate", {
          title: fields.title || "",
          need: fields.need || "",
          result: fields.result || "",
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy("");
    }
  }
  return (
    <details className="cover-editor" open={coverId ? true : undefined}>
      <summary>
        <ImagePlus size={18} />
        {t("cover")}
        <span>{t("coverOptional")}</span>
      </summary>
      <div className="cover-editor-body">
        <p className="muted">{t("coverHint")}</p>
        {coverId && (
          <img
            className="cover-selected"
            src={"/covers/" + coverId + ".jpg"}
            alt={t("cover")}
          />
        )}
        <input
          type="file"
          accept="image/jpeg,image/png"
          ref={file}
          hidden
          aria-label={t("uploadPhoto")}
          onChange={(e) => {
            if (e.target.files?.[0]) void upload(e.target.files[0]);
          }}
        />
        <div className="row wrap">
          <button
            type="button"
            className="soft-btn"
            disabled={!!busy}
            onClick={() => file.current?.click()}
          >
            {busy === "upload" ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Upload size={17} />
            )}{" "}
            {t("uploadPhoto")}
          </button>
          <button
            type="button"
            className="soft-btn"
            disabled={
              !!busy ||
              data.user?.plan !== "pro" ||
              !data.capabilities.images ||
              !fields.need?.trim()
            }
            onClick={() => void generate()}
          >
            {busy === "ai" ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Sparkles size={17} />
            )}{" "}
            {t(busy === "ai" ? "generatingCover" : "generateCover")}{" "}
            <span className="pro-pill">Pro</span>
          </button>
          {coverId && (
            <button
              type="button"
              className="text-btn"
              disabled={!!busy}
              onClick={() => onChange("")}
            >
              <Trash2 size={16} />
              {t("removeCover")}
            </button>
          )}
        </div>
        <p className="micro muted">
          {t("imageLimit")} ·{" "}
          {t(
            data.user?.plan !== "pro"
              ? "imagePro"
              : data.capabilities.images
                ? "imagePrivacy"
                : "imageUnavailable",
          )}
        </p>
        {busy === "ai" && <p role="status">{t("generatingCover")}</p>}
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
      </div>
      {candidate && (
        <Modal title={t("coverPreview")} onClose={() => setCandidate(null)}>
          <img
            className="cover-candidate"
            src={candidate.url}
            alt={t("coverPreview")}
          />
          <div className="row">
            <button
              className="primary"
              onClick={() => {
                onChange(candidate.id);
                setCandidate(null);
              }}
            >
              <Check size={17} />
              {t("useCover")}
            </button>
            <button className="soft-btn" onClick={() => setCandidate(null)}>
              {t("discard")}
            </button>
          </div>
        </Modal>
      )}
    </details>
  );
}
