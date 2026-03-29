# Tools

Python scripts for deterministic execution. Each script handles a specific task:
API calls, data transformations, file operations, database queries.

## Conventions
- Scripts accept inputs via CLI args or stdin
- Credentials are loaded from `.env` (never hardcoded)
- Scripts are idempotent where possible
- Each script does one thing well
