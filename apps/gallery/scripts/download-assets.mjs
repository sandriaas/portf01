#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const SOURCE_DIR = path.join(ROOT, 'docs', 'research', 'shopify.design');
const SOURCE_FILES = [
  path.join(SOURCE_DIR, 'page-source.html'),
  path.join(SOURCE_DIR, 'index.css'),
  path.join(SOURCE_DIR, 'home.css'),
];
const PUBLIC_DIR = path.join(ROOT, 'public');
const DEFAULT_CONCURRENCY = 4;

const HELP = `Usage: node scripts/download-assets.mjs [--dry-run] [--concurrency N]

Downloads visual assets referenced by the captured Shopify Design homepage source
into public/, preserving the source path structure where possible.

Options:
  --dry-run        List assets without downloading them
  --concurrency N  Number of parallel downloads (default: 4)
  --help           Show this help text
`;

function parseArgs(argv) {
  const args = { dryRun: false, concurrency: DEFAULT_CONCURRENCY, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--concurrency') {
      const value = Number(argv[i + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('Expected a positive integer after --concurrency');
      }
      args.concurrency = value;
      i += 1;
    } else if (arg.startsWith('--concurrency=')) {
      const value = Number(arg.slice('--concurrency='.length));
      if (!Number.isInteger(value) || value < 1) {
        throw new Error('Expected a positive integer after --concurrency=');
      }
      args.concurrency = value;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function normalizeUrl(raw) {
  const trimmed = decodeHtmlEntities(
    String(raw)
      .trim()
      .replace(/\\u0026/g, '&')
      .replace(/\\u003c/gi, '<')
      .replace(/\\u003e/gi, '>')
      .replace(/\\+/g, '')
      .replace(/^url\((.*)\)$/i, '$1')
      .replace(/^["']|["']$/g, ''),
  );
  if (!trimmed) return null;
  if (/[\s,\\]/.test(trimmed)) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:')) return null;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return `https://shopify.design${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function isVisualUrl(urlString) {
  const url = new URL(urlString);
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith('/')) return false;
  const ext = path.extname(pathname);
  const visualExts = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif',
    '.mp4', '.webm', '.mov',
    '.woff', '.woff2', '.ttf', '.otf',
    '.ico', '.cur',
  ]);
  return visualExts.has(ext) || pathname.includes('/favicon') || pathname.includes('/icons/') || pathname.includes('/carousel/') || pathname.includes('/clock/');
}

function shouldSkip(urlString) {
  const url = new URL(urlString);
  const hostname = url.hostname;
  const pathname = url.pathname.toLowerCase();
  if (/googletagmanager|google-analytics|gtag|clarity|segment|hotjar|mixpanel|sentry/.test(hostname + pathname)) return true;
  if (hostname === 'www.googletagmanager.com') return true;
  if (pathname.endsWith('.js') && !pathname.includes('/icons/')) return true;
  if (!isVisualUrl(urlString)) return true;
  return false;
}

function extractFromSrcset(value) {
  const urls = [];
  for (const part of String(value).split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const candidate = trimmed.split(/\s+/)[0];
    const normalized = normalizeUrl(candidate);
    if (normalized) urls.push(normalized);
  }
  return urls;
}

function collectUrlsFromText(text, baseUrl) {
  const found = new Set();
  const patterns = [
    /(?:src|href|poster|content|data-webgl-src|data-src|data-image|data-href)\s*=\s*["']([^"']+)["']/gi,
    /url\(([^)]+)\)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const raw = match[1];
      const normalized = normalizeUrl(raw) ?? (raw.startsWith('/') ? new URL(raw, baseUrl).toString() : null);
      if (normalized && !shouldSkip(normalized)) found.add(normalized);
    }
  }
  return found;
}

function collectUrlsFromHtml(html) {
  const baseUrl = new URL('https://shopify.design/');
  const urls = new Set();
  const tagPatterns = [
    /<img\b[^>]*>/gi,
    /<video\b[^>]*>/gi,
    /<source\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /<svg\b[\s\S]*?<\/svg>/gi,
  ];

  for (const pattern of tagPatterns) {
    for (const match of html.matchAll(pattern)) {
      const tag = match[0];
      const srcsetMatch = tag.match(/\b(?:srcset|srcSet|imageSrcSet)\s*=\s*["']([^"']+)["']/i);
      if (srcsetMatch) {
        for (const url of extractFromSrcset(srcsetMatch[1])) {
          if (!shouldSkip(url)) urls.add(url);
        }
      }
      for (const url of collectUrlsFromText(tag, baseUrl)) urls.add(url);
    }
  }

  // Script/json payloads can contain source URLs for media and icons.
  for (const url of collectUrlsFromText(html, baseUrl)) urls.add(url);
  for (const match of html.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    for (const token of match[0].split(/[\s,]+/)) {
      const normalized = normalizeUrl(token);
      if (normalized && !shouldSkip(normalized)) urls.add(normalized);
    }
  }

  return urls;
}

function collectUrlsFromCss(css) {
  const urls = new Set();
  for (const match of css.matchAll(/url\(([^)]+)\)/gi)) {
    const normalized = normalizeUrl(match[1]);
    if (normalized && !shouldSkip(normalized)) urls.add(normalized);
  }
  for (const match of css.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
    for (const token of match[0].split(/[\s,]+/)) {
      const normalized = normalizeUrl(token);
      if (normalized && !shouldSkip(normalized)) urls.add(normalized);
    }
  }
  return urls;
}

function inferLocalPath(urlString) {
  const url = new URL(urlString);
  const host = url.hostname === 'shopify.design' ? '' : url.hostname;
  const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const ext = path.extname(pathname);
  const safeQuery = url.search ? `__${crypto.createHash('sha1').update(url.search).digest('hex').slice(0, 10)}` : '';
  const queryHint = url.search ? url.search.replace(/^[?]/, '').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 40) : '';
  const querySuffix = url.search ? `${safeQuery}${queryHint ? `__${queryHint}` : ''}` : '';
  const base = host ? path.join(host, pathname) : pathname;
  if (!ext && pathname.endsWith('/')) return path.join(base, 'index');
  if (!ext && pathname && !pathname.endsWith('/')) return `${base}${querySuffix}`;
  return `${base}${querySuffix}`;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function downloadUrl(urlString, destPath) {
  await ensureDir(destPath);
  const response = await fetch(urlString, {
    headers: {
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      accept: '*/*',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${urlString}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(destPath, buffer);
  return buffer.length;
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }

  const contents = await Promise.all(SOURCE_FILES.map(async (file) => [file, await fs.readFile(file, 'utf8')]));
  const assetUrls = new Set();

  for (const [, text] of contents) {
    const urls = text.endsWith('}') || text.includes('@font-face')
      ? collectUrlsFromCss(text)
      : collectUrlsFromHtml(text);
    for (const url of urls) assetUrls.add(url);
  }

  const sortedUrls = [...assetUrls].sort((a, b) => a.localeCompare(b));
  const downloads = sortedUrls.map((url) => ({
    url,
    dest: path.join(PUBLIC_DIR, inferLocalPath(url)),
  }));

  console.log(`Found ${downloads.length} visual assets`);
  if (args.dryRun) {
    for (const item of downloads) {
      console.log(`${item.url} -> ${path.relative(ROOT, item.dest)}`);
    }
    return;
  }

  let downloaded = 0;
  let skipped = 0;
  let bytes = 0;

  await mapLimit(downloads, args.concurrency, async (item) => {
    try {
      const existed = await fs
        .access(item.dest)
        .then(() => true)
        .catch(() => false);
      if (existed) {
        skipped += 1;
        return;
      }
      const size = await downloadUrl(item.url, item.dest);
      downloaded += 1;
      bytes += size;
      console.log(`saved ${path.relative(ROOT, item.dest)}`);
    } catch (error) {
      console.error(`failed ${item.url}`);
      console.error(error instanceof Error ? error.message : String(error));
    }
  });

  console.log(`Summary: downloaded=${downloaded} skipped=${skipped} total=${downloads.length} bytes=${bytes}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
