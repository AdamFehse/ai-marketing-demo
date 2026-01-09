# AI Marketing Demo

[DEMO](https://adamfehse.github.io/ai-marketing-demo/)

## What it is
A lightweight, browser-based intelligence dashboard that turns marketing notes into structured summaries, action items, and CRM-friendly fields. It also surfaces simple, non-AI text analytics (keyword density, urgency signals, and Markov-style transitions) to explain why outputs look the way they do.

## Use cases
- Summarize client notes and extract decisions, deadlines, and action owners.
- Draft a quick response email or follow-up note.
- Capture CRM fields like budget, priority, and next touchpoint.
- Create a quick "why" layer with simple NLP stats.

## Data flow
- The browser sends your input text to a Cloudflare Worker.
- The Worker calls an NVIDIA NIM model and returns JSON only.
- The UI renders results and local text analytics in the browser.

## Sanitization and safety
- The Worker asks the model to return JSON only and parses it strictly.
- CRM fields are sanitized and normalized server-side before returning to the UI.
- The model prompt treats user input as untrusted and ignores instructions inside it.

## Security notes
- CORS is restricted via the `ALLOWED_ORIGINS` worker env var.
- No data is stored in the browser or in the Worker by default.
- If you enable webhooks (optional), only high-priority, budgeted leads are sent.

## Quick setup
1. Deploy the Worker with `NVIDIA_API_KEY`.
2. Set `ALLOWED_ORIGINS` to your site origin(s).
3. Optionally set `ALLOWED_MODELS` for the dropdown.
4. Open `index.html` or the demo link.
