#!/usr/bin/env python3
"""Generates assets/images/how-to-share-kardia-ekg.svg and -mobile.svg.

Four phone screens showing how to export a Kardia (AliveCor) EKG as a PDF:
History > View EKG History > tap ⋯ on a recording > Download PDF > skip the
password > tap the share icon at the bottom left. Steps follow AliveCor's
support article "How do I download my EKG PDF from the Kardia app to share
with my doctor?" Screens are simplified drawings, not AliveCor's interface;
EKG tracings are synthetic. Reuses the drawing helpers in share-watch-ecg.py.

Usage: python3 scripts/figures/share-kardia-ekg.py
"""
import importlib.util
import os

_spec = importlib.util.spec_from_file_location('share_watch_ecg', os.path.join(os.path.dirname(__file__), 'share-watch-ecg.py'))
F = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(F)

TINT = '#2563C9'   # generic app blue, not AliveCor branding

STEPS = [
    ('Open History', 'Open the Kardia app and tap the History tab at the bottom of the screen.'),
    ('View your EKGs', 'Tap View EKG History to see every recording you have saved.'),
    ('Download the PDF', 'Tap the three dots next to the recording you want, then tap Download PDF.'),
    ('Share it', 'Skip the password step. Tap the Share icon at the bottom left to print, send, or save it to Files.'),
]
FOOTER = [
    "Simplified illustrations with synthetic EKG tracings, not AliveCor's actual screens.",
    'Menu names can change with app updates. Kardia and AliveCor are trademarks of AliveCor, Inc.',
    '© Matt Segar, MD · Free to share with attribution · segar.me',
]
TITLE = 'How to export your Kardia EKG as a PDF'
DESC = ('Four phone screens. One: open the Kardia app and tap the History tab. '
        'Two: tap View EKG History. '
        'Three: tap the three dots next to a recording, then tap Download PDF. '
        'Four: skip the password step and tap the Share icon at the bottom left to print, send, or save the PDF.')

text, tap, ecg_strip, chevron = F.text, F.tap, F.ecg_strip, F.chevron


def bottom_bar(active):
    """App tab bar: Home, Record, History."""
    out = ['<rect x="4" y="296" width="162" height="50" fill="#FFFFFF"/>',
           '<line x1="4" y1="296" x2="166" y2="296" stroke="#E2E2E7" stroke-width="0.6"/>']
    tabs = [('Home', 40), ('Record', 85), ('History', 130)]
    for name, cx in tabs:
        c = TINT if name == active else F.IOS_GRAY
        cy = 309
        if name == 'Home':
            out.append(f'<path d="M{cx - 6} {cy} L{cx} {cy - 5.5} L{cx + 6} {cy} M{cx - 4.5} {cy - 1} V{cy + 5} H{cx + 4.5} V{cy - 1}" fill="none" stroke="{c}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>')
        elif name == 'Record':
            out.append(f'<path d="M{cx - 7} {cy} H{cx - 3} L{cx - 1.5} {cy - 5} L{cx + 1} {cy + 5} L{cx + 2.5} {cy} H{cx + 7}" fill="none" stroke="{c}" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>')
        else:
            out.append(f'<circle cx="{cx}" cy="{cy}" r="5.5" fill="none" stroke="{c}" stroke-width="1.3"/>'
                       f'<path d="M{cx} {cy - 3} V{cy} L{cx + 2.3} {cy + 1.5}" fill="none" stroke="{c}" stroke-width="1.3" stroke-linecap="round"/>')
        out.append(text(cx, 325, name, 6.8, c, 600 if name == active else 500, anchor='middle'))
    return ''.join(out)


def screen_home(uid):
    return (text(16, 62, 'Home', 21, '#000', 700)
            + '<rect x="10" y="74" width="150" height="130" rx="12" fill="#FFFFFF"/>'
            + text(85, 96, 'Ready to record', 10.5, '#000', 600, anchor='middle')
            + f'<circle cx="85" cy="140" r="27" fill="{TINT}"/>'
            + '<path d="M72 140 H78 L80.5 132 L84 148 L87 140 H98" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>'
            + text(85, 188, 'Record EKG', 10, TINT, 600, anchor='middle')
            + '<rect x="10" y="214" width="150" height="56" rx="12" fill="#FFFFFF"/>'
            + text(20, 233, 'Last EKG', 8.5, F.IOS_GRAY)
            + text(20, 248, 'Normal Sinus Rhythm', 10, '#000', 600)
            + text(20, 261, 'Today, 9:41 AM', 8.5, F.IOS_GRAY)
            + bottom_bar('Home') + tap(130, 309))


def screen_history(uid):
    return (text(16, 62, 'History', 21, '#000', 700)
            + '<rect x="10" y="74" width="150" height="74" rx="12" fill="#FFFFFF"/>'
            + text(20, 93, 'EKGs recorded', 8.5, F.IOS_GRAY)
            + text(20, 116, '24', 22, '#000', 700)
            + text(52, 116, 'in the last 30 days', 9, F.IOS_GRAY)
            + text(20, 136, 'Most recent: Today, 9:41 AM', 8.5, F.IOS_GRAY)
            + f'<rect x="10" y="160" width="150" height="34" rx="17" fill="{TINT}"/>'
            + text(85, 181, 'View EKG History', 10.5, '#FFFFFF', 600, anchor='middle')
            + '<rect x="10" y="206" width="150" height="56" rx="12" fill="#FFFFFF"/>'
            + text(20, 225, 'Heart rate, 30 days', 8.5, F.IOS_GRAY)
            + ''.join(f'<rect x="{22 + k * 9}" y="{254 - h}" width="5" height="{h}" rx="1.5" fill="{TINT}" fill-opacity="0.35"/>'
                      for k, h in enumerate((14, 18, 12, 20, 16, 22, 15, 19, 13, 17, 21, 16, 18, 14, 20)))
            + bottom_bar('History') + tap(147, 177))


def ekg_row(y, label, when, uid, highlight=False):
    out = [f'<rect x="10" y="{y}" width="150" height="50" fill="{"#E5E5EA" if highlight else "#FFFFFF"}"/>',
           text(18, y + 15, label, 9.6, '#000', 600),
           text(18, y + 27, when, 8, F.IOS_GRAY),
           ecg_strip(18, y + 32, 112, 13, 18, uid, stroke=0.7)]
    for k in range(3):   # ⋯ menu button
        out.append(f'<circle cx="{143 + k * 4.5}" cy="{y + 18}" r="1.3" fill="#3C3C43"/>')
    return ''.join(out)


def screen_list(uid):
    rows = [('Normal Sinus Rhythm', 'Today, 9:41 AM · 72 BPM'),
            ('Possible Atrial Fibrillation', 'Yesterday, 7:12 PM · 104 BPM'),
            ('Normal Sinus Rhythm', 'Oct 14, 8:05 AM · 68 BPM'),
            ('Normal Sinus Rhythm', 'Oct 12, 9:30 PM · 75 BPM')]
    out = [F.back_button('History').replace(F.IOS_BLUE, TINT), text(16, 72, 'EKG History', 19, '#000', 700),
           '<rect x="10" y="84" width="150" height="200" rx="12" fill="#FFFFFF"/>',
           '<clipPath id="list{0}"><rect x="10" y="84" width="150" height="200" rx="12"/></clipPath>'.format(uid),
           f'<g clip-path="url(#list{uid})">']
    for i, (label, when) in enumerate(rows):
        out.append(ekg_row(84 + i * 50, label, when, uid, highlight=(i == 1)))
        if i < 3:
            out.append(f'<line x1="18" y1="{134 + i * 50}" x2="160" y2="{134 + i * 50}" stroke="#E2E2E7" stroke-width="0.6"/>')
    out.append('</g>')
    # menu opened from the second recording's ⋯ button
    out.append('<rect x="65" y="160" width="95" height="58" rx="10" fill="#000" fill-opacity="0.08"/>'
               '<rect x="64" y="158" width="95" height="58" rx="10" fill="#FFFFFF" stroke="#D1D1D6" stroke-width="0.6"/>'
               + text(73, 176, 'Add Note', 9.5, '#000')
               + '<line x1="64" y1="187" x2="159" y2="187" stroke="#E2E2E7" stroke-width="0.6"/>'
               + text(73, 205, 'Download PDF', 9.5, TINT, 600))
    return ''.join(out) + bottom_bar('History') + tap(152, 201)


def screen_pdf(uid):
    page = ['<rect x="23" y="62" width="124" height="196" rx="2" fill="#000" fill-opacity="0.08"/>',
            '<rect x="22" y="60" width="124" height="196" rx="2" fill="#FFFFFF"/>',
            '<rect x="30" y="68" width="48" height="4" rx="1.5" fill="#1C1C1E"/>',
            '<rect x="30" y="76" width="74" height="2.6" rx="1.3" fill="#C7C7CC"/>',
            '<rect x="30" y="81.5" width="58" height="2.6" rx="1.3" fill="#C7C7CC"/>']
    for k in range(6):   # six-lead report
        page.append(ecg_strip(28, 90 + k * 26, 112, 22, 24, uid, stroke=0.7))
    toolbar = ['<rect x="4" y="296" width="162" height="50" fill="#F7F7FA"/>',
               '<line x1="4" y1="296" x2="166" y2="296" stroke="#E2E2E7" stroke-width="0.6"/>',
               f'<g fill="none" stroke="{TINT}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">'
               '<path d="M21 309 H18.5 V319 H31.5 V309 H29"/><path d="M25 314 V303 M21.8 306 L25 302.8 L28.2 306"/></g>']
    return (f'<rect x="4" y="30" width="162" height="316" fill="#E5E5EA"/>'
            + text(16, 45, 'Done', 10.5, TINT, 600)
            + text(85, 45, 'EKG Report', 10.5, '#000', 600, anchor='middle')
            + ''.join(page)
            + ''.join(toolbar) + tap(25, 311))


def screens(i, uid):
    return [screen_home, screen_history, screen_list, screen_pdf][i](uid)


if __name__ == '__main__':
    for layout, name in (('desktop', 'how-to-share-kardia-ekg.svg'), ('mobile', 'how-to-share-kardia-ekg-mobile.svg')):
        path = os.path.normpath(os.path.join(F.OUT_DIR, name))
        with open(path, 'w') as f:
            f.write(F.build(layout, STEPS, screens, TITLE, DESC, FOOTER))
        print('Wrote', path)
