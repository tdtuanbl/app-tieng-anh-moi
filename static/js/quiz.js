// Trò chơi Tìm hình 4 ô (Grid 2x2) cho bé Đậu
const QuizScreen = {
  currentWord: null,
  options: [],
  isLocked: false,

  start() {
    if (!AppState.currentTopic || !AppState.currentTopic.words || AppState.currentTopic.words.length < 4) {
      if (AppState.topics && AppState.topics.length > 0) {
        AppState.currentTopic = AppState.topics[0];
      } else {
        return;
      }
    }
    this.renderContainer();
    this.nextQuestion();
  },

  // Khởi tạo khung giao diện zero-scroll
  renderContainer() {
    const container = document.getElementById("screen-quiz");
    if (!container) return;

    container.innerHTML = `
      <style>
        @keyframes quizShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
        .shake-box {
          animation: quizShake 0.4s ease-in-out;
        }
      </style>

      <div class="w-full h-full flex flex-col justify-between max-w-5xl mx-auto py-1 relative">
        <!-- Thanh điều hướng & Câu hỏi -->
        <div class="flex items-center justify-between w-full px-2">
          <button onclick="AppState.showScreen('screen-home')" class="px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-2">
            <span>⬅️</span>
            <span>Chủ đề</span>
          </button>

          <!-- Nút Loa to & Câu hỏi nổi bật -->
          <button onclick="QuizScreen.playQuestionPrompt()" class="px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-xl shadow-md flex items-center gap-3 transition-all">
            <span class="text-2xl animate-pulse">🔊</span>
            <span id="quiz-question-text">Đậu ơi, hình nào là...?</span>
          </button>

          <div class="px-4 py-1.5 rounded-full bg-emerald-100/80 text-emerald-900 font-extrabold text-sm border border-emerald-200 flex items-center gap-2">
            <span>🎯</span>
            <span id="quiz-topic-title">${AppState.currentTopic ? AppState.currentTopic.title : ""}</span>
          </div>
        </div>

        <!-- LƯỚI 4 Ô CHỮ NHẬT TO (GRID 2x2) VỪA KHÍT MÀN HÌNH IPAD -->
        <div id="quiz-grid" class="grid grid-cols-2 grid-rows-2 gap-4 md:gap-6 flex-1 w-full my-3">
          <!-- 4 Ô đáp án được chèn động -->
        </div>

        <!-- Thông báo khích lệ & Trạng thái -->
        <div class="h-10 flex items-center justify-center">
          <p id="quiz-feedback" class="text-base font-bold text-slate-500">
            Chạm vào hình ảnh bé cho là đúng nhé! 👆
          </p>
        </div>
      </div>
    `;
  },

  // Tạo câu hỏi mới
  nextQuestion() {
    this.isLocked = false;
    const words = AppState.currentTopic.words;
    
    // Chọn 1 từ đúng ngẫu nhiên
    const target = words[Math.floor(Math.random() * words.length)];
    this.currentWord = target;

    // Chọn 3 từ nhiễu khác nhau
    const others = words.filter(w => w.id !== target.id);
    this.shuffle(others);
    const distractors = others.slice(0, 3);

    // Xáo trộn 4 đáp án
    this.options = [target, ...distractors];
    this.shuffle(this.options);

    // Cập nhật câu hỏi text
    const questionTextEl = document.getElementById("quiz-question-text");
    if (questionTextEl) {
      if (AppState.voiceMode === "bilingual") {
        questionTextEl.textContent = `Đậu ơi, hình nào là "${target.en}"?`;
      } else {
        questionTextEl.textContent = `Where is the "${target.en}", Đậu?`;
      }
    }

    // Render 4 thẻ ô lớn
    const gridEl = document.getElementById("quiz-grid");
    if (gridEl) {
      gridEl.innerHTML = this.options.map((opt, idx) => `
        <div id="quiz-card-${idx}" onclick="QuizScreen.handleSelect('${opt.id}', 'quiz-card-${idx}')"
             class="group bg-white rounded-[2.5rem] border-4 border-slate-100 hover:border-amber-300 shadow-md active:scale-95 transition-all duration-150 cursor-pointer flex flex-col items-center justify-center p-4 text-center">
          <div class="text-7xl md:text-8xl filter drop-shadow-sm group-hover:scale-110 transition-transform mb-1">
            ${opt.visual}
          </div>
          <span class="text-2xl md:text-3xl font-extrabold text-slate-800 capitalize">
            ${opt.en}
          </span>
        </div>
      `).join("");
    }

    // Tự động phát âm thanh câu hỏi
    setTimeout(() => {
      this.playQuestionPrompt();
    }, 300);
  },

  // Phát câu hỏi theo chế độ giọng nói
  async playQuestionPrompt() {
    if (!this.currentWord) return;
    if (AppState.voiceMode === "bilingual") {
      await AppState.speakText("Đậu ơi, hình nào là:", "vi");
      await AppState.speakText(this.currentWord.en, "en");
    } else {
      await AppState.speakText(`Where is the ${this.currentWord.en}, Đậu?`, "en");
    }
  },

  // Xử lý khi bé chạm chọn ô
  async handleSelect(chosenId, cardElementId) {
    if (this.isLocked) return;

    const cardEl = document.getElementById(cardElementId);
    const feedbackEl = document.getElementById("quiz-feedback");

    if (chosenId === this.currentWord.id) {
      // ĐÚNG Ô!
      this.isLocked = true;
      AppState.addStars(1);

      if (cardEl) {
        cardEl.className = "bg-emerald-50 rounded-[2.5rem] border-4 border-emerald-400 shadow-xl flex flex-col items-center justify-center p-4 text-center scale-105 transition-all";
      }

      const praiseMsg = AppState.voiceMode === "bilingual"
        ? "Đúng rồi! Đậu giỏi quá!"
        : "Spot on, Đậu! Awesome!";

      if (feedbackEl) {
        feedbackEl.innerHTML = `<span class="text-emerald-600 font-black text-xl animate-bounce">🎉 ${praiseMsg} +1 ⭐</span>`;
      }

      // Phát tiếng khen ngợi
      await AppState.speakText(praiseMsg, AppState.voiceMode === "bilingual" ? "vi" : "en");
      
      // Chuyển sang câu hỏi kế tiếp
      setTimeout(() => {
        this.nextQuestion();
      }, 1000);

    } else {
      // CHỌN NHẦM: Rung lắc & nhắc nhở thân thiện
      if (cardEl) {
        cardEl.classList.add("shake-box", "border-rose-300");
        setTimeout(() => {
          cardEl.classList.remove("shake-box", "border-rose-300");
        }, 500);
      }

      const wrongMsg = AppState.voiceMode === "bilingual"
        ? "Chưa đúng rồi Đậu ơi, tìm lại nhé!"
        : "Not quite, try again Đậu!";

      if (feedbackEl) {
        feedbackEl.innerHTML = `<span class="text-amber-700 font-bold text-base">✨ ${wrongMsg}</span>`;
      }

      await AppState.speakText(wrongMsg, AppState.voiceMode === "bilingual" ? "vi" : "en");
    }
  },

  // Thuật toán xáo trộn mảng Fisher-Yates
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
};

window.QuizScreen = QuizScreen;
