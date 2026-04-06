import { useState } from "react";
import pluginsData from "../../data/plugins.json";
import styles from "./AdminPlugins.module.css";

const PLUGIN_CATEGORIES = pluginsData.categories;

export default function AdminPlugins() {
  const [openPlugin, setOpenPlugin] = useState(null);

  const toggle = (name) => setOpenPlugin(openPlugin === name ? null : name);

  const totalPlugins = PLUGIN_CATEGORIES.reduce((sum, cat) => sum + cat.plugins.length, 0);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <span className={styles.overline}>MCP Plugins & Servers</span>
        <h1 className={styles.title}>플러그인 ({totalPlugins})</h1>
        <p className={styles.headerDesc}>
          Claude Code에 설치된 공식 플러그인 및 MCP 서버 목록입니다. 대부분 자동 활성화되며, 일부는 API 키가 필요합니다.
        </p>
      </div>

      {PLUGIN_CATEGORIES.map((cat) => (
        <section key={cat.title} className={styles.section}>
          <div className={styles.catHeader}>
            <h2 className={styles.catTitle}>{cat.title}</h2>
            <span className={styles.catCount}>{cat.plugins.length}개</span>
          </div>
          <p className={styles.catDesc}>{cat.desc}</p>

          <div className={styles.grid}>
            {cat.plugins.map((plugin) => (
              <div
                key={plugin.name}
                className={`${styles.card} ${openPlugin === plugin.name ? styles.cardOpen : ""}`}
                onClick={() => toggle(plugin.name)}
              >
                <div className={`${styles.cardStatusRule} ${plugin.requiresKey ? styles.notConfigured : styles.isConfigured}`} />
                <div className={styles.cardTop}>
                  <h3 className={styles.cardName}>{plugin.displayName}</h3>
                  <span className={plugin.requiresKey ? styles.badgeKey : styles.badgeAuto}>
                    {plugin.requiresKey ? "키 필요" : "자동"}
                  </span>
                </div>
                <p className={styles.cardSource}>{plugin.source}</p>
                <p className={styles.cardDesc}>{plugin.desc}</p>

                {openPlugin === plugin.name && (
                  <div className={styles.cardDetail}>
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailLabel}>주요 기능</h4>
                      <ul className={styles.featureList}>
                        {plugin.features.map((f, j) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </div>
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailLabel}>사용법</h4>
                      <p className={styles.usageText}>{plugin.usage}</p>
                    </div>
                    {plugin.requiresKey && (
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailLabel}>필수 환경변수</h4>
                        <code className={styles.envKey}>{plugin.keyName}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
