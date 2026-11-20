// Màn hình Học từ vựng cho bé Đậu
const LearnScreen = {
  currentIndex: 0,
  words: [],
  isSpeaking: false,
  playSequence: 0,

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
    this.isSpeaking = false;
    this.playSequence = 0;
    AppState.stopAudio();
    this.render();
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
          <div onclick="LearnScreen.playPrompt()" class="cursor-pointer group relative bg-white rounded-[3rem] p-6 md:p-8 w-full max-w-lg shadow-xl border-4 border-amber-200 flex flex-col items-center justify-center transition-all duration-300 hover:scale-[1.02] active:scale-95 text-center">
            
            <!-- Nút loa góc trên thẻ -->
            <button class="absolute top-6 right-6 w-12 h-12 rounded-2xl bg-amber-50 group-hover:bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shadow-sm transition-all">
              🔊
            </button>

            <!-- Khung hình ảnh thật cỡ lớn hoặc Emoji trực quan -->
            ${word.image_url ? `
              <div class="w-64 h-64 md:w-72 md:h-72 my-2 rounded-3xl overflow-hidden shadow-lg border-4 border-white bg-amber-50/50 flex items-center justify-center relative">
                <img src="${word.image_url}" alt="${word.en}" class="w-full h-full object-cover rounded-2xl shadow-md transition-transform duration-300 group-hover:scale-105" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                <div style="display:none;" class="w-full h-full items-center justify-center text-8xl md:text-9xl filter drop-shadow-md">
                  ${word.visual}
                </div>
              </div>
            ` : `
              <div class="w-64 h-64 md:w-72 md:h-72 my-2 flex items-center justify-center text-8xl md:text-9xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                ${word.visual}
              </div>
            `}

            <!-- Từ tiếng Anh in đậm sắc nét -->
            <h2 class="text-4xl md:text-5xl font-black text-slate-800 tracking-tight mt-1 capitalize">
              ${word.en}
            </h2>

            <!-- Nghĩa tiếng Việt -->
            <p class="text-xl md:text-2xl font-bold text-slate-500 mt-1">
              ${word.vi}
            </p>
          </div>

          <!-- NÚT XÁC NHẬN CHO BA MẸ: CHÍNH XÁC -->
          <div class="h-16 flex items-center justify-center mt-3">
            <button onclick="LearnScreen.confirmCorrect()" class="px-8 py-3.5 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-xl md:text-2xl shadow-lg shadow-emerald-200/60 flex items-center gap-3 transition-all border-2 border-white">
              <span>✅</span>
              <span>Chính xác</span>
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

  // Phát từ tiếng Anh và câu nhắc khi chạm vào thẻ
  async playPrompt() {
    const currentSeq = ++this.playSequence;
    this.isSpeaking = true;
    AppState.stopAudio();

    const word = this.words[this.currentIndex];
    if (!word) return;

    try {
      // Bước A: Phát âm từ tiếng Anh (ví dụ: "Dog")
      await AppState.speakText(word.en, "en");
      if (this.playSequence !== currentSeq) return;

      // Bước B: Ngay khi tiếng Anh vừa kết thúc, phát tiếp câu tiếng Việt ngắn gọn: "Đậu đọc lại cho cô nhé"
      await AppState.speakText("Đậu đọc lại cho cô nhé", "vi");
    } finally {
      if (this.playSequence === currentSeq) {
        this.isSpeaking = false;
      }
    }
  },

  // Xử lý khi ba mẹ bấm nút Chính xác
  async confirmCorrect() {
    const word = this.words[this.currentIndex];
    if (!word) return;

    // Ngắt âm thanh đang đọc từ dở nếu có
    AppState.stopAudio();
    this.isSpeaking = false;

    // Cộng sao & lưu tiến trình
    AppState.addStars(1);
    this.saveWordLearned(word.id);

    // Chọn ngẫu nhiên câu khen
    const isBilingual = AppState.voiceMode === "bilingual";
    const praises = isBilingual ? this.VI_PRAISES : this.EN_PRAISES;
    const praise = praises[Math.floor(Math.random() * praises.length)];

    this.showPraise(praise);
    await AppState.speakText(praise, isBilingual ? "vi" : "en");
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
  showPraise(text) {
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
    AppState.stopAudio();
    this.isSpeaking = false;
    if (this.currentIndex < this.words.length - 1) {
      this.currentIndex++;
      this.render();
    } else {
      // Đã học hết chủ đề
      AppState.speakText("Chúc mừng Đậu đã hoàn thành tất cả từ vựng!", "vi");
      AppState.showScreen("screen-home");
    }
  },

  // Quay lại từ trước
  prevWord() {
    AppState.stopAudio();
    this.isSpeaking = false;
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
    }
  }
};

window.LearnScreen = LearnScreen;