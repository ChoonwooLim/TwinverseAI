/**
 * Product preset library: single source of truth for the /product pages,
 * the Product sidebar and the page metadata.
 *
 * To add a preset, add an object to the category's `items` array and it appears as a card.
 * This module is part of the main bundle: it may import image URLs, never three.js or a scene.
 *
 * @typedef {Object} PresetItem
 * @property {string} id        Unique within its category, lowercase-hyphen (e.g. "night-city-dolly-in").
 * @property {string} name      Display name.
 * @property {string} summary   One or two sentences on what the preset is for.
 * @property {string} [tool]    Tool or model the preset is made for.
 * @property {string[]} [tags]  Short keywords.
 * @property {string} [thumbnail] Image URL: an imported asset (content-hashed by Vite) or a path under /public.
 * @property {string} [source]  Path or URL of the source asset (e.g. a three.js scene module or a .glb file). Shown as text only, never loaded.
 * @property {string} [updatedAt] Last update date, YYYY-MM-DD.
 * @property {string} [scene]   Key in src/spaces/registry.js when the preset has an openable 3D scene;
 *                              the card then links to /product/{category}/{id}. Only used in "3d-space".
 */

/**
 * @typedef {Object} PresetCategory
 * @property {string} slug      URL segment: /product/{slug}.
 * @property {string} label     Display name.
 * @property {string} desc      One-line description of the category.
 * @property {string[]} holds   What a preset in this category contains.
 * @property {PresetItem[]} items
 */

// Preview images are imported through Vite (content-hashed, long-cached). The glob form keeps this
// main-bundle module and its tests working while a space's assets are still being produced.
const thumbnails = import.meta.glob("../spaces/*/assets/thumbnail.jpg", { eager: true, query: "?url", import: "default" });
const nationalAssemblyThumbnail = thumbnails["../spaces/national-assembly/assets/thumbnail.jpg"];

/** @type {PresetCategory[]} */
export const PRESET_CATEGORIES = [
  {
    slug: "video",
    label: "동영상 프리셋",
    desc: "영상 제작에 반복해서 쓰는 장면·카메라 워크·스타일 프롬프트와 생성 설정을 모읍니다.",
    holds: ["장면·카메라 워크 프롬프트", "모델·해상도·길이 등 생성 설정", "참고 영상과 결과물"],
    items: [],
  },
  {
    slug: "image",
    label: "이미지 프리셋",
    desc: "키 비주얼·썸네일·배경 이미지 생성에 쓰는 스타일·구도·조명 설정을 모읍니다.",
    holds: ["스타일·구도·조명 프롬프트", "모델·비율·해상도 설정", "참고 이미지와 결과물"],
    items: [],
  },
  {
    slug: "character",
    label: "캐릭터 프리셋",
    desc: "영상과 웹사이트에 일관되게 등장하는 인물·마스코트의 외형과 성격 설정을 모읍니다.",
    holds: ["외형·의상·표정 기준 이미지", "성격·말투·목소리 설정", "일관성 유지를 위한 참조 시트"],
    items: [],
  },
  {
    slug: "3d-space",
    label: "3D 공간 프리셋",
    desc: "three.js로 만든 3D 공간과 장면을 보관해 두고, 이후 영상 제작과 웹사이트 구축에서 골라 쓸 수 있게 모읍니다.",
    holds: ["three.js 장면 구성 (카메라·조명·환경)", "GLB 모델·텍스처 등 에셋 경로", "미리보기 이미지와 적용 대상"],
    items: [
      {
        id: "national-assembly",
        name: "여의도 국회의사당",
        summary:
          "아바타로 국회의사당과 앞마당을 걸어서 둘러보는 3D 공간입니다. Blender로 모델링하고 three.js로 렌더링했으며, 측량 자료가 아닌 비례 모형이라 세부 치수는 실제와 다릅니다.",
        tool: "Blender 5.2 · three.js r187",
        tags: ["건축", "야외", "WASD 이동"],
        thumbnail: nationalAssemblyThumbnail,
        source: "frontend/src/spaces/national-assembly",
        updatedAt: "2026-11-18",
        scene: "national-assembly",
      },
    ],
  },
  {
    slug: "audio",
    label: "오디오 프리셋",
    desc: "배경 음악·효과음·내레이션 음성 제작에 쓰는 설정을 모읍니다.",
    holds: ["음악 장르·분위기 프롬프트", "효과음 구성", "내레이션 음성·톤 설정"],
    items: [],
  },
  {
    slug: "website",
    label: "웹사이트 프리셋",
    desc: "웹사이트 구축에 반복해서 쓰는 섹션 구성·디자인 토큰·컴포넌트 조합을 모읍니다.",
    holds: ["페이지·섹션 구성", "컬러·타이포 등 디자인 토큰", "컴포넌트 조합과 적용 예"],
    items: [],
  },
];

/**
 * @param {string | undefined} slug
 * @returns {PresetCategory | undefined}
 */
export function findPresetCategory(slug) {
  return PRESET_CATEGORIES.find((category) => category.slug === slug);
}
