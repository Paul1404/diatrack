// Generates the full favicon/icon set from public/favicon.svg using sharp.
// Run with: bun run generate:icons
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp, { type FormatEnum } from "sharp";

const PUBLIC = join(process.cwd(), "public");
const SVG = join(PUBLIC, "favicon.svg");

const PNG_TARGETS: Array<{ size: number; name: string }> = [
  { size: 16, name: "favicon-16.png" },
  { size: 32, name: "favicon-32.png" },
  { size: 180, name: "apple-touch-icon.png" },
  { size: 192, name: "icon-192.png" },
  { size: 512, name: "icon-512.png" },
];

async function main() {
  const svg = await readFile(SVG);

  for (const target of PNG_TARGETS) {
    const out = await sharp(svg, { density: 384 })
      .resize(target.size, target.size)
      .png()
      .toBuffer();
    await writeFile(join(PUBLIC, target.name), out);
    console.info(`generated ${target.name}`);
  }

  // favicon.ico (16/32/48 packed). sharp emits a single-size ICO; 32px is fine for legacy.
  const ico = await sharp(svg, { density: 384 }).resize(48, 48).toFormat("png").toBuffer();
  // Wrap the 48px PNG as ICO via sharp's ico support when available; fall back to png bytes.
  try {
    const icoBuf = await sharp(ico)
      .toFormat("ico" as keyof FormatEnum & string)
      .toBuffer();
    await writeFile(join(PUBLIC, "favicon.ico"), icoBuf);
  } catch {
    await writeFile(join(PUBLIC, "favicon.ico"), ico);
  }
  console.info("generated favicon.ico");

  const manifest = {
    name: "DiaTrack",
    short_name: "DiaTrack",
    description: "Tracker für Diabetes-Sensoren und Katheter.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0052CC",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
  await writeFile(join(PUBLIC, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));
  console.info("generated manifest.webmanifest");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
