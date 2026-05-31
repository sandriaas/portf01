#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const HTML_FILE = path.join(PUBLIC_DIR, 'shopify-design', 'index.html');
const OXYGEN_ASSET_DIR = path.join(
  PUBLIC_DIR,
  'cdn.shopify.com',
  'oxygen-v2',
  '53091',
  '115564',
  '237336',
  '3308732',
  'assets',
);
const BUILD_ID_FILE = path.join(ROOT, '.next', 'BUILD_ID');
const SERVER_HOST = '127.0.0.1';
const SERVER_PORT = Number(process.env.SHOPIFY_VERIFY_PORT ?? 3105);
const SERVER_URL = `http://${SERVER_HOST}:${SERVER_PORT}`;
const LIVE_SITE_URL = 'https://shopify.design';
const LOCAL_PATH_PATTERN =
  /\/(?:cdn\.shopify\.com|pds-shop-design\.myshopify\.com|draco|fonts|icons|favicons|carousel|clock)\/[^"'`\s<>()\\]+/g;
const FORBIDDEN_REMOTE_HOSTS = [
  /https?:\/\/cdn\.shopify\.com/gi,
  /https?:\/\/pds-shop-design\.myshopify\.com/gi,
  /https?:\/\/www\.googletagmanager\.com/gi,
  /https?:\/\/www\.clarity\.ms/gi,
  /https?:\/\/www\.gstatic\.com\/draco/gi,
];
const REQUIRED_TEXT_FILES = [
  HTML_FILE,
  path.join(OXYGEN_ASSET_DIR, 'root-CRV0kK55.js'),
  path.join(OXYGEN_ASSET_DIR, '_index-DATvhclo.js'),
  path.join(OXYGEN_ASSET_DIR, 'entry.client-B8ftjTuC.js'),
  path.join(OXYGEN_ASSET_DIR, 'manifest-9719090d.js'),
  path.join(OXYGEN_ASSET_DIR, 'index-BxNsuFNe.css'),
  path.join(OXYGEN_ASSET_DIR, '_index-d1PKX52d.css'),
];
const REQUIRED_STATIC_PATHS = [
  '/icons/logo.svg',
  '/icons/arrow-outward.svg',
  '/icons/design-mark-white.svg',
  '/icons/close.svg',
  '/fonts/AntiqueLegacy-Regular.woff2',
  '/fonts/AntiqueLegacy-Medium.woff2',
  '/fonts/AntiqueLegacy-Light.woff2',
  '/fonts/FragmentMono-Regular.woff2',
  '/favicons/11/favicon-32x32.png',
  '/favicons/11/favicon-16x16.png',
  '/favicons/11/apple-touch-icon.png',
  '/draco/1.5.7/draco_decoder.js',
  '/draco/1.5.7/draco_decoder.wasm',
  '/draco/1.5.7/draco_wasm_wrapper.js',
];
const livePathStatusCache = new Map();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listTextFiles(dirPath) {
  const files = [];
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTextFiles(fullPath));
      continue;
    }

    if (/\.(?:html|js|css|json|txt)$/i.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function collectLocalPaths(text) {
  const matches = text.match(LOCAL_PATH_PATTERN) ?? [];
  return new Set(
    matches
      .map((value) => value.replace(/[),]+$/g, ''))
      .filter((value) => !value.includes('${')),
  );
}

function findForbiddenRemoteHosts(text) {
  const matches = [];
  for (const pattern of FORBIDDEN_REMOTE_HOSTS) {
    for (const match of text.matchAll(pattern)) {
      matches.push(match[0]);
    }
  }
  return [...new Set(matches)];
}

async function verifyLocalFiles() {
  for (const filePath of REQUIRED_TEXT_FILES) {
    assert(await exists(filePath), `Missing required mirror file: ${path.relative(ROOT, filePath)}`);
  }

  const textFiles = [
    ...new Set([
      ...REQUIRED_TEXT_FILES,
      ...await listTextFiles(path.join(PUBLIC_DIR, 'cdn.shopify.com')),
    ]),
  ];
  const assetReferenceFiles = textFiles;
  const referencedPaths = new Set(REQUIRED_STATIC_PATHS);
  const forbiddenLeaks = [];

  for (const filePath of assetReferenceFiles) {
    const text = await fs.readFile(filePath, 'utf8');
    for (const localPath of collectLocalPaths(text)) {
      referencedPaths.add(localPath);
    }
  }

  for (const filePath of textFiles) {
    const text = await fs.readFile(filePath, 'utf8');
    const leaks = findForbiddenRemoteHosts(text);
    if (leaks.length > 0) {
      forbiddenLeaks.push({
        file: path.relative(ROOT, filePath),
        leaks,
      });
    }
  }

  assert(forbiddenLeaks.length === 0, `Found forbidden remote host leaks in mirrored text files:\n${forbiddenLeaks
    .map(({ file, leaks }) => `${file}: ${leaks.join(', ')}`)
    .join('\n')}`);

  const missingPaths = [];
  const skippedLive404Paths = [];
  for (const localPath of referencedPaths) {
    const targetPath = path.join(PUBLIC_DIR, localPath.replace(/^\/+/, ''));
    if (await exists(targetPath)) {
      continue;
    }

    if (/^\/(?:cdn\.shopify\.com|pds-shop-design\.myshopify\.com|draco)\//.test(localPath)) {
      missingPaths.push(localPath);
      continue;
    }

    const liveStatus = await getLivePathStatus(localPath);
    if (liveStatus === 404) {
      skippedLive404Paths.push(localPath);
      continue;
    }

    missingPaths.push(localPath);
  }

  assert(
    missingPaths.length === 0,
    `Missing localized assets referenced by the mirror:\n${missingPaths.sort().join('\n')}`,
  );

  const mp4Paths = [...referencedPaths].filter((value) => value.endsWith('.mp4')).sort();
  const imagePaths = [...referencedPaths]
    .filter((value) => /\.(?:png|jpe?g|webp|gif|svg)$/i.test(value))
    .sort();

  assert(mp4Paths.length > 0, 'No mirrored MP4 assets were discovered in the localized homepage runtime.');

  return {
    textFileCount: textFiles.length,
    referencedAssetCount: referencedPaths.size,
    mp4Paths,
    imagePaths,
    skippedLive404Paths,
  };
}

async function fetchWithFallback(url, init = {}) {
  let response = await fetch(url, init);
  if (response.status === 405 && init.method === 'HEAD') {
    response = await fetch(url);
  }
  return response;
}

async function getLivePathStatus(localPath) {
  if (livePathStatusCache.has(localPath)) {
    return livePathStatusCache.get(localPath);
  }

  const response = await fetchWithFallback(new URL(localPath, LIVE_SITE_URL).toString(), {
    method: 'HEAD',
  });
  livePathStatusCache.set(localPath, response.status);
  return response.status;
}

async function ensureHttpOk(url, { method = 'GET', acceptStatuses = [200], label } = {}) {
  const response = await fetchWithFallback(url, { method });
  if (!acceptStatuses.includes(response.status)) {
    throw new Error(`${label ?? url} responded with HTTP ${response.status}`);
  }
  return response;
}

async function startServer() {
  const child = spawn(
    'npm',
    ['run', 'start', '--', '--hostname', SERVER_HOST, '--port', String(SERVER_PORT)],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  let output = '';

  return await new Promise((resolve, reject) => {
    let resolved = false;
    const timeoutId = setTimeout(() => {
      if (resolved) return;
      child.kill('SIGTERM');
      reject(new Error(`Timed out starting Next production server.\n${output}`));
    }, 60_000);

    const handleChunk = (chunk) => {
      output += chunk.toString();
      if (!resolved && new RegExp(`http://${SERVER_HOST}:${SERVER_PORT}`).test(output)) {
        resolved = true;
        clearTimeout(timeoutId);
        resolve({ child, output });
      }
    };

    child.stdout.on('data', handleChunk);
    child.stderr.on('data', handleChunk);

    child.on('exit', (code, signal) => {
      if (resolved) return;
      clearTimeout(timeoutId);
      reject(new Error(`Next production server exited early (${signal ?? code}).\n${output}`));
    });
  });
}

async function stopServer(child) {
  if (!child || child.killed) return;

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 5_000);

    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });

    child.kill('SIGTERM');
  });
}

async function verifyServedClone(localSummary) {
  const htmlResponse = await ensureHttpOk(`${SERVER_URL}/`, {
    label: 'Homepage /',
  });
  const html = await htmlResponse.text();

  const servedLeaks = findForbiddenRemoteHosts(html);
  assert(
    servedLeaks.length === 0,
    `Served homepage leaked forbidden remote hosts: ${servedLeaks.join(', ')}`,
  );

  const servedAssetPaths = new Set(REQUIRED_STATIC_PATHS);
  for (const localPath of collectLocalPaths(html)) {
    servedAssetPaths.add(localPath);
  }

  const runtimePaths = [...servedAssetPaths]
    .filter((value) => value.startsWith('/cdn.shopify.com/oxygen-v2/') && /\.(?:js|css)$/i.test(value))
    .sort();
  const runtimeLeaks = [];

  for (const runtimePath of runtimePaths) {
    const runtimeResponse = await ensureHttpOk(new URL(runtimePath, `${SERVER_URL}/`).toString(), {
      label: runtimePath,
    });
    const runtimeText = await runtimeResponse.text();
    const leaks = findForbiddenRemoteHosts(runtimeText);
    if (leaks.length > 0) {
      runtimeLeaks.push({
        path: runtimePath,
        leaks,
      });
    }

    for (const localPath of collectLocalPaths(runtimeText)) {
      servedAssetPaths.add(localPath);
    }
  }

  assert(
    runtimeLeaks.length === 0,
    `Served runtime bundles leaked forbidden remote hosts:\n${runtimeLeaks
      .map(({ path, leaks }) => `${path}: ${leaks.join(', ')}`)
      .join('\n')}`,
  );

  const sampledMediaPaths = [
    ...localSummary.mp4Paths.slice(0, 4),
    ...localSummary.imagePaths.slice(0, 4),
  ];
  const smokePaths = [
    ...new Set(runtimePaths),
    ...REQUIRED_STATIC_PATHS,
    ...sampledMediaPaths,
  ];

  for (const localPath of smokePaths) {
    const method = /\.(?:mp4|png|jpe?g|webp|gif|wasm|woff2?)$/i.test(localPath) ? 'HEAD' : 'GET';
    const acceptStatuses = localPath.endsWith('.mp4') ? [200, 206] : [200];
    await ensureHttpOk(new URL(localPath, `${SERVER_URL}/`).toString(), {
      method,
      acceptStatuses,
      label: localPath,
    });
  }

  return {
    servedAssetCount: servedAssetPaths.size,
    runtimePathCount: runtimePaths.length,
    smokeCheckCount: smokePaths.length,
  };
}

async function main() {
  assert(await exists(BUILD_ID_FILE), 'Missing .next/BUILD_ID. Run `npm run build` before verification.');

  const localSummary = await verifyLocalFiles();
  let server;

  try {
    server = await startServer();
    const servedSummary = await verifyServedClone(localSummary);

    const summary = {
      verifiedAt: new Date().toISOString(),
      textFileCount: localSummary.textFileCount,
      referencedAssetCount: localSummary.referencedAssetCount,
      mirroredMp4Count: localSummary.mp4Paths.length,
      mirroredImageCount: localSummary.imagePaths.length,
      skippedLive404PathCount: localSummary.skippedLive404Paths.length,
      servedAssetCount: servedSummary.servedAssetCount,
      runtimePathCount: servedSummary.runtimePathCount,
      smokeCheckCount: servedSummary.smokeCheckCount,
      serverUrl: SERVER_URL,
    };

    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await stopServer(server?.child);
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
