### Setup

To setup thebit you'll need to run `npm install` in the directory you clone the repo to. Afterwards you'll need to create a copy of the config files. Based on what controllers you use this may include a `.env` with environment variables with details for ATEM or OBS connections as seen below.
```shell
ATEM_IP_ADDRESS=192.168.0.XXX
OBS_WS_ADDRESS=192.168.0.XXX
OBS_WS_PASSWORD=<passwordGeneratedByOBS>
```

You can copy the `.env.example` file to `.env` and fill in your details to get started.
```shell
cp ./.env.example ./.env
```

Afterwards you'll need to do something similar for the `config.json` and `listeners.yaml` files.

### Listeners
Listeners are defined in the `listeners.yaml` file. Inside you can define a Socket.IO connection (WebSockets are a WIP). Additionally you define an array of rules for the listener to apply to it's defined controller. Rules contain a `function` key that should be a javascript script that returns an action in the shape expected by whichever controller you are using.

For example, for an OBS Controller, if you were listening for the message `donation:show` from a Socket.IO server this would run the `shrink` action on scene `player1` with a magnitude of `0.5`. 
```yaml
rules:
    - on: "donation:show"
      uid: "donationId"
      function: |
        (() => {
            return {action: "shrink", sceneName: "player1", magnitude: 0.5}
        })()
```

To address instances where you could potentially recieve duplicates of a message, listeners implement a history of 100 unique id's. Unique ID's must be provided by the server we are listening to and you can identify what value in the event can be used as such. This is an extremely basic way of doing this and so does not currently support the ability to use compound keys.

### Development

When developing you can use `npm run dev` to run with nodemon to automatically
reload as you make changes to the files.

### Production

To run this in a production capacity you'll need to run it with `npm run start`.
