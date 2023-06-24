const { default: OBSWebSocket } = require("obs-websocket-js");
const obs = new OBSWebSocket();
const io = require("socket.io-client");

const socket = io("http://localhost:8080");
// Declare some events to listen for.
obs.on("ConnectionOpened", () => {
  console.log("Connection Opened");
});

obs.on("Identified", () => {
  console.log("Identified, good to go!");

  obs.call("GetHotkeyList").then(
    (data) => {
      console.log(data);
    },
  );

  obs.call("GetSourceFilterList", { sourceName: "Test" }).then(
    (data) => {
      if (data?.filters) {
        for (filter of data?.filters) {
          console.log(filter?.filterSettings);
        }
      }
    },
  );

  let activityDelta = 1.00;
  let currentSize = 1;

  setInterval(() => {
    if (activityDelta < 1) {
      activityDelta += 0.01;
    }
  }, 1000);

  socket.on("donation:save", (data) => {
    const { amount: donationCents } = data;

    // this seems to work and makes it so that larger amounts
    // make larger change and smaller amounts make smaller changes
    const adjustSign = (donationCents % 2) ? 1 : -1;
    const baseDelta = donationCents / 99900;
    const newSize = currentSize + (baseDelta * activityDelta * adjustSign);

    currentSize = newSize < 0 ? 0 : newSize;
    activityDelta *= 0.95;

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
      sourceName: "Test",
      filterName: "MinishResize",
      filterSettings: {
        scale: { x: currentSize, y: currentSize },
      },
    });

    obs.call("TriggerHotkeyByName", {
      hotkeyName: "MinishResize",
    }).then(
      (data) => {
        console.log("success");
      },
    ).catch((e) => console.log(e));

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

obs.connect("ws://192.168.1.147:4455", "FiFAhPnPyOT12siC").then((info) => {
  console.log("Connected and identified", info);
}, () => {
  console.error("Error Connecting");
});
