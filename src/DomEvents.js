const dom_events = ({ $activateBtn, $showCommandsBtn }) => (annyang) => {
  return {
    'click': [{
      element: $activateBtn,
      callback: function(_) {
        if (annyang.isListening()) {
          annyang.abort()
          $activateBtn.textContent = 'Start'
        } else {
          annyang.start({ autoRestart: false, continuous: true })
          $activateBtn.textContent = 'Stop'
        }
      }
    }, {
      element: $showCommandsBtn,
      callback: function(_) {
        annyang.trigger('show commands')
      }
    }]
  }
}

module.exports = dom_events