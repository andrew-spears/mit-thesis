# Verified Equivalence Checking for Vector Assembly in Fiat Cryptography

MEng thesis by Andrew M. Spears, MIT EECS, May 2026.

## Building

The thesis source lives in [src/](src/). To build:

```sh
cd src
latexmk -lualatex MIT-Thesis.tex
```

Built output: [src/MIT-Thesis.pdf](src/MIT-Thesis.pdf).

Run

```sh
node scripts/codeshot.mjs
```

to generate code screenshots from "#CODESHOT'-delimited comments.

## Layout

- [src/MIT-Thesis.tex](src/MIT-Thesis.tex) — main document
- [src/body.tex](src/body.tex), [appendixa.tex](src/appendixa.tex), [appendixb.tex](src/appendixb.tex) — content
- [src/abstract.tex](src/abstract.tex), [acknowledgments.tex](src/acknowledgments.tex), [biography.tex](src/biography.tex) — frontmatter
- [src/references.bib](src/references.bib) — bibliography
- [src/mitthesis.cls](src/mitthesis.cls) — MIT thesis class (J. H. Lienhard, [github.com/jhlienhard/mitthesis](https://github.com/jhlienhard/mitthesis))
- [scripts/](scripts/) — code-screenshot rendering helpers (Shiki + Puppeteer)

## TODO

- a better solution for code snippets?
- double check formatting and specs
