---
title: Reconstructing a Mixbook Movie with ffmpeg
description: How I traced Mixbook's animated Movie feature to its data API, found that the browser builds the video instead of storing it, and rebuilt a downloadable MP4 from the raw photos and music with crossfades, Ken Burns motion, and the original title text
date: 2026-05-23
img: ../assets/images/mixbook-movie-reconstruction.png
categories: [Reverse Engineering, ffmpeg, Video, Lottie, Developer Tools]
---

# Reconstructing a Mixbook Movie with ffmpeg

[Mixbook](https://www.mixbook.com) emailed me to say my animated project was ready: a short movie built from my photos and set to music. I could watch it in the browser or order a printed copy. I could not download it. There is no download button, and Mixbook's help docs say one does not exist.

I wanted the file. Getting it became a small reverse-engineering exercise, because the reason there's no download button is more interesting than a missing feature. There is no video file to download. Your browser builds the movie frame by frame every time you press play.

One caveat up front: this was my own project, reached through my own shareable view link. Everything below is about getting your own memories out of a service that offers no export. None of it touches anyone else's content.

## The First Dead End: No File in the Page

The obvious move is to open the project page and look for a video URL in the HTML. That fails for two reasons.

First, the editor URL is private. Fetching it without a logged-in session returns `403 Forbidden`:

```
https://www.mixbook.com/memories/edit?pid=123456   →  403
```

Second, the public share link contains no video either. The shareable preview URL carries a **view key** (`vk`), the access token for read-only viewing:

```
https://www.mixbook.com/memories/preview?pid=123456&vk=YOUR_VIEW_KEY
```

That page loads fine (HTTP 200, ~110 KB), but grepping the raw HTML for `.mp4`, `.m3u8`, `videoUrl`, or anything media-shaped returns nothing. It's a JavaScript application shell. The browser builds the video after the page boots and makes its API calls.

So I left the HTML and went after the app's code.

## Following the View Key Into a Second App

The preview page's embedded config listed a handful of service hosts. One stood out:

```json
{ "baseUrl": "https://memories.mixbook.com" }
```

`memories.mixbook.com` is a separate **Next.js** application, Mixbook's "Memory Explorer." Requesting the same path against it, instead of `www`, returns a real route:

```
https://memories.mixbook.com/memories/preview?pid=123456&vk=...   →  200
```

The response is a React Server Components payload. It names the component that renders the page:

```
6:I[7305, [ ... "page-ce08bafe9614bffc.js" ], "AnimatedProject"]
```

An `AnimatedProject` component, hydrated client-side, fetches its own data. Any video URL would sit in whatever that component requests, so I downloaded the JavaScript bundles it references and read them.

## Reading the App's Own Code to Find the API

Minified Next.js chunks are painful to read, so I didn't read them. I grepped them for the shapes I wanted. The string `animatedProject` appeared 22 times in one chunk. Pulling the surrounding context gave me the data-fetching code, a Redux Toolkit async thunk:

```js
let h = (0, n.hg)("animatedProject/fetchAnimatedProject", async (t, e) => {
  let { projectId: i, viewKey: n } = t,
      a = o().auth.token,
      u = "".concat(s.l.apiBaseUrl, "/api/v2/my/animated_projects/").concat(i);
  return n && (u += "?".concat(new URLSearchParams({ vk: n }))),
    (await r.L.get(u, { token: a })).data.data;
});
```

The endpoint:

```
{apiBaseUrl}/api/v2/my/animated_projects/{projectId}?vk={viewKey}
```

The last unknown was `apiBaseUrl`. The same bundle carried an environment config block:

```js
production: { apiBaseUrl: "https://www.mixbook.com", ... }
```

Putting it together and calling it with my view key:

```bash
curl -s "https://www.mixbook.com/api/v2/my/animated_projects/123456?vk=YOUR_VIEW_KEY"
```

`HTTP 200`, and **174 KB of JSON** describing how to build the movie.

## The Real Shape of a "Movie"

This is where I understood the problem differently. I expected the API to return a link to a rendered file. It returned the movie's definition instead:

```
data
├── name: "Our Trip to the Coast"
├── durationInFrames: 2598.96        # ≈ 108.3 s at 24fps
├── musicTrack
│   ├── name: "Acoustic Breeze"
│   └── audioFile: "https://mixbook-user-content.s3.amazonaws.com/..."
├── segments:    [ 43 items ]
└── transitions: [ 42 items ]
```

Each of the 43 segments holds a full **Lottie animation**, a 1920×1080, 24fps vector animation with my photo embedded as an asset:

```json
{
  "position": 0,
  "durationInFrames": 170,
  "lottieAnimation": {
    "w": 1920, "h": 1080, "fr": 24,
    "assets": [
      { "id": "position_0_photo_...",
        "p": "https://media.mixbook.com/<bucket>/photos/<year>/<photo-id>.png",
        "meta": { "type": "photo" } },
      { "id": "position_0_comp_0", "nm": "COMP_00_INTRO", "layers": [ ... ] }
    ]
  }
}
```

That answers the download question. A Mixbook Movie is 43 Lottie animations, 42 transitions, and a music track, composited in your browser each time it plays. A finished MP4 never exists on their servers, so you have nothing to download and something to render.

The architecture makes sense for them: cheap to store, editable, and resolution-independent. It also leaves two paths to a file. I could screen-record the playback, or reconstruct the movie myself from its raw materials. I took the second one.

## Pulling the Raw Materials

The JSON has everything. A short script walks the segments, collects every photo asset URL in play order, and grabs the music track. All of them sit on public S3/CDN URLs:

```python
photos = []
for s in data["segments"]:
    for a in s["lottieAnimation"].get("assets", []):
        if a.get("meta", {}).get("type") == "photo" and a["p"].startswith("http"):
            photos.append(a["p"])
# 42 unique photos, in order, + one music file
```

Forty-two photos, one music track ("Acoustic Breeze"), and 108 seconds of runtime. I had the ingredients.

## Reconstruction v1: A Length-Matched Crossfade Slideshow

The first goal was modest: a 1080p slideshow, photos in order, crossfaded, set to the music, the same length as the original (108.3 s) so the audio lined up.

The only arithmetic is the per-photo duration once you account for overlapping crossfades. If each photo stays on screen for `D` seconds and consecutive photos overlap by a transition of length `T`, then `N` photos run for `N·D − (N−1)·T`. Solve for `D` given a target total:

```python
N, T, TOTAL = 42, 0.8, 108.3
D = (TOTAL + (N - 1) * T) / N        # ≈ 3.36 s per photo
step = D - T                          # ≈ 2.56 s net advance per photo
```

In ffmpeg, each photo becomes a looped clip of length `D`, normalized to 1080p with letterbox padding. I join the clips with a chain of `xfade` filters. The detail that matters is the xfade offset: the *n*-th crossfade starts at `n · step`, because each transition eats `T` seconds of overlap.

```python
# normalize every photo to a 1920x1080, 30fps clip
for i in range(N):
    fc.append(f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=decrease,"
              f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v{i}]")

# chain the crossfades
prev = "v0"
for i in range(1, N):
    off = i * step
    label = f"x{i}" if i < N - 1 else "vout"
    fc.append(f"[{prev}][v{i}]xfade=transition=fade:duration={T}:offset={off:.4f}[{label}]")
    prev = label

# music, trimmed to length with a 2s fade-out
fc.append(f"[{N}:a]atrim=0:{TOTAL},asetpts=PTS-STARTPTS,afade=t=out:st={TOTAL-2}:d=2[aout]")
```

The output ran 108.3 s at 1920×1080, photos and pacing correct, music fading out on cue. It worked as a baseline. Static photos with dissolves felt flat next to the original, which had motion, so I kept going.

## Reconstruction v2: Ken Burns Motion

The Ken Burns effect, a slow zoom and pan across a still image, gives a slideshow life. ffmpeg's `zoompan` filter does it. It also has a gotcha that produces a stutter, and the fix is worth knowing.

`zoompan` outputs `d` frames for every input frame it consumes. Feed it a looped still and it grabs a fresh (identical) frame now and then, restarting the zoom each time, so a smooth 3-second push-in turns into a jittery sawtooth. The fix is to force it to read one frame, with a `select` filter, then let it generate the whole clip from that single frame:

```
select='eq(n\,0)',
zoompan=z='...':x='...':y='...':d=101:s=1920x1080:fps=30
```

With `d` set to the clip's full frame count (≈101 frames for a 3.36 s clip at 30fps), one input frame becomes one smooth move. I also upscale each photo to 4K before the zoom so cropping into it stays sharp.

Expressing zoom and pan as a function of the output frame counter `on` keeps the motion smooth across the clip. I wrote four presets and cycled them across the 42 photos so the result varies:

```python
zin  = f"1.0+{(Z-1)/DF:.6f}*on"      # zoom in over the clip
zout = f"{Z}-{(Z-1)/DF:.6f}*on"      # zoom out over the clip
presets = [
    (f"min({Z},{zin})",  cx, cy),                       # zoom in,  centered
    (f"max(1.0,{zout})", cx, cy),                        # zoom out, centered
    (f"min({Z},{zin})",  f"(iw-iw/zoom)*on/{DF}", cy),  # zoom in,  pan right
    (f"min({Z},{zin})",  cx, f"(ih-ih/zoom)*on/{DF}"),  # zoom in,  pan down
]
```

Each photo now drifts under a gentle 1.0→1.15 zoom. This version sold it. It read as a movie rather than a slideshow.

## Reconstruction v3: Putting the Text Back

The original opens with a title card (the project name) and ends on an "Experience Your Memories" sign-off. I wanted both back. Finding them was easy; rendering them was not.

### Finding the text in the Lottie layers

Lottie stores text as a layer of type `ty: 5`, with the string at `t.d.k[*].s.t`. I walked the JSON recursively and pulled out three:

```
"Our Trip to the\rCoast"        (intro title)
"Our Trip to the\rCoast"        (a duplicate "shadow" layer behind it)
"Experience Your Memories"      (the outro card)
```

Two things fell out of this. The intro title is my project name, injected by the template into a placeholder layer whose internal name was still the template default, "My Summer Family Travels, 2024." The top-level `isTextEnabled: false` flag controls optional per-photo captions, so no other text appears.

Mapping the text-bearing segments to the timeline confirmed the structure: segment 0 shows the title over the first photo, and the last segment is a photo-less card reading "Experience Your Memories." An outro, placed at the end.

### The drawtext dead end

The natural tool for burning text into video is ffmpeg's `drawtext` filter. Mine didn't have it:

```
[AVFilterGraph] No such filter: 'drawtext'
```

The Homebrew ffmpeg bottle was built without libfreetype, so `drawtext` isn't compiled in. You can confirm it:

```bash
ffmpeg -hide_banner -version | grep -o enable-libfreetype   # → (nothing)
```

I could have rebuilt ffmpeg with freetype. There was a faster, more portable route.

### Rendering text to PNGs and compositing them

If ffmpeg can't draw text, draw it elsewhere. I rendered each card to a transparent PNG with Python's Pillow, which gave me full control over the font and drop shadow, then composited the PNGs over the video with the `overlay` filter. `overlay` needs no freetype:

```python
def card(lines, path, sizes, gap=104):
    img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    y0 = 1080 // 2 - gap * (len(lines) - 1) // 2
    for i, (txt, f) in enumerate(zip(lines, fonts)):
        cy = y0 + i * gap
        d.text((964, cy + 4), txt, font=f, fill=(0, 0, 0, 150), anchor="mm")    # shadow
        d.text((960, cy),     txt, font=f, fill=(255, 255, 255), anchor="mm")   # text
    img.save(path)
```

To fade them in and out, I looped each PNG as a video input and ran ffmpeg's `fade` filter on the alpha channel (`alpha=1`), then overlaid with a time window:

```
[1:v]fade=t=in:st=0.3:d=0.5:alpha=1,fade=t=out:st=2.0:d=0.5:alpha=1[ti];
[0:v][ti]overlay=0:0:enable='between(t,0.2,2.6)'[v1];
[v1][ou]overlay=0:0:enable='between(t,105.3,108.3)'[vout]
```

Proxima Nova (Mixbook's font) isn't installed locally, so I used Arial Bold and tidied the title's awkward auto-wrap (a line break landing mid-phrase) into two clean lines. It isn't pixel-identical, and it doesn't need to be.

## Reconstruction v4: Tightening the Title Timing

The first text pass left the title up for five seconds, so it bled across the first two photos. The fix was to match its timing to the slideshow's pacing. Photos advance every `step ≈ 2.56 s`, so the title has to fade out before 2.56 s, clearing as the next photo crossfades in:

```python
# title: fade in at 0.3s, gone by ~2.5s, before photo 2 arrives
"[1:v]fade=t=in:st=0.3:d=0.5:alpha=1,fade=t=out:st=2.0:d=0.5:alpha=1[ti]"
```

I shrank the font a little. The title now sits on the first photo alone, the way an intro card should.

## What You Can and Can't Reconstruct

The reconstruction matches the original on some axes and falls short on others.

| Element | Reconstructed? |
| --- | --- |
| Photos, order, timing | ✅ Faithful (straight from the API) |
| Music + end fade | ✅ Faithful (original audio file) |
| Crossfades | ✅ |
| Ken Burns motion | ✅ Tasteful approximation, not the exact keyframes |
| Title + outro text | ✅ Same words; substitute font, simple fade |
| Mixbook's exact Lottie motion / transitions | ❌ Can't be exported |

For a frame-perfect copy, with the real Lottie easing and exact typography, the only route is a screen recording of the playback. Short of that, this gives you a good MP4 that's yours to keep.

## Conclusion

A few lessons here apply well beyond Mixbook:

- **When the page has no file, read the app.** Grepping the minified client bundles for one feature word, `animatedProject`, led to the data API and its auth parameter.
- **"No download" often means "rendered on demand."** This movie is composited from a JSON definition, which is what lets you rebuild it from that same definition.
- **Treat the data API as the interface.** Once I had `GET /api/v2/my/animated_projects/{id}?vk=...`, the photos, the music, and the title text inside the Lottie layers all came with it.
- **Know `zoompan`'s one-frame trick.** `select='eq(n\,0)'`, plus motion written in terms of the output frame `on`, turns a stuttering zoom into a smooth one.
- **Route around missing ffmpeg filters.** With no `drawtext`, I rendered text to transparent PNGs in Pillow and overlaid them, putting the fades on the alpha channel.
- **Tie overlay timing to your pacing constants.** The title's fade-out uses the same `step` value that sets the slideshow's pace, so it clears before the next photo.

The whole thing came together in an afternoon. I have a 1080p movie, with motion, music, and title, sitting in a folder I control. The feature Mixbook left out was one I could build myself.

**Practical note:** this works on your own projects, through your own share link. The `vk` view key makes the data API readable; it's the same token Mixbook puts in the link you'd send to family. Treat someone else's key the way you'd treat any private link.
