const channelSuccess = []
const channelFail = []

const objectValues = (obj) => {
  return Reflect.ownKeys(obj).map(key => obj[key])
}

const init = (commands) => {
  for (var c in commands) {
    var cObj = commands[c]
    var wrapped = wrapper({ callback: cObj.callback, success: cObj.success, fail: cObj.fail }) 
    
    if (cObj.regexp === undefined) {
      commands[c] = wrapped 
    } else {
      cObj.callback = wrapped
      delete cObj.success
      delete cObj.fail
    }
  }
  
 return {
   commands, channelSuccess, channelFail
 }
}

const wrapper = ({ callback, success, fail }) => (...args) => {
  const outcome = callback(...args)
  
  outcome === true
    ? channelSuccess.push(success(...args))
    : channelFail.push(fail(...args))
}

module.exports = init