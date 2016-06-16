const h = require('snabbdom/h')

const StateCreator = ({
  clogs
}) => {
  while (clogs.length > 30) {
    clogs.shift()
  }
  return h('div#content', [
      h('div#clog', clogs.map(log => h('span', [log])))
    ])
}


module.exports = StateCreator