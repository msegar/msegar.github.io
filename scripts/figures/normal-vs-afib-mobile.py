#!/usr/bin/env python3
"""Builds the phone version of normal-vs-afib-rhythm.svg (first 4 seconds, larger labels).

Usage: python3 scripts/figures/normal-vs-afib-mobile.py assets/images/normal-vs-afib-rhythm.svg assets/images/normal-vs-afib-rhythm-mobile.svg
"""
import re, sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src).read()
K = 1.35          # font scale for phones
RIGHT = 500       # strip ends at x=500 (first 4 seconds)

s = re.sub(r'font-size="([\d.]+)"', lambda m: f'font-size="{float(m.group(1))*K:.1f}"', s)
s = s.replace('<rect width="880" height="138"', '<rect width="440" height="138"')
s = s.replace('</defs>', '  <clipPath id="strip"><rect width="440" height="138"/></clipPath>\n  </defs>')
s = re.sub(r'(<g transform="translate\(60,\d+\)">\s*<rect[^>]*>\s*)<path ', r'\1<path clip-path="url(#strip)" ', s)
s = s.replace('x2="940"', f'x2="{RIGHT}"')

out = []
for line in s.split('\n'):
    m = re.search(r'<(line|rect|text) x1?="([\d.]+)"', line)
    if m and 'translate' not in line:
        x = float(m.group(2))
        if m.group(1) == 'rect': x += 15
        if x > RIGHT and "normal rhythm's gap" not in line:
            continue
    out.append(line)
s = '\n'.join(out)

s = s.replace('<text x="940" y="662"', f'<text x="{RIGHT}" y="660"')
# annotations: start further left so the larger text fits the shorter strip
s = s.replace('<text x="109.9" y="18"', '<text x="10" y="20"')
s = s.replace('<text x="322.3" y="18"', '<text x="425" y="20"').replace('No P waves, just a wobbly baseline</text>', 'No P waves, just a wobbly baseline</text>'.replace('', ''), 1)
s = re.sub(r'(<text x="425" y="20"[^>]*?)text-anchor="middle"', r'\1text-anchor="end"', s)
# footer on two lines
s = s.replace('<text x="60" y="772">Illustration with synthetic tracings, not patient data. © Matt Segar, MD · Free to share with attribution · segar.me</text>',
              '<text x="60" y="766">Illustration with synthetic tracings, not patient data.</text>\n    <text x="60" y="790">© Matt Segar, MD · Free to share with attribution · segar.me</text>')
s = s.replace('from 0.44 to 1.08 seconds', 'from 0.47 to 1.08 seconds')
s = s.replace('viewBox="0 135 1000 650" width="1000" height="650"', 'viewBox="40 135 480 670" width="480" height="670"')
s = s.replace('<rect y="135" width="1000" height="650"', '<rect x="40" y="135" width="480" height="670"')
open(dst, 'w').write(s)

# --- fit fixes ---
s = open(dst).read()
# section titles: smaller with tighter tracking so the rate fits
s = s.replace('font-size="17.6" font-weight="700" letter-spacing="1.5"', 'font-size="15.5" font-weight="700" letter-spacing="1"')
# annotations: keep above the R peaks (peaks top out near y=29)
s = re.sub(r'<text x="(10|425)" y="20" font-size="[\d.]+"', lambda m: f'<text x="{m.group(1)}" y="21" font-size="16.5"', s)
# dashed-line label moves up to the header row, clear of the bars
s = re.sub(r'<text x="500" y="660" font-size="[\d.]+"([^>]*)>the normal rhythm\'s gap, 0.80 s</text>',
           r'<text x="500" y="641" font-size="14"\1>dashed line = normal gap, 0.80 s</text>', s)
open(dst, 'w').write(s)
s = open(dst).read()
s = re.sub(r'font-size="[\d.]+"( font-style="italic" fill="#6E6A63"[^>]*>Gap between beats)', r'font-size="16"\1', s)
s = s.replace('<text x="500" y="641" font-size="14"', '<text x="500" y="641" font-size="13"')
open(dst, 'w').write(s)
s = open(dst).read()
# empty band at the top for the page's expand button
s = s.replace('viewBox="40 135 480 670" width="480" height="670"', 'viewBox="40 95 480 710" width="480" height="710"')
s = s.replace('<rect x="40" y="135" width="480" height="670"', '<rect x="40" y="95" width="480" height="710"')
open(dst, 'w').write(s)
