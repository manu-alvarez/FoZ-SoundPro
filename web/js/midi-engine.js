/**
 * FoZ SoundPro — Pure Client-side Standard MIDI File (SMF1) Engine (v1.1)
 * =====================================================================
 * Genera archivos MIDI estándar binarios (.mid) directamente en el navegador
 * sin dependencias de servidor ni bibliotecas de terceros.
 * v1.1: mapa General MIDI extendido a las 16 voces del kit correctedo.
 */

class FoZMidiEngine {
  constructor() {
    // GM Drum Map (Canal 10). Cada voz del kit sintético tiene su nota nativa.
    this.GM_DRUM_MAP = {
      kick:         36, // Bass Drum 1
      bass808:      35, // Acoustic Bass Drum (sub)
      snare:        38, // Acoustic Snare
      clap:         39, // Hand Clap
      hihat_closed: 42, // Closed Hi-Hat
      hihat_open:   46, // Open Hi-Hat
      rimshot:      37, // Side Stick / Rim
      crash:        49, // Crash Cymbal 1
      ride:         51, // Ride Cymbal 1
      tom_low:      41, // Low Floor Tom
      tom_mid:      45, // Low Tom
      cowbell:      56, // Cowbell
      snap_trap:    40, // Electric Snare (transitorio trap)
      shaker:       70, // Maracas (shaker)
      stab_dark:    62, // Mute Hi Conga (stab percusivo)
      horn_slap:    60, // Hi Bongo (slap metales)
    };
  }

  encodeVLQ(value) {
    let val = Math.max(0, Math.floor(value));
    let buffer = val & 0x7f;
    const bytes = [buffer];
    val = val >> 7;

    while (val > 0) {
      buffer = (val & 0x7f) | 0x80;
      bytes.push(buffer);
      val = val >> 7;
    }
    bytes.reverse();
    return bytes;
  }

  _serializeTrackChunk(events) {
    events.sort((a, b) => {
      if (a.tick !== b.tick) return a.tick - b.tick;
      return (a.priority || 10) - (b.priority || 10);
    });

    const payload = [];
    let lastTick = 0;

    for (const ev of events) {
      const delta = ev.tick - lastTick;
      if (delta < 0) throw new Error(`Delta time negativo: ${delta}`);
      const deltaBytes = this.encodeVLQ(delta);
      deltaBytes.forEach((b) => payload.push(b));
      ev.data.forEach((b) => payload.push(b));
      lastTick = ev.tick;
    }

    const chunkLength = payload.length;
    const chunkHeader = [
      0x4d, 0x54, 0x72, 0x6b, // 'MTrk'
      (chunkLength >> 24) & 0xff,
      (chunkLength >> 16) & 0xff,
      (chunkLength >> 8) & 0xff,
      chunkLength & 0xff,
    ];

    return new Uint8Array([...chunkHeader, ...payload]);
  }

  createMidiBlob(projectData, repeatBars = 2) {
    const bpm = Math.max(FoZConstants.MIN_BPM, Math.min(FoZConstants.MAX_BPM, projectData.bpm || 90));
    const ppq = 480;
    const ticksPerStep = ppq / 4;
    const stepsCount = projectData.stepsCount || FoZConstants.DEFAULT_STEPS_COUNT;
    const ticksPerBar = stepsCount * ticksPerStep;
    const totalTicks = repeatBars * ticksPerBar;

    // ---------------------------------------------------------------------
    // PISTA 0: Master / Conductor
    // ---------------------------------------------------------------------
    const track0Events = [];

    track0Events.push({
      tick: 0, priority: 0,
      data: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08], // Time Signature 4/4
    });

    const usPerQuarter = Math.round(60000000 / bpm);
    track0Events.push({
      tick: 0, priority: 1,
      data: [0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff],
    });

    const name0Bytes = Array.from(new TextEncoder().encode("FoZ SoundPro Conductor"));
    track0Events.push({ tick: 0, priority: 2, data: [0xff, 0x03, name0Bytes.length, ...name0Bytes] });

    track0Events.push({ tick: totalTicks, priority: 99, data: [0xff, 0x2F, 0x00] });

    // ---------------------------------------------------------------------
    // PISTA 1: Drum Track (Canal 10)
    // ---------------------------------------------------------------------
    const track1Events = [];
    const chStatus = 0x09;
    const noteOnStatus = 0x90 | chStatus;
    const noteOffStatus = 0x80 | chStatus;

    const name1Bytes = Array.from(new TextEncoder().encode("FoZ Beatmaker Drums (GM 10)"));
    track1Events.push({ tick: 0, priority: 0, data: [0xff, 0x03, name1Bytes.length, ...name1Bytes] });

    track1Events.push({ tick: 0, priority: 1, data: [0xc0 | chStatus, 0x00] });

    for (let r = 0; r < repeatBars; r++) {
      const barOffset = r * ticksPerBar;

      projectData.tracks.forEach((track) => {
        if (track.muted) return;
        const midiNote = this.GM_DRUM_MAP[track.id] || 38;

        track.steps.forEach((active, stepIdx) => {
          if (active && stepIdx < stepsCount) {
            let stepTick = barOffset + stepIdx * ticksPerStep;

            const swingFactor = typeof FoZConstants !== "undefined"
              ? FoZConstants.SWING_FACTOR : 0.33;
            if (projectData.swing && stepIdx % 2 === 1) {
              stepTick += Math.round(ticksPerStep * (projectData.swing * swingFactor));
            }

            const defaultVel = (typeof FoZConstants !== "undefined")
              ? FoZConstants.DEFAULT_VELOCITY : 0.85;
            const rawVel = track.velocities ? track.velocities[stepIdx] || defaultVel : defaultVel;
            const midiVelocity = Math.max(1, Math.min(127, Math.round(rawVel * 127)));
            const noteDuration = Math.round(ticksPerStep * 0.75);

            track1Events.push({
              tick: stepTick, priority: 5,
              data: [noteOnStatus, midiNote, midiVelocity],
            });

            track1Events.push({
              tick: stepTick + noteDuration, priority: 4,
              data: [noteOffStatus, midiNote, 0],
            });
          }
        });
      });
    }

    track1Events.push({ tick: totalTicks, priority: 99, data: [0xff, 0x2F, 0x00] });

    // ---------------------------------------------------------------------
    // Ensamblado SMF1
    // ---------------------------------------------------------------------
    const chunk0 = this._serializeTrackChunk(track0Events);
    const chunk1 = this._serializeTrackChunk(track1Events);

    const header = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, // 'MThd'
      0x00, 0x00, 0x00, 0x06,
      0x00, 0x01,             // Formato 1
      0x00, 0x02,             // 2 pistas
      (ppq >> 8) & 0xff, ppq & 0xff, // 480 PPQ
    ]);

    const totalBytes = header.length + chunk0.length + chunk1.length;
    const fullMidi = new Uint8Array(totalBytes);
    fullMidi.set(header, 0);
    fullMidi.set(chunk0, header.length);
    fullMidi.set(chunk1, header.length + chunk0.length);

    return new Blob([fullMidi], { type: "audio/midi" });
  }

  downloadMidi(blob, filename = "foz_beat.mid") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

window.fozMidiEngine = new FoZMidiEngine();
