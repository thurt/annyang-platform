(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

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
},{}],2:[function(require,module,exports){
const channelSuccess = []
const channelFail = []

const objectValues = (obj) => {
  return Reflect.ownKeys(obj).map(key => obj[key])
}

const init = (commands) => {
  for (var c of objectValues(commands)) {
    c.callback = wrapper({ callback: c.callback, success: c.success, fail: c.fail })
    delete c.success
    delete c.fail
  }
  
 return {
   commands, channelSuccess, channelFail
 }
}

const wrapper = ({ callback, success, fail }) => (...args) => {
  const outcome = callback(...args)
  
  outcome === true
    ? channelSuccess.push(success(...args))
    : channelFail.push(outcome)
}

module.exports = init
},{}],3:[function(require,module,exports){
const h = require('snabbdom/h')

const FailStateCreator = ({
  errMsg
}) => {
  return h('div#err', [errMsg])
}

module.exports = FailStateCreator
},{"snabbdom/h":7}],4:[function(require,module,exports){
const h = require('snabbdom/h')

const StateCreator = ({
  vlogs,
  clogs
}) => {
  return h('div#content', [
      h('div#vlog', [vlogs.join('\n')]),
      h('div#clog', [clogs.join('\n')])
    ])
}


module.exports = StateCreator
},{"snabbdom/h":7}],5:[function(require,module,exports){
const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with choosen modules
  require('snabbdom/modules/class'), // makes it easy to toggle classes
  require('snabbdom/modules/props'), // for setting properties on DOM elements
  require('snabbdom/modules/style'), // handles styling on elements with support for animations
  require('snabbdom/modules/eventlisteners'), // attaches event listeners
])

const init = (parentNode) => (StateCreator) => (init_params) => {
  var vtree = parentNode
  const states = []
  
  // cursor stores the index of the currently rendered state
  // it moves back and forward for undo/redo operations
  const i = 0
  
  // replace must be true for first state change
  const change = (state, { replace }) => {
    if (!replace) {
      state = Object.assign(Object.assign({}, states[i]), state)
    }

    const new_vtree = StateCreator(state)
    
    // remove all state parameters in front of cursor position
    if (i !== 0) {
      states.splice(0, i)
      i = 0
    }
    states.unshift(state)
    
    patch(vtree, new_vtree)
    vtree = new_vtree
  }
  
  const undo = () => {
    return (i < states.length - 1)
      ? (change(states[++i], { replace: true }), true)
      : false
  }
  
  const redo = () => {
    return (i > 0)
      ? (change(states[--i], { replace: true }), true)
      : false
    }
  
  // replace must be true for first state change
  change(init_params, { replace: true })
  
  return { change, undo, redo }
}

module.exports = { init }
},{"snabbdom":14,"snabbdom/modules/class":10,"snabbdom/modules/eventlisteners":11,"snabbdom/modules/props":12,"snabbdom/modules/style":13}],6:[function(require,module,exports){
//! annyang
//! version : 2.4.0
//! author  : Tal Ater @TalAter
//! license : MIT
//! https://www.TalAter.com/annyang/
(function (root, factory) {
  "use strict";
  if (typeof define === 'function' && define.amd) { // AMD + global
    define([], function () {
      return (root.annyang = factory(root));
    });
  } else if (typeof module === 'object' && module.exports) { // CommonJS
    module.exports = factory(root);
  } else { // Browser globals
    root.annyang = factory(root);
  }
}(typeof window !== 'undefined' ? window : this, function (root, undefined) {
  "use strict";

  /**
   * # Quick Tutorial, Intro and Demos
   *
   * The quickest way to get started is to visit the [annyang homepage](https://www.talater.com/annyang/).
   *
   * For a more in-depth look at annyang, read on.
   *
   * # API Reference
   */

  var annyang;

  // Get the SpeechRecognition object, while handling browser prefixes
  var SpeechRecognition = root.SpeechRecognition ||
                          root.webkitSpeechRecognition ||
                          root.mozSpeechRecognition ||
                          root.msSpeechRecognition ||
                          root.oSpeechRecognition;

  // Check browser support
  // This is done as early as possible, to make it as fast as possible for unsupported browsers
  if (!SpeechRecognition) {
    return null;
  }

  var commandsList = [];
  var recognition;
  var callbacks = { start: [], error: [], end: [], result: [], resultMatch: [], resultNoMatch: [], errorNetwork: [], errorPermissionBlocked: [], errorPermissionDenied: [] };
  var autoRestart;
  var lastStartedAt = 0;
  var debugState = false;
  var debugStyle = 'font-weight: bold; color: #00f;';
  var pauseListening = false;
  var isListening = false;

  // The command matching code is a modified version of Backbone.Router by Jeremy Ashkenas, under the MIT license.
  var optionalParam = /\s*\((.*?)\)\s*/g;
  var optionalRegex = /(\(\?:[^)]+\))\?/g;
  var namedParam    = /(\(\?)?:\w+/g;
  var splatParam    = /\*\w+/g;
  var escapeRegExp  = /[\-{}\[\]+?.,\\\^$|#]/g;
  var commandToRegExp = function(command) {
    command = command.replace(escapeRegExp, '\\$&')
                  .replace(optionalParam, '(?:$1)?')
                  .replace(namedParam, function(match, optional) {
                    return optional ? match : '([^\\s]+)';
                  })
                  .replace(splatParam, '(.*?)')
                  .replace(optionalRegex, '\\s*$1?\\s*');
    return new RegExp('^' + command + '$', 'i');
  };

  // This method receives an array of callbacks to iterate over, and invokes each of them
  var invokeCallbacks = function(callbacks) {
    var args = Array.prototype.slice.call(arguments, 1);
    callbacks.forEach(function(callback) {
      callback.callback.apply(callback.context, args);
    });
  };

  var isInitialized = function() {
    return recognition !== undefined;
  };

  var initIfNeeded = function() {
    if (!isInitialized()) {
      annyang.init({}, false);
    }
  };

  var registerCommand = function(command, cb, phrase) {
    commandsList.push({ command: command, callback: cb, originalPhrase: phrase });
    if (debugState) {
      console.log('Command successfully loaded: %c'+phrase, debugStyle);
    }
  };

  var parseResults = function(results) {
    invokeCallbacks(callbacks.result, results);
    var commandText;
    // go over each of the 5 results and alternative results received (we've set maxAlternatives to 5 above)
    for (var i = 0; i<results.length; i++) {
      // the text recognized
      commandText = results[i].trim();
      if (debugState) {
        console.log('Speech recognized: %c'+commandText, debugStyle);
      }

      // try and match recognized text to one of the commands on the list
      for (var j = 0, l = commandsList.length; j < l; j++) {
        var currentCommand = commandsList[j];
        var result = currentCommand.command.exec(commandText);
        if (result) {
          var parameters = result.slice(1);
          if (debugState) {
            console.log('command matched: %c'+currentCommand.originalPhrase, debugStyle);
            if (parameters.length) {
              console.log('with parameters', parameters);
            }
          }
          // execute the matched command
          currentCommand.callback.apply(this, parameters);
          invokeCallbacks(callbacks.resultMatch, commandText, currentCommand.originalPhrase, results);
          return;
        }
      }
    }
    invokeCallbacks(callbacks.resultNoMatch, results);
  };

  annyang = {

    /**
     * Initialize annyang with a list of commands to recognize.
     *
     * #### Examples:
     * ````javascript
     * var commands = {'hello :name': helloFunction};
     * var commands2 = {'hi': helloFunction};
     *
     * // initialize annyang, overwriting any previously added commands
     * annyang.init(commands, true);
     * // adds an additional command without removing the previous commands
     * annyang.init(commands2, false);
     * ````
     * As of v1.1.0 it is no longer required to call init(). Just start() listening whenever you want, and addCommands() whenever, and as often as you like.
     *
     * @param {Object} commands - Commands that annyang should listen to
     * @param {boolean} [resetCommands=true] - Remove all commands before initializing?
     * @method init
     * @deprecated
     * @see [Commands Object](#commands-object)
     */
    init: function(commands, resetCommands) {

      // resetCommands defaults to true
      if (resetCommands === undefined) {
        resetCommands = true;
      } else {
        resetCommands = !!resetCommands;
      }

      // Abort previous instances of recognition already running
      if (recognition && recognition.abort) {
        recognition.abort();
      }

      // initiate SpeechRecognition
      recognition = new SpeechRecognition();

      // Set the max number of alternative transcripts to try and match with a command
      recognition.maxAlternatives = 5;

      // In HTTPS, turn off continuous mode for faster results.
      // In HTTP,  turn on  continuous mode for much slower results, but no repeating security notices
      recognition.continuous = root.location.protocol === 'http:';

      // Sets the language to the default 'en-US'. This can be changed with annyang.setLanguage()
      recognition.lang = 'en-US';

      recognition.onstart   = function() {
        isListening = true;
        invokeCallbacks(callbacks.start);
      };

      recognition.onerror   = function(event) {
        invokeCallbacks(callbacks.error);
        switch (event.error) {
        case 'network':
          invokeCallbacks(callbacks.errorNetwork);
          break;
        case 'not-allowed':
        case 'service-not-allowed':
          // if permission to use the mic is denied, turn off auto-restart
          autoRestart = false;
          // determine if permission was denied by user or automatically.
          if (new Date().getTime()-lastStartedAt < 200) {
            invokeCallbacks(callbacks.errorPermissionBlocked);
          } else {
            invokeCallbacks(callbacks.errorPermissionDenied);
          }
          break;
        }
      };

      recognition.onend     = function() {
        isListening = false;
        invokeCallbacks(callbacks.end);
        // annyang will auto restart if it is closed automatically and not by user action.
        if (autoRestart) {
          // play nicely with the browser, and never restart annyang automatically more than once per second
          var timeSinceLastStart = new Date().getTime()-lastStartedAt;
          if (timeSinceLastStart < 1000) {
            setTimeout(annyang.start, 1000-timeSinceLastStart);
          } else {
            annyang.start();
          }
        }
      };

      recognition.onresult  = function(event) {
        if(pauseListening) {
          if (debugState) {
            console.log('Speech heard, but annyang is paused');
          }
          return false;
        }

        // Map the results to an array
        var SpeechRecognitionResult = event.results[event.resultIndex];
        var results = [];
        for (var k = 0; k<SpeechRecognitionResult.length; k++) {
          results[k] = SpeechRecognitionResult[k].transcript;
        }

        parseResults(results);
      };

      // build commands list
      if (resetCommands) {
        commandsList = [];
      }
      if (commands.length) {
        this.addCommands(commands);
      }
    },

    /**
     * Start listening.
     * It's a good idea to call this after adding some commands first, but not mandatory.
     *
     * Receives an optional options object which supports the following options:
     *
     * - `autoRestart` (boolean, default: true) Should annyang restart itself if it is closed indirectly, because of silence or window conflicts?
     * - `continuous`  (boolean, default: undefined) Allow forcing continuous mode on or off. Annyang is pretty smart about this, so only set this if you know what you're doing.
     *
     * #### Examples:
     * ````javascript
     * // Start listening, don't restart automatically
     * annyang.start({ autoRestart: false });
     * // Start listening, don't restart automatically, stop recognition after first phrase recognized
     * annyang.start({ autoRestart: false, continuous: false });
     * ````
     * @param {Object} [options] - Optional options.
     * @method start
     */
    start: function(options) {
      pauseListening = false;
      initIfNeeded();
      options = options || {};
      if (options.autoRestart !== undefined) {
        autoRestart = !!options.autoRestart;
      } else {
        autoRestart = true;
      }
      if (options.continuous !== undefined) {
        recognition.continuous = !!options.continuous;
      }

      lastStartedAt = new Date().getTime();
      try {
        recognition.start();
      } catch(e) {
        if (debugState) {
          console.log(e.message);
        }
      }
    },

    /**
     * Stop listening, and turn off mic.
     *
     * Alternatively, to only temporarily pause annyang responding to commands without stopping the SpeechRecognition engine or closing the mic, use pause() instead.
     * @see [pause()](#pause)
     *
     * @method abort
     */
    abort: function() {
      autoRestart = false;
      if (isInitialized()) {
        recognition.abort();
      }
    },

    /**
     * Pause listening. annyang will stop responding to commands (until the resume or start methods are called), without turning off the browser's SpeechRecognition engine or the mic.
     *
     * Alternatively, to stop the SpeechRecognition engine and close the mic, use abort() instead.
     * @see [abort()](#abort)
     *
     * @method pause
     */
    pause: function() {
      pauseListening = true;
    },

    /**
     * Resumes listening and restores command callback execution when a result matches.
     * If SpeechRecognition was aborted (stopped), start it.
     *
     * @method resume
     */
    resume: function() {
      annyang.start();
    },

    /**
     * Turn on output of debug messages to the console. Ugly, but super-handy!
     *
     * @param {boolean} [newState=true] - Turn on/off debug messages
     * @method debug
     */
    debug: function(newState) {
      if (arguments.length > 0) {
        debugState = !!newState;
      } else {
        debugState = true;
      }
    },

    /**
     * Set the language the user will speak in. If this method is not called, defaults to 'en-US'.
     *
     * @param {String} language - The language (locale)
     * @method setLanguage
     * @see [Languages](#languages)
     */
    setLanguage: function(language) {
      initIfNeeded();
      recognition.lang = language;
    },

    /**
     * Add commands that annyang will respond to. Similar in syntax to init(), but doesn't remove existing commands.
     *
     * #### Examples:
     * ````javascript
     * var commands = {'hello :name': helloFunction, 'howdy': helloFunction};
     * var commands2 = {'hi': helloFunction};
     *
     * annyang.addCommands(commands);
     * annyang.addCommands(commands2);
     * // annyang will now listen to all three commands
     * ````
     *
     * @param {Object} commands - Commands that annyang should listen to
     * @method addCommands
     * @see [Commands Object](#commands-object)
     */
    addCommands: function(commands) {
      var cb;

      initIfNeeded();

      for (var phrase in commands) {
        if (commands.hasOwnProperty(phrase)) {
          cb = root[commands[phrase]] || commands[phrase];
          if (typeof cb === 'function') {
            // convert command to regex then register the command
            registerCommand(commandToRegExp(phrase), cb, phrase);
          } else if (typeof cb === 'object' && cb.regexp instanceof RegExp) {
            // register the command
            registerCommand(new RegExp(cb.regexp.source, 'i'), cb.callback, phrase);
          } else {
            if (debugState) {
              console.log('Can not register command: %c'+phrase, debugStyle);
            }
            continue;
          }
        }
      }
    },

    /**
     * Remove existing commands. Called with a single phrase, array of phrases, or methodically. Pass no params to remove all commands.
     *
     * #### Examples:
     * ````javascript
     * var commands = {'hello': helloFunction, 'howdy': helloFunction, 'hi': helloFunction};
     *
     * // Remove all existing commands
     * annyang.removeCommands();
     *
     * // Add some commands
     * annyang.addCommands(commands);
     *
     * // Don't respond to hello
     * annyang.removeCommands('hello');
     *
     * // Don't respond to howdy or hi
     * annyang.removeCommands(['howdy', 'hi']);
     * ````
     * @param {String|Array|Undefined} [commandsToRemove] - Commands to remove
     * @method removeCommands
     */
    removeCommands: function(commandsToRemove) {
      if (commandsToRemove === undefined) {
        commandsList = [];
        return;
      }
      commandsToRemove = Array.isArray(commandsToRemove) ? commandsToRemove : [commandsToRemove];
      commandsList = commandsList.filter(function(command) {
        for (var i = 0; i<commandsToRemove.length; i++) {
          if (commandsToRemove[i] === command.originalPhrase) {
            return false;
          }
        }
        return true;
      });
    },

    /**
     * Add a callback function to be called in case one of the following events happens:
     *
     * * `start` - Fired as soon as the browser's Speech Recognition engine starts listening
     * * `error` - Fired when the browser's Speech Recogntion engine returns an error, this generic error callback will be followed by more accurate error callbacks (both will fire if both are defined)
     * * `errorNetwork` - Fired when Speech Recognition fails because of a network error
     * * `errorPermissionBlocked` - Fired when the browser blocks the permission request to use Speech Recognition.
     * * `errorPermissionDenied` - Fired when the user blocks the permission request to use Speech Recognition.
     * * `end` - Fired when the browser's Speech Recognition engine stops
     * * `result` - Fired as soon as some speech was identified. This generic callback will be followed by either the `resultMatch` or `resultNoMatch` callbacks.
     *     Callback functions registered to this event will include an array of possible phrases the user said as the first argument
     * * `resultMatch` - Fired when annyang was able to match between what the user said and a registered command
     *     Callback functions registered to this event will include three arguments in the following order:
     *       * The phrase the user said that matched a command
     *       * The command that was matched
     *       * An array of possible alternative phrases the user might've said
     * * `resultNoMatch` - Fired when what the user said didn't match any of the registered commands.
     *     Callback functions registered to this event will include an array of possible phrases the user might've said as the first argument
     *
     * #### Examples:
     * ````javascript
     * annyang.addCallback('error', function() {
     *   $('.myErrorText').text('There was an error!');
     * });
     *
     * annyang.addCallback('resultMatch', function(userSaid, commandText, phrases) {
     *   console.log(userSaid); // sample output: 'hello'
     *   console.log(commandText); // sample output: 'hello (there)'
     *   console.log(phrases); // sample output: ['hello', 'halo', 'yellow', 'polo', 'hello kitty']
     * });
     *
     * // pass local context to a global function called notConnected
     * annyang.addCallback('errorNetwork', notConnected, this);
     * ````
     * @param {String} type - Name of event that will trigger this callback
     * @param {Function} callback - The function to call when event is triggered
     * @param {Object} [context] - Optional context for the callback function
     * @method addCallback
     */
    addCallback: function(type, callback, context) {
      if (callbacks[type]  === undefined) {
        return;
      }
      var cb = root[callback] || callback;
      if (typeof cb !== 'function') {
        return;
      }
      callbacks[type].push({callback: cb, context: context || this});
    },

    /**
     * Remove callbacks from events.
     *
     * - Pass an event name and a callback command to remove that callback command from that event type.
     * - Pass just an event name to remove all callback commands from that event type.
     * - Pass undefined as event name and a callback command to remove that callback command from all event types.
     * - Pass no params to remove all callback commands from all event types.
     *
     * #### Examples:
     * ````javascript
     * annyang.addCallback('start', myFunction1);
     * annyang.addCallback('start', myFunction2);
     * annyang.addCallback('end', myFunction1);
     * annyang.addCallback('end', myFunction2);
     *
     * // Remove all callbacks from all events:
     * annyang.removeCallback();
     *
     * // Remove all callbacks attached to end event:
     * annyang.removeCallback('end');
     *
     * // Remove myFunction2 from being called on start:
     * annyang.removeCallback('start', myFunction2);
     *
     * // Remove myFunction1 from being called on all events:
     * annyang.removeCallback(undefined, myFunction1);
     * ````
     *
     * @param type Name of event type to remove callback from
     * @param callback The callback function to remove
     * @returns undefined
     * @method removeCallback
     */
    removeCallback: function(type, callback) {
      var compareWithCallbackParameter = function(cb) {
        return cb.callback !== callback;
      };
      // Go over each callback type in callbacks store object
      for (var callbackType in callbacks) {
        if (callbacks.hasOwnProperty(callbackType)) {
          // if this is the type user asked to delete, or he asked to delete all, go ahead.
          if (type === undefined || type === callbackType) {
            // If user asked to delete all callbacks in this type or all types
            if (callback === undefined) {
                callbacks[callbackType] = [];
              } else {
                // Remove all matching callbacks
                callbacks[callbackType] = callbacks[callbackType].filter(compareWithCallbackParameter);
            }
          }
        }
      }
    },

    /**
     * Returns true if speech recognition is currently on.
     * Returns false if speech recognition is off or annyang is paused.
     *
     * @return boolean true = SpeechRecognition is on and annyang is listening
     * @method isListening
     */
    isListening: function() {
      return isListening && !pauseListening;
    },

    /**
     * Returns the instance of the browser's SpeechRecognition object used by annyang.
     * Useful in case you want direct access to the browser's Speech Recognition engine.
     *
     * @returns SpeechRecognition The browser's Speech Recognizer currently used by annyang
     * @method getSpeechRecognizer
     */
    getSpeechRecognizer: function() {
      return recognition;
    },

    /**
     * Simulate speech being recognized. This will trigger the same events and behavior as when the Speech Recognition
     * detects speech.
     *
     * Can accept either a string containing a single sentence, or an array containing multiple sentences to be checked
     * in order until one of them matches a command (similar to the way Speech Recognition Alternatives are parsed)
     *
     * #### Examples:
     * ````javascript
     * annyang.trigger('Time for some thrilling heroics');
     * annyang.trigger(
     *     ['Time for some thrilling heroics', 'Time for some thrilling aerobics']
     *   );
     * ````
     *
     * @param string|array sentences A sentence as a string or an array of strings of possible sentences
     * @returns undefined
     * @method trigger
     */
    trigger: function(sentences) {
      /*
      if(!annyang.isListening()) {
        if (debugState) {
          if (!isListening) {
            console.log('Cannot trigger while annyang is aborted');
          } else {
            console.log('Speech heard, but annyang is paused');
          }
        }
        return;
      }
      */

      if (!Array.isArray(sentences)) {
        sentences = [sentences];
      }

      parseResults(sentences);
    }
  };

  return annyang;

}));

/**
 * # Good to Know
 *
 * ## Commands Object
 *
 * Both the [init()]() and addCommands() methods receive a `commands` object.
 *
 * annyang understands commands with `named variables`, `splats`, and `optional words`.
 *
 * * Use `named variables` for one word arguments in your command.
 * * Use `splats` to capture multi-word text at the end of your command (greedy).
 * * Use `optional words` or phrases to define a part of the command as optional.
 *
 * #### Examples:
 * ````html
 * <script>
 * var commands = {
 *   // annyang will capture anything after a splat (*) and pass it to the function.
 *   // e.g. saying "Show me Batman and Robin" will call showFlickr('Batman and Robin');
 *   'show me *tag': showFlickr,
 *
 *   // A named variable is a one word variable, that can fit anywhere in your command.
 *   // e.g. saying "calculate October stats" will call calculateStats('October');
 *   'calculate :month stats': calculateStats,
 *
 *   // By defining a part of the following command as optional, annyang will respond
 *   // to both: "say hello to my little friend" as well as "say hello friend"
 *   'say hello (to my little) friend': greeting
 * };
 *
 * var showFlickr = function(tag) {
 *   var url = 'http://api.flickr.com/services/rest/?tags='+tag;
 *   $.getJSON(url);
 * }
 *
 * var calculateStats = function(month) {
 *   $('#stats').text('Statistics for '+month);
 * }
 *
 * var greeting = function() {
 *   $('#greeting').text('Hello!');
 * }
 * </script>
 * ````
 *
 * ### Using Regular Expressions in commands
 * For advanced commands, you can pass a regular expression object, instead of
 * a simple string command.
 *
 * This is done by passing an object containing two properties: `regexp`, and
 * `callback` instead of the function.
 *
 * #### Examples:
 * ````javascript
 * var calculateFunction = function(month) { console.log(month); }
 * var commands = {
 *   // This example will accept any word as the "month"
 *   'calculate :month stats': calculateFunction,
 *   // This example will only accept months which are at the start of a quarter
 *   'calculate :quarter stats': {'regexp': /^calculate (January|April|July|October) stats$/, 'callback': calculateFunction}
 * }
 ````
 *
 * ## Languages
 *
 * While there isn't an official list of supported languages (cultures? locales?), here is a list based on [anecdotal evidence](http://stackoverflow.com/a/14302134/338039).
 *
 * * Afrikaans `af`
 * * Basque `eu`
 * * Bulgarian `bg`
 * * Catalan `ca`
 * * Arabic (Egypt) `ar-EG`
 * * Arabic (Jordan) `ar-JO`
 * * Arabic (Kuwait) `ar-KW`
 * * Arabic (Lebanon) `ar-LB`
 * * Arabic (Qatar) `ar-QA`
 * * Arabic (UAE) `ar-AE`
 * * Arabic (Morocco) `ar-MA`
 * * Arabic (Iraq) `ar-IQ`
 * * Arabic (Algeria) `ar-DZ`
 * * Arabic (Bahrain) `ar-BH`
 * * Arabic (Lybia) `ar-LY`
 * * Arabic (Oman) `ar-OM`
 * * Arabic (Saudi Arabia) `ar-SA`
 * * Arabic (Tunisia) `ar-TN`
 * * Arabic (Yemen) `ar-YE`
 * * Czech `cs`
 * * Dutch `nl-NL`
 * * English (Australia) `en-AU`
 * * English (Canada) `en-CA`
 * * English (India) `en-IN`
 * * English (New Zealand) `en-NZ`
 * * English (South Africa) `en-ZA`
 * * English(UK) `en-GB`
 * * English(US) `en-US`
 * * Finnish `fi`
 * * French `fr-FR`
 * * Galician `gl`
 * * German `de-DE`
 * * Hebrew `he`
 * * Hungarian `hu`
 * * Icelandic `is`
 * * Italian `it-IT`
 * * Indonesian `id`
 * * Japanese `ja`
 * * Korean `ko`
 * * Latin `la`
 * * Mandarin Chinese `zh-CN`
 * * Traditional Taiwan `zh-TW`
 * * Simplified China zh-CN `?`
 * * Simplified Hong Kong `zh-HK`
 * * Yue Chinese (Traditional Hong Kong) `zh-yue`
 * * Malaysian `ms-MY`
 * * Norwegian `no-NO`
 * * Polish `pl`
 * * Pig Latin `xx-piglatin`
 * * Portuguese `pt-PT`
 * * Portuguese (Brasil) `pt-BR`
 * * Romanian `ro-RO`
 * * Russian `ru`
 * * Serbian `sr-SP`
 * * Slovak `sk`
 * * Spanish (Argentina) `es-AR`
 * * Spanish (Bolivia) `es-BO`
 * * Spanish (Chile) `es-CL`
 * * Spanish (Colombia) `es-CO`
 * * Spanish (Costa Rica) `es-CR`
 * * Spanish (Dominican Republic) `es-DO`
 * * Spanish (Ecuador) `es-EC`
 * * Spanish (El Salvador) `es-SV`
 * * Spanish (Guatemala) `es-GT`
 * * Spanish (Honduras) `es-HN`
 * * Spanish (Mexico) `es-MX`
 * * Spanish (Nicaragua) `es-NI`
 * * Spanish (Panama) `es-PA`
 * * Spanish (Paraguay) `es-PY`
 * * Spanish (Peru) `es-PE`
 * * Spanish (Puerto Rico) `es-PR`
 * * Spanish (Spain) `es-ES`
 * * Spanish (US) `es-US`
 * * Spanish (Uruguay) `es-UY`
 * * Spanish (Venezuela) `es-VE`
 * * Swedish `sv-SE`
 * * Turkish `tr`
 * * Zulu `zu`
 *
 * ## Developing
 *
 * Prerequisities: node.js
 *
 * First, install dependencies in your local annyang copy:
 *
 *     npm install
 *
 * Make sure to run the default grunt task after each change to annyang.js. This can also be done automatically by running:
 *
 *     grunt watch
 *
 * You can also run a local server for testing your work with:
 *
 *     grunt dev
 *
 * Point your browser to `https://localhost:8443/demo/` to see the demo page.
 * Since it's using self-signed certificate, you might need to click *"Proceed Anyway"*.
 *
 * For more info, check out the [CONTRIBUTING](https://github.com/TalAter/annyang/blob/master/CONTRIBUTING.md) file
 *
 */

},{}],7:[function(require,module,exports){
var VNode = require('./vnode');
var is = require('./is');

function addNS(data, children) {
  data.ns = 'http://www.w3.org/2000/svg';
  if (children !== undefined) {
    for (var i = 0; i < children.length; ++i) {
      addNS(children[i].data, children[i].children);
    }
  }
}

module.exports = function h(sel, b, c) {
  var data = {}, children, text, i;
  if (c !== undefined) {
    data = b;
    if (is.array(c)) { children = c; }
    else if (is.primitive(c)) { text = c; }
  } else if (b !== undefined) {
    if (is.array(b)) { children = b; }
    else if (is.primitive(b)) { text = b; }
    else { data = b; }
  }
  if (is.array(children)) {
    for (i = 0; i < children.length; ++i) {
      if (is.primitive(children[i])) children[i] = VNode(undefined, undefined, undefined, children[i]);
    }
  }
  if (sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g') {
    addNS(data, children);
  }
  return VNode(sel, data, children, text, undefined);
};

},{"./is":9,"./vnode":15}],8:[function(require,module,exports){
function createElement(tagName){
  return document.createElement(tagName);
}

function createElementNS(namespaceURI, qualifiedName){
  return document.createElementNS(namespaceURI, qualifiedName);
}

function createTextNode(text){
  return document.createTextNode(text);
}


function insertBefore(parentNode, newNode, referenceNode){
  parentNode.insertBefore(newNode, referenceNode);
}


function removeChild(node, child){
  node.removeChild(child);
}

function appendChild(node, child){
  node.appendChild(child);
}

function parentNode(node){
  return node.parentElement;
}

function nextSibling(node){
  return node.nextSibling;
}

function tagName(node){
  return node.tagName;
}

function setTextContent(node, text){
  node.textContent = text;
}

module.exports = {
  createElement: createElement,
  createElementNS: createElementNS,
  createTextNode: createTextNode,
  appendChild: appendChild,
  removeChild: removeChild,
  insertBefore: insertBefore,
  parentNode: parentNode,
  nextSibling: nextSibling,
  tagName: tagName,
  setTextContent: setTextContent
};

},{}],9:[function(require,module,exports){
module.exports = {
  array: Array.isArray,
  primitive: function(s) { return typeof s === 'string' || typeof s === 'number'; },
};

},{}],10:[function(require,module,exports){
function updateClass(oldVnode, vnode) {
  var cur, name, elm = vnode.elm,
      oldClass = oldVnode.data.class || {},
      klass = vnode.data.class || {};
  for (name in oldClass) {
    if (!klass[name]) {
      elm.classList.remove(name);
    }
  }
  for (name in klass) {
    cur = klass[name];
    if (cur !== oldClass[name]) {
      elm.classList[cur ? 'add' : 'remove'](name);
    }
  }
}

module.exports = {create: updateClass, update: updateClass};

},{}],11:[function(require,module,exports){
var is = require('../is');

function arrInvoker(arr) {
  return function() {
    if (!arr.length) return;
    // Special case when length is two, for performance
    arr.length === 2 ? arr[0](arr[1]) : arr[0].apply(undefined, arr.slice(1));
  };
}

function fnInvoker(o) {
  return function(ev) { 
    if (o.fn === null) return;
    o.fn(ev); 
  };
}

function updateEventListeners(oldVnode, vnode) {
  var name, cur, old, elm = vnode.elm,
      oldOn = oldVnode.data.on || {}, on = vnode.data.on;
  if (!on) return;
  for (name in on) {
    cur = on[name];
    old = oldOn[name];
    if (old === undefined) {
      if (is.array(cur)) {
        elm.addEventListener(name, arrInvoker(cur));
      } else {
        cur = {fn: cur};
        on[name] = cur;
        elm.addEventListener(name, fnInvoker(cur));
      }
    } else if (is.array(old)) {
      // Deliberately modify old array since it's captured in closure created with `arrInvoker`
      old.length = cur.length;
      for (var i = 0; i < old.length; ++i) old[i] = cur[i];
      on[name]  = old;
    } else {
      old.fn = cur;
      on[name] = old;
    }
  }
  if (oldOn) {
    for (name in oldOn) {
      if (on[name] === undefined) {
        var old = oldOn[name];
        if (is.array(old)) {
          old.length = 0;
        }
        else {
          old.fn = null;
        }
      }
    }
  }
}

module.exports = {create: updateEventListeners, update: updateEventListeners};

},{"../is":9}],12:[function(require,module,exports){
function updateProps(oldVnode, vnode) {
  var key, cur, old, elm = vnode.elm,
      oldProps = oldVnode.data.props || {}, props = vnode.data.props || {};
  for (key in oldProps) {
    if (!props[key]) {
      delete elm[key];
    }
  }
  for (key in props) {
    cur = props[key];
    old = oldProps[key];
    if (old !== cur && (key !== 'value' || elm[key] !== cur)) {
      elm[key] = cur;
    }
  }
}

module.exports = {create: updateProps, update: updateProps};

},{}],13:[function(require,module,exports){
var raf = (typeof window !== 'undefined' && window.requestAnimationFrame) || setTimeout;
var nextFrame = function(fn) { raf(function() { raf(fn); }); };

function setNextFrame(obj, prop, val) {
  nextFrame(function() { obj[prop] = val; });
}

function updateStyle(oldVnode, vnode) {
  var cur, name, elm = vnode.elm,
      oldStyle = oldVnode.data.style || {},
      style = vnode.data.style || {},
      oldHasDel = 'delayed' in oldStyle;
  for (name in oldStyle) {
    if (!style[name]) {
      elm.style[name] = '';
    }
  }
  for (name in style) {
    cur = style[name];
    if (name === 'delayed') {
      for (name in style.delayed) {
        cur = style.delayed[name];
        if (!oldHasDel || cur !== oldStyle.delayed[name]) {
          setNextFrame(elm.style, name, cur);
        }
      }
    } else if (name !== 'remove' && cur !== oldStyle[name]) {
      elm.style[name] = cur;
    }
  }
}

function applyDestroyStyle(vnode) {
  var style, name, elm = vnode.elm, s = vnode.data.style;
  if (!s || !(style = s.destroy)) return;
  for (name in style) {
    elm.style[name] = style[name];
  }
}

function applyRemoveStyle(vnode, rm) {
  var s = vnode.data.style;
  if (!s || !s.remove) {
    rm();
    return;
  }
  var name, elm = vnode.elm, idx, i = 0, maxDur = 0,
      compStyle, style = s.remove, amount = 0, applied = [];
  for (name in style) {
    applied.push(name);
    elm.style[name] = style[name];
  }
  compStyle = getComputedStyle(elm);
  var props = compStyle['transition-property'].split(', ');
  for (; i < props.length; ++i) {
    if(applied.indexOf(props[i]) !== -1) amount++;
  }
  elm.addEventListener('transitionend', function(ev) {
    if (ev.target === elm) --amount;
    if (amount === 0) rm();
  });
}

module.exports = {create: updateStyle, update: updateStyle, destroy: applyDestroyStyle, remove: applyRemoveStyle};

},{}],14:[function(require,module,exports){
// jshint newcap: false
/* global require, module, document, Node */
'use strict';

var VNode = require('./vnode');
var is = require('./is');
var domApi = require('./htmldomapi');

function isUndef(s) { return s === undefined; }
function isDef(s) { return s !== undefined; }

var emptyNode = VNode('', {}, [], undefined, undefined);

function sameVnode(vnode1, vnode2) {
  return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
}

function createKeyToOldIdx(children, beginIdx, endIdx) {
  var i, map = {}, key;
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key;
    if (isDef(key)) map[key] = i;
  }
  return map;
}

var hooks = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];

function init(modules, api) {
  var i, j, cbs = {};

  if (isUndef(api)) api = domApi;

  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      if (modules[j][hooks[i]] !== undefined) cbs[hooks[i]].push(modules[j][hooks[i]]);
    }
  }

  function emptyNodeAt(elm) {
    return VNode(api.tagName(elm).toLowerCase(), {}, [], undefined, elm);
  }

  function createRmCb(childElm, listeners) {
    return function() {
      if (--listeners === 0) {
        var parent = api.parentNode(childElm);
        api.removeChild(parent, childElm);
      }
    };
  }

  function createElm(vnode, insertedVnodeQueue) {
    var i, data = vnode.data;
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.init)) {
        i(vnode);
        data = vnode.data;
      }
    }
    var elm, children = vnode.children, sel = vnode.sel;
    if (isDef(sel)) {
      // Parse selector
      var hashIdx = sel.indexOf('#');
      var dotIdx = sel.indexOf('.', hashIdx);
      var hash = hashIdx > 0 ? hashIdx : sel.length;
      var dot = dotIdx > 0 ? dotIdx : sel.length;
      var tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
      elm = vnode.elm = isDef(data) && isDef(i = data.ns) ? api.createElementNS(i, tag)
                                                          : api.createElement(tag);
      if (hash < dot) elm.id = sel.slice(hash + 1, dot);
      if (dotIdx > 0) elm.className = sel.slice(dot+1).replace(/\./g, ' ');
      if (is.array(children)) {
        for (i = 0; i < children.length; ++i) {
          api.appendChild(elm, createElm(children[i], insertedVnodeQueue));
        }
      } else if (is.primitive(vnode.text)) {
        api.appendChild(elm, api.createTextNode(vnode.text));
      }
      for (i = 0; i < cbs.create.length; ++i) cbs.create[i](emptyNode, vnode);
      i = vnode.data.hook; // Reuse variable
      if (isDef(i)) {
        if (i.create) i.create(emptyNode, vnode);
        if (i.insert) insertedVnodeQueue.push(vnode);
      }
    } else {
      elm = vnode.elm = api.createTextNode(vnode.text);
    }
    return vnode.elm;
  }

  function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      api.insertBefore(parentElm, createElm(vnodes[startIdx], insertedVnodeQueue), before);
    }
  }

  function invokeDestroyHook(vnode) {
    var i, j, data = vnode.data;
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode);
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode);
      if (isDef(i = vnode.children)) {
        for (j = 0; j < vnode.children.length; ++j) {
          invokeDestroyHook(vnode.children[j]);
        }
      }
    }
  }

  function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      var i, listeners, rm, ch = vnodes[startIdx];
      if (isDef(ch)) {
        if (isDef(ch.sel)) {
          invokeDestroyHook(ch);
          listeners = cbs.remove.length + 1;
          rm = createRmCb(ch.elm, listeners);
          for (i = 0; i < cbs.remove.length; ++i) cbs.remove[i](ch, rm);
          if (isDef(i = ch.data) && isDef(i = i.hook) && isDef(i = i.remove)) {
            i(ch, rm);
          } else {
            rm();
          }
        } else { // Text node
          api.removeChild(parentElm, ch.elm);
        }
      }
    }
  }

  function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
    var oldStartIdx = 0, newStartIdx = 0;
    var oldEndIdx = oldCh.length - 1;
    var oldStartVnode = oldCh[0];
    var oldEndVnode = oldCh[oldEndIdx];
    var newEndIdx = newCh.length - 1;
    var newStartVnode = newCh[0];
    var newEndVnode = newCh[newEndIdx];
    var oldKeyToIdx, idxInOld, elmToMove, before;

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (isUndef(oldStartVnode)) {
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode has been moved left
      } else if (isUndef(oldEndVnode)) {
        oldEndVnode = oldCh[--oldEndIdx];
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];
      } else {
        if (isUndef(oldKeyToIdx)) oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
        idxInOld = oldKeyToIdx[newStartVnode.key];
        if (isUndef(idxInOld)) { // New element
          api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
          newStartVnode = newCh[++newStartIdx];
        } else {
          elmToMove = oldCh[idxInOld];
          patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
          oldCh[idxInOld] = undefined;
          api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
          newStartVnode = newCh[++newStartIdx];
        }
      }
    }
    if (oldStartIdx > oldEndIdx) {
      before = isUndef(newCh[newEndIdx+1]) ? null : newCh[newEndIdx+1].elm;
      addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
    } else if (newStartIdx > newEndIdx) {
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
    }
  }

  function patchVnode(oldVnode, vnode, insertedVnodeQueue) {
    var i, hook;
    if (isDef(i = vnode.data) && isDef(hook = i.hook) && isDef(i = hook.prepatch)) {
      i(oldVnode, vnode);
    }
    var elm = vnode.elm = oldVnode.elm, oldCh = oldVnode.children, ch = vnode.children;
    if (oldVnode === vnode) return;
    if (!sameVnode(oldVnode, vnode)) {
      var parentElm = api.parentNode(oldVnode.elm);
      elm = createElm(vnode, insertedVnodeQueue);
      api.insertBefore(parentElm, elm, oldVnode.elm);
      removeVnodes(parentElm, [oldVnode], 0, 0);
      return;
    }
    if (isDef(vnode.data)) {
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode);
      i = vnode.data.hook;
      if (isDef(i) && isDef(i = i.update)) i(oldVnode, vnode);
    }
    if (isUndef(vnode.text)) {
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue);
      } else if (isDef(ch)) {
        if (isDef(oldVnode.text)) api.setTextContent(elm, '');
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
      } else if (isDef(oldCh)) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1);
      } else if (isDef(oldVnode.text)) {
        api.setTextContent(elm, '');
      }
    } else if (oldVnode.text !== vnode.text) {
      api.setTextContent(elm, vnode.text);
    }
    if (isDef(hook) && isDef(i = hook.postpatch)) {
      i(oldVnode, vnode);
    }
  }

  return function(oldVnode, vnode) {
    var i, elm, parent;
    var insertedVnodeQueue = [];
    for (i = 0; i < cbs.pre.length; ++i) cbs.pre[i]();

    if (isUndef(oldVnode.sel)) {
      oldVnode = emptyNodeAt(oldVnode);
    }

    if (sameVnode(oldVnode, vnode)) {
      patchVnode(oldVnode, vnode, insertedVnodeQueue);
    } else {
      elm = oldVnode.elm;
      parent = api.parentNode(elm);

      createElm(vnode, insertedVnodeQueue);

      if (parent !== null) {
        api.insertBefore(parent, vnode.elm, api.nextSibling(elm));
        removeVnodes(parent, [oldVnode], 0, 0);
      }
    }

    for (i = 0; i < insertedVnodeQueue.length; ++i) {
      insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
    }
    for (i = 0; i < cbs.post.length; ++i) cbs.post[i]();
    return vnode;
  };
}

module.exports = {init: init};

},{"./htmldomapi":8,"./is":9,"./vnode":15}],15:[function(require,module,exports){
module.exports = function(sel, data, children, text, elm) {
  var key = data === undefined ? undefined : data.key;
  return {sel: sel, data: data, children: children,
          text: text, elm: elm, key: key};
};

},{}],16:[function(require,module,exports){
(function (global){
const annyang = require('annyang')
const StateMachine = require('./StateMachine')
const Environment = require('./Environment')
const data = {
  letters: {
     a: 0,
     b: 0,
     c: 0
   },
  clients: {
     'Bob Jones': {},
     'Greg Harmon': {},
     'Leann Lewis': {},
     'Harmony Chostwitz': {}
   },
   vlogs: [],
   clogs: []
}
const commands = require('./Commands')

const StateCreator = require('./StateCreator')
const FailStateCreator = require('./FailStateCreator')

/////////////////////
const $activateBtn = document.getElementById('activate-btn')
const $showCommandsBtn = document.getElementById('show-commands-btn')
const dom_events = {
  'click': [{
    element: $activateBtn,
    callback: function(_) {
      annyang.start({ autoRestart: false, continuous: true })
    }
  }, {
    element: $showCommandsBtn,
    callback: function(_) {
      annyang.trigger('increase a')
    }
  }]
}
const annyang_callbacks = {
 'start': () => {
   $activateBtn.disabled = true
   $activateBtn.textContent = 'Listening'
 },
 'result': (result) => {
   console.log(result)
 },
 'resultMatch': (result) => {
   console.log(result)
 },
 'end': () => {
   $activateBtn.disabled = false
   $activateBtn.textContent = 'Start'
 }
}

for (var cb in annyang_callbacks) {
  annyang.addCallback(cb, annyang_callbacks[cb])
}
for (var type in dom_events) {
  dom_events[type].forEach(event => {
    event.element.addEventListener(type, event.callback)
  })
}

/////////////////// 

const myEnv = Environment(commands(data))
global.myEnv = myEnv
const State = StateMachine.init(document.getElementById('content'))(StateCreator)({
  vlogs: data.vlogs,
  clogs: data.clogs
})

const ErrState = StateMachine.init(document.getElementById('err'))(FailStateCreator)({
  errMsg: 'Poo'
})

const StateChange = (_) => {
  var new_state = myEnv.channelFail.shift()
  
  if (new_state === undefined) {
    
    new_state = myEnv.channelSuccess.shift()
    if (new_state !== undefined) { 
      State.change(new_state, { replace: new_state.replace }) 
    }
    
  } else {
    ErrState.change(new_state)
  }
  
  window.requestAnimationFrame(StateChange)
}


annyang.addCommands(myEnv.commands)

window.requestAnimationFrame(StateChange)

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./Commands":1,"./Environment":2,"./FailStateCreator":3,"./StateCreator":4,"./StateMachine":5,"annyang":6}]},{},[16])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJDb21tYW5kcy5qcyIsIkVudmlyb25tZW50LmpzIiwiRmFpbFN0YXRlQ3JlYXRvci5qcyIsIlN0YXRlQ3JlYXRvci5qcyIsIlN0YXRlTWFjaGluZS5qcyIsIm5vZGVfbW9kdWxlcy9hbm55YW5nL2FubnlhbmcuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaC5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9odG1sZG9tYXBpLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2lzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvY2xhc3MuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vbW9kdWxlcy9ldmVudGxpc3RlbmVycy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL3Byb3BzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvc3R5bGUuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vc25hYmJkb20uanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vdm5vZGUuanMiLCJwbGF0Zm9ybS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDandCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJcbmNvbnN0IGNvbW1hbmRzID0gKGRhdGEpID0+IHtcbiAgY29uc3QgX2NvbW1hbmRzID0ge1xuICAgICdzaG93IGNvbW1hbmRzJzoge1xuICAgICAgY2FsbGJhY2soKSB7XG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9LFxuICAgICAgc3VjY2VzcygpIHtcbiAgICAgICAgZGF0YS5jbG9ncy5wdXNoKFJlZmxlY3Qub3duS2V5cyhfY29tbWFuZHMpLmpvaW4oJywgJykgKyAnXFxuJylcbiAgICAgICAgcmV0dXJuIHsgY2xvZ3M6IGRhdGEuY2xvZ3N9XG4gICAgICB9XG4gICAgfSxcbiAgICAnaW5jcmVhc2UgOmxldHRlcic6IHtcbiAgICAgIHJlZ2V4cDogL15pbmNyZWFzZSAoXFx3KSQvLFxuICAgICAgY2FsbGJhY2sobGV0dGVyKSB7XG4gICAgICAgIGxldHRlciA9IGxldHRlci50b0xvd2VyQ2FzZSgpXG4gICAgICAgIFxuICAgICAgICBpZiAoZGF0YS5sZXR0ZXJzW2xldHRlcl0gIT09IHVuZGVmaW5lZCkgIHtcbiAgICAgICAgICBkYXRhLmxldHRlcnNbbGV0dGVyXSsrXG4gICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gYGNhbm5vdCBpbmNyZWFzZSBsZXR0ZXIgJHtsZXR0ZXJ9IC0tIGl0IGRvZXNuJ3QgZXhpc3RgXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzdWNjZXNzKGxldHRlcikge1xuICAgICAgICBkYXRhLmNsb2dzLnB1c2goYGluY3JlYXNlZCBsZXR0ZXIgJHtsZXR0ZXJ9ICR7SlNPTi5zdHJpbmdpZnkoZGF0YS5sZXR0ZXJzKX1gKVxuICAgICAgICByZXR1cm4geyBjbG9nczogZGF0YS5jbG9ncyB9XG4gICAgICB9XG4gICAgfSxcbiAgICAnY2xpZW50IDpmaXJzdCA6bGFzdCc6IHtcbiAgICAgIGNhbGxiYWNrKGZpcnN0LCBsYXN0KSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBgJHtmaXJzdH0gJHtsYXN0fWBcbiAgICAgICAgXG4gICAgICAgIGlmIChkYXRhLmNsaWVudHNbbmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGBjbGllbnQgJHtuYW1lfSBub3QgZm91bmRgXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBzdWNjZXNzKGZpcnN0LCBsYXN0KSB7XG4gICAgICAgIGRhdGEuY2xvZ3MucHVzaChgZm91bmQgY2xpZW50ICR7Zmlyc3R9ICR7bGFzdH1gKVxuICAgICAgICByZXR1cm4geyBjbG9nczogZGF0YS5jbG9ncyB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBfY29tbWFuZHNcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb21tYW5kcyIsImNvbnN0IGNoYW5uZWxTdWNjZXNzID0gW11cbmNvbnN0IGNoYW5uZWxGYWlsID0gW11cblxuY29uc3Qgb2JqZWN0VmFsdWVzID0gKG9iaikgPT4ge1xuICByZXR1cm4gUmVmbGVjdC5vd25LZXlzKG9iaikubWFwKGtleSA9PiBvYmpba2V5XSlcbn1cblxuY29uc3QgaW5pdCA9IChjb21tYW5kcykgPT4ge1xuICBmb3IgKHZhciBjIG9mIG9iamVjdFZhbHVlcyhjb21tYW5kcykpIHtcbiAgICBjLmNhbGxiYWNrID0gd3JhcHBlcih7IGNhbGxiYWNrOiBjLmNhbGxiYWNrLCBzdWNjZXNzOiBjLnN1Y2Nlc3MsIGZhaWw6IGMuZmFpbCB9KVxuICAgIGRlbGV0ZSBjLnN1Y2Nlc3NcbiAgICBkZWxldGUgYy5mYWlsXG4gIH1cbiAgXG4gcmV0dXJuIHtcbiAgIGNvbW1hbmRzLCBjaGFubmVsU3VjY2VzcywgY2hhbm5lbEZhaWxcbiB9XG59XG5cbmNvbnN0IHdyYXBwZXIgPSAoeyBjYWxsYmFjaywgc3VjY2VzcywgZmFpbCB9KSA9PiAoLi4uYXJncykgPT4ge1xuICBjb25zdCBvdXRjb21lID0gY2FsbGJhY2soLi4uYXJncylcbiAgXG4gIG91dGNvbWUgPT09IHRydWVcbiAgICA/IGNoYW5uZWxTdWNjZXNzLnB1c2goc3VjY2VzcyguLi5hcmdzKSlcbiAgICA6IGNoYW5uZWxGYWlsLnB1c2gob3V0Y29tZSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbml0IiwiY29uc3QgaCA9IHJlcXVpcmUoJ3NuYWJiZG9tL2gnKVxuXG5jb25zdCBGYWlsU3RhdGVDcmVhdG9yID0gKHtcbiAgZXJyTXNnXG59KSA9PiB7XG4gIHJldHVybiBoKCdkaXYjZXJyJywgW2Vyck1zZ10pXG59XG5cbm1vZHVsZS5leHBvcnRzID0gRmFpbFN0YXRlQ3JlYXRvciIsImNvbnN0IGggPSByZXF1aXJlKCdzbmFiYmRvbS9oJylcblxuY29uc3QgU3RhdGVDcmVhdG9yID0gKHtcbiAgdmxvZ3MsXG4gIGNsb2dzXG59KSA9PiB7XG4gIHJldHVybiBoKCdkaXYjY29udGVudCcsIFtcbiAgICAgIGgoJ2RpdiN2bG9nJywgW3Zsb2dzLmpvaW4oJ1xcbicpXSksXG4gICAgICBoKCdkaXYjY2xvZycsIFtjbG9ncy5qb2luKCdcXG4nKV0pXG4gICAgXSlcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlQ3JlYXRvciIsImNvbnN0IHNuYWJiZG9tID0gcmVxdWlyZSgnc25hYmJkb20nKVxuY29uc3QgcGF0Y2ggPSBzbmFiYmRvbS5pbml0KFsgLy8gSW5pdCBwYXRjaCBmdW5jdGlvbiB3aXRoIGNob29zZW4gbW9kdWxlc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL2NsYXNzJyksIC8vIG1ha2VzIGl0IGVhc3kgdG8gdG9nZ2xlIGNsYXNzZXNcbiAgcmVxdWlyZSgnc25hYmJkb20vbW9kdWxlcy9wcm9wcycpLCAvLyBmb3Igc2V0dGluZyBwcm9wZXJ0aWVzIG9uIERPTSBlbGVtZW50c1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL3N0eWxlJyksIC8vIGhhbmRsZXMgc3R5bGluZyBvbiBlbGVtZW50cyB3aXRoIHN1cHBvcnQgZm9yIGFuaW1hdGlvbnNcbiAgcmVxdWlyZSgnc25hYmJkb20vbW9kdWxlcy9ldmVudGxpc3RlbmVycycpLCAvLyBhdHRhY2hlcyBldmVudCBsaXN0ZW5lcnNcbl0pXG5cbmNvbnN0IGluaXQgPSAocGFyZW50Tm9kZSkgPT4gKFN0YXRlQ3JlYXRvcikgPT4gKGluaXRfcGFyYW1zKSA9PiB7XG4gIHZhciB2dHJlZSA9IHBhcmVudE5vZGVcbiAgY29uc3Qgc3RhdGVzID0gW11cbiAgXG4gIC8vIGN1cnNvciBzdG9yZXMgdGhlIGluZGV4IG9mIHRoZSBjdXJyZW50bHkgcmVuZGVyZWQgc3RhdGVcbiAgLy8gaXQgbW92ZXMgYmFjayBhbmQgZm9yd2FyZCBmb3IgdW5kby9yZWRvIG9wZXJhdGlvbnNcbiAgY29uc3QgaSA9IDBcbiAgXG4gIC8vIHJlcGxhY2UgbXVzdCBiZSB0cnVlIGZvciBmaXJzdCBzdGF0ZSBjaGFuZ2VcbiAgY29uc3QgY2hhbmdlID0gKHN0YXRlLCB7IHJlcGxhY2UgfSkgPT4ge1xuICAgIGlmICghcmVwbGFjZSkge1xuICAgICAgc3RhdGUgPSBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHN0YXRlc1tpXSksIHN0YXRlKVxuICAgIH1cblxuICAgIGNvbnN0IG5ld192dHJlZSA9IFN0YXRlQ3JlYXRvcihzdGF0ZSlcbiAgICBcbiAgICAvLyByZW1vdmUgYWxsIHN0YXRlIHBhcmFtZXRlcnMgaW4gZnJvbnQgb2YgY3Vyc29yIHBvc2l0aW9uXG4gICAgaWYgKGkgIT09IDApIHtcbiAgICAgIHN0YXRlcy5zcGxpY2UoMCwgaSlcbiAgICAgIGkgPSAwXG4gICAgfVxuICAgIHN0YXRlcy51bnNoaWZ0KHN0YXRlKVxuICAgIFxuICAgIHBhdGNoKHZ0cmVlLCBuZXdfdnRyZWUpXG4gICAgdnRyZWUgPSBuZXdfdnRyZWVcbiAgfVxuICBcbiAgY29uc3QgdW5kbyA9ICgpID0+IHtcbiAgICByZXR1cm4gKGkgPCBzdGF0ZXMubGVuZ3RoIC0gMSlcbiAgICAgID8gKGNoYW5nZShzdGF0ZXNbKytpXSwgeyByZXBsYWNlOiB0cnVlIH0pLCB0cnVlKVxuICAgICAgOiBmYWxzZVxuICB9XG4gIFxuICBjb25zdCByZWRvID0gKCkgPT4ge1xuICAgIHJldHVybiAoaSA+IDApXG4gICAgICA/IChjaGFuZ2Uoc3RhdGVzWy0taV0sIHsgcmVwbGFjZTogdHJ1ZSB9KSwgdHJ1ZSlcbiAgICAgIDogZmFsc2VcbiAgICB9XG4gIFxuICAvLyByZXBsYWNlIG11c3QgYmUgdHJ1ZSBmb3IgZmlyc3Qgc3RhdGUgY2hhbmdlXG4gIGNoYW5nZShpbml0X3BhcmFtcywgeyByZXBsYWNlOiB0cnVlIH0pXG4gIFxuICByZXR1cm4geyBjaGFuZ2UsIHVuZG8sIHJlZG8gfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgaW5pdCB9IiwiLy8hIGFubnlhbmdcbi8vISB2ZXJzaW9uIDogMi40LjBcbi8vISBhdXRob3IgIDogVGFsIEF0ZXIgQFRhbEF0ZXJcbi8vISBsaWNlbnNlIDogTUlUXG4vLyEgaHR0cHM6Ly93d3cuVGFsQXRlci5jb20vYW5ueWFuZy9cbihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xuICBcInVzZSBzdHJpY3RcIjtcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkgeyAvLyBBTUQgKyBnbG9iYWxcbiAgICBkZWZpbmUoW10sIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiAocm9vdC5hbm55YW5nID0gZmFjdG9yeShyb290KSk7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHsgLy8gQ29tbW9uSlNcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3Rvcnkocm9vdCk7XG4gIH0gZWxzZSB7IC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgIHJvb3QuYW5ueWFuZyA9IGZhY3Rvcnkocm9vdCk7XG4gIH1cbn0odHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB0aGlzLCBmdW5jdGlvbiAocm9vdCwgdW5kZWZpbmVkKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIC8qKlxuICAgKiAjIFF1aWNrIFR1dG9yaWFsLCBJbnRybyBhbmQgRGVtb3NcbiAgICpcbiAgICogVGhlIHF1aWNrZXN0IHdheSB0byBnZXQgc3RhcnRlZCBpcyB0byB2aXNpdCB0aGUgW2FubnlhbmcgaG9tZXBhZ2VdKGh0dHBzOi8vd3d3LnRhbGF0ZXIuY29tL2FubnlhbmcvKS5cbiAgICpcbiAgICogRm9yIGEgbW9yZSBpbi1kZXB0aCBsb29rIGF0IGFubnlhbmcsIHJlYWQgb24uXG4gICAqXG4gICAqICMgQVBJIFJlZmVyZW5jZVxuICAgKi9cblxuICB2YXIgYW5ueWFuZztcblxuICAvLyBHZXQgdGhlIFNwZWVjaFJlY29nbml0aW9uIG9iamVjdCwgd2hpbGUgaGFuZGxpbmcgYnJvd3NlciBwcmVmaXhlc1xuICB2YXIgU3BlZWNoUmVjb2duaXRpb24gPSByb290LlNwZWVjaFJlY29nbml0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3Qud2Via2l0U3BlZWNoUmVjb2duaXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5tb3pTcGVlY2hSZWNvZ25pdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICByb290Lm1zU3BlZWNoUmVjb2duaXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5vU3BlZWNoUmVjb2duaXRpb247XG5cbiAgLy8gQ2hlY2sgYnJvd3NlciBzdXBwb3J0XG4gIC8vIFRoaXMgaXMgZG9uZSBhcyBlYXJseSBhcyBwb3NzaWJsZSwgdG8gbWFrZSBpdCBhcyBmYXN0IGFzIHBvc3NpYmxlIGZvciB1bnN1cHBvcnRlZCBicm93c2Vyc1xuICBpZiAoIVNwZWVjaFJlY29nbml0aW9uKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2YXIgY29tbWFuZHNMaXN0ID0gW107XG4gIHZhciByZWNvZ25pdGlvbjtcbiAgdmFyIGNhbGxiYWNrcyA9IHsgc3RhcnQ6IFtdLCBlcnJvcjogW10sIGVuZDogW10sIHJlc3VsdDogW10sIHJlc3VsdE1hdGNoOiBbXSwgcmVzdWx0Tm9NYXRjaDogW10sIGVycm9yTmV0d29yazogW10sIGVycm9yUGVybWlzc2lvbkJsb2NrZWQ6IFtdLCBlcnJvclBlcm1pc3Npb25EZW5pZWQ6IFtdIH07XG4gIHZhciBhdXRvUmVzdGFydDtcbiAgdmFyIGxhc3RTdGFydGVkQXQgPSAwO1xuICB2YXIgZGVidWdTdGF0ZSA9IGZhbHNlO1xuICB2YXIgZGVidWdTdHlsZSA9ICdmb250LXdlaWdodDogYm9sZDsgY29sb3I6ICMwMGY7JztcbiAgdmFyIHBhdXNlTGlzdGVuaW5nID0gZmFsc2U7XG4gIHZhciBpc0xpc3RlbmluZyA9IGZhbHNlO1xuXG4gIC8vIFRoZSBjb21tYW5kIG1hdGNoaW5nIGNvZGUgaXMgYSBtb2RpZmllZCB2ZXJzaW9uIG9mIEJhY2tib25lLlJvdXRlciBieSBKZXJlbXkgQXNoa2VuYXMsIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAgdmFyIG9wdGlvbmFsUGFyYW0gPSAvXFxzKlxcKCguKj8pXFwpXFxzKi9nO1xuICB2YXIgb3B0aW9uYWxSZWdleCA9IC8oXFwoXFw/OlteKV0rXFwpKVxcPy9nO1xuICB2YXIgbmFtZWRQYXJhbSAgICA9IC8oXFwoXFw/KT86XFx3Ky9nO1xuICB2YXIgc3BsYXRQYXJhbSAgICA9IC9cXCpcXHcrL2c7XG4gIHZhciBlc2NhcGVSZWdFeHAgID0gL1tcXC17fVxcW1xcXSs/LixcXFxcXFxeJHwjXS9nO1xuICB2YXIgY29tbWFuZFRvUmVnRXhwID0gZnVuY3Rpb24oY29tbWFuZCkge1xuICAgIGNvbW1hbmQgPSBjb21tYW5kLnJlcGxhY2UoZXNjYXBlUmVnRXhwLCAnXFxcXCQmJylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKG9wdGlvbmFsUGFyYW0sICcoPzokMSk/JylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKG5hbWVkUGFyYW0sIGZ1bmN0aW9uKG1hdGNoLCBvcHRpb25hbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9uYWwgPyBtYXRjaCA6ICcoW15cXFxcc10rKSc7XG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgLnJlcGxhY2Uoc3BsYXRQYXJhbSwgJyguKj8pJylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKG9wdGlvbmFsUmVnZXgsICdcXFxccyokMT9cXFxccyonKTtcbiAgICByZXR1cm4gbmV3IFJlZ0V4cCgnXicgKyBjb21tYW5kICsgJyQnLCAnaScpO1xuICB9O1xuXG4gIC8vIFRoaXMgbWV0aG9kIHJlY2VpdmVzIGFuIGFycmF5IG9mIGNhbGxiYWNrcyB0byBpdGVyYXRlIG92ZXIsIGFuZCBpbnZva2VzIGVhY2ggb2YgdGhlbVxuICB2YXIgaW52b2tlQ2FsbGJhY2tzID0gZnVuY3Rpb24oY2FsbGJhY2tzKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGNhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjay5jYWxsYmFjay5hcHBseShjYWxsYmFjay5jb250ZXh0LCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICB2YXIgaXNJbml0aWFsaXplZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiByZWNvZ25pdGlvbiAhPT0gdW5kZWZpbmVkO1xuICB9O1xuXG4gIHZhciBpbml0SWZOZWVkZWQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIWlzSW5pdGlhbGl6ZWQoKSkge1xuICAgICAgYW5ueWFuZy5pbml0KHt9LCBmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIHZhciByZWdpc3RlckNvbW1hbmQgPSBmdW5jdGlvbihjb21tYW5kLCBjYiwgcGhyYXNlKSB7XG4gICAgY29tbWFuZHNMaXN0LnB1c2goeyBjb21tYW5kOiBjb21tYW5kLCBjYWxsYmFjazogY2IsIG9yaWdpbmFsUGhyYXNlOiBwaHJhc2UgfSk7XG4gICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdDb21tYW5kIHN1Y2Nlc3NmdWxseSBsb2FkZWQ6ICVjJytwaHJhc2UsIGRlYnVnU3R5bGUpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgcGFyc2VSZXN1bHRzID0gZnVuY3Rpb24ocmVzdWx0cykge1xuICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MucmVzdWx0LCByZXN1bHRzKTtcbiAgICB2YXIgY29tbWFuZFRleHQ7XG4gICAgLy8gZ28gb3ZlciBlYWNoIG9mIHRoZSA1IHJlc3VsdHMgYW5kIGFsdGVybmF0aXZlIHJlc3VsdHMgcmVjZWl2ZWQgKHdlJ3ZlIHNldCBtYXhBbHRlcm5hdGl2ZXMgdG8gNSBhYm92ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaTxyZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyB0aGUgdGV4dCByZWNvZ25pemVkXG4gICAgICBjb21tYW5kVGV4dCA9IHJlc3VsdHNbaV0udHJpbSgpO1xuICAgICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1NwZWVjaCByZWNvZ25pemVkOiAlYycrY29tbWFuZFRleHQsIGRlYnVnU3R5bGUpO1xuICAgICAgfVxuXG4gICAgICAvLyB0cnkgYW5kIG1hdGNoIHJlY29nbml6ZWQgdGV4dCB0byBvbmUgb2YgdGhlIGNvbW1hbmRzIG9uIHRoZSBsaXN0XG4gICAgICBmb3IgKHZhciBqID0gMCwgbCA9IGNvbW1hbmRzTGlzdC5sZW5ndGg7IGogPCBsOyBqKyspIHtcbiAgICAgICAgdmFyIGN1cnJlbnRDb21tYW5kID0gY29tbWFuZHNMaXN0W2pdO1xuICAgICAgICB2YXIgcmVzdWx0ID0gY3VycmVudENvbW1hbmQuY29tbWFuZC5leGVjKGNvbW1hbmRUZXh0KTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgIHZhciBwYXJhbWV0ZXJzID0gcmVzdWx0LnNsaWNlKDEpO1xuICAgICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29tbWFuZCBtYXRjaGVkOiAlYycrY3VycmVudENvbW1hbmQub3JpZ2luYWxQaHJhc2UsIGRlYnVnU3R5bGUpO1xuICAgICAgICAgICAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd3aXRoIHBhcmFtZXRlcnMnLCBwYXJhbWV0ZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZXhlY3V0ZSB0aGUgbWF0Y2hlZCBjb21tYW5kXG4gICAgICAgICAgY3VycmVudENvbW1hbmQuY2FsbGJhY2suYXBwbHkodGhpcywgcGFyYW1ldGVycyk7XG4gICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5yZXN1bHRNYXRjaCwgY29tbWFuZFRleHQsIGN1cnJlbnRDb21tYW5kLm9yaWdpbmFsUGhyYXNlLCByZXN1bHRzKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5yZXN1bHROb01hdGNoLCByZXN1bHRzKTtcbiAgfTtcblxuICBhbm55YW5nID0ge1xuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSBhbm55YW5nIHdpdGggYSBsaXN0IG9mIGNvbW1hbmRzIHRvIHJlY29nbml6ZS5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiB2YXIgY29tbWFuZHMgPSB7J2hlbGxvIDpuYW1lJzogaGVsbG9GdW5jdGlvbn07XG4gICAgICogdmFyIGNvbW1hbmRzMiA9IHsnaGknOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKlxuICAgICAqIC8vIGluaXRpYWxpemUgYW5ueWFuZywgb3ZlcndyaXRpbmcgYW55IHByZXZpb3VzbHkgYWRkZWQgY29tbWFuZHNcbiAgICAgKiBhbm55YW5nLmluaXQoY29tbWFuZHMsIHRydWUpO1xuICAgICAqIC8vIGFkZHMgYW4gYWRkaXRpb25hbCBjb21tYW5kIHdpdGhvdXQgcmVtb3ZpbmcgdGhlIHByZXZpb3VzIGNvbW1hbmRzXG4gICAgICogYW5ueWFuZy5pbml0KGNvbW1hbmRzMiwgZmFsc2UpO1xuICAgICAqIGBgYGBcbiAgICAgKiBBcyBvZiB2MS4xLjAgaXQgaXMgbm8gbG9uZ2VyIHJlcXVpcmVkIHRvIGNhbGwgaW5pdCgpLiBKdXN0IHN0YXJ0KCkgbGlzdGVuaW5nIHdoZW5ldmVyIHlvdSB3YW50LCBhbmQgYWRkQ29tbWFuZHMoKSB3aGVuZXZlciwgYW5kIGFzIG9mdGVuIGFzIHlvdSBsaWtlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbW1hbmRzIC0gQ29tbWFuZHMgdGhhdCBhbm55YW5nIHNob3VsZCBsaXN0ZW4gdG9cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtyZXNldENvbW1hbmRzPXRydWVdIC0gUmVtb3ZlIGFsbCBjb21tYW5kcyBiZWZvcmUgaW5pdGlhbGl6aW5nP1xuICAgICAqIEBtZXRob2QgaW5pdFxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICogQHNlZSBbQ29tbWFuZHMgT2JqZWN0XSgjY29tbWFuZHMtb2JqZWN0KVxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uKGNvbW1hbmRzLCByZXNldENvbW1hbmRzKSB7XG5cbiAgICAgIC8vIHJlc2V0Q29tbWFuZHMgZGVmYXVsdHMgdG8gdHJ1ZVxuICAgICAgaWYgKHJlc2V0Q29tbWFuZHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXNldENvbW1hbmRzID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc2V0Q29tbWFuZHMgPSAhIXJlc2V0Q29tbWFuZHM7XG4gICAgICB9XG5cbiAgICAgIC8vIEFib3J0IHByZXZpb3VzIGluc3RhbmNlcyBvZiByZWNvZ25pdGlvbiBhbHJlYWR5IHJ1bm5pbmdcbiAgICAgIGlmIChyZWNvZ25pdGlvbiAmJiByZWNvZ25pdGlvbi5hYm9ydCkge1xuICAgICAgICByZWNvZ25pdGlvbi5hYm9ydCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBpbml0aWF0ZSBTcGVlY2hSZWNvZ25pdGlvblxuICAgICAgcmVjb2duaXRpb24gPSBuZXcgU3BlZWNoUmVjb2duaXRpb24oKTtcblxuICAgICAgLy8gU2V0IHRoZSBtYXggbnVtYmVyIG9mIGFsdGVybmF0aXZlIHRyYW5zY3JpcHRzIHRvIHRyeSBhbmQgbWF0Y2ggd2l0aCBhIGNvbW1hbmRcbiAgICAgIHJlY29nbml0aW9uLm1heEFsdGVybmF0aXZlcyA9IDU7XG5cbiAgICAgIC8vIEluIEhUVFBTLCB0dXJuIG9mZiBjb250aW51b3VzIG1vZGUgZm9yIGZhc3RlciByZXN1bHRzLlxuICAgICAgLy8gSW4gSFRUUCwgIHR1cm4gb24gIGNvbnRpbnVvdXMgbW9kZSBmb3IgbXVjaCBzbG93ZXIgcmVzdWx0cywgYnV0IG5vIHJlcGVhdGluZyBzZWN1cml0eSBub3RpY2VzXG4gICAgICByZWNvZ25pdGlvbi5jb250aW51b3VzID0gcm9vdC5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHA6JztcblxuICAgICAgLy8gU2V0cyB0aGUgbGFuZ3VhZ2UgdG8gdGhlIGRlZmF1bHQgJ2VuLVVTJy4gVGhpcyBjYW4gYmUgY2hhbmdlZCB3aXRoIGFubnlhbmcuc2V0TGFuZ3VhZ2UoKVxuICAgICAgcmVjb2duaXRpb24ubGFuZyA9ICdlbi1VUyc7XG5cbiAgICAgIHJlY29nbml0aW9uLm9uc3RhcnQgICA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpc0xpc3RlbmluZyA9IHRydWU7XG4gICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3Muc3RhcnQpO1xuICAgICAgfTtcblxuICAgICAgcmVjb2duaXRpb24ub25lcnJvciAgID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvcik7XG4gICAgICAgIHN3aXRjaCAoZXZlbnQuZXJyb3IpIHtcbiAgICAgICAgY2FzZSAnbmV0d29yayc6XG4gICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvck5ldHdvcmspO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdub3QtYWxsb3dlZCc6XG4gICAgICAgIGNhc2UgJ3NlcnZpY2Utbm90LWFsbG93ZWQnOlxuICAgICAgICAgIC8vIGlmIHBlcm1pc3Npb24gdG8gdXNlIHRoZSBtaWMgaXMgZGVuaWVkLCB0dXJuIG9mZiBhdXRvLXJlc3RhcnRcbiAgICAgICAgICBhdXRvUmVzdGFydCA9IGZhbHNlO1xuICAgICAgICAgIC8vIGRldGVybWluZSBpZiBwZXJtaXNzaW9uIHdhcyBkZW5pZWQgYnkgdXNlciBvciBhdXRvbWF0aWNhbGx5LlxuICAgICAgICAgIGlmIChuZXcgRGF0ZSgpLmdldFRpbWUoKS1sYXN0U3RhcnRlZEF0IDwgMjAwKSB7XG4gICAgICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLmVycm9yUGVybWlzc2lvbkJsb2NrZWQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLmVycm9yUGVybWlzc2lvbkRlbmllZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICByZWNvZ25pdGlvbi5vbmVuZCAgICAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaXNMaXN0ZW5pbmcgPSBmYWxzZTtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lbmQpO1xuICAgICAgICAvLyBhbm55YW5nIHdpbGwgYXV0byByZXN0YXJ0IGlmIGl0IGlzIGNsb3NlZCBhdXRvbWF0aWNhbGx5IGFuZCBub3QgYnkgdXNlciBhY3Rpb24uXG4gICAgICAgIGlmIChhdXRvUmVzdGFydCkge1xuICAgICAgICAgIC8vIHBsYXkgbmljZWx5IHdpdGggdGhlIGJyb3dzZXIsIGFuZCBuZXZlciByZXN0YXJ0IGFubnlhbmcgYXV0b21hdGljYWxseSBtb3JlIHRoYW4gb25jZSBwZXIgc2Vjb25kXG4gICAgICAgICAgdmFyIHRpbWVTaW5jZUxhc3RTdGFydCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLWxhc3RTdGFydGVkQXQ7XG4gICAgICAgICAgaWYgKHRpbWVTaW5jZUxhc3RTdGFydCA8IDEwMDApIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoYW5ueWFuZy5zdGFydCwgMTAwMC10aW1lU2luY2VMYXN0U3RhcnQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhbm55YW5nLnN0YXJ0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICByZWNvZ25pdGlvbi5vbnJlc3VsdCAgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZihwYXVzZUxpc3RlbmluZykge1xuICAgICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU3BlZWNoIGhlYXJkLCBidXQgYW5ueWFuZyBpcyBwYXVzZWQnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWFwIHRoZSByZXN1bHRzIHRvIGFuIGFycmF5XG4gICAgICAgIHZhciBTcGVlY2hSZWNvZ25pdGlvblJlc3VsdCA9IGV2ZW50LnJlc3VsdHNbZXZlbnQucmVzdWx0SW5kZXhdO1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBrID0gMDsgazxTcGVlY2hSZWNvZ25pdGlvblJlc3VsdC5sZW5ndGg7IGsrKykge1xuICAgICAgICAgIHJlc3VsdHNba10gPSBTcGVlY2hSZWNvZ25pdGlvblJlc3VsdFtrXS50cmFuc2NyaXB0O1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyc2VSZXN1bHRzKHJlc3VsdHMpO1xuICAgICAgfTtcblxuICAgICAgLy8gYnVpbGQgY29tbWFuZHMgbGlzdFxuICAgICAgaWYgKHJlc2V0Q29tbWFuZHMpIHtcbiAgICAgICAgY29tbWFuZHNMaXN0ID0gW107XG4gICAgICB9XG4gICAgICBpZiAoY29tbWFuZHMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZHMoY29tbWFuZHMpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBsaXN0ZW5pbmcuXG4gICAgICogSXQncyBhIGdvb2QgaWRlYSB0byBjYWxsIHRoaXMgYWZ0ZXIgYWRkaW5nIHNvbWUgY29tbWFuZHMgZmlyc3QsIGJ1dCBub3QgbWFuZGF0b3J5LlxuICAgICAqXG4gICAgICogUmVjZWl2ZXMgYW4gb3B0aW9uYWwgb3B0aW9ucyBvYmplY3Qgd2hpY2ggc3VwcG9ydHMgdGhlIGZvbGxvd2luZyBvcHRpb25zOlxuICAgICAqXG4gICAgICogLSBgYXV0b1Jlc3RhcnRgIChib29sZWFuLCBkZWZhdWx0OiB0cnVlKSBTaG91bGQgYW5ueWFuZyByZXN0YXJ0IGl0c2VsZiBpZiBpdCBpcyBjbG9zZWQgaW5kaXJlY3RseSwgYmVjYXVzZSBvZiBzaWxlbmNlIG9yIHdpbmRvdyBjb25mbGljdHM/XG4gICAgICogLSBgY29udGludW91c2AgIChib29sZWFuLCBkZWZhdWx0OiB1bmRlZmluZWQpIEFsbG93IGZvcmNpbmcgY29udGludW91cyBtb2RlIG9uIG9yIG9mZi4gQW5ueWFuZyBpcyBwcmV0dHkgc21hcnQgYWJvdXQgdGhpcywgc28gb25seSBzZXQgdGhpcyBpZiB5b3Uga25vdyB3aGF0IHlvdSdyZSBkb2luZy5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiAvLyBTdGFydCBsaXN0ZW5pbmcsIGRvbid0IHJlc3RhcnQgYXV0b21hdGljYWxseVxuICAgICAqIGFubnlhbmcuc3RhcnQoeyBhdXRvUmVzdGFydDogZmFsc2UgfSk7XG4gICAgICogLy8gU3RhcnQgbGlzdGVuaW5nLCBkb24ndCByZXN0YXJ0IGF1dG9tYXRpY2FsbHksIHN0b3AgcmVjb2duaXRpb24gYWZ0ZXIgZmlyc3QgcGhyYXNlIHJlY29nbml6ZWRcbiAgICAgKiBhbm55YW5nLnN0YXJ0KHsgYXV0b1Jlc3RhcnQ6IGZhbHNlLCBjb250aW51b3VzOiBmYWxzZSB9KTtcbiAgICAgKiBgYGBgXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMuXG4gICAgICogQG1ldGhvZCBzdGFydFxuICAgICAqL1xuICAgIHN0YXJ0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBwYXVzZUxpc3RlbmluZyA9IGZhbHNlO1xuICAgICAgaW5pdElmTmVlZGVkKCk7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIGlmIChvcHRpb25zLmF1dG9SZXN0YXJ0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXV0b1Jlc3RhcnQgPSAhIW9wdGlvbnMuYXV0b1Jlc3RhcnQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdXRvUmVzdGFydCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucy5jb250aW51b3VzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVjb2duaXRpb24uY29udGludW91cyA9ICEhb3B0aW9ucy5jb250aW51b3VzO1xuICAgICAgfVxuXG4gICAgICBsYXN0U3RhcnRlZEF0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICB0cnkge1xuICAgICAgICByZWNvZ25pdGlvbi5zdGFydCgpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coZS5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdG9wIGxpc3RlbmluZywgYW5kIHR1cm4gb2ZmIG1pYy5cbiAgICAgKlxuICAgICAqIEFsdGVybmF0aXZlbHksIHRvIG9ubHkgdGVtcG9yYXJpbHkgcGF1c2UgYW5ueWFuZyByZXNwb25kaW5nIHRvIGNvbW1hbmRzIHdpdGhvdXQgc3RvcHBpbmcgdGhlIFNwZWVjaFJlY29nbml0aW9uIGVuZ2luZSBvciBjbG9zaW5nIHRoZSBtaWMsIHVzZSBwYXVzZSgpIGluc3RlYWQuXG4gICAgICogQHNlZSBbcGF1c2UoKV0oI3BhdXNlKVxuICAgICAqXG4gICAgICogQG1ldGhvZCBhYm9ydFxuICAgICAqL1xuICAgIGFib3J0OiBmdW5jdGlvbigpIHtcbiAgICAgIGF1dG9SZXN0YXJ0ID0gZmFsc2U7XG4gICAgICBpZiAoaXNJbml0aWFsaXplZCgpKSB7XG4gICAgICAgIHJlY29nbml0aW9uLmFib3J0KCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFBhdXNlIGxpc3RlbmluZy4gYW5ueWFuZyB3aWxsIHN0b3AgcmVzcG9uZGluZyB0byBjb21tYW5kcyAodW50aWwgdGhlIHJlc3VtZSBvciBzdGFydCBtZXRob2RzIGFyZSBjYWxsZWQpLCB3aXRob3V0IHR1cm5pbmcgb2ZmIHRoZSBicm93c2VyJ3MgU3BlZWNoUmVjb2duaXRpb24gZW5naW5lIG9yIHRoZSBtaWMuXG4gICAgICpcbiAgICAgKiBBbHRlcm5hdGl2ZWx5LCB0byBzdG9wIHRoZSBTcGVlY2hSZWNvZ25pdGlvbiBlbmdpbmUgYW5kIGNsb3NlIHRoZSBtaWMsIHVzZSBhYm9ydCgpIGluc3RlYWQuXG4gICAgICogQHNlZSBbYWJvcnQoKV0oI2Fib3J0KVxuICAgICAqXG4gICAgICogQG1ldGhvZCBwYXVzZVxuICAgICAqL1xuICAgIHBhdXNlOiBmdW5jdGlvbigpIHtcbiAgICAgIHBhdXNlTGlzdGVuaW5nID0gdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lcyBsaXN0ZW5pbmcgYW5kIHJlc3RvcmVzIGNvbW1hbmQgY2FsbGJhY2sgZXhlY3V0aW9uIHdoZW4gYSByZXN1bHQgbWF0Y2hlcy5cbiAgICAgKiBJZiBTcGVlY2hSZWNvZ25pdGlvbiB3YXMgYWJvcnRlZCAoc3RvcHBlZCksIHN0YXJ0IGl0LlxuICAgICAqXG4gICAgICogQG1ldGhvZCByZXN1bWVcbiAgICAgKi9cbiAgICByZXN1bWU6IGZ1bmN0aW9uKCkge1xuICAgICAgYW5ueWFuZy5zdGFydCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUdXJuIG9uIG91dHB1dCBvZiBkZWJ1ZyBtZXNzYWdlcyB0byB0aGUgY29uc29sZS4gVWdseSwgYnV0IHN1cGVyLWhhbmR5IVxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbbmV3U3RhdGU9dHJ1ZV0gLSBUdXJuIG9uL29mZiBkZWJ1ZyBtZXNzYWdlc1xuICAgICAqIEBtZXRob2QgZGVidWdcbiAgICAgKi9cbiAgICBkZWJ1ZzogZnVuY3Rpb24obmV3U3RhdGUpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBkZWJ1Z1N0YXRlID0gISFuZXdTdGF0ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlYnVnU3RhdGUgPSB0cnVlO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGxhbmd1YWdlIHRoZSB1c2VyIHdpbGwgc3BlYWsgaW4uIElmIHRoaXMgbWV0aG9kIGlzIG5vdCBjYWxsZWQsIGRlZmF1bHRzIHRvICdlbi1VUycuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbGFuZ3VhZ2UgLSBUaGUgbGFuZ3VhZ2UgKGxvY2FsZSlcbiAgICAgKiBAbWV0aG9kIHNldExhbmd1YWdlXG4gICAgICogQHNlZSBbTGFuZ3VhZ2VzXSgjbGFuZ3VhZ2VzKVxuICAgICAqL1xuICAgIHNldExhbmd1YWdlOiBmdW5jdGlvbihsYW5ndWFnZSkge1xuICAgICAgaW5pdElmTmVlZGVkKCk7XG4gICAgICByZWNvZ25pdGlvbi5sYW5nID0gbGFuZ3VhZ2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZCBjb21tYW5kcyB0aGF0IGFubnlhbmcgd2lsbCByZXNwb25kIHRvLiBTaW1pbGFyIGluIHN5bnRheCB0byBpbml0KCksIGJ1dCBkb2Vzbid0IHJlbW92ZSBleGlzdGluZyBjb21tYW5kcy5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiB2YXIgY29tbWFuZHMgPSB7J2hlbGxvIDpuYW1lJzogaGVsbG9GdW5jdGlvbiwgJ2hvd2R5JzogaGVsbG9GdW5jdGlvbn07XG4gICAgICogdmFyIGNvbW1hbmRzMiA9IHsnaGknOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKlxuICAgICAqIGFubnlhbmcuYWRkQ29tbWFuZHMoY29tbWFuZHMpO1xuICAgICAqIGFubnlhbmcuYWRkQ29tbWFuZHMoY29tbWFuZHMyKTtcbiAgICAgKiAvLyBhbm55YW5nIHdpbGwgbm93IGxpc3RlbiB0byBhbGwgdGhyZWUgY29tbWFuZHNcbiAgICAgKiBgYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY29tbWFuZHMgLSBDb21tYW5kcyB0aGF0IGFubnlhbmcgc2hvdWxkIGxpc3RlbiB0b1xuICAgICAqIEBtZXRob2QgYWRkQ29tbWFuZHNcbiAgICAgKiBAc2VlIFtDb21tYW5kcyBPYmplY3RdKCNjb21tYW5kcy1vYmplY3QpXG4gICAgICovXG4gICAgYWRkQ29tbWFuZHM6IGZ1bmN0aW9uKGNvbW1hbmRzKSB7XG4gICAgICB2YXIgY2I7XG5cbiAgICAgIGluaXRJZk5lZWRlZCgpO1xuXG4gICAgICBmb3IgKHZhciBwaHJhc2UgaW4gY29tbWFuZHMpIHtcbiAgICAgICAgaWYgKGNvbW1hbmRzLmhhc093blByb3BlcnR5KHBocmFzZSkpIHtcbiAgICAgICAgICBjYiA9IHJvb3RbY29tbWFuZHNbcGhyYXNlXV0gfHwgY29tbWFuZHNbcGhyYXNlXTtcbiAgICAgICAgICBpZiAodHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IGNvbW1hbmQgdG8gcmVnZXggdGhlbiByZWdpc3RlciB0aGUgY29tbWFuZFxuICAgICAgICAgICAgcmVnaXN0ZXJDb21tYW5kKGNvbW1hbmRUb1JlZ0V4cChwaHJhc2UpLCBjYiwgcGhyYXNlKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjYiA9PT0gJ29iamVjdCcgJiYgY2IucmVnZXhwIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgICAvLyByZWdpc3RlciB0aGUgY29tbWFuZFxuICAgICAgICAgICAgcmVnaXN0ZXJDb21tYW5kKG5ldyBSZWdFeHAoY2IucmVnZXhwLnNvdXJjZSwgJ2knKSwgY2IuY2FsbGJhY2ssIHBocmFzZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDYW4gbm90IHJlZ2lzdGVyIGNvbW1hbmQ6ICVjJytwaHJhc2UsIGRlYnVnU3R5bGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBleGlzdGluZyBjb21tYW5kcy4gQ2FsbGVkIHdpdGggYSBzaW5nbGUgcGhyYXNlLCBhcnJheSBvZiBwaHJhc2VzLCBvciBtZXRob2RpY2FsbHkuIFBhc3Mgbm8gcGFyYW1zIHRvIHJlbW92ZSBhbGwgY29tbWFuZHMuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogdmFyIGNvbW1hbmRzID0geydoZWxsbyc6IGhlbGxvRnVuY3Rpb24sICdob3dkeSc6IGhlbGxvRnVuY3Rpb24sICdoaSc6IGhlbGxvRnVuY3Rpb259O1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIGFsbCBleGlzdGluZyBjb21tYW5kc1xuICAgICAqIGFubnlhbmcucmVtb3ZlQ29tbWFuZHMoKTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCBzb21lIGNvbW1hbmRzXG4gICAgICogYW5ueWFuZy5hZGRDb21tYW5kcyhjb21tYW5kcyk7XG4gICAgICpcbiAgICAgKiAvLyBEb24ndCByZXNwb25kIHRvIGhlbGxvXG4gICAgICogYW5ueWFuZy5yZW1vdmVDb21tYW5kcygnaGVsbG8nKTtcbiAgICAgKlxuICAgICAqIC8vIERvbid0IHJlc3BvbmQgdG8gaG93ZHkgb3IgaGlcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNvbW1hbmRzKFsnaG93ZHknLCAnaGknXSk7XG4gICAgICogYGBgYFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fFVuZGVmaW5lZH0gW2NvbW1hbmRzVG9SZW1vdmVdIC0gQ29tbWFuZHMgdG8gcmVtb3ZlXG4gICAgICogQG1ldGhvZCByZW1vdmVDb21tYW5kc1xuICAgICAqL1xuICAgIHJlbW92ZUNvbW1hbmRzOiBmdW5jdGlvbihjb21tYW5kc1RvUmVtb3ZlKSB7XG4gICAgICBpZiAoY29tbWFuZHNUb1JlbW92ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbW1hbmRzTGlzdCA9IFtdO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb21tYW5kc1RvUmVtb3ZlID0gQXJyYXkuaXNBcnJheShjb21tYW5kc1RvUmVtb3ZlKSA/IGNvbW1hbmRzVG9SZW1vdmUgOiBbY29tbWFuZHNUb1JlbW92ZV07XG4gICAgICBjb21tYW5kc0xpc3QgPSBjb21tYW5kc0xpc3QuZmlsdGVyKGZ1bmN0aW9uKGNvbW1hbmQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGk8Y29tbWFuZHNUb1JlbW92ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChjb21tYW5kc1RvUmVtb3ZlW2ldID09PSBjb21tYW5kLm9yaWdpbmFsUGhyYXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBpbiBjYXNlIG9uZSBvZiB0aGUgZm9sbG93aW5nIGV2ZW50cyBoYXBwZW5zOlxuICAgICAqXG4gICAgICogKiBgc3RhcnRgIC0gRmlyZWQgYXMgc29vbiBhcyB0aGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pdGlvbiBlbmdpbmUgc3RhcnRzIGxpc3RlbmluZ1xuICAgICAqICogYGVycm9yYCAtIEZpcmVkIHdoZW4gdGhlIGJyb3dzZXIncyBTcGVlY2ggUmVjb2dudGlvbiBlbmdpbmUgcmV0dXJucyBhbiBlcnJvciwgdGhpcyBnZW5lcmljIGVycm9yIGNhbGxiYWNrIHdpbGwgYmUgZm9sbG93ZWQgYnkgbW9yZSBhY2N1cmF0ZSBlcnJvciBjYWxsYmFja3MgKGJvdGggd2lsbCBmaXJlIGlmIGJvdGggYXJlIGRlZmluZWQpXG4gICAgICogKiBgZXJyb3JOZXR3b3JrYCAtIEZpcmVkIHdoZW4gU3BlZWNoIFJlY29nbml0aW9uIGZhaWxzIGJlY2F1c2Ugb2YgYSBuZXR3b3JrIGVycm9yXG4gICAgICogKiBgZXJyb3JQZXJtaXNzaW9uQmxvY2tlZGAgLSBGaXJlZCB3aGVuIHRoZSBicm93c2VyIGJsb2NrcyB0aGUgcGVybWlzc2lvbiByZXF1ZXN0IHRvIHVzZSBTcGVlY2ggUmVjb2duaXRpb24uXG4gICAgICogKiBgZXJyb3JQZXJtaXNzaW9uRGVuaWVkYCAtIEZpcmVkIHdoZW4gdGhlIHVzZXIgYmxvY2tzIHRoZSBwZXJtaXNzaW9uIHJlcXVlc3QgdG8gdXNlIFNwZWVjaCBSZWNvZ25pdGlvbi5cbiAgICAgKiAqIGBlbmRgIC0gRmlyZWQgd2hlbiB0aGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pdGlvbiBlbmdpbmUgc3RvcHNcbiAgICAgKiAqIGByZXN1bHRgIC0gRmlyZWQgYXMgc29vbiBhcyBzb21lIHNwZWVjaCB3YXMgaWRlbnRpZmllZC4gVGhpcyBnZW5lcmljIGNhbGxiYWNrIHdpbGwgYmUgZm9sbG93ZWQgYnkgZWl0aGVyIHRoZSBgcmVzdWx0TWF0Y2hgIG9yIGByZXN1bHROb01hdGNoYCBjYWxsYmFja3MuXG4gICAgICogICAgIENhbGxiYWNrIGZ1bmN0aW9ucyByZWdpc3RlcmVkIHRvIHRoaXMgZXZlbnQgd2lsbCBpbmNsdWRlIGFuIGFycmF5IG9mIHBvc3NpYmxlIHBocmFzZXMgdGhlIHVzZXIgc2FpZCBhcyB0aGUgZmlyc3QgYXJndW1lbnRcbiAgICAgKiAqIGByZXN1bHRNYXRjaGAgLSBGaXJlZCB3aGVuIGFubnlhbmcgd2FzIGFibGUgdG8gbWF0Y2ggYmV0d2VlbiB3aGF0IHRoZSB1c2VyIHNhaWQgYW5kIGEgcmVnaXN0ZXJlZCBjb21tYW5kXG4gICAgICogICAgIENhbGxiYWNrIGZ1bmN0aW9ucyByZWdpc3RlcmVkIHRvIHRoaXMgZXZlbnQgd2lsbCBpbmNsdWRlIHRocmVlIGFyZ3VtZW50cyBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICAgICAqICAgICAgICogVGhlIHBocmFzZSB0aGUgdXNlciBzYWlkIHRoYXQgbWF0Y2hlZCBhIGNvbW1hbmRcbiAgICAgKiAgICAgICAqIFRoZSBjb21tYW5kIHRoYXQgd2FzIG1hdGNoZWRcbiAgICAgKiAgICAgICAqIEFuIGFycmF5IG9mIHBvc3NpYmxlIGFsdGVybmF0aXZlIHBocmFzZXMgdGhlIHVzZXIgbWlnaHQndmUgc2FpZFxuICAgICAqICogYHJlc3VsdE5vTWF0Y2hgIC0gRmlyZWQgd2hlbiB3aGF0IHRoZSB1c2VyIHNhaWQgZGlkbid0IG1hdGNoIGFueSBvZiB0aGUgcmVnaXN0ZXJlZCBjb21tYW5kcy5cbiAgICAgKiAgICAgQ2FsbGJhY2sgZnVuY3Rpb25zIHJlZ2lzdGVyZWQgdG8gdGhpcyBldmVudCB3aWxsIGluY2x1ZGUgYW4gYXJyYXkgb2YgcG9zc2libGUgcGhyYXNlcyB0aGUgdXNlciBtaWdodCd2ZSBzYWlkIGFzIHRoZSBmaXJzdCBhcmd1bWVudFxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2Vycm9yJywgZnVuY3Rpb24oKSB7XG4gICAgICogICAkKCcubXlFcnJvclRleHQnKS50ZXh0KCdUaGVyZSB3YXMgYW4gZXJyb3IhJyk7XG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdyZXN1bHRNYXRjaCcsIGZ1bmN0aW9uKHVzZXJTYWlkLCBjb21tYW5kVGV4dCwgcGhyYXNlcykge1xuICAgICAqICAgY29uc29sZS5sb2codXNlclNhaWQpOyAvLyBzYW1wbGUgb3V0cHV0OiAnaGVsbG8nXG4gICAgICogICBjb25zb2xlLmxvZyhjb21tYW5kVGV4dCk7IC8vIHNhbXBsZSBvdXRwdXQ6ICdoZWxsbyAodGhlcmUpJ1xuICAgICAqICAgY29uc29sZS5sb2cocGhyYXNlcyk7IC8vIHNhbXBsZSBvdXRwdXQ6IFsnaGVsbG8nLCAnaGFsbycsICd5ZWxsb3cnLCAncG9sbycsICdoZWxsbyBraXR0eSddXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBwYXNzIGxvY2FsIGNvbnRleHQgdG8gYSBnbG9iYWwgZnVuY3Rpb24gY2FsbGVkIG5vdENvbm5lY3RlZFxuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2Vycm9yTmV0d29yaycsIG5vdENvbm5lY3RlZCwgdGhpcyk7XG4gICAgICogYGBgYFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIC0gTmFtZSBvZiBldmVudCB0aGF0IHdpbGwgdHJpZ2dlciB0aGlzIGNhbGxiYWNrXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCB3aGVuIGV2ZW50IGlzIHRyaWdnZXJlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY29udGV4dF0gLSBPcHRpb25hbCBjb250ZXh0IGZvciB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAbWV0aG9kIGFkZENhbGxiYWNrXG4gICAgICovXG4gICAgYWRkQ2FsbGJhY2s6IGZ1bmN0aW9uKHR5cGUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgICBpZiAoY2FsbGJhY2tzW3R5cGVdICA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBjYiA9IHJvb3RbY2FsbGJhY2tdIHx8IGNhbGxiYWNrO1xuICAgICAgaWYgKHR5cGVvZiBjYiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjYWxsYmFja3NbdHlwZV0ucHVzaCh7Y2FsbGJhY2s6IGNiLCBjb250ZXh0OiBjb250ZXh0IHx8IHRoaXN9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGNhbGxiYWNrcyBmcm9tIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIC0gUGFzcyBhbiBldmVudCBuYW1lIGFuZCBhIGNhbGxiYWNrIGNvbW1hbmQgdG8gcmVtb3ZlIHRoYXQgY2FsbGJhY2sgY29tbWFuZCBmcm9tIHRoYXQgZXZlbnQgdHlwZS5cbiAgICAgKiAtIFBhc3MganVzdCBhbiBldmVudCBuYW1lIHRvIHJlbW92ZSBhbGwgY2FsbGJhY2sgY29tbWFuZHMgZnJvbSB0aGF0IGV2ZW50IHR5cGUuXG4gICAgICogLSBQYXNzIHVuZGVmaW5lZCBhcyBldmVudCBuYW1lIGFuZCBhIGNhbGxiYWNrIGNvbW1hbmQgdG8gcmVtb3ZlIHRoYXQgY2FsbGJhY2sgY29tbWFuZCBmcm9tIGFsbCBldmVudCB0eXBlcy5cbiAgICAgKiAtIFBhc3Mgbm8gcGFyYW1zIHRvIHJlbW92ZSBhbGwgY2FsbGJhY2sgY29tbWFuZHMgZnJvbSBhbGwgZXZlbnQgdHlwZXMuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnc3RhcnQnLCBteUZ1bmN0aW9uMSk7XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnc3RhcnQnLCBteUZ1bmN0aW9uMik7XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnZW5kJywgbXlGdW5jdGlvbjEpO1xuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2VuZCcsIG15RnVuY3Rpb24yKTtcbiAgICAgKlxuICAgICAqIC8vIFJlbW92ZSBhbGwgY2FsbGJhY2tzIGZyb20gYWxsIGV2ZW50czpcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNhbGxiYWNrKCk7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgYWxsIGNhbGxiYWNrcyBhdHRhY2hlZCB0byBlbmQgZXZlbnQ6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjaygnZW5kJyk7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgbXlGdW5jdGlvbjIgZnJvbSBiZWluZyBjYWxsZWQgb24gc3RhcnQ6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjaygnc3RhcnQnLCBteUZ1bmN0aW9uMik7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgbXlGdW5jdGlvbjEgZnJvbSBiZWluZyBjYWxsZWQgb24gYWxsIGV2ZW50czpcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNhbGxiYWNrKHVuZGVmaW5lZCwgbXlGdW5jdGlvbjEpO1xuICAgICAqIGBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0eXBlIE5hbWUgb2YgZXZlbnQgdHlwZSB0byByZW1vdmUgY2FsbGJhY2sgZnJvbVxuICAgICAqIEBwYXJhbSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcmVtb3ZlXG4gICAgICogQHJldHVybnMgdW5kZWZpbmVkXG4gICAgICogQG1ldGhvZCByZW1vdmVDYWxsYmFja1xuICAgICAqL1xuICAgIHJlbW92ZUNhbGxiYWNrOiBmdW5jdGlvbih0eXBlLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGNvbXBhcmVXaXRoQ2FsbGJhY2tQYXJhbWV0ZXIgPSBmdW5jdGlvbihjYikge1xuICAgICAgICByZXR1cm4gY2IuY2FsbGJhY2sgIT09IGNhbGxiYWNrO1xuICAgICAgfTtcbiAgICAgIC8vIEdvIG92ZXIgZWFjaCBjYWxsYmFjayB0eXBlIGluIGNhbGxiYWNrcyBzdG9yZSBvYmplY3RcbiAgICAgIGZvciAodmFyIGNhbGxiYWNrVHlwZSBpbiBjYWxsYmFja3MpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrcy5oYXNPd25Qcm9wZXJ0eShjYWxsYmFja1R5cGUpKSB7XG4gICAgICAgICAgLy8gaWYgdGhpcyBpcyB0aGUgdHlwZSB1c2VyIGFza2VkIHRvIGRlbGV0ZSwgb3IgaGUgYXNrZWQgdG8gZGVsZXRlIGFsbCwgZ28gYWhlYWQuXG4gICAgICAgICAgaWYgKHR5cGUgPT09IHVuZGVmaW5lZCB8fCB0eXBlID09PSBjYWxsYmFja1R5cGUpIHtcbiAgICAgICAgICAgIC8vIElmIHVzZXIgYXNrZWQgdG8gZGVsZXRlIGFsbCBjYWxsYmFja3MgaW4gdGhpcyB0eXBlIG9yIGFsbCB0eXBlc1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja3NbY2FsbGJhY2tUeXBlXSA9IFtdO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBhbGwgbWF0Y2hpbmcgY2FsbGJhY2tzXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzW2NhbGxiYWNrVHlwZV0gPSBjYWxsYmFja3NbY2FsbGJhY2tUeXBlXS5maWx0ZXIoY29tcGFyZVdpdGhDYWxsYmFja1BhcmFtZXRlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiBzcGVlY2ggcmVjb2duaXRpb24gaXMgY3VycmVudGx5IG9uLlxuICAgICAqIFJldHVybnMgZmFsc2UgaWYgc3BlZWNoIHJlY29nbml0aW9uIGlzIG9mZiBvciBhbm55YW5nIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm4gYm9vbGVhbiB0cnVlID0gU3BlZWNoUmVjb2duaXRpb24gaXMgb24gYW5kIGFubnlhbmcgaXMgbGlzdGVuaW5nXG4gICAgICogQG1ldGhvZCBpc0xpc3RlbmluZ1xuICAgICAqL1xuICAgIGlzTGlzdGVuaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBpc0xpc3RlbmluZyAmJiAhcGF1c2VMaXN0ZW5pbmc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGluc3RhbmNlIG9mIHRoZSBicm93c2VyJ3MgU3BlZWNoUmVjb2duaXRpb24gb2JqZWN0IHVzZWQgYnkgYW5ueWFuZy5cbiAgICAgKiBVc2VmdWwgaW4gY2FzZSB5b3Ugd2FudCBkaXJlY3QgYWNjZXNzIHRvIHRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbml0aW9uIGVuZ2luZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIFNwZWVjaFJlY29nbml0aW9uIFRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbml6ZXIgY3VycmVudGx5IHVzZWQgYnkgYW5ueWFuZ1xuICAgICAqIEBtZXRob2QgZ2V0U3BlZWNoUmVjb2duaXplclxuICAgICAqL1xuICAgIGdldFNwZWVjaFJlY29nbml6ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHJlY29nbml0aW9uO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTaW11bGF0ZSBzcGVlY2ggYmVpbmcgcmVjb2duaXplZC4gVGhpcyB3aWxsIHRyaWdnZXIgdGhlIHNhbWUgZXZlbnRzIGFuZCBiZWhhdmlvciBhcyB3aGVuIHRoZSBTcGVlY2ggUmVjb2duaXRpb25cbiAgICAgKiBkZXRlY3RzIHNwZWVjaC5cbiAgICAgKlxuICAgICAqIENhbiBhY2NlcHQgZWl0aGVyIGEgc3RyaW5nIGNvbnRhaW5pbmcgYSBzaW5nbGUgc2VudGVuY2UsIG9yIGFuIGFycmF5IGNvbnRhaW5pbmcgbXVsdGlwbGUgc2VudGVuY2VzIHRvIGJlIGNoZWNrZWRcbiAgICAgKiBpbiBvcmRlciB1bnRpbCBvbmUgb2YgdGhlbSBtYXRjaGVzIGEgY29tbWFuZCAoc2ltaWxhciB0byB0aGUgd2F5IFNwZWVjaCBSZWNvZ25pdGlvbiBBbHRlcm5hdGl2ZXMgYXJlIHBhcnNlZClcbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiBhbm55YW5nLnRyaWdnZXIoJ1RpbWUgZm9yIHNvbWUgdGhyaWxsaW5nIGhlcm9pY3MnKTtcbiAgICAgKiBhbm55YW5nLnRyaWdnZXIoXG4gICAgICogICAgIFsnVGltZSBmb3Igc29tZSB0aHJpbGxpbmcgaGVyb2ljcycsICdUaW1lIGZvciBzb21lIHRocmlsbGluZyBhZXJvYmljcyddXG4gICAgICogICApO1xuICAgICAqIGBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSBzdHJpbmd8YXJyYXkgc2VudGVuY2VzIEEgc2VudGVuY2UgYXMgYSBzdHJpbmcgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvZiBwb3NzaWJsZSBzZW50ZW5jZXNcbiAgICAgKiBAcmV0dXJucyB1bmRlZmluZWRcbiAgICAgKiBAbWV0aG9kIHRyaWdnZXJcbiAgICAgKi9cbiAgICB0cmlnZ2VyOiBmdW5jdGlvbihzZW50ZW5jZXMpIHtcbiAgICAgIC8qXG4gICAgICBpZighYW5ueWFuZy5pc0xpc3RlbmluZygpKSB7XG4gICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgaWYgKCFpc0xpc3RlbmluZykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0Nhbm5vdCB0cmlnZ2VyIHdoaWxlIGFubnlhbmcgaXMgYWJvcnRlZCcpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU3BlZWNoIGhlYXJkLCBidXQgYW5ueWFuZyBpcyBwYXVzZWQnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgKi9cblxuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHNlbnRlbmNlcykpIHtcbiAgICAgICAgc2VudGVuY2VzID0gW3NlbnRlbmNlc107XG4gICAgICB9XG5cbiAgICAgIHBhcnNlUmVzdWx0cyhzZW50ZW5jZXMpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gYW5ueWFuZztcblxufSkpO1xuXG4vKipcbiAqICMgR29vZCB0byBLbm93XG4gKlxuICogIyMgQ29tbWFuZHMgT2JqZWN0XG4gKlxuICogQm90aCB0aGUgW2luaXQoKV0oKSBhbmQgYWRkQ29tbWFuZHMoKSBtZXRob2RzIHJlY2VpdmUgYSBgY29tbWFuZHNgIG9iamVjdC5cbiAqXG4gKiBhbm55YW5nIHVuZGVyc3RhbmRzIGNvbW1hbmRzIHdpdGggYG5hbWVkIHZhcmlhYmxlc2AsIGBzcGxhdHNgLCBhbmQgYG9wdGlvbmFsIHdvcmRzYC5cbiAqXG4gKiAqIFVzZSBgbmFtZWQgdmFyaWFibGVzYCBmb3Igb25lIHdvcmQgYXJndW1lbnRzIGluIHlvdXIgY29tbWFuZC5cbiAqICogVXNlIGBzcGxhdHNgIHRvIGNhcHR1cmUgbXVsdGktd29yZCB0ZXh0IGF0IHRoZSBlbmQgb2YgeW91ciBjb21tYW5kIChncmVlZHkpLlxuICogKiBVc2UgYG9wdGlvbmFsIHdvcmRzYCBvciBwaHJhc2VzIHRvIGRlZmluZSBhIHBhcnQgb2YgdGhlIGNvbW1hbmQgYXMgb3B0aW9uYWwuXG4gKlxuICogIyMjIyBFeGFtcGxlczpcbiAqIGBgYGBodG1sXG4gKiA8c2NyaXB0PlxuICogdmFyIGNvbW1hbmRzID0ge1xuICogICAvLyBhbm55YW5nIHdpbGwgY2FwdHVyZSBhbnl0aGluZyBhZnRlciBhIHNwbGF0ICgqKSBhbmQgcGFzcyBpdCB0byB0aGUgZnVuY3Rpb24uXG4gKiAgIC8vIGUuZy4gc2F5aW5nIFwiU2hvdyBtZSBCYXRtYW4gYW5kIFJvYmluXCIgd2lsbCBjYWxsIHNob3dGbGlja3IoJ0JhdG1hbiBhbmQgUm9iaW4nKTtcbiAqICAgJ3Nob3cgbWUgKnRhZyc6IHNob3dGbGlja3IsXG4gKlxuICogICAvLyBBIG5hbWVkIHZhcmlhYmxlIGlzIGEgb25lIHdvcmQgdmFyaWFibGUsIHRoYXQgY2FuIGZpdCBhbnl3aGVyZSBpbiB5b3VyIGNvbW1hbmQuXG4gKiAgIC8vIGUuZy4gc2F5aW5nIFwiY2FsY3VsYXRlIE9jdG9iZXIgc3RhdHNcIiB3aWxsIGNhbGwgY2FsY3VsYXRlU3RhdHMoJ09jdG9iZXInKTtcbiAqICAgJ2NhbGN1bGF0ZSA6bW9udGggc3RhdHMnOiBjYWxjdWxhdGVTdGF0cyxcbiAqXG4gKiAgIC8vIEJ5IGRlZmluaW5nIGEgcGFydCBvZiB0aGUgZm9sbG93aW5nIGNvbW1hbmQgYXMgb3B0aW9uYWwsIGFubnlhbmcgd2lsbCByZXNwb25kXG4gKiAgIC8vIHRvIGJvdGg6IFwic2F5IGhlbGxvIHRvIG15IGxpdHRsZSBmcmllbmRcIiBhcyB3ZWxsIGFzIFwic2F5IGhlbGxvIGZyaWVuZFwiXG4gKiAgICdzYXkgaGVsbG8gKHRvIG15IGxpdHRsZSkgZnJpZW5kJzogZ3JlZXRpbmdcbiAqIH07XG4gKlxuICogdmFyIHNob3dGbGlja3IgPSBmdW5jdGlvbih0YWcpIHtcbiAqICAgdmFyIHVybCA9ICdodHRwOi8vYXBpLmZsaWNrci5jb20vc2VydmljZXMvcmVzdC8/dGFncz0nK3RhZztcbiAqICAgJC5nZXRKU09OKHVybCk7XG4gKiB9XG4gKlxuICogdmFyIGNhbGN1bGF0ZVN0YXRzID0gZnVuY3Rpb24obW9udGgpIHtcbiAqICAgJCgnI3N0YXRzJykudGV4dCgnU3RhdGlzdGljcyBmb3IgJyttb250aCk7XG4gKiB9XG4gKlxuICogdmFyIGdyZWV0aW5nID0gZnVuY3Rpb24oKSB7XG4gKiAgICQoJyNncmVldGluZycpLnRleHQoJ0hlbGxvIScpO1xuICogfVxuICogPC9zY3JpcHQ+XG4gKiBgYGBgXG4gKlxuICogIyMjIFVzaW5nIFJlZ3VsYXIgRXhwcmVzc2lvbnMgaW4gY29tbWFuZHNcbiAqIEZvciBhZHZhbmNlZCBjb21tYW5kcywgeW91IGNhbiBwYXNzIGEgcmVndWxhciBleHByZXNzaW9uIG9iamVjdCwgaW5zdGVhZCBvZlxuICogYSBzaW1wbGUgc3RyaW5nIGNvbW1hbmQuXG4gKlxuICogVGhpcyBpcyBkb25lIGJ5IHBhc3NpbmcgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdHdvIHByb3BlcnRpZXM6IGByZWdleHBgLCBhbmRcbiAqIGBjYWxsYmFja2AgaW5zdGVhZCBvZiB0aGUgZnVuY3Rpb24uXG4gKlxuICogIyMjIyBFeGFtcGxlczpcbiAqIGBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgY2FsY3VsYXRlRnVuY3Rpb24gPSBmdW5jdGlvbihtb250aCkgeyBjb25zb2xlLmxvZyhtb250aCk7IH1cbiAqIHZhciBjb21tYW5kcyA9IHtcbiAqICAgLy8gVGhpcyBleGFtcGxlIHdpbGwgYWNjZXB0IGFueSB3b3JkIGFzIHRoZSBcIm1vbnRoXCJcbiAqICAgJ2NhbGN1bGF0ZSA6bW9udGggc3RhdHMnOiBjYWxjdWxhdGVGdW5jdGlvbixcbiAqICAgLy8gVGhpcyBleGFtcGxlIHdpbGwgb25seSBhY2NlcHQgbW9udGhzIHdoaWNoIGFyZSBhdCB0aGUgc3RhcnQgb2YgYSBxdWFydGVyXG4gKiAgICdjYWxjdWxhdGUgOnF1YXJ0ZXIgc3RhdHMnOiB7J3JlZ2V4cCc6IC9eY2FsY3VsYXRlIChKYW51YXJ5fEFwcmlsfEp1bHl8T2N0b2Jlcikgc3RhdHMkLywgJ2NhbGxiYWNrJzogY2FsY3VsYXRlRnVuY3Rpb259XG4gKiB9XG4gYGBgYFxuICpcbiAqICMjIExhbmd1YWdlc1xuICpcbiAqIFdoaWxlIHRoZXJlIGlzbid0IGFuIG9mZmljaWFsIGxpc3Qgb2Ygc3VwcG9ydGVkIGxhbmd1YWdlcyAoY3VsdHVyZXM/IGxvY2FsZXM/KSwgaGVyZSBpcyBhIGxpc3QgYmFzZWQgb24gW2FuZWNkb3RhbCBldmlkZW5jZV0oaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTQzMDIxMzQvMzM4MDM5KS5cbiAqXG4gKiAqIEFmcmlrYWFucyBgYWZgXG4gKiAqIEJhc3F1ZSBgZXVgXG4gKiAqIEJ1bGdhcmlhbiBgYmdgXG4gKiAqIENhdGFsYW4gYGNhYFxuICogKiBBcmFiaWMgKEVneXB0KSBgYXItRUdgXG4gKiAqIEFyYWJpYyAoSm9yZGFuKSBgYXItSk9gXG4gKiAqIEFyYWJpYyAoS3V3YWl0KSBgYXItS1dgXG4gKiAqIEFyYWJpYyAoTGViYW5vbikgYGFyLUxCYFxuICogKiBBcmFiaWMgKFFhdGFyKSBgYXItUUFgXG4gKiAqIEFyYWJpYyAoVUFFKSBgYXItQUVgXG4gKiAqIEFyYWJpYyAoTW9yb2NjbykgYGFyLU1BYFxuICogKiBBcmFiaWMgKElyYXEpIGBhci1JUWBcbiAqICogQXJhYmljIChBbGdlcmlhKSBgYXItRFpgXG4gKiAqIEFyYWJpYyAoQmFocmFpbikgYGFyLUJIYFxuICogKiBBcmFiaWMgKEx5YmlhKSBgYXItTFlgXG4gKiAqIEFyYWJpYyAoT21hbikgYGFyLU9NYFxuICogKiBBcmFiaWMgKFNhdWRpIEFyYWJpYSkgYGFyLVNBYFxuICogKiBBcmFiaWMgKFR1bmlzaWEpIGBhci1UTmBcbiAqICogQXJhYmljIChZZW1lbikgYGFyLVlFYFxuICogKiBDemVjaCBgY3NgXG4gKiAqIER1dGNoIGBubC1OTGBcbiAqICogRW5nbGlzaCAoQXVzdHJhbGlhKSBgZW4tQVVgXG4gKiAqIEVuZ2xpc2ggKENhbmFkYSkgYGVuLUNBYFxuICogKiBFbmdsaXNoIChJbmRpYSkgYGVuLUlOYFxuICogKiBFbmdsaXNoIChOZXcgWmVhbGFuZCkgYGVuLU5aYFxuICogKiBFbmdsaXNoIChTb3V0aCBBZnJpY2EpIGBlbi1aQWBcbiAqICogRW5nbGlzaChVSykgYGVuLUdCYFxuICogKiBFbmdsaXNoKFVTKSBgZW4tVVNgXG4gKiAqIEZpbm5pc2ggYGZpYFxuICogKiBGcmVuY2ggYGZyLUZSYFxuICogKiBHYWxpY2lhbiBgZ2xgXG4gKiAqIEdlcm1hbiBgZGUtREVgXG4gKiAqIEhlYnJldyBgaGVgXG4gKiAqIEh1bmdhcmlhbiBgaHVgXG4gKiAqIEljZWxhbmRpYyBgaXNgXG4gKiAqIEl0YWxpYW4gYGl0LUlUYFxuICogKiBJbmRvbmVzaWFuIGBpZGBcbiAqICogSmFwYW5lc2UgYGphYFxuICogKiBLb3JlYW4gYGtvYFxuICogKiBMYXRpbiBgbGFgXG4gKiAqIE1hbmRhcmluIENoaW5lc2UgYHpoLUNOYFxuICogKiBUcmFkaXRpb25hbCBUYWl3YW4gYHpoLVRXYFxuICogKiBTaW1wbGlmaWVkIENoaW5hIHpoLUNOIGA/YFxuICogKiBTaW1wbGlmaWVkIEhvbmcgS29uZyBgemgtSEtgXG4gKiAqIFl1ZSBDaGluZXNlIChUcmFkaXRpb25hbCBIb25nIEtvbmcpIGB6aC15dWVgXG4gKiAqIE1hbGF5c2lhbiBgbXMtTVlgXG4gKiAqIE5vcndlZ2lhbiBgbm8tTk9gXG4gKiAqIFBvbGlzaCBgcGxgXG4gKiAqIFBpZyBMYXRpbiBgeHgtcGlnbGF0aW5gXG4gKiAqIFBvcnR1Z3Vlc2UgYHB0LVBUYFxuICogKiBQb3J0dWd1ZXNlIChCcmFzaWwpIGBwdC1CUmBcbiAqICogUm9tYW5pYW4gYHJvLVJPYFxuICogKiBSdXNzaWFuIGBydWBcbiAqICogU2VyYmlhbiBgc3ItU1BgXG4gKiAqIFNsb3ZhayBgc2tgXG4gKiAqIFNwYW5pc2ggKEFyZ2VudGluYSkgYGVzLUFSYFxuICogKiBTcGFuaXNoIChCb2xpdmlhKSBgZXMtQk9gXG4gKiAqIFNwYW5pc2ggKENoaWxlKSBgZXMtQ0xgXG4gKiAqIFNwYW5pc2ggKENvbG9tYmlhKSBgZXMtQ09gXG4gKiAqIFNwYW5pc2ggKENvc3RhIFJpY2EpIGBlcy1DUmBcbiAqICogU3BhbmlzaCAoRG9taW5pY2FuIFJlcHVibGljKSBgZXMtRE9gXG4gKiAqIFNwYW5pc2ggKEVjdWFkb3IpIGBlcy1FQ2BcbiAqICogU3BhbmlzaCAoRWwgU2FsdmFkb3IpIGBlcy1TVmBcbiAqICogU3BhbmlzaCAoR3VhdGVtYWxhKSBgZXMtR1RgXG4gKiAqIFNwYW5pc2ggKEhvbmR1cmFzKSBgZXMtSE5gXG4gKiAqIFNwYW5pc2ggKE1leGljbykgYGVzLU1YYFxuICogKiBTcGFuaXNoIChOaWNhcmFndWEpIGBlcy1OSWBcbiAqICogU3BhbmlzaCAoUGFuYW1hKSBgZXMtUEFgXG4gKiAqIFNwYW5pc2ggKFBhcmFndWF5KSBgZXMtUFlgXG4gKiAqIFNwYW5pc2ggKFBlcnUpIGBlcy1QRWBcbiAqICogU3BhbmlzaCAoUHVlcnRvIFJpY28pIGBlcy1QUmBcbiAqICogU3BhbmlzaCAoU3BhaW4pIGBlcy1FU2BcbiAqICogU3BhbmlzaCAoVVMpIGBlcy1VU2BcbiAqICogU3BhbmlzaCAoVXJ1Z3VheSkgYGVzLVVZYFxuICogKiBTcGFuaXNoIChWZW5lenVlbGEpIGBlcy1WRWBcbiAqICogU3dlZGlzaCBgc3YtU0VgXG4gKiAqIFR1cmtpc2ggYHRyYFxuICogKiBadWx1IGB6dWBcbiAqXG4gKiAjIyBEZXZlbG9waW5nXG4gKlxuICogUHJlcmVxdWlzaXRpZXM6IG5vZGUuanNcbiAqXG4gKiBGaXJzdCwgaW5zdGFsbCBkZXBlbmRlbmNpZXMgaW4geW91ciBsb2NhbCBhbm55YW5nIGNvcHk6XG4gKlxuICogICAgIG5wbSBpbnN0YWxsXG4gKlxuICogTWFrZSBzdXJlIHRvIHJ1biB0aGUgZGVmYXVsdCBncnVudCB0YXNrIGFmdGVyIGVhY2ggY2hhbmdlIHRvIGFubnlhbmcuanMuIFRoaXMgY2FuIGFsc28gYmUgZG9uZSBhdXRvbWF0aWNhbGx5IGJ5IHJ1bm5pbmc6XG4gKlxuICogICAgIGdydW50IHdhdGNoXG4gKlxuICogWW91IGNhbiBhbHNvIHJ1biBhIGxvY2FsIHNlcnZlciBmb3IgdGVzdGluZyB5b3VyIHdvcmsgd2l0aDpcbiAqXG4gKiAgICAgZ3J1bnQgZGV2XG4gKlxuICogUG9pbnQgeW91ciBicm93c2VyIHRvIGBodHRwczovL2xvY2FsaG9zdDo4NDQzL2RlbW8vYCB0byBzZWUgdGhlIGRlbW8gcGFnZS5cbiAqIFNpbmNlIGl0J3MgdXNpbmcgc2VsZi1zaWduZWQgY2VydGlmaWNhdGUsIHlvdSBtaWdodCBuZWVkIHRvIGNsaWNrICpcIlByb2NlZWQgQW55d2F5XCIqLlxuICpcbiAqIEZvciBtb3JlIGluZm8sIGNoZWNrIG91dCB0aGUgW0NPTlRSSUJVVElOR10oaHR0cHM6Ly9naXRodWIuY29tL1RhbEF0ZXIvYW5ueWFuZy9ibG9iL21hc3Rlci9DT05UUklCVVRJTkcubWQpIGZpbGVcbiAqXG4gKi9cbiIsInZhciBWTm9kZSA9IHJlcXVpcmUoJy4vdm5vZGUnKTtcbnZhciBpcyA9IHJlcXVpcmUoJy4vaXMnKTtcblxuZnVuY3Rpb24gYWRkTlMoZGF0YSwgY2hpbGRyZW4pIHtcbiAgZGF0YS5ucyA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc7XG4gIGlmIChjaGlsZHJlbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgYWRkTlMoY2hpbGRyZW5baV0uZGF0YSwgY2hpbGRyZW5baV0uY2hpbGRyZW4pO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGgoc2VsLCBiLCBjKSB7XG4gIHZhciBkYXRhID0ge30sIGNoaWxkcmVuLCB0ZXh0LCBpO1xuICBpZiAoYyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgZGF0YSA9IGI7XG4gICAgaWYgKGlzLmFycmF5KGMpKSB7IGNoaWxkcmVuID0gYzsgfVxuICAgIGVsc2UgaWYgKGlzLnByaW1pdGl2ZShjKSkgeyB0ZXh0ID0gYzsgfVxuICB9IGVsc2UgaWYgKGIgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmIChpcy5hcnJheShiKSkgeyBjaGlsZHJlbiA9IGI7IH1cbiAgICBlbHNlIGlmIChpcy5wcmltaXRpdmUoYikpIHsgdGV4dCA9IGI7IH1cbiAgICBlbHNlIHsgZGF0YSA9IGI7IH1cbiAgfVxuICBpZiAoaXMuYXJyYXkoY2hpbGRyZW4pKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICBpZiAoaXMucHJpbWl0aXZlKGNoaWxkcmVuW2ldKSkgY2hpbGRyZW5baV0gPSBWTm9kZSh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBjaGlsZHJlbltpXSk7XG4gICAgfVxuICB9XG4gIGlmIChzZWxbMF0gPT09ICdzJyAmJiBzZWxbMV0gPT09ICd2JyAmJiBzZWxbMl0gPT09ICdnJykge1xuICAgIGFkZE5TKGRhdGEsIGNoaWxkcmVuKTtcbiAgfVxuICByZXR1cm4gVk5vZGUoc2VsLCBkYXRhLCBjaGlsZHJlbiwgdGV4dCwgdW5kZWZpbmVkKTtcbn07XG4iLCJmdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWUpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgcXVhbGlmaWVkTmFtZSl7XG4gIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMobmFtZXNwYWNlVVJJLCBxdWFsaWZpZWROYW1lKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVGV4dE5vZGUodGV4dCl7XG4gIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZXh0KTtcbn1cblxuXG5mdW5jdGlvbiBpbnNlcnRCZWZvcmUocGFyZW50Tm9kZSwgbmV3Tm9kZSwgcmVmZXJlbmNlTm9kZSl7XG4gIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKG5ld05vZGUsIHJlZmVyZW5jZU5vZGUpO1xufVxuXG5cbmZ1bmN0aW9uIHJlbW92ZUNoaWxkKG5vZGUsIGNoaWxkKXtcbiAgbm9kZS5yZW1vdmVDaGlsZChjaGlsZCk7XG59XG5cbmZ1bmN0aW9uIGFwcGVuZENoaWxkKG5vZGUsIGNoaWxkKXtcbiAgbm9kZS5hcHBlbmRDaGlsZChjaGlsZCk7XG59XG5cbmZ1bmN0aW9uIHBhcmVudE5vZGUobm9kZSl7XG4gIHJldHVybiBub2RlLnBhcmVudEVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIG5leHRTaWJsaW5nKG5vZGUpe1xuICByZXR1cm4gbm9kZS5uZXh0U2libGluZztcbn1cblxuZnVuY3Rpb24gdGFnTmFtZShub2RlKXtcbiAgcmV0dXJuIG5vZGUudGFnTmFtZTtcbn1cblxuZnVuY3Rpb24gc2V0VGV4dENvbnRlbnQobm9kZSwgdGV4dCl7XG4gIG5vZGUudGV4dENvbnRlbnQgPSB0ZXh0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgY3JlYXRlRWxlbWVudDogY3JlYXRlRWxlbWVudCxcbiAgY3JlYXRlRWxlbWVudE5TOiBjcmVhdGVFbGVtZW50TlMsXG4gIGNyZWF0ZVRleHROb2RlOiBjcmVhdGVUZXh0Tm9kZSxcbiAgYXBwZW5kQ2hpbGQ6IGFwcGVuZENoaWxkLFxuICByZW1vdmVDaGlsZDogcmVtb3ZlQ2hpbGQsXG4gIGluc2VydEJlZm9yZTogaW5zZXJ0QmVmb3JlLFxuICBwYXJlbnROb2RlOiBwYXJlbnROb2RlLFxuICBuZXh0U2libGluZzogbmV4dFNpYmxpbmcsXG4gIHRhZ05hbWU6IHRhZ05hbWUsXG4gIHNldFRleHRDb250ZW50OiBzZXRUZXh0Q29udGVudFxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBhcnJheTogQXJyYXkuaXNBcnJheSxcbiAgcHJpbWl0aXZlOiBmdW5jdGlvbihzKSB7IHJldHVybiB0eXBlb2YgcyA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHMgPT09ICdudW1iZXInOyB9LFxufTtcbiIsImZ1bmN0aW9uIHVwZGF0ZUNsYXNzKG9sZFZub2RlLCB2bm9kZSkge1xuICB2YXIgY3VyLCBuYW1lLCBlbG0gPSB2bm9kZS5lbG0sXG4gICAgICBvbGRDbGFzcyA9IG9sZFZub2RlLmRhdGEuY2xhc3MgfHwge30sXG4gICAgICBrbGFzcyA9IHZub2RlLmRhdGEuY2xhc3MgfHwge307XG4gIGZvciAobmFtZSBpbiBvbGRDbGFzcykge1xuICAgIGlmICgha2xhc3NbbmFtZV0pIHtcbiAgICAgIGVsbS5jbGFzc0xpc3QucmVtb3ZlKG5hbWUpO1xuICAgIH1cbiAgfVxuICBmb3IgKG5hbWUgaW4ga2xhc3MpIHtcbiAgICBjdXIgPSBrbGFzc1tuYW1lXTtcbiAgICBpZiAoY3VyICE9PSBvbGRDbGFzc1tuYW1lXSkge1xuICAgICAgZWxtLmNsYXNzTGlzdFtjdXIgPyAnYWRkJyA6ICdyZW1vdmUnXShuYW1lKTtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7Y3JlYXRlOiB1cGRhdGVDbGFzcywgdXBkYXRlOiB1cGRhdGVDbGFzc307XG4iLCJ2YXIgaXMgPSByZXF1aXJlKCcuLi9pcycpO1xuXG5mdW5jdGlvbiBhcnJJbnZva2VyKGFycikge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCFhcnIubGVuZ3RoKSByZXR1cm47XG4gICAgLy8gU3BlY2lhbCBjYXNlIHdoZW4gbGVuZ3RoIGlzIHR3bywgZm9yIHBlcmZvcm1hbmNlXG4gICAgYXJyLmxlbmd0aCA9PT0gMiA/IGFyclswXShhcnJbMV0pIDogYXJyWzBdLmFwcGx5KHVuZGVmaW5lZCwgYXJyLnNsaWNlKDEpKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZm5JbnZva2VyKG8pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGV2KSB7IFxuICAgIGlmIChvLmZuID09PSBudWxsKSByZXR1cm47XG4gICAgby5mbihldik7IFxuICB9O1xufVxuXG5mdW5jdGlvbiB1cGRhdGVFdmVudExpc3RlbmVycyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIG5hbWUsIGN1ciwgb2xkLCBlbG0gPSB2bm9kZS5lbG0sXG4gICAgICBvbGRPbiA9IG9sZFZub2RlLmRhdGEub24gfHwge30sIG9uID0gdm5vZGUuZGF0YS5vbjtcbiAgaWYgKCFvbikgcmV0dXJuO1xuICBmb3IgKG5hbWUgaW4gb24pIHtcbiAgICBjdXIgPSBvbltuYW1lXTtcbiAgICBvbGQgPSBvbGRPbltuYW1lXTtcbiAgICBpZiAob2xkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChpcy5hcnJheShjdXIpKSB7XG4gICAgICAgIGVsbS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGFyckludm9rZXIoY3VyKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjdXIgPSB7Zm46IGN1cn07XG4gICAgICAgIG9uW25hbWVdID0gY3VyO1xuICAgICAgICBlbG0uYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBmbkludm9rZXIoY3VyKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChpcy5hcnJheShvbGQpKSB7XG4gICAgICAvLyBEZWxpYmVyYXRlbHkgbW9kaWZ5IG9sZCBhcnJheSBzaW5jZSBpdCdzIGNhcHR1cmVkIGluIGNsb3N1cmUgY3JlYXRlZCB3aXRoIGBhcnJJbnZva2VyYFxuICAgICAgb2xkLmxlbmd0aCA9IGN1ci5sZW5ndGg7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG9sZC5sZW5ndGg7ICsraSkgb2xkW2ldID0gY3VyW2ldO1xuICAgICAgb25bbmFtZV0gID0gb2xkO1xuICAgIH0gZWxzZSB7XG4gICAgICBvbGQuZm4gPSBjdXI7XG4gICAgICBvbltuYW1lXSA9IG9sZDtcbiAgICB9XG4gIH1cbiAgaWYgKG9sZE9uKSB7XG4gICAgZm9yIChuYW1lIGluIG9sZE9uKSB7XG4gICAgICBpZiAob25bbmFtZV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICB2YXIgb2xkID0gb2xkT25bbmFtZV07XG4gICAgICAgIGlmIChpcy5hcnJheShvbGQpKSB7XG4gICAgICAgICAgb2xkLmxlbmd0aCA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgb2xkLmZuID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtjcmVhdGU6IHVwZGF0ZUV2ZW50TGlzdGVuZXJzLCB1cGRhdGU6IHVwZGF0ZUV2ZW50TGlzdGVuZXJzfTtcbiIsImZ1bmN0aW9uIHVwZGF0ZVByb3BzKG9sZFZub2RlLCB2bm9kZSkge1xuICB2YXIga2V5LCBjdXIsIG9sZCwgZWxtID0gdm5vZGUuZWxtLFxuICAgICAgb2xkUHJvcHMgPSBvbGRWbm9kZS5kYXRhLnByb3BzIHx8IHt9LCBwcm9wcyA9IHZub2RlLmRhdGEucHJvcHMgfHwge307XG4gIGZvciAoa2V5IGluIG9sZFByb3BzKSB7XG4gICAgaWYgKCFwcm9wc1trZXldKSB7XG4gICAgICBkZWxldGUgZWxtW2tleV07XG4gICAgfVxuICB9XG4gIGZvciAoa2V5IGluIHByb3BzKSB7XG4gICAgY3VyID0gcHJvcHNba2V5XTtcbiAgICBvbGQgPSBvbGRQcm9wc1trZXldO1xuICAgIGlmIChvbGQgIT09IGN1ciAmJiAoa2V5ICE9PSAndmFsdWUnIHx8IGVsbVtrZXldICE9PSBjdXIpKSB7XG4gICAgICBlbG1ba2V5XSA9IGN1cjtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7Y3JlYXRlOiB1cGRhdGVQcm9wcywgdXBkYXRlOiB1cGRhdGVQcm9wc307XG4iLCJ2YXIgcmFmID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUpIHx8IHNldFRpbWVvdXQ7XG52YXIgbmV4dEZyYW1lID0gZnVuY3Rpb24oZm4pIHsgcmFmKGZ1bmN0aW9uKCkgeyByYWYoZm4pOyB9KTsgfTtcblxuZnVuY3Rpb24gc2V0TmV4dEZyYW1lKG9iaiwgcHJvcCwgdmFsKSB7XG4gIG5leHRGcmFtZShmdW5jdGlvbigpIHsgb2JqW3Byb3BdID0gdmFsOyB9KTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlU3R5bGUob2xkVm5vZGUsIHZub2RlKSB7XG4gIHZhciBjdXIsIG5hbWUsIGVsbSA9IHZub2RlLmVsbSxcbiAgICAgIG9sZFN0eWxlID0gb2xkVm5vZGUuZGF0YS5zdHlsZSB8fCB7fSxcbiAgICAgIHN0eWxlID0gdm5vZGUuZGF0YS5zdHlsZSB8fCB7fSxcbiAgICAgIG9sZEhhc0RlbCA9ICdkZWxheWVkJyBpbiBvbGRTdHlsZTtcbiAgZm9yIChuYW1lIGluIG9sZFN0eWxlKSB7XG4gICAgaWYgKCFzdHlsZVtuYW1lXSkge1xuICAgICAgZWxtLnN0eWxlW25hbWVdID0gJyc7XG4gICAgfVxuICB9XG4gIGZvciAobmFtZSBpbiBzdHlsZSkge1xuICAgIGN1ciA9IHN0eWxlW25hbWVdO1xuICAgIGlmIChuYW1lID09PSAnZGVsYXllZCcpIHtcbiAgICAgIGZvciAobmFtZSBpbiBzdHlsZS5kZWxheWVkKSB7XG4gICAgICAgIGN1ciA9IHN0eWxlLmRlbGF5ZWRbbmFtZV07XG4gICAgICAgIGlmICghb2xkSGFzRGVsIHx8IGN1ciAhPT0gb2xkU3R5bGUuZGVsYXllZFtuYW1lXSkge1xuICAgICAgICAgIHNldE5leHRGcmFtZShlbG0uc3R5bGUsIG5hbWUsIGN1cik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5hbWUgIT09ICdyZW1vdmUnICYmIGN1ciAhPT0gb2xkU3R5bGVbbmFtZV0pIHtcbiAgICAgIGVsbS5zdHlsZVtuYW1lXSA9IGN1cjtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYXBwbHlEZXN0cm95U3R5bGUodm5vZGUpIHtcbiAgdmFyIHN0eWxlLCBuYW1lLCBlbG0gPSB2bm9kZS5lbG0sIHMgPSB2bm9kZS5kYXRhLnN0eWxlO1xuICBpZiAoIXMgfHwgIShzdHlsZSA9IHMuZGVzdHJveSkpIHJldHVybjtcbiAgZm9yIChuYW1lIGluIHN0eWxlKSB7XG4gICAgZWxtLnN0eWxlW25hbWVdID0gc3R5bGVbbmFtZV07XG4gIH1cbn1cblxuZnVuY3Rpb24gYXBwbHlSZW1vdmVTdHlsZSh2bm9kZSwgcm0pIHtcbiAgdmFyIHMgPSB2bm9kZS5kYXRhLnN0eWxlO1xuICBpZiAoIXMgfHwgIXMucmVtb3ZlKSB7XG4gICAgcm0oKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG5hbWUsIGVsbSA9IHZub2RlLmVsbSwgaWR4LCBpID0gMCwgbWF4RHVyID0gMCxcbiAgICAgIGNvbXBTdHlsZSwgc3R5bGUgPSBzLnJlbW92ZSwgYW1vdW50ID0gMCwgYXBwbGllZCA9IFtdO1xuICBmb3IgKG5hbWUgaW4gc3R5bGUpIHtcbiAgICBhcHBsaWVkLnB1c2gobmFtZSk7XG4gICAgZWxtLnN0eWxlW25hbWVdID0gc3R5bGVbbmFtZV07XG4gIH1cbiAgY29tcFN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShlbG0pO1xuICB2YXIgcHJvcHMgPSBjb21wU3R5bGVbJ3RyYW5zaXRpb24tcHJvcGVydHknXS5zcGxpdCgnLCAnKTtcbiAgZm9yICg7IGkgPCBwcm9wcy5sZW5ndGg7ICsraSkge1xuICAgIGlmKGFwcGxpZWQuaW5kZXhPZihwcm9wc1tpXSkgIT09IC0xKSBhbW91bnQrKztcbiAgfVxuICBlbG0uYWRkRXZlbnRMaXN0ZW5lcigndHJhbnNpdGlvbmVuZCcsIGZ1bmN0aW9uKGV2KSB7XG4gICAgaWYgKGV2LnRhcmdldCA9PT0gZWxtKSAtLWFtb3VudDtcbiAgICBpZiAoYW1vdW50ID09PSAwKSBybSgpO1xuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7Y3JlYXRlOiB1cGRhdGVTdHlsZSwgdXBkYXRlOiB1cGRhdGVTdHlsZSwgZGVzdHJveTogYXBwbHlEZXN0cm95U3R5bGUsIHJlbW92ZTogYXBwbHlSZW1vdmVTdHlsZX07XG4iLCIvLyBqc2hpbnQgbmV3Y2FwOiBmYWxzZVxuLyogZ2xvYmFsIHJlcXVpcmUsIG1vZHVsZSwgZG9jdW1lbnQsIE5vZGUgKi9cbid1c2Ugc3RyaWN0JztcblxudmFyIFZOb2RlID0gcmVxdWlyZSgnLi92bm9kZScpO1xudmFyIGlzID0gcmVxdWlyZSgnLi9pcycpO1xudmFyIGRvbUFwaSA9IHJlcXVpcmUoJy4vaHRtbGRvbWFwaScpO1xuXG5mdW5jdGlvbiBpc1VuZGVmKHMpIHsgcmV0dXJuIHMgPT09IHVuZGVmaW5lZDsgfVxuZnVuY3Rpb24gaXNEZWYocykgeyByZXR1cm4gcyAhPT0gdW5kZWZpbmVkOyB9XG5cbnZhciBlbXB0eU5vZGUgPSBWTm9kZSgnJywge30sIFtdLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cbmZ1bmN0aW9uIHNhbWVWbm9kZSh2bm9kZTEsIHZub2RlMikge1xuICByZXR1cm4gdm5vZGUxLmtleSA9PT0gdm5vZGUyLmtleSAmJiB2bm9kZTEuc2VsID09PSB2bm9kZTIuc2VsO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVLZXlUb09sZElkeChjaGlsZHJlbiwgYmVnaW5JZHgsIGVuZElkeCkge1xuICB2YXIgaSwgbWFwID0ge30sIGtleTtcbiAgZm9yIChpID0gYmVnaW5JZHg7IGkgPD0gZW5kSWR4OyArK2kpIHtcbiAgICBrZXkgPSBjaGlsZHJlbltpXS5rZXk7XG4gICAgaWYgKGlzRGVmKGtleSkpIG1hcFtrZXldID0gaTtcbiAgfVxuICByZXR1cm4gbWFwO1xufVxuXG52YXIgaG9va3MgPSBbJ2NyZWF0ZScsICd1cGRhdGUnLCAncmVtb3ZlJywgJ2Rlc3Ryb3knLCAncHJlJywgJ3Bvc3QnXTtcblxuZnVuY3Rpb24gaW5pdChtb2R1bGVzLCBhcGkpIHtcbiAgdmFyIGksIGosIGNicyA9IHt9O1xuXG4gIGlmIChpc1VuZGVmKGFwaSkpIGFwaSA9IGRvbUFwaTtcblxuICBmb3IgKGkgPSAwOyBpIDwgaG9va3MubGVuZ3RoOyArK2kpIHtcbiAgICBjYnNbaG9va3NbaV1dID0gW107XG4gICAgZm9yIChqID0gMDsgaiA8IG1vZHVsZXMubGVuZ3RoOyArK2opIHtcbiAgICAgIGlmIChtb2R1bGVzW2pdW2hvb2tzW2ldXSAhPT0gdW5kZWZpbmVkKSBjYnNbaG9va3NbaV1dLnB1c2gobW9kdWxlc1tqXVtob29rc1tpXV0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGVtcHR5Tm9kZUF0KGVsbSkge1xuICAgIHJldHVybiBWTm9kZShhcGkudGFnTmFtZShlbG0pLnRvTG93ZXJDYXNlKCksIHt9LCBbXSwgdW5kZWZpbmVkLCBlbG0pO1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlUm1DYihjaGlsZEVsbSwgbGlzdGVuZXJzKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgaWYgKC0tbGlzdGVuZXJzID09PSAwKSB7XG4gICAgICAgIHZhciBwYXJlbnQgPSBhcGkucGFyZW50Tm9kZShjaGlsZEVsbSk7XG4gICAgICAgIGFwaS5yZW1vdmVDaGlsZChwYXJlbnQsIGNoaWxkRWxtKTtcbiAgICAgIH1cbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gY3JlYXRlRWxtKHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICB2YXIgaSwgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgaWYgKGlzRGVmKGRhdGEpKSB7XG4gICAgICBpZiAoaXNEZWYoaSA9IGRhdGEuaG9vaykgJiYgaXNEZWYoaSA9IGkuaW5pdCkpIHtcbiAgICAgICAgaSh2bm9kZSk7XG4gICAgICAgIGRhdGEgPSB2bm9kZS5kYXRhO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgZWxtLCBjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuLCBzZWwgPSB2bm9kZS5zZWw7XG4gICAgaWYgKGlzRGVmKHNlbCkpIHtcbiAgICAgIC8vIFBhcnNlIHNlbGVjdG9yXG4gICAgICB2YXIgaGFzaElkeCA9IHNlbC5pbmRleE9mKCcjJyk7XG4gICAgICB2YXIgZG90SWR4ID0gc2VsLmluZGV4T2YoJy4nLCBoYXNoSWR4KTtcbiAgICAgIHZhciBoYXNoID0gaGFzaElkeCA+IDAgPyBoYXNoSWR4IDogc2VsLmxlbmd0aDtcbiAgICAgIHZhciBkb3QgPSBkb3RJZHggPiAwID8gZG90SWR4IDogc2VsLmxlbmd0aDtcbiAgICAgIHZhciB0YWcgPSBoYXNoSWR4ICE9PSAtMSB8fCBkb3RJZHggIT09IC0xID8gc2VsLnNsaWNlKDAsIE1hdGgubWluKGhhc2gsIGRvdCkpIDogc2VsO1xuICAgICAgZWxtID0gdm5vZGUuZWxtID0gaXNEZWYoZGF0YSkgJiYgaXNEZWYoaSA9IGRhdGEubnMpID8gYXBpLmNyZWF0ZUVsZW1lbnROUyhpLCB0YWcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBhcGkuY3JlYXRlRWxlbWVudCh0YWcpO1xuICAgICAgaWYgKGhhc2ggPCBkb3QpIGVsbS5pZCA9IHNlbC5zbGljZShoYXNoICsgMSwgZG90KTtcbiAgICAgIGlmIChkb3RJZHggPiAwKSBlbG0uY2xhc3NOYW1lID0gc2VsLnNsaWNlKGRvdCsxKS5yZXBsYWNlKC9cXC4vZywgJyAnKTtcbiAgICAgIGlmIChpcy5hcnJheShjaGlsZHJlbikpIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgYXBpLmFwcGVuZENoaWxkKGVsbSwgY3JlYXRlRWxtKGNoaWxkcmVuW2ldLCBpbnNlcnRlZFZub2RlUXVldWUpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpcy5wcmltaXRpdmUodm5vZGUudGV4dCkpIHtcbiAgICAgICAgYXBpLmFwcGVuZENoaWxkKGVsbSwgYXBpLmNyZWF0ZVRleHROb2RlKHZub2RlLnRleHQpKTtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBjYnMuY3JlYXRlLmxlbmd0aDsgKytpKSBjYnMuY3JlYXRlW2ldKGVtcHR5Tm9kZSwgdm5vZGUpO1xuICAgICAgaSA9IHZub2RlLmRhdGEuaG9vazsgLy8gUmV1c2UgdmFyaWFibGVcbiAgICAgIGlmIChpc0RlZihpKSkge1xuICAgICAgICBpZiAoaS5jcmVhdGUpIGkuY3JlYXRlKGVtcHR5Tm9kZSwgdm5vZGUpO1xuICAgICAgICBpZiAoaS5pbnNlcnQpIGluc2VydGVkVm5vZGVRdWV1ZS5wdXNoKHZub2RlKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZWxtID0gdm5vZGUuZWxtID0gYXBpLmNyZWF0ZVRleHROb2RlKHZub2RlLnRleHQpO1xuICAgIH1cbiAgICByZXR1cm4gdm5vZGUuZWxtO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVm5vZGVzKHBhcmVudEVsbSwgYmVmb3JlLCB2bm9kZXMsIHN0YXJ0SWR4LCBlbmRJZHgsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIGZvciAoOyBzdGFydElkeCA8PSBlbmRJZHg7ICsrc3RhcnRJZHgpIHtcbiAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBjcmVhdGVFbG0odm5vZGVzW3N0YXJ0SWR4XSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSwgYmVmb3JlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBpbnZva2VEZXN0cm95SG9vayh2bm9kZSkge1xuICAgIHZhciBpLCBqLCBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICBpZiAoaXNEZWYoZGF0YSkpIHtcbiAgICAgIGlmIChpc0RlZihpID0gZGF0YS5ob29rKSAmJiBpc0RlZihpID0gaS5kZXN0cm95KSkgaSh2bm9kZSk7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLmRlc3Ryb3kubGVuZ3RoOyArK2kpIGNicy5kZXN0cm95W2ldKHZub2RlKTtcbiAgICAgIGlmIChpc0RlZihpID0gdm5vZGUuY2hpbGRyZW4pKSB7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCB2bm9kZS5jaGlsZHJlbi5sZW5ndGg7ICsraikge1xuICAgICAgICAgIGludm9rZURlc3Ryb3lIb29rKHZub2RlLmNoaWxkcmVuW2pdKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZVZub2RlcyhwYXJlbnRFbG0sIHZub2Rlcywgc3RhcnRJZHgsIGVuZElkeCkge1xuICAgIGZvciAoOyBzdGFydElkeCA8PSBlbmRJZHg7ICsrc3RhcnRJZHgpIHtcbiAgICAgIHZhciBpLCBsaXN0ZW5lcnMsIHJtLCBjaCA9IHZub2Rlc1tzdGFydElkeF07XG4gICAgICBpZiAoaXNEZWYoY2gpKSB7XG4gICAgICAgIGlmIChpc0RlZihjaC5zZWwpKSB7XG4gICAgICAgICAgaW52b2tlRGVzdHJveUhvb2soY2gpO1xuICAgICAgICAgIGxpc3RlbmVycyA9IGNicy5yZW1vdmUubGVuZ3RoICsgMTtcbiAgICAgICAgICBybSA9IGNyZWF0ZVJtQ2IoY2guZWxtLCBsaXN0ZW5lcnMpO1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjYnMucmVtb3ZlLmxlbmd0aDsgKytpKSBjYnMucmVtb3ZlW2ldKGNoLCBybSk7XG4gICAgICAgICAgaWYgKGlzRGVmKGkgPSBjaC5kYXRhKSAmJiBpc0RlZihpID0gaS5ob29rKSAmJiBpc0RlZihpID0gaS5yZW1vdmUpKSB7XG4gICAgICAgICAgICBpKGNoLCBybSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJtKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgeyAvLyBUZXh0IG5vZGVcbiAgICAgICAgICBhcGkucmVtb3ZlQ2hpbGQocGFyZW50RWxtLCBjaC5lbG0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlQ2hpbGRyZW4ocGFyZW50RWxtLCBvbGRDaCwgbmV3Q2gsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIHZhciBvbGRTdGFydElkeCA9IDAsIG5ld1N0YXJ0SWR4ID0gMDtcbiAgICB2YXIgb2xkRW5kSWR4ID0gb2xkQ2gubGVuZ3RoIC0gMTtcbiAgICB2YXIgb2xkU3RhcnRWbm9kZSA9IG9sZENoWzBdO1xuICAgIHZhciBvbGRFbmRWbm9kZSA9IG9sZENoW29sZEVuZElkeF07XG4gICAgdmFyIG5ld0VuZElkeCA9IG5ld0NoLmxlbmd0aCAtIDE7XG4gICAgdmFyIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFswXTtcbiAgICB2YXIgbmV3RW5kVm5vZGUgPSBuZXdDaFtuZXdFbmRJZHhdO1xuICAgIHZhciBvbGRLZXlUb0lkeCwgaWR4SW5PbGQsIGVsbVRvTW92ZSwgYmVmb3JlO1xuXG4gICAgd2hpbGUgKG9sZFN0YXJ0SWR4IDw9IG9sZEVuZElkeCAmJiBuZXdTdGFydElkeCA8PSBuZXdFbmRJZHgpIHtcbiAgICAgIGlmIChpc1VuZGVmKG9sZFN0YXJ0Vm5vZGUpKSB7XG4gICAgICAgIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFsrK29sZFN0YXJ0SWR4XTsgLy8gVm5vZGUgaGFzIGJlZW4gbW92ZWQgbGVmdFxuICAgICAgfSBlbHNlIGlmIChpc1VuZGVmKG9sZEVuZFZub2RlKSkge1xuICAgICAgICBvbGRFbmRWbm9kZSA9IG9sZENoWy0tb2xkRW5kSWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld1N0YXJ0Vm5vZGUpKSB7XG4gICAgICAgIHBhdGNoVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdO1xuICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWbm9kZShvbGRFbmRWbm9kZSwgbmV3RW5kVm5vZGUpKSB7XG4gICAgICAgIHBhdGNoVm5vZGUob2xkRW5kVm5vZGUsIG5ld0VuZFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBvbGRFbmRWbm9kZSA9IG9sZENoWy0tb2xkRW5kSWR4XTtcbiAgICAgICAgbmV3RW5kVm5vZGUgPSBuZXdDaFstLW5ld0VuZElkeF07XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWbm9kZShvbGRTdGFydFZub2RlLCBuZXdFbmRWbm9kZSkpIHsgLy8gVm5vZGUgbW92ZWQgcmlnaHRcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRTdGFydFZub2RlLCBuZXdFbmRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtLCBhcGkubmV4dFNpYmxpbmcob2xkRW5kVm5vZGUuZWxtKSk7XG4gICAgICAgIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFsrK29sZFN0YXJ0SWR4XTtcbiAgICAgICAgbmV3RW5kVm5vZGUgPSBuZXdDaFstLW5ld0VuZElkeF07XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWbm9kZShvbGRFbmRWbm9kZSwgbmV3U3RhcnRWbm9kZSkpIHsgLy8gVm5vZGUgbW92ZWQgbGVmdFxuICAgICAgICBwYXRjaFZub2RlKG9sZEVuZFZub2RlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgb2xkRW5kVm5vZGUuZWxtLCBvbGRTdGFydFZub2RlLmVsbSk7XG4gICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaXNVbmRlZihvbGRLZXlUb0lkeCkpIG9sZEtleVRvSWR4ID0gY3JlYXRlS2V5VG9PbGRJZHgob2xkQ2gsIG9sZFN0YXJ0SWR4LCBvbGRFbmRJZHgpO1xuICAgICAgICBpZHhJbk9sZCA9IG9sZEtleVRvSWR4W25ld1N0YXJ0Vm5vZGUua2V5XTtcbiAgICAgICAgaWYgKGlzVW5kZWYoaWR4SW5PbGQpKSB7IC8vIE5ldyBlbGVtZW50XG4gICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGNyZWF0ZUVsbShuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpLCBvbGRTdGFydFZub2RlLmVsbSk7XG4gICAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVsbVRvTW92ZSA9IG9sZENoW2lkeEluT2xkXTtcbiAgICAgICAgICBwYXRjaFZub2RlKGVsbVRvTW92ZSwgbmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgICBvbGRDaFtpZHhJbk9sZF0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGVsbVRvTW92ZS5lbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9sZFN0YXJ0SWR4ID4gb2xkRW5kSWR4KSB7XG4gICAgICBiZWZvcmUgPSBpc1VuZGVmKG5ld0NoW25ld0VuZElkeCsxXSkgPyBudWxsIDogbmV3Q2hbbmV3RW5kSWR4KzFdLmVsbTtcbiAgICAgIGFkZFZub2RlcyhwYXJlbnRFbG0sIGJlZm9yZSwgbmV3Q2gsIG5ld1N0YXJ0SWR4LCBuZXdFbmRJZHgsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgfSBlbHNlIGlmIChuZXdTdGFydElkeCA+IG5ld0VuZElkeCkge1xuICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgb2xkQ2gsIG9sZFN0YXJ0SWR4LCBvbGRFbmRJZHgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhdGNoVm5vZGUob2xkVm5vZGUsIHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICB2YXIgaSwgaG9vaztcbiAgICBpZiAoaXNEZWYoaSA9IHZub2RlLmRhdGEpICYmIGlzRGVmKGhvb2sgPSBpLmhvb2spICYmIGlzRGVmKGkgPSBob29rLnByZXBhdGNoKSkge1xuICAgICAgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgICB2YXIgZWxtID0gdm5vZGUuZWxtID0gb2xkVm5vZGUuZWxtLCBvbGRDaCA9IG9sZFZub2RlLmNoaWxkcmVuLCBjaCA9IHZub2RlLmNoaWxkcmVuO1xuICAgIGlmIChvbGRWbm9kZSA9PT0gdm5vZGUpIHJldHVybjtcbiAgICBpZiAoIXNhbWVWbm9kZShvbGRWbm9kZSwgdm5vZGUpKSB7XG4gICAgICB2YXIgcGFyZW50RWxtID0gYXBpLnBhcmVudE5vZGUob2xkVm5vZGUuZWxtKTtcbiAgICAgIGVsbSA9IGNyZWF0ZUVsbSh2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBlbG0sIG9sZFZub2RlLmVsbSk7XG4gICAgICByZW1vdmVWbm9kZXMocGFyZW50RWxtLCBbb2xkVm5vZGVdLCAwLCAwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGlzRGVmKHZub2RlLmRhdGEpKSB7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnVwZGF0ZS5sZW5ndGg7ICsraSkgY2JzLnVwZGF0ZVtpXShvbGRWbm9kZSwgdm5vZGUpO1xuICAgICAgaSA9IHZub2RlLmRhdGEuaG9vaztcbiAgICAgIGlmIChpc0RlZihpKSAmJiBpc0RlZihpID0gaS51cGRhdGUpKSBpKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgfVxuICAgIGlmIChpc1VuZGVmKHZub2RlLnRleHQpKSB7XG4gICAgICBpZiAoaXNEZWYob2xkQ2gpICYmIGlzRGVmKGNoKSkge1xuICAgICAgICBpZiAob2xkQ2ggIT09IGNoKSB1cGRhdGVDaGlsZHJlbihlbG0sIG9sZENoLCBjaCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNEZWYoY2gpKSB7XG4gICAgICAgIGlmIChpc0RlZihvbGRWbm9kZS50ZXh0KSkgYXBpLnNldFRleHRDb250ZW50KGVsbSwgJycpO1xuICAgICAgICBhZGRWbm9kZXMoZWxtLCBudWxsLCBjaCwgMCwgY2gubGVuZ3RoIC0gMSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNEZWYob2xkQ2gpKSB7XG4gICAgICAgIHJlbW92ZVZub2RlcyhlbG0sIG9sZENoLCAwLCBvbGRDaC5sZW5ndGggLSAxKTtcbiAgICAgIH0gZWxzZSBpZiAoaXNEZWYob2xkVm5vZGUudGV4dCkpIHtcbiAgICAgICAgYXBpLnNldFRleHRDb250ZW50KGVsbSwgJycpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob2xkVm5vZGUudGV4dCAhPT0gdm5vZGUudGV4dCkge1xuICAgICAgYXBpLnNldFRleHRDb250ZW50KGVsbSwgdm5vZGUudGV4dCk7XG4gICAgfVxuICAgIGlmIChpc0RlZihob29rKSAmJiBpc0RlZihpID0gaG9vay5wb3N0cGF0Y2gpKSB7XG4gICAgICBpKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKG9sZFZub2RlLCB2bm9kZSkge1xuICAgIHZhciBpLCBlbG0sIHBhcmVudDtcbiAgICB2YXIgaW5zZXJ0ZWRWbm9kZVF1ZXVlID0gW107XG4gICAgZm9yIChpID0gMDsgaSA8IGNicy5wcmUubGVuZ3RoOyArK2kpIGNicy5wcmVbaV0oKTtcblxuICAgIGlmIChpc1VuZGVmKG9sZFZub2RlLnNlbCkpIHtcbiAgICAgIG9sZFZub2RlID0gZW1wdHlOb2RlQXQob2xkVm5vZGUpO1xuICAgIH1cblxuICAgIGlmIChzYW1lVm5vZGUob2xkVm5vZGUsIHZub2RlKSkge1xuICAgICAgcGF0Y2hWbm9kZShvbGRWbm9kZSwgdm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsbSA9IG9sZFZub2RlLmVsbTtcbiAgICAgIHBhcmVudCA9IGFwaS5wYXJlbnROb2RlKGVsbSk7XG5cbiAgICAgIGNyZWF0ZUVsbSh2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcblxuICAgICAgaWYgKHBhcmVudCAhPT0gbnVsbCkge1xuICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudCwgdm5vZGUuZWxtLCBhcGkubmV4dFNpYmxpbmcoZWxtKSk7XG4gICAgICAgIHJlbW92ZVZub2RlcyhwYXJlbnQsIFtvbGRWbm9kZV0sIDAsIDApO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoaSA9IDA7IGkgPCBpbnNlcnRlZFZub2RlUXVldWUubGVuZ3RoOyArK2kpIHtcbiAgICAgIGluc2VydGVkVm5vZGVRdWV1ZVtpXS5kYXRhLmhvb2suaW5zZXJ0KGluc2VydGVkVm5vZGVRdWV1ZVtpXSk7XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBjYnMucG9zdC5sZW5ndGg7ICsraSkgY2JzLnBvc3RbaV0oKTtcbiAgICByZXR1cm4gdm5vZGU7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2luaXQ6IGluaXR9O1xuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihzZWwsIGRhdGEsIGNoaWxkcmVuLCB0ZXh0LCBlbG0pIHtcbiAgdmFyIGtleSA9IGRhdGEgPT09IHVuZGVmaW5lZCA/IHVuZGVmaW5lZCA6IGRhdGEua2V5O1xuICByZXR1cm4ge3NlbDogc2VsLCBkYXRhOiBkYXRhLCBjaGlsZHJlbjogY2hpbGRyZW4sXG4gICAgICAgICAgdGV4dDogdGV4dCwgZWxtOiBlbG0sIGtleToga2V5fTtcbn07XG4iLCJjb25zdCBhbm55YW5nID0gcmVxdWlyZSgnYW5ueWFuZycpXG5jb25zdCBTdGF0ZU1hY2hpbmUgPSByZXF1aXJlKCcuL1N0YXRlTWFjaGluZScpXG5jb25zdCBFbnZpcm9ubWVudCA9IHJlcXVpcmUoJy4vRW52aXJvbm1lbnQnKVxuY29uc3QgZGF0YSA9IHtcbiAgbGV0dGVyczoge1xuICAgICBhOiAwLFxuICAgICBiOiAwLFxuICAgICBjOiAwXG4gICB9LFxuICBjbGllbnRzOiB7XG4gICAgICdCb2IgSm9uZXMnOiB7fSxcbiAgICAgJ0dyZWcgSGFybW9uJzoge30sXG4gICAgICdMZWFubiBMZXdpcyc6IHt9LFxuICAgICAnSGFybW9ueSBDaG9zdHdpdHonOiB7fVxuICAgfSxcbiAgIHZsb2dzOiBbXSxcbiAgIGNsb2dzOiBbXVxufVxuY29uc3QgY29tbWFuZHMgPSByZXF1aXJlKCcuL0NvbW1hbmRzJylcblxuY29uc3QgU3RhdGVDcmVhdG9yID0gcmVxdWlyZSgnLi9TdGF0ZUNyZWF0b3InKVxuY29uc3QgRmFpbFN0YXRlQ3JlYXRvciA9IHJlcXVpcmUoJy4vRmFpbFN0YXRlQ3JlYXRvcicpXG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuY29uc3QgJGFjdGl2YXRlQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGl2YXRlLWJ0bicpXG5jb25zdCAkc2hvd0NvbW1hbmRzQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Nob3ctY29tbWFuZHMtYnRuJylcbmNvbnN0IGRvbV9ldmVudHMgPSB7XG4gICdjbGljayc6IFt7XG4gICAgZWxlbWVudDogJGFjdGl2YXRlQnRuLFxuICAgIGNhbGxiYWNrOiBmdW5jdGlvbihfKSB7XG4gICAgICBhbm55YW5nLnN0YXJ0KHsgYXV0b1Jlc3RhcnQ6IGZhbHNlLCBjb250aW51b3VzOiB0cnVlIH0pXG4gICAgfVxuICB9LCB7XG4gICAgZWxlbWVudDogJHNob3dDb21tYW5kc0J0bixcbiAgICBjYWxsYmFjazogZnVuY3Rpb24oXykge1xuICAgICAgYW5ueWFuZy50cmlnZ2VyKCdpbmNyZWFzZSBhJylcbiAgICB9XG4gIH1dXG59XG5jb25zdCBhbm55YW5nX2NhbGxiYWNrcyA9IHtcbiAnc3RhcnQnOiAoKSA9PiB7XG4gICAkYWN0aXZhdGVCdG4uZGlzYWJsZWQgPSB0cnVlXG4gICAkYWN0aXZhdGVCdG4udGV4dENvbnRlbnQgPSAnTGlzdGVuaW5nJ1xuIH0sXG4gJ3Jlc3VsdCc6IChyZXN1bHQpID0+IHtcbiAgIGNvbnNvbGUubG9nKHJlc3VsdClcbiB9LFxuICdyZXN1bHRNYXRjaCc6IChyZXN1bHQpID0+IHtcbiAgIGNvbnNvbGUubG9nKHJlc3VsdClcbiB9LFxuICdlbmQnOiAoKSA9PiB7XG4gICAkYWN0aXZhdGVCdG4uZGlzYWJsZWQgPSBmYWxzZVxuICAgJGFjdGl2YXRlQnRuLnRleHRDb250ZW50ID0gJ1N0YXJ0J1xuIH1cbn1cblxuZm9yICh2YXIgY2IgaW4gYW5ueWFuZ19jYWxsYmFja3MpIHtcbiAgYW5ueWFuZy5hZGRDYWxsYmFjayhjYiwgYW5ueWFuZ19jYWxsYmFja3NbY2JdKVxufVxuZm9yICh2YXIgdHlwZSBpbiBkb21fZXZlbnRzKSB7XG4gIGRvbV9ldmVudHNbdHlwZV0uZm9yRWFjaChldmVudCA9PiB7XG4gICAgZXZlbnQuZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGV2ZW50LmNhbGxiYWNrKVxuICB9KVxufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vIFxuXG5jb25zdCBteUVudiA9IEVudmlyb25tZW50KGNvbW1hbmRzKGRhdGEpKVxuZ2xvYmFsLm15RW52ID0gbXlFbnZcbmNvbnN0IFN0YXRlID0gU3RhdGVNYWNoaW5lLmluaXQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRlbnQnKSkoU3RhdGVDcmVhdG9yKSh7XG4gIHZsb2dzOiBkYXRhLnZsb2dzLFxuICBjbG9nczogZGF0YS5jbG9nc1xufSlcblxuY29uc3QgRXJyU3RhdGUgPSBTdGF0ZU1hY2hpbmUuaW5pdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZXJyJykpKEZhaWxTdGF0ZUNyZWF0b3IpKHtcbiAgZXJyTXNnOiAnUG9vJ1xufSlcblxuY29uc3QgU3RhdGVDaGFuZ2UgPSAoXykgPT4ge1xuICB2YXIgbmV3X3N0YXRlID0gbXlFbnYuY2hhbm5lbEZhaWwuc2hpZnQoKVxuICBcbiAgaWYgKG5ld19zdGF0ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgXG4gICAgbmV3X3N0YXRlID0gbXlFbnYuY2hhbm5lbFN1Y2Nlc3Muc2hpZnQoKVxuICAgIGlmIChuZXdfc3RhdGUgIT09IHVuZGVmaW5lZCkgeyBcbiAgICAgIFN0YXRlLmNoYW5nZShuZXdfc3RhdGUsIHsgcmVwbGFjZTogbmV3X3N0YXRlLnJlcGxhY2UgfSkgXG4gICAgfVxuICAgIFxuICB9IGVsc2Uge1xuICAgIEVyclN0YXRlLmNoYW5nZShuZXdfc3RhdGUpXG4gIH1cbiAgXG4gIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoU3RhdGVDaGFuZ2UpXG59XG5cblxuYW5ueWFuZy5hZGRDb21tYW5kcyhteUVudi5jb21tYW5kcylcblxud2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShTdGF0ZUNoYW5nZSlcbiJdfQ==
