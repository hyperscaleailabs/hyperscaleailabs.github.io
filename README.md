# hyperscaleailabs.github.io

The Hyperscale AI Labs website — the personal site of **Constantine Gurnov**,
ML platform, AI systems and AI infrastructure engineer.

Live at **https://hyperscaleailabs.github.io/**

| Page | Contents |
| --- | --- |
| `index.html` | Hero with an interactive WebGL globe, practice summary, capability grid, measured outcomes |
| `work.html` | Full professional history (CV), stack and education |
| `projects.html` | Open source repositories, rendered from a JSON data file |
| `cv/` | Downloadable PDF CV |

## Design

Dark museum ground, hairline column rules, high-contrast serif display type
against monospace micro-labels, and scroll-driven word-by-word reveals.

The hero globe samples an equirectangular land mask into a point cloud, extrudes
bars at major cloud and interconnect metros on a blue→cyan→green→amber→red ramp,
adds a fresnel rim shell, and draws great-circle arcs between regions. It spins on
its own and responds to drag. **Bar heights are illustrative** — the globe is a
visual, not a dataset.

## Architecture

No build step, no framework, no tracker. Plain HTML, one stylesheet, two scripts.
`three.js` is vendored into `assets/vendor/`, so the only external requests are
Google Fonts. Everything degrades: without JavaScript the pages are still complete
readable documents, and `prefers-reduced-motion` disables all animation.

```
index.html  work.html  projects.html  404.html
assets/
  css/site.css          design tokens + all layout
  js/globe.js           WebGL globe (ES module)
  js/site.js            nav, scroll reveals, project rendering
  data/projects.json    <- edit this to change the project list
  img/                  land mask, favicon
  vendor/               three.js
cv/                     PDF CV
```

## Editing

**Add or change a project** — edit `assets/data/projects.json`:

```json
{
  "name": "repo-name",
  "description": "One or two sentences.",
  "url": "https://github.com/hyperscaleailabs/repo-name",
  "tags": ["Python", "Topic"]
}
```

**Change CV content** — edit `work.html` directly, and replace
`cv/Constantine_Gurnov_CV.pdf` with a new export.

**Change colours or type** — every token is at the top of `assets/css/site.css`
under `:root`.

## Running locally

```bash
python3 -m http.server 4321
```

Then open <http://localhost:4321>. A plain file open (`file://`) will not work —
the project list is fetched over HTTP and ES modules require an origin.

## Deployment

GitHub Pages serves the default branch from the repository root. Pushing to
`main` publishes. `.nojekyll` disables Jekyll processing.

## Credits

See [`NOTICE`](NOTICE) for third-party components. Site code is MIT licensed;
written content and the CV remain © Constantine Gurnov.
