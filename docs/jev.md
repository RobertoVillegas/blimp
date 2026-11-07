# Exploring Jev (TypeSafe) for Helium Max

Notes from 2026-11-07. **Parked:** no code uses Jev and nothing here was tested with a real key.

Decision: Tidy Tabs stays LLM-only. Jev only picks among labels you give it, so the group names (like "PHP docs & CVEs") would still need an LLM call, and splitting the job across two calls and two keys isn't worth it. Revisit for yes/no grounding checks when F04 follow-ups, F05 previews and F07 Instant Links are built.

## What Jev is

Jev is TypeSafe's "System One" decision model. It does not write text. You send a `state` (text or JSON) plus named questions, and every question comes back as a typed answer with probabilities:

| Type | Returns |
| --- | --- |
| `noul` | Probability (0–1) that the answer is yes |
| `choice` | One option from up to 255 you define, with the full distribution and a confidence |
| `score` | A position on a 2–10 level rubric |
| `box` | A bounding box in an image (Jev 1.14+) |

All questions in a request are answered in parallel against the same state.

- **Endpoints:** `POST https://api.typesafe.ai/v1/systemone` (TypeSafe key), or `POST https://openrouter.ai/api/alpha/decisions` with model `typesafe/jev-1.13` (OpenRouter key, which works with the existing OpenRouter preset). Neither is Chat Completions, so it needs its own adapter.
- **Cost and speed:** $0.042 per million input tokens; output is free. OpenRouter reports about 0.09 s median latency. A Tidy Tabs call over 30 tabs (~2k tokens) costs about $0.0001.
- **Limits:** 64k tokens per request and 32k per question by default.
- **From the extension:** both endpoints answered a test request from an extension origin. OpenRouter sends `access-control-allow-origin: *`. TypeSafe doesn't for extension origins, but service-worker requests to an origin with granted host permission skip CORS, the same way the other providers already work.

## Where it fits

Jev is good where Helium Max currently asks an LLM for JSON and then validates it. The answer space is fixed in advance, so malformed output can't happen, and the probabilities give an honest "not sure" threshold.

1. **Tidy Tabs, hybrid (rejected for now, see above).** The LLM still proposes 3–8 group names, which is the only generative step. Jev then gets one `choice` question per tab, with the group names plus `none` as options. Tabs below a confidence threshold stay ungrouped, which matches the PRD's "don't force a Misc group". This removes invalid tab IDs and duplicate assignments by construction and makes reassignment nearly free.
2. **Grounding checks for Ask Page and cross-tab answers.** A `noul` question asks "does the page text contain the answer to this question?" before or after the LLM answers. When it's low, the UI says "the page doesn't seem to say" instead of trusting the LLM's prose (PRD F04/F06: say when evidence is absent).
3. **Instant Links reranking (F07).** Candidates come from the real search adapter; Jev `choice` picks the best match among them with a probability. It can only choose URLs that were actually returned, which is exactly the PRD's "don't trust model-invented URLs".
4. **Link preview gating (F05).** After fetching a page, a `noul` asks whether it's a login wall, paywall or bot check, so the card shows "Preview unavailable" instead of summarizing a sign-in page.
5. **Cross-tab relevance (F06).** A `score` per tab against the user's question decides which tabs to include before spending LLM tokens on map/reduce.

## Where it doesn't fit

- Summaries, answers and group names: anything that produces prose still needs an LLM.
- Browser agents. The jev-ultrafast / "Jev for Chrome" projects let Jev pick the next click, but the PRD rules out autonomous navigation, and that's a different product.

## Risks

- **Two keys.** The hybrid needs an LLM profile plus a Jev key. The OpenRouter route needs only one key if the user already uses OpenRouter.
- **Calibration claims.** TypeSafe says the probabilities are calibrated across many predictions, not that each one is right. Thresholds have to be tuned on real tab sets.
- **OpenRouter's decisions endpoint is `/api/alpha/`**, so its shape may change.
- **Privacy is unchanged:** Jev is another hosted provider, so the same disclosure applies (tab titles/URLs, page text).

## Proposed spike

1. Add a `DecisionProvider` interface next to `ai/`, with adapters for TypeSafe and OpenRouter decisions and an optional "Decision model" profile in Settings.
2. Implement Tidy Tabs hybrid behind a setting, keeping the current LLM-only path as the default and fallback.
3. Build a small offline eval: about 10 saved tab sets with hand-labeled groups. Compare LLM-only and hybrid on agreement, ungrouped rate, latency and cost per run.
4. Decide from those numbers whether to extend Jev to F05–F07.
