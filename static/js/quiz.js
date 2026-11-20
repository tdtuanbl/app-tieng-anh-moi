// Trò chơi Tìm hình 4 ô (Grid 2x2) cho bé Đậu
const QuizScreen = {
  currentWord: null,
  currentPrompt: "",
  options: [],
  isLocked: false,
  preloadPromise: null,
  lastQuestionPrompt: "",
  lastPraise: "",

  VI_QUESTIONS: [
    "Đậu ơi, hình nào là",
    "Tìm cho cô từ:",
    "Đố Đậu biết đâu là",
    "Bé Đậu chỉ cho cô hình",
    "Đậu giỏi ơi, hình nào là"
  ],

  VI_PRAISES: [
    "Đậu xuất sắc quá!",
    "Tuyệt vời, 10 điểm!",
    "Chính xác rồi, Đậu giỏi quá!",
    "Hoan hô bé Đậu, đúng rồi!",
    "Quá đỉnh luôn Đậu ơi!",
    "Giỏi lắm, 10 điểm cho bé Đậu!"
  ],

  getRandomQuestionPrompt() {
    const list = this.VI_QUESTIONS.filter(q => q !== this.lastQuestionPrompt);
    const selected = list[Math.floor(Math.random() * list.length)];
    this.lastQuestionPrompt = selected;
    return selected;
  },

  getRandomPraise() {
    const list = this.VI_PRAISES.filter(p => p !== this.lastPraise);
    const selected = list[Math.floor(Math.random() * list.length)];
    this.lastPraise = selected;
    return selected;
  },

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
      console.error("Lỗi tải trước âm thanh:", err);
      return null;
    }
  },

  // Tạo câu hỏi mới
  nextQuestion() {
    this.isLocked = false;
    const words = AppState.currentTopic.words;
    
    // Chọn 1 từ đúng ngẫu nhiên
    const target = words[Math.floor(Math.random() * words.length)];
    this.currentWord = target;

    // Chọn ngẫu nhiên mẫu câu hỏi tiếng Việt (không lặp)
    this.currentPrompt = this.getRandomQuestionPrompt();

    // Chọn 3 từ nhiễu khác nhau
    const others = words.filter(w => w.id !== target.id);
    this.shuffle(others);
    const distractors = others.slice(0, 3);

    // Xáo trộn 4 đáp án
    this.options = [target, ...distractors];
    this.shuffle(this.options);

    // Tải trước đồng thời audio tiếng Việt và tiếng Anh để xóa độ trễ
    this.preloadPromise = Promise.all([
      this.fetchAudioUrl(this.currentPrompt, "vi"),
      this.fetchAudioUrl(target.en, "en")
    ]);

    // Cập nhật câu hỏi text
    const questionTextEl = document.getElementById("quiz-question-text");
    if (questionTextEl) {
      if (AppState.voiceMode === "bilingual") {
        questionTextEl.textContent = `${this.currentPrompt} "${target.en}"?`;
      } else {
        questionTextEl.textContent = `Where is the "${target.en}", Đậu?`;
      }
    }

    // Render 4 thẻ ô lớn
    const gridEl = document.getElementById("quiz-grid");
    if (gridEl) {
      gridEl.innerHTML = this.options.map((opt, idx) => {
        const visualContent = opt.image_url ? `
          <div class="w-full h-36 md:h-44 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center relative mb-2 shadow-inner border border-slate-100">
            <img src="${opt.image_url}" alt="${opt.en}" class="w-full h-full object-cover rounded-2xl shadow-md transition-transform duration-300 group-hover:scale-105" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div style="display:none;" class="w-full h-full items-center justify-center text-6xl md:text-7xl filter drop-shadow-sm">
              ${opt.visual}
            </div>
          </div>
        ` : `
          <div class="w-full h-36 md:h-44 flex items-center justify-center text-7xl md:text-8xl filter drop-shadow-sm group-hover:scale-110 transition-transform mb-2">
            ${opt.visual}
          </div>
        `;

        return `
          <div id="quiz-card-${idx}" onclick="QuizScreen.handleSelect('${opt.id}', 'quiz-card-${idx}')"
               class="group bg-white rounded-[2rem] border-4 border-slate-100 hover:border-amber-300 shadow-md active:scale-95 transition-all duration-150 cursor-pointer flex flex-col items-center justify-center p-3 text-center overflow-hidden">
            ${visualContent}
            <span class="text-xl md:text-2xl font-black text-slate-800 capitalize leading-tight">
              ${opt.en}
            </span>
          </div>
        `;
      }).join("");
    }

    // Tự động phát âm thanh câu hỏi liền mạch
    setTimeout(() => {
      this.playQuestionPrompt();
    }, 200);
  },

  // Phát chuỗi âm thanh tiếng Việt -> tiếng Anh liền mạch không ngắt quãng
  playSeamlessQuestion(viUrl, enUrl) {
    return new Promise((resolve) => {
      AppState.stopAudio();
      const player = AppState.audioPlayer;
      let switched = false;

      AppState.currentAudioResolve = resolve;

      const cleanup = () => {
        player.ontimeupdate = null;
        player.onended = null;
        player.onerror = null;
        if (AppState.currentAudioResolve === resolve) {
          AppState.currentAudioResolve = null;
        }
        resolve();
      };

      const switchToEnglish = () => {
        if (switched) return;
        switched = true;
        player.ontimeupdate = null;
        player.src = enUrl;
        player.onended = cleanup;
        player.onerror = cleanup;
        player.play().catch(cleanup);
      };

      player.ontimeupdate = () => {
        // Cắt khoảng lặng đuôi của Edge-TTS (khoảng 0.28s) để nối ngay tiếng Anh
        if (player.duration && (player.duration - player.currentTime <= 0.28)) {
          switchToEnglish();
        }
      };

      player.onended = () => {
        if (!switched) {
          switchToEnglish();
        } else {
          cleanup();
        }
      };

      player.onerror = cleanup;

      player.src = viUrl;
      player.play().catch(cleanup);
    });
  },

  // Phát câu hỏi
  async playQuestionPrompt() {
    if (!this.currentWord) return;

    if (AppState.voiceMode === "bilingual") {
      try {
        let urls = null;
        if (this.preloadPromise) {
          urls = await this.preloadPromise;
        }
        const [viUrl, enUrl] = urls || [];
        if (viUrl && enUrl) {
          await this.playSeamlessQuestion(viUrl, enUrl);
        } else {
          await AppState.speakText(this.currentPrompt, "vi");
          await AppState.speakText(this.currentWord.en, "en");
        }
      } catch (e) {
        console.error("Lỗi phát câu hỏi song ngữ:", e);
      }
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
        cardEl.className = "bg-emerald-50 rounded-[2rem] border-4 border-emerald-400 shadow-xl flex flex-col items-center justify-center p-3 text-center scale-105 transition-all overflow-hidden";
      }

      const praiseMsg = AppState.voiceMode === "bilingual"
        ? this.getRandomPraise()
        : "Spot on, Đậu! Awesome!";

      if (feedbackEl) {
        feedbackEl.innerHTML = `<span class="text-emerald-600 font-black text-xl animate-bounce">🎉 ${praiseMsg} +1 ⭐</span>`;
      }

      // Phát tiếng khen ngợi
      await AppState.speakText(praiseMsg, AppState.voiceMode === "bilingual" ? "vi" : "en");
      
      // Chuyển sang câu hỏi kế tiếp
      setTimeout(() => {
        this.nextQuestion();
      }, 900);

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
