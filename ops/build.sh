#!/bin/sh
# Build the deployable bundle: web/ -> dist/, with the version and build
# time stamped into tool.json.
#
# The version comes from the latest git tag, so `git tag -a v0.2.0` is the
# whole release procedure. A dirty tree is marked, because a bundle built
# from uncommitted work is not reproducible and should never reach
# production without that being visible in the tool's footer.
set -eu
cd "$(dirname "$0")/.."

VERSION=$(git describe --tags --dirty --always 2>/dev/null || echo "0.0.0-untracked")
VERSION=${VERSION#v}
BUILT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

rm -rf dist
mkdir -p dist
cp -R web/. dist/

python3 - "$VERSION" "$BUILT" <<'PY'
import json, sys
p = 'dist/tool.json'
m = json.load(open(p))
m['version'], m['built'] = sys.argv[1], sys.argv[2]
json.dump(m, open(p, 'w'), indent=2)
open(p, 'a').write('\n')
PY

echo "built dist/ at version $VERSION ($BUILT)"
echo "  $(find dist -type f | wc -l | tr -d ' ') files, $(du -sh dist | cut -f1)"

# Guard the bundle contract: no absolute references to a site host, which
# is exactly how the old webmapper tool died when the domain moved.
if grep -rIl 'groundtruth[a-z]*\.\(org\|com\)/' dist --include='*.html' --include='*.js' --include='*.css' 2>/dev/null; then
  echo "ERROR: bundle contains absolute site URLs" >&2
  exit 1
fi
