import main from "./main.js"

const runMain = async () => {
  try {
    await main()
  } catch (error) {
    console.log('Errored out, restarting.')
    console.error(error)
    await runMain()
  }
}

await runMain()
