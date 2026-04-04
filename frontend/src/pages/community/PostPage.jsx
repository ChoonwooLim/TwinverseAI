import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import PostDetail from "../../components/board/PostDetail";
import PostForm from "../../components/board/PostForm";
import CommentSection from "../../components/board/CommentSection";
import styles from "./PostPage.module.css";

const BOARD_TYPE_MAP = {
  notice: "notice",
  qna: "qna",
  gallery: "gallery",
  videos: "video",
};

export default function PostPage() {
  const { boardType, postId } = useParams();
  const navigate = useNavigate();
  const apiType = BOARD_TYPE_MAP[boardType] || boardType;
  const isNew = postId === "new";
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api.get(`/api/boards/${apiType}/${postId}`)
      .then((r) => setPost(r.data))
      .catch(() => navigate(`/community/${boardType}`))
      .finally(() => setLoading(false));
  }, [apiType, postId]);

  const handleCreate = async (data, files) => {
    setSubmitting(true);
    try {
      const res = await api.post(`/api/boards/${apiType}`, data);
      const newPostId = res.data.id;
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        await api.post(`/api/files/upload?post_id=${newPostId}`, formData);
      }
      navigate(`/community/${boardType}/${newPostId}`);
    } catch (err) {
      alert(err.response?.data?.detail || "작성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (data) => {
    setSubmitting(true);
    try {
      await api.put(`/api/boards/${apiType}/${postId}`, data);
      navigate(`/community/${boardType}/${postId}`);
    } catch (err) {
      alert(err.response?.data?.detail || "수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await api.delete(`/api/boards/${apiType}/${postId}`);
      navigate(`/community/${boardType}`);
    } catch { alert("삭제에 실패했습니다."); }
  };

  if (loading) return <p className={styles.loading}>로딩 중...</p>;

  if (isNew) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>새 글 작성</h1>
        <PostForm boardType={apiType} onSubmit={handleCreate} loading={submitting} />
      </div>
    );
  }

  if (!post) return null;

  const isEditing = window.location.pathname.endsWith("/edit");
  if (isEditing) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>글 수정</h1>
        <PostForm boardType={apiType} initial={post} onSubmit={(data) => handleUpdate(data)} loading={submitting} />
      </div>
    );
  }

  const canEdit = user && (post.author_id === user.id || user.role === "admin" || user.role === "superadmin");

  return (
    <div className={styles.page}>
      <button onClick={() => navigate(`/community/${boardType}`)} className={styles.backBtn}>목록으로</button>
      <PostDetail post={post} canEdit={canEdit} onDelete={handleDelete} />
      <CommentSection postId={post.id} />
    </div>
  );
}
