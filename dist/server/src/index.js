import main from "./main.js";
import express from "express";
import path from "path";
const app = express();
const PORT = 3131;
app.use(express.static(path.join(import.meta.dirname, '..', 'client')));
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
app.get("/controllers", (req, res) => {
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
await main();
