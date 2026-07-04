---
name: ddb-inspect
description: >-
  Inspect DynamoDB data for this app — scan items by partition key, find
  duplicate records by field, get a specific item, or show pk distribution and
  counts. Use when inspecting DynamoDB, checking item counts, finding duplicates,
  or scanning the main table, instead of reaching for the AWS CLI.
---

# DynamoDB Inspection Script

> **SUNSET AFTER THE V4 PORT.** This skill exists ONLY for the v4
> Dynamo-mapping phase (reading the v1 database to design the new data
> structures). Once the port is done, DELETE this skill from
> `.claude/skills/` (the script itself stays in v1). Do not build anything
> new on it; no legacy leaks into v4.

When inspecting DynamoDB data (find duplicates, scan tables, check item counts),
use the `ddb-inspect` script instead of the AWS CLI.

## Location

`v1/packages/server/src/scripts/packages/ddb-inspect/`

## How to run

From the `v1/packages/server` directory:

```bash
bun run src/scripts/packages/ddb-inspect/index.ts -- [options]
```

## Actions

| Action       | Description                           | Required Args     |
| ------------ | ------------------------------------- | ----------------- |
| `list-pks`   | Show known pk distribution and counts | none              |
| `scan`       | Scan items by pk                      | `--pk`            |
| `duplicates` | Find duplicate records by field       | `--pk`, `--field` |
| `item`       | Get specific item                     | `--pk`, `--sk`    |

## Known PKs

`list-pks` checks these partition keys: `media`, `media-group`, `collection`,
`image`, `play-skip-count`, `thread`, `msg`.

## Environment variables (required)

Create a `.env` file in `v1/packages/server/` (Bun auto-loads it):

```bash
APP_NAME=stockpile-v6    # Required: builds table name as {APP_NAME}-{env}-main
TABLE_NAME=              # Alternative: direct table name, ignores APP_NAME and --env
```

One of `APP_NAME` or `TABLE_NAME` must be set. No fallback defaults.

## CLI options

- `--env` / `-e`: environment (`dev` or `prod`), default `dev`
- `--action` / `-a`: action to perform, default `list-pks`
- `--pk`: partition key filter
- `--sk`: sort key (for `item`)
- `--field`: field to check for duplicates
- `--limit` / `-l`: max items to display, default `100`

## Examples

```bash
# Show pk distribution in prod
bun run src/scripts/packages/ddb-inspect/index.ts -- -e prod -a list-pks

# Scan all media items in dev
bun run src/scripts/packages/ddb-inspect/index.ts -- --pk=media --action=scan

# Find duplicate titles in media items
bun run src/scripts/packages/ddb-inspect/index.ts -- -e prod --action=duplicates --pk=media --field=title

# Find duplicate file hashes in media
bun run src/scripts/packages/ddb-inspect/index.ts -- -e prod --action=duplicates --pk=media --field=fileHash

# Get specific item
bun run src/scripts/packages/ddb-inspect/index.ts -- --action=item --pk=media --sk=abc123
```

## Table naming

Tables follow `{APP_NAME}-{env}-main`. With `APP_NAME=stockpile-v6`:

- Dev: `stockpile-v6-dev-main`
- Prod: `stockpile-v6-prod-main`

Override with `TABLE_NAME` for custom table names.
