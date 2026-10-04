// ══════════════════════════════════════════════════════════════════
// COMMUNICATION AVEC L'API AGNES
// ══════════════════════════════════════════════════════════════════

function loadTimingCache() {
    try { return JSON.parse(localStorage.getItem(CONFIG.TIMING_CACHE_KEY) || '{}'); }
    catch (e) { return {}; }
}
function saveTimingCache(cache) {
    try { localStorage.setItem(CONFIG.TIMING_CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
}
function recordGenerationTime(numFrames, durationMs) {
    const cache = loadTimingCache();
    const key = String(numFrames);
    if (!cache[key]) cache[key] = [];
    cache[key].push(durationMs);
    if (cache[key].length > 10) cache[key] = cache[key].slice(-10);
    saveTimingCache(cache);
    updateTimingDisplay();
}
function estimateGenerationTime(numFrames) {
    const cache = loadTimingCache();
    const samples = cache[String(numFrames)];
    if (samples && samples.length > 0) {
        const sorted = [...samples].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid-1] + sorted[mid]) / 2 : sorted[mid];
    }
    return 30000 + numFrames * 500;
}
function updateTimingDisplay() {
    const cache = loadTimingCache();
    const all = Object.values(cache).flat();
    const speedEl = document.getElementById('stat-speed');
    const samplesEl = document.getElementById('stat-samples');
    if (!speedEl || !samplesEl) return;
    if (all.length === 0) {
        speedEl.textContent = 'en attente de données';
        samplesEl.textContent = '0 génération';
        return;
    }
    const avg = all.reduce((a, b) => a + b, 0) / all.length;
    speedEl.textContent = (avg / 1000).toFixed(1) + ' s en moyenne';
    samplesEl.textContent = all.length + ' génération' + (all.length > 1 ? 's' : '');
}

function getApiKey() {
    try { return (localStorage.getItem(CONFIG.API_KEY_STORAGE) || '').trim(); }
    catch (e) { return ''; }
}

function saveApiKey() {
    const input = document.getElementById('api-key-input');
    if (!input) return;
    const key = input.value.trim();
    if (!key) {
        try { localStorage.removeItem(CONFIG.API_KEY_STORAGE); } catch (e) {}
        updateApiPanel();
        showToast('Clé supprimée', 'warn');
        return;
    }
    if (!key.startsWith('sk-')) {
        if (!confirm('La clé ne commence pas par "sk-". La sauvegarder quand même ?')) return;
    }
    try {
        localStorage.setItem(CONFIG.API_KEY_STORAGE, key);
        updateApiPanel();
        showToast('Clé API enregistrée ✓', 'success');
        input.blur();
    } catch (e) {
        showToast('Erreur lors de la sauvegarde', 'error');
    }
}

function updateApiPanel() {
    const panel = document.getElementById('api-panel');
    const input = document.getElementById('api-key-input');
    const statusLine = document.getElementById('api-status-line');
    const statusText = document.getElementById('api-status-text');
    const key = getApiKey();
    if (!panel || !input || !statusLine || !statusText) return;

    if (key) {
        panel.classList.add('ok');
        statusLine.classList.add('ok');
        statusText.textContent = 'Clé API active · ' + key.slice(0, 8) + '…' + key.slice(-4);
        input.value = key;
        input.placeholder = '';
    } else {
        panel.classList.remove('ok');
        statusLine.classList.remove('ok');
        statusText.textContent = 'Aucune clé API enregistrée';
        input.value = '';
        input.placeholder = 'Collez votre clé API ici (sk-...)';
    }
    updateGenerateBtn();
}

async function apiFetch(url, options = {}, label = 'API') {
    for (let attempt = 0; attempt < 7; attempt++) {
        if (state.stopRequested) throw new Error('Arrêt demandé');
        try {
            const res = await fetch(url, options);
            if (res.status === 429) {
                state.creationAttemptsSinceLastError = 0;
                if (state.createIntervalMs < CONFIG.CREATE_INTERVAL_SAFE) {
                    state.createIntervalMs = Math.min(state.createIntervalMs + 8000, CONFIG.CREATE_INTERVAL_MAX);
                    log('429 → intervalle ' + (state.createIntervalMs / 1000) + 's');
                }
                const wait = [15, 30, 45, 60, 90, 120, 180][Math.min(attempt, 6)];
                setStatus('L\'IA se prépare… (' + wait + 's)');
                await sleep(wait * 1000);
                continue;
            }
            if (res.status === 503) {
                const wait = [5, 10, 15, 20, 30, 45][Math.min(attempt, 5)];
                setStatus('Votre vidéo se prépare… (' + wait + 's)');
                await sleep(wait * 1000);
                continue;
            }
            if (res.ok && state.createIntervalMs > CONFIG.CREATE_INTERVAL_MIN) {
                state.creationAttemptsSinceLastError++;
                if (state.creationAttemptsSinceLastError >= 3) {
                    state.createIntervalMs = Math.max(state.createIntervalMs - 4000, CONFIG.CREATE_INTERVAL_MIN);
                    state.creationAttemptsSinceLastError = 0;
                }
            }
            return res;
        } catch (e) {
            if (e.message === 'Arrêt demandé') throw e;
            const wait = [3, 5, 8, 12, 20, 30][Math.min(attempt, 5)];
            setStatus('Connexion en cours… (' + wait + 's)');
            await sleep(wait * 1000);
        }
    }
    return fetch(url, options);
}

async function createVideoTask(imageDataUri, prompt) {
    const body = {
        model: CONFIG.MODEL_VIDEO,
        prompt: prompt,
        image: imageDataUri,
        num_frames: state.durationFrames,
        frame_rate: CONFIG.FRAME_RATE
    };
    const res = await apiFetch(CONFIG.API_BASE + '/videos', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + getApiKey(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    }, 'Création');

    if (!res.ok) {
        const err = await res.text();
        throw new Error('HTTP ' + res.status + ' — ' + err.slice(0, 200));
    }
    const data = await res.json();
    const videoId = data.video_id || data.id || data.task_id;
    if (!videoId) throw new Error('Pas de video_id retourné');
    return videoId;
}

async function pollVideo(videoId, onProgress) {
    const estimatedMs = estimateGenerationTime(state.durationFrames);
    const estimatedSec = estimatedMs / 1000;
    let remaining = Math.max(20, Math.floor(estimatedSec * 0.8));
    while (remaining > 0) {
        if (state.stopRequested) throw new Error('Arrêt demandé');
        onProgress('Votre vidéo se prépare… — ' + remaining + 's');
        await sleep(1000);
        remaining--;
    }
    for (let attempt = 0; attempt < CONFIG.MAX_POLL_ATTEMPTS; attempt++) {
        if (state.stopRequested) throw new Error('Arrêt demandé');
        if (attempt > 0) {
            let r = CONFIG.POLL_INTERVAL_SEC;
            while (r > 0) {
                if (state.stopRequested) throw new Error('Arrêt demandé');
                onProgress('L\'image prend vie… — ' + r + 's');
                await sleep(1000);
                r--;
            }
        }
        const url = CONFIG.POLL_BASE + '?video_id=' + encodeURIComponent(videoId) + '&model_name=' + encodeURIComponent(CONFIG.MODEL_VIDEO);
        const res = await apiFetch(url, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + getApiKey() }
        }, 'Polling');

        const d = await res.json();
        const status = d.status || 'unknown';
        const progress = d.progress || 0;
        onProgress('Création en cours… — ' + progress + '%');

        if (status === 'completed' || status === 'succeeded' || status === 'done') {
            const videoUrl = (d.metadata && d.metadata.url) || d.url || (d.output && d.output.url);
            if (!videoUrl) throw new Error('Terminé mais pas d\'URL');
            return videoUrl;
        }
        if (status === 'failed' || status === 'error' || status === 'cancelled') {
            throw new Error('Échec (' + status + ')');
        }
    }
    throw new Error('Délai maximal dépassé');
}