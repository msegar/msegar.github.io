---
title: Adding Localization and RTL Support to a Next.js App
description: Notes on adding multiple languages and right-to-left support to a Next.js app, covering logical CSS properties, locale formatting tags, LLM-assisted translation, and two hydration bugs to watch for
date: 2026-05-22
img: ../assets/images/app-localization-rtl.png
categories: [Localization, Next.js, i18n, Tailwind CSS, Developer Tools]
---

# Adding Localization and RTL Support to a Next.js App

I added eight languages and right-to-left (RTL) support to [ManuscriptMind](https://manuscriptmind.com), an AI peer-review tool I build, taking it from English only to German, Portuguese, French, Chinese, Japanese, Arabic, and Spanish. A handful of techniques handled most of the work, and two non-obvious bugs cost more time than they should have. These are my notes on both.

The principles apply to any framework. The concrete examples use Next.js (App Router), [next-intl](https://next-intl.dev), Tailwind CSS, and Radix UI, since that's the stack here.

## Start With One Source of Truth for Your Locales

Before touching a single string, decide where your list of supported locales lives, and make everything derive from it. Your language switcher, your sitemap, your `hreflang` tags, and your routing config should all read from the same array.

In next-intl that looks like this:

```ts
// i18n/routing.ts
export const routing = defineRouting({
  locales: ['en', 'es', 'de', 'pt', 'fr', 'zh', 'ja', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
```

Then the sitemap generates `hreflang` alternates by mapping over `routing.locales` instead of a hardcoded list. Add a language later and the sitemap, the switcher, and the routes all update for free. This one habit prevents the classic bug where you ship a new language but forget to add it to the SEO metadata.

## Use Logical CSS Properties So RTL Is (Almost) Free

Of everything here, this removed the most work.

A lot of directional CSS gets written out of habit: `margin-left`, `padding-right`, `text-align: left`. The problem is that "left" and "right" are physical directions. In an RTL language like Arabic, the layout mirrors, and all of those physical directions are now wrong.

The fix is **logical properties**, which describe position relative to the reading direction instead of the screen. `margin-inline-start` is "the start edge," which is the left in English and the right in Arabic. The browser flips it for you when the document direction changes.

Tailwind ships logical equivalents for almost everything:

| Physical (avoid) | Logical (use) |
| --- | --- |
| `ml-2` / `mr-2` | `ms-2` / `me-2` |
| `pl-4` / `pr-4` | `ps-4` / `pe-4` |
| `left-0` / `right-0` | `start-0` / `end-0` |
| `text-left` / `text-right` | `text-start` / `text-end` |
| `border-l` / `border-r` | `border-s` / `border-e` |

The migration is mostly a find-and-replace. Once it's done, the bulk of your UI mirrors when you flip the document direction, with no per-language stylesheets or conditional class names.

## Flip the Document Direction in One Place

Logical properties only work if the document knows its direction. Set `dir` on the `<html>` element based on the active locale:

```tsx
const RTL_LOCALES = ['ar'];
const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';

return <html lang={locale} dir={dir}>{children}</html>;
```

There is a catch with component libraries. Floating elements like dropdowns, popovers, and tooltips often render in a portal at the bottom of the `<body>`, outside your layout tree. They can miss the `dir` context. Radix solves this with a `DirectionProvider`, so wrap your app once:

```tsx
import { DirectionProvider } from '@radix-ui/react-direction';

<DirectionProvider dir={dir}>{children}</DirectionProvider>
```

Now your portaled menus open and align on the correct side in RTL.

## Flip Directional Icons by Hand

Logical properties handle spacing and alignment, but they do nothing for icons that point somewhere. A "back" arrow, a chevron in a breadcrumb, a caret on an expandable row: these all point left or right on purpose, and in RTL they should point the other way.

Tailwind's `rtl:` variant makes this a one-liner:

```tsx
<ArrowLeft className="h-4 w-4 rtl:rotate-180" />
```

For a caret that also has an open or closed state, combine a mirror with the existing rotation:

```tsx
<CaretRight className="rtl:-scale-x-100 data-[open]:rotate-90" />
```

It's a small detail, but arrows pointing the wrong way make a localized UI feel broken even when the rest is correct.

## Separate the URL Locale From the Formatting Locale

The locale code in your URL and the locale code you hand to `Intl` do not have to be the same string.

I wanted Brazilian Portuguese, but I wanted the URL to stay short and clean as `/pt`, not `/pt-BR`. The trouble is that `Intl` resolves a bare `pt` to generic or European Portuguese, so dates and numbers came out wrong for Brazilian users.

The answer is a tiny mapping layer. Keep the short slug for routing, and widen it to a full [BCP-47](https://en.wikipedia.org/wiki/IETF_language_tag) tag only when you format:

```ts
const FORMATTING_LOCALE: Record<string, string> = { pt: 'pt-BR' };

export function getFormattingLocale(locale: string) {
  return FORMATTING_LOCALE[locale] ?? locale;
}
```

Then use `getFormattingLocale(locale)` anywhere you call `Intl` (dates, numbers, currency), for the `<html lang>` attribute, and for your `hreflang` keys. Your URLs stay tidy, your formatting is correct, and search engines still see the precise regional tag. The same trick works for `en-GB` versus `en-US`, or any case where the route and the format diverge.

## Translate the Boring Parts With an LLM

Once your strings live in JSON message catalogs, a language model is a good fit for translating them. I wrote a small script that reads the English catalog, finds the keys missing from a target language, sends those keys to the model, and merges the result back.

A few rules made the output reliable:

- **Only translate the diff.** Compare against the existing target file and translate keys that are missing or still identical to English. This makes re-runs cheap and keeps human edits intact.
- **Preserve placeholders verbatim.** Tell the model to leave [ICU MessageFormat](https://formatjs.io/docs/core-concepts/icu-syntax/) tokens like `{count, plural, one {# credit} other {# credits}}` and markup tokens like `<link>` exactly as they are. Translate the words around them, never the braces.
- **Give it tone and register.** A one-line instruction such as "use the informal register appropriate to the language" produces more natural copy than a literal translation.
- **Keep product names fixed.** List the terms that should never be translated.

This is not a replacement for a professional review on copy that matters. For UI labels and buttons, it gets you most of the way there quickly. Treat the output as a first draft you can refine.

## Watch Out for Hydration Mismatches

This is where I lost the most time, so it gets its own section. Server-rendered apps render HTML twice: once on the server and once on the client during hydration. If the two renders disagree, React throws a hydration error. Localization introduces two ways to make them disagree.

### Dates and times

If you format a date with the user's locale and timezone, the server (often running in UTC) and the browser (in the user's local timezone) can produce different text for the same instant, which is a guaranteed mismatch. For the case where the content is correct on both sides and only the timezone differs, `suppressHydrationWarning` on that element is the right tool:

```tsx
<span suppressHydrationWarning>{formatDate(createdAt, locale)}</span>
```

Use it only when the timezone is the sole difference. It is the wrong tool for hiding an actual content mismatch.

### The stale message cache that looks like a different bug

This one is worth knowing because the symptom shows up far from the cause.

After translating my message files, the review page filled with hydration errors. The diff was a flood of mismatched IDs on component-library elements (`id`, `aria-controls`, and so on), all with different values. It looked like a bug in the UI library's ID generation.

It was not. The real cause was a single text mismatch high up the tree: my dev server had cached the old version of a message file in memory, while the browser bundle had hot-reloaded the freshly translated strings. So the server rendered the old translation of a button and the client rendered the new one. React hit that text difference, gave up trying to patch the subtree, and re-rendered it on the client from scratch. That re-render regenerated every auto-generated ID below it, which is why the error looked like dozens of unrelated ID mismatches instead of one wrong word.

The lesson: a cascade of mysterious auto-generated ID mismatches after editing translations almost always means the server and client are reading different versions of your message files. The fix was restarting the dev server so it reloaded the catalogs from disk:

```bash
rm -rf .next && npm run dev
```

If you edit message JSON and suddenly see hydration noise, restart before you debug anything else. It will save you the hour it cost me.

## Conclusion

The translation step is tedious, but the structural work is smaller than it looks once you use the right primitives:

- Derive everything from one locale list.
- Convert physical CSS to logical properties and let the browser mirror your layout.
- Set `dir` once, add a direction provider for portaled UI, and flip directional icons by hand.
- Decouple the URL locale from the formatting tag when you need regional precision.
- Let a model handle the first-draft translations, with strict rules about placeholders.
- When hydration breaks after a translation change, suspect a stale cache first.

Most of these took an afternoon to wire up. If you start with the locale list and the logical properties, the rest is incremental.
