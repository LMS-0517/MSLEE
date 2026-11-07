"""KPP 파렛트 렌탈 회수 흐름 — diagram-design Loop type, KPP skin.

python3 build.py  ->  kpp-rental-loop.html
Geometry follows the Loop type contract: N stations on a circle of radius R,
clockwise from the top, ring arcs on the same circle, dashed write-back spokes.
"""
import math
from pathlib import Path

HERE = Path(__file__).parent
SLUG = "kpp-rental-loop"

# KPP skin (diagram-design style-guide.md, KPP profile)
PAPER, INK, MUTED, SOFT = "#f8f8f8", "#192e63", "#555555", "#666666"
ACCENT, TINT = "#b05800", "rgba(239,128,15,0.10)"

STATIONS = [  # clockwise from top
    {"name": "KPP 데포", "sub": "파렛트 공급"},
    {"name": "고객사 입고", "sub": "렌탈 시작", "spoke": "입고"},
    {"name": "적재·사용", "sub": "구내용 · 수송용"},
    {"name": "출고", "sub": "출고통보로 이관", "spoke": "출고"},
    {"name": "회수", "sub": "실물회수 + 전산회수", "spoke": "회수", "focal": True},
]
HUB = {"name": "WPPS 수불", "lines": ["입고 · 출고 · 회수 기록", "회수율 = 회수 ÷ 순입고"]}

SW, SH = 176, 64
HW, HH = 200, 104
R = 260
W, CX, CY = 800, 400, 356
LEGEND_Y = 680
H = 736
GAP = 6  # spoke end before hub stroke
OVERHANG = 1.2


def g4(v):
    return round(v / 4) * 4


def em(text, size):
    """Per-character width budget: wide chars 1em, others 0.6em."""
    import unicodedata
    width = 0.0
    for ch in text:
        if unicodedata.combining(ch):
            continue
        width += 1.0 if unicodedata.east_asian_width(ch) in "WFA" else 0.6
    return width * size


N = len(STATIONS)
boxes = []
for k in range(N):
    t = math.radians(-90 + k * 360 / N)
    x = g4(CX + R * math.cos(t) - SW / 2)
    y = g4(CY + R * math.sin(t) - SH / 2)
    boxes.append((x, y))
# keep mirrored pairs symmetric after rounding
for a, b in ((1, 4), (2, 3)):
    xa, ya = boxes[a]
    boxes[b] = (2 * CX - xa - SW, ya)


def ang(px, py):
    return math.atan2(py - CY, px - CX) % (2 * math.pi)


def crossings(x, y):
    pts = []
    for xe in (x, x + SW):
        d = R * R - (xe - CX) ** 2
        if d >= 0:
            for s in (1, -1):
                yy = CY + s * math.sqrt(d)
                if y <= yy <= y + SH:
                    pts.append((xe, yy))
    for ye in (y, y + SH):
        d = R * R - (ye - CY) ** 2
        if d >= 0:
            for s in (1, -1):
                xx = CX + s * math.sqrt(d)
                if x <= xx <= x + SW:
                    pts.append((xx, ye))
    return pts


def entry_exit(k):
    x, y = boxes[k]
    centre = ang(x + SW / 2, y + SH / 2)
    pts = crossings(x, y)
    rel = lambda p: (ang(*p) - centre + math.pi) % (2 * math.pi) - math.pi
    entry = min((p for p in pts if rel(p) < 0), key=lambda p: -rel(p))
    leave = min((p for p in pts if rel(p) > 0), key=rel)
    return entry, leave


rings = []
for k in range(N):
    j = (k + 1) % N
    _, start = entry_exit(k)
    entry, _ = entry_exit(j)
    phi = math.atan2(entry[1] - CY, entry[0] - CX) - OVERHANG / R
    end = (CX + R * math.cos(phi), CY + R * math.sin(phi))
    rings.append((k, f"M{start[0]:.3f} {start[1]:.3f} A{R} {R} 0 0 1 {end[0]:.3f} {end[1]:.3f}"))


def box_distance(ux, uy, a, b):
    terms = []
    if abs(ux) > 1e-9:
        terms.append(a / abs(ux))
    if abs(uy) > 1e-9:
        terms.append(b / abs(uy))
    return min(terms)


spokes, labels = [], []
for k, st in enumerate(STATIONS):
    if "spoke" not in st:
        continue
    x, y = boxes[k]
    px, py = x + SW / 2, y + SH / 2
    dx, dy = px - CX, py - CY
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L  # outward
    d_station = box_distance(ux, uy, SW / 2, SH / 2)
    d_hub = box_distance(ux, uy, HW / 2, HH / 2)
    sx, sy = px - d_station * ux, py - d_station * uy
    ex, ey = CX + (d_hub + GAP) * ux, CY + (d_hub + GAP) * uy
    spokes.append(f"M{sx:.1f} {sy:.1f} L{ex:.1f} {ey:.1f}")
    # label beside the spoke midpoint, on the clockwise-trailing side, 8px clear of the stroke
    lw, lh = g4(em(st["spoke"], 12) + 12), 16
    nx, ny = -uy, ux
    if nx < 0:
        nx, ny = -nx, -ny
    off = 8 + abs(nx) * lw / 2 + abs(ny) * lh / 2
    mx, my = (sx + ex) / 2 + nx * off, (sy + ey) / 2 + ny * off
    labels.append((mx, my, lw, lh, st["spoke"]))

KO = "'Geist', 'Noto Sans KR', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif"
svg = []
svg.append(f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="{SLUG}-title {SLUG}-desc">')
svg.append(f'<title id="{SLUG}-title">KPP 파렛트 렌탈 회수 흐름</title>')
svg.append(
    f'<desc id="{SLUG}-desc">KPP 데포에서 공급된 파렛트가 고객사 입고, 적재·사용, 출고를 거쳐 실물회수와 전산회수로 데포에 돌아오는 순환이며, '
    f"입고·출고·회수는 WPPS 수불 기록에 쌓여 회수율(회수 ÷ 순입고)을 만든다.</desc>"
)
svg.append(
    "<defs>"
    f'<marker id="arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{MUTED}"/></marker>'
    f'<marker id="arrow-accent" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{ACCENT}"/></marker>'
    f'<marker id="arrow-soft" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="{SOFT}"/></marker>'
    "</defs>"
)
svg.append(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')
for k, d in rings:
    headline = k == N - 1  # 회수 -> KPP 데포: the return that closes the pool
    cls = "ring accent" if headline else "ring"
    svg.append(f'<path class="{cls}" d="{d}" marker-end="url(#{"arrow-accent" if headline else "arrow"})"/>')
for d in spokes:
    svg.append(f'<path class="spoke" d="{d}" marker-end="url(#arrow-soft)"/>')
for mx, my, lw, lh, text in []:  # station names already name each write-back
    svg.append(f'<rect x="{g4(mx - lw / 2)}" y="{g4(my - lh / 2)}" width="{lw}" height="{lh}" rx="4" fill="{PAPER}"/>')
    svg.append(f'<text x="{g4(mx - lw / 2) + lw / 2:.0f}" y="{g4(my - lh / 2) + 12}" class="arrow-label-ko">{text}</text>')
for k, st in enumerate(STATIONS):
    x, y = boxes[k]
    focal = st.get("focal")
    svg.append(f'<rect class="station{" focal" if focal else ""}" x="{x}" y="{y}" width="{SW}" height="{SH}" rx="6"/>')
    svg.append(f'<text x="{x + SW / 2:.0f}" y="{y + 27}" class="node-name{" focal-name" if focal else ""}">{st["name"]}</text>')
    svg.append(f'<text x="{x + SW / 2:.0f}" y="{y + 47}" class="sub-ko">{st["sub"]}</text>')
hx, hy = CX - HW / 2, CY - HH / 2
svg.append(f'<rect class="hub" x="{hx:.0f}" y="{hy:.0f}" width="{HW}" height="{HH}" rx="8"/>')
svg.append(f'<text x="{CX}" y="{hy + 38:.0f}" class="hub-name">{HUB["name"]}</text>')
svg.append(f'<text x="{CX}" y="{hy + 62:.0f}" class="hub-sub">{HUB["lines"][0]}</text>')
svg.append(f'<text x="{CX}" y="{hy + 82:.0f}" class="hub-sub">{HUB["lines"][1]}</text>')
# legend strip
svg.append(f'<line x1="32" y1="{LEGEND_Y - 8}" x2="{W - 32}" y2="{LEGEND_Y - 8}" stroke="rgba(25,46,99,0.10)" stroke-width="0.8"/>')
svg.append(f'<text x="32" y="{LEGEND_Y + 20}" class="legend-eyebrow">LEGEND</text>')
lx = 108
svg.append(f'<line x1="{lx}" y1="{LEGEND_Y + 16}" x2="{lx + 32}" y2="{LEGEND_Y + 16}" class="ring" marker-end="url(#arrow)"/>')
svg.append(f'<text x="{lx + 44}" y="{LEGEND_Y + 20}" class="legend-ko">파렛트 이동</text>')
lx = 260
svg.append(f'<line x1="{lx}" y1="{LEGEND_Y + 16}" x2="{lx + 32}" y2="{LEGEND_Y + 16}" class="spoke" marker-end="url(#arrow-soft)"/>')
svg.append(f'<text x="{lx + 44}" y="{LEGEND_Y + 20}" class="legend-ko">WPPS 전산 기록</text>')
lx = 432
svg.append(f'<line x1="{lx}" y1="{LEGEND_Y + 16}" x2="{lx + 32}" y2="{LEGEND_Y + 16}" class="ring accent" marker-end="url(#arrow-accent)"/>')
svg.append(f'<rect x="{lx + 44}" y="{LEGEND_Y + 8}" width="16" height="12" rx="2" fill="{TINT}" stroke="{ACCENT}" stroke-width="1"/>')
svg.append(f'<text x="{lx + 68}" y="{LEGEND_Y + 20}" class="legend-ko">회수: 집중 관리 단계</text>')
svg.append("</svg>")

html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KPP 파렛트 렌탈 회수 흐름</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500;600&family=Noto+Serif:ital@0;1&family=Noto+Sans+KR:wght@400;500;600&family=Noto+Serif+KR:wght@400&display=swap" rel="stylesheet">
<style>
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
:root {{
  --paper: {PAPER}; --ink: {INK}; --muted: {MUTED}; --soft: {SOFT};
  --accent: {ACCENT}; --accent-tint: {TINT}; --rule: rgba(25,46,99,0.12);
  --sans: {KO};
  --serif: 'Instrument Serif', 'Noto Serif', 'Noto Serif KR', serif;
  --mono: 'Geist Mono', ui-monospace, monospace;
}}
body {{ min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 3rem 2rem; background: var(--paper); color: var(--ink); font-family: var(--sans); }}
.frame {{ width: 100%; max-width: 860px; }}
.eyebrow {{ margin-bottom: 0.5rem; color: var(--muted); font: 500 0.66rem var(--mono); letter-spacing: 0.18em; text-transform: uppercase; }}
h1 {{ margin-bottom: 1.5rem; color: var(--ink); font: 400 clamp(1.5rem, 2.4vw + 0.75rem, 2rem)/1.15 var(--serif); letter-spacing: -0.02em; }}
.diagram-container {{ width: 100%; overflow-x: auto; }}
svg {{ display: block; width: 100%; min-width: {W}px; }}
@media print {{ svg {{ min-width: 0; }} .diagram-container {{ overflow: visible; }} }}
.ring {{ fill: none; stroke: var(--muted); stroke-width: 1.2; }}
.ring.accent {{ stroke: var(--accent); }}
.spoke {{ fill: none; stroke: var(--soft); stroke-width: 1; stroke-dasharray: 5 4; }}
.station {{ fill: var(--paper); stroke: var(--ink); stroke-width: 1; }}
.station.focal {{ fill: var(--accent-tint); stroke: var(--accent); stroke-width: 1.2; }}
.hub {{ fill: var(--ink); }}
.node-name {{ fill: var(--ink); font: 600 13px var(--sans); text-anchor: middle; }}
.focal-name {{ fill: var(--accent); }}
.sub-ko {{ fill: var(--soft); font: 400 12px var(--sans); text-anchor: middle; }}
.hub-name {{ fill: var(--paper); font: 600 16px var(--sans); text-anchor: middle; }}
.hub-sub {{ fill: var(--paper); opacity: 0.8; font: 400 12px var(--sans); text-anchor: middle; }}
.arrow-label-ko {{ fill: var(--soft); font: 500 12px var(--sans); text-anchor: middle; }}
.legend-eyebrow {{ fill: var(--muted); font: 500 8px var(--mono); letter-spacing: 0.14em; }}
.legend-ko {{ fill: var(--muted); font: 400 12px var(--sans); }}
.cards {{ display: grid; grid-template-columns: 1fr 1.15fr 1.25fr; gap: 12px; margin-top: 1.5rem; }}
.card {{ background: #fff; border: 1px solid var(--rule); border-radius: 6px; padding: 14px 16px; }}
.card .k {{ font: 500 0.62rem var(--mono); letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }}
.card .f {{ font: 600 0.95rem var(--sans); color: var(--ink); }}
.card .f b {{ color: var(--accent); font-weight: 600; }}
.card p {{ margin-top: 6px; font: 400 0.8rem/1.5 var(--sans); color: var(--muted); }}
@media (max-width: 640px) {{ .cards {{ grid-template-columns: 1fr; }} }}
</style>
</head>
<body>
<main class="frame">
<p class="eyebrow">KPP · PPS 파렛트 풀</p>
<h1>파렛트 렌탈 회수 흐름</h1>
<div class="diagram-container">
{chr(10).join(svg)}
</div>
<section class="cards" aria-label="회수 지표 정의">
  <div class="card"><div class="k">Net in</div><div class="f">순입고 = 입고 − 출고</div><p>고객사가 실제로 들고 있는 렌탈 수량.</p></div>
  <div class="card"><div class="k">Return</div><div class="f">회수 = 실물회수 + 전산회수</div><p>실물회수는 차량이 현장에서 수거한 수량, 전산회수는 전산으로만 처리돼 실물이 남아 있는 수량.</p></div>
  <div class="card"><div class="k">Rate</div><div class="f"><b>회수율</b> = 회수 ÷ 순입고 × 100</div><p>일반과 건자재는 목표가 달라(일반 99%대, 건자재 76.5%) 섞지 않고 함께 표기. 재고증감 (+)는 회수 부족.</p></div>
</section>
</main>
</body>
</html>
"""
(HERE / f"{SLUG}.html").write_text(html, encoding="utf-8")
print("wrote", f"{SLUG}.html", "stations", boxes)
