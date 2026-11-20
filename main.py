import hashlib
import json
from pathlib import Path
from typing import Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import edge_tts

# Tự động tạo thư mục static & cache âm thanh
static_dir = Path("static")
audio_cache_dir = static_dir / "audio_cache"
audio_cache_dir.mkdir(parents=True, exist_ok=True)
vocab_path = Path("data/vocab.json")

app = FastAPI(title="App Học Tiếng Anh Cho Bé Đậu")

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phục vụ file tĩnh
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return FileResponse(
        static_dir / "index.html",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

class TTSRequest(BaseModel):
    text: str = Field(..., max_length=200, description="Nội dung cần đọc tối đa 200 ký tự")
    lang: Literal["vi", "en"] = "en"

VOICE_MAP = {
    "vi": "vi-VN-HoaiMyNeural",
    "en": "en-US-AnaNeural",
}

@app.get("/api/ping")
def ping():
    return {"status": "ok", "message": "Xin chào Đậu!"}

@app.get("/api/topics")
def get_topics():
    try:
        if not vocab_path.exists():
            raise HTTPException(status_code=404, detail="Không tìm thấy file dữ liệu vocab.json")
        with open(vocab_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Lỗi khi đọc file dữ liệu từ vựng")

@app.post("/api/tts")
async def generate_tts(req: TTSRequest):
    clean_text = req.text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text không được để trống")

    voice = VOICE_MAP.get(req.lang, "en-US-AnaNeural")

    # Hash nội dung text + lang thành tên file mp3
    cache_key = hashlib.md5(f"{req.lang}_{clean_text}".encode("utf-8")).hexdigest()
    filename = f"{cache_key}.mp3"
    file_path = audio_cache_dir / filename

    # Nếu chưa có trong cache hoặc file bị rỗng (0 byte) thì xóa và sinh audio mới
    if not file_path.exists() or file_path.stat().st_size == 0:
        if file_path.exists() and file_path.stat().st_size == 0:
            file_path.unlink(missing_ok=True)
        try:
            communicate = edge_tts.Communicate(clean_text, voice)
            await communicate.save(str(file_path))
            if file_path.exists() and file_path.stat().st_size == 0:
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=500, detail="Edge TTS sinh file rỗng")
        except HTTPException:
            raise
        except Exception as e:
            if file_path.exists():
                file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=f"Lỗi TTS: {str(e)}")

    return {"url": f"/static/audio_cache/{filename}"}

if __name__ == "__main__":
    import os
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
