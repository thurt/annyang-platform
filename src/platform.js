/*global Horizon*/
const horizon = Horizon()
const annyang = require('annyang')
const channel = []

horizon.connect()
annyang.debug()
global.annyang = annyang
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
  
  const myCallbacks = require('./Callbacks')({ $activateBtn })(channel)
  const myDomEvents = require('./DomEvents')({ $activateBtn, $showCommandsBtn })(annyang)
  
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

// Setup annyang command entry and manual command entry
{
  const fuzzyset = require('fuzzyset.js')
  const myDatabaseActions = require('./DatabaseActions')(horizon)(fuzzyset)(channel)
  const myManualCommandEntry = require('./ManualCommandEntry')(annyang)(channel)
  const myCommands = require('./Commands')(horizon)(myDatabaseActions)(myManualCommandEntry)(channel)
  annyang.addCommands(myCommands)
  global.myCommands = myCommands
}

/////////////////// 

// Setup state machine
{
const StateSystem = require('./StateSystem')
const myStateChange = StateSystem(channel)

window.requestAnimationFrame(myStateChange)
}

/////////////////// 