import { Component } from "react";
import styles from "./RouteErrorBoundary.module.css";

export default class RouteErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isRoot = this.props.scope === "app";
    return (
      <section className={`${styles.recovery} ${isRoot ? styles.root : ""}`} role="alert">
        <p className={styles.eyebrow}>TwinverseAI</p>
        <h1>{isRoot ? "화면을 표시하지 못했습니다" : "페이지를 불러오지 못했습니다"}</h1>
        <p>
          새 버전 배포 또는 일시적인 연결 문제로 화면을 불러오지 못했을 수 있습니다.
          {!isRoot && " 상단 메뉴에서 다른 페이지로 이동할 수 있습니다."}
        </p>
        <p className={styles.notice}>
          자동으로 새로고침하지 않습니다. 최신 버전을 다시 불러오면 저장하지 않은 입력이나 진행 중인 연결이 초기화될 수 있습니다.
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          최신 버전 다시 불러오기
        </button>
      </section>
    );
  }
}
