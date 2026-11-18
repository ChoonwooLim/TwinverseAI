import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import api from "../../services/api";
import { describeLoadError, describeProgress, mediaAspect, presetMediaUrl } from "../../data/presetMedia";
import styles from "./PresetDetail.module.css";

function PlayIcon() {
  return (
    <svg className={styles.playIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5Z" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className={styles.lockIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="5" y="10.5" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function FrameMessage({ message, onRetry, focusRef }) {
  return (
    <div ref={focusRef} tabIndex={-1} className={styles.frameMessage} role="alert">
      <p className={styles.frameMessageText}>{message}</p>
      {onRetry && (
        <button type="button" className={styles.retryButton} onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

/** Admin media the viewer may not load: no request is made, only a quiet placeholder. */
function LockedMedia({ signedIn }) {
  return (
    <div className={styles.locked}>
      <LockIcon />
      <p className={styles.lockedText}>관리자만 볼 수 있는 영상입니다.</p>
      {!signedIn && (
        <Link to="/login" className={styles.lockedLink}>
          로그인
        </Link>
      )}
    </div>
  );
}

function PublicVideo({ presetId, item }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return (
      <FrameMessage
        message="영상을 불러오지 못했습니다."
        onRetry={() => {
          setFailed(false);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  return (
    <video
      key={attempt}
      className={styles.video}
      src={presetMediaUrl(presetId, item.file, "public")}
      poster={item.poster ? presetMediaUrl(presetId, item.poster, "public") : undefined}
      controls
      preload="metadata"
      playsInline
      aria-label={item.title}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Admin media for an administrator: the poster is fetched with the bearer token on mount, the
 * video only when the viewer presses play. Both arrive as blobs behind object URLs, so the
 * files never get a public URL.
 */
function AdminVideo({ presetId, item }) {
  const posterSrc = item.poster ? presetMediaUrl(presetId, item.poster, "admin") : null;
  const videoSrc = presetMediaUrl(presetId, item.file, "admin");

  const [poster, setPoster] = useState(() => (posterSrc ? { status: "loading" } : { status: "absent" }));
  const [posterAttempt, setPosterAttempt] = useState(0);
  const [video, setVideo] = useState({ status: "idle" });
  const pending = useRef({ controller: null, urls: new Set() });
  const focusTarget = useRef(null);
  const userActed = useRef(false);

  useEffect(() => {
    if (!posterSrc) return undefined;
    let alive = true;
    let objectUrl = null;
    const controller = new AbortController();
    api
      .get(posterSrc, { responseType: "blob", signal: controller.signal })
      .then(({ data }) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(data);
        setPoster({ status: "ready", url: objectUrl });
      })
      .catch((err) => {
        if (!alive || axios.isCancel(err)) return;
        const status = err?.response?.status;
        // A missing poster is decoration only: keep the play button on a plain frame.
        setPoster(status === 404 ? { status: "absent" } : { status: "error", httpStatus: status });
      });
    return () => {
      alive = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [posterSrc, posterAttempt]);

  // Abort the video download and revoke every video object URL on unmount.
  useEffect(() => {
    const box = pending.current;
    return () => {
      box.controller?.abort();
      box.controller = null;
      box.urls.forEach((url) => URL.revokeObjectURL(url));
      box.urls.clear();
    };
  }, []);

  // Keep keyboard focus inside the frame as the play button gives way to progress, video or error.
  useEffect(() => {
    if (userActed.current) focusTarget.current?.focus({ preventScroll: true });
  }, [video.status]);

  const loadVideo = () => {
    userActed.current = true;
    const box = pending.current;
    box.controller?.abort();
    box.urls.forEach((url) => URL.revokeObjectURL(url));
    box.urls.clear();

    const controller = new AbortController();
    box.controller = controller;
    setVideo({ status: "loading", loaded: 0, total: 0 });

    api
      .get(videoSrc, {
        responseType: "blob",
        signal: controller.signal,
        onDownloadProgress: (event) => {
          if (controller.signal.aborted) return;
          setVideo((prev) =>
            prev.status === "loading" ? { status: "loading", loaded: event.loaded, total: event.total || 0 } : prev,
          );
        },
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        const url = URL.createObjectURL(data);
        box.urls.add(url);
        setVideo({ status: "ready", url });
      })
      .catch((err) => {
        if (controller.signal.aborted || axios.isCancel(err)) return;
        setVideo({ status: "error", httpStatus: err?.response?.status });
      })
      .finally(() => {
        if (box.controller === controller) box.controller = null;
      });
  };

  const retryPoster = () => {
    setPoster({ status: "loading" });
    setPosterAttempt((n) => n + 1);
  };

  const posterImage = poster.status === "ready" ? (
    <img className={styles.posterImage} src={poster.url} alt="" decoding="async" />
  ) : null;

  if (video.status === "ready") {
    return (
      <video
        ref={focusTarget}
        className={styles.video}
        src={video.url}
        poster={poster.status === "ready" ? poster.url : undefined}
        controls
        autoPlay
        playsInline
        aria-label={item.title}
        onError={() => setVideo({ status: "error", playback: true })}
      />
    );
  }

  if (video.status === "loading") {
    const progress = describeProgress(video.loaded, video.total);
    return (
      <>
        {posterImage}
        <div ref={focusTarget} tabIndex={-1} className={styles.loadingOverlay}>
          <span className={styles.srOnly} role="status">영상을 불러오는 중입니다.</span>
          <span className={styles.loadingText} aria-hidden="true">
            영상을 불러오는 중 · {progress.text}
          </span>
          <div
            className={`${styles.progressTrack} ${progress.percent === null ? styles.progressIndeterminate : ""}`}
            role="progressbar"
            aria-label={`${item.title} 내려받기`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent ?? undefined}
          >
            <span className={styles.progressFill} style={{ width: `${progress.percent ?? 30}%` }} />
          </div>
        </div>
      </>
    );
  }

  if (video.status === "error") {
    const error = video.playback
      ? { message: "영상을 재생하지 못했습니다.", retry: true }
      : describeLoadError(video.httpStatus, "video");
    return (
      <>
        {posterImage}
        <FrameMessage focusRef={focusTarget} message={error.message} onRetry={error.retry ? loadVideo : undefined} />
      </>
    );
  }

  if (poster.status === "loading") {
    return (
      <div className={styles.skeleton}>
        <span className={styles.srOnly} role="status">영상 미리보기를 불러오는 중입니다.</span>
      </div>
    );
  }

  if (poster.status === "error") {
    const error = describeLoadError(poster.httpStatus, "video");
    return <FrameMessage message={error.message} onRetry={error.retry ? retryPoster : undefined} />;
  }

  return (
    <>
      {posterImage}
      <button type="button" className={styles.playButton} onClick={loadVideo}>
        <span className={styles.playDisc}>
          <PlayIcon />
        </span>
        <span className={styles.playLabel}>
          재생<span className={styles.srOnly}>: {item.title}</span>
        </span>
      </button>
    </>
  );
}

/**
 * One media item with its title and caption. The frame reserves the item's aspect ratio in every
 * state, so nothing moves when a poster, a progress bar or the player appears.
 *
 * @param {{ presetId: string, item: import("../../data/productPresets").PresetMediaItem, canView: boolean, signedIn: boolean }} props
 */
export default function PresetMedia({ presetId, item, canView, signedIn }) {
  const titleId = useId();
  const isAdminMedia = item.access !== "public";

  let body;
  if (item.access === "public") body = <PublicVideo presetId={presetId} item={item} />;
  else if (item.access === "admin" && canView) body = <AdminVideo presetId={presetId} item={item} />;
  else body = <LockedMedia signedIn={signedIn} />;

  return (
    <figure className={styles.media} aria-labelledby={titleId}>
      <div className={styles.frame} style={{ aspectRatio: mediaAspect(item.aspect) }}>
        {body}
      </div>
      <figcaption className={styles.mediaCaption}>
        <div className={styles.mediaTitleRow}>
          <h3 id={titleId} className={styles.mediaTitle}>{item.title}</h3>
          {isAdminMedia && <span className={styles.adminBadge}>관리자 전용</span>}
        </div>
        {item.caption && <p className={styles.mediaText}>{item.caption}</p>}
      </figcaption>
    </figure>
  );
}
