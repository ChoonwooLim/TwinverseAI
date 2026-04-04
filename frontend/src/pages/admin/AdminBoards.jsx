import { useState, useEffect } from "react";
import api from "../../services/api";
import styles from "./AdminBoards.module.css";

const BOARD_PATH_MAP = { notice: "notice", qna: "qna", gallery: "gallery", video: "videos" };

export default function AdminBoards() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, size: 20 });
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get(`/api/admin/posts?page=${page}&size=20`).then((r) => setData(r.data)).catch(() => {});
  }, [page]);

  const handleDelete = async (postId, boardType) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/api/boards/${boardType}/${postId}`);
      api.get(`/api/admin/posts?page=${page}&size=20`).then((r) => setData(r.data));
    } catch { alert("삭제 실패"); }
  };

  const totalPages = Math.ceil(data.total / data.size);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>게시판 관리</h1>
      <table className={styles.table}>
        <thead><tr><th>ID</th><th>게시판</th><th>제목</th><th>작성자</th><th>조회</th><th>날짜</th><th>작업</th></tr></thead>
        <tbody>
          {data.items.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.board_type}</td>
              <td><a href={`/community/${BOARD_PATH_MAP[p.board_type] || p.board_type}/${p.id}`} className={styles.link}>{p.title}</a></td>
              <td>{p.author}</td>
              <td>{p.view_count}</td>
              <td>{new Date(p.created_at).toLocaleDateString("ko-KR")}</td>
              <td><button onClick={() => handleDelete(p.id, p.board_type)} className={styles.deleteBtn}>삭제</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`${styles.pageBtn} ${p === page ? styles.pageActive : ""}`} onClick={() => setPage(p)}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
