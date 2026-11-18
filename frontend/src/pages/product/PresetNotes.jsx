import { useEffect, useState } from "react";
import axios from "axios";
import api from "../../services/api";
import { describeLoadError, parseNotes, presetMediaUrl } from "../../data/presetMedia";
import productStyles from "./Product.module.css";
import styles from "./PresetDetail.module.css";

/**
 * Administrator notes, fetched through the admin media endpoint. Render this only for viewers
 * who may view admin media: everyone else gets no block and no request.
 *
 * @param {{ presetId: string, notes: import("../../data/productPresets").PresetNotesRef, sectionId: string }} props
 */
export default function PresetNotes({ presetId, notes, sectionId }) {
  const url = presetMediaUrl(presetId, notes.file, "admin");
  const headingId = `${sectionId}-title`;
  const [state, setState] = useState({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    api
      .get(url, { responseType: "json", signal: controller.signal })
      .then(({ data }) => {
        if (!alive) return;
        const entries = parseNotes(data);
        setState(entries === null ? { status: "malformed" } : { status: "ready", entries });
      })
      .catch((err) => {
        if (!alive || axios.isCancel(err)) return;
        setState({ status: "error", httpStatus: err?.response?.status });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [url, attempt]);

  let body;
  if (state.status === "loading") {
    body = (
      <div className={styles.notesSkeleton}>
        <span className={styles.srOnly} role="status">메모를 불러오는 중입니다.</span>
        <span className={styles.skeletonLine} />
        <span className={styles.skeletonLine} />
      </div>
    );
  } else if (state.status === "error") {
    const error = describeLoadError(state.httpStatus, "notes");
    body = (
      <div className={styles.notesMessage} role="alert">
        <p className={styles.notesMessageText}>{error.message}</p>
        {error.retry && (
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            다시 시도
          </button>
        )}
      </div>
    );
  } else if (state.status === "malformed" || state.entries.length === 0) {
    body = (
      <div className={styles.notesMessage}>
        <p className={styles.notesMessageText}>
          {state.status === "malformed" ? "메모 파일의 형식이 올바르지 않습니다." : "표시할 메모가 없습니다."}
        </p>
      </div>
    );
  } else {
    body = (
      <ul className={styles.notesList} role="list">
        {state.entries.map((entry, index) => (
          <li key={`${index}-${entry.title}`} className={styles.note}>
            <h3 className={styles.itemTitle}>{entry.title}</h3>
            <p className={styles.itemText}>{entry.body}</p>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section id={sectionId} className={`${productStyles.section} ${styles.anchorTarget} ${styles.notes}`} aria-labelledby={headingId}>
      <div className={styles.sectionHead}>
        <h2 id={headingId} className={productStyles.sectionTitle}>{notes.title}</h2>
        <span className={styles.adminBadge}>관리자 전용</span>
      </div>
      {body}
    </section>
  );
}
