const h = require('snabbdom/h')

const StateCreator = ({
  vlogs,
  clogs
}) => {
  return h('div#content', [
      h('div#vlog', [vlogs.join('\n')]),
      h('div#clog', [clogs.join('\n')])
    ])
}


module.exports = StateCreator