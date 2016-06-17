(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"fp-lib":6}],2:[function(require,module,exports){
const channel = []

const init = (commands) => {
  for (var name in commands) {
    commands[name] = wrapper(commands[name])
  }
  return { commands, channel }
}

const wrapper = (callback) => (...args) => {
  channel.push(callback(...args))
}

module.exports = { init }
},{}],3:[function(require,module,exports){
const h = require('snabbdom/h')

const StateCreator = ({
  errMsg,
  clogs
}) => {
  while (clogs.length > 30) {
    clogs.shift()
  }
  return h('div#content', [
      h('div#err', [errMsg]),
      h('div#clog', clogs.map(log => h('span', [log])))
    ])
}


module.exports = StateCreator
},{"snabbdom/h":7}],4:[function(require,module,exports){
const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with choosen modules
  require('snabbdom/modules/class'), // makes it easy to toggle classes
  require('snabbdom/modules/props'), // for setting properties on DOM elements
  require('snabbdom/modules/style'), // handles styling on elements with support for animations
  require('snabbdom/modules/eventlisteners'), // attaches event listeners
])

const init = (parentNode) => (StateCreator) => (init_params) => {
  var _vtree = parentNode
  const _states = []
  
  // cursor stores the index of the currently rendered state
  // it moves back and forward for undo/redo operations
  const i = 0
  
  // replace must be true for first state change
  const change = (state, { replace }) => {
    if (!replace) {
      state = Object.assign(Object.assign({}, _states[i]), state)
    }

    const new_vtree = StateCreator(state)
    
    // remove all state parameters in front of cursor position
    if (i !== 0) {
      _states.splice(0, i)
      i = 0
    }
    _states.unshift(state)
    
    patch(_vtree, new_vtree)
    _vtree = new_vtree
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
},{"snabbdom":14,"snabbdom/modules/class":10,"snabbdom/modules/eventlisteners":11,"snabbdom/modules/props":12,"snabbdom/modules/style":13}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
// FUNCTIONS /////////////////////////////////////////////////////

//:: a -> a
const trace = (x) => {
  console.log(x)
  return x
}

//:: ((a, b, ... -> e), (e -> f), ..., (y -> z)) -> (a, b, ...) -> z
const pipe = (...fns) => (...xs) => {
  return fns
    .slice(1)
    .reduce((x, fn) => fn(x), fns[0](...xs))
}
const pipeP = (...fns) => (...xs) => {
  return fns
    .slice(1)
    .reduce((xP, fn) => xP.then(fn), Promise.resolve(fns[0](...xs)))
}

//:: (a -> b) -> [a] -> [b]
const map = (fn) => (f) => {
  return f.map(fn)
}

//:: [a] -> [a] -> [a]
const intersection = (xs) => (xs2) => {
  return xs.filter(x => xs2.includes(x))
}

//:: [a] -> [a] -> [a]
const difference = (xs) => (xs2) => {
  return xs.filter(x => !xs2.includes(x))
}

//:: [(a, b, ...) -> n] -> [a, b, ...] -> [n]
const applyFunctions = (fns) => (xs) => {
  return fns.map(fn =>
    xs.slice(1).reduce((partial, x) => partial(x), fn(xs[0])))
}

//:: [a] -> a
const last = (xs) => {
  return xs[xs.length - 1]
}

//:: (a -> b -> c) -> b -> a -> c
const flip = (fn) => (b) => (a) => {
  return fn(a)(b)
}

const curry = (fn) => {
  var _args = []
  const countArgs = (...xs) => {
    _args = _args.concat(xs)
    return (_args.length >= fn.length)
      ? fn.apply(this, _args)
      : countArgs
  }
  return countArgs
}

//:: Int -> [a] -> a
const nth = (n) => (xs) => {
  return xs[n]
}

//:: (a -> a) -> Number -> [a] -> [a]
const adjust = (fn) => (i) => (list) => {
  var copy = list.slice()
  copy.splice(i, 1, fn(list[i]))
  return copy
}

//:: Object -> Array
const toPairs = (obj) => {
  return Reflect.ownKeys(obj).map(key => [key, obj[key]])
}

//:: (a -> Bool) -> (a -> b) -> (a -> b) -> a -> b
const ifElse = (predFn) => (whenTrueFn) => (whenFalseFn) => (a) =>{
  return predFn(a)
    ? whenTrueFn(a)
    : whenFalseFn(a)
}


// this isn't in exports, it is used by IO.sequence //////////////
const Generator = Object.freeze({
  //:: (a -> b) -> (Generator ([a] -> b))
  /* returns a generator which will apply
     action to ea value sequentially in xs
   */
  seq(action) {
    return function* applyAction(xs) {
      for (var x of xs) {
        yield action(x)
      }
    }
  },
  //:: Generator -> _
  /* automatically steps generator every ~x ms
     until the generator is exhausted
   */
  auto: (ms) => (gen) => {
    if (!gen.next().done) {
      setTimeout(() => Generator.auto(ms)(gen), ms)
    }
  }
})


// MONADS ///////////////////////////////////////////////////////

// Maybe type
const Maybe = (() => {
  const newM = (type) => (value) => {
    return Object.freeze(Object.create(type, { __value: { value: value }}))
  }

  const Nothing = Object.freeze({
    map(_) {
      return newM(Nothing)(null)
    },
    isNothing: true,
    isJust: false
  })

  const Just = Object.freeze({
    map(fn) {
      return newM(Just)(fn(this.__value))
    },
    isNothing: false,
    isJust: true
  })

  const Maybe = (x) => {
    return (x == null)
      ? newM(Nothing)(null)
      : newM(Just)(x)
  }

  Maybe.isNothing = (M) => {
    return Nothing.isPrototypeOf(M)
  }

  Maybe.isJust = (M) => {
    return Just.isPrototypeOf(M)
  }

  return Object.freeze(Maybe)
})()

// Either type
const Either = (() => {
  const newE = (type) => (value) => {
    return Object.freeze(Object.create(type, { __value: { value: value } }))
  }

  const Left = Object.freeze({
    map(_) {
      return this
    },
    bimap(fn) {
      const me = this
      return (_) => {
        return newE(Left)(fn(me.__value))
      }
    },
    isLeft: true,
    isRight: false
  })

  const Right = Object.freeze({
    map(fn) {
      return newE(Right)(fn(this.__value))
    },
    bimap(_) {
      const me = this
      return (fn) => {
        return me.map(fn)
      }
    },
    isLeft: false,
    isRight: true
  })

  const Either = Object.freeze({
    Left(x) {
      return newE(Left)(x)
    },
    Right(x) {
      return newE(Right)(x)
    },
    isRight(E) {
      return Right.isPrototypeOf(E)
    },
    isLeft(E) {
      return Left.isPrototypeOf(E)
    },
    bimap: (leftFn) => (rightFn) => (E) => {
      return E.bimap(leftFn)(rightFn)
    }
  })

  return Either
})()

// IO type
const IO = (() => {
  const new_io = (fn) => {
    return Object.freeze(Object.create(io, { __value: { value: fn }}))
  }

  const io = {
    runIO(value) {
      return this.__value(value)
    },
    map(fn) {
      return new_io(() => fn(this.__value()))
    },
    join() {
      return new_io(() => {
        return this.runIO().runIO()
      })
    },
    chain(io_returning_fn) {
      return this.map(io_returning_fn).join()
    },
    ap(io_value) {
      return io_value.map(this.__value)
    }
  }

  const IO = (fn) => {
    if (fn instanceof Function) {
      return new_io(fn)
    } else {
      throw new TypeError(`IO constructor expected instance of Function`)
    }
  }

  IO.of = (x) => {
    return new_io(() => x)
  }

  IO.run = (io) => {
    return io.runIO()
  }

  //:: (a -> b) -> a -> IO b
  IO.wrap = (fn) => (_value) => {
    return IO.of(_value).map(fn)
  }

  //:: [IO] -> IO _
  IO.sequence = IO.wrap(
    pipe(
      Generator.seq(IO.run),
      Generator.auto(0)
    ))

  return Object.freeze(IO)
})()


/////////////////////////////////////////////////////////////////

module.exports = {
  trace, pipe, pipeP, map, intersection, difference, applyFunctions,
  last, flip, curry, nth, adjust, toPairs, ifElse,
  Maybe, Either, IO
}






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
const { Either } = require('fp-lib')

const StateCreator = require('./StateCreator')

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
   //console.log(result)
 },
 'resultMatch': (result) => {
   //console.log(result)
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

const myEnv = Environment.init(commands(data))
global.myEnv = myEnv

const State = StateMachine.init(document.getElementById('content'))(StateCreator)({
  errMsg: 'Poo',
  clogs: data.clogs
})

const StateChange = (_) => {
  const either_state = myEnv.channel.shift()
  
  if (either_state !== undefined) { 
    // pass internal either value to State.change
    Either.bimap
      (err_state => { // same behavior for error state
        State.change(err_state, { replace: false }) 
      })
      (state => { 
        State.change(state, { replace: false }) 
      })
      (either_state) 
  }
    
  window.requestAnimationFrame(StateChange)
}


annyang.addCommands(myEnv.commands)

window.requestAnimationFrame(StateChange)

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./Commands":1,"./Environment":2,"./StateCreator":3,"./StateMachine":4,"annyang":5,"fp-lib":6}]},{},[16])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJDb21tYW5kcy5qcyIsIkVudmlyb25tZW50LmpzIiwiU3RhdGVDcmVhdG9yLmpzIiwiU3RhdGVNYWNoaW5lLmpzIiwibm9kZV9tb2R1bGVzL2FubnlhbmcvYW5ueWFuZy5qcyIsIm5vZGVfbW9kdWxlcy9mcC1saWIvZnAtbGliLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2guanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaHRtbGRvbWFwaS5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9pcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL2NsYXNzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vbW9kdWxlcy9wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL3N0eWxlLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3NuYWJiZG9tLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3Zub2RlLmpzIiwicGxhdGZvcm0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqd0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0UkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbFFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJjb25zdCB7IHBpcGUsIEVpdGhlciB9ID0gcmVxdWlyZSgnZnAtbGliJylcblxuY29uc3QgY29tbWFuZHMgPSAoZGF0YSkgPT4ge1xuICBjb25zdCBfY29tbWFuZHMgPSB7XG4gICAgJ2NsaWVudCA6Zmlyc3QgOmxhc3QnOiBwaXBlKFxuICAgICAgKGZpcnN0LCBsYXN0KSA9PiB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSBgJHtmaXJzdH0gJHtsYXN0fWBcbiAgICAgICAgXG4gICAgICAgIGlmIChkYXRhLmNsaWVudHNbbmFtZV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHJldHVybiBFaXRoZXIuUmlnaHQoYGZvdW5kIGNsaWVudCAke25hbWV9YClcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gRWl0aGVyLkxlZnQoYGNsaWVudCAke25hbWV9IG5vdCBmb3VuZGApXG4gICAgICAgIH1cbiAgICAgIH0sIFxuICAgICAgRWl0aGVyLmJpbWFwXG4gICAgICAgIChlcnJNc2cgPT4geyByZXR1cm4geyBlcnJNc2cgfSB9KVxuICAgICAgICAoc3VjY2Vzc01zZyA9PiB7IFxuICAgICAgICAgIGNvbnN0IGNsb2dzID0gZGF0YS5jbG9ncy5zbGljZSgpXG4gICAgICAgICAgY2xvZ3MucHVzaChzdWNjZXNzTXNnKVxuICAgICAgICAgIHJldHVybiB7IGNsb2dzIH1cbiAgICAgICAgfSlcbiAgICApLFxuICAgICdpbmNyZWFzZSA6bGV0dGVyJzogcGlwZShcbiAgICAgIChsZXR0ZXIpID0+IHtcbiAgICAgICAgbGV0dGVyID0gbGV0dGVyLnRvTG93ZXJDYXNlKClcbiAgICAgICAgaWYgKGRhdGEubGV0dGVyc1tsZXR0ZXJdICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBkYXRhLmxldHRlcnNbbGV0dGVyXSsrXG4gICAgICAgICAgcmV0dXJuIEVpdGhlci5SaWdodChgaW5jcmVhc2VkIGxldHRlciAke2xldHRlcn0gJHtKU09OLnN0cmluZ2lmeShkYXRhLmxldHRlcnMpfWApXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIEVpdGhlci5MZWZ0KGBjYW5ub3QgaW5jcmVhc2UgbGV0dGVyICR7bGV0dGVyfSAtLSBpdCBkb2VzIG5vdCBleGlzdGApXG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBFaXRoZXIuYmltYXBcbiAgICAgICAgKGVyck1zZyA9PiB7IHJldHVybiB7IGVyck1zZyB9IH0pXG4gICAgICAgIChzdWNjZXNzTXNnID0+IHtcbiAgICAgICAgICBjb25zdCBjbG9ncyA9IGRhdGEuY2xvZ3Muc2xpY2UoKVxuICAgICAgICAgIGNsb2dzLnB1c2goc3VjY2Vzc01zZylcbiAgICAgICAgICByZXR1cm4geyBjbG9ncyB9XG4gICAgICAgIH0pXG4gICAgKSxcbiAgICAnc2hvdyBjb21tYW5kcyc6ICgpID0+IHtcbiAgICAgIHZhciBjbG9ncyA9IGRhdGEuY2xvZ3Muc2xpY2UoKVxuICAgICAgY2xvZ3MucHVzaChSZWZsZWN0Lm93bktleXMoX2NvbW1hbmRzKS5qb2luKCcsICcpICsgJ1xcbicpXG4gICAgICByZXR1cm4gRWl0aGVyLlJpZ2h0KHsgY2xvZ3MgfSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIF9jb21tYW5kc1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbW1hbmRzIiwiY29uc3QgY2hhbm5lbCA9IFtdXG5cbmNvbnN0IGluaXQgPSAoY29tbWFuZHMpID0+IHtcbiAgZm9yICh2YXIgbmFtZSBpbiBjb21tYW5kcykge1xuICAgIGNvbW1hbmRzW25hbWVdID0gd3JhcHBlcihjb21tYW5kc1tuYW1lXSlcbiAgfVxuICByZXR1cm4geyBjb21tYW5kcywgY2hhbm5lbCB9XG59XG5cbmNvbnN0IHdyYXBwZXIgPSAoY2FsbGJhY2spID0+ICguLi5hcmdzKSA9PiB7XG4gIGNoYW5uZWwucHVzaChjYWxsYmFjayguLi5hcmdzKSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IGluaXQgfSIsImNvbnN0IGggPSByZXF1aXJlKCdzbmFiYmRvbS9oJylcblxuY29uc3QgU3RhdGVDcmVhdG9yID0gKHtcbiAgZXJyTXNnLFxuICBjbG9nc1xufSkgPT4ge1xuICB3aGlsZSAoY2xvZ3MubGVuZ3RoID4gMzApIHtcbiAgICBjbG9ncy5zaGlmdCgpXG4gIH1cbiAgcmV0dXJuIGgoJ2RpdiNjb250ZW50JywgW1xuICAgICAgaCgnZGl2I2VycicsIFtlcnJNc2ddKSxcbiAgICAgIGgoJ2RpdiNjbG9nJywgY2xvZ3MubWFwKGxvZyA9PiBoKCdzcGFuJywgW2xvZ10pKSlcbiAgICBdKVxufVxuXG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVDcmVhdG9yIiwiY29uc3Qgc25hYmJkb20gPSByZXF1aXJlKCdzbmFiYmRvbScpXG5jb25zdCBwYXRjaCA9IHNuYWJiZG9tLmluaXQoWyAvLyBJbml0IHBhdGNoIGZ1bmN0aW9uIHdpdGggY2hvb3NlbiBtb2R1bGVzXG4gIHJlcXVpcmUoJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnKSwgLy8gbWFrZXMgaXQgZWFzeSB0byB0b2dnbGUgY2xhc3Nlc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJyksIC8vIGZvciBzZXR0aW5nIHByb3BlcnRpZXMgb24gRE9NIGVsZW1lbnRzXG4gIHJlcXVpcmUoJ3NuYWJiZG9tL21vZHVsZXMvc3R5bGUnKSwgLy8gaGFuZGxlcyBzdHlsaW5nIG9uIGVsZW1lbnRzIHdpdGggc3VwcG9ydCBmb3IgYW5pbWF0aW9uc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJyksIC8vIGF0dGFjaGVzIGV2ZW50IGxpc3RlbmVyc1xuXSlcblxuY29uc3QgaW5pdCA9IChwYXJlbnROb2RlKSA9PiAoU3RhdGVDcmVhdG9yKSA9PiAoaW5pdF9wYXJhbXMpID0+IHtcbiAgdmFyIF92dHJlZSA9IHBhcmVudE5vZGVcbiAgY29uc3QgX3N0YXRlcyA9IFtdXG4gIFxuICAvLyBjdXJzb3Igc3RvcmVzIHRoZSBpbmRleCBvZiB0aGUgY3VycmVudGx5IHJlbmRlcmVkIHN0YXRlXG4gIC8vIGl0IG1vdmVzIGJhY2sgYW5kIGZvcndhcmQgZm9yIHVuZG8vcmVkbyBvcGVyYXRpb25zXG4gIGNvbnN0IGkgPSAwXG4gIFxuICAvLyByZXBsYWNlIG11c3QgYmUgdHJ1ZSBmb3IgZmlyc3Qgc3RhdGUgY2hhbmdlXG4gIGNvbnN0IGNoYW5nZSA9IChzdGF0ZSwgeyByZXBsYWNlIH0pID0+IHtcbiAgICBpZiAoIXJlcGxhY2UpIHtcbiAgICAgIHN0YXRlID0gT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCBfc3RhdGVzW2ldKSwgc3RhdGUpXG4gICAgfVxuXG4gICAgY29uc3QgbmV3X3Z0cmVlID0gU3RhdGVDcmVhdG9yKHN0YXRlKVxuICAgIFxuICAgIC8vIHJlbW92ZSBhbGwgc3RhdGUgcGFyYW1ldGVycyBpbiBmcm9udCBvZiBjdXJzb3IgcG9zaXRpb25cbiAgICBpZiAoaSAhPT0gMCkge1xuICAgICAgX3N0YXRlcy5zcGxpY2UoMCwgaSlcbiAgICAgIGkgPSAwXG4gICAgfVxuICAgIF9zdGF0ZXMudW5zaGlmdChzdGF0ZSlcbiAgICBcbiAgICBwYXRjaChfdnRyZWUsIG5ld192dHJlZSlcbiAgICBfdnRyZWUgPSBuZXdfdnRyZWVcbiAgfVxuICBcbiAgY29uc3QgdW5kbyA9ICgpID0+IHtcbiAgICByZXR1cm4gKGkgPCBzdGF0ZXMubGVuZ3RoIC0gMSlcbiAgICAgID8gKGNoYW5nZShzdGF0ZXNbKytpXSwgeyByZXBsYWNlOiB0cnVlIH0pLCB0cnVlKVxuICAgICAgOiBmYWxzZVxuICB9XG4gIFxuICBjb25zdCByZWRvID0gKCkgPT4ge1xuICAgIHJldHVybiAoaSA+IDApXG4gICAgICA/IChjaGFuZ2Uoc3RhdGVzWy0taV0sIHsgcmVwbGFjZTogdHJ1ZSB9KSwgdHJ1ZSlcbiAgICAgIDogZmFsc2VcbiAgfVxuICBcbiAgLy8gcmVwbGFjZSBtdXN0IGJlIHRydWUgZm9yIGZpcnN0IHN0YXRlIGNoYW5nZVxuICBjaGFuZ2UoaW5pdF9wYXJhbXMsIHsgcmVwbGFjZTogdHJ1ZSB9KVxuICBcbiAgcmV0dXJuIHsgY2hhbmdlLCB1bmRvLCByZWRvIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IGluaXQgfSIsIi8vISBhbm55YW5nXG4vLyEgdmVyc2lvbiA6IDIuNC4wXG4vLyEgYXV0aG9yICA6IFRhbCBBdGVyIEBUYWxBdGVyXG4vLyEgbGljZW5zZSA6IE1JVFxuLy8hIGh0dHBzOi8vd3d3LlRhbEF0ZXIuY29tL2FubnlhbmcvXG4oZnVuY3Rpb24gKHJvb3QsIGZhY3RvcnkpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHsgLy8gQU1EICsgZ2xvYmFsXG4gICAgZGVmaW5lKFtdLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gKHJvb3QuYW5ueWFuZyA9IGZhY3Rvcnkocm9vdCkpO1xuICAgIH0pO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBtb2R1bGUgPT09ICdvYmplY3QnICYmIG1vZHVsZS5leHBvcnRzKSB7IC8vIENvbW1vbkpTXG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJvb3QpO1xuICB9IGVsc2UgeyAvLyBCcm93c2VyIGdsb2JhbHNcbiAgICByb290LmFubnlhbmcgPSBmYWN0b3J5KHJvb3QpO1xuICB9XG59KHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogdGhpcywgZnVuY3Rpb24gKHJvb3QsIHVuZGVmaW5lZCkge1xuICBcInVzZSBzdHJpY3RcIjtcblxuICAvKipcbiAgICogIyBRdWljayBUdXRvcmlhbCwgSW50cm8gYW5kIERlbW9zXG4gICAqXG4gICAqIFRoZSBxdWlja2VzdCB3YXkgdG8gZ2V0IHN0YXJ0ZWQgaXMgdG8gdmlzaXQgdGhlIFthbm55YW5nIGhvbWVwYWdlXShodHRwczovL3d3dy50YWxhdGVyLmNvbS9hbm55YW5nLykuXG4gICAqXG4gICAqIEZvciBhIG1vcmUgaW4tZGVwdGggbG9vayBhdCBhbm55YW5nLCByZWFkIG9uLlxuICAgKlxuICAgKiAjIEFQSSBSZWZlcmVuY2VcbiAgICovXG5cbiAgdmFyIGFubnlhbmc7XG5cbiAgLy8gR2V0IHRoZSBTcGVlY2hSZWNvZ25pdGlvbiBvYmplY3QsIHdoaWxlIGhhbmRsaW5nIGJyb3dzZXIgcHJlZml4ZXNcbiAgdmFyIFNwZWVjaFJlY29nbml0aW9uID0gcm9vdC5TcGVlY2hSZWNvZ25pdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICByb290LndlYmtpdFNwZWVjaFJlY29nbml0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3QubW96U3BlZWNoUmVjb2duaXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5tc1NwZWVjaFJlY29nbml0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3Qub1NwZWVjaFJlY29nbml0aW9uO1xuXG4gIC8vIENoZWNrIGJyb3dzZXIgc3VwcG9ydFxuICAvLyBUaGlzIGlzIGRvbmUgYXMgZWFybHkgYXMgcG9zc2libGUsIHRvIG1ha2UgaXQgYXMgZmFzdCBhcyBwb3NzaWJsZSBmb3IgdW5zdXBwb3J0ZWQgYnJvd3NlcnNcbiAgaWYgKCFTcGVlY2hSZWNvZ25pdGlvbikge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmFyIGNvbW1hbmRzTGlzdCA9IFtdO1xuICB2YXIgcmVjb2duaXRpb247XG4gIHZhciBjYWxsYmFja3MgPSB7IHN0YXJ0OiBbXSwgZXJyb3I6IFtdLCBlbmQ6IFtdLCByZXN1bHQ6IFtdLCByZXN1bHRNYXRjaDogW10sIHJlc3VsdE5vTWF0Y2g6IFtdLCBlcnJvck5ldHdvcms6IFtdLCBlcnJvclBlcm1pc3Npb25CbG9ja2VkOiBbXSwgZXJyb3JQZXJtaXNzaW9uRGVuaWVkOiBbXSB9O1xuICB2YXIgYXV0b1Jlc3RhcnQ7XG4gIHZhciBsYXN0U3RhcnRlZEF0ID0gMDtcbiAgdmFyIGRlYnVnU3RhdGUgPSBmYWxzZTtcbiAgdmFyIGRlYnVnU3R5bGUgPSAnZm9udC13ZWlnaHQ6IGJvbGQ7IGNvbG9yOiAjMDBmOyc7XG4gIHZhciBwYXVzZUxpc3RlbmluZyA9IGZhbHNlO1xuICB2YXIgaXNMaXN0ZW5pbmcgPSBmYWxzZTtcblxuICAvLyBUaGUgY29tbWFuZCBtYXRjaGluZyBjb2RlIGlzIGEgbW9kaWZpZWQgdmVyc2lvbiBvZiBCYWNrYm9uZS5Sb3V0ZXIgYnkgSmVyZW15IEFzaGtlbmFzLCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG4gIHZhciBvcHRpb25hbFBhcmFtID0gL1xccypcXCgoLio/KVxcKVxccyovZztcbiAgdmFyIG9wdGlvbmFsUmVnZXggPSAvKFxcKFxcPzpbXildK1xcKSlcXD8vZztcbiAgdmFyIG5hbWVkUGFyYW0gICAgPSAvKFxcKFxcPyk/OlxcdysvZztcbiAgdmFyIHNwbGF0UGFyYW0gICAgPSAvXFwqXFx3Ky9nO1xuICB2YXIgZXNjYXBlUmVnRXhwICA9IC9bXFwte31cXFtcXF0rPy4sXFxcXFxcXiR8I10vZztcbiAgdmFyIGNvbW1hbmRUb1JlZ0V4cCA9IGZ1bmN0aW9uKGNvbW1hbmQpIHtcbiAgICBjb21tYW5kID0gY29tbWFuZC5yZXBsYWNlKGVzY2FwZVJlZ0V4cCwgJ1xcXFwkJicpXG4gICAgICAgICAgICAgICAgICAucmVwbGFjZShvcHRpb25hbFBhcmFtLCAnKD86JDEpPycpXG4gICAgICAgICAgICAgICAgICAucmVwbGFjZShuYW1lZFBhcmFtLCBmdW5jdGlvbihtYXRjaCwgb3B0aW9uYWwpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9wdGlvbmFsID8gbWF0Y2ggOiAnKFteXFxcXHNdKyknO1xuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKHNwbGF0UGFyYW0sICcoLio/KScpXG4gICAgICAgICAgICAgICAgICAucmVwbGFjZShvcHRpb25hbFJlZ2V4LCAnXFxcXHMqJDE/XFxcXHMqJyk7XG4gICAgcmV0dXJuIG5ldyBSZWdFeHAoJ14nICsgY29tbWFuZCArICckJywgJ2knKTtcbiAgfTtcblxuICAvLyBUaGlzIG1ldGhvZCByZWNlaXZlcyBhbiBhcnJheSBvZiBjYWxsYmFja3MgdG8gaXRlcmF0ZSBvdmVyLCBhbmQgaW52b2tlcyBlYWNoIG9mIHRoZW1cbiAgdmFyIGludm9rZUNhbGxiYWNrcyA9IGZ1bmN0aW9uKGNhbGxiYWNrcykge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICBjYWxsYmFja3MuZm9yRWFjaChmdW5jdGlvbihjYWxsYmFjaykge1xuICAgICAgY2FsbGJhY2suY2FsbGJhY2suYXBwbHkoY2FsbGJhY2suY29udGV4dCwgYXJncyk7XG4gICAgfSk7XG4gIH07XG5cbiAgdmFyIGlzSW5pdGlhbGl6ZWQgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gcmVjb2duaXRpb24gIT09IHVuZGVmaW5lZDtcbiAgfTtcblxuICB2YXIgaW5pdElmTmVlZGVkID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKCFpc0luaXRpYWxpemVkKCkpIHtcbiAgICAgIGFubnlhbmcuaW5pdCh7fSwgZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgcmVnaXN0ZXJDb21tYW5kID0gZnVuY3Rpb24oY29tbWFuZCwgY2IsIHBocmFzZSkge1xuICAgIGNvbW1hbmRzTGlzdC5wdXNoKHsgY29tbWFuZDogY29tbWFuZCwgY2FsbGJhY2s6IGNiLCBvcmlnaW5hbFBocmFzZTogcGhyYXNlIH0pO1xuICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICBjb25zb2xlLmxvZygnQ29tbWFuZCBzdWNjZXNzZnVsbHkgbG9hZGVkOiAlYycrcGhyYXNlLCBkZWJ1Z1N0eWxlKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIHBhcnNlUmVzdWx0cyA9IGZ1bmN0aW9uKHJlc3VsdHMpIHtcbiAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLnJlc3VsdCwgcmVzdWx0cyk7XG4gICAgdmFyIGNvbW1hbmRUZXh0O1xuICAgIC8vIGdvIG92ZXIgZWFjaCBvZiB0aGUgNSByZXN1bHRzIGFuZCBhbHRlcm5hdGl2ZSByZXN1bHRzIHJlY2VpdmVkICh3ZSd2ZSBzZXQgbWF4QWx0ZXJuYXRpdmVzIHRvIDUgYWJvdmUpXG4gICAgZm9yICh2YXIgaSA9IDA7IGk8cmVzdWx0cy5sZW5ndGg7IGkrKykge1xuICAgICAgLy8gdGhlIHRleHQgcmVjb2duaXplZFxuICAgICAgY29tbWFuZFRleHQgPSByZXN1bHRzW2ldLnRyaW0oKTtcbiAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCdTcGVlY2ggcmVjb2duaXplZDogJWMnK2NvbW1hbmRUZXh0LCBkZWJ1Z1N0eWxlKTtcbiAgICAgIH1cblxuICAgICAgLy8gdHJ5IGFuZCBtYXRjaCByZWNvZ25pemVkIHRleHQgdG8gb25lIG9mIHRoZSBjb21tYW5kcyBvbiB0aGUgbGlzdFxuICAgICAgZm9yICh2YXIgaiA9IDAsIGwgPSBjb21tYW5kc0xpc3QubGVuZ3RoOyBqIDwgbDsgaisrKSB7XG4gICAgICAgIHZhciBjdXJyZW50Q29tbWFuZCA9IGNvbW1hbmRzTGlzdFtqXTtcbiAgICAgICAgdmFyIHJlc3VsdCA9IGN1cnJlbnRDb21tYW5kLmNvbW1hbmQuZXhlYyhjb21tYW5kVGV4dCk7XG4gICAgICAgIGlmIChyZXN1bHQpIHtcbiAgICAgICAgICB2YXIgcGFyYW1ldGVycyA9IHJlc3VsdC5zbGljZSgxKTtcbiAgICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ2NvbW1hbmQgbWF0Y2hlZDogJWMnK2N1cnJlbnRDb21tYW5kLm9yaWdpbmFsUGhyYXNlLCBkZWJ1Z1N0eWxlKTtcbiAgICAgICAgICAgIGlmIChwYXJhbWV0ZXJzLmxlbmd0aCkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnd2l0aCBwYXJhbWV0ZXJzJywgcGFyYW1ldGVycyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGV4ZWN1dGUgdGhlIG1hdGNoZWQgY29tbWFuZFxuICAgICAgICAgIGN1cnJlbnRDb21tYW5kLmNhbGxiYWNrLmFwcGx5KHRoaXMsIHBhcmFtZXRlcnMpO1xuICAgICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MucmVzdWx0TWF0Y2gsIGNvbW1hbmRUZXh0LCBjdXJyZW50Q29tbWFuZC5vcmlnaW5hbFBocmFzZSwgcmVzdWx0cyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MucmVzdWx0Tm9NYXRjaCwgcmVzdWx0cyk7XG4gIH07XG5cbiAgYW5ueWFuZyA9IHtcblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgYW5ueWFuZyB3aXRoIGEgbGlzdCBvZiBjb21tYW5kcyB0byByZWNvZ25pemUuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogdmFyIGNvbW1hbmRzID0geydoZWxsbyA6bmFtZSc6IGhlbGxvRnVuY3Rpb259O1xuICAgICAqIHZhciBjb21tYW5kczIgPSB7J2hpJzogaGVsbG9GdW5jdGlvbn07XG4gICAgICpcbiAgICAgKiAvLyBpbml0aWFsaXplIGFubnlhbmcsIG92ZXJ3cml0aW5nIGFueSBwcmV2aW91c2x5IGFkZGVkIGNvbW1hbmRzXG4gICAgICogYW5ueWFuZy5pbml0KGNvbW1hbmRzLCB0cnVlKTtcbiAgICAgKiAvLyBhZGRzIGFuIGFkZGl0aW9uYWwgY29tbWFuZCB3aXRob3V0IHJlbW92aW5nIHRoZSBwcmV2aW91cyBjb21tYW5kc1xuICAgICAqIGFubnlhbmcuaW5pdChjb21tYW5kczIsIGZhbHNlKTtcbiAgICAgKiBgYGBgXG4gICAgICogQXMgb2YgdjEuMS4wIGl0IGlzIG5vIGxvbmdlciByZXF1aXJlZCB0byBjYWxsIGluaXQoKS4gSnVzdCBzdGFydCgpIGxpc3RlbmluZyB3aGVuZXZlciB5b3Ugd2FudCwgYW5kIGFkZENvbW1hbmRzKCkgd2hlbmV2ZXIsIGFuZCBhcyBvZnRlbiBhcyB5b3UgbGlrZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb21tYW5kcyAtIENvbW1hbmRzIHRoYXQgYW5ueWFuZyBzaG91bGQgbGlzdGVuIHRvXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbcmVzZXRDb21tYW5kcz10cnVlXSAtIFJlbW92ZSBhbGwgY29tbWFuZHMgYmVmb3JlIGluaXRpYWxpemluZz9cbiAgICAgKiBAbWV0aG9kIGluaXRcbiAgICAgKiBAZGVwcmVjYXRlZFxuICAgICAqIEBzZWUgW0NvbW1hbmRzIE9iamVjdF0oI2NvbW1hbmRzLW9iamVjdClcbiAgICAgKi9cbiAgICBpbml0OiBmdW5jdGlvbihjb21tYW5kcywgcmVzZXRDb21tYW5kcykge1xuXG4gICAgICAvLyByZXNldENvbW1hbmRzIGRlZmF1bHRzIHRvIHRydWVcbiAgICAgIGlmIChyZXNldENvbW1hbmRzID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVzZXRDb21tYW5kcyA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXNldENvbW1hbmRzID0gISFyZXNldENvbW1hbmRzO1xuICAgICAgfVxuXG4gICAgICAvLyBBYm9ydCBwcmV2aW91cyBpbnN0YW5jZXMgb2YgcmVjb2duaXRpb24gYWxyZWFkeSBydW5uaW5nXG4gICAgICBpZiAocmVjb2duaXRpb24gJiYgcmVjb2duaXRpb24uYWJvcnQpIHtcbiAgICAgICAgcmVjb2duaXRpb24uYWJvcnQoKTtcbiAgICAgIH1cblxuICAgICAgLy8gaW5pdGlhdGUgU3BlZWNoUmVjb2duaXRpb25cbiAgICAgIHJlY29nbml0aW9uID0gbmV3IFNwZWVjaFJlY29nbml0aW9uKCk7XG5cbiAgICAgIC8vIFNldCB0aGUgbWF4IG51bWJlciBvZiBhbHRlcm5hdGl2ZSB0cmFuc2NyaXB0cyB0byB0cnkgYW5kIG1hdGNoIHdpdGggYSBjb21tYW5kXG4gICAgICByZWNvZ25pdGlvbi5tYXhBbHRlcm5hdGl2ZXMgPSA1O1xuXG4gICAgICAvLyBJbiBIVFRQUywgdHVybiBvZmYgY29udGludW91cyBtb2RlIGZvciBmYXN0ZXIgcmVzdWx0cy5cbiAgICAgIC8vIEluIEhUVFAsICB0dXJuIG9uICBjb250aW51b3VzIG1vZGUgZm9yIG11Y2ggc2xvd2VyIHJlc3VsdHMsIGJ1dCBubyByZXBlYXRpbmcgc2VjdXJpdHkgbm90aWNlc1xuICAgICAgcmVjb2duaXRpb24uY29udGludW91cyA9IHJvb3QubG9jYXRpb24ucHJvdG9jb2wgPT09ICdodHRwOic7XG5cbiAgICAgIC8vIFNldHMgdGhlIGxhbmd1YWdlIHRvIHRoZSBkZWZhdWx0ICdlbi1VUycuIFRoaXMgY2FuIGJlIGNoYW5nZWQgd2l0aCBhbm55YW5nLnNldExhbmd1YWdlKClcbiAgICAgIHJlY29nbml0aW9uLmxhbmcgPSAnZW4tVVMnO1xuXG4gICAgICByZWNvZ25pdGlvbi5vbnN0YXJ0ICAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaXNMaXN0ZW5pbmcgPSB0cnVlO1xuICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLnN0YXJ0KTtcbiAgICAgIH07XG5cbiAgICAgIHJlY29nbml0aW9uLm9uZXJyb3IgICA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MuZXJyb3IpO1xuICAgICAgICBzd2l0Y2ggKGV2ZW50LmVycm9yKSB7XG4gICAgICAgIGNhc2UgJ25ldHdvcmsnOlxuICAgICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MuZXJyb3JOZXR3b3JrKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnbm90LWFsbG93ZWQnOlxuICAgICAgICBjYXNlICdzZXJ2aWNlLW5vdC1hbGxvd2VkJzpcbiAgICAgICAgICAvLyBpZiBwZXJtaXNzaW9uIHRvIHVzZSB0aGUgbWljIGlzIGRlbmllZCwgdHVybiBvZmYgYXV0by1yZXN0YXJ0XG4gICAgICAgICAgYXV0b1Jlc3RhcnQgPSBmYWxzZTtcbiAgICAgICAgICAvLyBkZXRlcm1pbmUgaWYgcGVybWlzc2lvbiB3YXMgZGVuaWVkIGJ5IHVzZXIgb3IgYXV0b21hdGljYWxseS5cbiAgICAgICAgICBpZiAobmV3IERhdGUoKS5nZXRUaW1lKCktbGFzdFN0YXJ0ZWRBdCA8IDIwMCkge1xuICAgICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvclBlcm1pc3Npb25CbG9ja2VkKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvclBlcm1pc3Npb25EZW5pZWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgcmVjb2duaXRpb24ub25lbmQgICAgID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlzTGlzdGVuaW5nID0gZmFsc2U7XG4gICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MuZW5kKTtcbiAgICAgICAgLy8gYW5ueWFuZyB3aWxsIGF1dG8gcmVzdGFydCBpZiBpdCBpcyBjbG9zZWQgYXV0b21hdGljYWxseSBhbmQgbm90IGJ5IHVzZXIgYWN0aW9uLlxuICAgICAgICBpZiAoYXV0b1Jlc3RhcnQpIHtcbiAgICAgICAgICAvLyBwbGF5IG5pY2VseSB3aXRoIHRoZSBicm93c2VyLCBhbmQgbmV2ZXIgcmVzdGFydCBhbm55YW5nIGF1dG9tYXRpY2FsbHkgbW9yZSB0aGFuIG9uY2UgcGVyIHNlY29uZFxuICAgICAgICAgIHZhciB0aW1lU2luY2VMYXN0U3RhcnQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKS1sYXN0U3RhcnRlZEF0O1xuICAgICAgICAgIGlmICh0aW1lU2luY2VMYXN0U3RhcnQgPCAxMDAwKSB7XG4gICAgICAgICAgICBzZXRUaW1lb3V0KGFubnlhbmcuc3RhcnQsIDEwMDAtdGltZVNpbmNlTGFzdFN0YXJ0KTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYW5ueWFuZy5zdGFydCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgcmVjb2duaXRpb24ub25yZXN1bHQgID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYocGF1c2VMaXN0ZW5pbmcpIHtcbiAgICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NwZWVjaCBoZWFyZCwgYnV0IGFubnlhbmcgaXMgcGF1c2VkJyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIE1hcCB0aGUgcmVzdWx0cyB0byBhbiBhcnJheVxuICAgICAgICB2YXIgU3BlZWNoUmVjb2duaXRpb25SZXN1bHQgPSBldmVudC5yZXN1bHRzW2V2ZW50LnJlc3VsdEluZGV4XTtcbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgayA9IDA7IGs8U3BlZWNoUmVjb2duaXRpb25SZXN1bHQubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICByZXN1bHRzW2tdID0gU3BlZWNoUmVjb2duaXRpb25SZXN1bHRba10udHJhbnNjcmlwdDtcbiAgICAgICAgfVxuXG4gICAgICAgIHBhcnNlUmVzdWx0cyhyZXN1bHRzKTtcbiAgICAgIH07XG5cbiAgICAgIC8vIGJ1aWxkIGNvbW1hbmRzIGxpc3RcbiAgICAgIGlmIChyZXNldENvbW1hbmRzKSB7XG4gICAgICAgIGNvbW1hbmRzTGlzdCA9IFtdO1xuICAgICAgfVxuICAgICAgaWYgKGNvbW1hbmRzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLmFkZENvbW1hbmRzKGNvbW1hbmRzKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RhcnQgbGlzdGVuaW5nLlxuICAgICAqIEl0J3MgYSBnb29kIGlkZWEgdG8gY2FsbCB0aGlzIGFmdGVyIGFkZGluZyBzb21lIGNvbW1hbmRzIGZpcnN0LCBidXQgbm90IG1hbmRhdG9yeS5cbiAgICAgKlxuICAgICAqIFJlY2VpdmVzIGFuIG9wdGlvbmFsIG9wdGlvbnMgb2JqZWN0IHdoaWNoIHN1cHBvcnRzIHRoZSBmb2xsb3dpbmcgb3B0aW9uczpcbiAgICAgKlxuICAgICAqIC0gYGF1dG9SZXN0YXJ0YCAoYm9vbGVhbiwgZGVmYXVsdDogdHJ1ZSkgU2hvdWxkIGFubnlhbmcgcmVzdGFydCBpdHNlbGYgaWYgaXQgaXMgY2xvc2VkIGluZGlyZWN0bHksIGJlY2F1c2Ugb2Ygc2lsZW5jZSBvciB3aW5kb3cgY29uZmxpY3RzP1xuICAgICAqIC0gYGNvbnRpbnVvdXNgICAoYm9vbGVhbiwgZGVmYXVsdDogdW5kZWZpbmVkKSBBbGxvdyBmb3JjaW5nIGNvbnRpbnVvdXMgbW9kZSBvbiBvciBvZmYuIEFubnlhbmcgaXMgcHJldHR5IHNtYXJ0IGFib3V0IHRoaXMsIHNvIG9ubHkgc2V0IHRoaXMgaWYgeW91IGtub3cgd2hhdCB5b3UncmUgZG9pbmcuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogLy8gU3RhcnQgbGlzdGVuaW5nLCBkb24ndCByZXN0YXJ0IGF1dG9tYXRpY2FsbHlcbiAgICAgKiBhbm55YW5nLnN0YXJ0KHsgYXV0b1Jlc3RhcnQ6IGZhbHNlIH0pO1xuICAgICAqIC8vIFN0YXJ0IGxpc3RlbmluZywgZG9uJ3QgcmVzdGFydCBhdXRvbWF0aWNhbGx5LCBzdG9wIHJlY29nbml0aW9uIGFmdGVyIGZpcnN0IHBocmFzZSByZWNvZ25pemVkXG4gICAgICogYW5ueWFuZy5zdGFydCh7IGF1dG9SZXN0YXJ0OiBmYWxzZSwgY29udGludW91czogZmFsc2UgfSk7XG4gICAgICogYGBgYFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gLSBPcHRpb25hbCBvcHRpb25zLlxuICAgICAqIEBtZXRob2Qgc3RhcnRcbiAgICAgKi9cbiAgICBzdGFydDogZnVuY3Rpb24ob3B0aW9ucykge1xuICAgICAgcGF1c2VMaXN0ZW5pbmcgPSBmYWxzZTtcbiAgICAgIGluaXRJZk5lZWRlZCgpO1xuICAgICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gICAgICBpZiAob3B0aW9ucy5hdXRvUmVzdGFydCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGF1dG9SZXN0YXJ0ID0gISFvcHRpb25zLmF1dG9SZXN0YXJ0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYXV0b1Jlc3RhcnQgPSB0cnVlO1xuICAgICAgfVxuICAgICAgaWYgKG9wdGlvbnMuY29udGludW91cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJlY29nbml0aW9uLmNvbnRpbnVvdXMgPSAhIW9wdGlvbnMuY29udGludW91cztcbiAgICAgIH1cblxuICAgICAgbGFzdFN0YXJ0ZWRBdCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgcmVjb2duaXRpb24uc3RhcnQoKTtcbiAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGUubWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU3RvcCBsaXN0ZW5pbmcsIGFuZCB0dXJuIG9mZiBtaWMuXG4gICAgICpcbiAgICAgKiBBbHRlcm5hdGl2ZWx5LCB0byBvbmx5IHRlbXBvcmFyaWx5IHBhdXNlIGFubnlhbmcgcmVzcG9uZGluZyB0byBjb21tYW5kcyB3aXRob3V0IHN0b3BwaW5nIHRoZSBTcGVlY2hSZWNvZ25pdGlvbiBlbmdpbmUgb3IgY2xvc2luZyB0aGUgbWljLCB1c2UgcGF1c2UoKSBpbnN0ZWFkLlxuICAgICAqIEBzZWUgW3BhdXNlKCldKCNwYXVzZSlcbiAgICAgKlxuICAgICAqIEBtZXRob2QgYWJvcnRcbiAgICAgKi9cbiAgICBhYm9ydDogZnVuY3Rpb24oKSB7XG4gICAgICBhdXRvUmVzdGFydCA9IGZhbHNlO1xuICAgICAgaWYgKGlzSW5pdGlhbGl6ZWQoKSkge1xuICAgICAgICByZWNvZ25pdGlvbi5hYm9ydCgpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBQYXVzZSBsaXN0ZW5pbmcuIGFubnlhbmcgd2lsbCBzdG9wIHJlc3BvbmRpbmcgdG8gY29tbWFuZHMgKHVudGlsIHRoZSByZXN1bWUgb3Igc3RhcnQgbWV0aG9kcyBhcmUgY2FsbGVkKSwgd2l0aG91dCB0dXJuaW5nIG9mZiB0aGUgYnJvd3NlcidzIFNwZWVjaFJlY29nbml0aW9uIGVuZ2luZSBvciB0aGUgbWljLlxuICAgICAqXG4gICAgICogQWx0ZXJuYXRpdmVseSwgdG8gc3RvcCB0aGUgU3BlZWNoUmVjb2duaXRpb24gZW5naW5lIGFuZCBjbG9zZSB0aGUgbWljLCB1c2UgYWJvcnQoKSBpbnN0ZWFkLlxuICAgICAqIEBzZWUgW2Fib3J0KCldKCNhYm9ydClcbiAgICAgKlxuICAgICAqIEBtZXRob2QgcGF1c2VcbiAgICAgKi9cbiAgICBwYXVzZTogZnVuY3Rpb24oKSB7XG4gICAgICBwYXVzZUxpc3RlbmluZyA9IHRydWU7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlc3VtZXMgbGlzdGVuaW5nIGFuZCByZXN0b3JlcyBjb21tYW5kIGNhbGxiYWNrIGV4ZWN1dGlvbiB3aGVuIGEgcmVzdWx0IG1hdGNoZXMuXG4gICAgICogSWYgU3BlZWNoUmVjb2duaXRpb24gd2FzIGFib3J0ZWQgKHN0b3BwZWQpLCBzdGFydCBpdC5cbiAgICAgKlxuICAgICAqIEBtZXRob2QgcmVzdW1lXG4gICAgICovXG4gICAgcmVzdW1lOiBmdW5jdGlvbigpIHtcbiAgICAgIGFubnlhbmcuc3RhcnQoKTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogVHVybiBvbiBvdXRwdXQgb2YgZGVidWcgbWVzc2FnZXMgdG8gdGhlIGNvbnNvbGUuIFVnbHksIGJ1dCBzdXBlci1oYW5keSFcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW25ld1N0YXRlPXRydWVdIC0gVHVybiBvbi9vZmYgZGVidWcgbWVzc2FnZXNcbiAgICAgKiBAbWV0aG9kIGRlYnVnXG4gICAgICovXG4gICAgZGVidWc6IGZ1bmN0aW9uKG5ld1N0YXRlKSB7XG4gICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZGVidWdTdGF0ZSA9ICEhbmV3U3RhdGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWJ1Z1N0YXRlID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBsYW5ndWFnZSB0aGUgdXNlciB3aWxsIHNwZWFrIGluLiBJZiB0aGlzIG1ldGhvZCBpcyBub3QgY2FsbGVkLCBkZWZhdWx0cyB0byAnZW4tVVMnLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGxhbmd1YWdlIC0gVGhlIGxhbmd1YWdlIChsb2NhbGUpXG4gICAgICogQG1ldGhvZCBzZXRMYW5ndWFnZVxuICAgICAqIEBzZWUgW0xhbmd1YWdlc10oI2xhbmd1YWdlcylcbiAgICAgKi9cbiAgICBzZXRMYW5ndWFnZTogZnVuY3Rpb24obGFuZ3VhZ2UpIHtcbiAgICAgIGluaXRJZk5lZWRlZCgpO1xuICAgICAgcmVjb2duaXRpb24ubGFuZyA9IGxhbmd1YWdlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGQgY29tbWFuZHMgdGhhdCBhbm55YW5nIHdpbGwgcmVzcG9uZCB0by4gU2ltaWxhciBpbiBzeW50YXggdG8gaW5pdCgpLCBidXQgZG9lc24ndCByZW1vdmUgZXhpc3RpbmcgY29tbWFuZHMuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogdmFyIGNvbW1hbmRzID0geydoZWxsbyA6bmFtZSc6IGhlbGxvRnVuY3Rpb24sICdob3dkeSc6IGhlbGxvRnVuY3Rpb259O1xuICAgICAqIHZhciBjb21tYW5kczIgPSB7J2hpJzogaGVsbG9GdW5jdGlvbn07XG4gICAgICpcbiAgICAgKiBhbm55YW5nLmFkZENvbW1hbmRzKGNvbW1hbmRzKTtcbiAgICAgKiBhbm55YW5nLmFkZENvbW1hbmRzKGNvbW1hbmRzMik7XG4gICAgICogLy8gYW5ueWFuZyB3aWxsIG5vdyBsaXN0ZW4gdG8gYWxsIHRocmVlIGNvbW1hbmRzXG4gICAgICogYGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbW1hbmRzIC0gQ29tbWFuZHMgdGhhdCBhbm55YW5nIHNob3VsZCBsaXN0ZW4gdG9cbiAgICAgKiBAbWV0aG9kIGFkZENvbW1hbmRzXG4gICAgICogQHNlZSBbQ29tbWFuZHMgT2JqZWN0XSgjY29tbWFuZHMtb2JqZWN0KVxuICAgICAqL1xuICAgIGFkZENvbW1hbmRzOiBmdW5jdGlvbihjb21tYW5kcykge1xuICAgICAgdmFyIGNiO1xuXG4gICAgICBpbml0SWZOZWVkZWQoKTtcblxuICAgICAgZm9yICh2YXIgcGhyYXNlIGluIGNvbW1hbmRzKSB7XG4gICAgICAgIGlmIChjb21tYW5kcy5oYXNPd25Qcm9wZXJ0eShwaHJhc2UpKSB7XG4gICAgICAgICAgY2IgPSByb290W2NvbW1hbmRzW3BocmFzZV1dIHx8IGNvbW1hbmRzW3BocmFzZV07XG4gICAgICAgICAgaWYgKHR5cGVvZiBjYiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgLy8gY29udmVydCBjb21tYW5kIHRvIHJlZ2V4IHRoZW4gcmVnaXN0ZXIgdGhlIGNvbW1hbmRcbiAgICAgICAgICAgIHJlZ2lzdGVyQ29tbWFuZChjb21tYW5kVG9SZWdFeHAocGhyYXNlKSwgY2IsIHBocmFzZSk7XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY2IgPT09ICdvYmplY3QnICYmIGNiLnJlZ2V4cCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgICAgLy8gcmVnaXN0ZXIgdGhlIGNvbW1hbmRcbiAgICAgICAgICAgIHJlZ2lzdGVyQ29tbWFuZChuZXcgUmVnRXhwKGNiLnJlZ2V4cC5zb3VyY2UsICdpJyksIGNiLmNhbGxiYWNrLCBwaHJhc2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZygnQ2FuIG5vdCByZWdpc3RlciBjb21tYW5kOiAlYycrcGhyYXNlLCBkZWJ1Z1N0eWxlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgZXhpc3RpbmcgY29tbWFuZHMuIENhbGxlZCB3aXRoIGEgc2luZ2xlIHBocmFzZSwgYXJyYXkgb2YgcGhyYXNlcywgb3IgbWV0aG9kaWNhbGx5LiBQYXNzIG5vIHBhcmFtcyB0byByZW1vdmUgYWxsIGNvbW1hbmRzLlxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIHZhciBjb21tYW5kcyA9IHsnaGVsbG8nOiBoZWxsb0Z1bmN0aW9uLCAnaG93ZHknOiBoZWxsb0Z1bmN0aW9uLCAnaGknOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKlxuICAgICAqIC8vIFJlbW92ZSBhbGwgZXhpc3RpbmcgY29tbWFuZHNcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNvbW1hbmRzKCk7XG4gICAgICpcbiAgICAgKiAvLyBBZGQgc29tZSBjb21tYW5kc1xuICAgICAqIGFubnlhbmcuYWRkQ29tbWFuZHMoY29tbWFuZHMpO1xuICAgICAqXG4gICAgICogLy8gRG9uJ3QgcmVzcG9uZCB0byBoZWxsb1xuICAgICAqIGFubnlhbmcucmVtb3ZlQ29tbWFuZHMoJ2hlbGxvJyk7XG4gICAgICpcbiAgICAgKiAvLyBEb24ndCByZXNwb25kIHRvIGhvd2R5IG9yIGhpXG4gICAgICogYW5ueWFuZy5yZW1vdmVDb21tYW5kcyhbJ2hvd2R5JywgJ2hpJ10pO1xuICAgICAqIGBgYGBcbiAgICAgKiBAcGFyYW0ge1N0cmluZ3xBcnJheXxVbmRlZmluZWR9IFtjb21tYW5kc1RvUmVtb3ZlXSAtIENvbW1hbmRzIHRvIHJlbW92ZVxuICAgICAqIEBtZXRob2QgcmVtb3ZlQ29tbWFuZHNcbiAgICAgKi9cbiAgICByZW1vdmVDb21tYW5kczogZnVuY3Rpb24oY29tbWFuZHNUb1JlbW92ZSkge1xuICAgICAgaWYgKGNvbW1hbmRzVG9SZW1vdmUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBjb21tYW5kc0xpc3QgPSBbXTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY29tbWFuZHNUb1JlbW92ZSA9IEFycmF5LmlzQXJyYXkoY29tbWFuZHNUb1JlbW92ZSkgPyBjb21tYW5kc1RvUmVtb3ZlIDogW2NvbW1hbmRzVG9SZW1vdmVdO1xuICAgICAgY29tbWFuZHNMaXN0ID0gY29tbWFuZHNMaXN0LmZpbHRlcihmdW5jdGlvbihjb21tYW5kKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpPGNvbW1hbmRzVG9SZW1vdmUubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZiAoY29tbWFuZHNUb1JlbW92ZVtpXSA9PT0gY29tbWFuZC5vcmlnaW5hbFBocmFzZSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBBZGQgYSBjYWxsYmFjayBmdW5jdGlvbiB0byBiZSBjYWxsZWQgaW4gY2FzZSBvbmUgb2YgdGhlIGZvbGxvd2luZyBldmVudHMgaGFwcGVuczpcbiAgICAgKlxuICAgICAqICogYHN0YXJ0YCAtIEZpcmVkIGFzIHNvb24gYXMgdGhlIGJyb3dzZXIncyBTcGVlY2ggUmVjb2duaXRpb24gZW5naW5lIHN0YXJ0cyBsaXN0ZW5pbmdcbiAgICAgKiAqIGBlcnJvcmAgLSBGaXJlZCB3aGVuIHRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbnRpb24gZW5naW5lIHJldHVybnMgYW4gZXJyb3IsIHRoaXMgZ2VuZXJpYyBlcnJvciBjYWxsYmFjayB3aWxsIGJlIGZvbGxvd2VkIGJ5IG1vcmUgYWNjdXJhdGUgZXJyb3IgY2FsbGJhY2tzIChib3RoIHdpbGwgZmlyZSBpZiBib3RoIGFyZSBkZWZpbmVkKVxuICAgICAqICogYGVycm9yTmV0d29ya2AgLSBGaXJlZCB3aGVuIFNwZWVjaCBSZWNvZ25pdGlvbiBmYWlscyBiZWNhdXNlIG9mIGEgbmV0d29yayBlcnJvclxuICAgICAqICogYGVycm9yUGVybWlzc2lvbkJsb2NrZWRgIC0gRmlyZWQgd2hlbiB0aGUgYnJvd3NlciBibG9ja3MgdGhlIHBlcm1pc3Npb24gcmVxdWVzdCB0byB1c2UgU3BlZWNoIFJlY29nbml0aW9uLlxuICAgICAqICogYGVycm9yUGVybWlzc2lvbkRlbmllZGAgLSBGaXJlZCB3aGVuIHRoZSB1c2VyIGJsb2NrcyB0aGUgcGVybWlzc2lvbiByZXF1ZXN0IHRvIHVzZSBTcGVlY2ggUmVjb2duaXRpb24uXG4gICAgICogKiBgZW5kYCAtIEZpcmVkIHdoZW4gdGhlIGJyb3dzZXIncyBTcGVlY2ggUmVjb2duaXRpb24gZW5naW5lIHN0b3BzXG4gICAgICogKiBgcmVzdWx0YCAtIEZpcmVkIGFzIHNvb24gYXMgc29tZSBzcGVlY2ggd2FzIGlkZW50aWZpZWQuIFRoaXMgZ2VuZXJpYyBjYWxsYmFjayB3aWxsIGJlIGZvbGxvd2VkIGJ5IGVpdGhlciB0aGUgYHJlc3VsdE1hdGNoYCBvciBgcmVzdWx0Tm9NYXRjaGAgY2FsbGJhY2tzLlxuICAgICAqICAgICBDYWxsYmFjayBmdW5jdGlvbnMgcmVnaXN0ZXJlZCB0byB0aGlzIGV2ZW50IHdpbGwgaW5jbHVkZSBhbiBhcnJheSBvZiBwb3NzaWJsZSBwaHJhc2VzIHRoZSB1c2VyIHNhaWQgYXMgdGhlIGZpcnN0IGFyZ3VtZW50XG4gICAgICogKiBgcmVzdWx0TWF0Y2hgIC0gRmlyZWQgd2hlbiBhbm55YW5nIHdhcyBhYmxlIHRvIG1hdGNoIGJldHdlZW4gd2hhdCB0aGUgdXNlciBzYWlkIGFuZCBhIHJlZ2lzdGVyZWQgY29tbWFuZFxuICAgICAqICAgICBDYWxsYmFjayBmdW5jdGlvbnMgcmVnaXN0ZXJlZCB0byB0aGlzIGV2ZW50IHdpbGwgaW5jbHVkZSB0aHJlZSBhcmd1bWVudHMgaW4gdGhlIGZvbGxvd2luZyBvcmRlcjpcbiAgICAgKiAgICAgICAqIFRoZSBwaHJhc2UgdGhlIHVzZXIgc2FpZCB0aGF0IG1hdGNoZWQgYSBjb21tYW5kXG4gICAgICogICAgICAgKiBUaGUgY29tbWFuZCB0aGF0IHdhcyBtYXRjaGVkXG4gICAgICogICAgICAgKiBBbiBhcnJheSBvZiBwb3NzaWJsZSBhbHRlcm5hdGl2ZSBwaHJhc2VzIHRoZSB1c2VyIG1pZ2h0J3ZlIHNhaWRcbiAgICAgKiAqIGByZXN1bHROb01hdGNoYCAtIEZpcmVkIHdoZW4gd2hhdCB0aGUgdXNlciBzYWlkIGRpZG4ndCBtYXRjaCBhbnkgb2YgdGhlIHJlZ2lzdGVyZWQgY29tbWFuZHMuXG4gICAgICogICAgIENhbGxiYWNrIGZ1bmN0aW9ucyByZWdpc3RlcmVkIHRvIHRoaXMgZXZlbnQgd2lsbCBpbmNsdWRlIGFuIGFycmF5IG9mIHBvc3NpYmxlIHBocmFzZXMgdGhlIHVzZXIgbWlnaHQndmUgc2FpZCBhcyB0aGUgZmlyc3QgYXJndW1lbnRcbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdlcnJvcicsIGZ1bmN0aW9uKCkge1xuICAgICAqICAgJCgnLm15RXJyb3JUZXh0JykudGV4dCgnVGhlcmUgd2FzIGFuIGVycm9yIScpO1xuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygncmVzdWx0TWF0Y2gnLCBmdW5jdGlvbih1c2VyU2FpZCwgY29tbWFuZFRleHQsIHBocmFzZXMpIHtcbiAgICAgKiAgIGNvbnNvbGUubG9nKHVzZXJTYWlkKTsgLy8gc2FtcGxlIG91dHB1dDogJ2hlbGxvJ1xuICAgICAqICAgY29uc29sZS5sb2coY29tbWFuZFRleHQpOyAvLyBzYW1wbGUgb3V0cHV0OiAnaGVsbG8gKHRoZXJlKSdcbiAgICAgKiAgIGNvbnNvbGUubG9nKHBocmFzZXMpOyAvLyBzYW1wbGUgb3V0cHV0OiBbJ2hlbGxvJywgJ2hhbG8nLCAneWVsbG93JywgJ3BvbG8nLCAnaGVsbG8ga2l0dHknXVxuICAgICAqIH0pO1xuICAgICAqXG4gICAgICogLy8gcGFzcyBsb2NhbCBjb250ZXh0IHRvIGEgZ2xvYmFsIGZ1bmN0aW9uIGNhbGxlZCBub3RDb25uZWN0ZWRcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdlcnJvck5ldHdvcmsnLCBub3RDb25uZWN0ZWQsIHRoaXMpO1xuICAgICAqIGBgYGBcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gdHlwZSAtIE5hbWUgb2YgZXZlbnQgdGhhdCB3aWxsIHRyaWdnZXIgdGhpcyBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrIC0gVGhlIGZ1bmN0aW9uIHRvIGNhbGwgd2hlbiBldmVudCBpcyB0cmlnZ2VyZWRcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW2NvbnRleHRdIC0gT3B0aW9uYWwgY29udGV4dCBmb3IgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uXG4gICAgICogQG1ldGhvZCBhZGRDYWxsYmFja1xuICAgICAqL1xuICAgIGFkZENhbGxiYWNrOiBmdW5jdGlvbih0eXBlLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgICAgaWYgKGNhbGxiYWNrc1t0eXBlXSAgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB2YXIgY2IgPSByb290W2NhbGxiYWNrXSB8fCBjYWxsYmFjaztcbiAgICAgIGlmICh0eXBlb2YgY2IgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgY2FsbGJhY2tzW3R5cGVdLnB1c2goe2NhbGxiYWNrOiBjYiwgY29udGV4dDogY29udGV4dCB8fCB0aGlzfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBjYWxsYmFja3MgZnJvbSBldmVudHMuXG4gICAgICpcbiAgICAgKiAtIFBhc3MgYW4gZXZlbnQgbmFtZSBhbmQgYSBjYWxsYmFjayBjb21tYW5kIHRvIHJlbW92ZSB0aGF0IGNhbGxiYWNrIGNvbW1hbmQgZnJvbSB0aGF0IGV2ZW50IHR5cGUuXG4gICAgICogLSBQYXNzIGp1c3QgYW4gZXZlbnQgbmFtZSB0byByZW1vdmUgYWxsIGNhbGxiYWNrIGNvbW1hbmRzIGZyb20gdGhhdCBldmVudCB0eXBlLlxuICAgICAqIC0gUGFzcyB1bmRlZmluZWQgYXMgZXZlbnQgbmFtZSBhbmQgYSBjYWxsYmFjayBjb21tYW5kIHRvIHJlbW92ZSB0aGF0IGNhbGxiYWNrIGNvbW1hbmQgZnJvbSBhbGwgZXZlbnQgdHlwZXMuXG4gICAgICogLSBQYXNzIG5vIHBhcmFtcyB0byByZW1vdmUgYWxsIGNhbGxiYWNrIGNvbW1hbmRzIGZyb20gYWxsIGV2ZW50IHR5cGVzLlxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ3N0YXJ0JywgbXlGdW5jdGlvbjEpO1xuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ3N0YXJ0JywgbXlGdW5jdGlvbjIpO1xuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2VuZCcsIG15RnVuY3Rpb24xKTtcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdlbmQnLCBteUZ1bmN0aW9uMik7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgYWxsIGNhbGxiYWNrcyBmcm9tIGFsbCBldmVudHM6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjaygpO1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIGFsbCBjYWxsYmFja3MgYXR0YWNoZWQgdG8gZW5kIGV2ZW50OlxuICAgICAqIGFubnlhbmcucmVtb3ZlQ2FsbGJhY2soJ2VuZCcpO1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIG15RnVuY3Rpb24yIGZyb20gYmVpbmcgY2FsbGVkIG9uIHN0YXJ0OlxuICAgICAqIGFubnlhbmcucmVtb3ZlQ2FsbGJhY2soJ3N0YXJ0JywgbXlGdW5jdGlvbjIpO1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIG15RnVuY3Rpb24xIGZyb20gYmVpbmcgY2FsbGVkIG9uIGFsbCBldmVudHM6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjayh1bmRlZmluZWQsIG15RnVuY3Rpb24xKTtcbiAgICAgKiBgYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdHlwZSBOYW1lIG9mIGV2ZW50IHR5cGUgdG8gcmVtb3ZlIGNhbGxiYWNrIGZyb21cbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sgVGhlIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIHJlbW92ZVxuICAgICAqIEByZXR1cm5zIHVuZGVmaW5lZFxuICAgICAqIEBtZXRob2QgcmVtb3ZlQ2FsbGJhY2tcbiAgICAgKi9cbiAgICByZW1vdmVDYWxsYmFjazogZnVuY3Rpb24odHlwZSwgY2FsbGJhY2spIHtcbiAgICAgIHZhciBjb21wYXJlV2l0aENhbGxiYWNrUGFyYW1ldGVyID0gZnVuY3Rpb24oY2IpIHtcbiAgICAgICAgcmV0dXJuIGNiLmNhbGxiYWNrICE9PSBjYWxsYmFjaztcbiAgICAgIH07XG4gICAgICAvLyBHbyBvdmVyIGVhY2ggY2FsbGJhY2sgdHlwZSBpbiBjYWxsYmFja3Mgc3RvcmUgb2JqZWN0XG4gICAgICBmb3IgKHZhciBjYWxsYmFja1R5cGUgaW4gY2FsbGJhY2tzKSB7XG4gICAgICAgIGlmIChjYWxsYmFja3MuaGFzT3duUHJvcGVydHkoY2FsbGJhY2tUeXBlKSkge1xuICAgICAgICAgIC8vIGlmIHRoaXMgaXMgdGhlIHR5cGUgdXNlciBhc2tlZCB0byBkZWxldGUsIG9yIGhlIGFza2VkIHRvIGRlbGV0ZSBhbGwsIGdvIGFoZWFkLlxuICAgICAgICAgIGlmICh0eXBlID09PSB1bmRlZmluZWQgfHwgdHlwZSA9PT0gY2FsbGJhY2tUeXBlKSB7XG4gICAgICAgICAgICAvLyBJZiB1c2VyIGFza2VkIHRvIGRlbGV0ZSBhbGwgY2FsbGJhY2tzIGluIHRoaXMgdHlwZSBvciBhbGwgdHlwZXNcbiAgICAgICAgICAgIGlmIChjYWxsYmFjayA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzW2NhbGxiYWNrVHlwZV0gPSBbXTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgYWxsIG1hdGNoaW5nIGNhbGxiYWNrc1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrc1tjYWxsYmFja1R5cGVdID0gY2FsbGJhY2tzW2NhbGxiYWNrVHlwZV0uZmlsdGVyKGNvbXBhcmVXaXRoQ2FsbGJhY2tQYXJhbWV0ZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRydWUgaWYgc3BlZWNoIHJlY29nbml0aW9uIGlzIGN1cnJlbnRseSBvbi5cbiAgICAgKiBSZXR1cm5zIGZhbHNlIGlmIHNwZWVjaCByZWNvZ25pdGlvbiBpcyBvZmYgb3IgYW5ueWFuZyBpcyBwYXVzZWQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIGJvb2xlYW4gdHJ1ZSA9IFNwZWVjaFJlY29nbml0aW9uIGlzIG9uIGFuZCBhbm55YW5nIGlzIGxpc3RlbmluZ1xuICAgICAqIEBtZXRob2QgaXNMaXN0ZW5pbmdcbiAgICAgKi9cbiAgICBpc0xpc3RlbmluZzogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gaXNMaXN0ZW5pbmcgJiYgIXBhdXNlTGlzdGVuaW5nO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIHRoZSBpbnN0YW5jZSBvZiB0aGUgYnJvd3NlcidzIFNwZWVjaFJlY29nbml0aW9uIG9iamVjdCB1c2VkIGJ5IGFubnlhbmcuXG4gICAgICogVXNlZnVsIGluIGNhc2UgeW91IHdhbnQgZGlyZWN0IGFjY2VzcyB0byB0aGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pdGlvbiBlbmdpbmUuXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyBTcGVlY2hSZWNvZ25pdGlvbiBUaGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pemVyIGN1cnJlbnRseSB1c2VkIGJ5IGFubnlhbmdcbiAgICAgKiBAbWV0aG9kIGdldFNwZWVjaFJlY29nbml6ZXJcbiAgICAgKi9cbiAgICBnZXRTcGVlY2hSZWNvZ25pemVyOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiByZWNvZ25pdGlvbjtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogU2ltdWxhdGUgc3BlZWNoIGJlaW5nIHJlY29nbml6ZWQuIFRoaXMgd2lsbCB0cmlnZ2VyIHRoZSBzYW1lIGV2ZW50cyBhbmQgYmVoYXZpb3IgYXMgd2hlbiB0aGUgU3BlZWNoIFJlY29nbml0aW9uXG4gICAgICogZGV0ZWN0cyBzcGVlY2guXG4gICAgICpcbiAgICAgKiBDYW4gYWNjZXB0IGVpdGhlciBhIHN0cmluZyBjb250YWluaW5nIGEgc2luZ2xlIHNlbnRlbmNlLCBvciBhbiBhcnJheSBjb250YWluaW5nIG11bHRpcGxlIHNlbnRlbmNlcyB0byBiZSBjaGVja2VkXG4gICAgICogaW4gb3JkZXIgdW50aWwgb25lIG9mIHRoZW0gbWF0Y2hlcyBhIGNvbW1hbmQgKHNpbWlsYXIgdG8gdGhlIHdheSBTcGVlY2ggUmVjb2duaXRpb24gQWx0ZXJuYXRpdmVzIGFyZSBwYXJzZWQpXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogYW5ueWFuZy50cmlnZ2VyKCdUaW1lIGZvciBzb21lIHRocmlsbGluZyBoZXJvaWNzJyk7XG4gICAgICogYW5ueWFuZy50cmlnZ2VyKFxuICAgICAqICAgICBbJ1RpbWUgZm9yIHNvbWUgdGhyaWxsaW5nIGhlcm9pY3MnLCAnVGltZSBmb3Igc29tZSB0aHJpbGxpbmcgYWVyb2JpY3MnXVxuICAgICAqICAgKTtcbiAgICAgKiBgYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0gc3RyaW5nfGFycmF5IHNlbnRlbmNlcyBBIHNlbnRlbmNlIGFzIGEgc3RyaW5nIG9yIGFuIGFycmF5IG9mIHN0cmluZ3Mgb2YgcG9zc2libGUgc2VudGVuY2VzXG4gICAgICogQHJldHVybnMgdW5kZWZpbmVkXG4gICAgICogQG1ldGhvZCB0cmlnZ2VyXG4gICAgICovXG4gICAgdHJpZ2dlcjogZnVuY3Rpb24oc2VudGVuY2VzKSB7XG4gICAgICAvKlxuICAgICAgaWYoIWFubnlhbmcuaXNMaXN0ZW5pbmcoKSkge1xuICAgICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICAgIGlmICghaXNMaXN0ZW5pbmcpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDYW5ub3QgdHJpZ2dlciB3aGlsZSBhbm55YW5nIGlzIGFib3J0ZWQnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1NwZWVjaCBoZWFyZCwgYnV0IGFubnlhbmcgaXMgcGF1c2VkJyk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgICovXG5cbiAgICAgIGlmICghQXJyYXkuaXNBcnJheShzZW50ZW5jZXMpKSB7XG4gICAgICAgIHNlbnRlbmNlcyA9IFtzZW50ZW5jZXNdO1xuICAgICAgfVxuXG4gICAgICBwYXJzZVJlc3VsdHMoc2VudGVuY2VzKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIGFubnlhbmc7XG5cbn0pKTtcblxuLyoqXG4gKiAjIEdvb2QgdG8gS25vd1xuICpcbiAqICMjIENvbW1hbmRzIE9iamVjdFxuICpcbiAqIEJvdGggdGhlIFtpbml0KCldKCkgYW5kIGFkZENvbW1hbmRzKCkgbWV0aG9kcyByZWNlaXZlIGEgYGNvbW1hbmRzYCBvYmplY3QuXG4gKlxuICogYW5ueWFuZyB1bmRlcnN0YW5kcyBjb21tYW5kcyB3aXRoIGBuYW1lZCB2YXJpYWJsZXNgLCBgc3BsYXRzYCwgYW5kIGBvcHRpb25hbCB3b3Jkc2AuXG4gKlxuICogKiBVc2UgYG5hbWVkIHZhcmlhYmxlc2AgZm9yIG9uZSB3b3JkIGFyZ3VtZW50cyBpbiB5b3VyIGNvbW1hbmQuXG4gKiAqIFVzZSBgc3BsYXRzYCB0byBjYXB0dXJlIG11bHRpLXdvcmQgdGV4dCBhdCB0aGUgZW5kIG9mIHlvdXIgY29tbWFuZCAoZ3JlZWR5KS5cbiAqICogVXNlIGBvcHRpb25hbCB3b3Jkc2Agb3IgcGhyYXNlcyB0byBkZWZpbmUgYSBwYXJ0IG9mIHRoZSBjb21tYW5kIGFzIG9wdGlvbmFsLlxuICpcbiAqICMjIyMgRXhhbXBsZXM6XG4gKiBgYGBgaHRtbFxuICogPHNjcmlwdD5cbiAqIHZhciBjb21tYW5kcyA9IHtcbiAqICAgLy8gYW5ueWFuZyB3aWxsIGNhcHR1cmUgYW55dGhpbmcgYWZ0ZXIgYSBzcGxhdCAoKikgYW5kIHBhc3MgaXQgdG8gdGhlIGZ1bmN0aW9uLlxuICogICAvLyBlLmcuIHNheWluZyBcIlNob3cgbWUgQmF0bWFuIGFuZCBSb2JpblwiIHdpbGwgY2FsbCBzaG93RmxpY2tyKCdCYXRtYW4gYW5kIFJvYmluJyk7XG4gKiAgICdzaG93IG1lICp0YWcnOiBzaG93RmxpY2tyLFxuICpcbiAqICAgLy8gQSBuYW1lZCB2YXJpYWJsZSBpcyBhIG9uZSB3b3JkIHZhcmlhYmxlLCB0aGF0IGNhbiBmaXQgYW55d2hlcmUgaW4geW91ciBjb21tYW5kLlxuICogICAvLyBlLmcuIHNheWluZyBcImNhbGN1bGF0ZSBPY3RvYmVyIHN0YXRzXCIgd2lsbCBjYWxsIGNhbGN1bGF0ZVN0YXRzKCdPY3RvYmVyJyk7XG4gKiAgICdjYWxjdWxhdGUgOm1vbnRoIHN0YXRzJzogY2FsY3VsYXRlU3RhdHMsXG4gKlxuICogICAvLyBCeSBkZWZpbmluZyBhIHBhcnQgb2YgdGhlIGZvbGxvd2luZyBjb21tYW5kIGFzIG9wdGlvbmFsLCBhbm55YW5nIHdpbGwgcmVzcG9uZFxuICogICAvLyB0byBib3RoOiBcInNheSBoZWxsbyB0byBteSBsaXR0bGUgZnJpZW5kXCIgYXMgd2VsbCBhcyBcInNheSBoZWxsbyBmcmllbmRcIlxuICogICAnc2F5IGhlbGxvICh0byBteSBsaXR0bGUpIGZyaWVuZCc6IGdyZWV0aW5nXG4gKiB9O1xuICpcbiAqIHZhciBzaG93RmxpY2tyID0gZnVuY3Rpb24odGFnKSB7XG4gKiAgIHZhciB1cmwgPSAnaHR0cDovL2FwaS5mbGlja3IuY29tL3NlcnZpY2VzL3Jlc3QvP3RhZ3M9Jyt0YWc7XG4gKiAgICQuZ2V0SlNPTih1cmwpO1xuICogfVxuICpcbiAqIHZhciBjYWxjdWxhdGVTdGF0cyA9IGZ1bmN0aW9uKG1vbnRoKSB7XG4gKiAgICQoJyNzdGF0cycpLnRleHQoJ1N0YXRpc3RpY3MgZm9yICcrbW9udGgpO1xuICogfVxuICpcbiAqIHZhciBncmVldGluZyA9IGZ1bmN0aW9uKCkge1xuICogICAkKCcjZ3JlZXRpbmcnKS50ZXh0KCdIZWxsbyEnKTtcbiAqIH1cbiAqIDwvc2NyaXB0PlxuICogYGBgYFxuICpcbiAqICMjIyBVc2luZyBSZWd1bGFyIEV4cHJlc3Npb25zIGluIGNvbW1hbmRzXG4gKiBGb3IgYWR2YW5jZWQgY29tbWFuZHMsIHlvdSBjYW4gcGFzcyBhIHJlZ3VsYXIgZXhwcmVzc2lvbiBvYmplY3QsIGluc3RlYWQgb2ZcbiAqIGEgc2ltcGxlIHN0cmluZyBjb21tYW5kLlxuICpcbiAqIFRoaXMgaXMgZG9uZSBieSBwYXNzaW5nIGFuIG9iamVjdCBjb250YWluaW5nIHR3byBwcm9wZXJ0aWVzOiBgcmVnZXhwYCwgYW5kXG4gKiBgY2FsbGJhY2tgIGluc3RlYWQgb2YgdGhlIGZ1bmN0aW9uLlxuICpcbiAqICMjIyMgRXhhbXBsZXM6XG4gKiBgYGBgamF2YXNjcmlwdFxuICogdmFyIGNhbGN1bGF0ZUZ1bmN0aW9uID0gZnVuY3Rpb24obW9udGgpIHsgY29uc29sZS5sb2cobW9udGgpOyB9XG4gKiB2YXIgY29tbWFuZHMgPSB7XG4gKiAgIC8vIFRoaXMgZXhhbXBsZSB3aWxsIGFjY2VwdCBhbnkgd29yZCBhcyB0aGUgXCJtb250aFwiXG4gKiAgICdjYWxjdWxhdGUgOm1vbnRoIHN0YXRzJzogY2FsY3VsYXRlRnVuY3Rpb24sXG4gKiAgIC8vIFRoaXMgZXhhbXBsZSB3aWxsIG9ubHkgYWNjZXB0IG1vbnRocyB3aGljaCBhcmUgYXQgdGhlIHN0YXJ0IG9mIGEgcXVhcnRlclxuICogICAnY2FsY3VsYXRlIDpxdWFydGVyIHN0YXRzJzogeydyZWdleHAnOiAvXmNhbGN1bGF0ZSAoSmFudWFyeXxBcHJpbHxKdWx5fE9jdG9iZXIpIHN0YXRzJC8sICdjYWxsYmFjayc6IGNhbGN1bGF0ZUZ1bmN0aW9ufVxuICogfVxuIGBgYGBcbiAqXG4gKiAjIyBMYW5ndWFnZXNcbiAqXG4gKiBXaGlsZSB0aGVyZSBpc24ndCBhbiBvZmZpY2lhbCBsaXN0IG9mIHN1cHBvcnRlZCBsYW5ndWFnZXMgKGN1bHR1cmVzPyBsb2NhbGVzPyksIGhlcmUgaXMgYSBsaXN0IGJhc2VkIG9uIFthbmVjZG90YWwgZXZpZGVuY2VdKGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzE0MzAyMTM0LzMzODAzOSkuXG4gKlxuICogKiBBZnJpa2FhbnMgYGFmYFxuICogKiBCYXNxdWUgYGV1YFxuICogKiBCdWxnYXJpYW4gYGJnYFxuICogKiBDYXRhbGFuIGBjYWBcbiAqICogQXJhYmljIChFZ3lwdCkgYGFyLUVHYFxuICogKiBBcmFiaWMgKEpvcmRhbikgYGFyLUpPYFxuICogKiBBcmFiaWMgKEt1d2FpdCkgYGFyLUtXYFxuICogKiBBcmFiaWMgKExlYmFub24pIGBhci1MQmBcbiAqICogQXJhYmljIChRYXRhcikgYGFyLVFBYFxuICogKiBBcmFiaWMgKFVBRSkgYGFyLUFFYFxuICogKiBBcmFiaWMgKE1vcm9jY28pIGBhci1NQWBcbiAqICogQXJhYmljIChJcmFxKSBgYXItSVFgXG4gKiAqIEFyYWJpYyAoQWxnZXJpYSkgYGFyLURaYFxuICogKiBBcmFiaWMgKEJhaHJhaW4pIGBhci1CSGBcbiAqICogQXJhYmljIChMeWJpYSkgYGFyLUxZYFxuICogKiBBcmFiaWMgKE9tYW4pIGBhci1PTWBcbiAqICogQXJhYmljIChTYXVkaSBBcmFiaWEpIGBhci1TQWBcbiAqICogQXJhYmljIChUdW5pc2lhKSBgYXItVE5gXG4gKiAqIEFyYWJpYyAoWWVtZW4pIGBhci1ZRWBcbiAqICogQ3plY2ggYGNzYFxuICogKiBEdXRjaCBgbmwtTkxgXG4gKiAqIEVuZ2xpc2ggKEF1c3RyYWxpYSkgYGVuLUFVYFxuICogKiBFbmdsaXNoIChDYW5hZGEpIGBlbi1DQWBcbiAqICogRW5nbGlzaCAoSW5kaWEpIGBlbi1JTmBcbiAqICogRW5nbGlzaCAoTmV3IFplYWxhbmQpIGBlbi1OWmBcbiAqICogRW5nbGlzaCAoU291dGggQWZyaWNhKSBgZW4tWkFgXG4gKiAqIEVuZ2xpc2goVUspIGBlbi1HQmBcbiAqICogRW5nbGlzaChVUykgYGVuLVVTYFxuICogKiBGaW5uaXNoIGBmaWBcbiAqICogRnJlbmNoIGBmci1GUmBcbiAqICogR2FsaWNpYW4gYGdsYFxuICogKiBHZXJtYW4gYGRlLURFYFxuICogKiBIZWJyZXcgYGhlYFxuICogKiBIdW5nYXJpYW4gYGh1YFxuICogKiBJY2VsYW5kaWMgYGlzYFxuICogKiBJdGFsaWFuIGBpdC1JVGBcbiAqICogSW5kb25lc2lhbiBgaWRgXG4gKiAqIEphcGFuZXNlIGBqYWBcbiAqICogS29yZWFuIGBrb2BcbiAqICogTGF0aW4gYGxhYFxuICogKiBNYW5kYXJpbiBDaGluZXNlIGB6aC1DTmBcbiAqICogVHJhZGl0aW9uYWwgVGFpd2FuIGB6aC1UV2BcbiAqICogU2ltcGxpZmllZCBDaGluYSB6aC1DTiBgP2BcbiAqICogU2ltcGxpZmllZCBIb25nIEtvbmcgYHpoLUhLYFxuICogKiBZdWUgQ2hpbmVzZSAoVHJhZGl0aW9uYWwgSG9uZyBLb25nKSBgemgteXVlYFxuICogKiBNYWxheXNpYW4gYG1zLU1ZYFxuICogKiBOb3J3ZWdpYW4gYG5vLU5PYFxuICogKiBQb2xpc2ggYHBsYFxuICogKiBQaWcgTGF0aW4gYHh4LXBpZ2xhdGluYFxuICogKiBQb3J0dWd1ZXNlIGBwdC1QVGBcbiAqICogUG9ydHVndWVzZSAoQnJhc2lsKSBgcHQtQlJgXG4gKiAqIFJvbWFuaWFuIGByby1ST2BcbiAqICogUnVzc2lhbiBgcnVgXG4gKiAqIFNlcmJpYW4gYHNyLVNQYFxuICogKiBTbG92YWsgYHNrYFxuICogKiBTcGFuaXNoIChBcmdlbnRpbmEpIGBlcy1BUmBcbiAqICogU3BhbmlzaCAoQm9saXZpYSkgYGVzLUJPYFxuICogKiBTcGFuaXNoIChDaGlsZSkgYGVzLUNMYFxuICogKiBTcGFuaXNoIChDb2xvbWJpYSkgYGVzLUNPYFxuICogKiBTcGFuaXNoIChDb3N0YSBSaWNhKSBgZXMtQ1JgXG4gKiAqIFNwYW5pc2ggKERvbWluaWNhbiBSZXB1YmxpYykgYGVzLURPYFxuICogKiBTcGFuaXNoIChFY3VhZG9yKSBgZXMtRUNgXG4gKiAqIFNwYW5pc2ggKEVsIFNhbHZhZG9yKSBgZXMtU1ZgXG4gKiAqIFNwYW5pc2ggKEd1YXRlbWFsYSkgYGVzLUdUYFxuICogKiBTcGFuaXNoIChIb25kdXJhcykgYGVzLUhOYFxuICogKiBTcGFuaXNoIChNZXhpY28pIGBlcy1NWGBcbiAqICogU3BhbmlzaCAoTmljYXJhZ3VhKSBgZXMtTklgXG4gKiAqIFNwYW5pc2ggKFBhbmFtYSkgYGVzLVBBYFxuICogKiBTcGFuaXNoIChQYXJhZ3VheSkgYGVzLVBZYFxuICogKiBTcGFuaXNoIChQZXJ1KSBgZXMtUEVgXG4gKiAqIFNwYW5pc2ggKFB1ZXJ0byBSaWNvKSBgZXMtUFJgXG4gKiAqIFNwYW5pc2ggKFNwYWluKSBgZXMtRVNgXG4gKiAqIFNwYW5pc2ggKFVTKSBgZXMtVVNgXG4gKiAqIFNwYW5pc2ggKFVydWd1YXkpIGBlcy1VWWBcbiAqICogU3BhbmlzaCAoVmVuZXp1ZWxhKSBgZXMtVkVgXG4gKiAqIFN3ZWRpc2ggYHN2LVNFYFxuICogKiBUdXJraXNoIGB0cmBcbiAqICogWnVsdSBgenVgXG4gKlxuICogIyMgRGV2ZWxvcGluZ1xuICpcbiAqIFByZXJlcXVpc2l0aWVzOiBub2RlLmpzXG4gKlxuICogRmlyc3QsIGluc3RhbGwgZGVwZW5kZW5jaWVzIGluIHlvdXIgbG9jYWwgYW5ueWFuZyBjb3B5OlxuICpcbiAqICAgICBucG0gaW5zdGFsbFxuICpcbiAqIE1ha2Ugc3VyZSB0byBydW4gdGhlIGRlZmF1bHQgZ3J1bnQgdGFzayBhZnRlciBlYWNoIGNoYW5nZSB0byBhbm55YW5nLmpzLiBUaGlzIGNhbiBhbHNvIGJlIGRvbmUgYXV0b21hdGljYWxseSBieSBydW5uaW5nOlxuICpcbiAqICAgICBncnVudCB3YXRjaFxuICpcbiAqIFlvdSBjYW4gYWxzbyBydW4gYSBsb2NhbCBzZXJ2ZXIgZm9yIHRlc3RpbmcgeW91ciB3b3JrIHdpdGg6XG4gKlxuICogICAgIGdydW50IGRldlxuICpcbiAqIFBvaW50IHlvdXIgYnJvd3NlciB0byBgaHR0cHM6Ly9sb2NhbGhvc3Q6ODQ0My9kZW1vL2AgdG8gc2VlIHRoZSBkZW1vIHBhZ2UuXG4gKiBTaW5jZSBpdCdzIHVzaW5nIHNlbGYtc2lnbmVkIGNlcnRpZmljYXRlLCB5b3UgbWlnaHQgbmVlZCB0byBjbGljayAqXCJQcm9jZWVkIEFueXdheVwiKi5cbiAqXG4gKiBGb3IgbW9yZSBpbmZvLCBjaGVjayBvdXQgdGhlIFtDT05UUklCVVRJTkddKGh0dHBzOi8vZ2l0aHViLmNvbS9UYWxBdGVyL2FubnlhbmcvYmxvYi9tYXN0ZXIvQ09OVFJJQlVUSU5HLm1kKSBmaWxlXG4gKlxuICovXG4iLCIvLyBGVU5DVElPTlMgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuLy86OiBhIC0+IGFcbmNvbnN0IHRyYWNlID0gKHgpID0+IHtcbiAgY29uc29sZS5sb2coeClcbiAgcmV0dXJuIHhcbn1cblxuLy86OiAoKGEsIGIsIC4uLiAtPiBlKSwgKGUgLT4gZiksIC4uLiwgKHkgLT4geikpIC0+IChhLCBiLCAuLi4pIC0+IHpcbmNvbnN0IHBpcGUgPSAoLi4uZm5zKSA9PiAoLi4ueHMpID0+IHtcbiAgcmV0dXJuIGZuc1xuICAgIC5zbGljZSgxKVxuICAgIC5yZWR1Y2UoKHgsIGZuKSA9PiBmbih4KSwgZm5zWzBdKC4uLnhzKSlcbn1cbmNvbnN0IHBpcGVQID0gKC4uLmZucykgPT4gKC4uLnhzKSA9PiB7XG4gIHJldHVybiBmbnNcbiAgICAuc2xpY2UoMSlcbiAgICAucmVkdWNlKCh4UCwgZm4pID0+IHhQLnRoZW4oZm4pLCBQcm9taXNlLnJlc29sdmUoZm5zWzBdKC4uLnhzKSkpXG59XG5cbi8vOjogKGEgLT4gYikgLT4gW2FdIC0+IFtiXVxuY29uc3QgbWFwID0gKGZuKSA9PiAoZikgPT4ge1xuICByZXR1cm4gZi5tYXAoZm4pXG59XG5cbi8vOjogW2FdIC0+IFthXSAtPiBbYV1cbmNvbnN0IGludGVyc2VjdGlvbiA9ICh4cykgPT4gKHhzMikgPT4ge1xuICByZXR1cm4geHMuZmlsdGVyKHggPT4geHMyLmluY2x1ZGVzKHgpKVxufVxuXG4vLzo6IFthXSAtPiBbYV0gLT4gW2FdXG5jb25zdCBkaWZmZXJlbmNlID0gKHhzKSA9PiAoeHMyKSA9PiB7XG4gIHJldHVybiB4cy5maWx0ZXIoeCA9PiAheHMyLmluY2x1ZGVzKHgpKVxufVxuXG4vLzo6IFsoYSwgYiwgLi4uKSAtPiBuXSAtPiBbYSwgYiwgLi4uXSAtPiBbbl1cbmNvbnN0IGFwcGx5RnVuY3Rpb25zID0gKGZucykgPT4gKHhzKSA9PiB7XG4gIHJldHVybiBmbnMubWFwKGZuID0+XG4gICAgeHMuc2xpY2UoMSkucmVkdWNlKChwYXJ0aWFsLCB4KSA9PiBwYXJ0aWFsKHgpLCBmbih4c1swXSkpKVxufVxuXG4vLzo6IFthXSAtPiBhXG5jb25zdCBsYXN0ID0gKHhzKSA9PiB7XG4gIHJldHVybiB4c1t4cy5sZW5ndGggLSAxXVxufVxuXG4vLzo6IChhIC0+IGIgLT4gYykgLT4gYiAtPiBhIC0+IGNcbmNvbnN0IGZsaXAgPSAoZm4pID0+IChiKSA9PiAoYSkgPT4ge1xuICByZXR1cm4gZm4oYSkoYilcbn1cblxuY29uc3QgY3VycnkgPSAoZm4pID0+IHtcbiAgdmFyIF9hcmdzID0gW11cbiAgY29uc3QgY291bnRBcmdzID0gKC4uLnhzKSA9PiB7XG4gICAgX2FyZ3MgPSBfYXJncy5jb25jYXQoeHMpXG4gICAgcmV0dXJuIChfYXJncy5sZW5ndGggPj0gZm4ubGVuZ3RoKVxuICAgICAgPyBmbi5hcHBseSh0aGlzLCBfYXJncylcbiAgICAgIDogY291bnRBcmdzXG4gIH1cbiAgcmV0dXJuIGNvdW50QXJnc1xufVxuXG4vLzo6IEludCAtPiBbYV0gLT4gYVxuY29uc3QgbnRoID0gKG4pID0+ICh4cykgPT4ge1xuICByZXR1cm4geHNbbl1cbn1cblxuLy86OiAoYSAtPiBhKSAtPiBOdW1iZXIgLT4gW2FdIC0+IFthXVxuY29uc3QgYWRqdXN0ID0gKGZuKSA9PiAoaSkgPT4gKGxpc3QpID0+IHtcbiAgdmFyIGNvcHkgPSBsaXN0LnNsaWNlKClcbiAgY29weS5zcGxpY2UoaSwgMSwgZm4obGlzdFtpXSkpXG4gIHJldHVybiBjb3B5XG59XG5cbi8vOjogT2JqZWN0IC0+IEFycmF5XG5jb25zdCB0b1BhaXJzID0gKG9iaikgPT4ge1xuICByZXR1cm4gUmVmbGVjdC5vd25LZXlzKG9iaikubWFwKGtleSA9PiBba2V5LCBvYmpba2V5XV0pXG59XG5cbi8vOjogKGEgLT4gQm9vbCkgLT4gKGEgLT4gYikgLT4gKGEgLT4gYikgLT4gYSAtPiBiXG5jb25zdCBpZkVsc2UgPSAocHJlZEZuKSA9PiAod2hlblRydWVGbikgPT4gKHdoZW5GYWxzZUZuKSA9PiAoYSkgPT57XG4gIHJldHVybiBwcmVkRm4oYSlcbiAgICA/IHdoZW5UcnVlRm4oYSlcbiAgICA6IHdoZW5GYWxzZUZuKGEpXG59XG5cblxuLy8gdGhpcyBpc24ndCBpbiBleHBvcnRzLCBpdCBpcyB1c2VkIGJ5IElPLnNlcXVlbmNlIC8vLy8vLy8vLy8vLy8vXG5jb25zdCBHZW5lcmF0b3IgPSBPYmplY3QuZnJlZXplKHtcbiAgLy86OiAoYSAtPiBiKSAtPiAoR2VuZXJhdG9yIChbYV0gLT4gYikpXG4gIC8qIHJldHVybnMgYSBnZW5lcmF0b3Igd2hpY2ggd2lsbCBhcHBseVxuICAgICBhY3Rpb24gdG8gZWEgdmFsdWUgc2VxdWVudGlhbGx5IGluIHhzXG4gICAqL1xuICBzZXEoYWN0aW9uKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKiBhcHBseUFjdGlvbih4cykge1xuICAgICAgZm9yICh2YXIgeCBvZiB4cykge1xuICAgICAgICB5aWVsZCBhY3Rpb24oeClcbiAgICAgIH1cbiAgICB9XG4gIH0sXG4gIC8vOjogR2VuZXJhdG9yIC0+IF9cbiAgLyogYXV0b21hdGljYWxseSBzdGVwcyBnZW5lcmF0b3IgZXZlcnkgfnggbXNcbiAgICAgdW50aWwgdGhlIGdlbmVyYXRvciBpcyBleGhhdXN0ZWRcbiAgICovXG4gIGF1dG86IChtcykgPT4gKGdlbikgPT4ge1xuICAgIGlmICghZ2VuLm5leHQoKS5kb25lKSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IEdlbmVyYXRvci5hdXRvKG1zKShnZW4pLCBtcylcbiAgICB9XG4gIH1cbn0pXG5cblxuLy8gTU9OQURTIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuLy8gTWF5YmUgdHlwZVxuY29uc3QgTWF5YmUgPSAoKCkgPT4ge1xuICBjb25zdCBuZXdNID0gKHR5cGUpID0+ICh2YWx1ZSkgPT4ge1xuICAgIHJldHVybiBPYmplY3QuZnJlZXplKE9iamVjdC5jcmVhdGUodHlwZSwgeyBfX3ZhbHVlOiB7IHZhbHVlOiB2YWx1ZSB9fSkpXG4gIH1cblxuICBjb25zdCBOb3RoaW5nID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgbWFwKF8pIHtcbiAgICAgIHJldHVybiBuZXdNKE5vdGhpbmcpKG51bGwpXG4gICAgfSxcbiAgICBpc05vdGhpbmc6IHRydWUsXG4gICAgaXNKdXN0OiBmYWxzZVxuICB9KVxuXG4gIGNvbnN0IEp1c3QgPSBPYmplY3QuZnJlZXplKHtcbiAgICBtYXAoZm4pIHtcbiAgICAgIHJldHVybiBuZXdNKEp1c3QpKGZuKHRoaXMuX192YWx1ZSkpXG4gICAgfSxcbiAgICBpc05vdGhpbmc6IGZhbHNlLFxuICAgIGlzSnVzdDogdHJ1ZVxuICB9KVxuXG4gIGNvbnN0IE1heWJlID0gKHgpID0+IHtcbiAgICByZXR1cm4gKHggPT0gbnVsbClcbiAgICAgID8gbmV3TShOb3RoaW5nKShudWxsKVxuICAgICAgOiBuZXdNKEp1c3QpKHgpXG4gIH1cblxuICBNYXliZS5pc05vdGhpbmcgPSAoTSkgPT4ge1xuICAgIHJldHVybiBOb3RoaW5nLmlzUHJvdG90eXBlT2YoTSlcbiAgfVxuXG4gIE1heWJlLmlzSnVzdCA9IChNKSA9PiB7XG4gICAgcmV0dXJuIEp1c3QuaXNQcm90b3R5cGVPZihNKVxuICB9XG5cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUoTWF5YmUpXG59KSgpXG5cbi8vIEVpdGhlciB0eXBlXG5jb25zdCBFaXRoZXIgPSAoKCkgPT4ge1xuICBjb25zdCBuZXdFID0gKHR5cGUpID0+ICh2YWx1ZSkgPT4ge1xuICAgIHJldHVybiBPYmplY3QuZnJlZXplKE9iamVjdC5jcmVhdGUodHlwZSwgeyBfX3ZhbHVlOiB7IHZhbHVlOiB2YWx1ZSB9IH0pKVxuICB9XG5cbiAgY29uc3QgTGVmdCA9IE9iamVjdC5mcmVlemUoe1xuICAgIG1hcChfKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG4gICAgYmltYXAoZm4pIHtcbiAgICAgIGNvbnN0IG1lID0gdGhpc1xuICAgICAgcmV0dXJuIChfKSA9PiB7XG4gICAgICAgIHJldHVybiBuZXdFKExlZnQpKGZuKG1lLl9fdmFsdWUpKVxuICAgICAgfVxuICAgIH0sXG4gICAgaXNMZWZ0OiB0cnVlLFxuICAgIGlzUmlnaHQ6IGZhbHNlXG4gIH0pXG5cbiAgY29uc3QgUmlnaHQgPSBPYmplY3QuZnJlZXplKHtcbiAgICBtYXAoZm4pIHtcbiAgICAgIHJldHVybiBuZXdFKFJpZ2h0KShmbih0aGlzLl9fdmFsdWUpKVxuICAgIH0sXG4gICAgYmltYXAoXykge1xuICAgICAgY29uc3QgbWUgPSB0aGlzXG4gICAgICByZXR1cm4gKGZuKSA9PiB7XG4gICAgICAgIHJldHVybiBtZS5tYXAoZm4pXG4gICAgICB9XG4gICAgfSxcbiAgICBpc0xlZnQ6IGZhbHNlLFxuICAgIGlzUmlnaHQ6IHRydWVcbiAgfSlcblxuICBjb25zdCBFaXRoZXIgPSBPYmplY3QuZnJlZXplKHtcbiAgICBMZWZ0KHgpIHtcbiAgICAgIHJldHVybiBuZXdFKExlZnQpKHgpXG4gICAgfSxcbiAgICBSaWdodCh4KSB7XG4gICAgICByZXR1cm4gbmV3RShSaWdodCkoeClcbiAgICB9LFxuICAgIGlzUmlnaHQoRSkge1xuICAgICAgcmV0dXJuIFJpZ2h0LmlzUHJvdG90eXBlT2YoRSlcbiAgICB9LFxuICAgIGlzTGVmdChFKSB7XG4gICAgICByZXR1cm4gTGVmdC5pc1Byb3RvdHlwZU9mKEUpXG4gICAgfSxcbiAgICBiaW1hcDogKGxlZnRGbikgPT4gKHJpZ2h0Rm4pID0+IChFKSA9PiB7XG4gICAgICByZXR1cm4gRS5iaW1hcChsZWZ0Rm4pKHJpZ2h0Rm4pXG4gICAgfVxuICB9KVxuXG4gIHJldHVybiBFaXRoZXJcbn0pKClcblxuLy8gSU8gdHlwZVxuY29uc3QgSU8gPSAoKCkgPT4ge1xuICBjb25zdCBuZXdfaW8gPSAoZm4pID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZShPYmplY3QuY3JlYXRlKGlvLCB7IF9fdmFsdWU6IHsgdmFsdWU6IGZuIH19KSlcbiAgfVxuXG4gIGNvbnN0IGlvID0ge1xuICAgIHJ1bklPKHZhbHVlKSB7XG4gICAgICByZXR1cm4gdGhpcy5fX3ZhbHVlKHZhbHVlKVxuICAgIH0sXG4gICAgbWFwKGZuKSB7XG4gICAgICByZXR1cm4gbmV3X2lvKCgpID0+IGZuKHRoaXMuX192YWx1ZSgpKSlcbiAgICB9LFxuICAgIGpvaW4oKSB7XG4gICAgICByZXR1cm4gbmV3X2lvKCgpID0+IHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnVuSU8oKS5ydW5JTygpXG4gICAgICB9KVxuICAgIH0sXG4gICAgY2hhaW4oaW9fcmV0dXJuaW5nX2ZuKSB7XG4gICAgICByZXR1cm4gdGhpcy5tYXAoaW9fcmV0dXJuaW5nX2ZuKS5qb2luKClcbiAgICB9LFxuICAgIGFwKGlvX3ZhbHVlKSB7XG4gICAgICByZXR1cm4gaW9fdmFsdWUubWFwKHRoaXMuX192YWx1ZSlcbiAgICB9XG4gIH1cblxuICBjb25zdCBJTyA9IChmbikgPT4ge1xuICAgIGlmIChmbiBpbnN0YW5jZW9mIEZ1bmN0aW9uKSB7XG4gICAgICByZXR1cm4gbmV3X2lvKGZuKVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKGBJTyBjb25zdHJ1Y3RvciBleHBlY3RlZCBpbnN0YW5jZSBvZiBGdW5jdGlvbmApXG4gICAgfVxuICB9XG5cbiAgSU8ub2YgPSAoeCkgPT4ge1xuICAgIHJldHVybiBuZXdfaW8oKCkgPT4geClcbiAgfVxuXG4gIElPLnJ1biA9IChpbykgPT4ge1xuICAgIHJldHVybiBpby5ydW5JTygpXG4gIH1cblxuICAvLzo6IChhIC0+IGIpIC0+IGEgLT4gSU8gYlxuICBJTy53cmFwID0gKGZuKSA9PiAoX3ZhbHVlKSA9PiB7XG4gICAgcmV0dXJuIElPLm9mKF92YWx1ZSkubWFwKGZuKVxuICB9XG5cbiAgLy86OiBbSU9dIC0+IElPIF9cbiAgSU8uc2VxdWVuY2UgPSBJTy53cmFwKFxuICAgIHBpcGUoXG4gICAgICBHZW5lcmF0b3Iuc2VxKElPLnJ1biksXG4gICAgICBHZW5lcmF0b3IuYXV0bygwKVxuICAgICkpXG5cbiAgcmV0dXJuIE9iamVjdC5mcmVlemUoSU8pXG59KSgpXG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHRyYWNlLCBwaXBlLCBwaXBlUCwgbWFwLCBpbnRlcnNlY3Rpb24sIGRpZmZlcmVuY2UsIGFwcGx5RnVuY3Rpb25zLFxuICBsYXN0LCBmbGlwLCBjdXJyeSwgbnRoLCBhZGp1c3QsIHRvUGFpcnMsIGlmRWxzZSxcbiAgTWF5YmUsIEVpdGhlciwgSU9cbn1cblxuXG5cblxuXG4iLCJ2YXIgVk5vZGUgPSByZXF1aXJlKCcuL3Zub2RlJyk7XG52YXIgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG5cbmZ1bmN0aW9uIGFkZE5TKGRhdGEsIGNoaWxkcmVuKSB7XG4gIGRhdGEubnMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xuICBpZiAoY2hpbGRyZW4gIT09IHVuZGVmaW5lZCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIGFkZE5TKGNoaWxkcmVuW2ldLmRhdGEsIGNoaWxkcmVuW2ldLmNoaWxkcmVuKTtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBoKHNlbCwgYiwgYykge1xuICB2YXIgZGF0YSA9IHt9LCBjaGlsZHJlbiwgdGV4dCwgaTtcbiAgaWYgKGMgIT09IHVuZGVmaW5lZCkge1xuICAgIGRhdGEgPSBiO1xuICAgIGlmIChpcy5hcnJheShjKSkgeyBjaGlsZHJlbiA9IGM7IH1cbiAgICBlbHNlIGlmIChpcy5wcmltaXRpdmUoYykpIHsgdGV4dCA9IGM7IH1cbiAgfSBlbHNlIGlmIChiICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoaXMuYXJyYXkoYikpIHsgY2hpbGRyZW4gPSBiOyB9XG4gICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGIpKSB7IHRleHQgPSBiOyB9XG4gICAgZWxzZSB7IGRhdGEgPSBiOyB9XG4gIH1cbiAgaWYgKGlzLmFycmF5KGNoaWxkcmVuKSkge1xuICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgaWYgKGlzLnByaW1pdGl2ZShjaGlsZHJlbltpXSkpIGNoaWxkcmVuW2ldID0gVk5vZGUodW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY2hpbGRyZW5baV0pO1xuICAgIH1cbiAgfVxuICBpZiAoc2VsWzBdID09PSAncycgJiYgc2VsWzFdID09PSAndicgJiYgc2VsWzJdID09PSAnZycpIHtcbiAgICBhZGROUyhkYXRhLCBjaGlsZHJlbik7XG4gIH1cbiAgcmV0dXJuIFZOb2RlKHNlbCwgZGF0YSwgY2hpbGRyZW4sIHRleHQsIHVuZGVmaW5lZCk7XG59O1xuIiwiZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh0YWdOYW1lKXtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgcXVhbGlmaWVkTmFtZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRleHROb2RlKHRleHQpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCk7XG59XG5cblxuZnVuY3Rpb24gaW5zZXJ0QmVmb3JlKHBhcmVudE5vZGUsIG5ld05vZGUsIHJlZmVyZW5jZU5vZGUpe1xuICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShuZXdOb2RlLCByZWZlcmVuY2VOb2RlKTtcbn1cblxuXG5mdW5jdGlvbiByZW1vdmVDaGlsZChub2RlLCBjaGlsZCl7XG4gIG5vZGUucmVtb3ZlQ2hpbGQoY2hpbGQpO1xufVxuXG5mdW5jdGlvbiBhcHBlbmRDaGlsZChub2RlLCBjaGlsZCl7XG4gIG5vZGUuYXBwZW5kQ2hpbGQoY2hpbGQpO1xufVxuXG5mdW5jdGlvbiBwYXJlbnROb2RlKG5vZGUpe1xuICByZXR1cm4gbm9kZS5wYXJlbnRFbGVtZW50O1xufVxuXG5mdW5jdGlvbiBuZXh0U2libGluZyhub2RlKXtcbiAgcmV0dXJuIG5vZGUubmV4dFNpYmxpbmc7XG59XG5cbmZ1bmN0aW9uIHRhZ05hbWUobm9kZSl7XG4gIHJldHVybiBub2RlLnRhZ05hbWU7XG59XG5cbmZ1bmN0aW9uIHNldFRleHRDb250ZW50KG5vZGUsIHRleHQpe1xuICBub2RlLnRleHRDb250ZW50ID0gdGV4dDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGNyZWF0ZUVsZW1lbnQ6IGNyZWF0ZUVsZW1lbnQsXG4gIGNyZWF0ZUVsZW1lbnROUzogY3JlYXRlRWxlbWVudE5TLFxuICBjcmVhdGVUZXh0Tm9kZTogY3JlYXRlVGV4dE5vZGUsXG4gIGFwcGVuZENoaWxkOiBhcHBlbmRDaGlsZCxcbiAgcmVtb3ZlQ2hpbGQ6IHJlbW92ZUNoaWxkLFxuICBpbnNlcnRCZWZvcmU6IGluc2VydEJlZm9yZSxcbiAgcGFyZW50Tm9kZTogcGFyZW50Tm9kZSxcbiAgbmV4dFNpYmxpbmc6IG5leHRTaWJsaW5nLFxuICB0YWdOYW1lOiB0YWdOYW1lLFxuICBzZXRUZXh0Q29udGVudDogc2V0VGV4dENvbnRlbnRcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgYXJyYXk6IEFycmF5LmlzQXJyYXksXG4gIHByaW1pdGl2ZTogZnVuY3Rpb24ocykgeyByZXR1cm4gdHlwZW9mIHMgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBzID09PSAnbnVtYmVyJzsgfSxcbn07XG4iLCJmdW5jdGlvbiB1cGRhdGVDbGFzcyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIGN1ciwgbmFtZSwgZWxtID0gdm5vZGUuZWxtLFxuICAgICAgb2xkQ2xhc3MgPSBvbGRWbm9kZS5kYXRhLmNsYXNzIHx8IHt9LFxuICAgICAga2xhc3MgPSB2bm9kZS5kYXRhLmNsYXNzIHx8IHt9O1xuICBmb3IgKG5hbWUgaW4gb2xkQ2xhc3MpIHtcbiAgICBpZiAoIWtsYXNzW25hbWVdKSB7XG4gICAgICBlbG0uY2xhc3NMaXN0LnJlbW92ZShuYW1lKTtcbiAgICB9XG4gIH1cbiAgZm9yIChuYW1lIGluIGtsYXNzKSB7XG4gICAgY3VyID0ga2xhc3NbbmFtZV07XG4gICAgaWYgKGN1ciAhPT0gb2xkQ2xhc3NbbmFtZV0pIHtcbiAgICAgIGVsbS5jbGFzc0xpc3RbY3VyID8gJ2FkZCcgOiAncmVtb3ZlJ10obmFtZSk7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlQ2xhc3MsIHVwZGF0ZTogdXBkYXRlQ2xhc3N9O1xuIiwidmFyIGlzID0gcmVxdWlyZSgnLi4vaXMnKTtcblxuZnVuY3Rpb24gYXJySW52b2tlcihhcnIpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGlmICghYXJyLmxlbmd0aCkgcmV0dXJuO1xuICAgIC8vIFNwZWNpYWwgY2FzZSB3aGVuIGxlbmd0aCBpcyB0d28sIGZvciBwZXJmb3JtYW5jZVxuICAgIGFyci5sZW5ndGggPT09IDIgPyBhcnJbMF0oYXJyWzFdKSA6IGFyclswXS5hcHBseSh1bmRlZmluZWQsIGFyci5zbGljZSgxKSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGZuSW52b2tlcihvKSB7XG4gIHJldHVybiBmdW5jdGlvbihldikgeyBcbiAgICBpZiAoby5mbiA9PT0gbnVsbCkgcmV0dXJuO1xuICAgIG8uZm4oZXYpOyBcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRXZlbnRMaXN0ZW5lcnMob2xkVm5vZGUsIHZub2RlKSB7XG4gIHZhciBuYW1lLCBjdXIsIG9sZCwgZWxtID0gdm5vZGUuZWxtLFxuICAgICAgb2xkT24gPSBvbGRWbm9kZS5kYXRhLm9uIHx8IHt9LCBvbiA9IHZub2RlLmRhdGEub247XG4gIGlmICghb24pIHJldHVybjtcbiAgZm9yIChuYW1lIGluIG9uKSB7XG4gICAgY3VyID0gb25bbmFtZV07XG4gICAgb2xkID0gb2xkT25bbmFtZV07XG4gICAgaWYgKG9sZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoaXMuYXJyYXkoY3VyKSkge1xuICAgICAgICBlbG0uYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBhcnJJbnZva2VyKGN1cikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3VyID0ge2ZuOiBjdXJ9O1xuICAgICAgICBvbltuYW1lXSA9IGN1cjtcbiAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZm5JbnZva2VyKGN1cikpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXMuYXJyYXkob2xkKSkge1xuICAgICAgLy8gRGVsaWJlcmF0ZWx5IG1vZGlmeSBvbGQgYXJyYXkgc2luY2UgaXQncyBjYXB0dXJlZCBpbiBjbG9zdXJlIGNyZWF0ZWQgd2l0aCBgYXJySW52b2tlcmBcbiAgICAgIG9sZC5sZW5ndGggPSBjdXIubGVuZ3RoO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvbGQubGVuZ3RoOyArK2kpIG9sZFtpXSA9IGN1cltpXTtcbiAgICAgIG9uW25hbWVdICA9IG9sZDtcbiAgICB9IGVsc2Uge1xuICAgICAgb2xkLmZuID0gY3VyO1xuICAgICAgb25bbmFtZV0gPSBvbGQ7XG4gICAgfVxuICB9XG4gIGlmIChvbGRPbikge1xuICAgIGZvciAobmFtZSBpbiBvbGRPbikge1xuICAgICAgaWYgKG9uW25hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdmFyIG9sZCA9IG9sZE9uW25hbWVdO1xuICAgICAgICBpZiAoaXMuYXJyYXkob2xkKSkge1xuICAgICAgICAgIG9sZC5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIG9sZC5mbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7Y3JlYXRlOiB1cGRhdGVFdmVudExpc3RlbmVycywgdXBkYXRlOiB1cGRhdGVFdmVudExpc3RlbmVyc307XG4iLCJmdW5jdGlvbiB1cGRhdGVQcm9wcyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIGtleSwgY3VyLCBvbGQsIGVsbSA9IHZub2RlLmVsbSxcbiAgICAgIG9sZFByb3BzID0gb2xkVm5vZGUuZGF0YS5wcm9wcyB8fCB7fSwgcHJvcHMgPSB2bm9kZS5kYXRhLnByb3BzIHx8IHt9O1xuICBmb3IgKGtleSBpbiBvbGRQcm9wcykge1xuICAgIGlmICghcHJvcHNba2V5XSkge1xuICAgICAgZGVsZXRlIGVsbVtrZXldO1xuICAgIH1cbiAgfVxuICBmb3IgKGtleSBpbiBwcm9wcykge1xuICAgIGN1ciA9IHByb3BzW2tleV07XG4gICAgb2xkID0gb2xkUHJvcHNba2V5XTtcbiAgICBpZiAob2xkICE9PSBjdXIgJiYgKGtleSAhPT0gJ3ZhbHVlJyB8fCBlbG1ba2V5XSAhPT0gY3VyKSkge1xuICAgICAgZWxtW2tleV0gPSBjdXI7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlUHJvcHMsIHVwZGF0ZTogdXBkYXRlUHJvcHN9O1xuIiwidmFyIHJhZiA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB8fCBzZXRUaW1lb3V0O1xudmFyIG5leHRGcmFtZSA9IGZ1bmN0aW9uKGZuKSB7IHJhZihmdW5jdGlvbigpIHsgcmFmKGZuKTsgfSk7IH07XG5cbmZ1bmN0aW9uIHNldE5leHRGcmFtZShvYmosIHByb3AsIHZhbCkge1xuICBuZXh0RnJhbWUoZnVuY3Rpb24oKSB7IG9ialtwcm9wXSA9IHZhbDsgfSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVN0eWxlKG9sZFZub2RlLCB2bm9kZSkge1xuICB2YXIgY3VyLCBuYW1lLCBlbG0gPSB2bm9kZS5lbG0sXG4gICAgICBvbGRTdHlsZSA9IG9sZFZub2RlLmRhdGEuc3R5bGUgfHwge30sXG4gICAgICBzdHlsZSA9IHZub2RlLmRhdGEuc3R5bGUgfHwge30sXG4gICAgICBvbGRIYXNEZWwgPSAnZGVsYXllZCcgaW4gb2xkU3R5bGU7XG4gIGZvciAobmFtZSBpbiBvbGRTdHlsZSkge1xuICAgIGlmICghc3R5bGVbbmFtZV0pIHtcbiAgICAgIGVsbS5zdHlsZVtuYW1lXSA9ICcnO1xuICAgIH1cbiAgfVxuICBmb3IgKG5hbWUgaW4gc3R5bGUpIHtcbiAgICBjdXIgPSBzdHlsZVtuYW1lXTtcbiAgICBpZiAobmFtZSA9PT0gJ2RlbGF5ZWQnKSB7XG4gICAgICBmb3IgKG5hbWUgaW4gc3R5bGUuZGVsYXllZCkge1xuICAgICAgICBjdXIgPSBzdHlsZS5kZWxheWVkW25hbWVdO1xuICAgICAgICBpZiAoIW9sZEhhc0RlbCB8fCBjdXIgIT09IG9sZFN0eWxlLmRlbGF5ZWRbbmFtZV0pIHtcbiAgICAgICAgICBzZXROZXh0RnJhbWUoZWxtLnN0eWxlLCBuYW1lLCBjdXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuYW1lICE9PSAncmVtb3ZlJyAmJiBjdXIgIT09IG9sZFN0eWxlW25hbWVdKSB7XG4gICAgICBlbG0uc3R5bGVbbmFtZV0gPSBjdXI7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5RGVzdHJveVN0eWxlKHZub2RlKSB7XG4gIHZhciBzdHlsZSwgbmFtZSwgZWxtID0gdm5vZGUuZWxtLCBzID0gdm5vZGUuZGF0YS5zdHlsZTtcbiAgaWYgKCFzIHx8ICEoc3R5bGUgPSBzLmRlc3Ryb3kpKSByZXR1cm47XG4gIGZvciAobmFtZSBpbiBzdHlsZSkge1xuICAgIGVsbS5zdHlsZVtuYW1lXSA9IHN0eWxlW25hbWVdO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5UmVtb3ZlU3R5bGUodm5vZGUsIHJtKSB7XG4gIHZhciBzID0gdm5vZGUuZGF0YS5zdHlsZTtcbiAgaWYgKCFzIHx8ICFzLnJlbW92ZSkge1xuICAgIHJtKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBuYW1lLCBlbG0gPSB2bm9kZS5lbG0sIGlkeCwgaSA9IDAsIG1heER1ciA9IDAsXG4gICAgICBjb21wU3R5bGUsIHN0eWxlID0gcy5yZW1vdmUsIGFtb3VudCA9IDAsIGFwcGxpZWQgPSBbXTtcbiAgZm9yIChuYW1lIGluIHN0eWxlKSB7XG4gICAgYXBwbGllZC5wdXNoKG5hbWUpO1xuICAgIGVsbS5zdHlsZVtuYW1lXSA9IHN0eWxlW25hbWVdO1xuICB9XG4gIGNvbXBTdHlsZSA9IGdldENvbXB1dGVkU3R5bGUoZWxtKTtcbiAgdmFyIHByb3BzID0gY29tcFN0eWxlWyd0cmFuc2l0aW9uLXByb3BlcnR5J10uc3BsaXQoJywgJyk7XG4gIGZvciAoOyBpIDwgcHJvcHMubGVuZ3RoOyArK2kpIHtcbiAgICBpZihhcHBsaWVkLmluZGV4T2YocHJvcHNbaV0pICE9PSAtMSkgYW1vdW50Kys7XG4gIH1cbiAgZWxtLmFkZEV2ZW50TGlzdGVuZXIoJ3RyYW5zaXRpb25lbmQnLCBmdW5jdGlvbihldikge1xuICAgIGlmIChldi50YXJnZXQgPT09IGVsbSkgLS1hbW91bnQ7XG4gICAgaWYgKGFtb3VudCA9PT0gMCkgcm0oKTtcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlU3R5bGUsIHVwZGF0ZTogdXBkYXRlU3R5bGUsIGRlc3Ryb3k6IGFwcGx5RGVzdHJveVN0eWxlLCByZW1vdmU6IGFwcGx5UmVtb3ZlU3R5bGV9O1xuIiwiLy8ganNoaW50IG5ld2NhcDogZmFsc2Vcbi8qIGdsb2JhbCByZXF1aXJlLCBtb2R1bGUsIGRvY3VtZW50LCBOb2RlICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBWTm9kZSA9IHJlcXVpcmUoJy4vdm5vZGUnKTtcbnZhciBpcyA9IHJlcXVpcmUoJy4vaXMnKTtcbnZhciBkb21BcGkgPSByZXF1aXJlKCcuL2h0bWxkb21hcGknKTtcblxuZnVuY3Rpb24gaXNVbmRlZihzKSB7IHJldHVybiBzID09PSB1bmRlZmluZWQ7IH1cbmZ1bmN0aW9uIGlzRGVmKHMpIHsgcmV0dXJuIHMgIT09IHVuZGVmaW5lZDsgfVxuXG52YXIgZW1wdHlOb2RlID0gVk5vZGUoJycsIHt9LCBbXSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXG5mdW5jdGlvbiBzYW1lVm5vZGUodm5vZGUxLCB2bm9kZTIpIHtcbiAgcmV0dXJuIHZub2RlMS5rZXkgPT09IHZub2RlMi5rZXkgJiYgdm5vZGUxLnNlbCA9PT0gdm5vZGUyLnNlbDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlS2V5VG9PbGRJZHgoY2hpbGRyZW4sIGJlZ2luSWR4LCBlbmRJZHgpIHtcbiAgdmFyIGksIG1hcCA9IHt9LCBrZXk7XG4gIGZvciAoaSA9IGJlZ2luSWR4OyBpIDw9IGVuZElkeDsgKytpKSB7XG4gICAga2V5ID0gY2hpbGRyZW5baV0ua2V5O1xuICAgIGlmIChpc0RlZihrZXkpKSBtYXBba2V5XSA9IGk7XG4gIH1cbiAgcmV0dXJuIG1hcDtcbn1cblxudmFyIGhvb2tzID0gWydjcmVhdGUnLCAndXBkYXRlJywgJ3JlbW92ZScsICdkZXN0cm95JywgJ3ByZScsICdwb3N0J107XG5cbmZ1bmN0aW9uIGluaXQobW9kdWxlcywgYXBpKSB7XG4gIHZhciBpLCBqLCBjYnMgPSB7fTtcblxuICBpZiAoaXNVbmRlZihhcGkpKSBhcGkgPSBkb21BcGk7XG5cbiAgZm9yIChpID0gMDsgaSA8IGhvb2tzLmxlbmd0aDsgKytpKSB7XG4gICAgY2JzW2hvb2tzW2ldXSA9IFtdO1xuICAgIGZvciAoaiA9IDA7IGogPCBtb2R1bGVzLmxlbmd0aDsgKytqKSB7XG4gICAgICBpZiAobW9kdWxlc1tqXVtob29rc1tpXV0gIT09IHVuZGVmaW5lZCkgY2JzW2hvb2tzW2ldXS5wdXNoKG1vZHVsZXNbal1baG9va3NbaV1dKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlbXB0eU5vZGVBdChlbG0pIHtcbiAgICByZXR1cm4gVk5vZGUoYXBpLnRhZ05hbWUoZWxtKS50b0xvd2VyQ2FzZSgpLCB7fSwgW10sIHVuZGVmaW5lZCwgZWxtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVJtQ2IoY2hpbGRFbG0sIGxpc3RlbmVycykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLWxpc3RlbmVycyA9PT0gMCkge1xuICAgICAgICB2YXIgcGFyZW50ID0gYXBpLnBhcmVudE5vZGUoY2hpbGRFbG0pO1xuICAgICAgICBhcGkucmVtb3ZlQ2hpbGQocGFyZW50LCBjaGlsZEVsbSk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUVsbSh2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIGksIGRhdGEgPSB2bm9kZS5kYXRhO1xuICAgIGlmIChpc0RlZihkYXRhKSkge1xuICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLmhvb2spICYmIGlzRGVmKGkgPSBpLmluaXQpKSB7XG4gICAgICAgIGkodm5vZGUpO1xuICAgICAgICBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGVsbSwgY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlbiwgc2VsID0gdm5vZGUuc2VsO1xuICAgIGlmIChpc0RlZihzZWwpKSB7XG4gICAgICAvLyBQYXJzZSBzZWxlY3RvclxuICAgICAgdmFyIGhhc2hJZHggPSBzZWwuaW5kZXhPZignIycpO1xuICAgICAgdmFyIGRvdElkeCA9IHNlbC5pbmRleE9mKCcuJywgaGFzaElkeCk7XG4gICAgICB2YXIgaGFzaCA9IGhhc2hJZHggPiAwID8gaGFzaElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICB2YXIgZG90ID0gZG90SWR4ID4gMCA/IGRvdElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICB2YXIgdGFnID0gaGFzaElkeCAhPT0gLTEgfHwgZG90SWR4ICE9PSAtMSA/IHNlbC5zbGljZSgwLCBNYXRoLm1pbihoYXNoLCBkb3QpKSA6IHNlbDtcbiAgICAgIGVsbSA9IHZub2RlLmVsbSA9IGlzRGVmKGRhdGEpICYmIGlzRGVmKGkgPSBkYXRhLm5zKSA/IGFwaS5jcmVhdGVFbGVtZW50TlMoaSwgdGFnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogYXBpLmNyZWF0ZUVsZW1lbnQodGFnKTtcbiAgICAgIGlmIChoYXNoIDwgZG90KSBlbG0uaWQgPSBzZWwuc2xpY2UoaGFzaCArIDEsIGRvdCk7XG4gICAgICBpZiAoZG90SWR4ID4gMCkgZWxtLmNsYXNzTmFtZSA9IHNlbC5zbGljZShkb3QrMSkucmVwbGFjZSgvXFwuL2csICcgJyk7XG4gICAgICBpZiAoaXMuYXJyYXkoY2hpbGRyZW4pKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICAgIGFwaS5hcHBlbmRDaGlsZChlbG0sIGNyZWF0ZUVsbShjaGlsZHJlbltpXSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoaXMucHJpbWl0aXZlKHZub2RlLnRleHQpKSB7XG4gICAgICAgIGFwaS5hcHBlbmRDaGlsZChlbG0sIGFwaS5jcmVhdGVUZXh0Tm9kZSh2bm9kZS50ZXh0KSk7XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLmNyZWF0ZS5sZW5ndGg7ICsraSkgY2JzLmNyZWF0ZVtpXShlbXB0eU5vZGUsIHZub2RlKTtcbiAgICAgIGkgPSB2bm9kZS5kYXRhLmhvb2s7IC8vIFJldXNlIHZhcmlhYmxlXG4gICAgICBpZiAoaXNEZWYoaSkpIHtcbiAgICAgICAgaWYgKGkuY3JlYXRlKSBpLmNyZWF0ZShlbXB0eU5vZGUsIHZub2RlKTtcbiAgICAgICAgaWYgKGkuaW5zZXJ0KSBpbnNlcnRlZFZub2RlUXVldWUucHVzaCh2bm9kZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsbSA9IHZub2RlLmVsbSA9IGFwaS5jcmVhdGVUZXh0Tm9kZSh2bm9kZS50ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHZub2RlLmVsbTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFZub2RlcyhwYXJlbnRFbG0sIGJlZm9yZSwgdm5vZGVzLCBzdGFydElkeCwgZW5kSWR4LCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICBmb3IgKDsgc3RhcnRJZHggPD0gZW5kSWR4OyArK3N0YXJ0SWR4KSB7XG4gICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKHZub2Rlc1tzdGFydElkeF0sIGluc2VydGVkVm5vZGVRdWV1ZSksIGJlZm9yZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaW52b2tlRGVzdHJveUhvb2sodm5vZGUpIHtcbiAgICB2YXIgaSwgaiwgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgaWYgKGlzRGVmKGRhdGEpKSB7XG4gICAgICBpZiAoaXNEZWYoaSA9IGRhdGEuaG9vaykgJiYgaXNEZWYoaSA9IGkuZGVzdHJveSkpIGkodm5vZGUpO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5kZXN0cm95Lmxlbmd0aDsgKytpKSBjYnMuZGVzdHJveVtpXSh2bm9kZSk7XG4gICAgICBpZiAoaXNEZWYoaSA9IHZub2RlLmNoaWxkcmVuKSkge1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICBpbnZva2VEZXN0cm95SG9vayh2bm9kZS5jaGlsZHJlbltqXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVWbm9kZXMocGFyZW50RWxtLCB2bm9kZXMsIHN0YXJ0SWR4LCBlbmRJZHgpIHtcbiAgICBmb3IgKDsgc3RhcnRJZHggPD0gZW5kSWR4OyArK3N0YXJ0SWR4KSB7XG4gICAgICB2YXIgaSwgbGlzdGVuZXJzLCBybSwgY2ggPSB2bm9kZXNbc3RhcnRJZHhdO1xuICAgICAgaWYgKGlzRGVmKGNoKSkge1xuICAgICAgICBpZiAoaXNEZWYoY2guc2VsKSkge1xuICAgICAgICAgIGludm9rZURlc3Ryb3lIb29rKGNoKTtcbiAgICAgICAgICBsaXN0ZW5lcnMgPSBjYnMucmVtb3ZlLmxlbmd0aCArIDE7XG4gICAgICAgICAgcm0gPSBjcmVhdGVSbUNiKGNoLmVsbSwgbGlzdGVuZXJzKTtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnJlbW92ZS5sZW5ndGg7ICsraSkgY2JzLnJlbW92ZVtpXShjaCwgcm0pO1xuICAgICAgICAgIGlmIChpc0RlZihpID0gY2guZGF0YSkgJiYgaXNEZWYoaSA9IGkuaG9vaykgJiYgaXNEZWYoaSA9IGkucmVtb3ZlKSkge1xuICAgICAgICAgICAgaShjaCwgcm0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBybSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHsgLy8gVGV4dCBub2RlXG4gICAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudEVsbSwgY2guZWxtKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZUNoaWxkcmVuKHBhcmVudEVsbSwgb2xkQ2gsIG5ld0NoLCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICB2YXIgb2xkU3RhcnRJZHggPSAwLCBuZXdTdGFydElkeCA9IDA7XG4gICAgdmFyIG9sZEVuZElkeCA9IG9sZENoLmxlbmd0aCAtIDE7XG4gICAgdmFyIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFswXTtcbiAgICB2YXIgb2xkRW5kVm5vZGUgPSBvbGRDaFtvbGRFbmRJZHhdO1xuICAgIHZhciBuZXdFbmRJZHggPSBuZXdDaC5sZW5ndGggLSAxO1xuICAgIHZhciBuZXdTdGFydFZub2RlID0gbmV3Q2hbMF07XG4gICAgdmFyIG5ld0VuZFZub2RlID0gbmV3Q2hbbmV3RW5kSWR4XTtcbiAgICB2YXIgb2xkS2V5VG9JZHgsIGlkeEluT2xkLCBlbG1Ub01vdmUsIGJlZm9yZTtcblxuICAgIHdoaWxlIChvbGRTdGFydElkeCA8PSBvbGRFbmRJZHggJiYgbmV3U3RhcnRJZHggPD0gbmV3RW5kSWR4KSB7XG4gICAgICBpZiAoaXNVbmRlZihvbGRTdGFydFZub2RlKSkge1xuICAgICAgICBvbGRTdGFydFZub2RlID0gb2xkQ2hbKytvbGRTdGFydElkeF07IC8vIFZub2RlIGhhcyBiZWVuIG1vdmVkIGxlZnRcbiAgICAgIH0gZWxzZSBpZiAoaXNVbmRlZihvbGRFbmRWbm9kZSkpIHtcbiAgICAgICAgb2xkRW5kVm5vZGUgPSBvbGRDaFstLW9sZEVuZElkeF07XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWbm9kZShvbGRTdGFydFZub2RlLCBuZXdTdGFydFZub2RlKSkge1xuICAgICAgICBwYXRjaFZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFsrK29sZFN0YXJ0SWR4XTtcbiAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkRW5kVm5vZGUsIG5ld0VuZFZub2RlKSkge1xuICAgICAgICBwYXRjaFZub2RlKG9sZEVuZFZub2RlLCBuZXdFbmRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgb2xkRW5kVm5vZGUgPSBvbGRDaFstLW9sZEVuZElkeF07XG4gICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3RW5kVm5vZGUpKSB7IC8vIFZub2RlIG1vdmVkIHJpZ2h0XG4gICAgICAgIHBhdGNoVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3RW5kVm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBvbGRTdGFydFZub2RlLmVsbSwgYXBpLm5leHRTaWJsaW5nKG9sZEVuZFZub2RlLmVsbSkpO1xuICAgICAgICBvbGRTdGFydFZub2RlID0gb2xkQ2hbKytvbGRTdGFydElkeF07XG4gICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkRW5kVm5vZGUsIG5ld1N0YXJ0Vm5vZGUpKSB7IC8vIFZub2RlIG1vdmVkIGxlZnRcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRFbmRWbm9kZSwgbmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIG9sZEVuZFZub2RlLmVsbSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICBvbGRFbmRWbm9kZSA9IG9sZENoWy0tb2xkRW5kSWR4XTtcbiAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzVW5kZWYob2xkS2V5VG9JZHgpKSBvbGRLZXlUb0lkeCA9IGNyZWF0ZUtleVRvT2xkSWR4KG9sZENoLCBvbGRTdGFydElkeCwgb2xkRW5kSWR4KTtcbiAgICAgICAgaWR4SW5PbGQgPSBvbGRLZXlUb0lkeFtuZXdTdGFydFZub2RlLmtleV07XG4gICAgICAgIGlmIChpc1VuZGVmKGlkeEluT2xkKSkgeyAvLyBOZXcgZWxlbWVudFxuICAgICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBjcmVhdGVFbG0obmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbG1Ub01vdmUgPSBvbGRDaFtpZHhJbk9sZF07XG4gICAgICAgICAgcGF0Y2hWbm9kZShlbG1Ub01vdmUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgb2xkQ2hbaWR4SW5PbGRdID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBlbG1Ub01vdmUuZWxtLCBvbGRTdGFydFZub2RlLmVsbSk7XG4gICAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvbGRTdGFydElkeCA+IG9sZEVuZElkeCkge1xuICAgICAgYmVmb3JlID0gaXNVbmRlZihuZXdDaFtuZXdFbmRJZHgrMV0pID8gbnVsbCA6IG5ld0NoW25ld0VuZElkeCsxXS5lbG07XG4gICAgICBhZGRWbm9kZXMocGFyZW50RWxtLCBiZWZvcmUsIG5ld0NoLCBuZXdTdGFydElkeCwgbmV3RW5kSWR4LCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgIH0gZWxzZSBpZiAobmV3U3RhcnRJZHggPiBuZXdFbmRJZHgpIHtcbiAgICAgIHJlbW92ZVZub2RlcyhwYXJlbnRFbG0sIG9sZENoLCBvbGRTdGFydElkeCwgb2xkRW5kSWR4KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwYXRjaFZub2RlKG9sZFZub2RlLCB2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIGksIGhvb2s7XG4gICAgaWYgKGlzRGVmKGkgPSB2bm9kZS5kYXRhKSAmJiBpc0RlZihob29rID0gaS5ob29rKSAmJiBpc0RlZihpID0gaG9vay5wcmVwYXRjaCkpIHtcbiAgICAgIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICB9XG4gICAgdmFyIGVsbSA9IHZub2RlLmVsbSA9IG9sZFZub2RlLmVsbSwgb2xkQ2ggPSBvbGRWbm9kZS5jaGlsZHJlbiwgY2ggPSB2bm9kZS5jaGlsZHJlbjtcbiAgICBpZiAob2xkVm5vZGUgPT09IHZub2RlKSByZXR1cm47XG4gICAgaWYgKCFzYW1lVm5vZGUob2xkVm5vZGUsIHZub2RlKSkge1xuICAgICAgdmFyIHBhcmVudEVsbSA9IGFwaS5wYXJlbnROb2RlKG9sZFZub2RlLmVsbSk7XG4gICAgICBlbG0gPSBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgZWxtLCBvbGRWbm9kZS5lbG0pO1xuICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgW29sZFZub2RlXSwgMCwgMCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChpc0RlZih2bm9kZS5kYXRhKSkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy51cGRhdGUubGVuZ3RoOyArK2kpIGNicy51cGRhdGVbaV0ob2xkVm5vZGUsIHZub2RlKTtcbiAgICAgIGkgPSB2bm9kZS5kYXRhLmhvb2s7XG4gICAgICBpZiAoaXNEZWYoaSkgJiYgaXNEZWYoaSA9IGkudXBkYXRlKSkgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgICBpZiAoaXNVbmRlZih2bm9kZS50ZXh0KSkge1xuICAgICAgaWYgKGlzRGVmKG9sZENoKSAmJiBpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKG9sZENoICE9PSBjaCkgdXBkYXRlQ2hpbGRyZW4oZWxtLCBvbGRDaCwgY2gsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKGNoKSkge1xuICAgICAgICBpZiAoaXNEZWYob2xkVm5vZGUudGV4dCkpIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgICAgYWRkVm5vZGVzKGVsbSwgbnVsbCwgY2gsIDAsIGNoLmxlbmd0aCAtIDEsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKG9sZENoKSkge1xuICAgICAgICByZW1vdmVWbm9kZXMoZWxtLCBvbGRDaCwgMCwgb2xkQ2gubGVuZ3RoIC0gMSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKG9sZFZub2RlLnRleHQpKSB7XG4gICAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9sZFZub2RlLnRleHQgIT09IHZub2RlLnRleHQpIHtcbiAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sIHZub2RlLnRleHQpO1xuICAgIH1cbiAgICBpZiAoaXNEZWYoaG9vaykgJiYgaXNEZWYoaSA9IGhvb2sucG9zdHBhdGNoKSkge1xuICAgICAgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbihvbGRWbm9kZSwgdm5vZGUpIHtcbiAgICB2YXIgaSwgZWxtLCBwYXJlbnQ7XG4gICAgdmFyIGluc2VydGVkVm5vZGVRdWV1ZSA9IFtdO1xuICAgIGZvciAoaSA9IDA7IGkgPCBjYnMucHJlLmxlbmd0aDsgKytpKSBjYnMucHJlW2ldKCk7XG5cbiAgICBpZiAoaXNVbmRlZihvbGRWbm9kZS5zZWwpKSB7XG4gICAgICBvbGRWbm9kZSA9IGVtcHR5Tm9kZUF0KG9sZFZub2RlKTtcbiAgICB9XG5cbiAgICBpZiAoc2FtZVZub2RlKG9sZFZub2RlLCB2bm9kZSkpIHtcbiAgICAgIHBhdGNoVm5vZGUob2xkVm5vZGUsIHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbG0gPSBvbGRWbm9kZS5lbG07XG4gICAgICBwYXJlbnQgPSBhcGkucGFyZW50Tm9kZShlbG0pO1xuXG4gICAgICBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG5cbiAgICAgIGlmIChwYXJlbnQgIT09IG51bGwpIHtcbiAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnQsIHZub2RlLmVsbSwgYXBpLm5leHRTaWJsaW5nKGVsbSkpO1xuICAgICAgICByZW1vdmVWbm9kZXMocGFyZW50LCBbb2xkVm5vZGVdLCAwLCAwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgaW5zZXJ0ZWRWbm9kZVF1ZXVlLmxlbmd0aDsgKytpKSB7XG4gICAgICBpbnNlcnRlZFZub2RlUXVldWVbaV0uZGF0YS5ob29rLmluc2VydChpbnNlcnRlZFZub2RlUXVldWVbaV0pO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnBvc3QubGVuZ3RoOyArK2kpIGNicy5wb3N0W2ldKCk7XG4gICAgcmV0dXJuIHZub2RlO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtpbml0OiBpbml0fTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oc2VsLCBkYXRhLCBjaGlsZHJlbiwgdGV4dCwgZWxtKSB7XG4gIHZhciBrZXkgPSBkYXRhID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkYXRhLmtleTtcbiAgcmV0dXJuIHtzZWw6IHNlbCwgZGF0YTogZGF0YSwgY2hpbGRyZW46IGNoaWxkcmVuLFxuICAgICAgICAgIHRleHQ6IHRleHQsIGVsbTogZWxtLCBrZXk6IGtleX07XG59O1xuIiwiY29uc3QgYW5ueWFuZyA9IHJlcXVpcmUoJ2FubnlhbmcnKVxuY29uc3QgU3RhdGVNYWNoaW5lID0gcmVxdWlyZSgnLi9TdGF0ZU1hY2hpbmUnKVxuY29uc3QgRW52aXJvbm1lbnQgPSByZXF1aXJlKCcuL0Vudmlyb25tZW50JylcbmNvbnN0IGRhdGEgPSB7XG4gIGxldHRlcnM6IHtcbiAgICAgYTogMCxcbiAgICAgYjogMCxcbiAgICAgYzogMFxuICAgfSxcbiAgY2xpZW50czoge1xuICAgICAnQm9iIEpvbmVzJzoge30sXG4gICAgICdHcmVnIEhhcm1vbic6IHt9LFxuICAgICAnTGVhbm4gTGV3aXMnOiB7fSxcbiAgICAgJ0hhcm1vbnkgQ2hvc3R3aXR6Jzoge31cbiAgIH0sXG4gICB2bG9nczogW10sXG4gICBjbG9nczogW11cbn1cbmNvbnN0IGNvbW1hbmRzID0gcmVxdWlyZSgnLi9Db21tYW5kcycpXG5jb25zdCB7IEVpdGhlciB9ID0gcmVxdWlyZSgnZnAtbGliJylcblxuY29uc3QgU3RhdGVDcmVhdG9yID0gcmVxdWlyZSgnLi9TdGF0ZUNyZWF0b3InKVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbmNvbnN0ICRhY3RpdmF0ZUJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3RpdmF0ZS1idG4nKVxuY29uc3QgJHNob3dDb21tYW5kc0J0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzaG93LWNvbW1hbmRzLWJ0bicpXG5jb25zdCBkb21fZXZlbnRzID0ge1xuICAnY2xpY2snOiBbe1xuICAgIGVsZW1lbnQ6ICRhY3RpdmF0ZUJ0bixcbiAgICBjYWxsYmFjazogZnVuY3Rpb24oXykge1xuICAgICAgYW5ueWFuZy5zdGFydCh7IGF1dG9SZXN0YXJ0OiBmYWxzZSwgY29udGludW91czogdHJ1ZSB9KVxuICAgIH1cbiAgfSwge1xuICAgIGVsZW1lbnQ6ICRzaG93Q29tbWFuZHNCdG4sXG4gICAgY2FsbGJhY2s6IGZ1bmN0aW9uKF8pIHtcbiAgICAgIGFubnlhbmcudHJpZ2dlcignaW5jcmVhc2UgYScpXG4gICAgfVxuICB9XVxufVxuY29uc3QgYW5ueWFuZ19jYWxsYmFja3MgPSB7XG4gJ3N0YXJ0JzogKCkgPT4ge1xuICAgJGFjdGl2YXRlQnRuLmRpc2FibGVkID0gdHJ1ZVxuICAgJGFjdGl2YXRlQnRuLnRleHRDb250ZW50ID0gJ0xpc3RlbmluZydcbiB9LFxuICdyZXN1bHQnOiAocmVzdWx0KSA9PiB7XG4gICAvL2NvbnNvbGUubG9nKHJlc3VsdClcbiB9LFxuICdyZXN1bHRNYXRjaCc6IChyZXN1bHQpID0+IHtcbiAgIC8vY29uc29sZS5sb2cocmVzdWx0KVxuIH0sXG4gJ2VuZCc6ICgpID0+IHtcbiAgICRhY3RpdmF0ZUJ0bi5kaXNhYmxlZCA9IGZhbHNlXG4gICAkYWN0aXZhdGVCdG4udGV4dENvbnRlbnQgPSAnU3RhcnQnXG4gfVxufVxuXG5mb3IgKHZhciBjYiBpbiBhbm55YW5nX2NhbGxiYWNrcykge1xuICBhbm55YW5nLmFkZENhbGxiYWNrKGNiLCBhbm55YW5nX2NhbGxiYWNrc1tjYl0pXG59XG5mb3IgKHZhciB0eXBlIGluIGRvbV9ldmVudHMpIHtcbiAgZG9tX2V2ZW50c1t0eXBlXS5mb3JFYWNoKGV2ZW50ID0+IHtcbiAgICBldmVudC5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZXZlbnQuY2FsbGJhY2spXG4gIH0pXG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8gXG5cbmNvbnN0IG15RW52ID0gRW52aXJvbm1lbnQuaW5pdChjb21tYW5kcyhkYXRhKSlcbmdsb2JhbC5teUVudiA9IG15RW52XG5cbmNvbnN0IFN0YXRlID0gU3RhdGVNYWNoaW5lLmluaXQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRlbnQnKSkoU3RhdGVDcmVhdG9yKSh7XG4gIGVyck1zZzogJ1BvbycsXG4gIGNsb2dzOiBkYXRhLmNsb2dzXG59KVxuXG5jb25zdCBTdGF0ZUNoYW5nZSA9IChfKSA9PiB7XG4gIGNvbnN0IGVpdGhlcl9zdGF0ZSA9IG15RW52LmNoYW5uZWwuc2hpZnQoKVxuICBcbiAgaWYgKGVpdGhlcl9zdGF0ZSAhPT0gdW5kZWZpbmVkKSB7IFxuICAgIC8vIHBhc3MgaW50ZXJuYWwgZWl0aGVyIHZhbHVlIHRvIFN0YXRlLmNoYW5nZVxuICAgIEVpdGhlci5iaW1hcFxuICAgICAgKGVycl9zdGF0ZSA9PiB7IC8vIHNhbWUgYmVoYXZpb3IgZm9yIGVycm9yIHN0YXRlXG4gICAgICAgIFN0YXRlLmNoYW5nZShlcnJfc3RhdGUsIHsgcmVwbGFjZTogZmFsc2UgfSkgXG4gICAgICB9KVxuICAgICAgKHN0YXRlID0+IHsgXG4gICAgICAgIFN0YXRlLmNoYW5nZShzdGF0ZSwgeyByZXBsYWNlOiBmYWxzZSB9KSBcbiAgICAgIH0pXG4gICAgICAoZWl0aGVyX3N0YXRlKSBcbiAgfVxuICAgIFxuICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKFN0YXRlQ2hhbmdlKVxufVxuXG5cbmFubnlhbmcuYWRkQ29tbWFuZHMobXlFbnYuY29tbWFuZHMpXG5cbndpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUoU3RhdGVDaGFuZ2UpXG4iXX0=
