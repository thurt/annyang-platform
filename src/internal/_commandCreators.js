const h = require('snabbdom/h')
const keyboardCommandEntry = require('./keyboardCommandEntry')

const showCommands = (names) => {
  return [names.map(name => {
    return h('button', { on: { click: [keyboardCommandEntry, name] } }, name)
  })]
}

module.exports = { showCommands }



