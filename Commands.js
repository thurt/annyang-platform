
const commands = (data) => {
  const _commands = {
    'show commands': {
      callback() {
        return true
      },
      success() {
        data.clogs.push(Reflect.ownKeys(_commands).join(', ') + '\n')
        return { clogs: data.clogs}
      }
    },
    'increase :letter': {
      callback(letter) {
        letter = letter.toLowerCase()
        
        return (data.letters[letter] !== undefined)
          ? (data.letters[letter]++, true)
          : false
      },
      success(letter) {
        data.clogs.push(`increased letter ${letter} ${JSON.stringify(data.letters)}`)
        return { clogs: data.clogs }
      },
      fail(letter) {
        return { errMsg: `cannot increase letter ${letter} -- it does not exist` }
      }
    },
    'client :first :last': {
      callback(first, last) {
        const name = `${first} ${last}`
        
        return (data.clients[name] !== undefined) 
          ? true
          : false
      },
      success(first, last) {
        data.clogs.push(`found client ${first} ${last}`)
        return { clogs: data.clogs }
      },
      fail(first, last) {
        return { errMsg: `client ${first} ${last} not found` }
      }
    }
  }
  return _commands
}

module.exports = commands