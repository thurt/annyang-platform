const { Either } = require('fp-lib')

const StateChange = (channel) => (State) => (_) => {
  const either_state = channel.shift()
  
  if (either_state !== undefined) { 
    // pass internal either value to State.change
    Either.bimap
      (err_state => { // same behavior for error state
        State.change(err_state) 
      })
      (state => { 
        State.change(state) 
      })
      (either_state) 
  }
    
  window.requestAnimationFrame(StateChange(channel)(State))
}

module.exports = StateChange