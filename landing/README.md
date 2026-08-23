# landing/

The static landing page published at <https://rajagurunath.github.io/claw-compute/>.

Plain HTML, CSS and one script — no build step, no bundler, no dependencies.
The only external asset is Google Fonts. Every other path is relative so the
page works under the `/claw-compute/` project-pages base.

```
index.html          the page
assets/styles.css   Ledger Ink tokens, lifted from web/src/app/globals.css
assets/meter.js     the escrow meter, the copy button, the scroll reveal
assets/openclaw.svg the mark, copied from web/public/
.nojekyll           skip Jekyll processing on Pages
```

## Editing

Open `index.html` directly, or serve the directory:

```bash
cd landing && python3 -m http.server 8123
```

## Deploying

`.github/workflows/pages.yml` publishes this directory on every push to `main`
that touches `landing/**`. It can also be run by hand from the Actions tab.

One-time setup: repo **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The workflow's `GITHUB_TOKEN` is not allowed to create the
Pages site, so this switch has to be flipped by a repo admin before the first
deploy will succeed.

## Keeping it honest

The escrow meter simulates bookings — it is labelled `simulated booking` and
must stay that way while it is not reading the live ledger. The facts strip
under the hero carries only values that can be checked against the repo or the
chain (contract address, split, chain, worker target); it is deliberately not a
volume dashboard.
