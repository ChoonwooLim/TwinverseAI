import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import PostList from "../../components/board/PostList";
import styles from "./BoardPage.module.css";

const BOARD_LABELS = {
  notice: "공지사항",
  qna: "Q&A",
  gallery: "이미지 갤러리",
  videos: "동영상",
};

const BOARD_TYPE_MAP = {
  notice: "notice",
  qna: "qna",
  gallery: "gallery",
  videos: "video",
};

export default function BoardPage() {
  const { boardType } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parseInt(searchParams.get("page") || "1", 10);
  const [data, setData] = useState({ items: [], total: 0, page: 1, size: 20 });
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const apiType = BOARD_TYPE_MAP[boardType] || boardType;
  const label = BOARD_LABELS[boardType] || boardType;

  const canWrite = token && (boardType !== "notice" || user?.role === "admin" || user?.role === "superadmin");

  useEffect(() => {
    setLoading(true);
    api.get(`/api/boards/${apiType}?page=${page}&size=20`)
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiType, page]);

  const totalPages = Math.ceil(data.total / data.size);

  return (
    <div className={styles.board}>
      <div className={styles.header}>
        <h1 className={styles.title}>{label}</h1>
        {canWrite && (
          <button onClick={() => navigate(`/community/${boardType}/new`)} className={styles.writeBtn}>글쓰기</button>
        )}
      </div>
      {loading ? (
        <p className={styles.loading}>로딩 중...</p>
      ) : data.items.length === 0 ? (
        <p className={styles.empty}>게시물이 없습니다.</p>
      ) : (
        <PostList posts={data.items} boardType={apiType} basePath={`/community/${boardType}`} />
      )}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`${styles.pageBtn} ${p === page ? styles.pageActive : ""}`} onClick={() => setSearchParams({ page: p.toString() })}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
