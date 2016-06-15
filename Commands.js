const commands = (data) => {
  'increase :letter': {
    regexp: /^increase (\w)$/,
    // this is the data manipulation
    callback: (letter) => {
      letter = letter.toLowerCase()
      if (data.letters[letter] !== undefined)  {
        data.letters[letter]++
        return true
      } else {
        return `cannot increase letter ${letter} -- it doesn't exist`
      }
    },
    // these are the new DOM states
    success: function(letter) {
      data.clogs.push(`increased letter ${letter} ${JSON.stringify(data.letters)}`)
      return { clogs: data.clogs }
    }
  },
  'client :first :last': {
    callback: (first, last) => {
      const name = `${first} ${last}`
      if (data.clients[name] !== undefined) {
        span.textContent = `found ${name}\n`
      }
      else {
        span.textContent = `no ${name}\n`
      }
      $clog.appendChild(span)
    }
  },
  'show commands': {
    callback: () => {
      const span = document.createElement('span')
      span.textContent += Reflect.ownKeys(commands).join(', ') + '\n'
      $clog.appendChild(span)
    },
    success: function() {},
    fail: function() {}
  }
}
    `increased ${letter} to ${data.letters[letter]}. ${JSON.stringify(data.letters)} \n`
    module.exports = commands