import * as esbuild from "esbuild";
import esbuildPluginTsc from "esbuild-plugin-tsc";

const watchMode = process.argv.includes("--watch");

let esbuildArgs = {
  entryPoints: [
    "src/index.ts",
  ],
  platform: "node",
  packages: "external",
  bundle: true,
  sourcemap: true,
  format: "esm",
  minify: true,
  keepNames: true,
  metafile: true,
  treeShaking: false,
  outfile: "../dist/server.js",
  logLevel: "info",
  plugins: [
    esbuildPluginTsc({}),
  ],
  alias: {
  },
  external: [
    "thebit.config.js",
  ]
};

if (watchMode) {
  let ctx = await esbuild.context(esbuildArgs);
  await ctx.watch();
  console.log("watching...");
} else {
  esbuild.build(esbuildArgs);
}
