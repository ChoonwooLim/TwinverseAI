import { useState } from "react";
import FileUpload from "./FileUpload";
import styles from "./PostForm.module.css";

export default function PostForm({ boardType, initial, onSubmit, loading }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [videoUrl, setVideoUrl] = useState(initial?.video_url || "");
  const [files, setFiles] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ title, content, video_url: videoUrl || null }, files);
  };

  const showVideo = boardType === "video";
  const showFiles = boardType === "gallery" || boardType === "video";

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <input type="text" placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} className={styles.input} required />
      <textarea placeholder="내용 (마크다운 지원)" value={content} onChange={(e) => setContent(e.target.value)} className={styles.textarea} rows={12} />
      {showVideo && (
        <input type="url" placeholder="동영상 URL (YouTube 등)" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={styles.input} />
      )}
      {showFiles && <FileUpload accept={boardType === "gallery" ? "image/*" : "video/*,image/*"} files={files} onChange={setFiles} />}
      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? "저장 중..." : initial ? "수정" : "작성"}
      </button>
    </form>
  );
}
