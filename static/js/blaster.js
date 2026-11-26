// Trò chơi Phi Thuyền Phá Thiên Thạch cho bé Đậu cùng Cô giáo
const BlasterScreen = {
  topic: null,
  words: [],
  currentIndex: 0,
  totalTargets: 5,
  combo: 0,
  starsEarned: 0,
  isFiring: false,
  isDestroyed: false,
  isVictory: false,
  isActive: false,

  // Canvas & Animation State
  canvas: null,
  ctx: null,
  rafId: null,
  lastTime: 0,
  width: 960,
  height: 460,
  dpr: 1,

  // Space Entities
  starsBg: [],
  warpTimer: 0,
  ship: { x: 135, y: 230, baseY: 230, bobPhase: 0, recoil: 0, flash: 0 },
  asteroid: {
    x: 780,
    y: 220,
    targetX: 660,
    radius: 66,
    rot: 0,
    rotSpeed: 0.35,
    scale: 1,
    hitShake: 0,
    visible: true,
    vertices: []
  },
  projectiles: [],
  flashes: [],
  shockwaves: [],
  fireballs: [],
  shards: [],
  sparks: [],
  flyingStars: [],
  confetti: [],
  imageCache: new Map(),

  // Audio, Speech Recognition & Timers
  audioCtx: null,
  timers: [],
  speechSeq: 0,
  speechSessionId: 0,
  speechRecognition: null,
  speechTimeoutTimer: null,
  isListening: false,
  lastPraise: "",
  lastEnPraise: "",

  VI_PRAISES: [
    "Bùm! Đậu bắn trúng siêu đỉnh!",
    "Tuyệt vời Đậu ơi, thiên thạch nổ tung rồi!",
    "Phi thuyền của Đậu siêu quá đi!",
    "Chính xác rồi! Thêm một viên pha lê nữa nè!"
  ],

  EN_PRAISES: [
    "Boom! Direct hit, Đậu!",
    "Awesome shot, Space Captain Đậu!",
    "Super laser blast, Đậu!",
    "Target destroyed! Great job, Đậu!"
  ],

  getAudioContext() {
    if (!this.audioCtx) {
      if (window.AppState && typeof AppState.getAudioContext === "function") {
        this.audioCtx = AppState.getAudioContext();
      } else {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  },

  addTimer(fn, delay) {
    const id = setTimeout(() => {
      this.timers = this.timers.filter(t => t !== id);
      if (this.isActive) fn();
    }, delay);
    this.timers.push(id);
    return id;
  },

  clearTimers() {
    this.timers.forEach(id => clearTimeout(id));
    this.timers = [];
  },

  // Xáo trộn Fisher-Yates
  shuffle(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // Khởi tạo màn chơi theo chủ đề đang chọn (5 từ mỗi chặng bay)
  start(topicArg) {
    this.cleanup();
    this.isActive = true;

    const fallbackTopic = (window.AppState && AppState.topics && AppState.topics[0]) || {
      id: "default",
      title: "Vũ trụ Từ vựng",
      icon: "🚀",
      words: []
    };
    const chosenTopic = topicArg || (window.AppState && AppState.currentTopic) || fallbackTopic;
    this.topic = chosenTopic;

    const pool = Array.isArray(chosenTopic.words) ? chosenTopic.words : [];
    const shuffled = this.shuffle(pool);
    this.words = shuffled.slice(0, Math.min(5, shuffled.length));
    this.totalTargets = this.words.length;
    this.currentIndex = 0;
    this.combo = 0;
    this.starsEarned = 0;
    this.isFiring = false;
    this.isDestroyed = false;
    this.isVictory = false;
    this.warpTimer = 0;

    this.getAudioContext();
    this.renderShell();

    if (this.totalTargets === 0) {
      this.renderEmptyState();
      return;
    }

    this.initCanvas();
    this.loadCurrentTarget();
    this.startLoop();
  },

  renderEmptyState() {
    const stage = document.getElementById("blaster-stage-wrap");
    if (!stage) return;
    stage.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center p-6 text-white">
        <div class="text-6xl mb-3 animate-bounce">🛸✨</div>
        <h2 class="text-2xl font-black mb-2">Chủ đề này chưa có thiên thạch nào!</h2>
        <p class="text-sky-200 font-bold mb-6">Đậu quay về chọn chủ đề khác để phóng phi thuyền nhé!</p>
        <button onclick="BlasterScreen.goHome()" class="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-lg shadow-lg cursor-pointer active:scale-95 transition-all">
          🏠 Về chọn chủ đề
        </button>
      </div>
    `;
  },

  renderShell() {
    const container = document.getElementById("screen-blaster");
    if (!container) return;

    const topicIcon = (this.topic && this.topic.icon) || "🚀";
    const topicTitle = (this.topic && this.topic.title) || "Vũ trụ Từ vựng";

    container.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between rounded-[2rem] bg-gradient-to-b from-[#0B1026] via-[#131C42] to-[#1B234A] border-4 border-indigo-400/30 shadow-2xl overflow-hidden relative select-none">
        
        <!-- 1. THANH TRÊN: VỀ NHÀ, CHỦ ĐỀ & 5 VIÊN PHA LÊ TIẾN ĐỘ -->
        <div class="relative z-20 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-slate-950/60 backdrop-blur-md border-b border-indigo-400/20 shrink-0">
          <div class="flex items-center gap-2 sm:gap-3">
            <button onclick="BlasterScreen.goHome()" aria-label="Về trang chủ" class="px-3 sm:px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xs sm:text-sm border border-white/20 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer">
              <span>🏠</span>
              <span>Về nhà</span>
            </button>

            <div class="px-3 py-1.5 rounded-2xl bg-indigo-500/30 border border-indigo-300/30 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-inner">
              <span aria-hidden="true">${topicIcon}</span>
              <span class="truncate max-w-[140px] sm:max-w-[240px]">${topicTitle}</span>
            </div>
          </div>

          <div class="flex items-center gap-2 sm:gap-3">
            <div id="blaster-combo-pill" class="hidden px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 via-amber-400 to-cyan-400 text-slate-950 font-black text-xs shadow-md animate-pulse">
              🌈 SIÊU PHÁO x<span id="blaster-combo-val">3</span>
            </div>

            <div id="blaster-gems" class="flex items-center gap-1 sm:gap-1.5 bg-slate-900/80 px-3 py-1.5 rounded-full border border-cyan-400/30 shadow-inner" aria-label="Tiến độ 5 viên pha lê">
              ${Array.from({ length: Math.max(1, this.totalTargets) }).map((_, i) => `
                <span id="blaster-gem-${i}" class="text-base sm:text-xl transition-all duration-300 opacity-35 grayscale">💎</span>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- 2. SÀN BAY TRUNG TÂM: BẦU TRỜI SAO, PHI THUYỀN & THIÊN THẠCH PHA LÊ -->
        <div id="blaster-stage-wrap" class="relative flex-1 w-full min-h-[260px] overflow-hidden">
          <canvas id="blaster-canvas" class="absolute inset-0 w-full h-full block"></canvas>

          <!-- Nhãn HUD trạng thái nhẹ trên sàn bay -->
          <div id="blaster-feedback-banner" class="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-slate-900/75 border border-cyan-400/40 text-cyan-100 font-black text-xs sm:text-sm shadow-lg backdrop-blur-sm whitespace-nowrap transition-all">
            🚀 Khóa mục tiêu! Bé đọc to từ tiếng Anh để bắn nhé!
          </div>

          <!-- Thẻ từ tiếng Anh khóa ngay dưới Thiên Thạch bên phải -->
          <div id="blaster-word-hud" class="pointer-events-none absolute bottom-3 right-4 sm:right-10 md:right-16 z-10 flex flex-col items-center transition-all duration-300">
            <div class="px-4 sm:px-6 py-2 rounded-2xl bg-slate-950/85 border-2 border-purple-400/70 shadow-[0_0_24px_rgba(168,85,247,0.45)] backdrop-blur-md text-center">
              <div id="blaster-word-en" class="text-xl sm:text-3xl font-black text-white tracking-wide capitalize leading-tight">...</div>
              <div id="blaster-word-vi" class="text-xs sm:text-sm font-bold text-amber-300 mt-0.5">...</div>
            </div>
          </div>
        </div>

        <!-- 3. BẢNG ĐIỀU KHIỂN ĐÁY MÀN HÌNH -->
        <div class="relative z-20 px-3 sm:px-6 py-3 bg-slate-950/75 backdrop-blur-md border-t border-indigo-400/20 flex flex-wrap sm:flex-nowrap items-center justify-center gap-2.5 sm:gap-4 shrink-0">
          <button id="btn-blaster-listen" onclick="BlasterScreen.playSample()" aria-label="Nghe mẫu từ vựng" class="px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 active:scale-95 text-white font-black text-sm sm:text-base shadow-lg shadow-sky-500/30 border-2 border-sky-200/60 flex items-center gap-2 transition-all cursor-pointer">
            <span class="text-lg sm:text-xl" aria-hidden="true">🔊</span>
            <span>Nghe mẫu</span>
          </button>

          <button id="btn-blaster-fire" onclick="BlasterScreen.triggerSpeechFire()" aria-label="Đọc từ để bắn laser" class="flex-1 sm:flex-initial sm:min-w-[280px] px-6 sm:px-8 py-3.5 sm:py-4 rounded-3xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 active:scale-95 text-slate-950 font-black text-base sm:text-xl shadow-[0_0_25px_rgba(250,204,21,0.5)] border-2 border-white flex items-center justify-center gap-2.5 transition-all cursor-pointer">
            <span class="text-xl sm:text-2xl" aria-hidden="true">🎙️</span>
            <span>Đọc từ để bắn laser!</span>
          </button>

          <button id="btn-blaster-assist" onclick="BlasterScreen.triggerAssistFire()" aria-label="Bắn trợ giúp cho bé" class="px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-indigo-500/40 hover:bg-indigo-500/60 active:scale-95 text-indigo-100 font-bold text-xs sm:text-sm border border-indigo-300/40 flex items-center gap-1.5 transition-all cursor-pointer">
            <span aria-hidden="true">⚡</span>
            <span>Bắn trợ giúp</span>
          </button>
        </div>

        <!-- 4. MODAL RƯƠNG KHO BÁU VŨ TRỤ KHI HOÀN THÀNH CHẶNG -->
        <div id="blaster-victory-modal" class="hidden absolute inset-0 z-30 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div class="relative bg-gradient-to-b from-indigo-900 via-slate-900 to-indigo-950 rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full border-4 border-amber-400 shadow-[0_0_50px_rgba(250,204,21,0.4)] text-center text-white">
            <div class="text-6xl sm:text-7xl mb-2 animate-bounce" aria-hidden="true">🧰✨</div>
            <h2 class="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight mb-1">Rương Kho Báu Vũ Trụ!</h2>
            <p class="text-sm sm:text-base font-bold text-sky-100 mb-4">
              Đậu bắn nổ trọn <span id="blaster-victory-count" class="text-amber-300 font-black">5</span> thiên thạch xuất sắc quá!
            </p>
            <div class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-400/20 border-2 border-amber-300 text-amber-300 font-black text-xl mb-6">
              <span>⭐</span>
              <span>+5 Ngôi Sao Vũ Trụ</span>
            </div>
            <div class="flex flex-col sm:flex-row gap-3 justify-center">
              <button onclick="BlasterScreen.start(BlasterScreen.topic)" class="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 active:scale-95 text-slate-950 font-black text-base sm:text-lg shadow-lg border-2 border-white cursor-pointer transition-all">
                🚀 Bay chặng mới
              </button>
              <button onclick="BlasterScreen.goHome()" class="flex-1 py-3.5 px-5 rounded-2xl bg-white/15 hover:bg-white/25 active:scale-95 text-white font-black text-base sm:text-lg border border-white/30 cursor-pointer transition-all">
                🏠 Về nhà
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  },

  initCanvas() {
    this.canvas = document.getElementById("blaster-canvas");
    const wrap = document.getElementById("blaster-stage-wrap");
    if (!this.canvas || !wrap) return;
    this.ctx = this.canvas.getContext("2d");

    const resize = () => {
      if (!this.canvas || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      this.width = Math.max(320, rect.width || 960);
      this.height = Math.max(240, rect.height || 420);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      this.ship.x = Math.max(92, Math.min(165, this.width * 0.16));
      this.ship.baseY = this.height * 0.5;
      this.asteroid.radius = Math.max(52, Math.min(78, Math.min(this.width, this.height) * 0.16));
      this.asteroid.targetX = this.computeAsteroidTargetX();
      if (this.asteroid.visible) {
        this.asteroid.x = Math.min(this.asteroid.x, this.width - this.asteroid.radius - 32);
        if (this.asteroid.x < this.asteroid.targetX) {
          this.asteroid.x = this.asteroid.targetX;
        }
      }
      this.asteroid.y = this.height * 0.44;
    };

    this._onResize = resize;
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    resize();

    // Tạo bầu trời sao 3 lớp (parallax depth)
    this.starsBg = Array.from({ length: 75 }, (_, i) => {
      const layer = i % 3;
      return {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: layer === 0 ? 1.2 : layer === 1 ? 2.1 : 3.1,
        speed: layer === 0 ? 22 : layer === 1 ? 52 : 95,
        alpha: 0.35 + Math.random() * 0.65,
        hue: i % 7 === 0 ? "#7DD3FC" : i % 11 === 0 ? "#FDE68A" : "#FFFFFF"
      };
    });
  },

  buildAsteroidPolygon() {
    const pts = [];
    const count = 11;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const jitter = 0.84 + Math.random() * 0.28;
      pts.push({ angle, jitter });
    }
    return pts;
  },

  preloadWordImage(word) {
    if (!word || !word.image_url) return;
    if (this.imageCache.has(word.id)) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    const entry = { img, loaded: false, failed: false };
    img.onload = () => { entry.loaded = true; };
    img.onerror = () => { entry.failed = true; };
    img.src = word.image_url;
    this.imageCache.set(word.id, entry);
  },

  computeAsteroidTargetX() {
    const safeMax = this.width - this.asteroid.radius - 32;
    const safeMin = this.ship.x + this.asteroid.radius + 90;
    return Math.max(safeMin, Math.min(this.width * 0.72, safeMax));
  },

  loadCurrentTarget() {
    const word = this.words[this.currentIndex];
    if (!word) return;

    this.isFiring = false;
    this.isDestroyed = false;

    // Thiên thạch bắt đầu bên phải, bay vào dứt khoát và dừng ở vùng an toàn
    this.asteroid.x = this.width + this.asteroid.radius + 40;
    this.asteroid.targetX = this.computeAsteroidTargetX();
    this.asteroid.y = this.height * 0.44;
    this.asteroid.scale = 1;
    this.asteroid.hitShake = 0;
    this.asteroid.visible = true;
    this.asteroid.vertices = this.buildAsteroidPolygon();

    this.preloadWordImage(word);
    if (this.words[this.currentIndex + 1]) {
      this.preloadWordImage(this.words[this.currentIndex + 1]);
    }

    if (window.LearnScreen && typeof LearnScreen.preloadRealSound === "function") {
      LearnScreen.preloadRealSound(word.id);
    }

    const enEl = document.getElementById("blaster-word-en");
    const viEl = document.getElementById("blaster-word-vi");
    const hud = document.getElementById("blaster-word-hud");
    if (enEl) enEl.textContent = word.en || "";
    if (viEl) viEl.textContent = word.vi || "";
    if (hud) hud.classList.remove("opacity-0", "scale-75");

    this.updateGemsUI();
    this.updateComboUI();
    this.setBanner(`🎯 Thiên thạch ${this.currentIndex + 1}/${this.totalTargets}: Đọc "${word.en}" để phóng đạn Plasma!`);

    // Tự động đọc mẫu nhẹ khi khóa mục tiêu mới
    this.addTimer(() => {
      if (this.isActive && !this.isDestroyed && !this.isFiring) {
        this.playSample();
      }
    }, 220);
  },

  setBanner(text) {
    const el = document.getElementById("blaster-feedback-banner");
    if (el) el.textContent = text;
  },

  updateGemsUI() {
    for (let i = 0; i < this.totalTargets; i++) {
      const gem = document.getElementById(`blaster-gem-${i}`);
      if (!gem) continue;
      if (i < this.currentIndex) {
        gem.className = "text-base sm:text-xl transition-all duration-300 scale-110 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]";
      } else if (i === this.currentIndex && !this.isVictory) {
        gem.className = "text-base sm:text-xl transition-all duration-300 opacity-90 animate-pulse";
      } else {
        gem.className = "text-base sm:text-xl transition-all duration-300 opacity-35 grayscale";
      }
    }
  },

  updateComboUI() {
    const pill = document.getElementById("blaster-combo-pill");
    const val = document.getElementById("blaster-combo-val");
    if (!pill) return;
    if (this.combo >= 3) {
      pill.classList.remove("hidden");
      if (val) val.textContent = String(this.combo);
    } else {
      pill.classList.add("hidden");
    }
  },

  async playSample() {
    const word = this.words[this.currentIndex];
    if (!word || !this.isActive) return;

    if (window.LearnScreen && typeof LearnScreen.playRealSound === "function") {
      LearnScreen.playRealSound(word.id);
    }
    if (window.AppState && typeof AppState.speakWord === "function") {
      await AppState.speakWord(word.en, word.vi);
    } else if (window.AppState && typeof AppState.speakText === "function") {
      await AppState.speakText(word.en, "en");
    }
  },

  updateMicButtonUI(listening = false) {
    const btn = document.getElementById("btn-blaster-fire");
    if (!btn) return;
    if (listening) {
      btn.className = "flex-1 sm:flex-initial sm:min-w-[280px] px-6 sm:px-8 py-3.5 sm:py-4 rounded-3xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white font-black text-base sm:text-xl shadow-[0_0_30px_rgba(244,63,94,0.65)] border-2 border-white ring-4 ring-cyan-300/80 animate-pulse flex items-center justify-center gap-2.5 transition-all cursor-pointer";
      btn.innerHTML = `<span class="text-xl sm:text-2xl" aria-hidden="true">🎙️</span><span>Đang nghe Đậu đọc...</span>`;
    } else {
      btn.className = "flex-1 sm:flex-initial sm:min-w-[280px] px-6 sm:px-8 py-3.5 sm:py-4 rounded-3xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 active:scale-95 text-slate-950 font-black text-base sm:text-xl shadow-[0_0_25px_rgba(250,204,21,0.5)] border-2 border-white flex items-center justify-center gap-2.5 transition-all cursor-pointer";
      btn.innerHTML = `<span class="text-xl sm:text-2xl" aria-hidden="true">🎙️</span><span>Đọc từ để bắn laser!</span>`;
    }
  },

  stopSpeechRecognition(silent = true) {
    this.speechSessionId += 1;
    if (this.speechTimeoutTimer) {
      clearTimeout(this.speechTimeoutTimer);
      this.speechTimeoutTimer = null;
    }
    const rec = this.speechRecognition;
    this.speechRecognition = null;
    this.isListening = false;
    if (rec) {
      try { rec.onresult = null; rec.onerror = null; rec.onend = null; } catch (e) {}
      try { rec.abort(); } catch (e) {}
    }
    if (!silent) {
      this.updateMicButtonUI(false);
    }
  },

  // Đợt 2: Thu âm thực tế chuẩn Safari iPadOS (new SpeechRecognition + start() đồng bộ 0ms)
  triggerSpeechFire() {
    if (this.isFiring || this.isDestroyed || this.isVictory || !this.isActive) return;

    if (this.isListening) {
      this.stopSpeechRecognition(false);
      this.setBanner("🎙️ Đã dừng nghe. Chạm Micro để đọc lại nhé!");
      return;
    }

    const word = this.words[this.currentIndex];
    if (!word) return;

    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) {
      this.setBanner("⚠️ Trình duyệt chưa hỗ trợ Micro — dùng nút ⚡ Bắn trợ giúp nhé!");
      return;
    }

    // Hủy phiên cũ & giải phóng Audio Session đồng bộ 0ms giữ trọn User Gesture trên Safari iPadOS
    this.stopSpeechRecognition(true);
    const appSessionId = (window.AppState && typeof AppState.prepareForSpeechRecognition === "function")
      ? AppState.prepareForSpeechRecognition()
      : null;
    const sessionId = ++this.speechSessionId;

    this.isListening = true;
    this.updateMicButtonUI(true);
    this.setBanner(`🎙️ Cô đang nghe... Đậu đọc to "${word.en}" nhé!`);

    let hasHandledResult = false;
    let hasHandledError = false;

    try {
      const rec = new Rec();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.maxAlternatives = 5;
      this.speechRecognition = rec;

      this.speechTimeoutTimer = setTimeout(() => {
        if (sessionId === this.speechSessionId && this.speechRecognition === rec) {
          try { rec.stop(); } catch (e) {}
        }
      }, 7500);

      rec.onresult = async (event) => {
        if (sessionId !== this.speechSessionId || !this.isActive || hasHandledResult) return;
        hasHandledResult = true;

        if (this.speechTimeoutTimer) {
          clearTimeout(this.speechTimeoutTimer);
          this.speechTimeoutTimer = null;
        }
        this.isListening = false;
        if (this.speechRecognition === rec) this.speechRecognition = null;
        this.updateMicButtonUI(false);
        try { rec.stop(); } catch (e) {}

        if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
          await AppState.restoreAfterSpeechRecognition(appSessionId);
        }
        if (sessionId !== this.speechSessionId || !this.isActive) return;

        const results = event.results;
        const lastResult = results && results.length > 0 ? results[results.length - 1] : null;
        const alts = [];
        if (lastResult) {
          for (let i = 0; i < lastResult.length && i < 5; i++) {
            if (lastResult[i] && lastResult[i].transcript) {
              alts.push(lastResult[i].transcript);
            }
          }
        }

        let evalRes = { bestScore: 0, bestTranscript: alts[0] || "" };
        if (window.LearnScreen && typeof LearnScreen.evaluatePronunciation === "function") {
          evalRes = LearnScreen.evaluatePronunciation(word.en, alts);
        } else if (window.LearnScreen && typeof LearnScreen.scoreSingleTranscript === "function") {
          let best = 0;
          let bestTxt = "";
          alts.forEach(a => {
            const s = LearnScreen.scoreSingleTranscript(word.en, a);
            if (s > best) { best = s; bestTxt = a; }
          });
          evalRes = { bestScore: best, bestTranscript: bestTxt };
        }

        const score = Math.round(evalRes.bestScore || 0);
        if (score >= 70) {
          this.combo += 1;
          this.updateComboUI();
          this.setBanner(`🎯 ${score}% — Chuẩn rồi! Phóng đạn ${this.combo >= 3 ? "Cầu Vồng" : "Plasma"}!`);
          this.firePlasmaVolley(false);
        } else {
          this.combo = 0;
          this.updateComboUI();
          this.handleLowPronunciationScore(score);
        }
      };

      rec.onerror = async (event) => {
        if (sessionId !== this.speechSessionId || hasHandledResult || hasHandledError) return;
        hasHandledError = true;

        if (this.speechTimeoutTimer) {
          clearTimeout(this.speechTimeoutTimer);
          this.speechTimeoutTimer = null;
        }
        this.isListening = false;
        if (this.speechRecognition === rec) this.speechRecognition = null;
        this.updateMicButtonUI(false);

        if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
          await AppState.restoreAfterSpeechRecognition(appSessionId);
        }
        if (sessionId !== this.speechSessionId || !this.isActive) return;

        const errCode = event && event.error ? event.error : "unknown";
        if (errCode === "not-allowed" || errCode === "service-not-allowed") {
          this.setBanner("🔒 Chưa bật quyền Micro — Bố mẹ cấp quyền hoặc nhấn ⚡ Bắn trợ giúp nhé!");
        } else if (errCode === "no-speech") {
          this.setBanner("🤫 Cô chưa nghe rõ — Đậu chạm Micro và đọc to hơn chút nhé!");
        } else if (errCode !== "aborted") {
          this.setBanner("🎙️ Sóng vũ trụ hơi nhiễu — Đậu chạm Micro đọc lại nhé!");
        }
      };

      rec.onend = async () => {
        if (sessionId !== this.speechSessionId) return;
        if (this.speechTimeoutTimer) {
          clearTimeout(this.speechTimeoutTimer);
          this.speechTimeoutTimer = null;
        }
        this.isListening = false;
        if (this.speechRecognition === rec) this.speechRecognition = null;
        this.updateMicButtonUI(false);

        if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
          await AppState.restoreAfterSpeechRecognition(appSessionId);
        }
        if (sessionId !== this.speechSessionId || !this.isActive) return;

        if (!hasHandledResult && !hasHandledError) {
          this.setBanner("🤫 Cô chưa nghe thấy tiếng Đậu — Con chạm Micro đọc lại nhé!");
        }
      };

      // Gọi start() đồng bộ 0ms trong handler chạm nút
      rec.start();
    } catch (err) {
      console.warn("Lỗi khởi động SpeechRecognition:", err);
      this.stopSpeechRecognition(false);
      if (window.AppState && typeof AppState.restoreAfterSpeechRecognition === "function") {
        AppState.restoreAfterSpeechRecognition(appSessionId);
      }
      this.setBanner("⚠️ Chưa mở được Micro — Đậu thử lại hoặc nhấn ⚡ Bắn trợ giúp nhé!");
    }
  },

  // Phản hồi nhẹ nhàng khi bé phát âm < 70%: tia lửa xẹt nhẹ + thiên thạch rung lắc + lời nhắc dịu dàng
  handleLowPronunciationScore(score) {
    this.setBanner(`✨ ${score}% — Gần trúng rồi! Đọc to và rõ hơn chút nữa nhé!`);
    this.fireMissSparks();
    this.playSparkFizzleSound();

    if (window.AppState && typeof AppState.speakText === "function") {
      const msg = AppState.voiceMode === "bilingual"
        ? "Gần trúng rồi Đậu ơi, đọc to và rõ hơn một chút nữa nhé!"
        : "Almost hit, Đậu! Say it a bit louder and clearer!";
      AppState.speakText(msg, AppState.voiceMode === "bilingual" ? "vi" : "en");
    }
  },

  fireMissSparks() {
    this.ship.recoil = 6;
    this.ship.flash = 0.6;
    this.asteroid.hitShake = 1.0;

    const startX = this.ship.x + 56;
    const startY = this.ship.y;
    const targetX = this.asteroid.x - this.asteroid.radius * 0.7;
    const targetY = this.asteroid.y;

    for (let i = 0; i < 12; i++) {
      const sx = startX + (targetX - startX) * (0.45 + Math.random() * 0.55);
      const sy = startY + (targetY - startY) * (0.45 + Math.random() * 0.55) + (Math.random() - 0.5) * 40;
      this.sparks.push({
        x: sx,
        y: sy,
        vx: (Math.random() - 0.3) * 180,
        vy: (Math.random() - 0.5) * 200,
        size: 2.5 + Math.random() * 3,
        alpha: 1,
        color: i % 2 === 0 ? "#FDE047" : "#FB923C"
      });
    }
  },

  playSparkFizzleSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.22);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  },

  triggerAssistFire() {
    if (this.isFiring || this.isDestroyed || this.isVictory || !this.isActive) return;
    this.stopSpeechRecognition(false);
    this.combo = 0;
    this.updateComboUI();
    this.firePlasmaVolley(true);
  },

  // Phóng 2 quả cầu Plasma (hoặc Siêu Pháo Cầu Vồng xoắn ốc nếu Combo >= 3)
  firePlasmaVolley(isAssist = false) {
    if (this.isFiring || this.isDestroyed || !this.isActive) return;
    this.isFiring = true;

    if (window.AppState) AppState.stopAudio();
    if (window.LearnScreen && typeof LearnScreen.stopRealSound === "function") {
      LearnScreen.stopRealSound();
    }

    const isRainbowSuper = !isAssist && this.combo >= 3;
    this.ship.recoil = 14;
    this.ship.flash = 1;
    this.playLaserSound(isRainbowSuper);

    if (isRainbowSuper) {
      this.setBanner("🌈 SIÊU PHÁO CẦU VỒNG XOẮN ỐC! Phóng!!!");
    } else {
      this.setBanner("⚡ Bắn đạn Plasma 2 nòng pháo!");
    }

    const startX = this.ship.x + 58;
    const topGunY = this.ship.y - 26;
    const botGunY = this.ship.y + 26;

    [topGunY, botGunY].forEach((gunY, idx) => {
      this.projectiles.push({
        x: startX,
        y: gunY,
        baseY: gunY,
        vx: isRainbowSuper ? 860 : 780,
        radius: isRainbowSuper ? 12 : 9,
        rainbow: isRainbowSuper,
        spiralPhase: idx * Math.PI,
        age: 0,
        trail: []
      });
    });
  },

  // Vụ nổ 5 tầng khi đạn Plasma chạm Thiên thạch Pha lê
  triggerFiveLayerExplosion(impactX, impactY) {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    this.isFiring = false;
    this.asteroid.visible = false;
    this.warpTimer = 1.25; // Kích hoạt Turbo Warp Speed bầu trời sao

    const hud = document.getElementById("blaster-word-hud");
    if (hud) hud.classList.add("opacity-0", "scale-75");

    // Tầng 1: Chớp sáng tâm nổ
    this.flashes.push({ x: impactX, y: impactY, radius: 18, maxRadius: 155, alpha: 1 });

    // Tầng 2: 2 vòng sóng xung kích lan tỏa
    this.shockwaves.push({ x: impactX, y: impactY, radius: 16, speed: 420, alpha: 1, color: "#38BDF8", lineWidth: 7 });
    this.shockwaves.push({ x: impactX, y: impactY, radius: 8, speed: 290, alpha: 0.95, color: "#FACC15", lineWidth: 5 });

    // Tầng 3: Cầu lửa bung nở
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const spd = 45 + Math.random() * 140;
      this.fireballs.push({
        x: impactX,
        y: impactY,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        radius: 16 + Math.random() * 24,
        alpha: 0.95,
        color: i % 2 === 0 ? "#F97316" : "#FDE047"
      });
    }

    // Tầng 4: 20 mảnh đá pha lê văng theo trọng lực
    const shardColors = ["#C084FC", "#A855F7", "#E879F9", "#38BDF8", "#F472B6"];
    for (let i = 0; i < 20; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 280;
      this.shards.push({
        x: impactX + (Math.random() - 0.5) * 20,
        y: impactY + (Math.random() - 0.5) * 20,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 90,
        gravity: 520,
        size: 6 + Math.random() * 10,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
        alpha: 1,
        color: shardColors[i % shardColors.length]
      });
    }

    // Tầng 5: 5 ngôi sao vàng bay hút về buồng lái phi thuyền
    for (let i = 0; i < 5; i++) {
      const spreadAngle = -Math.PI / 2 + (i - 2) * 0.55;
      this.flyingStars.push({
        x: impactX,
        y: impactY,
        vx: Math.cos(spreadAngle) * 180,
        vy: Math.sin(spreadAngle) * 180 - 60,
        age: 0,
        delay: i * 0.06,
        size: 15,
        done: false
      });
    }

    this.playExplosionSound();
    this.speakPraise();

    this.addTimer(() => {
      this.currentIndex += 1;
      this.updateGemsUI();
      if (this.currentIndex >= this.totalTargets) {
        this.showVictoryModal();
      } else {
        this.loadCurrentTarget();
      }
    }, 1550);
  },

  speakPraise() {
    if (!window.AppState || typeof AppState.speakText !== "function") return;
    const isBi = AppState.voiceMode === "bilingual";
    const pool = isBi ? this.VI_PRAISES : this.EN_PRAISES;
    const last = isBi ? this.lastPraise : this.lastEnPraise;
    const candidates = pool.filter(p => p !== last);
    const chosen = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
    if (isBi) this.lastPraise = chosen;
    else this.lastEnPraise = chosen;

    this.setBanner(`🎉 ${chosen}`);
    AppState.speakText(chosen, isBi ? "vi" : "en");
  },

  showVictoryModal() {
    this.isVictory = true;
    this.updateGemsUI();
    if (window.AppState && typeof AppState.addStars === "function") {
      AppState.addStars(5);
    }

    // Tung pháo giấy trên canvas
    const colors = ["#FACC15", "#38BDF8", "#F472B6", "#34D399", "#A855F7"];
    for (let i = 0; i < 55; i++) {
      this.confetti.push({
        x: this.width * 0.5 + (Math.random() - 0.5) * 120,
        y: this.height * 0.45,
        vx: (Math.random() - 0.5) * 420,
        vy: -180 - Math.random() * 260,
        gravity: 480,
        size: 6 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
        color: colors[i % colors.length],
        alpha: 1
      });
    }

    this.playVictoryFanfare();
    const countEl = document.getElementById("blaster-victory-count");
    if (countEl) countEl.textContent = String(this.totalTargets);

    const modal = document.getElementById("blaster-victory-modal");
    if (modal) modal.classList.remove("hidden");

    if (window.AppState && typeof AppState.speakText === "function") {
      const msg = AppState.voiceMode === "bilingual"
        ? "Hoan hô! Đậu đã mở Rương Kho Báu Vũ Trụ và nhận năm ngôi sao rực rỡ!"
        : "Woohoo! You opened the Cosmic Treasure Chest and earned five stars, Đậu!";
      AppState.speakText(msg, AppState.voiceMode === "bilingual" ? "vi" : "en");
    }
  },

  // Âm thanh bắn Laser 0ms (Web Audio)
  playLaserSound(isRainbow = false) {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isRainbow ? "triangle" : "sawtooth";
      osc.frequency.setValueAtTime(isRainbow ? 1120 : 880, now);
      osc.frequency.exponentialRampToValueAtTime(210, now + 0.22);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {}
  },

  // Âm thanh nổ thiên thạch vui tai 0ms (trầm ấm + lấp lánh sao)
  playExplosionSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      // Bass boom
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.38);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);

      // Crystal sparkle chime
      [1046.5, 1318.5, 1568, 2093].forEach((freq, idx) => {
        const sOsc = ctx.createOscillator();
        const sGain = ctx.createGain();
        sOsc.type = "sine";
        sOsc.frequency.setValueAtTime(freq, now + 0.08 + idx * 0.055);
        sGain.gain.setValueAtTime(0.12, now + 0.08 + idx * 0.055);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38 + idx * 0.055);
        sOsc.connect(sGain);
        sGain.connect(ctx.destination);
        sOsc.start(now + 0.08 + idx * 0.055);
        sOsc.stop(now + 0.4 + idx * 0.055);
      });
    } catch (e) {}
  },

  playVictoryFanfare() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.18, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.46);
      });
    } catch (e) {}
  },

  startLoop() {
    this.lastTime = performance.now();
    const tick = (now) => {
      if (!this.isActive) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.update(dt, now / 1000);
      this.draw(now / 1000);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  },

  update(dt, timeSec) {
    // 1. Warp & Bầu trời sao
    if (this.warpTimer > 0) this.warpTimer = Math.max(0, this.warpTimer - dt);
    const warpMult = this.warpTimer > 0 ? 5.2 : 1;
    for (const s of this.starsBg) {
      s.x -= s.speed * warpMult * dt;
      if (s.x < -16) {
        s.x = this.width + 8;
        s.y = Math.random() * this.height;
      }
    }

    // 2. Phi thuyền lơ lửng + giật nòng nhẹ
    this.ship.bobPhase += dt * 2.6;
    this.ship.y = this.ship.baseY + Math.sin(this.ship.bobPhase) * 8;
    this.ship.recoil = Math.max(0, this.ship.recoil - dt * 42);
    this.ship.flash = Math.max(0, this.ship.flash - dt * 6);

    // 3. Thiên thạch bay vào ~420 px/s và tự động dừng êm ái ở vùng an toàn (không bao giờ đâm tàu)
    if (this.asteroid.visible) {
      if (this.asteroid.x > this.asteroid.targetX) {
        this.asteroid.x = Math.max(this.asteroid.targetX, this.asteroid.x - 420 * dt);
      }
      this.asteroid.x = Math.min(this.asteroid.x, Math.max(this.asteroid.targetX, this.width - this.asteroid.radius - 32));
      this.asteroid.rot += this.asteroid.rotSpeed * dt;
      this.asteroid.hitShake = Math.max(0, this.asteroid.hitShake - dt * 2.4);
      const shakeY = this.asteroid.hitShake > 0 ? Math.sin(timeSec * 55) * 9 * this.asteroid.hitShake : 0;
      this.asteroid.y = this.height * 0.43 + Math.sin(timeSec * 1.7) * 7 + shakeY;
    }

    // 4. Đạn Plasma / Siêu Pháo Cầu Vồng
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 10) p.trail.shift();

      p.x += p.vx * dt;
      const targetY = this.asteroid.y;
      p.y += (targetY - p.y) * Math.min(1, dt * 6.5);
      if (p.rainbow) {
        p.y += Math.sin(p.age * 24 + p.spiralPhase) * 2.6;
      }

      if (this.asteroid.visible && p.x >= this.asteroid.x - this.asteroid.radius * 0.65) {
        this.projectiles.splice(i, 1);
        if (!this.isDestroyed) {
          this.triggerFiveLayerExplosion(this.asteroid.x, this.asteroid.y);
        }
      } else if (p.x > this.width + 50) {
        this.projectiles.splice(i, 1);
      }
    }

    // 5. Cập nhật 5 tầng nổ
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.radius += 520 * dt;
      f.alpha -= dt * 3.4;
      if (f.alpha <= 0) this.flashes.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const w = this.shockwaves[i];
      w.radius += w.speed * dt;
      w.alpha -= dt * 1.5;
      if (w.alpha <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;
      fb.radius += 28 * dt;
      fb.alpha -= dt * 1.75;
      if (fb.alpha <= 0) this.fireballs.splice(i, 1);
    }

    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      sh.vy += sh.gravity * dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;
      sh.rot += sh.vRot * dt;
      sh.alpha -= dt * 0.85;
      if (sh.alpha <= 0) this.shards.splice(i, 1);
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.alpha -= dt * 2.2;
      if (sp.alpha <= 0) this.sparks.splice(i, 1);
    }

    const cockpitX = this.ship.x + 10;
    const cockpitY = this.ship.y - 4;
    for (let i = this.flyingStars.length - 1; i >= 0; i--) {
      const st = this.flyingStars[i];
      st.age += dt;
      if (st.age < st.delay) continue;
      const dx = cockpitX - st.x;
      const dy = cockpitY - st.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 18) {
        this.flyingStars.splice(i, 1);
        continue;
      }
      const pull = Math.min(1, (st.age - st.delay) * 3.2);
      st.vx = st.vx * (1 - pull * 0.14) + (dx / dist) * 580 * pull;
      st.vy = st.vy * (1 - pull * 0.14) + (dy / dist) * 580 * pull;
      st.x += st.vx * dt;
      st.y += st.vy * dt;
    }

    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.vy += c.gravity * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vRot * dt;
      c.alpha -= dt * 0.42;
      if (c.alpha <= 0) this.confetti.splice(i, 1);
    }
  },

  draw(timeSec) {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    // Nebula glow
    const neb = ctx.createRadialGradient(this.width * 0.72, this.height * 0.42, 30, this.width * 0.65, this.height * 0.45, this.width * 0.6);
    neb.addColorStop(0, "rgba(139, 92, 246, 0.22)");
    neb.addColorStop(0.5, "rgba(14, 165, 233, 0.10)");
    neb.addColorStop(1, "rgba(11, 16, 38, 0)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, this.width, this.height);

    // 1. Sao nền + Turbo Warp streaks
    for (const s of this.starsBg) {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.hue;
      if (this.warpTimer > 0) {
        ctx.strokeStyle = s.hue;
        ctx.lineWidth = s.size;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + 26 + s.size * 5, s.y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 2. Đường ngắm laser mờ từ phi thuyền tới thiên thạch
    if (this.asteroid.visible && !this.isDestroyed) {
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.22)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(this.ship.x + 62, this.ship.y);
      ctx.lineTo(this.asteroid.x - this.asteroid.radius, this.asteroid.y);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Phi thuyền Siêu Anh Hùng của Đậu (bên trái)
    this.drawShip(ctx, timeSec);

    // 4. Thiên thạch Pha lê & Vòng ngắm Radar (bên phải)
    if (this.asteroid.visible) {
      this.drawAsteroid(ctx, timeSec);
    }

    // 5. Đạn Plasma / Cầu Vồng
    for (const p of this.projectiles) {
      this.drawProjectile(ctx, p);
    }

    // 6. Vụ nổ 5 tầng
    for (const fb of this.fireballs) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, fb.alpha);
      const grad = ctx.createRadialGradient(fb.x, fb.y, 2, fb.x, fb.y, fb.radius);
      grad.addColorStop(0, "#FFFFFF");
      grad.addColorStop(0.4, fb.color);
      grad.addColorStop(1, "rgba(249, 115, 22, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, fb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const w of this.shockwaves) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, w.alpha);
      ctx.strokeStyle = w.color;
      ctx.lineWidth = w.lineWidth;
      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const f of this.flashes) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.alpha);
      const grad = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.radius);
      grad.addColorStop(0, "#FFFFFF");
      grad.addColorStop(0.45, "#67E8F9");
      grad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const sh of this.shards) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sh.alpha);
      ctx.translate(sh.x, sh.y);
      ctx.rotate(sh.rot);
      ctx.fillStyle = sh.color;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -sh.size);
      ctx.lineTo(sh.size * 0.85, 0);
      ctx.lineTo(0, sh.size);
      ctx.lineTo(-sh.size * 0.7, sh.size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (const st of this.flyingStars) {
      this.drawStar(ctx, st.x, st.y, st.size, "#FACC15", "#FEF08A");
    }

    for (const sp of this.sparks) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.alpha);
      ctx.fillStyle = sp.color;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const c of this.confetti) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, c.alpha);
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.size / 2, -c.size / 3, c.size, c.size * 0.66);
      ctx.restore();
    }
  },

  drawShip(ctx, timeSec) {
    const sx = this.ship.x - this.ship.recoil;
    const sy = this.ship.y;
    const flameLen = 28 + Math.sin(timeSec * 36) * 9 + (this.warpTimer > 0 ? 28 : 0);

    ctx.save();
    ctx.translate(sx, sy);

    // Lửa động cơ xanh-cam đôi
    [-12, 12].forEach(fy => {
      const fGrad = ctx.createLinearGradient(-44, fy, -44 - flameLen, fy);
      fGrad.addColorStop(0, "#38BDF8");
      fGrad.addColorStop(0.55, "#F97316");
      fGrad.addColorStop(1, "rgba(250, 204, 21, 0)");
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(-40, fy - 7);
      ctx.lineTo(-44 - flameLen, fy);
      ctx.lineTo(-40, fy + 7);
      ctx.closePath();
      ctx.fill();
    });

    // 2 nòng pháo đầu cánh (trên & dưới)
    ctx.fillStyle = "#38BDF8";
    ctx.strokeStyle = "#E0F2FE";
    ctx.lineWidth = 2;
    [-28, 28].forEach(cy => {
      ctx.beginPath();
      ctx.roundRect(12, cy - 5, 36, 10, 5);
      ctx.fill();
      ctx.stroke();
      // Đèn đầu nòng
      ctx.fillStyle = this.ship.flash > 0 ? "#FFFFFF" : "#22D3EE";
      ctx.beginPath();
      ctx.arc(48, cy, 4 + this.ship.flash * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#38BDF8";
    });

    // Cánh phi thuyền
    ctx.fillStyle = "#F59E0B";
    ctx.strokeStyle = "#FEF3C7";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-26, -12);
    ctx.lineTo(-8, -38);
    ctx.lineTo(24, -30);
    ctx.lineTo(14, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-26, 12);
    ctx.lineTo(-8, 38);
    ctx.lineTo(24, 30);
    ctx.lineTo(14, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Thân phi thuyền
    const bodyGrad = ctx.createLinearGradient(-44, -22, 62, 22);
    bodyGrad.addColorStop(0, "#E2E8F0");
    bodyGrad.addColorStop(0.6, "#FFFFFF");
    bodyGrad.addColorStop(1, "#38BDF8");
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#BAE6FD";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-42, -16);
    ctx.quadraticCurveTo(10, -24, 60, 0);
    ctx.quadraticCurveTo(10, 24, -42, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Kính buồng lái + Bé Đậu 🥑
    ctx.fillStyle = "#0EA5E9";
    ctx.strokeStyle = "#E0F2FE";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(10, 0, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🥑", 10, 1);

    ctx.restore();
  },

  drawAsteroid(ctx, timeSec) {
    const ax = this.asteroid.x;
    const ay = this.asteroid.y;
    const r = this.asteroid.radius;
    const word = this.words[this.currentIndex];

    // Vòng ngắm radar xoay ngoài thiên thạch
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(-timeSec * 0.9);
    ctx.strokeStyle = "rgba(236, 72, 153, 0.85)";
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 12]);
    ctx.beginPath();
    ctx.arc(0, 0, r + 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4 góc tâm ngắm
    ctx.strokeStyle = "#22D3EE";
    ctx.lineWidth = 3.5;
    [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(ang => {
      ctx.save();
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(r + 12, 0);
      ctx.lineTo(r + 25, 0);
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();

    // Khối đá thiên thạch pha lê xoay
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(this.asteroid.rot);

    const rockGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.15, 0, 0, r * 1.1);
    rockGrad.addColorStop(0, "#E9D5FF");
    rockGrad.addColorStop(0.55, "#9333EA");
    rockGrad.addColorStop(1, "#4C1D95");
    ctx.fillStyle = rockGrad;
    ctx.strokeStyle = "#F0ABFC";
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    this.asteroid.vertices.forEach((pt, idx) => {
      const px = Math.cos(pt.angle) * r * pt.jitter;
      const py = Math.sin(pt.angle) * r * pt.jitter;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Vòng tròn trắng sáng ở tâm để ảnh từ vựng nổi bật rõ ràng
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.strokeStyle = "#FDE047";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(ax, ay, r * 0.64, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Vẽ image_url (fallback visual emoji)
    if (word) {
      const cached = this.imageCache.get(word.id);
      const imgSize = r * 0.96;
      if (cached && cached.loaded && !cached.failed) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ax, ay, r * 0.58, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(cached.img, ax - imgSize / 2, ay - imgSize / 2, imgSize, imgSize);
        ctx.restore();
      } else {
        ctx.font = `${Math.round(r * 0.72)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(word.visual || "🌟", ax, ay + 2);
      }
    }
    ctx.restore();
  },

  drawProjectile(ctx, p) {
    const rainbowPalette = ["#F43F5E", "#FBBF24", "#34D399", "#38BDF8", "#A855F7"];
    // Đuôi sao chổi
    for (let i = 0; i < p.trail.length; i++) {
      const t = p.trail[i];
      const frac = (i + 1) / p.trail.length;
      ctx.save();
      ctx.globalAlpha = frac * 0.65;
      ctx.fillStyle = p.rainbow ? rainbowPalette[i % rainbowPalette.length] : "#38BDF8";
      ctx.beginPath();
      ctx.arc(t.x, t.y, p.radius * frac * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Quả cầu Plasma
    ctx.save();
    const coreColor = p.rainbow ? rainbowPalette[Math.floor(p.age * 20) % rainbowPalette.length] : "#22D3EE";
    const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.radius * 2.2);
    glow.addColorStop(0, "#FFFFFF");
    glow.addColorStop(0.45, coreColor);
    glow.addColorStop(1, "rgba(34, 211, 238, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  drawStar(ctx, x, y, r, fill, stroke) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const outer = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const inner = outer + Math.PI / 5;
      if (i === 0) ctx.moveTo(Math.cos(outer) * r, Math.sin(outer) * r);
      else ctx.lineTo(Math.cos(outer) * r, Math.sin(outer) * r);
      ctx.lineTo(Math.cos(inner) * (r * 0.45), Math.sin(inner) * (r * 0.45));
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  },

  goHome() {
    this.cleanup();
    if (window.AppState && typeof AppState.showScreen === "function") {
      AppState.showScreen("screen-home");
    }
  },

  cleanup() {
    this.isActive = false;
    this.stopSpeechRecognition(true);
    this.clearTimers();
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
      window.removeEventListener("orientationchange", this._onResize);
      this._onResize = null;
    }
    this.projectiles = [];
    this.flashes = [];
    this.shockwaves = [];
    this.fireballs = [];
    this.shards = [];
    this.sparks = [];
    this.flyingStars = [];
    this.confetti = [];
    if (window.AppState && typeof AppState.stopAudio === "function") {
      AppState.stopAudio();
    }
    if (window.LearnScreen && typeof LearnScreen.stopRealSound === "function") {
      LearnScreen.stopRealSound();
    }
  }
};

window.BlasterScreen = BlasterScreen;
