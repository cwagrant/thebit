import express, { Request, Response } from "express";
import path from "path";
import ObsController from "./controllers/obs_controller.js"
import dotenv from "dotenv";

dotenv.config({ path: path.join(import.meta.dirname, "..", "..", ".env") });
import Client from "./client.js"
import config from "./config.js"

const app = express();
const PORT = 3131;

if (config.controller("OBS")) {
  if (!process.env.OBS_WEBSOCKET_ADDRESS) {
    throw new Error("OBS_WEBSOCKET_ADDRESS must be set in your environment");
  }

  const obs = new ObsController(
    process.env.OBS_WEBSOCKET_ADDRESS,
    process.env.OBS_WEBSOCKET_PASSWORD
  );

  obs.connect();

  app.get("/obs", (req: Request, res: Response) => {
    res.json(config.controller("OBS"));
  })

  app.get("/test", async (req: Request, res: Response) => {
    const scene = obs.getScene("TransformGame1")
    scene?.getSceneItem()?.scale(0.5)

    res.json(scene || {})
  })
}

app.use(express.static(path.join(import.meta.dirname, '..', 'client')));

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
// const runMain = async () => {
//   try {
//     await main()
//   } catch (error) {
//     console.log('Errored out, restarting.')
//     console.error(error)
//     await runMain()
//   }
// }
//
// await runMain()
//
// await main()
