/*global Horizon*/
const annyang = require('annyang')
const env = require('./annyangEnv')
const channel = []

const StateChange = require('./StateChange')
const StateMachine = require('./StateMachine')
const StateCreator = require('./StateCreator')

const horizon = Horizon()
horizon.status(status => {
  document.getElementById('header').className = `status-${status.type}`
})
horizon.connect()

/////////////////////

global.horizon = horizon
global.annyang =annyang

for (var cb in env.callbacks) {
  annyang.addCallback(cb, env.callbacks[cb])
}
for (var type in env.dom_events) {
  env.dom_events[type].forEach(event => {
    event.element.addEventListener(type, event.callback)
  })
}

/////////////////// 

annyang.debug()

annyang.addCommands(
  env.commands({})
    (horizon)
    (channel)
)

window.requestAnimationFrame(
  StateChange
    (channel)
    (StateMachine.init(document.getElementById('content'))(StateCreator)({ logs: [] }))
)

/////////////////// 

module.exports = channel
