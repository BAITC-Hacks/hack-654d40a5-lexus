import { errorText } from "./http-errors";
import { AuthDialog } from "./Auth";
import { Admin } from "./Admin";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  Search,
  SlidersHorizontal,
  Compass,
  Users,
  Layers,
  Sparkles,
  Bell,
  ChevronDown,
  Accessibility,
  Check,
  Star,
  ShieldCheck,
  Mountain,
  LogIn,
  Menu,
  ExternalLink,
  Flag,
  BookOpen,
  Trophy,
} from "lucide-react";
import type { Challenge, Data, Lang, Team } from "./types";
import { api } from "./types";
import { translator } from "./i18n";
import { Badge, Meter, Modal, Empty, Diff, ChangeAdvisor } from "./components";
import { Studio } from "./Studio";
import { QuestDetail, ProposalCard } from "./QuestDetail";
import "./style.css";
import "./v2.css";
export function App() {
  const lang: Lang = "ru";
  const [data, setData] = useState<Data | null>(null);
  const [route, setRoute] = useState(location.hash.slice(1) || "catalog");
  const [modal, setModal] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [sort, setSort] = useState("score");
  const [team, setTeam] = useState<Team | null>(null);
  const [notice, setNotice] = useState("");
  const [mobile, setMobile] = useState(false);
  const [access, setAccess] = useState<Record<string, boolean>>(() =>
    JSON.parse(localStorage.getItem("sana-access") || "{}"),
  );
  const t = translator(lang);
  const refreshSequence = useRef(0);
  async function refresh() {
    const sequence = ++refreshSequence.current;
    try {
      const next = await api<Data>("/bootstrap");
      if (sequence === refreshSequence.current) setData(next);
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    const hash = () => {
      setRoute(location.hash.slice(1) || "catalog");
      setMobile(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", hash);
    return () => {
      clearInterval(timer);
      window.removeEventListener("hashchange", hash);
    };
  }, []);
  useEffect(() => {
    localStorage.setItem("sana-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    localStorage.setItem("sana-access", JSON.stringify(access));
    document.body.classList.toggle("large-text", !!access.largeText);
    document.body.classList.toggle("high-contrast", !!access.highContrast);
    document.body.classList.toggle("reduce-motion", !!access.reduceMotion);
  }, [access]);
  useEffect(() => {
    if (toast) {
      const tm = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(tm);
    }
  }, [toast]);
  const go = (p: string) => {
    location.hash = p;
    setModal("");
  };
  useEffect(() => {
    if (data?.user?.role === "pending") setModal("login");
  }, [data?.user?.id, data?.user?.role]);
  const requireProfile = (action: () => void) => {
    if (!data?.user || data.user.role === "pending") setModal("login");
    else action();
  };
  const onError = (e: unknown) => setError(String(e));
  const common = {
    data: data!,
    t,
    lang,
    refresh,
    onError,
    go,
    notify: setToast,
  };
  const published = useMemo(
    () =>
      data?.challenges
        .filter((c) => c.published)
        .map((c) => {
          const v = c.versions.at(-1)!;
          return {
            ...c,
            fields: v.fields,
            coverId: v.coverId,
            attachmentIds: v.attachmentIds,
            languagePenalty: v.languagePenalty,
            approved: v.approved,
            score: v.score,
          };
        }) || [],
    [data],
  );
  let list = published.filter(
    (c) =>
      (!category || c.category === category) &&
      (!search ||
        (
          c.fields.title +
          " " +
          c.fields.need +
          " " +
          c.company +
          " " +
          c.category
        )
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (!level ||
        (level === "draft"
          ? c.score < 40
          : level === "working"
            ? c.score >= 40 && c.score < 70
            : level === "ready"
              ? c.score >= 70 && c.score < 90
              : c.score >= 90)),
  );
  list.sort((a, b) =>
    sort === "new" ? b.createdAt.localeCompare(a.createdAt) : b.score - a.score,
  );
  if (sort === "match" && data?.user?.teamId) {
    const tm = data.teams.find((t) => t.id === data.user?.teamId);
    const match = (c: Challenge) =>
      tm?.skills.filter((s) =>
        Object.values(c.fields)
          .join(" ")
          .toLowerCase()
          .includes(s.toLowerCase()),
      ).length || 0;
    list.sort((a, b) => match(b) - match(a) || b.score - a.score);
  }
  const current = data?.challenges.find((c) => c.id === route.split("/")[1]);
  const newAction = () =>
    requireProfile(() =>
      data?.user?.role === "business" ? go("new") : setToast(t("learnRole")),
    );
  const nav = [
    ["catalog", Compass, "catalog"],
    ["teams", Users, "teams"],
    ["workspace", Layers, "workspace"],
  ] as const;
  const nc = data?.notifications.filter((n) => !n.read).length || 0;
  const shownNotices = useRef(new Set<string>());
  useEffect(() => {
    if (data?.user?.role !== "student" || !route.startsWith("quest/")) return;
    const n = data.notifications.find(
      (n) =>
        n.kind === "changed" &&
        !n.read &&
        n.challengeId === route.split("/")[1] &&
        !shownNotices.current.has(n.id),
    );
    if (n) {
      shownNotices.current.add(n.id);
      setNotice(n.id);
    }
  }, [data, route]);
  const openNotice = data?.notifications.find((n) => n.id === notice);
  const noticeChallenge = data?.challenges.find(
    (c) => c.id === openNotice?.challengeId,
  );
  return (
    <div className="app-shell">
      <a
        className="skip"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
          document.getElementById("main")?.scrollIntoView();
        }}
      >
        {t("skip")}
      </a>
      <aside className={"sidebar " + (mobile ? "mobile-open" : "")}>
        <a className="brand" href="#catalog">
          <span className="brand-symbol">
            <Mountain size={27} />
            <i />
          </span>
          <span>
            Sana<span className="brand-quest">Quest</span>
            <small>{t("appSubtitle")}</small>
          </span>
        </a>

        <nav>
          {nav.map(([r, Icon, k]) => (
            <a key={r} href={"#" + r} className={route === r ? "active" : ""}>
              <Icon size={20} />
              {t(k)}
              {r === "workspace" && data?.user && (
                <span className="nav-count">
                  {data.user.role === "business"
                    ? data.challenges.filter((c) => c.ownerId === data.user!.id)
                        .length
                    : data.proposals.length}
                </span>
              )}
            </a>
          ))}
          {data?.user?.role === "admin" && (
            <a href="#admin" className={route === "admin" ? "active" : ""}>
              <ShieldCheck size={20} />
              {t("admin")}
            </a>
          )}
        </nav>
        <div className="sidebar-bottom">
          <a
            className={route === "plans" ? "pro-nav active" : "pro-nav"}
            href="#plans"
          >
            <Sparkles size={19} />
            <span>Sana Pro</span>
            <span className="tiny-label">PRO</span>
          </a>
          <button className="a11y" onClick={() => setModal("access")}>
            <Accessibility size={19} />
            {t("accessibility")}
          </button>
          <div className="sidebar-footer">
            <span className="live-dot" /> HACKALEM 2026 <span>↗</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-btn menu-toggle"
            onClick={() => setMobile(!mobile)}
            aria-label="Menu"
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Sana Quest <span>/</span>{" "}
            <strong>
              {t(
                route.startsWith("edit") || route === "new"
                  ? "studio"
                  : route.startsWith("quest")
                    ? "catalog"
                    : route,
              )}
            </strong>
          </div>
          <div className="top-actions">
            <span
              className="language-fixed"
              aria-label="Язык интерфейса: русский"
            >
              РУС
            </span>
            <button
              className="icon-btn notification-button"
              aria-label={t("notifications")}
              onClick={() => setModal("notifications")}
            >
              <Bell size={20} />
              {nc > 0 && <b>{nc}</b>}
            </button>
            <div className="top-divider" />
            <button
              className="profile-button"
              onClick={() => setModal("login")}
            >
              <span className="profile-avatar">
                {data?.user?.name?.slice(0, 1) || <LogIn size={17} />}
              </span>
              <span className="profile-copy">
                <strong>{data?.user?.name || t("login")}</strong>
                <small>
                  {data?.user
                    ? t(data.user.role) + " · " + t(data.user.plan)
                    : t("register")}
                </small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {!data ? (
            <Empty text={t("loading")} />
          ) : (
            <>
              {route === "catalog" && (
                <>
                  <section className="catalog-welcome">
                    <div>
                      <span className="section-kicker">
                        <span className="live-dot" /> SANA QUEST
                      </span>
                      <h1>{t("tasksForYou")}</h1>
                      <p>{t("cleanCatalogSub")}</p>
                    </div>
                    <div className="welcome-art" aria-hidden="true" />
                  </section>
                  <section id="quests">
                    <div className="section-heading">
                      <div>
                        <h2>{t("catalogTitle")}</h2>
                        <p>{t("catalogSub")}</p>
                      </div>
                      <button className="primary" onClick={newAction}>
                        <Plus size={18} />
                        {t("newQuest")}
                      </button>
                    </div>
                    <div className="filters">
                      <label className="search-field">
                        <Search size={19} />
                        <span className="sr-only">{t("search")}</span>
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder={t("search")}
                        />
                      </label>
                      <label>
                        <span className="sr-only">{t("category")}</span>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          <option value="">{t("all")}</option>
                          {[
                            "Retail",
                            "Social",
                            "Education",
                            "Analytics",
                            "Ecology",
                            "Technology",
                          ].map((c) => (
                            <option key={c} value={c}>
                              {t(c)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span className="sr-only">{t("readiness")}</span>
                        <select
                          value={level}
                          onChange={(e) => setLevel(e.target.value)}
                        >
                          <option value="">{t("allLevels")}</option>
                          {["draft", "working", "ready", "priority"].map(
                            (c) => (
                              <option key={c} value={c}>
                                {t(c)}
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                    </div>
                    <div className="results-row">
                      <span>
                        <strong>{list.length}</strong> {t("results")}{" "}
                        <span className="micro muted">
                          / {t("publicCatalog")}
                        </span>
                      </span>
                      <label>
                        <SlidersHorizontal size={14} />
                        <select
                          aria-label={t("sort")}
                          value={sort}
                          onChange={(e) => setSort(e.target.value)}
                        >
                          <option value="score">{t("sort")}</option>
                          <option value="new">{t("newest")}</option>
                          {data.user?.role === "student" && (
                            <option value="match">{t("recommended")}</option>
                          )}
                        </select>
                      </label>
                    </div>
                    <div className="quest-grid">
                      {list.map((c) => (
                        <QuestCard
                          key={c.id}
                          c={c}
                          t={t}
                          onOpen={() => go("quest/" + c.id)}
                        />
                      ))}
                    </div>
                    {!list.length && (
                      <Empty text={t("noResults")}>
                        <button
                          className="soft-btn"
                          onClick={() => {
                            setSearch("");
                            setCategory("");
                            setLevel("");
                          }}
                        >
                          {t("clear")}
                        </button>
                      </Empty>
                    )}
                  </section>
                </>
              )}
              {route === "teams" && (
                <>
                  <div className="page-heading">
                    <h1>{t("teamTitle")}</h1>
                    <p>{t("cleanTeamSub")}</p>
                  </div>
                  <label className="search-field team-search">
                    <Search size={19} />
                    <input
                      aria-label={t("search")}
                      placeholder={t("search")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div className="team-grid">
                    {data.teams
                      .filter((tm) =>
                        (
                          tm.name +
                          " " +
                          tm.skills.join(" ") +
                          " " +
                          tm.description
                        )
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .sort((a, b) => b.xp - a.xp)
                      .map((tm) => (
                        <article className="team-card" key={tm.id}>
                          <div className={"team-banner " + tm.color}>
                            <span className="pixel-pattern" />
                            <span className="team-mascot">{tm.emoji}</span>
                            <span className="level-tag">
                              {t("level")} {Math.floor(tm.xp / 200) + 1}
                            </span>
                          </div>
                          <div className="team-body">
                            <div className="row between">
                              <h3>{tm.name}</h3>
                              <span className="rating">
                                <Star size={15} />
                                {tm.reviews.length
                                  ? (
                                      tm.reviews.reduce(
                                        (s, r) => s + r.stars,
                                        0,
                                      ) / tm.reviews.length
                                    ).toFixed(1)
                                  : "—"}
                              </span>
                            </div>
                            <p className="micro muted">
                              {tm.university} · {tm.members} {t("members")}
                            </p>
                            <p className="team-description">{tm.description}</p>
                            <div className="chips">
                              {tm.skills.map((s) => (
                                <span key={s}>{s}</span>
                              ))}
                            </div>
                            <div className="team-stats">
                              <span>
                                <Trophy size={15} />
                                {tm.reviews.length} {t("completedTasks")}
                              </span>
                              <strong>{tm.xp} XP</strong>
                            </div>
                            <button
                              className="card-link"
                              onClick={() => setTeam(tm)}
                            >
                              {t("teamProfile")}
                              <ArrowUpRight size={17} />
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                </>
              )}
              {route === "workspace" && (
                <>
                  <div className="page-heading">
                    <span className="eyebrow">ВАШИ ПРОЕКТЫ</span>
                    <div className="row between">
                      <h1>{t("workspace")}</h1>
                      {data.user?.role === "business" && (
                        <button className="primary" onClick={newAction}>
                          <Plus size={18} />
                          {t("newQuest")}
                        </button>
                      )}
                    </div>
                    <p>{data.user?.name || t("needLogin")}</p>
                  </div>
                  {!data.user ? (
                    <Empty text={t("needLogin")}>
                      <button
                        className="primary"
                        onClick={() => setModal("login")}
                      >
                        {t("login")}
                      </button>
                    </Empty>
                  ) : data.user.role === "business" ? (
                    <>
                      <h2>{t("myDrafts")}</h2>
                      <div className="quest-grid">
                        {data.challenges
                          .filter((c) => c.ownerId === data.user!.id)
                          .map((c) => (
                            <QuestCard
                              key={c.id}
                              c={c}
                              t={t}
                              onOpen={() =>
                                go((c.published ? "quest/" : "edit/") + c.id)
                              }
                            />
                          ))}
                      </div>
                      <h2 className="spaced">{t("proposals")}</h2>
                      {data.proposals.map((p) => (
                        <ProposalCard key={p.id} p={p} {...common} />
                      ))}
                    </>
                  ) : (
                    <>
                      {data.proposals.map((p) => (
                        <ProposalCard key={p.id} p={p} {...common} />
                      ))}
                      {!data.proposals.length && (
                        <Empty text={t("emptyWorkspace")}>
                          <button
                            className="primary"
                            onClick={() => go("catalog")}
                          >
                            {t("explore")}
                          </button>
                        </Empty>
                      )}
                    </>
                  )}
                </>
              )}
              {(route === "new" || route.startsWith("edit/")) && (
                <Studio
                  key={route}
                  challenge={current}
                  {...common}
                  onLogin={() => setModal("login")}
                />
              )}
              {route.startsWith("quest/") &&
                (current ? (
                  <QuestDetail
                    key={current.id}
                    challenge={current}
                    {...common}
                    onLogin={() => setModal("login")}
                  />
                ) : (
                  <Empty text={t("noResults")} />
                ))}
              {route === "admin" && (
                <Admin t={t} current={data.user} refresh={refresh} />
              )}
              {route === "plans" && (
                <>
                  <div className="page-heading centered">
                    <span className="eyebrow">SANA PRO</span>
                    <h1>{t("planTitle")}</h1>
                    <p>{t("planSub")}</p>
                  </div>
                  <div className="plan-grid">
                    {["free", "pro"].map((plan) => (
                      <article className={"plan-card " + plan} key={plan}>
                        <span className="plan-icon">
                          {plan === "pro" ? <Sparkles /> : <Compass />}
                        </span>
                        <h2>{plan === "pro" ? "Sana Pro" : t("free")}</h2>
                        <div className="price">
                          {plan === "free" ? "0" : "4 990"} <span>₸</span>
                        </div>
                        <p className="muted micro">{t("perMonth")}</p>
                        <ul>
                          {t(plan === "pro" ? "proFeatures" : "freeFeatures")
                            .split("|")
                            .map((f) => (
                              <li key={f}>
                                <Check size={17} />
                                {f}
                              </li>
                            ))}
                        </ul>
                        <button
                          className={plan === "pro" ? "primary" : "secondary"}
                          disabled={data.user?.plan === plan}
                          onClick={() =>
                            data.user?.role === "admin"
                              ? go("admin")
                              : setModal("pro-info")
                          }
                        >
                          {data.user?.plan === plan
                            ? t("activePlan")
                            : t("contactAdmin")}
                        </button>
                      </article>
                    ))}
                  </div>
                  <p className="centered muted">{t("activationNote")}</p>
                  <div className="fairness">
                    <ShieldCheck />
                    {t("noPayToWin")}
                  </div>
                </>
              )}
            </>
          )}
          <footer className="main-footer">
            <span>✦ SANA QUEST</span>
            <p>{t("footer")}</p>
            <span>СОЗДАНО В КАЗАХСТАНЕ ↗</span>
          </footer>
        </main>
      </div>
      {modal === "login" && data && (
        <AuthDialog
          user={data.user}
          t={t}
          refresh={refresh}
          onClose={() => setModal("")}
          go={go}
        />
      )}
      {modal === "pro-info" && (
        <Modal title={t("contactAdmin")} onClose={() => setModal("")}>
          <p>{t("accessInfo")}</p>
          <button className="primary" onClick={() => setModal("")}>
            {t("close")}
          </button>
        </Modal>
      )}
      {modal === "access" && (
        <Modal title={t("accessibility")} onClose={() => setModal("")}>
          {["largeText", "highContrast", "reduceMotion"].map((k) => (
            <label className="toggle-line" key={k}>
              <span>{t(k)}</span>
              <input
                type="checkbox"
                checked={!!access[k]}
                onChange={(e) =>
                  setAccess({ ...access, [k]: e.target.checked })
                }
              />
            </label>
          ))}
        </Modal>
      )}
      {modal === "notifications" && data && (
        <Modal title={t("notifications")} onClose={() => setModal("")}>
          {data.notifications.length ? (
            data.notifications
              .slice()
              .reverse()
              .map((n) => (
                <button
                  className={"notice " + (!n.read ? "unread" : "")}
                  key={n.id}
                  onClick={async () => {
                    if (n.kind === "changed") {
                      setNotice(n.id);
                      setModal("");
                    } else {
                      await api("/notifications/read", { id: n.id });
                      await refresh();
                      go("quest/" + n.challengeId);
                    }
                  }}
                >
                  <span className="stat-icon mint">
                    <Bell size={18} />
                  </span>
                  <span>
                    <strong>
                      {t(
                        n.kind === "changed"
                          ? "changed"
                          : n.kind === "submission"
                            ? "submissionNotice"
                            : "proposalNotice",
                      )}
                    </strong>
                    <small>
                      {
                        data.challenges.find((c) => c.id === n.challengeId)
                          ?.fields.title
                      }{" "}
                      · v{n.version}
                    </small>
                  </span>
                  <ArrowRight size={17} />
                </button>
              ))
          ) : (
            <Empty text={t("emptyNotifications")} />
          )}
        </Modal>
      )}
      {notice && noticeChallenge && openNotice && (
        <Modal wide title={t("changed")} onClose={() => setNotice("")}>
          <p>{t("changedText")}</p>
          <h3>{noticeChallenge.fields.title}</h3>
          <ChangeAdvisor challenge={noticeChallenge} lang={lang} t={t} />
          <Diff challenge={noticeChallenge} t={t} data={data || undefined} />
          <button
            className="primary"
            onClick={async () => {
              await api("/notifications/read", { id: notice });
              await refresh();
              setNotice("");
              go("quest/" + noticeChallenge.id);
            }}
          >
            {t("ack")}
          </button>
        </Modal>
      )}
      {team && (
        <Modal wide title={team.name} onClose={() => setTeam(null)}>
          <div className="team-profile-head">
            <span className={"big-avatar " + team.color}>{team.emoji}</span>
            <div>
              <p>
                {team.university} · {team.members} {t("members")}
              </p>
              <h3>
                {team.xp} XP · LVL {Math.floor(team.xp / 200) + 1}
              </h3>
              <div className="chips">
                {team.skills.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>
            </div>
          </div>
          <h3>{t("aboutTeam")}</h3>
          <p>{team.description}</p>
          <div className="achievement">
            <Trophy />
            <div>
              <strong>{t(team.xp >= 150 ? "builder" : "explorer")}</strong>
              <p>{t("xpNote")}</p>
            </div>
          </div>
          <h3>
            {t("reviews")} ({team.reviews.length})
          </h3>
          {team.reviews.length ? (
            team.reviews.map((r) => (
              <div className="review" key={r.proposalId}>
                <div className="row between">
                  <strong>{r.company}</strong>
                  <span className="stars">
                    {"★".repeat(r.stars)}
                    {"☆".repeat(5 - r.stars)}
                  </span>
                </div>
                <p>{r.text}</p>
                <a
                  href={"#quest/" + r.challengeId}
                  onClick={() => setTeam(null)}
                >
                  {t("viewQuest")} <ExternalLink size={13} />
                </a>
              </div>
            ))
          ) : (
            <p className="muted">{t("noReviews")}</p>
          )}
        </Modal>
      )}
      {error && (
        <Modal title={t("error")} onClose={() => setError("")}>
          <p role="alert" className="error-text">
            {errorText(error)}
          </p>
          <button className="primary" onClick={() => setError("")}>
            {t("close")}
          </button>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
    </div>
  );
}
function QuestCard({
  c,
  t,
  onOpen,
}: {
  c: Challenge;
  t: (k: string) => string;
  onOpen: () => void;
}) {
  const art: Record<string, string> = {
    Retail: "coffee",
    Social: "city",
    Education: "learn",
    Analytics: "data",
    Ecology: "green",
    Technology: "tech",
  };
  return (
    <article className="quest-card">
      <button
        className={"quest-cover cover-" + (art[c.category] || "tech")}
        onClick={onOpen}
        aria-label={c.fields.title}
      >
        {c.coverId ? (
          <img src={"/covers/" + c.coverId + ".jpg"} alt="" loading="lazy" />
        ) : (
          <img
            src={"/assets/cover-" + (art[c.category] || "tech") + ".svg"}
            alt=""
            loading="lazy"
          />
        )}
        <span className="cover-category">{t(c.category)}</span>
      </button>
      <div className="quest-card-content">
        <div className="company-name">
          {c.company}
          <span>{c.locale.toUpperCase()}</span>
        </div>
        <h3>
          <button onClick={onOpen}>{c.fields.title}</button>
        </h3>
        <p className="quest-description">{c.fields.need}</p>
        <div className="quest-card-bottom">
          <div className="readiness-compact">
            <Badge score={c.score} t={t} />
            <span title={t("scoreExplanation")}>
              {t("readyScore")}{" "}
              <strong>
                {c.score}
                <small>/100</small>
              </strong>
            </span>
          </div>
          {!c.published && (
            <span className="micro muted">{t("notPublished")}</span>
          )}
          <button className="card-link" onClick={onOpen}>
            {t("viewQuest")}
            <ArrowUpRight size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
