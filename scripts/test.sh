data() {
  if [ $(($# % 2)) -ne 0 ]; then
    echo "Error: Odd number of arguments supplied. Arguments must be in pairs." >&2
    exit 1
  fi

  newCommand=""
  while [ $# -gt 0 ]; do
    arg1="$1"
    arg2="$2"
    newCommand+="--arg '$arg1' '$arg2' "
    shift 2
  done

  echo $(jq -n ${newCommand} '$ARGS.named')
}

send() {
  source .env

  if [ $(($# % 2)) -ne 0 ]; then
    echo "Error: Odd number of arguments supplied. Arguments must be in pairs." >&2
    exit 1
  fi

  newCommand=""
  while [ $# -gt 0 ]; do
    arg1="$1"
    arg2="$2"
    newCommand+="--arg $arg1 $arg2 "
    shift 2
  done

  echo $(jq -n ${newCommand} '$ARGS.named') | websocat "$WS_ADDRESS"
}

merged() {
  source .env
  data="${@:2}"
  data=$(echo $data | tr "'" '"')
  # echo $data
  json=$(echo "$data" | jq --arg "event" "$1" '. * $ARGS.named')
  echo "${json//$'\n'/}" | websocat "$WS_ADDRESS"
}

message() {
  source .env
  data="${@:2}"
  data=$(echo $data | tr "'" '"')
  # echo $data
  json=$(jq -n --arg "event" "$1" --argjson "data" "$data" '$ARGS.named')
  # echo "${json//$'\n'  /}"
  echo "${json//$'\n'/}" | websocat "$WS_ADDRESS"
}

# While not the most intuitive way to test things this is a helpful little
# script for formatting simple arguments into a message to send via websocat.
#
# The easiest way to do it is
# `./scripts.test.sh send key1 value1 key2 value2 key3 value3`
#
# This would create something like
# { "key1": "value1", "key2": "value2", "key3": "value3" }
#
# If you for some reason wanted a JSON object with an "event" key and a
# separate data object you could do it like so.
#
# `./scripts.test.sh data key1 value1 key2 value2 | xargs -0 message myeventnamehere`
#
# This would create something like
# { "event": "myeventnamehere", "data": { "key1": "value1", "key2": "value2" } }

FUNCTION_TO_RUN=$1

shift

eval "$FUNCTION_TO_RUN $@"
