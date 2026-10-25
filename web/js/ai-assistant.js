/**
 * FoZ SoundPro — AI Assistant & Musical Rule Generator (v1.1.1 multi-proveedor)
 * ============================================================================
 * Generación asistida de patrones rítmicos con tres rutas complementarias:
 *
 * 1. FoZ Local Bridge (http://127.0.0.1:8765) — proxy local hacia Ollama.
 *    Ruta recomendada desde orígenes HTTPS (GitHub Pages), porque el navegador
 *    bloquea el HTTP directo a IPs privadas (contenido mixto / PNA).
 * 2. Ollama directo (p. ej. Tailscale http://100.100.x.x:11434) — funciona desde
 *    orígenes locales (http://127.0.0.1:9200) si Ollama permite CORS
 *    (variable OLLAMA_ORIGINS). Diagnóstico triple: online / alcanzable sin
 *    CORS / no accesible.
 * 3. API del usuario compatible con OpenAI (baseUrl + apiKey + modelo).
 *    La clave se guarda SOLO en el localStorage del navegador: nunca sale del
 *    dispositivo y jamás viaja por el puente.
 *
 * Si ningún proveedor responde, el Motor Heurístico Musical Nativo genera el
 * patrón 100% offline mediante reglas de teoría musical por género.
 */

class FoZAIAssistant {
  constructor() {
    this.settings = this._loadSettings();
    this.providerStatuses = [];      // resultado del último checkConnection()
    this.activeProviderId = this.settings.activeProvider || null;
    this.lastGeneratedResult = null;

    // Campos retro-compatibles con el wiring principal
    this.isBridgeConnected = false;  // true si el proveedor puente está online
    this.detectedModels = [];
    this.activeModel = null;
  }

  // ===========================================================================
  // AJUSTES PERSISTENTES (localStorage)
  // ===========================================================================

  _defaultSettings() {
    const C = window.FoZConstants;
    return {
      version: 1,
      activeProvider: C.AI_PROVIDER_DEFAULTS[0].id,
      providers: C.AI_PROVIDER_DEFAULTS.map((p) => ({ ...p })),
    };
  }

  _loadSettings() {
    try {
      const raw = localStorage.getItem(window.FoZConstants.STORAGE_KEY_AI_SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.providers) && parsed.providers.length) {
          return this._sanitizeSettings(parsed);
        }
      }
    } catch (e) { /* modo privado o JSON corrupto: usar defaults */ }
    return this._defaultSettings();
  }

  _sanitizeSettings(parsed) {
    const validKinds = ["bridge", "ollama", "openai"];
    const providers = [];
    for (const p of parsed.providers) {
      if (!p || typeof p !== "object") continue;
      const kind = validKinds.includes(p.kind) ? p.kind : "ollama";
      const baseUrl = String(p.baseUrl || "").trim().replace(/\/+$/, "");
      if (!/^https?:\/\//.test(baseUrl) || baseUrl.length > 200) continue;
      providers.push({
        id: this._makeValidId(p.id) || this._newId(kind),
        kind,
        name: String(p.name || "Proveedor").slice(0, 80),
        baseUrl,
        apiKey: kind === "openai" ? String(p.apiKey || "").slice(0, 300) : "",
        model: String(p.model || "").slice(0, 120),
        enabled: p.enabled !== false,
      });
    }
    if (!providers.length) return this._defaultSettings();
    const activeId = providers.some((p) => p.id === parsed.activeProvider)
      ? parsed.activeProvider
      : providers[0].id;
    const mergedActive = providers.some((p) => p.id === parsed.activeProvider && p.enabled)
      ? parsed.activeProvider
      : null;
    return { version: 1, activeProvider: mergedActive || activeId, providers };
  }

  _saveSettings() {
    try {
      localStorage.setItem(
        window.FoZConstants.STORAGE_KEY_AI_SETTINGS,
        JSON.stringify(this.settings)
      );
    } catch (e) { /* espacio agotado o modo privado: operamos en memoria */ }
  }

  resetSettings() {
    this.settings = this._defaultSettings();
    this._saveSettings();
  }

  getSettings() {
    return JSON.parse(JSON.stringify(this.settings));
  }

  saveSettings(newSettings) {
    if (newSettings && Array.isArray(newSettings.providers)) {
      this.settings = this._sanitizeSettings(newSettings);
    }
    this._saveSettings();
  }

  _newId(kind) {
    return `${kind}-${Math.random().toString(36).slice(2, 9)}`;
  }

  _makeValidId(raw) {
    const clean = String(raw || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    return clean || null;
  }

  getProviders() {
    return this.settings.providers;
  }

  getProvider(id) {
    return this.settings.providers.find((p) => p.id === id) || null;
  }

  /**
   * Añade un proveedor tras validar. Devuelve {ok, id?, error?}.
   */
  addProvider(def) {
    const source = {
      id: this._newId(String(def.kind || "prov")),
      kind: def.kind,
      name: def.name,
      baseUrl: def.baseUrl,
      apiKey: def.kind === "openai" ? (def.apiKey || "") : "",
      model: def.model || "",
      enabled: true,
    };
    const clean = this._sanitizeSettings({ version: 1, activeProvider: this.settings.activeProvider, providers: [...this.settings.providers, source] });
    if (clean.providers.length <= this.settings.providers.length) {
      return { ok: false, error: "URL del proveedor inválida (debe empezar por http:// o https://). La clave NUNCA se guarda en Git." };
    }
    const added = clean.providers[clean.providers.length - 1];
    this.settings = { ...clean, activeProvider: this.settings.activeProvider };
    this._saveSettings();
    return { ok: true, id: added.id };
  }

  removeProvider(id) {
    this.settings.providers = this.settings.providers.filter((p) => p.id !== id);
    if (this.settings.activeProvider === id) {
      this.settings.activeProvider = this.settings.providers.length ? this.settings.providers[0].id : null;
    }
    this._saveSettings();
  }

  /** Modifica campos de un proveedor. La clave solo con kind openai. */
  updateProvider(id, patch) {
    const p = this.getProvider(id);
    if (!p) return false;
    if (patch.baseUrl !== undefined) {
      const url = String(patch.baseUrl).trim().replace(/\/+$/, "");
      if (!/^https?:\/\//.test(url) || url.length > 200) return false;
      p.baseUrl = url;
    }
    if (patch.name !== undefined) p.name = String(patch.name).slice(0, 80);
    if (patch.model !== undefined) p.model = String(patch.model).slice(0, 120);
    if (patch.enabled !== undefined) p.enabled = Boolean(patch.enabled);
    if (patch.apiKey !== undefined && p.kind === "openai") {
      p.apiKey = String(patch.apiKey).trim().slice(0, 300);
    }
    this._saveSettings();
    return true;
  }

  setActiveProvider(id) {
    const p = this.getProvider(id);
    if (!p) return false;
    this.settings.activeProvider = id;
    this._saveSettings();
    return true;
  }

  activeProvider() {
    return this.settings.providers.find((p) => p.id === this.settings.activeProvider) || null;
  }

  // ===========================================================================
  // AUTENTICACIÓN / UTILES DE RED
  // ===========================================================================

  _fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  }

  // ===========================================================================
  // DIAGNÓSTICO DE PROVEEDORES (honesto, por sondeo real)
  // ===========================================================================

  /**
   * Sonda de un proveedor. Estados posibles:
   *  - online:    responde con CORS y protocolo reconocido (full access).
   *  - reachable: la red responde (no-cors) pero el navegador no puede leer
   *               la respuesta (CORS: falta OLLAMA_ORIGINS; contenido mixto
   *               HTTPS→HTTP; o endpoint sin /models gestionado).
   *  - down:      la red no responde desde este navegador.
   *  - auth:      el servidor responde pero rechaza la API key.
   */
  async probeProvider(provider) {
    if (!provider || provider.enabled === false) {
      return { id: provider ? provider.id : null, online: false, reachable: false, corsOk: false, authError: false, detail: "Desactivado", models: [] };
    }
    if (provider.kind === "bridge") return this._probeBridge(provider);
    if (provider.kind === "ollama") return this._probeOllama(provider);
    return this._probeOpenAi(provider);
  }

  async _probeBridge(provider) {
    try {
      const resp = await this._fetchWithTimeout(`${provider.baseUrl}/api/status`, {}, 2500);
      if (resp.ok) {
        const data = await resp.json();
        const models = Array.isArray(data.localModels) ? data.localModels : [];
        return {
          id: provider.id, online: true, reachable: true, corsOk: true, authError: false,
          detail: `Puente v${data.bridgeVersion || "desconocida"} activo (${models.length} modelos locales)`,
          models,
          lmms: Boolean(data.lmmsAvailable),
          status: data,
        };
      }
      return { id: provider.id, online: false, reachable: true, corsOk: true, authError: false, detail: `Puente respondió HTTP ${resp.status}`, models: [] };
    } catch (e) {
      return this._reachableOnlyCheck(
        provider,
        "Puente no accesible desde el navegador: red inalcanzable o bloqueo HTTPS→HTTP.",
        "Alcanzable en red, pero el navegador no puede leerlo (CORS): comprueba que el proceso ES el FoZ Local Bridge."
      );
    }
  }

  async _probeOllama(provider) {
    try {
      const resp = await this._fetchWithTimeout(`${provider.baseUrl}/api/tags`, {}, 3000);
      if (resp.ok) {
        const data = await resp.json();
        const models = (data.models || [])
          .filter((m) => !String(m.name || "").includes(":cloud") && !m.remote_model)
          .map((m) => ({
            name: m.name,
            size: m.size || 0,
            parameter_size: (m.details || {}).parameter_size || "Desconocido",
            family: (m.details || {}).family || "Desconocido",
          }));
        return {
          id: provider.id, online: true, reachable: true, corsOk: true, authError: false,
          detail: `Ollama directo online (${models.length} modelos)`,
          models,
          status: data,
        };
      }
      return { id: provider.id, online: false, reachable: true, corsOk: true, authError: false, detail: `Ollama respondió HTTP ${resp.status}`, models: [] };
    } catch (e) {
      return this._reachableOnlyCheck(
        provider,
        "No accesible desde el navegador: red/Tailscale caída, o bloqueo de contenido mixto HTTPS→HTTP (en Pages hay que usar el puente).",
        "Alcanzable en red, pero sin CORS para leer modelos: define OLLAMA_ORIGINS en el servidor Ollama y reinícialo."
      );
    }
  }

  /**
   * Segunda sonda con mode:"no-cors" (respuesta opaca): si resuelve, la red SÍ
   * llega al host. Permite distinguir "alcanzable sin CORS" de "no accesible".
   */
  async _reachableOnlyCheck(provider, downDetail, limitedDetail) {
    try {
      const probeUrl = provider.kind === "bridge" ? `${provider.baseUrl}/api/status` : `${provider.baseUrl}/api/tags`;
      await this._fetchWithTimeout(probeUrl, { mode: "no-cors" }, 3000);
      return {
        id: provider.id, online: false, reachable: true, corsOk: false, authError: false,
        detail: limitedDetail,
        models: [],
      };
    } catch (e) {
      return {
        id: provider.id, online: false, reachable: false, corsOk: false, authError: false,
        detail: downDetail,
        models: [],
      };
    }
  }

  async _probeOpenAi(provider) {
    const headers = { "Content-Type": "application/json" };
    if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;
    try {
      const resp = await this._fetchWithTimeout(`${provider.baseUrl}/models`, { headers }, 4000);
      if (resp.status === 401 || resp.status === 403) {
        return { id: provider.id, online: false, reachable: true, corsOk: true, authError: true, detail: "API key denegada o ausente (HTTP 401/403)", models: [] };
      }
      if (resp.ok) {
        const data = await resp.json();
        const models = Array.isArray(data.data) ? data.data.map((m) => ({ name: m.id })).filter((m) => m.name) : [];
        return {
          id: provider.id, online: true, reachable: true, corsOk: true, authError: false,
          detail: `API online (${models.length} modelos listados)`,
          models,
        };
      }
      if (resp.status === 404 || resp.status === 405) {
        return { id: provider.id, online: false, reachable: true, corsOk: true, authError: false, detail: "Servidor responde pero sin /models (puede seguir siendo compatible con chat/completions)", models: [] };
      }
      return { id: provider.id, online: false, reachable: true, corsOk: true, authError: false, detail: `API respondió HTTP ${resp.status}`, models: [] };
    } catch (e) {
      return {
        id: provider.id, online: false, reachable: false, corsOk: false, authError: false,
        detail: "No accesible desde el navegador (CORS, dominio o red); verifica la baseUrl y que la API permita CORS",
        models: [],
      };
    }
  }

  /**
   * Sondea todos los proveedores activos en paralelo y decide el "conectado".
   * Prioridad del activo: seleccionado por el usuario si está online;
   * si no, el primer proveedor online.
   */
  async checkConnection() {
    const enabled = this.settings.providers.filter((p) => p.enabled !== false);
    const settled = await Promise.allSettled(enabled.map((p) => this.probeProvider(p)));
    const statuses = settled.map((r) => r.value || r.reason);
    for (const s of statuses) if (s && s.models) s.models = s.models.map((m) => (typeof m === "object" ? m : { name: m }));
    this.providerStatuses = statuses;

    const onlineIds = statuses.filter((s) => s.online).map((s) => s.id);
    const chosenId = onlineIds.includes(this.settings.activeProvider) && (this.getProvider(this.settings.activeProvider) || {}).enabled !== false
      ? this.settings.activeProvider
      : (onlineIds[0] || null);

    this.activeProviderId = chosenId;
    this.activeModel = this._pickModelFor(chosenId, statuses);
    this.isBridgeConnected = onlineIds.some((id) => this.getProvider(id) && this.getProvider(id).kind === "bridge");
    const chosen = statuses.find((s) => s.id === chosenId) || null;
    this.detectedModels = chosen ? chosen.models : [];

    const bridgeStatus = statuses.find((s) => this.getProvider(s.id) && this.getProvider(s.id).kind === "bridge");

    return {
      connected: onlineIds.length > 0,
      provider: this.getProvider(chosenId),
      status: chosen,
      statuses,
      models: this.detectedModels,
      activeModel: this.activeModel,
      activeProviderId: chosenId,
      lmmsInstalled: bridgeStatus ? Boolean(bridgeStatus.lmms) : false,
    };
  }

  /** Modelo elegible: preferencia del proveedor > preferencia global > llamusic/qwen/phi4 > primero no-embed. */
  _pickModelFor(providerId, statuses) {
    const st = statuses.find((s) => s.id === providerId);
    if (!st || !Array.isArray(st.models) || !st.models.length) return null;
    const prov = this.getProvider(providerId);
    const pref = prov ? prov.model : "";
    if (pref && st.models.some((m) => m && m.name === pref)) return pref;
    const preferredDefaults = ["llamusic/llamusic:latest", "qwen3.5:4b", "phi4-mini-reasoning:latest"];
    for (const cand of preferredDefaults) {
      if (st.models.some((m) => m && m.name === cand)) return cand;
    }
    const nonEmbed = st.models.find((m) => m && m.name && !m.name.toLowerCase().includes("embed"));
    return nonEmbed ? nonEmbed.name : st.models[0].name;
  }

  // ===========================================================================
  // GENERACIÓN DE PATRONES
  // ===========================================================================

  async generatePattern(promptText, genre = "trap", currentBpm = 140) {
    const status = await this.checkConnection();

    if (status.connected) {
      const onlineProviders = (status.statuses || []).filter((s) => s.online).map((s) => this.getProvider(s.id)).filter(Boolean);
      const chosenFirst = status.provider;
      const candidates = [];
      if (chosenFirst && chosenFirst.enabled !== false) candidates.push(chosenFirst);
      onlineProviders.forEach((p) => {
        if (!candidates.some((c) => c && c.id === p.id)) candidates.push(p);
      });

      const failures = [];
      for (const provider of candidates) {
        try {
          return await this._generateViaProvider(provider, promptText, genre, currentBpm);
        } catch (err) {
          failures.push(`${provider.name} (${provider.kind}): ${err.message}`);
          console.warn(`Falló la generación con "${provider.name}":`, err.message);
        }
      }
      if (failures.length) {
        console.warn("Ningún proveedor IA pudo generar el patrón; motor heurístico local:", failures.join(" | "));
      }
    }

    return this._generateWithNativeRules(promptText, genre, currentBpm);
  }

  async _generateViaProvider(provider, promptText, genre, currentBpm) {
    if (provider.kind === "bridge") {
      return await this._generateWithOllamaBridge(provider, promptText, genre, currentBpm);
    }
    if (provider.kind === "ollama") {
      return await this._generateWithOllamaDirect(provider, promptText, genre, currentBpm);
    }
    return await this._generateWithOpenAi(provider, promptText, genre, currentBpm);
  }

  _systemInstruction() {
    const voices = window.FoZConstants.AI_VOICE_IDS;
    const schemaTracks = voices.map((v) => `    "${v}": [16 números 0 o 1]`).join(",\n");
    const schemaVels = voices.map((v) => `    "${v}": [16 números flotantes entre 0.1 y 1.0]`).join(",\n");
    return (
      "Eres el asistente musical de FoZ SoundPro. Tu tarea es generar patrones rítmicos " +
      "de batería en formato JSON para un secuenciador de 16 pasos en compás 4/4 con 16 voces. " +
      "Debes responder EXCLUSIVAMENTE con un JSON válido sin texto introductorio ni explicaciones adicionales. " +
      "Estructura exacta requerida:\n" +
      "{\n" +
      '  "genre": "género musical",\n' +
      '  "suggestedBpm": número entero entre 60 y 180,\n' +
      '  "swing": número flotante entre 0.0 y 0.5,\n' +
      '  "explanation": "breve razonamiento rítmico",\n' +
      '  "tracks": {\n' + schemaTracks + "\n  },\n" +
      '  "velocities": {\n' + schemaVels + "\n  }\n" +
      "}\n" +
      "Las voces que no uses déjalas todo a 0 o 1. Sketch de géneros: trap (hi-hats rápidos), boombap (swing), drill (syncopa) y lo-fi."
    );
  }

  _userQuery(promptText, genre, bpm) {
    return `Género: ${genre}. Tempo actual: ${bpm} BPM. Instrucción del productor: ${promptText}`;
  }

  _cleanJsonText(rawText) {
    let text = String(rawText || "").trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last > first) text = text.slice(first, last + 1);
    return text;
  }

  async _generateWithOllamaBridge(provider, promptText, genre, bpm) {
    const payload = {
      prompt: promptText,
      genre: genre,
      bpm: bpm,
      model: provider.model || this.activeModel,
    };
    const resp = await this._fetchWithTimeout(`${provider.baseUrl}/api/generate-pattern`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 320000);
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Error del Bridge (${resp.status}): ${errText}`);
    }
    const data = await resp.json();
    this._validatePatternData(data);
    this.lastGeneratedResult = data;
    return data;
  }

  async _generateWithOllamaDirect(provider, promptText, genre, bpm) {
    const payload = {
      model: provider.model || this.activeModel,
      messages: [
        { role: "system", content: this._systemInstruction() },
        { role: "user", content: this._userQuery(promptText, genre, bpm) },
      ],
      stream: false,
      format: "json",
      options: { temperature: 0.3, top_p: 0.9, num_ctx: 2048 },
    };
    const resp = await this._fetchWithTimeout(`${provider.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 150000);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Error de Ollama (${resp.status}): ${errText.slice(0, 160)}`);
    }
    const data = await resp.json();
    const content = data && data.message && typeof data.message.content === "string" ? data.message.content : "";
    const parsed = JSON.parse(this._cleanJsonText(content) || "{}");
    return this._normalizePattern(parsed, `Ollama directo (${payload.model})`, genre, bpm, provider.id);
  }

  async _generateWithOpenAi(provider, promptText, genre, bpm) {
    const headers = { "Content-Type": "application/json" };
    if (provider.apiKey) headers["Authorization"] = `Bearer ${provider.apiKey}`;
    const payload = {
      model: provider.model || this.activeModel,
      temperature: 0.3,
      messages: [
        { role: "system", content: this._systemInstruction() },
        { role: "user", content: this._userQuery(promptText, genre, bpm) },
      ],
    };
    const resp = await this._fetchWithTimeout(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }, 120000);
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      throw new Error(`Error de la API (${resp.status}): ${errText.slice(0, 160)}`);
    }
    const data = await resp.json();
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";
    const parsed = JSON.parse(this._cleanJsonText(content) || "{}");
    return this._normalizePattern(parsed, `API del usuario (${payload.model})`, genre, bpm, provider.id);
  }

  /**
   * Normaliza cualquier salida a las 16 voces canónicas. Acepta sinónimos
   * comunes y descarta claves desconocidas. longitudes 4..64 se respetan.
   */
  _normalizePattern(parsed, source, genre, bpm, providerId) {
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Respuesta inválida: no es un objeto JSON.");
    }
    const validVoices = window.FoZConstants.AI_VOICE_IDS;
    const aliases = {
      hihat: "hihat_closed", "hi-hat": "hihat_closed", hh: "hihat_closed",
      openhihat: "hihat_open", "hi-hat-open": "hihat_open", oih: "hihat_open",
      rim: "rimshot", snaredrum: "snare",
      bass: "bass808", sub: "bass808", "808": "bass808",
    };
    // tracks viene anidado bajo "tracks"; si el modelo lo devuelve plano
    // (kick: [...], snare: [...]) usamos el propio objeto como raíz.
    const rawTracks = parsed.tracks && typeof parsed.tracks === "object" ? parsed.tracks : parsed;
    const rawVels = parsed.velocities && typeof parsed.velocities === "object" ? parsed.velocities : {};

    const tracks = {};
    const velocities = {};
    for (const voice of validVoices) {
      const paths = [voice, aliases[voice.toLowerCase()]];
      let stepsSrc = null;
      let velsSrc = null;
      for (const key of paths) {
        if (typeof key === "string" && Array.isArray(rawTracks[key])) stepsSrc = rawTracks[key];
        if (typeof key === "string" && Array.isArray(rawVels[key])) velsSrc = rawVels[key];
      }
      const boolSteps = stepsSrc ? stepsSrc.map((s) => Boolean(s)) : [];
      const clamp = (v) => (typeof v === "number" && isFinite(v) ? Math.min(1.0, Math.max(0.1, v)) : 0.85);
      const floatVels = velsSrc ? velsSrc.map(clamp) : [];
      const targetLen = Math.min(64, Math.max(16, boolSteps.length || 16));
      tracks[voice] = new Array(targetLen).fill(false).map((_, i) => boolSteps[i] || false);
      velocities[voice] = new Array(targetLen).fill(0.85).map((_, i) => (floatVels[i] !== undefined ? floatVels[i] : 0.85));
    }

    const bpmNum = Math.max(30, Math.min(300, Math.round(Number(parsed.suggestedBpm) || bpm)));
    const swingNum = Math.max(0, Math.min(0.75, Number(parsed.swing)));
    const result = {
      source: source,
      genre: String(parsed.genre || genre),
      suggestedBpm: Number.isFinite(bpmNum) ? bpmNum : bpm,
      swing: Number.isFinite(swingNum) ? swingNum : 0.1,
      explanation: String(parsed.explanation || "Patrón generado por IA."),
      tracks,
      velocities,
    };
    if (providerId) result.providerId = providerId;
    this._validatePatternData(result);
    this.lastGeneratedResult = result;
    return result;
  }

  /**
   * Motor Heurístico Nativo de Teoría Musical (100% offline, determinista o variacional)
   */
  _generateWithNativeRules(promptText, genre = "trap", currentBpm = 140) {
    const g = (genre || "trap").toLowerCase();
    const empty16 = () => new Array(16).fill(false);
    const tracks = {};
    const velocities = {};
    window.FoZConstants.AI_VOICE_IDS.forEach((v) => {
      tracks[v] = empty16();
      velocities[v] = new Array(16).fill(0.85);
    });
    const result = {
      source: "Motor Heurístico Musical Local (Offline)",
      genre: genre,
      suggestedBpm: currentBpm,
      swing: 0.1,
      explanation: "",
      tracks,
      velocities,
    };

    if (g.includes("boombap") || g.includes("boom bap") || g.includes("90s") || g.includes("rap")) {
      result.suggestedBpm = 90;
      result.swing = 0.22;
      result.explanation = "Patrón Boom Bap clásico: bombo en pulso 1 y 2.5, caja con pegada en 2 y 4, hi-hats en corcheas con swing natural.";

      [0, 6, 8].forEach((i) => (result.tracks.kick[i] = true));
      [0, 6, 8].forEach((i) => (result.tracks.bass808[i] = true));
      [4, 12].forEach((i) => (result.tracks.snare[i] = true));
      for (let i = 0; i < 16; i += 2) {
        result.tracks.hihat_closed[i] = true;
        result.velocities.hihat_closed[i] = i % 4 === 0 ? 0.9 : 0.68;
      }
      result.tracks.hihat_open[14] = true;
      result.tracks.rimshot[10] = true;
    } else if (g.includes("drill")) {
      result.suggestedBpm = 142;
      result.swing = 0.15;
      result.explanation = "Patrón UK/NY Drill: caja desplazada al compás 3, hi-hats sincopados en tresillos/semicorcheas y 808 con caídas.";

      [0, 10].forEach((i) => (result.tracks.kick[i] = true));
      [0, 10].forEach((i) => (result.tracks.bass808[i] = true));
      [8, 12].forEach((i) => (result.tracks.snare[i] = true));
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
      result.suggestedBpm = 140;
      result.swing = 0.05;
      result.explanation = "Patrón Trap Moderno: palmas en el pulso 3, hi-hats rápidos en semicorcheas continuas y bombo 808 sincopado.";

      [0, 8, 14].forEach((i) => (result.tracks.kick[i] = true));
      [0, 8, 14].forEach((i) => (result.tracks.bass808[i] = true));
      [8].forEach((i) => (result.tracks.clap[i] = true));
      [8].forEach((i) => (result.tracks.snare[i] = true));
      for (let i = 0; i < 16; i++) {
        result.tracks.hihat_closed[i] = true;
        result.velocities.hihat_closed[i] = i % 4 === 0 ? 0.95 : i % 2 === 0 ? 0.8 : 0.65;
      }
      result.velocities.hihat_closed[14] = 0.9;
      result.velocities.hihat_closed[15] = 1.0;
      result.tracks.hihat_open[6] = true;
    }

    this.lastGeneratedResult = result;
    return result;
  }

  /** Validación mínima antes de devolver el patrón al secuenciador. */
  _validatePatternData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Respuesta inválida: no es un objeto JSON.");
    }
    if (!data.tracks || typeof data.tracks !== "object") {
      throw new Error("Respuesta inválida: falta el bloque 'tracks'.");
    }
    const validInstruments = window.FoZConstants.AI_VOICE_IDS;
    for (const inst of validInstruments) {
      if (data.tracks[inst] && !Array.isArray(data.tracks[inst])) {
        throw new Error(`La pista ${inst} debe ser una lista de pasos.`);
      }
    }
  }

  // ===========================================================================
  // DESCARGA DE MODELOS (pull)
  // ===========================================================================

  /**
   * Descarga un modelo en un Ollama.
   * - kind "ollama": intenta directo; si el navegador no llega (HTTPS→HTTP),
   *   usa el puente con host especificado (si hay puente activo).
   * - kind "bridge": pide al puente { model, host? } (host = URL Ollama destino).
   * - kind "openai": no aplica (los modelos de API no se "descargan").
   */
  async pullModel(providerId, modelName) {
    const provider = this.getProvider(providerId);
    if (!provider) throw new Error("Proveedor no encontrado.");
    const model = String(modelName || provider.model || "").trim();
    if (!model || !/^[A-Za-z0-9_./:-]{1,120}$/.test(model)) {
      throw new Error("Nombre de modelo inválido (ejemplos: qwen3.5:4b, llamusic/llamusic:latest).");
    }

    if (provider.kind === "openai") {
      throw new Error("Los proveedores de API no necesitan descarga: el modelo se elige en su consola.");
    }

    if (provider.kind === "ollama") {
      try {
        const resp = await fetch(`${provider.baseUrl}/api/pull`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, stream: false }),
        });
        if (resp.ok) return this._parsePullResponse(resp, model, provider.baseUrl);
        throw new Error(await resp.text());
      } catch (e) {
        const bridge = this.settings.providers.find((p) => p.kind === "bridge" && p.enabled !== false);
        if (!bridge) throw new Error("Descarga no posible desde el navegador y sin puente activo: inicia el FoZ Local Bridge e inténtalo de nuevo.");
        return this._pullViaBridge(bridge, model, provider.baseUrl);
      }
    }

    // pull desde un proveedor "bridge"
    const hostHint = this._inferOllamaHostFromPull(provider);
    return this._pullViaBridge(provider, model, hostHint);
  }

  _inferOllamaHostFromPull(_provider) {
    // El puente usa su OLLAMA_BASE_URL si no se especifica host.
    const ollamaProv = this.settings.providers.find((p) => p.kind === "ollama" && p.enabled !== false);
    return ollamaProv ? ollamaProv.baseUrl : "";
  }

  async _pullViaBridge(bridgeProvider, model, host) {
    const payload = { model };
    if (host) payload.host = host;
    const resp = await fetch(`${bridgeProvider.baseUrl}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Error del puente (${resp.status}): ${text.slice(0, 200)}`);
    }
    return this._parsePullResponse(resp, model, host || "puente");
  }

  async _parsePullResponse(resp, model, host) {
    const text = await resp.text();
    let detail = text ? text.slice(0, 200) : "";
    try {
      const data = JSON.parse(text);
      detail = data.status || detail;
      if (String(detail).toLowerCase() === "success") detail = "Success";
    } catch (e) { /* respuesta no JSON: usar texto crudo */ }
    return { ok: true, model, host, detail };
  }

  // ===========================================================================
  // APLICACIÓN AL PROYECTO (compatible con el wiring principal)
  // ===========================================================================

  applyToProject(project, patternData) {
    if (!patternData || !patternData.tracks) return false;

    if (patternData.suggestedBpm) {
      project.bpm = patternData.suggestedBpm;
    }
    if (patternData.swing !== undefined) {
      project.swing = patternData.swing;
    }

    const stepsCount = project.stepsCount || 16;
    Object.keys(patternData.tracks).forEach((instId) => {
      const targetTrack = project.tracks.find((t) => t.id === instId);
      if (targetTrack) {
        const rawSteps = patternData.tracks[instId];
        const steps = new Array(stepsCount).fill(false).map((_, i) => Boolean(rawSteps[i]));
        targetTrack.steps = steps;
        if (patternData.velocities && patternData.velocities[instId]) {
          const vels = new Array(stepsCount).fill(window.FoZConstants.DEFAULT_VELOCITY);
          rawSteps.forEach((_, i) => {
            if (i < stepsCount && typeof patternData.velocities[instId][i] === "number") {
              vels[i] = patternData.velocities[instId][i];
            }
          });
          targetTrack.velocities = vels;
        }
      }
    });

    return true;
  }
}

window.fozAIAssistant = new FoZAIAssistant();
