/*global Horizon*/
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
const { Either } = require('fp-lib')
const StateCreator = require('./StateCreator')

const horizon = Horizon()
horizon.status(status => {
  document.getElementById('header').className = `status-${status.type}`
  if (status === 'disconnected') {
    
  }
})
horizon.connect()

annyang.debug()
/////////////////////
const myEnv = Environment.init(commands(data))
global.myEnv = myEnv
global.horizon = horizon
global.annyang = annyang

const $activateBtn = document.getElementById('activate-btn')
const $showCommandsBtn = document.getElementById('show-commands-btn')
const dom_events = {
  'click': [{
    element: $activateBtn,
    callback: function(_) {
      annyang.start({ autoRestart: false, continuous: false })
    }
  }, {
    element: $showCommandsBtn,
    callback: function(_) {
      annyang.trigger('show commands')
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
 'resultNoMatch': (result) => {
   console.log(result)
   myEnv.channel.push(Either.Left({ errMsg: `No match for ${result}` }))
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



const State = StateMachine.init(document.getElementById('content'))(StateCreator)({
  errMsg: 'Poo',
  clogs: data.clogs
})

const StateChange = (_) => {
  const either_state = myEnv.channel.shift()
  
  if (either_state !== undefined) { 
    // pass internal either value to State.change
    Either.bimap
      (err_state => { // same behavior for error state
        State.change(err_state, { replace: false }) 
      })
      (state => { 
        State.change(state, { replace: false }) 
      })
      (either_state) 
  }
    
  window.requestAnimationFrame(StateChange)
}


annyang.addCommands(myEnv.commands)

window.requestAnimationFrame(StateChange)
