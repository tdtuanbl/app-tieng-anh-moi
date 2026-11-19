// Màn hình Học từ vựng & Luyện phát âm cho bé Đậu
const LearnScreen = {
  currentIndex: 0,
  words: [],
  isListening: false,
  recognition: null,
  isSpeaking: false,

  VI_PRAISES: [
    "Giỏi quá Đậu ơi!",
    "Đậu xuất sắc quá!",
    "Đậu tuyệt vời, 10 điểm!",
    "Chính xác!"
  ],

  EN_PRAISES: [
    "Awesome job, Đậu!",
    "You are amazing, Đậu! Ten out of ten!",
    "Excellent, Đậu!",
    "Spot on, Đậu!"
  ],

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
    this.initRecognition();
    this.render();
    setTimeout(() => {
      this.playPrompt();
    }, 400);
  },

  // Khởi tạo nhận diện giọng nói
  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Trình duyệt không hỗ trợ Web Speech API.");
      return;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.lang = "en-US";
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 3;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateMicUI(true);
    };

    this.recognition.onresult = (event) => {
      this.isListening = false;
      this.updateMicUI(false);
      let spokenText = "";
      for (let i = 0; i < event.results[0].length; i++) {
        spokenText += " " + event.results[0][i].transcript;
      }
      this.checkPronunciation(spokenText);
    };

    this.recognition.onerror = () => {
      this.isListening = false;
      this.updateMicUI(false);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.updateMicUI(false);
    };
  },

  // Hiển thị giao diện màn hình học
  render() {
    const container = document.getElementById("screen-learn");
    if (!container) return;

    const word = this.words[this.currentIndex];
    const total = this.words.length;
    const topic = AppState.currentTopic;

    container.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between max-w-4xl mx-auto py-2 relative">
        <!-- Thanh điều hướng phụ -->
        <div class="flex items-center justify-between w-full px-2">
          <button onclick="AppState.showScreen('screen-home')" class="px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-2">
            <span>⬅️</span>
            <span>Chủ đề</span>
          </button>

          <div class="px-4 py-1.5 rounded-full bg-amber-100/80 text-amber-900 font-extrabold text-sm border border-amber-200 flex items-center gap-2">
            <span>${topic.icon}</span>
            <span>${topic.title}</span>
            <span class="text-amber-600 font-semibold">• Từ ${this.currentIndex + 1}/${total}</span>
          </div>

          <div class="w-20"></div>
        </div>

        <!-- THẺ FLASHCARD TRUNG TÂM KHỔ LỚN -->
        <div class="flex-1 flex flex-col items-center justify-center my-2">
          <div onclick="LearnScreen.playPrompt()" class="cursor-pointer group relative bg-white rounded-[3rem] p-8 w-full max-w-lg shadow-xl border-4 border-amber-200 flex flex-col items-center justify-center transition-all duration-300 hover:scale-[1.02] active:scale-95 text-center">
            
            <!-- Nút loa góc trên thẻ -->
            <button class="absolute top-6 right-6 w-12 h-12 rounded-2xl bg-amber-50 group-hover:bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shadow-sm transition-all">
              🔊
            </button>

            <!-- Hình minh họa Visual cực lớn -->
            <div class="text-8xl md:text-9xl my-3 filter drop-shadow-md group-hover:scale-110 transition-transform">
              ${word.visual}
            </div>

            <!-- Từ tiếng Anh in đậm sắc nét -->
            <h2 class="text-5xl md:text-6xl font-black text-slate-800 tracking-tight mt-2 capitalize">
              ${word.en}
            </h2>

            <!-- Nghĩa tiếng Việt -->
            <p class="text-2xl font-bold text-slate-500 mt-2">
              ${word.vi}
            </p>
          </div>

          <!-- KHU VỰC HIỆU ỨNG SÓNG ÂM MICRO -->
          <div id="mic-status-box" class="h-16 flex items-center justify-center mt-3">
            <button onclick="LearnScreen.startListening()" class="px-6 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center gap-2 active:scale-95 transition-all">
              <span>🎙️</span>
              <span>Chạm để Đậu nói</span>
            </button>
          </div>
        </div>

        <!-- BỘ ĐIỀU KHIỂN TIẾN / LÙI TỪ -->
        <div class="flex items-center justify-center gap-6 pb-2">
          <button onclick="LearnScreen.prevWord()" class="px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-black text-lg shadow-md border border-slate-200 active:scale-95 transition-all flex items-center gap-2">
            <span>⬅️</span>
            <span>Từ trước</span>
          </button>

          <button onclick="LearnScreen.playPrompt()" class="px-8 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-500 text-slate-900 font-black text-xl shadow-lg shadow-amber-200/50 active:scale-95 transition-all flex items-center gap-2">
            <span>🔊</span>
            <span>Nghe lại</span>
          </button>

          <button onclick="LearnScreen.nextWord()" class="px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-black text-lg shadow-md border border-slate-200 active:scale-95 transition-all flex items-center gap-2">
            <span>Từ sau</span>
            <span>➡️</span>
          </button>
        </div>

        <!-- Lớp phủ thông báo Khen thưởng & Hiệu ứng -->
        <div id="praise-overlay" class="hidden absolute inset-0 z-40 bg-white/90 backdrop-blur-sm rounded-[3rem] flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-200">
          <div id="praise-emoji" class="text-8xl mb-4 animate-bounce">🌟</div>
          <h2 id="praise-title" class="text-4xl md:text-5xl font-black text-amber-500 mb-2"></h2>
          <p id="praise-subtitle" class="text-2xl font-bold text-slate-600 mb-6">+1 ⭐ cho Đậu!</p>
          <button onclick="LearnScreen.dismissPraise()" class="px-8 py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-500 text-white font-black text-xl shadow-lg active:scale-95 transition-all">
            Học từ tiếp theo 🚀
          </button>
        </div>
      </div>
    `;
  },

  // Cập nhật giao diện sóng âm micro
  updateMicUI(active) {
    const box = document.getElementById("mic-status-box");
    if (!box) return;
    if (active) {
      box.innerHTML = `
        <div class="flex items-center gap-3 px-6 py-2.5 rounded-full bg-rose-50 border-2 border-rose-300 shadow-sm animate-pulse">
          <span class="relative flex h-4 w-4">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
          </span>
          <span class="font-black text-rose-600 text-lg">Đến lượt Đậu nói nào! 🎙️</span>
        </div>
      `;
    } else {
      box.innerHTML = `
        <button onclick="LearnScreen.startListening()" class="px-6 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center gap-2 active:scale-95 transition-all">
          <span>🎙️</span>
          <span>Chạm vào đây để Đậu nói</span>
        </button>
      `;
    }
  },

  // Phát lời dẫn & từ vựng theo voiceMode
  async playPrompt() {
    if (this.isSpeaking) return;
    this.isSpeaking = true;
    const word = this.words[this.currentIndex];

    try {
      if (AppState.voiceMode === "bilingual") {
        await AppState.speakText(`Đậu ơi, đây là ${word.vi}:`, "vi");
        await AppState.speakText(word.en, "en");
        await AppState.speakText("Đậu đọc lại nhé!", "vi");
      } else {
        await AppState.speakText(`Look Đậu! It's a ${word.en}. Your turn!`, "en");
      }
    } finally {
      this.isSpeaking = false;
      // Tự động mở Micro mời bé nói
      this.startListening();
    }
  },

  // Bật thu âm micro
  startListening() {
    if (this.recognition && !this.isListening) {
      try {
        this.recognition.start();
      } catch (err) {
        // Tránh lỗi đã start trước đó
      }
    }
  },

  // Kiểm tra phát âm (hỗ trợ phát âm gần đúng của trẻ 5 tuổi)
  async checkPronunciation(spokenText) {
    const word = this.words[this.currentIndex];
    const target = word.en.toLowerCase().trim();
    const spoken = spokenText.toLowerCase().trim();

    const isMatch = this.fuzzyMatch(spoken, target);

    if (isMatch) {
      // Đọc đúng: Cộng sao & lưu tiến trình
      AppState.addStars(1);
      this.saveWordLearned(word.id);

      // Chọn ngẫu nhiên câu khen
      const isBilingual = AppState.voiceMode === "bilingual";
      const praises = isBilingual ? this.VI_PRAISES : this.EN_PRAISES;
      const praise = praises[Math.floor(Math.random() * praises.length)];

      this.showPraise(praise, true);
      await AppState.speakText(praise, isBilingual ? "vi" : "en");
    } else {
      // Đọc chưa khớp: Động viên bé
      const encourageMsg = AppState.voiceMode === "bilingual" 
        ? "Đậu đọc lại cùng cô nhé!" 
        : "Try again, Đậu!";
      
      const box = document.getElementById("mic-status-box");
      if (box) {
        box.innerHTML = `
          <div class="px-5 py-2 rounded-full bg-amber-50 border border-amber-300 text-amber-800 font-bold text-sm flex items-center gap-2">
            <span>✨</span>
            <span>${encourageMsg}</span>
          </div>
        `;
      }
      await AppState.speakText(encourageMsg, AppState.voiceMode === "bilingual" ? "vi" : "en");
    }
  },

  // So sánh tương đối âm gần giống
  fuzzyMatch(spoken, target) {
    if (!spoken) return false;
    if (spoken.includes(target) || target.includes(spoken)) return true;

    // Khoảng cách Levenshtein cho trẻ nhỏ
    let s = spoken.replace(/[^a-z0-9]/g, "");
    let t = target.replace(/[^a-z0-9]/g, "");
    if (!s || !t) return false;

    let d = [];
    for (let i = 0; i <= s.length; i++) d[i] = [i];
    for (let j = 0; j <= t.length; j++) d[0][j] = j;

    for (let i = 1; i <= s.length; i++) {
      for (let j = 1; j <= t.length; j++) {
        d[i][j] = (s[i - 1] === t[j - 1])
          ? d[i - 1][j - 1]
          : Math.min(d[i - 1][j - 1] + 1, d[i][j - 1] + 1, d[i - 1][j] + 1);
      }
    }
    return d[s.length][t.length] <= 2;
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

  // Hiển thị popup khen ngợi
  showPraise(text, success) {
    const overlay = document.getElementById("praise-overlay");
    const title = document.getElementById("praise-title");
    if (overlay && title) {
      title.textContent = text;
      overlay.classList.remove("hidden");
    }
  },

  dismissPraise() {
    const overlay = document.getElementById("praise-overlay");
    if (overlay) overlay.classList.add("hidden");
    this.nextWord();
  },

  // Chuyển sang từ kế tiếp
  nextWord() {
    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.render();
      setTimeout(() => this.playPrompt(), 300);
    } else {
      // Đã học hết chủ đề
      AppState.speakText("Chúc mừng Đậu đã hoàn thành tất cả từ vựng!", "vi");
      AppState.showScreen("screen-home");
    }
  },

  // Quay lại từ trước
  prevWord() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
      setTimeout(() => this.playPrompt(), 300);
    }
  }
};

window.LearnScreen = LearnScreen;
