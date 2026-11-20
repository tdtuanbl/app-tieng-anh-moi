// Trò chơi Đua xe 3 làn đường học từ vựng cho bé Đậu
const RacerScreen = {
  currentWord: null,
  options: [], // 3 lựa chọn tương ứng 3 làn: [ { word, isTarget }, ... ]
  playerLane: 1, // 0: Làn trái, 1: Làn giữa, 2: Làn phải
  speedDuration: 7, // Mặc định 7 giây
  lives: 3,
  isDropping: false,
  animId: null,
  startTime: null,
  targetLaneIndex: 1,

  PRAISES_VI: [
    "Đậu xuất sắc quá!",
    "Đậu tuyệt vời, 10 điểm!",
    "Chính xác!"
  ],

  PRAISES_EN: [
    "Awesome job, Đậu!",
    "You are amazing, Đậu! Ten out of ten!",
    "Spot on, Đậu!"
  ],

  // Bắt đầu màn hình đua xe
  start() {
    if (!AppState.currentTopic || !AppState.currentTopic.words || AppState.currentTopic.words.length < 3) {
      if (AppState.topics && AppState.topics.length > 0) {
        AppState.currentTopic = AppState.topics[0];
      } else {
        return;
      }
    }
    this.lives = 3;
    this.playerLane = 1;
    this.renderContainer();
    this.startRound();
  },

  // Hiển thị khung giao diện đường đua 3 làn
  renderContainer() {
    const container = document.getElementById("screen-racer");
    if (!container) return;

    container.innerHTML = `
      <style>
        @keyframes starExplode {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.6); opacity: 1; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .star-explode {
          animation: starExplode 0.8s ease-out forwards;
        }
        @keyframes funBounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-16px) rotate(-8deg); }
          50% { transform: translateY(0) rotate(8deg); }
          75% { transform: translateY(-8px) rotate(-4deg); }
        }
        .car-bounce {
          animation: funBounce 0.5s ease-in-out;
        }
      </style>

      <div class="w-full h-full flex flex-col justify-between max-w-5xl mx-auto py-1 relative select-none">
        <!-- THANH TRÊN CÙNG: Điều hướng, Mạng sống, Nút Loa câu hỏi, Chọn tốc độ -->
        <div class="flex items-center justify-between w-full px-2 z-20">
          <!-- Nút về chủ đề & Mạng sống -->
          <div class="flex items-center gap-3">
            <button onclick="RacerScreen.exitGame()" class="px-4 py-2 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 font-bold shadow-sm border border-slate-200 active:scale-95 transition-all flex items-center gap-2">
              <span>⬅️</span>
              <span>Chủ đề</span>
            </button>
            <div id="racer-hearts" class="flex items-center text-2xl tracking-widest bg-white/90 px-3 py-1.5 rounded-2xl shadow-sm border border-rose-100">
              ❤️❤️❤️
            </div>
          </div>

          <!-- NÚT LOA & TỪ KHÓA CẦN TÌM -->
          <button onclick="RacerScreen.playQuestionPrompt()" class="px-6 py-2 rounded-full bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-xl shadow-md flex items-center gap-3 transition-all border-2 border-white">
            <span class="text-2xl animate-pulse">🔊</span>
            <span id="racer-keyword-display">Đậu ơi, tìm từ vựng...</span>
          </button>

          <!-- NÚT CHỌN TỐC ĐỘ: Chậm (8s) / Vừa (6s) -->
          <div class="flex items-center gap-1.5 bg-white/90 p-1 rounded-2xl shadow-sm border border-slate-200 text-xs font-black">
            <button id="btn-speed-slow" onclick="RacerScreen.setSpeed(8)" class="px-3 py-1.5 rounded-xl transition-all ${this.speedDuration === 8 ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
              🐢 Chậm 8s
            </button>
            <button id="btn-speed-medium" onclick="RacerScreen.setSpeed(6)" class="px-3 py-1.5 rounded-xl transition-all ${this.speedDuration === 6 ? 'bg-amber-400 text-slate-900 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}">
              ⚡ Vừa 6s
            </button>
          </div>
        </div>

        <!-- ĐƯỜNG ĐUA 3 LÀN XE (KHUNG CHÍNH) -->
        <div class="flex-1 w-full my-2 relative rounded-[2.5rem] bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-4 border-slate-600 shadow-2xl overflow-hidden flex">
          
          <!-- LÀN 0 (Trái) -->
          <div onclick="RacerScreen.switchLane(0)" class="flex-1 h-full border-r-2 border-dashed border-yellow-300/60 relative cursor-pointer active:bg-white/5 transition-colors flex justify-center">
            <div id="lane-item-0" class="absolute -top-36 w-24 h-24 md:w-28 md:h-28 bg-white rounded-2xl shadow-2xl border-4 border-amber-300 flex flex-col items-center justify-between p-1.5 text-center pointer-events-none overflow-hidden">
            </div>
          </div>

          <!-- LÀN 1 (Giữa) -->
          <div onclick="RacerScreen.switchLane(1)" class="flex-1 h-full border-r-2 border-dashed border-yellow-300/60 relative cursor-pointer active:bg-white/5 transition-colors flex justify-center">
            <div id="lane-item-1" class="absolute -top-36 w-24 h-24 md:w-28 md:h-28 bg-white rounded-2xl shadow-2xl border-4 border-amber-300 flex flex-col items-center justify-between p-1.5 text-center pointer-events-none overflow-hidden">
            </div>
          </div>

          <!-- LÀN 2 (Phải) -->
          <div onclick="RacerScreen.switchLane(2)" class="flex-1 h-full relative cursor-pointer active:bg-white/5 transition-colors flex justify-center">
            <div id="lane-item-2" class="absolute -top-36 w-24 h-24 md:w-28 md:h-28 bg-white rounded-2xl shadow-2xl border-4 border-amber-300 flex flex-col items-center justify-between p-1.5 text-center pointer-events-none overflow-hidden">
            </div>
          </div>

          <!-- XE CỦA BÉ ĐẬU Ở ĐÁY ĐƯỜNG ĐUA -->
          <div id="player-car" class="absolute bottom-6 w-1/3 flex justify-center transition-all duration-200 pointer-events-none z-10" style="left: 33.333%;">
            <div id="car-inner" class="text-7xl filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] transform -rotate-90">
              🏎️
            </div>
          </div>

          <!-- HIỆU ỨNG NGÔI SAO NỔ TUNG KHI ĐÂM ĐÚNG -->
          <div id="star-burst" class="hidden absolute bottom-6 z-30 pointer-events-none flex items-center justify-center text-8xl" style="left: 33.333%; width: 33.333%;">
            ⭐✨🌟
          </div>

          <!-- LỚP PHỦ THÔNG BÁO LƯỢT ĐUA / HƯỚNG DẪN -->
          <div id="racer-prompt-banner" class="absolute top-4 inset-x-0 mx-auto w-fit px-6 py-2 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/20 text-white font-extrabold text-base shadow-lg text-center pointer-events-none">
            Đậu chạm vào làn đường để chuyển xe nhé!
          </div>
        </div>

        <!-- BỘ ĐIỀU KHIỂN NÚT BẤM DƯỚI ĐÁY -->
        <div class="flex items-center justify-between px-4 pb-1">
          <button onclick="RacerScreen.moveLeft()" class="px-8 py-3 rounded-2xl bg-white/90 hover:bg-white active:scale-95 text-slate-800 font-black text-xl shadow-md border-2 border-slate-200 transition-all flex items-center gap-2">
            <span>⬅️</span>
            <span>Sang trái</span>
          </button>

          <span class="text-slate-400 font-bold text-sm">Chạm trực tiếp vào làn đường hoặc bấm nút ⬅️ ➡️</span>

          <button onclick="RacerScreen.moveRight()" class="px-8 py-3 rounded-2xl bg-white/90 hover:bg-white active:scale-95 text-slate-800 font-black text-xl shadow-md border-2 border-slate-200 transition-all flex items-center gap-2">
            <span>Sang phải</span>
            <span>➡️</span>
          </button>
        </div>
      </div>
    `;
    this.updateCarPosition();
    this.updateHeartsUI();
  },

  // Chọn tốc độ trôi
  setSpeed(seconds) {
    this.speedDuration = seconds;
    const btnSlow = document.getElementById("btn-speed-slow");
    const btnMed = document.getElementById("btn-speed-medium");
    if (btnSlow && btnMed) {
      if (seconds === 8) {
        btnSlow.className = "px-3 py-1.5 rounded-xl transition-all bg-amber-400 text-slate-900 shadow-sm";
        btnMed.className = "px-3 py-1.5 rounded-xl transition-all text-slate-600 hover:bg-slate-100";
      } else {
        btnMed.className = "px-3 py-1.5 rounded-xl transition-all bg-amber-400 text-slate-900 shadow-sm";
        btnSlow.className = "px-3 py-1.5 rounded-xl transition-all text-slate-600 hover:bg-slate-100";
      }
    }
  },

  // Cập nhật mạng sống ❤️
  updateHeartsUI() {
    const el = document.getElementById("racer-hearts");
    if (!el) return;
    let heartsStr = "";
    for (let i = 0; i < 3; i++) {
      heartsStr += (i < this.lives) ? "❤️" : "🖤";
    }
    el.textContent = heartsStr;
  },

  // Thoát game quay lại Home
  exitGame() {
    this.stopDropAnimation();
    AppState.showScreen("screen-home");
  },

  // Khởi động lượt chơi mới
  async startRound() {
    this.stopDropAnimation();
    const words = AppState.currentTopic.words;
    
    // Chọn 1 từ đích
    this.currentWord = words[Math.floor(Math.random() * words.length)];
    
    // Chọn 2 từ sai
    const others = words.filter(w => w.id !== this.currentWord.id);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    const distractors = others.slice(0, 2);

    // Xếp ngẫu nhiên vào 3 làn: 0, 1, 2
    this.targetLaneIndex = Math.floor(Math.random() * 3);
    this.options = [null, null, null];
    this.options[this.targetLaneIndex] = { word: this.currentWord, isTarget: true };

    let distractorIndex = 0;
    for (let lane = 0; lane < 3; lane++) {
      if (this.options[lane] === null) {
        this.options[lane] = { word: distractors[distractorIndex++], isTarget: false };
      }
    }

    // Hiển thị từ khóa lên thanh trên cùng
    const keywordEl = document.getElementById("racer-keyword-display");
    if (keywordEl) {
      if (AppState.voiceMode === "bilingual") {
        keywordEl.textContent = `Đậu ơi, "${this.currentWord.en}" ở đâu?`;
      } else {
        keywordEl.textContent = `Where is the "${this.currentWord.en}", Đậu?`;
      }
    }

    // Cập nhật nội dung 3 thẻ ở đỉnh đường đua
    for (let lane = 0; lane < 3; lane++) {
      const itemEl = document.getElementById(`lane-item-${lane}`);
      if (itemEl) {
        const item = this.options[lane];
        itemEl.style.top = "-140px";
        const visualHtml = item.word.image_url ? `
          <div class="w-full flex-1 rounded-xl overflow-hidden relative flex items-center justify-center bg-slate-100">
            <img src="${item.word.image_url}" alt="${item.word.en}" class="w-full h-full object-cover rounded-xl shadow-md" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div style="display:none;" class="w-full h-full items-center justify-center text-4xl filter drop-shadow-sm">
              ${item.word.visual}
            </div>
          </div>
        ` : `
          <div class="w-full flex-1 flex items-center justify-center text-4xl md:text-5xl filter drop-shadow-sm">
            ${item.word.visual}
          </div>
        `;

        itemEl.innerHTML = `
          ${visualHtml}
          <span class="text-[11px] md:text-xs font-black text-slate-800 capitalize leading-tight py-0.5 truncate max-w-full">${item.word.en}</span>
        `;
      }
    }

    // BƯỚC 1: PHÁT ÂM HỎI TRƯỚC KHI THẢ HÌNH
    await this.playQuestionPrompt();

    // BƯỚC 2: THẢ 3 HÌNH TRÔI CHẬM
    this.startDropAnimation();
  },

  // Phát âm câu hỏi trước khi xe chạy
  async playQuestionPrompt() {
    if (!this.currentWord) return;
    if (AppState.voiceMode === "bilingual") {
      await AppState.speakText(`Đậu ơi, ${this.currentWord.en} ở đâu?`, "vi");
    } else {
      await AppState.speakText(`Where is the ${this.currentWord.en}, Đậu?`, "en");
    }
  },

  // Bắt đầu hiệu ứng trôi chậm 3 thẻ hình
  startDropAnimation() {
    this.isDropping = true;
    this.startTime = performance.now();
    const durationMs = this.speedDuration * 1000;

    const banner = document.getElementById("racer-prompt-banner");
    if (banner) {
      banner.textContent = `Lái xe đón hình "${this.currentWord.en}" nào! 🏎️💨`;
    }

    const animate = (currentTime) => {
      if (!this.isDropping) return;

      const elapsed = currentTime - this.startTime;
      const progress = Math.min(1, elapsed / durationMs);

      // Tính vị trí Y từ đỉnh (0%) tới khu vực ngang xe (khoảng 80% chiều cao đường đua)
      const topPercentage = progress * 80;

      for (let lane = 0; lane < 3; lane++) {
        const el = document.getElementById(`lane-item-${lane}`);
        if (el) {
          el.style.top = `${topPercentage}%`;
        }
      }

      // XỬ LÝ VA CHẠM KHI 3 HÌNH ĐI NGANG QUA XE CỦA ĐẬU (progress >= 0.95 hoặc >= 76%)
      if (progress >= 0.95) {
        this.handleCollision();
        return;
      }

      this.animId = requestAnimationFrame(animate);
    };

    this.animId = requestAnimationFrame(animate);
  },

  stopDropAnimation() {
    this.isDropping = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  },

  // Xử lý va chạm
  async handleCollision() {
    this.stopDropAnimation();
    const hitItem = this.options[this.playerLane];

    if (hitItem && hitItem.isTarget) {
      // 1. ĐÂM TRÚNG HÌNH ĐÚNG!
      AppState.addStars(2); // Cộng +2 sao

      // Hiệu ứng ngôi sao nổ tung
      const burst = document.getElementById("star-burst");
      if (burst) {
        burst.style.left = `${this.playerLane * 33.333}%`;
        burst.classList.remove("hidden");
        burst.classList.add("star-explode");
        setTimeout(() => {
          burst.classList.remove("star-explode");
          burst.classList.add("hidden");
        }, 800);
      }

      // Chọn câu khen ngợi ngẫu nhiên
      const praises = (AppState.voiceMode === "bilingual") ? this.PRAISES_VI : this.PRAISES_EN;
      const praise = praises[Math.floor(Math.random() * praises.length)];

      const banner = document.getElementById("racer-prompt-banner");
      if (banner) {
        banner.innerHTML = `<span class="text-amber-300 font-black text-lg animate-bounce">🌟 ${praise} +2 ⭐</span>`;
      }

      await AppState.speakText(praise, (AppState.voiceMode === "bilingual") ? "vi" : "en");

      // Tự động chuyển sang lượt tiếp theo
      setTimeout(() => {
        this.startRound();
      }, 1000);

    } else {
      // 2. ĐÂM NHẦM HÌNH SAI!
      // Xe nảy nhẹ vui nhộn (không gây sợ hãi)
      const carInner = document.getElementById("car-inner");
      if (carInner) {
        carInner.classList.add("car-bounce");
        setTimeout(() => carInner.classList.remove("car-bounce"), 500);
      }

      // Trừ 1 mạng
      this.lives = Math.max(0, this.lives - 1);
      this.updateHeartsUI();

      const remindMsg = (AppState.voiceMode === "bilingual")
        ? `Suýt đúng rồi! Đậu lái xe sang hình ${this.currentWord.vi} nhé!`
        : `Almost! Steer to the ${this.currentWord.en}!`;

      const banner = document.getElementById("racer-prompt-banner");
      if (banner) {
        banner.innerHTML = `<span class="text-rose-300 font-bold text-base">⚠️ ${remindMsg}</span>`;
      }

      await AppState.speakText(remindMsg, (AppState.voiceMode === "bilingual") ? "vi" : "en");

      // Nếu hết 3 mạng, tự động hồi phục để bé chơi tiếp không bị nản
      if (this.lives === 0) {
        this.lives = 3;
        this.updateHeartsUI();
      }

      // Cho chạy lại lượt đó
      setTimeout(() => {
        this.replayCurrentRound();
      }, 1000);
    }
  },

  // Chạy lại lượt vừa đâm nhầm
  async replayCurrentRound() {
    this.stopDropAnimation();

    // Reset vị trí thẻ lên đỉnh
    for (let lane = 0; lane < 3; lane++) {
      const itemEl = document.getElementById(`lane-item-${lane}`);
      if (itemEl) itemEl.style.top = "-140px";
    }

    await this.playQuestionPrompt();
    this.startDropAnimation();
  },

  // Chuyển làn xe
  switchLane(laneIndex) {
    if (laneIndex < 0 || laneIndex > 2) return;
    this.playerLane = laneIndex;
    this.updateCarPosition();
  },

  moveLeft() {
    if (this.playerLane > 0) {
      this.playerLane--;
      this.updateCarPosition();
    }
  },

  moveRight() {
    if (this.playerLane < 2) {
      this.playerLane++;
      this.updateCarPosition();
    }
  },

  updateCarPosition() {
    const car = document.getElementById("player-car");
    if (car) {
      car.style.left = `${this.playerLane * 33.333}%`;
    }
  }
};

window.RacerScreen = RacerScreen;
