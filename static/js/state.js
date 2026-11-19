// Quản lý trạng thái toàn cục ứng dụng học tiếng Anh cho bé Đậu
const AppState = {
  voiceMode: localStorage.getItem("dau_voice_mode") || "bilingual", // "bilingual" | "english"
  stars: parseInt(localStorage.getItem("dau_stars") || "0", 10),
  topics: [],
  currentTopic: null,
  currentAudio: null,

  // Khởi tạo ban đầu
  async init() {
    this.updateStarsDisplay();
    this.updateVoiceModeUI();
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

  // Phát âm thanh TTS qua backend
  async speakText(text, lang = "en") {
    if (!text) return;
    try {
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      }
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang })
      });
      if (res.ok) {
        const data = await res.json();
        const audio = new Audio(data.url);
        this.currentAudio = audio;
        return new Promise((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      }
    } catch (err) {
      console.error("Lỗi phát TTS:", err);
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
