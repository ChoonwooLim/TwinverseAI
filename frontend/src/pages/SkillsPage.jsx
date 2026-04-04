import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../services/api";
import s from "./SkillsPage.module.css";

export default function SkillsPage() {
  const [skills, setSkills] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/skills/list").then(({ data }) => {
      setSkills(data);
      setLoading(false);
    });
  }, []);

  const handleSelect = (key) => {
    if (selected === key) {
      setSelected(null);
      setDetail(null);
      return;
    }
    setSelected(key);
    setDetail(null);
    api.get(`/api/skills/${key}`).then(({ data }) => setDetail(data));
  };

  return (
    <div className={s.page}>
      <Link to="/" className={s.breadcrumb}>
        <span>Home</span>
        <span className={s.breadcrumbSep}>/</span>
        <span>AI Skills</span>
      </Link>

      <header className={s.header}>
        <h1 className={s.title}>AI Skills</h1>
        <p className={s.subtitle}>
          Claude Code에서 사용 가능한 스킬 목록입니다. 스킬을 클릭하면 상세 설명을 볼 수 있습니다.
        </p>
      </header>

      {loading ? (
        <div className={s.loading}>
          <span className={s.spinner} />
          로딩중...
        </div>
      ) : (
        <div className={s.list}>
          {skills.map((skill, i) => {
            const isOpen = selected === skill.key;
            return (
              <div
                key={skill.key}
                className={s.item}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Accordion trigger */}
                <button
                  className={`${s.trigger} ${isOpen ? s.triggerActive : ""}`}
                  onClick={() => handleSelect(skill.key)}
                  type="button"
                >
                  <div className={s.triggerLeft}>
                    <div className={s.skillName}>
                      <span className={s.skillSlash}>/{skill.name}</span>
                      {skill.user_invocable && (
                        <span className={s.badge}>실행 가능</span>
                      )}
                    </div>
                    <p className={s.skillDesc}>{skill.description}</p>
                  </div>
                  <svg
                    className={`${s.chevron} ${isOpen ? s.chevronOpen : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* Expandable content */}
                <div
                  className={`${s.expandWrapper} ${isOpen ? s.expandWrapperOpen : ""}`}
                >
                  <div className={s.expandInner}>
                    <div className={s.detail}>
                      {isOpen && !detail ? (
                        <div className={s.detailLoading}>
                          <span className={s.spinner} />
                          불러오는 중...
                        </div>
                      ) : isOpen && detail ? (
                        <div className={s.prose}>
                          <ReactMarkdown>{detail.body}</ReactMarkdown>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
