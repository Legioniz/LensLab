import { useEffect, useState } from "react";
import { Aperture, ArrowUpRight, BookOpen, Camera, CheckCircle2, X } from "lucide-react";

type PracticePhoto = {
  id: string;
  title: string;
  imageId: string;
  photographer: string;
  sourceUrl: string;
  exercise: string;
  focus: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "CHALLENGE";
};

type PracticeScene = {
  id: string;
  label: string;
  sceneId: string;
  summary: string;
  objective: string;
  starter: { aperture: string; shutter: string; iso: string; focal: string };
  photos: PracticePhoto[];
};

const practiceScenes: PracticeScene[] = [
  {
    id: "portrait",
    label: "Portraits",
    sceneId: "portrait",
    summary: "Five natural-light portraits to study subject separation, focus, and skin-tone exposure.",
    objective: "Keep the nearest eye sharp, choose a background that supports the subject, and protect bright skin highlights.",
    starter: { aperture: "f/2.8–f/4", shutter: "1/250s", iso: "ISO 100–800", focal: "35–55mm" },
    photos: [
      { id: "portrait-01", title: "Golden-hour headshot", imageId: "1770853800316-911f5a248785", photographer: "Alef Morais", sourceUrl: "https://unsplash.com/photos/young-woman-with-glasses-wearing-a-yellow-sweater-outdoors-1WZNcvJbdXA", exercise: "Expose for the face while retaining detail in the bright background. Compare a neutral exposure with −1/3 EV.", focus: "Eye focus · warm light · highlight protection", difficulty: "BEGINNER" },
      { id: "portrait-02", title: "Wind and movement", imageId: "1766469295724-193a0f282de4", photographer: "Kailun Zhang", sourceUrl: "https://unsplash.com/photos/young-woman-looking-up-outdoors-with-hair-blowing-vWmmtFBkC4o", exercise: "Imagine the subject turning into the wind. Try 1/500s or faster, then open the aperture or raise ISO to keep exposure balanced.", focus: "Shutter speed · focus tracking · natural light", difficulty: "INTERMEDIATE" },
      { id: "portrait-03", title: "Portrait in green", imageId: "1747671688812-76d7bca21f34", photographer: "Arturo Añez", sourceUrl: "https://unsplash.com/photos/a-smiling-woman-poses-outdoors-in-nature-nGnQpHSZaQ4", exercise: "Use a wider aperture to soften the background. Compare f/2.8, f/5.6, and f/8 while keeping the framing consistent.", focus: "Depth of field · background separation", difficulty: "BEGINNER" },
      { id: "portrait-04", title: "Soft autumn portrait", imageId: "1761046543296-5c3c6abe0db1", photographer: "Sorin Basangeac", sourceUrl: "https://unsplash.com/photos/a-young-woman-with-blonde-hair-smiling-outdoors-HZk4Vxq8oT4", exercise: "Look for the brightest parts of the face and hair. Try a small negative exposure compensation if highlights begin to clip.", focus: "Metering · exposure compensation · skin detail", difficulty: "INTERMEDIATE" },
      { id: "portrait-05", title: "Natural-light close-up", imageId: "1760552069633-c05f246a5d8c", photographer: "amin naderloei", sourceUrl: "https://unsplash.com/photos/young-woman-with-long-brown-hair-outdoors-FJj9JnT-scY", exercise: "Compare a tightly framed 55mm look with a wider 35mm view. Watch how the background changes as you move closer or farther away.", focus: "Focal length · framing · bokeh", difficulty: "CHALLENGE" },
    ],
  },
  {
    id: "landscape",
    label: "Landscapes",
    sceneId: "landscape",
    summary: "Five wide outdoor scenes to practice depth, composition, and highlight control.",
    objective: "Build a clear foreground-to-background composition and keep important details acceptably sharp.",
    starter: { aperture: "f/8–f/11", shutter: "1/125s or faster", iso: "ISO 100–200", focal: "18–35mm" },
    photos: [
      { id: "landscape-01", title: "Mountain lake", imageId: "1429081172764-c0ee67ab9afd", photographer: "Adriel Kloppenburg", sourceUrl: "https://unsplash.com/photos/landscape-photography-of-mountain-and-lake-EKIyHUrUHWU", exercise: "Identify a foreground, middle ground, and background. Try f/8, then f/11, and compare the depth you would expect.", focus: "Depth of field · layered composition", difficulty: "BEGINNER" },
      { id: "landscape-02", title: "Snowdonia reflection", imageId: "1748499429963-85c58cb2b95e", photographer: "Fabian Jones", sourceUrl: "https://unsplash.com/photos/mountain-landscape-with-a-lake-and-clear-blue-sky-aJzQJ_oP-tY", exercise: "Protect detail in the bright sky while retaining the darker land. Consider a slightly negative exposure compensation and review the histogram.", focus: "Dynamic range · histogram · highlights", difficulty: "INTERMEDIATE" },
      { id: "landscape-03", title: "Lake Louise", imageId: "1531764411937-45495415d84d", photographer: "Ryan Stone", sourceUrl: "https://unsplash.com/photos/landscape-photography-of-lake-and-mountains-bXGUdxFeQUQ", exercise: "Use the wide view to compare a centered horizon with a horizon placed near the upper or lower third.", focus: "Wide-angle framing · horizon placement", difficulty: "BEGINNER" },
      { id: "landscape-04", title: "Mountain reflections", imageId: "1433275328929-69941e862d61", photographer: "Ales Krivec", sourceUrl: "https://unsplash.com/photos/landscape-photography-of-lake-surrounded-by-mountains-8aSs7QejvSw", exercise: "Find the reflection line and consider whether symmetry strengthens the frame. Keep ISO low and use a stable support if the light fades.", focus: "Symmetry · low ISO · steady shooting", difficulty: "INTERMEDIATE" },
      { id: "landscape-05", title: "Forest lake at sunset", imageId: "1686903430763-ce58bce57eac", photographer: "Jeremy Bishop", sourceUrl: "https://unsplash.com/photos/a-lake-in-the-middle-of-a-forest-with-a-mountain-in-the-background-qYq8p5S9Kq0", exercise: "The scene contains bright sky and dark trees. Try a bracketed exposure plan and decide which tones matter most.", focus: "Golden-hour exposure · tonal range", difficulty: "CHALLENGE" },
    ],
  },
  {
    id: "night",
    label: "Night scenes",
    sceneId: "night",
    summary: "Five real low-light streetscapes for balancing noise, motion, and bright signs.",
    objective: "Preserve the atmosphere of the lights without losing all shadow detail or creating unwanted motion blur.",
    starter: { aperture: "f/1.8–f/4", shutter: "1/30–1/125s", iso: "ISO 800–3200", focal: "18–35mm" },
    photos: [
      { id: "night-01", title: "Market lights after dark", imageId: "1770173852739-39ad95229266", photographer: "Leo_Visions", sourceUrl: "https://unsplash.com/photos/neon-sign-glows-in-a-city-street-at-night-ueKs5DiJk_4", exercise: "Meter for the lit signs, then compare what happens to the darker buildings. Try lowering exposure compensation to protect the brightest lights.", focus: "Night metering · highlight detail", difficulty: "BEGINNER" },
      { id: "night-02", title: "Green neon street", imageId: "1773969459236-0e78c4fb6f71", photographer: "MChe Lee", sourceUrl: "https://unsplash.com/photos/city-street-at-night-with-neon-signs-and-buildings-huZJPeBX4GU", exercise: "Imagine pedestrians crossing the frame. Compare 1/30s, 1/60s, and 1/125s, raising ISO only as needed.", focus: "Shutter speed · ISO trade-off", difficulty: "INTERMEDIATE" },
      { id: "night-03", title: "Neon and pedestrians", imageId: "1767973419928-11ffdfe630a4", photographer: "Jay lee", sourceUrl: "https://unsplash.com/photos/city-street-at-night-with-neon-lights-and-people-VlgYkk-CgwM", exercise: "Decide whether you want pedestrians frozen or slightly blurred. Pick a shutter speed that matches that intention.", focus: "People in low light · motion rendering", difficulty: "INTERMEDIATE" },
      { id: "night-04", title: "Neon storefronts", imageId: "1751768853626-3737132f25f7", photographer: "Jay lee", sourceUrl: "https://unsplash.com/photos/neon-lights-illuminate-a-city-street-at-night-zGocRrMrGQY", exercise: "Compare a wider aperture with a slower shutter. Which choice better protects the highlights while keeping the scene sharp?", focus: "Aperture · shutter · practical lights", difficulty: "CHALLENGE" },
      { id: "night-05", title: "Busy neon alley", imageId: "1771308457556-1b7ed7e8669c", photographer: "Jason Leung", sourceUrl: "https://unsplash.com/photos/a-busy-street-at-night-with-glowing-neon-signs-mzkAUKmtX6g", exercise: "Find bright signs near dark edges. Practice keeping the brightest areas from clipping, then inspect shadow noise at ISO 800 and ISO 3200.", focus: "High contrast · noise · exposure", difficulty: "CHALLENGE" },
    ],
  },
  {
    id: "motion",
    label: "Action & motion",
    sceneId: "motion",
    summary: "Five sports moments for choosing between freezing action and showing movement.",
    objective: "Choose whether motion should look crisp or blurred, then select a shutter speed to support that visual intention.",
    starter: { aperture: "f/2.8–f/5.6", shutter: "1/500–1/2000s", iso: "ISO 400–3200", focal: "35–55mm" },
    photos: [
      { id: "motion-01", title: "Basketball movement", imageId: "1761644593544-d4c24e6a7c12", photographer: "Ernesto Alfano", sourceUrl: "https://unsplash.com/photos/basketball-players-running-on-wooden-court-gYDFadIzozU", exercise: "Track the player and imagine capturing the peak of the action. Start at 1/1000s, then slow down until movement becomes visible.", focus: "Freezing action · timing · focus", difficulty: "BEGINNER" },
      { id: "motion-02", title: "Cyclists and runners", imageId: "1774050021561-e23dc4b6e1e1", photographer: "RETRATO DEPORTIVO", sourceUrl: "https://unsplash.com/photos/people-rollerblading-and-cycling-on-a-street-H22uMld9kOk", exercise: "Try a panning approach: follow the subject smoothly at around 1/30–1/60s, then compare with a fast shutter that freezes the action.", focus: "Panning · motion blur · tracking", difficulty: "CHALLENGE" },
      { id: "motion-03", title: "Skateboard jump", imageId: "1718248028293-934f04a578db", photographer: "Venti Views", sourceUrl: "https://unsplash.com/photos/a-man-flying-through-the-air-while-riding-a-skateboard--UYedjT31zY", exercise: "Choose the instant the skater reaches the highest point. Test 1/1000s or faster and keep enough depth of field for small focus errors.", focus: "Peak action · fast shutter", difficulty: "INTERMEDIATE" },
      { id: "motion-04", title: "Skatepark technique", imageId: "1638486071986-bbcac55fc52c", photographer: "Jan Kopřiva", sourceUrl: "https://unsplash.com/photos/a-man-flying-through-the-air-while-riding-a-skateboard-eEuYjzsBJOM", exercise: "Predict where the subject will move into the frame. Leave lead room and use continuous focus for the moving subject.", focus: "Composition · AF-C · anticipation", difficulty: "INTERMEDIATE" },
      { id: "motion-05", title: "Agility drill", imageId: "1608216958660-afe291732df0", photographer: "Gabin Vallet", sourceUrl: "https://unsplash.com/photos/1O-EpKEfI5E", exercise: "Freeze the athlete mid-stride. Compare 1/500s with 1/1600s, then compensate exposure with aperture or ISO.", focus: "Fast shutter · exposure balance", difficulty: "BEGINNER" },
    ],
  },
  {
    id: "product",
    label: "Food & products",
    sceneId: "product",
    summary: "Five tabletop photographs for studying controlled light, texture, and clean product framing.",
    objective: "Make the subject readable, control reflections and shadows, and keep important product details sharp.",
    starter: { aperture: "f/4–f/8", shutter: "1/30–1/125s", iso: "ISO 100–800", focal: "35–55mm" },
    photos: [
      { id: "product-01", title: "Coffee and camera", imageId: "1738468042772-56c0053fa75b", photographer: "Manki Kim", sourceUrl: "https://unsplash.com/photos/a-coffee-cup-and-a-camera-on-a-table-xNqxaDOKLg0", exercise: "Identify the main subject and supporting objects. Try a wider aperture to separate the camera, then f/8 to keep more of the arrangement sharp.", focus: "Product hierarchy · depth of field", difficulty: "BEGINNER" },
      { id: "product-02", title: "Pear still life", imageId: "1680122755569-b0da19722fe5", photographer: "Kate Laine", sourceUrl: "https://unsplash.com/photos/a-pear-sitting-on-a-plate-next-to-two-cups-DBf5iVsLCb0", exercise: "Study how the light reveals the pear's shape. Imagine moving a reflector to soften the shadow and brighten the darker side.", focus: "Shape · light direction · shadows", difficulty: "BEGINNER" },
      { id: "product-03", title: "Breakfast tabletop", imageId: "1653177605885-134a333433a9", photographer: "pure julia", sourceUrl: "https://unsplash.com/photos/1vW0_H_D3Is", exercise: "Keep the plate edges and cup details clear. Compare f/4 with f/8 and consider whether a top-down or 45-degree camera angle works better.", focus: "Food styling · angle · sharpness", difficulty: "INTERMEDIATE" },
      { id: "product-04", title: "Cafe table arrangement", imageId: "1678047211247-062c4f6407b2", photographer: "FERNANDES, Felipe", sourceUrl: "https://unsplash.com/photos/a-table-topped-with-plates-of-food-and-cups-of-coffee-X7WFIt6NMKY", exercise: "Look for repeated shapes and leading lines. Practice a balanced exposure that preserves detail in white plates and bright food surfaces.", focus: "Composition · highlights · color", difficulty: "INTERMEDIATE" },
      { id: "product-05", title: "Brunch detail", imageId: "1710533835063-ef6e502226b5", photographer: "Luke Tokaryk", sourceUrl: "https://unsplash.com/photos/a-plate-of-food-on-a-table-with-a-cup-of-coffee-3ut7pvPXcIg", exercise: "Choose one hero item and simplify the frame around it. Test a closer crop and a wider view with more context.", focus: "Visual hierarchy · crop · framing", difficulty: "CHALLENGE" },
    ],
  },
];

function PhotoImage({ photo, large = false }: { photo: PracticePhoto; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div className={`practice-image-fallback ${large ? "large" : ""}`}><Aperture size={large ? 32 : 24}/><span>PHOTO UNAVAILABLE</span><small>Check your internet connection</small></div>;
  }
  return <img
    className={large ? "practice-photo-large" : "practice-photo"}
    src={`https://images.unsplash.com/photo-${photo.imageId}?auto=format&fit=crop&w=${large ? 1600 : 900}&q=80`}
    alt={photo.title}
    loading="lazy"
    referrerPolicy="no-referrer"
    onError={() => setFailed(true)}
  />;
}

export default function PhotoPracticeLibrary({ onTryScene }: { onTryScene: (sceneId: string) => void }) {
  const [activeSceneId, setActiveSceneId] = useState("portrait");
  const [selectedPhoto, setSelectedPhoto] = useState<PracticePhoto | null>(null);
  const activeScene = practiceScenes.find((scene) => scene.id === activeSceneId) ?? practiceScenes[0];

  useEffect(() => {
    if (!selectedPhoto) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPhoto(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedPhoto]);

  return (
    <section className="content-page photo-practice-page">
      <div className="page-heading">
        <div>
          <div className="section-kicker">REAL-WORLD REFERENCE COLLECTION</div>
          <h1>Photo practice <span>/ REFERENCE LIBRARY</span></h1>
          <p>Study real photographs, identify the lighting and motion, then plan the camera settings you would use to make a similar shot.</p>
        </div>
        <div className="practice-total-chip"><Camera size={15}/> 25 PHOTOS <span>·</span> 5 SCENES</div>
      </div>

      <div className="practice-intro" data-guide="photo-practice-intro">
        <div className="practice-intro-icon"><BookOpen size={21}/></div>
        <div>
          <b>Look first. Predict the settings. Then practice.</b>
          <p>These are real photographs hosted by Unsplash. Each card includes a short exercise and a source credit. The suggested settings are practice starting points, not the original camera settings or EXIF from the photograph.</p>
        </div>
      </div>

      <div className="practice-scene-tabs" role="tablist" aria-label="Practice scene categories">
        {practiceScenes.map((scene) => (
          <button
            key={scene.id}
            type="button"
            role="tab"
            aria-selected={activeScene.id === scene.id}
            className={`practice-scene-tab ${activeScene.id === scene.id ? "active" : ""}`}
            onClick={() => { setActiveSceneId(scene.id); setSelectedPhoto(null); }}
          >
            <span>{scene.label}</span><small>05</small>
          </button>
        ))}
      </div>

      <div className="practice-scene-heading">
        <div><span className="section-kicker">{activeScene.label.toUpperCase()} · 05 REFERENCE PHOTOS</span><h2>{activeScene.summary}</h2></div>
        <button className="subtle-button" onClick={() => onTryScene(activeScene.sceneId)}><Camera size={14}/> OPEN MATCHING SIMULATOR</button>
      </div>

      <div className="practice-photo-grid">
        {activeScene.photos.map((photo, index) => (
          <article className="practice-photo-card" key={photo.id}>
            <button type="button" className="practice-photo-open" onClick={() => setSelectedPhoto(photo)} aria-label={`Study ${photo.title}`}>
              <div className="practice-photo-frame"><PhotoImage photo={photo}/><span className="practice-photo-number">0{index + 1}</span><span className="practice-photo-open-hint">OPEN STUDY <ArrowUpRight size={12}/></span></div>
              <div className="practice-photo-copy"><span className={`practice-difficulty difficulty-${photo.difficulty.toLowerCase()}`}>{photo.difficulty}</span><b>{photo.title}</b><small>Photo by {photo.photographer} · Unsplash</small></div>
            </button>
            <button type="button" className="practice-card-study" onClick={() => setSelectedPhoto(photo)}>VIEW PRACTICE <ArrowUpRight size={12}/></button>
          </article>
        ))}
      </div>

      <div className="practice-learning-panel">
        <div className="practice-learning-heading"><Aperture size={17}/><div><b>SCENE LEARNING TARGET</b><span>{activeScene.label}</span></div></div>
        <p>{activeScene.objective}</p>
        <div className="practice-starter-grid">
          <div><small>APERTURE</small><b>{activeScene.starter.aperture}</b></div>
          <div><small>SHUTTER</small><b>{activeScene.starter.shutter}</b></div>
          <div><small>ISO</small><b>{activeScene.starter.iso}</b></div>
          <div><small>FOCAL LENGTH</small><b>{activeScene.starter.focal}</b></div>
        </div>
        <small className="practice-starter-note">Suggested starting ranges only. Adapt them to the actual light, subject movement, lens, and creative result you want.</small>
      </div>

      <div className="practice-source-note">Images are loaded directly from Unsplash and may require an internet connection. Photo credits link to each original source page. If a source image is unavailable, LENS LAB shows a fallback without interrupting the rest of the app.</div>

      {selectedPhoto && (
        <div className="practice-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedPhoto(null); }}>
          <section className="practice-modal" role="dialog" aria-modal="true" aria-labelledby="practice-modal-title">
            <button type="button" className="practice-modal-close" onClick={() => setSelectedPhoto(null)} aria-label="Close practice details"><X size={18}/></button>
            <div className="practice-modal-image"><PhotoImage photo={selectedPhoto} large/></div>
            <div className="practice-modal-content">
              <span className="section-kicker">FIELD EXERCISE · {activeScene.label.toUpperCase()}</span>
              <h2 id="practice-modal-title">{selectedPhoto.title}</h2>
              <p className="practice-photo-credit">Photo by <a href={selectedPhoto.sourceUrl} target="_blank" rel="noreferrer">{selectedPhoto.photographer} on Unsplash <ArrowUpRight size={11}/></a></p>
              <div className="practice-exercise-block"><b>YOUR CHALLENGE</b><p>{selectedPhoto.exercise}</p></div>
              <div className="practice-focus-row"><CheckCircle2 size={15}/><span>{selectedPhoto.focus}</span><em>{selectedPhoto.difficulty}</em></div>
              <div className="practice-modal-actions">
                <button type="button" className="primary-button" onClick={() => onTryScene(activeScene.sceneId)}><Camera size={14}/> TRY MATCHING SCENE</button>
                <a className="subtle-button practice-source-button" href={selectedPhoto.sourceUrl} target="_blank" rel="noreferrer">OPEN ORIGINAL PHOTO <ArrowUpRight size={13}/></a>
              </div>
              <p className="practice-modal-disclaimer">The Studio opens its related illustrative scene, not this exact reference photograph. The reference image is for visual study; the simulator uses a simplified teaching model.</p>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
