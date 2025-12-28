Thinking about implementing a queue with timers for controllers.

So for example the controller for OBS when given a send action would push it to a queue.

Then we would have a setInterval running on the obsController that would check every X milliseconds and if something is in the queue it would execute it. Then things like obsController could also set up a config option for cooldown time that would be the setInterval interval - it would need to at minimum be the duration of the MoveTransition filter duration to ensure animations always occur appropriately.

Could also look at implementing ComfyJS for a Twitch chat listener as well.

Need to talk to Crafty about setting up a Controller for Ship.
