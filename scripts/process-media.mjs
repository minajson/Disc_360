import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";

/**
 * One-shot production asset pipeline (specs: MEDIA_GUIDE.md, generated from
 * data/media-registry.ts). Takes the raw drops in public/media and produces
 * the guide-named deliverables: WebM + MP4 + poster per film (muted, no
 * audio track), optimised WebP portraits, and the brand derivatives in
 * public/brand from the raster mark. Raw sources are preserved with a
 * `-source` suffix so reprocessing stays possible.
 */

const MEDIA = "public/media";
const BRAND = "public/brand";
const SRC = "assets-src";
const mb = (path) => (statSync(path).size / 1024 / 1024).toFixed(2);
const kb = (path) => Math.round(statSync(path).size / 1024);

function ffmpeg(args) {
  execFileSync(ffmpegPath, ["-y", "-hide_banner", "-loglevel", "error", ...args], {
    stdio: ["ignore", "inherit", "inherit"],
  });
}

/** Encode one film: crop to ratio, scale, strip audio, webm+mp4+poster. */
function film({ source, base, w, h, maxSeconds, webmCrf, x264Crf }) {
  const crop = `crop='min(iw,ih*${w}/${h})':'min(ih,iw*${h}/${w})',scale=${w}:${h}`;
  const t = maxSeconds ? ["-t", String(maxSeconds)] : [];
  ffmpeg(["-i", source, ...t, "-vf", crop, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(webmCrf), "-row-mt", "1", `${base}.webm`]);
  ffmpeg(["-i", source, ...t, "-vf", crop, "-an", "-c:v", "libx264", "-crf", String(x264Crf), "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${base}.mp4`]);
  ffmpeg(["-ss", "1", "-i", `${base}.mp4`, "-frames:v", "1", "-q:v", "4", `${base}-poster.jpg`]);
  console.log(`${base}: webm ${mb(`${base}.webm`)}MB · mp4 ${mb(`${base}.mp4`)}MB · poster ${kb(`${base}-poster.jpg`)}KB`);
}

/* ── 1 · hero film: desktop 3:2 + mobile 4:5, ≤4MB, 10–20s ─────────────── */
if (existsSync(`${MEDIA}/hero.mp4`) && !existsSync(`${SRC}/media/hero-source.mp4`)) {
  renameSync(`${MEDIA}/hero.mp4`, `${SRC}/media/hero-source.mp4`);
}
film({ source: `${SRC}/media/hero-source.mp4`, base: `${MEDIA}/hero`, w: 1920, h: 1280, maxSeconds: 20, webmCrf: 44, x264Crf: 30 });
film({ source: `${SRC}/media/hero-source.mp4`, base: `${MEDIA}/hero-mobile`, w: 1080, h: 1350, maxSeconds: 20, webmCrf: 44, x264Crf: 30 });

/* ── 2 · case-study film: 16:9 1600×900, ≤3MB ──────────────────────────── */
if (existsSync(`${MEDIA}/case-02.mp4.mp4`)) {
  renameSync(`${MEDIA}/case-02.mp4.mp4`, `${SRC}/media/case-01-source.mp4`);
}
film({ source: `${SRC}/media/case-01-source.mp4`, base: `${MEDIA}/case-01`, w: 1600, h: 900, maxSeconds: 40, webmCrf: 46, x264Crf: 31 });

/* ── 2b · coach living portrait: 4:5 1200×1500, face-safe upward crop ──── */
if (existsSync(`${MEDIA}/coach-01.mp4`) && !existsSync(`${SRC}/media/coach-01-source.mp4`)) {
  renameSync(`${MEDIA}/coach-01.mp4`, `${SRC}/media/coach-01-source.mp4`);
}
if (existsSync(`${SRC}/media/coach-01-source.mp4`)) {
  // Head-and-shoulders crop measured against this source (1080×1340): the
  // face spans ~60% of the frame with safe forehead/chin margins. Output is
  // sized to the display slot (max ~320 CSS px → 800×1000 retina) so the
  // upscale stays modest.
  const crop = "crop=488:610:421:44,scale=800:1000";
  ffmpeg(["-i", `${SRC}/media/coach-01-source.mp4`, "-t", "20", "-vf", crop, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "44", "-row-mt", "1", `${MEDIA}/coach-01.webm`]);
  ffmpeg(["-i", `${SRC}/media/coach-01-source.mp4`, "-t", "20", "-vf", crop, "-an", "-c:v", "libx264", "-crf", "30", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", `${MEDIA}/coach-01.mp4`]);
  ffmpeg(["-ss", "1", "-i", `${MEDIA}/coach-01.mp4`, "-frames:v", "1", "-q:v", "4", `${MEDIA}/coach-01-poster.jpg`]);
  console.log(`coach-01: webm ${mb(`${MEDIA}/coach-01.webm`)}MB · mp4 ${mb(`${MEDIA}/coach-01.mp4`)}MB · poster ${kb(`${MEDIA}/coach-01-poster.jpg`)}KB`);
}

/* ── 3 · testimonial portraits: 400×400 WebP ≤80KB ─────────────────────── */
for (const n of ["01", "02", "03"]) {
  const src = `${MEDIA}/testimonial-${n}.webp.png`;
  if (!existsSync(src)) continue;
  await sharp(src).resize(400, 400, { fit: "cover" }).webp({ quality: 82 }).toFile(`${MEDIA}/testimonial-${n}.webp`);
  unlinkSync(src);
  console.log(`testimonial-${n}.webp: ${kb(`${MEDIA}/testimonial-${n}.webp`)}KB`);
}

/* ── 4 · brand derivatives from the raster mark ────────────────────────── */
if (existsSync(`${MEDIA}/logo.png`) && !existsSync(`${SRC}/brand/mark-source.png`)) {
  copyFileSync(`${MEDIA}/logo.png`, `${SRC}/brand/mark-source.png`);
  unlinkSync(`${MEDIA}/logo.png`);
}
// Tight-trimmed mark, pure white → transparent (the white in the source is
// negative space; the canvas shows through the cutouts as designed).
const mark = sharp(`${SRC}/brand/mark-source.png`).trim({ threshold: 12 }).unflatten();
await mark.clone().resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(`${SRC}/brand/mark.png`);
await sharp(`${SRC}/brand/mark.png`).resize(192, 192, { fit: "inside" }).png({ palette: true, effort: 10, compressionLevel: 9 }).toFile(`${BRAND}/mark-192.png`);

const markB64 = (size) => sharp(`${SRC}/brand/mark.png`).resize(size, size, { fit: "inside" }).png({ palette: true, effort: 10, compressionLevel: 9 }).toBuffer().then((b) => b.toString("base64"));

// icon.svg / favicon.svg — scalable wrappers embedding the mark.
const icon320 = await markB64(320);
writeFileSync(`${BRAND}/icon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320"><image href="data:image/png;base64,${icon320}" width="320" height="320"/></svg>\n`);
const icon96 = await markB64(72);
writeFileSync(`${BRAND}/favicon.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><image href="data:image/png;base64,${icon96}" width="72" height="72"/></svg>\n`);

// logo.svg — horizontal lockup: mark + wordmark text.
writeFileSync(`${BRAND}/logo.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 120">
  <image href="data:image/png;base64,${icon96}" x="8" y="12" width="96" height="96"/>
  <text x="122" y="78" font-family="Fraunces, Georgia, serif" font-size="52" font-weight="600" fill="#17201D">DISC<tspan fill="#174C3C">360</tspan></text>
</svg>\n`);

// app-icon.png — mark on solid ivory, 1024².
const appMark = await sharp(`${SRC}/brand/mark.png`).resize(780, 780, { fit: "inside" }).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#F7F4EE" } })
  .composite([{ input: appMark, gravity: "centre" }])
  .png({ palette: true, effort: 10, compressionLevel: 9 })
  .toFile(`${BRAND}/app-icon.png`);

// og-image.png — 1200×630 brand card on ivory.
const ogMark = await sharp(`${SRC}/brand/mark.png`).resize(360, 360, { fit: "inside" }).png().toBuffer();
const ogText = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <text x="470" y="300" font-family="Fraunces, Georgia, serif" font-size="92" font-weight="600" fill="#17201D">DISC<tspan fill="#174C3C">360</tspan></text>
  <text x="474" y="366" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="#5F6965">Personality intelligence for real teams</text>
  <rect x="474" y="410" width="180" height="4" fill="#4B8275"/>
</svg>`);
await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#F7F4EE" } })
  .composite([{ input: ogMark, left: 80, top: 135 }, { input: ogText, left: 0, top: 0 }])
  .png({ palette: true, effort: 10, compressionLevel: 9 })
  .toFile(`${BRAND}/og-image.png`);

for (const f of ["icon.svg", "favicon.svg", "logo.svg", "app-icon.png", "og-image.png", "mark-192.png"]) {
  console.log(`${BRAND}/${f}: ${kb(`${BRAND}/${f}`)}KB`);
}
console.log("done");
