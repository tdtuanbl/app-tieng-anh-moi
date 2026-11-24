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

  VI_PRAISES: [
    "Giỏi quá Đậu ơi, con đọc xuất sắc lắm!",
    "Hoan hô, Đậu của cô giỏi quá!",
    "Tuyệt vời, cô thưởng Đậu một ngôi sao nhé!",
    "Chính xác rồi, Đậu đọc siêu quá nè!"
  ],

  EN_PRAISES: [
    "Awesome job, Đậu!",
    "You are amazing, Đậu! Ten out of ten!",
    "Excellent pronunciation, Đậu!",
    "Spot on, Đậu!"
  ],

  // Khởi tạo AudioContext cho âm thanh Ting 0ms
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
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

  // Dừng toàn bộ các node âm thanh thực tế đang phát
  stopRealSound() {
    if (this.activeSoundNodes && this.activeSoundNodes.length > 0) {
      this.activeSoundNodes.forEach(node => {
        try { node.stop(); } catch (e) {}
      });
      this.activeSoundNodes = [];
    }
    this.isSpeakingRealSound = false;
  },

  // Kiểm tra xem từ vựng có hỗ trợ âm thanh thực tế Web Audio không
  hasRealSound(wordId) {
    return !!this.getSoundKey(wordId);
  },

  // Ánh xạ từ vựng sang key âm thanh thực tế
  getSoundKey(wordId) {
    if (!wordId) return null;
    const id = wordId.toLowerCase();
    // 8 nhóm phương tiện giao thông (Vehicles)
    if (id === "fire_truck") return "fire_truck";
    if (id === "police_car") return "police_car";
    if (id === "ambulance") return "ambulance";
    if (["car", "bus", "taxi", "pickup_truck", "van", "truck"].includes(id)) return "car_horn";
    if (["train", "bullet_train"].includes(id)) return "train_whistle";
    if (["bicycle", "cyclo", "tricycle"].includes(id)) return "bicycle_bell";
    if (["ship", "ferry", "boat", "speedboat"].includes(id)) return "ship_horn";
    if (["airplane", "rocket", "helicopter"].includes(id)) return "engine_rumble";

    // 9 nhóm động vật (Animals)
    if (["cat", "kitten"].includes(id)) return "cat_meow";
    if (["dog", "puppy"].includes(id)) return "dog_bark";
    if (id === "cow") return "cow_moo";
    if (id === "pig") return "pig_oink";
    if (["chicken", "rooster", "hen"].includes(id)) return "rooster_crow";
    if (id === "duck") return "duck_quack";
    if (["lion", "tiger"].includes(id)) return "lion_roar";
    if (id === "elephant") return "elephant_trumpet";
    if (["bird", "sparrow"].includes(id)) return "bird_chirp";

    return null;
  },

  // Phát 17 hiệu ứng âm thanh thực tế bằng Web Audio API thuần (0KB tải ngoài, 0ms trễ, 1.0-1.2s)
  playRealSound(wordId) {
    const soundKey = this.getSoundKey(wordId);
    if (!soundKey) return Promise.resolve();

    this.stopRealSound();
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

  // Nạp trước toàn bộ các câu khen ngợi vào RAM (ttsUrlCache)
  preloadPraises() {
    this.ttsUrlCache = this.ttsUrlCache || new Map();
    const items = [];
    this.VI_PRAISES.forEach(text => items.push({ text, lang: "vi" }));
    this.EN_PRAISES.forEach(text => items.push({ text, lang: "en" }));

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

  // Bắt đầu màn hình học
  start() {
    if (!AppState.currentTopic || !AppState.currentTopic.words || AppState.currentTopic.words.length === 0) {
      if (AppState.topics && AppState.topics.length > 0) {
        AppState.currentTopic = AppState.topics[0];
      } else {
        return;
      }
    }
    this.words = AppState.currentTopic.words;
    this.currentIndex = 0;
    this.isSpeaking = false;
    this.isFlipped = false;
    this.isFlipping = false;
    this.isAdvancing = false;
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
    this.playSequence = 0;
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
      </style>

      <div class="w-full h-full flex flex-col justify-between max-w-4xl mx-auto py-1 sm:py-2 relative overflow-hidden">
        
        <!-- BANNER PHẢN HỒI KHEN NGỢI LIỀN MẠCH -->
        <div id="learn-feedback-banner" class="hidden absolute top-14 left-1/2 -translate-x-1/2 z-40 pointer-events-none transition-all"></div>

        <!-- 1. THANH ĐIỀU HƯỚNG PHỤ & TIẾN ĐỘ CHỦ ĐỀ -->
        <div class="flex items-center justify-between w-full px-2 gap-2 shrink-0">
          <button onclick="AppState.showScreen('screen-home')" aria-label="Quay lại danh sách chủ đề" class="px-3 sm:px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            <span aria-hidden="true">⬅️</span>
            <span>Chủ đề</span>
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
        <div class="flex-1 flex flex-col items-center justify-center my-1 sm:my-2 w-full px-2">
          <div id="flashcard-wrap" class="flashcard-3d-wrap w-full max-w-xs sm:max-w-md h-[340px] sm:h-[390px] mx-auto cursor-pointer select-none">
            <div id="flashcard-inner" class="flashcard-3d-inner ${this.isFlipped ? 'is-flipped' : ''}" onclick="LearnScreen.toggleFlip()" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();LearnScreen.toggleFlip();}" aria-label="Thẻ học từ vựng ${word.en}">
              
              <!-- MẶT TRƯỚC (ĐOÁN HÌNH - BẬT PHẢN XẠ NHỚ TỪ) -->
              <div class="flashcard-face flashcard-front bg-white rounded-[2.5rem] p-4 sm:p-5 shadow-xl border-4 border-amber-200 hover:border-amber-300 flex flex-col items-center justify-between text-center transition-all duration-300 hover:scale-[1.01] active:scale-95">
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
                  <div class="w-44 h-44 sm:w-56 sm:h-56 my-auto rounded-3xl overflow-hidden shadow-inner border border-slate-100 bg-slate-50/50 p-2 flex items-center justify-center relative">
                    <img src="${word.image_url}" alt="${word.en}" class="w-full h-full object-contain rounded-2xl transition-transform duration-300 hover:scale-105" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div style="display:none;" class="w-full h-full items-center justify-center text-7xl sm:text-8xl filter drop-shadow-md" aria-hidden="true">
                      ${word.visual}
                    </div>
                  </div>
                ` : `
                  <div class="w-44 h-44 sm:w-56 sm:h-56 my-auto flex items-center justify-center text-7xl sm:text-8xl filter drop-shadow-md hover:scale-110 transition-transform" aria-hidden="true">
                    ${word.visual}
                  </div>
                `}

                <!-- Nút nghe âm thanh thực tế nếu từ có hiệu ứng -->
                ${this.hasRealSound(word.id) ? `
                  <button id="btn-front-sound" onclick="event.stopPropagation(); LearnScreen.handleFrontSoundClick('${word.id}')" class="my-1 py-1 px-3.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-500 hover:to-orange-500 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/60 z-10" aria-label="Nghe âm thanh thực tế">
                    <span>🔊</span>
                    <span>${["vehicles", "transport"].includes(AppState.currentTopic?.id) ? "Nghe còi / động cơ xe" : "Nghe tiếng kêu bạn ấy"}</span>
                  </button>
                ` : ''}

                <!-- Nhãn gợi ý chạm tay lật thẻ & nghe đọc -->
                <div class="py-1.5 px-4 rounded-full bg-amber-50 text-amber-800 font-black text-xs sm:text-sm border border-amber-200/80 shadow-sm animate-pulse flex items-center gap-1.5">
                  <span>👆</span>
                  <span>Chạm vào hình để xem từ & nghe cô đọc!</span>
                </div>
              </div>

              <!-- MẶT SAU (TỪ VỰNG TIẾNG ANH & NGHĨA TIẾNG VIỆT) -->
              <div class="flashcard-face flashcard-back bg-gradient-to-b from-amber-50/70 via-white to-amber-50/40 rounded-[2.5rem] p-4 sm:p-5 shadow-2xl border-4 border-amber-300 flex flex-col items-center justify-between text-center transition-all duration-300 hover:scale-[1.01] active:scale-95">
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
                  <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-sm border border-amber-100 bg-white p-1 flex items-center justify-center relative mt-1">
                    <img src="${word.image_url}" alt="${word.en}" class="w-full h-full object-contain rounded-xl" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <div style="display:none;" class="w-full h-full items-center justify-center text-5xl sm:text-6xl filter drop-shadow-sm" aria-hidden="true">
                      ${word.visual}
                    </div>
                  </div>
                ` : `
                  <div class="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center text-5xl sm:text-6xl filter drop-shadow-sm mt-1" aria-hidden="true">
                    ${word.visual}
                  </div>
                `}

                <!-- Từ tiếng Anh in đậm sắc nét cỡ lớn -->
                <div class="my-auto flex flex-col items-center">
                  <h2 class="text-3xl sm:text-4xl md:text-5xl font-black text-slate-800 tracking-tight capitalize">
                    ${word.en}
                  </h2>
                  <p class="text-lg sm:text-xl font-black text-amber-700 mt-1">
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

          <!-- NÚT HÀNH ĐỘNG CHÍNH (HERO ACTION): BÉ CHẠM ĐỂ NGHE CÔ ĐỌC -->
          <div class="w-full flex justify-center mt-2.5 sm:mt-3">
            <button id="btn-hero-speak" onclick="LearnScreen.handleHeroSpeak()" aria-label="Chạm để nghe cô đọc từ ${word.en}" class="w-full max-w-sm py-3.5 sm:py-4 px-6 rounded-3xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-lg sm:text-xl shadow-lg shadow-amber-300/50 border-2 border-white flex items-center justify-center gap-3 transition-all cursor-pointer">
              <span id="hero-speak-icon" class="text-2xl sm:text-3xl" aria-hidden="true">🔊</span>
              <span id="hero-speak-text">${this.isFlipped ? "Nghe lại cô đọc" : "Chạm để nghe cô đọc"}</span>
            </button>
          </div>
        </div>

        <!-- 3. KHU VỰC ĐIỀU KHIỂN DƯỚI ĐÁY: PHỤ HUYNH XÁC NHẬN & CHUYỂN TỪ -->
        <div class="flex flex-col items-center gap-2 pb-1 w-full shrink-0">
          <!-- Nút phụ huynh xác nhận bé đã đọc chuẩn để thưởng sao -->
          <button id="btn-confirm-correct" onclick="LearnScreen.confirmCorrect()" aria-label="Bố mẹ xác nhận bé đọc chuẩn để thưởng sao" class="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm sm:text-base shadow-md shadow-emerald-200/50 flex items-center gap-2 border-2 border-white transition-all cursor-pointer">
            <span aria-hidden="true">✅</span>
            <span>Đậu đọc chuẩn rồi (+1 ⭐)</span>
          </button>

          <!-- Bộ nút chuyển từ trước / từ sau -->
          <div class="flex items-center justify-center gap-3 sm:gap-4">
            <button onclick="LearnScreen.prevWord()" aria-label="Xem từ trước" class="px-4 sm:px-5 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm sm:text-base shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
              <span aria-hidden="true">⬅️</span>
              <span>Từ trước</span>
            </button>

            <button onclick="LearnScreen.nextWord()" aria-label="Sang từ tiếp theo" class="px-4 sm:px-5 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-sm sm:text-base shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
              <span>Từ sau</span>
              <span aria-hidden="true">➡️</span>
            </button>
          </div>
        </div>

      </div>
    `;
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
  async confirmCorrect() {
    if (this.isAdvancing) return;
    const word = this.words[this.currentIndex];
    if (!word) return;

    this.isAdvancing = true;

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
    if (feedbackBanner) feedbackBanner.classList.add("hidden");
    if (btnConfirm) {
      btnConfirm.classList.remove("pointer-events-none", "opacity-75");
    }

    this.nextWord();
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

  // Chuyển sang từ kế tiếp
  nextWord() {
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
    this.isAdvancing = false;
    this.isFlipping = false;
    AppState.stopAudio();
    this.stopRealSound();
    this.isSpeaking = false;
    this.isFlipped = false; // Luôn hiển thị mặt trước để bé quan sát hình trước

    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.render();
    } else {
      // Đã học hết chủ đề
      AppState.speakText("Hoan hô Đậu ơi! Con đã hoàn thành tất cả từ vựng cùng cô rồi!", "vi");
      AppState.showScreen("screen-home");
    }
  },

  // Quay lại từ trước
  prevWord() {
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
    this.isAdvancing = false;
    this.isFlipping = false;
    AppState.stopAudio();
    this.stopRealSound();
    this.isSpeaking = false;
    this.isFlipped = false; // Luôn hiển thị mặt trước khi lùi

    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
    }
  }
};

window.LearnScreen = LearnScreen;
