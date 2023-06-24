const { default: OBSWebSocket } = require("obs-websocket-js");
const obs = new OBSWebSocket();
const io = require("socket.io-client");
require("dotenv").config();

const socket = io("http://localhost:8080");

// Declare some events to listen for.
obs.on("ConnectionOpened", () => {
  console.log("Connection Opened");
});

obs.on("Identified", () => {
  console.log("Identified, good to go!");

  // obs.call("GetSourceFilterList", { sourceName: "Test" }).then(
  //   (data) => {
  //     if (data?.filters) {
  //       for (filter of data?.filters) {
  //         // console.log("filter settings data", filter?.filterSettings);
  //       }
  //     }

  //   },
  // );

  // if it crashes and you restart it the below values
  // will be wrong. We probalby need to set them to hard
  // values given to us from the OBS crew.
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;
  let currentWidth = 1920;
  let currentHeight = 1080;

  obs.call("GetSceneItemId", {
    sceneName: process.env.SCENE_NAME,
    sourceName: process.env.SOURCE_NAME,
  }).then((data) => {
    obs.call("GetSceneItemTransform", {
      sceneName: process.env.SCENE_NAME,
      sceneItemId: data.sceneItemId,
    }).then((data) => {
      // console.log(data);
      startX = data.sceneItemTransform.positionX;
      startY = data.sceneItemTransform.positionY;

      startWidth = data.sceneItemTransform.sourceWidth;
      startHeight = data.sceneItemTransform.sourceHeight;
      currentWidth = startWidth;
      currentHeight = startHeight;
    });
  });

  let activityDelta = 1.00;
  let currentSize = 1;

  setInterval(() => {
    if (activityDelta < 1) {
      activityDelta += 0.01;
    }
  }, 1000);

  const clamp = (number) => {
    if (number < 0.1) {
      return 0.1;
    } else if (number > 10) {
      return 10;
    }
    return number;
  };

  socket.on("donation:save", (data) => {
    const { amount: donationCents } = data;

    const adjustSign = (donationCents % 2) ? 1 : -1;
    const baseDelta = donationCents / 99900;
    const newSize = currentSize + (baseDelta * activityDelta * adjustSign);

    currentSize = clamp(newSize);
    currentWidth = startWidth * currentSize;
    currentHeight = startHeight * currentSize;
    activityDelta *= 0.95;

    const posX = startX + ((startWidth - currentWidth) / 2);
    const posY = startY + ((startHeight - currentHeight) / 2);

    console.log({
      currentSize: currentSize,
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
        scale: { x: currentSize, y: currentSize },
      },
    });

    obs.call("TriggerHotkeyByName", {
      hotkeyName: process.env.HOTKEY_NAME,
    }).then().catch((e) => console.log(e));

    // update the transition to increase or decrease based on amount
    // I'm thinking we could probably load up some kind of config file
    // via json that could have special amounts that do wacky things.
    // E.g.
    // {
    //    1111: {"scale": 0.25, "transition": 'instant'},
    //    6969: {"scale": 0.69, "transition": 'smooth'}
    //
    // }
    //
    // We can then maybe even have 2 different methods we call where we
    // either update the scale of the scene/source immediately or we update
    // the filter and then trigger that for a smoother transition.
    //
    //
    //
  });
});

obs.on("SwitchScenes", (data) => {
  console.log("SwitchScenes", data);
});

obs.connect(
  `ws://${process.env.OBS_WEBSOCKET_ADDRESS}`,
  process.env.OBS_WEBSOCKET_PASSWORD,
).then((info) => {
  console.log("Connected and identified", info);
}, () => {
  console.error("Error Connecting");
});
