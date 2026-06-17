# Chatbot ↔ Help Content integration

The same help corpus that powers the in-product Help Center (`/help` page and the `?` drawer) can feed your chatbot. This document explains how.

---

## The corpus

**Single source of truth:** [`src/components/help/helpContent.ts`](../BackOffice.Presentation/src/components/help/helpContent.ts).

It exports a typed array `topics: HelpTopic[]`, where each topic has:

| Field | Type | Used for |
|---|---|---|
| `key` | string | Stable URL slug for retrieval (`/help?topic=key`) |
| `title` | string | Search-result label, chatbot answer headers |
| `summary` | string | One-line snippet for previews |
| `body` | markdown string | Main answer content |
| `category` | enum | `getting-started` / `how-to` / `troubleshooting` / `reference` / `explanation` |
| `keywords` | string[] | RAG boosting; chatbot match acceleration |
| `route` | string? | App route this topic auto-pairs with |

All documentation lives inside the BackOffice app itself. Each topic is reachable at `/help?topic=<key>` on the same domain — there is no separate documentation website to maintain or sync.

Adding a new topic to `helpContent.ts` automatically:
- Shows up in the in-product Help Center sidebar.
- Surfaces in the drawer's full-text search.
- Becomes available to the chatbot (after regenerating the corpus).

---

## Three ways the chatbot can consume the corpus

Pick one based on how your chatbot is hosted.

### Option 1 — Fetch the static JSON file (simplest)

The React app ships a static file at `https://<host>/help-topics.json`. Your chatbot's RAG indexer fetches it on startup or on a cron.

**Generate the file before each build:**

```powershell
cd BackOffice.Presentation
node scripts/generate-help-corpus.mjs
# writes public/help-topics.json
```

Wire it into `package.json` so it runs automatically:

```jsonc
{
  "scripts": {
    "prebuild": "node scripts/generate-help-corpus.mjs",
    "predev":   "node scripts/generate-help-corpus.mjs"
  }
}
```

After `npm run build`, the file is deployed alongside the React app. Your chatbot fetches:

```
GET https://qa.smartkart.app/help-topics.json
```

The response shape:

```jsonc
{
  "version": 1,
  "generatedAt": "2026-05-13T...",
  "categories": {
    "getting-started": { "label": "Getting started", "description": "..." },
    ...
  },
  "topics": [
    {
      "key": "what-is-the-print-helper",
      "title": "What is the Print Helper?",
      "summary": "...",
      "body": "Markdown body...",
      "category": "getting-started",
      "keywords": ["overview", "intro", ...],
      "route": null,
      "inAppUrl": "/help?topic=what-is-the-print-helper"
    },
    ...
  ]
}
```

`inAppUrl` is relative to the running BackOffice app's origin — e.g. `https://qa.smartkart.app/help?topic=...`. The chatbot should construct the absolute URL using the current `window.location.origin` when surfacing a deep link.

### Option 2 — Import directly in a Node-based RAG pipeline

If your chatbot backend is a Node service in the same monorepo, import the corpus:

```ts
import { helpAsJson, topics } from "BackOffice.Presentation/src/components/help/helpContent"

const corpus = helpAsJson()
// Feed into your vector store, e.g. pgvector / Pinecone / Qdrant.
```

No build step needed; the chatbot always has the latest content. Requires that the chatbot can import TypeScript (use `tsx` or a monorepo build setup).

### Option 3 — Backend API endpoint

If your chatbot prefers a live REST call (e.g., serverless RAG), add a minimal endpoint to BackOffice.Api:

```csharp
// BackOffice.Api/Controllers/HelpCorpusController.cs
[ApiController]
[Route("api/help")]
public class HelpCorpusController : ControllerBase
{
    [HttpGet("topics")]
    [AllowAnonymous]  // public — same content is in the React bundle anyway
    public IActionResult GetTopics()
    {
        var path = Path.Combine(Environment.WebRootPath ?? "", "help-topics.json");
        return PhysicalFile(path, "application/json");
    }
}
```

Then the chatbot calls `GET https://qa.smartkart.app/api/help/topics`.

---

## RAG indexing recommendations

For best chatbot answer quality:

1. **Chunk by topic, not by paragraph.** Each topic is already self-contained (~50–500 words). Use one embedding per topic.
2. **Include the title and summary in the indexed text** alongside the body — they're often the strongest signal for retrieval.
3. **Index keywords as a separate field** that you can boost in the retrieval query.
4. **Surface the `inAppUrl`** in the answer so users can click through to the same page inside BackOffice. Format: `https://<your-host>/help?topic=<key>`.
5. **Filter by category when appropriate.** "Why" questions → `explanation`. "How do I…" → `how-to`. "Error: …" → `troubleshooting`.

Example pgvector indexing (pseudo-SQL):

```sql
CREATE TABLE help_corpus (
  key            TEXT PRIMARY KEY,
  title          TEXT,
  summary        TEXT,
  body           TEXT,
  category       TEXT,
  keywords       TEXT[],
  embedding      vector(1536)
);

-- One row per topic. Embed (title + ". " + summary + "\n\n" + body).
```

---

## Updating the corpus

1. Edit a topic (or add a new one) in `helpContent.ts`.
2. Run `node scripts/generate-help-corpus.mjs` (or just rebuild — the prebuild hook handles it).
3. Deploy the React app — the new `help-topics.json` ships with it.
4. Your chatbot's next index refresh picks up the change.

If your chatbot indexes on a schedule, allow up to that interval before the new answer is available. If your chatbot indexes on cold start, it's instant after redeploy.

---

## One corpus

There is a **single source of truth**: `helpContent.ts`. The Help Center page (`/help`), the contextual help drawer, and the chatbot all consume the same data. Edit a topic once; every consumer picks up the change on the next build.

The deeper markdown files under `docs/print-helper/` (left over from an earlier MkDocs experiment) are no longer surfaced anywhere in the app. They can be removed, or kept as reference material for future expansion of `helpContent.ts`.
