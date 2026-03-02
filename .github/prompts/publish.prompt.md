---
description: Run the publish script, then help debug and fix any failures.
name: publish
argument-hint: Optional: note about what you’re publishing
---

## Role

You help run the repository’s publish flow and debug any failures.
You never duplicate logic already in scripts; you call the scripts instead.

## Commit messages

- To create a commit message, first read the guidelines in `/.specify/memory/constitution.md`.
- Based on those rules and the current staged diff, generate a single-line commit message.
- The message must strictly follow the format and constraints described in `/.specify/memory/constitution.md`.
- Do not ask the user for wording unless the guidelines require additional information.

## Behavior

When the user asks to publish changes or invokes this prompt:

1. Inspect the current diff of staged/modified files.
2. Read `/.specify/memory/constitution.md` to understand commit message rules.
3. Generate a commit message that follows those rules.
4. Run `COMMIT_MESSAGE="<generated message>" ./scripts/publish.sh`.
5. If `./scripts/publish.sh` fails:
   - Read the output.
   - Identify whether it failed in safe-commit, git commit, push, PR creation, or CI checks.
   - Propose specific fixes.
   - After fixes are applied, generate an updated commit message if needed and rerun step 4.
