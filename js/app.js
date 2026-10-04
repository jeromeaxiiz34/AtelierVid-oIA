// ══════════════════════════════════════════════════════════════════
// PIPELINE PRINCIPAL & INITIALISATION
// ══════════════════════════════════════════════════════════════════

async function createTaskOnly(item) {
    item.status = 'creating';
    item.progress = 'Préparation…';
    renderQueue();
    const prompt = buildPrompt();
    item.prompt = prompt;
    log('[Image ' + (item.imageIndex + 1) + '] Création…');
    const videoId = await createVideoTask(item.image.dataUri, prompt);
    item.videoId = videoId;
    item.startTime = Date.now();
    item.status = 'processing';
    item.progress = 'En cours…';
    renderQueue();
    log('[Image ' + (item.imageIndex + 1) + '] Tâche : ' + String(videoId).slice(0, 30) + '…');
    return videoId;
}

async function pollTaskAndDisplay(item) {
    try {
        const videoUrl = await pollVideo(item.videoId, (prog) => {
            item.progress = prog;
            renderQueue();
        });
        const elapsed = Date.now() - item.startTime;
        recordGenerationTime(state.durationFrames, elapsed);
        log('[Image ' + (item.imageIndex + 1) + '] OK en ' + (elapsed / 1000).toFixed(1) + 's');
        item.status = 'done';
        item.videoUrl = videoUrl;
        item.progress = 'Terminé';
        state.completed++;
        renderQueue();
        updateGenerateBtn();
        addToGallery(videoUrl, 'Image ' + (item.imageIndex + 1));
    } catch (e) {
        if (e.message === 'Arrêt demandé') {
            item.status = 'failed';
            item.progress = 'Arrêté';
        } else {
            log('[Image ' + (item.imageIndex + 1) + '] ' + e.message);
            item.status = 'failed';
            item.progress = 'Échec';
            state.failed++;
        }
        renderQueue();
        updateGenerateBtn();
    }
}

async function startGeneration() {
    if (state.isRunning || !state.images.length) return;
    if (!getApiKey()) {
        showToast('Ajoutez d\'abord votre clé API', 'error');
        document.getElementById('api-key-input').focus();
        return;
    }

    state.mainPrompt = document.getElementById('main-prompt').value.trim();

    if (!state.mainPrompt && !state.selectedEffect) {
        if (!confirm('Ni prompt ni effet sélectionné. Continuer avec un style aléatoire ?')) return;
    }

    state.isRunning = true;
    state.stopRequested = false;
    state.completed = 0;
    state.failed = 0;
    state.creationAttemptsSinceLastError = 0;
    state.createIntervalMs = CONFIG.CREATE_INTERVAL_MIN;

    state.queue = state.images.map((img, i) => ({
        imageIndex: i, image: img, status: 'pending', progress: null,
        videoId: null, videoUrl: null, prompt: null, startTime: null
    }));

    document.getElementById('gallery-grid').innerHTML = '';
    document.getElementById('gallery').style.display = 'none';
    document.getElementById('stop-btn').classList.add('visible');
    document.getElementById('generate-btn').disabled = true;

    await ensureWakeLockActive();
    renderQueue();
    updateGenerateBtn();

    log('Démarrage — ' + state.images.length + ' vidéos');
    log('Effet : ' + (state.selectedEffect || 'aucun'));

    const totalStart = Date.now();
    const pollingTasks = [];

    try {
        for (let i = 0; i < state.queue.length; i++) {
            if (state.stopRequested) break;
            const item = state.queue[i];
            try {
                await createTaskOnly(item);
                pollingTasks.push(pollTaskAndDisplay(item));
            } catch (e) {
                if (e.message === 'Arrêt demandé') break;
                log('[Image ' + (i + 1) + '] Échec création : ' + e.message);
                item.status = 'failed';
                item.progress = 'Échec';
                state.failed++;
                renderQueue();
                updateGenerateBtn();
            }
            if (i < state.queue.length - 1 && !state.stopRequested) {
                const waitSec = Math.ceil(state.createIntervalMs / 1000);
                for (let r = waitSec; r > 0; r--) {
                    if (state.stopRequested) break;
                    setStatus('Respiration créative… — Image ' + (i + 2) + '/' + state.queue.length + ' dans ' + r + 's');
                    await sleep(1000);
                }
            }
        }
        if (pollingTasks.length > 0) {
            setStatus('Finalisation…');
            await Promise.allSettled(pollingTasks);
        }
    } catch (e) {
        log('Erreur globale : ' + e.message);
    }

    const totalElapsed = (Date.now() - totalStart) / 1000;
    const summary = state.stopRequested
        ? 'Arrêté — ' + state.completed + '/' + state.queue.length + ' vidéos'
        : '✦ ' + state.completed + '/' + state.queue.length + ' vidéos créées en ' + formatEta(totalElapsed) + ' ✦';

    log(summary);
    setStatus(summary);
    await sleep(4000);
    setStatus(null);

    state.isRunning = false;
    state.stopRequested = false;
    document.getElementById('stop-btn').classList.remove('visible');
    updateGenerateBtn();
    showToast(state.completed + ' vidéo' + (state.completed > 1 ? 's' : '') + ' créée' + (state.completed > 1 ? 's' : ''), 'success');
}

function stopGeneration() {
    if (!state.isRunning) return;
    state.stopRequested = true;
    log('Arrêt demandé');
    setStatus('Arrêt en cours…');
}

// ══════════════════════════════════════════════════════════════════
// INITIALISATION
// ══════════════════════════════════════════════════════════════════
(function init() {
    // Boutons
    document.getElementById('api-save-btn')?.addEventListener('click', saveApiKey);
    document.getElementById('stop-btn')?.addEventListener('click', stopGeneration);
    document.getElementById('generate-btn')?.addEventListener('click', startGeneration);
    document.getElementById('wake-toggle-btn')?.addEventListener('click', toggleWakeLock);

    // Entrée dans le champ API
    document.getElementById('api-key-input')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveApiKey(); }
    });

    // Sections collapsibles
    document.querySelectorAll('[data-toggle]').forEach(header => {
        header.addEventListener('click', () => {
            document.getElementById(header.dataset.toggle).classList.toggle('open');
        });
    });

    // Upload
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    if (uploadZone && fileInput) {
        uploadZone.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', e => {
            handleFiles(e.target.files);
            fileInput.value = '';
        });
    }

    // Prompt
    document.getElementById('main-prompt')?.addEventListener('input', e => {
        state.mainPrompt = e.target.value;
    });

    // Recherche d'effets
    document.getElementById('effect-search')?.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        renderStyles();
    });

    // Sélecteurs
    document.getElementById('duration-select')?.addEventListener('change', e => {
        state.durationFrames = parseInt(e.target.value, 10);
    });
    document.getElementById('framing-select')?.addEventListener('change', e => {
        state.framing = e.target.value;
    });
    document.getElementById('intensity-select')?.addEventListener('change', e => {
        state.intensity = e.target.value;
    });

    // Wake Lock préférence
    try {
        wakeLockEnabled = localStorage.getItem(CONFIG.WAKE_LOCK_PREF) === '1';
    } catch (e) {}
    if (wakeLockEnabled) activateWakeLock().then(() => updateWakeStatus());

    // Badge nombre d'effets
    const badge = document.getElementById('effect-count-badge');
    if (badge) badge.textContent = ALL_EFFECTS.length + ' effets disponibles';

    // Rendu initial
    updateApiPanel();
    updateTimingDisplay();
    updateWakeStatus();
    renderPromptPresets();
    renderCategoryTabs();
    renderStyles();
    renderImages();
    renderQueue();

    log('Prêt — ' + ALL_EFFECTS.length + ' effets chargés.');
})();