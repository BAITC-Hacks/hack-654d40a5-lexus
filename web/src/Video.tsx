import { useState } from "react";
import {
  Film,
  Check,
  Download,
  Play,
  Sparkles,
  LockKeyhole,
} from "lucide-react";
import { api, type Challenge, type Lang } from "./types";
import type { Common } from "./Studio";
import { Empty, Modal } from "./components";
export function MediaStudio({
  challenge: c,
  data,
  t,
  lang,
  refresh,
  onError,
  go,
  notify,
}: Common & { challenge: Challenge }) {
  const [script, setScript] = useState(
    [c.fields.need, c.fields.users, c.fields.result, c.fields.success]
      .filter(Boolean)
      .join("\n\n"),
  );
  const [locale, setLocale] = useState<Lang>(c.locale);
  const [duration, setDuration] = useState(45);
  const [voice, setVoice] = useState("none");
  const [approved, setApproved] = useState(false);
  const [preview, setPreview] = useState(false);
  const [final, setFinal] = useState(false);
  const [busy, setBusy] = useState(false);
  const items = data.media.filter((m) => m.challengeId === c.id);
  const own = data.user?.id === c.ownerId;
  return (
    <div className="detail-paper">
      <div className="panel-title">
        <span className="stat-icon lavender">
          <Film size={24} />
        </span>
        <div>
          <h2>{t("videoTitle")}</h2>
          <p>{t("videoSub")}</p>
        </div>
      </div>
      {own &&
        (data.user?.plan === "pro" ? (
          <>
            <div className="row">
              <label>
                {t("contentLanguage")}
                <select
                  value={locale}
                  onChange={(e) => {
                    setLocale(e.target.value as Lang);
                    setApproved(false);
                  }}
                >
                  <option value="ru">Русский</option>
                  <option value="kk">Қазақша</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label>
                {t("duration")}
                <select
                  value={duration}
                  onChange={(e) => {
                    setDuration(+e.target.value);
                    setApproved(false);
                  }}
                >
                  {[30, 45, 60, 90].map((n) => (
                    <option key={n} value={n}>
                      {n} {t("seconds")}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              {t("voice")}
              <select
                value={voice}
                onChange={(e) => {
                  setVoice(e.target.value);
                  setApproved(false);
                }}
              >
                <option value="none">{t("voiceNone")}</option>
                {data.capabilities.speech && (
                  <option value="ai">{t("voiceAI")}</option>
                )}
              </select>
            </label>
            <p className="micro muted">{t("scriptHint")}</p>
            {locale !== c.locale && (
              <p className="info-note">{t("translationHint")}</p>
            )}
            <label>
              {t("script")}{" "}
              <span className="micro muted">({script.length}/1800 · ≤ 6)</span>
              <textarea
                rows={8}
                value={script}
                maxLength={1800}
                onChange={(e) => {
                  setScript(e.target.value);
                  setApproved(false);
                }}
              />
            </label>
            <p className="micro muted">
              {t("pilotHint")} {t("videoVersion")} · v{c.versions.length}.{" "}
              {voice === "ai" && t("aiVoice")}
            </p>
            <label className="consent">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              <span>{t("approveScript")}</span>
            </label>
            <button
              className="primary"
              disabled={!approved || script.trim().length < 20}
              onClick={() => {
                setFinal(false);
                setPreview(true);
              }}
            >
              <Play size={17} />
              {t("videoPreview")}
            </button>
          </>
        ) : (
          <div className="upgrade-box">
            <LockKeyhole size={30} />
            <h3>{t("videoPro")}</h3>
            <p>{t("demoPayment")}</p>
            <button className="primary" onClick={() => go("plans")}>
              <Sparkles size={16} />
              {t("activate")}
            </button>
          </div>
        ))}
      <h3 className="spaced">{t("media")}</h3>
      {items.length ? (
        items
          .slice()
          .reverse()
          .map((m) => (
            <div className="media-result" key={m.id}>
              <div className="row between">
                <strong>
                  v{m.version} · {m.locale.toUpperCase()}
                </strong>
                <span className={"badge " + m.status}>
                  {t(
                    m.status === "ready"
                      ? "readyVideo"
                      : m.status === "preview_ready"
                        ? "preview"
                        : m.status === "previewing"
                          ? "rendering"
                          : m.status === "queued_final"
                            ? "queued"
                            : m.status,
                  )}
                </span>
              </div>
              {m.version !== c.versions.length && (
                <p className="warning-text">{t("outdatedMedia")}</p>
              )}
              {m.status === "preview_ready" && own && (
                <>
                  <video controls preload="metadata" src={m.previewUrl}>
                    <track
                      kind="captions"
                      src={m.previewUrl.replace("preview.mp4", "final.vtt")}
                      srcLang={m.locale}
                      label={m.locale.toUpperCase()}
                      default
                    />
                  </video>
                  <button
                    className="primary"
                    onClick={async () => {
                      try {
                        await api("/media", {
                          id: m.id,
                          action: "finalize",
                          previewApproved: true,
                        });
                        await refresh();
                        notify(t("queued"));
                      } catch (e) {
                        onError(e);
                      }
                    }}
                  >
                    <Check size={16} />
                    {t("approvePilot")}
                  </button>
                </>
              )}
              {m.status === "failed" && own && (
                <button
                  className="soft-btn"
                  onClick={async () => {
                    try {
                      await api("/media", { id: m.id, action: "retry" });
                      await refresh();
                    } catch (e) {
                      onError(e);
                    }
                  }}
                >
                  {t("retry")}
                </button>
              )}
              {m.status === "ready" && (
                <>
                  <video controls preload="metadata" src={m.url}>
                    <track
                      kind="captions"
                      src={m.url.replace(".mp4", ".vtt")}
                      srcLang={m.locale}
                      label={m.locale.toUpperCase()}
                      default
                    />
                  </video>
                  <a className="soft-btn" href={m.url} download>
                    <Download size={16} />
                    {t("download")}
                  </a>
                </>
              )}
              {m.error && <p className="error-text">{m.error}</p>}
              {["rendering", "queued", "previewing", "queued_final"].includes(
                m.status,
              ) ? (
                <div className="render-progress">
                  <span />
                </div>
              ) : null}
            </div>
          ))
      ) : (
        <p className="muted">{t("noVideo")}</p>
      )}
      {preview && (
        <Modal wide title={t("videoPreview")} onClose={() => setPreview(false)}>
          <p>
            {c.fields.title} · v{c.versions.length} · {locale.toUpperCase()} ·{" "}
            {duration} {t("seconds")}
          </p>
          <div className="storyboard">
            {script
              .split(/\n\n+/)
              .filter(Boolean)
              .slice(0, 6)
              .map((s, i) => (
                <div key={i}>
                  <span>SCENE {String(i + 1).padStart(2, "0")}</span>
                  <h3>
                    {i === 0
                      ? c.fields.title
                      : t(["need", "users", "result", "success"][i % 4])}
                  </h3>
                  <p>{s}</p>
                  <small>
                    {Math.round(
                      (i * duration) /
                        Math.min(
                          script.split(/\n\n+/).filter(Boolean).length,
                          6,
                        ),
                    )}
                    s
                  </small>
                </div>
              ))}
          </div>
          <label className="consent">
            <input
              type="checkbox"
              checked={final}
              onChange={(e) => setFinal(e.target.checked)}
            />
            <span>{t("approveVideo")}</span>
          </label>
          <button
            className="primary"
            disabled={!final || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/media", {
                  challengeId: c.id,
                  version: c.versions.length,
                  script,
                  locale,
                  duration,
                  voice,
                  approved: true,
                  previewApproved: true,
                });
                await refresh();
                setPreview(false);
                notify(t("queued"));
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Film size={17} />
            {t("generateVideo")}
          </button>
        </Modal>
      )}
    </div>
  );
}
