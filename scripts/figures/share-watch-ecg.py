#!/usr/bin/env python3
"""Generates assets/images/how-to-share-watch-ecg.svg and -mobile.svg.

Four iPhone screens showing how to export an Apple Watch ECG from the Health app
(Browse > Heart > Electrocardiograms (ECG) > tap a recording > Export a PDF for
Your Doctor > Share), per Apple Support article 120278 (September 2026).
Screens are simplified drawings; ECG tracings are synthetic.

Usage: python3 scripts/figures/share-watch-ecg.py
"""
import math
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'images')

SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif"
SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif"
INK, MUTED, ACCENT = '#1F2A37', '#6E6A63', '#B4472C'
IOS_BG, IOS_SEP, IOS_GRAY, IOS_BLUE, IOS_CHEV = '#F2F2F7', '#E2E2E7', '#8E8E93', '#007AFF', '#C4C4C7'
ECG_RED = '#E8344E'

PHONE_W, PHONE_H = 170, 350

STEPS = [
    ('Find Heart in Health', 'Open Health on your iPhone, tap the Browse tab, then tap Heart.'),
    ('Open your ECGs', "Tap Electrocardiograms (ECG) to see every recording you've made."),
    ('Pick one and export it', 'Tap the result you want, then tap Export a PDF for Your Doctor.'),
    ('Share the PDF', 'Tap the Share button to print or send it. Save it to Files for a copy.'),
]
FOOTER = [
    "Simplified illustrations with synthetic ECG tracings, not Apple's actual screens.",
    'Menu names can change with software updates. Apple Watch and iPhone are trademarks of Apple Inc.',
    '© Matt Segar, MD · Free to share with attribution · segar.me',
]
TITLE = 'How to export your Apple Watch ECG as a PDF'
DESC = ('Four iPhone screens. One: open the Health app, tap the Browse tab, then tap Heart. '
        'Two: tap Electrocardiograms (ECG) to see every recording. '
        'Three: tap the result you want, then tap Export a PDF for Your Doctor. '
        'Four: tap the Share button to print or send the PDF, or save it to Files.')


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def text(x, y, s, size, fill=INK, weight=None, family=SF, anchor=None, extra=''):
    attrs = f'x="{x:g}" y="{y:g}" font-size="{size:g}" fill="{fill}" font-family="{family}"'
    if weight:
        attrs += f' font-weight="{weight}"'
    if anchor:
        attrs += f' text-anchor="{anchor}"'
    return f'<text {attrs}{extra}>{esc(s)}</text>'


def wrap(s, size, width, factor=0.5):
    """Greedy word wrap using an average glyph width estimate."""
    max_chars = max(1, int(width / (size * factor)))
    lines, cur = [], ''
    for word in s.split():
        trial = f'{cur} {word}'.strip()
        if len(trial) > max_chars and cur:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def ecg_path(x0, x1, base, amp, rr, step=0.5):
    """Synthetic sinus rhythm: P, QRS and T waves as Gaussian bumps."""
    def g(p, mu, sd):
        return math.exp(-0.5 * ((p - mu) / sd) ** 2)
    pts = []
    x = x0
    while x <= x1:
        p = ((x - x0) % rr) / rr
        v = (0.13 * g(p, 0.16, 0.03) - 0.12 * g(p, 0.285, 0.012) + 1.0 * g(p, 0.31, 0.013)
             - 0.22 * g(p, 0.338, 0.012) + 0.27 * g(p, 0.56, 0.055))
        pts.append(f'{x:.1f} {base - amp * v:.1f}')
        x += step
    return 'M' + ' L'.join(pts)


def ecg_strip(x, y, w, h, rr, uid, stroke=1.1):
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#grid{uid})" stroke="#F2C4CB" stroke-width="0.6"/>'
            f'<path d="{ecg_path(x + 1, x + w - 1, y + h * 0.66, h * 0.55, rr)}" fill="none" stroke="{ECG_RED}" '
            f'stroke-width="{stroke}" stroke-linejoin="round"/>')


def chevron(x, y, color=IOS_CHEV):
    return f'<path d="M{x - 2} {y - 3.5} L{x + 1.5} {y} L{x - 2} {y + 3.5}" fill="none" stroke="{color}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>'


def back_button(label):
    return (f'<path d="M17 36 L12.5 40.5 L17 45" fill="none" stroke="{IOS_BLUE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
            + text(21, 44, label, 10.5, IOS_BLUE))


def tap(cx, cy):
    """Tap marker: where the patient's finger goes."""
    return f'<circle cx="{cx}" cy="{cy}" r="9.5" fill="{ACCENT}" fill-opacity="0.14" stroke="{ACCENT}" stroke-width="1.6"/>'


def status_bar():
    out = [text(25, 24, '9:41', 9.5, '#000', 600)]
    for i, hgt in enumerate((3, 4.5, 6, 7.5)):          # signal
        out.append(f'<rect x="{119 + i * 3}" y="{25 - hgt}" width="2" height="{hgt}" rx="0.5" fill="#000"/>')
    out.append('<path d="M132 21.2 a6 6 0 0 1 8 0 M133.6 23 a3.6 3.6 0 0 1 4.8 0" fill="none" stroke="#000" stroke-width="1.2" stroke-linecap="round"/>'
               '<circle cx="136" cy="24.6" r="0.9" fill="#000"/>')   # wifi
    out.append('<rect x="143.5" y="18.5" width="14" height="7" rx="2" fill="none" stroke="#000" stroke-opacity="0.4" stroke-width="0.9"/>'
               '<rect x="145" y="20" width="10" height="4" rx="1" fill="#000"/>'
               '<rect x="158.3" y="20.6" width="1.2" height="2.8" rx="0.6" fill="#000" fill-opacity="0.4"/>')   # battery
    return ''.join(out)


def tab_bar():
    """iOS 26 floating tab bar with Browse selected."""
    y = 300
    out = [f'<rect x="21" y="{y + 1.5}" width="128" height="34" rx="17" fill="#000" fill-opacity="0.07"/>',
           f'<rect x="21" y="{y}" width="128" height="34" rx="17" fill="#FFFFFF" fill-opacity="0.96" stroke="#000" stroke-opacity="0.08" stroke-width="0.6"/>',
           f'<rect x="105" y="{y + 3}" width="41" height="28" rx="14" fill="#000" fill-opacity="0.06"/>']
    cy = y + 13
    # Summary: heart
    out.append(f'<path d="M45 {cy + 4} C40 {cy} 39.5 {cy - 4} 42.2 {cy - 5.2} C43.6 {cy - 5.8} 44.6 {cy - 4.8} 45 {cy - 3.6} '
               f'C45.4 {cy - 4.8} 46.4 {cy - 5.8} 47.8 {cy - 5.2} C50.5 {cy - 4} 50 {cy} 45 {cy + 4} Z" fill="none" stroke="{IOS_GRAY}" stroke-width="1.2" stroke-linejoin="round"/>')
    out.append(text(45, y + 27, 'Summary', 6.5, IOS_GRAY, 500, anchor='middle'))
    # Sharing: two people
    out.append(f'<circle cx="83" cy="{cy - 2.5}" r="2.2" fill="{IOS_GRAY}"/><circle cx="88.5" cy="{cy - 2}" r="1.9" fill="{IOS_GRAY}"/>'
               f'<path d="M79 {cy + 4.5} a4 3.6 0 0 1 8 0 Z M85.3 {cy + 4.5} a3.3 3.2 0 0 1 6.6 0 Z" fill="{IOS_GRAY}"/>')
    out.append(text(85, y + 27, 'Sharing', 6.5, IOS_GRAY, 500, anchor='middle'))
    # Browse: grid, selected
    for dx, dy in ((0, 0), (5, 0), (0, 5), (5, 0 + 5)):
        out.append(f'<rect x="{121 + dx}" y="{cy - 5 + dy}" width="4" height="4" rx="1" fill="{IOS_BLUE}"/>')
    out.append(text(125.5, y + 27, 'Browse', 6.5, IOS_BLUE, 600, anchor='middle'))
    return ''.join(out)


def list_card(y, rows, highlight, label_x=38, icons=None, size=10):
    row_h = 25
    out = [f'<rect x="10" y="{y}" width="150" height="{row_h * len(rows)}" rx="10" fill="#FFFFFF"/>']
    for i, label in enumerate(rows):
        ry = y + i * row_h
        if i == highlight:
            out.append(f'<rect x="10" y="{ry}" width="150" height="{row_h}" fill="#E5E5EA"/>')
        if icons:
            out.append(icons[i](24, ry + row_h / 2))
        out.append(text(label_x, ry + 16, label, size, '#000'))
        out.append(chevron(151, ry + row_h / 2))
        if i < len(rows) - 1:
            out.append(f'<line x1="{label_x}" y1="{ry + row_h}" x2="160" y2="{ry + row_h}" stroke="{IOS_SEP}" stroke-width="0.6"/>')
    return ''.join(out)


# Category glyphs for the Browse list (drawn, not Apple artwork)
def _sq(color, inner):
    return lambda cx, cy: f'<rect x="{cx - 7}" y="{cy - 7}" width="14" height="14" rx="3.5" fill="{color}"/>' + inner(cx, cy)

def _heart(cx, cy, fill='#FFFFFF', s=1.0):
    return (f'<path d="M{cx} {cy + 4 * s} C{cx - 5 * s} {cy} {cx - 5.5 * s} {cy - 4 * s} {cx - 2.8 * s} {cy - 5.2 * s} '
            f'C{cx - 1.4 * s} {cy - 5.8 * s} {cx - 0.4 * s} {cy - 4.8 * s} {cx} {cy - 3.6 * s} '
            f'C{cx + 0.4 * s} {cy - 4.8 * s} {cx + 1.4 * s} {cy - 5.8 * s} {cx + 2.8 * s} {cy - 5.2 * s} '
            f'C{cx + 5.5 * s} {cy - 4 * s} {cx + 5 * s} {cy} {cx} {cy + 4 * s} Z" fill="{fill}"/>')

CATEGORY_ICONS = [
    _sq('#FF6A2B', lambda cx, cy: f'<path d="M{cx} {cy - 4.5} C{cx + 4} {cy - 1} {cx + 3.5} {cy + 4.5} {cx} {cy + 4.5} C{cx - 3.5} {cy + 4.5} {cx - 3.5} {cy} {cx - 1} {cy - 1.5} C{cx - 1} {cy} {cx} {cy + 1} {cx} {cy - 4.5} Z" fill="#FFFFFF"/>'),
    _sq('#A65DD8', lambda cx, cy: f'<circle cx="{cx}" cy="{cy - 3}" r="1.6" fill="#FFFFFF"/><path d="M{cx - 2.2} {cy + 4.5} V{cy - 0.5} H{cx + 2.2} V{cy + 4.5}" fill="#FFFFFF"/>'),
    _sq('#FF5E7E', lambda cx, cy: ''.join(f'<circle cx="{cx + 3 * math.cos(a):.1f}" cy="{cy + 3 * math.sin(a):.1f}" r="1.3" fill="#FFFFFF"/>' for a in [k * math.pi / 3 for k in range(6)])),
    _sq('#3A9BEF', lambda cx, cy: f'<path d="M{cx - 2.5} {cy - 1} a2.8 3 0 1 1 5 1.8 c-1 1 -1.6 1.4 -1.6 2.6 a1.6 1.6 0 0 1 -3 0.4" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linecap="round"/>'),
    _sq('#FF3B30', lambda cx, cy: _heart(cx, cy + 0.6, s=0.95)),
    _sq('#34C3B4', lambda cx, cy: f'<circle cx="{cx}" cy="{cy - 0.5}" r="3.6" fill="none" stroke="#FFFFFF" stroke-width="1.3"/><circle cx="{cx}" cy="{cy - 0.5}" r="1.2" fill="#FFFFFF"/>'),
    _sq('#FF9500', lambda cx, cy: f'<path d="M{cx - 4} {cy + 2} H{cx + 3} M{cx + 1} {cy} L{cx + 3} {cy + 2} L{cx + 1} {cy + 4} M{cx + 4} {cy - 2.5} H{cx - 3} M{cx - 1} {cy - 4.5} L{cx - 3} {cy - 2.5} L{cx - 1} {cy - 0.5}" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>'),
]
HEART_ICON = [lambda cx, cy: _heart(cx, cy + 0.5, ECG_RED, 1.05)] * 7


def screen_browse():
    rows = ['Activity', 'Body Measurements', 'Cycle Tracking', 'Hearing', 'Heart', 'Mental Wellbeing', 'Mobility']
    return (text(16, 62, 'Browse', 21, '#000', 700)
            + text(16, 86, 'Health Categories', 11.5, '#000', 600)
            + list_card(94, rows, 4, icons=CATEGORY_ICONS)
            + tab_bar() + tap(146, 94 + 4 * 25 + 12.5))


def screen_heart():
    rows = ['AFib History', 'Blood Pressure', 'Cardio Fitness', 'Electrocardiograms (ECG)',
            'Heart Rate', 'Cardio Recovery', 'Resting Heart Rate']
    return (back_button('Browse') + text(16, 72, 'Heart', 21, '#000', 700)
            + list_card(84, rows, 3, label_x=34, icons=HEART_ICON, size=9.1)
            + tab_bar() + tap(150, 84 + 3 * 25 + 12.5))


def screen_ecg(uid):
    return (back_button('Electrocardiograms')
            + text(16, 70, 'Sinus Rhythm', 17, '#000', 700)
            + text(16, 84, '72 BPM Average', 9.5, IOS_GRAY)
            + '<rect x="10" y="94" width="150" height="96" rx="10" fill="#FFFFFF"/>'
            + ecg_strip(18, 102, 134, 64, 34, uid)
            + text(18, 181, 'Today, 9:41 AM', 8.5, IOS_GRAY)
            + text(16, 206, 'This ECG does not show signs of', 8.8, '#3C3C43')
            + text(16, 218, 'atrial fibrillation.', 8.8, '#3C3C43')
            + '<rect x="10" y="230" width="150" height="28" rx="10" fill="#E5E5EA"/>'
            + text(19, 248, 'Export a PDF for Your Doctor', 8.9, IOS_BLUE)
            + tab_bar() + tap(150.5, 244))


def screen_share(uid):
    share = (f'<g fill="none" stroke="{IOS_BLUE}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'
             '<path d="M146 39 H143.5 V49 H156.5 V39 H154"/><path d="M150 44 V33 M146.8 36 L150 32.8 L153.2 36"/></g>')
    page = ['<rect x="25" y="59" width="120" height="152" rx="2" fill="#000" fill-opacity="0.08"/>',
            '<rect x="24" y="57" width="120" height="152" rx="2" fill="#FFFFFF"/>',
            '<rect x="31" y="65" width="44" height="4" rx="1.5" fill="#1C1C1E"/>',
            '<rect x="31" y="73" width="70" height="2.6" rx="1.3" fill="#C7C7CC"/>',
            '<rect x="31" y="78.5" width="56" height="2.6" rx="1.3" fill="#C7C7CC"/>']
    for k in range(3):
        page.append(ecg_strip(30, 88 + k * 34, 108, 28, 26, uid, stroke=0.8))
    sheet = ['<rect x="4" y="226" width="162" height="2" fill="#000" fill-opacity="0.04"/>',
             '<path d="M4 244 a16 16 0 0 1 16 -16 H150 a16 16 0 0 1 16 16 V346 H4 Z" fill="#F7F7FA"/>',
             '<rect x="72" y="233" width="26" height="3.5" rx="1.75" fill="#C7C7CC"/>',
             '<rect x="16" y="246" width="18" height="22" rx="2" fill="#FFFFFF" stroke="#D1D1D6" stroke-width="0.6"/>',
             f'<path d="M19 259 h12" stroke="{ECG_RED}" stroke-width="0.8"/>',
             text(40, 255, 'ECG.pdf', 9.5, '#000', 600), text(40, 266, 'PDF Document', 8, IOS_GRAY),
             '<rect x="10" y="278" width="150" height="50" rx="10" fill="#FFFFFF"/>',
             text(20, 296, 'Print', 10, '#000'),
             '<line x1="20" y1="303" x2="160" y2="303" stroke="#E2E2E7" stroke-width="0.6"/>',
             text(20, 321, 'Save to Files', 10, '#000'),
             f'<g fill="none" stroke="#000" stroke-width="1.1" stroke-linejoin="round"><rect x="141" y="289" width="11" height="6" rx="1"/><path d="M143.5 289 V285.5 H149.5 V289 M143.5 293 H149.5 V297 H143.5 Z"/>'
             '<path d="M140.5 313 H145 L146.5 314.5 H152.5 V321.5 H140.5 Z"/></g>']
    return (f'<rect x="4" y="30" width="162" height="316" fill="#E5E5EA"/>'
            + text(16, 45, 'Done', 10.5, IOS_BLUE, 600)
            + share + ''.join(page) + ''.join(sheet) + tap(150, 41))


def phone(content, uid):
    """iPhone with Dynamic Island; content drawn in a 170x350 coordinate space."""
    return (f'<rect x="-1.2" y="70" width="1.6" height="22" rx="0.8" fill="#3A3A3C"/>'
            f'<rect x="-1.2" y="100" width="1.6" height="34" rx="0.8" fill="#3A3A3C"/>'
            f'<rect x="{PHONE_W - 0.4}" y="105" width="1.6" height="44" rx="0.8" fill="#3A3A3C"/>'
            f'<rect width="{PHONE_W}" height="{PHONE_H}" rx="30" fill="#1C1C1E"/>'
            f'<rect x="1.4" y="1.4" width="{PHONE_W - 2.8}" height="{PHONE_H - 2.8}" rx="28.8" fill="none" stroke="#5A5A5E" stroke-width="0.8"/>'
            f'<g clip-path="url(#screen{uid})"><rect x="4" y="4" width="162" height="342" fill="{IOS_BG}"/>'
            f'{content}{status_bar()}'
            f'<rect x="60" y="339" width="50" height="3.5" rx="1.75" fill="#000"/></g>'
            f'<rect x="61" y="11" width="48" height="15" rx="7.5" fill="#000"/>')


def defs(uid):
    return (f'<clipPath id="screen{uid}"><rect x="4" y="4" width="162" height="342" rx="26"/></clipPath>'
            f'<pattern id="grid{uid}" width="5" height="5" patternUnits="userSpaceOnUse">'
            f'<path d="M5 0 V5 H0" fill="none" stroke="#FBE1E5" stroke-width="0.5"/></pattern>')


def screens(i, uid):
    return [screen_browse, screen_heart, lambda: screen_ecg(uid), lambda: screen_share(uid)][i]()


def build(layout, steps=STEPS, screen_fn=screens, title=TITLE, desc=DESC, footer=FOOTER):
    out = []
    d = []
    if layout == 'desktop':
        W, col_w, scale = 1000, 225, 1.0
        positions = [(60 + i * col_w, 0) for i in range(4)]
        title_size, body_size, text_w = 17, 15, 200
    else:
        W, col_w, scale = 500, 230, 1.18
        positions = [(30 + (i % 2) * 240, (i // 2) * 625) for i in range(4)]
        title_size, body_size, text_w = 19, 17, 215
    y_bottom = 0
    for i, (x0, y0) in enumerate(positions):
        uid = i
        d.append(defs(uid))
        px = x0 + (col_w - 25 - PHONE_W * scale) / 2 if layout == 'desktop' else x0 + (210 - PHONE_W * scale) / 2
        out.append(text(x0, y0 + 48, str(i + 1), 44, ACCENT, family=SERIF, extra=' font-style="italic" fill-opacity="0.55"'))
        out.append(f'<g transform="translate({px:.1f},{y0 + 62}) scale({scale})">{phone(screen_fn(i, uid), uid)}</g>')
        ty = y0 + 62 + PHONE_H * scale + 40
        for j, line in enumerate(wrap(steps[i][0], title_size, text_w, 0.5)):
            out.append(text(x0, ty, line, title_size, INK, 700, SERIF))
            ty += title_size * 1.3
        ty += 4
        for line in wrap(steps[i][1], body_size, text_w, 0.47):
            out.append(text(x0, ty, line, body_size, MUTED, family=SERIF))
            ty += body_size * 1.4
        y_bottom = max(y_bottom, ty)
        if layout == 'desktop' and i < 3:
            ax, ay = px + PHONE_W + 14, y0 + 62 + PHONE_H / 2
            out.append(f'<path d="M{ax:.1f} {ay} H{ax + 26:.1f} M{ax + 20:.1f} {ay - 6} L{ax + 26:.1f} {ay} L{ax + 20:.1f} {ay + 6}" fill="none" stroke="{MUTED}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>')
    margin = 30 if layout == 'desktop' else 30
    fy = y_bottom + 12
    out.append(f'<line x1="{margin if layout != "desktop" else 60}" y1="{fy}" x2="{W - (60 if layout == "desktop" else 30)}" y2="{fy}" stroke="#E1E4E8" stroke-width="1"/>')
    fy += 24
    foot_size = 12.5 if layout == 'desktop' else 14
    lines = footer if layout == 'desktop' else [l for f in footer for l in wrap(f, foot_size, 440, 0.5)]
    for line in lines:
        out.append(text(60 if layout == 'desktop' else 30, fy, line, foot_size, MUTED))
        fy += foot_size * 1.45
    H = math.ceil(fy + 6)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t d">\n'
            f'  <title id="t">{esc(title)}</title>\n  <desc id="d">{esc(desc)}</desc>\n'
            f'  <defs>{"".join(d)}</defs>\n  <rect width="{W}" height="{H}" fill="#FFFFFF"/>\n  '
            + '\n  '.join(out) + '\n</svg>\n')


if __name__ == '__main__':
    for layout, name in (('desktop', 'how-to-share-watch-ecg.svg'), ('mobile', 'how-to-share-watch-ecg-mobile.svg')):
        path = os.path.normpath(os.path.join(OUT_DIR, name))
        with open(path, 'w') as f:
            f.write(build(layout))
        print('Wrote', path)
