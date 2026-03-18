# AGENTS.md — Agent 002: File Guardian

## Files That Must Never Be Committed
- Any file matching *_PROJECT_CONTEXT.md
- .env / .env.local
- Any file containing API keys, secrets, or credentials
- Build logs, operating contracts, process-template files

## Git Rules (Non-Negotiable)
- NEVER use `git add .`, `git add -A`, or `git add -f`
- Always stage files explicitly by name
- Before any `git add`, confirm the file is NOT in .gitignore
- If unsure whether a file should be committed, ASK first

## Working Agreement
- Read the project context file before making any changes
- Make small, focused diffs — one concern per change
- Run ALL tests after every change
- Commit with a clear message and push immediately
- If tests fail, fix them before doing anything else
- Never modify files outside the scope of the current task
- If something seems wrong, ask before proceeding

## Communication Rules
- Explain what you changed and why, in plain language
- If you encounter something unexpected, say so immediately
- Don't silently skip steps or make assumptions

## What NOT To Do
- Don't refactor code unrelated to the current task
- Don't add features that weren't asked for
- Don't change architecture without explicit approval
- Don't delete tests
- Don't commit broken code
