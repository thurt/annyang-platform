const callbacks = ({ $activateBtn }) => (channel) => {
  const { Either } = require('fp-lib')
  
  return {
    'start': () => {
      //
    },
    'result': (result) => {
      //console.log(result)
    },
    'resultMatch': (result) => {
      //console.log(result)
    },
    'resultNoMatch': (result) => {
      channel.push(Either.Left(`No command matches for ${result[0]}`))
    },
    'end': () => {
      $activateBtn.textContent = 'Start'
    }
  }
}

module.exports = callbacks