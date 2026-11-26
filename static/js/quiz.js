// Trò chơi Tìm hình 4 ô (Grid 2x2) cho bé Đậu cùng Cô giáo
const QuizScreen = {
  currentWord: null,
  currentPrompt: "",
  options: [],
  isLocked: false,
  preloadPromise: null,
  lastQuestionPrompt: "",
  lastPraise: "",
  lastEnPraise: "",
  lastEncouragement: "",
  lastEnEncouragement: "",
  selectedTopicId: "all",
  questionQueue: [],
  lastTargetWordId: null,
  lastCorrectIndex: -1,
  distractorCounts: {},
  ttsUrlCache: new Map(),
  webAudioCtx: null,
  preloadedPraises: {},
  nextQuestionData: null,
  currentStageQuestion: 0,
  stageTotalQuestions: 5,
  stageStars: 0,
  streak: 0,
  mascotState: "normal",

  // 5 mẫu câu hỏi tiếng Việt thân thiện của cô giáo
  VI_QUESTIONS: [
    "Đậu ơi, chỉ cho cô xem đâu là",
    "Đậu tìm giúp cô hình",
    "Đố Đậu biết đâu là hình",
    "Cô đố Đậu tìm được hình",
    "Đậu yêu ơi, đâu là hình"
  ],

  // 6 câu khen ngợi ấm áp từ cô giáo khi chọn đúng
  VI_PRAISES: [
    "Giỏi quá Đậu ơi, đúng rồi nè!",
    "Tuyệt vời, cô thưởng Đậu một ngôi sao nhé!",
    "Chính xác rồi, Đậu giỏi lắm!",
    "Hoan hô, Đậu của cô giỏi quá!",
    "Đậu siêu quá, cô thưởng một ngôi sao nhé!",
    "Xuất sắc lắm Đậu ơi, mười điểm luôn!"
  ],

  // Câu khen tiếng Anh
  EN_PRAISES: [
    "Spot on, Đậu! Awesome!",
    "Great job, Đậu!",
    "Super, you found it, Đậu!",
    "Brilliant, Đậu! Well done!"
  ],

  // 4 câu động viên nhẹ nhàng ấm áp khi chọn nhầm
  VI_ENCOURAGEMENTS: [
    "Chưa đúng rồi Đậu ơi, thử lại nhé!",
    "Gần đúng rồi, bé nhìn kỹ lại nào!",
    "Đậu thử lại cùng cô nhé, cố lên!",
    "Không sao đâu, Đậu chọn lại xem nào!"
  ],

  // Câu động viên tiếng Anh
  EN_ENCOURAGEMENTS: [
    "Not quite, try again Đậu!",
    "Almost there, look closely Đậu!",
    "Give it another try, Đậu!"
  ],

  // Khởi tạo AudioContext đơn vị (Singleton) sẵn sàng phát tức thì 0ms
  getAudioContext() {
    if (!this.webAudioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.webAudioCtx = new AudioCtx();
      }
    }
    if (this.webAudioCtx && this.webAudioCtx.state === "suspended") {
      this.webAudioCtx.resume().catch(() => {});
    }
    return this.webAudioCtx;
  },

  // Hiệu ứng âm thanh "Ting!" pha lê vui tai tức thì 0ms bằng Web Audio API nội bộ
  playVictoryChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Hợp âm Ting! pha lê đôi: Note 1 (E6: 1318.5Hz) vút lên Note 2 (C7: 2093Hz) kèm âm hòa sắc 2637Hz
      const chimes = [
        { freq: 1318.51, time: now, duration: 0.35, gain: 0.25 },
        { freq: 2093.00, time: now + 0.045, duration: 0.45, gain: 0.32 },
        { freq: 2637.02, time: now + 0.075, duration: 0.35, gain: 0.16 }
      ];

      chimes.forEach(chime => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(chime.freq, chime.time);

        gain.gain.setValueAtTime(0.001, chime.time);
        gain.gain.exponentialRampToValueAtTime(chime.gain, chime.time + 0.008); // Bật tiếng đanh tức thì 8ms
        gain.gain.exponentialRampToValueAtTime(0.0001, chime.time + chime.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(chime.time);
        osc.stop(chime.time + chime.duration + 0.05);
      });
    } catch (e) {
      console.warn("Lỗi phát victory chime:", e);
    }
  },

  // Hiệu ứng âm thanh hợp âm chiến thắng khi đạt Combo Streak >= 3 (C5 - E5 - G5)
  playComboChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Hợp âm 3 nốt vút cao liên tiếp vui nhộn: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz)
      const notes = [
        { freq: 523.25, time: now + 0.05, duration: 0.3, gain: 0.22 },
        { freq: 659.25, time: now + 0.14, duration: 0.32, gain: 0.25 },
        { freq: 783.99, time: now + 0.24, duration: 0.45, gain: 0.30 }
      ];

      notes.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(note.freq, note.time);

        gain.gain.setValueAtTime(0.001, note.time);
        gain.gain.exponentialRampToValueAtTime(note.gain, note.time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, note.time + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(note.time);
        osc.stop(note.time + note.duration + 0.05);
      });
    } catch (e) {
      console.warn("Lỗi phát combo chime:", e);
    }
  },

  // Hiệu ứng âm thanh báo chọn nhầm nhẹ nhàng, trầm ấm vui tai 0ms (Web Audio API)
  playEncourageSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // 2 nốt trầm ấm êm tai (220Hz -> 174.6Hz), không chói tai cho bé 5 tuổi
      const notes = [
        { freq: 220.0, time: now, duration: 0.16, gain: 0.2 },
        { freq: 174.61, time: now + 0.11, duration: 0.28, gain: 0.25 }
      ];

      notes.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle"; // Dạng sóng triangle êm dịu, ấm áp
        osc.frequency.setValueAtTime(note.freq, note.time);
        osc.frequency.exponentialRampToValueAtTime(note.freq * 0.9, note.time + note.duration);

        gain.gain.setValueAtTime(0.001, note.time);
        gain.gain.exponentialRampToValueAtTime(note.gain, note.time + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, note.time + note.duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(note.time);
        osc.stop(note.time + note.duration + 0.05);
      });
    } catch (e) {
      console.warn("Lỗi phát encourage sound:", e);
    }
  },

  // Nạp trước toàn bộ câu khen ngợi (khi đúng) VÀ câu động viên (khi sai) vào RAM (ttsUrlCache)
  preloadFeedbackAudio() {
    const items = [];
    this.VI_PRAISES.forEach(text => items.push({ text, lang: "vi" }));
    this.VI_ENCOURAGEMENTS.forEach(text => items.push({ text, lang: "vi" }));
    this.EN_PRAISES.forEach(text => items.push({ text, lang: "en" }));
    this.EN_ENCOURAGEMENTS.forEach(text => items.push({ text, lang: "en" }));

    // Tải ngầm xen kẽ nhanh (mỗi 180ms một câu) để sớm có sẵn trong RAM mà không nghẽn mạng
    items.forEach((item, index) => {
      setTimeout(() => {
        const key = `${item.lang}_${item.text}`;
        if (!this.ttsUrlCache || !this.ttsUrlCache.has(key)) {
          this.fetchAudioUrl(item.text, item.lang);
        }
      }, 100 + index * 180);
    });
  },

  // Phát file audio đã được nạp sẵn từ cache một cách an toàn và giải phóng listener
  playPreloadedAudio(url) {
    return new Promise((resolve) => {
      if (!url) {
        resolve();
        return;
      }
      try {
        AppState.stopAudio();
        const player = AppState.audioPlayer;
        if (!player) {
          resolve();
          return;
        }

        player.ontimeupdate = null; // Xóa sạch listener cũ tránh xung đột
        AppState.currentAudioResolve = resolve;

        let finished = false;
        const onFinish = () => {
          if (finished) return;
          finished = true;
          player.ontimeupdate = null;
          player.onended = null;
          player.onerror = null;
          if (AppState.currentAudioResolve === resolve) {
            AppState.currentAudioResolve = null;
          }
          resolve();
        };

        player.onended = onFinish;
        player.onerror = onFinish;
        player.src = url;
        if (AppState.playbackRate) {
          player.playbackRate = AppState.playbackRate;
          player.defaultPlaybackRate = AppState.playbackRate;
        }
        player.play().catch(onFinish);
      } catch (e) {
        console.warn("Lỗi phát audio có sẵn:", e);
        resolve();
      }
    });
  },

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

  getRandomEnPraise() {
    const list = this.EN_PRAISES.filter(p => p !== this.lastEnPraise);
    const selected = list[Math.floor(Math.random() * list.length)];
    this.lastEnPraise = selected;
    return selected;
  },

  getRandomEncouragement() {
    const list = this.VI_ENCOURAGEMENTS.filter(e => e !== this.lastEncouragement);
    const selected = list[Math.floor(Math.random() * list.length)];
    this.lastEncouragement = selected;
    return selected;
  },

  getRandomEnEncouragement() {
    const list = this.EN_ENCOURAGEMENTS.filter(e => e !== this.lastEnEncouragement);
    const selected = list[Math.floor(Math.random() * list.length)];
    this.lastEnEncouragement = selected;
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
    this.getAudioContext();
    this.preloadFeedbackAudio();
    this.currentStageQuestion = 0;
    this.stageStars = 0;
    this.streak = 0;
    this.mascotState = "normal";

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
              <p class="text-base font-bold text-slate-600 mb-6">Chủ đề này chưa có đủ từ vựng để chơi tìm hình. Đậu cùng cô chọn chủ đề khác nhé!</p>
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
    if (!this.nextQuestionData) {
      this.questionQueue = [];
      this.lastTargetWordId = null;
      this.lastCorrectIndex = -1;
      this.distractorCounts = {};
    }
    this.renderContainer();
    this.nextQuestion();
  },

  // Chuyển đổi chủ đề ngay trong trò chơi
  handleTopicChange(newTopicId) {
    this.selectedTopicId = newTopicId;
    this.questionQueue = [];
    this.lastTargetWordId = null;
    this.lastCorrectIndex = -1;
    this.nextQuestionData = null;
    this.currentStageQuestion = 0;
    this.stageStars = 0;
    this.streak = 0;
    if (newTopicId !== "all" && AppState.topics) {
      const found = AppState.topics.find(t => t.id === newTopicId);
      if (found) AppState.currentTopic = found;
    }
    this.nextQuestion();
  },

  // Cập nhật thanh tiến độ chặng 5 câu
  updateStageProgress() {
    const numEl = document.getElementById("quiz-stage-num");
    if (numEl) {
      numEl.textContent = `${this.currentStageQuestion + 1}/${this.stageTotalQuestions}`;
    }
    for (let i = 0; i < this.stageTotalQuestions; i++) {
      const stepEl = document.getElementById(`quiz-step-${i}`);
      if (stepEl) {
        if (i < this.currentStageQuestion) {
          stepEl.className = "flex-1 h-3 sm:h-3.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 shadow-sm relative flex items-center justify-center transition-all duration-300";
          stepEl.innerHTML = '<span class="text-[10px] leading-none">⭐</span>';
        } else if (i === this.currentStageQuestion) {
          stepEl.className = "flex-1 h-3 sm:h-3.5 rounded-full bg-amber-300 ring-2 ring-amber-400 ring-offset-1 animate-pulse relative flex items-center justify-center transition-all duration-300";
          stepEl.innerHTML = '';
        } else {
          stepEl.className = "flex-1 h-3 sm:h-3.5 rounded-full bg-slate-200 relative flex items-center justify-center transition-all duration-300";
          stepEl.innerHTML = '';
        }
      }
    }
    const trophyEl = document.getElementById("quiz-stage-trophy");
    if (trophyEl) {
      if (this.currentStageQuestion === this.stageTotalQuestions - 1) {
        trophyEl.className = "text-xl sm:text-2xl filter drop-shadow-sm shrink-0 animate-bounce";
      } else {
        trophyEl.className = "text-xl sm:text-2xl filter drop-shadow-sm shrink-0 opacity-70";
      }
    }
  },

  // Cập nhật trạng thái biểu cảm linh vật cổ vũ
  setMascot(state) {
    this.mascotState = state;
    const avatarEl = document.getElementById("quiz-mascot-avatar");
    const speechEl = document.getElementById("quiz-mascot-speech");
    const cardEl = document.getElementById("quiz-mascot-card");
    if (!avatarEl || !speechEl) return;

    if (state === "happy") {
      avatarEl.textContent = "🎉";
      avatarEl.className = "text-2xl sm:text-3xl animate-bounce";
      speechEl.textContent = "Hoan hô, Đậu siêu quá! 👏";
      speechEl.className = "text-xs font-black text-emerald-600 truncate";
      if (cardEl) cardEl.className = "flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-2xl bg-emerald-50 shadow-sm border border-emerald-300 transition-all duration-300 shrink-0";
    } else if (state === "encourage") {
      avatarEl.textContent = "😉";
      avatarEl.className = "text-2xl sm:text-3xl animate-pulse";
      speechEl.textContent = "Thử lại cùng cô nào Đậu ơi! ❤️";
      speechEl.className = "text-xs font-black text-amber-700 truncate";
      if (cardEl) cardEl.className = "flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-2xl bg-amber-50 shadow-sm border border-amber-300 transition-all duration-300 shrink-0";
    } else {
      avatarEl.textContent = "🥑";
      avatarEl.className = "text-2xl sm:text-3xl";
      speechEl.textContent = "Đậu lắng nghe câu hỏi nhé! 👂";
      speechEl.className = "text-xs font-bold text-slate-600 truncate";
      if (cardEl) cardEl.className = "flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-2xl bg-white/90 shadow-sm border border-amber-200 transition-all duration-300 shrink-0";
    }
  },

  // Hiệu ứng pháo giấy Confetti mini bung tỏa tại ô đáp án đúng
  triggerConfetti(cardEl) {
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const colors = ["#f59e0b", "#10b981", "#38bdf8", "#ec4899", "#8b5cf6", "#facc15"];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const piece = document.createElement("div");
      const size = 6 + Math.random() * 8;
      const color = colors[Math.floor(Math.random() * colors.length)];
      piece.className = "fixed rounded-sm pointer-events-none z-50";
      piece.style.width = `${size}px`;
      piece.style.height = `${size * (Math.random() > 0.5 ? 1 : 1.5)}px`;
      piece.style.backgroundColor = color;
      piece.style.left = `${rect.left + rect.width / 2}px`;
      piece.style.top = `${rect.top + rect.height / 2}px`;
      piece.style.transform = "translate(0, 0)";
      piece.style.transition = "transform 0.65s cubic-bezier(0.1, 0.8, 0.3, 1), opacity 0.65s ease-out";
      document.body.appendChild(piece);

      const angle = (i / count) * 2 * Math.PI + (Math.random() - 0.5) * 0.5;
      const distance = 40 + Math.random() * 70;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - 20;

      requestAnimationFrame(() => {
        piece.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`;
        piece.style.opacity = "0";
      });

      setTimeout(() => piece.remove(), 700);
    }
  },

  // Hiệu ứng Ngôi sao vàng bay vút từ ô đáp án lên thanh điểm số Header
  triggerFlyingStar(cardEl) {
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const targetEl = document.getElementById("star-count") || document.getElementById("btn-home");
    const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: 80, top: 20 };

    const star = document.createElement("div");
    star.className = "fixed text-3xl pointer-events-none z-50 filter drop-shadow-[0_4px_10px_rgba(250,204,21,0.8)]";
    star.textContent = "⭐";
    star.style.left = `${rect.left + rect.width / 2 - 16}px`;
    star.style.top = `${rect.top + rect.height / 2 - 16}px`;
    star.style.transition = "transform 0.75s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.75s ease-in, scale 0.75s ease-in";
    document.body.appendChild(star);

    const dx = (targetRect.left + 10) - (rect.left + rect.width / 2 - 16);
    const dy = (targetRect.top + 10) - (rect.top + rect.height / 2 - 16);

    requestAnimationFrame(() => {
      star.style.transform = `translate(${dx}px, ${dy}px) scale(0.6)`;
      star.style.opacity = "0.9";
    });

    setTimeout(() => {
      star.remove();
      if (targetEl) {
        targetEl.classList.remove("scale-125");
        void targetEl.offsetWidth;
        targetEl.classList.add("scale-125", "transition-transform");
        setTimeout(() => targetEl.classList.remove("scale-125"), 250);
      }
    }, 750);
  },

  // Hiển thị Modal chúc mừng Trao Cúp Vàng sau 5 câu
  showStageCompletionModal() {
    const modal = document.getElementById("quiz-stage-modal");
    const starsEarnedEl = document.getElementById("stage-stars-earned");
    if (starsEarnedEl) {
      starsEarnedEl.textContent = this.stageStars;
    }
    if (modal) {
      modal.classList.remove("hidden");
    }
    this.playVictoryChime();
    setTimeout(() => this.playVictoryChime(), 260);

    if (AppState.voiceMode === "bilingual") {
      AppState.speakText("Hoan hô! Đậu của cô xuất sắc nhận cúp vàng rồi!", "vi");
    } else {
      AppState.speakText("Hurray! You got the golden trophy, Đậu!", "en");
    }
  },

  // Chơi lại chặng 5 câu mới
  startNewStage() {
    const modal = document.getElementById("quiz-stage-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
    this.currentStageQuestion = 0;
    this.stageStars = 0;
    this.streak = 0;
    const comboBadge = document.getElementById("quiz-combo-badge");
    if (comboBadge) {
      comboBadge.classList.add("hidden");
      comboBadge.classList.remove("flex");
    }
    this.nextQuestionData = null;
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
        <!-- TẦNG 1: Thanh điều hướng & Câu hỏi & Bộ chọn chủ đề -->
        <div class="flex items-center justify-between w-full px-2 gap-2">
          <button onclick="AppState.showScreen('screen-home')" aria-label="Quay lại danh sách chủ đề" class="px-3.5 md:px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-1.5 text-xs md:text-sm shrink-0 cursor-pointer">
            <span aria-hidden="true">⬅️</span>
            <span>Chủ đề</span>
          </button>

          <!-- Nút Loa to & Câu hỏi nổi bật kiêm Loading state (không cắt cụt từ dài) -->
          <button type="button" id="btn-quiz-speak" onclick="QuizScreen.playQuestionPrompt()" aria-label="Nghe cô đọc lại câu hỏi" class="px-4 md:px-6 py-2 rounded-3xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-sm sm:text-base md:text-lg shadow-md flex items-center justify-center gap-2 md:gap-2.5 transition-all max-w-full sm:max-w-[60%] cursor-pointer">
            <span id="quiz-speak-icon" class="text-xl md:text-2xl shrink-0" aria-hidden="true">🔊</span>
            <span id="quiz-question-text" class="whitespace-normal break-words leading-tight text-center">Đậu ơi, hình nào là...?</span>
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

        <!-- TẦNG 2: THANH TIẾN ĐỘ CHẶNG 5 CÂU HƯỚNG TỚI CÚP VÀNG -->
        <div class="w-full px-3 py-1 flex items-center justify-between gap-2 max-w-xl mx-auto">
          <div class="flex items-center gap-1.5 font-black text-xs md:text-sm text-amber-800 bg-amber-100/90 px-2.5 py-0.5 rounded-full shadow-inner shrink-0">
            <span>Chặng</span>
            <span id="quiz-stage-num">${this.currentStageQuestion + 1}/${this.stageTotalQuestions}</span>
          </div>

          <!-- Dãy 5 nấc sao -->
          <div class="flex-1 flex items-center justify-between gap-1.5 sm:gap-2 px-1">
            ${[0, 1, 2, 3, 4].map(i => `
              <div id="quiz-step-${i}" class="flex-1 h-3 sm:h-3.5 rounded-full transition-all duration-300 ${i < this.currentStageQuestion ? 'bg-gradient-to-r from-amber-400 to-yellow-400 shadow-sm' : (i === this.currentStageQuestion ? 'bg-amber-300 ring-2 ring-amber-400 ring-offset-1 animate-pulse' : 'bg-slate-200')} relative flex items-center justify-center">
                ${i < this.currentStageQuestion ? '<span class="text-[10px] leading-none">⭐</span>' : ''}
              </div>
            `).join("")}
          </div>

          <!-- Biểu tượng Cúp Vàng đích đến -->
          <div id="quiz-stage-trophy" class="text-xl sm:text-2xl filter drop-shadow-sm shrink-0 transition-transform ${this.currentStageQuestion === this.stageTotalQuestions - 1 ? 'animate-bounce' : 'opacity-70'}">
            🏆
          </div>
        </div>

        <!-- TẦNG 3: LƯỚI 4 Ô CHỮ NHẬT TO (GRID 2x2) VỪA KHÍT MÀN HÌNH IPAD & ĐIỆN THOẠI -->
        <div id="quiz-grid" class="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4 md:gap-5 flex-1 w-full my-1 sm:my-2">
          <!-- 4 Ô đáp án được chèn động -->
        </div>

        <!-- TẦNG 4: KHU VỰC THÔNG BÁO, NHÂN VẬT CỔ VŨ MINI & HUY HIỆU COMBO -->
        <div class="min-h-[3rem] flex items-center justify-between w-full px-2 sm:px-4 py-1 gap-2 bg-white/60 backdrop-blur-xs rounded-2xl border border-amber-100">
          <!-- Linh vật Bé Đậu & Cô giáo mini -->
          <div id="quiz-mascot-card" class="flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-2xl bg-white/90 shadow-sm border border-amber-200 transition-all duration-300 shrink-0">
            <div id="quiz-mascot-avatar" class="text-2xl sm:text-3xl transition-transform duration-300">
              🥑
            </div>
            <div class="flex flex-col text-left">
              <span id="quiz-mascot-name" class="text-[10px] md:text-[11px] font-black text-amber-700">Cô giáo & Đậu</span>
              <span id="quiz-mascot-speech" class="text-xs font-bold text-slate-700 max-w-[130px] sm:max-w-[200px] truncate">Đậu cố lên nhé!</span>
            </div>
          </div>

          <!-- Thông báo khích lệ -->
          <div id="quiz-feedback-box" class="flex-1 flex items-center justify-center px-1">
            <p id="quiz-feedback" class="text-xs sm:text-sm md:text-base font-bold text-slate-500 text-center truncate">
              Đậu chạm vào hình con tìm được nhé! 👆
            </p>
          </div>

          <!-- Huy hiệu Combo Streak (Hiển thị khi streak >= 3) -->
          <div id="quiz-combo-badge" class="hidden items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-xs sm:text-sm shadow-md animate-bounce shrink-0">
            <span>🔥</span>
            <span id="quiz-combo-text">Combo 3! (x2 ⭐)</span>
          </div>
        </div>

        <!-- MODAL TỔNG KẾT TRAO CÚP VÀNG SAU 5 CÂU -->
        <div id="quiz-stage-modal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 transition-opacity duration-300 hidden">
          <div class="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border-4 border-amber-300 p-6 flex flex-col items-center text-center">
            <div class="text-7xl sm:text-8xl mb-2 animate-bounce">🏆</div>
            <h2 class="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">HOÀN THÀNH CHẶNG ĐUA!</h2>
            <p class="text-sm sm:text-base font-bold text-amber-600 mt-1">Đậu xuất sắc vượt qua 5 câu hỏi!</p>

            <div class="my-4 px-6 py-3 rounded-2xl bg-amber-50 border-2 border-amber-200 flex items-center gap-3">
              <span class="text-3xl">⭐</span>
              <div class="text-left">
                <div class="text-xs font-bold text-slate-500 uppercase">Sao kiếm được trong chặng</div>
                <div class="text-2xl font-black text-amber-600">+<span id="stage-stars-earned">5</span> sao</div>
              </div>
            </div>

            <div class="w-full flex flex-col gap-2.5 mt-2">
              <button onclick="QuizScreen.startNewStage()" class="w-full py-3.5 sm:py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-500 hover:to-yellow-500 active:scale-95 text-slate-900 font-black text-lg sm:text-xl shadow-lg border-2 border-white flex items-center justify-center gap-2 cursor-pointer transition-all">
                <span>🔄</span>
                <span>Chơi lại chặng mới</span>
                <span>🚀</span>
              </button>

              <button onclick="AppState.showScreen('screen-home')" class="w-full py-2.5 sm:py-3 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer transition-all">
                <span>🏠</span>
                <span>Về chọn chủ đề</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Lấy URL audio từ backend TTS kèm bộ nhớ đệm cache và pre-buffer
  async fetchAudioUrl(text, lang) {
    if (!text) return null;
    const cacheKey = `${lang}_${text}`;
    if (this.ttsUrlCache && this.ttsUrlCache.has(cacheKey)) {
      return this.ttsUrlCache.get(cacheKey);
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang })
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.url) {
        if (!this.ttsUrlCache) this.ttsUrlCache = new Map();
        this.ttsUrlCache.set(cacheKey, data.url);
        // Tải trước buffer âm thanh vào RAM trình duyệt
        const a = new Audio();
        a.preload = "auto";
        a.src = data.url;
        try { a.load(); } catch (e) {}
        return data.url;
      }
      return null;
    } catch (err) {
      console.error("Lỗi tải trước âm thanh quiz:", err);
      return null;
    }
  },

  // Chuẩn bị trước bộ dữ liệu câu đố & nạp ngầm audio (Pipeline pre-caching)
  prepareQuestionData() {
    const target = this.getNextTargetWord();
    if (!target) return null;

    const prompt = this.getRandomQuestionPrompt();

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

    distractors.forEach(d => {
      this.distractorCounts[d.id] = (this.distractorCounts[d.id] || 0) + 1;
    });

    const availableIndices = [0, 1, 2, 3].filter(idx => idx !== this.lastCorrectIndex);
    const correctIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];

    this.shuffle(distractors);
    const options = new Array(4);
    options[correctIndex] = target;

    let distractorIdx = 0;
    for (let i = 0; i < 4; i++) {
      if (i !== correctIndex) {
        options[i] = distractors[distractorIdx++];
      }
    }

    let preloadPromise = null;
    if (AppState.voiceMode === "bilingual") {
      preloadPromise = Promise.all([
        this.fetchAudioUrl(prompt, "vi"),
        this.fetchAudioUrl(target.en, "en")
      ]);
    } else {
      preloadPromise = Promise.all([
        this.fetchAudioUrl(`Where is the ${target.en}, Đậu?`, "en")
      ]);
    }

    return {
      target,
      prompt,
      correctIndex,
      options,
      preloadPromise
    };
  },

  // Chuẩn bị trước câu hỏi đầu tiên ngay khi mở modal chủ đề từ trang chủ
  prepareFirstQuestion(topic) {
    if (topic && topic.id) {
      this.selectedTopicId = topic.id;
    }
    this.questionQueue = [];
    this.lastTargetWordId = null;
    this.nextQuestionData = this.prepareQuestionData();
  },

  // Tạo câu hỏi mới (sử dụng pipeline pre-caching đón đầu)
  nextQuestion() {
    this.isLocked = false;

    // Cập nhật giao diện tiến độ chặng và trạng thái mascot
    this.updateStageProgress();
    this.setMascot("normal");

    const feedbackEl = document.getElementById("quiz-feedback");
    if (feedbackEl) {
      feedbackEl.innerHTML = `
        <p class="text-xs sm:text-sm font-bold text-slate-500 italic truncate">
          Đậu chạm vào hình con tìm được nhé! 👆
        </p>
      `;
    }

    let qData = this.nextQuestionData;
    this.nextQuestionData = null;

    if (!qData) {
      qData = this.prepareQuestionData();
    }
    if (!qData) return;

    this.currentWord = qData.target;
    this.currentPrompt = qData.prompt;
    this.lastCorrectIndex = qData.correctIndex;
    this.options = qData.options;
    this.preloadPromise = qData.preloadPromise;

    // Cập nhật câu hỏi text
    const questionTextEl = document.getElementById("quiz-question-text");
    if (questionTextEl) {
      if (AppState.voiceMode === "bilingual") {
        questionTextEl.textContent = `${this.currentPrompt} "${this.currentWord.en}"?`;
      } else {
        questionTextEl.textContent = `Where is the "${this.currentWord.en}", Đậu?`;
      }
    }

    // Render 4 thẻ ô lớn với object-contain trên nền trắng sạch
    const gridEl = document.getElementById("quiz-grid");
    if (gridEl) {
      gridEl.innerHTML = this.options.map((opt, idx) => {
        const visualContent = opt.image_url ? `
          <div class="w-full h-44 sm:h-48 md:h-52 rounded-2xl overflow-hidden bg-white p-1 flex items-center justify-center relative mb-1.5 shadow-inner border border-slate-100">
            <img src="${opt.image_url}" alt="${opt.en}" class="w-full h-full object-contain rounded-2xl transition-transform duration-300 group-hover:scale-105" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div style="display:none;" class="w-full h-full items-center justify-center text-7xl md:text-8xl filter drop-shadow-sm">
              ${opt.visual}
            </div>
          </div>
        ` : `
          <div class="w-full h-44 sm:h-48 md:h-52 flex items-center justify-center text-7xl sm:text-8xl md:text-9xl filter drop-shadow-sm group-hover:scale-110 transition-transform mb-1.5">
            ${opt.visual}
          </div>
        `;

        return `
          <button type="button" id="quiz-card-${idx}" onclick="QuizScreen.handleSelect('${opt.id}', 'quiz-card-${idx}')"
               aria-label="Hình ${opt.en}, nghĩa là ${opt.vi}"
               class="group w-full bg-white rounded-[2rem] border-4 border-slate-100 hover:border-amber-300 focus-visible:ring-4 focus-visible:ring-amber-400 shadow-md active:scale-95 transition-all duration-150 cursor-pointer flex flex-col items-center justify-center p-2 sm:p-2.5 text-center overflow-hidden">
            ${visualContent}
            <span class="text-lg sm:text-xl md:text-2xl font-black text-slate-800 capitalize leading-tight">
              ${opt.en}
            </span>
          </button>
        `;
      }).join("");
    }

    // PHÁT NGAY CÂU HỎI (Không cần setTimeout thừa)
    this.playQuestionPrompt();

    // ĐÓN ĐẦU ỐNG DẪN: Trong lúc bé đang nhìn 4 thẻ và tìm hình, nạp trước câu tiếp theo (N+1)!
    setTimeout(() => {
      if (!this.nextQuestionData) {
        this.nextQuestionData = this.prepareQuestionData();
      }
    }, 600);
  },

  // Phát chuỗi âm thanh tiếng Việt -> tiếng Anh liền mạch không ngắt quãng
  playSeamlessQuestion(viUrl, enUrl) {
    return new Promise((resolve, reject) => {
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

      player.onerror = (err) => {
        cleanup();
        if (reject) reject(err);
      };

      player.src = viUrl;
      if (AppState.playbackRate) {
        player.playbackRate = AppState.playbackRate;
        player.defaultPlaybackRate = AppState.playbackRate;
      }
      player.play().catch((err) => {
        cleanup();
        if (reject) reject(err);
      });
    });
  },

  // Gắn cơ chế mở khóa âm thanh dự phòng thông minh cho iPad Safari
  attachAutoplayUnlockFallback() {
    const speakBtn = document.getElementById("btn-quiz-speak");
    if (speakBtn) {
      speakBtn.classList.add("animate-bounce", "ring-4", "ring-amber-300");
    }
    const container = document.getElementById("screen-quiz");
    if (container) {
      const onUserTouch = () => {
        container.removeEventListener("touchstart", onUserTouch);
        container.removeEventListener("click", onUserTouch);
        if (speakBtn) {
          speakBtn.classList.remove("animate-bounce", "ring-4", "ring-amber-300");
        }
        this.getAudioContext();
        this.playQuestionPrompt();
      };
      container.addEventListener("touchstart", onUserTouch, { once: true, passive: true });
      container.addEventListener("click", onUserTouch, { once: true });
    }
  },

  // Phát câu hỏi của cô giáo
  async playQuestionPrompt() {
    if (!this.currentWord) return;

    const speakIcon = document.getElementById("quiz-speak-icon");
    const speakBtn = document.getElementById("btn-quiz-speak");
    if (speakIcon) speakIcon.classList.add("audio-playing-pulse");
    if (speakBtn) {
      speakBtn.classList.remove("animate-bounce", "ring-4", "ring-amber-300");
      speakBtn.classList.add("pointer-events-none");
    }

    try {
      let urls = null;
      if (this.preloadPromise) {
        urls = await this.preloadPromise;
      }
      if (AppState.voiceMode === "bilingual") {
        const [viUrl, enUrl] = urls || [];
        if (viUrl && enUrl) {
          await this.playSeamlessQuestion(viUrl, enUrl);
        } else {
          await AppState.speakText(this.currentPrompt, "vi");
          await AppState.speakText(this.currentWord.en, "en");
        }
      } else {
        const [enUrl] = urls || [];
        if (enUrl) {
          await this.playPreloadedAudio(enUrl);
        } else {
          await AppState.speakText(`Where is the ${this.currentWord.en}, Đậu?`, "en");
        }
      }
    } catch (e) {
      console.warn("Autoplay / audio pending trên iPad Safari:", e);
      this.attachAutoplayUnlockFallback();
    } finally {
      if (speakIcon) speakIcon.classList.remove("audio-playing-pulse");
      if (speakBtn) speakBtn.classList.remove("pointer-events-none");
    }
  },

  // Xử lý khi bé chạm chọn ô (Âm thanh 0ms cho cả Đúng & Sai + Khóa chống bấm đè)
  async handleSelect(chosenId, cardElementId) {
    if (this.isLocked) return;

    const cardEl = document.getElementById(cardElementId);
    const feedbackEl = document.getElementById("quiz-feedback");

    if (chosenId === this.currentWord.id) {
      // ĐÚNG Ô! KHÓA TỨC THÌ ĐỂ CHỐNG BẤM ĐÈ
      this.isLocked = true;
      this.streak++;
      const starsEarned = this.streak >= 3 ? 2 : 1;
      AppState.addStars(starsEarned);
      this.stageStars += starsEarned;

      // 1. ÂM THANH "TING!" PHA LÊ TỨC THÌ 0MS BẰNG WEB AUDIO API NỘI BỘ
      this.playVictoryChime();

      // Hiệu ứng pháo giấy mini tung tỏa và ngôi sao bay lên header
      this.triggerConfetti(cardEl);
      this.triggerFlyingStar(cardEl);
      this.setMascot("happy");

      // Cập nhật huy hiệu Combo & phát hợp âm chiến thắng (khi streak >= 3)
      const comboBadge = document.getElementById("quiz-combo-badge");
      const comboText = document.getElementById("quiz-combo-text");
      if (this.streak >= 3) {
        this.playComboChime();
        if (comboBadge) {
          comboBadge.classList.remove("hidden");
          comboBadge.classList.add("flex");
        }
        if (comboText) {
          comboText.textContent = `Combo ${this.streak}! (x2 ⭐)`;
        }
      }

      if (cardEl) {
        cardEl.className = "bg-emerald-50 rounded-[2rem] border-4 border-emerald-400 shadow-xl flex flex-col items-center justify-center p-3 text-center scale-105 transition-all overflow-hidden";
      }

      const praiseMsg = AppState.voiceMode === "bilingual"
        ? this.getRandomPraise()
        : this.getRandomEnPraise();

      if (feedbackEl) {
        const bonusText = this.streak >= 3 ? " 🔥 COMBO X2!" : "";
        feedbackEl.innerHTML = `<span class="text-emerald-600 font-black text-sm sm:text-base animate-bounce">🎉 ${praiseMsg} +${starsEarned} ⭐${bonusText}</span>`;
      }

      // 2. PHÁT TIẾNG KHEN TỪ CACHE 0MS
      const startTime = Date.now();
      const praiseKey = `${AppState.voiceMode === "bilingual" ? "vi" : "en"}_${praiseMsg}`;
      const cachedUrl = (this.ttsUrlCache && this.ttsUrlCache.get(praiseKey)) ||
                        (this.preloadedPraises && this.preloadedPraises[praiseKey]);

      if (cachedUrl) {
        await this.playPreloadedAudio(cachedUrl);
      } else {
        await AppState.speakText(praiseMsg, AppState.voiceMode === "bilingual" ? "vi" : "en");
      }
      
      // 3. CHỈ CHUYỂN CÂU HỎI SAU KHI CÔ KHEN XONG (TỐI THIỂU 1.5S) ĐỂ KHÔNG BỊ CẮT LỜI CÔ
      const elapsed = Date.now() - startTime;
      const remainingWait = Math.max(0, 1500 - elapsed);

      setTimeout(() => {
        this.currentStageQuestion++;
        if (this.currentStageQuestion >= this.stageTotalQuestions) {
          this.showStageCompletionModal();
        } else {
          this.nextQuestion();
        }
      }, remainingWait);

    } else {
      // CHỌN NHẦM: KHÓA TẠM THỜI ĐỂ CHỐNG BẤM LIÊN TỤC GÂY CÂM TIẾNG
      this.isLocked = true;
      this.streak = 0;

      // 1. ÂM BÁO TRẦM ÊM TAI 0MS (WEB AUDIO API)
      this.playEncourageSound();

      const comboBadge = document.getElementById("quiz-combo-badge");
      if (comboBadge) {
        comboBadge.classList.add("hidden");
        comboBadge.classList.remove("flex");
      }
      this.setMascot("encourage");

      if (cardEl) {
        cardEl.classList.add("shake-box", "border-rose-300");
        setTimeout(() => {
          cardEl.classList.remove("shake-box", "border-rose-300");
        }, 500);
      }

      const wrongMsg = AppState.voiceMode === "bilingual"
        ? this.getRandomEncouragement()
        : this.getRandomEnEncouragement();

      if (feedbackEl) {
        feedbackEl.innerHTML = `<span class="text-amber-800 font-bold text-sm sm:text-base">✨ ${wrongMsg}</span>`;
      }

      // 2. PHÁT TIẾNG ĐỘNG VIÊN TỪ CACHE 0MS
      const wrongKey = `${AppState.voiceMode === "bilingual" ? "vi" : "en"}_${wrongMsg}`;
      const cachedWrongUrl = (this.ttsUrlCache && this.ttsUrlCache.get(wrongKey)) ||
                             (this.preloadedPraises && this.preloadedPraises[wrongKey]);

      if (cachedWrongUrl) {
        await this.playPreloadedAudio(cachedWrongUrl);
      } else {
        await AppState.speakText(wrongMsg, AppState.voiceMode === "bilingual" ? "vi" : "en");
      }

      // MỞ KHÓA LẠI SAU KHI CÔ ĐỘNG VIÊN XONG ĐỂ BÉ CHỌN TIẾP
      this.isLocked = false;
    }
  }
};

window.QuizScreen = QuizScreen;
