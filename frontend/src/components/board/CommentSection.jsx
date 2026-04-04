import { useState, useEffect } from "react";
import api from "../../services/api";
import styles from "./CommentSection.module.css";

export default function CommentSection({ postId }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => { loadComments(); }, [postId]);

  const loadComments = async () => {
    try { const res = await api.get(`/api/comments/${postId}`); setComments(res.data); } catch { /* ignore */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    try { await api.post(`/api/comments/${postId}`, { content: text }); setText(""); loadComments(); }
    catch { alert("댓글 작성에 실패했습니다."); }
    finally { setLoading(false); }
  };

  const handleDelete = async (commentId) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try { await api.delete(`/api/comments/${commentId}`); loadComments(); }
    catch { alert("삭제에 실패했습니다."); }
  };

  const canDelete = (c) => user && (c.author_id === user.id || user.role === "admin" || user.role === "superadmin");

  return (
    <section className={styles.section}>
      <h3 className={styles.title}>댓글 ({comments.length})</h3>
      <ul className={styles.list}>
        {comments.map((c) => (
          <li key={c.id} className={styles.item}>
            <div className={styles.commentHeader}>
              <strong className={styles.author}>{c.author}</strong>
              <span className={styles.date}>{new Date(c.created_at).toLocaleDateString("ko-KR")}</span>
              {canDelete(c) && <button onClick={() => handleDelete(c.id)} className={styles.deleteBtn}>삭제</button>}
            </div>
            <p className={styles.commentText}>{c.content}</p>
          </li>
        ))}
      </ul>
      {token && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <textarea placeholder="댓글을 입력하세요" value={text} onChange={(e) => setText(e.target.value)} className={styles.textarea} rows={3} />
          <button type="submit" className={styles.submitBtn} disabled={loading}>{loading ? "등록 중..." : "댓글 등록"}</button>
        </form>
      )}
    </section>
  );
}
