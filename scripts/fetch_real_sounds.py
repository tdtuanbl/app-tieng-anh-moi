#!/usr/bin/env python3
"""
Tải và chuẩn hóa kho âm thanh thu âm đời thực (.mp3, 1.2-1.8s, < 60KB)
cho chủ đề Động vật (animals) và Phương tiện (vehicles) vào static/sounds/.
Nguồn sử dụng: BigSoundBank (CC0) và Wikimedia Commons (Public Domain / CC).
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests

ROOT_DIR = Path(__file__).resolve().parent.parent
VOCAB_PATH = ROOT_DIR / "data" / "vocab.json"
SOUNDS_DIR = ROOT_DIR / "static" / "sounds"

# Cấu hình nguồn âm thanh thu âm thực tế tách riêng từng từ vựng
# Mỗi mục: ("bsb", "<id>") hoặc ("wiki", "File:<Title>")
SOUND_SOURCES = {
    # === 1. NHÓM ĐỘNG VẬT (animals) ===
    "dog": ("bsb", "2954"),          # Barking Dog #2
    "cat": ("bsb", "1890"),          # Meow Cat #2
    "cow": ("bsb", "0546"),          # Cow Moos #1
    "pig": ("wiki", "File:Mudchute pig 1.ogg"),
    "chicken": ("bsb", "0283"),      # Rooster Song
    "duck": ("bsb", "0276"),         # Ducks
    "lion": ("wiki", "File:Lion raring-sound1TamilNadu178.ogg"),
    "tiger": ("wiki", "File:439280 schots angry-tiger.wav"),
    "elephant": ("wiki", "File:Elephant voice - trumpeting.ogg"),
    "bird": ("bsb", "0999"),         # Birds Waking #3
    "sparrow": ("bsb", "1908"),      # Baby birds in a nest #2
    "frog": ("bsb", "0998"),         # Frogs #2
    "horse": ("bsb", "0863"),        # Horse Neighing #3
    "goat": ("bsb", "0279"),         # Bleating Goat #1
    "monkey": ("wiki", "File:Chimpanzee-Alarm-Call-Production-Meets-Key-Criteria-for-Intentionality-pone.0076674.s005.oga"),
    "bee": ("bsb", "1000"),          # Bumblebee #1
    "snake": ("wiki", "File:Rattlesnake.ogg"),
    "crocodile": ("wiki", "File:Alligatorhiss.ogg"),

    # === 2. NHÓM PHƯƠNG TIỆN (vehicles - tách riêng từng loại) ===
    "car": ("bsb", "0258"),          # Recent Car Horn #2
    "taxi": ("bsb", "3438"),         # Car Honking at 90 km/h #3
    "bus": ("bsb", "3594"),          # Bus horn
    "truck": ("bsb", "2721"),        # Truck Horn
    "dump_truck": ("bsb", "1449"),   # Truck, maneuvering and unloading
    "pickup_truck": ("bsb", "1146"), # Truck engine, small accelerations
    "container_truck": ("bsb", "1832"),  # Pneumatic Horn, Double #3
    "van": ("bsb", "1145"),          # Truck/van diesel engine
    "motorbike": ("bsb", "0281"),    # Motorcycle
    "scooter": ("bsb", "0533"),      # Scooter Passage
    "fire_truck": ("wiki", "File:WWS Fireenginesiren.ogg"),
    "police_car": ("bsb", "0886"),   # Gendarmerie, Outdoor Siren
    "ambulance": ("wiki", "File:Ambulance Sounds2.wav"),
    "train": ("bsb", "2847"),        # Train Horn #3
    "bullet_train": ("bsb", "0120"), # High-speed Train (passage) #1
    "airplane": ("bsb", "3008"),     # Airplane, Pass #5
    "helicopter": ("bsb", "0263"),   # Helicopter #1
    "ship": ("bsb", "0261"),         # Ocean Liner Horn #1
    "ferry": ("bsb", "0262"),        # Ocean Liner Horn #2
    "boat": ("bsb", "2571"),         # Small fishing port #1
    "bicycle": ("bsb", "1102"),      # Bell Bike #5
    "cyclo": ("bsb", "0275"),        # Bell Bike #2
    "tractor": ("bsb", "0499"),      # Small Tractor
    "excavator": ("bsb", "2147"),    # Excavator, engine
    "bulldozer": ("bsb", "0631"),    # Roadworks #1
    "submarine": ("bsb", "1920"),    # Sonar #2
}


def find_ffmpeg() -> str | None:
    """Tìm binary ffmpeg trong PATH, imageio_ffmpeg hoặc uv cache."""
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg  # type: ignore
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        pass
    # Thử tìm trong uv cache trên Windows/Linux
    uv_cache = Path.home() / "AppData" / "Local" / "uv" / "cache"
    if uv_cache.exists():
        for p in uv_cache.rglob("ffmpeg*.exe"):
            return str(p)
    return None


def load_target_vocab_ids() -> dict[str, set[str]]:
    """Đọc danh sách ID hợp lệ của animals và vehicles từ data/vocab.json."""
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    result = {"animals": set(), "vehicles": set()}
    for topic in data.get("topics", []):
        tid = topic.get("id")
        if tid in result:
            for w in topic.get("words", []):
                if w.get("id"):
                    result[tid].add(w["id"])
    return result


def resolve_wiki_url(session: requests.Session, file_title: str) -> tuple[str | None, float]:
    """Lấy URL MP3 (hoặc file gốc) và duration từ Wikimedia Commons API."""
    for attempt in range(3):
        try:
            r = session.get(
                "https://commons.wikimedia.org/w/api.php",
                params={
                    "action": "query",
                    "titles": file_title,
                    "prop": "imageinfo|videoinfo",
                    "iiprop": "url|size|mime",
                    "viprop": "derivatives",
                    "format": "json",
                },
                timeout=15,
            )
            if r.status_code == 200 and r.text.strip().startswith("{"):
                pages = list((r.json().get("query") or {}).get("pages", {}).values())
                if not pages:
                    return None, 0.0
                p = pages[0]
                ii = (p.get("imageinfo") or [{}])[0]
                vi = (p.get("videoinfo") or [{}])[0]
                dur = float(ii.get("duration") or 0.0)
                orig_url = ii.get("url")
                mp3_url = None
                if orig_url and orig_url.lower().split("?")[0].endswith(".mp3"):
                    mp3_url = orig_url
                else:
                    for d in vi.get("derivatives", []):
                        src = str(d.get("src", ""))
                        if d.get("transcodekey") == "mp3" or src.lower().endswith(".mp3"):
                            mp3_url = src
                            break
                return mp3_url or orig_url, dur
        except Exception:
            pass
        time.sleep(0.8 * (attempt + 1))
    return None, 0.0


def download_audio(session: requests.Session, src_type: str, src_ref: str) -> tuple[bytes | None, str]:
    """Tải dữ liệu âm thanh thô về RAM."""
    if src_type == "bsb":
        url = f"https://bigsoundbank.com/UPLOAD/mp3/{src_ref}.mp3"
        ext = ".mp3"
        headers = {"Referer": "https://bigsoundbank.com/"}
    else:
        url, _ = resolve_wiki_url(session, src_ref)
        if not url:
            return None, ""
        clean_path = url.split("?")[0].lower()
        ext = Path(clean_path).suffix or ".ogg"
        headers = {}

    for attempt in range(3):
        try:
            r = session.get(url, headers=headers, timeout=25)
            if r.status_code == 200 and len(r.content) > 1024:
                return r.content, ext
        except Exception:
            pass
        time.sleep(0.8 * (attempt + 1))
    return None, ""


def get_audio_duration(ffmpeg_exe: str, file_path: Path) -> float:
    """Đọc độ dài âm thanh thực tế bằng ffmpeg -i."""
    proc = subprocess.run(
        [ffmpeg_exe, "-i", str(file_path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
    )
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", proc.stderr)
    if not m:
        return 0.0
    h, mins, secs = int(m.group(1)), int(m.group(2)), float(m.group(3))
    return h * 3600 + mins * 60 + secs


def process_with_ffmpeg(ffmpeg_exe: str, raw_path: Path, out_path: Path) -> float:
    """
    Cắt gọn về 1.2-1.8s (ưu tiên 1.5s), bỏ khoảng lặng đầu,
    chuẩn hóa âm lượng, fade out cuối và nén MP3 mono 64kbps (< 60KB).
    """
    raw_dur = get_audio_duration(ffmpeg_exe, raw_path)
    target_dur = 1.5 if raw_dur <= 0 or raw_dur >= 1.5 else max(1.2, raw_dur)

    # Thử cắt bỏ khoảng lặng đầu để bé chạm nút là kêu ngay 0ms
    fade_start = max(0.8, target_dur - 0.25)
    af_trimmed = (
        f"silenceremove=start_periods=1:start_duration=0.05:start_threshold=-35dB,"
        f"atrim=0:{target_dur:.2f},"
        f"afade=t=in:st=0:d=0.03,afade=t=out:st={fade_start:.2f}:d=0.25,"
        f"loudnorm=I=-16:TP=-1.5:LRA=11"
    )
    cmd = [
        ffmpeg_exe, "-y", "-i", str(raw_path),
        "-vn", "-ac", "1", "-ar", "44100", "-b:a", "64k",
        "-af", af_trimmed,
        str(out_path),
    ]
    subprocess.run(cmd, capture_output=True)

    out_dur = get_audio_duration(ffmpeg_exe, out_path) if out_path.exists() else 0.0
    # Nếu silenceremove làm file bị ngắn dưới 1.15s -> cắt lại từ đầu (hoặc 0.1s) không dùng silenceremove
    if out_dur < 1.15:
        af_direct = (
            f"atrim=0:{target_dur:.2f},"
            f"afade=t=in:st=0:d=0.03,afade=t=out:st={fade_start:.2f}:d=0.25,"
            f"loudnorm=I=-16:TP=-1.5:LRA=11"
        )
        cmd_direct = [
            ffmpeg_exe, "-y", "-i", str(raw_path),
            "-vn", "-ac", "1", "-ar", "44100", "-b:a", "64k",
            "-af", af_direct,
            str(out_path),
        ]
        subprocess.run(cmd_direct, capture_output=True)
        out_dur = get_audio_duration(ffmpeg_exe, out_path) if out_path.exists() else 0.0

    # Nếu bản thu gốc vẫn ngắn (< 1.15s, vd tiếng heo ủn ỉn 0.36s), ghép thêm nhịp lặp tự nhiên kèm khoảng nghỉ 0.22s để đạt ~1.35s
    if 0.15 < out_dur < 1.15:
        tmp_pad = out_path.with_suffix(".pad.mp3")
        af_repeat = (
            "apad=pad_dur=0.22,aloop=loop=3:size=44100*2,"
            "atrim=0:1.40,afade=t=in:st=0:d=0.03,afade=t=out:st=1.15:d=0.25,"
            "loudnorm=I=-16:TP=-1.5:LRA=11"
        )
        subprocess.run(
            [ffmpeg_exe, "-y", "-i", str(raw_path), "-vn", "-ac", "1", "-ar", "44100", "-b:a", "64k", "-af", af_repeat, str(tmp_pad)],
            capture_output=True,
        )
        if tmp_pad.exists() and tmp_pad.stat().st_size > 2048:
            tmp_pad.replace(out_path)
            out_dur = get_audio_duration(ffmpeg_exe, out_path)

    # Nếu dung lượng vẫn > 58KB thì giảm bitrate xuống 48k
    if out_path.exists() and out_path.stat().st_size > 58 * 1024:
        tmp_small = out_path.with_suffix(".tmp.mp3")
        subprocess.run(
            [ffmpeg_exe, "-y", "-i", str(out_path), "-ac", "1", "-ar", "32000", "-b:a", "48k", str(tmp_small)],
            capture_output=True,
        )
        if tmp_small.exists() and tmp_small.stat().st_size > 2048:
            tmp_small.replace(out_path)
            out_dur = get_audio_duration(ffmpeg_exe, out_path)

    return out_dur


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    ffmpeg_exe = find_ffmpeg()
    if not ffmpeg_exe:
        print("LOI: Khong tim thay ffmpeg de cat/chuan hoa MP3 1.2-1.8s.", file=sys.stderr)
        return 1

    vocab_ids = load_target_vocab_ids()
    all_valid_ids = vocab_ids["animals"] | vocab_ids["vehicles"]
    SOUNDS_DIR.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers["User-Agent"] = "DauEnglishApp/1.0 (https://github.com/tdtuanbl/app-tieng-anh-moi)"

    animals_ok = 0
    vehicles_ok = 0
    failed = []
    sizes_kb = []

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_dir = Path(tmpdir)
        for word_id, (src_type, src_ref) in SOUND_SOURCES.items():
            if word_id not in all_valid_ids:
                print(f"[SKIP] '{word_id}' khong ton tai trong vocab.json")
                continue

            out_file = SOUNDS_DIR / f"{word_id}.mp3"
            raw_bytes, ext = download_audio(session, src_type, src_ref)
            if not raw_bytes:
                failed.append((word_id, f"Download failed ({src_type}:{src_ref})"))
                print(f"[FAIL] {word_id}: khong tai duoc tu {src_type}:{src_ref}")
                continue

            raw_path = tmp_dir / f"{word_id}{ext}"
            raw_path.write_bytes(raw_bytes)
            dur = process_with_ffmpeg(ffmpeg_exe, raw_path, out_file)

            size_bytes = out_file.stat().st_size if out_file.exists() else 0
            if size_bytes <= 2048 or size_bytes >= 60 * 1024:
                failed.append((word_id, f"Invalid size={size_bytes}B dur={dur:.2f}s"))
                print(f"[FAIL] {word_id}: kich thuoc khong dat ({size_bytes} bytes, {dur:.2f}s)")
                continue

            kb = round(size_bytes / 1024, 1)
            sizes_kb.append(kb)
            cat = "animals" if word_id in vocab_ids["animals"] else "vehicles"
            if cat == "animals":
                animals_ok += 1
            else:
                vehicles_ok += 1
            print(f"[OK] [{cat:8s}] {word_id:16s} -> {out_file.name:20s} | {kb:5.1f} KB | {dur:.2f}s")
            time.sleep(0.15)

    print("\n=== TONG KET ===")
    print(f"Animals OK : {animals_ok}")
    print(f"Vehicles OK: {vehicles_ok}")
    print(f"Total OK   : {animals_ok + vehicles_ok}")
    if sizes_kb:
        print(f"Size range : {min(sizes_kb):.1f} KB - {max(sizes_kb):.1f} KB")
    if failed:
        print(f"Failed ({len(failed)}): {failed}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
