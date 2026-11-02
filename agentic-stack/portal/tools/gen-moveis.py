# Gera os sprites e manifests dos moveis proprios da fabrica (TV, fliperama, pebolim, xadrez, bar, sinuca, reuniao, cafe, banheiro).
# Arte original desenhada em codigo, sem dependencia externa. Uso: python portal/tools/gen-moveis.py
import json, os
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'overlay', 'webview-ui', 'public', 'assets', 'furniture')


def hx(s):
    s = s.lstrip('#')
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)


OUTLINE = hx('3b2a20'); WOOD = hx('c89a6b'); WOOD2 = hx('a8774a'); WOOD3 = hx('6b4a31')
BLACK = hx('1b1d24'); GREY = hx('4a4f5c'); LGREY = hx('9aa0ad'); WHITE = hx('f2efe6')
FELT = hx('3f9a5a'); FELT2 = hx('2f7a47'); RED = hx('d6483c'); BLUE = hx('3f6fd6'); AMBER = hx('e6ac3f')
CYAN = hx('7ad1e0'); PURPLE = hx('6a4fb0'); PINK = hx('e0609a'); YELLOW = hx('f2d24b'); GREEN = hx('58c46a')
PORC = hx('e8e6df'); PORC2 = hx('c4c2ba')


class Img:
    def __init__(s, w, h):
        s.im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); s.w = w; s.h = h

    def px(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h:
            s.im.putpixel((x, y), c)

    def rect(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                s.px(x + i, y + j, c)

    def box(s, x, y, w, h, fill, line=OUTLINE):
        s.rect(x, y, w, h, line)
        s.rect(x + 1, y + 1, w - 2, h - 2, fill)


def save(id_, img, category, fw, fh, bg=0, wall=False, surf=False, orient=None):
    d = os.path.join(OUT, id_)
    os.makedirs(d, exist_ok=True)
    img.im.save(os.path.join(d, id_ + '.png'))
    m = {'id': id_, 'name': id_.replace('_', ' ').title(), 'category': category, 'type': 'asset',
         'canPlaceOnWalls': wall, 'canPlaceOnSurfaces': surf, 'backgroundTiles': bg,
         'width': img.w, 'height': img.h, 'footprintW': fw, 'footprintH': fh}
    if orient:
        m['orientation'] = orient
    json.dump(m, open(os.path.join(d, 'manifest.json'), 'w'), indent=2)


def tv():  # TV de parede 32x32 com campo de futebol
    i = Img(32, 32)
    i.box(1, 4, 30, 20, BLACK)
    i.rect(3, 6, 26, 16, FELT)
    for x in range(3, 29, 4):
        i.rect(x, 6, 2, 16, FELT2)
    i.rect(3, 6, 26, 1, WHITE); i.rect(3, 21, 26, 1, WHITE); i.rect(3, 6, 1, 16, WHITE); i.rect(28, 6, 1, 16, WHITE)
    i.rect(15, 7, 1, 14, WHITE); i.rect(13, 12, 5, 1, WHITE); i.rect(13, 16, 5, 1, WHITE); i.rect(13, 12, 1, 5, WHITE); i.rect(17, 12, 1, 5, WHITE)
    i.rect(8, 10, 2, 2, RED); i.rect(20, 14, 2, 2, BLUE); i.rect(14, 14, 2, 2, WHITE)
    i.rect(27, 23, 2, 1, GREEN)
    save('TV_WALL', i, 'wall', 2, 2, wall=True)


def tv_stand():  # TV de pe com rack
    i = Img(32, 32)
    i.box(2, 2, 28, 18, BLACK)
    i.rect(4, 4, 24, 14, CYAN)
    i.rect(4, 4, 24, 3, hx('a8e6f0')); i.rect(8, 9, 6, 6, hx('5aa8c8')); i.rect(18, 8, 7, 8, hx('5aa8c8')); i.rect(10, 12, 3, 3, hx('3f7fa0'))
    i.rect(14, 20, 4, 3, GREY)
    i.box(3, 23, 26, 8, WOOD2); i.rect(4, 24, 24, 1, WOOD); i.rect(15, 25, 2, 5, OUTLINE)
    i.rect(6, 27, 4, 2, BLACK); i.rect(21, 27, 5, 2, BLACK)
    save('TV_STAND', i, 'decor', 2, 2, bg=1)


def arcade(id_, body, glow, trim):
    i = Img(16, 32)
    i.box(2, 1, 12, 30, body)
    i.rect(3, 2, 10, 4, trim)
    i.box(3, 7, 10, 9, BLACK)
    i.rect(4, 8, 8, 7, glow)
    i.rect(5, 10, 2, 2, WHITE); i.rect(9, 12, 2, 2, YELLOW); i.rect(7, 9, 1, 1, RED)
    i.rect(3, 17, 10, 5, trim); i.rect(4, 18, 8, 3, OUTLINE)
    i.rect(5, 18, 2, 2, RED); i.rect(9, 18, 2, 2, YELLOW); i.rect(12, 19, 1, 2, BLUE)
    i.rect(3, 23, 10, 7, body); i.rect(6, 25, 4, 4, OUTLINE); i.rect(7, 26, 2, 2, AMBER)
    save(id_, i, 'desks', 1, 2, bg=1)


def foosball():  # pebolim visto de cima
    i = Img(32, 32)
    i.box(1, 8, 30, 20, WOOD3)
    i.rect(3, 10, 26, 16, FELT)
    i.rect(15, 10, 1, 16, WHITE); i.rect(13, 16, 5, 1, WHITE)
    i.rect(3, 15, 1, 6, WHITE); i.rect(28, 15, 1, 6, WHITE)
    for k, x in enumerate((7, 12, 19, 24)):
        i.rect(x, 7, 1, 22, LGREY)
        col = RED if k < 2 else BLUE
        for y in (12, 17, 21):
            i.rect(x - 1, y, 3, 2, col)
    i.rect(0, 14, 2, 3, BLACK); i.rect(30, 20, 2, 3, BLACK)
    i.rect(2, 28, 3, 3, OUTLINE); i.rect(27, 28, 3, 3, OUTLINE)
    save('FOOSBALL', i, 'desks', 2, 2)


def chess():  # mesinha de xadrez 16x16
    i = Img(16, 16)
    i.box(1, 1, 14, 14, WOOD3)
    for y in range(8):
        for x in range(8):
            i.rect(2 + x, 2 + y, 1, 1, WHITE if (x + y) % 2 == 0 else WOOD2)
    for (x, y, c) in ((4, 4, BLACK), (5, 3, BLACK), (7, 6, BLACK), (9, 9, RED), (10, 10, RED), (11, 5, RED)):
        i.px(2 + x - 2, 2 + y - 2, c)
    save('CHESS_TABLE', i, 'desks', 1, 1)


def bar():  # balcao do bar 64x32
    i = Img(64, 32)
    i.box(0, 8, 64, 22, WOOD2)
    i.rect(1, 9, 62, 3, WOOD)
    i.rect(1, 12, 62, 1, OUTLINE)
    for x in range(4, 62, 14):
        i.box(x, 15, 10, 12, WOOD3); i.rect(x + 4, 20, 2, 2, AMBER)
    for x, c in ((6, GREEN), (10, AMBER), (14, RED), (40, BLUE), (44, AMBER), (48, GREEN)):
        i.rect(x, 2, 3, 6, c); i.rect(x + 1, 0, 1, 2, c); i.rect(x, 2, 1, 6, WHITE)
    for x in (22, 28, 54):
        i.rect(x, 4, 3, 4, hx('cfe9f0')); i.rect(x, 4, 3, 1, WHITE)
    i.rect(32, 2, 4, 6, LGREY); i.rect(33, 0, 2, 3, GREY); i.rect(35, 5, 3, 1, LGREY)
    save('BAR_COUNTER', i, 'desks', 4, 2, bg=1)


def bar_shelf():  # prateleira de garrafas 32x32
    i = Img(32, 32)
    i.box(0, 4, 32, 26, WOOD3)
    i.rect(1, 5, 30, 24, hx('3a2a22'))
    for y in (16, 27):
        i.rect(1, y, 30, 2, WOOD)
    cols = [GREEN, AMBER, RED, BLUE, AMBER, GREEN, PINK, CYAN]
    for k in range(7):
        x = 3 + k * 4
        i.rect(x, 8, 2, 8, cols[k % len(cols)]); i.rect(x, 7, 2, 1, WHITE)
        i.rect(x, 19, 2, 8, cols[(k + 3) % len(cols)]); i.rect(x, 18, 2, 1, WHITE)
    save('BAR_SHELF', i, 'wall', 2, 2, wall=True)


def pool():  # mesa de sinuca 48x32
    i = Img(48, 32)
    i.box(0, 2, 48, 26, WOOD3)
    i.rect(2, 4, 44, 22, FELT)
    i.rect(2, 4, 44, 1, FELT2); i.rect(2, 25, 44, 1, FELT2)
    for (x, y) in ((1, 3), (22, 3), (44, 3), (1, 24), (22, 24), (44, 24)):
        i.rect(x, y, 3, 3, BLACK)
    for (x, y, c) in ((30, 13, RED), (32, 15, YELLOW), (32, 11, BLUE), (34, 10, PINK), (34, 14, GREEN), (34, 18, AMBER), (30, 17, BLACK)):
        i.rect(x, y, 2, 2, c)
    i.rect(12, 14, 2, 2, WHITE)
    i.rect(4, 28, 4, 4, OUTLINE); i.rect(40, 28, 4, 4, OUTLINE)
    for k in range(10):
        i.px(14 + k, 20 - k // 3, WOOD)
    save('POOL_TABLE', i, 'desks', 3, 2)


def meeting():  # mesa de reuniao oval 80x48
    i = Img(80, 48)
    for y in range(48):
        for x in range(80):
            dx = (x - 39.5) / 40.0; dy = (y - 23.5) / 24.0
            r = dx * dx + dy * dy
            if r <= 1.0:
                i.px(x, y, OUTLINE if r > 0.93 else (WOOD3 if r > 0.86 else (WOOD2 if y > 30 else WOOD)))
    i.rect(30, 21, 20, 6, OUTLINE); i.rect(31, 22, 18, 4, GREY); i.rect(38, 23, 4, 2, CYAN)
    for x in (14, 24, 54, 64):
        i.rect(x, 14, 4, 3, WHITE); i.rect(x, 33, 4, 3, WHITE)
    save('MEETING_TABLE', i, 'desks', 5, 3)


def status_board():  # quadro de status 48x32 de parede, com graficos
    i = Img(48, 32)
    i.box(0, 3, 48, 27, LGREY)
    i.rect(2, 5, 44, 23, WHITE)
    i.rect(4, 7, 40, 3, AMBER)
    for k, (h, c) in enumerate(((10, GREEN), (7, AMBER), (13, CYAN), (5, RED), (9, GREEN))):
        i.rect(6 + k * 7, 26 - h, 5, h, c)
    i.rect(2, 28, 44, 1, GREY)
    save('STATUS_BOARD', i, 'wall', 3, 2, wall=True)


def toilet():  # vaso sanitario visto de frente, usado como assento
    i = Img(16, 16)
    i.box(3, 0, 10, 6, PORC2)       # caixa acoplada
    i.rect(4, 1, 8, 4, PORC); i.rect(7, 1, 2, 1, LGREY)
    i.box(2, 6, 12, 9, PORC2)
    i.rect(3, 7, 10, 7, PORC)
    i.rect(4, 8, 8, 5, hx('d6d4cc')); i.rect(6, 9, 4, 3, hx('9fb5c0'))
    save('TOILET', i, 'chairs', 1, 1, orient='front')


def sink():  # pia na parede 16x32
    i = Img(16, 32)
    i.box(1, 14, 14, 8, PORC2)
    i.rect(2, 15, 12, 5, PORC); i.rect(4, 16, 8, 3, hx('9fb5c0'))
    i.rect(7, 11, 2, 4, LGREY); i.rect(5, 11, 6, 1, LGREY)
    i.rect(5, 22, 6, 7, PORC2); i.rect(4, 29, 8, 2, OUTLINE)
    save('SINK', i, 'wall', 1, 2, wall=True)


def stall_door():  # divisoria de box 16x32
    i = Img(16, 32)
    i.box(1, 2, 14, 28, hx('7a8fa8'))
    i.rect(2, 3, 12, 2, hx('9fb3c8')); i.rect(11, 15, 2, 3, LGREY)
    i.rect(1, 29, 14, 1, OUTLINE)
    save('STALL', i, 'decor', 1, 2, bg=1)


def coffee_machine():  # maquina de cafe 16x32
    i = Img(16, 32)
    i.box(2, 4, 12, 24, GREY)
    i.rect(4, 6, 8, 5, BLACK); i.rect(5, 7, 6, 3, AMBER)
    i.rect(4, 13, 8, 2, RED); i.rect(5, 18, 6, 6, OUTLINE); i.rect(6, 20, 4, 3, WHITE)
    i.rect(4, 26, 8, 1, LGREY)
    save('COFFEE_MACHINE', i, 'decor', 1, 2, bg=1)


def vending():  # maquina de lanches 16x32
    i = Img(16, 32)
    i.box(1, 1, 14, 30, RED)
    i.box(2, 3, 9, 20, BLACK)
    for k, c in enumerate((AMBER, GREEN, PINK, CYAN, YELLOW)):
        for x in (3, 6, 9 - 1):
            i.rect(x, 4 + k * 4, 2, 3, c)
    i.rect(12, 5, 2, 8, LGREY); i.rect(12, 15, 2, 2, YELLOW)
    i.rect(3, 25, 9, 4, OUTLINE)
    save('VENDING', i, 'decor', 1, 2, bg=1)


def fridge():  # geladeira 16x32
    i = Img(16, 32)
    i.box(2, 2, 12, 28, PORC)
    i.rect(3, 14, 10, 1, OUTLINE); i.rect(11, 5, 1, 6, LGREY); i.rect(11, 17, 1, 8, LGREY)
    i.rect(3, 6, 4, 3, hx('7ad1e0')); i.rect(4, 7, 2, 1, WHITE)
    save('FRIDGE', i, 'decor', 1, 2, bg=1)


def snack_counter():  # balcao do cafe 48x32 com frutas e bolo
    i = Img(48, 32)
    i.box(0, 10, 48, 20, WOOD2)
    i.rect(1, 11, 46, 3, WOOD); i.rect(1, 14, 46, 1, OUTLINE)
    for x in range(3, 45, 11):
        i.box(x, 17, 8, 10, WOOD3)
    i.rect(5, 4, 8, 6, WHITE); i.rect(5, 4, 8, 2, PINK); i.rect(8, 2, 2, 2, RED)   # bolo
    i.rect(20, 6, 3, 4, RED); i.rect(24, 6, 3, 4, YELLOW); i.rect(28, 6, 3, 4, GREEN)  # frutas
    i.rect(38, 3, 5, 7, WHITE); i.rect(39, 2, 3, 1, LGREY); i.rect(43, 5, 2, 3, WHITE)   # garrafa termica
    save('SNACK_COUNTER', i, 'desks', 3, 2, bg=1)


def pool_water():  # piscina vista de cima 112x64 (7x4 tiles)
    i = Img(112, 64)
    stone = hx('d8d2c4'); stone2 = hx('a9a393'); w1 = hx('3fa9d6'); w2 = hx('5cc3e8'); w3 = hx('2f8fbd'); hi = hx('c8eefa'); edge = hx('2a7aa6')
    i.rect(0, 0, 112, 64, stone2); i.rect(1, 1, 110, 62, stone)
    i.rect(5, 5, 102, 54, edge); i.rect(6, 6, 100, 52, w1)
    for y in range(6, 58):
        if (y // 4) % 2 == 0:
            i.rect(6, y, 100, 1, w2)
    i.rect(6, 31, 100, 1, w3); i.rect(6, 32, 100, 1, w3)
    for k, y in enumerate(range(10, 54, 7)):
        for x in range(10 + (k % 2) * 7, 100, 14):
            i.rect(x, y, 5, 1, hi)
    i.rect(100, 4, 2, 10, LGREY); i.rect(104, 4, 2, 10, LGREY); i.rect(100, 4, 6, 2, GREY)   # escada
    i.box(60, 27, 9, 9, WHITE, RED); i.rect(62, 29, 5, 5, w1)   # boia
    save('POOL_WATER', i, 'decor', 7, 4)


def palm():  # palmeira 16x32
    i = Img(16, 32)
    i.rect(7, 12, 3, 19, WOOD2); i.rect(7, 12, 1, 19, WOOD3)
    for y in (16, 21, 26):
        i.rect(7, y, 3, 1, WOOD3)
    leaf = hx('2f8a47'); leaf2 = hx('58c46a')
    for dx, dy, w in ((-6, 3, 7), (-5, 7, 6), (9, 3, 7), (8, 7, 6), (1, 0, 7), (3, 8, 5)):
        i.rect(8 + dx - 1, 2 + dy, w, 2, leaf); i.rect(8 + dx - 1, 2 + dy, w, 1, leaf2)
    i.rect(5, 9, 6, 4, leaf); i.rect(6, 8, 4, 1, leaf2)
    i.rect(6, 12, 2, 2, RED); i.rect(9, 13, 2, 2, RED)
    save('PALM', i, 'decor', 1, 2, bg=1)


def sunlounger(id_, orient, cor):  # espreguicadeira 16x16, usada como assento
    i = Img(16, 16)
    i.box(2, 0, 12, 16, WHITE)
    for y in range(2, 14, 4):
        i.rect(3, y, 10, 2, cor)
    if orient == 'front':
        i.rect(4, 1, 8, 3, hx('f2efe6')); i.rect(4, 1, 8, 1, LGREY)
    else:
        i.rect(4, 12, 8, 3, hx('f2efe6')); i.rect(4, 14, 8, 1, LGREY)
    save(id_, i, 'chairs', 1, 1, orient=orient)


if __name__ == '__main__':
    pool_water(); palm(); sunlounger('SUNLOUNGER_FRONT', 'front', hx('3f9fd6')); sunlounger('SUNLOUNGER_BACK', 'back', hx('e0609a'))
    tv(); tv_stand(); arcade('ARCADE_A', PURPLE, CYAN, BLUE); arcade('ARCADE_B', hx('b8402f'), YELLOW, AMBER)
    foosball(); chess(); bar(); bar_shelf(); pool(); meeting(); status_board()
    toilet(); sink(); stall_door(); coffee_machine(); vending(); fridge(); snack_counter()
    print('ok')
