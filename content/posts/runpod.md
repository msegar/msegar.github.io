---
title: Embedding 500K Medical Texts with PubMedBERT on RunPod
description: A practical guide to running large-scale biomedical embeddings on GPU.
date: 2026-01-18
img: ../assets/images/runpod.png
categories: [Python, Machine Learning, NLP, GPU]
---

I recently needed to generate embeddings for over half a million paragraphs of medical/biomedical text. Running this on my laptop would have taken days, so I turned to RunPod for on-demand GPU compute. Here's what I learned, including the gotchas that cost me hours of debugging.

## Why PubMedBERT?

When embedding domain-specific text, generic models like `all-MiniLM-L6-v2` leave performance on the table. **PubMedBERT** (`microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext`) is pre-trained exclusively on biomedical literature—PubMed abstracts and full-text articles from PubMed Central.

### What Makes It Different

| Aspect | Generic BERT | PubMedBERT |
|--------|-------------|------------|
| Training data | Wikipedia, books | PubMed abstracts + PMC full texts |
| Vocabulary | General English | Biomedical terminology |
| Domain terms | Often split into subwords | Preserved as single tokens |

A term like "cardiomyopathy" might be tokenized as `['card', '##io', '##my', '##op', '##athy']` by generic BERT, but PubMedBERT recognizes it as a single token. This matters for downstream tasks like semantic search, clustering, and classification.

### When to Use PubMedBERT

- Medical literature search and retrieval
- Clinical note analysis
- Drug/disease relationship extraction
- Biomedical research clustering
- Grant abstract similarity matching

The model outputs 768-dimensional vectors, which is standard for BERT-base models. You can store these in PostgreSQL with pgvector, Pinecone, Qdrant, or any vector database.

## Why RunPod?

I needed to embed ~500,000 text passages. On CPU, this would take 20+ hours. On an RTX 4090, it takes under 2 hours.

RunPod offers:
- **Pay-per-use GPU instances** — no commitment, pay by the minute
- **Pre-configured PyTorch templates** — CUDA drivers pre-installed
- **SSH access** — work in your familiar terminal environment
- **Persistent volumes** — keep model weights cached between sessions

### Cost Breakdown

For my 500K embedding job:

| GPU | Hourly Rate | Total Time | Total Cost |
|-----|-------------|------------|------------|
| RTX 4090 (24GB) | ~$0.44/hr | ~1.5 hrs | ~$0.66 |
| RTX 3090 (24GB) | ~$0.31/hr | ~2 hrs | ~$0.62 |
| A100 40GB | ~$1.09/hr | ~1 hr | ~$1.09 |

The RTX 4090 hits the sweet spot for this workload—fast enough that you don't need A100 pricing.

## Setting Up RunPod

### 1. Launch an Instance

1. Create a RunPod account and add credits
2. Go to **Pods** → **Deploy**
3. Select **RTX 4090** (24GB VRAM)
4. Choose template: **RunPod PyTorch 2.1**
5. Set volume size: **20GB** (for model cache)
6. Deploy

The instance takes 1-2 minutes to initialize.

### 2. Connect via SSH

Click **Connect** in the RunPod dashboard to get your SSH command:

```bash
ssh root@<IP> -p <PORT>
```

Or use VS Code's Remote-SSH extension for a better experience.

### 3. Install Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install PyTorch with CUDA support
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126

# Install sentence-transformers
pip install sentence-transformers psycopg2-binary tqdm
```

### 4. Verify GPU Access

```bash
python -c "import torch; print(f'CUDA: {torch.cuda.is_available()}, GPU: {torch.cuda.get_device_name(0)}')"
```

Expected output:
```
CUDA: True, GPU: NVIDIA GeForce RTX 4090
```

## The Embedding Script

Here's a minimal example that batches efficiently:

```python
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import numpy as np

# Load model (downloads ~500MB on first run)
model = SentenceTransformer('microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext')

def embed_texts(texts: list[str], batch_size: int = 64) -> np.ndarray:
    """Embed texts in batches with progress bar."""
    embeddings = []

    for i in tqdm(range(0, len(texts), batch_size), desc="Embedding"):
        batch = texts[i:i + batch_size]
        batch_embeddings = model.encode(
            batch,
            show_progress_bar=False,
            convert_to_numpy=True
        )
        embeddings.append(batch_embeddings)

    return np.vstack(embeddings)

# Example usage
texts = ["Patient presents with acute myocardial infarction...", ...]
vectors = embed_texts(texts, batch_size=64)
print(f"Shape: {vectors.shape}")  # (n_texts, 768)
```

### Optimal Batch Size

| GPU VRAM | Recommended Batch Size |
|----------|----------------------|
| 8GB | 16 |
| 16GB | 32 |
| 24GB | 64 |
| 40GB+ | 128 |

If you hit CUDA OOM errors, reduce batch size.

## Gotchas That Cost Me Hours

### 1. PyTorch Version Requirements (CVE-2025-32434)

**The error:**
```
ValueError: Due to a serious vulnerability issue in `torch.load`, even with
`weights_only=True`, we now require users to upgrade torch to at least v2.6
```

**The problem:** Recent versions of `transformers` and `sentence-transformers` require PyTorch 2.6+ due to a security vulnerability. The older CUDA indexes (`cu121`, `cu124`) only have PyTorch 2.5.x.

**The fix:** Use the `cu126` (or `cu130`) index:
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu126
```

### 2. IPv6 vs IPv4 (Supabase/Cloud Database)

**The error:**
```
psycopg2.OperationalError: connection to server at "db.xxx.supabase.co"
(2600:...), port 5432 failed: Network is unreachable
```

**The problem:** RunPod instances are IPv4-only, but many cloud database providers (Supabase, some AWS RDS configs) use IPv6 for direct connections.

**The fix:** Use a connection pooler that supports IPv4. For Supabase, this means using the "Shared Pooler" connection string instead of the direct connection:

```
# Instead of this (IPv6):
postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres

# Use this (IPv4 compatible):
postgresql://postgres.xxx:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

### 3. Statement Timeouts on Large Queries

**The error:**
```
psycopg2.errors.QueryCanceled: canceling statement due to statement timeout
```

**The problem:** Connection poolers often have default statement timeouts (e.g., 60 seconds). Querying 500K rows exceeds this.

**The fix:** Set a longer timeout at session start:
```python
cursor.execute("SET statement_timeout = '300s'")  # 5 minutes
```

### 4. SSH Disconnects Kill Your Job

**The problem:** Long-running jobs die when your SSH connection drops.

**The fix:** Use `tmux` to persist sessions:
```bash
# Install tmux
apt-get update && apt-get install -y tmux

# Start a named session
tmux new -s embed

# Run your script
python embed.py

# Detach: Ctrl+B, then D
# Reattach later: tmux attach -t embed
```

### 5. Model Download Timeouts

**The problem:** The first model load downloads ~500MB from HuggingFace, which can timeout.

**The fix:** Pre-download before your main script:
```bash
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext')"
```

Or use huggingface-cli:
```bash
pip install huggingface_hub
huggingface-cli download microsoft/BiomedNLP-PubMedBERT-base-uncased-abstract-fulltext
```

## Performance Tips

### 1. Monitor GPU Utilization

In a separate terminal:
```bash
watch -n 1 nvidia-smi
```

You should see 80-95% GPU utilization. If it's lower, your batch size might be too small or you're bottlenecked on data loading.

### 2. Commit to Database in Batches

Don't commit after every row. Batch your database writes:

```python
COMMIT_BATCH = 500
buffer = []

for text, embedding in generate_embeddings():
    buffer.append((text, embedding))

    if len(buffer) >= COMMIT_BATCH:
        insert_batch(buffer)
        conn.commit()
        buffer = []

# Don't forget the final batch
if buffer:
    insert_batch(buffer)
    conn.commit()
```

### 3. Use Direct PostgreSQL for Bulk Inserts

ORMs and REST APIs add overhead. For bulk operations, use `psycopg2` directly with `execute_values`:

```python
from psycopg2.extras import execute_values

def insert_embeddings(cursor, data):
    execute_values(
        cursor,
        """
        INSERT INTO embeddings (id, vector)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
        """,
        data
    )
```

## Final Numbers

For my 500K medical text embedding job:

| Metric | Value |
|--------|-------|
| Total texts | 506,205 |
| Model | PubMedBERT |
| Embedding dimension | 768 |
| GPU | RTX 4090 |
| Batch size | 64 |
| Total time | ~1.5 hours |
| Total cost | ~$0.66 |
| Throughput | ~5,600 texts/minute |

## Conclusion

RunPod makes it trivially easy to spin up GPU compute for batch jobs. The key lessons:

1. **Use domain-specific models** — PubMedBERT significantly outperforms generic models on biomedical text
2. **Watch your PyTorch version** — security patches broke older CUDA indexes
3. **Check IPv4/IPv6 compatibility** — cloud instances often don't support IPv6
4. **Use tmux** — don't let SSH disconnects kill hours of work
5. **Batch everything** — GPU encoding, database commits, all of it

The whole job cost less than a dollar and took under two hours. Compare that to days on CPU or hundreds of dollars for always-on GPU instances.

---

*Have questions or found other gotchas? Feel free to reach out.*
