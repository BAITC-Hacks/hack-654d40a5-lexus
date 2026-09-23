import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Sparkles,
  Save,
  Send,
  Eye,
  Flag,
  ChevronRight,
  FileText,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  fieldKeys,
  type Challenge,
  type Data,
  type Fields,
  type Lang,
} from "./types";
import type { T } from "./i18n";
import { AudioInput, Badge, Empty, Listen, Meter } from "./components";
export type Common = {
  data: Data;
  t: T;
  lang: Lang;
  refresh: () => Promise<void>;
  onError: (e: unknown) => void;
  go: (s: string) => void;
  notify: (s: string) => void;
};
const groups = [
  ["context", "need"],
  ["users", "data"],
  ["result", "success"],
  ["constraints", "contact", "interaction"],
];
export function Studio({
  challenge,
  data,
  t,
  lang,
  refresh,
  onError,
  go,
  notify,
  onLogin,
}: Common & { challenge?: Challenge; onLogin: () => void }) {
  const [c, setC] = useState(challenge);
  const [f, setF] = useState<Fields>(
    challenge?.fields || { title: "", need: "" },
  );
  const [stage, setStage] = useState(challenge ? 2 : 0);
  const [group, setGroup] = useState(0);
  const [source, setSource] = useState(challenge?.fields.need || "");
  const [answers, setAnswers] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [provider, setProvider] = useState("");
  const [category, setCategory] = useState(challenge?.category || "Retail");
  const [locale, setLocale] = useState<Lang>(challenge?.locale || lang);
  const [busy, setBusy] = useState(false);
  const [previewApproved, setPreviewApproved] = useState(false);
  const [note, setNote] = useState("");
  const [aiApplied, setAiApplied] = useState(false);
  const own =
    data.user?.role === "business" && (!c || c.ownerId === data.user.id);
  const confirmed = (k: string) => !!c?.approved[k] && c.fields[k] === f[k];
  const score = data.criteria.reduce(
    (sum, crit) =>
      sum +
      (crit.fields.every((k) => f[k]?.trim().length >= 3 && confirmed(k))
        ? crit.weight
        : 0),
    0,
  );
  function setField(k: string, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
    setPreviewApproved(false);
  }
  async function save(confirm: string[] = []) {
    const fields = {
      ...f,
      title: f.title.trim() || source.slice(0, 80) || t("newQuest"),
      need: f.need || source,
    };
    let current = c;
    if (!current) {
      current = await api<Challenge>("/challenges", {
        fields,
        category,
        locale,
      });
    }
    const updated = await api<Challenge>("/challenges/" + current.id, {
      revision: current.revision,
      fields,
      confirm,
      source: aiApplied ? "ai" : "manual",
    });
    setAiApplied(false);
    setC(updated);
    setF(updated.fields);
    await refresh();
    return updated;
  }
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  async function ask(build = false, local = false) {
    await action(async () => {
      const input = build ? source + "\n\n" + answers : source;
      const result = await api<{
        fields: Fields;
        questions: string[];
        provider: string;
      }>("/ai", { source: input, locale, local });
      setQuestions(result.questions);
      setProvider(result.provider);
      if (result.provider === "openai") {
        setF((prev) => ({
          ...prev,
          ...result.fields,
          title: result.fields.title || prev.title || source.slice(0, 80),
        }));
        setAiApplied(true);
      } else {
        setF((prev) => ({
          ...prev,
          title: prev.title || source.slice(0, 80),
          need: source,
        }));
      }
      setStage(build ? 2 : 1);
    });
  }
  if (!own)
    return (
      <Empty text={t("needLogin")}>
        <button className="primary" onClick={onLogin}>
          {t("switchRole")}
        </button>
      </Empty>
    );
  return (
    <>
      <button
        className="text-btn back-link"
        onClick={() => go(c?.published ? "quest/" + c.id : "workspace")}
      >
        <ArrowLeft size={17} />
        {t("back")}
      </button>
      <div className="page-heading studio-heading">
        <span className="eyebrow">BUILD SOMETHING THAT MATTERS</span>
        <h1>{t("studio")}</h1>
        <p>{t("studioSub")}</p>
      </div>
      <div className="stepper">
        {["idea", "clarify", "card", "preview"].map((s, i) => (
          <button
            key={s}
            className={stage === i ? "current" : stage > i ? "done" : ""}
            disabled={busy || i > stage}
            onClick={() => setStage(i)}
          >
            <span>{stage > i ? <Check size={15} /> : i + 1}</span>
            {t(s)}
            {i < 3 && <ChevronRight size={15} />}
          </button>
        ))}
      </div>
      <div className="studio-layout">
        <section className="studio-panel">
          {stage === 0 && (
            <>
              <div className="panel-title">
                <span className="stat-icon yellow">
                  <Lightbulb size={22} />
                </span>
                <div>
                  <h2>{t("original")}</h2>
                  <p>{t("studioSub")}</p>
                </div>
              </div>
              <div className="row">
                <label>
                  {t("category")}
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={!!c}
                  >
                    {[
                      "Retail",
                      "Social",
                      "Education",
                      "Analytics",
                      "Ecology",
                      "Technology",
                    ].map((k) => (
                      <option key={k} value={k}>
                        {t(k)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("contentLanguage")}
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as Lang)}
                    disabled={!!c}
                  >
                    <option value="ru">Русский</option>
                    <option value="kk">Қазақша</option>
                    <option value="en">English</option>
                  </select>
                </label>
              </div>
              <label>
                {t("need")}
                <textarea
                  className="idea-input"
                  rows={7}
                  value={source}
                  onChange={(e) => {
                    setSource(e.target.value);
                    setField("need", e.target.value);
                  }}
                  placeholder={t("ideaPlaceholder")}
                  maxLength={5000}
                />
              </label>
              <AudioInput
                t={t}
                lang={locale}
                enabled={data.capabilities.speech}
                onError={(s) => onError(s)}
                onText={(s) => {
                  setSource((v) => v + " " + s);
                  setField("need", source + " " + s);
                }}
              />
              <div className="studio-actions">
                <button
                  className="primary"
                  disabled={busy || source.trim().length < 5}
                  onClick={() => ask()}
                >
                  <Sparkles size={17} />
                  {t(busy ? "aiThinking" : "aiHelp")}
                </button>
                <button
                  className="text-btn"
                  disabled={source.trim().length < 5 || busy}
                  onClick={() => {
                    setF({
                      ...f,
                      need: source,
                      title: f.title || source.slice(0, 80),
                    });
                    setStage(2);
                  }}
                >
                  {t("quickPublish")}
                  <ArrowRight size={16} />
                </button>
              </div>
              {data.capabilities.ai && (
                <button
                  className="text-btn micro"
                  disabled={busy || source.trim().length < 5}
                  onClick={() => ask(false, true)}
                >
                  {t("localHelp")}
                </button>
              )}
            </>
          )}
          {stage === 1 && (
            <>
              <div className="panel-title">
                <span className="stat-icon lavender">
                  <Sparkles size={22} />
                </span>
                <div>
                  <h2>{t("clarify")}</h2>
                  <p>
                    {t(provider === "openai" ? "aiProvider" : "localProvider")}
                  </p>
                </div>
              </div>
              <div className="question-list">
                {questions.map((q, i) => (
                  <div key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <p>{q}</p>
                  </div>
                ))}
              </div>
              <Listen
                text={questions.join(". ")}
                t={t}
                lang={locale}
                live={data.capabilities.speech}
                onError={onError}
              />
              <label className="spaced-label">
                {t("answers")}
                <textarea
                  rows={7}
                  value={answers}
                  onChange={(e) => setAnswers(e.target.value)}
                  placeholder={t("answersPlaceholder")}
                />
              </label>
              <AudioInput
                t={t}
                lang={locale}
                enabled={data.capabilities.speech}
                onError={onError}
                onText={(s) => setAnswers((v) => v + " " + s)}
              />
              <div className="studio-actions">
                <button
                  className="primary"
                  onClick={() => ask(true)}
                  disabled={busy}
                >
                  <Sparkles size={17} />
                  {t(busy ? "aiThinking" : "buildCard")}
                </button>
                <button
                  className="text-btn"
                  onClick={() => setStage(2)}
                  disabled={busy}
                >
                  {t("next")}
                  <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
          {stage === 2 && (
            <>
              <div className="panel-title">
                <span className="stat-icon mint">
                  <FileText size={22} />
                </span>
                <div>
                  <h2>{t("card")}</h2>
                  <p>{t("aiReview")}</p>
                </div>
              </div>
              <label>
                {t("title")}
                <input
                  value={f.title || ""}
                  maxLength={160}
                  onChange={(e) => setField("title", e.target.value)}
                />
              </label>
              <div className="group-tabs">
                {groups.map((keys, i) => (
                  <button
                    key={i}
                    className={group === i ? "selected" : ""}
                    onClick={() => setGroup(i)}
                  >
                    {keys.every(confirmed) ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                    {t("step" + (i + 1))}
                  </button>
                ))}
              </div>
              {groups[group].map((k) => (
                <div className="field-wrap" key={k}>
                  <label>
                    <span className="row between">
                      <strong>{t(k)}</strong>
                      {confirmed(k) && (
                        <span className="confirmed-label">
                          <Check size={13} />
                          {t("confirmed")}
                        </span>
                      )}
                    </span>
                    <textarea
                      rows={k === "context" || k === "need" ? 4 : 3}
                      value={f[k] || ""}
                      onChange={(e) => setField(k, e.target.value)}
                      placeholder={t("empty")}
                      maxLength={5000}
                    />
                  </label>
                  <AudioInput
                    t={t}
                    lang={locale}
                    enabled={data.capabilities.speech}
                    onError={onError}
                    onText={(s) => setField(k, (f[k] || "") + " " + s)}
                  />
                </div>
              ))}
              <div className="studio-actions">
                <button
                  className="primary"
                  disabled={busy || !groups[group].some((k) => f[k]?.trim())}
                  onClick={() =>
                    action(async () => {
                      await save(groups[group]);
                      notify(t("confirmed"));
                      if (group < 3) setGroup(group + 1);
                    })
                  }
                >
                  <Check size={17} />
                  {t("confirmGroup")}
                </button>
                <button
                  className="soft-btn"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await save();
                      notify(t("saved"));
                    })
                  }
                >
                  <Save size={16} />
                  {t("save")}
                </button>
              </div>
              <div className="studio-next">
                <button
                  className="text-btn"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      await save();
                      setStage(3);
                    })
                  }
                >
                  {t("preview")}
                  <Eye size={16} />
                </button>
              </div>
            </>
          )}
          {stage === 3 && (
            <>
              <div className="panel-title">
                <span className="stat-icon peach">
                  <Eye size={22} />
                </span>
                <div>
                  <h2>{t("preview")}</h2>
                  <p>{t("previewHint")}</p>
                </div>
              </div>
              <div className="preview-paper">
                <div className="row between">
                  <span className="eyebrow">
                    {c?.company || data.user?.name}
                  </span>
                  <Badge score={score} t={t} />
                </div>
                <h2>{f.title}</h2>
                {fieldKeys
                  .filter((k) => k !== "title")
                  .map((k) => (
                    <div className="brief-section" key={k}>
                      <h4>
                        {t(k)} {confirmed(k) && <CheckCircle2 size={14} />}
                      </h4>
                      <p className={!f[k] ? "muted" : ""}>
                        {f[k] || t("empty")}
                      </p>
                    </div>
                  ))}
              </div>
              <Listen
                text={fieldKeys
                  .map((k) => f[k])
                  .filter(Boolean)
                  .join(". ")}
                t={t}
                lang={locale}
                live={data.capabilities.speech}
                onError={onError}
              />
              {c?.published && (
                <label className="spaced-label">
                  {t("versionNote")}
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t("versionNotePlaceholder")}
                  />
                </label>
              )}
              <label className="consent">
                <input
                  type="checkbox"
                  checked={previewApproved}
                  onChange={(e) => setPreviewApproved(e.target.checked)}
                />
                <span>{t("approvePreview")}</span>
              </label>
              {!confirmed("need") && (
                <p className="warning-text">{t("confirmNeed")}</p>
              )}
              <div className="studio-actions">
                <button
                  className="primary"
                  disabled={!previewApproved || !confirmed("need") || busy}
                  onClick={() =>
                    action(async () => {
                      const cur = await save();
                      await api("/challenges/" + cur.id + "/publish", {
                        revision: cur.revision,
                        previewApproved: true,
                        note,
                      });
                      await refresh();
                      notify(t("published"));
                      go("quest/" + cur.id);
                    })
                  }
                >
                  <Send size={17} />
                  {t(c?.published ? "publishUpdate" : "publish")}
                </button>
                <button className="secondary" onClick={() => setStage(2)}>
                  {t("edit")}
                </button>
              </div>
            </>
          )}
        </section>
        <aside className="score-panel">
          <div className="score-panel-inner">
            <span className="eyebrow">QUEST READINESS</span>
            <div className="score-big" aria-live="polite" aria-atomic="true">
              {score}
              <span>/100</span>
            </div>
            <Badge score={score} t={t} />
            <Meter score={score} />
            <p>{t("scoreHint")}</p>
            <div className="score-criteria">
              {data.criteria.map((cr) => {
                const yes = cr.fields.every(
                  (k) => confirmed(k) && f[k]?.trim().length >= 3,
                );
                return (
                  <div key={cr.id} className={yes ? "earned" : ""}>
                    <span>
                      {yes ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <span className="empty-circle" />
                      )}
                      {t(
                        cr.id === "context"
                          ? "step1"
                          : cr.id === "contact"
                            ? "contact"
                            : cr.id,
                      )}
                    </span>
                    <strong>
                      {yes ? cr.weight : 0}
                      <small>/{cr.weight}</small>
                    </strong>
                  </div>
                );
              })}
            </div>
            <div className="score-tip">
              <ShieldCheck size={20} />
              <span>{t(score < 40 ? "lowNote" : "noPayToWin")}</span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
