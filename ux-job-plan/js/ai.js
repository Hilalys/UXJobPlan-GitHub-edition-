// AI suggestions run only when the person presses a button.

import { S } from "./store.js";
import { browserAiImages, browserAiStatus, browserPrompt } from "./browser-ai.js";

let fn;            // undefined: not resolved yet; null: unavailable
let blocked = "";  // a code that hides AI for the rest of the visit

export const usesClaude = () => typeof window.claude?.use === "function";
export const aiVisible = () => !!S.settings.aiOn && (usesClaude() ? !blocked : browserAiStatus() === "available");

async function getSample() {
  if (fn !== undefined) return fn;
  try {
    fn = usesClaude()
      ? await Promise.race([window.claude.use("sample"), new Promise(r => setTimeout(() => r(null), 10000))])
      : null;
  } catch { fn = null; }
  return fn;
}

const COPY = {
  not_granted: "AI isn't allowed for this page. You can still do everything by hand.",
  sampling_disabled: "Claude isn't available for this account right now.",
  not_declared: "AI isn't set up for this page yet.",
  capability_disabled: "AI isn't available in this view.",
  capability_removed: "AI isn't available in this view.",
  rate_limited: "Too many AI requests right now. Try again in a little while.",
  session_expired: "Your Claude session expired. Sign in again, then try once more.",
  refused: "AI couldn't help with that request. Try rewording it.",
  empty_completion: "AI didn't return anything. Try again with a simpler request.",
  invalid_json: "The answer came back in the wrong shape. Try again.",
  prompt_too_large: "That's too much text to send at once. Try a shorter version.",
  upstream_error: "Something went wrong while running AI. Try again.",
  cancelled: "AI request cancelled.",
  unavailable: "AI isn't available here. You can still do everything by hand."
};
const HIDE = ["not_granted", "sampling_disabled", "not_declared", "capability_disabled", "capability_removed", "unavailable"];

export class AiError extends Error {
  constructor(code, text) { super(COPY[code] || COPY.upstream_error); this.code = code; this.partial = text; }
}

function browserError(e) {
  if (e instanceof AiError) return e;
  const code = { AbortError: "cancelled", QuotaExceededError: "prompt_too_large", NotSupportedError: "unavailable", NotAllowedError: "unavailable" }[e?.name];
  return new AiError(code || "upstream_error");
}

export async function canSendImages() {
  if (!usesClaude()) return aiVisible() && await browserAiImages();
  const s = await getSample();
  if (!s || typeof s.limits !== "function") return false;
  try { const l = await s.limits(); return !!(l && l.images); } catch { return false; }
}

// Ask for JSON. Throws AiError with viewer-friendly copy.
export async function askJson(prompt, { signal, tier = "default", images = null } = {}) {
  if (!usesClaude()) {
    const text = await askText(`${prompt}\n\nReturn only valid JSON in the requested shape, with no explanation.`, { signal, images });
    let result;
    try { result = JSON.parse(text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n?\s*```$/i, "$1")); }
    catch { throw new AiError("invalid_json"); }
    if (!result || typeof result !== "object") throw new AiError("invalid_json");
    return result;
  }
  const s = await getSample();
  if (!s) { blocked = "unavailable"; throw new AiError("unavailable"); }
  try {
    const opts = { signal, modelTier: tier };
    if (images && images.length && await canSendImages()) opts.images = images;
    return await s.json(prompt, opts);
  } catch (e) {
    const code = (e && e.code) || "upstream_error";
    if (HIDE.includes(code)) blocked = code;
    throw new AiError(code, e && e.text);
  }
}

// Ask for text, streaming into onText.
export async function askText(prompt, { signal, onText, tier = "default", cache, images } = {}) {
  if (!usesClaude()) {
    if (!aiVisible()) throw new AiError("unavailable");
    try {
      const text = await browserPrompt(prompt, { signal, images, onText });
      if (!text.trim()) throw new AiError("empty_completion");
      return text;
    } catch (e) { throw browserError(e); }
  }
  const s = await getSample();
  if (!s) { blocked = "unavailable"; throw new AiError("unavailable"); }
  try {
    const opts = { signal, modelTier: tier, onText };
    if (cache !== undefined) opts.cache = cache;
    const { text } = await s(prompt, opts);
    return text;
  } catch (e) {
    const code = (e && e.code) || "upstream_error";
    if (HIDE.includes(code)) blocked = code;
    throw new AiError(code, e && e.text);
  }
}

export const profileLine = () => {
  const p = S.settings.profile;
  const l = S.settings.location || {};
  const where = [l.city, l.region, l.country].filter(Boolean).join(", ");
  const parts = [p.name, p.role].filter(Boolean).join(", ");
  return `The person: ${parts || "a product designer"}${p.target ? `, looking for ${p.target}` : ""}${where ? `, based in ${where}` : ""}${l.remote ? " (open to remote)" : ""}.${p.summary ? ` Their profile:\n${p.summary.slice(0, 3000)}` : " They haven't written a profile yet, so don't assume details about their experience."}`;
};
