---
name: dossier-format
description: Read, extend and repair Forsion research dossiers (`.dossier.md`) without breaking claim/source ids, the frontmatter counters, or the machine-produced link verdicts. Use this whenever the user asks you to work on a dossier file, add findings to a research topic, tidy a dossier's claims or sources, or explain what a verdict such as LIKELY_HALLUCINATED means.
version: 1.0.0
author: Forsion
category: Forsion
---

# Dossier format (`.dossier.md`)

## Mental model

A dossier is one question the user did **not** have an answer to, plus everything found so far.
It is plain Markdown with five known sections and a frontmatter block of counters.

Three layers live in the file, and they belong to different owners:

1. **Content** — summary, claims, sources, open questions. Yours to write and improve.
2. **Identity** — `C1`, `C7`, `S1`, `S3` plus the `dossier_next_claim` / `dossier_next_source`
   counters. Owned by the plugin. Ids are **never reused**, not even after a claim is deleted.
3. **Verdicts** — the `体检:` / `Check:` line under each source. Produced by a pure function inside
   the plugin from raw `curl` + Internet Archive observations. **Never write, guess or edit one.**

## Copy this template

```markdown
---
dossier_slug: why-agent-citations-fail
dossier_question: Why do deep-research citations look fine but fail on facts?
dossier_lang: en
dossier_version: 3
dossier_created: 2026-08-14T02:11:00.000Z
dossier_updated: 2026-08-15T09:03:12.000Z
dossier_rounds: 5
dossier_next_claim: 12
dossier_next_source: 9
---

# Why do deep-research citations look fine but fail on facts?

## Summary

Two or three sentences: the current answer, as far as the evidence goes.

## Claims

### C1 · Link validity is not factual accuracy
The reasoning. May span several lines, lists and fenced code blocks.
Cites: S1 S3 | Support: SUPPORTED

### C7 · More tool calls correlate with lower factual accuracy
Cites: S1 | Support: NOT_FOUND

## Sources

- S1 · Cited but Not Verified — https://arxiv.org/abs/2605.06635
  - Quote: "link validity above 94% ... only 39-77% factual accuracy"
  - Check: LIVE · http_200 · 2026-08-15T09:02:41.000Z
- S3 · DRBench — https://arxiv.org/abs/2604.03173

## Open questions

- The first thing still unsettled.

## Research log

- Round 3 · 2026-08-15T09:03:12.000Z · queries: "citation hallucination" · 4 sources / 7 claims
```

## Section headings are bilingual

The parser accepts either language and keeps whatever the file already uses. Pick the set that
matches `dossier_lang` and do not mix them inside one file.

| key | Chinese heading | English heading |
|---|---|---|
| summary | `## 结论摘要` | `## Summary` |
| claims | `## 断言` | `## Claims` |
| sources | `## 证据源` | `## Sources` |
| gaps | `## 未决问题` | `## Open questions` |
| log | `## 检索记录` | `## Research log` |

Any other `## …` section, and anything before the first `## …` (including the `# ` title), is
**user territory**: it round-trips verbatim. Add your own notes there if you want, but never
delete what is already in it.

The claim metadata line and the source sub-lines follow the same language:
`引注:S1 S3 ｜ 支持:SUPPORTED` in Chinese files, `Cites: S1 S3 | Support: SUPPORTED` in English ones.
`引文:` ↔ `Quote:`, `体检:` ↔ `Check:`.

## Values that are always ASCII, in both languages

- Support: `SUPPORTED` or `NOT_FOUND`. There is deliberately **no** value meaning "false".
- Verdict: `LIVE`, `DEAD`, `LIKELY_HALLUCINATED`, `UNKNOWN`.

## Hard rules (each one protects something the user cannot recover)

1. **Never invent a URL, a title, a publication date or a quotation.** A source you did not open
   does not go in the file. This is the whole point of the format.
2. **Every claim must carry at least one citation.** If you cannot cite it, put it under
   `## Open questions` instead of `## Claims`.
3. **`Support: SUPPORTED` only when a source you actually read states the claim.** Otherwise
   `NOT_FOUND`. Never assert that something is false — this format has no vocabulary for it, on
   purpose, because "no source found" and "the opposite is true" are different discoveries.
4. **Never write or change a `Check:` / `体检:` line.** Those verdicts come from real HTTP requests
   the plugin made. Writing one by hand is fabricating evidence about evidence. If a source has no
   check line, leave it without one — the plugin will fill it in.
5. **Never renumber, reuse or tidy up `Cn` / `Sn` ids.** They are referenced from claim metadata,
   from history snapshots and from the version diff. When you add a claim, take the number in
   `dossier_next_claim` and increment that field; same for `dossier_next_source`. Never lower a
   counter, even after deleting things.
6. **Keep frontmatter to top-level single-line `key: value` pairs.** The parser is deliberately
   minimal: no nesting, no multi-line values, no YAML lists. Unknown keys are preserved, so the
   user's own keys are safe as long as they stay single-line.
7. **Do not touch `dossier_slug`.** It is the file's identity: the file name, the history folder
   `.history/<slug>/`, and the index entry all key off it.
8. **One source per URL.** Before adding a source, check whether the same page is already listed
   under a different query string — the plugin de-duplicates by normalised URL and will merge them.
9. **Quote verbatim, in the source's original language**, even when the rest of the dossier is in
   another language. A translated quote is not a quote.

## What the four verdicts mean (say it this way to the user)

- `LIVE` — the URL responded just now.
- `DEAD` — it does not respond, but the Internet Archive has snapshots of it. The link rotted;
  the source was real.
- `LIKELY_HALLUCINATED` — it does not respond **and** the Internet Archive has never seen it.
  This is a statement about the address only, never about whether the content is true.
- `UNKNOWN` — not enough evidence: access control (401/403/405/429), a server error, a timeout, a
  TLS failure, or the archive itself did not answer. `UNKNOWN` is the honest default, not a
  weaker form of `DEAD`.

A source with no check line at all has simply not been checked yet.

## Typical requests and how to handle them

- *"Add what you found to my dossier"* — append claims with fresh ids from the counters, append
  the sources you actually read with verbatim quotes, bump `dossier_next_claim` /
  `dossier_next_source` / `dossier_rounds`, and add one line to `## Research log`. Leave
  `dossier_version` alone; the plugin owns it.
- *"Clean up this dossier"* — you may rewrite claim titles and bodies, merge duplicate claims
  (keep the lower id, drop the higher one, never renumber), and reorder sections. You may not
  drop citations to make a claim read better.
- *"Is this source real?"* — read the `Check:` line. If there is none, tell the user to run the
  citation check from the plugin; do not curl it yourself and write a verdict in.
