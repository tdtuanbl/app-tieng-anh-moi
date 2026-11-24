# -*- coding: utf-8 -*-
"""
Script chuẩn hoá toàn diện vocab.json + tải ảnh cho ứng dụng Tiếng Anh Của Đậu.
Chạy: .\\.venv\\Scripts\\python.exe scripts/standardize_vocab.py
"""
import json, time, io, os, shutil
from pathlib import Path
import requests
from PIL import Image

BASE = Path(__file__).resolve().parent.parent
VOCAB = BASE / "data" / "vocab.json"
IMGS = BASE / "static" / "images"
HEADERS = {
    "User-Agent": "DauEnglishLearningApp/1.0 (https://github.com/dau-english; contact: tdtuan.med@gmail.com)"
}

# ===========================================================
# 1. ĐỊNH NGHĨA KHO TỪ VỰNG MỚI
# ===========================================================

TOPICS = [
    # ------- ANIMALS -------
    {
        "id": "animals", "title": "Động vật", "icon": "🦁",
        "color": "bg-amber-100 text-amber-800",
        "words": [
            {"id":"dog",       "en":"dog",        "vi":"con chó",           "visual":"🐶"},
            {"id":"cat",       "en":"cat",        "vi":"con mèo",           "visual":"🐱"},
            {"id":"duck",      "en":"duck",       "vi":"con vịt",           "visual":"🦆"},
            {"id":"chicken",   "en":"chicken",    "vi":"con gà",            "visual":"🐔"},
            {"id":"pig",       "en":"pig",        "vi":"con heo",           "visual":"🐷"},
            {"id":"cow",       "en":"cow",        "vi":"con bò",            "visual":"🐮"},
            {"id":"horse",     "en":"horse",      "vi":"con ngựa",          "visual":"🐴"},
            {"id":"goat",      "en":"goat",       "vi":"con dê",            "visual":"🐐"},
            {"id":"rabbit",    "en":"rabbit",     "vi":"con thỏ",           "visual":"🐰"},
            {"id":"bird",      "en":"bird",       "vi":"con chim",          "visual":"🐦"},
            {"id":"fish",      "en":"fish",       "vi":"con cá",            "visual":"🐟"},
            {"id":"mouse",     "en":"mouse",      "vi":"con chuột",         "visual":"🐭"},
            {"id":"elephant",  "en":"elephant",   "vi":"con voi",           "visual":"🐘"},
            {"id":"lion",      "en":"lion",       "vi":"con sư tử",         "visual":"🦁"},
            {"id":"tiger",     "en":"tiger",      "vi":"con hổ",            "visual":"🐯"},
            {"id":"bear",      "en":"bear",       "vi":"con gấu",           "visual":"🐻"},
            {"id":"monkey",    "en":"monkey",     "vi":"con khỉ",           "visual":"🐵"},
            {"id":"giraffe",   "en":"giraffe",    "vi":"con hươu cao cổ",   "visual":"🦒"},
            {"id":"frog",      "en":"frog",       "vi":"con ếch",           "visual":"🐸"},
            {"id":"snake",     "en":"snake",      "vi":"con rắn",           "visual":"🐍"},
            {"id":"turtle",    "en":"turtle",     "vi":"con rùa",           "visual":"🐢"},
            {"id":"dolphin",   "en":"dolphin",    "vi":"cá heo",            "visual":"🐬"},
            {"id":"bee",       "en":"bee",        "vi":"con ong",           "visual":"🐝"},
            {"id":"butterfly", "en":"butterfly",  "vi":"con bướm",          "visual":"🦋"},
            {"id":"crocodile", "en":"crocodile",  "vi":"con cá sấu",        "visual":"🐊"},
            # MỚI
            {"id":"buffalo",   "en":"buffalo",    "vi":"con trâu",          "visual":"🐃"},
            {"id":"sparrow",   "en":"sparrow",    "vi":"con chim sẻ",       "visual":"🐦"},
            {"id":"dragonfly", "en":"dragonfly",  "vi":"con chuồn chuồn",   "visual":"🦋"},
            {"id":"ant",       "en":"ant",        "vi":"con kiến",          "visual":"🐜"},
            {"id":"shrimp",    "en":"shrimp",     "vi":"con tôm",           "visual":"🦐"},
            {"id":"crab",      "en":"crab",       "vi":"con cua",           "visual":"🦀"},
        ],
    },
    # ------- VEHICLES -------
    {
        "id": "vehicles", "title": "Phương tiện giao thông", "icon": "🚗",
        "color": "bg-sky-100 text-sky-800",
        "words": [
            {"id":"car",          "en":"car",           "vi":"xe ô tô",         "visual":"🚗"},
            {"id":"bus",          "en":"bus",           "vi":"xe buýt",          "visual":"🚌"},
            {"id":"bicycle",      "en":"bicycle",       "vi":"xe đạp",           "visual":"🚲"},
            {"id":"motorbike",    "en":"motorbike",     "vi":"xe máy",           "visual":"🛵"},
            {"id":"train",        "en":"train",         "vi":"tàu hỏa",          "visual":"🚂"},
            {"id":"airplane",     "en":"airplane",      "vi":"máy bay",          "visual":"✈️"},
            {"id":"helicopter",   "en":"helicopter",    "vi":"trực thăng",       "visual":"🚁"},
            {"id":"boat",         "en":"boat",          "vi":"thuyền",           "visual":"⛵"},
            {"id":"ship",         "en":"ship",          "vi":"tàu thủy",         "visual":"🚢"},
            {"id":"truck",        "en":"truck",         "vi":"xe tải",           "visual":"🚚"},
            {"id":"fire_truck",   "en":"fire truck",    "vi":"xe cứu hỏa",       "visual":"🚒"},
            {"id":"ambulance",    "en":"ambulance",     "vi":"xe cứu thương",    "visual":"🚑"},
            {"id":"police_car",   "en":"police car",    "vi":"xe cảnh sát",      "visual":"🚓"},
            {"id":"taxi",         "en":"taxi",          "vi":"xe taxi",          "visual":"🚕"},
            {"id":"tractor",      "en":"tractor",       "vi":"máy cày",          "visual":"🚜"},
            {"id":"scooter",      "en":"scooter",       "vi":"xe trượt scooter", "visual":"🛴"},
            {"id":"van",          "en":"van",           "vi":"xe 16 chỗ",        "visual":"🚐"},
            {"id":"ferry",        "en":"ferry",         "vi":"phà chở khách",    "visual":"⛴️"},
            {"id":"cable_car",    "en":"cable car",     "vi":"cáp treo",         "visual":"🚡"},
            {"id":"dump_truck",   "en":"dump truck",    "vi":"xe ben chở cát",   "visual":"🚛"},
            {"id":"bulldozer",    "en":"bulldozer",     "vi":"xe ủi đất",        "visual":"🚜"},
            {"id":"sailboat",     "en":"sailboat",      "vi":"thuyền buồm",      "visual":"⛵"},
            {"id":"excavator",    "en":"excavator",     "vi":"máy xúc",          "visual":"🚜"},
            {"id":"crane_truck",  "en":"crane truck",   "vi":"xe cần cẩu",       "visual":"🏗️"},
            {"id":"garbage_truck","en":"garbage truck", "vi":"xe chở rác",       "visual":"🚛"},
            # MỚI
            {"id":"electric_bike","en":"electric bike", "vi":"xe đạp điện",      "visual":"🛵"},
            {"id":"tricycle",     "en":"tricycle",      "vi":"xe 3 bánh",        "visual":"🚲"},
            # 15 PHƯƠNG TIỆN MỚI BỔ SUNG
            {"id":"cement_mixer",   "en":"cement mixer",    "vi":"xe trộn bê tông",      "visual":"🚛"},
            {"id":"road_roller",    "en":"road roller",     "vi":"xe lu đường",          "visual":"🚜"},
            {"id":"container_truck","en":"container truck", "vi":"xe đầu kéo container",  "visual":"🚛"},
            {"id":"tow_truck",      "en":"tow truck",       "vi":"xe cứu hộ giao thông", "visual":"🛻"},
            {"id":"forklift",       "en":"forklift",        "vi":"xe nâng hàng",         "visual":"🏗️"},
            {"id":"tanker_truck",   "en":"tanker truck",    "vi":"xe bồn chở xăng",      "visual":"🚛"},
            {"id":"pickup_truck",   "en":"pickup truck",    "vi":"xe bán tải",           "visual":"🛻"},
            {"id":"cyclo",          "en":"cyclo",           "vi":"xe xích lô",           "visual":"🚲"},
            {"id":"hot_air_balloon","en":"hot air balloon", "vi":"khinh khí cầu",        "visual":"🎈"},
            {"id":"submarine",      "en":"submarine",       "vi":"tàu ngầm",             "visual":"🌊"},
            {"id":"bullet_train",   "en":"bullet train",    "vi":"tàu cao tốc",          "visual":"🚅"},
            {"id":"rocket",         "en":"rocket",          "vi":"tên lửa",              "visual":"🚀"},
            {"id":"speedboat",      "en":"speedboat",       "vi":"ca nô cao tốc",        "visual":"🚤"},
            {"id":"jet_ski",        "en":"jet ski",         "vi":"mô tô nước",           "visual":"🌊"},
            {"id":"carriage",       "en":"carriage",        "vi":"xe ngựa kéo",          "visual":"🐴"},
        ],
    },
    # ------- FAMILY -------
    {
        "id": "family", "title": "Gia đình", "icon": "👨‍👩‍👦",
        "color": "bg-rose-100 text-rose-800",
        "words": [
            {"id":"baby",        "en":"baby",        "vi":"em bé",                "visual":"👶"},
            {"id":"father",      "en":"father",      "vi":"bố",                   "visual":"👨"},
            {"id":"mother",      "en":"mother",      "vi":"mẹ",                   "visual":"👩"},
            {"id":"brother",     "en":"brother",     "vi":"anh trai / em trai",   "visual":"👦"},
            {"id":"sister",      "en":"sister",      "vi":"chị gái / em gái",     "visual":"👧"},
            {"id":"grandfather", "en":"grandfather", "vi":"ông nội / ông ngoại",  "visual":"👴"},
            {"id":"grandmother", "en":"grandmother", "vi":"bà nội / bà ngoại",    "visual":"👵"},
            {"id":"uncle",       "en":"uncle",       "vi":"chú / bác / cậu",      "visual":"👨‍🦰"},
            {"id":"aunt",        "en":"aunt",        "vi":"cô / dì / mợ",         "visual":"👩‍🦰"},
            {"id":"cousin",      "en":"cousin",      "vi":"anh chị em họ",        "visual":"🧑‍🤝‍🧑"},
            {"id":"son",         "en":"son",         "vi":"con trai",             "visual":"👦"},
            {"id":"daughter",    "en":"daughter",    "vi":"con gái",              "visual":"👧"},
            {"id":"child",       "en":"child",       "vi":"em bé nhỏ",            "visual":"🧒"},
            {"id":"friend",      "en":"friend",      "vi":"bạn bè",               "visual":"🤝"},
        ],
    },
    # ------- HOUSEHOLD -------
    {
        "id": "household", "title": "Đồ dùng trong nhà", "icon": "🏠",
        "color": "bg-emerald-100 text-emerald-800",
        "words": [
            {"id":"table",          "en":"table",          "vi":"cái bàn",              "visual":"🪵"},
            {"id":"chair",          "en":"chair",          "vi":"cái ghế",              "visual":"🪑"},
            {"id":"bed",            "en":"bed",            "vi":"cái giường ngủ",       "visual":"🛏️"},
            {"id":"door",           "en":"door",           "vi":"cửa ra vào",           "visual":"🚪"},
            {"id":"window",         "en":"window",         "vi":"cửa sổ",               "visual":"🪟"},
            {"id":"lamp",           "en":"lamp",           "vi":"đèn bàn / đèn ngủ",   "visual":"💡"},
            {"id":"clock",          "en":"clock",          "vi":"đồng hồ treo tường",  "visual":"⏰"},
            {"id":"television",     "en":"television",     "vi":"chiếc tivi",           "visual":"📺"},
            {"id":"refrigerator",   "en":"refrigerator",  "vi":"tủ lạnh",              "visual":"🧊"},
            {"id":"cup",            "en":"cup",            "vi":"cái cốc uống nước",    "visual":"🥛"},
            {"id":"bowl",           "en":"bowl",           "vi":"cái bát ăn cơm",       "visual":"🥣"},
            {"id":"spoon",          "en":"spoon",          "vi":"cái thìa nhỏ",         "visual":"🥄"},
            {"id":"plate",          "en":"plate",          "vi":"cái đĩa đựng thức ăn", "visual":"🍽️"},
            {"id":"bottle",         "en":"bottle",         "vi":"bình nước của bé",     "visual":"🍼"},
            {"id":"pillow",         "en":"pillow",         "vi":"chiếc gối êm",         "visual":"🛋️"},
            {"id":"blanket",        "en":"blanket",        "vi":"cái chăn ấm",          "visual":"🧶"},
            {"id":"fan",            "en":"fan",            "vi":"quạt máy mát mẻ",      "visual":"🪭"},
            {"id":"mirror",         "en":"mirror",         "vi":"gương soi",            "visual":"🪞"},
            {"id":"toothbrush",     "en":"toothbrush",     "vi":"bàn chải đánh răng",   "visual":"🪥"},
            {"id":"toothpaste",     "en":"toothpaste",     "vi":"kem đánh răng",        "visual":"🧴"},
            {"id":"soap",           "en":"soap",           "vi":"bánh xà phòng thơm",   "visual":"🧼"},
            {"id":"towel",          "en":"towel",          "vi":"khăn lau mềm mại",     "visual":"🧖"},
            {"id":"computer",       "en":"computer",       "vi":"máy vi tính",          "visual":"💻"},
            {"id":"book",           "en":"book",           "vi":"cuốn sách tranh",      "visual":"📖"},
            {"id":"broom",          "en":"broom",          "vi":"cây chổi quét nhà",    "visual":"🧹"},
            {"id":"trash_can",      "en":"trash can",      "vi":"thùng rác sạch sẽ",    "visual":"🗑️"},
            {"id":"pot",            "en":"pot",            "vi":"cái nồi nấu canh",     "visual":"🍲"},
            {"id":"key",            "en":"key",            "vi":"chìa khóa cửa",        "visual":"🔑"},
            # MỚI
            {"id":"smartphone",     "en":"smartphone",     "vi":"điện thoại thông minh","visual":"📱"},
            {"id":"chopsticks",     "en":"chopsticks",     "vi":"đôi đũa",              "visual":"🥢"},
            {"id":"washing_machine","en":"washing machine","vi":"máy giặt",             "visual":"🫧"},
            {"id":"backpack",       "en":"backpack",       "vi":"cặp sách",             "visual":"🎒"},
        ],
    },
    # ------- FRUITS & FOOD -------
    {
        "id": "fruits_food", "title": "Trái cây & Đồ ăn", "icon": "🍎",
        "color": "bg-orange-100 text-orange-800",
        "words": [
            {"id":"apple",        "en":"apple",        "vi":"quả táo",    "visual":"🍎"},
            {"id":"banana",       "en":"banana",       "vi":"quả chuối",  "visual":"🍌"},
            {"id":"orange",       "en":"orange",       "vi":"quả cam",    "visual":"🍊"},
            {"id":"watermelon",   "en":"watermelon",   "vi":"dưa hấu",    "visual":"🍉"},
            {"id":"grape",        "en":"grape",        "vi":"quả nho",    "visual":"🍇"},
            {"id":"mango",        "en":"mango",        "vi":"quả xoài",   "visual":"🥭"},
            {"id":"pineapple",    "en":"pineapple",    "vi":"quả dứa",    "visual":"🍍"},
            {"id":"milk",         "en":"milk",         "vi":"sữa",        "visual":"🥛"},
            {"id":"bread",        "en":"bread",        "vi":"bánh mì",    "visual":"🍞"},
            {"id":"egg",          "en":"egg",          "vi":"quả trứng",  "visual":"🥚"},
            {"id":"rice",         "en":"rice",         "vi":"cơm",        "visual":"🍚"},
            {"id":"cake",         "en":"cake",         "vi":"bánh kem",   "visual":"🎂"},
            {"id":"ice_cream",    "en":"ice cream",    "vi":"kem",        "visual":"🍦"},
            {"id":"water",        "en":"water",        "vi":"nước",       "visual":"💧"},
            # MỚI
            {"id":"papaya",       "en":"papaya",       "vi":"đu đủ",       "visual":"🍈"},
            {"id":"coconut",      "en":"coconut",      "vi":"quả dừa",     "visual":"🥥"},
            {"id":"dragon_fruit", "en":"dragon fruit", "vi":"thanh long",  "visual":"🍒"},
            {"id":"sweet_potato", "en":"sweet potato", "vi":"khoai lang",  "visual":"🍠"},
            {"id":"noodle",       "en":"noodle",       "vi":"bún / mì",    "visual":"🍜"},
            {"id":"vegetable",    "en":"vegetable",    "vi":"rau xanh",    "visual":"🥦"},
        ],
    },
    # ------- NATURE -------
    {
        "id": "nature", "title": "Thiên nhiên", "icon": "🌈",
        "color": "bg-teal-100 text-teal-800",
        "words": [
            {"id":"tree",     "en":"tree",     "vi":"cây",          "visual":"🌳"},
            {"id":"sun",      "en":"sun",      "vi":"mặt trời",     "visual":"☀️"},
            {"id":"moon",     "en":"moon",     "vi":"mặt trăng",    "visual":"🌙"},
            {"id":"star",     "en":"star",     "vi":"ngôi sao",     "visual":"⭐"},
            {"id":"cloud",    "en":"cloud",    "vi":"đám mây",      "visual":"☁️"},
            {"id":"rain",     "en":"rain",     "vi":"cơn mưa",      "visual":"🌧️"},
            {"id":"flower",   "en":"flower",   "vi":"bông hoa",     "visual":"🌸"},
            {"id":"leaf",     "en":"leaf",     "vi":"chiếc lá",     "visual":"🍃"},
            {"id":"rainbow",  "en":"rainbow",  "vi":"cầu vồng",     "visual":"🌈"},
            {"id":"mountain", "en":"mountain", "vi":"ngọn núi",     "visual":"⛰️"},
            {"id":"river",    "en":"river",    "vi":"dòng sông",    "visual":"🏞️"},
            {"id":"sea",      "en":"sea",      "vi":"biển",         "visual":"🌊"},
            {"id":"grass",    "en":"grass",    "vi":"bãi cỏ",       "visual":"🌿"},
            # MỚI
            {"id":"sand",     "en":"sand",     "vi":"cát",          "visual":"🏖️"},
            {"id":"rock",     "en":"rock",     "vi":"tảng đá",      "visual":"🪨"},
            {"id":"bamboo",   "en":"bamboo",   "vi":"cây tre",      "visual":"🌿"},
            {"id":"pond",     "en":"pond",     "vi":"ao nước",      "visual":"🏞️"},
            {"id":"soil",     "en":"soil",     "vi":"đất",          "visual":"🌱"},
            {"id":"mushroom", "en":"mushroom", "vi":"cây nấm",      "visual":"🍄"},
        ],
    },
    # ------- SHAPES (unchanged) -------
    {
        "id": "shapes", "title": "Hình học", "icon": "🔷",
        "color": "bg-indigo-100 text-indigo-800",
        "words": [
            {"id":"circle",    "en":"circle",    "vi":"hình tròn",       "visual":"⭕",  "image_url":"/static/images/shape_circle.png"},
            {"id":"square",    "en":"square",    "vi":"hình vuông",      "visual":"🟦",  "image_url":"/static/images/shape_square.png"},
            {"id":"triangle",  "en":"triangle",  "vi":"hình tam giác",   "visual":"🔺",  "image_url":"/static/images/shape_triangle.png"},
            {"id":"rectangle", "en":"rectangle", "vi":"hình chữ nhật",   "visual":"🟧",  "image_url":"/static/images/shape_rectangle.png"},
            {"id":"star",      "en":"star",      "vi":"hình ngôi sao",   "visual":"⭐",  "image_url":"/static/images/shape_star.png"},
            {"id":"heart",     "en":"heart",     "vi":"hình trái tim",   "visual":"❤️",  "image_url":"/static/images/shape_heart.png"},
            {"id":"oval",      "en":"oval",      "vi":"hình bầu dục",    "visual":"🥚",  "image_url":"/static/images/shape_oval.png"},
            {"id":"diamond",   "en":"diamond",   "vi":"hình thoi",       "visual":"💠",  "image_url":"/static/images/shape_diamond.png"},
            {"id":"pentagon",  "en":"pentagon",  "vi":"hình ngũ giác",   "visual":"⬟",  "image_url":"/static/images/shape_pentagon.png"},
            {"id":"hexagon",   "en":"hexagon",   "vi":"hình lục giác",   "visual":"⬢",  "image_url":"/static/images/shape_hexagon.png"},
            {"id":"cube",      "en":"cube",      "vi":"hình lập phương", "visual":"🧊",  "image_url":"/static/images/shape_cube.png"},
            {"id":"cylinder",  "en":"cylinder",  "vi":"hình trụ",        "visual":"🥫",  "image_url":"/static/images/shape_cylinder.png"},
        ],
    },
    # ------- CLOTHES (NEW) -------
    {
        "id": "clothes", "title": "Quần áo", "icon": "👕",
        "color": "bg-purple-100 text-purple-800",
        "words": [
            {"id":"shirt",    "en":"shirt",    "vi":"áo",          "visual":"👕"},
            {"id":"pants",    "en":"pants",    "vi":"quần dài",    "visual":"👖"},
            {"id":"dress",    "en":"dress",    "vi":"váy",         "visual":"👗"},
            {"id":"shoes",    "en":"shoes",    "vi":"giày",        "visual":"👟"},
            {"id":"sandals",  "en":"sandals",  "vi":"dép quai hậu","visual":"🩴"},
            {"id":"socks",    "en":"socks",    "vi":"tất / vớ",    "visual":"🧦"},
            {"id":"hat",      "en":"hat",      "vi":"mũ / nón",    "visual":"🧢"},
            {"id":"jacket",   "en":"jacket",   "vi":"áo khoác",    "visual":"🧥"},
            {"id":"shorts",   "en":"shorts",   "vi":"quần đùi",    "visual":"🩳"},
            {"id":"raincoat", "en":"raincoat", "vi":"áo mưa",      "visual":"🌧️"},
        ],
    },
]

# ===========================================================
# 2. HÀM TẢI ẢNH TỪ WIKIPEDIA
# ===========================================================
ARTICLE_MAP = {
    "cement_mixer":   "Concrete_mixer",
    "road_roller":    "Road_roller",
    "container_truck":"Semi-trailer_truck",
    "tow_truck":      "Tow_truck",
    "forklift":       "Forklift",
    "tanker_truck":   "Tank_truck",
    "pickup_truck":   "Pickup_truck",
    "cyclo":          "Cycle_rickshaw",
    "hot_air_balloon":"Hot_air_balloon",
    "submarine":      "Submarine",
    "bullet_train":   "Shinkansen",
    "rocket":         "Rocket",
    "speedboat":      "Motorboat",
    "jet_ski":        "Personal_watercraft",
    "carriage":       "Carriage",
    "buffalo":        "Water_buffalo",
    "sparrow":        "House_sparrow",
    "dragonfly":      "Dragonfly",
    "ant":            "Ant",
    "shrimp":         "Shrimp",
    "crab":           "Crab",
    "electric_bike":  "Electric_bicycle",
    "tricycle":       "Tricycle",
    "baby":           "Infant",
    "father":         "Father",
    "mother":         "Mother",
    "brother":        "Sibling",
    "sister":         "Sibling",
    "grandfather":    "Grandparent",
    "grandmother":    "Grandparent",
    "uncle":          "Uncle",
    "aunt":           "Aunt",
    "cousin":         ["Playdate", "Kinship", "Cousin"],
    "son":            "Child",
    "daughter":       "Child",
    "child":          "Child",
    "friend":         "Friendship",
    "smartphone":     "Smartphone",
    "chopsticks":     "Chopsticks",
    "washing_machine":"Washing_machine",
    "backpack":       "Backpack",
    "papaya":         "Papaya",
    "coconut":        "Coconut",
    "dragon_fruit":   "Dragon_fruit",
    "sweet_potato":   "Sweet_potato",
    "noodle":         "Noodle",
    "vegetable":      "Vegetable",
    "sand":           "Sand",
    "rock":           "Rock_(geology)",
    "bamboo":         "Bamboo",
    "pond":           "Pond",
    "soil":           "Soil",
    "mushroom":       "Mushroom",
    "shirt":          "Shirt",
    "pants":          "Trousers",
    "dress":          "Dress",
    "shoes":          "Shoe",
    "sandals":        "Sandal",
    "socks":          "Sock",
    "hat":            "Hat",
    "jacket":         "Jacket",
    "shorts":         ["Bermuda_shorts", "Shorts", "Boardshorts"],
    "raincoat":       "Raincoat",
}

def fetch_wiki_image(word_id, en_term):
    articles = ARTICLE_MAP.get(word_id, en_term.replace(" ", "_").capitalize())
    if isinstance(articles, str):
        articles = [articles]

    for article in articles:
        url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{article}"
        try:
            resp = requests.get(url, headers=HEADERS, timeout=10)
            if resp.status_code == 200:
                d = resp.json()
                img_url = d.get("originalimage", {}).get("source") or d.get("thumbnail", {}).get("source")
                if img_url and not img_url.lower().endswith(".svg"):
                    return img_url
        except Exception:
            pass
    return None

def download_image(img_url, save_path):
    resp = requests.get(img_url, headers=HEADERS, timeout=15)
    if resp.status_code != 200:
        raise Exception(f"HTTP {resp.status_code}")
    img = Image.open(io.BytesIO(resp.content)).convert("RGB")
    img.thumbnail((600, 600), Image.Resampling.LANCZOS)
    img.save(save_path, "JPEG", quality=88, optimize=True)

# ===========================================================
# 3. MAIN
# ===========================================================
def main():
    IMGS.mkdir(parents=True, exist_ok=True)

    # Collect which image files are still needed AFTER update
    still_needed = set()
    for t in TOPICS:
        for w in t["words"]:
            if t["id"] == "shapes":
                still_needed.add(Path(w["image_url"]).name)
            else:
                still_needed.add(f"{w['id']}.jpg")

    # Delete orphan images
    deleted = []
    for f in IMGS.iterdir():
        if f.suffix.lower() in (".jpg", ".jpeg") and f.name not in still_needed:
            f.unlink()
            deleted.append(f.name)
    print(f"\n🗑️  Đã xóa {len(deleted)} ảnh thừa: {deleted}")

    # Build final topic list with image_url
    total_words = 0
    all_ok = True

    for t in TOPICS:
        print(f"\n📂 {t['title']} ({t['id']})")
        for w in t["words"]:
            if t["id"] == "shapes":
                # already has image_url
                total_words += 1
                continue

            word_id = w["id"]
            filename = f"{word_id}.jpg"
            path = IMGS / filename
            w["image_url"] = f"/static/images/{filename}"

            if path.exists() and path.stat().st_size > 5120:
                print(f"  [ĐÃ CÓ] {w['en']}")
                total_words += 1
                continue

            # Need to download
            print(f"  [TẢI] {w['en']} ...", end=" ", flush=True)
            img_url = fetch_wiki_image(word_id, w["en"])
            if img_url:
                try:
                    download_image(img_url, path)
                    sz = path.stat().st_size
                    print(f"✓ {sz//1024}KB")
                except Exception as e:
                    print(f"✗ Lỗi tải: {e}")
                    all_ok = False
                    w["image_url"] = None
            else:
                print("✗ Không tìm thấy URL")
                all_ok = False
                w["image_url"] = None

            total_words += 1
            time.sleep(0.5)

    # Save vocab.json
    output = {"topics": TOPICS}
    with open(VOCAB, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n✅ Đã lưu vocab.json: {len(TOPICS)} chủ đề, {total_words} từ")

    # Final verification
    print("\n" + "="*60)
    print("🔍 KIỂM TRA CUỐI:")
    failures = []
    for t in TOPICS:
        for w in t["words"]:
            url = w.get("image_url")
            if not url:
                failures.append(f"NULL image: {t['id']}/{w['id']}")
                continue
            local = BASE / url.lstrip("/")
            if not local.exists():
                failures.append(f"FILE MISSING: {url}")
            elif local.stat().st_size <= 5120:
                failures.append(f"FILE TOO SMALL ({local.stat().st_size}B): {url}")
    
    if failures:
        print(f"❌ {len(failures)} lỗi:")
        for f in failures:
            print(f"  - {f}")
    else:
        print(f"✅ TẤT CẢ {total_words} từ có ảnh hợp lệ!")

    return failures

if __name__ == "__main__":
    failures = main()
    exit(1 if failures else 0)
