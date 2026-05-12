import { createHighlighter } from "shiki";
import puppeteer from "puppeteer";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const sourceFile = resolve(repoRoot, "src/body.tex");
const outDir = resolve(repoRoot, "src/code-screenshots");
const grammarPath = resolve(__dirname, "grammars/coq.tmLanguage.json");

const THEME = "github-light";

const coqGrammar = JSON.parse(readFileSync(grammarPath, "utf8"));
const source = readFileSync(sourceFile, "utf8");

// Match: % #CODESHOT name\n  ... %-prefixed lines ... \n% #END
// Each interior line must start with % (i.e. be a LaTeX comment).
// Header: % #CODESHOT name [key=val ...]
const blockRe =
  /^[ \t]*%\s*#CODESHOT([^\n]*)\r?\n([\s\S]*?)^[ \t]*%\s*#END\s*$/gm;
const blocks = [];
let m;
let fallbackIdx = 1;
while ((m = blockRe.exec(source)) !== null) {
  const header = m[1].trim();
  const tokens = header.split(/\s+/).filter(Boolean);
  let name = null;
  let lang = "coq";
  for (const tok of tokens) {
    const eq = tok.indexOf("=");
    if (eq === -1) {
      if (name === null) name = tok;
    } else {
      const k = tok.slice(0, eq);
      const v = tok.slice(eq + 1);
      if (k === "lang") lang = v;
    }
  }
  if (!name) name = `snippet${fallbackIdx++}`;
  const code = m[2]
    .split(/\r?\n/)
    .map((line) => line.replace(/^[ \t]*%[ \t]?/, ""))
    .filter((line, i, arr) => !(i === arr.length - 1 && line === ""))
    .join("\n");
  blocks.push({ name, lang, code });
}

if (blocks.length === 0) {
  console.error(`no #CODESHOT blocks found in ${sourceFile}`);
  process.exit(1);
}

const highlighter = await createHighlighter({
  themes: [THEME],
  langs: [{ ...coqGrammar, name: "coq", scopeName: "source.coq" }, "asm"],
});

const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.setViewport({ width: 2400, height: 200, deviceScaleFactor: 3 });

for (const { name, lang, code } of blocks) {
  const html = highlighter.codeToHtml(code, { lang, theme: THEME });
  const fullHtml = `<!doctype html><html><head><style>
    html, body { margin: 0; padding: 0; background: #ffffff; }
    body { padding: 0px; display: inline-block; font-family: Menlo, monospace; }
    pre.shiki { margin: 0; padding: 0px 0px; border-radius: 0px; font-size: 14px; line-height: 1.55; }
    pre.shiki code { counter-reset: line; }
    pre.shiki .line { display: inline; }
    pre.shiki code > .line::before {
      counter-increment: line;
      content: counter(line);
      display: inline-block;
      width: 2em;
      margin-right: 1em;
      text-align: right;
      color: #999;
    }
  </style></head><body>${html}</body></html>`;
  await page.setContent(fullHtml, { waitUntil: "load" });
  const body = await page.$("body");
  const out = resolve(outDir, `${name}.png`);
  await body.screenshot({ path: out });
  console.log(`wrote ${name}.png`);
}

await browser.close();
console.log(`\ndone — ${blocks.length} screenshots written to ${outDir}`);
