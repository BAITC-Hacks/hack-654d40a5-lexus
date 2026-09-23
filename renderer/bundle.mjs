import { bundle } from "@remotion/bundler";
import path from "node:path";
await bundle({
  entryPoint: path.resolve("src/index.tsx"),
  outDir: path.resolve("bundle"),
  publicDir: path.resolve("public"),
});
console.log("Video bundle ready");
