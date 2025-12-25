import express, { Request, Response } from "express";
import path from "path";
import ObsController from "./controllers/obs_controller.js"
import dotenv from "dotenv";
import { Listeners, SocketIOListener } from "./listeners/index.js"

dotenv.config({ path: path.join(import.meta.dirname, "..", "..", ".env") });
import config from "./config.js"
import ATEMController from "./controllers/atem_controller.js";

const app = express();
const PORT = 3131;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const listeners = new Listeners()

if (config.controller("OBS")) {
  if (!process.env.OBS_WEBSOCKET_ADDRESS) {
    throw new Error("OBS_WEBSOCKET_ADDRESS must be set in your environment");
  }

  const obs = new ObsController(
    process.env.OBS_WEBSOCKET_ADDRESS,
    process.env.OBS_WEBSOCKET_PASSWORD
  );

  obs.connect();
  listeners.setupListeners(obs);

  app.get("/api/obs", (req: Request, res: Response) => {
    res.json(config.controller("OBS"));
  })

  app.get("/api/obs/actions", (req: Request, res: Response) => {
    const actions = obs.getActions();
    const object = Object.fromEntries(actions);

    res.json(object);
  })

  app.post("/api/obs/action", (req: Request, res: Response) => {
    const { action, sceneName, ...args } = req.body;
    console.log('req', action, sceneName, args);
    obs.action(action, sceneName, args)
    res.sendStatus(200);
  })

  app.get("/test", async (req: Request, res: Response) => {
    const scene = obs.getScene("TransformGame1")
    scene?.getSceneItem()?.scale(0.5)

    res.json(scene || {})
  })
}

if (config.controller("ATEM")) {
  if (!process.env.ATEM_IP_ADDRESS) {
    throw new Error("ATEM_IP_ADDRESS must be set in your environment");
  }

  const atem = new ATEMController();
  atem.connect(process.env.ATEM_IP_ADDRESS);

  app.get("/api/atem", (req: Request, res: Response) => {
    res.json({
      config: config.controller("ATEM"),
      status: atem.atem.status,
      state: atem.atem.state
    });
  });

  app.get("/api/atem/actions", (req: Request, res: Response) => {
    res.json(atem.getActions());
  });

  app.post("/api/atem/action", (req: Request, res: Response) => {
    const { action, path, ...args } = req.body;

    if (typeof path !== "string") {
      res.status(400).send("Path must be a string");
      return;
    }

    if (typeof action !== "string") {
      res.status(400).send("Action must be a string");
      return;
    }

    console.log('req', action, path, args);
    atem.action(action, path.split('.'), args);
    res.sendStatus(200);
  });
}

app.use(express.static(path.join(import.meta.dirname, '..', 'client')));

app.get('/*', (req, res) => {
  res.sendFile(path.join(import.meta.dirname, '..', 'client', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});


