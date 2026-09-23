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
export function App() {
  const [lang, setLang] = useState<Lang>(
    (localStorage.getItem("sana-lang") as Lang) || "ru",
  );
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
  async function refresh() {
    try {
      setData(await api<Data>("/bootstrap"));
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
  const requireProfile = (action: () => void) => {
    if (!data?.user) setModal("login");
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
      data?.user?.role === "business" ? go("new") : setModal("login"),
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
        <div className="nav-caption">WORKSPACE</div>
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
        </nav>
        <div className="sidebar-card">
          <div className="pixel-spark">✦</div>
          <h3>{t("introProgress")}</h3>
          <p>{t("progressText")}</p>
          <button onClick={newAction}>
            {t("newQuest")}
            <Plus size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <a
            className={route === "plans" ? "pro-nav active" : "pro-nav"}
            href="#plans"
          >
            <Sparkles size={19} />
            <span>Sana Pro</span>
            <span className="tiny-label">UPGRADE</span>
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
            <label className="lang-select">
              <span className="sr-only">{t("language")}</span>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
              >
                <option value="ru">RU</option>
                <option value="kk">KZ</option>
                <option value="en">EN</option>
              </select>
            </label>
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
                {data?.user?.role === "student" ? "👾" : "A"}
              </span>
              <span className="profile-copy">
                <strong>{data?.user?.name || t("login")}</strong>
                <small>
                  {data?.user
                    ? t(data.user.role) + " · " + t(data.user.plan)
                    : t("demo")}
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
                  <section className="hero">
                    <div className="hero-copy">
                      <span className="eyebrow">
                        <span /> {t("heroLabel")}
                      </span>
                      <h1>{t("heroTitle")}</h1>
                      <p>{t("heroText")}</p>
                      <button
                        className="primary"
                        onClick={() =>
                          document
                            .getElementById("quests")
                            ?.scrollIntoView({
                              behavior: access.reduceMotion
                                ? "instant"
                                : "smooth",
                            })
                        }
                      >
                        {t("explore")}
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                    <div className="hero-label">
                      <span>✦</span> LEVEL UP YOUR IMPACT
                    </div>
                  </section>
                  <div className="stats-strip">
                    <div>
                      <span className="stat-icon mint">
                        <Flag size={20} />
                      </span>
                      <strong>
                        {published.length.toString().padStart(2, "0")}
                      </strong>
                      <span>{t("openQuests")}</span>
                    </div>
                    <div>
                      <span className="stat-icon peach">
                        <ShieldCheck size={20} />
                      </span>
                      <strong>
                        {published
                          .filter((c) => c.score >= 70)
                          .length.toString()
                          .padStart(2, "0")}
                      </strong>
                      <span>{t("readyQuests")}</span>
                    </div>
                    <div>
                      <span className="stat-icon lavender">
                        <Users size={20} />
                      </span>
                      <strong>
                        {data.teams.length.toString().padStart(2, "0")}
                      </strong>
                      <span>{t("guilds")}</span>
                    </div>
                  </div>
                  <section id="quests">
                    <div className="section-heading">
                      <div>
                        <div className="eyebrow small">QUEST BOARD</div>
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
                    <span className="eyebrow">FIND YOUR PARTY</span>
                    <h1>{t("teamTitle")}</h1>
                    <p>{t("teamSub")}</p>
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
                              LVL {Math.floor(tm.xp / 200) + 1}
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
                    <span className="eyebrow">YOUR ADVENTURE</span>
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
                            requireProfile(async () => {
                              try {
                                await api("/subscription", { plan });
                                await refresh();
                                setToast(t("successToast"));
                              } catch (e) {
                                onError(e);
                              }
                            })
                          }
                        >
                          {data.user?.plan === plan
                            ? t("activePlan")
                            : t(plan === "pro" ? "activate" : "downgrade")}
                        </button>
                      </article>
                    ))}
                  </div>
                  <p className="centered muted">{t("demoPayment")}</p>
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
            <span>BUILT IN KAZAKHSTAN ↗</span>
          </footer>
        </main>
      </div>
      {modal === "login" && data && (
        <Modal title={t("demoTitle")} onClose={() => setModal("")}>
          <p className="muted">{t("demoText")}</p>
          {["business", "student"].map((role) => (
            <section key={role}>
              <h4 className="micro uppercase">{t(role)}</h4>
              <div className="profile-list">
                {data.profiles
                  .filter((p) => p.role === role)
                  .map((p) => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        try {
                          await api("/session", { userId: p.id });
                          await refresh();
                          setModal("");
                          setNotice("");
                          setToast(p.name);
                        } catch (e) {
                          onError(e);
                        }
                      }}
                    >
                      <span
                        className={
                          "profile-avatar " +
                          (role === "student" ? "student-avatar" : "")
                        }
                      >
                        {role === "business" ? "◈" : "👾"}
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>
                          {t(role)} · {t(p.plan)}
                        </small>
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  ))}
              </div>
            </section>
          ))}
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
          <Diff challenge={noticeChallenge} t={t} />
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
            {error.replace("Error: ", "")}
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
  const icons: Record<string, string> = {
    Retail: "☕",
    Social: "🌿",
    Education: "📚",
    Analytics: "📊",
    Ecology: "♻️",
    Technology: "⚡",
  };
  return (
    <article className="quest-card">
      <div className="row between">
        <span
          className={
            "company-icon " +
            (c.category === "Social"
              ? "mint"
              : c.category === "Education"
                ? "lavender"
                : c.category === "Analytics"
                  ? "blue"
                  : "peach")
          }
        >
          {icons[c.category] || "✦"}
        </span>
        <Badge score={c.score} t={t} />
      </div>
      <div className="company-name">
        {c.company}
        <span>↗</span>
      </div>
      <h3>
        <button onClick={onOpen}>{c.fields.title}</button>
      </h3>
      <p className="quest-description">{c.fields.need}</p>
      <div className="chips">
        <span>{t(c.category)}</span>
        <span>{c.locale.toUpperCase()}</span>
        {!c.published && <span>{t("notPublished")}</span>}
      </div>
      <div className="quest-card-bottom">
        <div className="row between">
          <span>{t("readiness")}</span>
          <strong>
            {c.score}
            <small> / 100</small>
          </strong>
        </div>
        <Meter score={c.score} />
        <button className="card-link" onClick={onOpen}>
          {t("viewQuest")}
          <ArrowUpRight size={17} />
        </button>
      </div>
    </article>
  );
}
