# README and docs diagrams

The pictures in the README and on the docs' architecture pages are rendered from `readme-system.mmd` (the system) and `readme-group-turn.mmd` (one group turn). The themes use Najimi's own colours (black canvas, the aura's pink and violet) and Funnel Sans. Edit the Mermaid source, then render light and dark PNGs at 2× into `.github/assets/` and copy them to `apps/docs/public/diagrams/`:

```sh
mmdc -i .github/diagrams/readme-system.mmd -o .github/assets/system-light.png -c .github/diagrams/mermaid-light.json -b '#FFFFFF' -s 2
mmdc -i .github/diagrams/readme-system.mmd -o .github/assets/system-dark.png -c .github/diagrams/mermaid-dark.json -b '#000000' -s 2
mmdc -i .github/diagrams/readme-group-turn.mmd -o .github/assets/group-turn-light.png -c .github/diagrams/mermaid-light.json -b '#FFFFFF' -s 2
mmdc -i .github/diagrams/readme-group-turn.mmd -o .github/assets/group-turn-dark.png -c .github/diagrams/mermaid-dark.json -b '#000000' -s 2
cp .github/assets/system-*.png .github/assets/group-turn-*.png apps/docs/public/diagrams/
```

Mermaid CLI needs a local Chromium. Where Puppeteer can't find one, pass `-p` with a Puppeteer config whose `executablePath` points at a local Chrome.
