#!/usr/bin/env python3
"""Builds the template icon in the pluscloud icon family: a plain
pluscloud-blue tile with a white glyph. The glyph is the Messaging Web Widget
launcher bubble in an outlined tag ("the Web Widget, tagged"). No Zendesk or
Google logos.

    python3 scripts/make-icon.py

Writes assets/icon.svg, assets/icon.png (the GTM thumbnail, embedded by the
build) and assets/icon-preview.png. Needs rsvg-convert (brew install librsvg).
"""
import pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets'
BLUE = '#1274E7'  # --pc-blue, pluscloud design language

# The Web Widget launcher icon (24-unit box), mirrored like the widget does.
BUBBLE_D = ('M10,18 L6,22 L6,18 L10,18 Z M17,6 C19.7614237,6 22,8.23857625 22,11 '
            'C22,13.7614237 19.7614237,16 17,16 L7,16 C4.23857625,16 2,13.7614237 2,11 '
            'C2,8.23857625 4.23857625,6 7,6 Z')


def bubble(cx, cy, width):
    """Places the bubble by its visual block: the pill (x 2..22) plus the tail
    (down to y 22) is centred on (cx, cy), and the pill is `width` wide."""
    k = width / 20.0
    return (f'<g transform="translate({cx - 12 * k:.3f} {cy - 14 * k:.3f}) scale({k:.4f})">'
            f'<path fill="#fff" transform="translate(12 14) scale(-1 1) translate(-12 -14)" d="{BUBBLE_D}"/></g>')


def icon(size, radius=0.22):
    T = size
    stroke = T * 0.05
    # Tag: pointed on the left, rounded body on the right, with a hole.
    left, right = T * 0.14, T * 0.86
    top, bottom = T * 0.24, T * 0.76
    mid = (top + bottom) / 2
    shoulder = left + (bottom - top) / 2 * 0.85
    r = T * 0.06
    tag = (f'M{left:.2f},{mid:.2f} L{shoulder:.2f},{top:.2f} L{right - r:.2f},{top:.2f} '
           f'Q{right:.2f},{top:.2f} {right:.2f},{top + r:.2f} L{right:.2f},{bottom - r:.2f} '
           f'Q{right:.2f},{bottom:.2f} {right - r:.2f},{bottom:.2f} L{shoulder:.2f},{bottom:.2f} Z')
    hole_x = left + (shoulder - left) * 0.78
    hole_r = T * 0.035
    # Centre the bubble in the space between the hole and the right edge.
    inner_left = hole_x + hole_r + stroke / 2
    inner_right = right - stroke / 2
    parts = [
        f'<rect x="0" y="0" width="{T}" height="{T}" rx="{T * radius:.2f}" fill="{BLUE}"/>',
        f'<path d="{tag}" fill="none" stroke="#fff" stroke-width="{stroke:.2f}" stroke-linejoin="round"/>',
        f'<circle cx="{hole_x:.2f}" cy="{mid:.2f}" r="{hole_r:.2f}" fill="#fff"/>',
        bubble((inner_left + inner_right) / 2, mid, T * 0.29),
    ]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" '
            f'viewBox="0 0 {size} {size}">{"".join(parts)}</svg>')


def render(svg_path, png_path, size):
    subprocess.run(['rsvg-convert', '-w', str(size), '-h', str(size), str(svg_path), '-o', str(png_path)], check=True)


def main():
    OUT.mkdir(exist_ok=True)
    svg = OUT / 'icon.svg'
    svg.write_text(icon(128))
    # GTM shows the thumbnail at about 48 px; 96 px keeps it sharp on retina.
    render(svg, OUT / 'icon.png', 96)

    # Preview sheet: 24 / 48 / 96 px on light and dark backgrounds.
    sheet = ['<svg xmlns="http://www.w3.org/2000/svg" width="420" height="240">',
             '<rect width="420" height="120" fill="#f1f1f1"/><rect y="120" width="420" height="120" fill="#202124"/>']
    for row, y in ((0, 12), (1, 132)):
        x = 30
        for s in (24, 48, 96):
            sheet.append(f'<image x="{x}" y="{y + (96 - s) / 2}" width="{s}" height="{s}" href="icon.svg"/>')
            x += s + 50
    sheet.append('</svg>')
    preview_svg = OUT / 'icon-preview.svg'
    preview_svg.write_text(''.join(sheet))
    subprocess.run(['rsvg-convert', str(preview_svg), '-o', str(OUT / 'icon-preview.png')], check=True, cwd=OUT)
    preview_svg.unlink()
    print('icons written')


if __name__ == '__main__':
    main()
