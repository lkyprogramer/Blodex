![Blodex](docs/assets/Blodex.png)

# Blodex

Isometric fantasy hack-and-slash MVP built with Phaser + TypeScript in a pnpm workspace.

## Quick start

```bash
pnpm install
pnpm dev
```

## Workspace

- `apps/game-client`: browser game client (Phaser + Vite)
- `packages/core`: deterministic game systems and contracts
- `packages/content`: game content data (items, monsters, loot)
- `packages/tooling`: asset pipeline scripts and manifest validation

## Scripts

- `pnpm dev`: run game locally
- `pnpm test`: run `core` + `game-client` + `content` tests
- `pnpm build`: build all packages
- `pnpm check`: TypeScript checks
- `pnpm precheck`: run local quality gates before commit
- `pnpm ci:check`: run CI-equivalent quality gates
- `pnpm check:source-hygiene`: block build artifacts under `src/**`
- `pnpm check:content-i18n`: verify content locale consistency (`en-US` / `zh-CN`)
- `pnpm assets:compile`: compile image generation jobs from asset plan
- `pnpm assets:generate`: generate game art via imagegen and copy to client public assets
- `pnpm assets:validate`: validate generated asset manifest

See `docs/mvp-spec.md` and `docs/art-style-bible.md` for product and art pipeline details.
See `docs/engineering/quality-gates.md` for R4 governance baseline.

## Localization

- Supported locales: `en-US`, `zh-CN`
- First launch requires a language choice in Meta Menu gate
- Locale preference is persisted in meta progression data (schema v6) and mirrored to local storage during transition
- i18n checks:
  - `pnpm --filter @blodex/game-client i18n:check`
  - `pnpm check:content-i18n`

## Imagegen pipeline

`pnpm assets:generate` expects `OPENAI_API_KEY` in your environment and uses:

- `assets/source-prompts/asset-plan.yaml` as source of truth
- `tmp/imagegen/jobs.jsonl` as compiled batch jobs
- `assets/generated/manifest.json` as registry and revision tracking
- `apps/game-client/public/generated/*` as runtime asset output
