// ══════════════════════════════════════════════════════════════════
// ANTI-VEILLE — Wake Lock API + fallback canvas captureStream
// ══════════════════════════════════════════════════════════════════

let wakeLockSentinel = null;
let wakeLockEnabled = false;
let canvasStream = null;
let canvasInterval = null;

function isWakeLockSupported() {
    return 'wakeLock' in navigator && typeof navigator.wakeLock.request === 'function';
}

async function requestWakeLockAPI() {
    if (!isWakeLockSupported()) return false;
    try {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockSentinel.addEventListener('release', () => {
            wakeLockSentinel = null;
            updateWakeStatus();
        });
        return true;
    } catch (e) {
        console.warn('[WakeLock API] refusé :', e.message);
        return false;
    }
}

async function releaseWakeLockAPI() {
    if (wakeLockSentinel) {
        try { await wakeLockSentinel.release(); } catch (e) {}
        wakeLockSentinel = null;
    }
}

function startCanvasStream() {
    if (canvasStream) return true;
    try {
        const canvas = document.getElementById('noSleepCanvas');
        const video = document.getElementById('noSleepVideo');
        if (!canvas || !video) return false;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (typeof canvas.captureStream !== 'function') return false;

        canvasStream = canvas.captureStream(1);
        let toggle = false;
        canvasInterval = setInterval(() => {
            toggle = !toggle;
            ctx.fillStyle = toggle ? '#000000' : '#010101';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }, 1000);

        video.srcObject = canvasStream;
        video.muted = true;
        video.playsInline = true;
        const p = video.play();
        if (p && p.catch) p.catch(e => console.warn('[Video fallback]', e.message));
        return true;
    } catch (e) {
        console.warn('[Canvas Stream]', e.message);
        return false;
    }
}

function stopCanvasStream() {
    if (canvasInterval) { clearInterval(canvasInterval); canvasInterval = null; }
    const video = document.getElementById('noSleepVideo');
    if (video) {
        try { video.pause(); video.srcObject = null; } catch (e) {}
    }
    if (canvasStream) {
        try { canvasStream.getTracks().forEach(t => t.stop()); } catch (e) {}
        canvasStream = null;
    }
}

async function activateWakeLock() {
    let success = false;
    if (isWakeLockSupported()) success = await requestWakeLockAPI();
    if (!success) success = startCanvasStream();
    if (!success && !canvasStream) success = startCanvasStream();
    return success;
}

async function deactivateWakeLock() {
    await releaseWakeLockAPI();
    stopCanvasStream();
}

function updateWakeStatus() {
    const el = document.getElementById('wake-status');
    const txt = document.getElementById('wake-status-text');
    const btn = document.getElementById('wake-toggle-btn');
    if (!el || !txt || !btn) return;
    el.classList.remove('active', 'warn');

    const hasAny = isWakeLockSupported() || (document.getElementById('noSleepCanvas')?.captureStream);
    if (!hasAny) {
        el.classList.add('warn');
        txt.textContent = '⚠️ Non supporté';
        btn.style.display = 'none';
        return;
    }
    btn.style.display = 'inline-block';
    const isActive = wakeLockSentinel !== null || canvasStream !== null;

    if (wakeLockEnabled && isActive) {
        el.classList.add('active');
        txt.textContent = '✅ L\'écran reste allumé';
        btn.textContent = 'Désactiver';
    } else if (wakeLockEnabled && !isActive) {
        el.classList.add('warn');
        txt.textContent = '⏳ En attente (touchez la page)';
        btn.textContent = 'Désactiver';
    } else {
        txt.textContent = '💤 Veille automatique';
        btn.textContent = 'Garder l\'écran allumé';
    }
}

async function toggleWakeLock() {
    if (wakeLockEnabled) {
        wakeLockEnabled = false;
        await deactivateWakeLock();
        try { localStorage.setItem(CONFIG.WAKE_LOCK_PREF, '0'); } catch (e) {}
        showToast('Veille automatique réactivée', 'warn');
    } else {
        wakeLockEnabled = true;
        const ok = await activateWakeLock();
        try { localStorage.setItem(CONFIG.WAKE_LOCK_PREF, '1'); } catch (e) {}
        showToast(ok ? 'L\'écran va rester allumé' : 'Activez manuellement dans les réglages', ok ? 'success' : 'warn');
    }
    updateWakeStatus();
}

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && wakeLockEnabled) {
        await activateWakeLock();
        updateWakeStatus();
    }
});

async function ensureWakeLockActive() {
    if (!wakeLockEnabled) return;
    if (wakeLockSentinel === null && canvasStream === null) {
        await activateWakeLock();
        updateWakeStatus();
    }
}