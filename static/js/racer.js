// Trò chơi Đua xe 3 làn đường học từ vựng cho bé Đậu
const RacerScreen = {
  selectedCar: localStorage.getItem("dau_selected_car") || "bicycle",
  currentWord: null,
  options: [], // 3 lựa chọn tương ứng 3 làn: [ { word, isTarget }, ... ]
  playerLane: 1, // 0: Làn trái, 1: Làn giữa, 2: Làn phải
  sessionStars: 0,
  speedDuration: (() => {
    const saved = localStorage.getItem("dau_racer_speed");
    const val = saved ? parseFloat(saved) : 14;
    return [14, 10, 7].includes(val) ? val : 14; // Mặc định 14s (Siêu chậm, thong thả cho bé 5 tuổi)
  })(),
  lives: 3,
  isRacing: false,
  isWaitingForQuestion: false,
  isSpawningWave: false,
  animId: null,
  waveStartTime: null,
  collisionHandled: false,
  cardsState: [
    { hit: false, freezeTop: 0 },
    { hit: false, freezeTop: 0 },
    { hit: false, freezeTop: 0 }
  ],
  targetLaneIndex: 1,
  lastQuestionIndex: -1,
  lastPraise: "",
  preloadPromise: null,
  currentTemplate: null,
  ttsUrlCache: new Map(),
  preloadedPraises: {},
  nextWaveData: null,
  webAudioCtx: null,

  // Các mẫu câu hỏi sinh động của cô giáo xoay vòng ngẫu nhiên
  QUESTION_TEMPLATES: [
    {
      display: (en) => `Đậu lái xe tìm giúp cô từ "${en}" nào!`,
      parts: (en) => [
        { text: "Đậu lái xe tìm giúp cô từ:", lang: "vi" },
        { text: en, lang: "en" }
      ],
      enOnly: (en) => `Find the ${en} for me, Đậu!`
    },
    {
      display: (en) => `Đậu ơi, lái xe đón đúng hình "${en}" giúp cô nhé!`,
      parts: (en) => [
        { text: "Đậu ơi, lái xe đón đúng hình:", lang: "vi" },
        { text: en, lang: "en" },
        { text: "giúp cô nhé!", lang: "vi" }
      ],
      enOnly: (en) => `Steer to the ${en}, Đậu!`
    },
    {
      display: (en) => `Cô đố Đậu lái xe đón trúng từ "${en}" đấy!`,
      parts: (en) => [
        { text: "Cô đố Đậu lái xe đón trúng từ:", lang: "vi" },
        { text: en, lang: "en" }
      ],
      enOnly: (en) => `Steer to the ${en}, Đậu!`
    },
    {
      display: (en) => `Đậu chỉ cho cô xem hình "${en}" ở làn nào nhé!`,
      parts: (en) => [
        { text: "Đậu chỉ cho cô xem hình:", lang: "vi" },
        { text: en, lang: "en" }
      ],
      enOnly: (en) => `Show me which lane has the ${en}, Đậu!`
    }
  ],

  // Lời khen ngợi hào hứng từ cô giáo
  PRAISES_VI: [
    "Giỏi quá Đậu ơi, con lái xe siêu quá!",
    "Xuất sắc, cô thưởng Đậu hai ngôi sao luôn!",
    "Chính xác rồi, Đậu lái xe đỉnh quá!",
    "Hoan hô, Đậu của cô giỏi lắm!"
  ],

  // Lấy mẫu câu hỏi ngẫu nhiên không trùng với câu trước
  getRandomTemplate() {
    const available = [];
    for (let i = 0; i < this.QUESTION_TEMPLATES.length; i++) {
      if (i !== this.lastQuestionIndex) available.push(i);
    }
    const chosenIndex = available[Math.floor(Math.random() * available.length)];
    this.lastQuestionIndex = chosenIndex;
    return this.QUESTION_TEMPLATES[chosenIndex];
  },

  // Lấy lời khen ngợi ngẫu nhiên không trùng với lần trước
  getRandomPraise() {
    const list = this.PRAISES_VI.filter(p => p !== this.lastPraise);
    const selected = list[Math.floor(Math.random() * list.length)];
    this.lastPraise = selected;
    return selected;
  },

  // Chuẩn bị trước bộ dữ liệu câu hỏi và từ vựng cho một lượt đua (Pipeline Pre-caching)
  prepareWaveData(targetWord = null) {
    if (!AppState.currentTopic || !AppState.currentTopic.words || AppState.currentTopic.words.length < 3) {
      if (AppState.topics && AppState.topics.length > 0) {
        AppState.currentTopic = AppState.topics[0];
      } else {
        return null;
      }
    }
    const words = AppState.currentTopic.words;
    const chosenWord = targetWord || words[Math.floor(Math.random() * words.length)];

    const others = words.filter(w => w.id !== chosenWord.id);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const distractors = others.slice(0, 2);

    const targetLaneIndex = Math.floor(Math.random() * 3);
    const options = [null, null, null];
    options[targetLaneIndex] = { word: chosenWord, isTarget: true };

    let distractorIndex = 0;
    for (let lane = 0; lane < 3; lane++) {
      if (options[lane] === null) {
        options[lane] = { word: distractors[distractorIndex++], isTarget: false };
      }
    }

    const template = this.getRandomTemplate();

    let preloadPromise = null;
    if (AppState.voiceMode === "bilingual") {
      const parts = template.parts(chosenWord.en);
      preloadPromise = Promise.all(parts.map(p => this.fetchAudioUrl(p.text, p.lang)));
    } else {
      preloadPromise = Promise.all([
        this.fetchAudioUrl(template.enOnly(chosenWord.en), "en")
      ]);
    }

    return {
      word: chosenWord,
      distractors,
      targetLaneIndex,
      options,
      template,
      preloadPromise
    };
  },

  // Khởi tạo AudioContext đơn vị (Singleton) sẵn sàng phát tức thì 0ms
  getAudioContext() {
    if (!this.webAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.webAudioCtx = new AudioCtx();
      }
    }
    if (this.webAudioCtx && this.webAudioCtx.state === "suspended") {
      this.webAudioCtx.resume().catch(() => {});
    }
    return this.webAudioCtx;
  },

  // Hiệu ứng âm thanh "Ting!" pha lê vui tai tức thì 0ms bằng Web Audio API nội bộ
  playVictoryChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Hợp âm Ting! pha lê đôi: Note 1 (E6: 1318.5Hz) vút lên Note 2 (C7: 2093Hz) kèm âm hòa sắc 2637Hz
      const chimes = [
        { freq: 1318.51, time: now, duration: 0.35, gain: 0.25 },
        { freq: 2093.00, time: now + 0.045, duration: 0.45, gain: 0.32 },
        { freq: 2637.02, time: now + 0.075, duration: 0.35, gain: 0.16 }
      ];

      chimes.forEach(chime => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(chime.freq, chime.time);

        gain.gain.setValueAtTime(0.001, chime.time);
        gain.gain.exponentialRampToValueAtTime(chime.gain, chime.time + 0.008); // Bật tiếng đanh tức thì 8ms
        gain.gain.exponentialRampToValueAtTime(0.0001, chime.time + chime.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(chime.time);
        osc.stop(chime.time + chime.duration + 0.05);
      });
    } catch (e) {
      console.warn("Lỗi phát victory chime:", e);
    }
  },

  playBoingSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.28);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.warn("Lỗi phát boing sound:", e);
    }
  },

  // Tải trước các câu khen ngợi một cách nhẹ nhàng xen kẽ sau khi xe đã xuất phát
  preloadPraisesStaggered() {
    this.preloadedPraises = this.preloadedPraises || {};
    const viList = this.PRAISES_VI || [];
    const enList = [
      "Awesome driving, Đậu!",
      "Spot on, Đậu! Two stars!",
      "Excellent, great job, Đậu!",
      "Hurray, you did it, Đậu!"
    ];
    const allPraises = [
      ...viList.map(text => ({ text, lang: "vi" })),
      ...enList.map(text => ({ text, lang: "en" }))
    ];

    allPraises.forEach((item, index) => {
      setTimeout(() => {
        if (!this.isRacing) return;
        const key = `${item.lang}_${item.text}`;
        if (!this.preloadedPraises[key]) {
          this.fetchAudioUrl(item.text, item.lang).then(url => {
            if (url) {
              this.preloadedPraises[key] = url;
            }
          });
        }
      }, 2500 + index * 1000);
    });
  },

  preloadAllPraises() {
    this.preloadPraisesStaggered();
  },

  // Phát câu khen đã tải sẵn từ bộ nhớ cache
  playPreloadedAudio(url) {
    if (!url) return;
    try {
      AppState.stopAudio();
      const player = AppState.audioPlayer;
      player.src = url;
      if (AppState.playbackRate) {
        player.playbackRate = AppState.playbackRate;
        player.defaultPlaybackRate = AppState.playbackRate;
      }
      player.play().catch(() => {});
    } catch (e) {
      console.warn("Could not play preloaded audio:", e);
    }
  },

  // Lấy URL audio từ backend TTS (kèm cache cục bộ & pre-buffer trình duyệt)
  async fetchAudioUrl(text, lang) {
    const cacheKey = `${lang}_${text}`;
    if (this.ttsUrlCache && this.ttsUrlCache.has(cacheKey)) {
      return this.ttsUrlCache.get(cacheKey);
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
        // Tải trước buffer âm thanh vào RAM trình duyệt
        const a = new Audio();
        a.preload = "auto";
        a.src = data.url;
        return data.url;
      }
      return null;
    } catch (err) {
      console.error("Lỗi tải trước âm thanh racer:", err);
      return null;
    }
  },

  // Phát chuỗi âm thanh nối liền mạch không khoảng khựng, đồng bộ onStart ngay khi cất tiếng
  playSeamlessSequence(urlList, onStart) {
    return new Promise((resolve) => {
      AppState.stopAudio();
      const player = AppState.audioPlayer;
      if (!urlList || urlList.length === 0) {
        if (typeof onStart === "function") onStart();
        resolve();
        return;
      }

      AppState.currentAudioResolve = resolve;
      let currentIndex = 0;
      let startTriggered = false;

      const triggerStart = () => {
        if (!startTriggered) {
          startTriggered = true;
          if (typeof onStart === "function") {
            onStart();
          }
        }
      };

      const cleanup = () => {
        player.ontimeupdate = null;
        player.onended = null;
        player.onerror = null;
        player.removeEventListener("playing", triggerStart);
        player.removeEventListener("play", triggerStart);
        triggerStart();
        if (AppState.currentAudioResolve === resolve) {
          AppState.currentAudioResolve = null;
        }
        resolve();
      };

      const playNext = () => {
        currentIndex++;
        if (currentIndex >= urlList.length) {
          cleanup();
          return;
        }
        playItem(urlList[currentIndex]);
      };

      const playItem = (url) => {
        let transitioned = false;
        player.ontimeupdate = () => {
          // Cắt khoảng lặng đuôi 0.26s của Edge TTS để nối clip tiếp theo mượt mà
          if (currentIndex < urlList.length - 1) {
            if (player.duration && (player.duration - player.currentTime <= 0.26)) {
              if (!transitioned) {
                transitioned = true;
                player.ontimeupdate = null;
                playNext();
              }
            }
          }
        };

        player.onended = () => {
          if (!transitioned) {
            transitioned = true;
            player.ontimeupdate = null;
            playNext();
          }
        };

        player.onerror = cleanup;

        // Bắt chính xác sự kiện phát tiếng của clip đầu tiên để kích hoạt nhả thẻ đồng bộ 0ms
        if (currentIndex === 0) {
          player.addEventListener("playing", triggerStart, { once: true });
          player.addEventListener("play", triggerStart, { once: true });
        }

        player.src = url;
        if (AppState.playbackRate) {
          player.playbackRate = AppState.playbackRate;
          player.defaultPlaybackRate = AppState.playbackRate;
        }
        player.play().then(triggerStart).catch(cleanup);
      };

      playItem(urlList[0]);
    });
  },

  // Cấu hình & Thiết kế đồ họa cho các loại xe trong Gara của bé Đậu
  VEHICLE_CONFIGS: {
    bicycle: {
      id: "bicycle",
      nameVi: "🚲 Đậu Chở Em",
      nameEn: "Bicycle Ride",
      icon: "🚲",
      color: "#10b981",
      badge: "⭐ Siêu đặc biệt",
      renderSVG: () => `
        <img src="/static/images/dau-cho-em.png" alt="Đậu chở em" class="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] select-none pointer-events-none" />
      `
    },
    police: {
      id: "police",
      nameVi: "Xe Cảnh Sát",
      nameEn: "Police Car",
      icon: "🚓",
      color: "#1e3a8a",
      renderSVG: () => `
        <svg viewBox="0 0 100 150" class="w-full h-full filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
          <!-- Bánh xe 4 bên -->
          <rect x="4" y="24" width="8" height="24" rx="3" fill="#1e293b" />
          <rect x="88" y="24" width="8" height="24" rx="3" fill="#1e293b" />
          <rect x="4" y="96" width="8" height="24" rx="3" fill="#1e293b" />
          <rect x="88" y="96" width="8" height="24" rx="3" fill="#1e293b" />

          <!-- Thân xe xanh đậm -->
          <rect x="10" y="8" width="80" height="134" rx="20" fill="#1e3a8a" stroke="#0f172a" stroke-width="2" />
          
          <!-- Nóc và dải trắng trung tâm -->
          <path d="M 22 28 Q 50 24 78 28 L 76 122 Q 50 126 24 122 Z" fill="#ffffff" />
          
          <!-- Hông xe xanh cảnh sát -->
          <path d="M 12 40 L 22 42 L 24 110 L 12 110 Z" fill="#1d4ed8" />
          <path d="M 88 40 L 78 42 L 76 110 L 88 110 Z" fill="#1d4ed8" />

          <!-- Kính chắn gió trước -->
          <path d="M 24 40 Q 50 35 76 40 L 72 58 Q 50 54 28 58 Z" fill="#38bdf8" opacity="0.85" stroke="#0284c7" stroke-width="1.5" />
          
          <!-- Kính sau -->
          <path d="M 28 98 Q 50 102 72 98 L 70 112 Q 50 115 30 112 Z" fill="#38bdf8" opacity="0.85" stroke="#0284c7" stroke-width="1.5" />

          <!-- Cửa kính bên hông -->
          <rect x="23" y="62" width="4" height="30" rx="1.5" fill="#38bdf8" opacity="0.75" />
          <rect x="73" y="62" width="4" height="30" rx="1.5" fill="#38bdf8" opacity="0.75" />

          <!-- Chữ POLICE trên nắp capo -->
          <text x="50" y="34" font-size="7" font-weight="900" fill="#1e3a8a" text-anchor="middle" letter-spacing="1.5" font-family="Arial, sans-serif">POLICE</text>

          <!-- Huy hiệu ngôi sao cảnh sát trên nóc xe -->
          <circle cx="50" cy="78" r="9" fill="#1e3a8a" />
          <polygon points="50,71 52,76 57,76 53,79 55,84 50,81 45,84 47,79 43,76 48,76" fill="#facc15" />

          <!-- Đèn pha trước chiếu sáng -->
          <polygon points="20,10 32,10 36,4 16,4" fill="#fef08a" opacity="0.9" />
          <polygon points="80,10 68,10 64,4 84,4" fill="#fef08a" opacity="0.9" />

          <!-- Dàn đèn còi ưu tiên nhấp nháy trên nóc -->
          <rect x="34" y="58" width="32" height="7" rx="2" fill="#334155" />
          <circle cx="40" cy="61.5" r="3.5" class="siren-red" />
          <circle cx="60" cy="61.5" r="3.5" class="siren-blue" />
          <rect x="47" y="59.5" width="6" height="4" fill="#ffffff" rx="1" />
        </svg>
      `
    },
    ambulance: {
      id: "ambulance",
      nameVi: "Xe Cứu Thương",
      nameEn: "Ambulance",
      icon: "🚑",
      color: "#dc2626",
      renderSVG: () => `
        <svg viewBox="0 0 100 150" class="w-full h-full filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
          <!-- Bánh xe 4 bên -->
          <rect x="4" y="24" width="8" height="24" rx="3" fill="#1e293b" />
          <rect x="88" y="24" width="8" height="24" rx="3" fill="#1e293b" />
          <rect x="4" y="96" width="8" height="24" rx="3" fill="#1e293b" />
          <rect x="88" y="96" width="8" height="24" rx="3" fill="#1e293b" />

          <!-- Thân xe màu trắng cứu thương -->
          <rect x="10" y="8" width="80" height="134" rx="16" fill="#f8fafc" stroke="#94a3b8" stroke-width="2" />
          
          <!-- Dải sọc đỏ đặc trưng bên hông -->
          <rect x="10" y="44" width="80" height="8" fill="#dc2626" />
          <rect x="10" y="116" width="80" height="6" fill="#dc2626" />

          <!-- Kính trước -->
          <path d="M 22 28 Q 50 23 78 28 L 75 42 Q 50 38 25 42 Z" fill="#67e8f9" opacity="0.85" stroke="#0891b2" stroke-width="1.5" />

          <!-- Cửa kính đôi phía sau -->
          <rect x="22" y="126" width="22" height="8" rx="2" fill="#67e8f9" opacity="0.85" stroke="#0891b2" stroke-width="1" />
          <rect x="56" y="126" width="22" height="8" rx="2" fill="#67e8f9" opacity="0.85" stroke="#0891b2" stroke-width="1" />

          <!-- Chữ thập đỏ nổi bật trên nóc xe -->
          <circle cx="50" cy="80" r="22" fill="#ffffff" stroke="#dc2626" stroke-width="2.5" />
          <rect x="44" y="65" width="12" height="30" rx="2" fill="#dc2626" />
          <rect x="35" y="74" width="30" height="12" rx="2" fill="#dc2626" />

          <!-- Chữ AMBULANCE trước nắp capo -->
          <text x="50" y="22" font-size="6.5" font-weight="900" fill="#dc2626" text-anchor="middle" letter-spacing="1" font-family="Arial, sans-serif">AMBULANCE</text>

          <!-- Đèn pha -->
          <polygon points="18,10 30,10 34,4 14,4" fill="#fef08a" opacity="0.9" />
          <polygon points="82,10 70,10 66,4 86,4" fill="#fef08a" opacity="0.9" />

          <!-- Còi đèn cấp cứu nhấp nháy trên nóc -->
          <rect x="36" y="43" width="28" height="6" rx="2" fill="#1e293b" />
          <circle cx="41" cy="46" r="3.5" class="siren-red" />
          <circle cx="59" cy="46" r="3.5" class="siren-blue" />
          <circle cx="50" cy="46" r="2" fill="#ffffff" />
        </svg>
      `
    },
    firetruck: {
      id: "firetruck",
      nameVi: "Xe Cứu Hỏa",
      nameEn: "Fire Truck",
      icon: "🚒",
      color: "#dc2626",
      renderSVG: () => `
        <svg viewBox="0 0 100 150" class="w-full h-full filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
          <!-- Bánh xe kép chịu lực -->
          <rect x="4" y="24" width="8" height="24" rx="3" fill="#1e293b" />
          <rect x="88" y="24" width="8" height="24" rx="3" fill="#1e293b" />
          <rect x="4" y="86" width="8" height="20" rx="3" fill="#1e293b" />
          <rect x="88" y="86" width="8" height="20" rx="3" fill="#1e293b" />
          <rect x="4" y="110" width="8" height="20" rx="3" fill="#1e293b" />
          <rect x="88" y="110" width="8" height="20" rx="3" fill="#1e293b" />

          <!-- Thân xe đỏ rực rỡ -->
          <rect x="10" y="8" width="80" height="134" rx="14" fill="#dc2626" stroke="#991b1b" stroke-width="2" />
          
          <!-- Họa tiết phản quang sọc vàng sau đuôi xe -->
          <rect x="14" y="128" width="72" height="10" rx="2" fill="#facc15" stroke="#991b1b" stroke-width="1" />
          <line x1="26" y1="128" x2="36" y2="138" stroke="#dc2626" stroke-width="4" />
          <line x1="46" y1="128" x2="56" y2="138" stroke="#dc2626" stroke-width="4" />
          <line x1="66" y1="128" x2="76" y2="138" stroke="#dc2626" stroke-width="4" />

          <!-- Kính lái cabin -->
          <path d="M 20 25 Q 50 20 80 25 L 76 40 Q 50 36 24 40 Z" fill="#67e8f9" opacity="0.85" stroke="#0891b2" stroke-width="1.5" />

          <!-- Thang cứu nạn màu trắng bạc trên nóc xe -->
          <rect x="34" y="48" width="32" height="74" rx="3" fill="#f1f5f9" stroke="#64748b" stroke-width="2" />
          <line x1="40" y1="48" x2="40" y2="122" stroke="#64748b" stroke-width="2" />
          <line x1="60" y1="48" x2="60" y2="122" stroke="#64748b" stroke-width="2" />
          <line x1="40" y1="56" x2="60" y2="56" stroke="#64748b" stroke-width="2" />
          <line x1="40" y1="66" x2="60" y2="66" stroke="#64748b" stroke-width="2" />
          <line x1="40" y1="76" x2="60" y2="76" stroke="#64748b" stroke-width="2" />
          <line x1="40" y1="86" x2="60" y2="86" stroke="#64748b" stroke-width="2" />
          <line x1="40" y1="96" x2="60" y2="96" stroke="#64748b" stroke-width="2" />
          <line x1="40" y1="106" x2="60" y2="106" stroke="#64748b" stroke-width="2" />
          <line x1="40" y1="116" x2="60" y2="116" stroke="#64748b" stroke-width="2" />

          <!-- Cuộn vòi rồng cứu hỏa 2 bên -->
          <circle cx="24" cy="70" r="7" fill="#facc15" stroke="#b45309" stroke-width="2" />
          <circle cx="24" cy="70" r="3" fill="#78350f" />
          <circle cx="76" cy="70" r="7" fill="#facc15" stroke="#b45309" stroke-width="2" />
          <circle cx="76" cy="70" r="3" fill="#78350f" />

          <!-- Cụm đèn còi cứu hỏa nhấp nháy trên nóc -->
          <rect x="30" y="40" width="40" height="6" rx="2" fill="#1e293b" />
          <circle cx="36" cy="43" r="3.5" class="siren-red" />
          <circle cx="64" cy="43" r="3.5" class="siren-blue" />
          <circle cx="50" cy="43" r="3" class="siren-amber" />

          <!-- Đèn pha -->
          <polygon points="16,10 28,10 32,4 12,4" fill="#fef08a" opacity="0.9" />
          <polygon points="84,10 72,10 68,4 88,4" fill="#fef08a" opacity="0.9" />
        </svg>
      `
    },
    bulldozer: {
      id: "bulldozer",
      nameVi: "Xe Ủi Đất",
      nameEn: "Bulldozer",
      icon: "🚜",
      color: "#f59e0b",
      renderSVG: () => `
        <svg viewBox="0 0 100 150" class="w-full h-full filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)]">
          <!-- Bánh xích sắt lớn 2 bên -->
          <rect x="4" y="32" width="16" height="96" rx="6" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
          <line x1="4" y1="44" x2="20" y2="44" stroke="#475569" stroke-width="2" />
          <line x1="4" y1="56" x2="20" y2="56" stroke="#475569" stroke-width="2" />
          <line x1="4" y1="68" x2="20" y2="68" stroke="#475569" stroke-width="2" />
          <line x1="4" y1="80" x2="20" y2="80" stroke="#475569" stroke-width="2" />
          <line x1="4" y1="92" x2="20" y2="92" stroke="#475569" stroke-width="2" />
          <line x1="4" y1="104" x2="20" y2="104" stroke="#475569" stroke-width="2" />
          <line x1="4" y1="116" x2="20" y2="116" stroke="#475569" stroke-width="2" />

          <rect x="80" y="32" width="16" height="96" rx="6" fill="#1e293b" stroke="#0f172a" stroke-width="2" />
          <line x1="80" y1="44" x2="96" y2="44" stroke="#475569" stroke-width="2" />
          <line x1="80" y1="56" x2="96" y2="56" stroke="#475569" stroke-width="2" />
          <line x1="80" y1="68" x2="96" y2="68" stroke="#475569" stroke-width="2" />
          <line x1="80" y1="80" x2="96" y2="80" stroke="#475569" stroke-width="2" />
          <line x1="80" y1="92" x2="96" y2="92" stroke="#475569" stroke-width="2" />
          <line x1="80" y1="104" x2="96" y2="104" stroke="#475569" stroke-width="2" />
          <line x1="80" y1="116" x2="96" y2="116" stroke="#475569" stroke-width="2" />

          <!-- Cần thủy lực nối lưỡi ủi -->
          <path d="M 12 36 L 22 22 L 28 24 L 18 38 Z" fill="#475569" />
          <path d="M 88 36 L 78 22 L 72 24 L 82 38 Z" fill="#475569" />

          <!-- Lưỡi gạt/gầu ủi thép cong lớn phía trước -->
          <path d="M 4 20 Q 50 10 96 20 L 94 8 Q 50 0 6 8 Z" fill="#475569" stroke="#334155" stroke-width="2" />
          <line x1="8" y1="8" x2="92" y2="8" stroke="#f59e0b" stroke-width="3" />
          <!-- Răng lưỡi ủi thép cứng -->
          <rect x="12" y="4" width="6" height="6" fill="#cbd5e1" rx="1" />
          <rect x="36" y="2" width="6" height="6" fill="#cbd5e1" rx="1" />
          <rect x="58" y="2" width="6" height="6" fill="#cbd5e1" rx="1" />
          <rect x="82" y="4" width="6" height="6" fill="#cbd5e1" rx="1" />

          <!-- Thân xe vàng cam công trình -->
          <rect x="22" y="36" width="56" height="92" rx="10" fill="#f59e0b" stroke="#b45309" stroke-width="2" />
          
          <!-- Khe tản nhiệt động cơ -->
          <line x1="32" y1="44" x2="68" y2="44" stroke="#78350f" stroke-width="2" />
          <line x1="32" y1="50" x2="68" y2="50" stroke="#78350f" stroke-width="2" />
          <line x1="32" y1="56" x2="68" y2="56" stroke="#78350f" stroke-width="2" />

          <!-- Ống xả khói trên nóc máy -->
          <circle cx="28" cy="64" r="3.5" fill="#334155" />
          <circle cx="28" cy="64" r="2" fill="#0f172a" />

          <!-- Cabin điều khiển kiên cố -->
          <rect x="26" y="70" width="48" height="48" rx="8" fill="#d97706" stroke="#78350f" stroke-width="2" />
          <!-- Kính bảo hộ cabin -->
          <path d="M 30 76 Q 50 72 70 76 L 68 88 Q 50 85 32 88 Z" fill="#38bdf8" opacity="0.85" stroke="#0284c7" stroke-width="1.5" />
          <rect x="30" y="92" width="40" height="20" rx="3" fill="#38bdf8" opacity="0.75" />

          <!-- Đèn cảnh báo công trình màu hổ phách -->
          <circle cx="50" cy="70" r="4.5" class="siren-amber" />

          <!-- Tạ đối trọng phía sau -->
          <rect x="26" y="124" width="48" height="8" rx="2" fill="#334155" />
        </svg>
      `
    }
  },

  // Lấy SVG hoặc hình ảnh của loại xe đang chọn
  getCarSVG(carId) {
    const config = this.VEHICLE_CONFIGS[carId] || this.VEHICLE_CONFIGS.bicycle || this.VEHICLE_CONFIGS.police;
    return config.renderSVG();
  },

  // Bắt đầu màn hình đua xe
  start() {
    if (!AppState.currentTopic || !AppState.currentTopic.words || AppState.currentTopic.words.length < 3) {
      if (AppState.topics && AppState.topics.length > 0) {
        AppState.currentTopic = AppState.topics[0];
      } else {
        return;
      }
    }
    this.sessionStars = 0;
    this.lives = 3;
    this.playerLane = 1;
    this.isSpawningWave = false;
    this.getAudioContext();
    // Nạp trước câu hỏi lượt 1 ngay từ khi mở Gara (nhường 100% băng thông)
    this.nextWaveData = this.prepareWaveData();
    this.renderContainer();
    this.setupSwipeListeners();
    // Mở Gara chọn xe trước khi xuất phát
    this.openGarage(true);
  },

  // Hiển thị khung giao diện đường đua 3 làn
  renderContainer() {
    const container = document.getElementById("screen-racer");
    if (!container) return;

    container.innerHTML = `
      <style>
        @keyframes roadStripeMove {
          0% { background-position-y: 0px; }
          100% { background-position-y: 64px; }
        }
        .road-stripe-animated {
          background-image: linear-gradient(to bottom, #facc15 60%, transparent 60%);
          background-size: 100% 64px;
          background-repeat: repeat-y;
          animation: roadStripeMove 1.2s linear infinite;
        }
        @keyframes kerbMove {
          0% { background-position-y: 0px; }
          100% { background-position-y: 40px; }
        }
        .kerb-animated {
          background-image: repeating-linear-gradient(
            to bottom,
            #ef4444 0px,
            #ef4444 10px,
            #ffffff 10px,
            #ffffff 20px
          );
          background-size: 100% 40px;
          animation: kerbMove 1.2s linear infinite;
        }
        @keyframes grassMove {
          0% { background-position-y: 0px; }
          100% { background-position-y: 60px; }
        }
        .grass-animated {
          background-image: repeating-linear-gradient(
            to bottom,
            #10b981 0px,
            #10b981 30px,
            #059669 30px,
            #059669 60px
          );
          background-size: 100% 60px;
          animation: grassMove 1.2s linear infinite;
        }
        .checkered-start-line {
          background: repeating-conic-gradient(#1e293b 0% 25%, #ffffff 0% 50%) 50% / 14px 14px;
        }
        .headlight-cone {
          clip-path: polygon(28% 100%, 72% 100%, 100% 0, 0 0);
          background: linear-gradient(to top, rgba(254, 240, 138, 0.45) 0%, rgba(254, 240, 138, 0.15) 60%, transparent 100%);
        }
        @keyframes trackRumble {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-4px, 3px); }
          40% { transform: translate(4px, -3px); }
          60% { transform: translate(-3px, -2px); }
          80% { transform: translate(3px, 2px); }
        }
        .track-rumble {
          animation: trackRumble 0.35s ease-out;
        }
        @keyframes cardShakeWrong {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-8px); }
          40%, 80% { transform: translateX(8px); }
        }
        .shake-wrong {
          animation: cardShakeWrong 0.4s ease-in-out;
          border-color: #f43f5e !important;
        }
        @keyframes shockwave {
          0% { transform: scale(0.1); opacity: 1; border-width: 8px; }
          100% { transform: scale(3); opacity: 0; border-width: 1px; }
        }
        @keyframes funBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-16px) rotate(-6deg); }
          50% { transform: translateY(0) rotate(6deg); }
          75% { transform: translateY(-8px) rotate(-3deg); }
        }
        .car-bounce {
          animation: funBounce 0.5s ease-in-out;
        }
        @keyframes carVictoryFlash {
          0%, 100% { filter: drop-shadow(0 0 0 rgba(250, 204, 21, 0)); transform: scale(1); }
          50% { filter: drop-shadow(0 0 18px #facc15) drop-shadow(0 0 32px #f59e0b) brightness(1.25); transform: scale(1.1); }
        }
        .car-victory-flash {
          animation: carVictoryFlash 0.55s ease-out;
        }
        @keyframes sirenFlashRed {
          0%, 100% { fill: #ef4444; filter: drop-shadow(0 0 6px #ef4444); }
          50% { fill: #7f1d1d; filter: none; }
        }
        @keyframes sirenFlashBlue {
          0%, 100% { fill: #1d4ed8; filter: none; }
          50% { fill: #38bdf8; filter: drop-shadow(0 0 6px #38bdf8); }
        }
        @keyframes sirenFlashAmber {
          0%, 100% { fill: #f59e0b; filter: drop-shadow(0 0 6px #f59e0b); }
          50% { fill: #78350f; filter: none; }
        }
        .siren-red {
          animation: sirenFlashRed 0.6s infinite alternate;
        }
        .siren-blue {
          animation: sirenFlashBlue 0.6s infinite alternate;
        }
        .siren-amber {
          animation: sirenFlashAmber 0.5s infinite alternate;
        }
      </style>

      <div class="w-full h-full flex flex-col justify-between max-w-5xl mx-auto py-1 relative select-none">
        <!-- THANH TRÊN CÙNG: 2 TẦNG THOÁNG ĐÃNG -->
        <div class="flex flex-col w-full px-2 z-20 gap-1 sm:gap-1.5">
          <!-- TẦNG 1: Điều hướng, Nút Đổi xe, Nút Tốc độ 3 mức & Sao chặng đua -->
          <div class="flex items-center justify-between w-full flex-wrap gap-1">
            <!-- Cụm nút trái: Chủ đề, Đổi xe & Chọn 3 mức tốc độ -->
            <div class="flex items-center gap-1 sm:gap-2 flex-wrap">
              <button onclick="RacerScreen.exitGame()" aria-label="Thoát trò chơi về danh sách chủ đề" class="px-2.5 sm:px-3 py-1.5 md:py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1 text-xs md:text-sm cursor-pointer">
                <span aria-hidden="true">⬅️</span>
                <span class="hidden xs:inline">Chủ đề</span>
              </button>
              <button onclick="RacerScreen.openGarage(false)" aria-label="Mở gara đổi xe khác" class="px-2.5 sm:px-3 py-1.5 md:py-2 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-black shadow-sm border border-amber-300 active:scale-95 transition-all flex items-center gap-1 text-xs md:text-sm cursor-pointer">
                <span aria-hidden="true">🚗</span>
                <span class="hidden xs:inline">Đổi xe</span>
              </button>

              <!-- NÚT CHỌN 3 MỨC TỐC ĐỘ: 🐌 Siêu chậm (~14s) / 🐢 Chậm rãi (~10s) / 🚗 Vừa phải (~7s) -->
              <div class="flex items-center gap-0.5 md:gap-1 bg-white/95 p-0.5 sm:p-1 rounded-2xl shadow-sm border border-slate-200 text-[10px] sm:text-[11px] md:text-xs font-black">
                <button id="btn-speed-super-slow" onclick="RacerScreen.setSpeed(14)" aria-label="Tốc độ siêu chậm 14 giây" class="px-1.5 sm:px-2 md:px-2.5 py-1 rounded-xl transition-all ${this.speedDuration === 14 ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
                  🐌 Siêu chậm
                </button>
                <button id="btn-speed-slow" onclick="RacerScreen.setSpeed(10)" aria-label="Tốc độ chậm rãi 10 giây" class="px-1.5 sm:px-2 md:px-2.5 py-1 rounded-xl transition-all ${this.speedDuration === 10 ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
                  🐢 Chậm rãi
                </button>
                <button id="btn-speed-medium" onclick="RacerScreen.setSpeed(7)" aria-label="Tốc độ vừa phải 7 giây" class="px-1.5 sm:px-2 md:px-2.5 py-1 rounded-xl transition-all ${this.speedDuration === 7 ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
                  🚗 Vừa phải
                </button>
              </div>
            </div>

            <!-- Cụm phải: Huy hiệu Sao Chặng Đua Tích Lũy Thật -->
            <div id="racer-stars-badge" class="flex items-center gap-1 text-xs sm:text-sm font-black bg-white/95 px-2.5 sm:px-3 py-1.5 rounded-2xl shadow-sm border border-amber-200 text-amber-900 shrink-0" aria-label="Sao tích lũy chặng đua hiện tại">
              <span aria-hidden="true">⭐</span>
              <span id="racer-session-stars">0</span>
              <span class="text-[10px] sm:text-xs text-amber-700">sao chặng</span>
            </div>
          </div>

          <!-- TẦNG 2: BIỂU NGỮ CÂU HỎI RỘNG TOÀN DIỆN KIÊM NÚT LOA -->
          <div class="w-full flex justify-center">
            <button onclick="RacerScreen.playQuestionPrompt()" aria-label="Nghe cô đọc lại yêu cầu chặng đua" class="w-full max-w-2xl py-2 px-3 sm:px-6 rounded-2xl md:rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-400 hover:from-amber-400 hover:to-yellow-500 active:scale-[0.98] text-slate-900 font-black text-xs sm:text-base md:text-lg shadow-md border-2 border-white flex items-center justify-center gap-2 md:gap-3 transition-all cursor-pointer">
              <span class="text-base sm:text-xl md:text-2xl animate-pulse shrink-0" aria-hidden="true">🔊</span>
              <span id="racer-keyword-display" class="tracking-wide text-center">Đậu lái xe tìm từ vựng cùng cô nào...</span>
            </button>
          </div>
        </div>

        <!-- ĐƯỜNG ĐUA F1 3 LÀN XE: CÓ LỀ CỎ, GỜ KERB ĐỎ-TRẮNG & MẶT ĐƯỜNG THỂ THAO -->
        <div id="racer-track" class="flex-1 w-full my-1.5 relative rounded-[2.5rem] bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-4 border-slate-700 shadow-2xl overflow-hidden flex touch-none">
          
          <!-- DẢI LỀ CỎ & GỜ BÓ VỈA KERB F1 BÊN TRÁI -->
          <div class="absolute left-0 top-0 bottom-0 w-3 sm:w-4 md:w-5 grass-animated z-10 border-r border-emerald-700 pointer-events-none shadow-inner"></div>
          <div class="absolute left-3 sm:left-4 md:left-5 top-0 bottom-0 w-2.5 sm:w-3.5 kerb-animated z-10 border-r border-slate-700 pointer-events-none shadow-md"></div>

          <!-- DẢI LỀ CỎ & GỜ BÓ VỈA KERB F1 BÊN PHẢI -->
          <div class="absolute right-0 top-0 bottom-0 w-3 sm:w-4 md:w-5 grass-animated z-10 border-l border-emerald-700 pointer-events-none shadow-inner"></div>
          <div class="absolute right-3 sm:right-4 md:right-5 top-0 bottom-0 w-2.5 sm:w-3.5 kerb-animated z-10 border-l border-slate-700 pointer-events-none shadow-md"></div>

          <!-- VẠCH CARO XUẤT PHÁT F1 ĐỈNH ĐƯỜNG ĐUA -->
          <div class="absolute top-0 inset-x-0 h-3.5 checkered-start-line opacity-90 z-10 border-b-2 border-amber-400 pointer-events-none"></div>

          <!-- HIGHLIGHT LÀN XE ĐANG CHẠY (Hỗ trợ bé căn làn đón đúng từ) -->
          <div id="lane-active-highlight" class="absolute top-0 bottom-0 w-1/3 transition-all duration-200 pointer-events-none z-0 bg-gradient-to-t from-sky-400/15 via-amber-300/5 to-transparent" style="left: 33.333%;"></div>

          <!-- VẠCH PHÂN LÀN CHUYỂN ĐỘNG LIÊN TỤC (Đậm nét w-2) -->
          <div class="absolute left-1/3 top-0 bottom-0 w-2 -ml-1 road-stripe-animated pointer-events-none z-0"></div>
          <div class="absolute left-2/3 top-0 bottom-0 w-2 -ml-1 road-stripe-animated pointer-events-none z-0"></div>

          <!-- LÀN 0 (Trái) -->
          <div onclick="RacerScreen.switchLane(0)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();RacerScreen.switchLane(0);}" role="button" tabindex="0" aria-label="Lái xe vào làn bên trái" class="flex-1 h-full relative cursor-pointer active:bg-white/5 transition-colors flex justify-center z-10 focus:outline-none">
            <div id="lane-item-0" class="absolute top-[2%] left-0 right-0 mx-auto w-[90%] max-w-[210px] bg-white rounded-[1.75rem] shadow-[0_12px_24px_rgba(0,0,0,0.35),0_4px_8px_rgba(0,0,0,0.2)] border-4 border-amber-300 border-b-[6px] border-b-amber-400 flex flex-col items-center justify-between p-2 text-center pointer-events-none overflow-hidden transition-opacity">
            </div>
          </div>

          <!-- LÀN 1 (Giữa) -->
          <div onclick="RacerScreen.switchLane(1)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();RacerScreen.switchLane(1);}" role="button" tabindex="0" aria-label="Lái xe vào làn ở giữa" class="flex-1 h-full relative cursor-pointer active:bg-white/5 transition-colors flex justify-center z-10 focus:outline-none">
            <div id="lane-item-1" class="absolute top-[2%] left-0 right-0 mx-auto w-[90%] max-w-[210px] bg-white rounded-[1.75rem] shadow-[0_12px_24px_rgba(0,0,0,0.35),0_4px_8px_rgba(0,0,0,0.2)] border-4 border-amber-300 border-b-[6px] border-b-amber-400 flex flex-col items-center justify-between p-2 text-center pointer-events-none overflow-hidden transition-opacity">
            </div>
          </div>

          <!-- LÀN 2 (Phải) -->
          <div onclick="RacerScreen.switchLane(2)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();RacerScreen.switchLane(2);}" role="button" tabindex="0" aria-label="Lái xe vào làn bên phải" class="flex-1 h-full relative cursor-pointer active:bg-white/5 transition-colors flex justify-center z-10 focus:outline-none">
            <div id="lane-item-2" class="absolute top-[2%] left-0 right-0 mx-auto w-[90%] max-w-[210px] bg-white rounded-[1.75rem] shadow-[0_12px_24px_rgba(0,0,0,0.35),0_4px_8px_rgba(0,0,0,0.2)] border-4 border-amber-300 border-b-[6px] border-b-amber-400 flex flex-col items-center justify-between p-2 text-center pointer-events-none overflow-hidden transition-opacity">
            </div>
          </div>

          <!-- XE CỦA BÉ ĐẬU Ở ĐÁY ĐƯỜNG ĐUA (Cỡ lớn 78% kèm chùm sáng đèn pha rọi trước) -->
          <div id="player-car" class="absolute bottom-4 w-1/3 flex flex-col justify-center items-center transition-all duration-200 pointer-events-none z-20" style="left: 33.333%;">
            <!-- Chùm sáng đèn pha rọi phía trước mũi xe -->
            <div class="w-[85%] max-w-[140px] h-32 -mb-6 headlight-cone pointer-events-none filter blur-[1px]"></div>
            <!-- Xe cỡ lớn w-[78%] (hoặc h-32 md:h-36 cho xe đạp) -->
            <div id="car-inner" class="${this.selectedCar === 'bicycle' ? 'w-[85%] max-w-[140px] h-32 md:h-36' : 'w-[78%] max-w-[130px] aspect-[100/150]'} flex items-center justify-center transition-transform duration-200">
              ${this.getCarSVG(this.selectedCar)}
            </div>
            <!-- Vùng nhả khói xả đuôi xe khi bẻ lái -->
            <div id="car-smoke-emitter" class="absolute -bottom-2 w-full flex justify-center pointer-events-none"></div>
          </div>

          <!-- KHUNG HỆ THỐNG HẠT VỠ TUNG KHI XE ĐÂM ĐÚNG ĐÍCH -->
          <div id="shatter-container" class="absolute inset-0 pointer-events-none z-40 overflow-hidden"></div>

          <!-- LỚP PHỦ THÔNG BÁO LƯỢT ĐUA / HƯỚNG DẪN -->
          <div id="racer-prompt-banner" class="absolute top-5 inset-x-0 mx-auto w-fit px-6 py-2 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/25 text-white font-extrabold text-sm md:text-base shadow-xl text-center pointer-events-none z-30">
            Đậu lắng nghe câu hỏi rồi lái xe nhé! 👂🚗
          </div>
        </div>

        <!-- BỘ ĐIỀU KHIỂN NÚT BẤM DƯỚI ĐÁY CHUẨN GAME THIẾU NHI 3D -->
        <div class="flex items-center justify-between px-2 sm:px-6 pb-1">
          <button onclick="RacerScreen.moveLeft()" aria-label="Lái xe sang làn bên trái" class="px-4 sm:px-8 md:px-10 py-2.5 sm:py-3 md:py-3.5 rounded-2xl md:rounded-3xl bg-gradient-to-b from-sky-400 via-blue-500 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white font-black text-sm sm:text-base md:text-xl shadow-[0_6px_0_#1e3a8a,0_10px_16px_rgba(0,0,0,0.25)] active:shadow-none active:translate-y-1.5 border border-sky-300 transition-all flex items-center gap-1.5 sm:gap-2 select-none cursor-pointer">
            <span class="text-lg sm:text-xl md:text-2xl" aria-hidden="true">⬅️</span>
            <span>Sang trái</span>
          </button>

          <span class="px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-500 font-bold text-xs md:text-sm hidden sm:inline shadow-sm">
            Chạm vào làn hoặc bấm ⬅️ ➡️ để bẻ lái
          </span>

          <button onclick="RacerScreen.moveRight()" aria-label="Lái xe sang làn bên phải" class="px-4 sm:px-8 md:px-10 py-2.5 sm:py-3 md:py-3.5 rounded-2xl md:rounded-3xl bg-gradient-to-b from-amber-400 via-orange-500 to-orange-600 hover:from-amber-300 hover:to-orange-500 text-white font-black text-sm sm:text-base md:text-xl shadow-[0_6px_0_#9a3412,0_10px_16px_rgba(0,0,0,0.25)] active:shadow-none active:translate-y-1.5 border border-amber-200 transition-all flex items-center gap-1.5 sm:gap-2 select-none cursor-pointer">
            <span>Sang phải</span>
            <span class="text-lg sm:text-xl md:text-2xl" aria-hidden="true">➡️</span>
          </button>
        </div>

        <!-- MODAL GARA CHỌN XE ĐẦU MÀN CHƠI & ĐỔI XE -->
        <div id="racer-garage-modal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 transition-opacity duration-300 hidden">
          <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl border-4 border-amber-300 p-4 md:p-6 flex flex-col items-center max-h-[92vh] overflow-y-auto">
            <!-- Tiêu đề Gara -->
            <div class="text-center mb-3">
              <h2 class="text-2xl md:text-3xl font-black text-slate-800 flex items-center justify-center gap-2">
                <span>🚗</span>
                <span>GARA XE CỦA BÉ ĐẬU</span>
                <span>🏁</span>
              </h2>
              <p class="text-slate-500 font-bold text-xs md:text-sm mt-0.5">Đậu chạm chọn chiếc xe con thích để xuất phát nhé!</p>
            </div>

            <!-- Danh sách 4 loại xe (Grid 2x2) -->
            <div id="garage-cards-container" class="grid grid-cols-2 gap-3 w-full mb-4">
              ${this.getGarageCardsHTML()}
            </div>

            <!-- Nút Xuất Phát -->
            <button onclick="RacerScreen.confirmCarAndStart()" class="w-full py-3.5 md:py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-slate-900 font-black text-xl md:text-2xl shadow-lg border-2 border-white transition-all flex items-center justify-center gap-3">
              <span>🏁</span>
              <span>XUẤT PHÁT ĐUA XE!</span>
              <span>🏎️💨</span>
            </button>
          </div>
        </div>
      </div>
    `;
    this.updateCarPosition();
    this.updateHeartsUI();
  },

  // Tạo HTML danh sách các xe trong Gara
  getGarageCardsHTML() {
    return Object.values(this.VEHICLE_CONFIGS).map(car => {
      const isSelected = (this.selectedCar === car.id);
      const isBicycle = (car.id === "bicycle");

      if (isBicycle) {
        const activeClass = isSelected
          ? "ring-4 ring-amber-400 bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-100 border-amber-400 scale-[1.01] shadow-lg"
          : "border-amber-300 bg-gradient-to-r from-amber-50/90 to-yellow-50/80 hover:bg-amber-100/80 shadow-sm";

        return `
          <div onclick="RacerScreen.selectCar('${car.id}')" class="col-span-2 garage-car-card cursor-pointer rounded-2xl border-2 p-3 flex items-center justify-between transition-all duration-200 relative ${activeClass}" id="car-card-${car.id}">
            <div class="h-28 md:h-32 w-24 md:w-28 shrink-0 flex items-center justify-center p-1">
              ${car.renderSVG()}
            </div>
            <div class="flex-1 ml-3 text-left">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] md:text-xs bg-amber-400 text-slate-900 px-2.5 py-0.5 rounded-full font-black shadow-xs">⭐ Siêu đặc biệt</span>
                ${isSelected ? '<span class="bg-emerald-500 text-white text-[10px] md:text-xs px-2.5 py-0.5 rounded-full font-black shadow-xs">Đang chọn</span>' : ''}
              </div>
              <div class="font-black text-slate-900 text-base md:text-lg mt-1 flex items-center gap-1.5">
                <span>${car.nameVi}</span>
              </div>
              <p class="text-xs font-bold text-slate-600 mt-0.5">Bé Đậu đạp xe chở em cùng đua tài hứng sao!</p>
            </div>
          </div>
        `;
      }

      const activeClass = isSelected
        ? "ring-4 ring-amber-400 bg-amber-50/90 border-amber-400 scale-[1.02] shadow-md"
        : "border-slate-200 bg-slate-50/80 hover:bg-slate-100";

      return `
        <div onclick="RacerScreen.selectCar('${car.id}')" class="garage-car-card cursor-pointer rounded-2xl border-2 p-2.5 flex flex-col items-center justify-between transition-all duration-200 ${activeClass}" id="car-card-${car.id}">
          <div class="w-full h-28 md:h-32 flex items-center justify-center p-1 relative">
            <div class="w-20 md:w-24 h-full flex items-center justify-center">
              ${car.renderSVG()}
            </div>
            ${isSelected ? '<span class="absolute top-1 right-1 bg-amber-400 text-slate-900 text-[10px] md:text-xs px-2 py-0.5 rounded-full font-black shadow-sm">Đang chọn</span>' : ''}
          </div>
          <div class="text-center mt-1 w-full">
            <div class="font-black text-slate-800 text-sm md:text-base">${car.nameVi}</div>
            <div class="text-xs font-bold text-slate-500 uppercase tracking-wide">${car.nameEn}</div>
          </div>
        </div>
      `;
    }).join("");
  },

  // Cập nhật lại giao diện các thẻ trong Gara
  updateGarageCardsUI() {
    const container = document.getElementById("garage-cards-container");
    if (container) {
      container.innerHTML = this.getGarageCardsHTML();
    }
  },

  // Mở Gara chọn xe
  openGarage(isStartOfGame = false) {
    this.isRacing = false;
    this.isWaitingForQuestion = false;
    this.isSpawningWave = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.updateGarageCardsUI();
    const modal = document.getElementById("racer-garage-modal");
    if (modal) {
      modal.classList.remove("hidden");
    }
    // Nếu chưa nạp trước lượt 1 thì chuẩn bị ngay
    if (!this.nextWaveData) {
      this.nextWaveData = this.prepareWaveData();
    }
  },

  // Đóng Gara và xác nhận xe đã chọn
  confirmCarAndStart() {
    const modal = document.getElementById("racer-garage-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
    this.getAudioContext();
    this.updateCarSVG();
    this.startContinuousLoop();
    this.startNextWave();
    // Bắt đầu nạp xen kẽ các câu khen ngợi nhẹ nhàng sau khi đã xuất phát
    this.preloadPraisesStaggered();
  },

  // Chạm chọn 1 loại xe trong Gara
  selectCar(carId) {
    if (!this.VEHICLE_CONFIGS[carId]) return;
    this.selectedCar = carId;
    try {
      localStorage.setItem("dau_selected_car", carId);
    } catch (e) {
      console.warn("Could not save car to localStorage", e);
    }
    this.updateGarageCardsUI();
    this.updateCarSVG();
  },

  // Cập nhật lại SVG hoặc hình ảnh của xe trên đường đua
  updateCarSVG() {
    const inner = document.getElementById("car-inner");
    if (inner) {
      inner.innerHTML = this.getCarSVG(this.selectedCar);
      if (this.selectedCar === "bicycle") {
        inner.className = "w-[85%] max-w-[140px] h-32 md:h-36 flex items-center justify-center transition-transform duration-200";
      } else {
        inner.className = "w-[78%] max-w-[130px] aspect-[100/150] flex items-center justify-center transition-transform duration-200";
      }
    }
  },

  // Cài đặt cử chỉ vuốt (swipe left/right) trên màn hình cảm ứng
  setupSwipeListeners() {
    const track = document.getElementById("racer-track");
    if (!track) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    track.addEventListener("touchstart", (e) => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    }, { passive: true });

    track.addEventListener("touchend", (e) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const deltaX = touchEndX - touchStartX;
        const deltaY = touchEndY - touchStartY;
        const deltaTime = Date.now() - touchStartTime;

        // Nhận diện vuốt ngang: khoảng cách ngang tối thiểu 35px, góc ngang hơn dọc, thời gian < 600ms
        if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) && deltaTime < 600) {
          if (deltaX < 0) {
            this.moveLeft();
          } else {
            this.moveRight();
          }
        }
      }
    }, { passive: true });
  },

  // Chọn tốc độ trôi (14s: Siêu chậm, 10s: Chậm rãi, 7s: Vừa phải)
  setSpeed(seconds) {
    this.speedDuration = Number(seconds) || 14;
    try {
      localStorage.setItem("dau_racer_speed", this.speedDuration.toString());
    } catch (e) {
      console.warn("Could not save speed to localStorage", e);
    }
    const btnSuper = document.getElementById("btn-speed-super-slow");
    const btnSlow = document.getElementById("btn-speed-slow");
    const btnMed = document.getElementById("btn-speed-medium");
    if (btnSuper && btnSlow && btnMed) {
      btnSuper.className = (this.speedDuration === 14)
        ? "px-2 md:px-2.5 py-1.5 rounded-xl transition-all bg-amber-400 text-slate-900 shadow-sm"
        : "px-2 md:px-2.5 py-1.5 rounded-xl transition-all text-slate-600 hover:bg-slate-100";
      btnSlow.className = (this.speedDuration === 10)
        ? "px-2 md:px-2.5 py-1.5 rounded-xl transition-all bg-amber-400 text-slate-900 shadow-sm"
        : "px-2 md:px-2.5 py-1.5 rounded-xl transition-all text-slate-600 hover:bg-slate-100";
      btnMed.className = (this.speedDuration === 7)
        ? "px-2 md:px-2.5 py-1.5 rounded-xl transition-all bg-amber-400 text-slate-900 shadow-sm"
        : "px-2 md:px-2.5 py-1.5 rounded-xl transition-all text-slate-600 hover:bg-slate-100";
    }
  },

  // Cập nhật huy hiệu Sao chặng đua
  updateStarsUI() {
    const el = document.getElementById("racer-session-stars");
    if (el) {
      el.textContent = this.sessionStars;
    }
  },

  updateHeartsUI() {
    this.updateStarsUI();
  },

  // Thoát game quay lại Home
  exitGame() {
    this.isRacing = false;
    this.isWaitingForQuestion = false;
    this.isSpawningWave = false;
    this.nextWaveData = null;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    AppState.stopAudio();
    AppState.showScreen("screen-home");
  },

  // VÒNG LẶP CHUYỂN ĐỘNG LIÊN TỤC 100% (KHÔNG BAO GIỜ DỪNG KHI VA CHẠM)
  startContinuousLoop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.isRacing = true;

    const loop = (currentTime) => {
      if (!this.isRacing) return;

      this.updateWave(currentTime);

      this.animId = requestAnimationFrame(loop);
    };

    this.animId = requestAnimationFrame(loop);
  },

  // Cập nhật vị trí các thẻ: Đợi đọc xong câu hỏi mới trôi xuống với vận tốc ~14s / 10s / 7s
  updateWave(currentTime) {
    if (this.isWaitingForQuestion || !this.waveStartTime) {
      // Khi đang chờ cô giáo đọc xong câu hỏi: Thẻ giữ cố định tại vạch xuất phát (top: 2%)
      for (let lane = 0; lane < 3; lane++) {
        const el = document.getElementById(`lane-item-${lane}`);
        if (el && !this.cardsState[lane].hit) {
          el.style.top = "2%";
        }
      }
      return;
    }

    const elapsed = currentTime - this.waveStartTime;
    const durationMs = this.speedDuration * 1000;

    // Vị trí trôi từ 2% (vạch xuất phát) xuống mũi xe tại 68% trong đúng durationMs (~14s / 10s / 7s)
    const topPercentage = 2 + (elapsed / durationMs) * 66;

    // Cập nhật tọa độ độc lập cho từng thẻ
    for (let lane = 0; lane < 3; lane++) {
      const el = document.getElementById(`lane-item-${lane}`);
      if (!el) continue;

      if (this.cardsState[lane].hit) {
        // Chỉ riêng thẻ bị đâm đúng: Dừng đứng lại ngay tại tọa độ va chạm
        el.style.top = `${this.cardsState[lane].freezeTop}%`;
      } else {
        // Các thẻ còn lại: Vẫn giữ nguyên vận tốc và tiếp tục di chuyển trôi xuống dưới
        el.style.top = `${topPercentage}%`;
      }
    }

    // XỬ LÝ VA CHẠM KHI CỤM THẺ ĐI NGANG QUA ĐẦU XE (tại 68% chiều cao đường đua)
    if (!this.collisionHandled && topPercentage >= 68) {
      this.collisionHandled = true;
      this.handleCollision(topPercentage);
    }

    // KHI CÁC THẺ TRÔI QUA HẲN ĐÁY MÀN HÌNH (>= 115%): NỐI TIẾP CỤM TỪ MỚI MƯỢT MÀ
    if (topPercentage >= 115) {
      if (!this.isSpawningWave) {
        this.startNextWave();
      }
    }
  },

  // Thả đợt 3 từ vựng mới nối tiếp mượt mà
  async startNextWave(isRetry = false) {
    if (!this.isRacing || this.isSpawningWave) return;
    this.isSpawningWave = true;

    // Sử dụng bộ dữ liệu đã được tính toán & nạp âm thanh trước (Pipeline pre-caching)
    let waveData = null;
    if (!isRetry && this.nextWaveData) {
      waveData = this.nextWaveData;
      this.nextWaveData = null;
    } else {
      waveData = this.prepareWaveData(isRetry ? this.currentWord : null);
    }

    if (!waveData) {
      this.isSpawningWave = false;
      return;
    }

    this.currentWord = waveData.word;
    this.targetLaneIndex = waveData.targetLaneIndex;
    this.options = waveData.options;
    this.currentTemplate = waveData.template;
    this.preloadPromise = waveData.preloadPromise;

    // Cập nhật biểu ngữ câu hỏi to rõ phía trên đường đua
    const keywordEl = document.getElementById("racer-keyword-display");
    if (keywordEl) {
      if (AppState.voiceMode === "bilingual") {
        keywordEl.textContent = this.currentTemplate.display(this.currentWord.en);
      } else {
        keywordEl.textContent = this.currentTemplate.enOnly(this.currentWord.en);
      }
    }

    // Khởi tạo trạng thái chuyển động độc lập cho 3 thẻ
    this.cardsState = [
      { hit: false, freezeTop: 0 },
      { hit: false, freezeTop: 0 },
      { hit: false, freezeTop: 0 }
    ];
    this.collisionHandled = false;

    // Cập nhật nội dung & đặt 3 thẻ lớn 90% DỪNG TẠI VẠCH XUẤT PHÁT (top: 2%)
    for (let lane = 0; lane < 3; lane++) {
      const itemEl = document.getElementById(`lane-item-${lane}`);
      if (itemEl) {
        const item = this.options[lane];
        itemEl.style.top = "2%";
        itemEl.style.opacity = "1";
        itemEl.classList.remove("shake-wrong", "border-rose-500");
        itemEl.classList.add("border-amber-300");

        const visualHtml = item.word.image_url ? `
          <div class="w-full aspect-square rounded-2xl overflow-hidden relative flex items-center justify-center bg-gradient-to-b from-slate-50 to-amber-50/40 p-1.5 shadow-inner border border-amber-100/80">
            <img src="${item.word.image_url}" alt="${item.word.en}" class="w-full h-full object-contain rounded-xl" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div style="display:none;" class="w-full h-full items-center justify-center text-5xl md:text-6xl filter drop-shadow-sm">
              ${item.word.visual}
            </div>
          </div>
        ` : `
          <div class="w-full aspect-square flex items-center justify-center text-5xl md:text-6xl filter drop-shadow-sm bg-amber-50/60 rounded-2xl border border-amber-100">
            ${item.word.visual}
          </div>
        `;

        itemEl.innerHTML = `
          ${visualHtml}
          <div class="w-full mt-1 px-1 py-0.5 rounded-xl bg-gradient-to-r from-amber-100 via-amber-200 to-amber-100 border border-amber-300/80 shadow-sm">
            <span class="text-xs md:text-sm font-black text-slate-900 capitalize leading-tight py-0.5 block truncate tracking-wide">${item.word.en}</span>
          </div>
        `;
      }
    }

    const banner = document.getElementById("racer-prompt-banner");
    if (banner) {
      banner.textContent = `Đậu lắng nghe câu hỏi rồi lái xe nhé! 👂🚗`;
    }

    // TẠM DỪNG CỤM THẺ TẠI VẠCH XUẤT PHÁT TRONG KHI CHỜ ÂM THANH BẮT ĐẦU PHÁT
    this.isWaitingForQuestion = true;
    this.waveStartTime = null;

    let waveReleased = false;
    const releaseWave = () => {
      if (waveReleased) return;
      waveReleased = true;
      if (!this.isRacing) {
        this.isSpawningWave = false;
        return;
      }
      // ĐỒNG BỘ TUYỆT ĐỐI 0MS: Mở cờ cho thẻ rơi & gán mốc thời gian rơi
      this.isWaitingForQuestion = false;
      this.waveStartTime = performance.now();
      this.isSpawningWave = false;

      if (banner) {
        const config = this.VEHICLE_CONFIGS[this.selectedCar];
        const carName = config ? config.nameVi : "Xe";
        const icon = config?.icon || "🚗";
        banner.textContent = `Đậu lái ${carName} đón hình "${this.currentWord.en}" nào! ${icon}💨`;
      }

      // ĐÓN ĐẦU ỐNG DẪN (Pipeline Pre-caching): Khi xe bắt đầu chạy, tính trước & nạp âm thanh cho Lượt N+1
      setTimeout(() => {
        if (this.isRacing && !this.nextWaveData) {
          this.nextWaveData = this.prepareWaveData();
        }
      }, 1000);
    };

    // Đợi tín hiệu âm thanh bắt đầu phát thực sự (hoặc tối đa 4500ms an toàn nếu tắt tiếng / mạng chậm)
    const promptPromise = this.playQuestionPrompt(releaseWave);
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 4500));
    await Promise.race([promptPromise, timeoutPromise]);
    releaseWave();
  },

  // Phát câu hỏi nối âm liền mạch không khoảng khựng, kích hoạt onAudioStarted ngay khi có tiếng
  async playQuestionPrompt(onAudioStarted) {
    if (!this.currentWord || !this.currentTemplate) {
      if (typeof onAudioStarted === "function") onAudioStarted();
      return;
    }

    if (AppState.voiceMode === "bilingual") {
      try {
        let urls = null;
        if (this.preloadPromise) {
          urls = await this.preloadPromise;
        }
        if (urls && Array.isArray(urls) && urls.every(u => !!u)) {
          await this.playSeamlessSequence(urls, onAudioStarted);
        } else {
          const parts = this.currentTemplate.parts(this.currentWord.en);
          let started = false;
          const trigger = () => {
            if (!started) {
              started = true;
              if (typeof onAudioStarted === "function") onAudioStarted();
            }
          };
          AppState.audioPlayer.addEventListener("playing", trigger, { once: true });
          AppState.audioPlayer.addEventListener("play", trigger, { once: true });
          for (const p of parts) {
            await AppState.speakText(p.text, p.lang);
          }
          trigger();
        }
      } catch (e) {
        console.error("Lỗi phát câu hỏi song ngữ racer:", e);
        if (typeof onAudioStarted === "function") onAudioStarted();
      }
    } else {
      const enText = this.currentTemplate.enOnly(this.currentWord.en);
      let started = false;
      const trigger = () => {
        if (!started) {
          started = true;
          if (typeof onAudioStarted === "function") onAudioStarted();
        }
      };
      AppState.audioPlayer.addEventListener("playing", trigger, { once: true });
      AppState.audioPlayer.addEventListener("play", trigger, { once: true });
      await AppState.speakText(enText, "en");
      trigger();
    }
  },

  // Kích hoạt HIỆU ỨNG VỠ TUNG (Shatter / Explosion Particles)
  triggerShatterExplosion(laneIndex, imageUrl, emojiVisual, impactTop) {
    const track = document.getElementById("racer-track");
    const shatterContainer = document.getElementById("shatter-container");
    if (!track || !shatterContainer) return;

    // Rung nhẹ đường đua tạo cảm giác va chạm hoành tráng
    track.classList.remove("track-rumble");
    void track.offsetWidth; // Force reflow
    track.classList.add("track-rumble");
    setTimeout(() => track.classList.remove("track-rumble"), 400);

    // Điểm nổ ở trung tâm làn xe va chạm
    const lanePercent = (laneIndex * 33.333) + 16.666;
    const topPercent = impactTop || 68;

    shatterContainer.innerHTML = "";

    // 1. Vòng sóng xung kích chớp sáng (Shockwave ring)
    const shockwave = document.createElement("div");
    shockwave.className = "absolute rounded-full border-4 border-amber-300 pointer-events-none";
    shockwave.style.left = `calc(${lanePercent}% - 50px)`;
    shockwave.style.top = `calc(${topPercent}% - 50px)`;
    shockwave.style.width = "100px";
    shockwave.style.height = "100px";
    shockwave.style.animation = "shockwave 0.7s ease-out forwards";
    shatterContainer.appendChild(shockwave);

    // 2. Mảnh vỡ hình ảnh / con vật (12 mảnh bay tỏa tròn)
    const shardCount = 12;
    for (let i = 0; i < shardCount; i++) {
      const shard = document.createElement("div");
      shard.className = "absolute rounded-lg overflow-hidden pointer-events-none shadow-md";
      
      const size = 20 + Math.random() * 16;
      shard.style.width = `${size}px`;
      shard.style.height = `${size}px`;
      shard.style.left = `calc(${lanePercent}% - ${size / 2}px)`;
      shard.style.top = `calc(${topPercent}% - ${size / 2}px)`;

      if (imageUrl) {
        shard.style.backgroundImage = `url(${imageUrl})`;
        shard.style.backgroundSize = "80px 80px";
        shard.style.backgroundPosition = `${(i % 3) * 50}% ${(Math.floor(i / 3)) * 50}%`;
        shard.style.border = "1.5px solid white";
      } else {
        shard.innerHTML = `<span style="font-size: 18px;">${emojiVisual || '✨'}</span>`;
      }

      const angle = (i / shardCount) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
      const distance = 90 + Math.random() * 130;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 40; // Bay vồng lên trên
      const rot = (Math.random() - 0.5) * 720;

      shard.style.transition = "transform 0.85s cubic-bezier(0.1, 0.8, 0.2, 1), opacity 0.85s ease-out";
      shatterContainer.appendChild(shard);

      requestAnimationFrame(() => {
        shard.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${0.3 + Math.random() * 0.4})`;
        shard.style.opacity = "0";
      });
    }

    // 3. Hệ thống hạt ngôi sao & tia sáng lấp lánh (10 hạt)
    const starIcons = ["⭐", "✨", "🌟", "💫", "🎉", "💛", "🔥"];
    for (let j = 0; j < 10; j++) {
      const star = document.createElement("div");
      star.className = "absolute pointer-events-none text-2xl select-none";
      star.textContent = starIcons[Math.floor(Math.random() * starIcons.length)];
      star.style.left = `calc(${lanePercent}% - 12px)`;
      star.style.top = `calc(${topPercent}% - 12px)`;

      const angle = Math.random() * 2 * Math.PI;
      const distance = 60 + Math.random() * 110;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 30;

      star.style.transition = "transform 0.8s cubic-bezier(0.15, 0.85, 0.35, 1.2), opacity 0.8s ease-out";
      shatterContainer.appendChild(star);

      requestAnimationFrame(() => {
        star.style.transform = `translate(${dx}px, ${dy}px) scale(${1.2 + Math.random() * 0.6})`;
        star.style.opacity = "0";
      });
    }

    // Dọn dẹp sau 900ms
    setTimeout(() => {
      shatterContainer.innerHTML = "";
    }, 900);
  },

  // Xử lý va chạm: Độc lập từng thẻ, KHÔNG DỪNG VÒNG LẶP ĐƯỜNG ĐUA
  async handleCollision(currentTop) {
    const hitItem = this.options[this.playerLane];

    if (hitItem && hitItem.isTarget) {
      // 1. ĐÂM TRÚNG HÌNH ĐÚNG!
      AppState.addStars(2); // Cộng +2 sao vào tổng
      this.sessionStars += 2;
      this.updateStarsUI();

      // Âm thanh chiến thắng Ting-ting tức thì 0ms
      this.playVictoryChime();

      // Hiệu ứng chớp sáng rực rỡ khung xe (Car Victory Flash)
      const carInner = document.getElementById("car-inner");
      if (carInner) {
        carInner.classList.remove("car-victory-flash");
        void carInner.offsetWidth;
        carInner.classList.add("car-victory-flash");
        setTimeout(() => {
          if (carInner) carInner.classList.remove("car-victory-flash");
        }, 600);
      }

      // CHỈ RIÊNG THẺ BỊ ĐÂM: Đặt hit = true và dừng đứng lại ngay tại tọa độ va chạm
      this.cardsState[this.playerLane].hit = true;
      this.cardsState[this.playerLane].freezeTop = currentTop;

      const targetCard = document.getElementById(`lane-item-${this.playerLane}`);
      if (targetCard) {
        targetCard.style.opacity = "0"; // Ẩn thẻ ban đầu để mảnh vỡ bung ra tại chỗ
      }

      // Kích hoạt HIỆU ỨNG VỠ TUNG tại tọa độ va chạm
      this.triggerShatterExplosion(
        this.playerLane,
        hitItem.word.image_url,
        hitItem.word.visual,
        currentTop
      );

      // (2 THẺ CÒN LẠI VẪN TIẾP TỤC TRÔI XUỐNG DƯỚI TỰ NHIÊN NHỜ VÒNG LẶP KHÔNG DỪNG)

      // Lời khen ngợi hào hứng của cô giáo
      const isVi = (AppState.voiceMode === "bilingual");
      const enPraises = [
        "Awesome driving, Đậu!",
        "Spot on, Đậu! Two stars!",
        "Excellent, great job, Đậu!",
        "Hurray, you did it, Đậu!"
      ];
      const praise = isVi
        ? this.getRandomPraise()
        : enPraises[Math.floor(Math.random() * enPraises.length)];
      const praiseLang = isVi ? "vi" : "en";

      const banner = document.getElementById("racer-prompt-banner");
      if (banner) {
        banner.innerHTML = `<span class="text-amber-300 font-black text-lg animate-bounce">🌟 ${praise} +2 ⭐</span>`;
      }

      // Phát câu khen đã tải sẵn từ bộ nhớ cache (pre-cache) với độ trễ cực ngắn 100ms để tiếng Ting! vang lên trước
      const praiseKey = `${praiseLang}_${praise}`;
      const preloadedUrl = this.preloadedPraises ? this.preloadedPraises[praiseKey] : null;

      setTimeout(() => {
        if (!this.isRacing) return;
        if (preloadedUrl) {
          this.playPreloadedAudio(preloadedUrl);
        } else {
          AppState.speakText(praise, praiseLang);
        }
      }, 100);

    } else {
      // 2. ĐÂM NHẦM HÌNH SAI!
      // Không dừng đường đua, không phạt thua; thẻ sai rung đỏ rồi vẫn tiếp tục trôi qua
      this.playBoingSound();

      const carInner = document.getElementById("car-inner");
      if (carInner) {
        carInner.classList.add("car-bounce");
        setTimeout(() => carInner.classList.remove("car-bounce"), 500);
      }

      // Thẻ sai rung nhẹ viền đỏ
      const wrongCard = document.getElementById(`lane-item-${this.playerLane}`);
      if (wrongCard) {
        wrongCard.classList.remove("border-amber-300");
        wrongCard.classList.add("shake-wrong");
      }

      const banner = document.getElementById("racer-prompt-banner");
      if (banner) {
        banner.innerHTML = `<span class="text-rose-300 font-black text-sm sm:text-base">⚠️ Chưa đúng rồi Đậu ơi, Đậu lái xe thử lại cùng cô nhé! 👉 "${this.currentWord.en}"</span>`;
      }

      // Cô giáo nhắc dịu dàng và tiếp tục trôi lượt tiếp theo để bé không bị mất nhịp đua xe
      if (AppState.voiceMode === "bilingual") {
        try {
          const viUrl = await this.fetchAudioUrl("Chưa đúng rồi Đậu ơi, Đậu lái xe thử lại cùng cô nhé!", "vi");
          const enUrl = await this.fetchAudioUrl(this.currentWord.en, "en");
          if (viUrl && enUrl) {
            await this.playSeamlessSequence([viUrl, enUrl]);
          } else {
            AppState.speakText("Chưa đúng rồi Đậu ơi, Đậu lái xe thử lại cùng cô nhé!", "vi");
          }
        } catch (e) {
          console.error("Lỗi âm thanh nhắc sai:", e);
        }
      } else {
        AppState.speakText(`Not quite! Try again, find the ${this.currentWord.en}!`, "en");
      }
    }
  },

  // Kích hoạt vệt khói xả nhỏ phía sau đuôi xe khi bẻ lái
  triggerSteeringSmoke() {
    const emitter = document.getElementById("car-smoke-emitter");
    if (!emitter) return;
    for (let i = 0; i < 3; i++) {
      const puff = document.createElement("div");
      puff.className = "absolute rounded-full bg-white/70 pointer-events-none filter blur-[0.5px]";
      const size = 10 + Math.random() * 8;
      puff.style.width = `${size}px`;
      puff.style.height = `${size}px`;
      puff.style.left = `calc(50% + ${(Math.random() - 0.5) * 36}px)`;
      puff.style.bottom = "-2px";
      puff.style.transition = "transform 0.35s ease-out, opacity 0.35s ease-out";
      emitter.appendChild(puff);
      requestAnimationFrame(() => {
        puff.style.transform = `translate(${(Math.random() - 0.5) * 20}px, ${14 + Math.random() * 12}px) scale(1.6)`;
        puff.style.opacity = "0";
      });
      setTimeout(() => puff.remove(), 400);
    }
  },

  // Chuyển làn xe với cảm giác lái nghiêng thân xe
  switchLane(laneIndex) {
    if (laneIndex < 0 || laneIndex > 2 || laneIndex === this.playerLane) return;
    const dir = laneIndex > this.playerLane ? 1 : -1;
    this.playerLane = laneIndex;
    this.updateCarPosition(dir);
  },

  moveLeft() {
    if (this.playerLane > 0) {
      this.playerLane--;
      this.updateCarPosition(-1);
    }
  },

  moveRight() {
    if (this.playerLane < 2) {
      this.playerLane++;
      this.updateCarPosition(1);
    }
  },

  updateCarPosition(direction = 0) {
    const car = document.getElementById("player-car");
    const carInner = document.getElementById("car-inner");
    const laneHighlight = document.getElementById("lane-active-highlight");
    if (car) {
      car.style.left = `${this.playerLane * 33.333}%`;
    }
    if (laneHighlight) {
      laneHighlight.style.left = `${this.playerLane * 33.333}%`;
    }
    if (carInner && direction !== 0) {
      const angle = direction > 0 ? 10 : -10;
      carInner.style.transform = `rotate(${angle}deg) scale(1.03)`;
      this.triggerSteeringSmoke();
      setTimeout(() => {
        if (carInner && !carInner.classList.contains("car-bounce")) {
          carInner.style.transform = "rotate(0deg) scale(1)";
        }
      }, 260);
    }
  }
};

window.RacerScreen = RacerScreen;
