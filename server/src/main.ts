import ObsController from "./controllers/obs_controller.js"
// import ObsWebSocket from "obs-websocket-js"
// import ObsTransformer from "./obs_transformer.js";
import Client from "./client.js"
// import Controller from "./controller.js";
import { sleep, parseMessage } from "./helpers.js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(import.meta.dirname, "..", "..", ".env") });

export default async () => {
  if (!process.env.WS_ADDRESS) {
    throw new Error("WS_ADDRESS must be set in your environment");
  }

  if (!process.env.OBS_WEBSOCKET_ADDRESS) {
    throw new Error("OBS_WEBSOCKET_ADDRESS must be set in your environment");
  }

  const ws = new Client(process.env.WS_ADDRESS);
  const obs = new ObsController(process.env.OBS_WEBSOCKET_ADDRESS, process.env.OBS_WEBSOCKET_PASSWORD);

  await obs.connect();

  let modifiers = {
    // "test": () => {
    //   obs.getScene("TransformGame1").then((scene) => {
    //     scene?.getSceneItem()?.scale(0.5)
    //     console.log(scene)
    //   })
    // },
    //   "shrink": () => {
    //     const currentScale = obsTransformer.currentScale;
    //
    //     obs.setSourceFilterSettings({
    //       settings: obsTransformer.scale(0.3333)
    //     });
    //     obs.triggerHotkey();
    //   },
    //   "grow": () => {
    //     const currentScale = obsTransformer.currentScale;
    //
    //     obs.setSourceFilterSettings({
    //       settings: obsTransformer.scale(1.3333)
    //     });
    //     obs.triggerHotkey();
    //   },
    //   "rotate90": () => {
    //     const angle = obsTransformer.angle;
    //
    //     obs.setSourceFilterSettings({
    //       settings: obsTransformer.rotate((angle + 90))
    //     });
    //     obs.triggerHotkey();
    //   },
    //   "rotate180": () => {
    //     const angle = obsTransformer.angle;
    //
    //     obs.setSourceFilterSettings({
    //       settings: obsTransformer.rotate((angle + 180))
    //     });
    //     obs.triggerHotkey();
    //   },
    //   "flipH": () => {
    //     obs.setSourceFilterSettings({
    //       settings: obsTransformer.flipH()
    //     });
    //     obs.triggerHotkey();
    //   },
    //   "spin": async () => {
    //     const { filterEnabled } = await obs.getSourceFilter({
    //       sourceName: process.env.SCENE_NAME,
    //       filterName: "spin"
    //     })
    //
    //     obs.setSourceFilterEnabled({
    //       filterName: "spin",
    //       enabled: !filterEnabled
    //     })
    //   },
    //   "invert": async () => {
    //     const { filterEnabled } = await obs.getSourceFilter({
    //       sourceName: process.env.SCENE_NAME,
    //       filterName: "invert"
    //     })
    //
    //     obs.setSourceFilterEnabled({
    //       filterName: "invert",
    //       enabled: !filterEnabled
    //     })
    //   },
    //   "delay": async () => {
    //     const { filterEnabled } = await obs.getSourceFilter({
    //       sourceName: process.env.SCENE_NAME,
    //       filterName: "delay"
    //     })
    //
    //     obs.setSourceFilterEnabled({
    //       filterName: "delay",
    //       enabled: !filterEnabled
    //     })
    //   },
    //   "dvd": async () => {
    //     const { sceneItemEnabled } = await obs.getSceneItemEnabled({
    //       sceneName: process.env.SCENE_NAME,
    //       sceneItemName: 'dvd',
    //     })
    //
    //     obs.setSceneItemEnabled({
    //       sceneName: process.env.SCENE_NAME,
    //       sceneItemName: 'dvd',
    //       enabled: !sceneItemEnabled
    //     })
    //   },
    //   "spotlight": async () => {
    //     const { sceneItemEnabled } = await obs.getSceneItemEnabled({
    //       sceneName: process.env.SCENE_NAME,
    //       sceneItemName: 'dvd',
    //     })
    //
    //     obs.setSceneItemEnabled({
    //       sceneName: process.env.SCENE_NAME,
    //       sceneItemName: 'spotlight',
    //       enabled: !sceneItemEnabled
    //     })
    //   },
    //   "trivia": async () => {
    //     const { sceneItemEnabled } = await obs.getSceneItemEnabled({
    //       sceneName: process.env.SCENE_NAME,
    //       sceneItemName: 'dvd',
    //     })
    //
    //     obs.setSceneItemEnabled({
    //       sceneName: process.env.SCENE_NAME,
    //       sceneItemname: 'trivia',
    //       enabled: !sceneItemEnabled
    //     })
    //   },
    //   "mute": async () => {
    //     const { sceneItemEnabled } = await obs.getSceneItemEnabled({
    //       sceneName: process.env.SCENE_NAME,
    //       sceneItemName: 'dvd',
    //     })
    //
    //     obs.setSceneItemEnabled({
    //       sceneName: process.env.SCENE_NAME,
    //       sceneItemname: 'mute',
    //       enabled: !sceneItemEnabled
    //     })
    //   },
    //   "square": () => {
    //     const active = obsTransformer.toggle('square')
    //     obs.setSourceFilterSettings({
    //       settings: obsTransformer.transform({
    //         scaleX: active ? 9 / 16 : 1,
    //         scaleY: 1
    //       })
    //     });
    //     obs.triggerHotkey();
    //   },
  }

  ws.on('modifier', ({ data }: { data: any }) => {
    console.log('modifier', data)
    if (data in obs) {
    }
    // console.log('modify');
    // modifiers[data]();
    // if (["up", "down", "left", "right"].includes(data)) {
    //   obs.setSourceFilterSettings({
    //     settings: obsTransformer.move(data)
    //   });
    //   obs.triggerHotkey();
    // } else if (data in obs) {
    //   // for multi-game transforms will need to have a way to send
    //   // a sceneName (or look it up in some meaningful way)
    //   setTimeout(() => {
    //     obs[data]({
    //       sceneName: 'TransformGame1',
    //       sceneItemName: 'game1',
    //       ...data
    //     });
    //     // modifiers[data]();
    //   }, 1000)
    // }
  })

  ws.on('messages', async (message: any) => {
    let { event, data } = parseMessage(message)

    console.log(event, data)
    return

    // switch (event) {
    //   case "scenes":
    //     obs.getSceneItemList({})
    //     break;
    //   case "game:start":
    //     console.log('Resetting for new game');
    //     await obs.batchDisable({ sceneName: process.env.SCENE_NAME });
    //
    //     obsTransformer.reset();
    //     obs.setSourceFilterSettings({
    //       settings: obsTransformer.getTransform()
    //     })
    //     obs.triggerHotkey();
    //     break;
    //   case "modifier":
    //     if (["up", "down", "left", "right"].includes(data)) {
    //       obs.setSourceFilterSettings({
    //         settings: obsTransformer.move(data)
    //       });
    //       obs.triggerHotkey();
    //     } else if (data in modifiers) {
    //       await sleep(10000)
    //       modifiers[data]();
    //     }
    //     break;
    //   case "reset":
    //     await obs.batchDisable({ sceneName: process.env.SCENE_NAME })
    //
    //     obsTransformer.reset();
    //     obs.setSourceFilterSettings({
    //       settings: obsTransformer.getTransform()
    //     })
    //     obs.triggerHotkey();
    //     break;
    // }
  });
}
