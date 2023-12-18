// import OBSWebSocket from "obs-websocket-js";
import "dotenv/config";
import obs_ws from "./obs.js";
import socket_io from "./socketio.js";
import express from "express";
import http from "http";
import ObsTransformer from "./obs_transformer.js";

const socket = await socket_io();
const obs = await obs_ws();

const app = express();
const port = process.env.PORT || 8675;
const server = http.createServer(app);

const sceneItemId = await obs.call("GetSceneItemId", {
  sceneName: process.env.SCENE_NAME,
  sourceName: process.env.SOURCE_NAME,
}).then((resp) => {
  return resp.sceneItemId;
});

let active = true;
let obsTransformer;
/* Some very simple GET requests we can make
 * to the server for controlling the resizer.
 */
app.get("/", (req, res) => {
  obs.call("GetSceneItemTransform", {
    sceneName: process.env.SCENE_NAME,
    sceneItemId: sceneItemId,
  }).then((response) => {
    return res.json(response);
  });
});

app.get("/reset", (req, res) => {
  const transform = obsTransformer.transform(999999999);
  setSourceFilterSettings(transform);
  triggerHotkey();
  return res.json({ message: "Success" });
});

app.get("/stop", (req, res) => {
  active = false;
  const transform = obsTransformer.transform(999999999);
  setSourceFilterSettings(transform);
  triggerHotkey();
  return res.json({ message: "Success" });
});

app.get("/max", (req, res) => {
  try {
    obsTransformer.maximumSize = parseFloat(req.query.amount);

    return res.json({ message: "Success" });
  } catch (error) {
    return res.json({
      message: "Failed",
      reason: error,
    });
  }
});

app.get("/min", (req, res) => {
  try {
    obsTransformer.minimumSize = parseFloat(req.query.amount);

    return res.json({ message: "Success" });
  } catch {
    return res.json({
      message: "Failed",
      reason: "Unable to parse amount to float. Returning to default.",
    });
  }
});

// To be clear, when paused we are not keeping any information about
// missed donations. If we don't process them when they come in they
// just don't get processed, period.
app.get("/pause", (req, res) => {
  active = false;
  return res.json({ message: "Paused" });
});

app.get("/start", (req, res) => {
  active = true;
  return res.json({ message: "Resumed" });
});

app.get("/activityreset", (req, res) => {
  activityDelta = 1.00;
  return res.json({ message: "Activity Delta set to 1.00" });
});

app.get("/donate", (req, res) => {
  const { amount } = req.query;
  const transform = obsTransformer.transform(amount);
  setSourceFilterSettings(transform);
  triggerHotkey();
  return res.json({ message: "Donate Now!" });
});

app.get("/addTransform", (req, res) => {
  const { amount, x, y, scale } = req.query;
  try {
    obsTransformer.addLookupScale(amount, parseFloat(scale));
    return res.json({
      message: "Added New Transform",
      transforms: obsTransformer.tlookup,
    });
  } catch {
    return res.json({
      message: "Failed to add transform",
      transforms: obsTransformer.tlookup,
    });
  }
});

app.get("/removeTransform", (req, res) => {
  const amount = req.query.amount;

  try {
    obsTransformer.removeLookupScale(amount);
    return res.json({
      message: "Removed Transform",
      transforms: obsTransformer.tlookup,
    });
  } catch {
    return res.json({
      message: "Failed to Remove Transform",
      transforms: obsTransformer.tlookup,
    });
  }
});

obs.call("GetSceneItemTransform", {
  sceneName: process.env.SCENE_NAME,
  sceneItemId: sceneItemId,
}).then((data) => {
  console.log("Current Transform", data.sceneItemTransform);
  const width = data.sceneItemTransform.sourceWidth;
  const height = data.sceneItemTransform.sourceHeight;
  const scale = data.sceneItemTransform.scaleX;
  const crop = {
    bottom: data.sceneItemTransform.cropBottom,
    left: data.sceneItemTransform.cropLeft,
    right: data.sceneItemTransform.cropRight,
    top: data.sceneItemTransform.cropTop,
  };

  obsTransformer = new ObsTransformer(width, height, scale, crop);
});

// we may need to tweak this in the future but as it stands, based on the fastest
// opening speed possible, doing this every 1 second means we never really move
// the activity delta enough for it not to be 1 by the next time a donation is
// shown. Currently we're doing it every 3 seconds instead which appears to be
// just about slow enough so the activity delta continues to decrease during
// rapid fire donations but will increase during downtimes.

const setSourceFilterSettings = (settings) => {
  obs.call("SetSourceFilterSettings", {
    sourceName: process.env.SCENE_NAME,
    filterName: process.env.FILTER_NAME,
    filterSettings: settings,
  });
};

const triggerHotkey = () => {
  obs.call("TriggerHotkeyByName", {
    hotkeyName: process.env.HOTKEY_NAME,
  }).then().catch((e) => console.log(e));
};

let SHOWN_DONATIONS = [];

// socket.onAny((event, data) => {
//   console.log(event, data);
// });

socket.on("donation:show", ({ amount, donationid }) => {
  if (!active) {
    console.log("Donation received but I'm paused!");
    return false;
  }

  // Skip a donation if we already processed it
  if (SHOWN_DONATIONS.includes(donationid)) {
    console.log("I already processed that donation", donationid);
    return false;
  }

  SHOWN_DONATIONS.push(donationid);

  // Get rid of the oldest donation in our array.
  if (SHOWN_DONATIONS.length > 5) {
    SHOWN_DONATIONS.shift();
  }

  const transform = obsTransformer.transform(amount);

  setSourceFilterSettings(transform);
  triggerHotkey();
});

server.listen(port, function () {
  console.log(`Express Listening on port ${port}`);
});
