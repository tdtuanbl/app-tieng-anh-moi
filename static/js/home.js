// Quản lý màn hình Trang chủ (Home)
const HomeScreen = {
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
      <div class="w-full h-full flex flex-col justify-between max-w-6xl mx-auto py-2">
        <div class="text-center mb-2">
          <h2 class="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Hôm nay bé Đậu cùng cô khám phá chủ đề nào nhé? 🚀</h2>
        </div>

        <!-- Lưới thẻ chủ đề cân đối trên cả điện thoại và iPad -->
        <div class="flex flex-wrap justify-center gap-3 sm:gap-3.5 md:gap-4 flex-1 items-center content-center py-2 w-full">
          ${cardsHtml}
        </div>

        <div class="text-center text-slate-500 text-xs sm:text-sm font-bold mt-2">
          Chạm vào chủ đề để bắt đầu vui học cùng cô nhé! ❤️
        </div>
      </div>

      <!-- Bảng chọn hoạt động cùng cô giáo -->
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

    AppState.speakText(topic.title, "vi");
  },

  // Đóng modal
  closeTopicModal() {
    const modal = document.getElementById("home-topic-modal");
    if (modal) modal.classList.add("hidden");
  },

  // Khởi động hoạt động tương ứng
  startActivity(type) {
    this.closeTopicModal();
    if (type === "learn") {
      AppState.showScreen("screen-learn");
      if (window.LearnScreen && typeof window.LearnScreen.start === "function") {
        window.LearnScreen.start();
      }
    } else if (type === "quiz") {
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
  }
});
