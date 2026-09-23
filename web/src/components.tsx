import { responseJSON } from "./http-errors";
import { AttachmentList } from "./Attachments";
import { LanguageWarning, useLanguageAudit } from "./Language";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  X,
  Mic,
  Upload,
  Volume2,
  Square,
  LoaderCircle,
  Check,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api, type Lang, type Challenge, type Data } from "./types";
import type { T } from "./i18n";
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close / Закрыть / Жабу"
        >
          <X size={22} />
        </button>
      </header>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function Badge({ score, t }: { score: number; t: T }) {
  const k =
    score >= 90
      ? "priority"
      : score >= 70
        ? "ready"
        : score >= 40
          ? "working"
          : "draft";
  return (
    <span className={"badge " + k}>
      {score >= 90 ? (
        <Sparkles size={13} />
      ) : score >= 70 ? (
        <ShieldCheck size={13} />
      ) : (
        <span className="status-dot" />
      )}
      {t(k)}
    </span>
  );
}
export function Meter({ score }: { score: number }) {
  return (
    <div
      className="meter"
      role="meter"
      aria-label="Readiness / Готовность / Дайындық"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: score + "%" }} />
    </div>
  );
}
export function Empty({
  text,
  children,
}: {
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span>✧</span>
      <h3>{text}</h3>
      {children}
    </div>
  );
}
export function AudioInput({
  t,
  lang,
  onText,
  onError,
  enabled,
}: {
  t: T;
  lang: Lang;
  onText: (s: string) => void;
  onError: (s: string) => void;
  enabled: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const transcriptLanguage = useLanguageAudit(transcript || "", lang);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function upload(file: Blob, name: string) {
    if (file.size > 20 * 1024 * 1024) {
      onError(t("audioLimit"));
      return;
    }
    setBusy(true);
    try {
      const f = new FormData();
      f.append("audio", file, name);
      f.append("locale", lang);
      const r = await fetch("/api/transcribe", { method: "POST", body: f });
      const d = await responseJSON(r);
      setTranscript(d.text);
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function record() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      if (!navigator.mediaDevices || typeof MediaRecorder === "undefined")
        throw new Error(
          "Microphone recording is unavailable. Upload an audio file.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream.current);
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => {
        setRecording(false);
        stream.current?.getTracks().forEach((t) => t.stop());
        void upload(
          new Blob(chunks, { type: rec.mimeType }),
          rec.mimeType.includes("mp4") ? "recording.m4a" : "recording.webm",
        );
      };
      rec.start();
      setRecording(true);
      setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 120000);
    } catch (e) {
      onError(String(e));
    }
  }
  return (
    <>
      <div className="audio-tools">
        <button
          type="button"
          className={"soft-btn " + (recording ? "recording" : "")}
          onClick={record}
          disabled={!enabled || busy}
        >
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : recording ? (
            <Square size={16} />
          ) : (
            <Mic size={16} />
          )}{" "}
          {t(busy ? "transcribing" : recording ? "stopRecord" : "record")}
        </button>
        <button
          type="button"
          className="text-btn"
          disabled={!enabled || busy || recording}
          onClick={() => input.current?.click()}
        >
          <Upload size={16} />
          {t("upload")}
        </button>
        <input
          ref={input}
          type="file"
          accept="audio/*,.webm,.m4a,.mp4"
          hidden
          onChange={(e) => {
            if (e.target.files?.[0])
              void upload(e.target.files[0], e.target.files[0].name);
            e.target.value = "";
          }}
        />
      </div>
      <p className="micro muted">
        {t(enabled ? "audioNotice" : "speechUnavailable")}
      </p>
      {transcript !== null && (
        <Modal title={t("transcript")} onClose={() => setTranscript(null)}>
          <label>
            {t("transcript")}
            <textarea
              rows={7}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </label>
          <LanguageWarning
            audit={transcriptLanguage.audit}
            accepted={transcriptLanguage.accepted}
            onAccept={transcriptLanguage.setAccepted}
          />
          <button
            className="primary"
            disabled={transcriptLanguage.blocked || transcriptLanguage.checking}
            onClick={() => {
              onText(transcript);
              setTranscript(null);
            }}
          >
            <Check size={16} />
            {t("useTranscript")}
          </button>
        </Modal>
      )}
    </>
  );
}
export function Listen({
  text,
  t,
  lang,
  live,
  onError,
}: {
  text: string;
  t: T;
  lang: Lang;
  live: boolean;
  onError: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const obj = useRef("");
  function stop() {
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    setPlaying(false);
  }
  useEffect(
    () => () => {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
      if (obj.current) URL.revokeObjectURL(obj.current);
    },
    [],
  );
  async function play() {
    if (playing) {
      stop();
      return;
    }
    if (!text.trim()) return;
    setBusy(true);
    try {
      if (live) {
        const r = await fetch("/api/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 3900), locale: lang }),
        });
        if (!r.ok) {
          await responseJSON(r);
        }
        if (obj.current) URL.revokeObjectURL(obj.current);
        obj.current = URL.createObjectURL(await r.blob());
        audio.current = new Audio(obj.current);
        audio.current.onended = () => setPlaying(false);
        await audio.current.play();
        setPlaying(true);
      } else {
        if (!window.speechSynthesis) throw new Error(t("speechUnavailable"));
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = { ru: "ru-RU", kk: "kk-KZ", en: "en-US" }[lang];
        utterance.onend = () => setPlaying(false);
        utterance.onerror = () => {
          setPlaying(false);
          onError(t("speechBrowser"));
        };
        speechSynthesis.speak(utterance);
        setPlaying(true);
      }
    } catch (e) {
      onError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      className="soft-btn"
      onClick={play}
      disabled={busy}
      title={t(live ? "aiVoice" : "speechBrowser")}
    >
      {busy ? (
        <LoaderCircle className="spin" size={16} />
      ) : playing ? (
        <Square size={16} />
      ) : (
        <Volume2 size={16} />
      )}{" "}
      {t(playing ? "stop" : "listen")}
    </button>
  );
}
export function Diff({
  challenge,
  t,
  data,
}: {
  challenge: Challenge;
  t: T;
  data?: Data;
}) {
  const [a, setA] = useState(Math.max(1, challenge.versions.length - 1));
  const [b, setB] = useState(challenge.versions.length);
  const va = challenge.versions.find((v) => v.number === a),
    vb = challenge.versions.find((v) => v.number === b);
  return (
    <>
      <div className="row">
        <label>
          {t("before")}
          <select value={a} onChange={(e) => setA(+e.target.value)}>
            {challenge.versions.map((v) => (
              <option key={v.number} value={v.number}>
                v{v.number} · {v.score}/100
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("after")}
          <select value={b} onChange={(e) => setB(+e.target.value)}>
            {challenge.versions.map((v) => (
              <option key={v.number} value={v.number}>
                v{v.number} · {v.score}/100
              </option>
            ))}
          </select>
        </label>
      </div>
      {Object.keys(vb?.fields || {}).map((k) => {
        const old = va?.fields[k],
          next = vb?.fields[k];
        if (old === next && a !== b) return null;
        return (
          <div className="diff-field" key={k}>
            <h4>{t(k)}</h4>
            <div className="diff-grid">
              <p className="removed">{old || t("empty")}</p>
              <p className="added">{next || t("empty")}</p>
            </div>
          </div>
        );
      })}
      {data &&
        JSON.stringify(va?.attachmentIds || []) !==
          JSON.stringify(vb?.attachmentIds || []) && (
          <div className="diff-field">
            <h4>Файлы и материалы</h4>
            <div className="diff-grid">
              <div>
                <AttachmentList ids={va?.attachmentIds} data={data} />
                {!va?.attachmentIds?.length && <p>Без вложений</p>}
              </div>
              <div>
                <AttachmentList ids={vb?.attachmentIds} data={data} />
                {!vb?.attachmentIds?.length && <p>Без вложений</p>}
              </div>
            </div>
          </div>
        )}
      {va?.coverId !== vb?.coverId && (
        <div className="diff-field">
          <h4>Обложка</h4>
          <div className="diff-grid">
            <div>
              {va?.coverId ? (
                <img
                  className="brief-cover"
                  src={"/covers/" + va.coverId + ".jpg"}
                  alt="Предыдущая обложка"
                />
              ) : (
                <p>Без обложки</p>
              )}
            </div>
            <div>
              {vb?.coverId ? (
                <img
                  className="brief-cover"
                  src={"/covers/" + vb.coverId + ".jpg"}
                  alt="Новая обложка"
                />
              ) : (
                <p>Без обложки</p>
              )}
            </div>
          </div>
        </div>
      )}
      {(va?.languagePenalty || 0) !== (vb?.languagePenalty || 0) && (
        <div className="diff-field">
          <h4>Поправка за язык материалов</h4>
          <div className="diff-grid">
            <p>−{va?.languagePenalty || 0}</p>
            <p>−{vb?.languagePenalty || 0}</p>
          </div>
        </div>
      )}
      {a === b && <p className="muted">{t("unchanged")}</p>}
    </>
  );
}

export function ChangeAdvisor({
  challenge,
  lang,
  t,
}: {
  challenge: Challenge;
  lang: Lang;
  t: T;
}) {
  const [advice, setAdvice] = useState<{
    summary: string;
    actions: string[];
    fields: string[];
    provider: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setAdvice(null);
    api("/changes", {
      challengeId: challenge.id,
      version: challenge.versions.length,
      locale: lang,
    })
      .then((d) => {
        if (active) setAdvice(d);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [challenge.id, challenge.versions.length, lang]);
  if (failed) return <p className="muted">{t("aiUnavailableDiff")}</p>;
  return (
    <section className="change-advisor">
      <div className="row">
        <Sparkles size={18} />
        <strong>
          {t(
            advice?.provider === "local" ? "changeChecklist" : "aiChangeAdvice",
          )}
        </strong>
      </div>
      {advice ? (
        <>
          <p>{advice.summary}</p>
          <div className="chips">
            {advice.fields.map((f) => (
              <span key={f}>{t(f)}</span>
            ))}
          </div>
          <ul>
            {advice.actions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <small>{t("adviceConsent")}</small>
        </>
      ) : (
        <p role="status">{t("aiThinking")}</p>
      )}
    </section>
  );
}
