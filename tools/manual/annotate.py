"""Dibuja marcas numeradas (y un recuadro fino) sobre las capturas, a partir del JSON de cajas."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

FIGS = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
ACCENT = (178, 38, 30)      # rojo oscuro
FILL = (178, 38, 30)
TEXT = (255, 255, 255)
FONT = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 30)


def badge(draw, cx, cy, label, r=24):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=FILL, outline=(255, 255, 255), width=3)
    t = str(label)
    bb = draw.textbbox((0, 0), t, font=FONT)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    draw.text((cx - tw / 2 - bb[0], cy - th / 2 - bb[1]), t, font=FONT, fill=TEXT)


def annotate(name, manual_marks=None):
    png = os.path.join(FIGS, name + ".png")
    js = os.path.join(FIGS, name + ".json")
    base = Image.open(png).convert("RGB")
    M = 44
    im = Image.new("RGB", (base.width + 2 * M, base.height + 2 * M), (255, 255, 255))
    im.paste(base, (M, M))
    draw = ImageDraw.Draw(im)
    marks = []
    if os.path.exists(js):
        data = json.load(open(js, encoding="utf-8"))
        dpr = data["dpr"]
        for b in data["boxes"]:
            if "missing" in b:
                continue
            x, y, w, h = b["x"] * dpr, b["y"] * dpr, b["w"] * dpr, b["h"] * dpr
            marks.append((b["label"], x + M, y + M, w, h, b.get("anchor", "tl")))
    for m in manual_marks or []:
        marks.append((m[0], m[1] + M, m[2] + M, m[3], m[4], m[5]))
    W, H = im.size
    pad = 6
    for label, x, y, w, h, anchor in marks:
        # recuadro fino alrededor del elemento
        x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W - 1, x + w + pad), min(H - 1, y + h + pad)
        if w > 0:
            draw.rounded_rectangle((x0, y0, x1, y1), radius=8, outline=ACCENT, width=3)
        if anchor == "tl":
            cx, cy = x0, y0
        elif anchor == "tr":
            cx, cy = x1, y0
        elif anchor == "l":
            cx, cy = x0, (y0 + y1) / 2
        elif anchor == "r":
            cx, cy = x1, (y0 + y1) / 2
        elif anchor == "c":
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        else:
            cx, cy = x0, y0
        cx = min(max(cx, 26), W - 26)
        cy = min(max(cy, 26), H - 26)
        badge(draw, cx, cy, label)
    im.save(os.path.join(OUT, name + ".png"))
    print("ok", name, im.size)


# Marcas manuales para los lienzos (canvas): coordenadas en fracción de la imagen.
def frac(im_name, label, fx, fy, fw, fh, anchor="tl"):
    im = Image.open(os.path.join(FIGS, im_name + ".png"))
    W, H = im.size
    return (label, fx * W, fy * H, fw * W, fh * H, anchor)


if __name__ == "__main__":
    names = [n[:-5] for n in os.listdir(FIGS) if n.endswith(".json")]
    for n in sorted(names):
        if n == "A10-diagrama-feliz":
            annotate(n, [
                frac(n, 1, 0.003, 0.03, 0.03, 0.94),          # eje de tiempo
                frac(n, 2, 0.045, 0.0, 0.012, 0.06, "tr"),      # línea A
                frac(n, 3, 0.94, 0.0, 0.02, 0.06, "tl"),        # línea B
                frac(n, 4, 0.30, 0.075, 0, 0, "c"),              # trama F0 (sobre la diagonal)
                frac(n, 5, 0.70, 0.245, 0, 0, "c"),              # ACK1 (sobre la diagonal de vuelta)
            ])
        elif n == "A06-cadena-dos-tramos":
            annotate(n, [
                frac(n, 1, 0.02, 0.35, 0.05, 0.4, "tl"),        # nodo A
                frac(n, 2, 0.20, 0.30, 0.17, 0.40, "tl"),       # etiquetas tramo 1
                frac(n, 3, 0.47, 0.35, 0.06, 0.40, "tl"),       # nodo R1
                frac(n, 4, 0.93, 0.35, 0.05, 0.4, "tr"),        # nodo B
            ])
        else:
            annotate(n)
