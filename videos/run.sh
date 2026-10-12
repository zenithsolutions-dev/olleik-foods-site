#!/bin/sh
# Runs a node tool with Remotion's temp files on D: (the C: drive is nearly full) and removes them afterwards.
#   ./run.sh storyboard.mjs VISITOR
D=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$D/out/tmp"
W=$(cygpath -w "$D/out/tmp" 2>/dev/null || echo "$D/out/tmp")
TMP="$W" TEMP="$W" TMPDIR="$W" node "$@"
code=$?
rm -rf "$D/out/tmp"
exit $code
