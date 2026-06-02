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

The contact form uses Cloudflare Email Service through the `CONTACT_EMAIL` binding.
Before the form can send live messages, enable Email Sending for `rolundmusic.com`
in Cloudflare and verify `info@rolundmusic.com` as a sender/destination.

Update music platform URLs in `src/main.js`.
