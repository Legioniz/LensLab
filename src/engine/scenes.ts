import type { SceneDefinition } from "../types/camera";

export const scenes: SceneDefinition[] = [
  {
    id: "portrait", name: "Portrait study", category: "PEOPLE", description: "Soft outdoor daylight with a clear subject plane.",
    background: "/scenes/portrait-bg.svg", subject: "/scenes/portrait-subject.svg", sceneEv100: 8.95, subjectDistanceM: 2.5, motion: 0.05,
    recommended: { aperture: 5.6, shutter: 1 / 60, iso: 400, focalLength: 50, focusDistance: 2.5 },
    tip: "For portraits, focus on the nearest eye. A wider aperture can separate your subject from the background, but make sure the eye remains inside the focus plane.",
  },
  {
    id: "landscape", name: "Mountain light", category: "LANDSCAPE", description: "Layered mountains, reflective water, and distant detail.",
    background: "/scenes/landscape-bg.svg", subject: "/scenes/landscape-subject.svg", sceneEv100: 12.7, subjectDistanceM: 35, motion: 0.02,
    recommended: { aperture: 8, shutter: 1 / 125, iso: 100, focalLength: 24, focusDistance: 18 },
    tip: "Landscape scenes reward depth. Try f/8, keep ISO low, and focus around the hyperfocal distance when you need both foreground and distant detail.",
  },
  {
    id: "night", name: "Neon after dark", category: "LOW LIGHT", description: "A high-contrast city scene with practical lights.",
    background: "/scenes/night-bg.svg", subject: "/scenes/night-subject.svg", sceneEv100: 4.9, subjectDistanceM: 8, motion: 0.12,
    recommended: { aperture: 5.6, shutter: 1 / 30, iso: 3200, focalLength: 35, focusDistance: 8 },
    tip: "At night, stabilize the camera first. Open the aperture, then choose a shutter speed that protects moving subjects. Raise ISO only as far as the shot requires.",
  },
  {
    id: "motion", name: "Action study", category: "MOTION", description: "A moving subject against a softly layered outdoor background.",
    background: "/scenes/motion-bg.svg", subject: "/scenes/motion-subject.svg", sceneEv100: 10.3, subjectDistanceM: 7, motion: 0.9,
    recommended: { aperture: 5.6, shutter: 1 / 400, iso: 800, focalLength: 55, focusDistance: 7 },
    tip: "To freeze action, start around 1/1000s and adjust for subject speed. For panning, try 1/30–1/60s while following the subject smoothly.",
  },
  {
    id: "product", name: "Product tabletop", category: "STILL LIFE", description: "Controlled tabletop light with a close subject.",
    background: "/scenes/product-bg.svg", subject: "/scenes/product-subject.svg", sceneEv100: 8.2, subjectDistanceM: 0.8, motion: 0,
    recommended: { aperture: 5.6, shutter: 1 / 30, iso: 400, focalLength: 50, focusDistance: 0.8 },
    tip: "For small products, stopping down slightly can keep more of the object sharp. Use a stable support when the shutter speed gets slow.",
  },
];

export function getScene(id: string): SceneDefinition {
  return scenes.find((scene) => scene.id === id) ?? scenes[0];
}
