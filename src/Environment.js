const channel = []

const init = (commands) => {
  for (var name in commands) {
    commands[name] = wrapper(commands[name])
  }
  return { commands, channel }
}

const wrapper = (callback) => (...args) => {
  channel.push(callback(...args))
}

module.exports = { init }