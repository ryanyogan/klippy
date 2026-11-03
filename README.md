# Klippy

Klippy is a small personal agent that runs on Cloudflare. It answers with Claude, uses tools,
keeps notes, remembers you and nudges you on schedule.

This repo is the reference build for the build-along courses on [bits](https://bits.yogan.dev).
Every lesson has a git tag (`a-01`, `a-02`, ...). If you get stuck, check out the tag for the
lesson you're on and compare:

```sh
git clone https://github.com/ryanyogan/klippy
cd klippy
git checkout a-03
```

| Tags | Course |
|---|---|
| `a-01` … `a-05` | Your first Worker |
| `b-01` … `b-09` | Give your model tools |
| `c-01` … `c-09` | Your first agent loop |

`docs/outputs/<tag>.txt` holds the real terminal output each lesson shows, with the date it was
recorded.

## Requirements

- Node.js 24 LTS (`.node-version`) and pnpm 10 (pinned in `package.json`, via corepack)
- A free Cloudflare account
- For Claude: an Anthropic API key stored in your own AI Gateway (BYOK). Without one, Klippy can
  run on a free Workers AI model by changing one line.

## License

MIT. See `LICENSE`.
