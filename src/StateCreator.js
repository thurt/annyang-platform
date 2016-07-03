const h = require('snabbdom/h')

const StateCreator = ({
  errMsg,
  clogs
}) => {
  while (clogs.length > 30) {
    clogs.shift()
  }
  return h('div#content', [
      h('div#err', [errMsg||'']),
      h('div#clog', clogs ? clogs.map(log => h('span', [log])) : '')
    ])
}


module.exports = StateCreator