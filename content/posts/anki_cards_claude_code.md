---
title: Building Anki Cards with Claude Code
description: A working method for generating Anki cards with AI that you can actually trust, covering the HTML rendering bug that eats numeric cutoffs without an error, why ChatGPT alone produces a deck that teaches you the question bank instead of the subject, and what happened when I graded my own AI-built deck against 50 real exam questions.
date: 2026-08-23
img: ../assets/images/anki-claude-code.png
categories: [Anki, Claude Code, Spaced Repetition, AI Flashcards, Board Review]
---

I sit the clinical cardiac electrophysiology boards this year, and I own the usual pile of review material: a question-and-commentary product with 463 numbered items, twenty-three lecture decks, eighteen workshop question sets. Reading it is not the problem. Recalling a pre-excitation cutoff or an entrainment threshold months from now is the problem, and that is what spaced repetition solves.

The obvious approach is one flashcard per numbered item. I tried it, and it produces a deck that teaches you the question bank instead of the subject. What I wanted was a deck built the way I build study notes: pull the same fact from six places in the corpus, reconcile the versions where they disagree, and write one dense card.

I ended up with **468 notes generating 1,386 cards across 13 subdecks**, built with Claude Code over about a day. The tooling is ordinary. Python, `genanki` for packaging, `pdftotext` for extraction, no fine-tuning, no vector database, and no API bill beyond a Claude subscription.

The deck is not the interesting part. The interesting part is what the build caught. My first batch of 52 cards imported into Anki with no errors and no warnings, and sixteen of them were broken.

## The Bug That Would Have Poisoned Everything

A card reading `SPERRI <250 msec identifies a high-risk pathway` renders in Anki as `SPERRI`.

Anki treats fields as HTML. An HTML parser reads `<250 msec identifies a high-risk pathway` as an unclosed tag and discards everything up to the next `>`. My deck is built around numeric cutoffs, so nearly a third of that first batch had lost its number, and nothing in the toolchain complained. I would have found out in November, drilling cards that had been gutted since August.

The fix belongs in the packaging script rather than the card text, so that it protects every card written afterward:

```python
def esc(text: str) -> str:
    """Escape < and > so Anki does not parse cutoffs like "<115 msec" as HTML.

    Card text is plain cloze markup, never HTML, so this is unconditional.
    Without it, Anki swallows any "<..." run and the cutoff vanishes from the
    rendered card, a failure that is invisible until review time.
    """
    return text.replace('<', '&lt;').replace('>', '&gt;')
```

Nine characters of code.

The general version: whatever renders your cards has opinions about your text and will not tell you what they are. If your subject involves comparison operators, chemical formulas, or anything angle-bracketed, render a sample and look at it before you build a thousand more.

## Packaging, and Why Deck IDs Matter

The build stage is `genanki` and about sixty lines. Two decisions in it are worth copying.

The note type carries two fields. `Text` holds the cloze markup and `Extra` renders on the answer side only, which makes it free real estate for mechanism, citations, and the reason a distractor fails. None of it costs a recall test.

```python
CLOZE_MODEL = genanki.Model(
    998877661,                      # fixed ID so re-imports map to the same note type
    'EP Cloze Model',
    fields=[{'name': 'Text'}, {'name': 'Extra'}],
    templates=[{
        'name': 'Cloze',
        'qfmt': '{{cloze:Text}}',
        'afmt': '{{cloze:Text}}<br><br>'
                '<div style="color:#666;font-size:0.9em">{{Extra}}</div>',
    }],
    model_type=genanki.Model.CLOZE,
)
```

The second decision I made was to derive the deck ID from the deck name instead of letting `genanki` pick a random integer:

```python
def deck_id_from_name(name: str) -> int:
    return int(hashlib.md5(name.encode('utf-8')).hexdigest()[:8], 16)
```

A random ID means every rebuild imports as a brand new deck and your review history stays behind in the old one. Hashing the name means `EP Board Review::Devices & Programming` resolves to the same ID forever, so a rebuild updates in place. The `::` separator gives you subdecks, which is how one master deck grows across many source PDFs over months.

## Why Not Just Ask ChatGPT?

This is the obvious question, and I tried the obvious thing first. Paste a chapter into a chat window, ask for cloze deletions, copy the result into Anki. It works, and it produces a deck with four problems.

**It cards the source, not the subject.** One flashcard per question teaches you the question bank. Real understanding needs the same fact pulled from six places in the corpus with the versions reconciled. A chat window holds one chapter at a time and has no memory of the other five mentions.

**It duplicates.** Anki deduplicates on exact first-field match, so two differently worded cards teaching the same fact both import without complaint. You review the same fact twice for weeks before noticing.

**It cannot check its own work.** A chat model will tell you the cards look good. It will not open the packaged file, render the fields, and discover that a third of them lost their numbers.

**It cannot go to the source.** When my review product paraphrased a guideline wrong, catching it required fetching the actual guideline PDF, extracting the recommendation table, and comparing the text.

The difference is the agent loop. Claude Code reads files, writes files, runs code, and checks its own output against a standard I wrote down. Everything below depends on that loop, and none of it works in a chat window.

## Give Every Fact a Machine-Checkable ID

Pass one walks the corpus and emits one JSON line per extracted fact. Each carries a `fact_key`: a normalized `topic::parameter` string.

```json
{"item": 1,
 "fact_key": "af_ablation::early_recurrence_predictive_value",
 "fact": "Early recurrence after AF ablation: pooled NPV for late recurrence 89% paroxysmal / 91% persistent; PPV more variable (59.7% vs 81.2%)",
 "categories": ["pearls", "cutoffs"],
 "numeric": [{"param": "NPV early recurrence", "value": "89% parox / 91% persistent"},
             {"param": "PPV early recurrence", "value": "59.7% parox / 81.2% persistent"}],
 "figure_dependent": false,
 "src": "epsap"}
```

Every field earns its place. `numeric` is broken out separately so numbers can be checked against the source without parsing prose. `figure_dependent` flags facts that reference a tracing the extractor cannot see, which is how I learned that half the corpus was unusable for text cards. `src` matters once a second source enters the build.

Six hundred forty-nine facts came out of that pass. Sorting by `fact_key` clusters every mention of a parameter across the whole corpus, which turns an invisible contradiction spread across 400 pages into a visible one in a single grep. Four numeric conflicts surfaced. Each now lives on one card that teaches the majority value first and names the minority framing, with the item numbers in the notes field.

The same key solves the duplication problem. Before writing any card in a later phase, the build checks the key against the index. A hit permits three moves: enrich the existing note, reconcile a numeric conflict, or skip. Writing a new note is not among them. Two later phases added 104 notes and produced zero duplicates.

If you build a deck across more than one sitting, this is the piece to steal.

## Grade the Deck Against Real Questions

After the first phase produced 356 notes, the temptation was to keep building. Instead the build stops for a checkpoint that writes no cards.

The question sets are lecture slides, so there are no question numbers to split on. What every question does have is an option block, which makes the parse a scan for three or more consecutive `A.` through `E.` lines:

```python
OPT = re.compile(r'^\s*([A-E])\s*[\.\)]\s*\S')
...
if len(set(letters)) >= 3 and letters[0] == 'A':
    stem = '\n'.join(lines[max(0, a - 14):a])   # 14 lines above the options
    exp  = '\n'.join(lines[b:next_block])       # everything until the next one
```

Each stem appears twice in these decks, once on the question slide and once on the answer slide, so a dedup step keys on the normalized last 300 characters of the stem and keeps whichever copy carries the longer explanation. That yielded **225 discrete questions** across eighteen sets.

The sample is drawn by stride rather than randomly:

```python
idx = [round(i * len(questions) / 50) for i in range(50)]
```

Deterministic, spread across every set in proportion to its size, and reproducible. Shifting the offset later gives a genuinely independent second sample, which matters because I plan to re-score the deck after the next build phase.

Each question got one grade: does the deck contain the fact that discriminates the right answer from the distractors?

| Grade | n | % |
|---|---:|---:|
| answered | 28 | 56% |
| partial | 13 | 26% |
| missing | 9 | 18% |

**56%.**

My own review of my own cards told me the deck was in good shape. Fifty real questions told me it had holes and named them: the wavelength of a reentrant circuit, Coumel's sign, cryoablation technique for AV nodal reentry, the genetics counselling workflow. Not one had occurred to me.

The distribution mattered more than the score. Entrainment and pacing manoeuvres scored 17 of 19. Conduction system pacing had **one card in the entire deck** against a 111-page lecture, on a topic modern boards lean on. That single measurement redirected the next phase.

A second finding: 30 of the 50 questions required reading a tracing. The deck answered many of them because the discriminating fact is a principle and the tracing is the vehicle, but waveform interpretation stays out of reach for a text deck.

If you build a deck with AI and never score it against real questions, you are grading your own homework.

## Coverage and Card Quality Are Different Axes

I read a few hundred cards and found some of them worthless. This one is representative:

> Atenolol has {{c1::**less**}} protein binding than other beta-blockers and therefore more potential for beta-blocker-related adverse effects in pregnancy.

The word "therefore" hands you the answer. Worse, the fact worth testing, that atenolol is the beta-blocker to avoid in pregnancy, sits in plain text where nothing tests it.

A card like that scores `answered` on the coverage check. The validation checkpoint is blind to this failure by construction, because it asks whether the deck contains a fact, not whether the card tests it.

One class of bad card is machine-detectable, and worth catching mechanically because it is invisible on a read-through: a cloze whose answer appears somewhere else in the same note, in plain text or inside a different cloze.

```python
CLOZE = re.compile(r'\{\{c(\d+)::(.*?)\}\}')

def giveaways(text):
    """Yield clozes whose answer is visible elsewhere in the same note."""
    for num, answer in CLOZE.findall(text):
        # Same-numbered clozes hide together, so blank those; reveal the rest.
        shown = CLOZE.sub(
            lambda m: '' if m.group(1) == num else m.group(2), text)
        a = answer.strip()
        if len(a) > 3 and re.search(
                rf'(?<![A-Za-z]){re.escape(a)}(?![A-Za-z])', shown, re.I):
            yield num, a
```

The subtlety is the same-number carve-out. Clozes sharing an index are hidden together during review, so `{{c1::fast}}` appearing twice is fine, while `{{c1::fast}}` alongside `{{c2::slow-fast AVNRT}}` is a leak. My first version of this check used substring matching without word boundaries and reported clean. The boundary-aware version found 23 real leaks I had already declared fixed.

That scan is where mechanical detection stops. Run against the full deck it produced 65 candidates, most of them false positives, because `IKr` and `H-H` are short answers and good ones. It also missed the atenolol card entirely, since nothing in that sentence repeats the word "less." The defect is semantic. So Claude Code read all 1,184 clozes one at a time against a written test:

> Could a smart person who has never studied this subject answer it from the sentence alone?

Sixty-two clozes failed, or 5.2%. Six named failure modes came out of it, and they are the same six in any subject:

| Failure | Signature |
|---|---|
| Inferable from stem | The sentence's own logic forces the answer |
| Wrong half clozed | The hard fact sits in plain text |
| Redundant | Same fact hidden twice in one note |
| Coin-flip directional | higher/lower with no memory hook |
| Ungradeable | A ten-word list you cannot honestly self-score |
| Trivia | Enrollment counts, dates nobody tests |

## Prose Cards Fail Fifteen Times More Often Than Number Cards

This is the finding I would carry to any subject.

| Deck | Weak clozes | Rate |
|---|---:|---:|
| Drug Interactions | 5 / 27 | 19% |
| Clinical Pearls | 11 / 62 | 18% |
| Risk Factors | 4 / 124 | 3% |
| Ablation Biophysics | 2 / 150 | 1% |

The prose-heavy decks failed at roughly fifteen times the rate of the number-heavy ones, and the reason is mechanical. A cutoff of 250 msec cannot be inferred from a sentence. A clause beginning "and therefore" always can. Numbers resist the failure mode. Explanations invite it, because good explanatory prose makes its conclusion follow from its premises, which is the opposite of what a test item needs.

If you write cloze cards on conceptual material, that is where your bad cards live. Check those first.

The repair was rewriting rather than deletion. In almost every case the fact was fine and only the hiding was wrong, so 56 cards got new sentences and six lost a redundant cloze.

## Where the Source Itself Was Wrong

Three cards carried claims my review product had garbled. Finding them required going to the primary documents.

**A pacing target.** My source paraphrased a European guideline as recommending biventricular pacing above 95%. The guideline text reads that junction ablation should be added for incomplete pacing below **90 to 95%**, Class IIa. Close enough to sound right, wrong enough to lose a question.

**An anticoagulation recommendation.** The source cites a 2019 update that gave three drugs a Class III in end-stage kidney disease. The 2023 guideline supersedes it. No Class III survives, the whole question drops to Class IIb, and one of those three drugs remains listed at a reduced dose. The old card taught me to eliminate a drug that current guidance permits.

**Sports participation.** The 2015 disqualification framework, which most prep material still teaches, was replaced in 2025 by shared decision making. Several restrictions I would have memorized no longer exist.

The pattern: a review product freezes at its publication date and paraphrases toward whatever sounds cleaner. Verification against the primary document is slow, and it caught three cards that would have taught me confident wrong answers.

## Does This Work for Other Subjects?

Nothing above is specific to medicine. The method needs three things:

1. **A corpus you can turn into text.** PDFs with a text layer, transcripts, notes. My nine image-only lecture decks (604 pages) produced nothing, and that limitation is absolute.
2. **A way to name facts.** The `topic::parameter` convention works for anything with parameters. Pharmacology, statutes, language grammar rules, engineering constants.
3. **A held-out set of real questions.** Without something to score against, you have no feedback signal and you are back to grading your own homework.

What transfers least is the part I spent the most time on, which is domain judgment about what matters. The AI proposed the cards. Deciding that conduction system pacing deserved 38 of them and adult congenital heart disease deserved fewer required knowing the field.

## The Build Loop

Every phase ends the same way. One script walks every note and checks four things: cloze numbering is contiguous from 1, no cloze leaks its answer, every note carries provenance in `Extra`, and nothing is empty. It prints one line, and that line is the gate.

```
$ python3 qc.py cards_*.json
notes=468 cards=1386 issues=0

$ .venv/bin/python build_deck.py cards_*.json ep_board_review.apkg
Wrote 468 cards across 13 deck(s) to ep_board_review.apkg
```

A failing run names the card by deck and index, which is what makes the fix cheap:

```
GIVEAWAY  03_pacing_maneuvers 27 c1 :: fast
GAP       10_devices 61 [1, 2, 4]
THIN      09_guidelines 29
```

Two exports come out of the same pass: the `.apkg` for import, and a CSV carrying deck, a stable reference like `10_devices#32`, the card text, the extra field, and a blank verdict column. Reading 1,386 cards in a spreadsheet and flagging them by reference is a very different task from reading them in Anki one at a time.

## What I Have Not Proven

I have not sat the exam. I have no retention data, no comparison against a commercially built deck, and no evidence that a synthesized card outperforms a transcribed one on recall. What I have is a deck whose every card has been checked against a written standard by something with more patience than I have.

Two known gaps remain. Waveform interpretation needs image occlusion cards from 604 pages holding no extractable text. And the deck is owed a second validation round on a fresh question sample, to see whether 56% moved.

## Lessons

- **Ask for a critique of the plan before asking for execution.** Three errors in my build plan, including a worked example teaching the wrong number, surfaced before any card existed.
- **Give every fact a machine-checkable ID.** Clustering by `topic::parameter` turned four silent contradictions into visible ones and made later phases safe to add without duplicating.
- **Render a sample before building a thousand.** A comparison operator is an unclosed HTML tag. Sixteen of my first 52 cards were broken with no error.
- **Score against real questions, not your own review.** My review said the deck was good. Fifty questions said 56% and named four gaps I would never have listed.
- **Coverage and card quality are different axes.** A card can contain the right fact and test nothing. Read every cloze against "could someone outside the field answer this from the sentence alone."
- **Prose cards fail fifteen times more often than number cards.** The word "therefore" is where a testable fact goes to die.
- **Go to the primary document for anything versioned.** Review products freeze at their publication date. Three cards in my deck taught outdated guidance.
- **Let the measurement tell you to stop.** The same data that told me to build 29 more device cards told me to build zero more congenital ones.

The generation is the easy half. Everything that made the deck worth keeping happened after the cards existed.
