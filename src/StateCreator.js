const h = require('snabbdom/h')
var _logs = []
var _key = 0

const createLog = (log, i) => {
  var style
  
  if (i === 0) {
    style = {
      opacity: '0', 
      transition: 'opacity 1s', 
      delayed: { opacity: '1'}
    }
  } else {
    style = {}
  }

  return h('span', { style, key: _key++ }, log)
}
    
const StateCreator = ({
  logs
}) => {
  if (Array.isArray(logs)) {
    _logs = logs.concat(_logs)
  } else {
    _logs = [logs].concat(_logs)
  }
  
  while (_logs.length > 30) {
    _logs.shift()
  }
  
  return h('div#content', [
    _logs.length ? h('div#log', _logs.map(createLog)) : ''
  ])
}


module.exports = StateCreator