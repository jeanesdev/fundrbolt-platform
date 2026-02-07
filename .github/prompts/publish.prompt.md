---
description: Run local CI-equivalent checks, push, create PR, and watch CI.
---


## Goal

  You are helping automate the publishing workflow for this repo.
  When the user says something like 'publish' or 'run the publish flow',
  you should:

    
## Execution Steps
### 1. Stage any uncommitted changes and create a commit message according to the guidelines in /.specify/memory/constitution.md.
### 2. Push the commit to the default branch (e.g., main).
### 3. Explain that you will run the local CI-equivalent checks (pnpm prepublish:ci).
### 4. Open the VS Code terminal.
### 5. Run './scripts/publish.sh'.
### 6. If checks fail locally, read the error output and propose fixes to the code and/or configuration.