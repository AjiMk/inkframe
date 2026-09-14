# Git Branching & Workflow Strategy for InkFrame

This document outlines the recommended branching strategy, commit conventions, and Pull Request (PR) workflow for the **InkFrame** repository.

---

## 🌿 Branch Architecture

InkFrame uses a **Trunk-Based / GitHub-Flow Hybrid Model** designed for continuous delivery, clean history, and rapid feature development.

```
       feat/mcp-sync     fix/filter-overlay
             \                /
              v              v
main (prod) -----------------------*-------------> (v1.2.0 Release Tag)
```

### Main Branches

| Branch | Protection | Purpose |
|---|---|---|
| `main` | **Protected** | Production-ready code. Always stable and deployable. |

### Supporting Branches

All supporting branches are short-lived (1–3 days max) and created off `main`:

| Prefix | Example | Purpose |
|---|---|---|
| `feat/` | `feat/manga-screentone-filter` | New features, tools, or major UI enhancements. |
| `fix/` | `fix/store-localstorage-sync` | Bug fixes and patch resolutions. |
| `refactor/` | `refactor/canvas-render-loop` | Internal refactoring with no behavior change. |
| `docs/` | `docs/mcp-setup-guide` | Documentation updates and guides. |
| `release/` | `release/v1.2.0` | Release preparation, version bumps, and final QA verification. |
| `hotfix/` | `hotfix/broken-editor-crash` | Urgent production hotfixes branched from `main`. |

---

## 📝 Commit Conventions (Conventional Commits)

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description>
```

### Types

- **`feat`**: A new feature (e.g., `feat(filters): add 5 authentic comic book filters`).
- **`fix`**: A bug fix (e.g., `fix(store): preserve localstorage comics during MCP sync`).
- **`docs`**: Documentation only changes (e.g., `docs(mcp): update connection guide`).
- **`style`**: Changes that do not affect code logic (white-space, formatting, CSS tweaks).
- **`refactor`**: Code change that neither fixes a bug nor adds a feature.
- **`perf`**: A code change that improves performance.
- **`test`**: Adding missing tests or updating existing tests.
- **`chore`**: Updating dependencies, build scripts, or repository tooling.

---

## 🔄 Development & PR Lifecycle

### Step 1: Create a Feature Branch
```bash
# Update main
git checkout main
git pull origin main

# Create short-lived branch
git checkout -b feat/manga-filters
```

### Step 2: Develop & Verify Locally
Run local checks before committing:
```bash
npm run typecheck
npm run test
npm run lint
```

### Step 3: Commit Changes
```bash
git add .
git commit -m "feat(filters): add manga-screentone and 3d-anaglyph panel filters"
```

### Step 4: Push & Open PR
```bash
git push -u origin feat/manga-filters
```
Open a Pull Request into `main` on GitHub:
- Require at least 1 approval.
- Ensure all CI/typecheck status checks pass.

### Step 5: Merge & Clean Up
- Use **Squash and Merge** (or **Rebase and Merge**) to maintain a linear, readable `main` history.
- Delete the feature branch after merging:
```bash
git checkout main
git pull origin main
git branch -d feat/manga-filters
```

---

## 🛡️ Recommended GitHub Branch Protection Rules for `main`

In GitHub Repository Settings -> **Branches** -> Add rule for `main`:

1. ✅ **Require a pull request before merging** (1 approval required).
2. ✅ **Require status checks to pass before merging** (Require `npm run typecheck`).
3. ✅ **Require linear history** (Prevent merge commits; enforce Squash or Rebase).
4. ✅ **Do not allow bypassing the above settings**.
