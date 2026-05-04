# AI 3PL Workflow Console

[DEMO](https://adamfehse.github.io/ai-marketing-demo/)

## What it is

A lightweight, browser-based operations console that turns messy logistics emails, quote requests, and ops notes into structured workflow data, missing-field checks, recommended operator actions, customer replies, and API-ready payloads. Built as a demo for RK Logistics Group / 3PL AI Product Builder interviews.

## Use cases

- **Quote Intake** — Parse a messy freight quote request into origin, destination, pallet count, weight, and special requirements.
- **Order Creation** — Extract SKUs, quantities, and shipping addresses into a Warehance-style API payload.
- **Shipment Tracking** — Pull tracking numbers and order IDs from customer inquiries for carrier API lookups.
- **Receiving Exception** — Detect quantity mismatches, damage, and shortages from dock reports.
- **General Ops Triage** — Classify and prioritize vague escalations or complaints.

## Data flow

- The browser sends your input text to a Cloudflare Worker.
- The Worker calls an NVIDIA NIM model and returns structured JSON.
- The UI renders results and local text analytics in the browser.
- **If the AI worker is unreachable**, a deterministic fallback parser extracts data using regex/heuristics — the demo always works.

## Production workflow (n8n orchestration)

```
Webhook / Gmail → AI Extraction → Validation Branches → Customer Reply / Task Creation → WMS / TMS / CRM API → Operator Dashboard
```

The intended orchestration layer is **n8n**:

1. **Trigger** — Webhook or Gmail node receives incoming email/form.
2. **AI Extraction** — Calls the Worker (or equivalent) to parse unstructured text into structured JSON.
3. **Validation** — Branches on `completeness_score` and `missing_fields`:
   - Complete → route to API call (WMS/TMS/CRM).
   - Incomplete → send clarification reply to customer, create operator task.
4. **Routing** — Based on `workflow_type`:
   - `quote_intake` → rate engine / quoting tool.
   - `order_creation` → WMS order API (Warehance, ShipBob, etc.).
   - `shipment_tracking` → carrier tracking API.
   - `receiving_exception` → WMS receiving module + customer notification.
   - `general_ops_triage` → operator dashboard / Slack alert.
5. **Logging** — All results logged to CRM / data warehouse.

## Output panels

| Panel | Description |
|-------|-------------|
| Operations Summary | 2-sentence summary of the workflow |
| Structured Data | Extracted shipment/order fields in a table |
| Missing Fields & Validation | Required fields that are empty + validation warnings |
| Recommended Operator Actions | Action items grouped by owner (system, operator, CS, supervisor) |
| Suggested Customer Reply | Draft reply to send to the customer |
| API Payload | Warehance-style JSON for order creation, quote, or tracking |
| Production Workflow | Visual diagram of the n8n orchestration pipeline |

## Metrics

| Metric | Values | Meaning |
|--------|--------|---------|
| Priority | High / Medium / Low | How urgently the workflow needs attention |
| Workflow | Quote / Order / Tracking / Receiving / Triage | Classified workflow type |
| Completeness | 0–100% | Percentage of required fields populated |
| Exception Risk | High / Medium / Low | Likelihood of escalation or exception |

## Sanitization and safety

- The Worker asks the model to return JSON only and parses it strictly.
- Structured data fields are sanitized and type-checked server-side.
- The model prompt treats user input as untrusted and ignores instructions inside it.
- The browser fallback parser uses regex only — no AI, no data leaves the browser.

## Security notes

- CORS is restricted via the `ALLOWED_ORIGINS` worker env var.
- No data is stored in the browser or in the Worker by default.
- If you enable webhooks (optional), only high-priority workflows are sent.
- **No real API keys, customer data, or live production APIs are required to run this demo.**

## Quick setup

1. Deploy the Worker with `NVIDIA_API_KEY`.
2. Set `ALLOWED_ORIGINS` to your site origin(s).
3. Optionally set `ALLOWED_MODELS` for the dropdown.
4. Open `index.html` or the demo link.

## Fallback mode

When the AI worker is unreachable (no API key, network error, etc.), the console automatically falls back to deterministic browser-side parsing:

- Regex-based extraction of origin, destination, pallet count, weight, tracking numbers, SKUs, etc.
- Heuristic workflow classification based on keyword patterns.
- Missing field detection based on workflow type requirements.
- Validation warnings for common issues (overweight, missing liftgate, etc.).

This ensures the demo is always functional, even fully offline.
