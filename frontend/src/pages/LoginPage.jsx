import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { data } = await api.post("/api/auth/login", { username, password });
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate(data.user.role === "admin" || data.user.role === "superadmin" ? "/admin" : "/");
    } catch {
      setError("로그인에 실패했습니다.");
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Brand Panel ── */}
      <div className={styles.brand}>
        <div className={styles.brandLogo}>
          Twinverse<span className={styles.brandAccent}>AI</span>
        </div>
        <p className={styles.brandTagline}>
          Build, deploy, and manage intelligent digital twins — from concept to production.
        </p>
        <hr className={styles.brandRule} />
        <span className={styles.brandFootnote}>Authenticated Access</span>
      </div>

      {/* ── Form Panel ── */}
      <div className={styles.formPanel}>
        <div className={styles.formContainer}>
          <h1 className={styles.formHeading}>Sign in</h1>
          <p className={styles.formSubheading}>Enter your credentials to continue.</p>

          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <input
                className={`${styles.input} ${username ? styles.inputFilled : ""}`}
                type="text"
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
              <label className={styles.label} htmlFor="login-username">
                Username
              </label>
            </div>

            <div className={styles.inputGroup}>
              <input
                className={`${styles.input} ${password ? styles.inputFilled : ""}`}
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <label className={styles.label} htmlFor="login-password">
                Password
              </label>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.submit} type="submit">
              Sign in
            </button>
          </form>

          <Link to="/" className={styles.backLink}>
            <span className={styles.backLinkArrow}>&larr;</span>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
