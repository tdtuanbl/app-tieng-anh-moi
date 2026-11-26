// Màn hình Học từ vựng cho bé Đậu cùng Cô giáo (Thẻ lật 3D & Mạch học liền mạch)
const LearnScreen = {
  currentIndex: 0,
  words: [],
  isSpeaking: false,
  isFlipped: false,
  isFlipping: false,
  isAdvancing: false,
  advanceTimer: null,
  playSequence: 0,
  audioListenerAttached: false,
  audioCtx: null,
  ttsUrlCache: new Map(),
  lastPraise: "",
  lastEnPraise: "",
  activeSoundNodes: [],
  isSpeakingRealSound: false,
  realAudioBuffers: new Map(),
  realAudioLoading: new Map(),
  activeRealSoundSource: null,
  activeHtmlAudio: null,
  realSoundPlaySeq: 0,
  isPronunciationPassed: false,
  failCount: 0,
  isListening: false,
  speechRecognition: null,
  speechTimeoutTimer: null,
  speechFeedbackState: null,
  isConfirmingFromSpeech: false,
  lastRetryPrompt: "",
  isSpeakingRetryPrompt: false,

  // Danh sách 44 âm thanh thu âm đời thực (.mp3) trong /static/sounds/
  REAL_SOUND_FILES: new Set([
    // 18 động vật
    "dog", "cat", "cow", "pig", "chicken", "duck", "lion", "tiger", "elephant",
    "bird", "sparrow", "frog", "horse", "goat", "monkey", "bee", "snake", "crocodile",
    // 26 phương tiện
    "car", "taxi", "bus", "truck", "dump_truck", "pickup_truck", "container_truck",
    "van", "motorbike", "scooter", "fire_truck", "police_car", "ambulance",
    "train", "bullet_train", "airplane", "helicopter", "ship", "ferry", "boat",
    "bicycle", "cyclo", "tractor", "excavator", "bulldozer", "submarine"
  ]),

  REAL_SOUND_ALIASES: {
    rooster: "chicken",
    hen: "chicken",
    puppy: "dog",
    kitten: "cat"
  },

  VI_PRAISES: [
    "Giỏi quá Đậu ơi, con đọc xuất sắc lắm!",
    "Hoan hô, Đậu của cô giỏi quá!",
    "Tuyệt vời, cô thưởng Đậu một ngôi sao nhé!",
    "Chính xác rồi, Đậu đọc siêu quá nè!"
  ],

  VI_RETRY_PROMPTS: [
    "Đậu đọc lại to và rõ hơn một chút nhé!",
    "Gần đúng rồi Đậu ơi, thử lại nào!",
    "Cô chưa nghe rõ, Đậu nói lại cho cô nghe nhé!",
    "Cố lên Đậu ơi, đọc lại một lần nữa nào!"
  ],

  EN_PRAISES: [
    "Awesome job, Đậu!",
    "You are amazing, Đậu! Ten out of ten!",
    "Excellent pronunciation, Đậu!",
    "Spot on, Đậu!"
  ],

  // Bảng quy đổi đồng âm trẻ em Việt 5 tuổi giúp không chấm oan giọng trẻ thơ
  CHILD_HOMOPHONES: {
    car: ["ka", "ca", "card", "cart", "kah", "cah", "call", "core", "cars"],
    bus: ["but", "bud", "bot", "bath", "buzz", "boss", "birth", "bo", "buss", "bucks"],
    cat: ["ket", "cut", "cad", "cap", "kit", "kat", "catt", "catch"],
    dog: ["dot", "dock", "dark", "doc", "dawg", "dug", "doggy", "dogg"],
    ship: ["sip", "sheep", "chip", "sheet", "sit", "shift"],
    train: ["chain", "rain", "jane", "tran", "trane", "tren", "tray"],
    truck: ["chuck", "track", "trunk", "tuck", "chug", "chat", "truk", "trac"],
    van: ["fan", "man", "pen", "ban", "when", "ven", "vann"],
    taxi: ["text", "taxy", "texi", "taksi", "texas", "tax"],
    bicycle: ["by circle", "by sico", "bi cycle", "bicycl", "bicycles"],
    bike: ["by", "buy", "bite", "pike", "bake"],
    boat: ["bolt", "bow", "bode", "bot", "both", "bote"],
    airplane: ["air plain", "airplay", "explain", "play", "plain", "aeroplane"],
    helicopter: ["heli copter", "heli", "cop ter"],
    rocket: ["rock it", "pocket", "locket", "rock"],
    pig: ["big", "pick", "pink", "peg", "peeg"],
    cow: ["cowl", "how", "now", "kao", "kau"],
    duck: ["dark", "dock", "dot", "dug", "dac", "dack", "luck", "tuck"],
    bird: ["birth", "but", "bud", "bert", "burd", "burn"],
    chicken: ["kitchen", "checking", "chiken", "chick", "cheeken"],
    rooster: ["roster", "booster", "ruster"],
    lion: ["line", "lying", "ryan", "lyon", "laion"],
    tiger: ["tie", "tighter", "tyger", "taiger"],
    elephant: ["elefant", "eleven", "oliphant", "alephan"],
    sheep: ["ship", "cheap", "sheet", "seep"],
    horse: ["house", "hose", "hoarse", "force", "hoss"],
    frog: ["fog", "fork", "flog", "phrog"],
    fish: ["fist", "feet", "fit", "feesh"],
    ant: ["and", "aunt", "end", "act"],
    bee: ["be", "b", "pea", "pee", "beat"],
    apple: ["app", "able", "aple", "appo"],
    milk: ["mew", "mill", "miwk"],
    egg: ["et", "eck", "age", "eight"],
    cake: ["kek", "kick", "bake", "take"],
    red: ["read", "rat", "let", "wed"],
    blue: ["blew", "boo", "lu", "bloo"],
    green: ["grin", "clean", "queen"],
    one: ["won", "wan"],
    two: ["to", "too", "tu"],
    three: ["tree", "free", "tri"],
    four: ["for", "fo", "fall"],
    five: ["fine", "fai", "fight"]
  },

  // Khởi tạo AudioContext dùng chung cho âm thanh Ting 0ms & Web Audio
  getAudioContext() {
    if (!this.audioCtx) {
      if (window.AppState && typeof AppState.getAudioContext === "function") {
        this.audioCtx = AppState.getAudioContext();
      } else {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioCtx = new AudioCtx();
      }
    }
    if (window.AppState && !AppState.audioCtx && this.audioCtx) {
      AppState.audioCtx = this.audioCtx;
    }
    if (this.audioCtx && this.audioCtx.state !== "running" && this.audioCtx.state !== "closed") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  },

  // Phát tiếng chuông "Ting!" pha lê tức thì 0ms bằng Web Audio API
  playVictoryChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Ting 1 (E6 - 1318.5 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1318.5, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Ting 2 (B6 - 1975.5 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1975.5, now + 0.08);
      gain2.gain.setValueAtTime(0.22, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn("Chime error:", e);
    }
  },

  // Dừng toàn bộ âm thanh thực tế đang phát (AudioBufferSourceNode lẫn Web Audio synth fallback)
  stopRealSound() {
    this.realSoundPlaySeq = (this.realSoundPlaySeq || 0) + 1;
    if (this.activeRealSoundSource) {
      const { src, gain, timer, resolve } = this.activeRealSoundSource;
      this.activeRealSoundSource = null;
      if (timer) clearTimeout(timer);
      try { src.onended = null; } catch (e) {}
      try { src.stop(0); } catch (e) {}
      try { src.disconnect(); } catch (e) {}
      try { gain.disconnect(); } catch (e) {}
      if (typeof resolve === "function") {
        try { resolve(); } catch (e) {}
      }
    }
    if (this.activeHtmlAudio) {
      const { audio, timer, resolve } = this.activeHtmlAudio;
      this.activeHtmlAudio = null;
      if (timer) clearTimeout(timer);
      try { audio.onended = null; } catch (e) {}
      try { audio.onerror = null; } catch (e) {}
      try { audio.pause(); } catch (e) {}
      try { audio.currentTime = 0; } catch (e) {}
      if (typeof resolve === "function") {
        try { resolve(); } catch (e) {}
      }
    }
    if (this.activeSoundNodes && this.activeSoundNodes.length > 0) {
      this.activeSoundNodes.forEach(node => {
        try { node.stop(); } catch (e) {}
      });
      this.activeSoundNodes = [];
    }
    this.isSpeakingRealSound = false;
  },

  // Lấy ID file .mp3 tương ứng trong /static/sounds/ (44 âm thanh đời thực + alias)
  getRealSoundFileId(wordId) {
    if (!wordId) return null;
    const id = wordId.toLowerCase();
    const mapped = this.REAL_SOUND_ALIASES[id] || id;
    return this.REAL_SOUND_FILES.has(mapped) ? mapped : null;
  },

  // Kiểm tra xem từ vựng có hỗ trợ âm thanh thực tế không
  hasRealSound(wordId) {
    return !!(this.getRealSoundFileId(wordId) || this.getSoundKey(wordId));
  },

  // Tải trước & giải mã MP3 qua AudioContext.decodeAudioData() vào RAM để phát 0ms
  async preloadRealSound(wordId) {
    const mappedId = this.getRealSoundFileId(wordId);
    if (!mappedId) return null;

    if (this.realAudioBuffers.has(mappedId)) {
      return this.realAudioBuffers.get(mappedId);
    }
    if (this.realAudioLoading.has(mappedId)) {
      return this.realAudioLoading.get(mappedId);
    }

    const loadPromise = (async () => {
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return null;
        const res = await fetch(`/static/sounds/${mappedId}.mp3?v=34`);
        if (!res.ok) return null;
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await new Promise((resolve, reject) => {
          const maybePromise = ctx.decodeAudioData(arrayBuf, resolve, reject);
          if (maybePromise && typeof maybePromise.then === "function") {
            maybePromise.then(resolve).catch(reject);
          }
        });
        if (audioBuf) {
          this.realAudioBuffers.set(mappedId, audioBuf);
        }
        return audioBuf || null;
      } catch (err) {
        console.warn(`Lỗi nạp âm thanh thực tế ${mappedId}:`, err);
        return null;
      } finally {
        this.realAudioLoading.delete(mappedId);
      }
    })();

    this.realAudioLoading.set(mappedId, loadPromise);
    return loadPromise;
  },

  // Tự động nạp trước âm thanh cho từ hiện tại và từ kế tiếp
  preloadAdjacentRealSounds() {
    if (!this.words || this.words.length === 0) return;
    const cur = this.words[this.currentIndex];
    const next = this.words[this.currentIndex + 1];
    if (cur && cur.id) this.preloadRealSound(cur.id);
    if (next && next.id) this.preloadRealSound(next.id);
  },

  // Ánh xạ từ vựng sang key tổng hợp Web Audio (chỉ dùng làm fallback khi mạng chậm/chưa giải mã MP3)
  getSoundKey(wordId) {
    if (!wordId) return null;
    const id = wordId.toLowerCase();
    // Phương tiện giao thông
    if (id === "fire_truck") return "fire_truck";
    if (id === "police_car") return "police_car";
    if (id === "ambulance") return "ambulance";
    if (["car", "bus", "taxi", "pickup_truck", "van", "truck", "dump_truck", "container_truck"].includes(id)) return "car_horn";
    if (["train", "bullet_train"].includes(id)) return "train_whistle";
    if (["bicycle", "cyclo", "tricycle"].includes(id)) return "bicycle_bell";
    if (["ship", "ferry", "boat", "speedboat", "submarine"].includes(id)) return "ship_horn";
    if (["airplane", "rocket", "helicopter", "motorbike", "scooter", "tractor", "excavator", "bulldozer"].includes(id)) return "engine_rumble";

    // Động vật
    if (["cat", "kitten"].includes(id)) return "cat_meow";
    if (["dog", "puppy"].includes(id)) return "dog_bark";
    if (id === "cow") return "cow_moo";
    if (id === "pig") return "pig_oink";
    if (["chicken", "rooster", "hen"].includes(id)) return "rooster_crow";
    if (["duck", "frog"].includes(id)) return "duck_quack";
    if (["lion", "tiger", "crocodile"].includes(id)) return "lion_roar";
    if (id === "elephant") return "elephant_trumpet";
    if (["bird", "sparrow", "bee", "monkey", "horse", "goat", "snake"].includes(id)) return "bird_chirp";

    return null;
  },

  // Phát âm thanh thu âm đời thực 0ms (ưu tiên AudioBufferSourceNode, fallback HTMLAudioElement & Web Audio cho Safari iPadOS)
  playRealSound(wordId) {
    this.stopRealSound();
    const mySeq = ++this.realSoundPlaySeq;

    const ctx = (window.AppState && typeof AppState.getAudioContext === "function")
      ? AppState.getAudioContext()
      : this.getAudioContext();
    if (ctx) {
      this.audioCtx = ctx;
      if (ctx.state !== "running" && ctx.state !== "closed") {
        ctx.resume().catch(() => {});
      }
    }

    const mappedId = this.getRealSoundFileId(wordId);
    if (mappedId) {
      const buffer = this.realAudioBuffers.get(mappedId) || null;
      if (buffer && ctx && ctx.state === "running") {
        return this.playBufferedRealSound(ctx, buffer, mappedId, wordId, mySeq);
      }
      if (!buffer) {
        this.preloadRealSound(mappedId);
      }
      return this.playHtmlRealSound(mappedId, wordId, mySeq);
    }

    return this.playSynthRealSound(wordId, mySeq);
  },

  // Phát AudioBuffer đã giải mã sẵn trong RAM với độ trễ 0ms
  playBufferedRealSound(ctx, buffer, mappedId, wordId, mySeq) {
    if (mySeq !== this.realSoundPlaySeq) return Promise.resolve();
    this.isSpeakingRealSound = true;
    return new Promise((resolve) => {
      try {
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = buffer;
        gain.gain.setValueAtTime(1.0, ctx.currentTime);
        src.connect(gain);
        gain.connect(ctx.destination);

        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (this.activeRealSoundSource && this.activeRealSoundSource.src === src) {
            this.activeRealSoundSource = null;
          }
          this.isSpeakingRealSound = false;
          try { src.onended = null; } catch (e) {}
          try { src.disconnect(); } catch (e) {}
          try { gain.disconnect(); } catch (e) {}
          resolve();
        };

        const maxWaitMs = Math.min(1600, Math.max(300, Math.ceil((buffer.duration || 1.5) * 1000) + 80));
        const timer = setTimeout(() => {
          try { src.stop(0); } catch (e) {}
          finish();
        }, maxWaitMs);

        this.activeRealSoundSource = {
          src,
          gain,
          timer,
          resolve: () => {
            clearTimeout(timer);
            finish();
          }
        };
        src.onended = () => {
          clearTimeout(timer);
          finish();
        };
        src.start(0);
      } catch (err) {
        console.warn("Lỗi phát AudioBufferSourceNode, chuyển sang HTMLAudioElement:", err);
        this.isSpeakingRealSound = false;
        this.playHtmlRealSound(mappedId, wordId, mySeq).then(resolve);
      }
    });
  },

  // Phát trực tiếp file MP3 bằng HTMLAudioElement đồng bộ trong User Gesture (vượt lỗi Safari iPadOS interrupted)
  playHtmlRealSound(mappedId, wordId, mySeq) {
    if (mySeq !== this.realSoundPlaySeq) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      let audio = null;
      let timer = null;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (this.activeHtmlAudio && this.activeHtmlAudio.audio === audio) {
          this.activeHtmlAudio = null;
        }
        this.isSpeakingRealSound = false;
        if (audio) {
          try { audio.onended = null; } catch (e) {}
          try { audio.onerror = null; } catch (e) {}
        }
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const fallbackToSynth = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (mySeq === this.realSoundPlaySeq) {
          this.playSynthRealSound(wordId, mySeq).then(resolve);
        } else {
          resolve();
        }
      };

      try {
        audio = new Audio(`/static/sounds/${mappedId}.mp3?v=34`);
        audio.playsInline = true;
        audio.preload = "auto";
        this.isSpeakingRealSound = true;

        timer = setTimeout(() => {
          try { audio.pause(); } catch (e) {}
          try { audio.currentTime = 0; } catch (e) {}
          finish();
        }, 2000);

        this.activeHtmlAudio = { audio, timer, resolve: finish };
        audio.onended = finish;
        audio.onerror = fallbackToSynth;

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {
            fallbackToSynth();
          });
        }
      } catch (err) {
        fallbackToSynth();
      }
    });
  },

  // Bộ tổng hợp Web Audio dự phòng khi file MP3 chưa kịp giải mã hoặc ngoại tuyến
  playSynthRealSound(wordId, seqGuard) {
    if (typeof seqGuard === "number" && seqGuard !== this.realSoundPlaySeq) {
      return Promise.resolve();
    }
    const soundKey = this.getSoundKey(wordId);
    if (!soundKey) return Promise.resolve();

    const ctx = this.getAudioContext();
    if (!ctx) return Promise.resolve();

    this.isSpeakingRealSound = true;
    const t0 = ctx.currentTime;
    let duration = 1.1;

    const registerNode = (node) => {
      this.activeSoundNodes.push({
        stop: () => {
          try { node.stop(); } catch (e) {}
          try { node.disconnect(); } catch (e) {}
        }
      });
    };

    try {
      switch (soundKey) {
        case "fire_truck": {
          // 1. Còi cứu hỏa Hi-Lo (900Hz -> 650Hz xen kẽ 2 chu kỳ)
          duration = 1.15;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = "sawtooth";
          filter.type = "lowpass";
          filter.frequency.value = 1800;
          osc.frequency.setValueAtTime(900, t0);
          osc.frequency.setValueAtTime(650, t0 + 0.28);
          osc.frequency.setValueAtTime(900, t0 + 0.56);
          osc.frequency.setValueAtTime(650, t0 + 0.84);
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.2, t0 + 0.05);
          gain.gain.setValueAtTime(0.2, t0 + 1.0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.15);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.15);
          registerNode(osc);
          break;
        }
        case "police_car": {
          // 2. Còi xe cảnh sát hụ biến tần nhanh (quét tần số 650Hz - 1350Hz)
          duration = 1.15;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = "sawtooth";
          filter.type = "lowpass";
          filter.frequency.value = 2200;
          osc.frequency.setValueAtTime(650, t0);
          osc.frequency.linearRampToValueAtTime(1350, t0 + 0.28);
          osc.frequency.linearRampToValueAtTime(650, t0 + 0.56);
          osc.frequency.linearRampToValueAtTime(1350, t0 + 0.84);
          osc.frequency.linearRampToValueAtTime(650, t0 + 1.1);
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.18, t0 + 0.04);
          gain.gain.setValueAtTime(0.18, t0 + 1.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.15);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.15);
          registerNode(osc);
          break;
        }
        case "ambulance": {
          // 3. Còi xe cấp cứu Wee-Waa (820Hz / 600Hz êm dịu)
          duration = 1.05;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(820, t0);
          osc.frequency.setValueAtTime(600, t0 + 0.35);
          osc.frequency.setValueAtTime(820, t0 + 0.70);
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.25, t0 + 0.05);
          gain.gain.setValueAtTime(0.25, t0 + 0.95);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.05);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.05);
          registerNode(osc);
          break;
        }
        case "car_horn": {
          // 4. Còi xe bíp-bíp đôi (hợp âm 440Hz + 554Hz nhịp đôi)
          duration = 0.9;
          [440, 554].forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
            gain.gain.setValueAtTime(0.12, t0 + 0.32);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
            gain.gain.setValueAtTime(0, t0 + 0.45);
            gain.gain.linearRampToValueAtTime(0.12, t0 + 0.47);
            gain.gain.setValueAtTime(0.12, t0 + 0.80);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.88);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + 0.9);
            registerNode(osc);
          });
          break;
        }
        case "train_whistle": {
          // 5. Còi tàu hỏa tu-tu trầm ấm (311Hz + 370Hz + 466Hz)
          duration = 1.15;
          [311, 370, 466].forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(0.12, t0 + 0.15);
            gain.gain.setValueAtTime(0.12, t0 + 0.85);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.15);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + 1.15);
            registerNode(osc);
          });
          break;
        }
        case "bicycle_bell": {
          // 6. Chuông xe đạp kính-koong trong trẻo (2093Hz và 2637Hz)
          duration = 0.9;
          [[2093, 0], [2637, 0.25]].forEach(([freq, delay]) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const st = t0 + delay;
            gain.gain.setValueAtTime(0, st);
            gain.gain.linearRampToValueAtTime(0.25, st + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.55);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(st);
            osc.stop(st + 0.56);
            registerNode(osc);
          });
          break;
        }
        case "ship_horn": {
          // 7. Còi tàu thủy sương mù rền vang (165Hz + 220Hz qua lowpass filter)
          duration = 1.2;
          [165, 220].forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            osc.type = "sawtooth";
            osc.frequency.value = freq;
            filter.type = "lowpass";
            filter.frequency.value = 600;
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(0.18, t0 + 0.2);
            gain.gain.setValueAtTime(0.18, t0 + 0.95);
            gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.2);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + 1.2);
            registerNode(osc);
          });
          break;
        }
        case "engine_rumble": {
          // 8. Động cơ máy bay / trực thăng rung rền (90Hz - 140Hz qua lowpass)
          duration = 1.15;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(90, t0);
          osc.frequency.linearRampToValueAtTime(140, t0 + 0.6);
          osc.frequency.linearRampToValueAtTime(110, t0 + 1.1);
          filter.type = "lowpass";
          filter.frequency.value = 450;
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.2, t0 + 0.2);
          gain.gain.setValueAtTime(0.2, t0 + 0.85);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.15);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.15);
          registerNode(osc);
          break;
        }
        case "cat_meow": {
          // 9. Tiếng mèo meo meo nũng nịu (sóng sin trượt 580Hz -> 920Hz -> 520Hz)
          duration = 1.0;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(580, t0);
          osc.frequency.exponentialRampToValueAtTime(920, t0 + 0.35);
          osc.frequency.exponentialRampToValueAtTime(520, t0 + 0.95);
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.22, t0 + 0.1);
          gain.gain.setValueAtTime(0.2, t0 + 0.65);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.0);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.0);
          registerNode(osc);
          break;
        }
        case "dog_bark": {
          // 10. Tiếng cún gâu gâu vui tai (2 nhịp sủa ngắn)
          duration = 0.9;
          [0, 0.38].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            osc.type = "sawtooth";
            filter.type = "lowpass";
            filter.frequency.value = 1200;
            const st = t0 + delay;
            osc.frequency.setValueAtTime(380, st);
            osc.frequency.exponentialRampToValueAtTime(180, st + 0.22);
            gain.gain.setValueAtTime(0, st);
            gain.gain.linearRampToValueAtTime(0.28, st + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.24);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(st);
            osc.stop(st + 0.25);
            registerNode(osc);
          });
          break;
        }
        case "cow_moo": {
          // 11. Tiếng bò ùm bò trầm ấm (180Hz -> 125Hz qua lowpass filter)
          duration = 1.15;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(180, t0);
          osc.frequency.exponentialRampToValueAtTime(125, t0 + 0.9);
          filter.type = "lowpass";
          filter.frequency.value = 400;
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.3, t0 + 0.2);
          gain.gain.setValueAtTime(0.28, t0 + 0.8);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.15);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.15);
          registerNode(osc);
          break;
        }
        case "pig_oink": {
          // 12. Tiếng heo ủn ỉn (2 nhịp ủi ủi 240Hz -> 160Hz)
          duration = 0.9;
          [0, 0.35].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            osc.type = "sawtooth";
            filter.type = "bandpass";
            filter.frequency.value = 500;
            const st = t0 + delay;
            osc.frequency.setValueAtTime(240, st);
            osc.frequency.exponentialRampToValueAtTime(160, st + 0.2);
            gain.gain.setValueAtTime(0, st);
            gain.gain.linearRampToValueAtTime(0.25, st + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(st);
            osc.stop(st + 0.24);
            registerNode(osc);
          });
          break;
        }
        case "rooster_crow": {
          // 13. Tiếng gà gáy ò ó o (360Hz -> 540Hz -> 700Hz -> 520Hz)
          duration = 1.1;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = 1600;
          osc.frequency.setValueAtTime(360, t0);
          osc.frequency.linearRampToValueAtTime(540, t0 + 0.2);
          osc.frequency.linearRampToValueAtTime(700, t0 + 0.45);
          osc.frequency.linearRampToValueAtTime(520, t0 + 0.95);
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.18, t0 + 0.1);
          gain.gain.setValueAtTime(0.18, t0 + 0.85);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.05);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.05);
          registerNode(osc);
          break;
        }
        case "duck_quack": {
          // 14. Tiếng vịt cạp cạp (2 nhịp quack quack bandpass 800Hz)
          duration = 0.9;
          [0, 0.38].forEach(delay => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            osc.type = "sawtooth";
            filter.type = "bandpass";
            filter.frequency.value = 800;
            filter.Q.value = 3;
            const st = t0 + delay;
            osc.frequency.setValueAtTime(420, st);
            osc.frequency.linearRampToValueAtTime(320, st + 0.22);
            gain.gain.setValueAtTime(0, st);
            gain.gain.linearRampToValueAtTime(0.28, st + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.25);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            osc.start(st);
            osc.stop(st + 0.26);
            registerNode(osc);
          });
          break;
        }
        case "lion_roar": {
          // 15. Tiếng sư tử / hổ gầm gừ uy nghiêm (130Hz -> 75Hz qua lowpass filter)
          duration = 1.15;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(130, t0);
          osc.frequency.linearRampToValueAtTime(75, t0 + 0.9);
          filter.type = "lowpass";
          filter.frequency.value = 350;
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.3, t0 + 0.15);
          gain.gain.setValueAtTime(0.28, t0 + 0.8);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.15);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.15);
          registerNode(osc);
          break;
        }
        case "elephant_trumpet": {
          // 16. Tiếng voi ré kèn vút cao (520Hz vút lên 1150Hz)
          duration = 1.1;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(520, t0);
          osc.frequency.linearRampToValueAtTime(1150, t0 + 0.4);
          osc.frequency.linearRampToValueAtTime(950, t0 + 1.0);
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.25, t0 + 0.08);
          gain.gain.setValueAtTime(0.22, t0 + 0.85);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 1.1);
          registerNode(osc);
          break;
        }
        case "bird_chirp": {
          // 17. Tiếng chim hót líu lo (3 nốt líu lo tần số cao 2600Hz - 3900Hz)
          duration = 1.0;
          [0, 0.25, 0.55].forEach((delay, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            const st = t0 + delay;
            const baseFreq = 2600 + idx * 300;
            osc.frequency.setValueAtTime(baseFreq, st);
            osc.frequency.linearRampToValueAtTime(baseFreq + 700, st + 0.08);
            osc.frequency.linearRampToValueAtTime(baseFreq - 200, st + 0.18);
            gain.gain.setValueAtTime(0, st);
            gain.gain.linearRampToValueAtTime(0.2, st + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, st + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(st);
            osc.stop(st + 0.22);
            registerNode(osc);
          });
          break;
        }
        default:
          return Promise.resolve();
      }
    } catch (err) {
      console.error("Lỗi phát âm thanh thực tế Web Audio:", err);
      this.isSpeakingRealSound = false;
      return Promise.resolve();
    }

    return new Promise(resolve => {
      setTimeout(() => {
        this.isSpeakingRealSound = false;
        resolve();
      }, duration * 1000);
    });
  },

  // Xử lý khi bấm nút nghe âm thanh thực tế ở mặt trước thẻ
  handleFrontSoundClick(wordId) {
    this.stopSpeechRecognition(true);
    AppState.stopAudio();
    this.isSpeaking = false;
    const btn = document.getElementById("btn-front-sound");
    if (btn) {
      btn.classList.add("scale-105", "ring-2", "ring-amber-300");
      setTimeout(() => btn.classList.remove("scale-105", "ring-2", "ring-amber-300"), 1200);
    }
    this.playRealSound(wordId);
  },

  // Lấy URL audio từ backend TTS kèm bộ nhớ đệm cache và pre-buffer vào RAM
  async fetchAudioUrl(text, lang) {
    if (!text) return null;
    const cacheKey = `${lang}_${text}`;
    if (this.ttsUrlCache && this.ttsUrlCache.has(cacheKey)) {
      return this.ttsUrlCache.get(cacheKey);
    }
    if (window.QuizScreen && window.QuizScreen.ttsUrlCache && window.QuizScreen.ttsUrlCache.has(cacheKey)) {
      const url = window.QuizScreen.ttsUrlCache.get(cacheKey);
      this.ttsUrlCache.set(cacheKey, url);
      return url;
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.url) {
        if (!this.ttsUrlCache) this.ttsUrlCache = new Map();
        this.ttsUrlCache.set(cacheKey, data.url);
        // Tải trước buffer âm thanh vào RAM trình duyệt Safari/WebKit
        const a = new Audio();
        a.preload = "auto";
        a.src = data.url;
        try { a.load(); } catch (e) {}
        return data.url;
      }
      return null;
    } catch (err) {
      console.error("Lỗi nạp trước câu khen LearnScreen:", err);
      return null;
    }
  },

  // Nạp trước toàn bộ các câu khen ngợi & câu nhắc đọc lại vào RAM (ttsUrlCache)
  preloadPraises() {
    this.ttsUrlCache = this.ttsUrlCache || new Map();
    const items = [];
    this.VI_PRAISES.forEach(text => items.push({ text, lang: "vi" }));
    this.EN_PRAISES.forEach(text => items.push({ text, lang: "en" }));
    this.VI_RETRY_PROMPTS.forEach(text => items.push({ text, lang: "vi" }));

    items.forEach((item, index) => {
      setTimeout(() => {
        const key = `${item.lang}_${item.text}`;
        if (!this.ttsUrlCache.has(key)) {
          this.fetchAudioUrl(item.text, item.lang);
        }
      }, 100 + index * 180);
    });
  },

  // Phát file audio từ cache RAM đảm bảo không bị đè và bắt đúng sự kiện kết thúc
  playPreloadedAudio(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve();
        return;
      }
      try {
        AppState.stopAudio();
        const player = AppState.audioPlayer;
        if (!player) {
          resolve();
          return;
        }

        player.ontimeupdate = null;
        AppState.currentAudioResolve = resolve;

        let finished = false;
        const onFinish = () => {
          if (finished) return;
          finished = true;
          player.ontimeupdate = null;
          player.onended = null;
          player.onerror = null;
          if (AppState.currentAudioResolve === resolve) {
            AppState.currentAudioResolve = null;
          }
          resolve();
        };

        player.onended = onFinish;
        player.onerror = onFinish;
        player.src = url;
        if (AppState.playbackRate) {
          player.playbackRate = AppState.playbackRate;
          player.defaultPlaybackRate = AppState.playbackRate;
        }
        player.play().catch(onFinish);
      } catch (e) {
        console.warn("Lỗi phát audio khen ngợi:", e);
        resolve();
      }
    });
  },

  getRandomPraise() {
    const list = this.VI_PRAISES.filter(p => p !== this.lastPraise);
    const selected = list[Math.floor(Math.random() * list.length)];
    this.lastPraise = selected;
    return selected;
  },

  getRandomEnPraise() {
    const list = this.EN_PRAISES.filter(p => p !== this.lastEnPraise);
    const selected = list[Math.floor(Math.random() * list.length)];
    this.lastEnPraise = selected;
    return selected;
  },

  getRandomRetryPrompt() {
    const list = this.VI_RETRY_PROMPTS.filter(p => p !== this.lastRetryPrompt);
    const selected = list[Math.floor(Math.random() * list.length)];
    this.lastRetryPrompt = selected;
    return selected;
  },

  // Phát âm báo trầm nhẹ 0ms bằng Web Audio API khi phát âm < 70% hoặc chưa nghe rõ (khác hẳn chuông Ting)
  playGentleTryAgainTone() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Nốt trầm dịu E4 (329.6 Hz) -> C4 (261.6 Hz) bằng sóng sine mềm mại
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(329.6, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.14, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.17);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(261.6, now + 0.14);
      gain2.gain.setValueAtTime(0.001, now + 0.14);
      gain2.gain.linearRampToValueAtTime(0.14, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn("Gentle tone error:", e);
    }
  },

  // Phản hồi 0ms khi phát âm < 70% hoặc no-speech: âm báo trầm nhẹ + câu nhắc nạp sẵn từ RAM ttsUrlCache
  async playRetryFeedback() {
    const learnScreenEl = document.getElementById("screen-learn");
    if (learnScreenEl && learnScreenEl.classList.contains("hidden")) return;

    this.isSpeakingRetryPrompt = true;
    const micBtn = document.getElementById("btn-speak-practice");
    if (micBtn) {
      micBtn.disabled = true;
      micBtn.classList.add("pointer-events-none", "opacity-75");
    }

    try {
      this.playGentleTryAgainTone();

      const promptText = this.getRandomRetryPrompt();
      const promptKey = `vi_${promptText}`;
      const cachedUrl = (this.ttsUrlCache && this.ttsUrlCache.get(promptKey)) || null;

      if (cachedUrl) {
        await new Promise(resolve => setTimeout(resolve, 180));
        if (this.isListening || this.isPronunciationPassed) return;

        const playPromise = this.playPreloadedAudio(cachedUrl);
        const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2500));
        await Promise.race([playPromise, timeoutPromise]);
      } else {
        await new Promise(resolve => setTimeout(resolve, 350));
      }
    } finally {
      this.isSpeakingRetryPrompt = false;
      const btnNow = document.getElementById("btn-speak-practice");
      if (btnNow) {
        btnNow.disabled = false;
        btnNow.classList.remove("pointer-events-none", "opacity-75");
      }
    }
  },

  // Pháo giấy Confetti mini bung tỏa tại nút hoặc thẻ
  triggerConfetti(anchorEl) {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const colors = ["#f59e0b", "#10b981", "#38bdf8", "#ec4899", "#8b5cf6", "#facc15"];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      const size = 6 + Math.random() * 8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      piece.className = "fixed rounded-sm pointer-events-none z-50";
      piece.style.width = `${size}px`;
      piece.style.height = `${size * (Math.random() > 0.5 ? 1 : 1.5)}px`;
      piece.style.backgroundColor = color;
      piece.style.left = `${rect.left + rect.width / 2}px`;
      piece.style.top = `${rect.top + rect.height / 2}px`;
      piece.style.transform = "translate(0, 0)";
      piece.style.transition = "transform 0.65s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.65s ease-out";
      document.body.appendChild(piece);

      const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
      const distance = 40 + Math.random() * 70;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 20;

      requestAnimationFrame(() => {
        piece.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`;
        piece.style.opacity = "0";
      });

      setTimeout(() => piece.remove(), 700);
    }
  },

  // Ngôi sao vàng bay vút từ thẻ lên thanh điểm số Header
  triggerFlyingStar(anchorEl) {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const targetEl = document.getElementById("star-count") || document.getElementById("btn-home");
    const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: 80, top: 20 };

    const star = document.createElement("div");
    star.className = "fixed text-3xl pointer-events-none z-50 filter drop-shadow-[0_4px_10px_rgba(250,204,21,0.8)]";
    star.textContent = "⭐";
    star.style.left = `${rect.left + rect.width / 2 - 16}px`;
    star.style.top = `${rect.top + rect.height / 2 - 16}px`;
    star.style.transition = "transform 0.75s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.75s ease-in, scale 0.75s ease-in";
    document.body.appendChild(star);

    const dx = (targetRect.left + 10) - (rect.left + rect.width / 2 - 16);
    const dy = (targetRect.top + 10) - (rect.top + rect.height / 2 - 16);

    requestAnimationFrame(() => {
      star.style.transform = `translate(${dx}px, ${dy}px) scale(0.6)`;
      star.style.opacity = "0.9";
    });

    setTimeout(() => {
      star.remove();
      if (targetEl) {
        targetEl.classList.remove("scale-125");
        void targetEl.offsetWidth;
        targetEl.classList.add("scale-125", "transition-transform");
        setTimeout(() => targetEl.classList.remove("scale-125"), 250);
      }
    }, 750);
  },

  // Chuẩn hóa chuỗi phục vụ so khớp phát âm
  normalizeSpeechText(text) {
    if (!text) return "";
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  },

  // Quy đổi ngữ âm gần đúng cho giọng trẻ em Việt 5 tuổi (nuốt âm cuối / phụ âm gần giống)
  phoneticNormalizeForChild(text) {
    if (!text) return "";
    return text
      .replace(/ph/g, "f")
      .replace(/ck/g, "k")
      .replace(/[cq]/g, "k")
      .replace(/tr/g, "ch")
      .replace(/ee|ea/g, "i")
      .replace(/oo/g, "u")
      .replace(/([a-z])\1+/g, "$1")
      .trim();
  },

  // Tính khoảng cách Levenshtein chuẩn hóa
  levenshteinDistance(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  },

  // Chấm điểm 1 câu nhận diện so với từ tiếng Anh mục tiêu (0 - 100%)
  scoreSingleTranscript(targetRaw, spokenRaw) {
    const target = this.normalizeSpeechText(targetRaw);
    const spoken = this.normalizeSpeechText(spokenRaw);
    if (!target || !spoken) return 0;

    // 1. Khớp trực tiếp hoặc nằm trọn vẹn trong câu bé nói (vd: "a red car")
    if (spoken === target) return 100;
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const targetRegex = new RegExp(`(^|\\s)${escapedTarget}(\\s|$)`);
    if (targetRegex.test(spoken)) return 100;

    // 2. So khớp bảng đồng âm trẻ Việt 5 tuổi
    const homophones = this.CHILD_HOMOPHONES[target] || [];
    if (homophones.includes(spoken)) return 85;
    const spokenWords = spoken.split(" ").filter(Boolean);
    for (const w of spokenWords) {
      if (w === target) return 100;
      if (homophones.includes(w)) return 85;
    }

    // Với từ ghép nhiều âm tiết (vd: "fire truck", "police car"), chấm trung bình từng từ thành phần
    const targetWords = target.split(" ").filter(Boolean);
    if (targetWords.length > 1 && spokenWords.length >= targetWords.length) {
      let sumWordScore = 0;
      for (let i = 0; i < targetWords.length; i++) {
        const tw = targetWords[i];
        let bestWordMatch = 0;
        for (const sw of spokenWords) {
          bestWordMatch = Math.max(bestWordMatch, this.scoreSingleTranscript(tw, sw));
        }
        sumWordScore += bestWordMatch;
      }
      const avgMultiWordScore = Math.round(sumWordScore / targetWords.length);
      if (avgMultiWordScore >= 70) return avgMultiWordScore;
    }

    // 3. Khoảng cách Levenshtein chuẩn hóa trên chuỗi gốc
    const maxLen = Math.max(target.length, spoken.length);
    const dist = this.levenshteinDistance(target, spoken);
    let bestScore = Math.max(0, Math.round((1 - dist / maxLen) * 100));

    // Trường hợp bé nói thêm từ đệm với từ đơn (vd: "it dog") -> chấm từng từ con
    if (targetWords.length === 1 && spokenWords.length > 1) {
      for (const sw of spokenWords) {
        const subDist = this.levenshteinDistance(target, sw);
        const subScore = Math.max(0, Math.round((1 - subDist / Math.max(target.length, sw.length)) * 100));
        bestScore = Math.max(bestScore, subScore);
      }
    }

    // 4. Khoảng cách Levenshtein trên dạng ngữ âm đơn giản hóa cho trẻ 5 tuổi
    const pTarget = this.phoneticNormalizeForChild(target);
    const pSpoken = this.phoneticNormalizeForChild(spoken);
    if (pTarget && pSpoken) {
      if (pTarget === pSpoken) {
        bestScore = Math.max(bestScore, 82);
      } else {
        const pDist = this.levenshteinDistance(pTarget, pSpoken);
        const pScore = Math.max(0, Math.round((1 - pDist / Math.max(pTarget.length, pSpoken.length)) * 90));
        bestScore = Math.max(bestScore, pScore);
      }
    }

    return Math.min(100, bestScore);
  },

  // So khớp toàn bộ Top-5 alternatives trả về điểm cao nhất
  evaluatePronunciation(targetWord, alternatives) {
    let bestScore = 0;
    let bestTranscript = "";
    if (!Array.isArray(alternatives) || alternatives.length === 0) {
      return { bestScore: 0, bestTranscript: "" };
    }
    alternatives.slice(0, 5).forEach(alt => {
      const score = this.scoreSingleTranscript(targetWord, alt);
      if (score > bestScore || (score === bestScore && !bestTranscript)) {
        bestScore = score;
        bestTranscript = alt;
      }
    });
    return { bestScore, bestTranscript };
  },

  // Khóa / mở khóa 5 nút điều hướng & xác nhận tùy theo ngưỡng >= 70% (kèm nút dự phòng cho bố mẹ)
  updateNavigationLockUI() {
    const isLocked = !this.isPronunciationPassed;
    const navIds = [
      "btn-confirm-correct",
      "btn-prev-word",
      "btn-next-word",
      "btn-learn-topics",
      "btn-home"
    ];
    const learnScreenEl = document.getElementById("screen-learn");
    const isLearnActive = !!(learnScreenEl && !learnScreenEl.classList.contains("hidden"));

    navIds.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const shouldLock = id === "btn-home" ? (isLocked && isLearnActive) : isLocked;
      btn.disabled = shouldLock;
      if (shouldLock) {
        btn.classList.add("opacity-40", "pointer-events-none", "cursor-not-allowed");
      } else {
        btn.classList.remove("opacity-40", "pointer-events-none", "cursor-not-allowed");
      }
      const lockBadge = btn.querySelector("[data-lock-badge]");
      if (lockBadge) {
        if (shouldLock) {
          lockBadge.classList.remove("hidden");
        } else {
          lockBadge.classList.add("hidden");
        }
      }
    });

    const parentUnlockBtn = document.getElementById("btn-parent-unlock");
    if (parentUnlockBtn) {
      if (!this.isPronunciationPassed && this.failCount >= 3) {
        parentUnlockBtn.classList.remove("hidden");
      } else {
        parentUnlockBtn.classList.add("hidden");
      }
    }
  },

  // Cập nhật giao diện nút Micro (sóng âm 5 cột nhảy múa) & thanh phản hồi chấm điểm
  updateSpeechUI() {
    const btn = document.getElementById("btn-speak-practice");
    const feedbackBox = document.getElementById("speech-feedback-box");

    if (btn) {
      if (this.isListening) {
        btn.className = "w-full sm:flex-1 py-3.5 sm:py-4 px-5 rounded-3xl bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-600 text-white font-black text-base sm:text-lg shadow-lg shadow-pink-300/60 border-2 border-white flex items-center justify-center gap-3 transition-all cursor-pointer ring-4 ring-pink-300/60";
        btn.innerHTML = `
          <span class="flex items-center gap-1 h-5" aria-hidden="true">
            <span class="speak-wave-bar" style="animation-delay: 0s"></span>
            <span class="speak-wave-bar" style="animation-delay: 0.15s"></span>
            <span class="speak-wave-bar" style="animation-delay: 0.3s"></span>
            <span class="speak-wave-bar" style="animation-delay: 0.15s"></span>
            <span class="speak-wave-bar" style="animation-delay: 0s"></span>
          </span>
          <span>Đậu nói đi, cô đang nghe...</span>
        `;
      } else if (this.isPronunciationPassed) {
        btn.className = "w-full sm:flex-1 py-3.5 sm:py-4 px-5 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-95 text-white font-black text-base sm:text-lg shadow-lg shadow-emerald-200/60 border-2 border-white flex items-center justify-center gap-2 transition-all cursor-pointer";
        btn.innerHTML = `<span class="text-xl sm:text-2xl" aria-hidden="true">🎙️</span><span>Đậu nói lại lần nữa</span>`;
      } else {
        const label = this.failCount > 0 ? "Đậu đọc lại nào!" : "Đậu nói thử nào!";
        btn.className = "w-full sm:flex-1 py-3.5 sm:py-4 px-5 rounded-3xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 active:scale-95 text-white font-black text-base sm:text-lg shadow-lg shadow-pink-300/50 border-2 border-white flex items-center justify-center gap-2 transition-all cursor-pointer";
        btn.innerHTML = `<span class="text-xl sm:text-2xl" aria-hidden="true">🎙️</span><span>${label}</span>`;
      }
    }

    if (!feedbackBox) return;
    const state = this.speechFeedbackState;
    if (!state) {
      feedbackBox.className = "mt-2 w-full max-w-xl mx-auto text-center text-xs sm:text-sm font-bold text-slate-500";
      feedbackBox.innerHTML = `<span>🔒 Đậu hãy chạm <strong>"🎙️ Đậu nói thử nào!"</strong> và đọc đạt từ <strong>70%</strong> để mở khóa nút đi tiếp nhé!</span>`;
      return;
    }

    if (state.type === "listening") {
      feedbackBox.className = "mt-2 w-full max-w-xl mx-auto px-4 py-2 rounded-2xl bg-pink-50 border border-pink-200 text-pink-800 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 animate-pulse";
      const interimText = state.interim ? ` (Cô nghe: "${state.interim}")` : "";
      feedbackBox.innerHTML = `<span>🎤 Cô đang lắng nghe Đậu phát âm...${interimText}</span>`;
    } else if (state.type === "success") {
      feedbackBox.className = "mt-2 w-full max-w-xl mx-auto px-4 py-2 rounded-2xl bg-emerald-100 border-2 border-emerald-400 text-emerald-900 text-sm sm:text-base font-black flex items-center justify-center gap-2 shadow-sm";
      feedbackBox.innerHTML = `<span>🎉 Chuẩn ${state.score}% — Giỏi quá Đậu ơi!</span>`;
    } else if (state.type === "parent_unlocked") {
      feedbackBox.className = "mt-2 w-full max-w-xl mx-auto px-4 py-2 rounded-2xl bg-sky-100 border border-sky-300 text-sky-900 text-xs sm:text-sm font-black flex items-center justify-center gap-2";
      feedbackBox.innerHTML = `<span>🔑 Bố mẹ đã xác nhận mở khóa giúp Đậu! Bé bấm tiếp để học nhé.</span>`;
    } else if (state.type === "permission_denied") {
      feedbackBox.className = "mt-2 w-full max-w-xl mx-auto px-4 py-2 rounded-2xl bg-amber-100 border border-amber-300 text-amber-900 text-xs sm:text-sm font-bold";
      feedbackBox.innerHTML = `<span>🎙️ Trình duyệt chưa được cấp quyền Micro — Bố mẹ hãy cấp quyền hoặc dùng nút mở khóa bên dưới giúp Đậu nhé!</span>`;
    } else if (state.type === "unsupported") {
      feedbackBox.className = "mt-2 w-full max-w-xl mx-auto px-4 py-2 rounded-2xl bg-amber-100 border border-amber-300 text-amber-900 text-xs sm:text-sm font-bold";
      feedbackBox.innerHTML = `<span>📱 Thiết bị/trình duyệt chưa hỗ trợ nhận diện giọng nói — Bố mẹ dùng nút mở khóa bên dưới giúp Đậu nhé!</span>`;
    } else if (state.type === "retry") {
      const score = typeof state.score === "number" ? state.score : 0;
      feedbackBox.className = "mt-2 w-full max-w-xl mx-auto px-4 py-2 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs sm:text-sm font-extrabold flex flex-col items-center gap-1.5 shadow-sm";
      feedbackBox.innerHTML = `
        <span>🔄 Mới đạt ${score}% (cần 70%) — Đậu đọc lại to và rõ hơn nhé!</span>
        <div class="w-48 sm:w-64 h-2 bg-amber-200/80 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300" style="width: ${Math.max(4, score)}%"></div>
        </div>
      `;
    }
  },

  // Dừng phiên nhận diện giọng nói đang hoạt động một cách an toàn và vô hiệu hóa callback trễ
  stopSpeechRecognition(silent = false) {
    if (window.AppState) {
      AppState.speechSessionId = (AppState.speechSessionId || 0) + 1;
    }
    if (this.speechTimeoutTimer) {
      clearTimeout(this.speechTimeoutTimer);
      this.speechTimeoutTimer = null;
    }
    const rec = this.speechRecognition;
    this.speechRecognition = null;
    this.isListening = false;
    if (rec) {
      if (typeof rec._markManualStop === "function") {
        rec._markManualStop();
      }
      try {
        rec.abort();
      } catch (e) {
        try { rec.stop(); } catch (err) {}
      }
    }
    if (!silent) {
      if (this.speechFeedbackState && this.speechFeedbackState.type === "listening") {
        this.speechFeedbackState = null;
      }
      this.updateSpeechUI();
      if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
        AppState.restoreAfterSpeechRecognition();
      }
    }
  },

  // Xử lý khi bé chạm nút Micro "🎙️ Đậu nói thử nào!" — chạy đồng bộ 0ms giữ trọn User Gesture
  toggleSpeechPractice() {
    if (this.isListening) {
      this.stopSpeechRecognition(false);
      return;
    }

    const word = this.words[this.currentIndex];
    if (!word || this.isAdvancing || this.isSpeakingRetryPrompt) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      this.failCount = Math.max(this.failCount, 3);
      this.speechFeedbackState = { type: "unsupported" };
      this.updateNavigationLockUI();
      this.updateSpeechUI();
      return;
    }

    // Dọn dẹp phiên cũ và giải phóng Audio Session đồng bộ 0ms ngay trong User Gesture (không await)
    this.stopSpeechRecognition(true);
    const sessionId = (window.AppState && typeof AppState.prepareForSpeechRecognition === "function")
      ? AppState.prepareForSpeechRecognition()
      : Date.now();
    const isStaleSession = () => !!(window.AppState && sessionId !== AppState.speechSessionId);

    this.isListening = true;
    this.speechFeedbackState = { type: "listening", interim: "" };
    this.updateSpeechUI();

    let hasHandledResult = false;
    let hasHandledError = false;
    let isManualStop = false;
    let latestInterimAlts = [];

    try {
      const recognition = new SpeechRec();
      recognition.lang = "en-US";
      recognition.maxAlternatives = 5;
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition._markManualStop = () => {
        isManualStop = true;
      };
      this.speechRecognition = recognition;

      // Timeout 8 giây chống kẹt trạng thái đang nghe trên Safari iPadOS
      this.speechTimeoutTimer = setTimeout(() => {
        if (!isStaleSession() && this.speechRecognition === recognition) {
          try { recognition.stop(); } catch (e) {}
        }
      }, 8000);

      recognition.onresult = async (event) => {
        if (isStaleSession() || this.speechRecognition !== recognition || hasHandledResult) return;

        const results = event.results;
        if (!results || results.length === 0) return;

        const lastResult = results[results.length - 1];
        const alts = [];
        for (let i = 0; i < lastResult.length && i < 5; i++) {
          if (lastResult[i] && lastResult[i].transcript) {
            alts.push(lastResult[i].transcript);
          }
        }

        if (lastResult.isFinal) {
          hasHandledResult = true;
          if (this.speechTimeoutTimer) {
            clearTimeout(this.speechTimeoutTimer);
            this.speechTimeoutTimer = null;
          }
          this.isListening = false;
          this.speechRecognition = null;
          try { recognition.stop(); } catch (e) {}
          if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
            await AppState.restoreAfterSpeechRecognition(sessionId);
          }
          if (isStaleSession()) return;
          this.handleSpeechEvaluationResult(alts);
        } else if (alts.length > 0) {
          latestInterimAlts = alts;
          this.speechFeedbackState = { type: "listening", interim: alts[0] };
          this.updateSpeechUI();
        }
      };

      recognition.onerror = async (event) => {
        if (isStaleSession() || hasHandledResult || hasHandledError || isManualStop) return;
        hasHandledError = true;
        if (this.speechTimeoutTimer) {
          clearTimeout(this.speechTimeoutTimer);
          this.speechTimeoutTimer = null;
        }
        this.isListening = false;
        if (this.speechRecognition === recognition) {
          this.speechRecognition = null;
        }

        if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
          await AppState.restoreAfterSpeechRecognition(sessionId);
        }
        if (isStaleSession()) return;

        const errCode = event && event.error ? event.error : "unknown";
        let shouldPlayRetryTone = false;
        if (errCode === "not-allowed" || errCode === "service-not-allowed") {
          this.failCount = Math.max(this.failCount, 3);
          this.speechFeedbackState = { type: "permission_denied" };
        } else if (latestInterimAlts.length > 0 && errCode !== "aborted") {
          hasHandledResult = true;
          this.handleSpeechEvaluationResult(latestInterimAlts);
          return;
        } else {
          this.failCount += 1;
          this.speechFeedbackState = { type: "retry", score: 0, text: "" };
          shouldPlayRetryTone = true;
        }

        this.updateNavigationLockUI();
        this.updateSpeechUI();
        if (shouldPlayRetryTone) {
          this.playRetryFeedback();
        }
      };

      recognition.onend = async () => {
        if (isStaleSession()) return;
        if (this.speechTimeoutTimer) {
          clearTimeout(this.speechTimeoutTimer);
          this.speechTimeoutTimer = null;
        }
        if (this.speechRecognition === recognition) {
          this.speechRecognition = null;
        }
        this.isListening = false;

        if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
          await AppState.restoreAfterSpeechRecognition(sessionId);
        }
        if (isStaleSession()) return;

        if (!hasHandledResult && !hasHandledError) {
          if (latestInterimAlts.length > 0 && !isManualStop) {
            hasHandledResult = true;
            this.handleSpeechEvaluationResult(latestInterimAlts);
            return;
          }
          let shouldPlayRetryTone = false;
          if (!isManualStop) {
            this.failCount += 1;
            this.speechFeedbackState = { type: "retry", score: 0, text: "" };
            shouldPlayRetryTone = true;
          } else if (this.speechFeedbackState && this.speechFeedbackState.type === "listening") {
            this.speechFeedbackState = null;
          }
          this.updateNavigationLockUI();
          this.updateSpeechUI();
          if (shouldPlayRetryTone) {
            this.playRetryFeedback();
          }
        }
      };

      // Gọi start() ngay trong cùng call-stack đồng bộ của thao tác chạm tay
      recognition.start();
    } catch (err) {
      console.warn("Lỗi khởi động nhận diện giọng nói:", err);
      if (this.speechTimeoutTimer) {
        clearTimeout(this.speechTimeoutTimer);
        this.speechTimeoutTimer = null;
      }
      this.isListening = false;
      this.speechRecognition = null;
      if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
        AppState.restoreAfterSpeechRecognition(sessionId);
      }
      if (!isStaleSession()) {
        this.failCount += 1;
        this.speechFeedbackState = { type: "retry", score: 0, text: "" };
        this.updateNavigationLockUI();
        this.updateSpeechUI();
        this.playRetryFeedback();
      }
    }
  },

  // Phân nhánh kết quả chấm điểm phát âm (>= 70% vs < 70%)
  handleSpeechEvaluationResult(alternatives) {
    const word = this.words[this.currentIndex];
    if (!word) return;

    const { bestScore, bestTranscript } = this.evaluatePronunciation(word.en, alternatives);

    if (bestScore >= 70) {
      const shouldAutoConfirm = !this.isPronunciationPassed && !this.isConfirmingFromSpeech;
      this.isPronunciationPassed = true;
      this.speechFeedbackState = { type: "success", score: bestScore, text: bestTranscript };
      this.updateNavigationLockUI();
      this.updateSpeechUI();

      if (shouldAutoConfirm) {
        this.isConfirmingFromSpeech = true;
        setTimeout(() => {
          const learnScreenEl = document.getElementById("screen-learn");
          if (this.isPronunciationPassed && (!learnScreenEl || !learnScreenEl.classList.contains("hidden"))) {
            this.confirmCorrect(true);
          }
        }, 250);
      }
    } else {
      this.failCount += 1;
      this.speechFeedbackState = { type: "retry", score: bestScore, text: bestTranscript };
      this.updateNavigationLockUI();
      this.updateSpeechUI();
      this.playRetryFeedback();
    }
  },

  // Nút dự phòng cho bố mẹ mở khóa thủ công khi failCount >= 3 hoặc môi trường ồn
  unlockByParent() {
    this.stopSpeechRecognition(true);
    this.isSpeakingRetryPrompt = false;
    this.isPronunciationPassed = true;
    this.speechFeedbackState = { type: "parent_unlocked" };
    this.updateNavigationLockUI();
    this.updateSpeechUI();
    this.preloadAdjacentRealSounds();
  },

  // Bắt đầu màn hình học
  start() {
    if (!AppState.currentTopic || !AppState.currentTopic.words || AppState.currentTopic.words.length === 0) {
      if (AppState.topics && AppState.topics.length > 0) {
        AppState.currentTopic = AppState.topics[0];
      } else {
        return;
      }
    }
    // Xáo trộn Fisher-Yates bản sao danh sách từ mỗi lần mở chủ đề
    const shuffledWords = [...AppState.currentTopic.words];
    for (let i = shuffledWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
    }
    this.words = shuffledWords;
    this.currentIndex = 0;
    this.isSpeaking = false;
    this.isFlipped = false;
    this.isFlipping = false;
    this.isAdvancing = false;
    this.isPronunciationPassed = false;
    this.failCount = 0;
    this.speechFeedbackState = null;
    this.isConfirmingFromSpeech = false;
    this.isSpeakingRetryPrompt = false;
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
    this.playSequence = 0;
    this.stopSpeechRecognition(true);
    AppState.stopAudio();
    this.stopRealSound();
    this.getAudioContext();
    this.preloadPraises();

    if (!this.audioListenerAttached) {
      AppState.addAudioListener((isLoading, isPlaying) => {
        this.updateAudioUI(isLoading, isPlaying);
      });
      this.audioListenerAttached = true;
    }

    this.render();
  },

  // Cập nhật trạng thái loading và đang phát âm thanh trên nút Hero
  updateAudioUI(isLoading, isPlaying) {
    const heroBtn = document.getElementById("btn-hero-speak");
    const heroIcon = document.getElementById("hero-speak-icon");
    const heroText = document.getElementById("hero-speak-text");

    if (heroBtn && heroIcon && heroText) {
      if (isLoading || isPlaying) {
        heroBtn.classList.add("pointer-events-none", "opacity-85");
        heroIcon.classList.add("audio-playing-pulse");
        heroText.textContent = isLoading ? "Cô đang chuẩn bị đọc..." : "Cô đang đọc cho Đậu nghe...";
      } else {
        heroBtn.classList.remove("pointer-events-none", "opacity-85");
        heroIcon.classList.remove("audio-playing-pulse");
        heroText.textContent = this.isFlipped ? "Nghe lại cô đọc" : "Chạm để nghe cô đọc";
      }
    }
  },

  // Đếm số từ đã học trong chủ đề hiện tại
  getLearnedCount() {
    if (!AppState.currentTopic) return 0;
    const key = `dau_learned_${AppState.currentTopic.id}`;
    try {
      const data = localStorage.getItem(key);
      if (data) return JSON.parse(data).length;
    } catch {}
    return 0;
  },

  // Hiển thị giao diện màn hình học
  render() {
    const container = document.getElementById("screen-learn");
    if (!container) return;

    const word = this.words[this.currentIndex];
    const total = this.words.length;
    const topic = AppState.currentTopic;
    const learnedCount = this.getLearnedCount();

    container.innerHTML = `
      <style>
        .flashcard-3d-wrap {
          perspective: 1000px;
          -webkit-perspective: 1000px;
        }
        .flashcard-3d-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          -webkit-transform-style: preserve-3d;
          transition: transform 0.55s cubic-bezier(0.34, 1.25, 0.64, 1);
        }
        .flashcard-3d-inner.is-flipped {
          transform: rotateY(180deg);
          -webkit-transform: rotateY(180deg);
        }
        .flashcard-face {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          border-radius: 2.5rem;
        }
        .flashcard-front {
          transform: rotateY(0deg);
          -webkit-transform: rotateY(0deg);
          z-index: 2;
        }
        .flashcard-back {
          transform: rotateY(180deg);
          -webkit-transform: rotateY(180deg);
          z-index: 1;
        }
        @keyframes speakWaveBar {
          0%, 100% { transform: scaleY(0.35); opacity: 0.7; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        .speak-wave-bar {
          width: 4px;
          height: 20px;
          border-radius: 9999px;
          background-color: #ffffff;
          transform-origin: center;
          animation: speakWaveBar 0.75s ease-in-out infinite;
        }
      </style>

      <div class="w-full min-h-full flex flex-col justify-between max-w-4xl mx-auto py-1 sm:py-2 relative">
        
        <!-- BANNER PHẢN HỒI KHEN NGỢI LIỀN MẠCH -->
        <div id="learn-feedback-banner" class="hidden absolute top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all"></div>

        <!-- 1. THANH ĐIỀU HƯỚNG PHỤ & TIẾN ĐỘ CHỦ ĐỀ -->
        <div class="flex items-center justify-between w-full px-2 gap-2 shrink-0">
          <button id="btn-learn-topics" onclick="AppState.showScreen('screen-home')" aria-label="Quay lại danh sách chủ đề" class="px-3 sm:px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span aria-hidden="true">⬅️</span>
            <span>Chủ đề</span>
            <span data-lock-badge class="hidden text-xs" aria-hidden="true">🔒</span>
          </button>

          <!-- Tiến độ từ vựng trong chủ đề -->
          <div class="flex flex-col items-center flex-1 max-w-xs mx-auto">
            <div class="flex items-center gap-1.5 text-xs sm:text-sm font-black text-amber-900 truncate">
              <span aria-hidden="true">${topic.icon}</span>
              <span class="truncate">${topic.title}</span>
              <span class="text-amber-600 font-extrabold">• Từ ${this.currentIndex + 1}/${total}</span>
            </div>
            <!-- Thanh progress bar nhỏ gọn -->
            <div class="w-full bg-slate-200/80 rounded-full h-2 sm:h-2.5 mt-1 overflow-hidden p-0.5 border border-slate-300/40">
              <div class="bg-gradient-to-r from-amber-400 to-yellow-400 h-full rounded-full transition-all duration-300 shadow-sm" style="width: ${((this.currentIndex + 1) / total) * 100}%"></div>
            </div>
          </div>

          <!-- Huy hiệu từ đã thuộc -->
          <div class="px-2.5 sm:px-3 py-1.5 rounded-2xl bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200 flex items-center gap-1 shrink-0" title="Đã học ${learnedCount} trên tổng số ${total} từ">
            <span aria-hidden="true">✅</span>
            <span id="learn-learned-count">${learnedCount}/${total}</span>
          </div>
        </div>

        <!-- 2. THẺ FLASHCARD 3D TƯƠNG TÁC (3D FLIP CARD) -->
        <div class="flex-1 flex flex-col items-center justify-center my-0.5 sm:my-1 w-full px-2">
          <div id="flashcard-wrap" class="flashcard-3d-wrap w-full max-w-xs sm:max-w-md h-[285px] sm:h-[325px] md:h-[340px] mx-auto cursor-pointer select-none">
            <div id="flashcard-inner" class="flashcard-3d-inner ${this.isFlipped ? 'is-flipped' : ''}" onclick="LearnScreen.toggleFlip()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();LearnScreen.toggleFlip();}" aria-label="Thẻ học từ vựng ${word.en}">
              
              <!-- MẶT TRƯỚC (ĐOÁN HÌNH - BẬT PHẢN XẠ NHỚ TỪ) -->
              <div class="flashcard-face flashcard-front bg-white rounded-[2.25rem] p-3 sm:p-4 shadow-xl border-4 border-amber-200 hover:border-amber-300 flex flex-col items-center justify-between text-center transition-all duration-300 hover:scale-[1.01] active:scale-95">
                <!-- Tiêu đề gợi mở mặt trước -->
                <div class="w-full flex items-center justify-between px-2">
                  <span class="px-3 py-1 rounded-full bg-amber-100 text-amber-900 font-black text-xs flex items-center gap-1">
                    <span>❓</span>
                    <span>Đậu đoán xem gì nào?</span>
                  </span>
                  <span class="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center text-sm shadow-inner" title="Chạm để lật">🔄</span>
                </div>

                <!-- Khung hình ảnh thật cỡ lớn sắc nét -->
                ${word.image_url ? `
                  <div class="w-36 h-36 sm:w-44 sm:h-44 my-auto rounded-3xl overflow-hidden shadow-inner border border-slate-100 bg-slate-50/50 p-1.5 flex items-center justify-center relative">
                    <img src="${word.image_url}" alt="${word.en}" class="w-full h-full object-contain rounded-2xl transition-transform duration-300 hover:scale-105" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div style="display:none;" class="w-full h-full items-center justify-center text-6xl sm:text-7xl filter drop-shadow-md" aria-hidden="true">
                      ${word.visual}
                    </div>
                  </div>
                ` : `
                  <div class="w-36 h-36 sm:w-44 sm:h-44 my-auto flex items-center justify-center text-6xl sm:text-7xl filter drop-shadow-md hover:scale-110 transition-transform" aria-hidden="true">
                    ${word.visual}
                  </div>
                `}

                <!-- Nút nghe âm thanh thực tế nếu từ có hiệu ứng -->
                ${this.hasRealSound(word.id) ? `
                  <button id="btn-front-sound" onclick="event.stopPropagation(); LearnScreen.handleFrontSoundClick('${word.id}')" class="my-0.5 py-1 px-3.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/60 z-10" aria-label="Nghe âm thanh thực tế">
                    <span>🔊</span>
                    <span>${["vehicles", "transport"].includes(AppState.currentTopic?.id) ? "Nghe còi / động cơ xe" : "Nghe tiếng kêu bạn ấy"}</span>
                  </button>
                ` : ''}

                <!-- Nhãn gợi ý chạm tay lật thẻ & nghe đọc -->
                <div class="py-1 px-3.5 rounded-full bg-amber-50 text-amber-800 font-black text-xs border border-amber-200/80 shadow-sm animate-pulse flex items-center gap-1.5">
                  <span>👆</span>
                  <span>Chạm vào hình để xem từ & nghe cô đọc!</span>
                </div>
              </div>

              <!-- MẶT SAU (TỪ VỰNG TIẾNG ANH & NGHĨA TIẾNG VIỆT) -->
              <div class="flashcard-face flashcard-back bg-gradient-to-b from-amber-50/70 via-white to-amber-50/40 rounded-[2.25rem] p-3 sm:p-4 shadow-2xl border-4 border-amber-300 flex flex-col items-center justify-between text-center transition-all duration-300 hover:scale-[1.01] active:scale-95">
                <!-- Tiêu đề mặt sau -->
                <div class="w-full flex items-center justify-between px-2">
                  <span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-black text-xs flex items-center gap-1">
                    <span>✨</span>
                    <span>Kết quả</span>
                  </span>
                  <!-- Nút loa nghe lại ở mặt sau -->
                  <button onclick="event.stopPropagation(); LearnScreen.playPrompt()" aria-label="Nghe cô đọc lại" class="w-9 h-9 rounded-xl bg-amber-200 hover:bg-amber-300 text-amber-900 flex items-center justify-center text-lg shadow-sm active:scale-90 transition-all cursor-pointer">
                    🔊
                  </button>
                </div>

                <!-- Hình ảnh thu gọn -->
                ${word.image_url ? `
                  <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shadow-sm border border-amber-100 bg-white p-1 flex items-center justify-center relative mt-0.5">
                    <img src="${word.image_url}" alt="${word.en}" class="w-full h-full object-contain rounded-xl" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div style="display:none;" class="w-full h-full items-center justify-center text-5xl filter drop-shadow-sm" aria-hidden="true">
                      ${word.visual}
                    </div>
                  </div>
                ` : `
                  <div class="w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center text-5xl filter drop-shadow-sm mt-0.5" aria-hidden="true">
                    ${word.visual}
                  </div>
                `}

                <!-- Từ tiếng Anh in đậm sắc nét cỡ lớn -->
                <div class="my-auto flex flex-col items-center">
                  <h2 class="text-2xl sm:text-4xl font-black text-slate-800 tracking-tight capitalize">
                    ${word.en}
                  </h2>
                  <p class="text-base sm:text-xl font-black text-amber-700 mt-0.5">
                    ${word.vi}
                  </p>
                </div>

                <!-- Lời nhắc chạm để lật lại -->
                <div class="text-xs font-bold text-slate-400">
                  👆 Chạm thẻ để lật lại ảnh
                </div>
              </div>

            </div>
          </div>

          <!-- NÚT HÀNH ĐỘNG CHÍNH (HERO ACTION): NGHE CÔ ĐỌC & GÓC BÉ TẬP NÓI -->
          <div class="w-full flex flex-col items-center mt-2 sm:mt-2.5 px-1">
            <div class="w-full max-w-2xl flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
              <button id="btn-hero-speak" onclick="LearnScreen.handleHeroSpeak()" aria-label="Chạm để nghe cô đọc từ ${word.en}" class="w-full sm:flex-1 py-3 sm:py-3.5 px-5 rounded-3xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-base sm:text-lg shadow-lg shadow-amber-300/50 border-2 border-white flex items-center justify-center gap-2.5 transition-all cursor-pointer">
                <span id="hero-speak-icon" class="text-xl sm:text-2xl" aria-hidden="true">🔊</span>
                <span id="hero-speak-text">${this.isFlipped ? "Nghe lại cô đọc" : "Chạm để nghe cô đọc"}</span>
              </button>

              <button id="btn-speak-practice" onclick="LearnScreen.toggleSpeechPractice()" aria-label="Chạm để Đậu nói thử và chấm điểm phát âm" class="w-full sm:flex-1 py-3 sm:py-3.5 px-5 rounded-3xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 active:scale-95 text-white font-black text-base sm:text-lg shadow-lg shadow-pink-300/50 border-2 border-white flex items-center justify-center gap-2 transition-all cursor-pointer">
                <span class="text-xl sm:text-2xl" aria-hidden="true">🎙️</span>
                <span>Đậu nói thử nào!</span>
              </button>
            </div>

            <!-- Thanh phản hồi sóng âm & chấm điểm phát âm -->
            <div id="speech-feedback-box" class="mt-1.5 w-full max-w-xl mx-auto text-center text-xs sm:text-sm font-bold text-slate-500"></div>
          </div>
        </div>

        <!-- 3. KHU VỰC ĐIỀU KHIỂN DƯỚI ĐÁY: PHỤ HUYNH XÁC NHẬN & CHUYỂN TỪ -->
        <div class="flex flex-col items-center gap-1.5 pb-2 w-full shrink-0">
          <!-- Nút phụ huynh xác nhận bé đã đọc chuẩn để thưởng sao -->
          <button id="btn-confirm-correct" onclick="LearnScreen.confirmCorrect()" aria-label="Bố mẹ xác nhận bé đọc chuẩn để thưởng sao" class="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm sm:text-base shadow-md shadow-emerald-200/50 flex items-center gap-2 border-2 border-white transition-all cursor-pointer">
            <span aria-hidden="true">✅</span>
            <span>Đậu đọc chuẩn rồi (+1 ⭐)</span>
            <span data-lock-badge class="hidden text-xs" aria-hidden="true">🔒</span>
          </button>

          <!-- Bộ nút chuyển từ trước / từ sau -->
          <div class="flex items-center justify-center gap-3 sm:gap-4">
            <button id="btn-prev-word" onclick="LearnScreen.prevWord()" aria-label="Xem từ trước" class="px-4 sm:px-5 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm sm:text-base shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
              <span aria-hidden="true">⬅️</span>
              <span>Từ trước</span>
              <span data-lock-badge class="hidden text-xs" aria-hidden="true">🔒</span>
            </button>

            <button id="btn-next-word" onclick="LearnScreen.nextWord()" aria-label="Sang từ tiếp theo" class="px-4 sm:px-5 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm sm:text-base shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
              <span>Từ sau</span>
              <span aria-hidden="true">➡️</span>
              <span data-lock-badge class="hidden text-xs" aria-hidden="true">🔒</span>
            </button>
          </div>

          <!-- Nút dự phòng dành cho bố mẹ khi failCount >= 3 hoặc thiết bị không có micro -->
          <button id="btn-parent-unlock" onclick="LearnScreen.unlockByParent()" aria-label="Bố mẹ xác nhận mở khóa giúp Đậu" class="hidden mt-1 px-4 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-900 font-bold text-xs shadow-sm border border-amber-300 flex items-center gap-1.5 transition-all cursor-pointer">
            <span aria-hidden="true">🔑</span>
            <span>Bố mẹ xác nhận giúp Đậu</span>
          </button>
        </div>

      </div>
    `;

    this.updateNavigationLockUI();
    this.updateSpeechUI();
    this.preloadAdjacentRealSounds();
  },

  // Lật thẻ 3D qua lại (khóa chống chạm đúp trong 500ms)
  toggleFlip(forceState) {
    if (this.isFlipping) return;
    const inner = document.getElementById("flashcard-inner");
    if (!inner) return;

    this.isFlipping = true;
    setTimeout(() => {
      this.isFlipping = false;
    }, 500);

    if (typeof forceState === "boolean") {
      this.isFlipped = forceState;
    } else {
      this.isFlipped = !this.isFlipped;
    }

    if (this.isFlipped) {
      inner.classList.add("is-flipped");
      // Tự động phát âm thanh khi lật sang mặt sau
      this.playPrompt();
    } else {
      inner.classList.remove("is-flipped");
    }

    const heroText = document.getElementById("hero-speak-text");
    if (heroText && !this.isSpeaking) {
      heroText.textContent = this.isFlipped ? "Nghe lại cô đọc" : "Chạm để nghe cô đọc";
    }
  },

  // Chạm vào nút Hero Speak
  handleHeroSpeak() {
    if (!this.isFlipped) {
      this.toggleFlip(true);
    } else {
      this.playPrompt();
    }
  },

  // Phát từ tiếng Anh và câu nhắc của cô
  async playPrompt() {
    this.stopSpeechRecognition(true);
    if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
      await AppState.restoreAfterSpeechRecognition();
    }

    const currentSeq = ++this.playSequence;
    this.isSpeaking = true;
    AppState.stopAudio();
    this.stopRealSound();

    const word = this.words[this.currentIndex];
    if (!word) return;

    try {
      // Bước A: Nếu từ vựng có âm thanh thực tế -> phát trước 1.0 - 1.2s
      if (this.hasRealSound(word.id)) {
        await this.playRealSound(word.id);
        if (this.playSequence !== currentSeq) return;
        // Khoảng nghỉ ngắn 150ms để âm thanh thực tế lắng xuống
        await new Promise(r => setTimeout(r, 150));
        if (this.playSequence !== currentSeq) return;
      }

      // Bước B: Phát âm từ tiếng Anh (ví dụ: "Dog")
      await AppState.speakText(word.en, "en");
      if (this.playSequence !== currentSeq) return;

      // Bước C: Ngay khi tiếng Anh vừa kết thúc, phát tiếp câu tiếng Việt: "Đậu đọc lại theo cô nào!"
      await AppState.speakText("Đậu đọc lại theo cô nào!", "vi");
    } finally {
      if (this.playSequence === currentSeq) {
        this.isSpeaking = false;
      }
    }
  },

  // Xử lý khi ba mẹ bấm nút Xác nhận bé đọc chuẩn (Mạch học liền mạch, nghe trọn vẹn lời cô)
  async confirmCorrect(fromSpeech = false) {
    if ((!this.isPronunciationPassed && !fromSpeech) || this.isAdvancing) return;
    const word = this.words[this.currentIndex];
    if (!word) return;

    const activeWordIndex = this.currentIndex;
    this.isAdvancing = true;
    this.stopSpeechRecognition(true);
    if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
      await AppState.restoreAfterSpeechRecognition();
    }

    // Khóa tạm nút tích xanh & làm mờ nhẹ chống bấm đè
    const btnConfirm = document.getElementById("btn-confirm-correct");
    if (btnConfirm) {
      btnConfirm.classList.add("pointer-events-none", "opacity-75");
    }

    // Ngắt âm thanh đang đọc từ dở nếu có
    AppState.stopAudio();
    this.stopRealSound();
    this.isSpeaking = false;

    // 1. Cộng sao & lưu tiến trình từ đã học
    AppState.addStars(1);
    this.saveWordLearned(word.id);

    // Cập nhật ngay số từ đã học trên huy hiệu top bar
    const countEl = document.getElementById("learn-learned-count");
    if (countEl) {
      countEl.textContent = `${this.getLearnedCount()}/${this.words.length}`;
    }

    // 2. Âm thanh "Ting!" pha lê tức thì 0ms bằng Web Audio API
    this.playVictoryChime();

    // 3. Hiệu ứng pháo giấy Confetti mini & ngôi sao vàng bay lên thanh điểm số
    const anchorEl = btnConfirm || document.getElementById("flashcard-wrap");
    this.triggerConfetti(anchorEl);
    this.triggerFlyingStar(anchorEl);

    // 4. Chọn câu khen và hiển thị banner khen ngợi
    const isBilingual = AppState.voiceMode === "bilingual";
    const praise = isBilingual ? this.getRandomPraise() : this.getRandomEnPraise();

    const feedbackBanner = document.getElementById("learn-feedback-banner");
    if (feedbackBanner) {
      feedbackBanner.innerHTML = `
        <div class="px-5 py-2 rounded-full bg-emerald-500 text-white font-black text-sm sm:text-base shadow-xl border-2 border-white animate-bounce flex items-center gap-2">
          <span>🎉</span>
          <span>${praise} (+1 ⭐)</span>
        </div>
      `;
      feedbackBanner.classList.remove("hidden");
    }

    // 5. Phát giọng cô khen ngợi từ cache RAM (0ms)
    const praiseKey = `${isBilingual ? "vi" : "en"}_${praise}`;
    const cachedUrl = (this.ttsUrlCache && this.ttsUrlCache.get(praiseKey)) ||
                      (window.QuizScreen && window.QuizScreen.ttsUrlCache && window.QuizScreen.ttsUrlCache.get(praiseKey));

    const playPromise = cachedUrl
      ? this.playPreloadedAudio(cachedUrl)
      : AppState.speakText(praise, isBilingual ? "vi" : "en");

    // Timeout dự phòng an toàn tối đa 2.2s nếu audio bị nghẽn mạng
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2200));

    // Đợi giọng khen phát xong (hoặc tối đa 2.2s)
    await Promise.race([playPromise, timeoutPromise]);

    // Thêm khoảng nghỉ ngắn 300ms sau khi cô khen xong rồi chuyển mượt sang từ tiếp theo
    await new Promise(resolve => setTimeout(resolve, 300));

    this.isAdvancing = false;
    this.isConfirmingFromSpeech = false;
    if (feedbackBanner) feedbackBanner.classList.add("hidden");
    if (btnConfirm) {
      btnConfirm.classList.remove("pointer-events-none", "opacity-75");
    }

    const learnScreenEl = document.getElementById("screen-learn");
    if (this.currentIndex === activeWordIndex && (!learnScreenEl || !learnScreenEl.classList.contains("hidden"))) {
      this.nextWord();
    }
  },

  // Lưu từ đã học vào localStorage
  saveWordLearned(wordId) {
    if (!AppState.currentTopic) return;
    const key = `dau_learned_${AppState.currentTopic.id}`;
    let learned = [];
    try {
      const data = localStorage.getItem(key);
      if (data) learned = JSON.parse(data);
    } catch {}
    if (!learned.includes(wordId)) {
      learned.push(wordId);
      localStorage.setItem(key, JSON.stringify(learned));
    }
  },

  // Chuyển sang từ kế tiếp (chốt chặn: bắt buộc đã đạt >= 70% hoặc đã được mở khóa)
  nextWord() {
    if (!this.isPronunciationPassed) return;
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
    this.stopSpeechRecognition(true);
    this.isAdvancing = false;
    this.isFlipping = false;
    AppState.stopAudio();
    this.stopRealSound();
    this.isSpeaking = false;
    this.isFlipped = false; // Luôn hiển thị mặt trước để bé quan sát hình trước
    this.isPronunciationPassed = false;
    this.failCount = 0;
    this.speechFeedbackState = null;
    this.isConfirmingFromSpeech = false;

    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.render();
    } else {
      // Đã học hết chủ đề
      AppState.speakText("Hoan hô Đậu ơi! Con đã hoàn thành tất cả từ vựng cùng cô rồi!", "vi");
      AppState.showScreen("screen-home");
    }
  },

  // Quay lại từ trước (chốt chặn: bắt buộc đã đạt >= 70% hoặc đã được mở khóa)
  prevWord() {
    if (!this.isPronunciationPassed) return;
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
    this.stopSpeechRecognition(true);
    this.isAdvancing = false;
    this.isFlipping = false;
    AppState.stopAudio();
    this.stopRealSound();
    this.isSpeaking = false;
    this.isFlipped = false; // Luôn hiển thị mặt trước khi lùi

    if (this.currentIndex > 0) {
      this.isPronunciationPassed = false;
      this.failCount = 0;
      this.speechFeedbackState = null;
      this.isConfirmingFromSpeech = false;
      this.currentIndex--;
      this.render();
    }
  }
};

window.LearnScreen = LearnScreen;
