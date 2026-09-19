#!/bin/sh
# Loads the Marvel graph into the cloud instance named in ../marvel-web/.env.local (FALKORDB_URL=...).
# The password stays in that file: it is never printed.
cd "$(dirname "$0")"
URL=$(grep '^FALKORDB_URL=' ../marvel-web/.env.local | head -1 | cut -d= -f2-)
[ -z "$URL" ] && echo "Add FALKORDB_URL=falkor://falkordb:<password>@<host>:<port> to marvel-web/.env.local first" && exit 1
FALKORDB_URL="$URL" "${PYTHON:-python3}" load.py   # needs: pip install -r requirements.txt
