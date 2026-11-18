// World-space segments that must hit solid scenery once it is loaded (the engine warns once if one
// does not): the gate's stone base and palace wall, its roof, and the heritage pieces. Plain data in
// its own module so the asset pipeline (scripts/spaces) can check optimised files against it.
export const COLLISION_PROBES = Object.freeze([
  { name: "gate base west", from: [-14, 3, 280], to: [-14, 3, 320] },
  { name: "gate base east", from: [14, 3, 280], to: [14, 3, 320] },
  { name: "gate roof", from: [0, 40, 300], to: [0, -3, 300] },
  { name: "palace wall west", from: [-30, 3, 280], to: [-30, 3, 320] },
  { name: "palace wall east", from: [30, 3, 280], to: [30, 3, 320] },
  { name: "haetae east", from: [42, 1.5, 82], to: [42, 1.5, 102] },
  { name: "haetae west", from: [-42, 1.5, 82], to: [-42, 1.5, 102] },
  { name: "pagoda west", from: [-155, 2, 52], to: [-155, 2, 38] },
  { name: "pagoda east", from: [-155, 2, 22], to: [-155, 2, 33] },
  { name: "stone lantern", from: [-162, 1.2, 30], to: [-162, 1.2, 46] },
  { name: "sundial", from: [151, 0.6, 30], to: [151, 0.6, 46] },
]);
