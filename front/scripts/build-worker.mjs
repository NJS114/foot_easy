import { build } from "esbuild";
import { mkdir, writeFile, readFile, cp } from "node:fs/promises";
await mkdir("dist/server", { recursive: true });
await build({
  entryPoints: ["worker/index.ts"],
  outfile: "dist/server/index.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: true,
  tsconfig: "tsconfig.app.json",
});
await mkdir("dist/.openai", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
const config = {
  name: "foot-easy",
  main: "index.js",
  compatibility_date: "2026-05-15",
  assets: {
    directory: "../client",
    binding: "ASSETS",
    not_found_handling: "single-page-application",
  },
  d1_databases: [
    {
      binding: "DB",
      database_name: "foot-easy",
      database_id: "00000000-0000-4000-8000-000000000000",
      migrations_dir: "../../drizzle",
    },
  ],
  r2_buckets: [{ binding: "BUCKET", bucket_name: "foot-easy-files" }],
};
await writeFile("dist/server/wrangler.json", JSON.stringify(config, null, 2));
const manifest = JSON.parse(await readFile(".openai/hosting.json", "utf8"));
if (manifest.static || manifest.d1 !== "DB" || manifest.r2 !== "BUCKET")
  throw new Error("Worker bindings missing");
