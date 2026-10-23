/**
 * FoZ SoundPro — Pure Client-side Standard MIDI File (SMF1) Engine
 * ===============================================================
 * Genera archivos MIDI estándar binarios (.mid) directamente en el navegador
 * sin dependencias de servidor ni bibliotecas de terceros.
 * Cumple estrictamente la especificación SMF Formato 1 (Multipista) con
 * percusión asignada al Canal 10 de General MIDI (bombo, caja, hi-hats, etc.).
 */

class FoZMidiEngine {
  constructor() {
    this.GM_DRUM_MAP = {
      kick: 36,          // Bass Drum 1
      snare: 38,         // Acoustic Snare
      hihat_closed: 42,  // Closed Hi-Hat
      hihat_open: 46,    // Open Hi-Hat
      clap: 39,          // Hand Clap
      bass808: 35,       // Acoustic Bass Drum (Sub)
      rimshot: 37,       // Side Stick / Rim
    };
  }

  /**
   * Codifica un entero positivo en bytes de longitud variable (VLQ) según el estándar MIDI.
   */
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

  /**
   * Serializa una lista ordenada de eventos { tick, data, priority } en un chunk binario MTrk.
   */
  _serializeTrackChunk(events) {
    // Ordenar por tick ascendente, luego por prioridad
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

    // Cabecera MTrk (4 bytes ASCII) + 4 bytes longitud uint32 big-endian
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

  /**
   * Genera el archivo SMF1 completo a partir de los datos del secuenciador.
   * @param {Object} projectData - Datos del proyecto con { bpm, tracks, stepsCount }
   * @param {number} repeatBars - Número de compases a exportar (por defecto 2)
   * @returns {Blob} Blob binario con tipo MIME 'audio/midi'
   */
  createMidiBlob(projectData, repeatBars = 2) {
    const bpm = Math.max(30, Math.min(300, projectData.bpm || 90));
    const ppq = 480; // 480 ticks por negra (estándar profesional de resolución)
    const ticksPerStep = ppq / 4; // 120 ticks por semicorchea (paso de 16)
    const stepsCount = projectData.stepsCount || 16;
    const ticksPerBar = stepsCount * ticksPerStep;
    const totalTicks = repeatBars * ticksPerBar;

    // -------------------------------------------------------------------------
    // PISTA 0: Master / Conductor Track (Tempo y Compás)
    // -------------------------------------------------------------------------
    const track0Events = [];

    // Meta Evento: Time Signature 4/4 (0xFF 0x58 0x04 0x04 0x02 0x18 0x08)
    track0Events.push({
      tick: 0,
      priority: 0,
      data: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08],
    });

    // Meta Evento: Set Tempo (0xFF 0x51 0x03 [3 bytes us/quarter])
    const usPerQuarter = Math.round(60000000 / bpm);
    track0Events.push({
      tick: 0,
      priority: 1,
      data: [
        0xff, 0x51, 0x03,
        (usPerQuarter >> 16) & 0xff,
        (usPerQuarter >> 8) & 0xff,
        usPerQuarter & 0xff,
      ],
    });

    // Nombre de pista 0
    const name0Bytes = Array.from(new TextEncoder().encode("FoZ SoundPro Conductor"));
    track0Events.push({
      tick: 0,
      priority: 2,
      data: [0xff, 0x03, name0Bytes.length, ...name0Bytes],
    });

    // End of Track al final de los compases
    track0Events.push({
      tick: totalTicks,
      priority: 99,
      data: [0xff, 0x2F, 0x00],
    });

    // -------------------------------------------------------------------------
    // PISTA 1: Drum Track (Canal 10 General MIDI = 0x09 en byte status)
    // -------------------------------------------------------------------------
    const track1Events = [];
    const chStatus = 0x09; // Canal 10 (0-indexed)
    const noteOnStatus = 0x90 | chStatus;
    const noteOffStatus = 0x80 | chStatus;

    // Nombre de pista 1
    const name1Bytes = Array.from(new TextEncoder().encode("FoZ Beatmaker Drums (GM 10)"));
    track1Events.push({
      tick: 0,
      priority: 0,
      data: [0xff, 0x03, name1Bytes.length, ...name1Bytes],
    });

    // Program Change a Kit de batería estándar
    track1Events.push({
      tick: 0,
      priority: 1,
      data: [0xc0 | chStatus, 0x00],
    });

    // Añadir notas para cada compás
    for (let r = 0; r < repeatBars; r++) {
      const barOffset = r * ticksPerBar;

      projectData.tracks.forEach((track) => {
        if (track.muted) return;
        const midiNote = this.GM_DRUM_MAP[track.id] || 38;

        track.steps.forEach((active, stepIdx) => {
          if (active && stepIdx < stepsCount) {
            let stepTick = barOffset + stepIdx * ticksPerStep;

            // Swing sutil si está activado
            if (projectData.swing && stepIdx % 2 === 1) {
              stepTick += Math.round(ticksPerStep * (projectData.swing * 0.33));
            }

            const rawVel = track.velocities ? track.velocities[stepIdx] || 0.9 : 0.9;
            const midiVelocity = Math.max(1, Math.min(127, Math.round(rawVel * 127)));
            const noteDuration = Math.round(ticksPerStep * 0.75); // Duración de puerta (gate)

            // Note On
            track1Events.push({
              tick: stepTick,
              priority: 5,
              data: [noteOnStatus, midiNote, midiVelocity],
            });

            // Note Off
            track1Events.push({
              tick: stepTick + noteDuration,
              priority: 4,
              data: [noteOffStatus, midiNote, 0],
            });
          }
        });
      });
    }

    // End of Track de pista 1
    track1Events.push({
      tick: totalTicks,
      priority: 99,
      data: [0xff, 0x2F, 0x00],
    });

    // -------------------------------------------------------------------------
    // ENSAMBLAR CHUNKS EN STANDARD MIDI FILE FORMATO 1
    // -------------------------------------------------------------------------
    const chunk0 = this._serializeTrackChunk(track0Events);
    const chunk1 = this._serializeTrackChunk(track1Events);

    // Cabecera MThd (14 bytes): 'MThd' (4) + length 6 (4) + format 1 (2) + ntracks 2 (2) + ppq 480 (2)
    const header = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, // 'MThd'
      0x00, 0x00, 0x00, 0x06, // Longitud = 6
      0x00, 0x01,             // Formato = 1 (Multipista)
      0x00, 0x02,             // 2 Pistas
      (ppq >> 8) & 0xff, ppq & 0xff, // PPQ
    ]);

    const totalBytes = header.length + chunk0.length + chunk1.length;
    const fullMidi = new Uint8Array(totalBytes);
    fullMidi.set(header, 0);
    fullMidi.set(chunk0, header.length);
    fullMidi.set(chunk1, header.length + chunk0.length);

    return new Blob([fullMidi], { type: "audio/midi" });
  }

  /**
   * Descarga el archivo MIDI en el navegador del usuario.
   */
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
