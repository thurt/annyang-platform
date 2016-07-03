/*global Horizon*/
const env = require('./annyangEnv')

const StateMachine = require('./StateMachine')
const StateChange = require('./StateChange')
const StateCreator = require('./StateCreator')

const horizon = Horizon()
horizon.status(status => {
  document.getElementById('header').className = `status-${status.type}`
})
horizon.connect()


/////////////////////

const myCommands = env.commands({})(horizon)(env.channel)
global.myCommands = myCommands
global.horizon = horizon
global.annyang = env.annyang

for (var cb in env.callbacks) {
  env.annyang.addCallback(cb, env.callbacks[cb])
}
for (var type in env.dom_events) {
  env.dom_events[type].forEach(event => {
    event.element.addEventListener(type, event.callback)
  })
}

/////////////////// 

const myState = StateMachine.init(document.getElementById('content'))(StateCreator)({})

const myStateChange = StateChange(env.channel)(myState)

env.annyang.addCommands(myCommands)
env.annyang.debug()
window.requestAnimationFrame(myStateChange)
