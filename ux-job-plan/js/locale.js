// Location: where the person is looking for work. Set in Settings → Location.
// Built-in plan text uses tokens ({city}, {area} …) that are filled in from here,
// so the plan reads naturally for any city, and stays sensible when no city is set.

import { S } from "./store.js";

const enc = encodeURIComponent;

export function getLoc() {
  const l = (S.settings && S.settings.location) || {};
  return {
    city: (l.city || "").trim(),
    region: (l.region || "").trim(),
    country: (l.country || "").trim(),
    nearby: (l.nearby || "").trim(),
    remote: !!l.remote
  };
}
export const hasCity = () => !!getLoc().city;

// "Austin", or "your city" when no city is set.
export const cityName = () => getLoc().city || "your city";
// "Austin, TX", "Berlin, Germany", or "your city".
export function cityFull() {
  const l = getLoc();
  if (!l.city) return "your city";
  return [l.city, l.region || l.country].filter(Boolean).join(", ");
}
// "Austin, Round Rock and San Marcos", or "your area".
export function areaText() {
  const l = getLoc();
  const list = [l.city, ...l.nearby.split(",").map(s => s.trim())].filter(Boolean);
  if (!list.length) return "your area";
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}
// For prompts and short phrases: "in Austin, TX" or "" when not set.
export const inPlace = () => (hasCity() ? ` in ${cityFull()}` : "");
// A search-friendly location string for job and event sites.
function where() {
  const l = getLoc();
  return [l.city, l.region, l.country].filter(Boolean).join(", ");
}

// ---- Links that depend on the location ----
export function jobsUrl(q = "product designer") {
  const w = where();
  return `https://www.linkedin.com/jobs/search/?keywords=${enc(q)}${w ? `&location=${enc(w)}` : ""}`;
}
export function meetupUrl(q = "UX design") {
  const l = getLoc();
  return l.city ? `https://www.meetup.com/find/?keywords=${enc(q)}&location=${enc(where())}` : `https://www.meetup.com/find/?keywords=${enc(q)}&source=EVENTS&eventType=online`;
}
export const searchUrl = q => `https://www.google.com/search?q=${enc(q)}`;
export function libraryUrl() {
  return hasCity() ? searchUrl(`${where()} public library card`) : "https://search.worldcat.org/libraries";
}
export const bookUrl = q => `https://search.worldcat.org/search?q=${enc(q)}`;

// ---- Filling tokens in built-in text ----
const TOKENS = {
  city: () => cityName(),
  cityL: () => getLoc().city || "local",
  cityFull: () => cityFull(),
  area: () => areaText(),
  jobsUrl: () => jobsUrl(),
  meetupUrl: () => meetupUrl(),
  contentMeetupUrl: () => meetupUrl("content design UX writing"),
  uxpaUrl: () => searchUrl(`UXPA chapter ${getLoc().city || ""}`.trim()),
  libraryUrl: () => libraryUrl()
};
export function fill(text) {
  if (typeof text !== "string" || text.indexOf("{") < 0) return text;
  const out = text.replace(/\{(\w+)\}/g, (m, k) => (TOKENS[k] ? TOKENS[k]() : m));
  // "local" at the start of a sentence or title reads better capitalized.
  return out.replace(/(^|[.!?]\s+)local\b/g, (m, a) => a + "Local");
}
export const hasTokens = text => typeof text === "string" && /\{(city|cityL|cityFull|area|jobsUrl|meetupUrl|contentMeetupUrl|uxpaUrl|libraryUrl)\}/.test(text);
