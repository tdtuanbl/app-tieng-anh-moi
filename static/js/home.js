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

    if (!AppState.topics || AppState.topics.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-slate-400">
          <div class="text-6xl animate-bounce mb-3">🌟</div>
          <p class="text-xl font-bold">Đang tải các chủ đề cho bé Đậu...</p>
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
             class="group relative bg-white rounded-[1.75rem] p-3 md:p-3.5 shadow-sm hover:shadow-xl border-2 border-amber-100/80 hover:border-amber-300 transition-all duration-200 cursor-pointer flex flex-col items-center justify-between active:scale-95 text-center w-[calc(50%-0.6rem)] md:w-[calc(25%-1rem)] max-w-[245px] shrink-0">
          <!-- Icon lớn sắc nét -->
          <div class="w-16 h-16 md:w-18 md:h-18 rounded-2xl ${topic.color || 'bg-amber-100'} flex items-center justify-center text-3xl md:text-4xl shadow-sm mb-1.5 group-hover:scale-110 transition-transform">
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
        <div class="text-center mb-1">
          <h2 class="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Hôm nay bé Đậu muốn khám phá gì nào? 🚀</h2>
        </div>

        <!-- Lưới 8 thẻ chủ đề cân đối (2 hàng x 4 thẻ căn giữa) trên iPad ngang -->
        <div class="flex flex-wrap justify-center gap-3.5 md:gap-4 flex-1 items-center content-center py-1 w-full">
          ${cardsHtml}
        </div>

        <div class="text-center text-slate-400 text-sm font-semibold">
          Chạm vào chủ đề để bắt đầu vui học cùng bố nhé! ❤️
        </div>
      </div>

      <!-- Bảng chọn 3 hoạt động lớn -->
      <div id="home-topic-modal" class="hidden fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
        <div class="bg-white rounded-[2.5rem] p-8 max-w-xl w-full shadow-2xl border-4 border-amber-200 flex flex-col items-center">
          <!-- Header Modal -->
          <div id="modal-topic-header" class="flex items-center gap-3 mb-4"></div>

          <p class="text-lg font-bold text-slate-600 mb-6 text-center">Bé Đậu chọn một trò chơi thật vui nhé!</p>

          <!-- 3 Nút bấm cực lớn dễ chạm cho trẻ 5 tuổi -->
          <div class="w-full flex flex-col gap-4">
            <button onclick="HomeScreen.startActivity('learn')" class="w-full py-4 px-6 rounded-3xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-900 font-black text-xl shadow-lg shadow-amber-200/50 flex items-center justify-center gap-4 transition-all">
              <span class="text-3xl">📖</span>
              <span>1. Học từ vựng & Tập nói</span>
            </button>

            <button onclick="HomeScreen.startActivity('quiz')" class="w-full py-4 px-6 rounded-3xl bg-emerald-400 hover:bg-emerald-500 active:scale-95 text-white font-black text-xl shadow-lg shadow-emerald-200/50 flex items-center justify-center gap-4 transition-all">
              <span class="text-3xl">🎯</span>
              <span>2. Trò chơi Tìm hình</span>
            </button>

            <button onclick="HomeScreen.startActivity('racer')" class="w-full py-4 px-6 rounded-3xl bg-sky-400 hover:bg-sky-500 active:scale-95 text-white font-black text-xl shadow-lg shadow-sky-200/50 flex items-center justify-center gap-4 transition-all">
              <span class="text-3xl">🏎️</span>
              <span>3. Đua xe 3 làn đường</span>
            </button>
          </div>

          <!-- Nút Quay lại -->
          <button onclick="HomeScreen.closeTopicModal()" class="mt-6 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-base active:scale-95 transition-all">
            ⬅️ Quay lại chọn chủ đề khác
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
