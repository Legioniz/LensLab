import { forwardRef, useEffect, useRef } from "react";
import { renderSceneToCanvas } from "../engine/renderScene";
import { logError } from "../utils/logger";
import type { CameraProfile, CameraSettings, QualityMode, SceneDefinition } from "../types/camera";

interface Props {
  settings: CameraSettings;
  scene: SceneDefinition;
  camera: CameraProfile;
  quality: QualityMode;
  showGrid: boolean;
  animationsEnabled: boolean;
}

const SceneCanvas = forwardRef<HTMLCanvasElement, Props>(function SceneCanvas(
  { settings, scene, camera, quality, showGrid, animationsEnabled }, ref,
) {
  const internalRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastDrawRef = useRef(0);
  const renderFailedRef = useRef(false);
  const setRef = (node: HTMLCanvasElement | null) => {
    internalRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };

  useEffect(() => {
    let active = true;
    let drift = 0;
    renderFailedRef.current = false;
    const canvas = internalRef.current;
    const controller = new AbortController();
    if (!canvas) return;
    const draw = async (time: number) => {
      if (!active || !internalRef.current) return;
      if (time - lastDrawRef.current < 90 && scene.motion > 0.2 && animationsEnabled) {
        frameRef.current = requestAnimationFrame(draw);
        return;
      }
      lastDrawRef.current = time;
      drift = scene.motion > 0.2 && animationsEnabled ? Math.sin(time / 700) * 5 : 0;
      try {
        await renderSceneToCanvas(canvas, scene, settings, camera, {
          quality, showGrid, includeViewfinderOverlays: true, animateOffset: drift, signal: controller.signal,
        });
      } catch (error) {
        if (!renderFailedRef.current) logError("scene-render", "Scene rendering failed; fallback view is displayed.", error);
        renderFailedRef.current = true;
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = 1200;
          canvas.height = 800;
        }
        const fallback = canvas.getContext("2d");
        if (fallback) {
          fallback.fillStyle = "#101820";
          fallback.fillRect(0, 0, canvas.width, canvas.height);
          fallback.fillStyle = "#8bd3d4";
          fallback.font = "600 22px system-ui";
          fallback.textAlign = "center";
          fallback.fillText("SCENE UNAVAILABLE", (canvas.width || 1200) / 2, (canvas.height || 800) / 2 - 8);
          fallback.fillStyle = "#9aa9b6";
          fallback.font = "14px system-ui";
          fallback.fillText("Choose another scene or check the local scene assets.", (canvas.width || 1200) / 2, (canvas.height || 800) / 2 + 24);
        }
      }
      if (active && !renderFailedRef.current && scene.motion > 0.2 && animationsEnabled) frameRef.current = requestAnimationFrame(draw);
    };
    void draw(performance.now());
    return () => {
      active = false;
      controller.abort();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [settings, scene, camera, quality, showGrid, animationsEnabled]);

  return <canvas ref={setRef} className="scene-canvas" aria-label={`${scene.name} camera preview`} />;
});

export default SceneCanvas;
