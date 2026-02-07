---
description: Run local CI-equivalent checks, push, create PR, and watch CI.
---


## Goal

  You are helping automate the publishing workflow for this repo.
  When the user says something like 'publish' or 'run the publish flow',
  you should:


## Execution Steps
### 1. Stage any uncommitted changes
### 2. Run the './scripts/safe-commit.sh' to ensure the commit message follows guidelines and includes necessary information.
### 3. Create a commit with message according to the guidelines in /.specify/memory/constitution.md.
### 4. Push the commit to the default branch (e.g., main).
### 5. Explain that you will run the local CI-equivalent checks (pnpm prepublish:ci).
### 6. Open the VS Code terminal.
### 7. Run './scripts/publish.sh'.
### 8. If checks fail locally, read the error output and propose fixes to the code and/or configuration.
