import { useState, useEffect, useCallback } from "react";
import api from "../../services/api";
import styles from "./AdminOpenClawDevices.module.css";

export default function AdminOpenClawDevices() {
  const [pending, setPending] = useState([]);
  const [paired, setPaired] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [approving, setApproving] = useState(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.get("/api/admin/openclaw/pending");
      setPending(r.data.pending || []);
      setPaired(r.data.paired || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (requestId) => {
    setApproving(requestId);
    setMsg("");
    setError("");
    try {
      const r = await api.post(`/api/admin/openclaw/approve/${encodeURIComponent(requestId)}`);
      setMsg(r.data.message || "approved");
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "approve failed");
    } finally {
      setApproving(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <span className={styles.overline}>OpenClaw Device Pairing</span>
        <h1 className={styles.title}>OpenClaw 디바이스 승인</h1>
        <p className={styles.desc}>
          DeskRPG / UE5 클라이언트가 게이트웨이(<code>openclaw.twinverse.org</code>)에 페어링을 요청하면
          여기서 승인합니다. 한 번 승인된 기기는 재연결 시 재승인 불필요.
        </p>
      </div>

      <div className={styles.toolbar}>
        <button className={styles.btn} onClick={load} disabled={loading}>
          {loading ? "불러오는 중..." : "새로고침"}
        </button>
        {msg && <span className={styles.okMsg}>{msg}</span>}
        {error && <span className={styles.errMsg}>{error}</span>}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>대기 중 ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className={styles.empty}>승인 대기 중인 기기가 없습니다.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Device</th>
                <th>Role</th>
                <th>IP</th>
                <th>Age</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pending.map((p) => (
                <tr key={p.requestId}>
                  <td className={styles.mono}>{p.requestId}</td>
                  <td className={styles.mono}>{p.deviceId?.slice(0, 16)}…</td>
                  <td>{p.role}</td>
                  <td>{p.ip}</td>
                  <td>{p.age}</td>
                  <td>
                    <button
                      className={styles.approveBtn}
                      onClick={() => approve(p.requestId)}
                      disabled={approving === p.requestId}
                    >
                      {approving === p.requestId ? "승인 중..." : "승인"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>승인된 기기 ({paired.length})</h2>
        {paired.length === 0 ? (
          <p className={styles.empty}>승인된 기기가 없습니다.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Device</th>
                <th>Roles</th>
                <th>Tokens</th>
              </tr>
            </thead>
            <tbody>
              {paired.map((p) => (
                <tr key={p.deviceId}>
                  <td className={styles.mono}>{p.deviceId?.slice(0, 16)}…</td>
                  <td>{p.roles}</td>
                  <td>{p.tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
