/**
 * FoZ SoundPro — Master Application Controller
 * ============================================
 * Conecta la interfaz de usuario con los motores de audio, MIDI, secuenciador,
 * asistente IA y gestor de proyectos.
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. Instancias globales
  const audio = window.fozAudioEngine;
  const seq = window.fozSequencer;
  const projMgr = window.fozProjectManager;
  const midi = window.fozMidiEngine;
  const ai = window.fozAIAssistant;

  // 2. Estado local de la aplicación
  let currentProject = projMgr.loadCurrentProject();
  seq.setProject(currentProject);

  // 3. Elementos del DOM
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
    setTimeout(() => {
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

      // Si entra en diagnósticos, refrescar datos
      if (targetTabId === "tab-diagnostics") {
        updateDiagnosticsUI();
      }
    });
  });

  // =========================================================================
  // RENDERIZADO DEL SECUENCIADOR POR PASOS
  // =========================================================================
  function renderTimeline() {
    stepsTimeline.innerHTML = "";
    const totalSteps = currentProject.stepsCount || 16;
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

    const colorMap = {
      kick: "#ff5722",
      snare: "#00e5ff",
      clap: "#ffd600",
      hihat_closed: "#e2e8f0",
      hihat_open: "#38bdf8",
      bass808: "#c084fc",
      rimshot: "#f59e0b",
    };

    currentProject.tracks.forEach((track, trackIdx) => {
      const instColor = colorMap[track.id] || "#00f2fe";
      const row = document.createElement("div");
      row.className = "track-row";
      row.id = `track-row-${trackIdx}`;
      row.style.setProperty("--track-accent", instColor);

      // 1. Controles de pista (Color tag, Nombre, Mute, Solo, Volumen)
      const controls = document.createElement("div");
      controls.className = "track-controls";

      const colorTag = document.createElement("span");
      colorTag.className = "track-color-pill";
      colorTag.style.backgroundColor = instColor;
      controls.appendChild(colorTag);

      const nameBtn = document.createElement("button");
      nameBtn.className = "track-name-btn";
      nameBtn.textContent = track.name;
      nameBtn.title = `Escuchar muestra de ${track.name}`;
      nameBtn.addEventListener("click", () => {
        audio.init().then(() => {
          audio.triggerInstrument(track.id, 0, track.volume || 0.85);
        });
      });

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
      controls.appendChild(btnMute);
      controls.appendChild(btnSolo);
      controls.appendChild(volSlider);
      row.appendChild(controls);

      // 2. Pasos (16 Step buttons)
      const stepsContainer = document.createElement("div");
      stepsContainer.className = "track-steps";

      for (let s = 0; s < totalSteps; s++) {
        const stepBtn = document.createElement("button");
        const isGroupAlt = Math.floor(s / 4) % 2 === 1;
        stepBtn.className = "step-btn" + (isGroupAlt ? " group-alt" : "") + (track.steps[s] ? " active" : "");
        stepBtn.id = `step-${trackIdx}-${s}`;
        stepBtn.setAttribute("data-track", trackIdx);
        stepBtn.setAttribute("data-step", s);
        stepBtn.title = `${track.name} — Paso ${s + 1}`;

        stepBtn.addEventListener("click", () => {
          seq.toggleStep(trackIdx, s);
          stepBtn.classList.toggle("active", track.steps[s]);
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
  // CONTROL DE TRANSPORTE Y TIEMPO (BPM, SWING, VOLUME)
  // =========================================================================
  function updateTransportUI() {
    inputBpm.value = currentProject.bpm;
    rangeSwing.value = currentProject.swing || 0.1;
    labelSwingVal.textContent = `${Math.round((currentProject.swing || 0.1) * 100)}%`;
    rangeMasterVol.value = currentProject.masterVolume || 0.85;
  }

  btnPlayPause.addEventListener("click", () => {
    seq.togglePlay();
  });

  btnStop.addEventListener("click", () => {
    seq.stop();
  });

  // Atajo de teclado (Barra espaciadora para Play/Stop)
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      seq.togglePlay();
    }
  });

  seq.onPlayStateChange = (isPlaying) => {
    if (isPlaying) {
      btnPlayPause.classList.add("playing");
      btnPlayPause.querySelector(".transport-label").textContent = "PAUSE";
      btnPlayPause.querySelector(".transport-icon").textContent = "⏸";
    } else {
      btnPlayPause.classList.remove("playing");
      btnPlayPause.querySelector(".transport-label").textContent = "PLAY";
      btnPlayPause.querySelector(".transport-icon").textContent = "▶";
    }
  };

  // Metrónomo
  if (btnMetronome) {
    btnMetronome.addEventListener("click", () => {
      const active = seq.toggleMetronome();
      btnMetronome.classList.toggle("active", active);
      showToast(active ? "Metrónomo activado" : "Metrónomo desactivado");
    });
  }

  // Cursor visual de paso y actualización del display digital
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

    // Actualizar display digital de tiempo
    if (displayStep) {
      const beatNum = Math.floor(activeStep / 4) + 1;
      const subStep = (activeStep % 4) + 1;
      displayStep.textContent = `PULSO ${beatNum}.${subStep}`;
    }
  };

  // BPM
  inputBpm.addEventListener("change", (e) => {
    seq.setBpm(e.target.value);
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

  // Botón Limpiar Patrón
  document.getElementById("btn-clear-pattern").addEventListener("click", () => {
    seq.clearPattern();
    renderSequencerGrid();
    showToast("Patrón limpiado.");
  });

  // Botones de Presets Rápidos
  document.querySelectorAll(".btn-preset-chip[data-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const presetId = btn.getAttribute("data-preset");
      currentProject = projMgr.loadPresetIntoProject(presetId);
      seq.setProject(currentProject);
      updateTransportUI();
      renderSequencerGrid();
      showToast(`Preset cargado: ${currentProject.name}`);
    });
  });

  // =========================================================================
  // EXPORTACIÓN DE AUDIO Y MIDI
  // =========================================================================
  async function handleExportWav() {
    showToast("Renderizando audio WAV PCM 16b en navegador...");
    try {
      const blob = await audio.exportPatternToWavBlob(currentProject, 2);
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
      const blob = midi.createMidiBlob(currentProject, 2);
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

    // Línea base de reposo sutil
    visualizerCtx.fillStyle = "#161b26";
    visualizerCtx.fillRect(0, masterVisualizer.height - 1, masterVisualizer.width, 1);

    const barCount = 24;
    const barWidth = masterVisualizer.width / barCount;
    let hasSignal = false;

    // Verificar si hay señal audible real (umbral de corte para ruido digital residual)
    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor(i * (bufferLength / 32));
      if (dataArray[idx] > 4) {
        hasSignal = true;
        break;
      }
    }

    if (!hasSignal) {
      return; // Permanece en reposo limpio cuando no hay audio activo
    }

    let x = 0;
    for (let i = 0; i < barCount; i++) {
      const dataIdx = Math.floor(i * (bufferLength / 32));
      const val = dataArray[dataIdx] || 0;
      
      // Aplicar umbral de corte estricto
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
  // GRABADOR DE VOZ (VOCAL STUDIO)
  // =========================================================================
  const btnMicRecord = document.getElementById("btn-mic-record");
  const btnMicStop = document.getElementById("btn-mic-stop");
  const btnRecordText = document.getElementById("btn-record-text");
  const recordingTimer = document.getElementById("recording-timer");
  const vocalCanvas = document.getElementById("vocal-canvas");
  const vocalCtx = vocalCanvas.getContext("2d");
  const vocalTakeCard = document.getElementById("vocal-take-card");
  const audioPlayback = document.getElementById("audio-playback");
  const takeSizeInfo = document.getElementById("take-size-info");
  const btnDownloadRec = document.getElementById("btn-download-recording");
  const btnDiscardRec = document.getElementById("btn-discard-recording");

  let recStartTime = 0;
  let recTimerInterval = null;

  btnMicRecord.addEventListener("click", async () => {
    try {
      await audio.startVoiceRecording();
      btnMicRecord.classList.add("recording");
      btnRecordText.textContent = "GRABANDO...";
      btnMicRecord.disabled = true;
      btnMicStop.disabled = false;

      recStartTime = Date.now();
      recTimerInterval = setInterval(() => {
        const elapsed = (Date.now() - recStartTime) / 1000;
        const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
        const secs = (elapsed % 60).toFixed(1).padStart(4, "0");
        recordingTimer.textContent = `${mins}:${secs}`;
      }, 100);

      drawVocalWaveform();
      showToast("Micrófono activo. Grabando toma...");
    } catch (err) {
      showToast(`Error al iniciar micrófono: ${err.message}`);
    }
  });

  btnMicStop.addEventListener("click", async () => {
    clearInterval(recTimerInterval);
    btnMicRecord.classList.remove("recording");
    btnRecordText.textContent = "GRABAR TOMA";
    btnMicRecord.disabled = false;
    btnMicStop.disabled = true;

    const recordedBlob = await audio.stopVoiceRecording();
    if (recordedBlob && recordedBlob.size > 0) {
      vocalTakeCard.style.display = "flex";
      audioPlayback.src = URL.createObjectURL(recordedBlob);
      takeSizeInfo.textContent = `${(recordedBlob.size / 1024).toFixed(1)} KB`;
      showToast("Toma grabada correctamente.");
    }
  });

  btnDownloadRec.addEventListener("click", () => {
    if (!audio.recordedAudioBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(audio.recordedAudioBlob);
    a.download = `foz_vocal_take_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  btnDiscardRec.addEventListener("click", () => {
    audio.recordedAudioBlob = null;
    vocalTakeCard.style.display = "none";
    recordingTimer.textContent = "00:00.0";
    showToast("Toma descartada.");
  });

  function drawVocalWaveform() {
    if (!audio.isRecording) {
      vocalCtx.fillStyle = "#090c12";
      vocalCtx.fillRect(0, 0, vocalCanvas.width, vocalCanvas.height);
      return;
    }

    requestAnimationFrame(drawVocalWaveform);
    const bufferLength = audio.micAnalyser ? audio.micAnalyser.frequencyBinCount : 0;
    if (!bufferLength) return;

    const dataArray = new Uint8Array(bufferLength);
    audio.micAnalyser.getByteTimeDomainData(dataArray);

    vocalCtx.fillStyle = "#090c12";
    vocalCtx.fillRect(0, 0, vocalCanvas.width, vocalCanvas.height);

    vocalCtx.lineWidth = 2;
    vocalCtx.strokeStyle = "#ff1744";
    vocalCtx.beginPath();

    const sliceWidth = vocalCanvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * vocalCanvas.height) / 2;
      if (i === 0) vocalCtx.moveTo(x, y);
      else vocalCtx.lineTo(x, y);
      x += sliceWidth;
    }
    vocalCtx.stroke();
  }

  // =========================================================================
  // ASISTENTE MUSICAL CON IA LOCAL (TAB 3)
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

  // Chips de sugerencia rápida
  document.querySelectorAll(".btn-prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      aiPromptInput.value = chip.getAttribute("data-prompt");
    });
  });

  // Comprobar estado del bridge al inicio
  async function refreshBridgeStatus() {
    const status = await ai.checkConnection();
    if (status.connected) {
      const modelName = status.activeModel || "Ollama";
      aiBridgeStatusText.textContent = `Puente activo: ${modelName}`;
      sidebarAiIndicator.className = "ai-status-dot online";
      badgeAiStatus.className = "status-badge badge-green";
      badgeAiStatus.textContent = "Online";
    } else {
      aiBridgeStatusText.textContent = "Modo Reglas Heurísticas (100% Offline)";
      sidebarAiIndicator.className = "ai-status-dot offline";
      badgeAiStatus.className = "status-badge badge-gray";
      badgeAiStatus.textContent = "Offline";
    }
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

      aiEmptyState.style.display = "none";
      aiResultContent.style.display = "block";

      aiResultGenre.textContent = patternData.genre.toUpperCase();
      aiResultBpm.textContent = `${patternData.suggestedBpm} BPM`;
      aiResultSource.textContent = patternData.source || "Ollama Local";
      aiResultExplanation.textContent = patternData.explanation || "Patrón generado con éxito.";

      // Renderizar mini previsualización
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

    // Volver a la pestaña del secuenciador
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
  // GESTIÓN DE PROYECTOS (TAB 4)
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

  btnSaveProject.addEventListener("click", () => {
    projMgr.saveCurrentProject(currentProject);
    showToast("Proyecto guardado en el navegador.");
  });

  btnExportProject.addEventListener("click", () => {
    projMgr.exportProjectFile(currentProject);
    showToast("Descargando archivo .foz del proyecto...");
  });

  btnTriggerImport.addEventListener("click", () => {
    inputImportFile.click();
  });

  inputImportFile.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const imported = await projMgr.importProjectFile(file);
      currentProject = imported;
      seq.setProject(currentProject);
      projectNameInput.value = currentProject.name;
      updateTransportUI();
      renderSequencerGrid();
      showToast(`Proyecto '${currentProject.name}' importado con éxito.`);
    } catch (err) {
      showToast(`Error al importar: ${err.message}`);
    }
  });

  btnNewProject.addEventListener("click", () => {
    if (confirm("¿Crear un proyecto nuevo en blanco? Se descartarán los pasos no guardados.")) {
      currentProject = projMgr.createNewProject("Nuevo Beat FoZ", 90);
      seq.setProject(currentProject);
      projectNameInput.value = currentProject.name;
      updateTransportUI();
      renderSequencerGrid();
      showToast("Nuevo proyecto en blanco creado.");
    }
  });

  // Renderizar catálogo de presets
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
        projectNameInput.value = currentProject.name;
        updateTransportUI();
        renderSequencerGrid();
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
  // DIAGNÓSTICO Y CONFIGURACIÓN (TAB 5)
  // =========================================================================
  const diagAudioState = document.getElementById("diag-audio-state");
  const diagAudioSampleRate = document.getElementById("diag-audio-samplerate");
  const diagAudioLatency = document.getElementById("diag-audio-latency");
  const diagBridgeStatus = document.getElementById("diag-bridge-status");
  const diagBridgeModels = document.getElementById("diag-bridge-models");
  const diagLmmsStatus = document.getElementById("diag-lmms-status");
  const btnRecheckBridge = document.getElementById("btn-recheck-bridge");

  function updateDiagnosticsUI() {
    if (audio.ctx) {
      diagAudioState.textContent = audio.ctx.state;
      diagAudioSampleRate.textContent = `${audio.ctx.sampleRate} Hz`;
      diagAudioLatency.textContent = audio.ctx.baseLatency ? `${(audio.ctx.baseLatency * 1000).toFixed(1)} ms` : "Estándar";
    }

    ai.checkConnection().then((st) => {
      if (st.connected) {
        diagBridgeStatus.textContent = "Conectado a http://127.0.0.1:8765";
        diagBridgeModels.textContent = st.models.map((m) => m.name).join(", ") || "Ninguno";
        diagLmmsStatus.textContent = st.lmmsInstalled ? "Detectado en sistema" : "No detectado";
      } else {
        diagBridgeStatus.textContent = "Desconectado (Modo reglas nativo activo)";
        diagBridgeModels.textContent = "Modo Heurístico Autónomo";
        diagLmmsStatus.textContent = "No disponible vía puente";
      }
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
  updateTransportUI();
  renderSequencerGrid();

  console.log("FoZ SoundPro — Beatmaker AI Studio inicializado correctamente.");
});
