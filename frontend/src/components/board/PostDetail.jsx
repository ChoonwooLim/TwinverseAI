import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import styles from "./PostDetail.module.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function PostDetail({ post, onDelete, canEdit }) {
  const navigate = useNavigate();
  const [lightbox, setLightbox] = useState(null);

  const images = post.files?.filter((f) => f.file_type === "image") || [];
  const otherFiles = post.files?.filter((f) => f.file_type !== "image") || [];

  return (
    <article className={styles.detail}>
      <header className={styles.header}>
        <h1 className={styles.title}>{post.title}</h1>
        <div className={styles.meta}>
          <span>{post.author}</span>
          <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
          <span>조회 {post.view_count}</span>
        </div>
      </header>

      {/* Gallery images — large display */}
      {images.length > 0 && (
        <div className={styles.gallery}>
          {images.map((f, idx) => (
            <div key={f.id} className={styles.galleryItem} onClick={() => setLightbox(idx)}>
              <img src={`${API_BASE}${f.stored_path}`} alt={f.original_name} className={styles.galleryImage} loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && (
        <div className={styles.lightbox} onClick={() => setLightbox(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightbox(null)} aria-label="닫기">&times;</button>
          {lightbox > 0 && (
            <button className={styles.lightboxPrev} onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }} aria-label="이전">&#8249;</button>
          )}
          <img
            src={`${API_BASE}${images[lightbox].stored_path}`}
            alt={images[lightbox].original_name}
            className={styles.lightboxImage}
            onClick={(e) => e.stopPropagation()}
          />
          {lightbox < images.length - 1 && (
            <button className={styles.lightboxNext} onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }} aria-label="다음">&#8250;</button>
          )}
          <div className={styles.lightboxCaption}>
            {images[lightbox].original_name} ({lightbox + 1}/{images.length})
          </div>
        </div>
      )}

      {post.video_url && (
        <div className={styles.video}>
          {post.video_url.includes("youtube") || post.video_url.includes("youtu.be") ? (
            <iframe src={post.video_url.replace("watch?v=", "embed/")} title={post.title} allowFullScreen className={styles.iframe} />
          ) : (
            <video src={post.video_url} controls className={styles.videoPlayer} />
          )}
        </div>
      )}

      <div className={styles.content}>
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>

      {otherFiles.length > 0 && (
        <div className={styles.files}>
          <h3 className={styles.filesTitle}>첨부파일</h3>
          <div className={styles.fileList}>
            {otherFiles.map((f) => (
              <a key={f.id} href={`${API_BASE}${f.stored_path}`} download className={styles.fileLink}>
                {f.original_name} ({(f.file_size / 1024).toFixed(0)}KB)
              </a>
            ))}
          </div>
        </div>
      )}

      {canEdit && (
        <div className={styles.actions}>
          <button onClick={() => navigate("edit")} className={styles.editBtn}>수정</button>
          <button onClick={onDelete} className={styles.deleteBtn}>삭제</button>
        </div>
      )}
    </article>
  );
}
