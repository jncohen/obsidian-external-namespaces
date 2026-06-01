import esbuild from "esbuild";
import process from "process";
import { dirname, extname, isAbsolute, join } from "path";
import { fileURLToPath } from "url";

const isProduction = process.argv.includes("--production");
const projectRoot = dirname(fileURLToPath(import.meta.url));
const localSourcePlugin = {
  name: "local-source",
  setup(build) {
    build.onResolve({ filter: /^(\.\.?\/|.*src[\\/]main\.ts$)/ }, args => {
      let resolved = args.path;
      if (!isAbsolute(resolved)) resolved = join(args.resolveDir || projectRoot, resolved);
      if (!extname(resolved)) resolved += ".ts";
      return { path: resolved };
    });
  },
};

esbuild.build({
  entryPoints: [join(projectRoot, "src/main.ts")],
  bundle: true,
  outfile: join(projectRoot, "main.js"),
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
  plugins: [localSourcePlugin],
}).catch(() => process.exit(1));
