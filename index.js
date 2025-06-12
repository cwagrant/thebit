// import OBSWebSocket from "obs-websocket-js";
import "dotenv/config";
import obs_ws from "./obs.js";
// import socket_io from "./socketio.js";
import ObsController from "./obs_controller.js";
import ObsTransformer from "./obs_transformer.js";
import WebSocket from "ws";
import { parseMessage } from "./events.js";

// const socket = await socket_io();
const obs = await obs_ws();
const ws = new WebSocket(process.env.WS_ADDRESS);
const controller = new ObsController(obs);

const sceneItemId = await obs.call("GetSceneItemId", {
  sceneName: process.env.SCENE_NAME,
  sourceName: process.env.SOURCE_NAME,
}).then((resp) => {
  return resp.sceneItemId;
});

controller.getSceneItemList({ sceneName: process.env.SCENE_NAME });
let obsTransformer;

obs.call("GetSceneItemTransform", {
  sceneName: process.env.SCENE_NAME,
  sceneItemId: sceneItemId,
}).then((data) => {
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

let modifiers = {
  "shrink": () => {
    const currentScale = obsTransformer.currentScale;

    controller.setSourceFilterSettings({
      settings: obsTransformer.scale(currentScale - 0.1)
    });
    controller.triggerHotkey();
  },
  "grow": () => {
    const currentScale = obsTransformer.currentScale;

    controller.setSourceFilterSettings({
      settings: obsTransformer.scale(currentScale + 0.1)
    });
    controller.triggerHotkey();
  },
  "rotate90": () => {
    const angle = obsTransformer.angle;

    controller.setSourceFilterSettings({
      settings: obsTransformer.rotate((angle + 90))
    });
    controller.triggerHotkey();
  },
  "rotate180": () => {
    const angle = obsTransformer.angle;

    controller.setSourceFilterSettings({
      settings: obsTransformer.rotate((angle + 180))
    });
    controller.triggerHotkey();
  },
  "flipH": () => {
    controller.setSourceFilterSettings({
      settings: obsTransformer.flipH()
    });
    controller.triggerHotkey();
  },
  "spin": () => {
    controller.setSourceFilterEnabled({
      filterName: "spin",
      enabled: obsTransformer.toggle("spin")
    })
  },
  "invert": () => {
    controller.setSourceFilterEnabled({
      filterName: "invert",
      enabled: obsTransformer.toggle('invert')
    })
  },
  "delay": () => { },
  "dvd": () => {
    controller.setSceneItemEnabled({
      sceneName: process.env.SCENE_NAME,
      sceneItemName: 'dvd',
      enabled: obsTransformer.toggle('dvd')
    })
  },
  "spotlight": () => {
    controller.setSceneItemEnabled({
      sceneName: process.env.SCENE_NAME,
      sceneItemName: 'spotlight',
      enabled: obsTransformer.toggle('spotlight')
    })
  },
  "trivia": () => { },
  "mute": () => { },
  "square": () => { },
}

ws.on('message', (message) => {
  let { event, data } = parseMessage(message)

  switch (event) {
    case "scenes":
      controller.getSceneItemList({})
      break;
    case "game:start":
      if (obsTransformer.active) {
        modifiers[obsTransformer.activeModifier]();
      }

      obsTransformer.reset();
      controller.setSourceFilterSettings({
        settings: obsTransformer.getTransform()
      })
      controller.triggerHotkey();
      break;
    case "modifier":
      if (["up", "down", "left", "right"].includes(data)) {
        controller.setSourceFilterSettings({
          settings: obsTransformer.move(data)
        });
        controller.triggerHotkey();
      } else {

        modifiers[data]();
      }
      break;
    case "reset":
      if (obsTransformer.active) {
        modifiers[obsTransformer.activeModifier]();
      }

      obsTransformer.reset();
      controller.setSourceFilterSettings({
        settings: obsTransformer.getTransform()
      })
      controller.triggerHotkey();
      //
      break;
  }
});

