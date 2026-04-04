import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!token) return <Navigate to="/login" replace />;
  if (requiredRole && user?.role !== requiredRole && user?.role !== "superadmin") {
    return <Navigate to="/" replace />;
  }
  return children;
}
