# Changesets

This folder is used by [changesets](https://github.com/changesets/changesets) to track upcoming
releases. Changeset files are normally generated automatically from the PR title by the
`generate-changeset` workflow, so you usually don't need to add one yourself.

To add one manually:

```sh
pnpm changeset
```

Merging the "Version Packages" PR publishes a release from that branch:

- `main` publishes the current major and takes the `latest` tag on npm.
- `v7` (and any future `v<major>` maintenance branch) publishes under `latest-v7`, and its GitHub
  release is not marked as "Latest".
