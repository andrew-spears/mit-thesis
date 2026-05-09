import { createHighlighter } from 'shiki';
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const grammarPath = resolve(__dirname, 'grammars/coq.tmLanguage.json');
const coqGrammar = JSON.parse(readFileSync(grammarPath, 'utf8'));

const sample = `Definition SymexNormalInstruction {opts : symbolic_options_computed_opt} {descr:description}
    (instr : NormalInstruction) : M unit :=
    match instr.(Syntax.op), instr.(args) with
    ...
    | vpaddq, [dst; src1; src2] => (* packed add of quadwords *)
        let num_lanes := (op_size / 64)%N in
        v1 <- GetOperand src1;
        v2 <- GetOperand src2;
        result <- App ((vadd 64 num_lanes), [v1; v2]);
        SetOperand dst result
    ...`;

const themes = ['light-plus', 'github-light', 'one-light', 'min-light', 'solarized-light'];

const highlighter = await createHighlighter({
  themes,
  langs: [{ ...coqGrammar, name: 'coq', scopeName: 'source.coq' }],
});

const browser = await puppeteer.launch();
const page = await browser.newPage();

for (const theme of themes) {
  const html = highlighter.codeToHtml(sample, { lang: 'coq', theme });
  // Wrap with line numbers and padding to mimic CodeSnap.
  const fullHtml = `<!doctype html><html><head><style>
    body { margin: 0; padding: 24px; display: inline-block; font-family: Menlo, monospace; }
    pre.shiki { margin: 0; padding: 16px 20px; border-radius: 8px; font-size: 14px; line-height: 1.5; }
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
  await page.setContent(fullHtml);
  const body = await page.$('body');
  const out = resolve(__dirname, `../sample_${theme}.png`);
  await body.screenshot({ path: out, omitBackground: false });
  console.log('wrote', out);
}

await browser.close();
