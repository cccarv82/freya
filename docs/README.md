# Freya Web Docs

Freya runs as a local-only web app that reads and writes files on disk.

## Run

```bash
npx @cccarv82/freya
```

Or install globally:

```bash
npm i -g @cccarv82/freya
freya
```

## Options

```bash
freya --port 4000
freya --dir ./freya
freya --no-open
freya --dev
```

## Local-only storage

Workspaces are plain folders on your machine (data/, logs/, docs/, scripts/). Freya does not use an external database.
