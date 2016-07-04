/*global Horizon*/
const horizon = Horizon()
const annyang = require('annyang')
const env = require('./annyangEnv')
const channel = []

horizon.connect()
annyang.debug()

/////////////////////

// Setup horizon status indicator
{
  const $header = document.getElementById('header')
  horizon.status(status => {
    $header.className = `status-${status.type}`
  })
}

/////////////////////

// Setup annyang callbacks and dom events
{
  const $activateBtn = document.getElementById('activate-btn')
  const $showCommandsBtn = document.getElementById('show-commands-btn')
  
  const myCallbacks = env.callbacks({ $activateBtn })(channel)
  const myDomEvents = env.dom_events({ $activateBtn, $showCommandsBtn })(annyang)
  
  for (var cb in myCallbacks) {
    annyang.addCallback(cb, myCallbacks[cb])
  }
  for (var type in myDomEvents) {
    myDomEvents[type].forEach(event => {
      event.element.addEventListener(type, event.callback)
    })
  }
}

/////////////////// 

// Setup annyang commands
{
  const myCommands = env.commands(horizon)(channel)
  annyang.addCommands(myCommands)
}

/////////////////// 

// Setup state machine
{
  const StateChange = require('./StateChange')
  const StateMachine = require('./StateMachine')
  const StateCreator = require('./StateCreator')
  const $contentSpace = document.getElementById('content')
  const myStateMachine = StateMachine.init($contentSpace)(StateCreator)({ logs: [] })
  const myStateChange = StateChange(myStateMachine)(channel)
  
  window.requestAnimationFrame(myStateChange)
}

/////////////////// 