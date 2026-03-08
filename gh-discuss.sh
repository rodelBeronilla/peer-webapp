#!/usr/bin/env bash
# gh-discuss.sh — Safe wrapper for GitHub Discussions API
# Enforces all operations stay within rodelBeronilla/peer-webapp
#
# Usage:
#   ./gh-discuss.sh list                          — list recent discussions
#   ./gh-discuss.sh read <number>                 — read a discussion + comments
#   ./gh-discuss.sh create <category> <title>     — create (reads body from stdin)
#   ./gh-discuss.sh comment <number>              — comment on discussion (reads body from stdin)
#
# Categories: general, ideas, announcements, show-and-tell

set -euo pipefail

REPO_OWNER="rodelBeronilla"
REPO_NAME="peer-webapp"
REPO_ID="R_kgDORgsDyA"

# Agent identity — set via AGENT_NAME env var (e.g., "Alpha" or "Beta")
# When set, all posts are prefixed with **[AgentName]** for traceability
AGENT_NAME="${AGENT_NAME:-}"

prefix_body() {
  local body="$1"
  if [ -n "$AGENT_NAME" ]; then
    echo "**[${AGENT_NAME}]** ${body}"
  else
    echo "$body"
  fi
}

declare -A CATEGORIES=(
  ["general"]="DIC_kwDORgsDyM4C34I_"
  ["ideas"]="DIC_kwDORgsDyM4C34JB"
  ["announcements"]="DIC_kwDORgsDyM4C34I-"
  ["show-and-tell"]="DIC_kwDORgsDyM4C34JC"
)

case "${1:-}" in
  list)
    gh api graphql -f query="
      { repository(owner:\"$REPO_OWNER\", name:\"$REPO_NAME\") {
        discussions(first:10, orderBy:{field:UPDATED_AT, direction:DESC}) {
          nodes { number title category{name} author{login} updatedAt
            comments(last:3) { nodes { author{login} body createdAt } }
          }
        }
      }}"
    ;;

  read)
    NUMBER="${2:?Usage: gh-discuss.sh read <number>}"
    gh api graphql -f query="
      { repository(owner:\"$REPO_OWNER\", name:\"$REPO_NAME\") {
        discussion(number:$NUMBER) {
          id number title body author{login} createdAt category{name}
          comments(first:50) {
            nodes { id author{login} body createdAt }
          }
        }
      }}"
    ;;

  create)
    CATEGORY="${2:?Usage: gh-discuss.sh create <category> <title>}"
    TITLE="${3:?Usage: gh-discuss.sh create <category> <title>}"
    CATEGORY_ID="${CATEGORIES[$CATEGORY]:-}"
    if [ -z "$CATEGORY_ID" ]; then
      echo "ERROR: Unknown category '$CATEGORY'. Use: general, ideas, announcements, show-and-tell" >&2
      exit 1
    fi
    BODY="$(prefix_body "$(cat)")"
    # Escape for JSON
    BODY_ESCAPED="$(echo "$BODY" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])' 2>/dev/null || echo "$BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(d).slice(1,-1)))" 2>/dev/null || echo "$BODY" | sed 's/\\/\\\\/g; s/"/\\"/g')"
    TITLE_ESCAPED="$(echo "$TITLE" | sed 's/"/\\"/g')"
    RESULT="$(gh api graphql -f query="
      mutation { createDiscussion(input: {
        repositoryId: \"$REPO_ID\",
        categoryId: \"$CATEGORY_ID\",
        title: \"$TITLE_ESCAPED\",
        body: \"$BODY_ESCAPED\"
      }) { discussion { number url } } }" 2>&1)" || { echo "ERROR: gh api graphql exited non-zero: $RESULT" >&2; exit 1; }
    if echo "$RESULT" | python3 -c 'import json,sys; d=json.load(sys.stdin); errs=d.get("errors"); print("\n".join(e.get("message","(unknown)") for e in errs) if errs else "", end="")' 2>/dev/null | grep -q .; then
      echo "ERROR: GitHub API returned errors:" >&2
      echo "$RESULT" | python3 -c 'import json,sys; d=json.load(sys.stdin); [print(e.get("message","(unknown)"),file=__import__("sys").stderr) for e in d.get("errors",[])]' 2>&1 >&2 || true
      exit 1
    fi
    echo "$RESULT"
    ;;

  comment)
    NUMBER="${2:?Usage: gh-discuss.sh comment <number>}"
    BODY="$(prefix_body "$(cat)")"
    # First verify this discussion belongs to our repo and get its node ID
    DISC_ID="$(gh api graphql -f query="
      { repository(owner:\"$REPO_OWNER\", name:\"$REPO_NAME\") {
        discussion(number:$NUMBER) { id }
      }}" --jq '.data.repository.discussion.id')"
    if [ -z "$DISC_ID" ] || [ "$DISC_ID" = "null" ]; then
      echo "ERROR: Discussion #$NUMBER not found in $REPO_OWNER/$REPO_NAME" >&2
      exit 1
    fi
    BODY_ESCAPED="$(echo "$BODY" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])' 2>/dev/null || echo "$BODY" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(d).slice(1,-1)))" 2>/dev/null || echo "$BODY" | sed 's/\\/\\\\/g; s/"/\\"/g')"
    RESULT="$(gh api graphql -f query="
      mutation { addDiscussionComment(input: {
        discussionId: \"$DISC_ID\",
        body: \"$BODY_ESCAPED\"
      }) { comment { id } } }" 2>&1)" || { echo "ERROR: gh api graphql exited non-zero: $RESULT" >&2; exit 1; }
    if echo "$RESULT" | python3 -c 'import json,sys; d=json.load(sys.stdin); errs=d.get("errors"); print("\n".join(e.get("message","(unknown)") for e in errs) if errs else "", end="")' 2>/dev/null | grep -q .; then
      echo "ERROR: GitHub API returned errors:" >&2
      echo "$RESULT" | python3 -c 'import json,sys; d=json.load(sys.stdin); [print(e.get("message","(unknown)"),file=__import__("sys").stderr) for e in d.get("errors",[])]' 2>&1 >&2 || true
      exit 1
    fi
    echo "$RESULT"
    ;;

  *)
    echo "Usage: gh-discuss.sh {list|read|create|comment} [args]" >&2
    echo "" >&2
    echo "Commands:" >&2
    echo "  list                        List recent discussions" >&2
    echo "  read <number>               Read discussion + comments" >&2
    echo "  create <category> <title>   Create discussion (body from stdin)" >&2
    echo "  comment <number>            Comment on discussion (body from stdin)" >&2
    echo "" >&2
    echo "Categories: general, ideas, announcements, show-and-tell" >&2
    exit 1
    ;;
esac
