const channelSuccess = []
const channelFail = []

const objectValues = (obj) => {
  return Reflect.ownKeys(obj).map(key => obj[key])
}

const init = (commands) => {
  for (var c of objectValues(commands)) {
    c.callback = wrapper({ callback: c.callback, success: c.success, fail: c.fail })
    delete c.success
    delete c.fail
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