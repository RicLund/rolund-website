# Rolund Website

One-page static Rolund music-link site built with Vite and deployable on Cloudflare Workers Static Assets.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production build is written to `dist/`.

## Cloudflare

For Cloudflare pulling from GitHub, use:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`

The included `wrangler.jsonc` also supports deploying through Workers Static Assets:

```bash
npm run deploy
```

Update music platform URLs in `src/main.js`.
