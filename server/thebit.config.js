import { loadEnvFile } from "process"

loadEnvFile();

export default {
  controllerPlugins: [],
  listenerPlugins: [],
  controllers: [
    {
      id: 1,
      name: "OBS",
      kind: "obs",
      scenes: [
        {
          name: "TransformGame1",
          gameSource: "game1",
          moveTransitionFilterName: "transform",
          filters: ["spin", "invert", "delay"],
          sources: ["spotlight", "dvd"],
          minScale: 0.1,
          maxScale: 2.0

        },
        {
          name: "TransformGame2",
          gameSource: "game1",
          moveTransitionFilterName: "transform",
          filters: ["spin", "invert", "delay"],
          sources: ["spotlight", "dvd"]
        }
      ]
    }
  ],
  listeners: [
    {
      name: "DonationFaker",
      listener: "socketio",
      controller: "obs",
      address: process.env.DN_ADDRESS,
      options: {
        extraHeaders: {
          "Authorization": `Bearer ${process.env.DN_ACCESS_TOKEN}`
        },
        auth: {
          "token": `Bearer ${process.env.DN_ACCESS_TOKEN}`
        }
      },
      rules: [
        {
          on: "donation:show",
          function: ((event) => {
            console.log('Donation Received', event)
            const uid = event.donationid || event.data?.donationid
            const amount = parseFloat(event.amount || event.data?.amount)
            let magnitude = amount / 100

            if (magnitude > 1) {
              magnitude = 1
            }

            if (parseInt(amount * 100) % 2 == 0)
              return { uid: uid, action: "shrink", magnitude }
            else
              return { uid: uid, action: "grow", magnitude }
          })
        }
      ]
    }
  ]


}
