import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import styles from "./PostDetail.module.css";

export default function PostDetail({ post, onDelete, canEdit }) {
  const navigate = useNavigate();

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
      {post.files && post.files.length > 0 && (
        <div className={styles.files}>
          <h3 className={styles.filesTitle}>첨부파일</h3>
          <div className={styles.fileList}>
            {post.files.map((f) =>
              f.file_type === "image" ? (
                <img key={f.id} src={f.stored_path} alt={f.original_name} className={styles.image} />
              ) : (
                <a key={f.id} href={f.stored_path} download className={styles.fileLink}>
                  {f.original_name} ({(f.file_size / 1024).toFixed(0)}KB)
                </a>
              )
            )}
          </div>
        </div>
      )}
      {canEdit && (
        <div className={styles.actions}>
          <button onClick={() => navigate(`edit`)} className={styles.editBtn}>수정</button>
          <button onClick={onDelete} className={styles.deleteBtn}>삭제</button>
        </div>
      )}
    </article>
  );
}
