#!/bin/bash
set -euxo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR
git clean -dfx && git restore pnpm-test-repo/ && git restore yarn-test-repo/ && git restore npm-test-repo/

cd ../../

pnpm build
npm pack

mv snaplet-seed-*.tgz snaplet-seed.tgz
cp snaplet-seed.tgz $SCRIPT_DIR/npm-test-repo/
cp snaplet-seed.tgz $SCRIPT_DIR/pnpm-test-repo/
cp snaplet-seed.tgz $SCRIPT_DIR/yarn-test-repo/
rm snaplet-seed.tgz

# ======== PNPM
echo "++++++++++++++++++++++ TESTING PNPM ++++++++++++++++++++++"
# Try to run the seed script after install
cd $SCRIPT_DIR/pnpm-test-repo/
pnpm install
npx tsx seed.mts
# Make sure adding a new package does not break the seed script
pnpm add -w lodash
npx tsx seed.mts
git clean -dfx
echo "========================================================="

# ======== YARN
echo "++++++++++++++++++++++ TESTING YARN ++++++++++++++++++++++"
# Try to run the seed script after install
cd $SCRIPT_DIR/yarn-test-repo/
yarn cache clean
yarn install
npx tsx seed.mts
# Make sure adding a new package does not break the seed script
yarn add lodash
npx tsx seed.mts
git clean -dfx
echo "========================================================="


# ======== NPM
echo "++++++++++++++++++++++ TESTING NPM ++++++++++++++++++++++"
# Try to run the seed script after install
cd $SCRIPT_DIR/npm-test-repo/
npm cache clean --force
npm install
npx tsx seed.mts
# Make sure adding a new package does not break the seed script
npm install lodash
npx tsx seed.mts
git clean -dfx
echo "========================================================="