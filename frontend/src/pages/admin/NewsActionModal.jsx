import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import styles from "./NewsActionModal.module.css";

/**
 * Per-item action modal triggered from AdminNews.
 *
 * Mode is decided from `item.apply_action.type`:
 * - install_skill / install_plugin → show concrete commands + copy + 적용표시
 * - edit_claude_md / edit_settings → show diff + 큐잉 버튼 (Claude Code 가 적용)
 * - info_only or fallback → show summary + 적용표시 (acknowledged)
 *
 * On success, calls `onApplied(updatedRow)` so AdminNews can refresh.
 */
export default function NewsActionModal({ item, onClose, onApplied }) {
  const [busy, setBusy] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null); // index of last-copied block
  const [error, setError] = useState(null);

  const action = item.apply_action || { type: "info_only" };
  const type = action.type || "info_only";

  // Each block = one independent thing to copy. For multi-step installs we
  // render multiple blocks (numbered 1️⃣ 2️⃣ ...) to prevent the "paste two
  // /commands at once" bug — Claude Code merges them and dies on Windows.
  const { commandBlocks, secondaryNote } = useMemo(() => {
    if (type === "install_plugin") {
      const marketplace = action.marketplace || extractRepoSlug(item.source_url);
      const pluginId = action.plugin_id || guessPluginIdFromUrl(item.source_url);
      const blocks = [];
      let step = 1;
      if (marketplace) {
        blocks.push({
          label: `${stepEmoji(step++)} 마켓플레이스 추가`,
          code: `/plugin marketplace add ${marketplace}`,
        });
      }
      if (pluginId) {
        blocks.push({
          label: `${stepEmoji(step++)} 플러그인 설치 (위 명령 성공 메시지 확인 후 실행)`,
          code: `/plugin install ${pluginId}`,
        });
      }
      return {
        commandBlocks: blocks,
        secondaryNote: pluginId
          ? "각 명령은 한 줄씩 따로 입력하고 Enter — 한 번에 붙여넣으면 Claude Code 가 합쳐서 처리해 실패합니다."
          : "정확한 plugin id 는 repo README 에서 확인이 필요할 수 있습니다.",
      };
    }
    if (type === "install_skill") {
      const repo = action.repo || item.source_url || "";
      const skillName = action.skill_name || guessSkillNameFromUrl(repo);
      const method = action.install_method || "clone";
      if (method === "marketplace") {
        return {
          commandBlocks: [
            { label: "1️⃣ 마켓플레이스 추가", code: `/plugin marketplace add ${extractRepoSlug(repo)}` },
            { label: "2️⃣ 스킬 설치 (위 성공 후)", code: `/plugin install ${skillName}` },
          ],
          secondaryNote: "각 명령은 한 줄씩 따로 입력하고 Enter — 한 번에 붙여넣으면 실패합니다.",
        };
      }
      return {
        commandBlocks: [
          {
            label: "터미널 (Claude Code 외부) 에서 실행",
            code: `git clone --depth=1 ${repo} ~/.claude/skills/${skillName}`,
          },
        ],
        secondaryNote: "SKILL.md 가 repo 루트에 없으면 폴더 구조 정리 필요할 수 있습니다.",
      };
    }
    if (type === "edit_claude_md") {
      const section = action.section_title || "추가 섹션";
      const content = action.content_md || "";
      return {
        commandBlocks: [
          {
            label: "~/.claude/CLAUDE.md 에 추가될 섹션",
            code: `## ${section}\n\n${content}`,
          },
        ],
        secondaryNote:
          "이 변경은 Claude Code 가 안전하게 적용해야 합니다. 아래 [Claude Code 큐잉] 버튼을 누르면 다음 /news-watch 가 diff 를 보여드리고 적용합니다.",
      };
    }
    if (type === "edit_settings") {
      const keys = action.keys || {};
      const lines = Object.entries(keys).map(([k, v]) => `${k} = ${JSON.stringify(v)}`);
      return {
        commandBlocks: [
          { label: "settings.json 변경 제안", code: lines.join("\n") || "(변경 없음)" },
        ],
        secondaryNote:
          "settings.json 변경은 Claude Code 가 직접 적용해야 안전합니다. [Claude Code 큐잉] 버튼을 사용하세요.",
      };
    }
    return { commandBlocks: [], secondaryNote: null };
  }, [type, action, item.source_url]);

  const requiresQueue = type === "edit_claude_md" || type === "edit_settings";
  const canDirectApply = type === "info_only" || type === "general";

  // ESC closes
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function handleCopy(text, idx) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
    } catch {
      setError("클립보드 복사 실패. 텍스트를 직접 선택하세요.");
    }
  }

  async function callEndpoint(suffix) {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post(`/api/news/${item.id}${suffix}`);
      onApplied?.(r.data);
      onClose();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "요청 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.backdrop} onClick={busy ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>{item.title}</div>
          <button className={styles.closeBtn} onClick={onClose} disabled={busy} aria-label="닫기">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>출처</span>
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className={styles.metaLink}>
              {item.source_url}
            </a>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaLabel}>액션</span>
            <code className={styles.actionType}>{type}</code>
          </div>

          {item.summary && <p className={styles.summary}>{item.summary}</p>}

          {commandBlocks.length > 0 ? (
            <>
              {commandBlocks.map((b, i) => (
                <div key={i} className={styles.cmdGroup}>
                  {b.label && <div className={styles.cmdLabel}>{b.label}</div>}
                  <pre className={styles.codeBlock}>{b.code}</pre>
                  <div className={styles.btnRow}>
                    <button
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      onClick={() => handleCopy(b.code, i)}
                      disabled={busy}
                    >
                      {copiedIdx === i ? "✓ 복사됨" : "📋 복사"}
                    </button>
                  </div>
                </div>
              ))}
              {secondaryNote && <p className={styles.note}>※ {secondaryNote}</p>}
            </>
          ) : (
            <p className={styles.note}>
              이 항목은 정보성 뉴스입니다. 별도 설치/변경 없이 인식 처리할 수 있습니다.
            </p>
          )}

          {error && <p className={styles.errorMsg}>{error}</p>}
        </div>

        <div className={styles.footer}>
          {canDirectApply && (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => callEndpoint("/mark-applied")}
              disabled={busy}
            >
              ✓ 인식 완료로 표시
            </button>
          )}

          {!canDirectApply && !requiresQueue && (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => callEndpoint("/mark-applied")}
              disabled={busy}
            >
              ✓ Claude Code 에서 실행 완료 — 적용 표시
            </button>
          )}

          {requiresQueue && (
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => callEndpoint("/approve")}
              disabled={busy}
            >
              📥 Claude Code 큐잉 (다음 /news-watch 가 적용)
            </button>
          )}

          <button
            className={`${styles.btn} ${styles.btnDanger}`}
            onClick={() => callEndpoint("/ignore")}
            disabled={busy}
          >
            🚫 무시
          </button>
          <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose} disabled={busy}>
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

function stepEmoji(n) {
  const map = ["", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
  return map[n] || `${n}.`;
}

function extractRepoSlug(url) {
  // https://github.com/owner/name/... → owner/name
  const m = /github\.com\/([^/]+\/[^/?#]+)/i.exec(url || "");
  return m ? m[1].replace(/\.git$/, "") : "";
}

function guessPluginIdFromUrl(url) {
  // last path segment, lowercased, no special chars
  const m = /github\.com\/[^/]+\/([^/?#]+)/i.exec(url || "");
  if (!m) return "";
  return m[1].replace(/\.git$/, "").toLowerCase();
}

function guessSkillNameFromUrl(url) {
  return guessPluginIdFromUrl(url);
}
