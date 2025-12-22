#!/bin/bash

send() {
  source .env
  echo "{\"move\": \"$1\"}" | websocat "$WS_ADDRESS"
}

shader() {
  source .env
  enabled="${1:-false}"
  name="${2}"
  shader=$(
    jq -n \
      --arg "enabled" "$enabled" \
      --arg "name" "$name" \
      '$ARGS.named'

  )
  json=$(jq -n --argjson "shader" "$shader" '$ARGS.named')
  echo "${json//$'\n'/}" | websocat "$WS_ADDRESS"
}

to_json_example() {
  jq -n \
    --arg "param1" "stuff1" \
    --arg "param2" "stuff2" \
    '$ARGS.named'
}

message() {
  source .env
  json="$(jq -n --arg "event" "$1" --arg "data" "$2" --argjson ${@:3} 'ARGS.named')"
  echo "${json//$'\n'  /}"
  echo "${json//$'\n'/}" | websocat "$WS_ADDRESS"
}

FUNCTION_TO_RUN=$1

shift

eval "$FUNCTION_TO_RUN $@"
