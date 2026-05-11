#!/bin/bash

# Exit on error
set -e

BUMP_TYPE=${1:-patch}
PUSH_FLAG=$2

# 1. Read current version from root package.json
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found in current directory."
    exit 1
fi

VERSION=$(cat package.json | grep '"version":' | head -1 | awk -F: '{ print $2 }' | sed 's/[", ]//g')

if [ -z "$VERSION" ]; then
    echo "❌ Error: Could not find version in package.json"
    exit 1
fi

# 2. Parse version parts
IFS='.' read -r -a parts <<< "$VERSION"
MAJOR=${parts[0]}
MINOR=${parts[1]}
PATCH=${parts[2]}

# 3. Calculate new version
if [ "$BUMP_TYPE" == "major" ]; then
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
elif [ "$BUMP_TYPE" == "minor" ]; then
    MINOR=$((MINOR + 1))
    PATCH=0
else
    PATCH=$((PATCH + 1))
fi

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "🚀 Bumping version: $VERSION -> $NEW_VERSION ($BUMP_TYPE)"

# 4. Update all package.json files in the workspace
# We use sed for maximum compatibility (works on Linux/Mac/Git Bash)
# This matches "version": "x.y.z" and replaces it with the new version
find . -name "package.json" -not -path "*/node_modules/*" | while read -r file; do
    # Only update if the file actually has a version field
    if grep -q "\"version\":" "$file"; then
        # Use a temporary file for sed to avoid issues across different sed versions
        sed "s/\"version\": \"$VERSION\"/\"version\": \"$NEW_VERSION\"/" "$file" > "$file.tmp" && mv "$file.tmp" "$file"
        echo "✅ Updated $file"
    fi
done

# 5. Git operations
if [ -d ".git" ]; then
    git add .
    git commit -m "chore(release): v$NEW_VERSION"
    git tag "v$NEW_VERSION"
    echo "✅ Git commit and tag v$NEW_VERSION created."

    if [ "$PUSH_FLAG" == "--push" ]; then
        echo "📤 Pushing changes to origin..."
        git push origin main --tags
        echo "✅ Changes pushed successfully."
    fi
else
    echo "ℹ️ Not a git repository, skipping git operations."
fi
