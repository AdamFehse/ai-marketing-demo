// ============================================================
// AI 3PL Workflow Console — Client Logic
// ============================================================

const DEFAULT_WORKER = "https://ancient-bonus-67c5.adamfehse.workers.dev";

// ============================================================
// SAMPLE INPUTS — Logistics / 3PL Scenarios
// ============================================================
const SAMPLE_INPUTS = [
  {
    id: "quote-intake",
    label: "Quote Intake (messy request)",
    value: [
      "Need quote to move 4 pallets from Miami to Chicago, 4,500 lbs, liftgate delivery,",
      "pickup Friday. Customer is Acme Corp, contact Sarah at sarah@acme.com.",
      "Need rate by Thursday. They said the product is fragile so maybe extra padding.",
      "Delivery to a residential area, might need appointment."
    ].join("\n")
  },
  {
    id: "order-creation",
    label: "Order Creation (customer email)",
    value: [
      "Hi, please ship the following to our new warehouse:",
      "SKU: WH-200-BLK x 50 units",
      "SKU: WH-200-WHT x 30 units",
      "Ship to: 4500 Industrial Blvd, Suite 12, Dallas, TX 75247",
      "Attn: Mike Rodriguez, mike@bluewhale.co",
      "Ground shipping is fine. Need it by end of month.",
      "Our order number is BW-2026-0482."
    ].join("\n")
  },
  {
    id: "receiving-exception",
    label: "Receiving Exception (mismatch)",
    value: [
      "Receiving report for PO-9912 at Warehouse 3:",
      "Expected: SKU WH-200-BLK x 100, SKU WH-300-GRY x 50",
      "Received: SKU WH-200-BLK x 87 (13 short), SKU WH-300-GRY x 50",
      "2 cartons of WH-200-BLK had water damage on outer packaging.",
      "Contents seem okay but customer will need to be notified.",
      "Dock supervisor: Carlos M. — signed off at 2:15 PM."
    ].join("\n")
  },
  {
    id: "shipment-tracking",
    label: "Shipment Tracking (customer inquiry)",
    value: [
      "Customer GreenLeaf Inc is asking about their shipment.",
      "Tracking number: 1Z999AA10123456784",
      "Order number: GL-2026-0337",
      "They say it was supposed to arrive last Friday and they",
      "haven't received any updates. Their warehouse manager",
      "is asking for an ETA so they can plan staffing.",
      "Contact: jenny@greenleaf.com"
    ].join("\n")
  },
  {
    id: "vague-escalation",
    label: "Vague Escalation (angry customer)",
    value: [
      "This is the third time our shipment has been delayed. We have",
      "customers waiting and we're losing money every day this sits in",
      "your warehouse. I need someone to look into this immediately.",
      "Order #LF-8821. If I don't hear back by end of day I'm",
      "escalating to our VP to find a new 3PL partner.",
      "— Tom B., Operations Director, LeafLine Foods"
    ].join("\n")
  },
  {
    id: "short-vague",
    label: "Short & vague (inference test)",
    value: [
      "Hey, can we get a quote? 2 pallets, about 2000 lbs,",
      "going to New York. Need it soon. Thanks."
    ].join("\n")
  }
];

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function withTimeout(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, cleanup: () => clearTimeout(id) };
}

function tryParseJsonLoose(text) {
  let t = String(text || "")
    .replace(/```json\s*|```/gi, "")
    .trim();
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    t = t.slice(firstBrace, lastBrace + 1);
  }
  try {
    return JSON.parse(t);
  } catch (err) {
    if (!(err instanceof SyntaxError)) throw err;
    return JSON.parse(escapeControlCharsInJsonStrings(t));
  }
}

function escapeControlCharsInJsonStrings(jsonText) {
  let result = "";
  let inString = false;
  let escaping = false;
  for (let i = 0; i < jsonText.length; i += 1) {
    const char = jsonText[i];
    if (escaping) { result += char; escaping = false; continue; }
    if (char === "\\") { result += char; escaping = true; continue; }
    if (char === '"') { result += char; inString = !inString; continue; }
    if (!inString) { result += char; continue; }
    if (char === "\n") { result += "\\n"; continue; }
    if (char === "\r") { result += "\\r"; continue; }
    if (char === "\t") { result += "\\t"; continue; }
    const code = char.charCodeAt(0);
    if (code >= 0 && code <= 0x1f) { result += `\\u${code.toString(16).padStart(4, "0")}`; continue; }
    result += char;
  }
  return result;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, String.fromCharCode(38) + "amp;")
    .replace(/</g, String.fromCharCode(38) + "lt;")
    .replace(/>/g, String.fromCharCode(38) + "gt;")
    .replace(/"/g, String.fromCharCode(38) + "quot;")
    .replace(/'/g, String.fromCharCode(38) + "#039;");
}

function formatValue(v) {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

// ============================================================
// LOADING METER
// ============================================================

let loadingInterval = null;
let loadingValue = 0;
const loadingMessages = [
  "Extracting workflow data",
  "Classifying workflow type",
  "Validating fields",
  "Building API payload",
  "Finalizing dashboard"
];

function startLoadingMeter() {
  const bar = document.getElementById("progressBar");
  const sub = document.getElementById("loadingSub");
  if (!bar || !sub) return;
  document.body.classList.add("processing");
  loadingValue = 0;
  bar.style.width = "0%";
  let messageIndex = 0;
  sub.textContent = loadingMessages[messageIndex];
  if (loadingInterval) clearInterval(loadingInterval);
  loadingInterval = setInterval(() => {
    const jitter = Math.random() * 6 + 2;
    loadingValue = Math.min(92, loadingValue + jitter);
    bar.style.width = `${Math.round(loadingValue)}%`;
    if (loadingValue > (messageIndex + 1) * 18 && messageIndex < loadingMessages.length - 1) {
      messageIndex += 1;
      sub.textContent = loadingMessages[messageIndex];
    }
  }, 500);
}

function finishLoadingMeter() {
  const bar = document.getElementById("progressBar");
  const sub = document.getElementById("loadingSub");
  if (bar) bar.style.width = "100%";
  if (sub) sub.textContent = "Complete";
  if (loadingInterval) {
    clearInterval(loadingInterval);
    loadingInterval = null;
  }
  setTimeout(() => {
    document.body.classList.remove("processing");
  }, 350);
}

// ============================================================
// WORKER COMMUNICATION
// ============================================================

async function callWorker(workerUrl, prompt, model) {
  const { controller, cleanup } = withTimeout(30000);
  const res = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: prompt, model }),
    signal: controller.signal
  }).finally(cleanup);

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Worker request failed (${res.status}). ${body}`);
  }
  return res.json();
}

// ============================================================
// FALLBACK PARSER — Deterministic browser-side extraction
// ============================================================

const WORKFLOW_TYPES = ["quote_intake", "order_creation", "shipment_tracking", "receiving_exception", "general_ops_triage"];

const WORKFLOW_LABELS = {
  quote_intake: "Quote Intake",
  order_creation: "Order Creation",
  shipment_tracking: "Shipment Tracking",
  receiving_exception: "Receiving Exception",
  general_ops_triage: "General Ops Triage"
};

function classifyWorkflow(text) {
  const lower = text.toLowerCase();
  if (/\b(quote|rate|pricing|cost to|move|ship.*from|freight|pallet|liftgate)\b/.test(lower) && !/\b(order|sku|tracking)\b/.test(lower)) return "quote_intake";
  if (/\b(sku|order|ship to|shipping address|quantity|units|warehouse)\b/.test(lower) && !/\b(tracking|track|1z|exception|damag|short)\b/.test(lower)) return "order_creation";
  if (/\b(tracking|track number|1z|eta|where.*shipment|status.*order)\b/.test(lower)) return "shipment_tracking";
  if (/\b(receiv|expected.*received|short|damag|carton|mismatch|receiving report|dock)\b/.test(lower)) return "receiving_exception";
  return "general_ops_triage";
}

function extractOrigin(text) {
  const lower = text.toLowerCase();
  const patterns = [
    /(?:from|origin|pickup(?:\s+(?:city|location))?)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /from\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to\b/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractDestination(text) {
  const patterns = [
    /(?:to|destination|deliver(?:y)?(?:\s+(?:city|location))?)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /to\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*[,.\n]/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractPalletCount(text) {
  const m = text.match(/(\d+)\s*pallet/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractWeight(text) {
  const m = text.match(/([\d,]+(?:\.\d+)?)\s*(?:lbs?|pounds?)/i);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

function extractSpecialRequirements(text) {
  const lower = text.toLowerCase();
  const reqs = [];
  if (/\bliftgate\b/i.test(text)) reqs.push("liftgate");
  if (/\bresidential\b/i.test(text)) reqs.push("residential delivery");
  if (/\bappointment\b/i.test(text)) reqs.push("appointment required");
  if (/\bfragile\b/i.test(text)) reqs.push("fragile");
  if (/\b(extra|additional)\s+padding\b/i.test(text)) reqs.push("extra padding");
  if (/\binside\s+delivery\b/i.test(text)) reqs.push("inside delivery");
  if (/\bwhite\s+glove\b/i.test(text)) reqs.push("white glove");
  return reqs;
}

function extractPickupWindow(text) {
  const m = text.match(/pickup\s+(?:on\s+)?(?:this\s+)?(\w+)/i);
  if (m) return m[1].trim();
  const m2 = text.match(/pickup[:\s]+([^\n,.;]+)/i);
  if (m2) return m2[1].trim();
  return null;
}

function extractDeliveryWindow(text) {
  const m = text.match(/deliver(?:y)?\s+(?:by|before|on|no\s+later\s+than)\s+([^\n,.;]+)/i);
  if (m) return m[1].trim();
  const m2 = text.match(/need\s+(?:it\s+)?by\s+([^\n,.;]+)/i);
  if (m2) return m2[1].trim();
  return null;
}

function extractTrackingNumber(text) {
  const m = text.match(/\b(1Z[A-Z0-9]{6,})\b/i);
  if (m) return m[0];
  const m2 = text.match(/tracking(?:\s*(?:number|#|no))?[:\s]+([A-Z0-9\-]{6,})/i);
  if (m2) return m2[1].trim();
  return null;
}

function extractOrderNumber(text) {
  const m = text.match(/(?:order|PO|purchase)\s*(?:number|#|no)?[:\s]*([A-Z0-9\-]{4,})/i);
  if (m) return m[1].trim();
  return null;
}

function extractSKUs(text) {
  const items = [];
  const skuPattern = /SKU[:\s]*([A-Z0-9\-]+)[\s,]+x\s*(\d+)/gi;
  let match;
  while ((match = skuPattern.exec(text)) !== null) {
    items.push({ sku: match[1], quantity: parseInt(match[2], 10) });
  }
  return items;
}

function extractShippingAddress(text) {
  const addr = {};
  const streetM = text.match(/(\d+\s+[\w\s]+(?:Blvd|St|Ave|Dr|Ln|Way|Ct|Pkwy|Road|Suite|Unit)[^\n,]*)/i);
  if (streetM) addr.street1 = streetM[1].trim();

  const cityStateZip = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\s+(\d{5})/);
  if (cityStateZip) {
    addr.city = cityStateZip[1].trim();
    addr.state = cityStateZip[2];
    addr.postal_code = cityStateZip[3];
  }

  addr.country_code = "US";
  return addr;
}

function extractContactName(text) {
  const m = text.match(/(?:contact|attn)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  if (m) return m[1].trim();
  const m2 = text.match(/([A-Z][a-z]+\s+[A-Z]\.?,?\s+(?:Operations|Director|Manager|Supervisor))/);
  if (m2) return m2[1].trim();
  return null;
}

function extractEmail(text) {
  const m = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
  return m ? m[0] : null;
}

function extractClientName(text) {
  const m = text.match(/(?:customer|client)\s+(?:is\s+)?([A-Z][\w\s]+?)(?:,|\s+contact)/i);
  if (m) return m[1].trim();
  const m2 = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:Inc|Corp|LLC|Co|Ltd|Foods|Group)\b/);
  if (m2) return m2[0].trim();
  return null;
}

function extractExpectedReceived(text) {
  const result = { expected: [], received: [], damage: false, shortage: false };
  const expectedM = text.match(/expected[:\s]+(.*?)(?:received|$)/i);
  const receivedM = text.match(/received[:\s]+(.*?)(?:\n\n|dock|sign|$)/i);
  if (expectedM) {
    const skuPairs = expectedM[1].match(/SKU[:\s]*([A-Z0-9\-]+)[\s,]+x\s*(\d+)/gi);
    if (skuPairs) {
      skuPairs.forEach(p => {
        const parts = p.match(/SKU[:\s]*([A-Z0-9\-]+)[\s,]+x\s*(\d+)/i);
        if (parts) result.expected.push({ sku: parts[1], quantity: parseInt(parts[2], 10) });
      });
    }
  }
  if (receivedM) {
    const skuPairs = receivedM[1].match(/SKU[:\s]*([A-Z0-9\-]+)[\s,]+x\s*(\d+)/gi);
    if (skuPairs) {
      skuPairs.forEach(p => {
        const parts = p.match(/SKU[:\s]*([A-Z0-9\-]+)[\s,]+x\s*(\d+)/i);
        if (parts) result.received.push({ sku: parts[1], quantity: parseInt(parts[2], 10) });
      });
    }
  }
  if (/\bdamag/i.test(text)) result.damage = true;
  if (/\bshort\b|\bshortage\b/i.test(text)) result.shortage = true;
  return result;
}

function detectExceptionRisk(text) {
  const lower = text.toLowerCase();
  let score = 0;
  if (/\bdamag/i.test(text)) score += 2;
  if (/\bshort\b|\bshortage\b|\bmissing\b/i.test(text)) score += 2;
  if (/\bmismatch/i.test(text)) score += 2;
  if (/\blate|delay/i.test(text)) score += 1;
  if (/\bcomplain|angry|frustrat|third time/i.test(text)) score += 2;
  if (/\bescalat/i.test(text)) score += 2;
  if (/\bnew 3pl|new partner|other partner/i.test(text)) score += 2;
  if (/\blosing money/i.test(text)) score += 1;
  if (score >= 4) return "high";
  if (score >= 2) return "medium";
  return "low";
}

function detectPriority(text) {
  const lower = text.toLowerCase();
  if (/\bimmediately|asap|urgent|right away/i.test(text)) return "high";
  if (/\bthird time|escalat|losing money|new partner/i.test(lower)) return "high";
  if (/\bby end of (day|week|month)|need.*soon|need.*by/i.test(lower)) return "medium";
  return "low";
}

function computeCompleteness(structuredData, missingFields) {
  const allFields = ["origin", "destination", "pallet_count", "weight_lbs", "pickup_window", "delivery_window", "tracking_number", "order_number", "shipping_address", "items"];
  const filledCount = allFields.filter(f => {
    const val = structuredData[f];
    if (val === null || val === undefined || val === "") return false;
    if (Array.isArray(val) && val.length === 0) return false;
    if (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0) return false;
    return true;
  }).length;
  return Math.round((filledCount / allFields.length) * 100);
}

function buildMissingFields(structuredData, workflowType) {
  const missing = [];
  const requiredByType = {
    quote_intake: ["origin", "destination", "pallet_count", "weight_lbs", "pickup_window"],
    order_creation: ["shipping_address", "items"],
    shipment_tracking: ["tracking_number", "order_number"],
    receiving_exception: ["items"],
    general_ops_triage: ["order_number"]
  };
  const required = requiredByType[workflowType] || [];
  const fieldLabels = {
    origin: "Origin city/location",
    destination: "Destination city/location",
    pallet_count: "Pallet count",
    weight_lbs: "Weight (lbs)",
    pickup_window: "Pickup window",
    delivery_window: "Delivery deadline",
    tracking_number: "Tracking number",
    order_number: "Order number",
    shipping_address: "Shipping address",
    items: "Line items (SKU/qty)"
  };
  for (const field of required) {
    const val = structuredData[field];
    const isEmpty = val === null || val === undefined || val === "" ||
      (Array.isArray(val) && val.length === 0) ||
      (typeof val === "object" && !Array.isArray(val) && Object.keys(val).length === 0);
    if (isEmpty) {
      missing.push({ field, label: fieldLabels[field] || field, hint: `Required for ${WORKFLOW_LABELS[workflowType] || workflowType}` });
    }
  }
  return missing;
}

function buildValidationWarnings(structuredData, text) {
  const warnings = [];
  if (structuredData.weight_lbs && structuredData.weight_lbs > 20000) {
    warnings.push("Weight exceeds 20,000 lbs — may require LTL or FTL reclassification.");
  }
  if (structuredData.pallet_count && structuredData.pallet_count > 20) {
    warnings.push("High pallet count — verify FTL vs LTL routing.");
  }
  if (structuredData.special_requirements && structuredData.special_requirements.length > 2) {
    warnings.push("Multiple special requirements — confirm all accessorial charges.");
  }
  if (/\bfragile\b/i.test(text) && !/\bpadding|protect|wrap\b/i.test(text)) {
    warnings.push("Fragile goods mentioned but no packaging instructions specified.");
  }
  if (/\bresidential\b/i.test(text) && !/\bliftgate\b/i.test(text)) {
    warnings.push("Residential delivery without liftgate — confirm delivery requirements.");
  }
  return warnings;
}

function buildRecommendedActions(workflowType, structuredData, missingFields, exceptionRisk) {
  const actions = [];
  if (missingFields.length > 0) {
    actions.push({
      action: `Request missing fields: ${missingFields.map(f => f.label).join(", ")}`,
      owner: "customer_service",
      reason: "Cannot process workflow without required data."
    });
  }
  if (workflowType === "quote_intake") {
    actions.push({ action: "Generate freight quote with extracted parameters", owner: "system", reason: "Quote request has sufficient data to auto-generate." });
    if (structuredData.special_requirements && structuredData.special_requirements.length > 0) {
      actions.push({ action: `Verify accessorial charges: ${structuredData.special_requirements.join(", ")}`, owner: "operator", reason: "Special requirements affect pricing." });
    }
  }
  if (workflowType === "order_creation") {
    actions.push({ action: "Validate order against WMS inventory", owner: "system", reason: "Confirm SKU availability before processing." });
    actions.push({ action: "Create shipment in TMS", owner: "system", reason: "Order data is ready for TMS entry." });
  }
  if (workflowType === "shipment_tracking") {
    actions.push({ action: "Query carrier API for tracking status", owner: "system", reason: "Tracking number available for automated lookup." });
    actions.push({ action: "Send status update to customer", owner: "customer_service", reason: "Customer is waiting for ETA." });
  }
  if (workflowType === "receiving_exception") {
    actions.push({ action: "File receiving discrepancy report", owner: "operator", reason: "Quantity mismatch or damage detected." });
    actions.push({ action: "Notify customer of exception", owner: "customer_service", reason: "Customer needs to be informed of shortage/damage." });
  }
  if (workflowType === "general_ops_triage" && exceptionRisk === "high") {
    actions.push({ action: "Escalate to supervisor for review", owner: "supervisor", reason: "High exception risk detected in customer communication." });
    actions.push({ action: "Prioritize response within 1 hour", owner: "customer_service", reason: "Customer expressed urgency or dissatisfaction." });
  }
  if (exceptionRisk === "high") {
    actions.push({ action: "Flag account for retention review", owner: "supervisor", reason: "Multiple risk signals detected." });
  }
  return actions;
}

function buildSuggestedReply(workflowType, structuredData, missingFields) {
  if (missingFields.length === 0) {
    const replies = {
      quote_intake: `Thank you for your quote request. We're preparing a rate for ${structuredData.pallet_count || "?"} pallet(s) from ${structuredData.origin || "origin"} to ${structuredData.destination || "destination"}. You'll receive the quote shortly.`,
      order_creation: `We've received your order and are processing it now. We'll confirm shipment details once the order is validated against inventory.`,
      shipment_tracking: `We're looking up the status of your shipment now. We'll provide an ETA as soon as we have an update from the carrier.`,
      receiving_exception: `We've noted the receiving discrepancy and are investigating. We'll follow up with a resolution shortly.`,
      general_ops_triage: `Thank you for reaching out. We're reviewing your request and will get back to you shortly.`
    };
    return replies[workflowType] || replies.general_ops_triage;
  }
  const fieldList = missingFields.map(f => f.label).join(", ");
  return `Thank you for your request. To process this efficiently, we need a few more details: ${fieldList}. Could you provide these so we can move forward?`;
}

function buildApiPayload(workflowType, structuredData) {
  if (workflowType === "order_creation") {
    const addr = structuredData.shipping_address || {};
    return {
      store_id: 1,
      warehouse_id: 1,
      shipping_method_name: "Ground Shipping",
      shipping_address: {
        first_name: "",
        last_name: structuredData.contact_name || "",
        street1: addr.street1 || "",
        city: addr.city || "",
        state: addr.state || "",
        postal_code: addr.postal_code || "",
        country_code: addr.country_code || "US"
      },
      items: (structuredData.items || []).map(item => ({
        sku: item.sku || "",
        quantity: item.quantity || 1
      }))
    };
  }
  if (workflowType === "quote_intake") {
    return {
      origin: structuredData.origin || null,
      destination: structuredData.destination || null,
      pallet_count: structuredData.pallet_count || null,
      weight_lbs: structuredData.weight_lbs || null,
      special_requirements: structuredData.special_requirements || [],
      pickup_window: structuredData.pickup_window || null,
      delivery_window: structuredData.delivery_window || null,
      service_level: "LTL"
    };
  }
  if (workflowType === "shipment_tracking") {
    return {
      tracking_number: structuredData.tracking_number || null,
      order_number: structuredData.order_number || null,
      carrier: "auto-detect"
    };
  }
  return structuredData;
}

function runFallbackParser(text) {
  const workflowType = classifyWorkflow(text);
  const structuredData = {
    origin: extractOrigin(text),
    destination: extractDestination(text),
    pallet_count: extractPalletCount(text),
    weight_lbs: extractWeight(text),
    special_requirements: extractSpecialRequirements(text),
    pickup_window: extractPickupWindow(text),
    delivery_window: extractDeliveryWindow(text),
    tracking_number: extractTrackingNumber(text),
    order_number: extractOrderNumber(text),
    shipping_address: extractShippingAddress(text),
    items: extractSKUs(text),
    contact_name: extractContactName(text),
    contact_email: extractEmail(text),
    client_name: extractClientName(text)
  };

  const missingFields = buildMissingFields(structuredData, workflowType);
  const validationWarnings = buildValidationWarnings(structuredData, text);
  const exceptionRisk = detectExceptionRisk(text);
  const priority = detectPriority(text);
  const completeness = computeCompleteness(structuredData, missingFields);
  const recommendedActions = buildRecommendedActions(workflowType, structuredData, missingFields, exceptionRisk);
  const suggestedReply = buildSuggestedReply(workflowType, structuredData, missingFields);
  const apiPayload = buildApiPayload(workflowType, structuredData);

  const summaryParts = [];
  if (structuredData.client_name) summaryParts.push(`Client: ${structuredData.client_name}`);
  summaryParts.push(`Workflow: ${WORKFLOW_LABELS[workflowType]}`);
  if (structuredData.origin && structuredData.destination) summaryParts.push(`${structuredData.origin} → ${structuredData.destination}`);
  if (structuredData.pallet_count) summaryParts.push(`${structuredData.pallet_count} pallet(s)`);
  if (structuredData.weight_lbs) summaryParts.push(`${structuredData.weight_lbs.toLocaleString()} lbs`);
  if (structuredData.tracking_number) summaryParts.push(`Tracking: ${structuredData.tracking_number}`);
  if (structuredData.order_number) summaryParts.push(`Order: ${structuredData.order_number}`);

  return {
    workflow_type: workflowType,
    summary: summaryParts.join(". ") + ".",
    priority,
    completeness_score: completeness,
    exception_risk: exceptionRisk,
    structured_data: structuredData,
    missing_fields: missingFields,
    validation_warnings: validationWarnings,
    recommended_actions: recommendedActions,
    suggested_customer_reply: suggestedReply,
    api_payload: apiPayload,
    confidence: completeness >= 80 ? "high" : completeness >= 50 ? "medium" : "low",
    _source: "fallback"
  };
}

// ============================================================
// NORMALIZE AI WORKER OUTPUT
// ============================================================

function normalizeWorkerResult(raw) {
  const structuredData = raw.structured_data || {};
  const workflowType = WORKFLOW_TYPES.includes(raw.workflow_type) ? raw.workflow_type : classifyWorkflow(raw.summary || "");

  // Merge with fallback for any missing structured fields
  const normalizedData = {
    origin: structuredData.origin || null,
    destination: structuredData.destination || null,
    pallet_count: structuredData.pallet_count != null ? Number(structuredData.pallet_count) || null : null,
    weight_lbs: structuredData.weight_lbs != null ? Number(structuredData.weight_lbs) || null : null,
    special_requirements: Array.isArray(structuredData.special_requirements) ? structuredData.special_requirements : [],
    pickup_window: structuredData.pickup_window || null,
    delivery_window: structuredData.delivery_window || null,
    tracking_number: structuredData.tracking_number || null,
    order_number: structuredData.order_number || null,
    shipping_address: structuredData.shipping_address || {},
    items: Array.isArray(structuredData.items) ? structuredData.items.map(item => ({
      sku: item.sku || "",
      quantity: Number(item.quantity) || 1
    })) : [],
    contact_name: structuredData.contact_name || null,
    contact_email: structuredData.contact_email || null,
    client_name: structuredData.client_name || null
  };

  const missingFields = Array.isArray(raw.missing_fields)
    ? raw.missing_fields.map(f => typeof f === "string" ? { field: f, label: f, hint: "" } : f)
    : [];
  const validationWarnings = Array.isArray(raw.validation_warnings)
    ? raw.validation_warnings.map(w => typeof w === "string" ? w : String(w))
    : [];
  const recommendedActions = Array.isArray(raw.recommended_actions)
    ? raw.recommended_actions.map(a => ({
        action: a.action || a.item || "",
        owner: a.owner || "operator",
        reason: a.reason || a.rationale || ""
      }))
    : [];

  const completeness = typeof raw.completeness_score === "number"
    ? Math.min(100, Math.max(0, raw.completeness_score))
    : computeCompleteness(normalizedData, missingFields);

  return {
    workflow_type: workflowType,
    summary: String(raw.summary || "").trim() || "No summary generated.",
    priority: ["high", "medium", "low"].includes(raw.priority) ? raw.priority : "medium",
    completeness_score: completeness,
    exception_risk: ["high", "medium", "low"].includes(raw.exception_risk) ? raw.exception_risk : "low",
    structured_data: normalizedData,
    missing_fields: missingFields,
    validation_warnings: validationWarnings,
    recommended_actions: recommendedActions,
    suggested_customer_reply: String(raw.suggested_customer_reply || "").trim() || "",
    api_payload: raw.api_payload || buildApiPayload(workflowType, normalizedData),
    confidence: ["high", "medium", "low"].includes(raw.confidence) ? raw.confidence : "medium",
    _source: raw._source || "ai"
  };
}

// ============================================================
// MAIN PROCESSING
// ============================================================

async function processContent() {
  const inputTextElement = document.getElementById("inputText");
  const runBtn = document.getElementById("runBtn");
  const loadingElement = document.getElementById("loading");
  const resultsElement = document.getElementById("results");
  const debugJsonElement = document.getElementById("debugJson");
  const debugSectionElement = document.getElementById("debugSection");
  const modelSelectElement = document.getElementById("modelSelect");

  const inputText = inputTextElement.value.trim();

  if (!inputText) {
    showToast("Please enter logistics content to analyze.");
    return;
  }

  runBtn.disabled = true;
  loadingElement.classList.remove("hidden");
  resultsElement.classList.add("hidden");
  startLoadingMeter();

  let result;

  try {
    // Try AI worker first
    const model = modelSelectElement?.value || "";
    const data1 = await callWorker(DEFAULT_WORKER, inputText, model);
    let rawResult;
    try {
      const raw1 = data1?.choices?.[0]?.message?.content || "";
      rawResult = raw1 ? tryParseJsonLoose(raw1) : data1;
    } catch (e) {
      // Retry once
      try {
        const data2 = await callWorker(DEFAULT_WORKER, inputText, model);
        const raw2 = data2?.choices?.[0]?.message?.content || "";
        rawResult = raw2 ? tryParseJsonLoose(raw2) : data2;
      } catch (e2) {
        // Second parse failed, use fallback
        rawResult = null;
      }
    }
    if (rawResult) {
      result = normalizeWorkerResult(rawResult);
    } else {
      result = runFallbackParser(inputText);
    }
  } catch (error) {
    // Worker unreachable — use fallback parser
    result = runFallbackParser(inputText);
    result._source = "fallback";
  }

  // Show debug JSON
  debugJsonElement.textContent = JSON.stringify(result, null, 2);
  debugSectionElement.classList.remove("hidden");

  // Render all panels
  renderMetrics(result);
  renderSummary(result);
  renderStructuredData(result);
  renderMissingFields(result);
  renderRecommendedActions(result);
  renderSuggestedReply(result);
  renderApiPayload(result);
  renderConfidence(result);

  resultsElement.classList.remove("hidden");
  finishLoadingMeter();
  loadingElement.classList.add("hidden");
  runBtn.disabled = false;
}

// ============================================================
// RENDER FUNCTIONS
// ============================================================

function renderMetrics(result) {
  // Priority
  const priorityCard = document.getElementById("priorityCard");
  priorityCard.classList.remove("priority-high", "priority-medium", "priority-low");
  const pClass = `priority-${result.priority}`;
  priorityCard.classList.add(pClass);
  document.getElementById("priorityValue").textContent = result.priority.charAt(0).toUpperCase() + result.priority.slice(1);
  const prioritySubs = { high: "Immediate attention needed", medium: "Process within SLA", low: "Normal queue" };
  document.getElementById("prioritySub").textContent = prioritySubs[result.priority] || "";

  // Workflow
  document.getElementById("workflowValue").textContent = WORKFLOW_LABELS[result.workflow_type] || result.workflow_type;
  document.getElementById("workflowSub").textContent = "Classified workflow type";

  // Completeness
  const score = result.completeness_score;
  document.getElementById("completenessValue").textContent = `${score}%`;
  const compSubs = { high: "Most fields populated", medium: "Some fields missing", low: "Key fields missing" };
  document.getElementById("completenessSub").textContent = score >= 80 ? compSubs.high : score >= 50 ? compSubs.medium : compSubs.low;

  // Exception Risk
  const exceptionCard = document.getElementById("exceptionCard");
  exceptionCard.classList.remove("exception-high", "exception-medium", "exception-low");
  exceptionCard.classList.add(`exception-${result.exception_risk}`);
  document.getElementById("exceptionValue").textContent = result.exception_risk.charAt(0).toUpperCase() + result.exception_risk.slice(1);
  const riskSubs = { high: "Escalation likely", medium: "Monitor closely", low: "No flags" };
  document.getElementById("exceptionSub").textContent = riskSubs[result.exception_risk] || "";
}

function renderSummary(result) {
  document.getElementById("summary").textContent = result.summary || "No summary available.";
}

function renderStructuredData(result) {
  const container = document.getElementById("structuredData");
  const data = result.structured_data || {};
  const fields = [
    { key: "client_name", label: "Client" },
    { key: "contact_name", label: "Contact" },
    { key: "contact_email", label: "Email" },
    { key: "origin", label: "Origin" },
    { key: "destination", label: "Destination" },
    { key: "pallet_count", label: "Pallets" },
    { key: "weight_lbs", label: "Weight (lbs)" },
    { key: "pickup_window", label: "Pickup Window" },
    { key: "delivery_window", label: "Delivery Window" },
    { key: "tracking_number", label: "Tracking #" },
    { key: "order_number", label: "Order #" }
  ];

  let html = '<table class="data-table"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>';
  for (const field of fields) {
    const val = data[field.key];
    const isEmpty = val === null || val === undefined || val === "";
    html += `<tr><td>${escapeHtml(field.label)}</td><td class="${isEmpty ? "missing" : "present"}">${isEmpty ? "— not provided —" : escapeHtml(String(val))}</td></tr>`;
  }

  // Special requirements
  const reqs = data.special_requirements || [];
  html += `<tr><td>Special Req.</td><td class="${reqs.length ? "present" : "missing"}">${reqs.length ? reqs.map(r => escapeHtml(r)).join(", ") : "— none —"}</td></tr>`;

  // Shipping address
  const addr = data.shipping_address || {};
  const addrParts = [addr.street1, addr.city, addr.state, addr.postal_code].filter(Boolean);
  html += `<tr><td>Ship-To Address</td><td class="${addrParts.length ? "present" : "missing"}">${addrParts.length ? escapeHtml(addrParts.join(", ")) : "— not provided —"}</td></tr>`;

  // Items
  const items = data.items || [];
  if (items.length) {
    html += `<tr><td>Line Items</td><td class="present">${items.map(i => escapeHtml(`${i.sku} x ${i.quantity}`)).join("<br>")}</td></tr>`;
  } else {
    html += `<tr><td>Line Items</td><td class="missing">— none extracted —</td></tr>`;
  }

  html += "</tbody></table>";
  container.innerHTML = html;
}

function renderMissingFields(result) {
  const missingContainer = document.getElementById("missingFieldsList");
  const warningsContainer = document.getElementById("validationWarnings");

  const missing = result.missing_fields || [];
  if (missing.length === 0) {
    missingContainer.innerHTML = '<div class="action-meta">All required fields present ✓</div>';
  } else {
    missingContainer.innerHTML = missing.map(f =>
      `<div class="missing-field"><span class="field-name">${escapeHtml(f.label || f.field)}</span><span class="field-hint">— ${escapeHtml(f.hint || "required")}</span></div>`
    ).join("");
  }

  const warnings = result.validation_warnings || [];
  if (warnings.length === 0) {
    warningsContainer.innerHTML = '<div class="action-meta">No validation warnings ✓</div>';
  } else {
    warningsContainer.innerHTML = warnings.map(w =>
      `<div class="validation-warning">⚠ ${escapeHtml(typeof w === "string" ? w : String(w))}</div>`
    ).join("");
  }
}

function renderRecommendedActions(result) {
  const container = document.getElementById("actions");
  const actions = result.recommended_actions || [];
  const groups = { system: [], operator: [], customer_service: [], supervisor: [], other: [] };

  actions.forEach(a => {
    const owner = String(a.owner || "").toLowerCase();
    if (owner.includes("system")) groups.system.push(a);
    else if (owner.includes("operator")) groups.operator.push(a);
    else if (owner.includes("customer") || owner.includes("cs")) groups.customer_service.push(a);
    else if (owner.includes("supervisor")) groups.supervisor.push(a);
    else groups.other.push(a);
  });

  const ownerLabels = {
    system: "System (Automated)",
    operator: "Operator",
    customer_service: "Customer Service",
    supervisor: "Supervisor",
    other: "Unassigned"
  };

  container.innerHTML = [
    renderActionGroup(ownerLabels.system, groups.system),
    renderActionGroup(ownerLabels.operator, groups.operator),
    renderActionGroup(ownerLabels.customer_service, groups.customer_service),
    renderActionGroup(ownerLabels.supervisor, groups.supervisor),
    renderActionGroup(ownerLabels.other, groups.other)
  ].filter(Boolean).join("");

  container.querySelectorAll(".action-btn").forEach(btn => {
    btn.addEventListener("click", () => showToast("Action created."));
  });
}

function renderActionGroup(title, items) {
  if (!items.length) return "";
  const rows = items.map(item => {
    const reason = item.reason ? `<div class="action-meta">${escapeHtml(item.reason)}</div>` : "";
    return [
      '<div class="action-row">',
      `<div><strong>${escapeHtml(item.action)}</strong>${reason}</div>`,
      '<button class="action-btn" type="button">Create</button>',
      "</div>"
    ].join("");
  }).join("");
  return `<div class="action-group"><h4>${escapeHtml(title)}</h4>${rows}</div>`;
}

function renderSuggestedReply(result) {
  document.getElementById("draftReply").textContent = result.suggested_customer_reply || "No reply template generated.";
}

let currentPayloadTab = "order";

function renderApiPayload(result) {
  const payload = result.api_payload || {};
  const payloadEl = document.getElementById("apiPayload");

  // Store all payload variants
  window._payloadCache = {
    order: result.workflow_type === "order_creation" ? payload : buildApiPayload("order_creation", result.structured_data || {}),
    quote: result.workflow_type === "quote_intake" ? payload : buildApiPayload("quote_intake", result.structured_data || {}),
    tracking: result.workflow_type === "shipment_tracking" ? payload : buildApiPayload("shipment_tracking", result.structured_data || {})
  };

  // Show the tab matching the workflow type
  const tabMap = { quote_intake: "quote", order_creation: "order", shipment_tracking: "tracking" };
  const defaultTab = tabMap[result.workflow_type] || "order";
  switchPayloadTab(defaultTab);
}

function switchPayloadTab(tab) {
  currentPayloadTab = tab;
  const payloadEl = document.getElementById("apiPayload");
  const cache = window._payloadCache || {};
  payloadEl.textContent = JSON.stringify(cache[tab] || {}, null, 2);

  document.querySelectorAll(".payload-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });
}

function renderConfidence(result) {
  const banner = document.getElementById("confidenceBanner");
  if (!banner) return;
  const confidence = String(result?.confidence || "").toLowerCase();
  banner.classList.remove("medium");
  if (!confidence || confidence === "high") {
    banner.classList.add("hidden");
    banner.textContent = "";
    return;
  }
  if (confidence === "medium") {
    banner.textContent = `Medium confidence${result._source === "fallback" ? " (offline mode)" : ""}: review the output before acting.`;
    banner.classList.add("medium");
  } else {
    banner.textContent = `Low confidence${result._source === "fallback" ? " (offline mode)" : ""}: verify details before acting on this analysis.`;
  }
  banner.classList.remove("hidden");
}

// ============================================================
// UI HELPERS
// ============================================================

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function setInputText(value, toastMessage) {
  const inputTextElement = document.getElementById("inputText");
  if (!inputTextElement) return;
  inputTextElement.value = value;
  inputTextElement.focus();
  if (toastMessage) showToast(toastMessage);
}

function insertSampleInput() {
  const sampleSelect = document.getElementById("sampleSelect");
  const selectedId = sampleSelect?.value || "";
  const selected = SAMPLE_INPUTS.find((sample) => sample.id === selectedId);
  if (!selected) {
    showToast("Choose a sample first.");
    return;
  }
  setInputText(selected.value, "Sample loaded.");
}

function populateSampleSelect() {
  const sampleSelect = document.getElementById("sampleSelect");
  if (!sampleSelect) return;
  const options = SAMPLE_INPUTS.map((sample) =>
    `<option value="${escapeHtml(sample.id)}">${escapeHtml(sample.label)}</option>`
  ).join("");
  sampleSelect.insertAdjacentHTML("beforeend", options);
}

async function loadModelInfo() {
  const modelRow = document.getElementById("modelRow");
  const modelSelect = document.getElementById("modelSelect");
  try {
    const { controller, cleanup } = withTimeout(6000);
    const res = await fetch(DEFAULT_WORKER, { method: "GET", signal: controller.signal });
    cleanup();
    if (!res.ok) throw new Error("Worker not reachable");
    const data = await res.json().catch(() => ({}));
    if (!modelSelect) return;
    let models = [];
    if (Array.isArray(data?.allowed_models)) {
      models = data.allowed_models;
    } else if (typeof data?.allowed_models === "string") {
      models = data.allowed_models.split(",").map((m) => m.trim()).filter(Boolean);
    } else if (data?.model) {
      models = [data.model];
    }
    if (models.length) {
      modelSelect.innerHTML = models
        .map((m) => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`)
        .join("");
      modelSelect.value = data.model || models[0];
      modelRow?.classList.remove("hidden");
    }
  } catch (e) {
    // Ignore; dropdown stays hidden when worker is unreachable.
  }
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
  loadModelInfo();
  populateSampleSelect();

  // Attach event listeners (no inline onclick)
  const runBtn = document.getElementById("runBtn");
  if (runBtn) runBtn.addEventListener("click", processContent);

  const insertBtn = document.getElementById("insertSampleBtn");
  if (insertBtn) insertBtn.addEventListener("click", insertSampleInput);

  // Payload tab switching
  document.querySelectorAll(".payload-tab").forEach(tab => {
    tab.addEventListener("click", () => switchPayloadTab(tab.dataset.tab));
  });

  // Copy payload button
  const copyBtn = document.getElementById("copyPayloadBtn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const payloadEl = document.getElementById("apiPayload");
      if (payloadEl && payloadEl.textContent) {
        navigator.clipboard.writeText(payloadEl.textContent).then(() => {
          showToast("Payload copied to clipboard.");
        }).catch(() => {
          showToast("Copy failed — select and copy manually.");
        });
      }
    });
  }
});
