const channelSuccess = []
const channelFail = []

const init = (commands) => {
  for (var cmd in commands) {
    cmd.callback = wrapper({ callback: cmd.callback, success: cmd.success, fail: cmd.fail })
    delete cmd.success
    delete cmd.fail
  }
  
 return {
   commands, channelSuccess, channelFail
 }
}

const wrapper = ({ callback, success, fail }) => (...args) => {
  const outcome = callback(...args)
  
  outcome === true
    ? channelSuccess.push(success(...args))
    : channelFail.push(outcome)
}

module.exports = init