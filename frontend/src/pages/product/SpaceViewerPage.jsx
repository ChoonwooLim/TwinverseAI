import { Link, useParams } from "react-router-dom";
import { findPresetCategory } from "../../data/productPresets";
import { getSpaceViewerKind, hasSpaceScene } from "../../spaces/registry";
import SpaceViewport from "../../spaces/SpaceViewport";
import SparkLodViewport from "../../spaces/spark-streaming-lod/SparkLodViewport";
import styles from "./Product.module.css";
import viewer from "./SpaceViewer.module.css";

const CATEGORY_SLUG = "3d-space";

const WALKABLE_CONTROLS = [
  ["이동", "W A S D 또는 방향키 (화면을 클릭해 선택한 뒤)"],
  ["달리기", "Shift를 누른 채 이동"],
  ["점프", "Space (지면에서). 낮은 턱이나 화단은 뛰어올라 넘습니다. 비행 중에는 Space/E가 상승입니다."],
  ["비행", "F 비행 전환 · Space/E 상승 · Q/C 하강 · Shift 빠르게. 공중에서 F를 누르면 아래 바닥으로 내려앉습니다."],
  ["아바타 숨김", "H 또는 '아바타 숨김' 버튼. 아바타를 숨기고 눈높이 1인칭 시점으로 둘러봅니다. 휠로 멀어지면 보이지 않는 몸 주위를 돌아보고, 끝까지 당기면 다시 눈높이로 돌아옵니다. 선택은 이 브라우저에 기억됩니다."],
  ["시점 회전", "마우스 드래그 · 터치는 한 손가락으로 끌기"],
  ["확대·축소", "마우스 휠(화면 선택 후) · 터치는 두 손가락 오므리기·벌리기"],
  ["조작 해제", "Esc"],
  ["시네마틱 투어", "건물 주위를 약 40초 동안 자동으로 비행합니다. 키를 누르거나 클릭하면 종료합니다."],
  ["사진 모드", "화면 UI를 숨기고 피사계 심도로 건물이나 아바타에 초점을 맞춘 뒤 PNG로 저장합니다. Esc로 종료합니다."],
  ["설정", "품질(최대·높음·균형), 노출, 성능 표시를 바꿉니다. 선택한 품질은 이 브라우저에 기억됩니다."],
];

const SPARK_LOD_CONTROLS = [
  ["월드 전환", "상단 탭에서 Coit Tower(40M), Jastrzębia Góra(100M), Hobbiton(24M), Cozy Spaceship(6M) 4개 월드를 즉시 전환합니다."],
  ["이동", "화면을 클릭한 뒤 W A S D 또는 방향키 · E 상승 · Q 하강"],
  ["속도 조절", "Shift 빠르게(×5) · Ctrl 느리게(×0.2)"],
  ["시점 회전", "마우스 왼쪽 드래그 · 터치는 한 손가락으로 끌기"],
  ["평행·전후 이동", "마우스 오른쪽 드래그(평행 이동) · 마우스 휠(전후 이동)"],
  ["LOD 설정", "상단 'LOD 설정'에서 스플랫 디테일 배율(0.1× ~ 2.5×)을 실시간으로 조절합니다."],
  ["조작 해제", "Esc"],
];

export default function SpaceViewerPage() {
  const { presetId } = useParams();
  const category = findPresetCategory(CATEGORY_SLUG);
  const preset = category?.items.find((item) => item.id === presetId);

  if (!preset || !hasSpaceScene(preset.scene)) {
    return (
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <span className={styles.overline}>Product · 3D 공간</span>
          <h1 className={styles.title}>찾을 수 없는 3D 공간입니다.</h1>
        </header>
        <Link to={`/product/${CATEGORY_SLUG}`} className={styles.textLink}>3D 공간 프리셋으로 돌아가기</Link>
      </div>
    );
  }

  const viewerKind = getSpaceViewerKind(preset.scene);
  const controls = viewerKind === "spark-lod" ? SPARK_LOD_CONTROLS : WALKABLE_CONTROLS;

  return (
    <div className={`${styles.page} ${viewer.page}`}>
      <header className={`${styles.pageHeader} ${viewer.header}`}>
        <span className={styles.overline}>Product · 3D 공간</span>
        <h1 className={styles.title}>{preset.name}</h1>
        <p className={styles.headerDesc}>{preset.summary}</p>
      </header>

      {viewerKind === "spark-lod" ? (
        <SparkLodViewport key={preset.id} sceneKey={preset.scene} title={preset.name} poster={preset.thumbnail} />
      ) : (
        <SpaceViewport key={preset.id} sceneKey={preset.scene} title={preset.name} poster={preset.thumbnail} />
      )}

      <section className={viewer.controls} aria-labelledby="space-controls">
        <h2 id="space-controls" className={styles.sectionTitle}>조작 방법</h2>
        <dl className={viewer.controlList}>
          {controls.map(([term, description]) => (
            <div key={term} className={viewer.controlRow}>
              <dt>{term}</dt>
              <dd>{description}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Link to={`/product/${CATEGORY_SLUG}`} className={styles.textLink}>3D 공간 프리셋 목록으로</Link>
    </div>
  );
}
