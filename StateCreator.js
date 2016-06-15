const h = require('snabbdom/h')

const StateCreator = ({
  activateText,
  activateClickEvent,
  vlogs,
  clogs
}) => {
  return h('div', [
    h('button#activate', {
      on: { click: activateClickEvent }
    }, [activateText]),
    h('div#content', [
      h('div#vlog', vlogs),
      h('div#clog', clogs)
    ])
  ])
}


module.exports = StateCreator