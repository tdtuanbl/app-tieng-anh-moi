// Màn hình Học từ vựng & Luyện phát âm cho bé Đậu
const LearnScreen = {
  currentIndex: 0,
  words: [],
  isListening: false,
  recognition: null,
  isSpeaking: false,
  hasMatched: false,

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
    this.stopListening();
    this.initRecognition();
    this.render();
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
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 5;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.updateMicUI(true);
    };

    this.recognition.onresult = (event) => {
      if (this.hasMatched) return;
      const word = this.words[this.currentIndex];
      if (!word) return;
      const target = word.en.toLowerCase().trim();

      let latestTranscript = "";

      // Duyệt riêng rẽ từng alternative trong tất cả các kết quả (cả interim và final)
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        for (let j = 0; j < res.length; j++) {
          const candidate = res[j].transcript;
          if (!latestTranscript && candidate.trim()) {
            latestTranscript = candidate.trim();
          }
          if (this.matchCandidate(candidate, target)) {
            this.showTranscript(candidate.trim(), true);
            this.handleSuccess(word);
            return;
          }
        }
      }

      if (latestTranscript) {
        this.showTranscript(latestTranscript, false);
      }
    };

    this.recognition.onerror = (event) => {
      this.isListening = false;
      const err = event && event.error ? event.error : "";
      if (err === "not-allowed" || err === "service-not-allowed") {
        this.showMicError("Bố hãy bấm nút 'aA' (hoặc biểu tượng Micro) trên thanh địa chỉ Safari và chọn Cho phép Micro nhé!");
      } else if (err === "no-speech") {
        this.updateMicUI(false);
      } else {
        this.updateMicUI(false);
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (!this.hasMatched) {
        this.updateMicUI(false);
      }
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

  // Hiển thị trực quan transcript khi bé nói
  showTranscript(text, isMatch) {
    const box = document.getElementById("mic-status-box");
    if (!box) return;
    const styleClass = isMatch
      ? "text-emerald-700 bg-emerald-50 border-emerald-300"
      : "text-amber-800 bg-amber-50 border-amber-300";
    box.innerHTML = `
      <div class="px-6 py-2.5 rounded-full ${styleClass} border-2 shadow-sm flex items-center gap-2 text-lg font-black animate-pulse">
        <span>🎙️</span>
        <span>Đậu đang nói: "${text}"</span>
      </div>
    `;
  },

  // Hiển thị lỗi Micro minh bạch
  showMicError(msg) {
    const box = document.getElementById("mic-status-box");
    if (!box) return;
    box.innerHTML = `
      <div class="px-5 py-3 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-800 text-sm md:text-base font-extrabold flex items-center gap-2 text-center shadow-md">
        <span>⚠️</span>
        <span>${msg}</span>
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
          <span class="font-black text-rose-600 text-lg">Đậu nói đi, cô đang lắng nghe... 🎙️</span>
        </div>
      `;
    } else {
      box.innerHTML = `
        <button onclick="LearnScreen.startListening()" class="px-6 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-base flex items-center gap-2 active:scale-95 transition-all shadow-sm">
          <span>🎙️</span>
          <span>Chạm vào đây để Đậu nói</span>
        </button>
      `;
    }
  },

  // Nút Micro sẵn sàng, nổi bật để bé chạm (chuẩn User Gesture Safari iOS)
  readyForChildSpeech() {
    const box = document.getElementById("mic-status-box");
    if (!box) return;
    box.innerHTML = `
      <button onclick="LearnScreen.startListening()" class="px-8 py-3.5 rounded-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white font-black text-xl shadow-xl shadow-rose-300/60 animate-bounce active:scale-95 transition-all flex items-center gap-3 border-2 border-white">
        <span class="text-2xl animate-pulse">🎙️</span>
        <span>Bé Đậu chạm vào đây để nói</span>
      </button>
    `;
  },

  // Phát từ tiếng Anh và câu nhắc khi chạm vào thẻ
  async playPrompt() {
    if (this.isSpeaking) return;
    this.isSpeaking = true;
    this.stopListening();
    const word = this.words[this.currentIndex];

    try {
      // Bước A: Phát âm từ tiếng Anh (ví dụ: "Dog")
      await AppState.speakText(word.en, "en");
      // Bước B: Ngay khi tiếng Anh vừa kết thúc, phát tiếp câu tiếng Việt ngắn gọn: "Đậu đọc lại cho cô nhé"
      await AppState.speakText("Đậu đọc lại cho cô nhé", "vi");
    } finally {
      this.isSpeaking = false;
      // Chuyển nút Micro sang trạng thái sẵn sàng để bé chạm trực tiếp
      this.readyForChildSpeech();
    }
  },

  // Bật thu âm micro trực tiếp từ thao tác chạm của bé (User Gesture)
  startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.showMicError("Trình duyệt chưa hỗ trợ nhận diện giọng nói.");
      return;
    }

    this.hasMatched = false;
    this.isListening = true;

    try {
      if (!this.recognition) {
        this.initRecognition();
      }
      this.recognition.start();
      this.updateMicUI(true);
    } catch (err) {
      if (err.name === "InvalidStateError") {
        try {
          this.recognition.abort();
          setTimeout(() => {
            try {
              this.recognition.start();
              this.updateMicUI(true);
            } catch (e) {}
          }, 100);
        } catch (e) {}
      } else {
        console.warn("Lỗi startListening:", err);
      }
    }
  },

  // Dừng micro
  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {}
    }
  },

  // Xử lý khi bé phát âm đúng
  handleSuccess(word) {
    if (this.hasMatched) return;
    this.hasMatched = true;
    this.stopListening();

    // Đọc đúng: Cộng sao & lưu tiến trình
    AppState.addStars(1);
    this.saveWordLearned(word.id);

    // Chọn ngẫu nhiên câu khen
    const isBilingual = AppState.voiceMode === "bilingual";
    const praises = isBilingual ? this.VI_PRAISES : this.EN_PRAISES;
    const praise = praises[Math.floor(Math.random() * praises.length)];

    this.showPraise(praise, true);
    AppState.speakText(praise, isBilingual ? "vi" : "en");
  },

  // Khớp từng phương án dự phòng cho trẻ 5 tuổi
  matchCandidate(candidate, target) {
    if (!candidate || !target) return false;
    const cleanCand = candidate.toLowerCase().trim();
    const cleanTarget = target.toLowerCase().trim();

    // Tách thành các từ nếu bé nói cả cụm (ví dụ: "a dog", "it's cat")
    const words = cleanCand.replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
    if (words.length === 0) return false;

    // Kiểm tra toàn bộ chuỗi
    if (this.fuzzyMatchWord(cleanCand.replace(/[^a-z0-9]/g, ""), cleanTarget)) {
      return true;
    }
    // Kiểm tra từng từ đơn
    for (const w of words) {
      if (this.fuzzyMatchWord(w, cleanTarget)) {
        return true;
      }
    }
    return false;
  },

  // So sánh tương đối âm gần giống, hỗ trợ đặc trưng phát âm trẻ 5 tuổi
  fuzzyMatchWord(s, t) {
    if (!s || !t) return false;
    // 1. Khớp chính xác hoặc chứa nhau
    if (s === t || s.includes(t) || t.includes(s)) return true;

    // 2. Trẻ 5 tuổi nuốt âm cuối (bỏ 1 hoặc 2 âm cuối): ví dụ cat -> ca, dog -> do, fish -> fi/fis
    if (t.length >= 3) {
      if (s === t.slice(0, -1)) return true;
      if (t.length >= 4 && s === t.slice(0, -2)) return true;
    }

    // 3. Khớp âm tiết đầu nếu âm tiết >= 2 ký tự (ví dụ: cat -> ca/cut, dog -> do/dock)
    if (t.length >= 3) {
      const prefix = t.slice(0, 2);
      if (s.startsWith(prefix) && s.length <= t.length + 1) return true;
    }

    // 4. Khoảng cách Levenshtein (biến âm như cat -> cut, dog -> dock, fish -> fit)
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

    const maxDist = t.length <= 4 ? 2 : Math.min(3, Math.floor(t.length / 2) + 1);
    return d[s.length][t.length] <= maxDist;
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
    this.stopListening();
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
    this.stopListening();
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.render();
    }
  }
};

window.LearnScreen = LearnScreen;
