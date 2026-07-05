---
title: Benchmarking Five Embedding Models for a Keyword Relevance Filter
description: I compared five open embedding models to filter keyword lists down to a single niche. The top scorer wasn't the model I shipped, one wrong threshold made the best model look worthless, and the largest gains came from things the encoder never sees.
date: 2026-06-30
img: ../assets/images/embedding_model_comparison.png
categories: [Embeddings, NLP, Machine Learning, Benchmarking]
---

I run a content pipeline that pulls in keyword ideas, and most of what comes back belongs to some other domain. For a site about medical device safety, the keyword tools hand me "pharmacy discount cards" and "anti-aging skincare routines" next to the terms I want. I wanted to drop the wrong ones without checking each row by hand, on a CI runner, with no GPU.

Embeddings fit the job. Embed the keyword, embed a handful of reference phrases that describe the domain, keep the keyword when it lands close enough. The open-model shelf for this is deep and mostly free, so the real question was which model to reach for. I benchmarked five, and three things came out that I did not expect. The highest score belonged to a model I would not ship. One threshold flipped the ranking between models. And the encoder itself was the least important choice on the table.

## The setup

I started with ground truth. I hand-labeled 69 keywords: 26 clearly in-domain, 27 clearly out, and 16 borderline cases I left in on purpose. The borderlines carry the exercise. A set of easy positives and obvious negatives flatters every model and teaches you nothing, while the ambiguous keywords are where two encoders disagree. I scored strict F1 on the clean labels and watched the borderlines to see where the score distribution drifted.

The scoring stays simple. No training, no fine-tuning:

```
score = max(similarity to positive anchor phrases)
      − max(similarity to negative anchor phrases)
```

Embed the keyword and two small sets of anchor phrases, one for the domain and one for the neighboring domains that produce false positives, take the difference, and threshold it. My first pass used a fixed threshold of 0.25.

The field, all small enough to run on CPU:

| Model | Dim | Type | Prefix scheme |
|---|---|---|---|
| `all-MiniLM-L6-v2` | 384 | general small | none |
| `e5-small-v2` | 384 | similarity-tuned | symmetric `query:` |
| `bge-small-en-v1.5` | 384 | general small | none |
| `nomic-embed-text-v1.5` | 768 | retrieval | asymmetric query/document |
| `nomic-embed-text-v2-moe` | 768 | retrieval, mixture-of-experts | asymmetric query/document |

## The results

Two configurations carry the whole story. The **baseline** is the naive setup above: raw `max − max` scoring, one broad domain anchor, a fixed 0.25 threshold. The **tuned** config keeps the same models and adds three changes that have nothing to do with the encoder, which I get to below: sharper anchors, a steadier aggregation, and a threshold read off the ROC curve.

| Model | Dim | F1 (baseline) | F1 (tuned) | AUC (tuned) |
|---|---:|---:|---:|---:|
| `all-MiniLM-L6-v2` | 384 | 0.656 | 0.821 | 0.879 |
| `bge-small-en-v1.5` | 384 | 0.457 | 0.852 | 0.885 |
| `e5-small-v2` | 384 | **0.000** | 0.889 | 0.899 |
| `nomic-embed-text-v1.5` | 768 | 0.682 | **0.893** | **0.922** |
| `nomic-embed-text-v2-moe` | 768 | 0.727 | 0.868 | 0.916 |

Most of what I learned about this problem sits in those five rows.

## One threshold flips the ranking

Read the two F1 columns side by side. At the naive baseline the order barely resembles the tuned order. The mixture-of-experts model leads at 0.727 and `e5-small-v2` scores a flat 0.000. After I retuned the three non-model knobs, `e5-small-v2` climbs to 0.889 while the MoE model, still the largest and slowest of the set, drops into the middle of the pack.

That `e5-small-v2` zero comes from a mismatch you can hit with any encoder. e5 expects a `query:` prefix and packs its cosine similarities into a narrow, high band. A fixed 0.25 threshold sits above almost every score it emits, so the filter labels every keyword negative and F1 collapses. The model separates the two classes fine. Its tuned AUC of 0.899 leads the 384-dim group. A threshold borrowed from another model's scale hides that separation behind a bad cutoff.

So an absolute similarity threshold does not carry between models. Compare encoders at each one's own best threshold, or use a threshold-free measure like AUC. Line them all up behind one hardcoded cutoff and you measure whose similarity scale happened to match your guess.

## By AUC, the models sit close together

Set the threshold aside and read the AUC column, which scores class separation without committing to a cutoff. The five models land between 0.879 and 0.922, about four points apart. The two 768-dim models edge the three 384-dim ones, and they carry double the vector width for that edge.

The mixture-of-experts model makes the trade concrete. It is the largest model in the set, and it still landed below the lighter `nomic-embed-text-v1.5` at the tuned config, 0.868 against 0.893. On short keyword text, the extra capacity trained for long-document retrieval bought nothing back.

## The winner isn't what I shipped

By the numbers, `nomic-embed-text-v1.5` wins. It tops both columns at 0.893 F1 and 0.922 AUC. I shipped `e5-small-v2` anyway.

`e5-small-v2` trails by 0.004 F1 at 384 dimensions against nomic's 768. That buys half the storage per vector and a symmetric design built for the short-text-against-short-text comparison I was running. A filter that scores every keyword candidate does not earn back double the vector width for four thousandths of F1. The top of the benchmark and the right pick for the job were two different questions, and the distance between the top two models came in under the distance between a good threshold and a bad one on a single model.

## The part that moved the number

Those three non-model changes did more work than the model choice did. The baseline-to-tuned jump, roughly 0.66 to 0.89, came mostly from parameters the encoder never touches.

**The anchor phrases.** My first anchor set leaned on one broad phrase to cover the whole domain. A single anchor like:

```
"medical device industry news and analysis"
```

sits close enough to adjacent-but-wrong keywords ("prescription drug coupons", "health insurance enrollment") to pull them over the line. I swapped that umbrella for several concrete anchors, each pinned to one subtopic:

```
"implantable device malfunction and failure reports"
"medical device recall and safety alerts"
"post-market surveillance for device manufacturers"
```

That removed a whole class of false positives on its own. Anchors are the cheapest thing in the system to edit, and sharpening them moved F1 more than any model swap. Naming the specific neighbors on the negative side helped as much, since it gave the score something concrete to push against.

**The aggregation function.** `max(pos) − max(neg)` breaks on a single lucky anchor match, which then decides the whole keyword. I switched to the mean of the top-3 positive similarities minus the max negative, and the score steadied out on the borderline cases where one anchor spikes but the overall fit stays weak:

```
# brittle: one anchor decides everything
score = max(pos) − max(neg)

# steadier: needs broad agreement, not one spike
score = mean(top-3 pos) − max(neg)
```

**The threshold.** In place of my hand-picked 0.25, I swept the ROC curve and let the data pick the cutoff that maximized F1. As the `e5-small-v2` zero showed, that one choice separates a model that looks broken from a model that looks best.

Model, anchors, aggregation, threshold. I reached for the model first, and across this table it explains less of the spread than the other three.

## Final numbers

| Metric | Value |
|--------|-------|
| Keywords labeled | 69 |
| Models compared | 5 |
| Baseline F1 (MiniLM, fixed 0.25 threshold) | 0.656 |
| Best F1 (nomic-embed-text-v1.5, tuned) | 0.893 |
| Shipped model | e5-small-v2 (0.889 F1, 384-dim) |
| AUC spread across models (tuned) | 0.879 – 0.922 |
| Hardware | CPU, no GPU |

## Conclusion

A few things I would tell myself before starting:

1. **Benchmark on your own data, not the leaderboard.** MTEB rankings run on tasks that look nothing like short keyword-versus-phrase scoring. A 69-example set I labeled in an afternoon predicted real behavior that the public boards missed.
2. **Never compare models at one fixed threshold.** An absolute cutoff does not transfer between encoders, and it dragged my best-separating model down to a zero. Compare at each model's own threshold, or compare AUC.
3. **The top score is not the pick.** The leading model won by 0.004 F1 at double the dimensions. Vector width and how a model expects to be used outweighed a rounding-error gain in quality.
4. **Tune the model last.** How you write the anchor phrases and how you aggregate the scores moved the number more than swapping the encoder did.

No GPU, no fine-tuning, one afternoon of labeling and one of sweeps, and I ended with a filter I trust. The keeper wasn't a favorite model. It was the reminder that when an embedding pipeline underperforms, the encoder is one knob among several, and rarely the one worth turning first.

---

*Have you hit the same "everything but the model mattered" surprise on an embedding task? Feel free to reach out.*
