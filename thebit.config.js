export default {
  controllers: {
    OBS: {
      scenes: [
        {
          name: "TransformGame1",
          gameSource: "game1",
          moveTransitionFilterName: "transform",
          filters: ["spin", "invert", "delay"],
          sources: ["spotlight", "dvd"]
        }
      ]
    }
  },
  listeners: [
    {
      name: "DonationFaker",
      listener: "ws",
      controller: "obs",
      address: "http://localhost:8080",
      options: {
        extraHeaders: {
          "Authorization": "Bearer abc123"
        },
        auth: {
          "token": "Bearer abc123"
        }
      },
      rules: [
        {
          on: "donation:show",
          function: ((args) => {
            console.log("Donation received:", args);

            return {
              uid: args?.donationid,
              action: "shrink",
              path: "TransformGame1",
              magnitude: 0.02
            }
          })
        }
      ]
    }
  ]


}
