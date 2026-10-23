/**
 * FoZ SoundPro — Real-time Step Sequencer Engine
 * ===============================================
 * Planificador de alta precisión mediante Web Audio Lookahead Scheduling.
 * Evita el retardo y desincronización (drift) de setTimeout/setInterval convencionales.
 * Gestiona el cursor visual con requestAnimationFrame, swing ajustable y controles por pista.
 */

class FoZSequencer {
  constructor(audioEngine, projectManager) {
    this.audio = audioEngine;
    this.projectMgr = projectManager;

    this.isPlaying = false;
    this.currentStep = 0;
    this.nextNoteTime = 0.0;
    this.timerId = null;
    this.isMetronomeActive = false;

    // Configuración de planificación lookahead
    this.lookahead = 25.0; // Intervalo de comprobación en ms
    this.scheduleAheadTime = 0.10; // Ventana de audio adelantada en segundos (100 ms)

    // Referencia al proyecto activo
    this.project = null;

    // Callbacks para actualización de UI
    this.onStepChange = null;
    this.onPlayStateChange = null;
  }

  setProject(project) {
    this.project = project;
    this.currentStep = 0;
  }

  async start() {
    await this.audio.init();

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.audio.ctx.currentTime + 0.05;

    // Iniciar bucle de planificación
    this.timerId = setInterval(() => this._scheduler(), this.lookahead);

    if (this.onPlayStateChange) this.onPlayStateChange(true);
  }

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearInterval(this.timerId);
    this.timerId = null;
    this.currentStep = 0;

    if (this.onStepChange) this.onStepChange(0);
    if (this.onPlayStateChange) this.onPlayStateChange(false);
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    clearInterval(this.timerId);
    this.timerId = null;

    if (this.onPlayStateChange) this.onPlayStateChange(false);
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.start();
    }
  }

  _scheduler() {
    if (!this.project || !this.isPlaying) return;

    // Planificar mientras el tiempo de la siguiente nota esté dentro de la ventana de anticipación
    while (this.nextNoteTime < this.audio.ctx.currentTime + this.scheduleAheadTime) {
      this._scheduleStep(this.currentStep, this.nextNoteTime);
      this._advanceStep();
    }
  }

  _scheduleStep(stepNumber, time) {
    if (!this.project || !this.project.tracks) return;

    const hasSolo = this.project.tracks.some((t) => t.solo);

    this.project.tracks.forEach((track) => {
      // Reglas de mute y solo
      if (hasSolo) {
        if (!track.solo) return;
      } else {
        if (track.muted) return;
      }

      if (track.steps[stepNumber]) {
        const vel = (track.velocities ? track.velocities[stepNumber] : 0.85) * (track.volume !== undefined ? track.volume : 0.85);
        this.audio.triggerInstrument(track.id, time, vel);
      }
    });

    // Metrónomo en los 4 pulsos principales (pasos 0, 4, 8, 12)
    if (this.isMetronomeActive && stepNumber % 4 === 0) {
      this.audio.triggerMetronome(time, stepNumber === 0);
    }

    // Programar actualización visual exacta en el hilo gráfico
    const visualTime = (time - this.audio.ctx.currentTime) * 1000;
    setTimeout(() => {
      if (this.isPlaying && this.onStepChange) {
        this.onStepChange(stepNumber);
      }
    }, Math.max(0, visualTime));
  }

  toggleMetronome() {
    this.isMetronomeActive = !this.isMetronomeActive;
    return this.isMetronomeActive;
  }

  _advanceStep() {
    const secondsPerBeat = 60.0 / this.project.bpm;
    let stepDuration = secondsPerBeat / 4; // 16th note (semicorchea)

    // Aplicar Swing si está activo y el paso es impar
    if (this.project.swing && this.currentStep % 2 === 0) {
      stepDuration += stepDuration * (this.project.swing * 0.35);
    } else if (this.project.swing && this.currentStep % 2 === 1) {
      stepDuration -= stepDuration * (this.project.swing * 0.35);
    }

    this.nextNoteTime += Math.max(0.02, stepDuration);
    this.currentStep = (this.currentStep + 1) % (this.project.stepsCount || 16);
  }

  toggleStep(trackIndex, stepIndex) {
    if (!this.project || !this.project.tracks[trackIndex]) return;
    const track = this.project.tracks[trackIndex];
    track.steps[stepIndex] = !track.steps[stepIndex];

    // Si se activa, reproducir sonido previo al hacer clic para retroalimentación inmediata
    if (track.steps[stepIndex]) {
      this.audio.init().then(() => {
        const vel = (track.velocities ? track.velocities[stepIndex] : 0.85) * (track.volume || 0.85);
        this.audio.triggerInstrument(track.id, 0, vel);
      });
    }

    this.projectMgr.saveCurrentProject(this.project);
  }

  setStepVelocity(trackIndex, stepIndex, velocity) {
    if (!this.project || !this.project.tracks[trackIndex]) return;
    const track = this.project.tracks[trackIndex];
    if (!track.velocities) track.velocities = new Array(this.project.stepsCount || 16).fill(0.85);
    track.velocities[stepIndex] = Math.max(0.1, Math.min(1.0, velocity));
    this.projectMgr.saveCurrentProject(this.project);
  }

  setTrackVolume(trackIndex, vol) {
    if (!this.project || !this.project.tracks[trackIndex]) return;
    this.project.tracks[trackIndex].volume = Math.max(0, Math.min(1.2, vol));
    this.projectMgr.saveCurrentProject(this.project);
  }

  toggleTrackMute(trackIndex) {
    if (!this.project || !this.project.tracks[trackIndex]) return;
    const track = this.project.tracks[trackIndex];
    track.muted = !track.muted;
    this.projectMgr.saveCurrentProject(this.project);
  }

  toggleTrackSolo(trackIndex) {
    if (!this.project || !this.project.tracks[trackIndex]) return;
    const track = this.project.tracks[trackIndex];
    track.solo = !track.solo;
    this.projectMgr.saveCurrentProject(this.project);
  }

  setBpm(newBpm) {
    if (!this.project) return;
    this.project.bpm = Math.max(30, Math.min(300, parseInt(newBpm, 10) || 90));
    this.projectMgr.saveCurrentProject(this.project);
  }

  setSwing(newSwing) {
    if (!this.project) return;
    this.project.swing = Math.max(0, Math.min(0.75, parseFloat(newSwing) || 0));
    this.projectMgr.saveCurrentProject(this.project);
  }

  clearPattern() {
    if (!this.project || !this.project.tracks) return;
    this.project.tracks.forEach((track) => {
      track.steps.fill(false);
    });
    this.projectMgr.saveCurrentProject(this.project);
  }
}

window.fozSequencer = new FoZSequencer(window.fozAudioEngine, window.fozProjectManager);
