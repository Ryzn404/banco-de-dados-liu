"""Gera os ícones do app (PWA) em web/icons/: capacete de obra branco sobre o azul da marca.

Sem dependências: desenha em Python puro com supersampling e grava PNG com zlib.
Uso: python scripts/gerar_icones.py
"""
import pathlib
import struct
import zlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "web" / "icons"
AZUL = (37, 99, 235)
BRANCO = (255, 255, 255)
SS = 3  # amostras por eixo (anti-serrilhado)


def dentro_capacete(x, y):
    """Capacete em coordenadas 0..1, centrado. Retorna True onde é branco."""
    # aba
    if 0.18 <= x <= 0.82 and 0.645 <= y <= 0.725:
        r = 0.035
        cx = min(max(x, 0.18 + r), 0.82 - r)
        cy = min(max(y, 0.645 + r), 0.725 - r)
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    # cúpula (meia elipse), separada da aba por uma fresta
    if y <= 0.615:
        dx, dy = (x - 0.5) / 0.27, (y - 0.615) / 0.30
        if dx * dx + dy * dy <= 1:
            # crista central em azul (dá leitura de capacete)
            return not (0.47 <= x <= 0.53 and 0.36 <= y <= 0.56)
    return False


def dentro_fundo(x, y, raio):
    """Quadrado arredondado ocupando a tela toda (raio 0 = quadrado cheio)."""
    if raio == 0:
        return True
    cx = min(max(x, raio), 1 - raio)
    cy = min(max(y, raio), 1 - raio)
    return (x - cx) ** 2 + (y - cy) ** 2 <= raio * raio


def desenhar(tamanho, escala=1.0, raio=0.2):
    linhas = []
    for py in range(tamanho):
        linha = bytearray([0])  # filtro PNG "none"
        for px in range(tamanho):
            fundo = forma = 0
            for sy in range(SS):
                for sx in range(SS):
                    x = (px + (sx + 0.5) / SS) / tamanho
                    y = (py + (sy + 0.5) / SS) / tamanho
                    if dentro_fundo(x, y, raio):
                        fundo += 1
                        ix, iy = 0.5 + (x - 0.5) / escala, 0.5 + (y - 0.5) / escala
                        if dentro_capacete(ix, iy):
                            forma += 1
            total = SS * SS
            a = fundo / total
            f = forma / max(fundo, 1)
            cor = [round(AZUL[i] * (1 - f) + BRANCO[i] * f) for i in range(3)]
            linha += bytes(cor + [round(a * 255)])
        linhas.append(bytes(linha))
    return b"".join(linhas)


def gravar_png(caminho, tamanho, pixels):
    def chunk(tipo, dados):
        c = struct.pack(">I", len(dados)) + tipo + dados
        return c + struct.pack(">I", zlib.crc32(tipo + dados) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", tamanho, tamanho, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(pixels, 9)) + chunk(b"IEND", b"")
    caminho.write_bytes(png)
    print(f"[ok] {caminho.relative_to(ROOT)}")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    gravar_png(OUT / "icon-192.png", 192, desenhar(192))
    gravar_png(OUT / "icon-512.png", 512, desenhar(512))
    # "maskable": fundo cheio e desenho dentro da zona segura (80%)
    gravar_png(OUT / "maskable-512.png", 512, desenhar(512, escala=0.8, raio=0))
    # iOS aplica o próprio arredondamento: fundo cheio
    gravar_png(OUT / "apple-touch-icon.png", 180, desenhar(180, raio=0))
