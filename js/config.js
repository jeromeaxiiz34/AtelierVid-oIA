// ══════════════════════════════════════════════════════════════════
// CONFIGURATION GLOBALE
// ══════════════════════════════════════════════════════════════════
const CONFIG = {
    API_BASE: 'https://apihub.agnes-ai.com/v1',
    POLL_BASE: 'https://apihub.agnes-ai.com/agnesapi',
    MODEL_VIDEO: 'agnes-video-v2.0',
    FRAME_RATE: 24,

    CREATE_INTERVAL_MIN: 62000,
    CREATE_INTERVAL_MAX: 90000,
    CREATE_INTERVAL_SAFE: 75000,

    POLL_INTERVAL_SEC: 8,
    MAX_POLL_ATTEMPTS: 100,

    TIMING_CACHE_KEY: 'agnes_timing_cache_v10',
    API_KEY_STORAGE: 'agnes_api_key',
    WAKE_LOCK_PREF: 'agnes_wakelock_enabled',

    MAX_VISIBLE_QUEUE: 30,
    MAX_IMAGE_SIZE: 12 * 1024 * 1024,
    THUMBNAIL_MAX_WIDTH: 200
};

// État global partagé
const state = {
    images: [],
    isRunning: false,
    stopRequested: false,
    queue: [],
    completed: 0,
    failed: 0,
    selectedEffect: null,
    mainPrompt: '',
    framing: 'random',
    intensity: 'random',
    durationFrames: 153,
    isLoadingImages: false,
    creationAttemptsSinceLastError: 0,
    createIntervalMs: CONFIG.CREATE_INTERVAL_MIN
};

// Presets de prompt
const PROMPT_PRESETS = [
    { label: '🌬️ Vent léger',
      text: 'Anime doucement l\'image comme si le temps s\'arrêtait. Un vent léger fait bouger les cheveux et les feuilles. La lumière est chaude et dorée. Garde chaque sujet exactement identique à la photo originale.' },
    { label: '💭 Rêve éveillé',
      text: 'Prolonge cette image dans un rêve éveillé. Mouvements très lents, respiration visible, lumière douce et diffuse. Atmosphère onirique et paisible. Le sujet reste identique à la photo.' },
    { label: '🌅 Golden hour',
      text: 'Anime cette image avec une lumière dorée de fin de journée. Longues ombres chaudes, reflets lumineux, ambiance cinématographique. Le sujet reste identique à la photo originale.' },
    { label: '🌙 Nuit calme',
      text: 'Prolonge cette image dans une ambiance nocturne paisible. Lumière bleutée, reflets argentés, mouvement très lent. Le sujet reste identique à la photo.' },
    { label: '⚫ Noir & blanc',
      text: 'Anime cette image en noir et blanc élégant. Contraste doux, grain subtil, ambiance photographique classique. Le sujet reste identique à la photo.' },
    { label: '🎬 Cinématique',
      text: 'Anime cette image avec une esthétique cinématographique. Mouvement de caméra lent, lumière dramatique, profondeur de champ. Le sujet reste identique à la photo originale.' },
    { label: '🌫️ Brume poétique',
      text: 'Prolonge cette image dans une brume douce et poétique. Halo lumineux, particules flottantes, atmosphère mystérieuse. Le sujet reste identique à la photo.' }
];

// Mouvements aléatoires
const RANDOM_ACTIONS = [
    'the subject slowly raises a hand toward the camera, fingers trembling slightly',
    'a single tear rolls down the subject\'s cheek in extreme slow motion',
    'the subject turns their head slowly, eyes closing, breathing softly',
    'the subject\'s hair moves gently in an imperceptible breeze',
    'the subject stands still, only their chest rising and falling with breath',
    'the subject\'s eyes open slowly, revealing an intense gaze directly at the camera',
    'the subject extends a hand as if reaching for something just out of frame',
    'the subject lifts their chin slightly, a silent gesture of presence',
    'the subject walks slowly toward the camera, each step deliberate',
    'the subject looks down at their own hands, discovering them for the first time',
    'the subject\'s body shivers involuntarily, a wave of emotion passing through',
    'the subject leans forward slightly, closing the distance with the viewer'
];
const RANDOM_CAMERA = [
    'slow dolly-in, camera gliding forward almost imperceptibly',
    'static locked-off frame, subject moves within fixed borders',
    'handheld, slight tremor, camera breathing with the subject',
    'slow pan following the subject\'s movement',
    'subtle parallax movement revealing depth',
    'high angle looking down, subject appears small and vulnerable',
    'low angle looking up, subject appears powerful',
    'rack focus from foreground to subject',
    'camera drifts backward slowly, revealing a bit more of the environment'
];
const RANDOM_LIGHTING = [
    'soft diffused natural light',
    'warm golden hour backlight',
    'dramatic side lighting with deep shadows',
    'gentle ambient glow, almost shadowless',
    'cool moonlight atmosphere',
    'warm interior candlelight flicker',
    'cinematic rim lighting emphasizing the silhouette'
];
const INTENSITY_PRESETS = {
    subtle: 'very subtle movement, barely perceptible change, minimal animation, gentle and quiet',
    moderate: 'moderate movement, clear but controlled motion, balanced energy',
    strong: 'strong dynamic movement, energetic motion, pronounced physical action'
};
const FRAMING_PRESETS = {
    close: 'extreme close-up framing, tight on the subject, intimate and intense',
    medium: 'medium shot, subject framed from waist up, balanced composition',
   