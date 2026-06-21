"""Generate desktop/rayzek.ico for the executable. Run during the build."""

from __future__ import annotations

import os

from PIL import Image, ImageDraw


def draw(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (9, 11, 16, 255))
    d = ImageDraw.Draw(img)
    s = size / 64.0
    d.ellipse((8 * s, 8 * s, 56 * s, 56 * s), outline=(245, 166, 35, 255), width=max(1, int(3 * s)))
    d.ellipse((22 * s, 22 * s, 42 * s, 42 * s), outline=(78, 161, 255, 255), width=max(1, int(3 * s)))
    d.ellipse((28 * s, 28 * s, 36 * s, 36 * s), fill=(245, 166, 35, 255))
    return img


def main() -> None:
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "rayzek.ico")
    sizes = [16, 24, 32, 48, 64, 128, 256]
    base = draw(256)
    base.save(out, format="ICO", sizes=[(s, s) for s in sizes])
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
