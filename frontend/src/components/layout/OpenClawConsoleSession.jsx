import { lazy, Suspense, useState, useSyncExternalStore } from "react";
import { useMatch } from "react-router-dom";

const AdminOpenClawConsole = lazy(() => import("../../pages/admin/AdminOpenClawConsole"));

function subscribeToAuthChanges(notify) {
  const onStorage = (event) => {
    if (!event.key || event.key === "token" || event.key === "user") notify();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function getAdminSession() {
  try {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!token || !["admin", "superadmin"].includes(user?.role)) return null;
    return JSON.stringify([token, user.id ?? user.username, user.role]);
  } catch {
    return null;
  }
}

function RetainedConsole({ active, tab }) {
  const [lastTab, setLastTab] = useState(active ? tab : null);
  if (active && lastTab !== tab) setLastTab(tab);
  if (lastTab === null) return null;

  // Keep effects (especially the chat socket) alive while another route is shown.
  // A hidden DOM subtree also preserves drafts, attachments and panel scroll.
  return (
    <div hidden={!active}>
      <Suspense fallback={<div>로딩 중…</div>}>
        <AdminOpenClawConsole tab={lastTab} active={active} />
      </Suspense>
    </div>
  );
}

export default function OpenClawConsoleSession() {
  const rootMatch = useMatch("/admin/openclaw-console");
  const tabMatch = useMatch("/admin/openclaw-console/:tab");
  const session = useSyncExternalStore(subscribeToAuthChanges, getAdminSession, () => null);

  // Same-tab login/logout navigates and re-renders this host; storage events
  // cover other tabs. Changing the session unmounts all private state/sockets.
  if (!session) return null;
  return (
    <RetainedConsole
      key={session}
      active={Boolean(rootMatch || tabMatch)}
      tab={tabMatch?.params.tab || "agents"}
    />
  );
}
