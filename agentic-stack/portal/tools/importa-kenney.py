# Recorta os moveis do CEO e das paredes da folha "Roguelike Indoors", de Kenney (kenney.nl), licenca CC0.
# A folha NAO fica no repo: baixe em https://kenney.nl/assets/roguelike-indoors e passe o PNG transparente.
# Uso: python -I portal/tools/importa-kenney.py <roguelikeIndoor_transparent.png>
# A folha tem tiles de 16x16 com 1px de margem (passo 17). Cada item e montado tile a tile.
import json, os, sys
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'overlay', 'webview-ui', 'public', 'assets', 'furniture')
STEP = 17

# id, nome, categoria, (coluna, linha, tiles de largura, tiles de altura), noParede, tiles de fundo (andaveis, no topo)
ITENS = [
    ('GOLD_FLOOR_CANDELABRA', 'Gold Floor Candelabra', 'decor', (20, 3, 1, 3), False, 2),
    ('URN_GOLD', 'Gold Lit Urn', 'decor', (18, 5, 1, 1), False, 0),
    ('URN_SILVER', 'Silver Lit Urn', 'decor', (17, 5, 1, 1), False, 0),
    ('POTTED_PLANT_A', 'Potted Plant A', 'decor', (16, 0, 1, 1), False, 0),
    ('POTTED_PLANT_B', 'Potted Plant B', 'decor', (17, 0, 1, 1), False, 0),
    ('TORCH_WALL', 'Wall Torch', 'wall', (20, 7, 1, 1), True, 0),
    ('SHIELD_BRONZE', 'Bronze Shield', 'wall', (22, 9, 1, 1), True, 0),
    ('SHIELD_TEAL', 'Teal Shield', 'wall', (22, 10, 1, 1), True, 0),
    ('BANNER_ORANGE', 'Orange Banner', 'wall', (16, 15, 3, 1), True, 0),
    ('BANNER_TEAL', 'Teal Banner', 'wall', (16, 14, 3, 1), True, 0),
    ('BANNER_GREEN', 'Green Banner', 'wall', (16, 16, 3, 1), True, 0),
    ('MAP_WORLD', 'World Map', 'wall', (20, 12, 2, 1), True, 0),
    ('MAP_CASTLE', 'Castle Map', 'wall', (20, 13, 2, 1), True, 0),
]


def main(folha):
    sheet = Image.open(folha).convert('RGBA')
    for id_, nome, cat, (c0, r0, w, h), parede, bg in ITENS:
        # itens de parede de 1 tile viram 16x32 com a arte em cima: a parede tem 2 linhas de altura
        # (a de cima e vazio) e o Pixel Agents so desenha item de parede que comece na linha de topo
        if parede and w == 1 and h == 1:
            h_img = 2
        else:
            h_img = h
        im = Image.new('RGBA', (w * 16, h_img * 16), (0, 0, 0, 0))
        for j in range(h):
            for i in range(w):
                x, y = (c0 + i) * STEP, (r0 + j) * STEP
                im.paste(sheet.crop((x, y, x + 16, y + 16)), (i * 16, j * 16))
        d = os.path.join(OUT, id_)
        os.makedirs(d, exist_ok=True)
        im.save(os.path.join(d, id_ + '.png'), optimize=True)
        json.dump({'id': id_, 'name': nome, 'category': cat, 'type': 'asset', 'canPlaceOnWalls': parede,
                   'canPlaceOnSurfaces': False, 'backgroundTiles': bg, 'width': w * 16, 'height': h_img * 16,
                   'footprintW': w, 'footprintH': h_img}, open(os.path.join(d, 'manifest.json'), 'w'), indent=2)
        print('ok', id_)


if __name__ == '__main__':
    main(sys.argv[1])
