import esbuild from "esbuild";
import process from "process";

const isProduction = process.argv.includes("--production");

esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "main.js",
  platform: "node",
  target: "es2020",
  format: "cjs",
  external: [
    "obsidian",
    "fs",
    "path",
    "os",
    "electron"
  ],
  sourcemap: !isProduction,
  minify: isProduction,
}).catch(() => process.exit(1));
