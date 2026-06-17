// Generates public/help-topics.json from src/components/help/helpContent.ts
// so the chatbot can fetch it at https://<host>/help-topics.json.
//
// Usage:
//   node scripts/generate-help-corpus.mjs
//
// Or wire it into package.json:
//   "predev":  "node scripts/generate-help-corpus.mjs",
//   "prebuild": "node scripts/generate-help-corpus.mjs"
//
// The script uses `tsx` to import the TypeScript source. If tsx is not
// installed, fall back to plain Node ESM by transpiling the imports.

import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")
const sourceFile = pathToFileURL(resolve(repoRoot, "src/components/help/helpContent.ts")).href
const outFile = resolve(repoRoot, "public/help-topics.json")

async function main() {
  // tsx provides ESM loaders that import .ts directly. Most modern dev setups
  // have it. If not, `npm i -D tsx` (devDependency).
  try {
    const mod = await import(sourceFile)
    const corpus = mod.helpAsJson()
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, JSON.stringify(corpus, null, 2), "utf8")
    console.log(`Wrote ${corpus.topics.length} help topics → ${outFile}`)
  } catch (e) {
    console.error("Failed to import helpContent.ts directly.")
    console.error("Install tsx and run with the loader, e.g.:")
    console.error("  npx tsx scripts/generate-help-corpus.mjs")
    console.error("")
    console.error("Underlying error:", e.message)
    process.exit(1)
  }
}

main()
