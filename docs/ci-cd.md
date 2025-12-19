# CI/CD Overview

The repository has extensive GitHub Actions workflows:

| Workflow                  | Trigger            | Purpose                        |
| ------------------------- | ------------------ | ------------------------------ |
| `1_check_for_updates.yml` | Every 5 min (cron) | Checks for new Prisma releases |
| `2_bump_versions.yml`     | Triggered by #1    | Bumps Prisma dependencies      |
| `3_LS_tests_publish.yml`  | On version bump    | Tests and publishes LS to npm  |
| `4_e2e_tests.yml`         | Before releases    | Runs E2E tests                 |
| `5_build.yml`             | After E2E pass     | Builds extension               |
| `6_publish.yml`           | After build        | Publishes VS Code extension    |
| `PR_build_extension.yml`  | On PRs             | Builds `.vsix` for testing     |

```mermaid
graph TD
    A(Cron every 5 minutes) --> B[1. Check for Prisma CLI Update]
    B -->|update available?| C[2. Bump versions]
    C -->D{Which NPM channel was updated?}
    D -->|dev or patch-dev| E((Our release_channel is insider))
    D -->|latest| F((Our release_channel is stable))
    E --> G[3. Test Language Server and publish]
    F --> G
    G -->|tests and publish successful?| I[4. E2E tests VS Code Extension]
    I -->|tests pass?| J[5. Build extension]
    J --> K[6. Publish]

    L(Commit in the extension) --> M[1/2. Bump versions for extension only]
    M -->E
    N(Manual workflow dispatch) --> O[1/2. Bump and release a stable version of the extension]
    O -->F
```

## Testing PR Builds

When you open a PR, the `PR_build_extension.yml` workflow automatically builds a
`.vsix` file. To download and install it:

1. Go to the **Actions** tab in the GitHub repository
2. Find the workflow run for your PR (named "PR Build Extension" or similar)
3. Scroll to the **Artifacts** section at the bottom of the run summary
4. Download the `.vsix` artifact

Alternatively, download directly via command line:

```bash
wget --content-disposition \
  "https://github.com/prisma/language-tools/blob/artifacts/pull-request-artifacts/pr<PR_NUMBER>-prisma.vsix?raw=true"
```

Then install it with:

```bash
code --install-extension pr<PR_NUMBER>-prisma.vsix
```
