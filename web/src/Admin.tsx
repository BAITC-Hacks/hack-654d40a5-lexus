import { useEffect, useState } from "react";
import { Search, ShieldCheck, Check } from "lucide-react";
import { api, type User } from "./types";
import type { T } from "./i18n";
import { Empty } from "./components";
type Event = {
  actorId: string;
  userId: string;
  before: string;
  after: string;
  at: string;
};
export function Admin({
  t,
  current,
  refresh,
}: {
  t: T;
  current: User | null;
  refresh: () => Promise<void>;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  async function load() {
    try {
      const data = await api<{ users: User[]; events: Event[] }>(
        "/admin/users",
      );
      setUsers(data.users);
      setEvents(data.events || []);
    } catch (e) {
      setError(String(e));
    }
  }
  useEffect(() => {
    if (current?.role === "admin") void load();
  }, [current?.id]);
  if (current?.role !== "admin") return <Empty text={t("readOnly")} />;
  return (
    <>
      <div className="page-heading">
        <span className="section-kicker">
          <ShieldCheck size={17} />
          {t("admin")}
        </span>
        <h1>{t("adminTitle")}</h1>
        <p>{t("adminSub")}</p>
      </div>
      <label className="search-field admin-search">
        <Search size={19} />
        <input
          aria-label={t("search")}
          placeholder={t("search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="admin-list">
        {users
          .filter((u) =>
            (u.name + " " + u.email)
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((u) => (
            <UserAccess
              key={u.id + u.role + u.plan}
              user={u}
              self={u.id === current.id}
              t={t}
              onSave={async () => {
                await load();
                await refresh();
              }}
            />
          ))}
      </div>
      <details className="admin-audit">
        <summary>{t("auditLog")}</summary>
        {events.length ? (
          events
            .slice(-15)
            .reverse()
            .map((e, i) => (
              <p key={i}>
                <time>{new Date(e.at).toLocaleString()}</time> ·{" "}
                {users.find((u) => u.id === e.userId)?.email || e.userId}
                <br />
                {e.before} → {e.after}
              </p>
            ))
        ) : (
          <p>{t("noEvents")}</p>
        )}
      </details>
    </>
  );
}
function UserAccess({
  user,
  self,
  t,
  onSave,
}: {
  user: User;
  self: boolean;
  t: T;
  onSave: () => Promise<void>;
}) {
  const [role, setRole] = useState(user.role);
  const [plan, setPlan] = useState(user.plan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <article className="admin-user">
      <div className="admin-identity">
        <span className="account-monogram">
          {(user.name || user.email).slice(0, 1)}
        </span>
        <div>
          <strong>{user.name || t("pending")}</strong>
          <small>{user.email}</small>
        </div>
      </div>
      <label>
        {t("role")}
        <select
          disabled={self || user.role === "pending" || busy}
          aria-label={t("role")}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as User["role"]);
            setSaved(false);
          }}
        >
          {user.role === "pending" && (
            <option value="pending">{t("pending")}</option>
          )}
          {["student", "business", "admin"].map((r) => (
            <option key={r} value={r}>
              {t(r)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t("subscription")}
        <select
          disabled={busy || user.role === "pending"}
          aria-label={t("subscription")}
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setSaved(false);
          }}
        >
          <option value="free">{t("free")}</option>
          <option value="pro">Pro</option>
        </select>
      </label>
      <button
        className="soft-btn"
        disabled={
          busy ||
          user.role === "pending" ||
          (role === user.role && plan === user.plan)
        }
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            await api("/admin/users", { userId: user.id, role, plan });
            setSaved(true);
            await onSave();
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {saved ? <Check size={16} /> : <ShieldCheck size={16} />}{" "}
        {t(busy ? "authBusy" : "saveAccess")}
      </button>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
