/* =========================================================
   CÓDIGO MALVINAS — Flujo de intro
   Stages: Gate → Typewriter → Film Leader → Main Content
   Sonido de máquina de escribir: HTML5 Audio pool (funciona
   con file:// y con servidor HTTP, sin depender de fetch).
   ========================================================= */

const BRAND_NAME = 'Codigo Malvinas';
const KEY_SAMPLE_URL = 'assets/sounds/key-v4.mp3';
const POOL_SIZE = 3; // cuantos clones del sample tenemos en rotación

const stages = {
  gate:       document.getElementById('stage-gate'),
  typewriter: document.getElementById('stage-typewriter'),
  leader:     document.getElementById('stage-leader'),
  main:       document.getElementById('stage-main'),
};

const els = {
  gateButton:      stages.gate.querySelector('.gate-content'),
  typedText:       document.getElementById('typed'),
  leaderVideo:     document.getElementById('leader-video'),
  skipBtn:         document.getElementById('skip-btn'),
  firstTestimonio: document.querySelector('.testimonio-video'),
};

let audioPool      = [];
let poolIdx        = 0;
let introStarted   = false;
let introSkipped   = false;
let introFinished  = false;

const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

/* ----------------------------------------------------
   Helpers
---------------------------------------------------- */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function setStage(stage) {
  Object.values(stages).forEach((s) => {
    s.classList.remove('stage-active');
    s.setAttribute('aria-hidden', 'true');
  });
  stage.classList.add('stage-active');
  stage.setAttribute('aria-hidden', 'false');
}

function showSkipButton() {
  els.skipBtn.hidden = false;
  requestAnimationFrame(() => {
    els.skipBtn.classList.add('visible');
  });
}

function hideSkipButton() {
  els.skipBtn.classList.remove('visible');
  setTimeout(() => { els.skipBtn.hidden = true; }, 400);
}

/* ----------------------------------------------------
   Pool de elementos <audio> precargados.
   Usamos varias instancias para que dos clicks seguidos
   no se corten entre sí (rotación round-robin).
---------------------------------------------------- */
function buildAudioPool() {
  if (audioPool.length) return;
  const size = isMobile ? 2 : POOL_SIZE;
  for (let i = 0; i < size; i++) {
    const a = new Audio(KEY_SAMPLE_URL);
    a.preload = 'auto';
    a.volume = 0.9;
    // Para que en iOS el primer play no falle por "no gesture"
    a.load();
    audioPool.push(a);
  }
}

/* "Despertar" todos los elementos dentro del gesture del usuario
   para que mobile Safari/Chrome los considere "habilitados". */
function unlockAudioPool() {
  audioPool.forEach((a) => {
    // Truco clásico: play+pause silencioso para que el navegador lo apruebe
    const oldVol = a.volume;
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        a.volume = oldVol;
      }).catch(() => {
        a.muted = false;
      });
    } else {
      a.pause();
      a.muted = false;
    }
  });
}

/* ----------------------------------------------------
   Reproducir un click — variación de tono/volumen para
   que no suene robótico.
---------------------------------------------------- */
function playKeyClick(opts = {}) {
  if (!audioPool.length) return;

  const {
    rate    = 1,
    rateVar = 0.18,
    gain    = 0.95,
    gainVar = 0.12,
  } = opts;

  const a = audioPool[poolIdx];
  poolIdx = (poolIdx + 1) % audioPool.length;

  try {
    a.pause();
    a.currentTime = 0;
    a.playbackRate = Math.max(0.5, rate + (Math.random() * 2 - 1) * rateVar);
    a.volume = Math.min(1, Math.max(0, gain + (Math.random() * 2 - 1) * gainVar));
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { /* no pasa nada — el siguiente keystroke probará de nuevo */ });
    }
  } catch (e) {
    /* noop */
  }
}

/* Espacio: golpe más grave y un poco más fuerte (barra espaciadora) */
function playSpaceClick() {
  playKeyClick({ rate: 0.78, rateVar: 0.06, gain: 1.0, gainVar: 0.08 });
}

/* ----------------------------------------------------
   Animación de tipeo
---------------------------------------------------- */
async function typewriterAnimation(text, target) {
  for (let i = 0; i < text.length; i++) {
    if (introSkipped) break;

    const char = text[i];
    target.textContent += char;

    // En mobile reproducimos sonido cada 2 letras para no saturar
    const shouldPlay = !isMobile || i % 2 === 0;
    if (shouldPlay) {
      if (char === ' ') {
        playSpaceClick();
      } else {
        playKeyClick();
      }
    }

    const baseDelay = isMobile ? 100 : 70;
    const variance  = Math.random() * (isMobile ? 30 : 40);
    await wait(baseDelay + variance);
  }
}

/* ----------------------------------------------------
   Secuencia principal de la intro
---------------------------------------------------- */
async function runIntroSequence() {
  if (introStarted) return;
  introStarted = true;

  showSkipButton();

  setStage(stages.typewriter);

  if (navigator.vibrate) {
    try { navigator.vibrate(40); } catch (e) { /* noop */ }
  }

  await wait(500);
  if (introSkipped) return goToMain();

  await typewriterAnimation(BRAND_NAME, els.typedText);
  if (introSkipped) return goToMain();

  await wait(1200);
  if (introSkipped) return goToMain();

  // --- Stage 2: Film leader ---
  setStage(stages.leader);

  els.leaderVideo.muted = false;
  els.leaderVideo.volume = 0.85;

  try {
    await els.leaderVideo.play();
  } catch (err) {
    console.warn('No se pudo reproducir el leader con sonido, intento muteado:', err);
    els.leaderVideo.muted = true;
    try { await els.leaderVideo.play(); } catch (e) { /* último recurso */ }
  }

  await new Promise((resolve) => {
    const onEnded = () => {
      els.leaderVideo.removeEventListener('ended', onEnded);
      resolve();
    };
    els.leaderVideo.addEventListener('ended', onEnded);

    const checkSkip = setInterval(() => {
      if (introSkipped) {
        clearInterval(checkSkip);
        els.leaderVideo.pause();
        els.leaderVideo.removeEventListener('ended', onEnded);
        resolve();
      }
    }, 100);
  });

  goToMain();
}

/* ----------------------------------------------------
   Pasar al contenido principal
---------------------------------------------------- */
function goToMain() {
  if (introFinished) return;
  introFinished = true;

  if (!els.leaderVideo.paused && !els.leaderVideo.ended) {
    els.leaderVideo.pause();
  }

  setStage(stages.main);
  document.body.classList.remove('intro-playing');
  hideSkipButton();

  window.scrollTo(0, 0);

  if (els.firstTestimonio) {
    els.firstTestimonio.muted = false;
    els.firstTestimonio.play().catch((err) => {
      console.warn('Autoplay del primer testimonio falló (normal en algunos browsers):', err);
    });
  }
}

/* ----------------------------------------------------
   Event listeners
---------------------------------------------------- */

// Tap en la gate arranca todo
els.gateButton.addEventListener('click', () => {
  if (introStarted) return;

  // Crear y "destrabar" el pool de audio dentro del gesture del usuario
  buildAudioPool();
  unlockAudioPool();

  // Precargar el video del leader para que arranque sin demora
  els.leaderVideo.load();

  runIntroSequence();
});

// Skip
els.skipBtn.addEventListener('click', () => {
  if (introFinished) return;
  introSkipped = true;
  goToMain();
});

// Accesibilidad: Escape también salta la intro
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !introFinished && introStarted) {
    introSkipped = true;
    goToMain();
  }
});
