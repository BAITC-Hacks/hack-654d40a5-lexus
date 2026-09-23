import { AttachmentEditor, AttachmentList } from "./Attachments";
import { LanguageWarning, useLanguageAudit, languageFor } from "./Language";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Edit3,
  History,
  Send,
  Star,
  Users,
  Flag,
  Download,
  Film,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
  MessageSquare,
} from "lucide-react";
import { api, fieldKeys, type Challenge, type Proposal } from "./types";
import type { Common } from "./Studio";
import {
  AudioInput,
  Badge,
  Diff,
  Empty,
  Listen,
  Meter,
  Modal,
} from "./components";
import { MediaStudio } from "./Video";
export function QuestDetail({
  challenge: c,
  data,
  t,
  lang,
  refresh,
  onError,
  go,
  notify,
  onLogin,
}: Common & { challenge: Challenge; onLogin: () => void }) {
  const [tab, setTab] = useState("brief");
  const [proposal, setProposal] = useState(false);
  const [history, setHistory] = useState(false);
  const [form, setForm] = useState({
    idea: "",
    plan: "",
    deadline: "",
    link: "",
  });
  const [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const proposalLanguage = useLanguageAudit(
    proposal ? form.idea + "\n" + form.plan : "",
    c.locale,
  );
  const fileAudit = data.attachments?.find(
    (f) => attachmentIds.includes(f.id) && languageFor(f.audit, "ru").warning,
  )?.audit;
  const proposalAudit = proposalLanguage.audit?.warning
    ? proposalLanguage.audit
    : fileAudit
      ? languageFor(fileAudit, "ru")
      : undefined;
  const [busy, setBusy] = useState(false);
  const own = c.ownerId === data.user?.id;
  const latest = c.versions.at(-1);
  const f = latest?.fields || c.fields;
  const score = latest?.score ?? c.score;
  const ps = data.proposals.filter((p) => p.challengeId === c.id);
  const common = { data, t, lang, refresh, onError, go, notify };
  const publicView = { ...c, fields: f, score };
  function download() {
    const text =
      "# " +
      f.title +
      "\n\n" +
      t("version") +
      " " +
      (latest?.number || 0) +
      "\n\n" +
      fieldKeys
        .filter((k) => k !== "title")
        .map((k) => "## " + t(k) + "\n" + (f[k] || t("empty")))
        .join("\n\n");
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "sana-quest-v" + latest?.number + ".md";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <button className="text-btn back-link" onClick={() => go("catalog")}>
        <ArrowLeft size={17} />
        {t("catalog")}
      </button>
      <div className="detail-heading">
        <div className="row">
          <span className="company-icon peach">
            {c.category === "Retail" ? "☕" : "✦"}
          </span>
          <span className="company-name">{c.company}</span>
          <Badge score={score} t={t} />
        </div>
        <h1>{f.title}</h1>
        <div className="chips">
          <span>{t(c.category)}</span>
          <span>{c.locale.toUpperCase()}</span>
          <span>
            {t("version")} {latest?.number || 0}
          </span>
          {own && <span>{t("owner")}</span>}
        </div>
      </div>
      <div className="detail-layout">
        <section>
          <div className="detail-tabs">
            {[
              ["brief", "card", Flag],
              ["proposals", "proposals", MessageSquare],
              ["media", "media", Film],
              ["activity", "activity", History],
            ].map(([key, label, Icon]) => (
              <button
                key={key as string}
                onClick={() => setTab(key as string)}
                className={tab === key ? "selected" : ""}
              >
                {typeof Icon !== "string" && <Icon size={17} />}{" "}
                {t(label as string)}
                {key === "proposals" && <span>{ps.length}</span>}
              </button>
            ))}
          </div>
          {tab === "brief" && (
            <div className="detail-paper">
              {(latest?.coverId || (!latest && c.coverId)) && (
                <img
                  className="brief-cover"
                  src={"/covers/" + (latest?.coverId || c.coverId) + ".jpg"}
                  alt={t("cover")}
                />
              )}
              <AttachmentList
                ids={latest?.attachmentIds || c.attachmentIds}
                data={data}
              />
              {!!latest?.languagePenalty && (
                <p className="language-public-note">
                  Язык материала отличается от языка задачи. Заказчик подтвердил
                  публикацию. Поправка к готовности: −{latest.languagePenalty}.
                </p>
              )}
              {score < 40 && (
                <div className="info-note">
                  <Flag size={20} />
                  <p>{t("lowNote")}</p>
                </div>
              )}
              <div className="row between">
                <p className="micro muted">
                  {t("sourceLanguage")} · {c.locale.toUpperCase()}
                </p>
                <Listen
                  text={fieldKeys
                    .map((k) => f[k])
                    .filter(Boolean)
                    .join(". ")}
                  t={t}
                  lang={c.locale}
                  live={data.capabilities.speech && !!data.user}
                  onError={onError}
                />
              </div>
              {fieldKeys
                .filter((k) => k !== "title")
                .map((k) => (
                  <div className="brief-section" key={k}>
                    <h3>
                      {t(k)}
                      {latest?.approved[k] && <CheckCircle2 size={15} />}
                    </h3>
                    <p className={!f[k] ? "muted" : ""}>{f[k] || t("empty")}</p>
                  </div>
                ))}
            </div>
          )}
          {tab === "proposals" && (
            <div className="proposal-section">
              <p className="muted">{t("manualChoice")}</p>
              {ps.length ? (
                ps.map((p) => <ProposalCard key={p.id} p={p} {...common} />)
              ) : (
                <Empty text={t("noProposals")} />
              )}
            </div>
          )}
          {tab === "media" && (
            <MediaStudio challenge={publicView} {...common} />
          )}{" "}
          {tab === "activity" && (
            <div className="detail-paper">
              {(latest?.coverId || (!latest && c.coverId)) && (
                <img
                  className="brief-cover"
                  src={"/covers/" + (latest?.coverId || c.coverId) + ".jpg"}
                  alt={t("cover")}
                />
              )}
              <div className="row between">
                <h2>{t("history")}</h2>
                {c.versions.length > 0 && (
                  <button className="soft-btn" onClick={() => setHistory(true)}>
                    <History size={16} />
                    {t("before")} / {t("after")}
                  </button>
                )}
              </div>
              <div className="timeline">
                {c.versions
                  .slice()
                  .reverse()
                  .map((v) => (
                    <div className="timeline-item" key={v.number}>
                      <span className="timeline-dot" />
                      <div className="row between">
                        <h3>
                          v{v.number} · {t("publishedEvent")}
                        </h3>
                        <strong>{v.score}/100</strong>
                      </div>
                      <p>{v.note || v.fields.title}</p>
                      <time>{new Date(v.at).toLocaleString(lang)}</time>
                    </div>
                  ))}
                {c.activity
                  ?.slice()
                  .reverse()
                  .filter((a) => a.kind !== "published")
                  .map((a, i) => (
                    <div className="timeline-item" key={"a" + i}>
                      <span className="timeline-dot muted-dot" />
                      <h4>
                        {t(a.kind === "confirmed" ? "confirmedEvent" : a.kind)}
                      </h4>
                      {a.kind === "ai_applied" ? (
                        <AIActivity detail={a.detail} t={t} />
                      ) : (
                        <p>{a.detail}</p>
                      )}
                      <time>{new Date(a.at).toLocaleString(lang)}</time>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
        <aside className="detail-sidebar">
          <div className="score-panel-inner">
            <span className="eyebrow">{t("readiness")}</span>
            <div className="score-big">
              {score}
              <span>/100</span>
            </div>
            <Meter score={score} />
            <p>{t("scoreHint")}</p>
            <div className="score-criteria">
              {data.criteria.map((cr) => (
                <div key={cr.id}>
                  <span>{t(cr.id === "context" ? "step1" : cr.id)}</span>
                  <strong>
                    {cr.fields.every(
                      (k) => !!latest?.approved[k] && f[k]?.trim().length >= 3,
                    )
                      ? cr.weight
                      : 0}
                    <small>/{cr.weight}</small>
                  </strong>
                </div>
              ))}
            </div>
            {own ? (
              <button
                className="primary full"
                onClick={() => go("edit/" + c.id)}
              >
                <Edit3 size={17} />
                {t("edit")}
              </button>
            ) : (
              <button
                className="primary full"
                onClick={() => {
                  if (data.user?.role === "student") setProposal(true);
                  else onLogin();
                }}
              >
                <Send size={17} />
                {t("respond")}
              </button>
            )}
            <button className="secondary full" onClick={download}>
              <Download size={17} />
              {t("export")}
            </button>
            <button className="text-btn full" onClick={() => setHistory(true)}>
              <History size={16} />
              {t("history")}
            </button>
          </div>
          <div className="fair-card">
            <ShieldCheck size={22} />
            <h4>{t("publicCatalog")}</h4>
            <p>{t(score < 40 ? "lowNote" : "noPayToWin")}</p>
          </div>
        </aside>
      </div>
      {history && (
        <Modal wide title={t("history")} onClose={() => setHistory(false)}>
          <Diff challenge={c} t={t} data={data} />
        </Modal>
      )}
      {proposal && (
        <Modal title={t("offerTitle")} onClose={() => setProposal(false)}>
          <p className="muted">
            {f.title} · v{latest?.number}
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await api("/proposals", {
                  ...form,
                  attachmentIds,
                  acceptLanguageMismatch: proposalLanguage.accepted,
                  challengeId: c.id,
                  version: latest?.number,
                });
                await refresh();
                setProposal(false);
                setTab("proposals");
                notify(t("sent"));
              } catch (e) {
                onError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {(["idea", "plan", "deadline", "link"] as const).map((k) => (
              <label key={k}>
                {t(
                  {
                    idea: "offerIdea",
                    plan: "offerPlan",
                    deadline: "deadline",
                    link: "link",
                  }[k],
                )}
                {k === "idea" || k === "plan" ? (
                  <textarea
                    rows={4}
                    required
                    minLength={10}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                ) : (
                  <input
                    required={k !== "link"}
                    type={k === "link" ? "url" : "text"}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                )}
              </label>
            ))}
            <AttachmentEditor
              ids={attachmentIds}
              data={data}
              locale={c.locale}
              onChange={(ids) => {
                setAttachmentIds(ids);
                proposalLanguage.setAccepted(false);
              }}
              refresh={refresh}
            />
            <LanguageWarning
              audit={proposalAudit}
              accepted={proposalLanguage.accepted}
              onAccept={proposalLanguage.setAccepted}
            />
            <button
              className="primary"
              disabled={
                busy ||
                proposalLanguage.checking ||
                (!!proposalAudit?.warning && !proposalLanguage.accepted)
              }
            >
              <Send size={16} />
              {t("send")}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function ProposalCard({
  p,
  data,
  t,
  lang,
  refresh,
  onError,
  go,
  notify,
}: Common & { p: Proposal }) {
  const [modal, setModal] = useState("");
  const [text, setText] = useState("");
  const [attachmentIds, setAttachmentIds] = useState<string[]>(
    p.submissionAttachmentIds || [],
  );
  const submissionLanguage = useLanguageAudit(modal === "submit" ? text : "");
  const fileAudit = data.attachments?.find(
    (f) => attachmentIds.includes(f.id) && languageFor(f.audit, "ru").warning,
  )?.audit;
  const submissionAudit = submissionLanguage.audit?.warning
    ? submissionLanguage.audit
    : fileAudit
      ? languageFor(fileAudit, "ru")
      : undefined;
  const [stars, setStars] = useState(5);
  const [busy, setBusy] = useState(false);
  const c = data.challenges.find((c) => c.id === p.challengeId);
  const tm = data.teams.find((t) => t.id === p.teamId);
  if (!c || !tm) return null;
  const own = c.ownerId === data.user?.id;
  const stale = p.version < c.versions.length;
  async function act(action: string) {
    setBusy(true);
    try {
      await api("/proposals/" + p.id, {
        action,
        submission: text,
        text,
        stars,
        attachmentIds,
        acceptLanguageMismatch: submissionLanguage.accepted,
      });
      await refresh();
      setModal("");
      notify(t("successToast"));
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="proposal-card">
      <div className="row between">
        <button className="text-btn" onClick={() => go("quest/" + c.id)}>
          {c.versions.at(-1)?.fields.title || c.fields.title}
          <ArrowRight size={14} />
        </button>
        <span className={"badge " + p.status}>{t(p.status)}</span>
      </div>
      <div className="proposal-team">
        <span className={"team-avatar " + tm.color}>{tm.emoji}</span>
        <div>
          <h3>{tm.name}</h3>
          <p className="micro muted">
            {p.deadline} · v{p.version}{" "}
            {stale && (
              <strong className="warning-text">· {t("outdated")}</strong>
            )}
          </p>
        </div>
      </div>
      <h4>{t("offerIdea")}</h4>
      <p>{p.idea}</p>
      <h4>{t("offerPlan")}</h4>
      <p className="preserve">{p.plan}</p>
      <AttachmentList ids={p.attachmentIds} data={data} />
      {p.languageWarning && (
        <p className="language-public-note">
          Автор подтвердил материал на другом языке. При необходимости уточните
          содержание.
        </p>
      )}
      {p.link && (
        <a href={p.link} target="_blank" rel="noreferrer" className="text-btn">
          {t("link")}
          <ExternalLink size={14} />
        </a>
      )}
      {p.submission && (
        <div className="submission-box">
          <strong>{t("result")}</strong>
          <p className="preserve">{p.submission}</p>
          <AttachmentList ids={p.submissionAttachmentIds} data={data} />
        </div>
      )}
      <div className="proposal-actions">
        {own && p.status === "pending" && (
          <>
            <button
              className="primary"
              disabled={busy || stale}
              onClick={() => act("accept")}
            >
              <Check size={16} />
              {t("accept")}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => act("reject")}
            >
              {t("reject")}
            </button>
          </>
        )}
        {!own &&
          stale &&
          p.status !== "completed" &&
          p.status !== "rejected" && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => act("reconfirm")}
            >
              {t("reconfirm")}
            </button>
          )}
        {p.status === "accepted" && (
          <>
            {own ? (
              <>
                <button
                  className="soft-btn"
                  disabled={busy || p.milestone || stale}
                  onClick={() => act("milestone")}
                >
                  <Flag size={16} />
                  {t(p.milestone ? "milestoneDone" : "milestone")}
                </button>
                {p.submission && (
                  <button
                    className="primary"
                    onClick={() => {
                      setText("");
                      setModal("review");
                    }}
                    disabled={stale}
                  >
                    <Star size={16} />
                    {t("review")}
                  </button>
                )}
              </>
            ) : (
              <button
                className="primary"
                disabled={stale}
                onClick={() => {
                  setText(p.submission);
                  setModal("submit");
                }}
              >
                <Send size={16} />
                {t("submitResult")}
              </button>
            )}
          </>
        )}
        {p.status === "completed" && (
          <span className="confirmed-label">
            <CheckCircle2 size={17} />
            {t("completed")} · +150 XP
          </span>
        )}
      </div>
      {modal && (
        <Modal
          title={t(modal === "review" ? "review" : "submitResult")}
          onClose={() => setModal("")}
        >
          {modal === "review" && (
            <label>
              {t("rating")}
              <select value={stars} onChange={(e) => setStars(+e.target.value)}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)} · {n}/5
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t(modal === "review" ? "reviewText" : "result")}
            <textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t(
                modal === "review" ? "reviewText" : "resultPlaceholder",
              )}
            />
          </label>
          {modal === "submit" && (
            <AudioInput
              t={t}
              lang={lang}
              enabled={data.capabilities.speech}
              onError={onError}
              onText={(s) => setText((v) => v + " " + s)}
            />
          )}
          {modal === "submit" && (
            <>
              <AttachmentEditor
                ids={attachmentIds}
                data={data}
                onChange={(ids) => {
                  setAttachmentIds(ids);
                  submissionLanguage.setAccepted(false);
                }}
                refresh={refresh}
              />
              <LanguageWarning
                audit={submissionAudit}
                accepted={submissionLanguage.accepted}
                onAccept={submissionLanguage.setAccepted}
              />
            </>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              (modal === "submit" &&
                (submissionLanguage.checking ||
                  (!!submissionAudit?.warning &&
                    !submissionLanguage.accepted))) ||
              text.trim().length < (modal === "review" ? 5 : 10)
            }
            onClick={() => act(modal)}
          >
            {t(modal === "review" ? "reviewSubmit" : "submitResult")}
          </button>
        </Modal>
      )}
    </article>
  );
}

function AIActivity({
  detail,
  t,
}: {
  detail: string;
  t: (k: string) => string;
}) {
  try {
    const fields = JSON.parse(detail);
    return (
      <details>
        <summary>{t("aiReview")}</summary>
        {Object.entries(fields)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div className="brief-section" key={k}>
              <h4>{t(k)}</h4>
              <p>{String(v)}</p>
            </div>
          ))}
      </details>
    );
  } catch {
    return <p>{detail}</p>;
  }
}
