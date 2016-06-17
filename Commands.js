const { pipe, Either } = require('fp-lib')

const commands = (data) => {
  const _commands = {
    'client :first :last': pipe(
      (first, last) => {
        const name = `${first} ${last}`
        
        if (data.clients[name] !== undefined) {
          return Either.Right(`found client ${name}`)
        } else {
          return Either.Left(`client ${name} not found`)
        }
      }, 
      Either.bimap
        (errMsg => { return { errMsg } })
        (successMsg => { 
          const clogs = data.clogs.slice()
          clogs.push(successMsg)
          return { clogs }
        })
    ),
    'increase :letter': pipe(
      (letter) => {
        letter = letter.toLowerCase()
        if (data.letters[letter] !== undefined) {
          data.letters[letter]++
          return Either.Right(`increased letter ${letter} ${JSON.stringify(data.letters)}`)
        } else {
          return Either.Left(`cannot increase letter ${letter} -- it does not exist`)
        }
      },
      Either.bimap
        (errMsg => { return { errMsg } })
        (successMsg => {
          const clogs = data.clogs.slice()
          clogs.push(successMsg)
          return { clogs }
        })
    ),
    'show commands': () => {
      var clogs = data.clogs.slice()
      clogs.push(Reflect.ownKeys(_commands).join(', ') + '\n')
      return Either.Right({ clogs })
    }
  }
  return _commands
}

module.exports = commands