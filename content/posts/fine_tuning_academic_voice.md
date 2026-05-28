---
title: Fine-Tuning a Local LLM to Write in My Academic Voice
description: How I trained an 8B Llama on my own cardiology papers, from extracting prose out of Word docs, to a first attempt that failed because I trained on single sentences, to a working model that drafts abstracts, methods, and discussions in my style on a Mac.
date: 2026-05-27
img: ../assets/images/fine-tuning-academic-voice.png
categories: [LLM, Fine-Tuning, MLX, Modal, Academic Writing]
---

# Fine-Tuning a Local LLM to Write in My Academic Voice

I write a lot of papers, and the prose takes more time than the science. I turn statistical outputs and bullet points into a journal-shaped methods section, hedge a results paragraph the way a reviewer expects, drag a limitations paragraph out of a discussion. Generic chatbots can produce something on the topic, but the result reads like an AI assistant, not like me. I wanted a model that already knew the voice.

I ended up with a fine-tuned **Llama-3.1-8B-Instruct**, trained on my own corpus of 37 published papers, running on my Mac in **LM Studio** at 25 to 30 tokens per second. Total cloud spend across the whole project was under $5. My first training run flopped, and the reason it flopped pointed me at the fix.

## What I Wanted From It

A concrete goal made the rest of the decisions easier. The goal was a **rewrite assistant**. I paste a rough paragraph (mine, a co-author's, or something I dictated into Otter), and it returns the same content in my published academic style. The shapes I write in are abstracts, methods sections, and discussions.

That framing turned out to matter. The data format, the system prompt, and the way I generated training examples all follow from the task being "rewrite this draft" instead of "answer this question."

## The Stack

The pieces that mattered:

- **Llama-3.1-8B-Instruct** as the base. Better English prose than Qwen3 at this size, biggest LoRA ecosystem, Apache 2.0.
- **QLoRA via Unsloth** on a Modal **A100-40GB** for training. Cloud GPU because the dataset includes 4096-token sequences and my Mac would take hours.
- **MLX** for inference back on the Mac. Apple's runtime is 20 to 40% faster on Apple Silicon than CUDA-ported alternatives.
- **LM Studio** as the UI, because it is the path of least resistance to a chat box with a system prompt field.
- **Azure OpenAI GPT-5.4-mini** to generate the training pairs from my papers.

I managed the full setup with `uv`, the only Python env story I am willing to deal with in 2026.

## Step One: Getting Prose Out of Word

My papers are `.docx` files with the usual editorial sediment: reviewer comments, tracked changes, figure captions, reference lists, author affiliations. None of that should end up in training data. The extractor (`extract.py`) reads only `word/document.xml`, drops the contents of `<w:del>` (tracked deletions) while keeping `<w:ins>`, and walks paragraphs in order to tag each one with a section name.

Two things were not obvious going in:

1. **Word comments live in a separate XML part** (`word/comments.xml`). `python-docx` doesn't read it, so reviewer comments are excluded for free. I checked this first because an earlier scraping attempt of mine had pulled "Matt, do we have a citation for this?" into the training data.
2. **Section detection by short paragraphs, not styles.** Author-applied heading styles in Word are inconsistent across journals. The extractor looks for short (<80 char) paragraphs that match a small whitelist of section keywords (`Introduction`, `Methods`, `Discussion`, `Limitations`). Anything that follows belongs to that section until the next heading.

A second pass writes each paper out to `cleaned_docs/<paper>.md`, with frontmatter and `## section` headers. Out of 40 papers, 37 had clean abstracts and full sections, and three were research letters with a single `body` section.

## Step Two: Generating Training Pairs

Fine-tuning Llama needs **instruction → response** pairs in ChatML JSONL: a system prompt that defines the voice, a user turn with the instruction, an assistant turn with the desired output. The system prompt is **identical across every example**. That is where the voice lives. Change it per-example and the model has no anchor.

Mine is the obvious thing:

```
You are Matt Segar, MD, a cardiac electrophysiologist and cardiovascular
epidemiologist with experience leading observational cohort analyses,
machine-learning phenotyping studies, and post-hoc analyses of randomized
clinical trials. Write in a precise, hedged academic style appropriate for
high-impact cardiology journals such as JACC, Circulation, JAMA Cardiology,
and the European Heart Journal. Use formal but readable prose, qualify
statistical findings with appropriate uncertainty language, and structure
arguments with both clinical and mechanistic reasoning.
```

The prompt covers persona, journal register, and style. No specific topics or datasets, because those bleed into every output.

### The rewrite-pair trick

One natural way to make training pairs is "write a methods section about X" paired with the published methods section. That doesn't match how I use the model. I work from drafts, not blank pages. Every pair I generated is a **rewrite** task, with a rough draft as the input and the polished, published version as the output.

The polished side is easy because that paragraph is already in the paper. The rough draft is the missing half, so I had GPT-5.4-mini *de-polish* each published passage into one of three rough styles I see in real drafts:

- **AI-generic**: bland chatbot prose, "plays a crucial role in," "underscores the significance of"
- **Verbose co-author**: wordy, redundant clauses, "in addition to this, furthermore..."
- **Loose first draft**: short, casual, contractions, "a lot of" instead of "a high proportion"

Each pair then looks like:

```
USER: Rewrite the following in my academic cardiology style:
      [rough draft generated by GPT]
ASSISTANT: [original polished paragraph, verbatim]
```

A thread pool of 10 concurrent Azure calls turns 37 papers into ~1,400 candidate pairs in about 30 minutes, for a couple of dollars in API spend.

## Step Three: The First Attempt That Didn't Work

It took two training runs to see the problem with my first approach.

The initial generator broke each section into **single sentences** and asked GPT to rough up one sentence at a time. The idea was that more pairs equals more training signal: 1 paragraph times 6 sentences gives 6 examples instead of 1. After de-duplication I had close to 4,000 sentence-level pairs and an eval loss curve that looked beautiful.

The model came back broken in a specific, instructive way: it would write one good sentence and stop.

```
USER: Rewrite this discussion paragraph in my voice:
      [a four-sentence draft about ECG-AI and HF risk]

A: Electrocardiographic artificial intelligence has emerged
as a promising tool for the early detection of structural heart
disease in asymptomatic populations.
<|eot_id|>
```

That sentence sounds like me. It is also the entire response. Every training example had ended after one sentence, so the model learned that one sentence is where assistant turns terminate. The model had memorized where to put EOS. It had not learned to write at length.

The fix was not more data. The data needed a different shape.

## Step Four: Mixing Response Shapes

I scrapped the sentence-level pipeline and rebuilt the generator around three coexisting pair types:

| Type | Response shape | Count |
| --- | --- | --- |
| `paragraph` | A single paragraph, verbatim | ~960 |
| `section` | A complete multi-paragraph section (intro / methods / discussion) | ~210 |
| `abstract` | A full structured abstract (JAMA-style or traditional) | ~210 |

The model now sees assistant turns of every length it might need to produce, from one paragraph to a 350-word structured abstract with inline labels (`Importance:`, `Methods:`, `Findings:`). The EOS token marks the end of a response of any length, not the end of a sentence.

GPT's default behavior when asked to rewrite something long is to summarize it, so the prompt is explicit:

```
Rewrite the SAME content in a different prose style. Preserve every fact,
statistic, study detail, and conclusion exactly. Do not summarize or
shorten. Keep approximately the same length and the same paragraph
structure (use blank lines between paragraphs).
```

A weighted sampler tilts toward abstracts (weight 2.0) and main sections (weight 1.0), away from conclusions (0.5) and `unknown`-tagged paragraphs (0.25). Abstracts carry disproportionate stylistic signal, since every sentence has been agonized over, and doubling their weight is worth it.

Final dataset: **1,377 pairs, split 1,240 train / 137 valid (90/10)**.

Before training I ran a local HTML viewer (`viewer.html`, served by `python -m http.server 8000`) with arrow-key navigation through the JSONL. Scrolling through fifty random pairs takes ten minutes and catches contaminated examples before they eat a $0.40 GPU run.

## Step Five: Training on Modal

QLoRA on an A100-40GB through Unsloth is by 2026 a solved problem, *if* you don't fight the dependency matrix.

The rule I paid to learn: do not hand-pin the torch / transformers / unsloth / xformers / bitsandbytes version graph. It is fragile, it breaks every six weeks, and the Modal staff already maintain a working pin set in their reference example. Copy theirs verbatim. The key invocation in the Modal image:

```python
"unsloth[cu128-torch270]==2025.7.8"
```

That `[cu128-torch270]` extra pulls a pre-bundled wheel set for CUDA 12.8 plus torch 2.7.0 and sidesteps the whole problem.

Training itself is unremarkable:

```python
model = FastLanguageModel.get_peft_model(
    model,
    r=16, lora_alpha=32,
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    lora_dropout=0.05,
    bias="none",
    use_gradient_checkpointing="unsloth",
)
```

LoRA rank 16 on the four attention projections across all 32 transformer layers. That is **13.6M trainable parameters out of 8B, or 0.17% of the model.** Two epochs at sequence length 4096, effective batch 8 (`batch=4 * grad_accum=2`), learning rate `2e-4` with a cosine schedule and 3% warmup.

Run command:

```bash
# Smoke test first. Validates the whole pipeline for about $0.10.
uv run modal run train_modal.py --max-steps 50

# Then the real thing.
uv run modal run train_modal.py --epochs 2
```

The eval loss curve was the thing I cared about, and this time it was honest:

```
step 100   eval_loss 0.7411
step 200   eval_loss 0.6747
step 300   eval_loss 0.6519
```

Monotonically dropping, with no plateau yet at two epochs. Three or four epochs would probably squeeze a little more out, but the model was already producing the outputs I wanted, so I shipped. About 18 minutes wall-clock, **$0.40** on the A100.

## Step Six: Getting It Onto the Mac

The Modal job saves two artifacts to a Modal volume: the raw LoRA adapter (~55 MB) and a merged FP16 model (~16 GB across four shards). The merged version is what matters, because MLX-LM's adapter loader can't read Unsloth's PEFT-format adapters directly. The key names and tensor layouts differ.

One Modal CLI bug worth knowing about as of May 2026: `modal volume get` on a directory flattens the contents into a single file. The workaround is a per-file loop, which is ugly but reliable. Once the merged FP16 model is local, MLX converts it to 4-bit in one command:

```bash
uv run mlx_lm.convert \
  --hf-path ./my-finetune/modal/merged_16bit \
  --mlx-path ./my-finetune/llama-segar-mlx \
  --quantize --q-bits 4
```

Output: a single ~4.2 GB MLX model directory. For an 8B model in conversation, 4-bit is the default. I tried a few side-by-side rewrites against the FP16 version and could not pick the FP16 one out of a lineup.

LM Studio's scanner looks for MLX models under `~/.cache/huggingface/hub/<author>/<name>/`:

```bash
mkdir -p ~/.cache/huggingface/hub/segar/llama-3.1-8b-cardiology-mlx
cp my-finetune/llama-segar-mlx/* \
   ~/.cache/huggingface/hub/segar/llama-3.1-8b-cardiology-mlx/
```

I refresh **My Models** in LM Studio, the model shows up, I click load. Pasting the same system prompt that anchored every training example into the System Prompt field puts the model in the right register.

## Does It Work?

The real test is whether I prefer its output to a generic Claude or GPT rewrite, and whether I would use it day to day. Three things stood out.

**First, it hedges the way I do.** The base Llama-3.1 will write "ECG-AI is a powerful tool that revolutionizes cardiovascular risk prediction." Mine writes "ECG-AI has emerged as a promising tool for cardiovascular risk stratification, leveraging subtle waveform features imperceptible to human interpretation, though prospective validation in diverse populations remains limited." The fine-tuned version qualifies, leans on "emerging," and gets the limitation into the same sentence.

**Second, it knows the section shapes.** Ask for "a limitations section for a propensity-matched retrospective cohort study" and it produces three paragraphs in the order I use: residual confounding from unmeasured variables, then ascertainment and outcome-definition concerns, then external validity. I never wrote that order down. The model absorbed it from the 23 limitations sections in the training set.

**Third, the structured-abstract reflex is back.** This was the regression I cared about after the sentence-level run. The prompt: "Write a structured abstract for a paper examining atrial cardiomyopathy phenotypes and stroke risk in ARIC." The response: a JAMA-style abstract with inline `Importance:`, `Objective:`, `Design:`, `Findings:`, `Meaning:` labels at the right length. The shape-mixing fix did what I hoped it would.

On an M5 Pro with 32 GB unified memory, the model generates at **25 to 30 tokens/sec**, uses about 8 GB of RAM, and gets to first token in about two seconds. That is comfortable interactive speed. It produces prose about six times faster than I can read it.

## Lessons

A few things from this project that I'd carry to the next one.

- **Match training shapes to inference shapes.** A model trained on single sentences will emit single sentences. Multi-paragraph output needs multi-paragraph examples in the training data. The eval loss curve gives you no warning about this. Mine dropped beautifully on both runs.
- **The system prompt is voice, not content.** Keep it identical across all examples. Cover persona, journal register, and style. Anything specific, like a dataset name or a topic, belongs in the user turn, because details in the system prompt bleed into every output.
- **Frame pairs around the task you do.** I draft from rough text, so every pair is a rewrite with a roughed-up draft on the input side. If I were drafting from blank pages, the pair shapes would look different.
- **Generate the rough draft, don't write it.** Hand-writing 1,400 rough drafts would be a part-time job. Asking GPT-5.4-mini to de-polish published prose into three named rough styles ("AI-generic," "verbose co-author," "loose first draft") cost about $2 and an afternoon.
- **Eyeball the pairs before training.** A 20-line HTML viewer with arrow-key nav and a search box saved at least one failed GPU run by catching abstracts where the rough draft had collapsed into a summary.
- **Don't hand-pin ML image dependencies.** Find a maintainer's working pin set (Modal staff publish theirs in `modal-labs/modal-examples`) and copy it verbatim. The torch/transformers/xformers/bitsandbytes matrix moves too fast to chase by hand.
- **Trial-first, full-run-second, at every stage.** Smoke-test on one paper for data generation, on 50 steps for training, on a single prompt for inference. Each smoke test is cheap, and each one has caught something stupid at least once.

The fine-tuned model now drafts the first version of most abstracts and limitations sections I write. I still edit the output, but I am editing my own voice instead of arguing with a chatbot. The gap between the first run and this one came down to the shape of the data.
