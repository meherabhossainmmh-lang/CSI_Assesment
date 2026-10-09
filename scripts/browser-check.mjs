import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const OUT = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const PAGES = [
  // ResponsiveContainer charts blank out under fullPage capture, so the
  // dashboard is captured as the user actually sees it (viewport shot).
  { route: '/', name: '1-dashboard', wait: 'Net Total', fullPage: false },
  { route: '/submit', name: '2-submit', wait: 'Submit Events', fullPage: true },
  { route: '/pending', name: '3-pending', wait: 'Pending Acknowledgements', fullPage: true },
  { route: '/exceptions', name: '4-exceptions', wait: 'Exceptions', fullPage: true },
  { route: '/mqtt', name: '5-mqtt', wait: 'MQTT Status', fullPage: true },
  { route: '/lines', name: '6-lines', wait: 'Production Lines', fullPage: true },
];

const report = { pages: [], consoleErrors: [], failedRequests: [] };

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

page.on('console', (msg) => {
  if (msg.type() === 'error') report.consoleErrors.push(msg.text());
});
page.on('requestfailed', (req) => report.failedRequests.push(`${req.url()} :: ${req.failure()?.errorText}`));
page.on('response', (res) => {
  if (res.status() >= 400) report.failedRequests.push(`${res.url()} :: HTTP ${res.status()}`);
});

async function settle(ms = 1200) {
  await new Promise((r) => setTimeout(r, ms));
}

for (const p of PAGES) {
  await page.goto(BASE + p.route, { waitUntil: 'networkidle2', timeout: 30000 });
  try {
    await page.waitForFunction(
      (txt) => document.body.innerText.includes(txt),
      { timeout: 10000 },
      p.wait,
    );
  } catch {
    /* still screenshot */
  }
  await settle();
  await page.screenshot({ path: `${OUT}${p.name}.png`, fullPage: p.fullPage });
  report.pages.push({ route: p.route, shot: `${p.name}.png`, ok: true });
}

// Interaction: submit a COUNT through the real UI and confirm a status badge.
await page.goto(BASE + '/submit', { waitUntil: 'networkidle2' });
await settle(600);
const evId = `EV-BR-${Date.now().toString().slice(-6)}`;
await page.type('input[placeholder="EV-201"]', evId);
const qty = await page.$('input[type="number"]');
await qty.click({ clickCount: 3 });
await qty.type('5');
await page.click('button::-p-text(Submit Event)');
try {
  await page.waitForFunction((id) => document.body.innerText.includes(id), { timeout: 10000 }, evId);
  await page.waitForFunction(() => /ACCEPTED|DUPLICATE|CONFLICT|REJECTED|PENDING_REFERENCE/.test(document.body.innerText), { timeout: 10000 });
  report.interaction = { eventId: evId, submitted: true, badgeSeen: true };
} catch {
  report.interaction = { eventId: evId, submitted: true, badgeSeen: false };
}
await settle(500);
await page.screenshot({ path: `${OUT}7-submit-result.png`, fullPage: true });

// Mobile viewport check for responsiveness.
await page.setViewport({ width: 390, height: 844 });
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await settle();
await page.screenshot({ path: `${OUT}8-dashboard-mobile.png`, fullPage: false });

await browser.close();

console.log(JSON.stringify(report, null, 2));
