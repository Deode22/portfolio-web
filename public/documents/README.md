# Documents

Drop the CV PDF here and it appears on the site. No code change, no config, no
restart of anything but the dev server.

## What the site looks for

`src/data/profile.ts` sets a **preferred** filename:

```ts
cvPath: "/documents/Daniel_Fernandez_CV.pdf",
```

The hero resolves the download link in two steps (`src/lib/assets.ts`):

1. that exact path, if it exists **and is not empty**;
2. otherwise, any other non-empty PDF in this folder.

So the filename above is a preference, not a contract — `cv.pdf`,
`daniel-fernandez-2026.pdf` or anything else works. Only the first PDF in the
manifest is used, so keep exactly one here.

## Why the button disappears instead of 404-ing

The "Download CV" button is conditionally rendered. If this folder holds no
usable PDF, the hero renders no button at all rather than a link that fails.
That is deliberate: a dead download link on a portfolio is worse than no link.

## The rule that bit us

A **zero-byte** file counts as missing. It is not enough for a file to exist:

- an empty PDF downloads as a 0-byte file, which Acrobat reports as damaged;
- an empty PNG makes `next/image` answer **HTTP 400**, not 404, so the
  placeholder never renders and you get a console error instead.

Both were live bugs here, caused by placeholder stubs committed to `public/`.
`scripts/sync-assets.mjs` now reports them separately:

```bash
npm run assets:sync
# [sync-assets] 1 ZERO-BYTE (treated as unavailable):
#   - documents/cv.pdf
```

If you ever see that output, the file is broken — replace it or delete it.

## Still open

There is no real CV in this repo yet. The button is hidden until one is added.
