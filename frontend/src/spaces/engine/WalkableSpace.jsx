/**
 * React wrapper around SpaceEngine (three.js r187 WebGPURenderer). Lives in the lazily loaded
 * scene chunk; spaces such as NationalAssemblyScene pass their bundled assets through `assets`.
 *
 * Props: see the comment at the top of national-assembly/NationalAssemblyScene.jsx.
 */
import { useEffect, useImperativeHandle, useRef } from "react";
import { useReducedMotion } from "../useMediaQuery";
import { SpaceEngine } from "./SpaceEngine";

const CALLBACKS = [
  "onProgress",
  "onReady",
  "onQualityChange",
  "onStats",
  "onTourChange",
  "onError",
  "onDeviceLost",
  "onNotice",
  "onScenery",
  "onVegetation",
  "onFlightChange",
  "onQualityApplying",
];

export default function WalkableSpace({
  assets,
  className,
  style,
  interactive = true,
  zoomEnabled = true,
  keysRef = null,
  apiRef = null,
  quality = null,
  exposure = 1,
  photoMode = null,
  showStats = false,
  avatarHidden = false,
  autoQuality = true,
  ...handlers
}) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const latestRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const photoFocus = photoMode ? photoMode.focus ?? "building" : null;

  // Latest props for the engine's callbacks and its construction (refs are written in effects).
  useEffect(() => {
    latestRef.current = { interactive, zoomEnabled, keysRef, quality, exposure, reducedMotion, avatarHidden, autoQuality, handlers };
  });

  useEffect(() => {
    const container = containerRef.current;
    const initial = latestRef.current ?? {};
    const callbacks = {};
    for (const name of CALLBACKS) {
      callbacks[name] = (...args) => latestRef.current?.handlers?.[name]?.(...args);
    }
    const engine = new SpaceEngine({
      container,
      assets,
      callbacks,
      interactive: initial.interactive ?? true,
      reducedMotion: Boolean(initial.reducedMotion),
      keysRef: initial.keysRef ?? null,
      quality: initial.quality ?? null,
      exposure: initial.exposure ?? 1,
      avatarHidden: Boolean(initial.avatarHidden),
      autoQuality: initial.autoQuality !== false,
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [assets]);

  useEffect(() => {
    engineRef.current?.setInteractive(interactive);
  }, [interactive]);

  useEffect(() => {
    engineRef.current?.setZoomEnabled(zoomEnabled);
  }, [zoomEnabled]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.keysRef = keysRef;
  }, [keysRef]);

  useEffect(() => {
    if (quality) engineRef.current?.setQuality(quality);
  }, [quality]);

  useEffect(() => {
    engineRef.current?.setExposure(exposure);
  }, [exposure]);

  useEffect(() => {
    engineRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    engineRef.current?.setPhotoMode(photoFocus ? { focus: photoFocus } : null);
  }, [photoFocus]);

  useEffect(() => {
    engineRef.current?.setStatsEnabled(showStats);
  }, [showStats]);

  useEffect(() => {
    engineRef.current?.setAvatarHidden(avatarHidden);
  }, [avatarHidden]);

  useEffect(() => {
    engineRef.current?.setAutoQuality(autoQuality);
  }, [autoQuality]);

  useImperativeHandle(
    apiRef,
    () => ({
      reset: () => engineRef.current?.reset(),
      setQuality: (key) => engineRef.current?.setQuality(key),
      startTour: () => engineRef.current?.startTour(),
      stopTour: () => engineRef.current?.stopTour(),
      toggleFlight: () => engineRef.current?.toggleFlight(),
      capture: () => engineRef.current?.capture() ?? Promise.reject(new Error("not ready")),
      captureStations: () => engineRef.current?.assets?.captureStations ?? [],
      captureStation: (station, options) => engineRef.current?.captureStation(station, options) ?? Promise.reject(new Error("not ready")),
      leaveCapture: () => engineRef.current?.leaveCapture(),
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }}
    />
  );
}
