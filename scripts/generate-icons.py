"""Generates Dayflow's PNG icons with only the standard library.

Run from the project root:  npm run icons
"""
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
BG = (91, 91, 214)       # accent indigo
FG = (255, 255, 255)


def png(size, pixels):
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in pixels)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def coverage(x, y, size):
    """Supersampled alpha for a rounded square holding a white 'flow' wave."""
    n = 4
    hits = 0
    for sy in range(n):
        for sx in range(n):
            u = (x + (sx + 0.5) / n) / size
            v = (y + (sy + 0.5) / n) / size
            hits += inside(u, v)
    return hits / (n * n)


def inside(u, v):
    r = 0.22
    cx = min(max(u, r), 1 - r)
    cy = min(max(v, r), 1 - r)
    return (u - cx) ** 2 + (v - cy) ** 2 <= r * r


def is_mark(u, v):
    # Three horizontal bars of decreasing length: a day's schedule.
    bars = [(0.24, 0.30, 0.76), (0.45, 0.30, 0.62), (0.66, 0.30, 0.70)]
    h = 0.075
    for cy, x0, x1 in bars:
        if x0 <= u <= x1 and abs(v - cy) <= h:
            return True
    return False


def render(size):
    rows = []
    for y in range(size):
        row = []
        for x in range(size):
            a = coverage(x, y, size)
            u, v = (x + 0.5) / size, (y + 0.5) / size
            r, g, b = FG if is_mark(u, v) else BG
            row.append((r, g, b, round(255 * a)))
        rows.append(row)
    return png(size, rows)


OUT.mkdir(parents=True, exist_ok=True)
for s in (16, 32, 48, 128):
    (OUT / f"icon-{s}.png").write_bytes(render(s))
    print(f"wrote icon-{s}.png")
