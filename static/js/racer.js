// Trò chơi Đua xe 3 làn đường học từ vựng cho bé Đậu
const RacerScreen = {
  selectedCar: localStorage.getItem("dau_selected_car") || "police",
  currentWord: null,
  options: [], // 3 lựa chọn tương ứng 3 làn: [ { word, isTarget }, ... ]
  playerLane: 1, // 0: Làn trái, 1: Làn giữa, 2: Làn phải
  speedDuration: (() => {
    const saved = localStorage.getItem("dau_racer_speed");
    const val = saved ? parseFloat(saved) : 14;
    return [14, 10, 7].includes(val) ? val : 14; // Mặc định 14s (Siêu chậm, thong thả cho bé 5 tuổi)
  })(),
  lives: 3,
  isRacing: false,
  isWaitingForQuestion: false,
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

  // Các mẫu câu hỏi sinh động xoay vòng ngẫu nhiên (không lặp lại câu liền trước)
  QUESTION_TEMPLATES: [
    {
      display: (en) => `Đậu ơi, "${en}" ở đâu?`,
      parts: (en) => [
        { text: "Đậu ơi,", lang: "vi" },
        { text: en, lang: "en" },
        { text: "ở đâu?", lang: "vi" }
      ],
      enOnly: (en) => `Where is the ${en}, Đậu?`
    },
    {
      display: (en) => `Tìm cho cô từ "${en}" nào!`,
      parts: (en) => [
        { text: "Tìm cho cô từ:", lang: "vi" },
        { text: en, lang: "en" }
      ],
      enOnly: (en) => `Find the ${en} for me, Đậu!`
    },
    {
      display: (en) => `Đố Đậu lái xe trúng hình "${en}"!`,
      parts: (en) => [
        { text: "Đố Đậu lái xe trúng hình:", lang: "vi" },
        { text: en, lang: "en" }
      ],
      enOnly: (en) => `Steer to the ${en}, Đậu!`
    },
    {
      display: (en) => `Bé Đậu chỉ cho cô "${en}" ở làn nào nhé!`,
      parts: (en) => [
        { text: "Bé Đậu chỉ cho cô hình:", lang: "vi" },
        { text: en, lang: "en" }
      ],
      enOnly: (en) => `Show me which lane has the ${en}, Đậu!`
    }
  ],

  // Lời khen ngợi hào hứng khi đúng (xoay vòng không lặp lại)
  PRAISES_VI: [
    "Đậu xuất sắc quá!",
    "Tuyệt vời, 10 điểm!",
    "Chính xác luôn, Đậu lái xe giỏi quá!",
    "Hoan hô bé Đậu, đúng rồi!"
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

  // Hiệu ứng âm thanh tổng hợp Web Audio API (không phụ thuộc file ngoài, không độ trễ)
  playVictoryChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // Hợp âm C5, E5, G5, C6 vui tươi
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
      });
    } catch (e) {
      // Bỏ qua nếu trình duyệt chặn
    }
  },

  playBoingSound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
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
      // Bỏ qua nếu trình duyệt chặn
    }
  },

  // Lấy URL audio từ backend TTS
  async fetchAudioUrl(text, lang) {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data ? data.url : null;
    } catch (err) {
      console.error("Lỗi tải trước âm thanh racer:", err);
      return null;
    }
  },

  // Phát chuỗi âm thanh nối liền mạch không khoảng khựng, tuân thủ playbackRate
  playSeamlessSequence(urlList) {
    return new Promise((resolve) => {
      AppState.stopAudio();
      const player = AppState.audioPlayer;
      if (!urlList || urlList.length === 0) {
        resolve();
        return;
      }

      AppState.currentAudioResolve = resolve;
      let currentIndex = 0;

      const cleanup = () => {
        player.ontimeupdate = null;
        player.onended = null;
        player.onerror = null;
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

        player.src = url;
        if (AppState.playbackRate) {
          player.playbackRate = AppState.playbackRate;
          player.defaultPlaybackRate = AppState.playbackRate;
        }
        player.play().catch(cleanup);
      };

      playItem(urlList[0]);
    });
  },

  // Cấu hình & Thiết kế đồ họa SVG cho 4 loại xe cỡ lớn
  VEHICLE_CONFIGS: {
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

  // Lấy SVG của loại xe đang chọn
  getCarSVG(carId) {
    const config = this.VEHICLE_CONFIGS[carId] || this.VEHICLE_CONFIGS.police;
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
    this.lives = 3;
    this.playerLane = 1;
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
        <!-- THANH TRÊN CÙNG: 2 TẦNG THOÁNG ĐÃNG (HẾT CẮT CỤT CHỮ) -->
        <div class="flex flex-col w-full px-2 z-20 gap-1.5">
          <!-- TẦNG 1: Điều hướng, Nút Đổi xe, Nút Tốc độ 3 mức & Mạng sống -->
          <div class="flex items-center justify-between w-full">
            <!-- Cụm nút trái: Chủ đề, Đổi xe & Chọn 3 mức tốc độ -->
            <div class="flex items-center gap-1.5 md:gap-2">
              <button onclick="RacerScreen.exitGame()" class="px-3 py-1.5 md:py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1 text-xs md:text-sm">
                <span>⬅️</span>
                <span class="hidden sm:inline">Chủ đề</span>
              </button>
              <button onclick="RacerScreen.openGarage(false)" class="px-3 py-1.5 md:py-2 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-black shadow-sm border border-amber-300 active:scale-95 transition-all flex items-center gap-1 text-xs md:text-sm">
                <span>🚗</span>
                <span class="hidden sm:inline">Đổi xe</span>
              </button>

              <!-- NÚT CHỌN 3 MỨC TỐC ĐỘ: 🐌 Siêu chậm (~14s) / 🐢 Chậm rãi (~10s) / 🚗 Vừa phải (~7s) -->
              <div class="flex items-center gap-0.5 md:gap-1 bg-white/95 p-1 rounded-2xl shadow-sm border border-slate-200 text-[11px] md:text-xs font-black">
                <button id="btn-speed-super-slow" onclick="RacerScreen.setSpeed(14)" class="px-2 md:px-2.5 py-1 rounded-xl transition-all ${this.speedDuration === 14 ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
                  🐌 Siêu chậm
                </button>
                <button id="btn-speed-slow" onclick="RacerScreen.setSpeed(10)" class="px-2 md:px-2.5 py-1 rounded-xl transition-all ${this.speedDuration === 10 ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
                  🐢 Chậm rãi
                </button>
                <button id="btn-speed-medium" onclick="RacerScreen.setSpeed(7)" class="px-2 md:px-2.5 py-1 rounded-xl transition-all ${this.speedDuration === 7 ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
                  🚗 Vừa phải
                </button>
              </div>
            </div>

            <!-- Cụm phải: Mạng sống ❤️❤️❤️ -->
            <div id="racer-hearts" class="flex items-center text-base md:text-xl tracking-widest bg-white/95 px-3 py-1.5 rounded-2xl shadow-sm border border-rose-100 shrink-0">
              ❤️❤️❤️
            </div>
          </div>

          <!-- TẦNG 2: BIỂU NGỮ CÂU HỎI RỘNG TOÀN DIỆN KIÊM NÚT LOA (KHÔNG BAO GIỜ BỊ CẮT CỤT CHỮ) -->
          <div class="w-full flex justify-center">
            <button onclick="RacerScreen.playQuestionPrompt()" class="w-full max-w-2xl py-2 px-4 md:px-6 rounded-2xl md:rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-400 hover:from-amber-400 hover:to-yellow-500 active:scale-[0.98] text-slate-900 font-black text-sm sm:text-base md:text-lg shadow-md border-2 border-white flex items-center justify-center gap-2 md:gap-3 transition-all cursor-pointer">
              <span class="text-lg md:text-2xl animate-pulse shrink-0">🔊</span>
              <span id="racer-keyword-display" class="tracking-wide text-center">Đậu ơi, tìm từ vựng...</span>
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
          <div onclick="RacerScreen.switchLane(0)" class="flex-1 h-full relative cursor-pointer active:bg-white/5 transition-colors flex justify-center z-10">
            <div id="lane-item-0" class="absolute top-[2%] left-0 right-0 mx-auto w-[90%] max-w-[210px] bg-white rounded-[1.75rem] shadow-[0_12px_24px_rgba(0,0,0,0.35),0_4px_8px_rgba(0,0,0,0.2)] border-4 border-amber-300 border-b-[6px] border-b-amber-400 flex flex-col items-center justify-between p-2 text-center pointer-events-none overflow-hidden transition-opacity">
            </div>
          </div>

          <!-- LÀN 1 (Giữa) -->
          <div onclick="RacerScreen.switchLane(1)" class="flex-1 h-full relative cursor-pointer active:bg-white/5 transition-colors flex justify-center z-10">
            <div id="lane-item-1" class="absolute top-[2%] left-0 right-0 mx-auto w-[90%] max-w-[210px] bg-white rounded-[1.75rem] shadow-[0_12px_24px_rgba(0,0,0,0.35),0_4px_8px_rgba(0,0,0,0.2)] border-4 border-amber-300 border-b-[6px] border-b-amber-400 flex flex-col items-center justify-between p-2 text-center pointer-events-none overflow-hidden transition-opacity">
            </div>
          </div>

          <!-- LÀN 2 (Phải) -->
          <div onclick="RacerScreen.switchLane(2)" class="flex-1 h-full relative cursor-pointer active:bg-white/5 transition-colors flex justify-center z-10">
            <div id="lane-item-2" class="absolute top-[2%] left-0 right-0 mx-auto w-[90%] max-w-[210px] bg-white rounded-[1.75rem] shadow-[0_12px_24px_rgba(0,0,0,0.35),0_4px_8px_rgba(0,0,0,0.2)] border-4 border-amber-300 border-b-[6px] border-b-amber-400 flex flex-col items-center justify-between p-2 text-center pointer-events-none overflow-hidden transition-opacity">
            </div>
          </div>

          <!-- XE CỦA BÉ ĐẬU Ở ĐÁY ĐƯỜNG ĐUA (Cỡ lớn 78% kèm chùm sáng đèn pha rọi trước) -->
          <div id="player-car" class="absolute bottom-4 w-1/3 flex flex-col justify-center items-center transition-all duration-200 pointer-events-none z-20" style="left: 33.333%;">
            <!-- Chùm sáng đèn pha rọi phía trước mũi xe -->
            <div class="w-[85%] max-w-[140px] h-32 -mb-6 headlight-cone pointer-events-none filter blur-[1px]"></div>
            <!-- Xe SVG cỡ lớn w-[78%] -->
            <div id="car-inner" class="w-[78%] max-w-[130px] aspect-[100/150] flex items-center justify-center transition-transform duration-200">
              ${this.getCarSVG(this.selectedCar)}
            </div>
            <!-- Vùng nhả khói xả đuôi xe khi bẻ lái -->
            <div id="car-smoke-emitter" class="absolute -bottom-2 w-full flex justify-center pointer-events-none"></div>
          </div>

          <!-- KHUNG HỆ THỐNG HẠT VỠ TUNG KHI XE ĐÂM ĐÚNG ĐÍCH -->
          <div id="shatter-container" class="absolute inset-0 pointer-events-none z-40 overflow-hidden"></div>

          <!-- LỚP PHỦ THÔNG BÁO LƯỢT ĐUA / HƯỚNG DẪN -->
          <div id="racer-prompt-banner" class="absolute top-5 inset-x-0 mx-auto w-fit px-6 py-2 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/25 text-white font-extrabold text-sm md:text-base shadow-xl text-center pointer-events-none z-30">
            Lắng nghe câu hỏi rồi lái xe nhé! 👂🚗
          </div>
        </div>

        <!-- BỘ ĐIỀU KHIỂN NÚT BẤM DƯỚI ĐÁY CHUẨN GAME THIẾU NHI 3D -->
        <div class="flex items-center justify-between px-3 md:px-6 pb-1">
          <button onclick="RacerScreen.moveLeft()" class="px-6 sm:px-8 md:px-10 py-3 md:py-3.5 rounded-2xl md:rounded-3xl bg-gradient-to-b from-sky-400 via-blue-500 to-blue-600 hover:from-sky-300 hover:to-blue-500 text-white font-black text-base md:text-xl shadow-[0_6px_0_#1e3a8a,0_10px_16px_rgba(0,0,0,0.25)] active:shadow-none active:translate-y-1.5 border border-sky-300 transition-all flex items-center gap-2 select-none cursor-pointer">
            <span class="text-xl md:text-2xl">⬅️</span>
            <span>SANG TRÁI</span>
          </button>

          <span class="px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-500 font-bold text-xs md:text-sm hidden sm:inline shadow-sm">
            Chạm vào làn, bấm ⬅️ ➡️ hoặc vuốt tay sang trái/phải
          </span>

          <button onclick="RacerScreen.moveRight()" class="px-6 sm:px-8 md:px-10 py-3 md:py-3.5 rounded-2xl md:rounded-3xl bg-gradient-to-b from-amber-400 via-orange-500 to-orange-600 hover:from-amber-300 hover:to-orange-500 text-white font-black text-base md:text-xl shadow-[0_6px_0_#9a3412,0_10px_16px_rgba(0,0,0,0.25)] active:shadow-none active:translate-y-1.5 border border-amber-200 transition-all flex items-center gap-2 select-none cursor-pointer">
            <span>SANG PHẢI</span>
            <span class="text-xl md:text-2xl">➡️</span>
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
              <p class="text-slate-500 font-bold text-xs md:text-sm mt-0.5">Bé Đậu chạm chọn chiếc xe yêu thích để xuất phát nhé!</p>
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

  // Tạo HTML danh sách 4 xe trong Gara
  getGarageCardsHTML() {
    return Object.values(this.VEHICLE_CONFIGS).map(car => {
      const isSelected = (this.selectedCar === car.id);
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
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    this.updateGarageCardsUI();
    const modal = document.getElementById("racer-garage-modal");
    if (modal) {
      modal.classList.remove("hidden");
    }
  },

  // Đóng Gara và xác nhận xe đã chọn
  confirmCarAndStart() {
    const modal = document.getElementById("racer-garage-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
    this.updateCarSVG();
    this.startContinuousLoop();
    this.startNextWave();
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

  // Cập nhật lại SVG của xe trên đường đua
  updateCarSVG() {
    const inner = document.getElementById("car-inner");
    if (inner) {
      inner.innerHTML = this.getCarSVG(this.selectedCar);
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

  // Cập nhật mạng sống ❤️
  updateHeartsUI() {
    const el = document.getElementById("racer-hearts");
    if (!el) return;
    let heartsStr = "";
    for (let i = 0; i < 3; i++) {
      heartsStr += (i < this.lives) ? "❤️" : "🖤";
    }
    el.textContent = heartsStr;
  },

  // Thoát game quay lại Home
  exitGame() {
    this.isRacing = false;
    this.isWaitingForQuestion = false;
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
      this.startNextWave();
    }
  },

  // Thả đợt 3 từ vựng mới nối tiếp mượt mà
  async startNextWave(isRetry = false) {
    if (!this.isRacing) return;
    const words = AppState.currentTopic.words;
    
    // Nếu là thử lại lượt vừa sai, giữ nguyên currentWord để bé làm chủ từ vựng
    if (!isRetry || !this.currentWord) {
      this.currentWord = words[Math.floor(Math.random() * words.length)];
    }
    
    // Chọn 2 từ sai
    const others = words.filter(w => w.id !== this.currentWord.id);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const distractors = others.slice(0, 2);

    // Xếp ngẫu nhiên vào 3 làn: 0, 1, 2
    this.targetLaneIndex = Math.floor(Math.random() * 3);
    this.options = [null, null, null];
    this.options[this.targetLaneIndex] = { word: this.currentWord, isTarget: true };

    let distractorIndex = 0;
    for (let lane = 0; lane < 3; lane++) {
      if (this.options[lane] === null) {
        this.options[lane] = { word: distractors[distractorIndex++], isTarget: false };
      }
    }

    // Chọn mẫu câu hỏi ngẫu nhiên (không lặp lại mẫu vừa hỏi)
    this.currentTemplate = this.getRandomTemplate();

    // Tải trước đồng thời toàn bộ audio của câu hỏi để nối âm tức thì
    if (AppState.voiceMode === "bilingual") {
      const parts = this.currentTemplate.parts(this.currentWord.en);
      this.preloadPromise = Promise.all(parts.map(p => this.fetchAudioUrl(p.text, p.lang)));
    } else {
      this.preloadPromise = Promise.all([
        this.fetchAudioUrl(this.currentTemplate.enOnly(this.currentWord.en), "en")
      ]);
    }

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
      banner.textContent = `Lắng nghe câu hỏi rồi lái xe nhé! 👂🚗`;
    }

    // TẠM DỪNG CỤM THẺ TẠI VẠCH XUẤT PHÁT TRONG KHI ĐỌC CÂU HỎI
    this.isWaitingForQuestion = true;
    this.waveStartTime = null;

    // Đợi phát âm xong câu hỏi (hoặc tối đa 2.5s nếu tắt tiếng / mạng chậm)
    const promptPromise = this.playQuestionPrompt();
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 2500));
    await Promise.race([promptPromise, timeoutPromise]);

    if (!this.isRacing) return;

    // NGAY KHI ĐỌC DỨT CÂU HỎI: BẮT ĐẦU CHO CỤM THẺ TRÔI XUỐNG
    this.isWaitingForQuestion = false;
    this.waveStartTime = performance.now();

    if (banner) {
      const carName = this.VEHICLE_CONFIGS[this.selectedCar]?.nameVi || "Xe";
      banner.textContent = `Lái ${carName} đón hình "${this.currentWord.en}" nào! 🚗💨`;
    }
  },

  // Phát câu hỏi nối âm liền mạch không khoảng khựng
  async playQuestionPrompt() {
    if (!this.currentWord || !this.currentTemplate) return;

    if (AppState.voiceMode === "bilingual") {
      try {
        let urls = null;
        if (this.preloadPromise) {
          urls = await this.preloadPromise;
        }
        if (urls && Array.isArray(urls) && urls.every(u => !!u)) {
          await this.playSeamlessSequence(urls);
        } else {
          const parts = this.currentTemplate.parts(this.currentWord.en);
          for (const p of parts) {
            await AppState.speakText(p.text, p.lang);
          }
        }
      } catch (e) {
        console.error("Lỗi phát câu hỏi song ngữ racer:", e);
      }
    } else {
      const enText = this.currentTemplate.enOnly(this.currentWord.en);
      await AppState.speakText(enText, "en");
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
      AppState.addStars(2); // Cộng +2 sao

      // Âm thanh chiến thắng Ting-ting tức thì
      this.playVictoryChime();

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

      // Lời khen ngợi hào hứng
      const praise = (AppState.voiceMode === "bilingual")
        ? this.getRandomPraise()
        : "Spot on, Đậu! You are amazing!";

      const banner = document.getElementById("racer-prompt-banner");
      if (banner) {
        banner.innerHTML = `<span class="text-amber-300 font-black text-lg animate-bounce">🌟 ${praise} +2 ⭐</span>`;
      }

      // Phát âm lời khen ngợi (không chặn vòng lặp trôi của 2 thẻ kia)
      AppState.speakText(praise, (AppState.voiceMode === "bilingual") ? "vi" : "en");

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
        banner.innerHTML = `<span class="text-rose-300 font-black text-base">⚠️ Chưa đúng rồi Đậu ơi, mình thử lại nhé! 👉 "${this.currentWord.en}"</span>`;
      }

      // Cô giáo nhắc dịu dàng và tiếp tục trôi lượt tiếp theo để bé không bị mất nhịp đua xe
      if (AppState.voiceMode === "bilingual") {
        try {
          const viUrl = await this.fetchAudioUrl("Chưa đúng rồi Đậu ơi, mình thử lại nhé!", "vi");
          const enUrl = await this.fetchAudioUrl(this.currentWord.en, "en");
          if (viUrl && enUrl) {
            await this.playSeamlessSequence([viUrl, enUrl]);
          } else {
            AppState.speakText("Chưa đúng rồi Đậu ơi, mình thử lại nhé!", "vi");
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
