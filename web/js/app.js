/**
 * FoZ SoundPro — Master Application Controller (v1.1)
 * ===================================================
 * Conecta la interfaz con todos los módulos del estudio:
 *  - Secuenciador de 16 voces (con muestras locales por pista)
 *  - FX Trackpad (bus de efectos XY)
 *  - Record Studio (grabación con beat, cadena pro, tomas WAV en IndexedDB)
 *  - Base Library (bases importadas MP3/M4U sincronizadas al transporte)
 *  - Asistente IA, Gestor de Proyectos y Diagnóstico
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Instancias globales
  const audio = window.fozAudioEngine;
  const seq = window.fozSequencer;
  const projMgr = window.fozProjectManager;
  const midi = window.fozMidiEngine;
  const ai = window.fozAIAssistant;
  const sampler = window.fozSampler;
  const trackpad = window.fozTrackpad;
  const baseLib = window.fozBaseLibrary;
  const recStudio = window.fozRecStudio;

  // 2. Estado local de la aplicación
  let currentProject = projMgr.loadCurrentProject();
  seq.setProject(currentProject);
  trackpad.setProject(currentProject);

  // 3. Elementos del DOM — Transporte
  const btnPlayPause = document.getElementById("btn-play-pause");
  const btnStop = document.getElementById("btn-stop");
  const btnMetronome = document.getElementById("btn-metronome");
  const displayBar = document.getElementById("display-bar");
  const displayStep = document.getElementById("display-step");
  const inputBpm = document.getElementById("input-bpm");
  const btnBpmDown = document.getElementById("btn-bpm-down");
  const btnBpmUp = document.getElementById("btn-bpm-up");
  const rangeSwing = document.getElementById("range-swing");
  const labelSwingVal = document.getElementById("label-swing-val");
  const rangeMasterVol = document.getElementById("range-master-vol");
  const selectStepsCount = document.getElementById("select-steps-count");

  const masterVisualizer = document.getElementById("master-visualizer");
  const visualizerCtx = masterVisualizer.getContext("2d");

  const btnQuickWav = document.getElementById("btn-quick-export-wav");
  const btnQuickMidi = document.getElementById("btn-quick-export-midi");
  const btnFooterWav = document.getElementById("btn-export-wav-dialog");
  const btnFooterMidi = document.getElementById("btn-export-midi-dialog");

  const sequencerGrid = document.getElementById("sequencer-grid");
  const stepsTimeline = document.getElementById("steps-timeline");
  const footerProjectName = document.getElementById("footer-project-name");
  const toastNotification = document.getElementById("toast-notification");

  // Pestañas de navegación
  const navButtons = document.querySelectorAll(".nav-button");
  const tabPanels = document.querySelectorAll(".studio-tab-panel");

  // =========================================================================
  // SISTEMA DE NOTIFICACIONES TOAST
  // =========================================================================
  function showToast(message, duration = 3000) {
    if (!toastNotification) return;
    toastNotification.textContent = message;
    toastNotification.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      toastNotification.classList.remove("show");
    }, duration);
  }

  // =========================================================================
  // NAVEGACIÓN ENTRE PESTAÑAS (MÓDULOS)
  // =========================================================================
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.getAttribute("data-tab");
      navButtons.forEach((b) => b.classList.remove("active"));
      tabPanels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = document.getElementById(targetTabId);
      if (targetPanel) targetPanel.classList.add("active");

      if (targetTabId === "tab-diagnostics") updateDiagnosticsUI();
      if (targetTabId === "tab-vocal") refreshRecDevices();
      if (targetTabId === "tab-bases") renderBaseList();
      if (targetTabId === "tab-trackpad") trackpad._draw();
    });
  });

  // =========================================================================
  // PALETA DE INSTRUMENTOS (16 VOCES)
  // =========================================================================
  const instrumentColorMap = {
    kick:         "#ff5722",
    snare:        "#00e5ff",
    clap:         "#ffd600",
    hihat_closed: "#e2e8f0",
    hihat_open:   "#38bdf8",
    bass808:      "#c084fc",
    rimshot:      "#f59e0b",
    crash:        "#ff9c00",
    ride:         "#ffb703",
    tom_low:      "#7ee093",
    tom_mid:      "#5ad6ba",
    cowbell:      "#f4d03f",
    snap_trap:    "#ff4d9e",
    shaker:       "#9be564",
    stab_dark:    "#b388ff",
    horn_slap:    "#ffd28a",
  };

  // =========================================================================
  // RENDERIZADO DEL SECUENCIADOR POR PASOS
  // =========================================================================
  function renderTimeline() {
    stepsTimeline.innerHTML = "";
    const totalSteps = currentProject.stepsCount || 16;
    stepsTimeline.style.setProperty("--steps-count", String(totalSteps));
    for (let i = 0; i < totalSteps; i++) {
      const marker = document.createElement("div");
      marker.className = "timeline-marker" + (i % 4 === 0 ? " beat-head" : "");
      const beatNum = Math.floor(i / 4) + 1;
      const subNum = (i % 4) + 1;
      marker.textContent = `${beatNum}.${subNum}`;
      stepsTimeline.appendChild(marker);
    }
  }

  function renderSequencerGrid() {
    sequencerGrid.innerHTML = "";
    const totalSteps = currentProject.stepsCount || 16;

    currentProject.tracks.forEach((track, trackIdx) => {
      const instColor = instrumentColorMap[track.id] || "#00f2fe";
      const row = document.createElement("div");
      row.className = "track-row";
      row.id = `track-row-${trackIdx}`;
      row.style.setProperty("--track-accent", instColor);

      // 1. Controles de pista
      const controls = document.createElement("div");
      controls.className = "track-controls";

      const colorTag = document.createElement("span");
      colorTag.className = "track-color-pill";
      colorTag.style.backgroundColor = instColor;
      controls.appendChild(colorTag);

      const nameBtn = document.createElement("button");
      nameBtn.className = "track-name-btn";
      nameBtn.textContent = track.name;
      const sampleName = sampler.getSampleName(track.id);
      nameBtn.title = sampleName
        ? `Muestra cargada: ${sampleName}. Clic para escuchar.`
        : `Escuchar muestra de ${track.name}`;
      nameBtn.addEventListener("click", () => {
        audio.init().then(() => {
          audio.triggerInstrument(track.id, 0, track.volume || 0.85);
        });
      });

      // Botón de muestra local (Sample Studio)
      const btnSample = document.createElement("button");
      btnSample.className = "btn-sample" + (sampleName ? " loaded" : "");
      btnSample.textContent = sampleName ? "🎵" : "📂";
      btnSample.title = sampleName ? `Muestra: ${sampleName} (clic para sustituir)` : "Cargar muestra local para esta pista";
      btnSample.addEventListener("click", () => {
        pendingSampleTrackId = track.id;
        inputSampleFile.value = "";
        inputSampleFile.click();
      });

      let btnClearSample = null;
      if (sampleName) {
        btnClearSample = document.createElement("button");
        btnClearSample.className = "btn-sample-clear";
        btnClearSample.textContent = "✕";
        btnClearSample.title = "Quitar muestra y volver a la voz sintética";
        btnClearSample.addEventListener("click", () => {
          sampler.clearSample(track.id);
          renderSequencerGrid();
          showToast(`Muestra de ${track.name} retirada.`);
        });
      }

      const btnMute = document.createElement("button");
      btnMute.className = "btn-mute" + (track.muted ? " active" : "");
      btnMute.textContent = "M";
      btnMute.title = "Silenciar pista (Mute)";
      btnMute.addEventListener("click", () => {
        seq.toggleTrackMute(trackIdx);
        btnMute.classList.toggle("active", track.muted);
      });

      const btnSolo = document.createElement("button");
      btnSolo.className = "btn-solo" + (track.solo ? " active" : "");
      btnSolo.textContent = "S";
      btnSolo.title = "Solo pista";
      btnSolo.addEventListener("click", () => {
        seq.toggleTrackSolo(trackIdx);
        btnSolo.classList.toggle("active", track.solo);
      });

      const volSlider = document.createElement("input");
      volSlider.type = "range";
      volSlider.className = "track-vol-slider";
      volSlider.min = "0";
      volSlider.max = "1.2";
      volSlider.step = "0.05";
      volSlider.value = track.volume !== undefined ? track.volume : 0.85;
      volSlider.title = `Volumen de ${track.name}`;
      volSlider.addEventListener("input", (e) => {
        seq.setTrackVolume(trackIdx, parseFloat(e.target.value));
      });

      controls.appendChild(nameBtn);
      controls.appendChild(btnSample);
      if (btnClearSample) controls.appendChild(btnClearSample);
      controls.appendChild(btnMute);
      controls.appendChild(btnSolo);
      controls.appendChild(volSlider);
      row.appendChild(controls);

      // 2. Pasos (toggle; Shift+Click cicla la velocity del paso activo)
      const stepsContainer = document.createElement("div");
      stepsContainer.className = "track-steps";
      stepsContainer.style.setProperty("--steps-count", String(totalSteps));

      const velocityCycles = [0.5, 0.85, 1.0];

      for (let s = 0; s < totalSteps; s++) {
        const stepBtn = document.createElement("button");
        const isGroupAlt = Math.floor(s / 4) % 2 === 1;
        const hasVel = track.velocities && track.velocities[s] !== undefined;
        const isSoft = hasVel && track.velocities[s] <= 0.6 && track.steps[s];
        const isHard = hasVel && track.velocities[s] >= 0.98 && track.steps[s];

        stepBtn.className = "step-btn"
          + (isGroupAlt ? " group-alt" : "")
          + (track.steps[s] ? " active" : "")
          + (isSoft ? " vel-soft" : "")
          + (isHard ? " vel-hard" : "");
        stepBtn.id = `step-${trackIdx}-${s}`;
        stepBtn.setAttribute("data-track", trackIdx);
        stepBtn.setAttribute("data-step", s);
        stepBtn.title = `${track.name} — Paso ${s + 1}` + (isSoft ? " (suave)" : isHard ? "(forte)" : "");

        stepBtn.addEventListener("click", (ev) => {
          if (ev.shiftKey && track.steps[s]) {
            const cur = track.velocities[s] || 0.85;
            const idxNext = (velocityCycles.indexOf(cur) + 1) % velocityCycles.length;
            seq.setStepVelocity(trackIdx, s, velocityCycles[idxNext]);
            renderSequencerGrid();
            return;
          }
          seq.toggleStep(trackIdx, s);
          renderSequencerGrid();
        });

        stepsContainer.appendChild(stepBtn);
      }

      row.appendChild(stepsContainer);
      sequencerGrid.appendChild(row);
    });

    if (footerProjectName) {
      footerProjectName.textContent = `Proyecto: ${currentProject.name}`;
    }
  }

  // =========================================================================
  // SAMPLE STUDIO (muestras locales)
  // =========================================================================
  let pendingSampleTrackId = null;
  const inputSampleFile = document.getElementById("input-sample-file");

  if (inputSampleFile) {
    inputSampleFile.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      const trackId = pendingSampleTrackId;
      if (!file || !trackId) return;
      try {
        await sampler.loadSample(trackId, file);
        audio.init().then(() => {
          audio.triggerInstrument(trackId, 0, 0.9);
        });
        showToast(`Muestra cargada en la pista (solo esta sesión): ${file.name}`);
      } catch (err) {
        showToast(`Error al cargar muestra: ${err.message}`);
      } finally {
        pendingSampleTrackId = null;
        renderSequencerGrid();
      }
    });
  }

  // =========================================================================
  // CONTROL DE TRANSPORTE Y TIEMPO (BPM, SWING, VOLUME, PASOS)
  // =========================================================================
  function updateTransportUI() {
    inputBpm.value = currentProject.bpm;
    rangeSwing.value = currentProject.swing || 0.1;
    labelSwingVal.textContent = `${Math.round((currentProject.swing || 0.1) * 100)}%`;
    rangeMasterVol.value = currentProject.masterVolume || 0.85;
    if (selectStepsCount) selectStepsCount.value = String(currentProject.stepsCount || 16);
  }

  btnPlayPause.addEventListener("click", () => {
    seq.togglePlay();
  });

  btnStop.addEventListener("click", () => {
    seq.stop();
  });

  // Atajo de teclado (Barra espaciadora para Play/Stop)
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "SELECT") {
      e.preventDefault();
      seq.togglePlay();
    }
  });

  // Hook: estado de reproducción (UI + Bases sincronizadas)
  seq.onPlayStateChange = (isPlaying) => {
    if (isPlaying) {
      btnPlayPause.classList.add("playing");
      btnPlayPause.querySelector(".transport-label").textContent = "PAUSE";
      btnPlayPause.querySelector(".transport-icon").textContent = "⏸";
      // La base activa arranca con el transporte
      if (baseLib.getActive() && !baseLib.playing) {
        baseLib.startLive().catch((err) => showToast(err.message));
      }
    } else {
      btnPlayPause.classList.remove("playing");
      btnPlayPause.querySelector(".transport-label").textContent = "PLAY";
      btnPlayPause.querySelector(".transport-icon").textContent = "▶";
      baseLib.stopLive();
    }
  };

  // Hook: BPM cambia → eco del trackpad sincronizado (corchea musical)
  seq.onBpmChange = (bpm) => {
    trackpad.syncEchoToBpm(bpm);
  };

  // Metrónomo
  if (btnMetronome) {
    btnMetronome.addEventListener("click", () => {
      const active = seq.toggleMetronome();
      btnMetronome.classList.toggle("active", active);
      showToast(active ? "Metrónomo activado" : "Metrónomo desactivado");
    });
  }

  // Cursor visual de paso y display digital
  let previousCursorStep = -1;
  seq.onStepChange = (activeStep) => {
    if (previousCursorStep >= 0 && previousCursorStep !== activeStep) {
      document.querySelectorAll(`.step-btn[data-step="${previousCursorStep}"]`).forEach((el) => {
        el.classList.remove("cursor");
      });
    }

    document.querySelectorAll(`.step-btn[data-step="${activeStep}"]`).forEach((el) => {
      el.classList.add("cursor");
    });
    previousCursorStep = activeStep;

    if (displayStep) {
      const beatNum = Math.floor(activeStep / 4) + 1;
      const subStep = (activeStep % 4) + 1;
      displayStep.textContent = `PULSO ${beatNum}.${subStep}`;
    }
  };

  // BPM
  inputBpm.addEventListener("change", (e) => {
    seq.setBpm(e.target.value);
    updateTransportUI();
  });

  btnBpmDown.addEventListener("click", () => {
    seq.setBpm(currentProject.bpm - 1);
    inputBpm.value = currentProject.bpm;
  });

  btnBpmUp.addEventListener("click", () => {
    seq.setBpm(currentProject.bpm + 1);
    inputBpm.value = currentProject.bpm;
  });

  // Swing
  rangeSwing.addEventListener("input", (e) => {
    seq.setSwing(e.target.value);
    labelSwingVal.textContent = `${Math.round(currentProject.swing * 100)}%`;
  });

  // Master Volume
  rangeMasterVol.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    audio.setMasterVolume(val);
    currentProject.masterVolume = val;
    projMgr.saveCurrentProject(currentProject);
  });

  // Número de pasos (16/32/64)
  if (selectStepsCount) {
    selectStepsCount.addEventListener("change", (e) => {
      seq.setStepsCount(e.target.value);
      renderTimeline();
      renderSequencerGrid();
      showToast(`Resolución del patrón: ${currentProject.stepsCount} pasos`);
    });
  }

  // Botón "Limpiar" lo renderiza renderPresetQuickBar() junto a los kits

  // Presets Rápidos (dibujados desde el Project Manager, 8 kits)
  function renderPresetQuickBar() {
    const bar = document.getElementById("preset-quick-bar");
    if (!bar) return;
    bar.innerHTML = '<span class="preset-bar-label">Kits:</span>';
    projMgr.getPresets().forEach((preset) => {
      const chip = document.createElement("button");
      chip.className = "btn-preset-chip";
      chip.dataset.preset = preset.id;
      chip.textContent = preset.name.split(" (")[0];
      chip.addEventListener("click", () => {
        currentProject = projMgr.loadPresetIntoProject(preset.id);
        seq.setProject(currentProject);
        trackpad.setProject(currentProject);
        updateTransportUI();
        renderSequencerGrid();
        renderPresetsCatalog();
        showToast(`Preset cargado: ${currentProject.name}`);
      });
      bar.appendChild(chip);
    });
    const clearBtn = document.createElement("button");
    clearBtn.className = "btn-preset-chip btn-danger";
    clearBtn.id = "btn-clear-pattern";
    clearBtn.title = "Borrar todos los pasos";
    clearBtn.textContent = "Limpiar";
    clearBtn.addEventListener("click", () => {
      seq.clearPattern();
      renderSequencerGrid();
      showToast("Patrón limpiado.");
    });
    bar.appendChild(clearBtn);
  }

  // =========================================================================
  // FX TRACKPAD
  // =========================================================================
  const trackpadCanvas = document.getElementById("trackpad-canvas");
  const trackpadState = document.getElementById("trackpad-state");
  const btnLatch = document.getElementById("btn-latch");
  const btnInExport = document.getElementById("btn-in-export");
  const btnResetPad = document.getElementById("btn-reset-pad");
  const selectMapX = document.getElementById("select-map-x");
  const selectMapY = document.getElementById("select-map-y");

  if (trackpadCanvas) {
    trackpad.init(trackpadCanvas, projMgr, (state) => {
      if (trackpadState) trackpadState.textContent = `${state.filter}  •  ${state.y}`;
    });
  }

  if (btnLatch) {
    btnLatch.addEventListener("click", () => {
      const active = trackpad.toggleLatch();
      btnLatch.classList.toggle("active", active);
      showToast(active ? "Modo momentáneo ON (vuelve al neutro al soltar)" : "Modo valor persistente (estilo looper)");
    });
  }
  if (btnInExport) {
    btnInExport.addEventListener("click", () => {
      const active = trackpad.toggleInExport();
      btnInExport.classList.toggle("active", active);
      showToast(active ? "Los FX del trackpad se hornearán en el WAV" : "Export WAV sin FX del trackpad");
    });
  }
  if (btnResetPad) {
    btnResetPad.addEventListener("click", () => {
      trackpad.resetPad();
      showToast("Estado FX reseteado (neutro).");
    });
  }
  if (selectMapX) {
    selectMapX.addEventListener("change", (e) => trackpad.setMapX(e.target.value));
  }
  if (selectMapY) {
    selectMapY.addEventListener("change", (e) => trackpad.setMapY(e.target.value));
  }
  document.querySelectorAll(".btn-pad-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      trackpad.applyStylePreset(btn.dataset.padpreset);
      showToast(`FX preset: ${btn.textContent.trim()}`);
    });
  });

  function syncTrackpadUi() {
    if (currentProject.padFx) {
      if (btnLatch) btnLatch.classList.toggle("active", currentProject.padFx.latch);
      if (btnInExport) btnInExport.classList.toggle("active", currentProject.padFx.inExport);
      if (selectMapX) selectMapX.value = currentProject.padFx.mapX;
      if (selectMapY) selectMapY.value = currentProject.padFx.mapY;
    }
  }

  // =========================================================================
  // EXPORTACIÓN DE AUDIO Y MIDI (con base y FX horneados)
  // =========================================================================
  function buildPadFxForExport() {
    const fx = currentProject.padFx;
    if (!fx || !fx.active) return null;
    return {
      filterMode: fx.mapX,
      filterHz: trackpad._xToHz(fx.x),
      drive: fx.mapY === "tape" ? fx.y * FoZConstants.PAD_DRIVE_MAX : 0,
      echoMix: fx.mapY === "echo" ? fx.y * FoZConstants.PAD_ECHO_WET_MAX : 0,
      echoTime: (60.0 / currentProject.bpm) * FoZConstants.PAD_DELAY_DIVISION,
    };
  }

  async function handleExportWav() {
    showToast("Renderizando audio WAV PCM 16b en navegador...");
    try {
      await audio.init();
      const bars = Math.max(1, currentProject.stepsCount / 16);
      const opts = {
        backing: baseLib.exportParams(),
        padFx: currentProject.padFx && currentProject.padFx.inExport ? buildPadFxForExport() : null,
      };
      const blob = await audio.exportPatternToWavBlob(currentProject, bars, opts);
      const filename = `${currentProject.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_${currentProject.bpm}bpm.wav`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      showToast(`¡WAV exportado con éxito! (${(blob.size / 1024).toFixed(1)} KB)`);
    } catch (err) {
      showToast(`Error al exportar WAV: ${err.message}`);
    }
  }

  function handleExportMidi() {
    try {
      const bars = Math.max(1, currentProject.stepsCount / 16);
      const blob = midi.createMidiBlob(currentProject, bars);
      const filename = `${currentProject.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_${currentProject.bpm}bpm.mid`;
      midi.downloadMidi(blob, filename);
      showToast(`¡MIDI SMF1 exportado con éxito! (${blob.size} bytes)`);
    } catch (err) {
      showToast(`Error al exportar MIDI: ${err.message}`);
    }
  }

  btnQuickWav.addEventListener("click", handleExportWav);
  btnQuickMidi.addEventListener("click", handleExportMidi);
  btnFooterWav.addEventListener("click", handleExportWav);
  btnFooterMidi.addEventListener("click", handleExportMidi);

  // =========================================================================
  // ANALIZADOR DE ESPECTRO MASTER (CANVAS)
  // =========================================================================
  function drawMasterVisualizer() {
    requestAnimationFrame(drawMasterVisualizer);
    if (!audio.analyser) {
      visualizerCtx.fillStyle = "#090c12";
      visualizerCtx.fillRect(0, 0, masterVisualizer.width, masterVisualizer.height);
      visualizerCtx.fillStyle = "#1e2430";
      visualizerCtx.fillRect(0, masterVisualizer.height - 1, masterVisualizer.width, 1);
      return;
    }

    const bufferLength = audio.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    audio.analyser.getByteFrequencyData(dataArray);

    visualizerCtx.fillStyle = "#090c12";
    visualizerCtx.fillRect(0, 0, masterVisualizer.width, masterVisualizer.height);
    visualizerCtx.fillStyle = "#161b26";
    visualizerCtx.fillRect(0, masterVisualizer.height - 1, masterVisualizer.width, 1);

    const barCount = 24;
    const barWidth = masterVisualizer.width / barCount;
    let hasSignal = false;

    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor(i * (bufferLength / 32));
      if (dataArray[idx] > 4) { hasSignal = true; break; }
    }
    if (!hasSignal) return;

    let x = 0;
    for (let i = 0; i < barCount; i++) {
      const dataIdx = Math.floor(i * (bufferLength / 32));
      const val = dataArray[dataIdx] || 0;
      if (val > 4) {
        const barHeight = Math.max(2, (val / 255) * (masterVisualizer.height - 3));
        const grad = visualizerCtx.createLinearGradient(0, masterVisualizer.height, 0, 0);
        grad.addColorStop(0, "#00f2fe");
        grad.addColorStop(0.7, "#a855f7");
        grad.addColorStop(1, "#fe007a");
        visualizerCtx.fillStyle = grad;
        visualizerCtx.fillRect(x + 1, masterVisualizer.height - barHeight, barWidth - 2, barHeight);
      }
      x += barWidth;
    }
  }
  drawMasterVisualizer();

  // =========================================================================
  // RECORD STUDIO (GRABACIÓN CON CADENA PRO + TOMAS WAV)
  // =========================================================================
  const btnRecordStart = document.getElementById("btn-record-start");
  const btnRecordStop = document.getElementById("btn-record-stop");
  const recModeSelect = document.getElementById("rec-mode");
  const recPrerollSelect = document.getElementById("rec-preroll");
  const recCountdown = document.getElementById("rec-countdown");
  const recMonitorToggle = document.getElementById("rec-monitor-toggle");
  const recDeviceSelect = document.getElementById("rec-device");
  const recGateToggle = document.getElementById("rec-gate-toggle");
  const recOffsetSlider = document.getElementById("rec-offset");
  const recOffsetLabel = document.getElementById("rec-offset-label");
  const micCanvas = document.getElementById("mic-canvas");
  const micCtx = micCanvas ? micCanvas.getContext("2d") : null;
  const recMeterBar = document.getElementById("rec-meter-fill");
  const takesContainer = document.getElementById("takes-container");

  const vendorCheck = document.getElementById("btn-open-mic");
  const slMicGain = document.getElementById("rec-gain");
  const micList = document.getElementById("mic-list");

  function applyRecSettingsToUI() {
    const s = recStudio.settings;
    if (recMonitorToggle) recMonitorToggle.classList.toggle("active", s.monitorMode === "on");
    if (recGateToggle) recGateToggle.classList.toggle("active", !!s.gateEnabled);
    if (recOffsetSlider) {
      recOffsetSlider.value = s.offsetMs || 0;
      recOffsetLabel.textContent = `${(s.offsetMs || 0)} ms`;
    }
  }

  async function refreshRecDevices() {
    if (!recDeviceSelect) return;
    try {
      const devices = await recStudio.listDevices();
      recDeviceSelect.innerHTML = "";
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "";
      defaultOpt.textContent = "Dispositivo por defecto del sistema";
      recDeviceSelect.appendChild(defaultOpt);
      devices.forEach((d) => {
        const opt = document.createElement("option");
        opt.value = d.deviceId;
        opt.textContent = d.label;
        recDeviceSelect.appendChild(opt);
      });
      if (recStudio.settings.deviceId) recDeviceSelect.value = recStudio.settings.deviceId;
    } catch (e) {
      // Sin permiso aún: la lista se rellena tras activar el micro
    }
  }

  if (vendorCheck) {
    vendorCheck.addEventListener("click", async () => {
      try {
        recStudio.settings.deviceId = recDeviceSelect ? recDeviceSelect.value : "";
        await recStudio.openMic();
        applyRecSettingsToUI();
        await refreshRecDevices();
        showToast("Micrófono activo con cadena de voz lista.");
      } catch (err) {
        showToast(`Error al abrir micrófono: ${err.message}`);
      }
    });
  }

  if (recDeviceSelect) {
    recDeviceSelect.addEventListener("change", async (e) => {
      recStudio.settings.deviceId = e.target.value;
      recStudio.saveSettings();
      if (recStudio.micStream) {
        try { await recStudio.openMic(); refreshRecDevices(); } catch (err) { showToast(err.message); }
      }
    });
  }

  if (recMonitorToggle) {
    recMonitorToggle.addEventListener("click", () => {
      const next = recStudio.settings.monitorMode === "on" ? "off" : "on";
      recStudio.setMonitorMode(next);
      recMonitorToggle.classList.toggle("active", next === "on");
      if (next === "on") showToast("Monitor ON — usa auriculares para evitar acople.");
    });
  }
  if (recGateToggle) {
    recGateToggle.addEventListener("click", () => {
      recStudio.settings.gateEnabled = !recStudio.settings.gateEnabled;
      recStudio.saveSettings();
      applyRecSettingsToUI();
      showToast(recStudio.settings.gateEnabled ? "Noise gate offline activo en las tomas" : "Noise gate desactivado");
    });
  }
  if (recOffsetSlider) {
    recOffsetSlider.addEventListener("input", (e) => {
      recStudio.settings.offsetMs = parseInt(e.target.value, 10) || 0;
      recStudio.saveSettings();
      recOffsetLabel.textContent = `${recStudio.settings.offsetMs} ms`;
    });
  }
  if (slMicGain) {
    slMicGain.addEventListener("input", (e) => {
      recStudio.setMicGain(parseFloat(e.target.value));
    });
    slMicGain.value = recStudio.settings.gain;
  }
  document.getElementById("rec-hpf")?.addEventListener("change", (e) => {
    const hz = parseInt(e.target.value, 10);
    recStudio.setHpf(isNaN(hz) ? 0 : hz);
  });
  ["rec-eq-low", "rec-eq-mid", "rec-eq-high"].forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", (e) => {
      const v = parseFloat(e.target.value) || 0;
      recStudio.setEq(
        i === 0 ? v : recStudio.settings.eqLow,
        i === 1 ? v : recStudio.settings.eqMid,
        i === 2 ? v : recStudio.settings.eqHigh
      );
    });
    el.value = [recStudio.settings.eqLow, recStudio.settings.eqMid, recStudio.settings.eqHigh][i];
  });
  document.getElementById("rec-comp")?.addEventListener("change", (e) => {
    recStudio.setCompPreset(e.target.value);
  });
  document.getElementById("rec-reverb")?.addEventListener("input", (e) => {
    recStudio.setReverbSend(parseFloat(e.target.value) || 0);
  });
  document.getElementById("rec-echo")?.addEventListener("input", (e) => {
    recStudio.setEchoSend(parseFloat(e.target.value) || 0);
  });

  // --- Flujo de grabación ---------------------------------------------------
  let isRecordingActive = false;

  if (btnRecordStart) {
    btnRecordStart.addEventListener("click", async () => {
      if (isRecordingActive) return;
      const mode = recModeSelect ? recModeSelect.value : "voz+beat";
      const preroll = parseInt(recPrerollSelect ? recPrerollSelect.value : "1", 10);

      isRecordingActive = true;
      btnRecordStart.disabled = true;
      btnRecordStart.classList.add("recording");
      btnRecordStop.disabled = false;
      if (recCountdown) recCountdown.textContent = "PREPARANDO...";

      recStudio.onCountdown = (bar, beat) => {
        if (recCountdown) {
          recCountdown.textContent = `CUENTA: COMPÁS ${bar + 1} / PULSO ${beat + 1}`;
        }
      };
      recStudio.onStopRequestedByUser = () => btnRecordStop.click();

      try {
        await recStudio.start({
          includeMic: mode !== "beat",
          includeBeat: mode !== "voz",
          prerollBars: preroll,
          bpm: currentProject.bpm,
          onStartBeat: () => {
            if (!seq.isPlaying) seq.start();
          },
        });
        // Espera activa hasta goTime (feedback visual y auto-start elegido)
        const goAwait = recStudio.rec ? recStudio.rec.goTime : 0;
        const waitMs = Math.max(0, (goAwait - audio.ctx.currentTime) * 1000);
        setTimeout(() => {
          if (recCountdown && isRecordingActive) recCountdown.textContent = "GRABANDO...";
        }, waitMs);
        drawMicWaveform();
        showToast(mode === "voz" ? "Grabación de voz iniciada." : "Grabación con beat programada.");
      } catch (err) {
        isRecordingActive = false;
        btnRecordStart.disabled = false;
        btnRecordStart.classList.remove("recording");
        btnRecordStop.disabled = true;
        if (recCountdown) recCountdown.textContent = "";
        showToast(`Error al iniciar grabación: ${err.message}`);
      }
    });
  }

  if (btnRecordStop) {
    btnRecordStop.addEventListener("click", async () => {
      if (!isRecordingActive) return;
      btnRecordStop.disabled = true;
      isRecordingActive = false;
      seq.stop();
      baseLib.stopLive();

      if (recCountdown) recCountdown.textContent = "PROCESANDO...";
      try {
        const take = await recStudio.stop();
        if (take) {
          showToast(`Toma guardada (${(take.durationSec).toFixed(1)} s, ${(take.size / 1024).toFixed(0)} KB)`);
          await renderTakesList();
        }
      } catch (err) {
        showToast(`Error al cerrar la toma: ${err.message}`);
      } finally {
        btnRecordStart.disabled = false;
        btnRecordStart.classList.remove("recording");
        if (recCountdown) recCountdown.textContent = "";
      }
    });
  }

  // --- VU meter + osciloscopio del micro ------------------------------------
  function drawMicWaveform() {
    if (!micCtx) return;
    requestAnimationFrame(drawMicWaveform);
    if (!recStudio.micAnalyser || !isRecordingActive) {
      micCtx.fillStyle = "#090c12";
      micCtx.fillRect(0, 0, micCanvas.width, micCanvas.height);
      if (recMeterBar) recMeterBar.style.width = "0%";
      return;
    }

    const analyser = recStudio.micAnalyser;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    // VU (RMS)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = (dataArray[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / bufferLength);
    if (recMeterBar) {
      const pct = Math.min(100, Math.max(0, rms * 260));
      recMeterBar.style.width = pct + "%";
      recMeterBar.style.background = pct > 92 ? "#ff1744" : "#00f2fe";
    }

    // Osciloscopio
    micCtx.fillStyle = "#090c12";
    micCtx.fillRect(0, 0, micCanvas.width, micCanvas.height);
    micCtx.lineWidth = 2;
    micCtx.strokeStyle = isRecordingActive ? "#ff1744" : "#00f2fe";
    micCtx.beginPath();
    const sliceWidth = micCanvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = (dataArray[i] - 128) / 128;
      const y = micCanvas.height / 2 + v * micCanvas.height * 0.45;
      if (i === 0) micCtx.moveTo(x, y); else micCtx.lineTo(x, y);
      x += sliceWidth;
    }
    micCtx.stroke();
  }

  // --- Lista de tomas -------------------------------------------------------
  async function renderTakesList() {
    if (!takesContainer) return;
    takesContainer.innerHTML = "";
    try {
      const takes = await recStudio.listTakes();
      if (!takes.length) {
        const empty = document.createElement("div");
        empty.className = "takes-empty";
        empty.textContent = "Sin tomas aún. Activa el micro y graba tu primera toma con el beat.";
        takesContainer.appendChild(empty);
        return;
      }
      takes.forEach((take) => {
        const card = document.createElement("div");
        card.className = "take-card-v2";

        const info = document.createElement("div");
        info.className = "take-info";
        const title = document.createElement("div");
        title.className = "take-name";
        title.textContent = `${take.name}`;
        const meta = document.createElement("div");
        meta.className = "take-meta";
        meta.textContent =
          `${take.mode} • ${take.durationSec ? take.durationSec.toFixed(1) : "?"} s • ${(take.size / 1024).toFixed(0)} KB` +
          (take.clipped ? " • ⚠️ CLIPPING" : "") +
          (take.offsetMs ? ` • offset ${take.offsetMs} ms` : "");
        info.appendChild(title);
        info.appendChild(meta);

        const player = document.createElement("audio");
        player.controls = true;
        player.className = "take-player";
        const url = URL.createObjectURL(new Blob([take.blob], { type: "audio/wav" }));
        player.src = url;

        const actions = document.createElement("div");
        actions.className = "take-actions-v2";

        const btnDl = document.createElement("button");
        btnDl.className = "btn-action btn-accent-blue";
        btnDl.textContent = "⬇ WAV";
        btnDl.addEventListener("click", () => recStudio.downloadTake(take));

        const btnDel = document.createElement("button");
        btnDel.className = "btn-action btn-danger";
        btnDel.textContent = "🗑";
        btnDel.addEventListener("click", async () => {
          if (confirm(`¿Eliminar la toma ${take.name}?`)) {
            await recStudio.deleteTake(take.id);
            URL.revokeObjectURL(url);
            renderTakesList();
          }
        });

        actions.appendChild(btnDl);
        actions.appendChild(btnDel);

        card.appendChild(info);
        card.appendChild(player);
        card.appendChild(actions);
        takesContainer.appendChild(card);
      });
    } catch (err) {
      console.warn("No se pudieron listar las tomas:", err);
    }
  }
  applyRecSettingsToUI();
  renderTakesList();

  // =========================================================================
  // BASE LIBRARY (BASES IMPORTADAS)
  // =========================================================================
  const inputBaseFiles = document.getElementById("input-base-files");
  const btnImportBase = document.getElementById("btn-import-base");
  const btnImportM3U = document.getElementById("btn-import-m3u");
  const inputBaseM3U = document.getElementById("input-base-m3u");
  const baseListEl = document.getElementById("base-list");
  const baseCatalogInfo = document.getElementById("base-catalog-info");
  const baseGain = document.getElementById("base-gain");
  const baseFadeIn = document.getElementById("base-fade-in");
  const baseFadeOut = document.getElementById("base-fade-out");
  const baseLoop = document.getElementById("base-loop");
  const btnBasePreview = document.getElementById("btn-base-preview");

  if (btnImportBase) btnImportBase.addEventListener("click", () => inputBaseFiles.click());
  if (btnImportM3U) btnImportM3U.addEventListener("click", () => inputBaseM3U.click());

  if (inputBaseFiles) {
    inputBaseFiles.addEventListener("change", async (e) => {
      const files = e.target.files;
      if (!files || !files.length) return;
      showToast("Decodificando bases...");
      try {
        const res = await baseLib.importFiles(files);
        const ok = res.imported.length;
        const fail = res.failed.length;
        if (fail) showToast(`${ok} base(s) cargadas, ${fail} fallidas (formato no soportado)`);
        else showToast(`${ok} base(s) cargadas en la biblioteca.`);
        renderBaseList();
      } catch (err) {
        showToast(`Error al importar: ${err.message}`);
      } finally {
        inputBaseFiles.value = "";
      }
    });
  }

  if (inputBaseM3U) {
    inputBaseM3U.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const count = await baseLib.importM3UFile(file);
        showToast(`Manifiesto ${file.name}: ${count} entradas (${baseLib.matchedCount} enlazadas).`);
        renderBaseList();
      } catch (err) {
        showToast(`Error en .m3u: ${err.message}`);
      } finally {
        inputBaseM3U.value = "";
      }
    });
  }

  function renderBaseList() {
    if (!baseListEl) return;
    baseListEl.innerHTML = "";

    if (baseCatalogInfo) {
      baseCatalogInfo.textContent = baseLib.catalog.length
        ? `Catálogo "${baseLib.catalogName}": ${baseLib.catalog.length} entradas • ${baseLib.matchedCount} enlazadas`
        : "Importa un .m3u/.m3u8 (con #EXTM3U) como catálogo, o directamente tus MP3/WAV.";
    }

    if (!baseLib.bases.length) {
      const empty = document.createElement("div");
      empty.className = "base-empty";
      empty.textContent = "Sin bases importadas. Añade MP3/M4A/WAV/Ogg/FLAC locales.";
      baseListEl.appendChild(empty);
      return;
    }

    baseLib.bases.forEach((base) => {
      const item = document.createElement("div");
      item.className = "base-item" + (baseLib.activeId === base.id ? " active" : "");

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "base-active";
      radio.checked = baseLib.activeId === base.id;
      radio.addEventListener("change", () => {
        baseLib.setActive(base.id);
        renderBaseList();
        if (baseLib.playing) baseLib.stopLive();
      });

      const label = document.createElement("span");
      label.className = "base-name";
      label.textContent = base.name;
      label.title = base.name;

      const dur = document.createElement("span");
      dur.className = "base-dur";
      dur.textContent = `${base.duration.toFixed(1)} s`;

      const btnRemove = document.createElement("button");
      btnRemove.className = "btn-base-remove";
      btnRemove.textContent = "🗑";
      btnRemove.title = "Quitar de la biblioteca";
      btnRemove.addEventListener("click", () => {
        baseLib.remove(base.id);
        renderBaseList();
      });

      item.appendChild(radio);
      item.appendChild(label);
      item.appendChild(dur);
      item.appendChild(btnRemove);
      baseListEl.appendChild(item);
    });
  }

  if (baseGain) {
    baseGain.addEventListener("input", (e) => {
      baseLib.settings.gain = parseFloat(e.target.value);
      if (baseLib.playing) {
        baseLib.playing.gain.gain.setTargetAtTime(baseLib.settings.gain, audio.ctx.currentTime, 0.02);
      }
    });
    baseGain.value = baseLib.settings.gain;
  }
  if (baseFadeIn) {
    baseFadeIn.addEventListener("input", (e) => { baseLib.settings.fadeInSec = parseFloat(e.target.value) || 0; });
    baseFadeIn.value = baseLib.settings.fadeInSec;
  }
  if (baseFadeOut) {
    baseFadeOut.addEventListener("input", (e) => { baseLib.settings.fadeOutSec = parseFloat(e.target.value) || 0; });
    baseFadeOut.value = baseLib.settings.fadeOutSec;
  }
  if (baseLoop) {
    baseLoop.checked = baseLib.settings.loop;
    baseLoop.addEventListener("change", (e) => {
      baseLib.settings.loop = e.target.checked;
      if (baseLib.playing) baseLib.playing.source.loop = e.target.checked;
    });
  }
  if (btnBasePreview) {
    btnBasePreview.addEventListener("click", async () => {
      if (baseLib.playing) {
        baseLib.stopLive();
        btnBasePreview.textContent = "▶ Escuchar";
      } else {
        const ok = await baseLib.startLive();
        if (ok) {
          btnBasePreview.textContent = "⏹ Stop";
          setTimeout(() => { if (!baseLib.playing) btnBasePreview.textContent = "▶ Escuchar"; }, 100);
          const poll = setInterval(() => {
            if (!baseLib.playing) {
              clearInterval(poll);
              btnBasePreview.textContent = "▶ Escuchar";
            }
          }, 400);
        }
      }
    });
  }

  // =========================================================================
  // ASISTENTE MUSICAL CON IA LOCAL (TAB IA)
  // =========================================================================
  const btnGenerateAi = document.getElementById("btn-generate-ai");
  const aiPromptInput = document.getElementById("ai-prompt-input");
  const aiGenreSelect = document.getElementById("ai-genre-select");
  const aiEmptyState = document.getElementById("ai-empty-state");
  const aiResultContent = document.getElementById("ai-result-content");
  const aiResultGenre = document.getElementById("ai-result-genre");
  const aiResultBpm = document.getElementById("ai-result-bpm");
  const aiResultSource = document.getElementById("ai-result-source");
  const aiResultExplanation = document.getElementById("ai-result-explanation");
  const aiMiniGrid = document.getElementById("ai-mini-grid");
  const btnApplyAiPattern = document.getElementById("btn-apply-ai-pattern");
  const btnExportAiMidi = document.getElementById("btn-export-ai-midi");

  const aiBridgeStatusCard = document.getElementById("ai-bridge-status-card");
  const aiBridgeStatusText = document.getElementById("ai-bridge-status-text");
  const sidebarAiIndicator = document.getElementById("sidebar-ai-indicator");
  const badgeAiStatus = document.getElementById("badge-ai-status");

  // --- Elementos de la tarjeta de Proveedores de IA (Diagnóstico) ---
  const provList = document.getElementById("ai-provider-list");
  const provKind = document.getElementById("ai-prov-kind");
  const provName = document.getElementById("ai-prov-name");
  const provUrl = document.getElementById("ai-prov-url");
  const provKey = document.getElementById("ai-prov-key");
  const provModel = document.getElementById("ai-prov-model");
  const btnProvAdd = document.getElementById("btn-ai-prov-add");
  const provStatusNote = document.getElementById("ai-prov-status");
  const pullModelInput = document.getElementById("ai-pull-model");
  const pullTargetSelect = document.getElementById("ai-pull-target");
  const btnAiPull = document.getElementById("btn-ai-pull");
  const pullStatus = document.getElementById("ai-pull-status");

  document.querySelectorAll(".btn-prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      aiPromptInput.value = chip.getAttribute("data-prompt");
    });
  });

  const KIND_LABELS = { bridge: "Puente", ollama: "Ollama", openai: "API" };

  function providerStateLabel(s) {
    if (!s) return { icon: "⚪", text: "Sin sondear" };
    if (s.online) return { icon: "🟢", text: "online" };
    if (s.authError) return { icon: "🔑", text: "clave denegada" };
    if (s.reachable && !s.corsOk) return { icon: "🟡", text: "alcanzable (sin CORS)" };
    return { icon: "🔴", text: "no accesible" };
  }

  function updateProvStatusNote(statuses) {
    if (!provStatusNote) return;
    const enabled = ai.getProviders().filter((p) => p.enabled !== false);
    if (!enabled.length) {
      provStatusNote.textContent = "Sin proveedores definidos: la generación usa el motor heurístico offline.";
      return;
    }
    const online = (statuses || []).filter((s) => s.online).map((s) => {
      const p = ai.getProvider(s.id);
      return p ? p.name : s.id;
    });
    provStatusNote.textContent = online.length
      ? `La IA está online vía: ${online.join(", ")}.`
      : "Ningún proveedor online ahora mismo: la generación usa reglas heurísticas offline.";
  }

  /**
   * Pinta la lista de proveedores como filas (sin innerHTML con datos de usuario).
   */
  function renderAIProviders(status) {
    if (!provList) return;
    const providers = ai.getProviders();
    const byId = {};
    ((status && status.statuses) || []).forEach((s) => (byId[s.id] = s));
    provList.innerHTML = "";

    if (!providers.length) {
      const empty = document.createElement("p");
      empty.className = "diag-note";
      empty.textContent = "No hay proveedor definido. Añade uno abajo (por defecto se usa el motor heurístico).";
      provList.appendChild(empty);
    }

    providers.forEach((p) => {
      const s = byId[p.id];
      const state = providerStateLabel(s);
      const isActive = p.id === ai.settings.activeProvider;

      const row = document.createElement("div");
      row.className = "ai-provider-row" + (isActive ? " active" : "");
      row.dataset.provId = p.id;

      // Línea principal
      const main = document.createElement("div");
      main.className = "prov-main";
      const stIcon = document.createElement("span");
      stIcon.className = "prov-state";
      stIcon.textContent = state.icon;
      stIcon.title = state.text;
      const nameEl = document.createElement("span");
      nameEl.className = "prov-name";
      nameEl.textContent = p.name;
      const kindEl = document.createElement("span");
      kindEl.className = "prov-kind";
      kindEl.textContent = KIND_LABELS[p.kind] || p.kind;
      const urlEl = document.createElement("code");
      urlEl.className = "prov-url";
      urlEl.textContent = p.baseUrl;
      main.append(stIcon, nameEl, kindEl, urlEl);

      // Detalle del último sondeo
      const detail = document.createElement("div");
      detail.className = "prov-detail";
      detail.textContent = s ? s.detail : "No sondeado aún.";

      // Acciones
      const actions = document.createElement("div");
      actions.className = "prov-actions";

      const btnActive = document.createElement("button");
      btnActive.className = "btn-secondary btn-xs";
      btnActive.textContent = isActive ? "★ Activo" : "☆ Usar";
      btnActive.disabled = isActive;
      btnActive.addEventListener("click", () => {
        ai.setActiveProvider(p.id);
        showToast(`Proveedor activo: ${p.name}`);
        refreshBridgeStatus();
      });

      const btnProbe = document.createElement("button");
      btnProbe.className = "btn-secondary btn-xs";
      btnProbe.textContent = "⟳ Sondear";
      btnProbe.addEventListener("click", async () => {
        btnProbe.disabled = true;
        detail.textContent = "Sondeando...";
        const s2 = await ai.probeProvider(p);
        const st2 = providerStateLabel(s2);
        stIcon.textContent = st2.icon;
        stIcon.title = st2.text;
        detail.textContent = s2.detail;
        btnProbe.disabled = false;
      });

      const modelInput = document.createElement("input");
      modelInput.type = "text";
      modelInput.className = "form-input prov-model";
      modelInput.placeholder = "Modelo preferido";
      modelInput.maxLength = 120;
      modelInput.value = p.model || "";
      modelInput.title = "Modelo preferido: si existe en este proveedor se usa; si no, se elige uno disponible";
      modelInput.addEventListener("change", () => {
        const ok = ai.updateProvider(p.id, { model: modelInput.value.trim() });
        if (ok && modelInput.value.trim()) {
          showToast(`Modelo preferido de "${p.name}": ${modelInput.value.trim()}`);
        }
      });

      const btnRemove = document.createElement("button");
      btnRemove.className = "btn-danger btn-xs";
      btnRemove.textContent = "✕ Quitar";
      btnRemove.addEventListener("click", () => {
        ai.removeProvider(p.id);
        showToast(`Proveedor eliminado: ${p.name}`);
        refreshBridgeStatus();
        renderPullTargets();
      });

      actions.append(btnActive, btnProbe, modelInput, btnRemove);
      row.append(main, detail, actions);
      provList.appendChild(row);
    });
  }

  function renderPullTargets() {
    if (!pullTargetSelect) return;
    const providers = ai.getProviders();
    pullTargetSelect.innerHTML = "";
    const bridge = providers.find((p) => p.kind === "bridge" && p.enabled !== false);
    if (bridge) {
      const opt = document.createElement("option");
      opt.value = bridge.id;
      opt.textContent = `${bridge.name} (ajuste: su OLLAMA_BASE_URL o el primer Ollama)`;
      pullTargetSelect.appendChild(opt);
    }
    providers
      .filter((p) => p.kind === "ollama" && p.enabled !== false)
      .forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = `${p.name} — ${p.baseUrl}`;
        pullTargetSelect.appendChild(opt);
      });
  }
  renderPullTargets();

  // Venta de clave: solo es relevante para APIs compatibles con OpenAI
  if (provKind && provKey) {
    const syncKeyField = () => {
      const isApi = provKind.value === "openai";
      provKey.disabled = !isApi;
      provKey.classList.toggle("field-disabled", !isApi);
      if (!isApi) provKey.value = "";
    };
    provKind.addEventListener("change", syncKeyField);
    syncKeyField();
  }

  if (btnProvAdd) {
    btnProvAdd.addEventListener("click", () => {
      const res = ai.addProvider({
        kind: provKind.value,
        name: provName.value.trim() || `${KIND_LABELS[provKind.value] || "Proveedor"} ${ai.getProviders().length + 1}`,
        baseUrl: provUrl.value.trim(),
        apiKey: provKey.value.trim(),
        model: provModel.value.trim(),
      });
      if (!res.ok) {
        showToast(res.error);
        return;
      }
      provName.value = "";
      provUrl.value = "";
      provKey.value = "";
      provModel.value = "";
      renderPullTargets();
      showToast("Proveedor añadido; comprobando estado...");
      refreshBridgeStatus();
    });
  }

  if (btnAiPull) {
    btnAiPull.addEventListener("click", async () => {
      const modelName = pullModelInput.value.trim();
      if (!modelName) {
        showToast("Escribe el nombre del modelo a descargar (ej. qwen3.5:4b).");
        return;
      }
      btnAiPull.disabled = true;
      if (pullStatus) pullStatus.textContent = "↻ Descargando modelo (puede tardar varios minutos)...";
      try {
        const res = await ai.pullModel(pullTargetSelect.value, modelName);
        const okTxt = String(res.detail || "").toLowerCase();
        if (pullStatus) {
          pullStatus.textContent = okTxt.includes("success")
            ? `✅ Modelo '${res.model}' disponible en ${res.host}.`
            : `ℹ️ Respuesta de Ollama: ${res.detail}`;
        }
        showToast(`Descarga de '${res.model}' finalizada.`);
      } catch (e) {
        if (pullStatus) pullStatus.textContent = `⚠️ ${e.message}`;
        showToast(`Descarga fallida: ${e.message}`);
      } finally {
        btnAiPull.disabled = false;
      }
    });
  }

  async function refreshBridgeStatus() {
    const status = await ai.checkConnection();
    if (status.connected && status.provider) {
      const kindLabel = KIND_LABELS[status.provider.kind] || "IA";
      const modelSuffix = status.activeModel ? ` · ${status.activeModel}` : "";
      aiBridgeStatusText.textContent = `${kindLabel} conectado: ${status.provider.name}${modelSuffix}`;
      sidebarAiIndicator.className = "ai-status-dot online";
      badgeAiStatus.className = "status-badge badge-green";
      badgeAiStatus.textContent = "Online";
    } else {
      aiBridgeStatusText.textContent = "Modo Reglas Heurísticas (100% Offline)";
      sidebarAiIndicator.className = "ai-status-dot offline";
      badgeAiStatus.className = "status-badge badge-gray";
      badgeAiStatus.textContent = "Offline";
    }
    renderAIProviders(status);
    updateProvStatusNote(status.statuses);
  }
  refreshBridgeStatus();

  btnGenerateAi.addEventListener("click", async () => {
    const prompt = aiPromptInput.value.trim() || "Beat con bombo potente y caja con pegada";
    const genre = aiGenreSelect.value;
    const currentBpm = currentProject.bpm || 90;

    const btnText = document.getElementById("btn-generate-text");
    btnText.textContent = "Analizando y generando...";
    btnGenerateAi.disabled = true;

    try {
      const patternData = await ai.generatePattern(prompt, genre, currentBpm);
      if (!patternData.suggestedBpm) patternData.suggestedBpm = currentBpm;

      aiEmptyState.style.display = "none";
      aiResultContent.style.display = "block";

      aiResultGenre.textContent = patternData.genre.toUpperCase();
      aiResultBpm.textContent = `${patternData.suggestedBpm} BPM`;
      aiResultSource.textContent = patternData.source || "Ollama Local";
      aiResultExplanation.textContent = patternData.explanation || "Patrón generado con éxito.";

      aiMiniGrid.innerHTML = "";
      Object.keys(patternData.tracks).forEach((instId) => {
        const row = document.createElement("div");
        row.className = "mini-grid-row";
        const label = document.createElement("span");
        label.className = "mini-row-label";
        label.textContent = instId;
        const stepsBox = document.createElement("div");
        stepsBox.className = "mini-steps-box";
        patternData.tracks[instId].forEach((active) => {
          const dot = document.createElement("div");
          dot.className = "mini-step-dot" + (active ? " active" : "");
          stepsBox.appendChild(dot);
        });
        row.appendChild(label);
        row.appendChild(stepsBox);
        aiMiniGrid.appendChild(row);
      });

      showToast("¡Nuevo patrón generado por el asistente!");
    } catch (err) {
      showToast(`Error del asistente: ${err.message}`);
    } finally {
      btnText.textContent = "Generar Patrón";
      btnGenerateAi.disabled = false;
    }
  });

  btnApplyAiPattern.addEventListener("click", () => {
    if (!ai.lastGeneratedResult) return;
    ai.applyToProject(currentProject, ai.lastGeneratedResult);
    seq.setProject(currentProject);
    updateTransportUI();
    renderSequencerGrid();
    showToast("Patrón de IA aplicado al secuenciador.");
    document.getElementById("nav-btn-sequencer").click();
  });

  btnExportAiMidi.addEventListener("click", () => {
    if (!ai.lastGeneratedResult) return;
    const tempProj = projMgr.createNewProject("AI_Pattern", ai.lastGeneratedResult.suggestedBpm);
    ai.applyToProject(tempProj, ai.lastGeneratedResult);
    const blob = midi.createMidiBlob(tempProj, 2);
    midi.downloadMidi(blob, `foz_ai_beat_${tempProj.bpm}bpm.mid`);
    showToast("Archivo MIDI generado desde la IA descargado.");
  });

  // =========================================================================
  // GESTIÓN DE PROYECTOS (TAB PROYECTOS)
  // =========================================================================
  const projectNameInput = document.getElementById("project-name-input");
  const btnSaveProject = document.getElementById("btn-save-project-local");
  const btnExportProject = document.getElementById("btn-export-project-file");
  const btnTriggerImport = document.getElementById("btn-trigger-import-project");
  const inputImportFile = document.getElementById("input-import-file");
  const btnNewProject = document.getElementById("btn-new-project");
  const presetsCatalogContainer = document.getElementById("presets-catalog-container");

  projectNameInput.value = currentProject.name;
  projectNameInput.addEventListener("input", (e) => {
    currentProject.name = e.target.value.trim() || "Sin Título";
    if (footerProjectName) footerProjectName.textContent = `Proyecto: ${currentProject.name}`;
    projMgr.saveCurrentProject(currentProject);
  });

  function refreshProjectUI() {
    projectNameInput.value = currentProject.name;
    updateTransportUI();
    renderSequencerGrid();
    renderTimeline();
    renderPresetsCatalog();
    syncTrackpadUi();
    if (footerProjectName) footerProjectName.textContent = `Proyecto: ${currentProject.name}`;
  }

  btnSaveProject.addEventListener("click", () => {
    projMgr.saveCurrentProject(currentProject);
    showToast("Proyecto guardado en el navegador.");
  });

  btnExportProject.addEventListener("click", () => {
    projMgr.exportProjectFile(currentProject);
    showToast("Descargando archivo .foz del proyecto...");
  });

  btnTriggerImport.addEventListener("click", () => inputImportFile.click());

  inputImportFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = await projMgr.importProjectFile(file);
      currentProject = imported;
      seq.setProject(currentProject);
      trackpad.setProject(currentProject);
      refreshProjectUI();
      showToast(`Proyecto '${currentProject.name}' importado con éxito.`);
    } catch (err) {
      showToast(`Error al importar: ${err.message}`);
    } finally {
      inputImportFile.value = "";
    }
  });

  btnNewProject.addEventListener("click", () => {
    if (confirm("¿Crear un proyecto nuevo en blanco? Se descartarán los pasos no guardados.")) {
      currentProject = projMgr.createNewProject("Nuevo Beat FoZ", 90);
      seq.setProject(currentProject);
      trackpad.setProject(currentProject);
      refreshProjectUI();
      showToast("Nuevo proyecto en blanco creado.");
    }
  });

  function renderPresetsCatalog() {
    presetsCatalogContainer.innerHTML = "";
    projMgr.getPresets().forEach((preset) => {
      const card = document.createElement("div");
      card.className = "preset-card-item";

      const info = document.createElement("div");
      const title = document.createElement("div");
      title.className = "preset-item-title";
      title.textContent = `${preset.name} — ${preset.bpm} BPM`;

      const desc = document.createElement("div");
      desc.className = "preset-item-desc";
      desc.textContent = preset.description;

      info.appendChild(title);
      info.appendChild(desc);

      const btnLoad = document.createElement("button");
      btnLoad.className = "btn-action btn-accent-blue";
      btnLoad.textContent = "Cargar";
      btnLoad.addEventListener("click", () => {
        currentProject = projMgr.loadPresetIntoProject(preset.id);
        seq.setProject(currentProject);
        trackpad.setProject(currentProject);
        refreshProjectUI();
        showToast(`Preset cargado: ${preset.name}`);
        document.getElementById("nav-btn-sequencer").click();
      });

      card.appendChild(info);
      card.appendChild(btnLoad);
      presetsCatalogContainer.appendChild(card);
    });
  }
  renderPresetsCatalog();

  // =========================================================================
  // DIAGNÓSTICO Y CONFIGURACIÓN (TAB DIAGNÓSTICO)
  // =========================================================================
  const diagAudioState = document.getElementById("diag-audio-state");
  const diagAudioSampleRate = document.getElementById("diag-audio-samplerate");
  const diagAudioLatency = document.getElementById("diag-audio-latency");
  const diagBridgeStatus = document.getElementById("diag-bridge-status");
  const diagBridgeUrl = document.getElementById("diag-bridge-url");
  const diagBridgeModels = document.getElementById("diag-bridge-models");
  const diagLmmsStatus = document.getElementById("diag-lmms-status");
  const btnRecheckBridge = document.getElementById("btn-recheck-bridge");

  function updateDiagnosticsUI() {
    if (audio.ctx) {
      diagAudioState.textContent = audio.ctx.state;
      diagAudioSampleRate.textContent = `${audio.ctx.sampleRate} Hz`;
      diagAudioLatency.textContent = audio.ctx.baseLatency
        ? `${(audio.ctx.baseLatency * 1000).toFixed(1)} ms`
        : "Estándar";
    }

    const bridgeProv = ai.getProviders().find((p) => p.kind === "bridge");
    if (diagBridgeUrl) diagBridgeUrl.textContent = bridgeProv ? bridgeProv.baseUrl : "(sin puente definido)";

    ai.checkConnection().then((st) => {
      const bridgeStatus = (st.statuses || []).find((s) => {
        const p = ai.getProvider(s.id);
        return p && p.kind === "bridge";
      });

      if (bridgeStatus && bridgeStatus.online) {
        diagBridgeStatus.textContent = `Conectado a ${bridgeProv.baseUrl}`;
      } else if (bridgeStatus && bridgeStatus.reachable && !bridgeStatus.corsOk) {
        diagBridgeStatus.textContent = "Alcanzable pero no leído (CORS/PNA): revisa que el proceso es el FoZ Local Bridge.";
      } else {
        diagBridgeStatus.textContent = "Desconectado (Modo reglas nativo activo)";
      }

      diagBridgeModels.textContent = st.connected
        ? (st.models.map((m) => m.name).join(", ") || "Ninguno")
        : "Modo Heurístico Autónomo";

      diagLmmsStatus.textContent = st.lmmsInstalled
        ? "Detectado en sistema"
        : bridgeStatus && bridgeStatus.online ? "No detectado" : "No disponible vía puente";

      renderAIProviders(st);
      updateProvStatusNote(st.statuses);
      renderPullTargets();
    });
  }

  btnRecheckBridge.addEventListener("click", () => {
    showToast("Comprobando puente local...");
    updateDiagnosticsUI();
    refreshBridgeStatus();
  });

  // =========================================================================
  // INICIALIZACIÓN COMPLETA
  // =========================================================================
  renderTimeline();
  renderPresetQuickBar();
  updateTransportUI();
  renderSequencerGrid();
  syncTrackpadUi();
  renderBaseList();
  refreshProjectUI();
  updateDiagnosticsUI();

  window.addEventListener("beforeunload", () => {
    projMgr.saveCurrentProject(currentProject);
  });

  console.log("FoZ SoundPro v1.1 — Beatmaker AI Studio inicializado correctamente (16 voces, Trackpad FX, Record Studio, Base Library).");
});
