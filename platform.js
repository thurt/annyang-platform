const annyang = require('annyang')
const StateMachine = require('./StateMachine')
const Environment = require('./Environment')

/////////////////////
const $activateBtn = document.getElementById('activate')
const dom_events = {
  'click': [{
    element: $activateBtn,
    callback: function(_) {
      annyang.start({ autoRestart: false, continuous: true })
    }
  }]
}
const annyang_callbacks = {
 'start': () => {
   $activateBtn.disabled = true
   $activateBtn.textContent = 'Listening'
 },
 'result': (result) => {
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
  type.forEach(event => {
    event.element.addEventListener(type, event.callback)
  })
}

///////////////////


const myEnv = Environment({
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
   }
})

const mySM = StateMachine.init(document.getElementById('content'))(myEnv.stateCreator)({
  vlogs: '',
  clogs: ''
})

annyang.addCommands(myEnv.commands)


// these are related to visual/DOM manipulation
const StateMachine = [
  ['increase :letter', State.change()],
  ['client :first :last', State.change()],
  ['show commands', State.change()]
]