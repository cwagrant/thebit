// import OBSWebSocket from "obs-websocket-js";
import "dotenv/config";
import obs_ws from "./obs.js";
import socket_io from "./socketio.js";
import express from "express";
import http from "http";

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
let startX = 0;
let startY = 0;
let startWidth = 1920;
let startHeight = 1080;
let currentWidth = 1920;
let currentHeight = 1080;
let currentScale = 1.0;
let activityDelta = 1.00;
let minimumSize = parseFloat(process.env.MINIMUM_SIZE);
let maximumSize = parseFloat(process.env.MAXIMUM_SIZE);
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
  obs.call("SetSceneItemTransform", {
    sceneName: process.env.SCENE_NAME,
    sceneItemId: sceneItemId,
    sceneItemTransform: {
      positionX: 0,
      positionY: 0,
      scaleX: 1,
      scaleY: 1,
    },
  }).then(() => {
    currentScale = 1;
    currentWidth = 1920;
    currentHeight = 1080;
    return res.json({ message: "Success" });
  });
});

app.get("/stop", (req, res) => {
  active = false;
  obs.call("SetSceneItemTransform", {
    sceneName: process.env.SCENE_NAME,
    sceneItemId: sceneItemId,
    sceneItemTransform: {
      positionX: 0,
      positionY: 0,
      scaleX: 1,
      scaleY: 1,
    },
  }).then(() => {
    currentScale = 1;
    currentWidth = 1920;
    currentHeight = 1080;
    return res.json({ message: "Success" });
  });
});

app.get("/max", (req, res) => {
  try {
    maximumSize = parseFloat(req.query.amount);

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
    minimumSize = parseFloat(req.query.amount);
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

app.get("/resume", (req, res) => {
  active = true;
  return res.json({ message: "Resumed" });
});

app.get("/activityreset", (req, res) => {
  activityDelta = 1.00;
  return res.json({ message: "Activity Delta set to 1.00" });
});

obs.call("GetSceneItemTransform", {
  sceneName: process.env.SCENE_NAME,
  sceneItemId: sceneItemId,
}).then((data) => {
  console.log("Current Transform", data.sceneItemTransform);
  currentWidth = data.sceneItemTransform.sourceWidth;
  currentHeight = data.sceneItemTransform.sourceHeight;
  currentScale = data.sceneItemTransform.scaleX;
});

// we may need to tweak this in the future but as it stands, based on the fastest
// opening speed possible, doing this every 1 second means we never really move
// the activity delta enough for it not to be 1 by the next time a donation is
// shown. Currently we're doing it every 3 seconds instead which appears to be
// just about slow enough so the activity delta continues to decrease during
// rapid fire donations but will increase during downtimes.
setInterval(() => {
  if (activityDelta < 1) {
    activityDelta += 0.01;
  }
}, 3000);

const clamp = (number) => {
  if (number < minimumSize) {
    return minimumSize;
  } else if (number > maximumSize) {
    return maximumSize;
  }
  return number;
};

socket.on("donation:show", (data) => {
  if (!active) {
    console.log("Donation received but I'm paused!");
    return false;
  }

  // While we don't currently do it, there's nothing that
  // would stop us from implementing a simple method to
  // do a lookup of donation amounts and certain amounts
  // could have certain affects on the scene.

  const { amount } = data;
  const donationCents = parseInt(amount * 100);
  const adjustSign = (donationCents % 2) ? 1 : -1;
  const baseDelta = donationCents / 99900;
  const newSize = currentScale + (baseDelta * activityDelta * adjustSign);

  currentScale = clamp(newSize);
  currentWidth = startWidth * currentScale;
  currentHeight = startHeight * currentScale;
  activityDelta *= 0.95;

  const posX = startX + ((startWidth - currentWidth) / 2);
  const posY = startY + ((startHeight - currentHeight) / 2);

  console.log({
    currentScale: currentScale,
    activityDelta: activityDelta,
    baseDelta: baseDelta,
    adjustSign: adjustSign,
    baseDelta: baseDelta,
    donationCents: donationCents,
    newSize: newSize,
  });

  obs.call("SetSourceFilterSettings", {
    sourceName: process.env.SCENE_NAME,
    filterName: process.env.FILTER_NAME,
    filterSettings: {
      pos: { x: posX, y: posY },
      scale: { x: currentScale, y: currentScale },
    },
  });

  obs.call("TriggerHotkeyByName", {
    hotkeyName: process.env.HOTKEY_NAME,
  }).then().catch((e) => console.log(e));
});

server.listen(port, function () {
  console.log(`Express Listening on port ${port}`);
});
