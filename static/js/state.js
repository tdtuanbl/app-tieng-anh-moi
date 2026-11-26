// Quản lý trạng thái toàn cục ứng dụng học tiếng Anh cho bé Đậu
const AppState = {
  voiceMode: localStorage.getItem("dau_voice_mode") || "bilingual", // "bilingual" | "english"
  playbackRate: parseFloat(localStorage.getItem("dau_playback_rate") || "1.2"),
  stars: parseInt(localStorage.getItem("dau_stars") || "0", 10),
  topics: [],
  currentTopic: null,
  audioPlayer: new Audio(),
  currentAudioResolve: null,
  audioCtx: null,
  playSequence: 0,
  speechSessionId: 0,
  isSpeechRecording: false,

  // Trạng thái tải âm thanh & tải dữ liệu
  isAudioLoading: false,
  isAudioPlaying: false,
  topicFetchLoading: false,
  topicFetchError: false,
  audioListeners: [],

  // Đăng ký lắng nghe thay đổi trạng thái âm thanh
  addAudioListener(fn) {
    if (typeof fn === "function" && !this.audioListeners.includes(fn)) {
      this.audioListeners.push(fn);
    }
  },

  removeAudioListener(fn) {
    this.audioListeners = this.audioListeners.filter(listener => listener !== fn);
  },

  notifyAudioState(isLoading, isPlaying) {
    this.isAudioLoading = isLoading;
    this.isAudioPlaying = isPlaying;
    this.audioListeners.forEach(fn => {
      try { fn(isLoading, isPlaying); } catch (e) { console.error(e); }
    });
  },

  // Khởi tạo ban đầu
  async init() {
    this.updateStarsDisplay();
    this.updateVoiceModeUI();
    this.updatePlaybackRateUI();
    this.applyPlaybackRate();

    // Đảm bảo luôn giữ tốc độ đọc mỗi khi audio phát trên iPad/Safari
    if (this.audioPlayer) {
      this.audioPlayer.addEventListener("play", () => {
        this.applyPlaybackRate();
      });
    }

    await this.fetchTopics();
  },

  // Tăng sao & lưu bộ nhớ
  addStars(amount = 1) {
    this.stars += amount;
    localStorage.setItem("dau_stars", this.stars);
    this.updateStarsDisplay();
  },

  updateStarsDisplay() {
    const el = document.getElementById("star-count");
    if (el) el.textContent = this.stars;
  },

  // Chuyển đổi chế độ giọng nói
  setVoiceMode(mode) {
    this.voiceMode = mode;
    localStorage.setItem("dau_voice_mode", mode);
    this.updateVoiceModeUI();
  },

  toggleVoiceMode() {
    const nextMode = this.voiceMode === "bilingual" ? "english" : "bilingual";
    this.setVoiceMode(nextMode);
  },

  updateVoiceModeUI() {
    const btn = document.getElementById("btn-voice-mode");
    if (!btn) return;
    if (this.voiceMode === "bilingual") {
      btn.innerHTML = `<span class="text-base sm:text-lg" aria-hidden="true">🇻🇳+🇬🇧</span> <span class="hidden xs:inline">Song ngữ</span>`;
      btn.className = "px-2.5 sm:px-3.5 py-1.5 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center gap-1.5 active:scale-95";
      btn.setAttribute("aria-label", "Chế độ hiện tại: Song ngữ Việt Anh. Chạm để đổi sang 100% tiếng Anh");
    } else {
      btn.innerHTML = `<span class="text-base sm:text-lg" aria-hidden="true">🇬🇧</span> <span class="hidden xs:inline">100% Tiếng Anh</span>`;
      btn.className = "px-2.5 sm:px-3.5 py-1.5 rounded-2xl bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center gap-1.5 active:scale-95";
      btn.setAttribute("aria-label", "Chế độ hiện tại: 100% Tiếng Anh. Chạm để đổi sang Song ngữ");
    }
  },

  // Áp dụng tốc độ đọc cho AudioPlayer
  applyPlaybackRate() {
    if (this.audioPlayer) {
      this.audioPlayer.playbackRate = this.playbackRate;
      this.audioPlayer.defaultPlaybackRate = this.playbackRate;
    }
  },

  // Xoay vòng tốc độ đọc: 1.0x (Chậm) -> 1.2x (Vừa - Mặc định) -> 1.4x (Nhanh) -> 1.0x
  togglePlaybackRate() {
    let nextRate = 1.2;
    if (Math.abs(this.playbackRate - 1.0) < 0.05) {
      nextRate = 1.2;
    } else if (Math.abs(this.playbackRate - 1.2) < 0.05) {
      nextRate = 1.4;
    } else {
      nextRate = 1.0;
    }
    this.setPlaybackRate(nextRate);
  },

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    localStorage.setItem("dau_playback_rate", rate.toString());
    this.applyPlaybackRate();
    this.updatePlaybackRateUI();
  },

  updatePlaybackRateUI() {
    const label = document.getElementById("speed-label");
    if (label) {
      label.textContent = `${this.playbackRate}x`;
    }
    const btn = document.getElementById("btn-speed");
    if (btn) {
      btn.setAttribute("aria-label", `Tốc độ đọc của cô giáo: ${this.playbackRate}x. Chạm để thay đổi`);
    }
  },

  // Lấy danh mục từ vựng với cơ chế bắt lỗi & Timeout 4s
  async fetchTopics() {
    this.topicFetchLoading = true;
    this.topicFetchError = false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const res = await fetch("/api/topics", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        this.topics = data.topics || [];
        this.topicFetchError = (!this.topics || this.topics.length === 0);
      } else {
        this.topicFetchError = true;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error("Lỗi nạp topics:", err);
      this.topicFetchError = true;
    } finally {
      this.topicFetchLoading = false;
    }
  },

  // Thử tải lại danh mục chủ đề khi gặp lỗi
  async retryFetchTopics() {
    await this.fetchTopics();
    if (window.HomeScreen && typeof window.HomeScreen.render === "function") {
      window.HomeScreen.render();
    }
  },

  // Lấy hoặc khởi tạo AudioContext dùng chung toàn ứng dụng
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    return this.audioCtx;
  },

  // Dừng âm thanh hiện tại và giải phóng Promise cũ an toàn
  stopAudio() {
    if (this.currentAudioResolve) {
      const resolve = this.currentAudioResolve;
      this.currentAudioResolve = null;
      resolve();
    }
    if (this.audioPlayer) {
      this.audioPlayer.pause();
      this.audioPlayer.currentTime = 0;
      this.audioPlayer.ontimeupdate = null;
      this.audioPlayer.onended = null;
      this.audioPlayer.onerror = null;
    }
    this.notifyAudioState(false, false);
  },

  // Giải phóng Audio Session đồng bộ 0ms giữ trọn User Gesture trên Safari iPadOS trước khi mở micro
  prepareForSpeechRecognition() {
    this.speechSessionId = (this.speechSessionId || 0) + 1;
    const currentSessionId = this.speechSessionId;
    this.isSpeechRecording = true;
    this.playSequence = (this.playSequence || 0) + 1;
    this.stopAudio();

    if (window.speechSynthesis && typeof window.speechSynthesis.cancel === "function") {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    if (window.LearnScreen) {
      window.LearnScreen.playSequence = (window.LearnScreen.playSequence || 0) + 1;
      window.LearnScreen.isSpeaking = false;
      if (typeof window.LearnScreen.stopRealSound === "function") {
        window.LearnScreen.stopRealSound();
      }
    }

    const contexts = new Set(
      [this.audioCtx, window.LearnScreen && window.LearnScreen.audioCtx].filter(Boolean)
    );
    for (const ctx of contexts) {
      if (ctx.state === "running") {
        try {
          ctx.suspend().catch(() => {});
        } catch (e) {}
      }
    }

    return currentSessionId;
  },

  // Khôi phục lại AudioContext & giải phóng cờ ghi âm an toàn (không để kẹt cờ nếu sessionId hết hạn)
  async restoreAfterSpeechRecognition(sessionId) {
    const anyListening = !!(
      (window.LearnScreen && window.LearnScreen.isListening) ||
      (window.BlasterScreen && window.BlasterScreen.isListening)
    );
    if (typeof sessionId !== "number" || sessionId === this.speechSessionId || !anyListening) {
      this.isSpeechRecording = false;
    }
    if (typeof sessionId === "number" && sessionId !== this.speechSessionId) {
      return;
    }
    const contexts = new Set(
      [this.audioCtx, window.LearnScreen && window.LearnScreen.audioCtx].filter(Boolean)
    );
    for (const ctx of contexts) {
      if (ctx.state === "suspended" || ctx.state === "interrupted") {
        try {
          await ctx.resume();
        } catch (e) {}
      }
    }
  },

  // Phát âm thanh TTS qua backend (Singleton Audio Player chống nghẽn & có Loading State)
  async speakText(text, lang = "en") {
    if (!text || this.isSpeechRecording) return;
    try {
      this.stopAudio();
      this.notifyAudioState(true, false);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        this.notifyAudioState(false, false);
        return;
      }
      const data = await res.json();
      if (!data || !data.url) {
        this.notifyAudioState(false, false);
        return;
      }

      return new Promise((resolve) => {
        this.currentAudioResolve = resolve;

        const onFinish = () => {
          this.notifyAudioState(false, false);
          if (this.currentAudioResolve === resolve) {
            this.currentAudioResolve = null;
          }
          resolve();
        };

        this.audioPlayer.onended = onFinish;
        this.audioPlayer.onerror = onFinish;

        this.audioPlayer.src = data.url;
        this.applyPlaybackRate();

        this.audioPlayer.play().then(() => {
          this.notifyAudioState(false, true);
        }).catch(() => {
          onFinish();
        });
      });
    } catch (err) {
      console.error("Lỗi phát TTS:", err);
      this.notifyAudioState(false, false);
      if (this.currentAudioResolve) {
        const resolve = this.currentAudioResolve;
        this.currentAudioResolve = null;
        resolve();
      }
    }
  },

  // Phát từ theo chế độ âm thanh
  async speakWord(enText, viText) {
    if (this.voiceMode === "bilingual") {
      await this.speakText(enText, "en");
      await new Promise(r => setTimeout(r, 200));
      await this.speakText(viText, "vi");
    } else {
      await this.speakText(enText, "en");
    }
  },

  // Điều hướng chuyển 5 màn hình
  showScreen(screenId) {
    if (screenId !== "screen-learn" && window.LearnScreen) {
      if (typeof window.LearnScreen.stopSpeechRecognition === "function") {
        window.LearnScreen.stopSpeechRecognition(true);
      }
    }
    if (screenId !== "screen-blaster" && window.BlasterScreen) {
      if (typeof window.BlasterScreen.cleanup === "function") {
        window.BlasterScreen.cleanup();
      }
    }

    const screens = ["screen-home", "screen-learn", "screen-quiz", "screen-racer", "screen-blaster"];
    screens.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === screenId) {
          el.classList.remove("hidden");
        } else {
          el.classList.add("hidden");
        }
      }
    });

    if (screenId === "screen-learn") {
      if (window.LearnScreen && typeof window.LearnScreen.updateNavigationLockUI === "function") {
        window.LearnScreen.updateNavigationLockUI();
      }
    } else {
      const btnHome = document.getElementById("btn-home");
      if (btnHome) {
        btnHome.disabled = false;
        btnHome.classList.remove("opacity-40", "pointer-events-none", "cursor-not-allowed");
        const lockBadge = btnHome.querySelector("[data-lock-badge]");
        if (lockBadge) lockBadge.classList.add("hidden");
      }
    }
  }
};

window.AppState = AppState;
