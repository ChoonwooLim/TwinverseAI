import { useState, useEffect } from "react";
import api from "../../services/api";
import styles from "./AdminPlugins.module.css";

export default function AdminPlugins() {
  const [plugins, setPlugins] = useState([]);

  useEffect(() => {
    api.get("/api/plugins/list").then((r) => setPlugins(r.data)).catch(() => {});
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>플러그인</h1>
      <div className={styles.grid}>
        {plugins.map((p) => (
          <div key={p.key} className={styles.card}>
            <h3 className={styles.cardName}>{p.display_name}</h3>
            <p className={styles.cardDesc}>{p.description}</p>
            <p className={styles.cardUsage}>{p.usage}</p>
            <span className={p.is_configured ? styles.configured : styles.notConfigured}>
              {p.is_configured ? "설정 완료" : "설정 필요"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
