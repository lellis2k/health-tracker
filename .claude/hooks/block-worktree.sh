#!/bin/bash
# Disable automatic worktree creation — work directly on current branch instead
jq -n '{
  "hookSpecificOutput": {
    "hookEventName": "WorktreeCreate",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Worktrees disabled for this project"
  }
}'
