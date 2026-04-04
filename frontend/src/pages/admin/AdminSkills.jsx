import { useState, useEffect } from "react";
import api from "../../services/api";
import ReactMarkdown from "react-markdown";
import styles from "./AdminSkills.module.css";

export default function AdminSkills() {
  const [skills, setSkills] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.get("/api/skills/list").then((r) => setSkills(r.data)).catch(() => {});
  }, []);

  const handleSelect = async (key) => {
    if (selected === key) { setSelected(null); setDetail(null); return; }
    setSelected(key);
    try { const res = await api.get(`/api/skills/${key}`); setDetail(res.data); }
    catch { setDetail(null); }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>AI 스킬</h1>
      <ul className={styles.list}>
        {skills.map((s) => (
          <li key={s.key} className={styles.item}>
            <button onClick={() => handleSelect(s.key)} className={styles.skillBtn}>
              <strong>{s.name}</strong>
              <span className={styles.desc}>{s.description}</span>
            </button>
            {selected === s.key && detail && (
              <div className={styles.detail}><ReactMarkdown>{detail.body}</ReactMarkdown></div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
