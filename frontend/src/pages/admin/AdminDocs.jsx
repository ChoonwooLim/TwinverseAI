import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../../services/api";
import styles from "./AdminDocs.module.css";

export default function AdminDocs() {
  const { docKey } = useParams();
  const [docs, setDocs] = useState([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/api/docs/list").then((r) => setDocs(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!docKey) return;
    setLoading(true);
    api.get(`/api/docs/${docKey}`)
      .then((r) => setContent(r.data.content))
      .catch(() => setContent("문서를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, [docKey]);

  if (!docKey) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>프로젝트 문서</h1>
        <ul className={styles.list}>
          {docs.map((d) => (
            <li key={d.key}><Link to={`/admin/docs/${d.key}`} className={styles.docLink}>{d.filename}</Link></li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link to="/admin/docs" className={styles.backLink}>문서 목록</Link>
      {loading ? <p>로딩 중...</p> : <div className={styles.content}><ReactMarkdown>{content}</ReactMarkdown></div>}
    </div>
  );
}
