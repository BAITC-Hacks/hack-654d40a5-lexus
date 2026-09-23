import { errorText } from "./http-errors";
import { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Building2,
  GraduationCap,
  Check,
  Eye,
  EyeOff,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { api, type User } from "./types";
import type { T } from "./i18n";
import { Modal } from "./components";
export function AuthDialog({
  user,
  t,
  refresh,
  onClose,
  go,
}: {
  user: User | null;
  t: T;
  refresh: () => Promise<void>;
  onClose: () => void;
  go: (route: string) => void;
}) {
  const [step, setStep] = useState(
    user?.role === "pending" ? "role" : user ? "account" : "login",
  );
  const [role, setRole] = useState<"business" | "student" | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState("");
  const [teamName, setTeamName] = useState("");
  const [skills, setSkills] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const title =
    step === "login"
      ? t("signInTitle")
      : step === "register"
        ? t("registerTitle")
        : step === "role"
          ? t("roleTitle")
          : step === "profile"
            ? t("profileTitle")
            : t("account");
  return (
    <Modal title={title} onClose={onClose}>
      <div className="auth-content">
        {(step === "login" || step === "register") && (
          <>
            <p className="muted">
              {t(step === "login" ? "signInSub" : "registerSub")}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  if (step === "register" && password !== confirm) {
                    throw new Error("Passwords do not match");
                  }
                  const u = await api<User>("/auth/" + step, {
                    email,
                    password,
                    ...(step === "register"
                      ? { confirmPassword: confirm }
                      : {}),
                  });
                  setPassword("");
                  setConfirm("");
                  await refresh();
                  if (u.role === "pending") {
                    setStep("role");
                  } else {
                    onClose();
                    if (u.role === "admin") go("admin");
                  }
                });
              }}
            >
              <label>
                {t("email")}
                <input
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                {t("password")}
                <span className="password-field">
                  <input
                    type={visible ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete={
                      step === "register" ? "new-password" : "current-password"
                    }
                    aria-label={t("password")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby="password-hint"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={t(visible ? "hidePassword" : "showPassword")}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
                <small id="password-hint" className="muted">
                  {t("passwordHint")}
                </small>
              </label>
              {step === "register" && (
                <label>
                  {t("confirmPassword")}
                  <input
                    type={visible ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <button className="primary auth-submit" disabled={busy}>
                {t(busy ? "authBusy" : step === "login" ? "login" : "register")}
                <ArrowRight size={18} />
              </button>
            </form>
            <p className="auth-switch">
              {t(step === "login" ? "noAccount" : "haveAccount")}{" "}
              <button
                className="text-btn"
                onClick={() => {
                  setStep(step === "login" ? "register" : "login");
                  setError("");
                }}
              >
                {t(step === "login" ? "register" : "login")}
              </button>
            </p>
          </>
        )}
        {step === "role" && (
          <>
            <div className="onboarding-progress">
              <span className="active" />
              <span />
            </div>
            <p className="muted">{t("roleSub")}</p>
            <div className="role-options">
              {(["student", "business"] as const).map((r) => (
                <button
                  key={r}
                  className={"role-option " + (role === r ? "selected" : "")}
                  aria-pressed={role === r}
                  onClick={() => setRole(r)}
                >
                  <span className="role-icon">
                    {r === "student" ? <GraduationCap /> : <Building2 />}
                  </span>
                  <span>
                    <strong>{t(r + "Role")}</strong>
                    <small>{t(r + "RoleSub")}</small>
                  </span>
                  {role === r && <Check size={19} />}
                </button>
              ))}
            </div>
            <button
              className="primary auth-submit"
              disabled={!role}
              onClick={() => setStep("profile")}
            >
              {t("next")}
              <ArrowRight size={18} />
            </button>
          </>
        )}
        {step === "profile" && (
          <>
            <div className="onboarding-progress">
              <span className="active" />
              <span className="active" />
            </div>
            <p className="muted">{t("profileSub")}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api("/auth/onboard", {
                    role,
                    name,
                    organization,
                    teamName,
                    skills,
                    description,
                  });
                  await refresh();
                  go(role === "business" ? "new" : "catalog");
                  onClose();
                });
              }}
            >
              <label>
                {t(role === "student" ? "personName" : "companyName")}
                <input
                  required
                  minLength={2}
                  maxLength={80}
                  autoFocus
                  autoComplete={role === "student" ? "name" : "organization"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              {role === "student" && (
                <>
                  <label>
                    {t("university")}
                    <input
                      required
                      maxLength={100}
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                    />
                  </label>
                  <label>
                    {t("skillsInput")}
                    <input
                      required
                      maxLength={160}
                      placeholder="Python, React, UI/UX"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                    />
                  </label>
                  <label>
                    {t("teamName")}
                    <input
                      maxLength={80}
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label>
                {t("profileDescription")}
                <textarea
                  rows={3}
                  maxLength={900}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <div className="row">
                <button
                  type="button"
                  className="soft-btn"
                  disabled={busy}
                  onClick={() => setStep("role")}
                >
                  <ArrowLeft size={16} />
                  {t("back")}
                </button>
                <button className="primary" disabled={busy}>
                  {t(busy ? "authBusy" : "finishSetup")}
                  <ArrowRight size={17} />
                </button>
              </div>
            </form>
          </>
        )}
        {step === "account" && user && (
          <>
            <div className="account-summary">
              <span className="account-monogram">{user.name.slice(0, 1)}</span>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
              <span className="badge ready">
                {t(user.role)} · {t(user.plan)}
              </span>
            </div>
            {user.role === "admin" && (
              <button
                className="soft-btn auth-submit"
                onClick={() => go("admin")}
              >
                <ShieldCheck size={18} />
                {t("adminTitle")}
              </button>
            )}
            <button
              className="text-btn auth-submit"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api("/auth/logout", {});
                  await refresh();
                  go("catalog");
                  onClose();
                })
              }
            >
              <LogOut size={18} />
              {t("logout")}
            </button>
            {error && <p role="alert">{error}</p>}
          </>
        )}
      </div>
    </Modal>
  );
}
