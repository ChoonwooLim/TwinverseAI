import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import api from "../../services/api";
import styles from "./AdminDesignMdDetail.module.css";

function PreviewDemo({ sample }) {
  return (
    <div className={styles.previewDemo}>
      <h4>{sample.name} 디자인 미리보기</h4>
      <p style={{ margin: 0 }}>
        이 컬러/폰트 토큰을 우리 데모 영역에 적용했습니다. 좌측 패널 안에서만 보입니다.
      </p>
      <button className={styles.previewDemoBtn}>샘플 버튼</button>
    </div>
  );
}

export default function AdminDesignMdDetail() {
  const { slug } = useParams();
  const [sample, setSample] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [iframeError, setIframeError] = useState(false);
  const [tokenPreview, setTokenPreview] = useState(false);
  const [toast, setToast] = useState(null);
  const iframeTimeoutRef = useRef(null);

  useEffect(() => {
    setSample(null);
    setLoadError(null);
    setIframeError(false);
    api
      .get(`/api/design-md/${slug}`)
      .then((r) => setSample(r.data))
      .catch((e) => setLoadError(e.response?.status === 404 ? "not_found" : "error"));
  }, [slug]);

  useEffect(() => {
    if (!sample || iframeError) return;
    iframeTimeoutRef.current = setTimeout(() => {
      setIframeError(true);
    }, 8000);
    return () => clearTimeout(iframeTimeoutRef.current);
  }, [sample, iframeError]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const copyMd = async () => {
    try {
      await navigator.clipboard.writeText(sample.design_md);
      showToast("DESIGN.md 가 클립보드에 복사되었습니다");
    } catch (e) {
      showToast("복사 실패: " + e.message);
    }
  };

  const downloadMd = () => {
    const blob = new Blob([sample.design_md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DESIGN-${sample.slug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loadError === "not_found") {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <h2>디자인 샘플을 찾을 수 없습니다</h2>
          <p>
            <Link to="/admin/design-md">← 목록으로</Link>
          </p>
        </div>
      </div>
    );
  }

  if (loadError === "error") {
    return (
      <div className={styles.page}>
        <div className={styles.notFound}>
          <h2>디자인 샘플 로드 중 오류가 발생했습니다</h2>
          <p>
            <Link to="/admin/design-md">← 목록으로</Link>
          </p>
        </div>
      </div>
    );
  }

  if (!sample) {
    return (
      <div className={styles.page}>
        <p style={{ color: "rgba(255,255,255,0.5)" }}>로딩 중...</p>
      </div>
    );
  }

  const hasColorTokens = (sample.color_tokens || []).length > 0;

  const tokenPreviewStyle = tokenPreview
    ? {
        "--preview-primary": sample.color_tokens?.[0],
        "--preview-bg": sample.color_tokens?.[1],
        "--preview-accent": sample.color_tokens?.[2],
        "--preview-text": sample.color_tokens?.[3] || "#fff",
        fontFamily: sample.font_tokens?.[0] || "inherit",
      }
    : {};

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        <Link to="/admin/design-md">디자인샘플</Link> / {sample.name}
      </div>
      <div className={styles.headRow}>
        <h1 className={styles.title}>{sample.name}</h1>
        {sample.category && <span className={styles.chip}>{sample.category}</span>}
      </div>
      <p className={styles.tagline}>{sample.tagline}</p>
      <div className={styles.actions}>
        <button onClick={copyMd}>📋 마크다운 복사</button>
        <button onClick={downloadMd}>⬇️ DESIGN.md 다운로드</button>
        <button
          onClick={() => setTokenPreview((v) => !v)}
          disabled={!hasColorTokens}
          title={!hasColorTokens ? "이 디자인의 색상 토큰을 자동 추출하지 못했습니다" : ""}
        >
          🎨 토큰 프리뷰 {tokenPreview ? "ON" : "OFF"}
        </button>
        <a href={sample.getdesign_url} target="_blank" rel="noreferrer">
          getdesign.md ↗
        </a>
        <a href={sample.github_url} target="_blank" rel="noreferrer">
          GitHub ↗
        </a>
      </div>

      <div className={styles.split}>
        <div className={styles.mdPane} style={tokenPreviewStyle}>
          {tokenPreview && <PreviewDemo sample={sample} />}
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{sample.design_md}</ReactMarkdown>
        </div>

        <div className={styles.iframeWrap}>
          {iframeError ? (
            <div className={styles.iframeFallback}>
              <p>외부 사이트를 임베드할 수 없습니다.</p>
              <a href={sample.getdesign_url} target="_blank" rel="noreferrer">
                새 창에서 열기 ↗
              </a>
            </div>
          ) : (
            <iframe
              className={styles.iframe}
              src={sample.getdesign_url}
              title={`${sample.name} on getdesign.md`}
              sandbox="allow-scripts allow-same-origin allow-popups"
              loading="lazy"
              onLoad={() => clearTimeout(iframeTimeoutRef.current)}
              onError={() => setIframeError(true)}
            />
          )}
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
