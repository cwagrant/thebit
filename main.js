import Obs from "./obs.js"
import ObsTransformer from "./obs_transformer.js";
import WebSocket from "ws";
import { parseMessage } from "./events.js";

export default async () => {
  const ws = new WebSocket(process.env.WS_ADDRESS);
  const obs = new Obs();
  await obs.connect();

  const sceneItemId = await obs.getSceneItemId({
    sceneName: process.env.SCENE_NAME,
    sourceName: process.env.SOURCE_NAME
  })

  await obs.getSceneItemList({ sceneName: process.env.SCENE_NAME });

  const baseTransform = await obs.getSceneItemTransform({
    sceneName: process.env.SCENE_NAME,
    sceneItemId: sceneItemId
  })

  const obsTransformer = new ObsTransformer(
    baseTransform.sceneItemTransform.sourceWidth,
    baseTransform.sceneItemTransform.sourceHeight,
    baseTransform.sceneItemTransform.scaleX
  )

  let modifiers = {
    "shrink": () => {
      const currentScale = obsTransformer.currentScale;

      obs.setSourceFilterSettings({
        settings: obsTransformer.scale(0.3333)
      });
      obs.triggerHotkey();
    },
    "grow": () => {
      const currentScale = obsTransformer.currentScale;

      obs.setSourceFilterSettings({
        settings: obsTransformer.scale(1.3333)
      });
      obs.triggerHotkey();
    },
    "rotate90": () => {
      const angle = obsTransformer.angle;

      obs.setSourceFilterSettings({
        settings: obsTransformer.rotate((angle + 90))
      });
      obs.triggerHotkey();
    },
    "rotate180": () => {
      const angle = obsTransformer.angle;

      obs.setSourceFilterSettings({
        settings: obsTransformer.rotate((angle + 180))
      });
      obs.triggerHotkey();
    },
    "flipH": () => {
      obs.setSourceFilterSettings({
        settings: obsTransformer.flipH()
      });
      obs.triggerHotkey();
    },
    "spin": async () => {
      const { filterEnabled } = await obs.getSourceFilter({
        sourceName: process.env.SCENE_NAME,
        filterName: "spin"
      })

      obs.setSourceFilterEnabled({
        filterName: "spin",
        enabled: !filterEnabled
      })
    },
    "invert": async () => {
      const { filterEnabled } = await obs.getSourceFilter({
        sourceName: process.env.SCENE_NAME,
        filterName: "invert"
      })

      obs.setSourceFilterEnabled({
        filterName: "invert",
        enabled: !filterEnabled
      })
    },
    "delay": async () => {
      const { filterEnabled } = await obs.getSourceFilter({
        sourceName: process.env.SCENE_NAME,
        filterName: "delay"
      })

      obs.setSourceFilterEnabled({
        filterName: "delay",
        enabled: !filterEnabled
      })
    },
    "dvd": async () => {
      const { sceneItemEnabled } = await obs.getSceneItemEnabled({
        sceneName: process.env.SCENE_NAME,
        sceneItemName: 'dvd',
      })

      obs.setSceneItemEnabled({
        sceneName: process.env.SCENE_NAME,
        sceneItemName: 'dvd',
        enabled: !sceneItemEnabled
      })
    },
    "spotlight": async () => {
      const { sceneItemEnabled } = await obs.getSceneItemEnabled({
        sceneName: process.env.SCENE_NAME,
        sceneItemName: 'dvd',
      })

      obs.setSceneItemEnabled({
        sceneName: process.env.SCENE_NAME,
        sceneItemName: 'spotlight',
        enabled: !sceneItemEnabled
      })
    },
    "trivia": async () => {
      const { sceneItemEnabled } = await obs.getSceneItemEnabled({
        sceneName: process.env.SCENE_NAME,
        sceneItemName: 'dvd',
      })

      obs.setSceneItemEnabled({
        sceneName: process.env.SCENE_NAME,
        sceneItemname: 'trivia',
        enabled: !sceneItemEnabled
      })
    },
    "mute": async () => {
      const { sceneItemEnabled } = await obs.getSceneItemEnabled({
        sceneName: process.env.SCENE_NAME,
        sceneItemName: 'dvd',
      })

      obs.setSceneItemEnabled({
        sceneName: process.env.SCENE_NAME,
        sceneItemname: 'mute',
        enabled: !sceneItemEnabled
      })
    },
    "square": () => {
      const active = obsTransformer.toggle('square')
      obs.setSourceFilterSettings({
        settings: obsTransformer.transform({
          scaleX: active ? 9 / 16 : 1,
          scaleY: 1
        })
      });
      obs.triggerHotkey();
    },
  }

  ws.on('message', async (message) => {
    let { event, data } = parseMessage(message)

    switch (event) {
      case "scenes":
        obs.getSceneItemList({})
        break;
      case "game:start":
        console.log('Resetting for new game');
        await obs.batchDisable({ sceneName: process.env.SCENE_NAME });

        obsTransformer.reset();
        obs.setSourceFilterSettings({
          settings: obsTransformer.getTransform()
        })
        obs.triggerHotkey();
        break;
      case "modifier":
        if (["up", "down", "left", "right"].includes(data)) {
          obs.setSourceFilterSettings({
            settings: obsTransformer.move(data)
          });
          obs.triggerHotkey();
        } else if (data in modifiers) {
          modifiers[data]();
        }
        break;
      case "reset":
        await obs.batchDisable({ sceneName: process.env.SCENE_NAME })

        obsTransformer.reset();
        obs.setSourceFilterSettings({
          settings: obsTransformer.getTransform()
        })
        obs.triggerHotkey();
        //
        break;
    }
  });
}
