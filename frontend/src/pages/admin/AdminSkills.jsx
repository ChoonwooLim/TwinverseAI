import { useState } from "react";
import skillsData from "../../data/skills.json";
import styles from "./AdminSkills.module.css";

const SKILL_CATEGORIES = skillsData.categories;

// Auto-discovered entries carry only a command, so the command doubles as the id.
// Without this every nameless entry shared one key and opened together.
const skillId = (skill) => skill.name ?? skill.command;

export default function AdminSkills() {
  const [openSkill, setOpenSkill] = useState(null);

  const toggle = (id) => setOpenSkill(openSkill === id ? null : id);

  const totalSkills = SKILL_CATEGORIES.reduce((sum, cat) => sum + cat.skills.length, 0);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <span className={styles.overline}>Claude Code Skills</span>
        <h1 className={styles.title}>AI 스킬 ({totalSkills})</h1>
        <p className={styles.headerDesc}>
          이 프로젝트에 설치된 모든 Claude Code 스킬 목록입니다. 슬래시 커맨드(<code>/명령어</code>)로 실행합니다.
        </p>
      </div>

      {SKILL_CATEGORIES.map((cat) => (
        <section key={cat.title} className={styles.category}>
          <div className={styles.catHeader}>
            <h2 className={styles.catTitle}>{cat.title}</h2>
            <span className={styles.catCount}>{cat.skills.length}개</span>
          </div>
          <p className={styles.catDesc}>{cat.desc}</p>

          <ul className={styles.list}>
            {cat.skills.map((skill, i) => {
              const id = skillId(skill);
              const isOpen = openSkill === id;
              return (
                <li key={id} className={styles.item}>
                  <button onClick={() => toggle(id)} className={styles.skillBtn}>
                    <span className={styles.skillIndex}>{String(i + 1).padStart(2, "0")}</span>
                    <div className={styles.skillBody}>
                      <span className={styles.skillName}>
                        {skill.name}
                        <code className={styles.command}>{skill.command}</code>
                      </span>
                      <span className={styles.skillShort}>{skill.desc}</span>
                    </div>
                    <span className={`${styles.skillChevron} ${isOpen ? styles.skillChevronOpen : ""}`}>
                      ▼
                    </span>
                  </button>
                  {isOpen && (
                    <div className={styles.detail}>
                      {skill.intro && (
                        <div className={styles.detailSection}>
                          <h4 className={styles.detailLabel}>소개</h4>
                          {skill.intro.map((text, j) => (
                            <p key={j} className={styles.introText}>{text}</p>
                          ))}
                        </div>
                      )}
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailLabel}>{skill.labels?.features ?? "주요 기능"}</h4>
                        <ul className={styles.featureList}>
                          {skill.features.map((f, j) => (
                            <li key={j}>{f}</li>
                          ))}
                        </ul>
                      </div>
                      {skill.tables?.map((table) => (
                        <div key={table.title} className={styles.detailSection}>
                          <h4 className={styles.detailLabel}>{table.title}</h4>
                          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label={table.title}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  {table.columns.map((column) => (
                                    <th key={column} scope="col">{column}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {table.rows.map((row) => (
                                  <tr key={row[0]}>
                                    <th scope="row">{row[0]}</th>
                                    {row.slice(1).map((cell, j) => (
                                      <td key={j}>{cell}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                      {(skill.usage || skill.guides) && (
                        <div className={styles.detailSection}>
                          <h4 className={styles.detailLabel}>{skill.labels?.usage ?? "사용법"}</h4>
                          {skill.usage && <p className={styles.usageText}>{skill.usage}</p>}
                          {skill.guides && (
                            <ol className={styles.guideList}>
                              {skill.guides.map((guide) => (
                                <li key={guide.title} className={styles.guide}>
                                  <h5 className={styles.guideTitle}>{guide.title}</h5>
                                  {guide.text && <p className={styles.guideText}>{guide.text}</p>}
                                  {guide.code && (
                                    <pre className={styles.code} tabIndex={0}>
                                      <code>{guide.code}</code>
                                    </pre>
                                  )}
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                      {skill.prompts && (
                        <div className={styles.detailSection}>
                          <h4 className={styles.detailLabel}>AI에게 요청하는 예</h4>
                          <ul className={styles.promptList}>
                            {skill.prompts.map((prompt, j) => (
                              <li key={j}>{prompt}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {skill.tips && (
                        <div className={styles.detailSection}>
                          <h4 className={styles.detailLabel}>{skill.labels?.tips ?? "실무 체크리스트"}</h4>
                          <ul className={styles.featureList}>
                            {skill.tips.map((tip, j) => (
                              <li key={j}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {skill.links && (
                        <div className={styles.detailSection}>
                          <h4 className={styles.detailLabel}>참고 링크</h4>
                          <ul className={styles.linkList}>
                            {skill.links.map((link) => (
                              <li key={link.url}>
                                <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
