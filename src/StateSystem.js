
const StateSystem = (channel) => {
  const StateChange = require('./StateChange')
  const StateMachine = require('./StateMachine')
  const StateCreator = require('./StateCreator')
  const $contentSpace = document.getElementById('content')
  const myStateMachine = StateMachine.init($contentSpace)(StateCreator)({ logs: [] })
  const myStateChange = StateChange(myStateMachine)(channel)
  
  return myStateChange  
}

module.exports = StateSystem