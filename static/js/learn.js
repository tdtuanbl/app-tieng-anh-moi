// Màn hình Học từ vựng cho bé Đậu cùng Cô giáo
const LearnScreen = {
  currentIndex: 0,
  words: [],
  isSpeaking: false,
  playSequence: 0,
  audioListenerAttached: false,

  VI_PRAISES: [
    "Cô khen Đậu giỏi quá nè!",
    "Đậu của cô xuất sắc quá, 10 điểm!",
    "Tuyệt vời, cô tặng Đậu một ngôi sao!",
    "Chính xác rồi, Đậu phát âm siêu thế!"
  ],

  EN_PRAISES: [
    "Awesome job, Đậu!",
    "You are amazing, Đậu! Ten out of ten!",
    "Excellent pronunciation, Đậu!",
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
        heroText.textContent = isLoading ? "Cô đang chuẩn bị đọc..." : "Cô đang đọc cho bé nghe...";
      } else {
        heroBtn.classList.remove("pointer-events-none", "opacity-85");
        heroIcon.classList.remove("audio-playing-pulse");
        heroText.textContent = "Chạm để nghe cô đọc";
      }
    }
  },

  // Hiển thị giao diện màn hình học
  render() {
    const container = document.getElementById("screen-learn");
    if (!container) return;

    const word = this.words[this.currentIndex];
    const total = this.words.length;
    const topic = AppState.currentTopic;

    container.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between max-w-4xl mx-auto py-1 sm:py-2 relative">
        <!-- Thanh điều hướng phụ -->
        <div class="flex items-center justify-between w-full px-2">
          <button onclick="AppState.showScreen('screen-home')" aria-label="Quay lại danh sách chủ đề" class="px-3.5 sm:px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer">
            <span aria-hidden="true">⬅️</span>
            <span>Chủ đề</span>
          </button>

          <div class="px-3.5 sm:px-4 py-1.5 rounded-full bg-amber-100/80 text-amber-900 font-extrabold text-xs sm:text-sm border border-amber-200 flex items-center gap-1.5 sm:gap-2">
            <span aria-hidden="true">${topic.icon}</span>
            <span>${topic.title}</span>
            <span class="text-amber-600 font-semibold">• Từ ${this.currentIndex + 1}/${total}</span>
          </div>

          <div class="w-16 sm:w-20"></div>
        </div>

        <!-- THẺ FLASHCARD TRUNG TÂM KHỔ LỚN -->
        <div class="flex-1 flex flex-col items-center justify-center my-1 sm:my-2 w-full">
          <div onclick="LearnScreen.playPrompt()" class="cursor-pointer group relative bg-white rounded-[2.5rem] p-4 sm:p-5 w-full max-w-md shadow-lg border-4 border-amber-200 flex flex-col items-center justify-center transition-all duration-300 hover:scale-[1.01] active:scale-95 text-center">
            
            <!-- Nút loa nhỏ góc trên thẻ -->
            <button onclick="event.stopPropagation(); LearnScreen.playPrompt()" aria-label="Nghe cô phát âm từ ${word.en}" class="absolute top-4 right-4 w-10 h-10 rounded-xl bg-amber-50 group-hover:bg-amber-100 text-amber-700 flex items-center justify-center text-xl shadow-sm transition-all cursor-pointer">
              🔊
            </button>

            <!-- Khung hình ảnh thật cỡ lớn hoặc Emoji trực quan -->
            ${word.image_url ? `
              <div class="w-40 h-40 sm:w-52 sm:h-52 my-1 rounded-2xl overflow-hidden shadow-md border-3 border-white bg-white p-1 flex items-center justify-center relative">
                <img src="${word.image_url}" alt="${word.en}" class="w-full h-full object-contain rounded-xl transition-transform duration-300 group-hover:scale-105" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                <div style="display:none;" class="w-full h-full items-center justify-center text-7xl sm:text-8xl filter drop-shadow-md" aria-hidden="true">
                  ${word.visual}
                </div>
              </div>
            ` : `
              <div class="w-40 h-40 sm:w-52 sm:h-52 my-1 flex items-center justify-center text-7xl sm:text-8xl filter drop-shadow-md group-hover:scale-110 transition-transform" aria-hidden="true">
                ${word.visual}
              </div>
            `}

            <!-- Từ tiếng Anh in đậm sắc nét -->
            <h2 class="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight mt-1 capitalize">
              ${word.en}
            </h2>

            <!-- Nghĩa tiếng Việt -->
            <p class="text-lg sm:text-xl font-bold text-slate-500">
              ${word.vi}
            </p>
          </div>

          <!-- NÚT HÀNH ĐỘNG CHÍNH (HERO ACTION): BÉ CHẠM ĐỂ NGHE CÔ ĐỌC -->
          <div class="w-full flex justify-center mt-3 sm:mt-4">
            <button id="btn-hero-speak" onclick="LearnScreen.playPrompt()" aria-label="Chạm để nghe cô đọc từ ${word.en}" class="w-full max-w-sm py-3.5 sm:py-4 px-6 rounded-3xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-lg sm:text-xl shadow-lg shadow-amber-300/50 border-2 border-white flex items-center justify-center gap-3 transition-all cursor-pointer">
              <span id="hero-speak-icon" class="text-2xl sm:text-3xl" aria-hidden="true">🔊</span>
              <span id="hero-speak-text">Chạm để nghe cô đọc</span>
            </button>
          </div>
        </div>

        <!-- KHU VỰC ĐIỀU KHIỂN DƯỚI ĐÁY: PHỤ HUYNH XÁC NHẬN & CHUYỂN TỪ -->
        <div class="flex flex-col items-center gap-2.5 pb-1 w-full">
          <!-- Nút phụ huynh xác nhận bé đã đọc chuẩn để thưởng sao -->
          <button onclick="LearnScreen.confirmCorrect()" aria-label="Bố mẹ xác nhận bé đọc chuẩn để thưởng sao" class="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm sm:text-base shadow-md shadow-emerald-200/50 flex items-center gap-2 border-2 border-white transition-all cursor-pointer">
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

        <!-- Lớp phủ thông báo Khen thưởng & Hiệu ứng -->
        <div id="praise-overlay" class="hidden absolute inset-0 z-40 bg-white/90 backdrop-blur-sm rounded-[3rem] flex flex-col items-center justify-center p-6 sm:p-8 text-center animate-in fade-in zoom-in duration-200" role="dialog" aria-modal="true" aria-labelledby="praise-title">
          <div id="praise-emoji" class="text-7xl sm:text-8xl mb-3 animate-bounce" aria-hidden="true">🌟</div>
          <h2 id="praise-title" class="text-3xl sm:text-5xl font-black text-amber-500 mb-2"></h2>
          <p id="praise-subtitle" class="text-xl sm:text-2xl font-bold text-slate-600 mb-6">Cô tặng Đậu +1 ⭐ nhé!</p>
          <button onclick="LearnScreen.dismissPraise()" aria-label="Học từ vựng tiếp theo" class="px-7 sm:px-8 py-3 sm:py-3.5 rounded-2xl bg-emerald-400 hover:bg-emerald-500 text-white font-black text-lg sm:text-xl shadow-lg active:scale-95 transition-all cursor-pointer">
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

      // Bước B: Ngay khi tiếng Anh vừa kết thúc, phát tiếp câu tiếng Việt: "Bé Đậu đọc lại cho cô nghe nhé"
      await AppState.speakText("Bé Đậu đọc lại cho cô nghe nhé", "vi");
    } finally {
      if (this.playSequence === currentSeq) {
        this.isSpeaking = false;
      }
    }
  },

  // Xử lý khi ba mẹ bấm nút Xác nhận bé đọc chuẩn
  async confirmCorrect() {
    const word = this.words[this.currentIndex];
    if (!word) return;

    // Ngắt âm thanh đang đọc từ dở nếu có
    AppState.stopAudio();
    this.isSpeaking = false;

    // Cộng sao & lưu tiến trình
    AppState.addStars(1);
    this.saveWordLearned(word.id);

    // Chọn ngẫu nhiên câu khen ngợi của cô
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
      AppState.speakText("Chúc mừng Bé Đậu đã hoàn thành tất cả từ vựng cùng cô!", "vi");
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