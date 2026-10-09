// server/scraper.js
import courtSources from './courtSources.js'; // FIXED: Renamed to avoid shadowing
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NAV_TIMEOUT_MS = 30000;
const SETTLE_MS = 1500;
const HOST_DELAY_MS = Number(process.env.SCRAPER_HOST_DELAY_MS || 2000);
const CACHE_TTL_MS = Number(process.env.SCRAPER_CACHE_TTL_MS || 5 * 60 * 1000);
const USER_AGENT =
  process.env.SCRAPER_USER_AGENT || 'DinkSyncBot/0.1 (school project; Pampanga)';
const TIMEZONE = 'Asia/Manila';

const SOLD_OUT_PHRASES = [
  'fully booked',
  'no slots available',
  'no available slots',
  'no availability',
  'sold out',
];

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeDate(date) {
  const d = String(date || '').trim().replace(/\//g, '-');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new ValidationError('date must look like 2026-10-05 (or 2026/10/05)');
  }
  return d;
}

// Converts any time format ("18:00", "6pm", "08:00 AM") into total minutes from midnight
function parseTimeLabel(label) {
  if (!label) return null;
  const clean = label.toLowerCase().replace(/\s+/g, '');
  
  // 1. Handle 12-hour format (e.g., "6pm", "8:30pm")
  const match12 = clean.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)$/);
  if (match12) {
    let [, hour, minute = '0', modifier] = match12;
    let h = parseInt(hour, 10);
    const m = parseInt(minute, 10);
    if (modifier === 'pm' && h < 12) h += 12;
    if (modifier === 'am' && h === 12) h = 0;
    return h * 60 + m;
  }

  // 2. Handle 24-hour format (e.g., "18:00", "20:00")
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let [, hour, minute] = match24;
    return parseInt(hour, 10) * 60 + parseInt(minute, 10);
  }

  return null;
}

function hasFreeSlotInWindow(slots, timeRange) {
  let windowStart, windowEnd;

  // If timeRange is already parsed as numeric minutes from midnight { start, end }
  if (typeof timeRange === 'object' && timeRange !== null && typeof timeRange.start === 'number') {
    windowStart = timeRange.start;
    windowEnd = timeRange.end;
  } else {
    let timeRangeStr = timeRange;
    if (typeof timeRange === 'object' && timeRange !== null) {
      timeRangeStr = timeRange.range || `${timeRange.start}-${timeRange.end}`;
    }
    
    if (typeof timeRangeStr !== 'string' || !timeRangeStr.includes('-')) return false;
    
    const [startStr, endStr] = timeRangeStr.split('-');
    windowStart = parseTimeLabel(startStr.trim());
    windowEnd = parseTimeLabel(endStr.trim());
  }

  if (windowStart === null || windowEnd === null) return false;

  return slots.some((s) => {
    const slotMin = parseTimeLabel(s.text);
    return s.free && slotMin !== null && slotMin >= windowStart && slotMin < windowEnd;
  });
}

function parseWindow(time) {
  const parts = String(time || '').split('-').map((s) => s.trim()).filter(Boolean);
  const start = parseTimeLabel(parts[0] || '');
  if (start === null) throw new ValidationError('time must look like 07:00-09:00');
  let end = parts[1] ? parseTimeLabel(parts[1]) : null;
  if (end === null) end = start + 60;
  if (end <= start) throw new ValidationError('time range must end after it starts');
  return { start, end };
}

function todayInManila() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function daysAhead(date) {
  const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((toUTC(date) - toUTC(todayInManila())) / 86400000);
}

function earlyReason(court, date) {
  const ahead = daysAhead(date);
  if (ahead < 0) return 'past';
  if (court.maxAdvanceDays != null && ahead > court.maxAdvanceDays) return 'too_far';
  return null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function confirmDateOnPage(text, date) {
  const wantMonth = Number(date.slice(5, 7));
  const wantDay = Number(date.slice(8, 10));
  const found = [];

  const names = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const monthFirst = new RegExp(`\\b${names}\\.?\\s+(\\d{1,2})(?!\\d)`, 'gi');
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${names}\\b`, 'gi');
  const iso = /\b(\d{4})[-/](\d{2})[-/](\d{2})\b/g;
  const lower = String(text).toLowerCase();

  for (const m of lower.matchAll(monthFirst)) {
    found.push({ month: MONTHS.indexOf(m[1].slice(0, 3)) + 1, day: Number(m[2]) });
  }
  for (const m of lower.matchAll(dayFirst)) {
    found.push({ month: MONTHS.indexOf(m[2].slice(0, 3)) + 1, day: Number(m[1]) });
  }
  for (const m of lower.matchAll(iso)) found.push({ month: Number(m[2]), day: Number(m[3]) });

  if (found.length === 0) return null;
  return found.some((f) => f.month === wantMonth && f.day === wantDay);
}

function noteFor(result, court) {
  if (result.state !== 'unknown') return null;
  switch (result.reason) {
    case 'auth_required':
      return 'Requires login on site';
    case 'too_far':
      return court.maxAdvanceDays != null
        ? `Bookings open up to ${court.maxAdvanceDays} days ahead`
        : 'Too far ahead to check';
    case 'past':
      return 'That date has already passed';
    case 'date_not_selectable':
      return "Couldn't select that date";
    case 'date_mismatch':
      return "The site didn't show that date";
    case 'robots':
      return "Automated checks disallowed";
    default:
      return "Couldn't check automatically";
  }
}

function parseRobots(text, agent = 'dinksyncbot') {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && current) {
      lastWasAgent = false;
      if (value) current.rules.push({ allow: key === 'allow', path: value });
    } else {
      lastWasAgent = false;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  return chosen.flatMap((g) => g.rules);
}

function isAllowedByRules(rules, pathWithQuery) {
  let best = null;
  for (const rule of rules) {
    const escaped = rule.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const re = new RegExp('^' + escaped.replace(/\\\$$/, '$'));
    if (re.test(pathWithQuery)) {
      if (!best || rule.path.length > best.path.length ||
          (rule.path.length === best.path.length && rule.allow)) {
        best = rule;
      }
    }
  }
  return best ? best.allow : true;
}

const robotsCache = new Map();

async function robotsAllows(url) {
  const u = new URL(url);
  let entry = robotsCache.get(u.origin);
  if (!entry || Date.now() - entry.at > 60 * 60 * 1000) {
    let rules = [];
    try {
      const res = await fetch(`${u.origin}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } });
      if (res.ok) rules = parseRobots(await res.text());
      else if (res.status === 401 || res.status === 403) rules = [{ allow: false, path: '/' }];
    } catch {
      rules = [{ allow: false, path: '/' }];
    }
    entry = { rules, at: Date.now() };
    robotsCache.set(u.origin, entry);
  }
  return isAllowedByRules(entry.rules, u.pathname + u.search);
}

function readSlotsInPage() {
  const timeRe = /^\d{1,2}(?::\d{2})?\s*(am|pm)$/i;
  const badClass = /(^|[\s_-])(booked|reserved|unavailable|disabled|taken|sold|past|selected)([\s_-]|$)/i;
  const badText = /\b(booked|reserved|sold out|unavailable|fully booked)\b/i;

  // 1. Handle Coura table layouts
  const rows = Array.from(document.querySelectorAll('tr'));
  if (rows.length > 0) {
    let tableSlots = [];
    for (const row of rows) {
      const textCells = Array.from(row.querySelectorAll('th, td, div')).map(el => (el.innerText || '').trim());
      const timeCell = textCells.find(t => timeRe.test(t));
      if (timeCell) {
        for (const cellEl of row.querySelectorAll('td, div')) {
          const t = (cellEl.innerText || '').trim();
          if (t && !timeRe.test(t)) {
            let free = true;
            const lower = t.toLowerCase();
            if (badText.test(lower) || lower.includes('reserved') || lower.includes('booked')) {
              free = false;
            } else if (cellEl.disabled || badClass.test(cellEl.className)) {
              free = false;
            }
            tableSlots.push({ text: timeCell, free });
          }
        }
      }
    }
    if (tableSlots.length > 0) return tableSlots;
  }

  // 2. Handle Rezerv Matrix Layouts (Explicitly mapping time column headers to court rows)
  // Find all time header cells in the top schedule axis
  const timeHeaders = Array.from(document.querySelectorAll('div, span, th')).filter(el => {
    const t = (el.innerText || '').trim();
    // Specifically looking for elements styled or placed like the time columns (8am, 9am, etc.)
    return timeRe.test(t) && el.getBoundingClientRect().height < 50;
  });

  if (timeHeaders.length > 0) {
    let matrixSlots = [];
    // Find all rows corresponding to courts
    const courtRows = Array.from(document.querySelectorAll('div, tr, [role="row"]')).filter(row => {
      const text = row.innerText || '';
      return text.includes('Court') && !text.includes('Standard Court Rental');
    });

    for (const row of courtRows) {
      // Get all interactive slot grid cells in this court row
      const cells = Array.from(row.querySelectorAll('button, [role="button"], div, span')).filter(el => {
        const text = (el.innerText || '').trim();
        // Exclude the court name label itself
        return !text.includes('Court') && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.className.includes('cell') || getComputedStyle(el).cursor === 'pointer');
      });

      cells.forEach((cell, index) => {
        if (index < timeHeaders.length) {
          const timeText = timeHeaders[index].innerText.trim();
          const t = (cell.innerText || '').trim();
          let free = true;
          const lower = t.toLowerCase();

          if (badText.test(lower) || lower.includes('booked') || lower.includes('reserved') || lower.includes('unavailable')) {
            free = false;
          } else {
            const style = getComputedStyle(cell);
            if (cell.disabled || style.pointerEvents === 'none' || badClass.test(cell.className)) {
              free = false;
            }
          }
          matrixSlots.push({ text: timeText, free });
        }
      });
    }

    if (matrixSlots.length > 0) return matrixSlots;
  }

  // 3. Fallback generic selector
  const nodes = Array.from(document.querySelectorAll('button, [role="button"], a, li, td, div, span, label'));
  const hits = nodes.filter((el) => {
    const t = (el.innerText || '').trim();
    return t && t.length <= 40 && timeRe.test(t);
  });
  
  return hits.map((el) => ({ text: el.innerText.trim(), free: true }));
}

function clickDayInPage(day) {
  const nodes = Array.from(document.querySelectorAll('button,[role="gridcell"],[role="button"],td,div,span'));
  const matches = nodes.filter((el) => (el.innerText || '').trim() === day);
  const innermost = matches.filter((el) => !matches.some((o) => o !== el && el.contains(o)));
  const looksDisabled = (el) => {
    const bad = /(^|[\s_-])(disabled|unavailable|past|outside|out-of-range|inactive)([\s_-]|$)/i;
    for (let node = el, i = 0; node && i < 3; i += 1, node = node.parentElement) {
      const cls = typeof node.className === 'string' ? node.className : '';
      const style = getComputedStyle(node);
      if (node.disabled || node.getAttribute('aria-disabled') === 'true') return true;
      if (bad.test(cls) || style.pointerEvents === 'none' || style.cursor === 'not-allowed') return true;
    }
    return false;
  };
  const target = innermost.find((el) => !looksDisabled(el));
  if (!target) return false;
  target.click();
  return true;
}

function buildUrl(court, date) {
  const url = new URL(court.check_url);
  if (court.platform === 'sports360' || court.platform === 'coura') {
    url.searchParams.set('date', date);
  }
  return url.toString();
}

async function ensureDate(page, court, date) {
  // If the URL already contains the date or platform handles it via query params, verify it directly
  const pageText = await page.evaluate(() => document.body.innerText);
  if (confirmDateOnPage(pageText, date) === true) {
    return true;
  }

  // Otherwise, try clicking the date on the calendar interface
  const clicked = await page.evaluate(clickDayInPage, String(Number(date.slice(8, 10))));
  if (clicked) await sleep(SETTLE_MS + 500);
  
  const updatedText = await page.evaluate(() => document.body.innerText);
  return confirmDateOnPage(updatedText, date) === true;
}

async function loadAndRead(browser, court, date) {
  const early = earlyReason(court, date);
  if (early) return { state: 'unknown', slots: [], reason: early };

  const url = buildUrl(court, date);
  if (!(await robotsAllows(url))) {
    console.warn(`[scraper] robots.txt disallows ${url}; skipping`);
    return { state: 'unknown', slots: [], reason: 'robots' };
  }

  const page = await browser.newPage();
  try {
    await page.setUserAgent(USER_AGENT);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS });
    await page
      .waitForFunction(() => !/loading/i.test(document.body.innerText), { timeout: 10000 })
      .catch(() => {});
    await sleep(SETTLE_MS);

    const pageText = await page.evaluate(() => document.body.innerText);
    const lowerText = pageText.toLowerCase();

    // Check for login wall
    if (lowerText.includes('welcome back') && lowerText.includes('email address')) {
      console.warn(`[scraper] ${court.name}: Hit login wall. Authentication required.`);
      return { state: 'unknown', slots: [], reason: 'auth_required' };
    }

    // Try selecting date if not already set, but don't hard-fail the whole scrape if text matching is quirky
    await ensureDate(page, court, date);

    // Read the slots directly from the calendar grid/list
    const raw = await page.evaluate(readSlotsInPage);
    const slots = raw
      .map((s) => ({ startMin: parseTimeLabel(s.text), free: s.free }))
      .filter((s) => s.startMin !== null);
      
    if (slots.length > 0) return { state: 'slots', slots };

    const text = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (SOLD_OUT_PHRASES.some((p) => text.includes(p))) return { state: 'soldout', slots: [] };
    return { state: 'unknown', slots: [], reason: 'no_slots_found' }; 
  } catch (error) {
    console.error(`[scraper] ${court.name}: ${error.message}`);
    return { state: 'unknown', slots: [], reason: 'error' };
  } finally {
    await page.close();
  }
}

const slotCache = new Map(); 

async function getSlots(browser, court, date) {
  const key = `${court.id}|${date}`;
  const hit = slotCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;
  const result = await loadAndRead(browser, court, date);
  if (result.state !== 'unknown') slotCache.set(key, { result, at: Date.now() });
  return result;
}

function toAvailability(result, window) {
  if (result.state === 'soldout') return false;
  if (result.state === 'slots') return hasFreeSlotInWindow(result.slots, window);
  return null;
}

let browserPromise = null;
async function launchBrowser() {
  return puppeteer.launch({
    headless: process.env.PUPPETEER_HEADFUL ? false : true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

export async function scrapeAllCourts(courts, date, time) {
  const day = normalizeDate(date);
  const window = parseWindow(time);

  const results = new Map();
  const scrapable = [];
  for (const court of courts) {
    // Exclude ground-002 and sports360 from automated scraping
    if (court.check_url && court.platform !== 'manual' && court.platform !== 'sports360' && court.id !== 'ground-002') {
      scrapable.push(court);
    } else {
      let note = null;
      if (court.platform === 'sports360') note = 'Requires login on site';
      if (court.id === 'ground-002') note = 'Requires manual booking on site';
      results.set(court.id, { available: null, note });
    }
  }

  const toScrape = [];
  for (const court of scrapable) {
    const early = earlyReason(court, day);
    if (early) {
      results.set(court.id, {
        available: null,
        note: noteFor({ state: 'unknown', reason: early }, court),
      });
    } else {
      toScrape.push(court);
    }
  }

  if (toScrape.length > 0) {
    browserPromise = browserPromise || launchBrowser();
    let browser;
    try {
      browser = await browserPromise;
    } catch (error) {
      browserPromise = null;
      console.error('[scraper] could not start browser:', error.message);
      toScrape.forEach((c) => results.set(c.id, { available: null, note: noteFor({ state: 'unknown' }, c) }));
    }

    if (browser) {
      const byHost = new Map();
      for (const court of toScrape) {
        const host = new URL(court.check_url).host;
        if (!byHost.has(host)) byHost.set(host, []);
        byHost.get(host).push(court);
      }
      await Promise.all(
        Array.from(byHost.values()).map(async (group) => {
          for (let i = 0; i < group.length; i += 1) {
            if (i > 0) await sleep(HOST_DELAY_MS);
            
            const result = await getSlots(browser, group[i], day);

            results.set(group[i].id, {
              available: toAvailability(result, window),
              note: noteFor(result, group[i]),
            });
          }
        })
      );
    }
  }

  return courts.map((court) => ({
    id: court.id,
    name: court.name,
    location: court.location || '',
    available: results.has(court.id) ? results.get(court.id).available : null,
    note: results.has(court.id) ? results.get(court.id).note : null,
    bookmarked: Boolean(court.bookmarked),
    bookingUrl:
      (court.platform === 'sports360' || court.id === 'ground-002') && court.check_url
        ? buildUrl(court, day)
        : court.booking_url || court.check_url || null,
  }));
}

async function inspect(courtId, dateArg) {
  const court = courtSources.find((c) => c.id === courtId); 
  if (!court) {
    console.error('Unknown court id. Options:\n  ' + courtSources.map((c) => c.id).join('\n  '));
    process.exit(1);
  }
  const date = normalizeDate(dateArg || todayInManila());
  console.log(`Inspecting ${court.name} for date: ${date}`);

  const browser = await launchBrowser();
  
  // Standard single-page flow for scrapable courts
  const page = await browser.newPage();
  const url = buildUrl(court, date);
  await page.setUserAgent(USER_AGENT);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS });
  await sleep(SETTLE_MS * 2);
  const slots = await page.evaluate(readSlotsInPage);
  await page.close();
  const result = { state: 'ok', slots };

  console.log(`\n--- slots read: ${result.slots.length} ---`);
  console.log(result.slots.slice(0, 25));

  const dir = path.join(__dirname, 'debug');
  fs.mkdirSync(dir, { recursive: true });
  const shot = path.join(dir, `${court.id}.png`);
  
  const pages = await browser.pages();
  if (pages.length > 0) {
    await pages[pages.length - 1].screenshot({ path: shot, fullPage: true });
    console.log(`\nscreenshot: ${shot}`);
  }

  await browser.close();
}

if (process.argv[1] === __filename) {
  const [command, id, date] = process.argv.slice(2);
  if (command === 'inspect' && id) {
    inspect(id, date).catch((e) => { console.error(e); process.exit(1); });
  } else {
    console.log('Usage: node scraper.js inspect <court-id> [YYYY-MM-DD]');
  }
}

export const _internals = { 
  daysAhead, 
  confirmDateOnPage, 
  noteFor, 
  normalizeDate, 
  parseWindow, 
  parseTimeLabel, 
  hasFreeSlotInWindow, 
  parseRobots, 
  isAllowedByRules, 
  todayInManila 
};