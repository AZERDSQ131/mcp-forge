# Rendered output drift receipts

`mcpm sync` has two jobs:

1. read the canonical project intent from `.mcpmrc`
2. render the correct MCP config shape for each installed client

For teams, diff/rollback should review the rendered outputs, not only the
canonical manifest. Claude Code, Cursor, VS Code, Zed, Windsurf, and other
clients do not all store the same JSON shape. A config can be correct in
`.mcpmrc` and still drift during render.

A useful dry-run receipt should be safe to paste in an issue or PR. It should
include hashes, paths, versions, and warnings, but never secret values.

## Suggested dry-run receipt

```json
{
  "schema": "mcpm.rendered-output-receipt.v1",
  "source": {
    "path": ".mcpmrc",
    "hash": "sha256:source-manifest-hash",
    "servers": [
      {
        "id": "github",
        "version": "2026.07.01",
        "source": "registry:mcp-fleet/github"
      }
    ]
  },
  "targets": [
    {
      "client": "claude-code",
      "path": "~/.claude.json",
      "beforeHash": "sha256:old-rendered-config",
      "afterHash": "sha256:new-rendered-config",
      "status": "changed",
      "serversAdded": ["github"],
      "serversRemoved": [],
      "serversChanged": [],
      "envKeysRequired": ["GITHUB_TOKEN"],
      "envValuesIncluded": false,
      "missingEnv": ["GITHUB_TOKEN"],
      "rollbackId": "mcpm-rollback-2026-07-01T14-02-00Z-claude-code"
    },
    {
      "client": "cursor",
      "path": "~/.cursor/mcp.json",
      "beforeHash": "sha256:old-rendered-config",
      "afterHash": "sha256:new-rendered-config",
      "status": "unchanged",
      "serversAdded": [],
      "serversRemoved": [],
      "serversChanged": [],
      "envKeysRequired": ["GITHUB_TOKEN"],
      "envValuesIncluded": false,
      "missingEnv": [],
      "rollbackId": null
    }
  ],
  "summary": {
    "targetsChecked": 2,
    "targetsChanged": 1,
    "secretsOmitted": true,
    "safeToLog": true
  }
}
```

## Why this helps issue #2

Diff preview and rollback are easier to trust when the dry run answers four
questions before writing files:

- Which canonical `.mcpmrc` was rendered?
- Which client config files would change?
- Which server/env entries changed per client?
- Which rollback snapshot restores each target?

This makes `mcpm sync --dry-run` useful in code review and onboarding: a team
can compare the intended MCP fleet with what each client will actually receive,
without exposing tokens or copying raw config files into tickets.

## Minimal CLI shape

```bash
mcpm sync --dry-run --receipt .mcpm/sync-receipt.json
```

Suggested behavior:

- no config files are modified
- missing env vars are warnings, not prompts
- secret values are never written to the receipt
- each target gets a stable rendered hash
- rollback snapshot ids are listed before write mode runs
