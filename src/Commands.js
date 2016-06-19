const { pipe, Either } = require('fp-lib')
const fuzzyset = require('fuzzyset.js')

const commands = (data) => {
  const fuzzy_clients = fuzzyset(Object.keys(data.clients))
  
  const _commands = {
    'client *name': pipe(
      (name) => {
        const res = fuzzy_clients.get(name)
        console.log(name,res)
        if (res !== null) {
          return Either.Right(`fuzzy client found ${res}`)
        } else {
          return Either.Left(`client ${name} not found by fuzzy`)
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
    },
    'clear screen': () => {
      return Either.Right({ clogs: [] })
    }
  }
  return _commands
}

module.exports = commands