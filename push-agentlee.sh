#!/bin/bash
# 🚀 Automate Git push for Agent Lee Firebase Studio project

REPO_URL="https://github.com/4citeB4U/AgentLee.git"
COMMIT_MESSAGE="🔥 Initial commit of Agent Lee Firebase Studio project"

echo "🔍 Checking for Git..."
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed."
    exit 1
fi

echo "📁 Switching to project directory..."
cd "$(dirname "$0")"

if [ ! -d .git ]; then
    echo "🧱 Initializing Git repo..."
    git init
fi

echo "🔗 Resetting remote origin..."
git remote remove origin 2>/dev/null
git remote add origin "$REPO_URL"

echo "🛡 Creating .gitignore (if missing)..."
if [ ! -f .gitignore ]; then
  cat <<EOL > .gitignore
node_modules/
.env
firebase-debug.log
.next/
dist/
.vscode/
.idea/
.DS_Store
EOL
  echo "✅ .gitignore created."
fi

echo "📦 Staging files..."
git add -A

echo "✅ Committing..."
git commit -m "$COMMIT_MESSAGE" 2>/dev/null || echo "ℹ️ Nothing new to commit."

echo "🌿 Switching to 'main' branch..."
git branch -M main

echo "🚀 Pushing to GitHub..."
git push -u origin main --force

echo "✅ Agent Lee project pushed to $REPO_URL"
