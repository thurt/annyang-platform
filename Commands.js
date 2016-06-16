
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
      regexp: /^increase (\w)$/,
      callback(letter) {
        letter = letter.toLowerCase()
        
        if (data.letters[letter] !== undefined)  {
          data.letters[letter]++
          return true
        } else {
          return `cannot increase letter ${letter} -- it doesn't exist`
        }
      },
      success(letter) {
        data.clogs.push(`increased letter ${letter} ${JSON.stringify(data.letters)}`)
        return { clogs: data.clogs }
      }
    },
    'client :first :last': {
      callback(first, last) {
        const name = `${first} ${last}`
        
        if (data.clients[name] !== undefined) {
          return true
        }
        else {
          return `client ${name} not found`
        }
      },
      success(first, last) {
        data.clogs.push(`found client ${first} ${last}`)
        return { clogs: data.clogs }
      }
    }
  }
  return _commands
}

module.exports = commands