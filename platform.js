const annyang = require('annyang')
const StateMachine = require('./StateMachine')
const Environment = require('./Environment')
const data = {
  letters: {
     a: 0,
     b: 0,
     c: 0
   },
  clients: {
     'Bob Jones': {},
     'Greg Harmon': {},
     'Leann Lewis': {},
     'Harmony Chostwitz': {}
   },
   vlogs: [],
   clogs: []
}
const commands = require('./Commands')

const StateCreator = require('./StateCreator')
const FailStateCreator = require('./FailStateCreator')

/////////////////////
const $activateBtn = document.getElementById('activate-btn')
const $showCommandsBtn = document.getElementById('show-commands-btn')
const dom_events = {
  'click': [{
    element: $activateBtn,
    callback: function(_) {
      annyang.start({ autoRestart: false, continuous: true })
    }
  }, {
    element: $showCommandsBtn,
    callback: function(_) {
      annyang.trigger('increase a')
    }
  }]
}
const annyang_callbacks = {
 'start': () => {
   $activateBtn.disabled = true
   $activateBtn.textContent = 'Listening'
 },
 'result': (result) => {
   //console.log(result)
 },
 'resultMatch': (result) => {
   //console.log(result)
 },
 'end': () => {
   $activateBtn.disabled = false
   $activateBtn.textContent = 'Start'
 }
}

for (var cb in annyang_callbacks) {
  annyang.addCallback(cb, annyang_callbacks[cb])
}
for (var type in dom_events) {
  dom_events[type].forEach(event => {
    event.element.addEventListener(type, event.callback)
  })
}

/////////////////// 

const myEnv = Environment(commands(data))
global.myEnv = myEnv
const State = StateMachine.init(document.getElementById('content'))(StateCreator)({
  vlogs: data.vlogs,
  clogs: data.clogs
})

const ErrState = StateMachine.init(document.getElementById('err'))(FailStateCreator)({
  errMsg: 'Poo'
})

const StateChange = (_) => {
  var new_state = myEnv.channelFail.shift()
  
  if (new_state === undefined) {
    
    new_state = myEnv.channelSuccess.shift()
    if (new_state !== undefined) { 
      State.change(new_state, { replace: false }) 
    }
    
  } else {
    ErrState.change(new_state, { replace: false })
  }
  
  window.requestAnimationFrame(StateChange)
}


annyang.addCommands(myEnv.commands)

window.requestAnimationFrame(StateChange)
