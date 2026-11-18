// Fixed camera stations for before/after review captures (?capture=1). Positions are world metres;
// the surfaces were located with the camera collision structures on the delivered files (gate
// door plane z 303.7, stone base z 304.9, name board z 302.4 between y 12.5 and 14.5, Haetae front
// z 92.6, Assembly entrance z 49.2, column-02 front z 59.6) and the plants are instances from
// vegetation.json.
export const CAPTURE_STATIONS = Object.freeze([
  { id: "spawn", label: "처음 위치 (광화문 앞)", eye: [-0.01, 1.85, 353.4], target: [0, 1.25, 344] },
  { id: "name-board", label: "현판과 단청 처마 (6 m)", eye: [0, 12, 309], target: [0, 13.2, 302.6] },
  { id: "door-leaf", label: "문짝 (2 m)", eye: [-1.3, 1.6, 305.7], target: [-1.3, 2.4, 303.7] },
  { id: "stone-base", label: "석축 질감 (1 m)", eye: [-12, 1.5, 305.9], target: [-12, 1.4, 304.9] },
  { id: "haetae", label: "해태 (3 m)", eye: [42, 1.6, 95.6], target: [42, 1.5, 90] },
  { id: "entrance", label: "국회의사당 입구 (4 m)", eye: [0, 6.7, 53.2], target: [0, 7.2, 49.2] },
  { id: "column-base", label: "기둥 하부", eye: [-57.5, 6.2, 62.6], target: [-57.5, 5.6, 59.6] },
  { id: "pine", label: "소나무 (5 m)", eye: [-100, 1.7, 267], target: [-100, 5, 262] },
  { id: "broadleaf", label: "활엽수 (5 m)", eye: [-33, 1.7, 225], target: [-38, 4.5, 225] },
  { id: "hedge", label: "생울타리 (2 m)", eye: [-19.3, 1.3, 288.6], target: [-21.3, 0.8, 288.6] },
  { id: "pool", label: "연못 반사", eye: [0, 1.7, 241], target: [0, 0.3, 216] },
  { id: "avenue", label: "진입로 원경", eye: [0, 1.7, 520], target: [0, 7, 300] },
]);
