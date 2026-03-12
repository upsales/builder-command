import { chromium, type Browser, type Page } from "playwright";

let browser: Browser | null = null;
let page: Page | null = null;
let lastActivity = 0;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const IDLE_TIMEOUT = 120_000; // Close browser after 2 minutes of inactivity

async function getBrowser(): Promise<Browser> {
  if (browser?.isConnected()) return browser;
  browser = await chromium.launch({ headless: true });
  return browser;
}

async function getPage(): Promise<Page> {
  const b = await getBrowser();
  if (!page || page.isClosed()) {
    page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  }
  lastActivity = Date.now();
  scheduleClose();
  return page;
}

function scheduleClose() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(async () => {
    if (Date.now() - lastActivity >= IDLE_TIMEOUT) {
      await closeBrowser();
    }
  }, IDLE_TIMEOUT + 1000);
}

async function closeBrowser() {
  if (page && !page.isClosed()) await page.close().catch(() => {});
  if (browser?.isConnected()) await browser.close().catch(() => {});
  page = null;
  browser = null;
}

export interface BrowseResult {
  url: string;
  title: string;
  text: string;
  screenshotBase64: string;
  links: { text: string; href: string }[];
}

/** Navigate to a URL, wait for it to load, and return page content + screenshot */
export async function browse(url: string): Promise<BrowseResult> {
  const p = await getPage();
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
  await p.waitForTimeout(2000); // Let JS render

  const title = await p.title();
  const text = await p.evaluate(() => {
    // Remove script/style/hidden elements
    document.querySelectorAll("script, style, noscript, [hidden]").forEach(el => el.remove());
    return document.body?.innerText?.substring(0, 15000) ?? "";
  });

  const links = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]")).slice(0, 50).map(a => ({
      text: (a as HTMLAnchorElement).innerText.trim().substring(0, 100),
      href: (a as HTMLAnchorElement).href,
    })).filter(l => l.text && l.href);
  });

  const screenshotBuffer = await p.screenshot({ type: "png" });
  const screenshotBase64 = screenshotBuffer.toString("base64");

  return { url: p.url(), title, text, screenshotBase64, links };
}

/** Click an element matching the given selector or text */
export async function click(selectorOrText: string): Promise<BrowseResult> {
  const p = await getPage();
  lastActivity = Date.now();

  // Try as selector first, then as text
  try {
    await p.click(selectorOrText, { timeout: 3000 });
  } catch {
    // Try clicking by text content
    await p.getByText(selectorOrText, { exact: false }).first().click({ timeout: 5000 });
  }

  await p.waitForTimeout(1500);

  const title = await p.title();
  const text = await p.evaluate(() => {
    document.querySelectorAll("script, style, noscript, [hidden]").forEach(el => el.remove());
    return document.body?.innerText?.substring(0, 15000) ?? "";
  });
  const links = await p.evaluate(() => {
    return Array.from(document.querySelectorAll("a[href]")).slice(0, 50).map(a => ({
      text: (a as HTMLAnchorElement).innerText.trim().substring(0, 100),
      href: (a as HTMLAnchorElement).href,
    })).filter(l => l.text && l.href);
  });
  const screenshotBuffer = await p.screenshot({ type: "png" });
  const screenshotBase64 = screenshotBuffer.toString("base64");

  return { url: p.url(), title, text, screenshotBase64, links };
}

/** Type text into a focused or selected input */
export async function type(selector: string, text: string): Promise<string> {
  const p = await getPage();
  lastActivity = Date.now();
  await p.fill(selector, text, { timeout: 5000 });
  return `Typed "${text}" into ${selector}`;
}

/** Take a screenshot of the current page */
export async function screenshot(): Promise<{ screenshotBase64: string; url: string; title: string }> {
  const p = await getPage();
  lastActivity = Date.now();
  const screenshotBuffer = await p.screenshot({ type: "png" });
  return {
    screenshotBase64: screenshotBuffer.toString("base64"),
    url: p.url(),
    title: await p.title(),
  };
}
