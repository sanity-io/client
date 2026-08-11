# Changesets

This folder is used by [changesets](https://github.com/changesets/changesets) to track upcoming
releases. Changeset files are normally generated automatically from the PR title by the
`generate-changeset` workflow, so you usually don't need to add one yourself.

To add one manually:

```sh
pnpm changeset
```

A manual changeset always wins. If the bot had already written its own `pr-<number>.md`, it
removes that file on the next run so the release doesn't get two entries for one PR. Editing the
bot's file directly works too: deleting the `<!-- auto-generated -->` marker on the first line
makes the bot leave it alone from then on.

Merging the "Version Packages" PR publishes a release from that branch:

- `main` publishes the current major and takes the `latest` tag on npm.
- `v7` (and any future `v<major>` maintenance branch) publishes under `latest-v7`, and its GitHub
  release is not marked as "Latest".
