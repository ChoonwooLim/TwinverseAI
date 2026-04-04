import { useState, useEffect } from "react";
import api from "../../services/api";
import styles from "./AdminUsers.module.css";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  const loadUsers = () => {
    api.get("/api/admin/users").then((r) => setUsers(r.data)).catch(() => {});
  };

  useEffect(loadUsers, []);

  const changeRole = async (userId, role) => {
    try { await api.put(`/api/admin/users/${userId}/role`, { role }); loadUsers(); }
    catch (err) { alert(err.response?.data?.detail || "역할 변경 실패"); }
  };

  const toggleActive = async (userId, isActive) => {
    try { await api.put(`/api/admin/users/${userId}/active`, { is_active: !isActive }); loadUsers(); }
    catch { alert("상태 변경 실패"); }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>사용자 관리</h1>
      <table className={styles.table}>
        <thead>
          <tr><th>ID</th><th>사용자명</th><th>이메일</th><th>역할</th><th>상태</th><th>가입일</th><th>작업</th></tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td>
                <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)} className={styles.select}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
              </td>
              <td><span className={u.is_active ? styles.active : styles.inactive}>{u.is_active ? "활성" : "비활성"}</span></td>
              <td>{new Date(u.created_at).toLocaleDateString("ko-KR")}</td>
              <td><button onClick={() => toggleActive(u.id, u.is_active)} className={styles.toggleBtn}>{u.is_active ? "비활성화" : "활성화"}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
