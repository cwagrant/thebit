// Minimal Twitch EventSub WebSocket mock for chat events the Twitch CLI can't
// trigger: channel.chat.message (including cheers) and channel.chat.notification
// (subs, resubs, gifts, raids, ...). Point a twitch-eventsub listener's
// `address` option at ws://127.0.0.1:8081/ws, then type commands on stdin.
//
// Usage: node scripts/mock-chat.cjs     (PORT=... to change the port)
// Type `help` once running for the command list.
const { WebSocketServer } = require("ws");
const { randomUUID } = require("crypto");
const readline = require("readline");

const PORT = Number(process.env.PORT || 8081);
const BROADCASTER = { id: "12345", login: "testbroadcaster", name: "TestBroadcaster" };
const clients = new Set();
let chatter = { id: "67890", login: "testchatter", name: "TestChatter" };

const HELP = `
Commands (options are key=value, anything after them is the chat message text):

  <text>                                  plain chat message
  msg <text>                              plain chat message
  cheer [bits=100] [prefix=Cheer] <text>  chat message with bits
  as <login>                              change who is chatting (default testchatter)

  channel.chat.notification notice types:
  sub [tier=1000] [prime=false] [months=1] [text]
  resub [months=12] [streak=3] [tier=1000] [prime=false] [gift=false] [gifter=somegifter] [anon=false] [text]
  subgift [recipient=luckyviewer] [tier=1000] [months=1] [total=5] [anon=false]
  community [count=5] [tier=1000] [total=25] [anon=false]
  giftupgrade [gifter=somegifter] [anon=false]
  primeupgrade [tier=1000]
  payitforward [gifter=somegifter] [anon=false]
  raid [viewers=42]
  unraid
  announce [color=PRIMARY] <text>
  bitsbadge [tier=1000]
  charity [amount=5.00] [currency=USD] [charity=Example Charity]

  help
`;

const tierName = (tier) => ({ "1000": "Tier 1", "2000": "Tier 2", "3000": "Tier 3" }[tier] || `Tier ${tier}`);
const bool = (value, fallback = false) => value === undefined ? fallback : value === "true" || value === "1" || value === "yes";
const userFromLogin = (login) => ({ id: String(Math.floor(Math.random() * 90000000) + 10000000), login: login.toLowerCase(), name: login });

// Splits "resub months=12 tier=2000 Love the stream" into
// { command: "resub", opts: { months: "12", tier: "2000" }, text: "Love the stream" }.
// Options must come before the message text.
function parse(line) {
  const tokens = line.trim().split(/\s+/);
  const command = tokens.shift()?.toLowerCase() || "";
  const opts = {};

  while (tokens.length && /^\w+=/.test(tokens[0])) {
    const [key, ...rest] = tokens.shift().split("=");
    opts[key.toLowerCase()] = rest.join("=");
  }

  return { command, opts, text: tokens.join(" ") };
}

function envelope(type, payload, subscriptionType) {
  return {
    metadata: {
      message_id: randomUUID(),
      message_type: type,
      message_timestamp: new Date().toISOString(),
      ...(subscriptionType ? { subscription_type: subscriptionType, subscription_version: "1" } : {})
    },
    payload
  };
}

function textFragments(text) {
  return text ? [{ type: "text", text, cheermote: null, emote: null, mention: null }] : [];
}

function baseEvent() {
  return {
    broadcaster_user_id: BROADCASTER.id,
    broadcaster_user_login: BROADCASTER.login,
    broadcaster_user_name: BROADCASTER.name,
    chatter_user_id: chatter.id,
    chatter_user_login: chatter.login,
    chatter_user_name: chatter.name,
    message_id: randomUUID(),
    color: "#00FF7F",
    badges: [],
    source_broadcaster_user_id: null,
    source_broadcaster_user_login: null,
    source_broadcaster_user_name: null,
    source_message_id: null,
    source_badges: null
  };
}

function send(subscriptionType, event) {
  const message = envelope("notification", {
    subscription: {
      id: randomUUID(),
      type: subscriptionType,
      version: "1",
      status: "enabled",
      cost: 0,
      condition: { broadcaster_user_id: BROADCASTER.id, user_id: BROADCASTER.id },
      transport: { method: "websocket" },
      created_at: new Date().toISOString()
    },
    event
  }, subscriptionType);

  for (const ws of clients) {
    ws.send(JSON.stringify(message));
  }

  const summary = subscriptionType === "channel.chat.notification"
    ? `${event.notice_type}: ${event.system_message}${event.message.text ? ` / "${event.message.text}"` : ""}`
    : `${event.cheer ? `[${event.cheer.bits} bits] ` : ""}${event.chatter_user_login}: ${event.message.text}`;
  console.log(`-> ${subscriptionType} (${clients.size} client(s)) ${summary}`);
}

function chatMessage(text, cheer) {
  let fragments = textFragments(text);

  if (cheer) {
    const cheermote = `${cheer.prefix}${cheer.bits}`;
    fragments = [
      { type: "cheermote", text: cheermote, cheermote: { prefix: cheer.prefix.toLowerCase(), bits: cheer.bits, tier: cheerTier(cheer.bits) }, emote: null, mention: null },
      ...textFragments(text ? ` ${text}` : "")
    ];
    text = text ? `${cheermote} ${text}` : cheermote;
  }

  send("channel.chat.message", {
    ...baseEvent(),
    message: { text, fragments },
    message_type: "text",
    cheer: cheer ? { bits: cheer.bits } : null,
    reply: null,
    channel_points_custom_reward_id: null,
    channel_points_animation_id: null
  });
}

function cheerTier(bits) {
  return [10000, 5000, 1000, 100, 1].find((tier) => bits >= tier) || 1;
}

const NOTICE_FIELDS = [
  "sub", "resub", "sub_gift", "community_sub_gift", "gift_paid_upgrade", "prime_paid_upgrade",
  "pay_it_forward", "raid", "unraid", "announcement", "bits_badge_tier", "charity_donation",
  "shared_chat_sub", "shared_chat_resub", "shared_chat_sub_gift", "shared_chat_community_sub_gift",
  "shared_chat_gift_paid_upgrade", "shared_chat_prime_paid_upgrade", "shared_chat_pay_it_forward",
  "shared_chat_raid", "shared_chat_unraid", "shared_chat_announcement"
];

function notification(noticeType, detail, systemMessage, { text = "", anonymous = false } = {}) {
  const event = {
    ...baseEvent(),
    chatter_is_anonymous: anonymous,
    system_message: systemMessage,
    message: { text, fragments: textFragments(text) },
    notice_type: noticeType
  };

  for (const field of NOTICE_FIELDS) {
    event[field] = null;
  }

  event[noticeType] = detail;

  if (anonymous) {
    Object.assign(event, { chatter_user_id: null, chatter_user_login: null, chatter_user_name: null });
  }

  send("channel.chat.notification", event);
}

function gifter(opts) {
  const anon = bool(opts.anon);
  const user = userFromLogin(opts.gifter || "somegifter");

  return {
    gifter_is_anonymous: anon,
    gifter_user_id: anon ? null : user.id,
    gifter_user_login: anon ? null : user.login,
    gifter_user_name: anon ? null : user.name
  };
}

const commands = {
  help: () => console.log(HELP),

  as: ({ text }) => {
    if (!text) return console.log(`current chatter: ${chatter.login}`);
    chatter = userFromLogin(text.split(/\s+/)[0]);
    console.log(`now chatting as ${chatter.login} (${chatter.id})`);
  },

  msg: ({ text }) => chatMessage(text),

  cheer: ({ opts, text }) => chatMessage(text, { bits: Number(opts.bits || 100), prefix: opts.prefix || "Cheer" }),

  sub: ({ opts, text }) => {
    const tier = opts.tier || "1000";
    const prime = bool(opts.prime);
    notification("sub", { sub_tier: tier, is_prime: prime, duration_months: Number(opts.months || 1) },
      `${chatter.name} subscribed ${prime ? "with Prime" : `at ${tierName(tier)}`}.`, { text });
  },

  resub: ({ opts, text }) => {
    const tier = opts.tier || "1000";
    const prime = bool(opts.prime);
    const months = Number(opts.months || 12);
    const streak = opts.streak === undefined ? 3 : Number(opts.streak);
    const isGift = bool(opts.gift);
    const giftInfo = isGift ? gifter(opts) : { gifter_is_anonymous: null, gifter_user_id: null, gifter_user_login: null, gifter_user_name: null };
    notification("resub", {
      cumulative_months: months,
      duration_months: 1,
      streak_months: streak || null,
      sub_tier: tier,
      is_prime: prime,
      is_gift: isGift,
      ...giftInfo
    }, `${chatter.name} subscribed ${prime ? "with Prime" : `at ${tierName(tier)}`}. They've subscribed for ${months} months${streak ? `, currently on a ${streak} month streak` : ""}!`, { text });
  },

  subgift: ({ opts }) => {
    const tier = opts.tier || "1000";
    const anon = bool(opts.anon);
    const recipient = userFromLogin(opts.recipient || "luckyviewer");
    notification("sub_gift", {
      duration_months: Number(opts.months || 1),
      cumulative_total: anon ? null : Number(opts.total || 5),
      recipient_user_id: recipient.id,
      recipient_user_login: recipient.login,
      recipient_user_name: recipient.name,
      sub_tier: tier,
      community_gift_id: null
    }, `${anon ? "An anonymous user" : chatter.name} gifted a ${tierName(tier)} sub to ${recipient.name}!`, { anonymous: anon });
  },

  community: ({ opts }) => {
    const tier = opts.tier || "1000";
    const anon = bool(opts.anon);
    const count = Number(opts.count || 5);
    notification("community_sub_gift", {
      id: randomUUID(),
      total: count,
      sub_tier: tier,
      cumulative_total: anon ? null : Number(opts.total || 25)
    }, `${anon ? "An anonymous user" : chatter.name} is gifting ${count} ${tierName(tier)} Subs to ${BROADCASTER.name}'s community!`, { anonymous: anon });
  },

  giftupgrade: ({ opts, text }) => {
    const info = gifter(opts);
    notification("gift_paid_upgrade", info,
      `${chatter.name} is continuing the Gift Sub they got from ${info.gifter_is_anonymous ? "an anonymous user" : info.gifter_user_name}!`, { text });
  },

  primeupgrade: ({ opts, text }) => {
    const tier = opts.tier || "1000";
    notification("prime_paid_upgrade", { sub_tier: tier },
      `${chatter.name} converted from a Prime sub to a ${tierName(tier)} sub!`, { text });
  },

  payitforward: ({ opts, text }) => {
    const info = gifter(opts);
    notification("pay_it_forward", info,
      `${chatter.name} is paying forward the Gift they got from ${info.gifter_is_anonymous ? "an anonymous user" : info.gifter_user_name}!`, { text });
  },

  raid: ({ opts }) => {
    const viewers = Number(opts.viewers || 42);
    notification("raid", {
      user_id: chatter.id,
      user_login: chatter.login,
      user_name: chatter.name,
      viewer_count: viewers,
      profile_image_url: "https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-70x70.png"
    }, `${viewers} raiders from ${chatter.name} have joined!`);
  },

  unraid: () => notification("unraid", {}, `${BROADCASTER.name} has cancelled the raid.`),

  announce: ({ opts, text }) => notification("announcement", { color: (opts.color || "PRIMARY").toUpperCase() }, "", { text }),

  bitsbadge: ({ opts }) => {
    const tier = Number(opts.tier || 1000);
    notification("bits_badge_tier", { tier }, `${chatter.name} just earned a new ${tier >= 1000 ? `${tier / 1000}K` : tier} Bits badge!`);
  },

  charity: ({ opts, text }) => {
    const [whole, fraction = ""] = String(opts.amount || "5.00").split(".");
    const decimalPlace = fraction.length;
    const currency = (opts.currency || "USD").toUpperCase();
    notification("charity_donation", {
      charity_name: opts.charity || "Example Charity",
      amount: { value: Number(whole + fraction), decimal_place: decimalPlace, currency }
    }, `${chatter.name}: Donated ${currency} ${opts.amount || "5.00"} to support ${opts.charity || "Example Charity"}`, { text });
  }
};

new WebSocketServer({ port: PORT, path: "/ws" }).on("connection", (ws) => {
  clients.add(ws);
  const sessionId = randomUUID();

  ws.send(JSON.stringify(envelope("session_welcome", {
    session: { id: sessionId, status: "connected", keepalive_timeout_seconds: 10, reconnect_url: null, connected_at: new Date().toISOString() }
  })));

  // The listener reconnects if it hears nothing for keepalive_timeout_seconds + 5.
  const keepalive = setInterval(() => ws.send(JSON.stringify(envelope("session_keepalive", {}))), 8000);

  ws.on("close", () => {
    clearInterval(keepalive);
    clients.delete(ws);
    console.log(`client disconnected (session ${sessionId})`);
  });

  console.log(`client connected (session ${sessionId})`);
});

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;

  const parsed = parse(line);
  const handler = commands[parsed.command];

  if (handler) {
    handler(parsed);
  } else {
    // Not a command - treat the whole line as a plain chat message.
    chatMessage(line.trim());
  }
});

console.log(`mock EventSub server on ws://127.0.0.1:${PORT}/ws - type 'help' for commands`);
