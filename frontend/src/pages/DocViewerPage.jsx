import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../services/api";
import s from "./DocViewerPage.module.css";

const DOC_TITLES = {
  "dev-plan": "개발계획서",
  "bugfix-log": "버그수정 로그",
  "upgrade-log": "업그레이드 로그",
  "work-log": "작업일지",
};

const DOC_KEYS = Object.keys(DOC_TITLES);

function Skeleton() {
  return (
    <div className={s.loadingWrap}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} className={s.shimmerLine} />
      ))}
    </div>
  );
}

export default function DocViewerPage() {
  const { docKey } = useParams();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/api/docs/${docKey}`)
      .then(({ data }) => setContent(data.content))
      .catch(() => setContent("문서를 불러올 수 없습니다."))
      .finally(() => setLoading(false));
  }, [docKey]);

  const currentTitle = DOC_TITLES[docKey] || docKey;

  return (
    <div className={s.page}>
      {/* ── Breadcrumb ── */}
      <nav className={s.breadcrumbBar}>
        <Link to="/" className={s.breadcrumbLink}>
          Home
        </Link>
        <span className={s.breadcrumbSep}>/</span>
        <span className={s.breadcrumbCurrent}>{currentTitle}</span>
      </nav>

      {/* ── Body ── */}
      <div className={s.body}>
        {/* ── Sidebar ── */}
        <aside className={s.sidebar}>
          <div className={s.sidebarHeading}>Documents</div>
          <ul className={s.navList}>
            {DOC_KEYS.map((key) => (
              <li key={key}>
                <Link
                  to={`/docs/${key}`}
                  className={key === docKey ? s.navItemActive : s.navItem}
                >
                  {DOC_TITLES[key]}
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        {/* ── Main content ── */}
        <main className={s.main}>
          <h1 className={s.docTitle}>{currentTitle}</h1>
          <hr className={s.titleRule} />

          {loading ? (
            <Skeleton />
          ) : (
            <div className={s.prose}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
