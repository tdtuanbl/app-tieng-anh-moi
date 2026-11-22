// Trò chơi Tìm hình 4 ô (Grid 2x2) cho bé Đậu cùng Cô giáo
const QuizScreen = {
  currentWord: null,
  currentPrompt: "",
  options: [],
  isLocked: false,
  preloadPromise: null,
  lastQuestionPrompt: "",
  lastPraise: "",
  selectedTopicId: "all",
  questionQueue: [],
  lastTargetWordId: null,
  lastCorrectIndex: -1,
  distractorCounts: {},

  // 5 mẫu câu hỏi tiếng Việt thân thiện của cô giáo
  VI_QUESTIONS: [
    "Bé Đậu chỉ cho cô hình nào là",
    "Đậu ơi, tìm cho cô từ:",
    "Đố Đậu biết đâu là",
    "Cô đố bé Đậu tìm được hình",
    "Đậu giỏi ơi, hình nào là"
  ],

  // 6 câu khen ngợi ấm áp từ cô giáo
  VI_PRAISES: [
    "Cô khen Đậu xuất sắc quá!",
    "Tuyệt vời, cô cho Đậu 10 điểm!",
    "Chính xác rồi, Đậu giỏi quá!",
    "Hoan hô bé Đậu, đúng rồi nè!",
    "Quá đỉnh luôn, cô tặng Đậu 1 sao!",
    "Giỏi lắm, 10 điểm cho bé Đậu của cô!"
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

  // Thuật toán xáo trộn mảng Fisher-Yates chuẩn xác
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  },

  // Lấy danh sách từ vựng theo chủ đề đang chọn (bao gồm "🎲 Tất cả chủ đề")
  getWordPool() {
    if (this.selectedTopicId === "all") {
      // Gộp toàn bộ từ của cả 6 chủ đề vào 1 kho duy nhất (~150 từ)
      const pool = [];
      const seen = new Set();
      if (AppState.topics && AppState.topics.length > 0) {
        for (const t of AppState.topics) {
          if (t.words) {
            for (const w of t.words) {
              if (!seen.has(w.id)) {
                seen.add(w.id);
                pool.push(w);
              }
            }
          }
        }
      }
      if (pool.length >= 4) return pool;
      return (AppState.currentTopic && AppState.currentTopic.words) ? AppState.currentTopic.words : [];
    }

    // Trường hợp chọn chủ đề cụ thể
    if (AppState.topics && AppState.topics.length > 0) {
      const topic = AppState.topics.find(t => t.id === this.selectedTopicId);
      if (topic && topic.words && topic.words.length >= 4) {
        return topic.words;
      }
    }

    if (AppState.currentTopic && AppState.currentTopic.words && AppState.currentTopic.words.length >= 4) {
      return AppState.currentTopic.words;
    }

    return [];
  },

  // Nạp lại túi xào bài (Shuffle Bag) khi hết lượt
  refillQuestionQueue() {
    const pool = this.getWordPool();
    if (!pool || pool.length === 0) return;

    const newQueue = [...pool];
    this.shuffle(newQueue);

    // Đảm bảo từ đầu tiên của vòng mới không bao giờ trùng với từ vừa hỏi liền trước
    if (newQueue.length > 1 && this.lastTargetWordId && newQueue[0].id === this.lastTargetWordId) {
      const swapIdx = 1 + Math.floor(Math.random() * (newQueue.length - 1));
      [newQueue[0], newQueue[swapIdx]] = [newQueue[swapIdx], newQueue[0]];
    }

    this.questionQueue = newQueue;
  },

  // Rút 1 từ đích tiếp theo từ túi xào bài
  getNextTargetWord() {
    if (!this.questionQueue || this.questionQueue.length === 0) {
      this.refillQuestionQueue();
    }
    const target = this.questionQueue.shift();
    this.lastTargetWordId = target ? target.id : null;
    return target;
  },

  // Bắt đầu màn hình Quiz
  start() {
    const pool = this.getWordPool();
    if (!pool || pool.length < 4) {
      if (AppState.topics && AppState.topics.length > 0) {
        AppState.currentTopic = AppState.topics[0];
      } else {
        const container = document.getElementById("screen-quiz");
        if (container) {
          container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full p-6 text-center max-w-md mx-auto my-auto">
              <div class="text-7xl mb-4 animate-bounce" aria-hidden="true">🎯📚</div>
              <h2 class="text-2xl font-black text-slate-800 mb-2">Chưa đủ từ vựng rồi!</h2>
              <p class="text-base font-bold text-slate-600 mb-6">Chủ đề này chưa có đủ từ vựng để chơi tìm hình. Bé Đậu cùng cô chọn chủ đề khác nhé!</p>
              <button onclick="AppState.showScreen('screen-home')" aria-label="Quay về chọn chủ đề khác" class="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-lg shadow-md transition-all cursor-pointer">
                <span>⬅️ Chọn chủ đề khác</span>
              </button>
            </div>
          `;
        }
        return;
      }
    }
    this.selectedTopicId = (AppState.currentTopic && AppState.currentTopic.id) ? AppState.currentTopic.id : "all";
    this.questionQueue = [];
    this.lastTargetWordId = null;
    this.lastCorrectIndex = -1;
    this.distractorCounts = {};
    this.renderContainer();
    this.nextQuestion();
  },

  // Chuyển đổi chủ đề ngay trong trò chơi
  handleTopicChange(newTopicId) {
    this.selectedTopicId = newTopicId;
    this.questionQueue = [];
    this.lastTargetWordId = null;
    this.lastCorrectIndex = -1;
    if (newTopicId !== "all" && AppState.topics) {
      const found = AppState.topics.find(t => t.id === newTopicId);
      if (found) AppState.currentTopic = found;
    }
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
        <!-- Thanh điều hướng & Câu hỏi & Bộ chọn chủ đề -->
        <div class="flex items-center justify-between w-full px-2 gap-2">
          <button onclick="AppState.showScreen('screen-home')" aria-label="Quay lại danh sách chủ đề" class="px-3.5 md:px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1.5 text-xs md:text-sm shrink-0 cursor-pointer">
            <span aria-hidden="true">⬅️</span>
            <span>Chủ đề</span>
          </button>

          <!-- Nút Loa to & Câu hỏi nổi bật kiêm Loading state -->
          <button id="btn-quiz-speak" onclick="QuizScreen.playQuestionPrompt()" aria-label="Nghe cô đọc lại câu hỏi" class="px-4 md:px-6 py-2.5 rounded-full bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-sm sm:text-base md:text-xl shadow-md flex items-center gap-2 md:gap-3 transition-all truncate max-w-[55%] cursor-pointer">
            <span id="quiz-speak-icon" class="text-xl md:text-2xl" aria-hidden="true">🔊</span>
            <span id="quiz-question-text" class="truncate">Đậu ơi, hình nào là...?</span>
          </button>

          <!-- Bộ chọn chủ đề (kèm lựa chọn 🎲 Tất cả chủ đề) -->
          <div class="flex items-center gap-1.5 bg-emerald-100/90 text-emerald-900 font-extrabold text-xs md:text-sm px-2.5 sm:px-3 py-1.5 rounded-2xl border border-emerald-200 shadow-sm shrink-0">
            <span aria-hidden="true">🎯</span>
            <select id="quiz-topic-select" aria-label="Chọn chủ đề cho câu đố" onchange="QuizScreen.handleTopicChange(this.value)" class="bg-transparent font-black text-xs md:text-sm text-emerald-950 outline-none cursor-pointer border-none pr-1">
              <option value="all" ${this.selectedTopicId === 'all' ? 'selected' : ''}>🎲 Tất cả chủ đề</option>
              ${(AppState.topics || []).map(t => `
                <option value="${t.id}" ${this.selectedTopicId === t.id ? 'selected' : ''}>${t.title}</option>
              `).join("")}
            </select>
          </div>
        </div>

        <!-- LƯỚI 4 Ô CHỮ NHẬT TO (GRID 2x2) VỪA KHÍT MÀN HÌNH IPAD & ĐIỆN THOẠI -->
        <div id="quiz-grid" class="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 md:gap-6 flex-1 w-full my-2 sm:my-3">
          <!-- 4 Ô đáp án được chèn động -->
        </div>

        <!-- Thông báo khích lệ & Trạng thái -->
        <div class="h-10 flex items-center justify-center">
          <p id="quiz-feedback" class="text-sm sm:text-base font-bold text-slate-500">
            Chạm vào hình ảnh bé tìm được nhé! 👆
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

  // Tạo câu hỏi mới (áp dụng túi xào bài + chống lặp vị trí ô 2x2)
  nextQuestion() {
    this.isLocked = false;
    
    // 1. Rút 1 từ đích từ túi xào bài Fisher-Yates (không bao giờ lặp cho đến khi hết vòng)
    const target = this.getNextTargetWord();
    if (!target) return;
    this.currentWord = target;

    // 2. Chọn ngẫu nhiên mẫu câu hỏi tiếng Việt (không lặp với câu liền trước)
    this.currentPrompt = this.getRandomQuestionPrompt();

    // 3. Xào ngẫu nhiên 3 đáp án nhiễu (ưu tiên những từ ít xuất hiện gần đây nhất)
    const pool = this.getWordPool();
    const candidates = pool.filter(w => w.id !== target.id);

    candidates.sort((a, b) => {
      const countA = this.distractorCounts[a.id] || 0;
      const countB = this.distractorCounts[b.id] || 0;
      if (countA !== countB) return countA - countB;
      return Math.random() - 0.5;
    });

    const poolSlice = candidates.slice(0, Math.min(candidates.length, 8));
    this.shuffle(poolSlice);
    const distractors = poolSlice.slice(0, 3);

    // Ghi nhận tần suất xuất hiện của từ nhiễu
    distractors.forEach(d => {
      this.distractorCounts[d.id] = (this.distractorCounts[d.id] || 0) + 1;
    });

    // 4. Chống lặp vị trí ô đúng trong lưới 2x2 (không bao giờ trùng với index câu trước)
    const availableIndices = [0, 1, 2, 3].filter(idx => idx !== this.lastCorrectIndex);
    const correctIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.lastCorrectIndex = correctIndex;

    // Xếp 3 từ nhiễu vào 3 vị trí còn lại sau khi xào trộn
    this.shuffle(distractors);
    this.options = new Array(4);
    this.options[correctIndex] = target;

    let distractorIdx = 0;
    for (let i = 0; i < 4; i++) {
      if (i !== correctIndex) {
        this.options[i] = distractors[distractorIdx++];
      }
    }

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

    // Render 4 thẻ ô lớn với object-contain trên nền trắng sạch
    const gridEl = document.getElementById("quiz-grid");
    if (gridEl) {
      gridEl.innerHTML = this.options.map((opt, idx) => {
        const visualContent = opt.image_url ? `
          <div class="w-full h-36 md:h-44 rounded-2xl overflow-hidden bg-white p-1 flex items-center justify-center relative mb-2 shadow-inner border border-slate-100">
            <img src="${opt.image_url}" alt="${opt.en}" class="w-full h-full object-contain rounded-2xl transition-transform duration-300 group-hover:scale-105" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
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
               onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();QuizScreen.handleSelect('${opt.id}', 'quiz-card-${idx}');}"
               role="button"
               tabindex="0"
               aria-label="Hình ${opt.en}, nghĩa là ${opt.vi}"
               class="group bg-white rounded-[2rem] border-4 border-slate-100 hover:border-amber-300 focus-visible:ring-4 focus-visible:ring-amber-400 shadow-md active:scale-95 transition-all duration-150 cursor-pointer flex flex-col items-center justify-center p-2.5 sm:p-3 text-center overflow-hidden">
            ${visualContent}
            <span class="text-lg sm:text-xl md:text-2xl font-black text-slate-800 capitalize leading-tight">
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
        if (AppState.playbackRate) {
          player.playbackRate = AppState.playbackRate;
          player.defaultPlaybackRate = AppState.playbackRate;
        }
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
      if (AppState.playbackRate) {
        player.playbackRate = AppState.playbackRate;
        player.defaultPlaybackRate = AppState.playbackRate;
      }
      player.play().catch(cleanup);
    });
  },

  // Phát câu hỏi của cô giáo
  async playQuestionPrompt() {
    if (!this.currentWord) return;

    const speakIcon = document.getElementById("quiz-speak-icon");
    const speakBtn = document.getElementById("btn-quiz-speak");
    if (speakIcon) speakIcon.classList.add("audio-playing-pulse");
    if (speakBtn) speakBtn.classList.add("pointer-events-none");

    try {
      if (AppState.voiceMode === "bilingual") {
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
      } else {
        await AppState.speakText(`Where is the ${this.currentWord.en}, Đậu?`, "en");
      }
    } catch (e) {
      console.error("Lỗi phát câu hỏi song ngữ:", e);
    } finally {
      if (speakIcon) speakIcon.classList.remove("audio-playing-pulse");
      if (speakBtn) speakBtn.classList.remove("pointer-events-none");
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

      // Phát tiếng khen ngợi của cô giáo
      await AppState.speakText(praiseMsg, AppState.voiceMode === "bilingual" ? "vi" : "en");
      
      // Chuyển sang câu hỏi kế tiếp
      setTimeout(() => {
        this.nextQuestion();
      }, 900);

    } else {
      // CHỌN NHẦM: Rung lắc & nhắc nhở thân thiện từ cô
      if (cardEl) {
        cardEl.classList.add("shake-box", "border-rose-300");
        setTimeout(() => {
          cardEl.classList.remove("shake-box", "border-rose-300");
        }, 500);
      }

      const wrongMsg = AppState.voiceMode === "bilingual"
        ? "Chưa đúng rồi Đậu ơi, bé tìm lại giúp cô nhé!"
        : "Not quite, try again Đậu!";

      if (feedbackEl) {
        feedbackEl.innerHTML = `<span class="text-amber-800 font-bold text-sm sm:text-base">✨ ${wrongMsg}</span>`;
      }

      await AppState.speakText(wrongMsg, AppState.voiceMode === "bilingual" ? "vi" : "en");
    }
  }
};

window.QuizScreen = QuizScreen;
