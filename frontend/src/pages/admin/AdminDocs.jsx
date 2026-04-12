import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../../services/api";
import styles from "./AdminDocs.module.css";

const DOC_TITLES = {
  "dev-plan": "개발계획",
  "bugfix-log": "버그수정 로그",
  "upgrade-log": "업그레이드 로그",
  "work-log": "작업일지",
  "pixel-streaming-server": "픽셀스트리밍 서버",
};

export default function AdminDocs() {
  const { docKey } = useParams();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

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
        <p className={styles.hint}>왼쪽 사이드바에서 문서를 선택하세요.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.docHeader}>
        <span className={styles.overline}>Project Documentation</span>
        <h1 className={styles.title}>{DOC_TITLES[docKey] || docKey}</h1>
      </div>
      {loading ? (
        <p className={styles.hint}>로딩 중...</p>
      ) : (
        <div className={styles.content}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
