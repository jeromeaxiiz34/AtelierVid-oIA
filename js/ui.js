// ══════════════════════════════════════════════════════════════════
// INTERFACE UTILISATEUR
// ══════════════════════════════════════════════════════════════════

let toastTimeout = null;
let currentCategory = 'all';
let searchQuery = '';

function showToast(message, type = 'success', duration = 2500) {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const text = document.getElementById('toast-text');
    if (!toast || !icon || !text) return;
    toast.classList.remove('visible', 'success', 'error', 'warn');
    void toast.offsetWidth;
    const icons = { success: '✓', error: '✕', warn: '⚠' };
    icon.textContent = icons[type] || '✓';
    text.textContent = message;
    toast.classList.add(type);
    requestAnimationFrame(() => toast.classList.add('visible'));
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove('visible'), duration);
}

function log(msg) { console.log('[Atelier] ' + msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}
function formatEta(seconds) {
    if (seconds < 60) return Math.round(seconds) + 's';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m + 'm' + (s > 0 ? ' ' + s + 's' : '');
}
function setStatus(text) {
    const bar = document.getElementById('status-bar');
    const txt = document.getElementById('status-text');
    if (!bar || !txt) return;
    if (text) { bar.classList.add('visible'); txt.textContent = text; }
    else bar.classList.remove('visible');
}

function updateGenerateBtn() {
    const btn = document.getElementById('generate-btn');
    if (!btn) return;
    const hasImages = state.images.length > 0;
    const hasKey = !!getApiKey();
    btn.disabled = !hasImages || !hasKey || state.isRunning || state.isLoadingImages;

    if (state.isLoadingImages) {
        btn.textContent = 'Chargement des images… (' + state.images.length + ')';
    } else if (state.isRunning) {
        const total = state.queue.length;
        const done = state.completed + state.failed;
        btn.textContent = 'Création en cours… (' + done + '/' + total + ')';
    } else if (!hasKey) {
        btn.textContent = 'Ajoutez votre clé API';
    } else if (!hasImages) {
        btn.textContent = 'Ajoutez des images';
    } else {
        btn.textContent = 'Créer ' + state.images.length + ' vidéo' + (state.images.length > 1 ? 's' : '');
    }
}

// ─── RENDU DES CATÉGORIES ─────────────────────────────────────────
function renderCategoryTabs() {
    const container = document.getElementById('category-tabs');
    if (!container) return;
    container.innerHTML = EFFECT_CATEGORIES.map(cat => {
        const count = countByCategory(cat.id);
        const selected = currentCategory === cat.id ? 'selected' : '';
        return '<div class="category-tab ' + selected + '" data-cat="' + cat.id + '">' +
            esc(cat.name) + ' <span style="opacity:0.6">(' + count + ')</span>' +
        '</div>';
    }).join('');

    container.querySelectorAll('.category-tab').forEach(el => {
        el.addEventListener('click', () => {
            currentCategory = el.dataset.cat;
            renderCategoryTabs();
            renderStyles();
        });
    });
}

// ─── RENDU DES EFFETS ─────────────────────────────────────────────
function renderStyles() {
    const container = document.getElementById('styles-grid');
    if (!container) return;

    let filtered = ALL_EFFECTS;
    if (currentCategory !== 'all') {
        filtered = filtered.filter(e => e.cat === currentCategory);
    }
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(e =>
            e.name.toLowerCase().includes(q) ||
            e.desc.toLowerCase().includes(q) ||
            e.id.toLowerCase().includes(q)
        );
    }

    let html = '';

    // Bouton "aucun effet"
    html += '<div class="no-style-card ' + (state.selectedEffect === null ? 'selected' : '') + '" data-effect="none">' +
        (state.selectedEffect === null
            ? '✓ Aucun effet — votre prompt seul gère les vidéos'
            : '🚫 Aucun effet visuel (utiliser seulement mon prompt)') +
        '</div>';

    if (filtered.length === 0) {
        html += '<div class="no-results">Aucun effet trouvé pour "' + esc(searchQuery) + '"</div>';
    } else {
        html += filtered.map(s => {
            return '<div class="style-card ' + (state.selectedEffect === s.id ? 'selected' : '') + '" data-effect="' + s.id + '">' +
                '<div class="style-emoji">' + s.emoji + '</div>' +
                '<div>' +
                    '<div class="style-name">' + esc(s.name) + '</div>' +
                    '<div class="style-desc">' + esc(s.desc) + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    container.innerHTML = html;

    container.querySelectorAll('[data-effect]').forEach(el => {
        el.addEventListener('click', () => {
            const val = el.dataset.effect;
            state.selectedEffect = (val === 'none') ? null : val;
            renderStyles();
            const eff = state.selectedEffect ? getEffectById(state.selectedEffect) : null;
            if (eff) showToast(eff.emoji + ' ' + eff.name + ' sélectionné', 'success', 1200);
        });
    });
}

// ─── PRESETS DE PROMPT ────────────────────────────────────────────
function renderPromptPresets() {
    const container = document.getElementById('prompt-presets');
    if (!container) return;
    container.innerHTML = PROMPT_PRESETS.map((p, i) => {
        return '<div class="prompt-preset" data-preset="' + i + '">' + esc(p.label) + '</div>';
    }).join('');
    container.querySelectorAll('.prompt-preset').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.preset, 10);
            const preset = PROMPT_PRESETS[idx];
            if (!preset) return;
            const ta = document.getElementById('main-prompt');
            ta.value = preset.text;
            state.mainPrompt = preset.text;
            ta.focus();
            showToast('Exemple appliqué', 'success', 1200);
        });
    });
}

// ─── IMAGES ───────────────────────────────────────────────────────
function fileToDataUri(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Erreur lecture'));
        reader.readAsDataURL(file);
    });
}

function generateThumbnail(dataUri) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ratio = img.height / img.width;
                canvas.width = CONFIG.THUMBNAIL_MAX_WIDTH;
                canvas.height = Math.round(CONFIG.THUMBNAIL_MAX_WIDTH * ratio);
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } catch (e) { resolve(dataUri); }
        };
        img.onerror = () => resolve(dataUri);
        img.src = dataUri;
    });
}

async function processOneFile(file) {
    if (!file.type.startsWith('image/')) return null;
    if (file.size > CONFIG.MAX_IMAGE_SIZE) return null;
    try {
        const dataUri = await fileToDataUri(file);
        const thumbnail = await generateThumbnail(dataUri);
        return { file, dataUri, thumbnail, id: Date.now() + Math.random() };
    } catch (e) { return null; }
}

async function handleFiles(files) {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!imageFiles.length) return;

    state.isLoadingImages = true;
    updateGenerateBtn();
    setStatus('Chargement de ' + imageFiles.length + ' image' + (imageFiles.length > 1 ? 's' : '') + '…');
    const uploadZone = document.getElementById('upload-zone');
    uploadZone.classList.add('loading');

    const BATCH = 5;
    let processed = 0;
    for (let i = 0; i < imageFiles.length; i += BATCH) {
        const batch = imageFiles.slice(i, i + BATCH);
        const results = await Promise.allSettled(batch.map(f => processOneFile(f)));
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value) {
                state.images.push(r.value);
                processed++;
            }
        }
        renderImages();
        setStatus('Chargement… ' + processed + '/' + imageFiles.length);
    }
    state.isLoadingImages = false;
    uploadZone.classList.remove('loading');
    setStatus(null);
    updateGenerateBtn();
}

function removeImage(id) {
    state.images = state.images.filter(img => img.id !== id);
    renderImages();
}

function renderImages() {
    const grid = document.getElementById('images-grid');
    grid.innerHTML = state.images.map(img => {
        return '<div class="image-card">' +
            '<img src="' + (img.thumbnail || img.dataUri) + '" alt="" loading="lazy">' +
            '<button class="remove-btn" data-remove="' + img.id + '">✕</button>' +
            '</div>';
    }).join('');
    grid.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeImage(parseFloat(btn.dataset.remove));
        });
    });
}

// ─── QUEUE ────────────────────────────────────────────────────────
function renderQueue() {
    const queueEl = document.getElementById('queue');
    if (!state.queue.length) { queueEl.style.display = 'none'; return; }
    queueEl.style.display = 'block';

    const total = state.queue.length;
    const done = state.completed + state.failed;
    const inProgress = state.queue.filter(q => q.status === 'processing').length;
    const pending = total - done - inProgress;
    const estGen = estimateGenerationTime(state.durationFrames) / 1000;
    const remainingCreates = pending;
    const eta = remainingCreates > 0
        ? (remainingCreates * (state.createIntervalMs / 1000)) + estGen
        : (inProgress * estGen / Math.max(inProgress, 1));

    let html = '<div class="queue-summary">' +
        '<span class="progress-text">Progression : ' + done + '/' + total + '</span>' +
        '<span class="eta-text">' + (done < total ? '≈ ' + formatEta(eta) + ' restant' : 'Terminé') + '</span>' +
        '</div>';

    const visible = state.queue.slice(0, CONFIG.MAX_VISIBLE_QUEUE);
    const hidden = state.queue.length - visible.length;

    html += visible.map(item => {
        let icon = '○', statusText = 'En file d\'attente', cls = 'pending';
        if (item.status === 'creating') { icon = '◐'; statusText = 'Préparation…'; cls = 'creating'; }
        else if (item.status === 'processing') { icon = '◐'; statusText = item.progress || 'En cours…'; cls = 'processing'; }
        else if (item.status === 'done') { icon = '●'; statusText = 'Terminé'; cls = 'done'; }
        else if (item.status === 'failed') { icon = '✕'; statusText = 'Échec'; cls = 'failed'; }
        return '<div class="queue-item ' + cls + '">' +
            '<div class="q-icon">' + icon + '</div>' +
            '<div class="q-name">Image ' + (item.imageIndex + 1) + '</div>' +
            '<div class="q-status">' + esc(statusText) + '</div>' +
        '</div>';
    }).join('');

    if (hidden > 0) {
        html += '<div class="queue-more">… et ' + hidden + ' autre' + (hidden > 1 ? 's' : '') + '</div>';
    }
    queueEl.innerHTML = html;
}

// ─── GALERIE ──────────────────────────────────────────────────────
function addToGallery(videoUrl, label) {
    const galleryEl = document.getElementById('gallery');
    const galleryGrid = document.getElementById('gallery-grid');
    galleryEl.style.display = 'block';
    const el = document.createElement('div');
    el.className = 'gallery-item';
    el.innerHTML = '<video controls preload="metadata" muted playsinline>' +
        '<source src="' + videoUrl + '" type="video/mp4">' +
        '</video>' +
        '<div class="g-caption">' + esc(label) + '</div>';
    galleryGrid.appendChild(el);
}

// ─── CONSTRUCTION DU PROMPT ───────────────────────────────────────
function buildPrompt() {
    const effect = state.selectedEffect ? getEffectById(state.selectedEffect) : null;
    const hasUserPrompt = state.mainPrompt && state.mainPrompt.trim().length > 0;
    const isAmbiance = effect && AMBIANCE_CATS.includes(effect.cat);
    const isStylize = effect && !isAmbiance && effect.cat === 'stylize';

    const parts = [];

    if (isStylize) {
        parts.push('Animate this image as the starting frame. Transform the entire image into the following artistic style:');
    } else {
        parts.push(
            'Animate this exact image as the starting frame. ' +
            'The subject must remain IDENTICAL to the input image: same face, expression, clothing, pose, identity. ' +
            'This is a CONTINUATION of the source image. ' +
            'Preserve the exact composition, framing, and layout. ' +
            'Only subtle motion, breathing, light, and atmosphere are animated.'
        );
    }

    if (effect) {
        parts.push(effect.prompt);
        if (isStylize) {
            parts.push('Maintain the same subject, pose, and composition, but reinterpret everything in this new style.');
        }
    }

    if (hasUserPrompt) {
        if (isStylize) parts.push('Additional artistic direction: ' + state.mainPrompt.trim());
        else parts.push('Artistic direction (highest priority, must not change subject identity): ' + state.mainPrompt.trim());
    }

    if (state.framing !== 'random' && FRAMING_PRESETS[state.framing]) {
        parts.push(FRAMING_PRESETS[state.framing]);
    }
    if (state.intensity !== 'random' && INTENSITY_PRESETS[state.intensity]) {
        parts.push(INTENSITY_PRESETS[state.intensity]);
    } else {
        parts.push('moderate movement, clear but controlled motion');
    }

    parts.push(randomItem(RANDOM_ACTIONS));
    parts.push(randomItem(RANDOM_CAMERA));
    parts.push(randomItem(RANDOM_LIGHTING));
    parts.push('Sound design: minimal foley, soft ambient textures, no music, no instruments, no dialogue');
    parts.push('Portrait orientation 9:16 vertical, 24fps, no text, no subtitles, no watermarks, consistent character design with the source image');

    return parts.join('. ');
}