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
   }
}
const commands = require('./Commands')(data)

const StateCreator = require('./StateCreator')
const FailStateCreator = require('./FailStateCreator')

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

const myEnv = Environment(commands)

const State = StateMachine.init(document.getElementById('content'))(StateCreator)({
  vlogs: JSON.stringify(data.vlogs),
  clogs: JSON.stringify(data.clogs)
})

const ErrState = StateMachine.init(document.getElementById('err'))(FailStateCreator)({})

annyang.addCommands(myEnv.commands)

myEnv.subscribeSuccess(State.change)
myEnv.subscribeFail(ErrState.change)

const Generator = {
  //:: (a -> b) -> (Generator ([a] -> b))
  /* returns a generator which will apply
     action to ea value sequentially in xs
   */
  seq(action) {
    return function* applyAction(xs) {
      for (var x of xs) {
        yield action(x)
      }
    }
  },
  //:: Generator -> _
  /* automatically steps generator every ~x ms
     until the generator is exhausted
   */
  auto: (ms) => (gen) => {
    if (!gen.next().done) {
      setTimeout(() => Generator.auto(ms)(gen), ms)
    }
  }
}
