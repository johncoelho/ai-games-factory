# Gera variantes dos avatares (char_6.png em diante) recolorindo cabelo, pele e roupa dos 6 originais do Pixel Agents.
# Uso: python portal/tools/gen-avatares.py <pasta-dos-char_0-5> <pasta-de-saida>
import colorsys, os, random, sys
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
FW, FH = 16, 32
HEAD = 13  # linhas do quadro que pertencem a cabeca (cabelo e rosto)

PELES = [(246, 205, 176), (226, 168, 128), (190, 128, 88), (140, 88, 60), (96, 60, 42)]
CABELOS = [(30, 24, 22), (92, 58, 34), (214, 168, 74), (190, 72, 36), (236, 232, 222), (118, 72, 170), (52, 110, 190), (214, 96, 150), (60, 150, 110)]
ROUPAS = [(52, 150, 160), (122, 82, 190), (226, 190, 60), (70, 160, 90), (214, 96, 140), (40, 44, 56), (200, 66, 56), (230, 128, 50), (70, 110, 200)]


def skin(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.02 <= h <= 0.09 and 0.2 <= s <= 0.65 and v >= 0.5


def tint(px, alvo, ref=0.55):
    r, g, b = px[:3]
    v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[2]
    k = max(0.25, min(1.35, v / ref))
    return tuple(max(0, min(255, int(c * k))) for c in alvo) + (px[3],)


def variante(im, pele, cabelo, roupa):
    out = im.copy()
    pix = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pix[x, y]
            if a == 0:
                continue
            v = max(r, g, b) / 255
            sat = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1]
            if skin(r, g, b):
                pix[x, y] = tint((r, g, b, a), pele, 0.91)
                continue
            if v < 0.16 and sat < 0.5:
                continue  # contorno e olhos escuros
            if (r, g, b) == (255, 255, 255):
                continue
            if (y % FH) < HEAD:
                pix[x, y] = tint((r, g, b, a), cabelo)
            elif sat > 0.2 or v > 0.55:
                pix[x, y] = tint((r, g, b, a), roupa, 0.5)
    return out


def main():
    rnd = random.Random(7)
    combos = set()
    base = [Image.open(os.path.join(SRC, f'char_{i}.png')).convert('RGBA') for i in range(6)]
    n = 6
    while n < 30:
        b = rnd.choice([0, 1, 3, 4, 5])
        c = (rnd.randrange(len(PELES)), rnd.randrange(len(CABELOS)), rnd.randrange(len(ROUPAS)))
        if c in combos:
            continue
        combos.add(c)
        variante(base[b], PELES[c[0]], CABELOS[c[1]], ROUPAS[c[2]]).save(os.path.join(OUT, f'char_{n}.png'))
        n += 1
    print('ok', n)


os.makedirs(OUT, exist_ok=True)
main()
