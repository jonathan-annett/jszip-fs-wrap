#!/bin/bash
cd "$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
../simple-package-wrap/update.sh
cd "$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"
node . --build
git add index.* js_zipWrap.* package.json *.sh
git commit -m "auto add"
git push
git rev-parse HEAD > ./.git_hash
