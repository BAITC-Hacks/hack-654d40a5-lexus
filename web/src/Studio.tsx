import { LanguageWarning, useLanguageAudit, languageFor } from "./Language";
import { AttachmentEditor, AttachmentList } from "./Attachments";
import { CoverEditor } from "./Cover";
import { useState, useEffect, useRef } from "react";
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
  const [answerValues, setAnswerValues] = useState<string[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [reviewed, setReviewed] = useState<boolean[]>([]);
  const [attachmentIds, setAttachmentIds] = useState<string[]>(
    challenge?.attachmentIds || [],
  );
  const [languageAccepted, setLanguageAccepted] = useState(false);
  const [coverId, setCoverId] = useState(challenge?.coverId || "");
  const questionRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (stage === 1) questionRef.current?.focus();
  }, [stage, questionIndex]);
  const [questions, setQuestions] = useState<string[]>([]);
  const answers = questions
    .map((q, i) => q + "\n" + (answerValues[i] || t("skipQuestion")))
    .join("\n\n");
  const setAnswer = (value: string) =>
    setAnswerValues((prev) => {
      const next = [...prev];
      next[questionIndex] = value;
      return next;
    });
  const advance = () => {
    setReviewed((prev) => {
      const next = [...prev];
      next[questionIndex] = true;
      return next;
    });
    setQuestionIndex((i) => i + 1);
  };
  const [provider, setProvider] = useState("");
  const [category, setCategory] = useState(challenge?.category || "Retail");
  const locale: Lang = challenge?.locale || "ru";
  const sourceLanguage = useLanguageAudit(stage === 0 ? source : "", locale);
  const answerLanguage = useLanguageAudit(
    stage === 1 ? answerValues[questionIndex] || "" : "",
    locale,
  );
  const finalLanguage = useLanguageAudit(stage >= 2 ? f : "", locale);
  const fileWarning = data.attachments?.find(
    (file) =>
      attachmentIds.includes(file.id) &&
      languageFor(file.audit, locale).warning,
  )?.audit;
  const languageAudit = finalLanguage.audit?.warning
    ? finalLanguage.audit
    : fileWarning
      ? languageFor(fileWarning, locale)
      : undefined;
  useEffect(() => {
    setLanguageAccepted(false);
  }, [JSON.stringify(f), attachmentIds.join(",")]);
  const [busy, setBusy] = useState(false);
  const [previewApproved, setPreviewApproved] = useState(false);
  const [note, setNote] = useState("");
  const [aiApplied, setAiApplied] = useState(false);
  const own =
    data.user?.role === "business" && (!c || c.ownerId === data.user.id);
  const confirmed = (k: string) =>
    !!c?.approved[k] &&
    c.fields[k] === f[k] &&
    (k !== "data" ||
      JSON.stringify(attachmentIds) === JSON.stringify(c.attachmentIds || []));
  const baseScore = data.criteria.reduce(
    (sum, crit) =>
      sum +
      (crit.fields.every((k) => f[k]?.trim().length >= 3 && confirmed(k))
        ? crit.weight
        : 0),
    0,
  );
  const languagePenalty = languageAudit?.warning && languageAccepted ? 5 : 0;
  const score = Math.max(0, baseScore - languagePenalty);
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
        original: source,
        answers,
      });
    }
    const updated = await api<Challenge>("/challenges/" + current.id, {
      revision: current.revision,
      fields,
      confirm,
      coverId,
      attachmentIds,
      acceptLanguageMismatch: languageAccepted,
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
      if (!build) {
        setQuestions(result.questions);
        setAnswerValues([]);
        setReviewed([]);
        setQuestionIndex(0);
      }
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
      <div className={"studio-layout " + (stage < 2 ? "focused-studio" : "")}>
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
                <div className="language-note">
                  Язык задачи:{" "}
                  <strong>
                    {locale === "ru" ? "Русский" : locale.toUpperCase()}
                  </strong>
                </div>
              </div>
              <label>
                {t("need")}
                <textarea
                  className="idea-input"
                  aria-label={t("need")}
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
              <LanguageWarning
                audit={sourceLanguage.audit}
                accepted={sourceLanguage.accepted}
                onAccept={sourceLanguage.setAccepted}
              />
              <div className="studio-actions">
                <button
                  className="primary"
                  disabled={
                    busy ||
                    source.trim().length < 5 ||
                    sourceLanguage.blocked ||
                    sourceLanguage.checking
                  }
                  onClick={() => ask()}
                >
                  <Sparkles size={17} />
                  {t(busy ? "aiThinking" : "aiHelp")}
                </button>
                <button
                  className="text-btn"
                  disabled={
                    source.trim().length < 5 ||
                    busy ||
                    sourceLanguage.blocked ||
                    sourceLanguage.checking
                  }
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
                  disabled={
                    busy ||
                    source.trim().length < 5 ||
                    sourceLanguage.blocked ||
                    sourceLanguage.checking
                  }
                  onClick={() => ask(false, true)}
                >
                  {t("localHelp")}
                </button>
              )}
            </>
          )}
          {stage === 1 && (
            <div className="question-flow">
              <div className="question-progress-copy" aria-live="polite">
                <span>{t("clarify")}</span>
                <strong>
                  {questionIndex < questions.length
                    ? `${t("question")} ${questionIndex + 1} ${t("of")} ${questions.length}`
                    : t("questionsComplete")}
                </strong>
              </div>
              <progress
                className="question-progress"
                aria-label={t("clarify")}
                max={questions.length || 1}
                value={reviewed.filter(Boolean).length}
              />
              {questionIndex < questions.length ? (
                <>
                  <p className="muted question-intro">{t("questionHint")}</p>
                  <h2 id="current-question" className="current-question">
                    {questions[questionIndex]}
                  </h2>
                  <Listen
                    key={"listen" + questionIndex}
                    text={questions[questionIndex]}
                    t={t}
                    lang={locale}
                    live={data.capabilities.speech}
                    onError={onError}
                  />
                  <label className="spaced-label">
                    {t("answerLabel")}
                    <textarea
                      ref={questionRef}
                      rows={4}
                      maxLength={1000}
                      aria-labelledby="current-question"
                      value={answerValues[questionIndex] || ""}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder={t("answerHint")}
                      disabled={busy}
                    />
                  </label>
                  <AudioInput
                    key={questionIndex}
                    t={t}
                    lang={locale}
                    enabled={data.capabilities.speech}
                    onError={onError}
                    onText={(v) =>
                      setAnswer(
                        ((answerValues[questionIndex] || "") + " " + v).slice(
                          0,
                          1000,
                        ),
                      )
                    }
                  />
                  <LanguageWarning
                    audit={answerLanguage.audit}
                    accepted={answerLanguage.accepted}
                    onAccept={answerLanguage.setAccepted}
                  />
                  <div className="question-navigation">
                    <button
                      className="text-btn"
                      disabled={busy || questionIndex === 0}
                      onClick={() => setQuestionIndex((i) => i - 1)}
                    >
                      <ArrowLeft size={17} />
                      {t("back")}
                    </button>
                    <div className="row">
                      <button
                        className="text-btn"
                        disabled={busy}
                        onClick={() => {
                          setAnswer("");
                          advance();
                        }}
                      >
                        {t("skipQuestion")}
                      </button>
                      <button
                        className="primary"
                        disabled={
                          busy ||
                          !answerValues[questionIndex]?.trim() ||
                          answerLanguage.blocked ||
                          answerLanguage.checking
                        }
                        onClick={advance}
                      >
                        {t(
                          questionIndex === questions.length - 1
                            ? "reviewAnswers"
                            : "nextQuestion",
                        )}
                        <ArrowRight size={17} />
                      </button>
                    </div>
                  </div>
                  <p className="question-save-note">
                    {t("answersSaved")} · {questions.length - questionIndex - 1}{" "}
                    {t("remaining")}
                  </p>
                </>
              ) : (
                <>
                  <div className="question-complete-icon">
                    <CheckCircle2 size={30} />
                  </div>
                  <h2>{t("questionsComplete")}</h2>
                  <p className="muted">{t("aiReview")}</p>
                  <div className="answer-review">
                    {questions.map((q, i) => (
                      <div key={i}>
                        <div>
                          <strong>{q}</strong>
                          <p>{answerValues[i] || t("skipQuestion")}</p>
                        </div>
                        <button
                          className="text-btn"
                          onClick={() => setQuestionIndex(i)}
                        >
                          {t("edit")}
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="studio-actions">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => ask(true, provider === "local")}
                    >
                      <Sparkles size={17} />
                      {t(busy ? "aiThinking" : "makeBrief")}
                    </button>
                    <button
                      className="text-btn"
                      disabled={busy}
                      onClick={() => setQuestionIndex(questions.length - 1)}
                    >
                      <ArrowLeft size={16} />
                      {t("back")}
                    </button>
                  </div>
                </>
              )}
            </div>
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
              <CoverEditor
                coverId={coverId}
                fields={f}
                data={data}
                t={t}
                onChange={(id) => {
                  setCoverId(id);
                  setPreviewApproved(false);
                }}
              />
              {answerValues.some((v) => v?.trim()) && (
                <details className="answer-notes">
                  <summary>Ваши ответы на уточняющие вопросы</summary>
                  {questions.map(
                    (q, i) =>
                      answerValues[i]?.trim() && (
                        <div key={i}>
                          <strong>{q}</strong>
                          <p>{answerValues[i]}</p>
                        </div>
                      ),
                  )}
                </details>
              )}
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
                      aria-label={t(k)}
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
              {group === 1 && (
                <AttachmentEditor
                  ids={attachmentIds}
                  data={data}
                  locale={locale}
                  onChange={(ids) => {
                    setAttachmentIds(ids);
                    setPreviewApproved(false);
                  }}
                  refresh={refresh}
                />
              )}
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
                {coverId && (
                  <img
                    className="brief-cover"
                    src={"/covers/" + coverId + ".jpg"}
                    alt={t("cover")}
                  />
                )}
                <div className="row between">
                  <span className="eyebrow">
                    {c?.company || data.user?.name}
                  </span>
                  <Badge score={score} t={t} />
                </div>
                <h2>{f.title}</h2>
                <AttachmentList ids={attachmentIds} data={data} />
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
              <LanguageWarning
                audit={languageAudit}
                accepted={languageAccepted}
                onAccept={(v) => {
                  setLanguageAccepted(v);
                  setPreviewApproved(false);
                }}
                penalty
              />
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
                  disabled={
                    !previewApproved ||
                    !confirmed("need") ||
                    busy ||
                    finalLanguage.checking ||
                    (!!languageAudit?.warning && !languageAccepted)
                  }
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
        {stage >= 2 && (
          <aside className="score-panel">
            <div className="score-panel-inner">
              <span className="eyebrow">{t("readiness")}</span>
              <div className="score-big" aria-live="polite" aria-atomic="true">
                {score}
                <span>/100</span>
              </div>
              <Badge score={score} t={t} />
              <Meter score={score} />
              <p>{t("scoreHint")}</p>
              {languageAudit?.warning && (
                <div className="language-score">
                  <span>Подтверждённые разделы</span>
                  <strong>{baseScore}</strong>
                  <span>
                    Язык материалов
                    {languageAccepted ? "" : " · ожидает решения"}
                  </span>
                  <strong>{languageAccepted ? "−5" : "0"}</strong>
                </div>
              )}
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
        )}
      </div>
    </>
  );
}
