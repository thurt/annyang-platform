const h = require('snabbdom/h')
var _logs = []
var _key = 0

const myStyles = {
  fadeIn: {
    opacity: '0', 
    transition: 'opacity 1s', 
    delayed: { opacity: '1'}
  }
}

const createLog = (log) => {
  const date = new Date()
  const log_date =  `${date.getMonth()}-${date.getDate()} @ ${date.getHours()}:${date.getMinutes()}`

  return h('div.log', {
    style: myStyles.fadeIn,
    key: _key++
  }, [
    h('span.log_date', log_date), 
    h('span.log_msg', log)
  ])
}

const StateCreator = ({
  logs
}) => {
  if (!Array.isArray(logs)) {
    logs = [logs]
  }
  _logs = logs.map(createLog).concat(_logs)
  
  while (_logs.length > 30) {
    _logs.shift()
  }
  
  return h('div#content', [
    h('div#logs', _logs)
  ])
}


module.exports = StateCreator