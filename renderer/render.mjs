import fs from "node:fs";
import path from "node:path";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
const [manifest, mode] = process.argv.slice(2);
if (!manifest || !["preview", "final"].includes(mode))
  throw new Error("Expected manifest and preview|final");
const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
const base = path.dirname(manifest);
// A 30-second pilot is already the complete approved movie. Reuse exact bytes.
if (
  mode === "final" &&
  m.duration <= 30 &&
  fs.existsSync(path.join(base, "preview.mp4"))
) {
  const out = path.join(base, "final.mp4");
  fs.copyFileSync(path.join(base, "preview.mp4"), out);
  console.log(
    JSON.stringify({ status: "ready", output: out, reusedPreview: true }),
  );
  process.exit(0);
}
const props = { ...m };
const executable = process.env.CHROME_EXECUTABLE || undefined;
const options = {
  browserExecutable: executable,
  chromiumOptions: { disableWebSecurity: false },
  logLevel: "error",
};
const composition = await selectComposition({
  serveUrl: path.resolve("renderer/bundle"),
  id: "Brief",
  inputProps: props,
  ...options,
});
const seconds = mode === "preview" ? Math.min(30, m.duration) : m.duration;
const out = path.join(base, mode === "preview" ? "preview.mp4" : "final.mp4");
const silent = path.join(base, mode + "-silent.mp4");
await renderMedia({
  serveUrl: path.resolve("renderer/bundle"),
  composition,
  codec: "h264",
  outputLocation: silent,
  inputProps: props,
  frameRange: [0, seconds * 30 - 1],
  concurrency: 2,
  crf: 24,
  timeoutInMilliseconds: 60000,
  ...options,
});
if (fs.existsSync(path.join(base, "audio.mp3"))) {
  execFileSync(
    process.env.FFMPEG_PATH || "ffmpeg",
    [
      "-y",
      "-i",
      silent,
      "-i",
      path.join(base, "audio.mp3"),
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-af",
      "apad",
      "-t",
      String(seconds),
      "-movflags",
      "+faststart",
      out,
    ],
    { stdio: "pipe" },
  );
  fs.unlinkSync(silent);
} else fs.renameSync(silent, out);
console.log(JSON.stringify({ status: "ready", output: out }));
