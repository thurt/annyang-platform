const h = require('snabbdom/h')

const FailStateCreator = ({
  errMsg
}) => {
  return h('div#err', [errMsg])
}

module.exports = FailStateCreator