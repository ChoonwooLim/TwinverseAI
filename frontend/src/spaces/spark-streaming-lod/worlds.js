/**
 * Streaming LoD 3D Gaussian Splatting worlds (from SparkJS 2.0 examples/streaming-lod).
 * Pure data module — never imports three.js or SparkJS.
 */

export const INITIAL_WORLD_KEY = "coit-tower";

export const STREAMING_LOD_WORLDS = [
  {
    key: "coit-tower",
    label: "Coit Tower, SF",
    badge: "40M",
    url: "https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/coit-40m-sh1-lod.rad",
    quaternion: [1, 0, 0, 0],
    position: [0, 0, 0],
    scale: 10.0,
    cameraPosition: [-0.858, 2.203, -1.128],
    cameraQuaternion: [-0.043, -0.909, -0.097, 0.402],
    background: "#cafefe",
    lodSplatScale: 1.5,
    highDpiOnDesktop: true,
    description: "샌프란시스코 코이트 타워 · 4,000만 스플랫 (Vincent Woo 실사 스캔)",
  },
  {
    key: "poland",
    label: "Jastrzębia Góra",
    badge: "100M",
    url: "https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/poland-lod.rad",
    quaternion: [1, 0, 0, 0],
    position: [0, 0, 0],
    scale: 0.05,
    cameraPosition: [43.7, -3.5, -1.7],
    cameraQuaternion: [-0.23, 0.241, 0.006, 0.943],
    background: "#cafefe",
    lodSplatScale: 1.0,
    highDpiOnDesktop: true,
    description: "폴란드 해안 마을 · 1억 스플랫 (Andrii Shramko 실사 스캔)",
  },
  {
    key: "hobbiton",
    label: "Hobbiton",
    badge: "24M",
    url: "https://storage.googleapis.com/forge-dev-public/asundqui/rad/260219/tijerin_w6_hobbiton-lod.rad",
    quaternion: [1, 0, 0, 0],
    position: [0, 0, 0],
    scale: 1.0,
    cameraPosition: [0, 0, 0],
    cameraQuaternion: [0, 0, 0, 1],
    background: "#cafefe",
    lodSplatScale: 1.0,
    highDpiOnDesktop: false,
    description: "호비튼 마을 · 2,400만 스플랫 (Tijerin · World Labs Marble)",
  },
  {
    key: "cozy-spaceship",
    label: "Cozy Spaceship",
    badge: "6M",
    url: "https://storage.googleapis.com/forge-dev-public/asundqui/rad/260217/cozy-spaceship_2-lod.rad",
    quaternion: [0, 0, 0, 1],
    position: [0, -6.5, 0],
    scale: 1.0,
    cameraPosition: [0, 0, 0],
    cameraQuaternion: [0, 0, 0, 1],
    background: "#000000",
    lodSplatScale: 1.0,
    highDpiOnDesktop: false,
    description: "아늑한 우주선 실내 · 600만 스플랫 (Britt Casado · World Labs Marble)",
  },
];

export function findStreamingWorld(key) {
  return STREAMING_LOD_WORLDS.find((w) => w.key === key) ?? STREAMING_LOD_WORLDS[0];
}
