const DEFAULT_WORKER = "https://marketing-worker.adamfehse.workers.dev";
const SAMPLE_INPUTS = [
  {
    id: "quarterly-check-in",
    label: "Quarterly check-in (baseline)",
    value: [
      "Quarterly check-in with Sarah from Bloom-Tech. Relationship remains stable,",
      "and she mentioned she is happy with the current results. However, she asked",
      "for a copy of their current contract just for their internal audit.",
      "",
      "She also noted that their parent company is pushing for a 15% reduction in",
      "vendor spend across the board by the end of Q1 (March 31). They currently pay",
      "us $8k/month. I suggested we could look at a performance-based model for their",
      "upcoming Spring Rejuvenation campaign in April.",
      "",
      "She said she would be open to a proposal but needs it by Friday because she is",
      "meeting with her CFO on Monday morning. Also, she mentioned a competitor reached",
      "out to their VP of Marketing last week."
    ].join("\n")
  },
  {
    id: "aggrieved-stakeholder",
    label: "Aggrieved stakeholder (conflict/sentiment test)",
    value: [
      "Look, I am extremely disappointed. We spent $20k on the Winter Blast campaign",
      "and the tracking links were broken for the first 48 hours. I have to explain",
      "this to the board on Wednesday morning. I need a full post-mortem report and a",
      "credit for the management fees by tomorrow end of day. If we cannot get this",
      "right, we are going to have to pause all Q2 spending while we evaluate other",
      "agency partners. Contact me on my cell, do not email Jim."
    ].join("\n")
  },
  {
    id: "technical-upsell",
    label: "Technical upsell (opportunity detection)",
    value: [
      "The landing pages look great, but our sales team is complaining that they have",
      "to manually export leads into Salesforce every morning. It is a mess. If you",
      "guys can automate that sync, we can move the extra $3,500 we had earmarked for",
      "the print ads over to your retainer instead. We are hoping to have the new",
      "system live before the trade show on March 15th. Let us talk about the API",
      "requirements on our regular Friday call."
    ].join("\n")
  },
  {
    id: "ma-high-stakes",
    label: "M&A / high stakes strategy (complex context)",
    value: [
      "Confidential: Bloom-Tech is actually in the middle of being acquired by a",
      "larger holding company. Because of this, we need to standardize all our",
      "marketing reporting by Feb 1st to match their format. Our current monthly",
      "spend is $12k, but the new owners might want to consolidate vendors. We need",
      "to look indispensable right now. I need a summary of our total ROI for the",
      "last 12 months for a meeting on Monday."
    ].join("\n")
  },
  {
    id: "micro-influencer",
    label: "Micro-influencer expansion (creative/briefing)",
    value: [
      "We want to pilot a TikTok influencer program. We have a small test budget of",
      "$5k to start. I want to see a list of 10 potential creators by end of week.",
      "If the pilot hits a 3x ROAS, we can scale this to $50k in the summer. No hard",
      "deadlines yet, just exploring for now. Make sure the draft reply sounds really",
      "casual - Sarah likes to keep things low-key."
    ].join("\n")
  },
  {
    id: "short-vague",
    label: "Short & vague (inference test)",
    value: [
      "Hey, did we ever decide on the renewal? My boss is asking. I think we",
      "discussed $10k but I cannot find the email. Send over the DocuSign again when",
      "you can. We need to sign by EOM or the project pauses."
    ].join("\n")
  }
];

function withTimeout(ms) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return { controller, cleanup: () => clearTimeout(id) };
}

function tryParseJsonLoose(text) {
  // 1) Strip common fences
  let t = text.replace(/```json\s*|```/gi, "").trim();

  // 2) If there's extra text, try to extract first {...} block
  const firstBrace = t.indexOf("{");
  const lastBrace = t.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    t = t.slice(firstBrace, lastBrace + 1);
  }

  return JSON.parse(t);
}

let loadingInterval = null;
let loadingValue = 0;
const loadingMessages = [
  "Calibrating insight engine",
  "Parsing intent signals",
  "Mapping urgency and impact",
  "Synthesizing evidence trails",
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

async function processContent() {
  // Cache DOM elements to avoid repeated queries
  const inputTextElement = document.getElementById("inputText");
  const runBtn = document.getElementById("runBtn");
  const loadingElement = document.getElementById("loading");
  const resultsElement = document.getElementById("results");
  const insightsElement = document.getElementById("insights");
  const debugJsonElement = document.getElementById("debugJson");
  const debugSectionElement = document.getElementById("debugSection");
  const summaryElement = document.getElementById("summary");
  const actionsElement = document.getElementById("actions");
  const draftElement = document.getElementById("draft");
  const crmElement = document.getElementById("crm");
  const modelSelectElement = document.getElementById("modelSelect");

  const inputText = inputTextElement.value.trim();

  if (!inputText) {
    alert("Please enter content");
    return;
  }

  runBtn.disabled = true;
  loadingElement.classList.remove("hidden");
  resultsElement.classList.add("hidden");
  insightsElement.classList.add("hidden");
  startLoadingMeter();

  try {
    // 1st attempt
    const model = modelSelectElement?.value || "";
    const data1 = await callWorker(DEFAULT_WORKER, inputText, model);
    let result;
    try {
      const raw1 = data1?.choices?.[0]?.message?.content || "";
      result = raw1 ? tryParseJsonLoose(raw1) : data1;
      // Show debug JSON
      debugJsonElement.textContent = JSON.stringify(result, null, 2);
      debugSectionElement.classList.remove("hidden");
    } catch (e) {
      // 2nd attempt: ask model to output ONLY valid JSON again
      const data2 = await callWorker(DEFAULT_WORKER, inputText, model);
      const raw2 = data2?.choices?.[0]?.message?.content || "";
      result = raw2 ? tryParseJsonLoose(raw2) : data2;
    }

    // Normalize action items once and reuse
    const normalizedActionItems = normalizeActionItems(result.action_items);

    renderDashboard(result, normalizedActionItems);
    renderActionMatrix(result, normalizedActionItems);
    renderConfidence(result);
    renderInsights(result, inputText, normalizedActionItems);

    // Render results
    summaryElement.textContent = result.summary || "";
    renderActionItems(result, normalizedActionItems);
    draftElement.textContent = result.draft_content || "";

    const crm = result.crm_data || {};
    crmElement.innerHTML = Object.entries(crm)
      .map(([k, v]) => `<p><strong>${escapeHtml(k)}:</strong> ${escapeHtml(formatValue(v))}</p>`)
      .join("");

    resultsElement.classList.remove("hidden");
  } catch (error) {
    alert("Error: " + error.message);
  } finally {
    finishLoadingMeter();
    loadingElement.classList.add("hidden");
    runBtn.disabled = false;
  }
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
  const options = SAMPLE_INPUTS.map((sample) => (
    `<option value="${escapeHtml(sample.id)}">${escapeHtml(sample.label)}</option>`
  )).join("");
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

function renderDashboard(result, normalizedActionItems) {
  // Use provided normalizedActionItems if available, otherwise normalize here
  const actionItems = normalizedActionItems || normalizeActionItems(result.action_items);

  const crm = result.crm_data || {};
  const priorityInfo = normalizePriority(crm.priority);
  const priorityCard = document.getElementById("priorityCard");
  priorityCard.classList.remove("priority-high", "priority-medium", "priority-low");
  priorityCard.classList.add(priorityInfo.className);
  document.getElementById("priorityValue").textContent = priorityInfo.label;
  document.getElementById("prioritySub").textContent = priorityInfo.sub;

  const budgetValue = crm.budget ? String(crm.budget) : "—";
  document.getElementById("budgetValue").textContent = budgetValue;
  document.getElementById("budgetSub").textContent = crm.budget ? "Budget extracted" : "Not specified";

  const rawDeadlines = [];
  if (crm.deadline) rawDeadlines.push(String(crm.deadline));
  for (const item of actionItems) {
    if (item?.deadline) rawDeadlines.push(String(item.deadline));
  }
  const parsedDeadlines = rawDeadlines
    .map((value) => parseDeadline(value))
    .filter(Boolean);
  const deadlineDate = pickSoonestDeadline(parsedDeadlines);
  const deadlineValueEl = document.getElementById("deadlineValue");
  const deadlineSubEl = document.getElementById("deadlineSub");
  if (deadlineDate) {
    const daysRemaining = daysBetween(new Date(), deadlineDate);
    const absDays = Math.abs(daysRemaining);
    if (daysRemaining >= 0) {
      deadlineValueEl.textContent = `${daysRemaining} days`;
      deadlineSubEl.textContent = `Next due: ${deadlineDate.toLocaleDateString()}`;
    } else {
      deadlineValueEl.textContent = `Overdue by ${absDays} days`;
      deadlineSubEl.textContent = `Past due: ${deadlineDate.toLocaleDateString()}`;
    }
  } else if (rawDeadlines.length) {
    deadlineValueEl.textContent = rawDeadlines[0];
    deadlineSubEl.textContent = "Timeline noted";
  } else {
    deadlineValueEl.textContent = "—";
    deadlineSubEl.textContent = "No deadline found";
  }

  const sentimentInfo = normalizeSentiment(crm.sentiment, result.summary || "");
  document.getElementById("sentimentValue").textContent = sentimentInfo.label;
  document.getElementById("sentimentSub").textContent = sentimentInfo.sub;
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
    banner.textContent = "Medium confidence: review the output before acting.";
    banner.classList.add("medium");
  } else {
    banner.textContent = "Low confidence: verify details before acting on this analysis.";
  }
  banner.classList.remove("hidden");
}

function renderActionMatrix(result, normalizedActionItems) {
  const buckets = {
    critical: document.getElementById("matrixCritical"),
    strategic: document.getElementById("matrixStrategic"),
    quick: document.getElementById("matrixQuick"),
    monitor: document.getElementById("matrixMonitor")
  };
  for (const key of Object.keys(buckets)) {
    const bucket = buckets[key];
    bucket.querySelectorAll(".matrix-item").forEach((el) => el.remove());
  }

  // Use provided normalizedActionItems if available, otherwise normalize here
  const items = normalizedActionItems || normalizeActionItems(result.action_items);

  const crm = result.crm_data || {};
  const budget = Number(crm.budget || 0);
  const highImpactGlobal = budget >= 25000 || String(crm.priority || "").toLowerCase().startsWith("high");

  if (!items.length) {
    Object.values(buckets).forEach((bucket) => {
      const row = document.createElement("div");
      row.className = "matrix-item";
      row.textContent = "No action items yet.";
      bucket.appendChild(row);
    });
    return;
  }

  items.forEach((item) => {
    const deadlineDate = parseDeadline(item.deadline);
    const days = deadlineDate ? daysBetween(new Date(), deadlineDate) : null;
    const highUrgency = days !== null && days <= 14;
    const highImpact = highImpactGlobal;
    const key = highImpact && highUrgency
      ? "critical"
      : highImpact && !highUrgency
      ? "strategic"
      : !highImpact && highUrgency
      ? "quick"
      : "monitor";
    const row = document.createElement("div");
    row.className = "matrix-item";
    row.textContent = item.item;
    buckets[key].appendChild(row);
  });
}

function renderInsights(result, inputText, normalizedActionItems) {
  const panel = document.getElementById("insights");
  if (!panel) return;

  const analysis = analyzeText(inputText || "");

  // Use provided normalizedActionItems if available, otherwise normalize here
  const items = normalizedActionItems || normalizeActionItems(result.action_items);

  const crm = result.crm_data || {};
  const evidenceCoverage = items.filter((item) => item.evidence && item.evidence !== "Not provided").length;
  const coveragePct = items.length ? Math.round((evidenceCoverage / items.length) * 100) : 0;

  const textStats = [
    statRow("Word count", String(analysis.wordCount)),
    statRow("Sentences", String(analysis.sentenceCount)),
    statRow("Avg words/sentence", String(analysis.avgWords)),
    statRow("Unique keywords", String(analysis.keywords.length)),
    statRow("Evidence coverage", `${coveragePct}%`),
  ].join("");

  const urgencyScore = computeUrgencyScore(result, analysis);
  const sentimentScore = Math.round(((analysis.sentimentScore + 1) / 2) * 100);
  const toneChips = [
    sentimentChip(analysis.sentimentScore),
    urgencyScore > 60 ? '<span class="chip urgent">High urgency</span>' : '<span class="chip">Steady pace</span>',
    crm.priority ? `<span class="chip">${escapeHtml(String(crm.priority))} priority</span>` : "",
  ].filter(Boolean).join("");

  const toneStats = [
    meterRow("Sentiment index", sentimentScore),
    meterRow("Urgency index", urgencyScore),
    `<div class="muted-small" style="margin-top: 8px;">${toneChips}</div>`,
  ].join("");

  const keywordStats = analysis.keywords.length
    ? analysis.keywords.map(([word, count]) => barRow(word, count, analysis.keywords[0][1])).join("")
    : '<div class="muted-small">No dominant keywords detected.</div>';

  const markovStats = analysis.transitions.length
    ? analysis.transitions.map((item) => statRow(item.pair, String(item.count))).join("")
    : '<div class="muted-small">Not enough text for transitions.</div>';

  const evidenceStats = buildEvidenceMap(items, result.summary || "", crm.key_requirement || "");

  document.getElementById("textStats").innerHTML = textStats;
  document.getElementById("toneStats").innerHTML = toneStats;
  document.getElementById("keywordStats").innerHTML = keywordStats;
  document.getElementById("markovStats").innerHTML = markovStats;
  document.getElementById("evidenceStats").innerHTML = evidenceStats;

  panel.classList.remove("hidden");
}

function renderActionItems(result, normalizedActionItems) {
  const container = document.getElementById("actions");
  const groups = { us: [], client: [], shared: [], other: [] };

  // Use provided normalizedActionItems if available, otherwise normalize here
  const items = normalizedActionItems || normalizeActionItems(result.action_items);

  items.forEach((item) => {
    const owner = String(item.owner || "").toLowerCase();
    if (owner.includes("client")) groups.client.push(item);
    else if (owner.includes("shared")) groups.shared.push(item);
    else if (owner.includes("us")) groups.us.push(item);
    else groups.other.push(item);
  });

  container.innerHTML = [
    renderActionGroup("Our team", groups.us),
    renderActionGroup("Client", groups.client),
    renderActionGroup("Shared", groups.shared),
    renderActionGroup("Unassigned", groups.other)
  ].filter(Boolean).join("");

  container.querySelectorAll(".task-btn").forEach((btn) => {
    btn.addEventListener("click", () => showToast("Task created."));
  });
}

function renderActionGroup(title, items) {
  if (!items.length) return "";
  const rows = items.map((item) => {
    const metaParts = [];
    if (item.deadline) metaParts.push(`Due: ${escapeHtml(item.deadline)}`);
    if (item.owner) metaParts.push(`Owner: ${escapeHtml(item.owner)}`);
    const rationale = item.rationale ? `<div class="task-meta">${escapeHtml(item.rationale)}</div>` : "";
    const evidence = item.evidence ? `<div class="task-meta">Evidence: ${escapeHtml(item.evidence)}</div>` : "";
    return [
      '<div class="task-row">',
      `<div><div><strong>${escapeHtml(item.item)}</strong></div><div class="task-meta">${metaParts.join(" • ")}</div>${rationale}${evidence}</div>`,
      '<button class="task-btn" type="button">Create Task</button>',
      "</div>"
    ].join("");
  }).join("");
  return `<div class="task-group"><h4>${escapeHtml(title)}</h4>${rows}</div>`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function parseDeadline(value) {
  if (!value || typeof value !== "string") return null;
  const lower = value.trim().toLowerCase();
  const today = new Date();
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const weekdayNames = "(monday|tuesday|wednesday|thursday|friday|saturday|sunday)";

  if (lower === "today") return base;
  if (lower === "tomorrow") return addDays(base, 1);
  if (lower.includes("end of week")) return nextWeekday(base, 5);
  if (lower.includes("next week")) return addDays(base, 7);
  if (lower.includes("end of month")) {
    return new Date(base.getFullYear(), base.getMonth() + 1, 0);
  }

  const weekdayMatch = lower.match(new RegExp(`next ${weekdayNames}`));
  if (weekdayMatch) return nextNamedWeekday(base, weekdayMatch[1]);

  const bareWeekdayMatch = lower.match(new RegExp(`^${weekdayNames}$`));
  if (bareWeekdayMatch) return nextNamedWeekday(base, bareWeekdayMatch[1], true);

  const inMatch = lower.match(/in (\d+)\s*(day|days|week|weeks)/);
  if (inMatch) {
    const amount = Number(inMatch[1]);
    const multiplier = inMatch[2].startsWith("week") ? 7 : 1;
    return addDays(base, amount * multiplier);
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed);
}

function daysBetween(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.ceil(ms / 86400000);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function nextWeekday(date, weekday, allowSameDay) {
  const result = new Date(date);
  const diffRaw = (weekday - result.getDay() + 7) % 7;
  const diff = diffRaw === 0 && !allowSameDay ? 7 : diffRaw;
  result.setDate(result.getDate() + diff);
  return result;
}

function nextNamedWeekday(date, name, allowSameDay) {
  const map = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
  };
  return nextWeekday(date, map[name], allowSameDay);
}

function pickSoonestDeadline(dates) {
  if (!dates.length) return null;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const future = dates.filter((date) => date >= startOfToday);
  if (future.length) {
    return new Date(Math.min(...future.map((date) => date.getTime())));
  }
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function normalizePriority(priority) {
  const value = String(priority || "").toLowerCase();
  if (value.startsWith("high")) {
    return { label: "High", className: "priority-high", sub: "Escalate decisions quickly" };
  }
  if (value.startsWith("medium")) {
    return { label: "Medium", className: "priority-medium", sub: "Keep momentum" };
  }
  if (value.startsWith("low")) {
    return { label: "Low", className: "priority-low", sub: "Monitor and follow up" };
  }
  return { label: "Unknown", className: "priority-low", sub: "No clear priority" };
}

function normalizeSentiment(sentiment, summary) {
  const raw = String(sentiment || "").toLowerCase();
  if (raw.includes("urgent")) return { label: "Urgent", sub: "Needs immediate attention" };
  if (raw.includes("concern")) return { label: "Concerned", sub: "Address risks quickly" };
  if (raw.includes("excited")) return { label: "Excited", sub: "Momentum is strong" };
  if (raw.includes("satisfied")) return { label: "Satisfied", sub: "Relationship is stable" };
  if (raw.includes("neutral")) return { label: "Neutral", sub: "No strong sentiment" };

  const summaryText = summary.toLowerCase();
  if (summaryText.includes("dip") || summaryText.includes("risk") || summaryText.includes("concern")) {
    return { label: "Concerned", sub: "Potential friction detected" };
  }
  if (summaryText.includes("excited") || summaryText.includes("strong") || summaryText.includes("great")) {
    return { label: "Excited", sub: "Positive momentum" };
  }
  return { label: "Neutral", sub: "No strong sentiment" };
}

function formatValue(v) {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function normalizeActionItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    if (typeof item === "string") {
      return { item, rationale: "Not provided", evidence: "Not provided", owner: "", deadline: "" };
    }
    return {
      item: item?.item || "Untitled action",
      rationale: item?.rationale || "Not provided",
      evidence: item?.evidence || "Not provided",
      owner: item?.owner || "",
      deadline: item?.deadline || ""
    };
  });
}

function analyzeText(text) {
  const lower = String(text || "").toLowerCase();
  const words = lower.match(/[a-z0-9][a-z0-9'-]*/g) || [];
  const sentences = String(text || "").split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const stopwords = new Set([
    "the","and","for","are","with","this","that","from","your","you","our","was","were","have","has","had","but","not","all","any","can","will","just",
    "like","into","over","then","than","they","them","their","its","it's","about","also","there","here","when","what","why","how","who","whom","which",
    "a","an","to","of","in","on","at","by","as","is","it","be","or","if","we","us","i","me","my","mine","he","she","his","her","hers","their","ours"
  ]);
  const freq = {};
  words.forEach((w) => {
    if (w.length < 3 || stopwords.has(w)) return;
    freq[w] = (freq[w] || 0) + 1;
  });
  const keywords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 6);

  const positiveWords = new Set(["win","growth","increase","excited","happy","strong","clear","approved","ready","opportunity","love","great","good","success"]);
  const negativeWords = new Set(["risk","concern","delay","issue","blocked","problem","churn","loss","unclear","urgent","overdue","late","cancel"]);
  const urgentWords = new Set(["asap","urgent","immediately","deadline","soon","tomorrow","today","eow","eod","overdue","rush","critical"]);
  let pos = 0;
  let neg = 0;
  let urgent = 0;
  words.forEach((w) => {
    if (positiveWords.has(w)) pos += 1;
    if (negativeWords.has(w)) neg += 1;
    if (urgentWords.has(w)) urgent += 1;
  });
  const sentimentScore = pos + neg ? (pos - neg) / (pos + neg) : 0;

  const transitions = buildMarkovTransitions(words);

  return {
    wordCount: words.length,
    sentenceCount: sentences.length || 1,
    avgWords: Math.round(words.length / (sentences.length || 1)),
    keywords,
    sentimentScore,
    urgent,
    transitions,
  };
}

function buildMarkovTransitions(words) {
  if (words.length < 3) return [];
  const minLen = 3;
  const map = {};
  for (let i = 0; i < words.length - 1; i += 1) {
    const from = words[i];
    const to = words[i + 1];
    if (from.length < minLen || to.length < minLen) continue;
    if (!map[from]) map[from] = {};
    map[from][to] = (map[from][to] || 0) + 1;
  }
  const pairs = [];
  Object.keys(map).forEach((from) => {
    Object.keys(map[from]).forEach((to) => {
      pairs.push({ pair: `${from} -> ${to}`, count: map[from][to] });
    });
  });
  return pairs.sort((a, b) => b.count - a.count).slice(0, 8);
}

function computeUrgencyScore(result, analysis) {
  const urgencyMap = { none: 10, low: 35, medium: 60, high: 85 };
  const timeUrgency = String(result?.time_analysis?.overall_urgency || "").toLowerCase();
  const base = urgencyMap[timeUrgency] || 30;
  const boosted = base + Math.min(20, analysis.urgent * 5);
  return Math.min(100, boosted);
}

function statRow(label, value) {
  return `<div class="stat-row"><span class="stat-label">${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
}

function meterRow(label, value) {
  const safe = Number.isFinite(value) ? value : 0;
  return [
    '<div class="bar-row">',
    `<div class="stat-label">${escapeHtml(label)}</div>`,
    '<div class="bar-track"><div class="bar-fill" style="width: ' + Math.min(100, Math.max(0, safe)) + '%;"></div></div>',
    `<div>${Math.round(safe)}%</div>`,
    "</div>",
  ].join("");
}

function barRow(label, value, maxValue) {
  const width = maxValue ? (value / maxValue) * 100 : 0;
  return [
    '<div class="bar-row">',
    `<div>${escapeHtml(label)}</div>`,
    '<div class="bar-track"><div class="bar-fill" style="width: ' + Math.min(100, Math.max(0, width)) + '%;"></div></div>',
    `<div>${escapeHtml(String(value))}</div>`,
    "</div>",
  ].join("");
}

function sentimentChip(score) {
  if (score >= 0.2) return '<span class="chip positive">Positive lean</span>';
  if (score <= -0.2) return '<span class="chip negative">Risk signals</span>';
  return '<span class="chip">Neutral tone</span>';
}

function buildEvidenceMap(items, summary, keyRequirement) {
  if (!items.length) {
    return '<div class="muted-small">No action items to map yet.</div>';
  }
  const header = [
    summary ? `<div class="muted-small">Summary signal: ${escapeHtml(summary)}</div>` : "",
    keyRequirement ? `<div class="muted-small">Key requirement: ${escapeHtml(keyRequirement)}</div>` : "",
  ].filter(Boolean).join("");
  const body = items.map((item) => {
    const evidence = item.evidence && item.evidence !== "Not provided"
      ? escapeHtml(item.evidence)
      : "No evidence provided";
    return [
      '<div class="evidence-item">',
      `<div class="evidence-title">${escapeHtml(item.item)}</div>`,
      `<div class="muted-small">Why: ${escapeHtml(item.rationale)}</div>`,
      `<div class="muted-small">Evidence: ${evidence}</div>`,
      "</div>",
    ].join("");
  }).join("");
  return header + body;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  loadModelInfo();
  populateSampleSelect();
});
