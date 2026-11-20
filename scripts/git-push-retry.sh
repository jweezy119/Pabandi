#!/usr/bin/env bash
#
# git-push-retry — push with retries.
#
# WHY THIS EXISTS
# ---------------
# The path to github.com drops the long-lived `git-receive-pack` connection
# intermittently:
#
#     send-pack: unexpected disconnect while reading sideband packet
#     error: failed to push some refs
#
# It is transient and time-clustered, not size- or repo-specific: the same push
# succeeds a few attempts later. Retrying is therefore the fix rather than a
# workaround. Measured on this machine: one bad window went 0/5, the next 10/10.
#
# It is NOT a credentials problem and NOT a bad anycast IP — both were checked.
#
# Usage:
#   scripts/git-push-retry.sh origin main
#   scripts/git-push-retry.sh --force-with-lease origin main
#
# Environment:
#   PUSH_RETRIES   maximum attempts          (default 5)
#   PUSH_BACKOFF   seconds between attempts  (default 5)
#
# A rejection from the server is a real answer and is NOT retried.

set -u

RETRIES="${PUSH_RETRIES:-5}"
BACKOFF="${PUSH_BACKOFF:-5}"

attempt=1
while [ "$attempt" -le "$RETRIES" ]; do
  if output="$(git push "$@" 2>&1)"; then
    printf '%s\n' "$output"
    exit 0
  fi

  printf '%s\n' "$output" >&2

  if printf '%s' "$output" | grep -qE '\[rejected\]|\[remote rejected\]|permission denied|Could not read from remote repository'; then
    echo "git-push-retry: the server refused the push — not a transport failure, so not retrying." >&2
    exit 1
  fi

  if [ "$attempt" -eq "$RETRIES" ]; then
    echo "git-push-retry: still failing after $RETRIES attempts." >&2
    exit 1
  fi

  echo "git-push-retry: attempt $attempt/$RETRIES failed; retrying in ${BACKOFF}s…" >&2
  sleep "$BACKOFF"
  attempt=$((attempt + 1))
done
