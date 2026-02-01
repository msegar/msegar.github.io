---
title: How I Boosted My Next.js Landing Page from 76 to 96 on Lighthouse
description: A 50KB animation library was blocking my landing page render. Here's how I replaced it with CSS and gained 20 Lighthouse points in the process.
date: 2026-02-01
img: ../assets/images/nextjs_optimization.png
categories: [Next.js, Performance, Accessibility, Web Vitals]
---

ManuscriptMind's landing page felt fast. Animations were smooth, the layout was responsive, and users didn't complain. But when I ran Lighthouse, the performance score came back at 76. Not terrible, but not great either.

I care about performance. A slow landing page means lost users, worse SEO rankings, and ultimately fewer people discovering the product. So I dug in to figure out what was holding things back.

What I found surprised me: the animations that made the page feel polished were the same ones making it slow.

## The Lighthouse Report

Lighthouse gave me a performance score of 76 and an accessibility score of 80. The performance issues were clear:

- High document request latency
- Render-blocking JavaScript
- Long JavaScript execution time
- Excessive main-thread work

The accessibility issues were more varied:

- Buttons without accessible names
- Low contrast text colors
- Skipped heading levels
- Small touch targets
- Links that only used color for distinction

Both needed fixing, but performance was the bigger problem. A slow page hurts everyone. Accessibility issues hurt specific users badly.

## Finding the Performance Bottleneck

I started by looking at the network waterfall in Chrome DevTools. The landing page had scroll-triggered fade-in animations on four components:

- FAQ accordion animations
- Feature section reveals
- Sample review fade-ins
- Social proof staggered animations

All of them used **Framer Motion**.

Framer Motion is a great library. The API is clean, the animations are buttery smooth, and it handles complex gesture interactions beautifully. But it's also ~50-60KB of JavaScript that has to load, parse, and execute before the page becomes interactive.

That's 50-60KB on the critical path. For a landing page where first impressions matter, that's expensive.

## The Trade-off I Didn't Mean to Make

When I originally built these animations, I chose Framer Motion because it was **easy**. The code looked like this:

```tsx
<motion.div
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  {content}
</motion.div>
```

Three props, done. The animation worked perfectly.

But I didn't think about what that convenience cost. Every component that imported `motion` pulled in the entire Framer Motion runtime. Even though I was only using simple fade-ins, I was shipping interpolation engines, spring physics solvers, and gesture recognizers.

For the dashboard where users are already logged in and engaged, that trade-off might be fine. For the landing page where I have three seconds to make an impression, it wasn't.

## The Fix: CSS Animations + Intersection Observer

The solution was to replace Framer Motion with native browser APIs: CSS transitions and Intersection Observer.

### Step 1: Build a Lightweight Hook

I created `useAnimateInView`, a 30-line React hook that watches when an element enters the viewport:

```typescript
export function useAnimateInView<T extends HTMLElement = HTMLDivElement>(
  options: UseAnimateInViewOptions = {}
) {
  const { threshold = 0.1, rootMargin = "-50px", once = true } = options;
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) observer.unobserve(element);
        } else if (!once) {
          setIsInView(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isInView };
}
```

Intersection Observer is a native browser API. No library needed. It triggers a callback when an element crosses a viewport threshold, which is exactly what scroll-triggered animations need.

### Step 2: Add CSS Animation Classes

In `globals.css`, I defined the animation states:

```css
.animate-in-view {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.5s ease-out, transform 0.5s ease-out;
}

.animate-in-view.in-view {
  opacity: 1;
  transform: translateY(0);
}

/* Staggered delays for sequential reveals */
.animate-delay-1 { transition-delay: 0.1s; }
.animate-delay-2 { transition-delay: 0.2s; }
.animate-delay-3 { transition-delay: 0.3s; }
```

CSS transitions are handled by the browser's compositor thread. They don't block the main JavaScript thread, and they work even before JavaScript finishes loading.

### Step 3: Refactor the Components

The component code changed from this:

```tsx
<motion.div
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5 }}
>
  {content}
</motion.div>
```

To this:

```tsx
const { ref, isInView } = useAnimateInView();

<div
  ref={ref}
  className={`animate-in-view ${isInView ? 'in-view' : ''}`}
>
  {content}
</div>
```

Same visual result. No external library. 50KB lighter.

### The Accordion Problem

The FAQ accordion was trickier. Animating `height: auto` in CSS is notoriously difficult because you can't transition to an unknown value. Framer Motion handled this elegantly by measuring the content and interpolating the height.

I solved it with the **CSS Grid trick**:

```css
.accordion-content {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s ease-out;
}

.accordion-content.open {
  grid-template-rows: 1fr;
}

.accordion-content > div {
  overflow: hidden;
}
```

CSS Grid's `fr` unit represents a fraction of available space. Transitioning from `0fr` to `1fr` smoothly animates from collapsed to the content's natural height. No JavaScript measurement required.

## The Results

After removing Framer Motion from the landing page:

- **Performance score: 76 → 96**
- **50-60KB less JavaScript** shipped to users
- **Animations work before JavaScript loads** (better perceived performance)
- **Reduced main-thread work** during page load

The animations look identical. Users can't tell the difference. But the page loads faster, scores better on Lighthouse, and ranks higher in search engines.

## Fixing Accessibility (The 80 → 92 Jump)

With performance handled, I turned to accessibility. Lighthouse flagged six issues:

### 1. Redundant Alt Text

The logo had `alt="ManuscriptMind"` with adjacent text that also said "ManuscriptMind". Screen readers would announce the name twice.

**Fix:** Changed to `alt=""` since the text provides the accessible name.

### 2. Links That Rely on Color

Navigation links only changed color on hover. Users with color blindness or low contrast displays couldn't distinguish them.

**Fix:** Added underlines on hover and focus:

```tsx
className="text-slate-600 hover:text-slate-900 hover:underline focus:underline"
```

### 3. Small Touch Targets

Carousel dots were 8×8px. The Web Content Accessibility Guidelines (WCAG) require a minimum 44×44px touch target for mobile users.

**Fix:** Added padding around the visual dot to create a larger clickable area:

```tsx
<button className="p-3 -m-2">
  <span className="block w-2 h-2 rounded-full ..." />
</button>
```

The dot still looks small, but the interactive area is 44×44px.

### 4. Buttons Without Accessible Names

Carousel dots had no labels. Screen reader users couldn't tell what they did.

**Fix:** Added ARIA attributes:

```tsx
<button
  role="tab"
  aria-selected={idx === selectedIndex}
  aria-label={`Go to ${feature.title}`}
>
  ...
</button>
```

### 5. Skipped Heading Levels

The demo UI mockup used `<h4>`, `<h5>`, `<h6>` inside sections, skipping levels in the document outline. Screen readers use heading hierarchy for navigation.

**Fix:** Changed decorative headings to `<p>` elements since they weren't structural.

### 6. Low Contrast Text

`text-slate-400` has a 3.5:1 contrast ratio. WCAG AA requires 4.5:1 for body text.

**Fix:** Changed to `text-slate-500` (4.6:1 contrast).

After these changes, accessibility went from 80 to 92.

## Why This Matters

Lighthouse scores aren't just vanity metrics. They correlate with real user outcomes:

- **Performance affects conversions.** Amazon found that every 100ms of latency cost them 1% in sales.
- **Accessibility is a legal requirement** in many jurisdictions and morally required everywhere.
- **SEO rankings factor in Core Web Vitals.** Google's algorithm rewards fast, accessible sites.

More importantly, optimizing for Lighthouse forces you to think about the user experience. A blind user navigating with a screen reader deserves the same quality experience as a sighted user with a mouse.

## Key Takeaways

1. **Animation libraries have a cost.** Framer Motion is great for complex interactions, but overkill for simple fade-ins. Use CSS when possible.

2. **Intersection Observer is underused.** It's a native browser API that does exactly what most scroll animation libraries do, with zero bundle size.

3. **The CSS Grid trick solves accordion animations.** Transitioning `grid-template-rows` from `0fr` to `1fr` handles dynamic height without JavaScript.

4. **Accessibility isn't just alt text.** Contrast ratios, touch targets, heading hierarchy, and ARIA labels all matter.

5. **Test with Lighthouse, but verify with real users.** Scores matter, but real people with real disabilities matter more. Run your site through a screen reader occasionally.

6. **Performance is a feature.** Users feel the difference between a 76 and a 96. They might not know why, but they'll choose the faster site.

---

*Optimizing your own Next.js landing page? The biggest wins usually come from removing dependencies, not adding them.*
