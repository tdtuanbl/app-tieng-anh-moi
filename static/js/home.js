// Quản lý màn hình Trang chủ (Home) - Linh vật đồng hành, Danh hiệu cấp độ & Bộ sưu tập Huy hiệu
const HomeScreen = {
  audioCtx: null,

  // 8 Huy hiệu & Sticker vui nhộn mở khóa theo mốc sao tích lũy
  BADGES: [
    { id: "badge_5", stars: 5, icon: "🌱", title: "Mầm Xanh Chăm Chỉ", desc: "Đậu đạt mốc 5 ngôi sao đầu tiên!" },
    { id: "badge_15", stars: 15, icon: "🚴", title: "Tay Lái Nhí", desc: "Đậu chở em bon bon trên đường làng!" },
    { id: "badge_30", stars: 30, icon: "🏎️", title: "Vua Đường Đua", desc: "Lướt gió thần tốc thu hoạch sao rực rỡ!" },
    { id: "badge_50", stars: 50, icon: "🔍", title: "Thám Tử Tinh Mắt", desc: "Tìm đúng vèo vèo không nhầm thẻ nào!" },
    { id: "badge_75", stars: 75, icon: "🥑", title: "Trái Bơ Thông Thái", desc: "Nhớ từ vựng siêu đẳng cùng cô giáo!" },
    { id: "badge_100", stars: 100, icon: "👑", title: "Siêu Sao Toàn Năng", desc: "Vượt mốc 100 sao vinh quang rực rỡ!" },
    { id: "badge_150", stars: 150, icon: "🚀", title: "Nhà Du Hành", desc: "Khám phá dải ngân hà tiếng Anh kỳ thú!" },
    { id: "badge_200", stars: 200, icon: "🏆", title: "Quán Quân Vô Địch", desc: "Bé Đậu xuất sắc chinh phục đỉnh vinh quang!" }
  ],

  // Khởi tạo AudioContext cho âm thanh huy hiệu
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  },

  // Tiếng chuông chúc mừng khi chạm vào huy hiệu đã mở
  playBadgeChime() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Hợp âm Ding-Dong 4 nốt tươi sáng (C6, E6, G6, C7)
      const notes = [1046.5, 1318.5, 1567.98, 2093.0];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.16, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.38);
      });
    } catch (e) {
      console.warn("Badge chime error:", e);
    }
  },

  // Tính toán danh hiệu cấp độ dựa trên tổng số sao
  getLevelInfo(stars = 0) {
    if (stars < 20) {
      return {
        level: 1,
        title: "Mầm Non Khám Phá 🌱",
        current: stars,
        next: 20,
        percent: Math.min(100, Math.round((stars / 20) * 100)),
        nextTitle: "Tay Đua Nhí 🏎️"
      };
    } else if (stars < 50) {
      return {
        level: 2,
        title: "Tay Đua Nhí 🏎️",
        current: stars,
        next: 50,
        percent: Math.min(100, Math.round(((stars - 20) / 30) * 100)),
        nextTitle: "Thám Tử Siêu Phàm 🔍"
      };
    } else if (stars < 100) {
      return {
        level: 3,
        title: "Thám Tử Siêu Phàm 🔍",
        current: stars,
        next: 100,
        percent: Math.min(100, Math.round(((stars - 50) / 50) * 100)),
        nextTitle: "Siêu Sao Tiếng Anh 👑"
      };
    } else {
      return {
        level: 4,
        title: "Siêu Sao Tiếng Anh 👑",
        current: stars,
        next: stars,
        percent: 100,
        nextTitle: "Cấp Tối Đa"
      };
    }
  },

  // Đếm số huy hiệu đã mở khóa
  getUnlockedBadgesCount() {
    const stars = AppState.stars || 0;
    return this.BADGES.filter(b => stars >= b.stars).length;
  },

  // Cập nhật nhãn số huy hiệu trên Top Bar Header
  updateBadgeHeader() {
    const el = document.getElementById("header-badge-count");
    if (el) {
      const unlocked = this.getUnlockedBadgesCount();
      el.textContent = `Huy hiệu (${unlocked}/8)`;
    }
  },

  // Lấy danh sách từ vựng đã học của một chủ đề từ localStorage
  getLearnedWords(topicId) {
    try {
      const data = localStorage.getItem(`dau_learned_${topicId}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Hiển thị giao diện Trang chủ
  render() {
    const container = document.getElementById("screen-home");
    if (!container) return;

    // Cập nhật nhãn huy hiệu trên Header
    this.updateBadgeHeader();

    // Trạng thái Lỗi kết nối / Không có dữ liệu
    if (AppState.topicFetchError) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full p-6 text-center max-w-md mx-auto my-auto">
          <div class="text-7xl mb-4 animate-bounce" aria-hidden="true">🥑📡</div>
          <h2 class="text-2xl font-black text-slate-800 mb-2">Chưa tải được bài học rồi!</h2>
          <p class="text-base font-bold text-slate-600 mb-6">Bé Đậu nhờ bố kiểm tra lại kết nối mạng để tiếp tục học cùng cô nhé!</p>
          <button onclick="AppState.retryFetchTopics()" aria-label="Thử tải lại bài học" class="px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-lg shadow-lg shadow-amber-300/50 border-2 border-white flex items-center gap-2.5 transition-all">
            <span>🔄</span>
            <span>Thử tải lại bài học</span>
          </button>
        </div>
      `;
      return;
    }

    // Trạng thái đang tải dữ liệu
    if (!AppState.topics || AppState.topics.length === 0 || AppState.topicFetchLoading) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-slate-500 p-6 text-center my-auto">
          <div class="text-6xl animate-bounce mb-3" aria-hidden="true">🌟</div>
          <p class="text-xl font-black text-slate-700">Cô đang chuẩn bị bài học cho bé Đậu...</p>
          <p class="text-sm font-semibold text-slate-400 mt-1">Chờ cô một chút xíu nhé! 🥑</p>
        </div>
      `;
      return;
    }

    const stars = AppState.stars || 0;
    const levelInfo = this.getLevelInfo(stars);
    const unlockedCount = this.getUnlockedBadgesCount();

    // Render danh sách 8 chủ đề từ vựng
    const cardsHtml = AppState.topics.map(topic => {
      const learned = this.getLearnedWords(topic.id);
      const total = topic.words ? topic.words.length : 30;
      const count = learned.length;
      const percent = Math.min(100, Math.round((count / total) * 100));

      return `
        <div onclick="HomeScreen.openTopicModal('${topic.id}')"
             onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();HomeScreen.openTopicModal('${topic.id}');}"
             role="button"
             tabindex="0"
             aria-label="Chủ đề ${topic.title}. Đã học ${count} trên ${total} từ."
             class="group relative bg-white rounded-[1.75rem] p-3 md:p-3.5 shadow-sm hover:shadow-xl border-2 border-amber-100/80 hover:border-amber-300 focus-visible:ring-4 focus-visible:ring-amber-400 transition-all duration-200 cursor-pointer flex flex-col items-center justify-between active:scale-95 text-center w-[calc(50%-0.5rem)] sm:w-[calc(50%-0.6rem)] md:w-[calc(25%-1rem)] max-w-[245px] shrink-0">
          <!-- Icon lớn sắc nét -->
          <div class="w-16 h-16 md:w-18 md:h-18 rounded-2xl ${topic.color || 'bg-amber-100'} flex items-center justify-center text-3xl md:text-4xl shadow-sm mb-1.5 group-hover:scale-110 transition-transform" aria-hidden="true">
            ${topic.icon || '📚'}
          </div>
          
          <!-- Tên chủ đề -->
          <h3 class="text-base md:text-lg font-black text-slate-800 mb-1 leading-tight line-clamp-1">${topic.title}</h3>
          
          <!-- Thanh tiến độ đã học -->
          <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200/80">
            <div class="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-300" style="width: ${percent}%"></div>
          </div>
          <span class="text-[11px] font-bold text-slate-500 mt-0.5">Đã học: ${count}/${total} từ</span>
        </div>
      `;
    }).join("");

    container.innerHTML = `
      <div class="w-full h-full flex flex-col justify-between max-w-6xl mx-auto py-1 sm:py-2">
        
        <!-- 1. KHUNG CHÀO MỪNG ĐỒNG HÀNH & DANH HIỆU CẤP ĐỘ CỦA BÉ ĐẬU -->
        <div class="w-full bg-gradient-to-r from-amber-100/95 via-yellow-50 to-amber-100/95 rounded-[2rem] p-3 sm:p-4 mb-2 shadow-md border-2 border-amber-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          <!-- Cụm trái: Avatar Đậu chở em + Lời chào cô giáo + Danh hiệu -->
          <div class="flex items-center gap-3 w-full sm:w-auto">
            <!-- Ảnh thu nhỏ Bé Đậu đạp xe chở em -->
            <div class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white shadow-md border-2 border-amber-300 p-1 flex items-center justify-center shrink-0">
              <img src="/static/images/dau-cho-em.png" alt="Bé Đậu đạp xe chở em" class="w-full h-full object-contain filter drop-shadow-sm" />
              <span class="absolute -bottom-1 -right-1 text-sm sm:text-base" title="Cô giáo đồng hành">👩‍🏫</span>
            </div>

            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h2 class="text-base sm:text-lg font-black text-slate-800 tracking-tight">Chào bé Đậu! 🥑</h2>
                <span class="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-200 to-yellow-200 text-amber-900 font-black text-xs border border-amber-300 shadow-sm flex items-center gap-1">
                  <span>🎖️</span>
                  <span>${levelInfo.title}</span>
                </span>
              </div>
              <p class="text-xs sm:text-sm font-bold text-slate-600 line-clamp-1 mt-0.5">
                Hôm nay mình cùng khám phá tiếng Anh nhé! 🚀
              </p>
            </div>
          </div>

          <!-- Cụm phải: Thanh tiến trình cấp độ & Nút Kho Huy hiệu -->
          <div class="flex items-center gap-2.5 sm:gap-3.5 w-full sm:w-auto justify-between sm:justify-end">
            <!-- Thanh tiến trình lên cấp -->
            <div class="flex flex-col items-end flex-1 sm:flex-initial min-w-[130px] sm:min-w-[170px]">
              <div class="flex items-center justify-between w-full text-[11px] font-black text-slate-600 mb-1">
                <span>Tiến trình cấp độ</span>
                <span class="text-amber-700 font-extrabold">${levelInfo.level === 4 ? 'ĐÃ ĐẠT MAX' : `${stars}/${levelInfo.next} ⭐`}</span>
              </div>
              <div class="w-full bg-white rounded-full h-2.5 overflow-hidden p-0.5 border border-amber-200 shadow-inner">
                <div class="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500 shadow-sm" style="width: ${levelInfo.percent}%"></div>
              </div>
            </div>

            <!-- Nút mở Kho Huy Hiệu & Sticker -->
            <button onclick="HomeScreen.openBadgeModal()" aria-label="Mở bộ sưu tập huy hiệu của bé Đậu" class="px-3 sm:px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-500 hover:to-yellow-500 text-slate-900 font-black text-xs sm:text-sm shadow-md border-2 border-white flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shrink-0">
              <span class="text-base sm:text-lg" aria-hidden="true">🏆</span>
              <span>Bộ sưu tập (${unlockedCount}/8)</span>
            </button>
          </div>
        </div>

        <!-- TIÊU ĐỀ HƯỚNG DẪN CHỌN CHỦ ĐỀ -->
        <div class="text-center mb-1 sm:mb-2 shrink-0">
          <h3 class="text-lg sm:text-2xl font-black text-slate-800 tracking-tight">Hôm nay bé Đậu cùng cô khám phá chủ đề nào nhé? 🌟</h3>
        </div>

        <!-- 2. LƯỚI 8 THẺ CHỦ ĐỀ CÂN ĐỐI TRÊN ĐIỆN THOẠI VÀ IPAD -->
        <div class="flex flex-wrap justify-center gap-3 sm:gap-3.5 md:gap-4 flex-1 items-center content-center py-1 sm:py-2 w-full">
          ${cardsHtml}
        </div>

        <!-- LỜI NHẮC CHÂN TRANG -->
        <div class="text-center text-slate-500 text-xs sm:text-sm font-bold mt-1 sm:mt-2 shrink-0">
          Chạm vào chủ đề để bắt đầu vui học cùng cô nhé! ❤️
        </div>
      </div>

      <!-- 3. MODAL KHO HUY HIỆU & STICKER CỦA ĐẬU -->
      <div id="home-badge-modal" class="hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="modal-badge-title">
        <div class="bg-white rounded-[2.5rem] p-5 sm:p-7 max-w-2xl w-full shadow-2xl border-4 border-amber-300 flex flex-col items-center max-h-[92vh] overflow-y-auto">
          <!-- Header Modal Huy hiệu -->
          <div class="text-5xl sm:text-6xl mb-1 filter drop-shadow animate-bounce">🏆</div>
          <h2 id="modal-badge-title" class="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight text-center">KHO HUY HIỆU & STICKER</h2>
          <p class="text-xs sm:text-sm font-bold text-amber-600 text-center mt-0.5">
            Đậu đã thu thập được <span class="font-black text-amber-700">${unlockedCount} / 8</span> huy hiệu rực rỡ! ⭐
          </p>

          <!-- Thanh tiến độ hoàn thành bộ sưu tập -->
          <div class="w-48 bg-slate-100 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-200 mt-2 mb-4">
            <div class="bg-gradient-to-r from-amber-400 to-yellow-400 h-full rounded-full transition-all duration-500" style="width: ${(unlockedCount / 8) * 100}%"></div>
          </div>

          <!-- Lưới 8 Huy hiệu & Sticker -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5 w-full mb-5">
            ${this.BADGES.map(badge => {
              const isUnlocked = stars >= badge.stars;
              if (isUnlocked) {
                return `
                  <div onclick="HomeScreen.clickBadge('${badge.id}', true)"
                       role="button"
                       tabindex="0"
                       aria-label="Huy hiệu ${badge.title}. Đã mở khóa với ${badge.stars} sao."
                       class="bg-gradient-to-b from-amber-50 to-yellow-50 border-3 border-amber-400 rounded-2xl p-3 flex flex-col items-center text-center shadow-md hover:scale-105 active:scale-95 cursor-pointer transition-all group">
                    <span class="text-3xl sm:text-4xl filter drop-shadow group-hover:scale-110 transition-transform mb-1">${badge.icon}</span>
                    <h4 class="font-black text-xs sm:text-sm text-slate-800 leading-tight line-clamp-1">${badge.title}</h4>
                    <span class="text-[10px] sm:text-xs font-bold text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-full mt-1">Đạt ${badge.stars} ⭐</span>
                    <p class="text-[10px] text-slate-500 line-clamp-2 mt-1">${badge.desc}</p>
                    <span class="text-[11px] text-emerald-600 font-black mt-1 flex items-center gap-0.5">✨ Đã mở</span>
                  </div>
                `;
              } else {
                return `
                  <div onclick="HomeScreen.clickBadge('${badge.id}', false)"
                       role="button"
                       tabindex="0"
                       aria-label="Huy hiệu ${badge.title}. Chưa mở khóa, cần ${badge.stars} sao."
                       class="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-3 flex flex-col items-center text-center opacity-65 hover:opacity-85 active:scale-95 cursor-pointer transition-all">
                    <div class="relative mb-1">
                      <span class="text-3xl sm:text-4xl filter grayscale">${badge.icon}</span>
                      <span class="absolute -top-1 -right-2 text-xs">🔒</span>
                    </div>
                    <h4 class="font-bold text-xs sm:text-sm text-slate-500 leading-tight line-clamp-1">${badge.title}</h4>
                    <span class="text-[10px] sm:text-xs font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full mt-1">Cần ${badge.stars} ⭐</span>
                    <p class="text-[10px] text-slate-400 line-clamp-1 mt-1">Thiếu ${badge.stars - stars} sao</p>
                    <span class="text-[10px] text-amber-700 font-bold mt-1">🔒 Chưa mở</span>
                  </div>
                `;
              }
            }).join("")}
          </div>

          <!-- Nút đóng Modal -->
          <button onclick="HomeScreen.closeBadgeModal()" aria-label="Đóng kho huy hiệu" class="w-full sm:w-auto px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-500 hover:to-yellow-500 active:scale-95 text-slate-900 font-black text-base shadow-md border-2 border-white transition-all cursor-pointer">
            Quay lại học tiếp 🚀
          </button>
        </div>
      </div>

      <!-- 4. BẢNG CHỌN HOẠT ĐỘNG CÙNG CÔ GIÁO -->
      <div id="home-topic-modal" class="hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="modal-topic-header">
        <div class="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl border-4 border-amber-200 flex flex-col items-center">
          <!-- Header Modal -->
          <div id="modal-topic-header" class="flex items-center gap-3 mb-3"></div>

          <p class="text-base sm:text-lg font-bold text-slate-600 mb-5 text-center">Bé Đậu chọn một hoạt động vui cùng cô nhé!</p>

          <!-- 3 Nút bấm lớn dễ chạm cho trẻ 5 tuổi -->
          <div class="w-full flex flex-col gap-3.5">
            <button onclick="HomeScreen.startActivity('learn')" aria-label="Hoạt động Học từ vựng và Tập nói cùng cô" class="w-full py-4 px-6 rounded-3xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-lg sm:text-xl shadow-lg shadow-amber-200/50 flex items-center justify-center gap-3.5 transition-all cursor-pointer">
              <span class="text-2xl sm:text-3xl" aria-hidden="true">📖</span>
              <span>Học từ vựng & Tập nói</span>
            </button>

            <button onclick="HomeScreen.startActivity('quiz')" aria-label="Hoạt động Trò chơi Tìm hình cùng cô" class="w-full py-4 px-6 rounded-3xl bg-emerald-400 hover:bg-emerald-500 active:scale-95 text-white font-black text-lg sm:text-xl shadow-lg shadow-emerald-200/50 flex items-center justify-center gap-3.5 transition-all cursor-pointer">
              <span class="text-2xl sm:text-3xl" aria-hidden="true">🎯</span>
              <span>Trò chơi Tìm hình</span>
            </button>

            <button onclick="HomeScreen.startActivity('racer')" aria-label="Hoạt động Đua xe 3 làn đường cùng cô" class="w-full py-4 px-6 rounded-3xl bg-sky-400 hover:bg-sky-500 active:scale-95 text-white font-black text-lg sm:text-xl shadow-lg shadow-sky-200/50 flex items-center justify-center gap-3.5 transition-all cursor-pointer">
              <span class="text-2xl sm:text-3xl" aria-hidden="true">🏎️</span>
              <span>Đua xe 3 làn đường</span>
            </button>
          </div>

          <!-- Nút Quay lại -->
          <button onclick="HomeScreen.closeTopicModal()" aria-label="Đóng bảng chọn, quay lại chọn chủ đề khác" class="mt-5 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm sm:text-base active:scale-95 transition-all cursor-pointer">
            ⬅️ Chọn chủ đề khác
          </button>
        </div>
      </div>
    `;
  },

  // Mở modal kho huy hiệu
  openBadgeModal() {
    const modal = document.getElementById("home-badge-modal");
    if (modal) {
      modal.classList.remove("hidden");
      this.playBadgeChime();
    }
  },

  // Đóng modal kho huy hiệu
  closeBadgeModal() {
    const modal = document.getElementById("home-badge-modal");
    if (modal) {
      modal.classList.add("hidden");
    }
  },

  // Xử lý khi bé chạm vào từng huy hiệu trong modal
  clickBadge(badgeId, isUnlocked) {
    const badge = this.BADGES.find(b => b.id === badgeId);
    if (!badge) return;

    if (isUnlocked) {
      this.playBadgeChime();
      if (AppState.voiceMode === "bilingual") {
        AppState.speakText(`Hoan hô! Đậu đã mở khóa huy hiệu ${badge.title}!`, "vi");
      } else {
        AppState.speakText(`Awesome! You unlocked the ${badge.title} badge!`, "en");
      }
    } else {
      const remaining = badge.stars - (AppState.stars || 0);
      if (AppState.voiceMode === "bilingual") {
        AppState.speakText(`Đậu cố gắng tích lũy thêm ${remaining} ngôi sao nữa để mở khóa huy hiệu ${badge.title} nhé!`, "vi");
      } else {
        AppState.speakText(`Keep going Đậu! Just ${remaining} more stars to unlock this badge!`, "en");
      }
    }
  },

  // Mở bảng chọn 3 hoạt động
  openTopicModal(topicId) {
    const topic = AppState.topics.find(t => t.id === topicId);
    if (!topic) return;
    AppState.currentTopic = topic;

    const header = document.getElementById("modal-topic-header");
    if (header) {
      header.innerHTML = `
        <span class="text-4xl">${topic.icon}</span>
        <span class="text-2xl font-black text-slate-800">${topic.title}</span>
      `;
    }

    const modal = document.getElementById("home-topic-modal");
    if (modal) modal.classList.remove("hidden");

    // Đón đầu ống dẫn: Chuẩn bị trước câu hỏi 1 của Tìm hình ngay khi mở modal
    if (window.QuizScreen && typeof window.QuizScreen.prepareFirstQuestion === "function") {
      window.QuizScreen.prepareFirstQuestion(topic);
    }

    AppState.speakText(topic.title, "vi");
  },

  // Đóng modal
  closeTopicModal() {
    const modal = document.getElementById("home-topic-modal");
    if (modal) modal.classList.add("hidden");
  },

  // Khởi động hoạt động tương ứng (Mở khóa AudioContext và quyền phát âm thanh ngay trên user gesture)
  startActivity(type) {
    this.closeTopicModal();
    if (window.AppState) {
      AppState.stopAudio();
      if (AppState.audioPlayer) {
        AppState.audioPlayer.play().catch(() => {});
      }
    }
    if (type === "learn") {
      AppState.showScreen("screen-learn");
      if (window.LearnScreen && typeof window.LearnScreen.start === "function") {
        window.LearnScreen.start();
      }
    } else if (type === "quiz") {
      if (window.QuizScreen && typeof window.QuizScreen.getAudioContext === "function") {
        window.QuizScreen.getAudioContext();
      }
      AppState.showScreen("screen-quiz");
      if (window.QuizScreen && typeof window.QuizScreen.start === "function") {
        window.QuizScreen.start();
      }
    } else if (type === "racer") {
      AppState.showScreen("screen-racer");
      if (window.RacerScreen && typeof window.RacerScreen.start === "function") {
        window.RacerScreen.start();
      }
    }
  }
};

window.HomeScreen = HomeScreen;

// Khởi chạy khi DOM và AppState tải xong
document.addEventListener("DOMContentLoaded", async () => {
  if (window.AppState) {
    if (!AppState.topics || AppState.topics.length === 0) {
      await AppState.fetchTopics();
    }
    HomeScreen.render();

    // Hook tự động làm mới tiến độ khi quay lại Trang chủ
    const originalShowScreen = AppState.showScreen;
    AppState.showScreen = function(screenId) {
      originalShowScreen.call(AppState, screenId);
      if (screenId === "screen-home") {
        HomeScreen.render();
      }
    };

    // Hook tự động cập nhật số huy hiệu khi nhận thêm sao
    const originalAddStars = AppState.addStars;
    AppState.addStars = function(amount) {
      originalAddStars.call(AppState, amount);
      HomeScreen.updateBadgeHeader();
    };
  }
});
