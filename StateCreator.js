const h = require('snabbdom/h')

const StateCreator = ({
  vlogs,
  clogs
}) => {
  return h('div#content', [
      h('div#vlog', vlogs),
      h('div#clog', clogs)
    ])
  ])
}


module.exports = StateCreator