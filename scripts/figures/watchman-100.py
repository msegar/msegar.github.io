#!/usr/bin/env python3
"""Builds the 100-person icon charts comparing Watchman with a blood thinner.

Usage: python3 scripts/figures/watchman-100.py assets/images/watchman-100.svg assets/images/watchman-100-mobile.svg

Rates are per 100 people over about 3 years, from the pooled randomized trials in
Laudani et al, JAMA Cardiol 2026 (Figure 3, events per 1000 patients, rounded to the nearest half).
"""
import sys

FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif"
INK, MUTED, EMPTY = '#1F2A37', '#57606a', '#D5DBE1'
BLUE, RED, AMBER = '#2a78d6', '#e34948', '#eda100'

# (label, sublabel, color, watchman, blood thinner)
ROWS = [
    ('Stroke from a clot', 'ischemic stroke', BLUE, 4, 2.5),
    ('Bleeding, not from the procedure', 'serious bleeds over about 3 years', RED, 4, 6.5),
    ('Serious bleeding of any kind', 'includes bleeding from the procedure', RED, 8, 9.5),
    ('Complication from the procedure', 'heart fluid, device moving, stroke, bleeding', AMBER, 3, 0),
]
ARMS = ('Watchman', 'Blood thinner')


def fmt(n):
    whole = int(n)
    if n == whole:
        return str(whole)
    return f'{whole}½' if whole else '½'


def person(x, y, s, color):
    """One person icon, s wide and 1.25*s tall, top-left at (x, y)."""
    r = s * 0.22
    return (f'<circle cx="{x + s/2:.1f}" cy="{y + r:.1f}" r="{r:.1f}" fill="{color}"/>'
            f'<path d="M{x + s*0.12:.1f} {y + s*1.22:.1f}V{y + s*0.86:.1f}a{s*0.38:.1f} {s*0.32:.1f} 0 0 1 {s*0.76:.1f} 0V{y + s*1.22:.1f}z" fill="{color}"/>')


def grid(x0, y0, s, gap, n, color, uid):
    """10x10 people filled row by row from the top left; a fractional count half-fills the last icon."""
    out = []
    for i in range(100):
        col, row = i % 10, i // 10
        x, y = x0 + col * (s + gap), y0 + row * (s * 1.25 + gap)
        out.append(person(x, y, s, EMPTY))
        if i < int(n):
            out.append(person(x, y, s, color))
        elif i == int(n) and n % 1:
            cid = f'c{uid}'
            out.append(f'<clipPath id="{cid}"><rect x="{x:.1f}" y="{y:.1f}" width="{s * (n % 1):.1f}" height="{s*1.25:.1f}"/></clipPath>'
                       f'<g clip-path="url(#{cid})">{person(x, y, s, color)}</g>')
    return '\n    '.join(out)


def text(x, y, s, size, weight=400, color=INK, anchor='start'):
    return f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}">{s}</text>'


def build(mobile):
    s, gap = (17, 4) if mobile else (14, 4)
    # Font sizes, set so text stays >= ~13px once the page scales the SVG to its ~760px (desktop) or ~360px (phone) column
    F = (dict(title=25, sub=18, label=22, note=16, arm=19, foot=14) if mobile
         else dict(title=30, sub=19, label=22, note=17, arm=19, foot=15))
    gw, gh = 10 * s + 9 * gap, 10 * s * 1.25 + 9 * gap
    pad = 20
    W = 2 * gw + 60 if mobile else 1000
    parts, uid = [], 0
    if mobile:
        parts.append(text(pad, 40, 'Out of 100 people with AFib,', F['title'], 700))
        parts.append(text(pad, 72, 'over about 3 years', F['title'], 700))
        parts.append(text(pad, 102, 'Each figure is one person. Colored figures', F['sub'], color=MUTED))
        parts.append(text(pad, 126, 'had the event.', F['sub'], color=MUTED))
        y0 = 172
    else:
        parts.append(text(pad, 44, 'Out of 100 people with AFib, over about 3 years', F['title'], 700))
        parts.append(text(pad, 76, 'Each figure is one person. Colored figures had the event.', F['sub'], color=MUTED))
        y0 = 132
    note_y = round(F['label'] * 1.2)
    grid_off = note_y + 24 + F['arm'] + 14
    panel_h = grid_off + gh + (48 if mobile else 52)
    y = y0
    for k, (label, sub, color, w, d) in enumerate(ROWS):
        if mobile:
            px, py = pad, y0 + k * panel_h
        else:
            px, py = pad + (k % 2) * 490, y0 + (k // 2) * panel_h
        parts.append(text(px, py, label, F['label'], 700))
        parts.append(text(px, py + note_y, sub, F['note'], color=MUTED))
        gy = py + grid_off
        for j, (arm, n) in enumerate(zip(ARMS, (w, d))):
            x = px + j * (gw + (20 if mobile else 36))
            parts.append(text(x, gy - 14, f'{arm}: <tspan font-weight="700">{fmt(n)}</tspan>', F['arm'], 400))
            uid += 1
            parts.append(grid(x, gy, s, gap, n, color, uid))
        y = py + panel_h
    lines = (['Pooled from 8 randomized trials (7,434 people),', 'Laudani et al, JAMA Cardiology 2026.']
             if mobile else ['Pooled from 8 randomized trials (7,434 people), Laudani et al, JAMA Cardiology 2026.',
                             'Half figures show averages between whole people.'])
    lines.append('© Matt Segar, MD · Free to share with attribution · segar.me')
    lh = round(F['foot'] * 1.45)
    for i, ln in enumerate(lines):
        parts.append(text(pad, y + i * lh, ln, F['foot'], color=MUTED))
    H = y + (len(lines) - 1) * lh + 16
    desc = ' '.join(f'{label}: Watchman {fmt(w)}, blood thinner {fmt(d)} out of 100.' for label, _, _, w, d in ROWS)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H:.0f}" width="{W}" height="{H:.0f}" role="img" aria-labelledby="t d">\n'
            f'  <title id="t">Watchman compared with a blood thinner, out of 100 people</title>\n'
            f'  <desc id="d">{desc}</desc>\n'
            f'  <rect width="{W}" height="{H:.0f}" fill="#FFFFFF"/>\n  '
            + '\n  '.join(parts) + '\n</svg>\n')


open(sys.argv[1], 'w').write(build(False))
open(sys.argv[2], 'w').write(build(True))
