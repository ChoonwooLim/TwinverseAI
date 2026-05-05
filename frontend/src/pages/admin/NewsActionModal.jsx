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
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const action = item.apply_action || { type: "info_only" };
  const type = action.type || "info_only";

  // Derive the commands to show + copy. Each apply_action.type has its own shape.
  const { primaryCommands, secondaryNote } = useMemo(() => {
    if (type === "install_plugin") {
      const marketplace = action.marketplace || extractRepoSlug(item.source_url);
      const pluginId = action.plugin_id || guessPluginIdFromUrl(item.source_url);
      const lines = [];
      if (marketplace) lines.push(`/plugin marketplace add ${marketplace}`);
      if (pluginId) lines.push(`/plugin install ${pluginId}`);
      return {
        primaryCommands: lines.join("\n"),
        secondaryNote: pluginId
          ? null
          : "정확한 plugin id 는 repo README 에서 확인이 필요할 수 있습니다.",
      };
    }
    if (type === "install_skill") {
      const repo = action.repo || item.source_url || "";
      const skillName = action.skill_name || guessSkillNameFromUrl(repo);
      const method = action.install_method || "clone";
      if (method === "marketplace") {
        return {
          primaryCommands: [
            `/plugin marketplace add ${extractRepoSlug(repo)}`,
            `/plugin install ${skillName}@${skillName}`,
          ].join("\n"),
          secondaryNote: null,
        };
      }
      return {
        primaryCommands: [
          `git clone --depth=1 ${repo} ~/.claude/skills/${skillName}`,
          `# SKILL.md 위치를 확인 후 폴더 정리 필요할 수 있음`,
        ].join("\n"),
        secondaryNote: "SKILL.md 가 repo 루트에 없으면 경로 수정 필요.",
      };
    }
    if (type === "edit_claude_md") {
      const section = action.section_title || "추가 섹션";
      const content = action.content_md || "";
      return {
        primaryCommands: `# ~/.claude/CLAUDE.md 에 다음 섹션 추가\n\n## ${section}\n\n${content}`,
        secondaryNote:
          "이 변경은 Claude Code 안에서 /news-watch 가 diff 를 보여드린 후 직접 적용합니다. 아래 [Claude Code 큐잉] 버튼을 누르세요.",
      };
    }
    if (type === "edit_settings") {
      const keys = action.keys || {};
      const lines = Object.entries(keys).map(([k, v]) => `${k} = ${JSON.stringify(v)}`);
      return {
        primaryCommands: `# settings.json 변경 제안\n${lines.join("\n")}`,
        secondaryNote:
          "settings.json 변경은 Claude Code 가 직접 적용해야 안전합니다. [Claude Code 큐잉] 버튼을 사용하세요.",
      };
    }
    return { primaryCommands: null, secondaryNote: null };
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

  async function handleCopy() {
    if (!primaryCommands) return;
    try {
      await navigator.clipboard.writeText(primaryCommands);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
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

          {primaryCommands ? (
            <>
              <div className={styles.cmdLabel}>
                {requiresQueue ? "변경 제안 (Claude Code 가 적용)" : "Claude Code 에서 실행:"}
              </div>
              <pre className={styles.codeBlock}>{primaryCommands}</pre>
              <div className={styles.btnRow}>
                <button
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={handleCopy}
                  disabled={busy}
                >
                  {copied ? "✓ 복사됨" : "📋 복사"}
                </button>
              </div>
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
