import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const sectionNames = [
  "nav",
  "hero",
  "overlap",
  "work",
  "services",
  "video",
  "numbers",
  "journal",
  "footer",
];

const liveDir = process.env.X29_COMPARE_LIVE_DIR;
const localDir = process.env.X29_COMPARE_LOCAL_DIR;
const outputDir = process.env.X29_COMPARE_OUTPUT_DIR;

if (!liveDir || !localDir || !outputDir) {
  throw new Error(
    "Missing X29_COMPARE_LIVE_DIR, X29_COMPARE_LOCAL_DIR, or X29_COMPARE_OUTPUT_DIR",
  );
}

fs.mkdirSync(outputDir, { recursive: true });

const readDimensions = (imagePath) => {
  const output = execFileSync(
    "magick",
    ["identify", "-format", "%w %h", imagePath],
    { encoding: "utf8" },
  ).trim();
  const [width, height] = output.split(" ").map(Number);

  return { width, height };
};

const compareImages = (leftPath, rightPath, diffPath) => {
  const parseMetric = (value) => {
    const token = String(value).trim().split(/\s+/)[0];
    const parsed = Number(token);

    if (!Number.isFinite(parsed)) {
      throw new Error(`Unable to parse ImageMagick metric: ${value}`);
    }

    return parsed;
  };

  try {
    const output = execFileSync(
      "magick",
      ["compare", "-metric", "AE", leftPath, rightPath, diffPath],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();

    return parseMetric(output || "0");
  } catch (error) {
    const metric = String(error.stderr ?? error.stdout ?? "").trim();
    if (metric.length === 0) {
      throw error;
    }

    return parseMetric(metric);
  }
};

const report = [];

for (const name of sectionNames) {
  const livePath = path.join(liveDir, `${name}.png`);
  const localPath = path.join(localDir, `${name}.png`);
  const diffPath = path.join(outputDir, `${name}.png`);

  if (!fs.existsSync(livePath) || !fs.existsSync(localPath)) {
    report.push({
      name,
      missing: true,
    });
    continue;
  }

  const liveDimensions = readDimensions(livePath);
  const localDimensions = readDimensions(localPath);

  if (
    liveDimensions.width !== localDimensions.width ||
    liveDimensions.height !== localDimensions.height
  ) {
    report.push({
      name,
      dimensionsMatch: false,
      liveDimensions,
      localDimensions,
    });
    continue;
  }

  const diffPixels = compareImages(livePath, localPath, diffPath);
  const totalPixels = liveDimensions.width * liveDimensions.height;

  report.push({
    name,
    dimensionsMatch: true,
    liveDimensions,
    localDimensions,
    diffPixels,
    diffPercent: totalPixels === 0 ? 0 : Number(((diffPixels / totalPixels) * 100).toFixed(4)),
  });
}

fs.writeFileSync(
  path.join(outputDir, "__report.json"),
  JSON.stringify(report, null, 2),
);

console.log(JSON.stringify(report, null, 2));
