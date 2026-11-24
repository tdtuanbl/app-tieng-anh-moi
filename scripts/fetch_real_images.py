import json
import time
import io
from pathlib import Path
import requests
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
VOCAB_PATH = BASE_DIR / "data" / "vocab.json"
IMAGES_DIR = BASE_DIR / "static" / "images"

IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Tuân thủ nghiêm ngặt tiêu chuẩn Wikimedia API
HEADERS = {
    "User-Agent": "DauEnglishLearningApp/1.0 (https://github.com/dau-english; contact: tdtuan.med@gmail.com)"
}

ARTICLE_MAP = {
    # Động vật
    "cow": "Cattle",
    "panda": "Giant panda",
    
    # Phương tiện
    "motorbike": "Motorcycle",
    "fire_truck": "Fire engine",
    "police_car": "Police car",
    "scooter": "Kick scooter",
    "hot_air_balloon": "Hot air balloon",
    "cable_car": "Cable car",
    "dump_truck": "Dump truck",
    "subway": "Rapid transit",
    "spaceship": "Spacecraft",
    "cement_mixer": "Concrete mixer",
    "road_roller": "Road roller",
    "container_truck": "Semi-trailer truck",
    "tow_truck": "Tow truck",
    "forklift": "Forklift",
    "tanker_truck": "Tank truck",
    "pickup_truck": "Pickup truck",
    "cyclo": "Cycle rickshaw",
    "submarine": "Submarine",
    "bullet_train": "Shinkansen",
    "rocket": "Rocket",
    "speedboat": "Motorboat",
    "jet_ski": "Personal watercraft",
    "carriage": "Carriage",

    # Đồ dùng gia đình
    "table": "Table (furniture)",
    "television": "Television set",
    "cup": "Coffee cup",
    "plate": "Plate (dishware)",
    "fan": "Mechanical fan",
    "trash_can": "Waste container",
    "pot": "Cooking pot",
    "key": "Key (lock)",
    "computer": "Personal computer"
}

def fetch_with_retry(url, params=None, max_retries=3):
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, params=params, headers=HEADERS, timeout=10)
            if resp.status_code == 429:
                wait_sec = 2.0 * (attempt + 1)
                time.sleep(wait_sec)
                continue
            return resp
        except Exception:
            time.sleep(1.0)
    return None

def get_image_url(term):
    """Lấy thumbnail từ Wikipedia / Wikimedia Commons"""
    search_term = ARTICLE_MAP.get(term.lower().replace(" ", "_"), term).replace(" ", "_")
    wiki_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{search_term}"
    
    resp = fetch_with_retry(wiki_url)
    if resp and resp.status_code == 200:
        try:
            data = resp.json()
            thumb = data.get("thumbnail", {}).get("source")
            if thumb and not thumb.lower().endswith(".svg"):
                return thumb
            orig = data.get("originalimage", {}).get("source")
            if orig and not orig.lower().endswith(".svg"):
                return orig
        except Exception:
            pass

    # Dự phòng qua Commons API
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": f"{term} filetype:bitmap",
        "gsrnamespace": "6",
        "gsrlimit": "6",
        "prop": "imageinfo",
        "iiprop": "url|mime",
        "iiurlwidth": "512",
        "format": "json"
    }
    resp = fetch_with_retry("https://commons.wikimedia.org/w/api.php", params=params)
    if resp and resp.status_code == 200:
        try:
            pages = resp.json().get("query", {}).get("pages", {})
            for pid, page in pages.items():
                title = page.get("title", "").lower()
                if any(bad in title for bad in ["diagram", "map", "logo", "icon", "drawing", "symbol", "flag", "schema"]):
                    continue
                info_list = page.get("imageinfo", [])
                if info_list:
                    thumb_url = info_list[0].get("thumburl") or info_list[0].get("url")
                    if thumb_url and not thumb_url.lower().endswith(".svg"):
                        return thumb_url
        except Exception:
            pass

    return None

def download_and_optimize_image(url, save_path):
    resp = fetch_with_retry(url)
    if not resp or resp.status_code != 200:
        raise Exception(f"Không thể tải ảnh HTTP {resp.status_code if resp else 'No resp'}")

    img_data = io.BytesIO(resp.content)
    with Image.open(img_data) as img:
        img = img.convert("RGB")
        img.thumbnail((512, 512), Image.Resampling.LANCZOS)
        img.save(save_path, "JPEG", quality=85, optimize=True)

def main():
    if not VOCAB_PATH.exists():
        print(f"Lỗi: Không tìm thấy file {VOCAB_PATH}")
        return

    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        vocab = json.load(f)

    PHYSICAL_TOPICS = {"animals", "vehicles", "household"}

    total_physical = 0
    success_count = 0
    missing_words = []

    for topic in vocab.get("topics", []):
        topic_id = topic.get("id")
        is_physical = topic_id in PHYSICAL_TOPICS
        print(f"\n📂 Chủ đề: {topic.get('title')} ({topic_id})")

        for word in topic.get("words", []):
            word_id = word["id"]
            en_term = word["en"]

            if not is_physical:
                word["image_url"] = None
                continue

            total_physical += 1
            filename = f"{word_id}.jpg"
            file_path = IMAGES_DIR / filename
            web_path = f"/static/images/{filename}"

            if file_path.exists() and file_path.stat().st_size > 1024:
                word["image_url"] = web_path
                success_count += 1
                print(f"  [ĐÃ CÓ] {en_term} -> {filename}")
                continue

            print(f"  [TẢI MỚI] {en_term}...", end=" ", flush=True)

            try:
                img_url = get_image_url(en_term)
                if img_url:
                    download_and_optimize_image(img_url, file_path)
                    word["image_url"] = web_path
                    success_count += 1
                    print("✓ THÀNH CÔNG")
                else:
                    word["image_url"] = None
                    missing_words.append(f"{topic_id}:{en_term}")
                    print("✗ KHÔNG TÌM THẤY")
            except Exception as e:
                word["image_url"] = None
                missing_words.append(f"{topic_id}:{en_term}")
                print(f"✗ LỖI: {e}")

            time.sleep(0.6)

    # Lưu kết quả cập nhật vào data/vocab.json
    with open(VOCAB_PATH, "w", encoding="utf-8") as f:
        json.dump(vocab, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(" BÁO CÁO NGHIỆM THU TẢI ẢNH:")
    print(f" - Tổng số từ vật thể thực tế: {total_physical}")
    print(f" - Tải ảnh thật thành công: {success_count}/{total_physical} ({success_count/total_physical*100:.1f}%)")
    print(f" - Số từ chưa có ảnh (fallback emoji): {len(missing_words)}")
    if missing_words:
        print(f" - Danh sách từ thiếu ảnh: {', '.join(missing_words)}")
    print("=" * 60)

if __name__ == "__main__":
    main()
