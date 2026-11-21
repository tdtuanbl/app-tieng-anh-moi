# 🥑 App Học Tiếng Anh Cho Bé Đậu

Ứng dụng web tương tác học từ vựng tiếng Anh (Flashcard, Trắc nghiệm tìm hình, Đua xe 3 làn) tích hợp giọng đọc AI, tối ưu trải nghiệm màn hình ngang iPadOS.

---

## 📌 QUY TẮC BẮT BUỘC: 100% ẢNH CHỤP THỰC TẾ (REAL PHOTOGRAPHY)

> [!IMPORTANT]
> **Quy tắc bất di bất dịch của dự án:**
> Mọi từ vựng trong ứng dụng Tiếng Anh Của Đậu (cả hiện tại lẫn các chủ đề mở rộng về sau) **BẮT BUỘC phải sử dụng ẢNH CHỤP THỰC TẾ (Real Photography)** cận cảnh, rõ nét, tách bạch 1 vật thể duy nhất. **Nghiêm cấm** sử dụng ảnh hoạt hình, icon, emoji 3D, vector, clipart hay tranh vẽ.
> 
> *Ngoại lệ duy nhất*: Riêng chủ đề Hình học sử dụng hình vẽ hình học chuẩn giáo dục tiểu học (nền trắng sạch, nét viền rõ ràng, tô màu tươi sáng, không chứa chữ).

---

## 🚀 Hướng Dẫn Vận Hành (3 Bước)

### 1. Khởi tạo môi trường ảo
```powershell
# Tạo môi trường ảo (nếu chưa có)
python -m venv .venv

# Kích hoạt môi trường ảo
.\.venv\Scripts\activate

# Cài đặt thư viện
pip install -r requirements.txt
```

### 2. Khởi động máy chủ backend
```powershell
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
- Truy cập nội mạng (PC / cùng mạng Wi-Fi): `http://localhost:8000` hoặc `http://<IP_MAY_TINH>:8000`

### 3. Mở đường hầm HTTPS an toàn (Cho iPad dùng Web Speech API)
Do tính năng Micro (Web Speech API) trên Safari yêu cầu kết nối an toàn (HTTPS hoặc localhost), sử dụng Cloudflare Tunnel:
```powershell
cloudflared tunnel --url http://localhost:8000
```
Sao chép liên kết `https://<ten-mien>.trycloudflare.com` tạo ra để mở trên iPad.

---

## 📱 Cài Đặt Ra Màn Hình Chính iPad Cho Bé Đậu

1. Mở trình duyệt **Safari** trên iPad và truy cập đường dẫn HTTPS của app.
2. Nhấn nút **Chia sẻ** (biểu tượng ô vuông mũi tên chỉ lên ở thanh công cụ).
3. Chọn **Thêm vào MH chính (Add to Home Screen)**.
4. Nhấn **Thêm (Add)**. 
5. Ứng dụng sẽ xuất hiện dưới dạng icon riêng biệt `Học Cùng Đậu`, chạy toàn màn hình ngang (Standalone PWA) không có thanh địa chỉ Safari, khóa cuộn và chống zoom ngoài ý muốn khi bé thao tác.
