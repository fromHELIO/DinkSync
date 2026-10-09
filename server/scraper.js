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

  // One cell = one hour. The window is available only if EVERY hour in it has at
  // least one free cell on some court. The courts don't have to match, so 8-10 is
  // fine when court 1 is free at 8 and court 2 is free at 9.
  const freeHours = new Set();
  for (const s of slots) {
    // loadAndRead already parsed each slot into startMin; fall back to the raw text.
    const slotMin = typeof s.startMin === 'number' ? s.startMin : parseTimeLabel(s.text);
    if (s.free && slotMin !== null) freeHours.add(slotMin);
  }
  // An hour the grid doesn't list at all (closed, not shown) counts as not free.
  for (let hour = windowStart; hour < windowEnd; hour += 60) {
    if (!freeHours.has(hour)) return false;
  }
  return true;
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
      else if (res.status === 401 || res.status === 403) rules = [{ allow: true, path: '/' }]; // Default to allow if restricted
    } catch {
      rules = [{ allow: true, path: '/' }]; // Default to allow on network/fetch error
    }
    entry = { rules, at: Date.now() };
    robotsCache.set(u.origin, entry);
  }
  return isAllowedByRules(entry.rules, u.pathname + u.search);
}

function readSlotsInPage(debug = false) {
  const timeRe = /^\d{1,2}\s*(am|pm)$/i;

  // Universal Grid Matrix Parser for both Rezerve and Coura (Pickle Place)
  // Both platforms use a grid where time labels run along the axis and slot boxes sit inside courts.
  const headerEls = Array.from(document.querySelectorAll('div, span, th')).filter((el) => {
    const t = (el.innerText || '').trim();
    return timeRe.test(t) && el.getBoundingClientRect().height < 50;
  });
  
  const innerHeaderEls = headerEls.filter((el) => !headerEls.some((o) => o !== el && el.contains(o)));
  const headers = [];
  for (const el of innerHeaderEls) {
    const r = el.getBoundingClientRect();
    const h = { text: el.innerText.trim(), cx: r.left + r.width / 2, width: r.width };
    if (!headers.some((x) => x.text === h.text && Math.abs(x.cx - h.cx) < 4)) headers.push(h);
  }

  // Find all slot cells containing pricing (like ₱550) or interactive booking blocks
  const allCells = Array.from(document.querySelectorAll('button, [role="button"], div, span')).filter((el) => {
    const rect = el.getBoundingClientRect();
    const text = (el.innerText || '').trim();
    return rect.width > 15 && rect.height > 10 && !timeRe.test(text) && !text.toLowerCase().includes('court') && !text.toLowerCase().includes('reservations');
  });
  
  const cells = allCells.filter((el) => !allCells.some((other) => other !== el && other.contains(el)));

  if (cells.length > 0 && headers.length > 0) {
    const placed = cells
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el, cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, h: r.height };
      })
      .sort((a, b) => a.cy - b.cy);

    const gridRows = [];
    for (const c of placed) {
      const row = gridRows.find((r) => Math.abs(r.cy - c.cy) <= Math.max(10, c.h / 2));
      if (row) row.cells.push(c);
      else gridRows.push({ cy: c.cy, cells: [c] });
    }
    gridRows.sort((a, b) => a.cy - b.cy);

    if (debug) window.__dinkDebug = [];
    let debugId = 0;
    const timeSlots = [];

    gridRows.forEach((row, rowIndex) => {
      for (const c of row.cells) {
        let best = null;
        for (const h of headers) {
          const dx = Math.abs(h.cx - c.cx);
          if (!best || dx < best.dx) best = { h, dx };
        }
        if (!best || best.dx > Math.max(best.h.width, c.w) / 2 + 10) continue;

        const style = getComputedStyle(c.el);
        const text = (c.el.innerText || '').trim().toLowerCase();
        
        const isClickable =
          style.cursor === 'pointer' || c.el.tagName === 'BUTTON' || c.el.getAttribute('role') === 'button';
        const isDisabled =
          c.el.disabled ||
          c.el.getAttribute('aria-disabled') === 'true' ||
          style.pointerEvents === 'none' ||
          style.cursor === 'default' ||
          style.cursor === 'not-allowed' ||
          text.includes('booked') ||
          text.includes('reserved') ||
          text.includes('unavailable');

        const free = Boolean(isClickable && !isDisabled);

        timeSlots.push({ text: best.h.text, free, court: rowIndex });

        if (debug) {
          const id = debugId;
          debugId += 1;
          c.el.setAttribute('data-dbg', String(id));
          const parent = c.el.parentElement ? getComputedStyle(c.el.parentElement) : null;
          window.__dinkDebug.push({
            id,
            row: rowIndex,
            header: best.h.text,
            text: text.slice(0, 20),
            free,
            tag: c.el.tagName,
            cls: String(c.el.className || '').slice(0, 60),
            cursor: style.cursor,
            parentCursor: parent ? parent.cursor : '',
            pointerEvents: style.pointerEvents,
            opacity: style.opacity,
            bg: style.backgroundColor,
            disabled: Boolean(c.el.disabled),
            ariaDisabled: c.el.getAttribute('aria-disabled'),
          });
        }
      }
    });

    if (timeSlots.length > 0) return timeSlots;
  }

  return [];
}
//--
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
  if (clicked) {
    // The slot grid reloads from the network after a date click. A fixed sleep can
    // read the OLD day's grid when the network is slow, which looks like random errors.
    if (typeof page.waitForNetworkIdle === 'function') {
      await page.waitForNetworkIdle({ idleTime: 800, timeout: 10000 }).catch(() => {});
    }
    await sleep(SETTLE_MS);
  }
  
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
    await page.setViewport({ width: 1366, height: 900 }); // fixed desktop layout (default 800x600 can switch to a mobile layout)
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
    const dateOk = await ensureDate(page, court, date);
    if (!dateOk) console.warn(`[scraper] ${court.name}: could not confirm ${date} is selected`);

    // If the page clearly shows a DIFFERENT date (and not ours), the date change
    // failed and we'd be reading the wrong day. null = page prints no date: carry on.
    const afterText = await page.evaluate(() => document.body.innerText);
    if (confirmDateOnPage(afterText, date) === false) {
      return { state: 'unknown', slots: [], reason: 'date_mismatch' };
    }

    // Read the slots directly from the calendar grid/list
    const raw = await page.evaluate(readSlotsInPage);
    const slots = raw
      .map((s) => ({ text: s.text, startMin: parseTimeLabel(s.text), free: s.free, court: s.court }))
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

async function openForInspection(courtId, dateArg) {
  const court = courtSources.find((c) => c.id === courtId);
  if (!court) {
    console.error('Unknown court id. Options:\n  ' + courtSources.map((c) => c.id).join('\n  '));
    process.exit(1);
  }
  const date = normalizeDate(dateArg || todayInManila());
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.setUserAgent(USER_AGENT);
  await page.goto(buildUrl(court, date), { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS });
  await sleep(SETTLE_MS * 2);
  const dateSelected = await ensureDate(page, court, date); // same date handling as the real scrape
  return { court, date, browser, page, dateSelected };
}

async function saveShot(page, name) {
  const dir = path.join(__dirname, 'debug');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  await page.screenshot({ path: file, fullPage: true }); // the real page, before it is closed
  console.log(`screenshot: ${file}`);
}

async function inspect(courtId, dateArg, timeArg) {
  const { court, date, browser, page, dateSelected } = await openForInspection(courtId, dateArg);
  const time = timeArg || '08:00-10:00';
  console.log(`Inspecting ${court.name} for ${date}, window ${time}`);

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('scraper selected the date:', dateSelected);
  console.log('page shows the date (true/false/null = page prints no date):', confirmDateOnPage(pageText, date));

  const raw = await page.evaluate(readSlotsInPage);
  console.log(`\n--- slots read: ${raw.length} ---`);
  console.log(raw.slice(0, 30));

  const slots = raw
    .map((s) => ({ text: s.text, startMin: parseTimeLabel(s.text), free: s.free, court: s.court }))
    .filter((s) => s.startMin !== null);
  console.log(`\navailable for ${time}:`, slots.length ? hasFreeSlotInWindow(slots, parseWindow(time)) : null);

  await saveShot(page, `${court.id}.png`);
  await browser.close();
}

// node scraper.js cells <court-id> [date]
// Dumps every grid cell with the properties the scraper uses to decide free/taken,
// hovers each one to see if it reacts, groups look-alike cells, and outlines each
// group in a different colour on a screenshot so you can compare with the real site.
async function inspectCells(courtId, dateArg) {
  const { court, date, browser, page, dateSelected } = await openForInspection(courtId, dateArg);
  console.log(`Cell report for ${court.name}, ${date} (date selected: ${dateSelected})`);

  await page.evaluate(readSlotsInPage, true);
  const cells = await page.evaluate(() => window.__dinkDebug || []);
  if (cells.length === 0) {
    console.log('No grid cells found: this court may use the table layout, or the grid is not on the page.');
    await saveShot(page, `${court.id}-cells.png`);
    await browser.close();
    return;
  }

  const signature = (id) =>
    page.evaluate((i) => {
      const el = document.querySelector(`[data-dbg="${i}"]`);
      if (!el) return '';
      const st = getComputedStyle(el);
      return [st.backgroundColor, st.color, st.borderColor, st.boxShadow, st.transform, st.opacity, st.cursor, st.filter].join('|');
    }, id);

  console.log(`Hovering ${cells.length} cells...`);
  for (const cell of cells) {
    try {
      const before = await signature(cell.id);
      const handle = await page.$(`[data-dbg="${cell.id}"]`);
      await handle.hover();
      await sleep(250);
      cell.hoverChanged = (await signature(cell.id)) !== before;
    } catch {
      cell.hoverChanged = 'n/a';
    }
    await page.mouse.move(0, 0);
  }

  // One line per court row: F = scraper thinks free, x = taken. Compare with the site.
  const byRow = new Map();
  for (const c of cells) {
    if (!byRow.has(c.row)) byRow.set(c.row, []);
    byRow.get(c.row).push(c);
  }
  console.log('\nGrid as the scraper sees it (F = free, x = taken):');
  for (const [row, list] of byRow) {
    console.log(`  row ${row}: ` + list.map((c) => `${c.header} ${c.free ? 'F' : 'x'}`).join(' | '));
  }

  const groups = new Map();
  for (const c of cells) {
    const key = [c.tag, c.cursor, 'parent:' + c.parentCursor, c.pointerEvents, 'op:' + c.opacity, c.bg, 'disabled:' + c.disabled, 'aria:' + c.ariaDisabled, 'hover:' + c.hoverChanged].join(' | ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const palette = ['red', 'blue', 'orange', 'purple', 'cyan', 'magenta', 'lime', 'black'];
  const colorOf = {};
  let n = 0;
  console.log('\nGroups of look-alike cells (each gets a coloured outline in the screenshot):');
  for (const [key, list] of groups) {
    const color = palette[n % palette.length];
    list.forEach((c) => { colorOf[c.id] = color; });
    console.log(`\n[${color}] ${list.length} cells, scraper says free=${list[0].free}`);
    console.log(`   ${key}`);
    console.log('   e.g.', list.slice(0, 4).map((c) => `row${c.row} ${c.header}`).join(', '));
    n += 1;
  }
  await page.evaluate((map) => {
    Object.entries(map).forEach(([id, color]) => {
      const el = document.querySelector(`[data-dbg="${id}"]`);
      if (el) { el.style.outline = `3px solid ${color}`; el.style.outlineOffset = '-3px'; }
    });
  }, colorOf);

  await saveShot(page, `${court.id}-cells.png`);
  await browser.close();
}

if (process.argv[1] === __filename) {
  const [command, id, date, time] = process.argv.slice(2);
  if (command === 'inspect' && id) {
    inspect(id, date, time).catch((e) => { console.error(e); process.exit(1); });
  } else if (command === 'cells' && id) {
    inspectCells(id, date).catch((e) => { console.error(e); process.exit(1); });
  } else {
    console.log('Usage:\n  node scraper.js inspect <court-id> [YYYY-MM-DD] [HH:mm-HH:mm]\n  node scraper.js cells <court-id> [YYYY-MM-DD]');
  }
}

export const _internals = { 
  readSlotsInPage,
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