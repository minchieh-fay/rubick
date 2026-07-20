#!/bin/sh
set -eu

SKILL_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
DEST="$SKILL_ROOT/references"
SOURCE="${1:-/tmp/openai-agents-js-codex-source}"

if [ ! -d "$SOURCE/docs/src/content/docs" ] || [ ! -d "$SOURCE/examples" ]; then
  echo "Source checkout is missing docs or examples: $SOURCE" >&2
  exit 1
fi

rm -rf "$DEST/docs" "$DEST/examples"
mkdir -p "$DEST/docs" "$DEST/examples"

find "$SOURCE/docs/src/content/docs" -type f \( -name '*.md' -o -name '*.mdx' \) ! -path '*/ja/*' ! -path '*/ko/*' ! -path '*/zh/*' | while IFS= read -r file; do
  relative=${file#"$SOURCE/docs/src/content/docs/"}
  case "$relative" in
    *.mdx) clean_relative="${relative%.mdx}.md" ;;
    *) clean_relative="$relative" ;;
  esac
  output="$DEST/docs/$clean_relative"
  mkdir -p "$(dirname "$output")"
  awk 'BEGIN { front=0 } /^---$/ && NR == 1 { front=1; next } front && /^---$/ { front=0; next } front { next } /^import / { next } { print }' "$file" > "$output"
  perl -0pi -e 's#</?(?:Code|Aside|Steps|Tabs|TabItem)\b[^>]*>##gs' "$output"
done

find "$SOURCE/examples" -type f \( -name '*.ts' -o -name '*.tsx' -o -name 'README.md' \) ! -path '*/node_modules/*' | while IFS= read -r file; do
  relative=${file#"$SOURCE/examples/"}
  output="$DEST/examples/$relative"
  mkdir -p "$(dirname "$output")"
  cp "$file" "$output"
done

commit=$(git -C "$SOURCE" rev-parse HEAD)
date=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
cat > "$DEST/SNAPSHOT.md" <<EOF
# OpenAI Agents SDK reference snapshot

- Repository: https://github.com/openai/openai-agents-js
- Documentation: https://openai.github.io/openai-agents-js/
- Commit: $commit
- Refreshed: $date
- Included: English Markdown guides and TypeScript/TSX files under the upstream examples directory.
- Cleaning: removed documentation frontmatter, Astro imports, and display-only component tags; source examples were copied unchanged.

This snapshot is a coding reference. Confirm APIs against the installed package version when it differs from this commit.
EOF

echo "Refreshed SDK snapshot at $DEST"
