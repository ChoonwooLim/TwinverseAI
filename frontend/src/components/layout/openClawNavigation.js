export const OPENCLAW_ITEMS = [
  { label: "개요 / 랜딩", path: "/admin/openclaw" },
  { label: "콘솔", path: "/admin/openclaw-console" },
  { label: "에이전트", path: "/admin/openclaw-console/agents" },
  { label: "플러그인", path: "/admin/openclaw-console/plugins" },
  { label: "설정", path: "/admin/openclaw-console/config" },
  { label: "토큰", path: "/admin/openclaw-console/token" },
  { label: "채팅", path: "/admin/openclaw-console/chat" },
  { label: "로그", path: "/admin/openclaw-console/logs" },
  { label: "디바이스 페어링", path: "/admin/openclaw-devices" },
];

export function isOpenClawPath(pathname) {
  return OPENCLAW_ITEMS.some(({ path }) => pathname === path || pathname.startsWith(`${path}/`));
}
