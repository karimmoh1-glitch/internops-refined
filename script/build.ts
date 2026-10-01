import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@octokit/rest",
  "bcryptjs",
  "dotenv",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "helmet",
  "jsonwebtoken",
  "multer",
  "nanoid",
  "openai",
  "pg",
  "resend",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  // The migration runner ships alongside the server so `npm start` can
  // apply pending migrations before the app boots (see package.json).
  await esbuild({
    entryPoints: ["script/migrate.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/migrate.cjs",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // Vercel function: one self-contained bundle (only pg's optional native
  // binding stays external) so the serverless build needs no tracing.
  // ESM, because package.json is "type": "module" and the runtime would
  // otherwise parse a CJS bundle as ESM. The banner restores `require`
  // and `__dirname` for the CommonJS dependencies bundled inside.
  await esbuild({
    entryPoints: ["server/vercel.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: "api/index.js",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    external: ["pg-native"],
    banner: { js: "import { createRequire as __createRequire } from 'module'; import { fileURLToPath as __fileURLToPath } from 'url'; import { dirname as __dirnameOf } from 'path'; const require = __createRequire(import.meta.url); const __filename = __fileURLToPath(import.meta.url); const __dirname = __dirnameOf(__filename);" },
    logLevel: "info",
  });

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
