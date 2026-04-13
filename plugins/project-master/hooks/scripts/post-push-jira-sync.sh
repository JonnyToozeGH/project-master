#!/bin/bash
# PostToolUse hook for Bash commands: auto-sync Jira after git push
#
# Triggered by ProjectMaster's hooks.json on every Bash tool use.
# Only acts when the command was a git push. Exits silently otherwise.

TOOL_INPUT="$1"

# Only trigger on git push commands
if ! echo "$TOOL_INPUT" | grep -qE 'git push'; then
  exit 0
fi

# Only trigger if we're in a ProjectMaster-managed project (has specs/ dir)
if [ ! -d "specs" ]; then
  exit 0
fi

# Check if sync script exists
SYNC_SCRIPT=""
if [ -f "scripts/sync-jira.mjs" ]; then
  SYNC_SCRIPT="scripts/sync-jira.mjs"
elif [ -n "$CLAUDE_PLUGIN_ROOT" ] && [ -f "$CLAUDE_PLUGIN_ROOT/scripts/sync-jira.mjs" ]; then
  SYNC_SCRIPT="$CLAUDE_PLUGIN_ROOT/scripts/sync-jira.mjs"
fi

if [ -z "$SYNC_SCRIPT" ]; then
  exit 0
fi

# Check Jira credentials are available
if [ -z "$JIRA_HOST" ] || [ -z "$JIRA_API_TOKEN" ]; then
  # Try to read from .mcp.json
  if [ -f ".mcp.json" ] || [ -f "../.mcp.json" ]; then
    echo "[ProjectMaster] Jira sync skipped - credentials not in environment. Run /pm-sync-jira manually."
  fi
  exit 0
fi

echo "[ProjectMaster] Push detected - syncing spec changes to Jira (dry run)..."
node "$SYNC_SCRIPT" 2>&1 | tail -5

echo "[ProjectMaster] Dry run complete. Run /pm-sync-jira to apply."
