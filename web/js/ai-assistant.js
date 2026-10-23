/**
 * FoZ SoundPro — AI Assistant & Musical Rule Generator
 * ====================================================
 * Proporciona generación asistida de patrones y recomendaciones musicales.
 * Soporta dos modos complementarios:
 * 1. Conexión con Ollama Local a través del FoZ Local Bridge (http://127.0.0.1:8765)
 *    utilizando modelos locales (qwen3.5:4b, llamusic) con validación estricta de JSON.
 * 2. Motor Heurístico Musical Nativo (100% offline en el navegador), que genera
 *    patrones rítmicos auténticos según reglas de teoría musical por género si Ollama no está activo.
 */

class FoZAIAssistant {
  constructor(bridgeUrl = "http://127.0.0.1:8765") {
    this.bridgeUrl = bridgeUrl;
    this.isBridgeConnected = false;
    this.detectedModels = [];
    this.activeModel = null;
    this.lastGeneratedResult = null;
  }

  /**
   * Comprueba la disponibilidad del Local Bridge y los modelos de Ollama.
   */
  async checkConnection() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const resp = await fetch(`${this.bridgeUrl}/api/status`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json();
        this.isBridgeConnected = true;
        this.detectedModels = data.localModels || [];
        this.activeModel = data.selectedModel || (this.detectedModels[0] ? this.detectedModels[0].name : null);
        return {
          connected: true,
          models: this.detectedModels,
          activeModel: this.activeModel,
          lmmsInstalled: data.lmmsAvailable,
        };
      }
    } catch (e) {
      // Local bridge desconectado o no iniciado
    }

    this.isBridgeConnected = false;
    this.detectedModels = [];
    this.activeModel = null;
    return {
      connected: false,
      models: [],
      activeModel: null,
      lmmsInstalled: false,
    };
  }

  /**
   * Genera un patrón musical a partir de una descripción en texto y género.
   */
  async generatePattern(promptText, genre = "trap", currentBpm = 140) {
    if (this.isBridgeConnected) {
      try {
        return await this._generateWithOllamaBridge(promptText, genre, currentBpm);
      } catch (err) {
        console.warn("Fallo en Ollama Bridge, recurriendo al motor heurístico nativo:", err);
      }
    }

    // Modo sin conexión / Heurístico nativo
    return this._generateWithNativeRules(promptText, genre, currentBpm);
  }

  /**
   * Generación mediante Local Bridge (Ollama local con esquema JSON forzado)
   */
  async _generateWithOllamaBridge(promptText, genre, currentBpm) {
    const payload = {
      prompt: promptText,
      genre: genre,
      bpm: currentBpm,
      model: this.activeModel,
    };

    const resp = await fetch(`${this.bridgeUrl}/api/generate-pattern`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Error del Bridge (${resp.status}): ${errText}`);
    }

    const data = await resp.json();
    this._validatePatternData(data);
    this.lastGeneratedResult = data;
    return data;
  }

  /**
   * Motor Heurístico Nativo de Teoría Musical (100% offline, determinista o variacional)
   */
  _generateWithNativeRules(promptText, genre = "trap", currentBpm = 140) {
    const g = (genre || "trap").toLowerCase();
    let result = {
      source: "Motor Heurístico Musical Local (Offline)",
      genre: genre,
      suggestedBpm: currentBpm,
      swing: 0.1,
      explanation: "",
      tracks: {
        kick: new Array(16).fill(false),
        snare: new Array(16).fill(false),
        clap: new Array(16).fill(false),
        hihat_closed: new Array(16).fill(false),
        hihat_open: new Array(16).fill(false),
        bass808: new Array(16).fill(false),
        rimshot: new Array(16).fill(false),
      },
      velocities: {
        kick: new Array(16).fill(0.9),
        snare: new Array(16).fill(0.95),
        clap: new Array(16).fill(0.85),
        hihat_closed: new Array(16).fill(0.75),
        hihat_open: new Array(16).fill(0.8),
        bass808: new Array(16).fill(0.9),
        rimshot: new Array(16).fill(0.75),
      },
    };

    if (g.includes("boombap") || g.includes("boom bap") || g.includes("90s") || g.includes("rap")) {
      result.suggestedBpm = 90;
      result.swing = 0.22;
      result.explanation = "Patrón Boom Bap clásico: bombo en pulso 1 y 2.5, caja con pegada en 2 y 4, hi-hats en corcheas con swing natural.";

      // Kick: 1, 2.5, 3
      [0, 6, 8].forEach((i) => (result.tracks.kick[i] = true));
      [0, 6, 8].forEach((i) => (result.tracks.bass808[i] = true));
      // Snare: 2 y 4 (pasos 4 y 12 en 0-indexed)
      [4, 12].forEach((i) => (result.tracks.snare[i] = true));
      // Hi-Hat cerrado: todas las corcheas
      for (let i = 0; i < 16; i += 2) {
        result.tracks.hihat_closed[i] = true;
        result.velocities.hihat_closed[i] = i % 4 === 0 ? 0.9 : 0.68;
      }
      // Hi-Hat abierto en el contratiempo previo al beat 4
      result.tracks.hihat_open[14] = true;
      result.tracks.rimshot[10] = true; // Sutil ghost rim
    } else if (g.includes("drill")) {
      result.suggestedBpm = 142;
      result.swing = 0.15;
      result.explanation = "Patrón UK/NY Drill: caja desplazada al compás 3, hi-hats sincopados en tresillos/semicorcheas y 808 con caídas.";

      // Kick sincopado Drill
      [0, 10].forEach((i) => (result.tracks.kick[i] = true));
      [0, 10].forEach((i) => (result.tracks.bass808[i] = true));
      // Snare en el pulso 3 (paso 8) y variación en 12
      [8, 12].forEach((i) => (result.tracks.snare[i] = true));
      // Hi-Hat cerrado con ritmo característico drill (1, 3, 4, 6, 7...)
      [0, 2, 3, 5, 6, 8, 10, 11, 13, 14].forEach((i) => {
        result.tracks.hihat_closed[i] = true;
        result.velocities.hihat_closed[i] = [0, 6, 11].includes(i) ? 0.95 : 0.7;
      });
      result.tracks.hihat_open[8] = true;
      result.tracks.rimshot[12] = true;
    } else if (g.includes("lofi") || g.includes("lo-fi") || g.includes("chill")) {
      result.suggestedBpm = 84;
      result.swing = 0.35;
      result.explanation = "Patrón Lo-Fi Chill: ritmo arrastrado (drunken beat) con swing alto, aro de caja suave y 808 redondo.";

      [0, 10].forEach((i) => (result.tracks.kick[i] = true));
      [0, 10].forEach((i) => (result.tracks.bass808[i] = true));
      [4, 12].forEach((i) => (result.tracks.snare[i] = true));
      [4, 12].forEach((i) => (result.tracks.rimshot[i] = true));
      for (let i = 0; i < 16; i += 2) {
        result.tracks.hihat_closed[i] = true;
        result.velocities.hihat_closed[i] = i % 4 === 0 ? 0.75 : 0.55;
      }
      result.tracks.hihat_open[14] = true;
    } else {
      // Trap por defecto
      result.suggestedBpm = 140;
      result.swing = 0.05;
      result.explanation = "Patrón Trap Moderno: palmas en el pulso 3, hi-hats rápidos en semicorcheas continuas y bombo 808 sincopado.";

      [0, 8, 14].forEach((i) => (result.tracks.kick[i] = true));
      [0, 8, 14].forEach((i) => (result.tracks.bass808[i] = true));
      [8].forEach((i) => (result.tracks.clap[i] = true));
      [8].forEach((i) => (result.tracks.snare[i] = true));
      // Hi-Hats continuos en semicorcheas con acentos
      for (let i = 0; i < 16; i++) {
        result.tracks.hihat_closed[i] = true;
        result.velocities.hihat_closed[i] = i % 4 === 0 ? 0.95 : i % 2 === 0 ? 0.8 : 0.65;
      }
      // Ráfaga / roll en pasos 14 y 15
      result.velocities.hihat_closed[14] = 0.9;
      result.velocities.hihat_closed[15] = 1.0;
      result.tracks.hihat_open[6] = true;
    }

    this.lastGeneratedResult = result;
    return result;
  }

  /**
   * Valida minuciosamente el formato del patrón antes de inyectarlo al secuenciador
   */
  _validatePatternData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Respuesta inválida: no es un objeto JSON.");
    }
    if (!data.tracks || typeof data.tracks !== "object") {
      throw new Error("Respuesta inválida: falta el bloque 'tracks'.");
    }

    const validInstruments = ["kick", "snare", "clap", "hihat_closed", "hihat_open", "bass808", "rimshot"];
    for (const inst of validInstruments) {
      if (data.tracks[inst] && !Array.isArray(data.tracks[inst])) {
        throw new Error(`La pista ${inst} debe ser una lista de pasos.`);
      }
    }
  }

  /**
   * Aplica el patrón generado al proyecto del secuenciador.
   */
  applyToProject(project, patternData) {
    if (!patternData || !patternData.tracks) return false;

    if (patternData.suggestedBpm) {
      project.bpm = patternData.suggestedBpm;
    }
    if (patternData.swing !== undefined) {
      project.swing = patternData.swing;
    }

    Object.keys(patternData.tracks).forEach((instId) => {
      const targetTrack = project.tracks.find((t) => t.id === instId);
      if (targetTrack) {
        const rawSteps = patternData.tracks[instId];
        targetTrack.steps = rawSteps.map((s) => Boolean(s));

        if (patternData.velocities && patternData.velocities[instId]) {
          targetTrack.velocities = [...patternData.velocities[instId]];
        }
      }
    });

    return true;
  }
}

window.fozAIAssistant = new FoZAIAssistant();
