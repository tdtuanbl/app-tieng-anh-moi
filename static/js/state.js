// Quản lý trạng thái toàn cục ứng dụng học tiếng Anh cho bé Đậu
const AppState = {
  voiceMode: localStorage.getItem("dau_voice_mode") || "bilingual", // "bilingual" | "english"
  playbackRate: parseFloat(localStorage.getItem("dau_playback_rate") || "1.2"),
  stars: parseInt(localStorage.getItem("dau_stars") || "0", 10),
  topics: [],
  currentTopic: null,
  audioPlayer: new Audio(),
  currentAudioResolve: null,

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
      btn.innerHTML = `<span class="text-lg">🇻🇳+🇬🇧</span> <span>Song ngữ</span>`;
      btn.className = "px-3.5 py-1.5 rounded-2xl bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-sm transition-all shadow-sm flex items-center gap-2 active:scale-95";
    } else {
      btn.innerHTML = `<span class="text-lg">🇬🇧</span> <span>100% Tiếng Anh</span>`;
      btn.className = "px-3.5 py-1.5 rounded-2xl bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-sm transition-all shadow-sm flex items-center gap-2 active:scale-95";
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
      label.textContent = `Tốc độ: ${this.playbackRate}x`;
    }
  },

  // Lấy danh mục từ vựng
  async fetchTopics() {
    try {
      const res = await fetch("/api/topics");
      if (res.ok) {
        const data = await res.json();
        this.topics = data.topics || [];
      }
    } catch (err) {
      console.error("Lỗi nạp topics:", err);
    }
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
    }
  },

  // Phát âm thanh TTS qua backend (Singleton Audio Player chống nghẽn)
  async speakText(text, lang = "en") {
    if (!text) return;
    try {
      this.stopAudio();

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang })
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.url) return;

      return new Promise((resolve) => {
        this.currentAudioResolve = resolve;

        this.audioPlayer.onended = () => {
          if (this.currentAudioResolve === resolve) {
            this.currentAudioResolve = null;
          }
          resolve();
        };

        this.audioPlayer.onerror = () => {
          if (this.currentAudioResolve === resolve) {
            this.currentAudioResolve = null;
          }
          resolve();
        };

        this.audioPlayer.src = data.url;
        this.applyPlaybackRate();
        this.audioPlayer.play().catch(() => {
          if (this.currentAudioResolve === resolve) {
            this.currentAudioResolve = null;
          }
          resolve();
        });
      });
    } catch (err) {
      console.error("Lỗi phát TTS:", err);
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

  // Điều hướng chuyển 4 màn hình
  showScreen(screenId) {
    const screens = ["screen-home", "screen-learn", "screen-quiz", "screen-racer"];
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
  }
};

window.AppState = AppState;
