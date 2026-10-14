/**
 * Flip Clock Application - Final JavaScript
 * Vanilla JS ES6 implementation of a Split-Flap Clock
 */

(function () {
  'use strict';

  // --- DEFAULT STATE ---
  const DEFAULT_SETTINGS = {
    isLive: true,
    showSeconds: true, // Defaulted to true to match premium layout requirements
    is24Hour: false,
    hudVisible: true,
    fixedHour: 10,
    fixedMinute: 32, // Set to match the screenshot time
    fixedAmPm: 'PM'
  };

  // State object initialized from LocalStorage or Defaults
  let state = loadSettings();

  // Internal Clock Interval & Fixed Time Tracking
  let clockInterval = null;
  let fixedStartTime = null;
  let fixedBaseTimestamp = null;

  // Cache DOM Elements safely
  const elements = {
    hoursTens: document.getElementById('hours-tens'),
    hoursUnits: document.getElementById('hours-units'),
    minutesTens: document.getElementById('minutes-tens'),
    minutesUnits: document.getElementById('minutes-units'),
    secondsTens: document.getElementById('seconds-tens'),
    secondsUnits: document.getElementById('seconds-units'),
    secondsWrapper: document.getElementById('seconds-wrapper'),
    ampmBadge: document.getElementById('ampm-badge'),
    ampmText: document.getElementById('ampm-text'),

    // HUD Elements
    hud: document.getElementById('hud'),
    showHudBtn: document.getElementById('show-hud-btn'),
    hideHudBtn: document.getElementById('hide-hud-btn'),
    modeLiveBtn: document.getElementById('mode-live'),
    modeFixedBtn: document.getElementById('mode-fixed'),
    quickTimeGroup: document.getElementById('quick-time-group'),
    hudHourInput: document.getElementById('hud-hour-input'),
    hudMinuteInput: document.getElementById('hud-minute-input'),
    hudAmPmSelect: document.getElementById('hud-ampm-select'),
    toggleSeconds: document.getElementById('toggle-seconds'),
    toggle24h: document.getElementById('toggle-24h'),
    openEditorBtn: document.getElementById('open-editor-btn'),
    toggleFullscreenBtn: document.getElementById('toggle-fullscreen-btn'),
    resetSettingsBtn: document.getElementById('reset-settings-btn'),

    // Modal Elements
    timeModal: document.getElementById('time-modal'),
    modalHour: document.getElementById('modal-hour'),
    modalMinute: document.getElementById('modal-minute'),
    modalAmPm: document.getElementById('modal-ampm'),
    modalAmPmWrapper: document.getElementById('modal-ampm-wrapper'),
    modalSaveBtn: document.getElementById('modal-save-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn')
  };

  // --- INITIALIZATION ---
  function init() {
    applyStateToUI();
    setupEventListeners();
    startClock();
  }

  // --- LOCAL STORAGE FUNCTIONS ---
  function loadSettings() {
    try {
      const saved = localStorage.getItem('flip_clock_settings_v2');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
      console.warn('LocalStorage unavailable, fallback to defaults:', e);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem('flip_clock_settings_v2', JSON.stringify(state));
    } catch (e) {
      console.warn('Unable to save settings to LocalStorage:', e);
    }
  }

  // --- FIXED TIME OFFSET CALCULATION ---
  function resetFixedOffset() {
    const now = new Date();
    let h = parseInt(state.fixedHour, 10) || 12;
    const m = parseInt(state.fixedMinute, 10) || 0;

    if (!state.is24Hour) {
      if (state.fixedAmPm === 'PM' && h < 12) h += 12;
      if (state.fixedAmPm === 'AM' && h === 12) h = 0;
    }

    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
    fixedBaseTimestamp = targetDate.getTime();
    fixedStartTime = Date.now();
  }

  // --- UI CONTROLS & STATE SYNC ---
  function applyStateToUI() {
    // Toggles
    if (elements.toggleSeconds) elements.toggleSeconds.checked = state.showSeconds;
    if (elements.toggle24h) elements.toggle24h.checked = state.is24Hour;

    // Visibility
    if (state.showSeconds) {
      if (elements.secondsWrapper) elements.secondsWrapper.classList.remove('hidden');
    } else {
      if (elements.secondsWrapper) elements.secondsWrapper.classList.add('hidden');
    }

    if (state.is24Hour) {
      if (elements.ampmBadge) elements.ampmBadge.classList.add('hidden');
      if (elements.hudAmPmSelect) elements.hudAmPmSelect.disabled = true;
      if (elements.modalAmPmWrapper) elements.modalAmPmWrapper.style.display = 'none';
      if (elements.hudHourInput) elements.hudHourInput.max = 23;
      if (elements.modalHour) elements.modalHour.max = 23;
    } else {
      if (elements.ampmBadge) elements.ampmBadge.classList.remove('hidden');
      if (elements.hudAmPmSelect) elements.hudAmPmSelect.disabled = false;
      if (elements.modalAmPmWrapper) elements.modalAmPmWrapper.style.display = 'flex';
      if (elements.hudHourInput) elements.hudHourInput.max = 12;
      if (elements.modalHour) elements.modalHour.max = 12;
    }

    // Modes
    if (state.isLive) {
      if (elements.modeLiveBtn) elements.modeLiveBtn.classList.add('active');
      if (elements.modeFixedBtn) elements.modeFixedBtn.classList.remove('active');
      if (elements.quickTimeGroup) elements.quickTimeGroup.classList.add('disabled');
    } else {
      if (elements.modeFixedBtn) elements.modeFixedBtn.classList.add('active');
      if (elements.modeLiveBtn) elements.modeLiveBtn.classList.remove('active');
      if (elements.quickTimeGroup) elements.quickTimeGroup.classList.remove('disabled');
    }

    // HUD Visibility
    if (state.hudVisible) {
      if (elements.hud) elements.hud.classList.remove('hidden');
      if (elements.showHudBtn) elements.showHudBtn.classList.add('hidden');
    } else {
      if (elements.hud) elements.hud.classList.add('hidden');
      if (elements.showHudBtn) elements.showHudBtn.classList.remove('hidden');
    }

    // HUD Inputs sync
    if (elements.hudHourInput) elements.hudHourInput.value = state.fixedHour;
    if (elements.hudMinuteInput) elements.hudMinuteInput.value = String(state.fixedMinute).padStart(2, '0');
    if (elements.hudAmPmSelect) elements.hudAmPmSelect.value = state.fixedAmPm;

    // Trigger initial render
    updateClock(true);
  }

  // --- CLOCK LOOP & TIMING LOGIC ---
  function startClock() {
    if (clockInterval) clearInterval(clockInterval);
    updateClock(true);
    clockInterval = setInterval(() => updateClock(false), 1000);
  }

  function updateClock(forceImmediate = false) {
    let hours, minutes, seconds, ampm = 'AM';

    if (state.isLive) {
      const now = new Date();
      let rawHours = now.getHours();
      minutes = now.getMinutes();
      seconds = now.getSeconds();

      if (state.is24Hour) {
        hours = rawHours;
      } else {
        ampm = rawHours >= 12 ? 'PM' : 'AM';
        hours = rawHours % 12;
        if (hours === 0) hours = 12;
      }
    } else {
      // Fixed Time Mode — Ticking forward from user's custom set time
      if (!fixedStartTime || !fixedBaseTimestamp) {
        resetFixedOffset();
      }

      const elapsedMs = Date.now() - fixedStartTime;
      const simulatedDate = new Date(fixedBaseTimestamp + elapsedMs);

      let rawHours = simulatedDate.getHours();
      minutes = simulatedDate.getMinutes();
      seconds = simulatedDate.getSeconds();

      if (state.is24Hour) {
        hours = rawHours;
      } else {
        ampm = rawHours >= 12 ? 'PM' : 'AM';
        hours = rawHours % 12;
        if (hours === 0) hours = 12;
      }
    }

    // Format Digits
    const hStr = String(hours).padStart(2, '0');
    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');

    // Update Card Digits with Split-Flap Animation
    flipDigit(elements.hoursTens, hStr[0], forceImmediate);
    flipDigit(elements.hoursUnits, hStr[1], forceImmediate);

    flipDigit(elements.minutesTens, mStr[0], forceImmediate);
    flipDigit(elements.minutesUnits, mStr[1], forceImmediate);

    if (state.showSeconds) {
      flipDigit(elements.secondsTens, sStr[0], forceImmediate);
      flipDigit(elements.secondsUnits, sStr[1], forceImmediate);
    }

    // Update AM/PM
    if (!state.is24Hour && elements.ampmText && elements.ampmText.textContent !== ampm) {
      elements.ampmText.textContent = ampm;
      const bottomSpan = elements.ampmBadge ? elements.ampmBadge.querySelector('.card-bottom span') : null;
      if (bottomSpan) bottomSpan.textContent = ampm;
    }
  }

  // --- CORE 3D FLIP ANIMATION ENGINE ---
  function flipDigit(cardEl, newValue, forceImmediate) {
    if (!cardEl) return;
    const currentValue = cardEl.dataset.value;

    if (currentValue === newValue && !forceImmediate) return;

    const topStatic = cardEl.querySelector('.card-top span');
    const bottomStatic = cardEl.querySelector('.card-bottom span');
    const leafFront = cardEl.querySelector('.flip-leaf-front span');
    const leafBack = cardEl.querySelector('.flip-leaf-back span');

    if (!topStatic || !bottomStatic || !leafFront || !leafBack) return;

    if (forceImmediate) {
      topStatic.textContent = newValue;
      bottomStatic.textContent = newValue;
      leafFront.textContent = newValue;
      leafBack.textContent = newValue;
      cardEl.dataset.value = newValue;
      cardEl.classList.remove('flipping');
      return;
    }

    // Setup Split-Flap cards for flip
    topStatic.textContent = newValue;
    bottomStatic.textContent = currentValue;
    leafFront.textContent = currentValue;
    leafBack.textContent = newValue;

    // Trigger CSS Keyframe animation
    cardEl.classList.remove('flipping');
    void cardEl.offsetWidth; // Force Reflow
    cardEl.classList.add('flipping');

    cardEl.dataset.value = newValue;

    // After animation finishes, align bottom static state
    setTimeout(() => {
      bottomStatic.textContent = newValue;
    }, 450); 
  }

  // --- EVENT LISTENERS & HANDLERS ---
  function setupEventListeners() {
    // HUD Toggle Hide/Show
    if (elements.hideHudBtn) elements.hideHudBtn.addEventListener('click', toggleHUD);
    if (elements.showHudBtn) elements.showHudBtn.addEventListener('click', toggleHUD);

    // Mode Toggle
    if (elements.modeLiveBtn) {
      elements.modeLiveBtn.addEventListener('click', () => {
        state.isLive = true;
        saveSettings();
        applyStateToUI();
      });
    }

    if (elements.modeFixedBtn) {
      elements.modeFixedBtn.addEventListener('click', () => {
        state.isLive = false;
        resetFixedOffset();
        saveSettings();
        applyStateToUI();
      });
    }

    // Quick Time HUD Inputs
    const onQuickTimeChange = () => {
      state.fixedHour = parseInt(elements.hudHourInput.value, 10) || 12;
      state.fixedMinute = parseInt(elements.hudMinuteInput.value, 10) || 0;
      state.fixedAmPm = elements.hudAmPmSelect.value;
      resetFixedOffset();
      saveSettings();
      if (!state.isLive) updateClock(true);
    };

    if (elements.hudHourInput) elements.hudHourInput.addEventListener('change', onQuickTimeChange);
    if (elements.hudMinuteInput) elements.hudMinuteInput.addEventListener('change', onQuickTimeChange);
    if (elements.hudAmPmSelect) elements.hudAmPmSelect.addEventListener('change', onQuickTimeChange);

    // Toggles
    if (elements.toggleSeconds) {
      elements.toggleSeconds.addEventListener('change', (e) => {
        state.showSeconds = e.target.checked;
        saveSettings();
        applyStateToUI();
      });
    }

    if (elements.toggle24h) {
      elements.toggle24h.addEventListener('change', (e) => {
        state.is24Hour = e.target.checked;
        resetFixedOffset(); // Reset offset to handle AM/PM mapping changes cleanly
        saveSettings();
        applyStateToUI();
      });
    }

    // Fullscreen Toggle
    if (elements.toggleFullscreenBtn) elements.toggleFullscreenBtn.addEventListener('click', toggleFullscreen);

    // Reset Defaults
    if (elements.resetSettingsBtn) {
      elements.resetSettingsBtn.addEventListener('click', () => {
        state = { ...DEFAULT_SETTINGS };
        resetFixedOffset();
        saveSettings();
        applyStateToUI();
      });
    }

    // Time Editor Modal
    if (elements.openEditorBtn) elements.openEditorBtn.addEventListener('click', openTimeModal);
    if (elements.modalCancelBtn) elements.modalCancelBtn.addEventListener('click', closeTimeModal);
    if (elements.modalSaveBtn) elements.modalSaveBtn.addEventListener('click', saveTimeModal);

    // Close Modal on backdrop click
    if (elements.timeModal) {
      elements.timeModal.addEventListener('click', (e) => {
        if (e.target === elements.timeModal) closeTimeModal();
      });
    }

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', handleKeyPress);
  }

  function toggleHUD() {
    state.hudVisible = !state.hudVisible;
    saveSettings();
    applyStateToUI();
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Fullscreen error: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  function openTimeModal() {
    if (!elements.modalHour) return;
    elements.modalHour.value = state.fixedHour;
    elements.modalMinute.value = String(state.fixedMinute).padStart(2, '0');
    elements.modalAmPm.value = state.fixedAmPm;
    elements.timeModal.classList.remove('hidden');
  }

  function closeTimeModal() {
    if (elements.timeModal) elements.timeModal.classList.add('hidden');
  }

  function saveTimeModal() {
    state.fixedHour = parseInt(elements.modalHour.value, 10) || 12;
    state.fixedMinute = parseInt(elements.modalMinute.value, 10) || 0;
    state.fixedAmPm = elements.modalAmPm.value;
    state.isLive = false; // Automatically switch to fixed mode when setting custom time
    
    resetFixedOffset();
    saveSettings();
    applyStateToUI();
    closeTimeModal();
  }

  function handleKeyPress(e) {
    // Avoid triggering shortcuts when typing in input fields
    if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      if (e.key === 'Escape') {
        document.activeElement.blur();
        closeTimeModal();
      }
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'h':
        e.preventDefault();
        toggleHUD();
        break;
      case 'f':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 't':
        e.preventDefault();
        openTimeModal();
        break;
      case 'escape':
        closeTimeModal();
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
        break;
    }
  }

  // Launch on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();