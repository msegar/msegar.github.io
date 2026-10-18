#!/usr/bin/env python3
"""Generates assets/images/og/<slug>.png, the 1200x630 social share card for each patient page.

One generic layout, built to read at thumbnail size: logo and an ECG stroke on top,
the page title (from front matter) large, and the byline on a navy band. Rasterized
with rsvg-convert; the webp logo is converted with macOS sips because librsvg cannot read webp.

Usage: python3 scripts/figures/og-cards.py [slug ...]   (no slugs = every page)
"""
import base64
import glob
import os
import re
import subprocess
import sys
import tempfile
from html import escape

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
CONTENT_DIR = os.path.join(ROOT, 'content', 'patients')
IMAGES = os.path.join(ROOT, 'assets', 'images')
OUT_DIR = os.path.join(IMAGES, 'og')

W, H, PAD = 1200, 630, 64
SERIF = "Georgia, 'Times New Roman', serif"
SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif"
NAVY, ACCENT = '#1F3A5F', '#C0392B'
BYLINE = 'Dr. Matt Segar · Heart Rhythm Specialist · segar.me'

# Approximate Georgia Bold advance widths, in em, for wrapping
NARROW, WIDE = set("fijlrt.,:;'!|()- "), set('MWmw@')


def text_width(s, size):
    em = 0
    for ch in s:
        if ch == ' ':
            em += 0.25
        elif ch in NARROW:
            em += 0.40
        elif ch in WIDE:
            em += 1.0
        elif ch.isupper() or ch.isdigit():
            em += 0.78
        else:
            em += 0.62
    return em * size


def wrap(text, size, max_w):
    lines, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if line and text_width(trial, size) > max_w:
            lines.append(line)
            line = word
        else:
            line = trial
    return lines + [line]


def front_matter(md):
    return re.search(r'^title:\s*"(.*)"\s*$', md.split('---')[1], re.M).group(1)


def logo_uri():
    with tempfile.NamedTemporaryFile(suffix='.png') as tmp:
        subprocess.run(['sips', '-s', 'format', 'png', os.path.join(IMAGES, 'logo_color.webp'), '--out', tmp.name],
                       check=True, capture_output=True)
        return 'data:image/png;base64,' + base64.b64encode(open(tmp.name, 'rb').read()).decode()


def ecg_path(x0, x1, y):
    # Repeating P-QRS-T complexes, drawn as one stroke
    d, x = f'M{x0} {y}', x0
    while x + 161 <= x1:
        d += ' h30 q12 -14 24 0 h16 l8 10 l12 -78 l12 92 l9 -24 h18 q16 -24 32 0'
        x += 161
    return d + f' H{x1}'


def card(title, logo):
    text_w = W - 2 * PAD
    # Largest title size that fits in three lines without a lone word on the last line
    for size in range(76, 40, -2):
        lines = wrap(title, size, text_w)
        if len(lines) <= 3 and (len(lines) == 1 or len(lines[-1].split()) > 1):
            break
    lh = round(size * 1.18)
    band = 116
    top = 168 + round((300 - lh * len(lines)) / 2) + size
    tspans = ''.join(f'<tspan x="{PAD}" y="{top + i * lh}">{escape(l)}</tspan>' for i, l in enumerate(lines))

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<rect width="{W}" height="{H}" fill="#fff"/>
<image x="{PAD}" y="52" width="72" height="72" href="{logo}"/>
<text x="{PAD + 92}" y="100" font-family="{SANS}" font-weight="700" font-size="26" letter-spacing="3" fill="{NAVY}">FOR PATIENTS</text>
<path d="{ecg_path(W - PAD - 500, W - PAD, 92)}" fill="none" stroke="{ACCENT}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
<text font-family="{SERIF}" font-weight="700" font-size="{size}" fill="{NAVY}">{tspans}</text>
<rect y="{H - band}" width="{W}" height="{band}" fill="{NAVY}"/>
<text x="{PAD}" y="{H - band / 2 + 12}" font-family="{SANS}" font-weight="600" font-size="34" fill="#fff">{escape(BYLINE)}</text>
</svg>'''


def main(slugs):
    os.makedirs(OUT_DIR, exist_ok=True)
    logo = logo_uri()
    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    for path in files:
        slug = os.path.basename(path)[:-3]
        if slugs and slug not in slugs:
            continue
        out = os.path.join(OUT_DIR, f'{slug}.png')
        subprocess.run(['rsvg-convert', '-w', str(W), '-h', str(H), '-o', out],
                       input=card(front_matter(open(path).read()), logo).encode(), check=True)
        print(f'Generated: assets/images/og/{slug}.png')


if __name__ == '__main__':
    main(sys.argv[1:])
