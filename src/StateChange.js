const { Either } = require('fp-lib')

const StateChange = (channel) => (State) => (_) => {
  const either_state = channel.shift()
  
  if (either_state !== undefined) { 
    // pass internal either value to State.change
    Either.bimap
      (msgs => { // currently, it is same behavior for error state
        State.change({ logs: msgs }) 
      })
      (msgs => { 
        State.change({ logs: msgs }) 
      })
      (either_state) 
  }
    
  window.requestAnimationFrame(StateChange(channel)(State))
}

module.exports = StateChange