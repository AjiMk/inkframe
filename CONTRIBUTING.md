# Contributing to Inkframe

Thank you for taking the time to contribute to Inkframe! As an open hobby project, community contributions help drive new panel layouts, visual ink filters, AI Model Context Protocol (MCP) tooling, and multi-format export capabilities.

This document outlines the branching model, commit standards, pull request workflow, and local verification steps for contributing to **Inkframe**.

---

## Branch Architecture

Inkframe follows a **Trunk-Based / GitHub-Flow Hybrid Model** designed for continuous delivery, clean linear git history, and rapid feature development.

```
       feat/mcp-sync     fix/filter-overlay
             \                /
              v              v
main (prod) -----------------------*-------------> (v1.2.0 Release Tag)
```

### Main Branch

| Branch | Protection | Purpose |
| :--- | :--- | :--- |
| `main` | Protected | Production-ready codebase. Must always be stable, tested, and deployable. |

### Supporting Branches

All supporting branches are short-lived (1–3 days max) and created off `main`:

| Prefix | Purpose | Example |
| :--- | :--- | :--- |
| `feat/` | New features, tools, or major UI enhancements | `feat/manga-screentone-filter` |
| `fix/` | Bug fixes and patch resolutions | `fix/store-localstorage-sync` |
| `refactor/` | Internal code refactoring with no behavior change | `refactor/canvas-render-loop` |
| `docs/` | Documentation updates and guides | `docs/mcp-setup-guide` |
| `release/` | Version preparation and final QA verification | `release/v1.2.0` |
| `hotfix/` | Critical production fixes branched from `main` | `hotfix/editor-crash` |

---

## Commit Conventions (Conventional Commits)

All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>
```

### Types

- **`feat`**: A new feature (e.g., `feat(filters): add 5 authentic comic book filters`)
- **`fix`**: A bug fix (e.g., `fix(store): preserve localstorage comics during MCP sync`)
- **`docs`**: Documentation changes (e.g., `docs(mcp): update connection guide`)
- **`style`**: Formatting, white-space, or minor visual CSS adjustments with no logic change
- **`refactor`**: Code reorganization that neither fixes a bug nor adds a feature
- **`perf`**: Performance optimizations
- **`test`**: Adding missing tests or updating existing test suites
- **`chore`**: Maintenance, dependency updates, or build tooling changes

---

## Development & PR Lifecycle

### Step 1: Create a Short-Lived Feature Branch

Update your local `main` branch and create a short-lived feature branch:

```bash
git checkout main
git pull origin main
git checkout -b feat/manga-filters
```

### Step 2: Develop & Verify Locally

Before committing changes, run the local verification checks to ensure typescript types, code styling, and unit tests pass:

```bash
# Typecheck TypeScript definitions
npm run typecheck

# Run unit tests
npm run test

# Run ESLint check
npm run lint

# Format codebase
npm run format
```

### Step 3: Commit Your Changes

Commit your changes adhering to Conventional Commit standards:

```bash
git add .
git commit -m "feat(filters): add manga-screentone and 3d-anaglyph panel filters"
```

### Step 4: Push Branch & Open a Pull Request

Push your feature branch to GitHub and create a Pull Request targeting `main`:

```bash
git push -u origin feat/manga-filters
```

When opening the PR:
- Provide a clear description of the changes and the rationale behind them.
- Ensure all CI status checks (typecheck, linting, tests) pass.

### Step 5: Merge & Branch Cleanup

- Use **Squash and Merge** (or **Rebase and Merge**) to maintain a clean linear commit history on `main`.
- Delete the feature branch locally and remotely after merging:

```bash
git checkout main
git pull origin main
git branch -d feat/manga-filters
```

---

## GitHub Branch Protection Rules for `main`

To maintain stability, the following protection rules are recommended for `main`:

1. **Require a Pull Request before merging** (1 approval required).
2. **Require status checks to pass before merging** (Require `npm run typecheck` and test suites).
3. **Require linear history** (Enforce Squash and Merge or Rebase and Merge; prevent merge commits).
4. **Do not allow bypassing branch rules**.
