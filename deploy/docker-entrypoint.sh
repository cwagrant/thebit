#!/bin/sh
set -e

# First run on an empty volume: thebit won't start without a config file and
# a .env in its working directory. Settings normally come from the
# container's environment, so the .env can stay empty.
[ -f thebit.config.js ] || cp /app/server/thebit.config.js thebit.config.js
[ -f .env ] || : > .env

exec "$@"
