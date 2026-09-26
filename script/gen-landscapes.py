"""Генератор бесшовных SVG-тайлов пейзажа за окнами (детерминированный, seed фиксирован).
Запуск: python3 script/gen-landscapes.py → client/public/game-assets/landscape/*.svg
Тайл 1600×400, левый и правый края совпадают — полоса зацикливается сдвигом ровно на ширину тайла."""
import math, random, os

W, H = 1600, 400
OUT = os.path.join(os.path.dirname(__file__), "..", "client", "public", "game-assets", "landscape")
THEMES = {
    "day":    dict(hill="#a9cdb0", hill2="#8fbb99", forest="#5e9470", near="#3b6f4c", pole="#56626b", wire="#56626b", ground="#86b06f"),
    "sunset": dict(hill="#c99192", hill2="#a8727f", forest="#6e4a63", near="#3e2a3f", pole="#2a2030", wire="#2a2030", ground="#5b3d4f"),
    "night":  dict(hill="#22335a", hill2="#1b2a4b", forest="#131f3a", near="#0a1226", pole="#060b18", wire="#0d1630", ground="#0e1830"),
}

def periodic(base, amps, seed):
    r = random.Random(seed)
    waves = [(a, k, r.uniform(0, 2 * math.pi)) for a, k in amps]
    return lambda x: base + sum(a * math.sin(2 * math.pi * k * x / W + p) for a, k, p in waves)

def ridge(f, color, step=20):
    pts = " ".join(f"L{x},{f(x):.1f}" for x in range(0, W + 1, step))
    return f'<path d="M0,{H} {pts} L{W},{H} Z" fill="{color}"/>'

def trees(y0, count, hmin, hmax, color, seed):
    r = random.Random(seed); out = []
    for i in range(count):
        x = (i + r.uniform(0, .8)) * W / count; h = r.uniform(hmin, hmax); w = h * r.uniform(.35, .5)
        for dx in (0, W) if x + w > W else (0,):  # дублируем у края для бесшовности
            xx = x - dx
            out.append(f'<path d="M{xx:.0f},{y0} L{xx + w / 2:.0f},{y0 - h:.0f} L{xx + w:.0f},{y0} Z" fill="{color}"/>')
    return "".join(out)

def far(t, name):
    body = ridge(periodic(210, [(28, 1), (14, 3), (6, 7)], 1), t["hill"]) + ridge(periodic(250, [(18, 2), (9, 5)], 2), t["hill2"])
    body += trees(262, 90, 16, 34, t["forest"], 3) + f'<rect y="260" width="{W}" height="{H - 260}" fill="{t["forest"]}"/>'
    if name == "night":  # огни далёкого посёлка
        r = random.Random(9)
        body += "".join(f'<rect x="{r.uniform(0, W - 4):.0f}" y="{r.uniform(236, 256):.0f}" width="3" height="3" fill="#ffd27a" opacity=".85"/>' for _ in range(28))
    return body

def near(t, name):
    g = f'<rect y="330" width="{W}" height="{H - 330}" fill="{t["ground"]}"/>'
    g += trees(338, 14, 70, 140, t["near"], 5)
    # опоры контактной сети каждые 400 px + провода
    for x in range(100, W, 400):
        g += f'<rect x="{x}" y="40" width="8" height="300" fill="{t["pole"]}"/><rect x="{x - 40}" y="60" width="60" height="6" fill="{t["pole"]}"/>'
    g += f'<path d="M0,70 Q{W / 8},92 {W / 4},70 T{W / 2},70 T{3 * W / 4},70 T{W},70" stroke="{t["wire"]}" stroke-width="2" fill="none"/>'
    return g

for name, t in THEMES.items():
    for layer, fn in (("far", far), ("near", near)):
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" preserveAspectRatio="none">{fn(t, name)}</svg>'
        open(os.path.join(OUT, f"{name}-{layer}.svg"), "w").write(svg)
print("ok")
