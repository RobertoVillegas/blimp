#!/bin/bash
# Installs a small background updater (a launchd agent) that keeps a folder-loaded Helium Max
# current: every 4 hours and at login it checks GitHub for a new release, verifies the zip's
# SHA-256, and replaces the folder's files. Helium Max notices the new build and reloads itself.
#
#   install-updater.sh "/path/to/the folder you loaded in Helium"
#   install-updater.sh --uninstall
set -euo pipefail

LABEL=com.robertovillegas.helium-max-updater
APP_DIR="$HOME/Library/Application Support/Helium Max Updater"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/helium-max-updater.log"
DOMAIN="gui/$(id -u)"

if [ "${1:-}" = "--uninstall" ]; then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  rm -rf "$APP_DIR"
  echo "Removed the Helium Max updater. Your extension folder was left as it is."
  exit 0
fi

if [ -z "${1:-}" ] || [ ! -d "$1" ]; then
  echo "Usage: install-updater.sh \"/path/to/the folder you loaded in Helium\"" >&2
  echo "Tip: type the command, then drag the folder from Finder into Terminal to paste its path." >&2
  exit 1
fi
FOLDER=$(cd "$1" && pwd)
if [ "$(/usr/bin/plutil -extract name raw -o - "$FOLDER/manifest.json" 2>/dev/null)" != "Helium Max" ]; then
  echo "$FOLDER doesn't look like Helium Max (its manifest.json isn't named \"Helium Max\"). Nothing was installed." >&2
  exit 1
fi

mkdir -p "$APP_DIR" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

cat > "$APP_DIR/update.sh" <<'UPDATER'
#!/bin/bash
# Keeps a folder-loaded Helium Max up to date from GitHub releases. Installed by install-updater.sh.
set -euo pipefail
REPO="RobertoVillegas/helium-max"
FOLDER="${1:?usage: update.sh <extension folder>}"
LOCK="${TMPDIR:-/tmp}/helium-max-updater.lock"
work=""

log() { printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
field() { /usr/bin/plutil -extract "$2" raw -o - "$1" 2>/dev/null || true; }

# True when version $1 is newer than $2 (numeric, dot-separated).
newer() {
  local IFS=.
  local -a a=($1) b=($2)
  local i
  for ((i = 0; i < ${#a[@]} || i < ${#b[@]}; i++)); do
    if ((10#${a[i]:-0} > 10#${b[i]:-0})); then return 0; fi
    if ((10#${a[i]:-0} < 10#${b[i]:-0})); then return 1; fi
  done
  return 1
}

if [ "$(field "$FOLDER/manifest.json" name)" != "Helium Max" ]; then
  log "skipped: $FOLDER no longer contains Helium Max"
  exit 1
fi
mkdir "$LOCK" 2>/dev/null || { log "skipped: another update is running"; exit 0; }
trap 'rm -rf "$LOCK" ${work:+"$work"}' EXIT

current=$(field "$FOLDER/manifest.json" version)
latest_url=$(curl -fsSIL -o /dev/null -w '%{url_effective}' "https://github.com/$REPO/releases/latest")
tag=${latest_url##*/}
latest=${tag#v}
if ! [[ "$latest" =~ ^[0-9]+(\.[0-9]+)*$ ]]; then
  log "error: couldn't read the latest version from $latest_url"
  exit 1
fi
if ! newer "$latest" "$current"; then
  log "up to date ($current)"
  exit 0
fi

work=$(mktemp -d)
base="https://github.com/$REPO/releases/download/$tag"
curl -fsSL "$base/helium-max-chrome.zip" -o "$work/helium-max-chrome.zip"
curl -fsSL "$base/SHA256SUMS" -o "$work/SHA256SUMS"
if ! (cd "$work" && grep ' helium-max-chrome.zip$' SHA256SUMS | shasum -a 256 -c - >/dev/null); then
  log "error: checksum mismatch for $tag; nothing changed"
  exit 1
fi
mkdir "$work/new"
unzip -q "$work/helium-max-chrome.zip" -d "$work/new"
if [ "$(field "$work/new/manifest.json" name)" != "Helium Max" ] || [ "$(field "$work/new/manifest.json" version)" != "$latest" ]; then
  log "error: the $tag download doesn't look like Helium Max $latest; nothing changed"
  exit 1
fi

# Every file except the manifest first, then the manifest: the extension only sees the new
# version once all of its files are in place. -I copies every file: zip entries all share one
# timestamp, so rsync's size-and-date check would keep stale files of the same size.
rsync -aI --delete --exclude manifest.json "$work/new/" "$FOLDER/"
if ! diff -rq -x manifest.json "$work/new" "$FOLDER" >/dev/null; then
  log "error: the folder doesn't match $tag after copying; manifest left at $current so Helium Max won't switch"
  exit 1
fi
cp "$work/new/manifest.json" "$FOLDER/.manifest.json.new"
mv -f "$FOLDER/.manifest.json.new" "$FOLDER/manifest.json"
log "updated $current -> $latest"
UPDATER
chmod +x "$APP_DIR/update.sh"

xml() { printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'; }
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$(xml "$APP_DIR/update.sh")</string>
    <string>$(xml "$FOLDER")</string>
  </array>
  <key>StartInterval</key><integer>14400</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$(xml "$LOG")</string>
  <key>StandardErrorPath</key><string>$(xml "$LOG")</string>
</dict>
</plist>
PLIST
/usr/bin/plutil -lint -s "$PLIST"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootstrap "$DOMAIN" "$PLIST"

echo "Installed. Helium Max in $FOLDER now updates itself:"
echo "  - this Mac checks GitHub every 4 hours and at login (log: $LOG)"
echo "  - Helium Max reloads into the new version within a minute (keep Developer mode on)"
echo "To remove it: curl -fsSL https://raw.githubusercontent.com/RobertoVillegas/helium-max/main/scripts/install-updater.sh | bash -s -- --uninstall"
