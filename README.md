### Setup

To setup thebit you'll need to run `npm install` in the directory you clone the repo to. Afterwards you'll need to create a copy of the config files. Based on what controllers you use this may include a `.env` with environment variables with details for ATEM or OBS connections as seen below.
```shell
ATEM_IP_ADDRESS=192.168.0.XXXj
OBS_WS_ADDRESS=192.168.0.XXX
OBS_WS_PASSWORD=<passwordGeneratedByOBS>
```

You can copy the `.env.example` file to `.env` and fill in your details to get started.
```shell
cp ./.env.example ./.env
```

Afterwards you'll need to do update `thebit.config.js` with your settings.

### Listeners
Listeners are defined in the `config.js` file under the `listeners` key. Inside you can define a listener type (currently Socket.IO or a WebSocket). Additionally you define an array of rules for the listener to apply to it's defined controller. Rules contain a `function` key that should be a javascript function that returns a JS object that implements the`ListenerAction` interface.

For example, for an OBS Controller, if you were listening for the message `donation:show` from a Socket.IO server this would run the `shrink` action on scene `player1` with a magnitude of `0.5`.
```js
rules: [
    {
        on: "donation:show",
        function: (args) => {
            return {action: "shrink", path: "player1", magnitude: 0.5}
        }
    }
]
```

To address instances where you could potentially recieve duplicates of a message, listeners implement a history of 100 unique id's. Unique ID's must be provided by the server we are listening to and you can identify what value in the event can be used as such by returning a "uid" key in your script as part of the returned `ListenerAction`.

For example
```js
rules: [
    {
        on: "donation:show",
        function: (event) => {
            return {
                action: "shrink",
                path: "player1",
                magnitude: 0.4,
                uid: event.unique_id_from_sender
            }
        }
    }
]
```

### Twitch EventSub authorization

A `twitch-eventsub` listener's options need a `clientId`, `accessToken`, and `broadcasterUserId` at minimum. Most useful subscription types (`channel.cheer`, `channel.subscribe`, etc.) require that the target channel's broadcaster (or, for a handful of scopes Twitch explicitly designates as moderator-delegable, a moderator) has authorized your Twitch application with the specific scope that event type needs - check the "Authorization" column on [Twitch's EventSub subscription types reference](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/).

To get that authorization without asking someone to install the Twitch CLI, `thebit` can run the OAuth flow itself:

1. Make sure the listener's row already exists (via the Listeners UI or the API) with `clientId` and `clientSecret` set in its options - these come from your app's registration at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps).
2. Add `TWITCH_OAUTH_REDIRECT_URI` to your `.env` (see `.env.example` - and its note about pointing this at the Vite dev server instead when running `npm run dev`) and register the exact same URL as a Redirect URL on that Twitch application. If the person authorizing isn't on this machine, this server needs to be reachable from their network (e.g. via a tunnel) for that URL to actually work.
3. Send them to:
   ```
   http://<host>:3131/oauth/twitch/authorize?listenerId=<id>&scope=<space-separated scopes>
   ```
   e.g. `?listenerId=2&scope=bits:read` for `channel.cheer`. (The Listeners UI has an "Authorize with Twitch" button on a `twitch-eventsub` listener's page that builds this link for you.)
4. They log into Twitch and click Allow. Twitch redirects back to `/oauth/twitch/callback`, which exchanges the code for an access token + refresh token, saves both (encrypted) for that listener, reloads the listener live (no restart needed), and redirects back to that listener's page in the app.

The listener automatically refreshes its access token in the background once it has both a refresh token and a known expiry (both set by the callback above), so this is normally a one-time step per scope. If a listener's `accessToken` was set some other way (e.g. a manually-pasted app access token with no refresh token), it's treated as long-lived and nothing is scheduled.

**Chat-based events instead of dedicated subscription types.** `channel.chat.message` and `channel.chat.notification` need `user:read:chat` (and likely `user:bot`) scope authorized by whoever's identity is doing the reading, rather than needing the broadcaster specifically - if that identity is a moderator (or the broadcaster) of the target channel, you can self-authorize this against your own account with no involvement from the channel owner at all. Set `chatUserId` in the listener's options to that identity's user id - it gets merged into every rule's condition as `user_id`, alongside `broadcaster_user_id`. `channel.chat.notification` covers subs/resubs/gift subs/raids with a structured `notice_type` payload (a real alternative to `channel.subscribe`), and `channel.chat.message`'s `message.fragments` array marks cheermote tokens with their bit values, which a rule can sum to detect cheers - at the cost of receiving every chat message rather than a pre-filtered cheer-only stream.

### Overture listener

An `overture` listener receives a campaign's events from Overture (the same Laravel Reverb feed the op-connector NodeCG bundle relays). It needs the Reverb host, port and app key, the campaign ID, and your Overture API token, which authorizes listening to the campaign's private channel.

A rule's message is the event's short name - the last part of the PHP class name it's broadcast as, so `App\Broadcasting\Events\DonationReceived` is matched by a rule for `DonationReceived`. The rule's script receives the event's data as `$0`:

```js
const event = $0;
return { uid: event.id, controller: "MainTech", action: "shrink", path: "TransformGame1", magnitude: 0.1 };
```

Only the campaign's own channel (`campaign.<campaignId>`) is listened to.

### Secrets, admin login and invite links

Values a controller or listener kind marks as secret (the OBS WebSocket password, a Twitch listener's client secret and access/refresh tokens, a Socket.IO listener's auth token) are stored encrypted in the `secrets` table rather than in the row's options, and are never sent back to a browser. A Socket.IO listener's token is its own `token` setting, sent to the server as `auth.token`. The encryption key comes from `THEBIT_SECRET_KEY`, or is generated into `thebit.key` next to the database on first run. Back the key up - without it the stored secrets can't be decrypted.

Set `THEBIT_ADMIN_PASSWORD` in your `.env` to require a login for the app and everything under `/api`. Without it the app is open to anyone who can reach its port, so set it before making the server reachable from outside your own network.

To let someone else connect their own OBS, open that controller's settings and create an invite link. Whoever has the link gets a page where they can enter their OBS WebSocket URL and password for that one controller, and nothing else. The link is shown once, lasts 7 days, and can be replaced or revoked from the same page. Their OBS has to be reachable from this server - if it's behind a home router, a tunnel such as `cloudflared tunnel --url http://localhost:4455` gives them a `wss://` address to enter. If this server is reached through a different address than the one you browse it at, set `PUBLIC_URL` so the link is built with the right one.

### Tunnels for invited controllers

Instead of asking an invited person to set up their own tunnel, you can run a [sish](https://github.com/antoniomika/sish) server and have thebit hand out a ready-made command. `deploy/docker-compose.yml` runs both thebit (built from the `Dockerfile` here) and sish behind an existing Traefik instance, which handles TLS - its comments cover the DNS records, certificate resolver and port it needs. Run it from the `deploy` directory with `docker compose up -d --build` after copying `.env.example` to `.env`.

With `TUNNEL_DOMAIN` set in thebit's `.env`, a controller's invite page shows an `ssh` command to run on the computer with OBS, a button to copy the password it asks for, and fills in the address the tunnel publishes OBS at (`wss://obs-<id>.<TUNNEL_DOMAIN>`, fixed per controller). Nothing needs installing - Windows, macOS and Linux all ship an ssh client - and the tunnel lasts for as long as the command is left running.

The tunnel password is the invite link's own token, checked by thebit each time someone logs in to the tunnel server, so replacing or revoking the link also cuts off the tunnel login.

### Development

When developing you can use `npm run dev` to run with nodemon to automatically
reload as you make changes to the files.

For testing WSListeners you can use `node scripts/wsserver.js`, just ensure your `.env` has a `WS_ADDRESS` set in it like so
```shell
WS_ADDRESS=ws://localhost:8080
```

You can then send test messages via like so
```
./scripts/test.sh send amount 10.00 donationid abc123 event donation:show
```

The `test.sh` script has a few odd commands in it but the most important is `send` which lets you send a simple JSON formatted message over the server created via `wsserver.js`. This requires having `websocat` and `js` available on your machine.


### Production

To run this in a production capacity you'll need to run it with `npm run start`.
