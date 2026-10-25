/**
 * FoZ SoundPro — Real-time Step Sequencer Engine (v1.1)
 * =====================================================
 * Planificador de alta precisión mediante Web Audio Lookahead Scheduling.
 * v1.1: constantes musicales unificadas con export WAV/MIDI (FoZConstants)
 * para que lo oído en vivo sea EXACTAMENTE igual al render offline y al MIDI.
 * Añade límites de pasos (4..64) y hooks para bases importadas y FX del trackpad.
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

    this.lookahead = 25.0;      // Intervalo de comprobación en ms
    this.scheduleAheadTime = 0.10; // Ventana de audio adelantada en segundos

    this.project = null;

    // Callbacks para actualización de UI / módulos externos (bases, trackpad)
    this.onStepChange = null;
    this.onPlayStateChange = null;
    this.onBpmChange = null;
  }

  setProject(project) {
    this.project = project;
    this.currentStep = 0;
    this._syncFxBusToBpm();
  }

  _syncFxBusToBpm() {
    // Sincroniza el tiempo de eco del trackpad con el tempo (corchea musical)
    if (this.onBpmChange) this.onBpmChange(this.project ? this.project.bpm : 90);
  }

  async start() {
    await this.audio.init();

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.audio.ctx.currentTime + 0.05;

    this.timerId = setInterval(() => this._scheduler(), this.lookahead);
    this._syncFxBusToBpm();

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

    while (this.nextNoteTime < this.audio.ctx.currentTime + this.scheduleAheadTime) {
      this._scheduleStep(this.currentStep, this.nextNoteTime);
      this._advanceStep();
    }
  }

  _scheduleStep(stepNumber, time) {
    if (!this.project || !this.project.tracks) return;

    const hasSolo = this.project.tracks.some((t) => t.solo);

    this.project.tracks.forEach((track) => {
      if (hasSolo) {
        if (!track.solo) return;
      } else {
        if (track.muted) return;
      }

      if (track.steps[stepNumber]) {
        const vel = (track.velocities ? track.velocities[stepNumber] : FoZConstants.DEFAULT_VELOCITY)
          * (track.volume !== undefined ? track.volume : FoZConstants.DEFAULT_VOLUME);
        this.audio.triggerInstrument(track.id, time, vel);
      }
    });

    // Metrónomo en los 4 pulsos principales
    if (this.isMetronomeActive && stepNumber % 4 === 0) {
      this.audio.triggerMetronome(time, stepNumber === 0);
    }

    // Actualización visual sincronizada con el hilo gráfico
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
    let stepDuration = secondsPerBeat / 4; // semicorchea

    // Factor de swing UNIFICADO con export WAV/MIDI (FoZConstants.SWING_FACTOR):
    // el paso impar se retrasa; el siguiente par recupera el hueco.
    if (this.project.swing && this.currentStep % 2 === 0) {
      stepDuration += stepDuration * (this.project.swing * FoZConstants.SWING_FACTOR);
    } else if (this.project.swing && this.currentStep % 2 === 1) {
      stepDuration -= stepDuration * (this.project.swing * FoZConstants.SWING_FACTOR);
    }

    this.nextNoteTime += Math.max(0.02, stepDuration);
    this.currentStep = (this.currentStep + 1) % (this.project.stepsCount || FoZConstants.DEFAULT_STEPS_COUNT);
  }

  toggleStep(trackIndex, stepIndex) {
    if (!this.project || !this.project.tracks[trackIndex]) return;
    const track = this.project.tracks[trackIndex];
    track.steps[stepIndex] = !track.steps[stepIndex];

    if (track.steps[stepIndex]) {
      this.audio.init().then(() => {
        const vel = (track.velocities ? track.velocities[stepIndex] : FoZConstants.DEFAULT_VELOCITY)
          * (track.volume || FoZConstants.DEFAULT_VOLUME);
        this.audio.triggerInstrument(track.id, 0, vel);
      });
    }

    this.projectMgr.saveCurrentProject(this.project);
  }

  setStepVelocity(trackIndex, stepIndex, velocity) {
    if (!this.project || !this.project.tracks[trackIndex]) return;
    const track = this.project.tracks[trackIndex];
    if (!track.velocities) track.velocities = new Array(this.project.stepsCount || 16).fill(FoZConstants.DEFAULT_VELOCITY);
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
    this.project.bpm = Math.max(
      FoZConstants.MIN_BPM,
      Math.min(FoZConstants.MAX_BPM, parseInt(newBpm, 10) || 90)
    );
    this.projectMgr.saveCurrentProject(this.project);
    this._syncFxBusToBpm();
  }

  setStepsCount(count) {
    if (!this.project) return;
    const n = Math.max(FoZConstants.MIN_STEPS_COUNT, Math.min(FoZConstants.MAX_STEPS_COUNT, parseInt(count, 10) || 16));
    if (n === this.project.stepsCount) return;

    const oldCount = this.project.stepsCount || 16;
    this.project.stepsCount = n;

    this.project.tracks.forEach((track) => {
      const steps = new Array(n).fill(false);
      for (let i = 0; i < Math.min(oldCount, n); i++) steps[i] = track.steps[i];
      track.steps = steps;

      const vels = new Array(n).fill(FoZConstants.DEFAULT_VELOCITY);
      for (let i = 0; i < Math.min(oldCount, n); i++) {
        vels[i] = track.velocities && track.velocities[i] != null ? track.velocities[i] : FoZConstants.DEFAULT_VELOCITY;
      }
      track.velocities = vels;
    });

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
