import { useState } from "react";
import skillsData from "../../data/skills.json";
import styles from "./AdminSkills.module.css";

const SKILL_CATEGORIES = skillsData.categories;

export default function AdminSkills() {
  const [openSkill, setOpenSkill] = useState(null);

  const toggle = (name) => setOpenSkill(openSkill === name ? null : name);

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
            {cat.skills.map((skill, i) => (
              <li key={skill.name} className={styles.item}>
                <button onClick={() => toggle(skill.name)} className={styles.skillBtn}>
                  <span className={styles.skillIndex}>{String(i + 1).padStart(2, "0")}</span>
                  <div className={styles.skillBody}>
                    <span className={styles.skillName}>
                      {skill.name}
                      <code className={styles.command}>{skill.command}</code>
                    </span>
                    <span className={styles.skillShort}>{skill.desc}</span>
                  </div>
                  <span className={`${styles.skillChevron} ${openSkill === skill.name ? styles.skillChevronOpen : ""}`}>
                    ▼
                  </span>
                </button>
                {openSkill === skill.name && (
                  <div className={styles.detail}>
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailLabel}>주요 기능</h4>
                      <ul className={styles.featureList}>
                        {skill.features.map((f, j) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </div>
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailLabel}>사용법</h4>
                      <p className={styles.usageText}>{skill.usage}</p>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
