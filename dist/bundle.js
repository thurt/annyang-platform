(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
// FUNCTIONS /////////////////////////////////////////////////////

//:: a -> a
const trace = (x) => {
  console.log(x)
  return x
}

//:: Object -> [v]
const objectValues = (obj) => {
  return Reflect.ownKeys(obj).map(key => obj[key])
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

//:: String -> Object -> a
const prop = (str) => (obj) => {
  return obj[str]
}

//:: String -> [a] -> [Maybe]
const pluck = (str) => (xs) => {
  return map(prop(str))(xs)
}

//:: a -> a -> Boolean
const is = (test_value) => (value) => {
  return value === test_value
}

//:: (a -> b) -> [a] -> [b]
const map = (fn) => (f) => {
  return f.map(fn)
}

//:: (a -> b) -> [a] -> [b]
const filter = (fn) => (xs) => {
  return xs.filter(fn)
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
    chain(fn) {
      return this
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
    chain(fn) {
      return fn(this.__value)
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
  Maybe, Either, IO, objectValues, prop, pluck, is, filter
}


// OTHER IDEAS //////////////////////////////////////////////////

const recurse_reduce = (f) => (a) => ([x, ...xs]) => {
  return x === undefined ? a : recurse_reduce(f, f(a, x), xs)
}



},{}],3:[function(require,module,exports){
module.exports = require('./lib/fuzzyset.js');

},{"./lib/fuzzyset.js":4}],4:[function(require,module,exports){
(function() {

var FuzzySet = function(arr, useLevenshtein, gramSizeLower, gramSizeUpper) {
    var fuzzyset = {
        version: '0.0.1'
    };

    // default options
    arr = arr || [];
    fuzzyset.gramSizeLower = gramSizeLower || 2;
    fuzzyset.gramSizeUpper = gramSizeUpper || 3;
    fuzzyset.useLevenshtein = useLevenshtein || true;

    // define all the object functions and attributes
    fuzzyset.exactSet = {}
    fuzzyset.matchDict = {};
    fuzzyset.items = {};

    // helper functions
    var levenshtein = function(str1, str2) {
        var current = [], prev, value;

        for (var i = 0; i <= str2.length; i++)
            for (var j = 0; j <= str1.length; j++) {
            if (i && j)
                if (str1.charAt(j - 1) === str2.charAt(i - 1))
                value = prev;
                else
                value = Math.min(current[j], current[j - 1], prev) + 1;
            else
                value = i + j;

            prev = current[j];
            current[j] = value;
            }

        return current.pop();
    };

    // return an edit distance from 0 to 1
    var _distance = function(str1, str2) {
        if (str1 == null && str2 == null) throw 'Trying to compare two null values'
        if (str1 == null || str2 == null) return 0;
        str1 = String(str1); str2 = String(str2);

        var distance = levenshtein(str1, str2);
        if (str1.length > str2.length) {
            return 1 - distance / str1.length;
        } else {
            return 1 - distance / str2.length;
        }
    };
    var _nonWordRe = /[^\w, ]+/;

    var _iterateGrams = function(value, gramSize) {
        gramSize = gramSize || 2;
        var simplified = '-' + value.toLowerCase().replace(_nonWordRe, '') + '-',
            lenDiff = gramSize - simplified.length,
            results = [];
        if (lenDiff > 0) {
            for (var i = 0; i < lenDiff; ++i) {
                value += '-';
            }
        }
        for (var i = 0; i < simplified.length - gramSize + 1; ++i) {
            results.push(simplified.slice(i, i + gramSize))
        }
        return results;
    };

    var _gramCounter = function(value, gramSize) {
        gramSize = gramSize || 2;
        var result = {},
            grams = _iterateGrams(value, gramSize),
            i = 0;
        for (i; i < grams.length; ++i) {
            if (grams[i] in result) {
                result[grams[i]] += 1;
            } else {
                result[grams[i]] = 1;
            }
        }
        return result;
    };

    // the main functions
    fuzzyset.get = function(value, defaultValue) {
        var result = this._get(value);
        if (!result && defaultValue) {
            return defaultValue;
        }
        return result;
    };

    fuzzyset._get = function(value) {
        var normalizedValue = this._normalizeStr(value),
            result = this.exactSet[normalizedValue];
        if (result) {
            return [[1, result]];
        }
        var results = [];
        for (var gramSize = this.gramSizeUpper; gramSize > this.gramSizeLower; --gramSize) {
            results = this.__get(value, gramSize);
            if (results) {
                return results;
            }
        }
        return null;
    };

    fuzzyset.__get = function(value, gramSize) {
        var normalizedValue = this._normalizeStr(value),
            matches = {},
            gramCounts = _gramCounter(normalizedValue, gramSize),
            items = this.items[gramSize],
            sumOfSquareGramCounts = 0,
            gram,
            gramCount,
            i,
            index,
            otherGramCount;

        for (gram in gramCounts) {
            gramCount = gramCounts[gram];
            sumOfSquareGramCounts += Math.pow(gramCount, 2);
            if (gram in this.matchDict) {
                for (i = 0; i < this.matchDict[gram].length; ++i) {
                    index = this.matchDict[gram][i][0];
                    otherGramCount = this.matchDict[gram][i][1];
                    if (index in matches) {
                        matches[index] += gramCount * otherGramCount;
                    } else {
                        matches[index] = gramCount * otherGramCount;
                    }
                }
            }
        }

        function isEmptyObject(obj) {
            for(var prop in obj) {
                if(obj.hasOwnProperty(prop))
                    return false;
            }
            return true;
        }

        if (isEmptyObject(matches)) {
            return null;
        }

        var vectorNormal = Math.sqrt(sumOfSquareGramCounts),
            results = [],
            matchScore;
        // build a results list of [score, str]
        for (var matchIndex in matches) {
            matchScore = matches[matchIndex];
            results.push([matchScore / (vectorNormal * items[matchIndex][0]), items[matchIndex][1]]);
        }
        var sortDescending = function(a, b) {
            if (a[0] < b[0]) {
                return 1;
            } else if (a[0] > b[0]) {
                return -1;
            } else {
                return 0;
            }
        };
        results.sort(sortDescending);
        if (this.useLevenshtein) {
            var newResults = [],
                endIndex = Math.min(50, results.length);
            // truncate somewhat arbitrarily to 50
            for (var i = 0; i < endIndex; ++i) {
                newResults.push([_distance(results[i][1], normalizedValue), results[i][1]]);
            }
            results = newResults;
            results.sort(sortDescending);
        }
        var newResults = [];
        for (var i = 0; i < results.length; ++i) {
            if (results[i][0] == results[0][0]) {
                newResults.push([results[i][0], this.exactSet[results[i][1]]]);
            }
        }
        return newResults;
    };

    fuzzyset.add = function(value) {
        var normalizedValue = this._normalizeStr(value);
        if (normalizedValue in this.exactSet) {
            return false;
        }

        var i = this.gramSizeLower;
        for (i; i < this.gramSizeUpper + 1; ++i) {
            this._add(value, i);
        }
    };

    fuzzyset._add = function(value, gramSize) {
        var normalizedValue = this._normalizeStr(value),
            items = this.items[gramSize] || [],
            index = items.length;

        items.push(0);
        var gramCounts = _gramCounter(normalizedValue, gramSize),
            sumOfSquareGramCounts = 0,
            gram, gramCount;
        for (var gram in gramCounts) {
            gramCount = gramCounts[gram];
            sumOfSquareGramCounts += Math.pow(gramCount, 2);
            if (gram in this.matchDict) {
                this.matchDict[gram].push([index, gramCount]);
            } else {
                this.matchDict[gram] = [[index, gramCount]];
            }
        }
        var vectorNormal = Math.sqrt(sumOfSquareGramCounts);
        items[index] = [vectorNormal, normalizedValue];
        this.items[gramSize] = items;
        this.exactSet[normalizedValue] = value;
    };

    fuzzyset._normalizeStr = function(str) {
        if (Object.prototype.toString.call(str) !== '[object String]') throw 'Must use a string as argument to FuzzySet functions'
        return str.toLowerCase();
    };

    // return length of items in set
    fuzzyset.length = function() {
        var count = 0,
            prop;
        for (prop in this.exactSet) {
            if (this.exactSet.hasOwnProperty(prop)) {
                count += 1;
            }
        }
        return count;
    };

    // return is set is empty
    fuzzyset.isEmpty = function() {
        for (var prop in this.exactSet) {
            if (this.exactSet.hasOwnProperty(prop)) {
                return false;
            }
        }
        return true;
    };

    // return list of values loaded into set
    fuzzyset.values = function() {
        var values = [],
            prop;
        for (prop in this.exactSet) {
            if (this.exactSet.hasOwnProperty(prop)) {
                values.push(this.exactSet[prop])
            }
        }
        return values;
    };


    // initialization
    var i = fuzzyset.gramSizeLower;
    for (i; i < fuzzyset.gramSizeUpper + 1; ++i) {
        fuzzyset.items[i] = [];
    }
    // add all the items to the set
    for (i = 0; i < arr.length; ++i) {
        fuzzyset.add(arr[i]);
    }

    return fuzzyset;
};

var root = this;
// Export the fuzzyset object for **CommonJS**, with backwards-compatibility
// for the old `require()` API. If we're not in CommonJS, add `_` to the
// global object.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FuzzySet;
    root.FuzzySet = FuzzySet;
} else {
    root.FuzzySet = FuzzySet;
}

})();

},{}],5:[function(require,module,exports){
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

},{"./is":7,"./vnode":13}],6:[function(require,module,exports){
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

},{}],7:[function(require,module,exports){
module.exports = {
  array: Array.isArray,
  primitive: function(s) { return typeof s === 'string' || typeof s === 'number'; },
};

},{}],8:[function(require,module,exports){
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

},{}],9:[function(require,module,exports){
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

},{"../is":7}],10:[function(require,module,exports){
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

},{}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
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

},{"./htmldomapi":6,"./is":7,"./vnode":13}],13:[function(require,module,exports){
module.exports = function(sel, data, children, text, elm) {
  var key = data === undefined ? undefined : data.key;
  return {sel: sel, data: data, children: children,
          text: text, elm: elm, key: key};
};

},{}],14:[function(require,module,exports){
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
},{"fp-lib":2}],15:[function(require,module,exports){
const commands = (horizon) => (manualCommandEntry) => (channel) => {
  const fuzzyset = require('fuzzyset.js')
  const h = require('snabbdom/h')
  const { Either, pluck } = require('fp-lib')
  
  const letters = horizon('letters')
  const clients = horizon('clients')
  
  let fuzzy_clients = fuzzyset([])
  let fuzzy_addresses = fuzzyset([])
  
  clients.watch().subscribe(
    (res) => { 
      if (res.length === 0) {} 
      else {
        console.log('received update', res)
        console.log(pluck('name')(res))
        fuzzy_clients = fuzzyset(pluck('name')(res), false, 1)
        //fuzzy_addresses = fuzzyset(pluck('address')(res))
      }
    },
    (err) => console.error(`clients.watch(): ${err}`))
  
  const _commands = {
    'client *name': (name) => {
      const res = fuzzy_clients.get(name)

      if (res !== null) {
        channel.push(Either.Right(`fuzzy client found ${res}`))
      } else {
        channel.push(Either.Left(`client ${name} not found by fuzzy`))
      }
    },
    'new client': () => {
      const name = window.prompt(`Enter new client name`)
      
      if (name === null) { // cancelled
        return
      }
      
      if (name === '') { // empty name
        channel.push(Either.Left(`Error new client -- cannot create client with no name`))  
        return
      }
      
      clients.find({ name }).fetch().defaultIfEmpty().subscribe(
        (msg) => {
          if (msg === null) {
            clients.store({ name }).subscribe(
              (res) => channel.push(Either.Right(`Created new client ${name}`)),
              (err) => channel.push(Either.Left(`Error new client ${name} -- ${err}`)))
          } else {
            channel.push(Either.Left(`Error new client ${name} -- that name already exists`))
          }
        }
      )
    },
    [`what's nearby`]: () => {},
    'client address *addr': (addr) => {
            
    },
    'increase :letter': (letter) => {
      letters.find(letter.toLowerCase()).fetch().defaultIfEmpty().subscribe(
        (res) => {
          if (res === null) {
            channel.push(Either.Left(`cannot increase letter ${letter} -- it does not exist`)) 
          } else {
            letters.replace({ id: letter, count: res.count + 1 }).subscribe(
              (id) => { 
                channel.push(Either.Right(`increased letter ${letter} to ${res.count}`)) 
              },
              (err) => { 
                channel.push(Either.Left(`Error on replace: increase letter ${letter} -- ${err} `))
              }
            )  
          }
        },
        (err) => {
          channel.push(Either.Left(`Error on find: increase letter ${letter} -- ${err}`)) 
        }
      )
    },
    'show commands': () => {
      const state = (names) => {
        return [names.map(name => {
          return h('button', { on: { click: [manualCommandEntry, name] } }, name)
        })]
      }
      channel.push(Either.Right(state(Reflect.ownKeys(_commands))))
    }
  }
  /*
  const wrapper = (f) => (...args) => {
    channel.push(f(...args))
  }
  
  for (let name of Object.keys(_commands)) {
    _commands[name] = wrapper(_commands[name])
  }
  */
  return _commands
} 

module.exports = commands
},{"fp-lib":2,"fuzzyset.js":3,"snabbdom/h":5}],16:[function(require,module,exports){
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
},{}],17:[function(require,module,exports){
const manualCommandEntry = (annyang) => (channel) => {
  const { Either } = require('fp-lib')
  const err = {
    0: (cmd) => `Can't complete [${cmd}]. Missing required input.`,
    1: (cmd, len) => `Can't complete [${cmd}]. It requires exactly ${len} inputs.`
  }
  const regx = {
    0: new RegExp(/(:\w+|\*\w+)/, 'gi'), // has command arguments
    1: new RegExp(/(:\w+)/, 'gi'), // command arg
    2: new RegExp(/(\*\w+)/, 'gi'), // command splat
    3: new RegExp(/(\w+)/, 'gi') // words
  }
  const pred = {
    0: (x) => x === '',
    1: (x, y) => x.length !== y.length
  }  
  
  //:: (String, String) -> Either String null
  const hasInput = (x, cmd) => {
    let result = null
    
    if (pred[0](x)) {
      result = Either.Left(err[0](cmd))
    } else {
      result = Either.Right(null)
    }

    return result
  }
  
  //:: (String, String) -> Either String null -> Either String String 
  const hasCorrectNumberOfInputs = (x, cmd) => (_) => {
    // first check if it has ':args'
    let args = cmd.match(regx[1])
    let xs
    let i = 0  
    
    if (args === null) {
      args = cmd.match(regx[2])
      xs = [x]
    } else {
      xs = x.match(regx[3])
    }
    
    return (pred[1](xs, args))
      ? Either.Left(err[1](cmd, args.length))
      : Either.Right(cmd.replace(regx[0], (match) => xs[i++]))
  }
  
  //:: String -> Either String String
  const getUserInput = (cmd) => {
    const x = window.prompt(cmd)
    return hasInput(x, cmd).chain(hasCorrectNumberOfInputs(x, cmd))
  }
  
  //:: String -> Bool
  const requiresArguments = (cmd) =>  {
    return regx[0].test(cmd)
  }
  
  //:: String -> _  
  return (cmd) => {
    if (requiresArguments(cmd)) {
      const result = getUserInput(cmd)
      
      Either.bimap
        (left => { channel.push(result) })
        (right => { annyang.trigger(right) })
        (result)
        
    } else {
      annyang.trigger(cmd)
    }
  }
}

module.exports = manualCommandEntry
},{"fp-lib":2}],18:[function(require,module,exports){
const { Either } = require('fp-lib')

const StateChange = (State) => (channel) => (_) => {
  const either_state = channel.shift()
  
  if (either_state !== undefined) { 
    // pass internal either value to State.change
    Either.bimap
      (msgs => { // currently, it is same behavior for error state
        State.change({ logs: msgs }) 
      })
      (msgs => { 
        State.change({ logs: msgs }) 
      })
      (either_state) 
  }
    
  window.requestAnimationFrame(StateChange(State)(channel))
}

module.exports = StateChange
},{"fp-lib":2}],19:[function(require,module,exports){
const h = require('snabbdom/h')
let _logs = []
let _key = 0

const myStyles = {
  fadeIn: {
    opacity: '0', 
    transition: 'opacity 1s', 
    delayed: { opacity: '1'}
  }
}

const createLog = (log) => {
  const date = new Date()
  const log_date =  `${date.getMonth()}-${date.getDate()} @ ${date.getHours()}:${date.getMinutes()}`

  return h('div.log', {
    style: myStyles.fadeIn,
    key: _key++
  }, [
    h('span.log_date', log_date), 
    h('span.log_msg', log)
  ])
}

const StateCreator = ({ logs }) => {
  if (!Array.isArray(logs)) {
    logs = [logs]
  }
  _logs = logs.map(createLog).concat(_logs)
  
  while (_logs.length > 30) {
    _logs.shift()
  }
  
  return h('div#content', [
    h('div#logs', _logs)
  ])
}

module.exports = StateCreator
},{"snabbdom/h":5}],20:[function(require,module,exports){
const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with choosen modules
  require('snabbdom/modules/class'), // makes it easy to toggle classes
  require('snabbdom/modules/props'), // for setting properties on DOM elements
  require('snabbdom/modules/style'), // handles styling on elements with support for animations
  require('snabbdom/modules/eventlisteners'), // attaches event listeners
])

const init = (parentNode) => (StateCreator) => (init_params) => {
  let _vtree = parentNode

  const change = (state) => {
    const new_vtree = StateCreator(state)
    patch(_vtree, new_vtree)
    _vtree = new_vtree
  }
  
  change(init_params)
  
  return { change }
}

module.exports = { init }
},{"snabbdom":12,"snabbdom/modules/class":8,"snabbdom/modules/eventlisteners":9,"snabbdom/modules/props":10,"snabbdom/modules/style":11}],21:[function(require,module,exports){

const StateSystem = (channel) => {
  const StateChange = require('./StateChange')
  const StateMachine = require('./StateMachine')
  const StateCreator = require('./StateCreator')
  const $contentSpace = document.getElementById('content')
  const myStateMachine = StateMachine.init($contentSpace)(StateCreator)({ logs: [] })
  const myStateChange = StateChange(myStateMachine)(channel)
  
  return myStateChange  
}

module.exports = StateSystem
},{"./StateChange":18,"./StateCreator":19,"./StateMachine":20}],22:[function(require,module,exports){
(function (global){
/*global Horizon*/
const horizon = Horizon()
const annyang = require('annyang')
const channel = []

horizon.connect()
annyang.debug()
global.annyang = annyang
/////////////////////

// Setup horizon status indicator
{
  const $header = document.getElementById('header')
  horizon.status(status => {
    $header.className = `status-${status.type}`
  })
}

/////////////////////

// Setup annyang callbacks and dom events
{
  const $activateBtn = document.getElementById('activate-btn')
  const $showCommandsBtn = document.getElementById('show-commands-btn')
  
  const myCallbacks = require('./Callbacks')({ $activateBtn })(channel)
  const myDomEvents = require('./DomEvents')({ $activateBtn, $showCommandsBtn })(annyang)
  
  for (var cb in myCallbacks) {
    annyang.addCallback(cb, myCallbacks[cb])
  }
  for (var type in myDomEvents) {
    myDomEvents[type].forEach(event => {
      event.element.addEventListener(type, event.callback)
    })
  }
}

/////////////////// 

// Setup annyang command entry and manual command entry
{
  const myManualCommandEntry = require('./ManualCommandEntry')(annyang)(channel)
  const myCommands = require('./Commands')(horizon)(myManualCommandEntry)(channel)
  annyang.addCommands(myCommands)
  global.myCommands = myCommands
}

/////////////////// 

// Setup state machine
{
const StateSystem = require('./StateSystem')
const myStateChange = StateSystem(channel)

window.requestAnimationFrame(myStateChange)
}

/////////////////// 
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./Callbacks":14,"./Commands":15,"./DomEvents":16,"./ManualCommandEntry":17,"./StateSystem":21,"annyang":1}]},{},[22])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYW5ueWFuZy9hbm55YW5nLmpzIiwibm9kZV9tb2R1bGVzL2ZwLWxpYi9mcC1saWIuanMiLCJub2RlX21vZHVsZXMvZnV6enlzZXQuanMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZnV6enlzZXQuanMvbGliL2Z1enp5c2V0LmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2guanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaHRtbGRvbWFwaS5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9pcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL2NsYXNzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vbW9kdWxlcy9wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL3N0eWxlLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3NuYWJiZG9tLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3Zub2RlLmpzIiwic3JjL0NhbGxiYWNrcy5qcyIsInNyYy9Db21tYW5kcy5qcyIsInNyYy9Eb21FdmVudHMuanMiLCJzcmMvTWFudWFsQ29tbWFuZEVudHJ5LmpzIiwic3JjL1N0YXRlQ2hhbmdlLmpzIiwic3JjL1N0YXRlQ3JlYXRvci5qcyIsInNyYy9TdGF0ZU1hY2hpbmUuanMiLCJzcmMvU3RhdGVTeXN0ZW0uanMiLCJzcmMvcGxhdGZvcm0uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2p3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeFRBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIvLyEgYW5ueWFuZ1xuLy8hIHZlcnNpb24gOiAyLjQuMFxuLy8hIGF1dGhvciAgOiBUYWwgQXRlciBAVGFsQXRlclxuLy8hIGxpY2Vuc2UgOiBNSVRcbi8vISBodHRwczovL3d3dy5UYWxBdGVyLmNvbS9hbm55YW5nL1xuKGZ1bmN0aW9uIChyb290LCBmYWN0b3J5KSB7XG4gIFwidXNlIHN0cmljdFwiO1xuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7IC8vIEFNRCArIGdsb2JhbFxuICAgIGRlZmluZShbXSwgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIChyb290LmFubnlhbmcgPSBmYWN0b3J5KHJvb3QpKTtcbiAgICB9KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgbW9kdWxlID09PSAnb2JqZWN0JyAmJiBtb2R1bGUuZXhwb3J0cykgeyAvLyBDb21tb25KU1xuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeShyb290KTtcbiAgfSBlbHNlIHsgLy8gQnJvd3NlciBnbG9iYWxzXG4gICAgcm9vdC5hbm55YW5nID0gZmFjdG9yeShyb290KTtcbiAgfVxufSh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyA/IHdpbmRvdyA6IHRoaXMsIGZ1bmN0aW9uIChyb290LCB1bmRlZmluZWQpIHtcbiAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgLyoqXG4gICAqICMgUXVpY2sgVHV0b3JpYWwsIEludHJvIGFuZCBEZW1vc1xuICAgKlxuICAgKiBUaGUgcXVpY2tlc3Qgd2F5IHRvIGdldCBzdGFydGVkIGlzIHRvIHZpc2l0IHRoZSBbYW5ueWFuZyBob21lcGFnZV0oaHR0cHM6Ly93d3cudGFsYXRlci5jb20vYW5ueWFuZy8pLlxuICAgKlxuICAgKiBGb3IgYSBtb3JlIGluLWRlcHRoIGxvb2sgYXQgYW5ueWFuZywgcmVhZCBvbi5cbiAgICpcbiAgICogIyBBUEkgUmVmZXJlbmNlXG4gICAqL1xuXG4gIHZhciBhbm55YW5nO1xuXG4gIC8vIEdldCB0aGUgU3BlZWNoUmVjb2duaXRpb24gb2JqZWN0LCB3aGlsZSBoYW5kbGluZyBicm93c2VyIHByZWZpeGVzXG4gIHZhciBTcGVlY2hSZWNvZ25pdGlvbiA9IHJvb3QuU3BlZWNoUmVjb2duaXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC53ZWJraXRTcGVlY2hSZWNvZ25pdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICByb290Lm1velNwZWVjaFJlY29nbml0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3QubXNTcGVlY2hSZWNvZ25pdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICByb290Lm9TcGVlY2hSZWNvZ25pdGlvbjtcblxuICAvLyBDaGVjayBicm93c2VyIHN1cHBvcnRcbiAgLy8gVGhpcyBpcyBkb25lIGFzIGVhcmx5IGFzIHBvc3NpYmxlLCB0byBtYWtlIGl0IGFzIGZhc3QgYXMgcG9zc2libGUgZm9yIHVuc3VwcG9ydGVkIGJyb3dzZXJzXG4gIGlmICghU3BlZWNoUmVjb2duaXRpb24pIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZhciBjb21tYW5kc0xpc3QgPSBbXTtcbiAgdmFyIHJlY29nbml0aW9uO1xuICB2YXIgY2FsbGJhY2tzID0geyBzdGFydDogW10sIGVycm9yOiBbXSwgZW5kOiBbXSwgcmVzdWx0OiBbXSwgcmVzdWx0TWF0Y2g6IFtdLCByZXN1bHROb01hdGNoOiBbXSwgZXJyb3JOZXR3b3JrOiBbXSwgZXJyb3JQZXJtaXNzaW9uQmxvY2tlZDogW10sIGVycm9yUGVybWlzc2lvbkRlbmllZDogW10gfTtcbiAgdmFyIGF1dG9SZXN0YXJ0O1xuICB2YXIgbGFzdFN0YXJ0ZWRBdCA9IDA7XG4gIHZhciBkZWJ1Z1N0YXRlID0gZmFsc2U7XG4gIHZhciBkZWJ1Z1N0eWxlID0gJ2ZvbnQtd2VpZ2h0OiBib2xkOyBjb2xvcjogIzAwZjsnO1xuICB2YXIgcGF1c2VMaXN0ZW5pbmcgPSBmYWxzZTtcbiAgdmFyIGlzTGlzdGVuaW5nID0gZmFsc2U7XG5cbiAgLy8gVGhlIGNvbW1hbmQgbWF0Y2hpbmcgY29kZSBpcyBhIG1vZGlmaWVkIHZlcnNpb24gb2YgQmFja2JvbmUuUm91dGVyIGJ5IEplcmVteSBBc2hrZW5hcywgdW5kZXIgdGhlIE1JVCBsaWNlbnNlLlxuICB2YXIgb3B0aW9uYWxQYXJhbSA9IC9cXHMqXFwoKC4qPylcXClcXHMqL2c7XG4gIHZhciBvcHRpb25hbFJlZ2V4ID0gLyhcXChcXD86W14pXStcXCkpXFw/L2c7XG4gIHZhciBuYW1lZFBhcmFtICAgID0gLyhcXChcXD8pPzpcXHcrL2c7XG4gIHZhciBzcGxhdFBhcmFtICAgID0gL1xcKlxcdysvZztcbiAgdmFyIGVzY2FwZVJlZ0V4cCAgPSAvW1xcLXt9XFxbXFxdKz8uLFxcXFxcXF4kfCNdL2c7XG4gIHZhciBjb21tYW5kVG9SZWdFeHAgPSBmdW5jdGlvbihjb21tYW5kKSB7XG4gICAgY29tbWFuZCA9IGNvbW1hbmQucmVwbGFjZShlc2NhcGVSZWdFeHAsICdcXFxcJCYnKVxuICAgICAgICAgICAgICAgICAgLnJlcGxhY2Uob3B0aW9uYWxQYXJhbSwgJyg/OiQxKT8nKVxuICAgICAgICAgICAgICAgICAgLnJlcGxhY2UobmFtZWRQYXJhbSwgZnVuY3Rpb24obWF0Y2gsIG9wdGlvbmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBvcHRpb25hbCA/IG1hdGNoIDogJyhbXlxcXFxzXSspJztcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAucmVwbGFjZShzcGxhdFBhcmFtLCAnKC4qPyknKVxuICAgICAgICAgICAgICAgICAgLnJlcGxhY2Uob3B0aW9uYWxSZWdleCwgJ1xcXFxzKiQxP1xcXFxzKicpO1xuICAgIHJldHVybiBuZXcgUmVnRXhwKCdeJyArIGNvbW1hbmQgKyAnJCcsICdpJyk7XG4gIH07XG5cbiAgLy8gVGhpcyBtZXRob2QgcmVjZWl2ZXMgYW4gYXJyYXkgb2YgY2FsbGJhY2tzIHRvIGl0ZXJhdGUgb3ZlciwgYW5kIGludm9rZXMgZWFjaCBvZiB0aGVtXG4gIHZhciBpbnZva2VDYWxsYmFja3MgPSBmdW5jdGlvbihjYWxsYmFja3MpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgY2FsbGJhY2tzLmZvckVhY2goZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICAgIGNhbGxiYWNrLmNhbGxiYWNrLmFwcGx5KGNhbGxiYWNrLmNvbnRleHQsIGFyZ3MpO1xuICAgIH0pO1xuICB9O1xuXG4gIHZhciBpc0luaXRpYWxpemVkID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIHJlY29nbml0aW9uICE9PSB1bmRlZmluZWQ7XG4gIH07XG5cbiAgdmFyIGluaXRJZk5lZWRlZCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghaXNJbml0aWFsaXplZCgpKSB7XG4gICAgICBhbm55YW5nLmluaXQoe30sIGZhbHNlKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIHJlZ2lzdGVyQ29tbWFuZCA9IGZ1bmN0aW9uKGNvbW1hbmQsIGNiLCBwaHJhc2UpIHtcbiAgICBjb21tYW5kc0xpc3QucHVzaCh7IGNvbW1hbmQ6IGNvbW1hbmQsIGNhbGxiYWNrOiBjYiwgb3JpZ2luYWxQaHJhc2U6IHBocmFzZSB9KTtcbiAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgY29uc29sZS5sb2coJ0NvbW1hbmQgc3VjY2Vzc2Z1bGx5IGxvYWRlZDogJWMnK3BocmFzZSwgZGVidWdTdHlsZSk7XG4gICAgfVxuICB9O1xuXG4gIHZhciBwYXJzZVJlc3VsdHMgPSBmdW5jdGlvbihyZXN1bHRzKSB7XG4gICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5yZXN1bHQsIHJlc3VsdHMpO1xuICAgIHZhciBjb21tYW5kVGV4dDtcbiAgICAvLyBnbyBvdmVyIGVhY2ggb2YgdGhlIDUgcmVzdWx0cyBhbmQgYWx0ZXJuYXRpdmUgcmVzdWx0cyByZWNlaXZlZCAod2UndmUgc2V0IG1heEFsdGVybmF0aXZlcyB0byA1IGFib3ZlKVxuICAgIGZvciAodmFyIGkgPSAwOyBpPHJlc3VsdHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIC8vIHRoZSB0ZXh0IHJlY29nbml6ZWRcbiAgICAgIGNvbW1hbmRUZXh0ID0gcmVzdWx0c1tpXS50cmltKCk7XG4gICAgICBpZiAoZGVidWdTdGF0ZSkge1xuICAgICAgICBjb25zb2xlLmxvZygnU3BlZWNoIHJlY29nbml6ZWQ6ICVjJytjb21tYW5kVGV4dCwgZGVidWdTdHlsZSk7XG4gICAgICB9XG5cbiAgICAgIC8vIHRyeSBhbmQgbWF0Y2ggcmVjb2duaXplZCB0ZXh0IHRvIG9uZSBvZiB0aGUgY29tbWFuZHMgb24gdGhlIGxpc3RcbiAgICAgIGZvciAodmFyIGogPSAwLCBsID0gY29tbWFuZHNMaXN0Lmxlbmd0aDsgaiA8IGw7IGorKykge1xuICAgICAgICB2YXIgY3VycmVudENvbW1hbmQgPSBjb21tYW5kc0xpc3Rbal07XG4gICAgICAgIHZhciByZXN1bHQgPSBjdXJyZW50Q29tbWFuZC5jb21tYW5kLmV4ZWMoY29tbWFuZFRleHQpO1xuICAgICAgICBpZiAocmVzdWx0KSB7XG4gICAgICAgICAgdmFyIHBhcmFtZXRlcnMgPSByZXN1bHQuc2xpY2UoMSk7XG4gICAgICAgICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdjb21tYW5kIG1hdGNoZWQ6ICVjJytjdXJyZW50Q29tbWFuZC5vcmlnaW5hbFBocmFzZSwgZGVidWdTdHlsZSk7XG4gICAgICAgICAgICBpZiAocGFyYW1ldGVycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ3dpdGggcGFyYW1ldGVycycsIHBhcmFtZXRlcnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBleGVjdXRlIHRoZSBtYXRjaGVkIGNvbW1hbmRcbiAgICAgICAgICBjdXJyZW50Q29tbWFuZC5jYWxsYmFjay5hcHBseSh0aGlzLCBwYXJhbWV0ZXJzKTtcbiAgICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLnJlc3VsdE1hdGNoLCBjb21tYW5kVGV4dCwgY3VycmVudENvbW1hbmQub3JpZ2luYWxQaHJhc2UsIHJlc3VsdHMpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLnJlc3VsdE5vTWF0Y2gsIHJlc3VsdHMpO1xuICB9O1xuXG4gIGFubnlhbmcgPSB7XG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIGFubnlhbmcgd2l0aCBhIGxpc3Qgb2YgY29tbWFuZHMgdG8gcmVjb2duaXplLlxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIHZhciBjb21tYW5kcyA9IHsnaGVsbG8gOm5hbWUnOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKiB2YXIgY29tbWFuZHMyID0geydoaSc6IGhlbGxvRnVuY3Rpb259O1xuICAgICAqXG4gICAgICogLy8gaW5pdGlhbGl6ZSBhbm55YW5nLCBvdmVyd3JpdGluZyBhbnkgcHJldmlvdXNseSBhZGRlZCBjb21tYW5kc1xuICAgICAqIGFubnlhbmcuaW5pdChjb21tYW5kcywgdHJ1ZSk7XG4gICAgICogLy8gYWRkcyBhbiBhZGRpdGlvbmFsIGNvbW1hbmQgd2l0aG91dCByZW1vdmluZyB0aGUgcHJldmlvdXMgY29tbWFuZHNcbiAgICAgKiBhbm55YW5nLmluaXQoY29tbWFuZHMyLCBmYWxzZSk7XG4gICAgICogYGBgYFxuICAgICAqIEFzIG9mIHYxLjEuMCBpdCBpcyBubyBsb25nZXIgcmVxdWlyZWQgdG8gY2FsbCBpbml0KCkuIEp1c3Qgc3RhcnQoKSBsaXN0ZW5pbmcgd2hlbmV2ZXIgeW91IHdhbnQsIGFuZCBhZGRDb21tYW5kcygpIHdoZW5ldmVyLCBhbmQgYXMgb2Z0ZW4gYXMgeW91IGxpa2UuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY29tbWFuZHMgLSBDb21tYW5kcyB0aGF0IGFubnlhbmcgc2hvdWxkIGxpc3RlbiB0b1xuICAgICAqIEBwYXJhbSB7Ym9vbGVhbn0gW3Jlc2V0Q29tbWFuZHM9dHJ1ZV0gLSBSZW1vdmUgYWxsIGNvbW1hbmRzIGJlZm9yZSBpbml0aWFsaXppbmc/XG4gICAgICogQG1ldGhvZCBpbml0XG4gICAgICogQGRlcHJlY2F0ZWRcbiAgICAgKiBAc2VlIFtDb21tYW5kcyBPYmplY3RdKCNjb21tYW5kcy1vYmplY3QpXG4gICAgICovXG4gICAgaW5pdDogZnVuY3Rpb24oY29tbWFuZHMsIHJlc2V0Q29tbWFuZHMpIHtcblxuICAgICAgLy8gcmVzZXRDb21tYW5kcyBkZWZhdWx0cyB0byB0cnVlXG4gICAgICBpZiAocmVzZXRDb21tYW5kcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJlc2V0Q29tbWFuZHMgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzZXRDb21tYW5kcyA9ICEhcmVzZXRDb21tYW5kcztcbiAgICAgIH1cblxuICAgICAgLy8gQWJvcnQgcHJldmlvdXMgaW5zdGFuY2VzIG9mIHJlY29nbml0aW9uIGFscmVhZHkgcnVubmluZ1xuICAgICAgaWYgKHJlY29nbml0aW9uICYmIHJlY29nbml0aW9uLmFib3J0KSB7XG4gICAgICAgIHJlY29nbml0aW9uLmFib3J0KCk7XG4gICAgICB9XG5cbiAgICAgIC8vIGluaXRpYXRlIFNwZWVjaFJlY29nbml0aW9uXG4gICAgICByZWNvZ25pdGlvbiA9IG5ldyBTcGVlY2hSZWNvZ25pdGlvbigpO1xuXG4gICAgICAvLyBTZXQgdGhlIG1heCBudW1iZXIgb2YgYWx0ZXJuYXRpdmUgdHJhbnNjcmlwdHMgdG8gdHJ5IGFuZCBtYXRjaCB3aXRoIGEgY29tbWFuZFxuICAgICAgcmVjb2duaXRpb24ubWF4QWx0ZXJuYXRpdmVzID0gNTtcblxuICAgICAgLy8gSW4gSFRUUFMsIHR1cm4gb2ZmIGNvbnRpbnVvdXMgbW9kZSBmb3IgZmFzdGVyIHJlc3VsdHMuXG4gICAgICAvLyBJbiBIVFRQLCAgdHVybiBvbiAgY29udGludW91cyBtb2RlIGZvciBtdWNoIHNsb3dlciByZXN1bHRzLCBidXQgbm8gcmVwZWF0aW5nIHNlY3VyaXR5IG5vdGljZXNcbiAgICAgIHJlY29nbml0aW9uLmNvbnRpbnVvdXMgPSByb290LmxvY2F0aW9uLnByb3RvY29sID09PSAnaHR0cDonO1xuXG4gICAgICAvLyBTZXRzIHRoZSBsYW5ndWFnZSB0byB0aGUgZGVmYXVsdCAnZW4tVVMnLiBUaGlzIGNhbiBiZSBjaGFuZ2VkIHdpdGggYW5ueWFuZy5zZXRMYW5ndWFnZSgpXG4gICAgICByZWNvZ25pdGlvbi5sYW5nID0gJ2VuLVVTJztcblxuICAgICAgcmVjb2duaXRpb24ub25zdGFydCAgID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGlzTGlzdGVuaW5nID0gdHJ1ZTtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5zdGFydCk7XG4gICAgICB9O1xuXG4gICAgICByZWNvZ25pdGlvbi5vbmVycm9yICAgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLmVycm9yKTtcbiAgICAgICAgc3dpdGNoIChldmVudC5lcnJvcikge1xuICAgICAgICBjYXNlICduZXR3b3JrJzpcbiAgICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLmVycm9yTmV0d29yayk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ25vdC1hbGxvd2VkJzpcbiAgICAgICAgY2FzZSAnc2VydmljZS1ub3QtYWxsb3dlZCc6XG4gICAgICAgICAgLy8gaWYgcGVybWlzc2lvbiB0byB1c2UgdGhlIG1pYyBpcyBkZW5pZWQsIHR1cm4gb2ZmIGF1dG8tcmVzdGFydFxuICAgICAgICAgIGF1dG9SZXN0YXJ0ID0gZmFsc2U7XG4gICAgICAgICAgLy8gZGV0ZXJtaW5lIGlmIHBlcm1pc3Npb24gd2FzIGRlbmllZCBieSB1c2VyIG9yIGF1dG9tYXRpY2FsbHkuXG4gICAgICAgICAgaWYgKG5ldyBEYXRlKCkuZ2V0VGltZSgpLWxhc3RTdGFydGVkQXQgPCAyMDApIHtcbiAgICAgICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MuZXJyb3JQZXJtaXNzaW9uQmxvY2tlZCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MuZXJyb3JQZXJtaXNzaW9uRGVuaWVkKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHJlY29nbml0aW9uLm9uZW5kICAgICA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpc0xpc3RlbmluZyA9IGZhbHNlO1xuICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLmVuZCk7XG4gICAgICAgIC8vIGFubnlhbmcgd2lsbCBhdXRvIHJlc3RhcnQgaWYgaXQgaXMgY2xvc2VkIGF1dG9tYXRpY2FsbHkgYW5kIG5vdCBieSB1c2VyIGFjdGlvbi5cbiAgICAgICAgaWYgKGF1dG9SZXN0YXJ0KSB7XG4gICAgICAgICAgLy8gcGxheSBuaWNlbHkgd2l0aCB0aGUgYnJvd3NlciwgYW5kIG5ldmVyIHJlc3RhcnQgYW5ueWFuZyBhdXRvbWF0aWNhbGx5IG1vcmUgdGhhbiBvbmNlIHBlciBzZWNvbmRcbiAgICAgICAgICB2YXIgdGltZVNpbmNlTGFzdFN0YXJ0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCktbGFzdFN0YXJ0ZWRBdDtcbiAgICAgICAgICBpZiAodGltZVNpbmNlTGFzdFN0YXJ0IDwgMTAwMCkge1xuICAgICAgICAgICAgc2V0VGltZW91dChhbm55YW5nLnN0YXJ0LCAxMDAwLXRpbWVTaW5jZUxhc3RTdGFydCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFubnlhbmcuc3RhcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHJlY29nbml0aW9uLm9ucmVzdWx0ICA9IGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgICAgIGlmKHBhdXNlTGlzdGVuaW5nKSB7XG4gICAgICAgICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTcGVlY2ggaGVhcmQsIGJ1dCBhbm55YW5nIGlzIHBhdXNlZCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBNYXAgdGhlIHJlc3VsdHMgdG8gYW4gYXJyYXlcbiAgICAgICAgdmFyIFNwZWVjaFJlY29nbml0aW9uUmVzdWx0ID0gZXZlbnQucmVzdWx0c1tldmVudC5yZXN1bHRJbmRleF07XG4gICAgICAgIHZhciByZXN1bHRzID0gW107XG4gICAgICAgIGZvciAodmFyIGsgPSAwOyBrPFNwZWVjaFJlY29nbml0aW9uUmVzdWx0Lmxlbmd0aDsgaysrKSB7XG4gICAgICAgICAgcmVzdWx0c1trXSA9IFNwZWVjaFJlY29nbml0aW9uUmVzdWx0W2tdLnRyYW5zY3JpcHQ7XG4gICAgICAgIH1cblxuICAgICAgICBwYXJzZVJlc3VsdHMocmVzdWx0cyk7XG4gICAgICB9O1xuXG4gICAgICAvLyBidWlsZCBjb21tYW5kcyBsaXN0XG4gICAgICBpZiAocmVzZXRDb21tYW5kcykge1xuICAgICAgICBjb21tYW5kc0xpc3QgPSBbXTtcbiAgICAgIH1cbiAgICAgIGlmIChjb21tYW5kcy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5hZGRDb21tYW5kcyhjb21tYW5kcyk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0YXJ0IGxpc3RlbmluZy5cbiAgICAgKiBJdCdzIGEgZ29vZCBpZGVhIHRvIGNhbGwgdGhpcyBhZnRlciBhZGRpbmcgc29tZSBjb21tYW5kcyBmaXJzdCwgYnV0IG5vdCBtYW5kYXRvcnkuXG4gICAgICpcbiAgICAgKiBSZWNlaXZlcyBhbiBvcHRpb25hbCBvcHRpb25zIG9iamVjdCB3aGljaCBzdXBwb3J0cyB0aGUgZm9sbG93aW5nIG9wdGlvbnM6XG4gICAgICpcbiAgICAgKiAtIGBhdXRvUmVzdGFydGAgKGJvb2xlYW4sIGRlZmF1bHQ6IHRydWUpIFNob3VsZCBhbm55YW5nIHJlc3RhcnQgaXRzZWxmIGlmIGl0IGlzIGNsb3NlZCBpbmRpcmVjdGx5LCBiZWNhdXNlIG9mIHNpbGVuY2Ugb3Igd2luZG93IGNvbmZsaWN0cz9cbiAgICAgKiAtIGBjb250aW51b3VzYCAgKGJvb2xlYW4sIGRlZmF1bHQ6IHVuZGVmaW5lZCkgQWxsb3cgZm9yY2luZyBjb250aW51b3VzIG1vZGUgb24gb3Igb2ZmLiBBbm55YW5nIGlzIHByZXR0eSBzbWFydCBhYm91dCB0aGlzLCBzbyBvbmx5IHNldCB0aGlzIGlmIHlvdSBrbm93IHdoYXQgeW91J3JlIGRvaW5nLlxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIC8vIFN0YXJ0IGxpc3RlbmluZywgZG9uJ3QgcmVzdGFydCBhdXRvbWF0aWNhbGx5XG4gICAgICogYW5ueWFuZy5zdGFydCh7IGF1dG9SZXN0YXJ0OiBmYWxzZSB9KTtcbiAgICAgKiAvLyBTdGFydCBsaXN0ZW5pbmcsIGRvbid0IHJlc3RhcnQgYXV0b21hdGljYWxseSwgc3RvcCByZWNvZ25pdGlvbiBhZnRlciBmaXJzdCBwaHJhc2UgcmVjb2duaXplZFxuICAgICAqIGFubnlhbmcuc3RhcnQoeyBhdXRvUmVzdGFydDogZmFsc2UsIGNvbnRpbnVvdXM6IGZhbHNlIH0pO1xuICAgICAqIGBgYGBcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIC0gT3B0aW9uYWwgb3B0aW9ucy5cbiAgICAgKiBAbWV0aG9kIHN0YXJ0XG4gICAgICovXG4gICAgc3RhcnQ6IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICAgIHBhdXNlTGlzdGVuaW5nID0gZmFsc2U7XG4gICAgICBpbml0SWZOZWVkZWQoKTtcbiAgICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgICAgaWYgKG9wdGlvbnMuYXV0b1Jlc3RhcnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBhdXRvUmVzdGFydCA9ICEhb3B0aW9ucy5hdXRvUmVzdGFydDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF1dG9SZXN0YXJ0ID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmIChvcHRpb25zLmNvbnRpbnVvdXMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZWNvZ25pdGlvbi5jb250aW51b3VzID0gISFvcHRpb25zLmNvbnRpbnVvdXM7XG4gICAgICB9XG5cbiAgICAgIGxhc3RTdGFydGVkQXQgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJlY29nbml0aW9uLnN0YXJ0KCk7XG4gICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlLm1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFN0b3AgbGlzdGVuaW5nLCBhbmQgdHVybiBvZmYgbWljLlxuICAgICAqXG4gICAgICogQWx0ZXJuYXRpdmVseSwgdG8gb25seSB0ZW1wb3JhcmlseSBwYXVzZSBhbm55YW5nIHJlc3BvbmRpbmcgdG8gY29tbWFuZHMgd2l0aG91dCBzdG9wcGluZyB0aGUgU3BlZWNoUmVjb2duaXRpb24gZW5naW5lIG9yIGNsb3NpbmcgdGhlIG1pYywgdXNlIHBhdXNlKCkgaW5zdGVhZC5cbiAgICAgKiBAc2VlIFtwYXVzZSgpXSgjcGF1c2UpXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIGFib3J0XG4gICAgICovXG4gICAgYWJvcnQ6IGZ1bmN0aW9uKCkge1xuICAgICAgYXV0b1Jlc3RhcnQgPSBmYWxzZTtcbiAgICAgIGlmIChpc0luaXRpYWxpemVkKCkpIHtcbiAgICAgICAgcmVjb2duaXRpb24uYWJvcnQoKTtcbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUGF1c2UgbGlzdGVuaW5nLiBhbm55YW5nIHdpbGwgc3RvcCByZXNwb25kaW5nIHRvIGNvbW1hbmRzICh1bnRpbCB0aGUgcmVzdW1lIG9yIHN0YXJ0IG1ldGhvZHMgYXJlIGNhbGxlZCksIHdpdGhvdXQgdHVybmluZyBvZmYgdGhlIGJyb3dzZXIncyBTcGVlY2hSZWNvZ25pdGlvbiBlbmdpbmUgb3IgdGhlIG1pYy5cbiAgICAgKlxuICAgICAqIEFsdGVybmF0aXZlbHksIHRvIHN0b3AgdGhlIFNwZWVjaFJlY29nbml0aW9uIGVuZ2luZSBhbmQgY2xvc2UgdGhlIG1pYywgdXNlIGFib3J0KCkgaW5zdGVhZC5cbiAgICAgKiBAc2VlIFthYm9ydCgpXSgjYWJvcnQpXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIHBhdXNlXG4gICAgICovXG4gICAgcGF1c2U6IGZ1bmN0aW9uKCkge1xuICAgICAgcGF1c2VMaXN0ZW5pbmcgPSB0cnVlO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZXN1bWVzIGxpc3RlbmluZyBhbmQgcmVzdG9yZXMgY29tbWFuZCBjYWxsYmFjayBleGVjdXRpb24gd2hlbiBhIHJlc3VsdCBtYXRjaGVzLlxuICAgICAqIElmIFNwZWVjaFJlY29nbml0aW9uIHdhcyBhYm9ydGVkIChzdG9wcGVkKSwgc3RhcnQgaXQuXG4gICAgICpcbiAgICAgKiBAbWV0aG9kIHJlc3VtZVxuICAgICAqL1xuICAgIHJlc3VtZTogZnVuY3Rpb24oKSB7XG4gICAgICBhbm55YW5nLnN0YXJ0KCk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFR1cm4gb24gb3V0cHV0IG9mIGRlYnVnIG1lc3NhZ2VzIHRvIHRoZSBjb25zb2xlLiBVZ2x5LCBidXQgc3VwZXItaGFuZHkhXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtuZXdTdGF0ZT10cnVlXSAtIFR1cm4gb24vb2ZmIGRlYnVnIG1lc3NhZ2VzXG4gICAgICogQG1ldGhvZCBkZWJ1Z1xuICAgICAqL1xuICAgIGRlYnVnOiBmdW5jdGlvbihuZXdTdGF0ZSkge1xuICAgICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGRlYnVnU3RhdGUgPSAhIW5ld1N0YXRlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGVidWdTdGF0ZSA9IHRydWU7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgbGFuZ3VhZ2UgdGhlIHVzZXIgd2lsbCBzcGVhayBpbi4gSWYgdGhpcyBtZXRob2QgaXMgbm90IGNhbGxlZCwgZGVmYXVsdHMgdG8gJ2VuLVVTJy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBsYW5ndWFnZSAtIFRoZSBsYW5ndWFnZSAobG9jYWxlKVxuICAgICAqIEBtZXRob2Qgc2V0TGFuZ3VhZ2VcbiAgICAgKiBAc2VlIFtMYW5ndWFnZXNdKCNsYW5ndWFnZXMpXG4gICAgICovXG4gICAgc2V0TGFuZ3VhZ2U6IGZ1bmN0aW9uKGxhbmd1YWdlKSB7XG4gICAgICBpbml0SWZOZWVkZWQoKTtcbiAgICAgIHJlY29nbml0aW9uLmxhbmcgPSBsYW5ndWFnZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkIGNvbW1hbmRzIHRoYXQgYW5ueWFuZyB3aWxsIHJlc3BvbmQgdG8uIFNpbWlsYXIgaW4gc3ludGF4IHRvIGluaXQoKSwgYnV0IGRvZXNuJ3QgcmVtb3ZlIGV4aXN0aW5nIGNvbW1hbmRzLlxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIHZhciBjb21tYW5kcyA9IHsnaGVsbG8gOm5hbWUnOiBoZWxsb0Z1bmN0aW9uLCAnaG93ZHknOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKiB2YXIgY29tbWFuZHMyID0geydoaSc6IGhlbGxvRnVuY3Rpb259O1xuICAgICAqXG4gICAgICogYW5ueWFuZy5hZGRDb21tYW5kcyhjb21tYW5kcyk7XG4gICAgICogYW5ueWFuZy5hZGRDb21tYW5kcyhjb21tYW5kczIpO1xuICAgICAqIC8vIGFubnlhbmcgd2lsbCBub3cgbGlzdGVuIHRvIGFsbCB0aHJlZSBjb21tYW5kc1xuICAgICAqIGBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBjb21tYW5kcyAtIENvbW1hbmRzIHRoYXQgYW5ueWFuZyBzaG91bGQgbGlzdGVuIHRvXG4gICAgICogQG1ldGhvZCBhZGRDb21tYW5kc1xuICAgICAqIEBzZWUgW0NvbW1hbmRzIE9iamVjdF0oI2NvbW1hbmRzLW9iamVjdClcbiAgICAgKi9cbiAgICBhZGRDb21tYW5kczogZnVuY3Rpb24oY29tbWFuZHMpIHtcbiAgICAgIHZhciBjYjtcblxuICAgICAgaW5pdElmTmVlZGVkKCk7XG5cbiAgICAgIGZvciAodmFyIHBocmFzZSBpbiBjb21tYW5kcykge1xuICAgICAgICBpZiAoY29tbWFuZHMuaGFzT3duUHJvcGVydHkocGhyYXNlKSkge1xuICAgICAgICAgIGNiID0gcm9vdFtjb21tYW5kc1twaHJhc2VdXSB8fCBjb21tYW5kc1twaHJhc2VdO1xuICAgICAgICAgIGlmICh0eXBlb2YgY2IgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIC8vIGNvbnZlcnQgY29tbWFuZCB0byByZWdleCB0aGVuIHJlZ2lzdGVyIHRoZSBjb21tYW5kXG4gICAgICAgICAgICByZWdpc3RlckNvbW1hbmQoY29tbWFuZFRvUmVnRXhwKHBocmFzZSksIGNiLCBwaHJhc2UpO1xuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGNiID09PSAnb2JqZWN0JyAmJiBjYi5yZWdleHAgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgICAgIC8vIHJlZ2lzdGVyIHRoZSBjb21tYW5kXG4gICAgICAgICAgICByZWdpc3RlckNvbW1hbmQobmV3IFJlZ0V4cChjYi5yZWdleHAuc291cmNlLCAnaScpLCBjYi5jYWxsYmFjaywgcGhyYXNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coJ0NhbiBub3QgcmVnaXN0ZXIgY29tbWFuZDogJWMnK3BocmFzZSwgZGVidWdTdHlsZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGV4aXN0aW5nIGNvbW1hbmRzLiBDYWxsZWQgd2l0aCBhIHNpbmdsZSBwaHJhc2UsIGFycmF5IG9mIHBocmFzZXMsIG9yIG1ldGhvZGljYWxseS4gUGFzcyBubyBwYXJhbXMgdG8gcmVtb3ZlIGFsbCBjb21tYW5kcy5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiB2YXIgY29tbWFuZHMgPSB7J2hlbGxvJzogaGVsbG9GdW5jdGlvbiwgJ2hvd2R5JzogaGVsbG9GdW5jdGlvbiwgJ2hpJzogaGVsbG9GdW5jdGlvbn07XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgYWxsIGV4aXN0aW5nIGNvbW1hbmRzXG4gICAgICogYW5ueWFuZy5yZW1vdmVDb21tYW5kcygpO1xuICAgICAqXG4gICAgICogLy8gQWRkIHNvbWUgY29tbWFuZHNcbiAgICAgKiBhbm55YW5nLmFkZENvbW1hbmRzKGNvbW1hbmRzKTtcbiAgICAgKlxuICAgICAqIC8vIERvbid0IHJlc3BvbmQgdG8gaGVsbG9cbiAgICAgKiBhbm55YW5nLnJlbW92ZUNvbW1hbmRzKCdoZWxsbycpO1xuICAgICAqXG4gICAgICogLy8gRG9uJ3QgcmVzcG9uZCB0byBob3dkeSBvciBoaVxuICAgICAqIGFubnlhbmcucmVtb3ZlQ29tbWFuZHMoWydob3dkeScsICdoaSddKTtcbiAgICAgKiBgYGBgXG4gICAgICogQHBhcmFtIHtTdHJpbmd8QXJyYXl8VW5kZWZpbmVkfSBbY29tbWFuZHNUb1JlbW92ZV0gLSBDb21tYW5kcyB0byByZW1vdmVcbiAgICAgKiBAbWV0aG9kIHJlbW92ZUNvbW1hbmRzXG4gICAgICovXG4gICAgcmVtb3ZlQ29tbWFuZHM6IGZ1bmN0aW9uKGNvbW1hbmRzVG9SZW1vdmUpIHtcbiAgICAgIGlmIChjb21tYW5kc1RvUmVtb3ZlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgY29tbWFuZHNMaXN0ID0gW107XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNvbW1hbmRzVG9SZW1vdmUgPSBBcnJheS5pc0FycmF5KGNvbW1hbmRzVG9SZW1vdmUpID8gY29tbWFuZHNUb1JlbW92ZSA6IFtjb21tYW5kc1RvUmVtb3ZlXTtcbiAgICAgIGNvbW1hbmRzTGlzdCA9IGNvbW1hbmRzTGlzdC5maWx0ZXIoZnVuY3Rpb24oY29tbWFuZCkge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaTxjb21tYW5kc1RvUmVtb3ZlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKGNvbW1hbmRzVG9SZW1vdmVbaV0gPT09IGNvbW1hbmQub3JpZ2luYWxQaHJhc2UpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogQWRkIGEgY2FsbGJhY2sgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGluIGNhc2Ugb25lIG9mIHRoZSBmb2xsb3dpbmcgZXZlbnRzIGhhcHBlbnM6XG4gICAgICpcbiAgICAgKiAqIGBzdGFydGAgLSBGaXJlZCBhcyBzb29uIGFzIHRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbml0aW9uIGVuZ2luZSBzdGFydHMgbGlzdGVuaW5nXG4gICAgICogKiBgZXJyb3JgIC0gRmlyZWQgd2hlbiB0aGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ250aW9uIGVuZ2luZSByZXR1cm5zIGFuIGVycm9yLCB0aGlzIGdlbmVyaWMgZXJyb3IgY2FsbGJhY2sgd2lsbCBiZSBmb2xsb3dlZCBieSBtb3JlIGFjY3VyYXRlIGVycm9yIGNhbGxiYWNrcyAoYm90aCB3aWxsIGZpcmUgaWYgYm90aCBhcmUgZGVmaW5lZClcbiAgICAgKiAqIGBlcnJvck5ldHdvcmtgIC0gRmlyZWQgd2hlbiBTcGVlY2ggUmVjb2duaXRpb24gZmFpbHMgYmVjYXVzZSBvZiBhIG5ldHdvcmsgZXJyb3JcbiAgICAgKiAqIGBlcnJvclBlcm1pc3Npb25CbG9ja2VkYCAtIEZpcmVkIHdoZW4gdGhlIGJyb3dzZXIgYmxvY2tzIHRoZSBwZXJtaXNzaW9uIHJlcXVlc3QgdG8gdXNlIFNwZWVjaCBSZWNvZ25pdGlvbi5cbiAgICAgKiAqIGBlcnJvclBlcm1pc3Npb25EZW5pZWRgIC0gRmlyZWQgd2hlbiB0aGUgdXNlciBibG9ja3MgdGhlIHBlcm1pc3Npb24gcmVxdWVzdCB0byB1c2UgU3BlZWNoIFJlY29nbml0aW9uLlxuICAgICAqICogYGVuZGAgLSBGaXJlZCB3aGVuIHRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbml0aW9uIGVuZ2luZSBzdG9wc1xuICAgICAqICogYHJlc3VsdGAgLSBGaXJlZCBhcyBzb29uIGFzIHNvbWUgc3BlZWNoIHdhcyBpZGVudGlmaWVkLiBUaGlzIGdlbmVyaWMgY2FsbGJhY2sgd2lsbCBiZSBmb2xsb3dlZCBieSBlaXRoZXIgdGhlIGByZXN1bHRNYXRjaGAgb3IgYHJlc3VsdE5vTWF0Y2hgIGNhbGxiYWNrcy5cbiAgICAgKiAgICAgQ2FsbGJhY2sgZnVuY3Rpb25zIHJlZ2lzdGVyZWQgdG8gdGhpcyBldmVudCB3aWxsIGluY2x1ZGUgYW4gYXJyYXkgb2YgcG9zc2libGUgcGhyYXNlcyB0aGUgdXNlciBzYWlkIGFzIHRoZSBmaXJzdCBhcmd1bWVudFxuICAgICAqICogYHJlc3VsdE1hdGNoYCAtIEZpcmVkIHdoZW4gYW5ueWFuZyB3YXMgYWJsZSB0byBtYXRjaCBiZXR3ZWVuIHdoYXQgdGhlIHVzZXIgc2FpZCBhbmQgYSByZWdpc3RlcmVkIGNvbW1hbmRcbiAgICAgKiAgICAgQ2FsbGJhY2sgZnVuY3Rpb25zIHJlZ2lzdGVyZWQgdG8gdGhpcyBldmVudCB3aWxsIGluY2x1ZGUgdGhyZWUgYXJndW1lbnRzIGluIHRoZSBmb2xsb3dpbmcgb3JkZXI6XG4gICAgICogICAgICAgKiBUaGUgcGhyYXNlIHRoZSB1c2VyIHNhaWQgdGhhdCBtYXRjaGVkIGEgY29tbWFuZFxuICAgICAqICAgICAgICogVGhlIGNvbW1hbmQgdGhhdCB3YXMgbWF0Y2hlZFxuICAgICAqICAgICAgICogQW4gYXJyYXkgb2YgcG9zc2libGUgYWx0ZXJuYXRpdmUgcGhyYXNlcyB0aGUgdXNlciBtaWdodCd2ZSBzYWlkXG4gICAgICogKiBgcmVzdWx0Tm9NYXRjaGAgLSBGaXJlZCB3aGVuIHdoYXQgdGhlIHVzZXIgc2FpZCBkaWRuJ3QgbWF0Y2ggYW55IG9mIHRoZSByZWdpc3RlcmVkIGNvbW1hbmRzLlxuICAgICAqICAgICBDYWxsYmFjayBmdW5jdGlvbnMgcmVnaXN0ZXJlZCB0byB0aGlzIGV2ZW50IHdpbGwgaW5jbHVkZSBhbiBhcnJheSBvZiBwb3NzaWJsZSBwaHJhc2VzIHRoZSB1c2VyIG1pZ2h0J3ZlIHNhaWQgYXMgdGhlIGZpcnN0IGFyZ3VtZW50XG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnZXJyb3InLCBmdW5jdGlvbigpIHtcbiAgICAgKiAgICQoJy5teUVycm9yVGV4dCcpLnRleHQoJ1RoZXJlIHdhcyBhbiBlcnJvciEnKTtcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ3Jlc3VsdE1hdGNoJywgZnVuY3Rpb24odXNlclNhaWQsIGNvbW1hbmRUZXh0LCBwaHJhc2VzKSB7XG4gICAgICogICBjb25zb2xlLmxvZyh1c2VyU2FpZCk7IC8vIHNhbXBsZSBvdXRwdXQ6ICdoZWxsbydcbiAgICAgKiAgIGNvbnNvbGUubG9nKGNvbW1hbmRUZXh0KTsgLy8gc2FtcGxlIG91dHB1dDogJ2hlbGxvICh0aGVyZSknXG4gICAgICogICBjb25zb2xlLmxvZyhwaHJhc2VzKTsgLy8gc2FtcGxlIG91dHB1dDogWydoZWxsbycsICdoYWxvJywgJ3llbGxvdycsICdwb2xvJywgJ2hlbGxvIGtpdHR5J11cbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIC8vIHBhc3MgbG9jYWwgY29udGV4dCB0byBhIGdsb2JhbCBmdW5jdGlvbiBjYWxsZWQgbm90Q29ubmVjdGVkXG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnZXJyb3JOZXR3b3JrJywgbm90Q29ubmVjdGVkLCB0aGlzKTtcbiAgICAgKiBgYGBgXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHR5cGUgLSBOYW1lIG9mIGV2ZW50IHRoYXQgd2lsbCB0cmlnZ2VyIHRoaXMgY2FsbGJhY2tcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayAtIFRoZSBmdW5jdGlvbiB0byBjYWxsIHdoZW4gZXZlbnQgaXMgdHJpZ2dlcmVkXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtjb250ZXh0XSAtIE9wdGlvbmFsIGNvbnRleHQgZm9yIHRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAqIEBtZXRob2QgYWRkQ2FsbGJhY2tcbiAgICAgKi9cbiAgICBhZGRDYWxsYmFjazogZnVuY3Rpb24odHlwZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICAgIGlmIChjYWxsYmFja3NbdHlwZV0gID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIGNiID0gcm9vdFtjYWxsYmFja10gfHwgY2FsbGJhY2s7XG4gICAgICBpZiAodHlwZW9mIGNiICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGNhbGxiYWNrc1t0eXBlXS5wdXNoKHtjYWxsYmFjazogY2IsIGNvbnRleHQ6IGNvbnRleHQgfHwgdGhpc30pO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmUgY2FsbGJhY2tzIGZyb20gZXZlbnRzLlxuICAgICAqXG4gICAgICogLSBQYXNzIGFuIGV2ZW50IG5hbWUgYW5kIGEgY2FsbGJhY2sgY29tbWFuZCB0byByZW1vdmUgdGhhdCBjYWxsYmFjayBjb21tYW5kIGZyb20gdGhhdCBldmVudCB0eXBlLlxuICAgICAqIC0gUGFzcyBqdXN0IGFuIGV2ZW50IG5hbWUgdG8gcmVtb3ZlIGFsbCBjYWxsYmFjayBjb21tYW5kcyBmcm9tIHRoYXQgZXZlbnQgdHlwZS5cbiAgICAgKiAtIFBhc3MgdW5kZWZpbmVkIGFzIGV2ZW50IG5hbWUgYW5kIGEgY2FsbGJhY2sgY29tbWFuZCB0byByZW1vdmUgdGhhdCBjYWxsYmFjayBjb21tYW5kIGZyb20gYWxsIGV2ZW50IHR5cGVzLlxuICAgICAqIC0gUGFzcyBubyBwYXJhbXMgdG8gcmVtb3ZlIGFsbCBjYWxsYmFjayBjb21tYW5kcyBmcm9tIGFsbCBldmVudCB0eXBlcy5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdzdGFydCcsIG15RnVuY3Rpb24xKTtcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdzdGFydCcsIG15RnVuY3Rpb24yKTtcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdlbmQnLCBteUZ1bmN0aW9uMSk7XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnZW5kJywgbXlGdW5jdGlvbjIpO1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIGFsbCBjYWxsYmFja3MgZnJvbSBhbGwgZXZlbnRzOlxuICAgICAqIGFubnlhbmcucmVtb3ZlQ2FsbGJhY2soKTtcbiAgICAgKlxuICAgICAqIC8vIFJlbW92ZSBhbGwgY2FsbGJhY2tzIGF0dGFjaGVkIHRvIGVuZCBldmVudDpcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNhbGxiYWNrKCdlbmQnKTtcbiAgICAgKlxuICAgICAqIC8vIFJlbW92ZSBteUZ1bmN0aW9uMiBmcm9tIGJlaW5nIGNhbGxlZCBvbiBzdGFydDpcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNhbGxiYWNrKCdzdGFydCcsIG15RnVuY3Rpb24yKTtcbiAgICAgKlxuICAgICAqIC8vIFJlbW92ZSBteUZ1bmN0aW9uMSBmcm9tIGJlaW5nIGNhbGxlZCBvbiBhbGwgZXZlbnRzOlxuICAgICAqIGFubnlhbmcucmVtb3ZlQ2FsbGJhY2sodW5kZWZpbmVkLCBteUZ1bmN0aW9uMSk7XG4gICAgICogYGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHR5cGUgTmFtZSBvZiBldmVudCB0eXBlIHRvIHJlbW92ZSBjYWxsYmFjayBmcm9tXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIFRoZSBjYWxsYmFjayBmdW5jdGlvbiB0byByZW1vdmVcbiAgICAgKiBAcmV0dXJucyB1bmRlZmluZWRcbiAgICAgKiBAbWV0aG9kIHJlbW92ZUNhbGxiYWNrXG4gICAgICovXG4gICAgcmVtb3ZlQ2FsbGJhY2s6IGZ1bmN0aW9uKHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgY29tcGFyZVdpdGhDYWxsYmFja1BhcmFtZXRlciA9IGZ1bmN0aW9uKGNiKSB7XG4gICAgICAgIHJldHVybiBjYi5jYWxsYmFjayAhPT0gY2FsbGJhY2s7XG4gICAgICB9O1xuICAgICAgLy8gR28gb3ZlciBlYWNoIGNhbGxiYWNrIHR5cGUgaW4gY2FsbGJhY2tzIHN0b3JlIG9iamVjdFxuICAgICAgZm9yICh2YXIgY2FsbGJhY2tUeXBlIGluIGNhbGxiYWNrcykge1xuICAgICAgICBpZiAoY2FsbGJhY2tzLmhhc093blByb3BlcnR5KGNhbGxiYWNrVHlwZSkpIHtcbiAgICAgICAgICAvLyBpZiB0aGlzIGlzIHRoZSB0eXBlIHVzZXIgYXNrZWQgdG8gZGVsZXRlLCBvciBoZSBhc2tlZCB0byBkZWxldGUgYWxsLCBnbyBhaGVhZC5cbiAgICAgICAgICBpZiAodHlwZSA9PT0gdW5kZWZpbmVkIHx8IHR5cGUgPT09IGNhbGxiYWNrVHlwZSkge1xuICAgICAgICAgICAgLy8gSWYgdXNlciBhc2tlZCB0byBkZWxldGUgYWxsIGNhbGxiYWNrcyBpbiB0aGlzIHR5cGUgb3IgYWxsIHR5cGVzXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2sgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIGNhbGxiYWNrc1tjYWxsYmFja1R5cGVdID0gW107XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gUmVtb3ZlIGFsbCBtYXRjaGluZyBjYWxsYmFja3NcbiAgICAgICAgICAgICAgICBjYWxsYmFja3NbY2FsbGJhY2tUeXBlXSA9IGNhbGxiYWNrc1tjYWxsYmFja1R5cGVdLmZpbHRlcihjb21wYXJlV2l0aENhbGxiYWNrUGFyYW1ldGVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0cnVlIGlmIHNwZWVjaCByZWNvZ25pdGlvbiBpcyBjdXJyZW50bHkgb24uXG4gICAgICogUmV0dXJucyBmYWxzZSBpZiBzcGVlY2ggcmVjb2duaXRpb24gaXMgb2ZmIG9yIGFubnlhbmcgaXMgcGF1c2VkLlxuICAgICAqXG4gICAgICogQHJldHVybiBib29sZWFuIHRydWUgPSBTcGVlY2hSZWNvZ25pdGlvbiBpcyBvbiBhbmQgYW5ueWFuZyBpcyBsaXN0ZW5pbmdcbiAgICAgKiBAbWV0aG9kIGlzTGlzdGVuaW5nXG4gICAgICovXG4gICAgaXNMaXN0ZW5pbmc6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIGlzTGlzdGVuaW5nICYmICFwYXVzZUxpc3RlbmluZztcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgaW5zdGFuY2Ugb2YgdGhlIGJyb3dzZXIncyBTcGVlY2hSZWNvZ25pdGlvbiBvYmplY3QgdXNlZCBieSBhbm55YW5nLlxuICAgICAqIFVzZWZ1bCBpbiBjYXNlIHlvdSB3YW50IGRpcmVjdCBhY2Nlc3MgdG8gdGhlIGJyb3dzZXIncyBTcGVlY2ggUmVjb2duaXRpb24gZW5naW5lLlxuICAgICAqXG4gICAgICogQHJldHVybnMgU3BlZWNoUmVjb2duaXRpb24gVGhlIGJyb3dzZXIncyBTcGVlY2ggUmVjb2duaXplciBjdXJyZW50bHkgdXNlZCBieSBhbm55YW5nXG4gICAgICogQG1ldGhvZCBnZXRTcGVlY2hSZWNvZ25pemVyXG4gICAgICovXG4gICAgZ2V0U3BlZWNoUmVjb2duaXplcjogZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gcmVjb2duaXRpb247XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFNpbXVsYXRlIHNwZWVjaCBiZWluZyByZWNvZ25pemVkLiBUaGlzIHdpbGwgdHJpZ2dlciB0aGUgc2FtZSBldmVudHMgYW5kIGJlaGF2aW9yIGFzIHdoZW4gdGhlIFNwZWVjaCBSZWNvZ25pdGlvblxuICAgICAqIGRldGVjdHMgc3BlZWNoLlxuICAgICAqXG4gICAgICogQ2FuIGFjY2VwdCBlaXRoZXIgYSBzdHJpbmcgY29udGFpbmluZyBhIHNpbmdsZSBzZW50ZW5jZSwgb3IgYW4gYXJyYXkgY29udGFpbmluZyBtdWx0aXBsZSBzZW50ZW5jZXMgdG8gYmUgY2hlY2tlZFxuICAgICAqIGluIG9yZGVyIHVudGlsIG9uZSBvZiB0aGVtIG1hdGNoZXMgYSBjb21tYW5kIChzaW1pbGFyIHRvIHRoZSB3YXkgU3BlZWNoIFJlY29nbml0aW9uIEFsdGVybmF0aXZlcyBhcmUgcGFyc2VkKVxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIGFubnlhbmcudHJpZ2dlcignVGltZSBmb3Igc29tZSB0aHJpbGxpbmcgaGVyb2ljcycpO1xuICAgICAqIGFubnlhbmcudHJpZ2dlcihcbiAgICAgKiAgICAgWydUaW1lIGZvciBzb21lIHRocmlsbGluZyBoZXJvaWNzJywgJ1RpbWUgZm9yIHNvbWUgdGhyaWxsaW5nIGFlcm9iaWNzJ11cbiAgICAgKiAgICk7XG4gICAgICogYGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHN0cmluZ3xhcnJheSBzZW50ZW5jZXMgQSBzZW50ZW5jZSBhcyBhIHN0cmluZyBvciBhbiBhcnJheSBvZiBzdHJpbmdzIG9mIHBvc3NpYmxlIHNlbnRlbmNlc1xuICAgICAqIEByZXR1cm5zIHVuZGVmaW5lZFxuICAgICAqIEBtZXRob2QgdHJpZ2dlclxuICAgICAqL1xuICAgIHRyaWdnZXI6IGZ1bmN0aW9uKHNlbnRlbmNlcykge1xuICAgICAgLypcbiAgICAgIGlmKCFhbm55YW5nLmlzTGlzdGVuaW5nKCkpIHtcbiAgICAgICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgICAgICBpZiAoIWlzTGlzdGVuaW5nKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnQ2Fubm90IHRyaWdnZXIgd2hpbGUgYW5ueWFuZyBpcyBhYm9ydGVkJyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdTcGVlY2ggaGVhcmQsIGJ1dCBhbm55YW5nIGlzIHBhdXNlZCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICAqL1xuXG4gICAgICBpZiAoIUFycmF5LmlzQXJyYXkoc2VudGVuY2VzKSkge1xuICAgICAgICBzZW50ZW5jZXMgPSBbc2VudGVuY2VzXTtcbiAgICAgIH1cblxuICAgICAgcGFyc2VSZXN1bHRzKHNlbnRlbmNlcyk7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBhbm55YW5nO1xuXG59KSk7XG5cbi8qKlxuICogIyBHb29kIHRvIEtub3dcbiAqXG4gKiAjIyBDb21tYW5kcyBPYmplY3RcbiAqXG4gKiBCb3RoIHRoZSBbaW5pdCgpXSgpIGFuZCBhZGRDb21tYW5kcygpIG1ldGhvZHMgcmVjZWl2ZSBhIGBjb21tYW5kc2Agb2JqZWN0LlxuICpcbiAqIGFubnlhbmcgdW5kZXJzdGFuZHMgY29tbWFuZHMgd2l0aCBgbmFtZWQgdmFyaWFibGVzYCwgYHNwbGF0c2AsIGFuZCBgb3B0aW9uYWwgd29yZHNgLlxuICpcbiAqICogVXNlIGBuYW1lZCB2YXJpYWJsZXNgIGZvciBvbmUgd29yZCBhcmd1bWVudHMgaW4geW91ciBjb21tYW5kLlxuICogKiBVc2UgYHNwbGF0c2AgdG8gY2FwdHVyZSBtdWx0aS13b3JkIHRleHQgYXQgdGhlIGVuZCBvZiB5b3VyIGNvbW1hbmQgKGdyZWVkeSkuXG4gKiAqIFVzZSBgb3B0aW9uYWwgd29yZHNgIG9yIHBocmFzZXMgdG8gZGVmaW5lIGEgcGFydCBvZiB0aGUgY29tbWFuZCBhcyBvcHRpb25hbC5cbiAqXG4gKiAjIyMjIEV4YW1wbGVzOlxuICogYGBgYGh0bWxcbiAqIDxzY3JpcHQ+XG4gKiB2YXIgY29tbWFuZHMgPSB7XG4gKiAgIC8vIGFubnlhbmcgd2lsbCBjYXB0dXJlIGFueXRoaW5nIGFmdGVyIGEgc3BsYXQgKCopIGFuZCBwYXNzIGl0IHRvIHRoZSBmdW5jdGlvbi5cbiAqICAgLy8gZS5nLiBzYXlpbmcgXCJTaG93IG1lIEJhdG1hbiBhbmQgUm9iaW5cIiB3aWxsIGNhbGwgc2hvd0ZsaWNrcignQmF0bWFuIGFuZCBSb2JpbicpO1xuICogICAnc2hvdyBtZSAqdGFnJzogc2hvd0ZsaWNrcixcbiAqXG4gKiAgIC8vIEEgbmFtZWQgdmFyaWFibGUgaXMgYSBvbmUgd29yZCB2YXJpYWJsZSwgdGhhdCBjYW4gZml0IGFueXdoZXJlIGluIHlvdXIgY29tbWFuZC5cbiAqICAgLy8gZS5nLiBzYXlpbmcgXCJjYWxjdWxhdGUgT2N0b2JlciBzdGF0c1wiIHdpbGwgY2FsbCBjYWxjdWxhdGVTdGF0cygnT2N0b2JlcicpO1xuICogICAnY2FsY3VsYXRlIDptb250aCBzdGF0cyc6IGNhbGN1bGF0ZVN0YXRzLFxuICpcbiAqICAgLy8gQnkgZGVmaW5pbmcgYSBwYXJ0IG9mIHRoZSBmb2xsb3dpbmcgY29tbWFuZCBhcyBvcHRpb25hbCwgYW5ueWFuZyB3aWxsIHJlc3BvbmRcbiAqICAgLy8gdG8gYm90aDogXCJzYXkgaGVsbG8gdG8gbXkgbGl0dGxlIGZyaWVuZFwiIGFzIHdlbGwgYXMgXCJzYXkgaGVsbG8gZnJpZW5kXCJcbiAqICAgJ3NheSBoZWxsbyAodG8gbXkgbGl0dGxlKSBmcmllbmQnOiBncmVldGluZ1xuICogfTtcbiAqXG4gKiB2YXIgc2hvd0ZsaWNrciA9IGZ1bmN0aW9uKHRhZykge1xuICogICB2YXIgdXJsID0gJ2h0dHA6Ly9hcGkuZmxpY2tyLmNvbS9zZXJ2aWNlcy9yZXN0Lz90YWdzPScrdGFnO1xuICogICAkLmdldEpTT04odXJsKTtcbiAqIH1cbiAqXG4gKiB2YXIgY2FsY3VsYXRlU3RhdHMgPSBmdW5jdGlvbihtb250aCkge1xuICogICAkKCcjc3RhdHMnKS50ZXh0KCdTdGF0aXN0aWNzIGZvciAnK21vbnRoKTtcbiAqIH1cbiAqXG4gKiB2YXIgZ3JlZXRpbmcgPSBmdW5jdGlvbigpIHtcbiAqICAgJCgnI2dyZWV0aW5nJykudGV4dCgnSGVsbG8hJyk7XG4gKiB9XG4gKiA8L3NjcmlwdD5cbiAqIGBgYGBcbiAqXG4gKiAjIyMgVXNpbmcgUmVndWxhciBFeHByZXNzaW9ucyBpbiBjb21tYW5kc1xuICogRm9yIGFkdmFuY2VkIGNvbW1hbmRzLCB5b3UgY2FuIHBhc3MgYSByZWd1bGFyIGV4cHJlc3Npb24gb2JqZWN0LCBpbnN0ZWFkIG9mXG4gKiBhIHNpbXBsZSBzdHJpbmcgY29tbWFuZC5cbiAqXG4gKiBUaGlzIGlzIGRvbmUgYnkgcGFzc2luZyBhbiBvYmplY3QgY29udGFpbmluZyB0d28gcHJvcGVydGllczogYHJlZ2V4cGAsIGFuZFxuICogYGNhbGxiYWNrYCBpbnN0ZWFkIG9mIHRoZSBmdW5jdGlvbi5cbiAqXG4gKiAjIyMjIEV4YW1wbGVzOlxuICogYGBgYGphdmFzY3JpcHRcbiAqIHZhciBjYWxjdWxhdGVGdW5jdGlvbiA9IGZ1bmN0aW9uKG1vbnRoKSB7IGNvbnNvbGUubG9nKG1vbnRoKTsgfVxuICogdmFyIGNvbW1hbmRzID0ge1xuICogICAvLyBUaGlzIGV4YW1wbGUgd2lsbCBhY2NlcHQgYW55IHdvcmQgYXMgdGhlIFwibW9udGhcIlxuICogICAnY2FsY3VsYXRlIDptb250aCBzdGF0cyc6IGNhbGN1bGF0ZUZ1bmN0aW9uLFxuICogICAvLyBUaGlzIGV4YW1wbGUgd2lsbCBvbmx5IGFjY2VwdCBtb250aHMgd2hpY2ggYXJlIGF0IHRoZSBzdGFydCBvZiBhIHF1YXJ0ZXJcbiAqICAgJ2NhbGN1bGF0ZSA6cXVhcnRlciBzdGF0cyc6IHsncmVnZXhwJzogL15jYWxjdWxhdGUgKEphbnVhcnl8QXByaWx8SnVseXxPY3RvYmVyKSBzdGF0cyQvLCAnY2FsbGJhY2snOiBjYWxjdWxhdGVGdW5jdGlvbn1cbiAqIH1cbiBgYGBgXG4gKlxuICogIyMgTGFuZ3VhZ2VzXG4gKlxuICogV2hpbGUgdGhlcmUgaXNuJ3QgYW4gb2ZmaWNpYWwgbGlzdCBvZiBzdXBwb3J0ZWQgbGFuZ3VhZ2VzIChjdWx0dXJlcz8gbG9jYWxlcz8pLCBoZXJlIGlzIGEgbGlzdCBiYXNlZCBvbiBbYW5lY2RvdGFsIGV2aWRlbmNlXShodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8xNDMwMjEzNC8zMzgwMzkpLlxuICpcbiAqICogQWZyaWthYW5zIGBhZmBcbiAqICogQmFzcXVlIGBldWBcbiAqICogQnVsZ2FyaWFuIGBiZ2BcbiAqICogQ2F0YWxhbiBgY2FgXG4gKiAqIEFyYWJpYyAoRWd5cHQpIGBhci1FR2BcbiAqICogQXJhYmljIChKb3JkYW4pIGBhci1KT2BcbiAqICogQXJhYmljIChLdXdhaXQpIGBhci1LV2BcbiAqICogQXJhYmljIChMZWJhbm9uKSBgYXItTEJgXG4gKiAqIEFyYWJpYyAoUWF0YXIpIGBhci1RQWBcbiAqICogQXJhYmljIChVQUUpIGBhci1BRWBcbiAqICogQXJhYmljIChNb3JvY2NvKSBgYXItTUFgXG4gKiAqIEFyYWJpYyAoSXJhcSkgYGFyLUlRYFxuICogKiBBcmFiaWMgKEFsZ2VyaWEpIGBhci1EWmBcbiAqICogQXJhYmljIChCYWhyYWluKSBgYXItQkhgXG4gKiAqIEFyYWJpYyAoTHliaWEpIGBhci1MWWBcbiAqICogQXJhYmljIChPbWFuKSBgYXItT01gXG4gKiAqIEFyYWJpYyAoU2F1ZGkgQXJhYmlhKSBgYXItU0FgXG4gKiAqIEFyYWJpYyAoVHVuaXNpYSkgYGFyLVROYFxuICogKiBBcmFiaWMgKFllbWVuKSBgYXItWUVgXG4gKiAqIEN6ZWNoIGBjc2BcbiAqICogRHV0Y2ggYG5sLU5MYFxuICogKiBFbmdsaXNoIChBdXN0cmFsaWEpIGBlbi1BVWBcbiAqICogRW5nbGlzaCAoQ2FuYWRhKSBgZW4tQ0FgXG4gKiAqIEVuZ2xpc2ggKEluZGlhKSBgZW4tSU5gXG4gKiAqIEVuZ2xpc2ggKE5ldyBaZWFsYW5kKSBgZW4tTlpgXG4gKiAqIEVuZ2xpc2ggKFNvdXRoIEFmcmljYSkgYGVuLVpBYFxuICogKiBFbmdsaXNoKFVLKSBgZW4tR0JgXG4gKiAqIEVuZ2xpc2goVVMpIGBlbi1VU2BcbiAqICogRmlubmlzaCBgZmlgXG4gKiAqIEZyZW5jaCBgZnItRlJgXG4gKiAqIEdhbGljaWFuIGBnbGBcbiAqICogR2VybWFuIGBkZS1ERWBcbiAqICogSGVicmV3IGBoZWBcbiAqICogSHVuZ2FyaWFuIGBodWBcbiAqICogSWNlbGFuZGljIGBpc2BcbiAqICogSXRhbGlhbiBgaXQtSVRgXG4gKiAqIEluZG9uZXNpYW4gYGlkYFxuICogKiBKYXBhbmVzZSBgamFgXG4gKiAqIEtvcmVhbiBga29gXG4gKiAqIExhdGluIGBsYWBcbiAqICogTWFuZGFyaW4gQ2hpbmVzZSBgemgtQ05gXG4gKiAqIFRyYWRpdGlvbmFsIFRhaXdhbiBgemgtVFdgXG4gKiAqIFNpbXBsaWZpZWQgQ2hpbmEgemgtQ04gYD9gXG4gKiAqIFNpbXBsaWZpZWQgSG9uZyBLb25nIGB6aC1IS2BcbiAqICogWXVlIENoaW5lc2UgKFRyYWRpdGlvbmFsIEhvbmcgS29uZykgYHpoLXl1ZWBcbiAqICogTWFsYXlzaWFuIGBtcy1NWWBcbiAqICogTm9yd2VnaWFuIGBuby1OT2BcbiAqICogUG9saXNoIGBwbGBcbiAqICogUGlnIExhdGluIGB4eC1waWdsYXRpbmBcbiAqICogUG9ydHVndWVzZSBgcHQtUFRgXG4gKiAqIFBvcnR1Z3Vlc2UgKEJyYXNpbCkgYHB0LUJSYFxuICogKiBSb21hbmlhbiBgcm8tUk9gXG4gKiAqIFJ1c3NpYW4gYHJ1YFxuICogKiBTZXJiaWFuIGBzci1TUGBcbiAqICogU2xvdmFrIGBza2BcbiAqICogU3BhbmlzaCAoQXJnZW50aW5hKSBgZXMtQVJgXG4gKiAqIFNwYW5pc2ggKEJvbGl2aWEpIGBlcy1CT2BcbiAqICogU3BhbmlzaCAoQ2hpbGUpIGBlcy1DTGBcbiAqICogU3BhbmlzaCAoQ29sb21iaWEpIGBlcy1DT2BcbiAqICogU3BhbmlzaCAoQ29zdGEgUmljYSkgYGVzLUNSYFxuICogKiBTcGFuaXNoIChEb21pbmljYW4gUmVwdWJsaWMpIGBlcy1ET2BcbiAqICogU3BhbmlzaCAoRWN1YWRvcikgYGVzLUVDYFxuICogKiBTcGFuaXNoIChFbCBTYWx2YWRvcikgYGVzLVNWYFxuICogKiBTcGFuaXNoIChHdWF0ZW1hbGEpIGBlcy1HVGBcbiAqICogU3BhbmlzaCAoSG9uZHVyYXMpIGBlcy1ITmBcbiAqICogU3BhbmlzaCAoTWV4aWNvKSBgZXMtTVhgXG4gKiAqIFNwYW5pc2ggKE5pY2FyYWd1YSkgYGVzLU5JYFxuICogKiBTcGFuaXNoIChQYW5hbWEpIGBlcy1QQWBcbiAqICogU3BhbmlzaCAoUGFyYWd1YXkpIGBlcy1QWWBcbiAqICogU3BhbmlzaCAoUGVydSkgYGVzLVBFYFxuICogKiBTcGFuaXNoIChQdWVydG8gUmljbykgYGVzLVBSYFxuICogKiBTcGFuaXNoIChTcGFpbikgYGVzLUVTYFxuICogKiBTcGFuaXNoIChVUykgYGVzLVVTYFxuICogKiBTcGFuaXNoIChVcnVndWF5KSBgZXMtVVlgXG4gKiAqIFNwYW5pc2ggKFZlbmV6dWVsYSkgYGVzLVZFYFxuICogKiBTd2VkaXNoIGBzdi1TRWBcbiAqICogVHVya2lzaCBgdHJgXG4gKiAqIFp1bHUgYHp1YFxuICpcbiAqICMjIERldmVsb3BpbmdcbiAqXG4gKiBQcmVyZXF1aXNpdGllczogbm9kZS5qc1xuICpcbiAqIEZpcnN0LCBpbnN0YWxsIGRlcGVuZGVuY2llcyBpbiB5b3VyIGxvY2FsIGFubnlhbmcgY29weTpcbiAqXG4gKiAgICAgbnBtIGluc3RhbGxcbiAqXG4gKiBNYWtlIHN1cmUgdG8gcnVuIHRoZSBkZWZhdWx0IGdydW50IHRhc2sgYWZ0ZXIgZWFjaCBjaGFuZ2UgdG8gYW5ueWFuZy5qcy4gVGhpcyBjYW4gYWxzbyBiZSBkb25lIGF1dG9tYXRpY2FsbHkgYnkgcnVubmluZzpcbiAqXG4gKiAgICAgZ3J1bnQgd2F0Y2hcbiAqXG4gKiBZb3UgY2FuIGFsc28gcnVuIGEgbG9jYWwgc2VydmVyIGZvciB0ZXN0aW5nIHlvdXIgd29yayB3aXRoOlxuICpcbiAqICAgICBncnVudCBkZXZcbiAqXG4gKiBQb2ludCB5b3VyIGJyb3dzZXIgdG8gYGh0dHBzOi8vbG9jYWxob3N0Ojg0NDMvZGVtby9gIHRvIHNlZSB0aGUgZGVtbyBwYWdlLlxuICogU2luY2UgaXQncyB1c2luZyBzZWxmLXNpZ25lZCBjZXJ0aWZpY2F0ZSwgeW91IG1pZ2h0IG5lZWQgdG8gY2xpY2sgKlwiUHJvY2VlZCBBbnl3YXlcIiouXG4gKlxuICogRm9yIG1vcmUgaW5mbywgY2hlY2sgb3V0IHRoZSBbQ09OVFJJQlVUSU5HXShodHRwczovL2dpdGh1Yi5jb20vVGFsQXRlci9hbm55YW5nL2Jsb2IvbWFzdGVyL0NPTlRSSUJVVElORy5tZCkgZmlsZVxuICpcbiAqL1xuIiwiLy8gRlVOQ1RJT05TIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbi8vOjogYSAtPiBhXG5jb25zdCB0cmFjZSA9ICh4KSA9PiB7XG4gIGNvbnNvbGUubG9nKHgpXG4gIHJldHVybiB4XG59XG5cbi8vOjogT2JqZWN0IC0+IFt2XVxuY29uc3Qgb2JqZWN0VmFsdWVzID0gKG9iaikgPT4ge1xuICByZXR1cm4gUmVmbGVjdC5vd25LZXlzKG9iaikubWFwKGtleSA9PiBvYmpba2V5XSlcbn1cblxuLy86OiAoKGEsIGIsIC4uLiAtPiBlKSwgKGUgLT4gZiksIC4uLiwgKHkgLT4geikpIC0+IChhLCBiLCAuLi4pIC0+IHpcbmNvbnN0IHBpcGUgPSAoLi4uZm5zKSA9PiAoLi4ueHMpID0+IHtcbiAgcmV0dXJuIGZuc1xuICAgIC5zbGljZSgxKVxuICAgIC5yZWR1Y2UoKHgsIGZuKSA9PiBmbih4KSwgZm5zWzBdKC4uLnhzKSlcbn1cbmNvbnN0IHBpcGVQID0gKC4uLmZucykgPT4gKC4uLnhzKSA9PiB7XG4gIHJldHVybiBmbnNcbiAgICAuc2xpY2UoMSlcbiAgICAucmVkdWNlKCh4UCwgZm4pID0+IHhQLnRoZW4oZm4pLCBQcm9taXNlLnJlc29sdmUoZm5zWzBdKC4uLnhzKSkpXG59XG5cbi8vOjogU3RyaW5nIC0+IE9iamVjdCAtPiBhXG5jb25zdCBwcm9wID0gKHN0cikgPT4gKG9iaikgPT4ge1xuICByZXR1cm4gb2JqW3N0cl1cbn1cblxuLy86OiBTdHJpbmcgLT4gW2FdIC0+IFtNYXliZV1cbmNvbnN0IHBsdWNrID0gKHN0cikgPT4gKHhzKSA9PiB7XG4gIHJldHVybiBtYXAocHJvcChzdHIpKSh4cylcbn1cblxuLy86OiBhIC0+IGEgLT4gQm9vbGVhblxuY29uc3QgaXMgPSAodGVzdF92YWx1ZSkgPT4gKHZhbHVlKSA9PiB7XG4gIHJldHVybiB2YWx1ZSA9PT0gdGVzdF92YWx1ZVxufVxuXG4vLzo6IChhIC0+IGIpIC0+IFthXSAtPiBbYl1cbmNvbnN0IG1hcCA9IChmbikgPT4gKGYpID0+IHtcbiAgcmV0dXJuIGYubWFwKGZuKVxufVxuXG4vLzo6IChhIC0+IGIpIC0+IFthXSAtPiBbYl1cbmNvbnN0IGZpbHRlciA9IChmbikgPT4gKHhzKSA9PiB7XG4gIHJldHVybiB4cy5maWx0ZXIoZm4pXG59XG4vLzo6IFthXSAtPiBbYV0gLT4gW2FdXG5jb25zdCBpbnRlcnNlY3Rpb24gPSAoeHMpID0+ICh4czIpID0+IHtcbiAgcmV0dXJuIHhzLmZpbHRlcih4ID0+IHhzMi5pbmNsdWRlcyh4KSlcbn1cblxuLy86OiBbYV0gLT4gW2FdIC0+IFthXVxuY29uc3QgZGlmZmVyZW5jZSA9ICh4cykgPT4gKHhzMikgPT4ge1xuICByZXR1cm4geHMuZmlsdGVyKHggPT4gIXhzMi5pbmNsdWRlcyh4KSlcbn1cblxuLy86OiBbKGEsIGIsIC4uLikgLT4gbl0gLT4gW2EsIGIsIC4uLl0gLT4gW25dXG5jb25zdCBhcHBseUZ1bmN0aW9ucyA9IChmbnMpID0+ICh4cykgPT4ge1xuICByZXR1cm4gZm5zLm1hcChmbiA9PlxuICAgIHhzLnNsaWNlKDEpLnJlZHVjZSgocGFydGlhbCwgeCkgPT4gcGFydGlhbCh4KSwgZm4oeHNbMF0pKSlcbn1cblxuLy86OiBbYV0gLT4gYVxuY29uc3QgbGFzdCA9ICh4cykgPT4ge1xuICByZXR1cm4geHNbeHMubGVuZ3RoIC0gMV1cbn1cblxuLy86OiAoYSAtPiBiIC0+IGMpIC0+IGIgLT4gYSAtPiBjXG5jb25zdCBmbGlwID0gKGZuKSA9PiAoYikgPT4gKGEpID0+IHtcbiAgcmV0dXJuIGZuKGEpKGIpXG59XG5cbmNvbnN0IGN1cnJ5ID0gKGZuKSA9PiB7XG4gIHZhciBfYXJncyA9IFtdXG4gIGNvbnN0IGNvdW50QXJncyA9ICguLi54cykgPT4ge1xuICAgIF9hcmdzID0gX2FyZ3MuY29uY2F0KHhzKVxuICAgIHJldHVybiAoX2FyZ3MubGVuZ3RoID49IGZuLmxlbmd0aClcbiAgICAgID8gZm4uYXBwbHkodGhpcywgX2FyZ3MpXG4gICAgICA6IGNvdW50QXJnc1xuICB9XG4gIHJldHVybiBjb3VudEFyZ3Ncbn1cblxuLy86OiBJbnQgLT4gW2FdIC0+IGFcbmNvbnN0IG50aCA9IChuKSA9PiAoeHMpID0+IHtcbiAgcmV0dXJuIHhzW25dXG59XG5cbi8vOjogKGEgLT4gYSkgLT4gTnVtYmVyIC0+IFthXSAtPiBbYV1cbmNvbnN0IGFkanVzdCA9IChmbikgPT4gKGkpID0+IChsaXN0KSA9PiB7XG4gIHZhciBjb3B5ID0gbGlzdC5zbGljZSgpXG4gIGNvcHkuc3BsaWNlKGksIDEsIGZuKGxpc3RbaV0pKVxuICByZXR1cm4gY29weVxufVxuXG4vLzo6IE9iamVjdCAtPiBBcnJheVxuY29uc3QgdG9QYWlycyA9IChvYmopID0+IHtcbiAgcmV0dXJuIFJlZmxlY3Qub3duS2V5cyhvYmopLm1hcChrZXkgPT4gW2tleSwgb2JqW2tleV1dKVxufVxuXG4vLzo6IChhIC0+IEJvb2wpIC0+IChhIC0+IGIpIC0+IChhIC0+IGIpIC0+IGEgLT4gYlxuY29uc3QgaWZFbHNlID0gKHByZWRGbikgPT4gKHdoZW5UcnVlRm4pID0+ICh3aGVuRmFsc2VGbikgPT4gKGEpID0+e1xuICByZXR1cm4gcHJlZEZuKGEpXG4gICAgPyB3aGVuVHJ1ZUZuKGEpXG4gICAgOiB3aGVuRmFsc2VGbihhKVxufVxuXG5cbi8vIHRoaXMgaXNuJ3QgaW4gZXhwb3J0cywgaXQgaXMgdXNlZCBieSBJTy5zZXF1ZW5jZSAvLy8vLy8vLy8vLy8vL1xuY29uc3QgR2VuZXJhdG9yID0gT2JqZWN0LmZyZWV6ZSh7XG4gIC8vOjogKGEgLT4gYikgLT4gKEdlbmVyYXRvciAoW2FdIC0+IGIpKVxuICAvKiByZXR1cm5zIGEgZ2VuZXJhdG9yIHdoaWNoIHdpbGwgYXBwbHlcbiAgICAgYWN0aW9uIHRvIGVhIHZhbHVlIHNlcXVlbnRpYWxseSBpbiB4c1xuICAgKi9cbiAgc2VxKGFjdGlvbikge1xuICAgIHJldHVybiBmdW5jdGlvbiogYXBwbHlBY3Rpb24oeHMpIHtcbiAgICAgIGZvciAodmFyIHggb2YgeHMpIHtcbiAgICAgICAgeWllbGQgYWN0aW9uKHgpXG4gICAgICB9XG4gICAgfVxuICB9LFxuICAvLzo6IEdlbmVyYXRvciAtPiBfXG4gIC8qIGF1dG9tYXRpY2FsbHkgc3RlcHMgZ2VuZXJhdG9yIGV2ZXJ5IH54IG1zXG4gICAgIHVudGlsIHRoZSBnZW5lcmF0b3IgaXMgZXhoYXVzdGVkXG4gICAqL1xuICBhdXRvOiAobXMpID0+IChnZW4pID0+IHtcbiAgICBpZiAoIWdlbi5uZXh0KCkuZG9uZSkge1xuICAgICAgc2V0VGltZW91dCgoKSA9PiBHZW5lcmF0b3IuYXV0byhtcykoZ2VuKSwgbXMpXG4gICAgfVxuICB9XG59KVxuXG5cbi8vIE1PTkFEUyAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbi8vIE1heWJlIHR5cGVcbmNvbnN0IE1heWJlID0gKCgpID0+IHtcbiAgY29uc3QgbmV3TSA9ICh0eXBlKSA9PiAodmFsdWUpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZShPYmplY3QuY3JlYXRlKHR5cGUsIHsgX192YWx1ZTogeyB2YWx1ZTogdmFsdWUgfX0pKVxuICB9XG5cbiAgY29uc3QgTm90aGluZyA9IE9iamVjdC5mcmVlemUoe1xuICAgIG1hcChfKSB7XG4gICAgICByZXR1cm4gbmV3TShOb3RoaW5nKShudWxsKVxuICAgIH0sXG4gICAgaXNOb3RoaW5nOiB0cnVlLFxuICAgIGlzSnVzdDogZmFsc2VcbiAgfSlcblxuICBjb25zdCBKdXN0ID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgbWFwKGZuKSB7XG4gICAgICByZXR1cm4gbmV3TShKdXN0KShmbih0aGlzLl9fdmFsdWUpKVxuICAgIH0sXG4gICAgaXNOb3RoaW5nOiBmYWxzZSxcbiAgICBpc0p1c3Q6IHRydWVcbiAgfSlcblxuICBjb25zdCBNYXliZSA9ICh4KSA9PiB7XG4gICAgcmV0dXJuICh4ID09IG51bGwpXG4gICAgICA/IG5ld00oTm90aGluZykobnVsbClcbiAgICAgIDogbmV3TShKdXN0KSh4KVxuICB9XG5cbiAgTWF5YmUuaXNOb3RoaW5nID0gKE0pID0+IHtcbiAgICByZXR1cm4gTm90aGluZy5pc1Byb3RvdHlwZU9mKE0pXG4gIH1cblxuICBNYXliZS5pc0p1c3QgPSAoTSkgPT4ge1xuICAgIHJldHVybiBKdXN0LmlzUHJvdG90eXBlT2YoTSlcbiAgfVxuXG4gIHJldHVybiBPYmplY3QuZnJlZXplKE1heWJlKVxufSkoKVxuXG4vLyBFaXRoZXIgdHlwZVxuY29uc3QgRWl0aGVyID0gKCgpID0+IHtcbiAgY29uc3QgbmV3RSA9ICh0eXBlKSA9PiAodmFsdWUpID0+IHtcbiAgICByZXR1cm4gT2JqZWN0LmZyZWV6ZShPYmplY3QuY3JlYXRlKHR5cGUsIHsgX192YWx1ZTogeyB2YWx1ZTogdmFsdWUgfSB9KSlcbiAgfVxuXG4gIGNvbnN0IExlZnQgPSBPYmplY3QuZnJlZXplKHtcbiAgICBtYXAoXykge1xuICAgICAgcmV0dXJuIHRoaXNcbiAgICB9LFxuICAgIGJpbWFwKGZuKSB7XG4gICAgICBjb25zdCBtZSA9IHRoaXNcbiAgICAgIHJldHVybiAoXykgPT4ge1xuICAgICAgICByZXR1cm4gbmV3RShMZWZ0KShmbihtZS5fX3ZhbHVlKSlcbiAgICAgIH1cbiAgICB9LFxuICAgIGNoYWluKGZuKSB7XG4gICAgICByZXR1cm4gdGhpc1xuICAgIH0sXG4gICAgaXNMZWZ0OiB0cnVlLFxuICAgIGlzUmlnaHQ6IGZhbHNlXG4gIH0pXG5cbiAgY29uc3QgUmlnaHQgPSBPYmplY3QuZnJlZXplKHtcbiAgICBtYXAoZm4pIHtcbiAgICAgIHJldHVybiBuZXdFKFJpZ2h0KShmbih0aGlzLl9fdmFsdWUpKVxuICAgIH0sXG4gICAgYmltYXAoXykge1xuICAgICAgY29uc3QgbWUgPSB0aGlzXG4gICAgICByZXR1cm4gKGZuKSA9PiB7XG4gICAgICAgIHJldHVybiBtZS5tYXAoZm4pXG4gICAgICB9XG4gICAgfSxcbiAgICBjaGFpbihmbikge1xuICAgICAgcmV0dXJuIGZuKHRoaXMuX192YWx1ZSlcbiAgICB9LFxuICAgIGlzTGVmdDogZmFsc2UsXG4gICAgaXNSaWdodDogdHJ1ZVxuICB9KVxuXG4gIGNvbnN0IEVpdGhlciA9IE9iamVjdC5mcmVlemUoe1xuICAgIExlZnQoeCkge1xuICAgICAgcmV0dXJuIG5ld0UoTGVmdCkoeClcbiAgICB9LFxuICAgIFJpZ2h0KHgpIHtcbiAgICAgIHJldHVybiBuZXdFKFJpZ2h0KSh4KVxuICAgIH0sXG4gICAgaXNSaWdodChFKSB7XG4gICAgICByZXR1cm4gUmlnaHQuaXNQcm90b3R5cGVPZihFKVxuICAgIH0sXG4gICAgaXNMZWZ0KEUpIHtcbiAgICAgIHJldHVybiBMZWZ0LmlzUHJvdG90eXBlT2YoRSlcbiAgICB9LFxuICAgIGJpbWFwOiAobGVmdEZuKSA9PiAocmlnaHRGbikgPT4gKEUpID0+IHtcbiAgICAgIHJldHVybiBFLmJpbWFwKGxlZnRGbikocmlnaHRGbilcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIEVpdGhlclxufSkoKVxuXG4vLyBJTyB0eXBlXG5jb25zdCBJTyA9ICgoKSA9PiB7XG4gIGNvbnN0IG5ld19pbyA9IChmbikgPT4ge1xuICAgIHJldHVybiBPYmplY3QuZnJlZXplKE9iamVjdC5jcmVhdGUoaW8sIHsgX192YWx1ZTogeyB2YWx1ZTogZm4gfX0pKVxuICB9XG5cbiAgY29uc3QgaW8gPSB7XG4gICAgcnVuSU8odmFsdWUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9fdmFsdWUodmFsdWUpXG4gICAgfSxcbiAgICBtYXAoZm4pIHtcbiAgICAgIHJldHVybiBuZXdfaW8oKCkgPT4gZm4odGhpcy5fX3ZhbHVlKCkpKVxuICAgIH0sXG4gICAgam9pbigpIHtcbiAgICAgIHJldHVybiBuZXdfaW8oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5JTygpLnJ1bklPKClcbiAgICAgIH0pXG4gICAgfSxcbiAgICBjaGFpbihpb19yZXR1cm5pbmdfZm4pIHtcbiAgICAgIHJldHVybiB0aGlzLm1hcChpb19yZXR1cm5pbmdfZm4pLmpvaW4oKVxuICAgIH0sXG4gICAgYXAoaW9fdmFsdWUpIHtcbiAgICAgIHJldHVybiBpb192YWx1ZS5tYXAodGhpcy5fX3ZhbHVlKVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IElPID0gKGZuKSA9PiB7XG4gICAgaWYgKGZuIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJldHVybiBuZXdfaW8oZm4pXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElPIGNvbnN0cnVjdG9yIGV4cGVjdGVkIGluc3RhbmNlIG9mIEZ1bmN0aW9uYClcbiAgICB9XG4gIH1cblxuICBJTy5vZiA9ICh4KSA9PiB7XG4gICAgcmV0dXJuIG5ld19pbygoKSA9PiB4KVxuICB9XG5cbiAgSU8ucnVuID0gKGlvKSA9PiB7XG4gICAgcmV0dXJuIGlvLnJ1bklPKClcbiAgfVxuXG4gIC8vOjogKGEgLT4gYikgLT4gYSAtPiBJTyBiXG4gIElPLndyYXAgPSAoZm4pID0+IChfdmFsdWUpID0+IHtcbiAgICByZXR1cm4gSU8ub2YoX3ZhbHVlKS5tYXAoZm4pXG4gIH1cblxuICAvLzo6IFtJT10gLT4gSU8gX1xuICBJTy5zZXF1ZW5jZSA9IElPLndyYXAoXG4gICAgcGlwZShcbiAgICAgIEdlbmVyYXRvci5zZXEoSU8ucnVuKSxcbiAgICAgIEdlbmVyYXRvci5hdXRvKDApXG4gICAgKSlcblxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShJTylcbn0pKClcblxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgdHJhY2UsIHBpcGUsIHBpcGVQLCBtYXAsIGludGVyc2VjdGlvbiwgZGlmZmVyZW5jZSwgYXBwbHlGdW5jdGlvbnMsXG4gIGxhc3QsIGZsaXAsIGN1cnJ5LCBudGgsIGFkanVzdCwgdG9QYWlycywgaWZFbHNlLFxuICBNYXliZSwgRWl0aGVyLCBJTywgb2JqZWN0VmFsdWVzLCBwcm9wLCBwbHVjaywgaXMsIGZpbHRlclxufVxuXG5cbi8vIE9USEVSIElERUFTIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbmNvbnN0IHJlY3Vyc2VfcmVkdWNlID0gKGYpID0+IChhKSA9PiAoW3gsIC4uLnhzXSkgPT4ge1xuICByZXR1cm4geCA9PT0gdW5kZWZpbmVkID8gYSA6IHJlY3Vyc2VfcmVkdWNlKGYsIGYoYSwgeCksIHhzKVxufVxuXG5cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvZnV6enlzZXQuanMnKTtcbiIsIihmdW5jdGlvbigpIHtcblxudmFyIEZ1enp5U2V0ID0gZnVuY3Rpb24oYXJyLCB1c2VMZXZlbnNodGVpbiwgZ3JhbVNpemVMb3dlciwgZ3JhbVNpemVVcHBlcikge1xuICAgIHZhciBmdXp6eXNldCA9IHtcbiAgICAgICAgdmVyc2lvbjogJzAuMC4xJ1xuICAgIH07XG5cbiAgICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgICBhcnIgPSBhcnIgfHwgW107XG4gICAgZnV6enlzZXQuZ3JhbVNpemVMb3dlciA9IGdyYW1TaXplTG93ZXIgfHwgMjtcbiAgICBmdXp6eXNldC5ncmFtU2l6ZVVwcGVyID0gZ3JhbVNpemVVcHBlciB8fCAzO1xuICAgIGZ1enp5c2V0LnVzZUxldmVuc2h0ZWluID0gdXNlTGV2ZW5zaHRlaW4gfHwgdHJ1ZTtcblxuICAgIC8vIGRlZmluZSBhbGwgdGhlIG9iamVjdCBmdW5jdGlvbnMgYW5kIGF0dHJpYnV0ZXNcbiAgICBmdXp6eXNldC5leGFjdFNldCA9IHt9XG4gICAgZnV6enlzZXQubWF0Y2hEaWN0ID0ge307XG4gICAgZnV6enlzZXQuaXRlbXMgPSB7fTtcblxuICAgIC8vIGhlbHBlciBmdW5jdGlvbnNcbiAgICB2YXIgbGV2ZW5zaHRlaW4gPSBmdW5jdGlvbihzdHIxLCBzdHIyKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gW10sIHByZXYsIHZhbHVlO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDw9IHN0cjIubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8PSBzdHIxLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZiAoaSAmJiBqKVxuICAgICAgICAgICAgICAgIGlmIChzdHIxLmNoYXJBdChqIC0gMSkgPT09IHN0cjIuY2hhckF0KGkgLSAxKSlcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHByZXY7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHZhbHVlID0gTWF0aC5taW4oY3VycmVudFtqXSwgY3VycmVudFtqIC0gMV0sIHByZXYpICsgMTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGkgKyBqO1xuXG4gICAgICAgICAgICBwcmV2ID0gY3VycmVudFtqXTtcbiAgICAgICAgICAgIGN1cnJlbnRbal0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3VycmVudC5wb3AoKTtcbiAgICB9O1xuXG4gICAgLy8gcmV0dXJuIGFuIGVkaXQgZGlzdGFuY2UgZnJvbSAwIHRvIDFcbiAgICB2YXIgX2Rpc3RhbmNlID0gZnVuY3Rpb24oc3RyMSwgc3RyMikge1xuICAgICAgICBpZiAoc3RyMSA9PSBudWxsICYmIHN0cjIgPT0gbnVsbCkgdGhyb3cgJ1RyeWluZyB0byBjb21wYXJlIHR3byBudWxsIHZhbHVlcydcbiAgICAgICAgaWYgKHN0cjEgPT0gbnVsbCB8fCBzdHIyID09IG51bGwpIHJldHVybiAwO1xuICAgICAgICBzdHIxID0gU3RyaW5nKHN0cjEpOyBzdHIyID0gU3RyaW5nKHN0cjIpO1xuXG4gICAgICAgIHZhciBkaXN0YW5jZSA9IGxldmVuc2h0ZWluKHN0cjEsIHN0cjIpO1xuICAgICAgICBpZiAoc3RyMS5sZW5ndGggPiBzdHIyLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIDEgLSBkaXN0YW5jZSAvIHN0cjEubGVuZ3RoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIDEgLSBkaXN0YW5jZSAvIHN0cjIubGVuZ3RoO1xuICAgICAgICB9XG4gICAgfTtcbiAgICB2YXIgX25vbldvcmRSZSA9IC9bXlxcdywgXSsvO1xuXG4gICAgdmFyIF9pdGVyYXRlR3JhbXMgPSBmdW5jdGlvbih2YWx1ZSwgZ3JhbVNpemUpIHtcbiAgICAgICAgZ3JhbVNpemUgPSBncmFtU2l6ZSB8fCAyO1xuICAgICAgICB2YXIgc2ltcGxpZmllZCA9ICctJyArIHZhbHVlLnRvTG93ZXJDYXNlKCkucmVwbGFjZShfbm9uV29yZFJlLCAnJykgKyAnLScsXG4gICAgICAgICAgICBsZW5EaWZmID0gZ3JhbVNpemUgLSBzaW1wbGlmaWVkLmxlbmd0aCxcbiAgICAgICAgICAgIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgaWYgKGxlbkRpZmYgPiAwKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbkRpZmY7ICsraSkge1xuICAgICAgICAgICAgICAgIHZhbHVlICs9ICctJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNpbXBsaWZpZWQubGVuZ3RoIC0gZ3JhbVNpemUgKyAxOyArK2kpIHtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChzaW1wbGlmaWVkLnNsaWNlKGksIGkgKyBncmFtU2l6ZSkpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfTtcblxuICAgIHZhciBfZ3JhbUNvdW50ZXIgPSBmdW5jdGlvbih2YWx1ZSwgZ3JhbVNpemUpIHtcbiAgICAgICAgZ3JhbVNpemUgPSBncmFtU2l6ZSB8fCAyO1xuICAgICAgICB2YXIgcmVzdWx0ID0ge30sXG4gICAgICAgICAgICBncmFtcyA9IF9pdGVyYXRlR3JhbXModmFsdWUsIGdyYW1TaXplKSxcbiAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICBmb3IgKGk7IGkgPCBncmFtcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgaWYgKGdyYW1zW2ldIGluIHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtncmFtc1tpXV0gKz0gMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W2dyYW1zW2ldXSA9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgLy8gdGhlIG1haW4gZnVuY3Rpb25zXG4gICAgZnV6enlzZXQuZ2V0ID0gZnVuY3Rpb24odmFsdWUsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gdGhpcy5fZ2V0KHZhbHVlKTtcbiAgICAgICAgaWYgKCFyZXN1bHQgJiYgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGZ1enp5c2V0Ll9nZXQgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB2YXIgbm9ybWFsaXplZFZhbHVlID0gdGhpcy5fbm9ybWFsaXplU3RyKHZhbHVlKSxcbiAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuZXhhY3RTZXRbbm9ybWFsaXplZFZhbHVlXTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgcmV0dXJuIFtbMSwgcmVzdWx0XV07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgZ3JhbVNpemUgPSB0aGlzLmdyYW1TaXplVXBwZXI7IGdyYW1TaXplID4gdGhpcy5ncmFtU2l6ZUxvd2VyOyAtLWdyYW1TaXplKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gdGhpcy5fX2dldCh2YWx1ZSwgZ3JhbVNpemUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9O1xuXG4gICAgZnV6enlzZXQuX19nZXQgPSBmdW5jdGlvbih2YWx1ZSwgZ3JhbVNpemUpIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRWYWx1ZSA9IHRoaXMuX25vcm1hbGl6ZVN0cih2YWx1ZSksXG4gICAgICAgICAgICBtYXRjaGVzID0ge30sXG4gICAgICAgICAgICBncmFtQ291bnRzID0gX2dyYW1Db3VudGVyKG5vcm1hbGl6ZWRWYWx1ZSwgZ3JhbVNpemUpLFxuICAgICAgICAgICAgaXRlbXMgPSB0aGlzLml0ZW1zW2dyYW1TaXplXSxcbiAgICAgICAgICAgIHN1bU9mU3F1YXJlR3JhbUNvdW50cyA9IDAsXG4gICAgICAgICAgICBncmFtLFxuICAgICAgICAgICAgZ3JhbUNvdW50LFxuICAgICAgICAgICAgaSxcbiAgICAgICAgICAgIGluZGV4LFxuICAgICAgICAgICAgb3RoZXJHcmFtQ291bnQ7XG5cbiAgICAgICAgZm9yIChncmFtIGluIGdyYW1Db3VudHMpIHtcbiAgICAgICAgICAgIGdyYW1Db3VudCA9IGdyYW1Db3VudHNbZ3JhbV07XG4gICAgICAgICAgICBzdW1PZlNxdWFyZUdyYW1Db3VudHMgKz0gTWF0aC5wb3coZ3JhbUNvdW50LCAyKTtcbiAgICAgICAgICAgIGlmIChncmFtIGluIHRoaXMubWF0Y2hEaWN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMubWF0Y2hEaWN0W2dyYW1dLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ID0gdGhpcy5tYXRjaERpY3RbZ3JhbV1baV1bMF07XG4gICAgICAgICAgICAgICAgICAgIG90aGVyR3JhbUNvdW50ID0gdGhpcy5tYXRjaERpY3RbZ3JhbV1baV1bMV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCBpbiBtYXRjaGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVzW2luZGV4XSArPSBncmFtQ291bnQgKiBvdGhlckdyYW1Db3VudDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZXNbaW5kZXhdID0gZ3JhbUNvdW50ICogb3RoZXJHcmFtQ291bnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBpc0VtcHR5T2JqZWN0KG9iaikge1xuICAgICAgICAgICAgZm9yKHZhciBwcm9wIGluIG9iaikge1xuICAgICAgICAgICAgICAgIGlmKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNFbXB0eU9iamVjdChtYXRjaGVzKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdmVjdG9yTm9ybWFsID0gTWF0aC5zcXJ0KHN1bU9mU3F1YXJlR3JhbUNvdW50cyksXG4gICAgICAgICAgICByZXN1bHRzID0gW10sXG4gICAgICAgICAgICBtYXRjaFNjb3JlO1xuICAgICAgICAvLyBidWlsZCBhIHJlc3VsdHMgbGlzdCBvZiBbc2NvcmUsIHN0cl1cbiAgICAgICAgZm9yICh2YXIgbWF0Y2hJbmRleCBpbiBtYXRjaGVzKSB7XG4gICAgICAgICAgICBtYXRjaFNjb3JlID0gbWF0Y2hlc1ttYXRjaEluZGV4XTtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChbbWF0Y2hTY29yZSAvICh2ZWN0b3JOb3JtYWwgKiBpdGVtc1ttYXRjaEluZGV4XVswXSksIGl0ZW1zW21hdGNoSW5kZXhdWzFdXSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHNvcnREZXNjZW5kaW5nID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgICAgaWYgKGFbMF0gPCBiWzBdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFbMF0gPiBiWzBdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmVzdWx0cy5zb3J0KHNvcnREZXNjZW5kaW5nKTtcbiAgICAgICAgaWYgKHRoaXMudXNlTGV2ZW5zaHRlaW4pIHtcbiAgICAgICAgICAgIHZhciBuZXdSZXN1bHRzID0gW10sXG4gICAgICAgICAgICAgICAgZW5kSW5kZXggPSBNYXRoLm1pbig1MCwgcmVzdWx0cy5sZW5ndGgpO1xuICAgICAgICAgICAgLy8gdHJ1bmNhdGUgc29tZXdoYXQgYXJiaXRyYXJpbHkgdG8gNTBcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW5kSW5kZXg7ICsraSkge1xuICAgICAgICAgICAgICAgIG5ld1Jlc3VsdHMucHVzaChbX2Rpc3RhbmNlKHJlc3VsdHNbaV1bMV0sIG5vcm1hbGl6ZWRWYWx1ZSksIHJlc3VsdHNbaV1bMV1dKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdHMgPSBuZXdSZXN1bHRzO1xuICAgICAgICAgICAgcmVzdWx0cy5zb3J0KHNvcnREZXNjZW5kaW5nKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmV3UmVzdWx0cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChyZXN1bHRzW2ldWzBdID09IHJlc3VsdHNbMF1bMF0pIHtcbiAgICAgICAgICAgICAgICBuZXdSZXN1bHRzLnB1c2goW3Jlc3VsdHNbaV1bMF0sIHRoaXMuZXhhY3RTZXRbcmVzdWx0c1tpXVsxXV1dKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3UmVzdWx0cztcbiAgICB9O1xuXG4gICAgZnV6enlzZXQuYWRkID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRWYWx1ZSA9IHRoaXMuX25vcm1hbGl6ZVN0cih2YWx1ZSk7XG4gICAgICAgIGlmIChub3JtYWxpemVkVmFsdWUgaW4gdGhpcy5leGFjdFNldCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGkgPSB0aGlzLmdyYW1TaXplTG93ZXI7XG4gICAgICAgIGZvciAoaTsgaSA8IHRoaXMuZ3JhbVNpemVVcHBlciArIDE7ICsraSkge1xuICAgICAgICAgICAgdGhpcy5fYWRkKHZhbHVlLCBpKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdXp6eXNldC5fYWRkID0gZnVuY3Rpb24odmFsdWUsIGdyYW1TaXplKSB7XG4gICAgICAgIHZhciBub3JtYWxpemVkVmFsdWUgPSB0aGlzLl9ub3JtYWxpemVTdHIodmFsdWUpLFxuICAgICAgICAgICAgaXRlbXMgPSB0aGlzLml0ZW1zW2dyYW1TaXplXSB8fCBbXSxcbiAgICAgICAgICAgIGluZGV4ID0gaXRlbXMubGVuZ3RoO1xuXG4gICAgICAgIGl0ZW1zLnB1c2goMCk7XG4gICAgICAgIHZhciBncmFtQ291bnRzID0gX2dyYW1Db3VudGVyKG5vcm1hbGl6ZWRWYWx1ZSwgZ3JhbVNpemUpLFxuICAgICAgICAgICAgc3VtT2ZTcXVhcmVHcmFtQ291bnRzID0gMCxcbiAgICAgICAgICAgIGdyYW0sIGdyYW1Db3VudDtcbiAgICAgICAgZm9yICh2YXIgZ3JhbSBpbiBncmFtQ291bnRzKSB7XG4gICAgICAgICAgICBncmFtQ291bnQgPSBncmFtQ291bnRzW2dyYW1dO1xuICAgICAgICAgICAgc3VtT2ZTcXVhcmVHcmFtQ291bnRzICs9IE1hdGgucG93KGdyYW1Db3VudCwgMik7XG4gICAgICAgICAgICBpZiAoZ3JhbSBpbiB0aGlzLm1hdGNoRGljdCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWF0Y2hEaWN0W2dyYW1dLnB1c2goW2luZGV4LCBncmFtQ291bnRdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXRjaERpY3RbZ3JhbV0gPSBbW2luZGV4LCBncmFtQ291bnRdXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgdmVjdG9yTm9ybWFsID0gTWF0aC5zcXJ0KHN1bU9mU3F1YXJlR3JhbUNvdW50cyk7XG4gICAgICAgIGl0ZW1zW2luZGV4XSA9IFt2ZWN0b3JOb3JtYWwsIG5vcm1hbGl6ZWRWYWx1ZV07XG4gICAgICAgIHRoaXMuaXRlbXNbZ3JhbVNpemVdID0gaXRlbXM7XG4gICAgICAgIHRoaXMuZXhhY3RTZXRbbm9ybWFsaXplZFZhbHVlXSA9IHZhbHVlO1xuICAgIH07XG5cbiAgICBmdXp6eXNldC5fbm9ybWFsaXplU3RyID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc3RyKSAhPT0gJ1tvYmplY3QgU3RyaW5nXScpIHRocm93ICdNdXN0IHVzZSBhIHN0cmluZyBhcyBhcmd1bWVudCB0byBGdXp6eVNldCBmdW5jdGlvbnMnXG4gICAgICAgIHJldHVybiBzdHIudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgLy8gcmV0dXJuIGxlbmd0aCBvZiBpdGVtcyBpbiBzZXRcbiAgICBmdXp6eXNldC5sZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGNvdW50ID0gMCxcbiAgICAgICAgICAgIHByb3A7XG4gICAgICAgIGZvciAocHJvcCBpbiB0aGlzLmV4YWN0U2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leGFjdFNldC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgIGNvdW50ICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH07XG5cbiAgICAvLyByZXR1cm4gaXMgc2V0IGlzIGVtcHR5XG4gICAgZnV6enlzZXQuaXNFbXB0eSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHRoaXMuZXhhY3RTZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YWN0U2V0Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICAvLyByZXR1cm4gbGlzdCBvZiB2YWx1ZXMgbG9hZGVkIGludG8gc2V0XG4gICAgZnV6enlzZXQudmFsdWVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB2YWx1ZXMgPSBbXSxcbiAgICAgICAgICAgIHByb3A7XG4gICAgICAgIGZvciAocHJvcCBpbiB0aGlzLmV4YWN0U2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leGFjdFNldC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgIHZhbHVlcy5wdXNoKHRoaXMuZXhhY3RTZXRbcHJvcF0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICB9O1xuXG5cbiAgICAvLyBpbml0aWFsaXphdGlvblxuICAgIHZhciBpID0gZnV6enlzZXQuZ3JhbVNpemVMb3dlcjtcbiAgICBmb3IgKGk7IGkgPCBmdXp6eXNldC5ncmFtU2l6ZVVwcGVyICsgMTsgKytpKSB7XG4gICAgICAgIGZ1enp5c2V0Lml0ZW1zW2ldID0gW107XG4gICAgfVxuICAgIC8vIGFkZCBhbGwgdGhlIGl0ZW1zIHRvIHRoZSBzZXRcbiAgICBmb3IgKGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGZ1enp5c2V0LmFkZChhcnJbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBmdXp6eXNldDtcbn07XG5cbnZhciByb290ID0gdGhpcztcbi8vIEV4cG9ydCB0aGUgZnV6enlzZXQgb2JqZWN0IGZvciAqKkNvbW1vbkpTKiosIHdpdGggYmFja3dhcmRzLWNvbXBhdGliaWxpdHlcbi8vIGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgbm90IGluIENvbW1vbkpTLCBhZGQgYF9gIHRvIHRoZVxuLy8gZ2xvYmFsIG9iamVjdC5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gRnV6enlTZXQ7XG4gICAgcm9vdC5GdXp6eVNldCA9IEZ1enp5U2V0O1xufSBlbHNlIHtcbiAgICByb290LkZ1enp5U2V0ID0gRnV6enlTZXQ7XG59XG5cbn0pKCk7XG4iLCJ2YXIgVk5vZGUgPSByZXF1aXJlKCcuL3Zub2RlJyk7XG52YXIgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG5cbmZ1bmN0aW9uIGFkZE5TKGRhdGEsIGNoaWxkcmVuKSB7XG4gIGRhdGEubnMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xuICBpZiAoY2hpbGRyZW4gIT09IHVuZGVmaW5lZCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIGFkZE5TKGNoaWxkcmVuW2ldLmRhdGEsIGNoaWxkcmVuW2ldLmNoaWxkcmVuKTtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBoKHNlbCwgYiwgYykge1xuICB2YXIgZGF0YSA9IHt9LCBjaGlsZHJlbiwgdGV4dCwgaTtcbiAgaWYgKGMgIT09IHVuZGVmaW5lZCkge1xuICAgIGRhdGEgPSBiO1xuICAgIGlmIChpcy5hcnJheShjKSkgeyBjaGlsZHJlbiA9IGM7IH1cbiAgICBlbHNlIGlmIChpcy5wcmltaXRpdmUoYykpIHsgdGV4dCA9IGM7IH1cbiAgfSBlbHNlIGlmIChiICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoaXMuYXJyYXkoYikpIHsgY2hpbGRyZW4gPSBiOyB9XG4gICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGIpKSB7IHRleHQgPSBiOyB9XG4gICAgZWxzZSB7IGRhdGEgPSBiOyB9XG4gIH1cbiAgaWYgKGlzLmFycmF5KGNoaWxkcmVuKSkge1xuICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgaWYgKGlzLnByaW1pdGl2ZShjaGlsZHJlbltpXSkpIGNoaWxkcmVuW2ldID0gVk5vZGUodW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY2hpbGRyZW5baV0pO1xuICAgIH1cbiAgfVxuICBpZiAoc2VsWzBdID09PSAncycgJiYgc2VsWzFdID09PSAndicgJiYgc2VsWzJdID09PSAnZycpIHtcbiAgICBhZGROUyhkYXRhLCBjaGlsZHJlbik7XG4gIH1cbiAgcmV0dXJuIFZOb2RlKHNlbCwgZGF0YSwgY2hpbGRyZW4sIHRleHQsIHVuZGVmaW5lZCk7XG59O1xuIiwiZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh0YWdOYW1lKXtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgcXVhbGlmaWVkTmFtZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRleHROb2RlKHRleHQpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCk7XG59XG5cblxuZnVuY3Rpb24gaW5zZXJ0QmVmb3JlKHBhcmVudE5vZGUsIG5ld05vZGUsIHJlZmVyZW5jZU5vZGUpe1xuICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShuZXdOb2RlLCByZWZlcmVuY2VOb2RlKTtcbn1cblxuXG5mdW5jdGlvbiByZW1vdmVDaGlsZChub2RlLCBjaGlsZCl7XG4gIG5vZGUucmVtb3ZlQ2hpbGQoY2hpbGQpO1xufVxuXG5mdW5jdGlvbiBhcHBlbmRDaGlsZChub2RlLCBjaGlsZCl7XG4gIG5vZGUuYXBwZW5kQ2hpbGQoY2hpbGQpO1xufVxuXG5mdW5jdGlvbiBwYXJlbnROb2RlKG5vZGUpe1xuICByZXR1cm4gbm9kZS5wYXJlbnRFbGVtZW50O1xufVxuXG5mdW5jdGlvbiBuZXh0U2libGluZyhub2RlKXtcbiAgcmV0dXJuIG5vZGUubmV4dFNpYmxpbmc7XG59XG5cbmZ1bmN0aW9uIHRhZ05hbWUobm9kZSl7XG4gIHJldHVybiBub2RlLnRhZ05hbWU7XG59XG5cbmZ1bmN0aW9uIHNldFRleHRDb250ZW50KG5vZGUsIHRleHQpe1xuICBub2RlLnRleHRDb250ZW50ID0gdGV4dDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGNyZWF0ZUVsZW1lbnQ6IGNyZWF0ZUVsZW1lbnQsXG4gIGNyZWF0ZUVsZW1lbnROUzogY3JlYXRlRWxlbWVudE5TLFxuICBjcmVhdGVUZXh0Tm9kZTogY3JlYXRlVGV4dE5vZGUsXG4gIGFwcGVuZENoaWxkOiBhcHBlbmRDaGlsZCxcbiAgcmVtb3ZlQ2hpbGQ6IHJlbW92ZUNoaWxkLFxuICBpbnNlcnRCZWZvcmU6IGluc2VydEJlZm9yZSxcbiAgcGFyZW50Tm9kZTogcGFyZW50Tm9kZSxcbiAgbmV4dFNpYmxpbmc6IG5leHRTaWJsaW5nLFxuICB0YWdOYW1lOiB0YWdOYW1lLFxuICBzZXRUZXh0Q29udGVudDogc2V0VGV4dENvbnRlbnRcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgYXJyYXk6IEFycmF5LmlzQXJyYXksXG4gIHByaW1pdGl2ZTogZnVuY3Rpb24ocykgeyByZXR1cm4gdHlwZW9mIHMgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBzID09PSAnbnVtYmVyJzsgfSxcbn07XG4iLCJmdW5jdGlvbiB1cGRhdGVDbGFzcyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIGN1ciwgbmFtZSwgZWxtID0gdm5vZGUuZWxtLFxuICAgICAgb2xkQ2xhc3MgPSBvbGRWbm9kZS5kYXRhLmNsYXNzIHx8IHt9LFxuICAgICAga2xhc3MgPSB2bm9kZS5kYXRhLmNsYXNzIHx8IHt9O1xuICBmb3IgKG5hbWUgaW4gb2xkQ2xhc3MpIHtcbiAgICBpZiAoIWtsYXNzW25hbWVdKSB7XG4gICAgICBlbG0uY2xhc3NMaXN0LnJlbW92ZShuYW1lKTtcbiAgICB9XG4gIH1cbiAgZm9yIChuYW1lIGluIGtsYXNzKSB7XG4gICAgY3VyID0ga2xhc3NbbmFtZV07XG4gICAgaWYgKGN1ciAhPT0gb2xkQ2xhc3NbbmFtZV0pIHtcbiAgICAgIGVsbS5jbGFzc0xpc3RbY3VyID8gJ2FkZCcgOiAncmVtb3ZlJ10obmFtZSk7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlQ2xhc3MsIHVwZGF0ZTogdXBkYXRlQ2xhc3N9O1xuIiwidmFyIGlzID0gcmVxdWlyZSgnLi4vaXMnKTtcblxuZnVuY3Rpb24gYXJySW52b2tlcihhcnIpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGlmICghYXJyLmxlbmd0aCkgcmV0dXJuO1xuICAgIC8vIFNwZWNpYWwgY2FzZSB3aGVuIGxlbmd0aCBpcyB0d28sIGZvciBwZXJmb3JtYW5jZVxuICAgIGFyci5sZW5ndGggPT09IDIgPyBhcnJbMF0oYXJyWzFdKSA6IGFyclswXS5hcHBseSh1bmRlZmluZWQsIGFyci5zbGljZSgxKSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGZuSW52b2tlcihvKSB7XG4gIHJldHVybiBmdW5jdGlvbihldikgeyBcbiAgICBpZiAoby5mbiA9PT0gbnVsbCkgcmV0dXJuO1xuICAgIG8uZm4oZXYpOyBcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRXZlbnRMaXN0ZW5lcnMob2xkVm5vZGUsIHZub2RlKSB7XG4gIHZhciBuYW1lLCBjdXIsIG9sZCwgZWxtID0gdm5vZGUuZWxtLFxuICAgICAgb2xkT24gPSBvbGRWbm9kZS5kYXRhLm9uIHx8IHt9LCBvbiA9IHZub2RlLmRhdGEub247XG4gIGlmICghb24pIHJldHVybjtcbiAgZm9yIChuYW1lIGluIG9uKSB7XG4gICAgY3VyID0gb25bbmFtZV07XG4gICAgb2xkID0gb2xkT25bbmFtZV07XG4gICAgaWYgKG9sZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoaXMuYXJyYXkoY3VyKSkge1xuICAgICAgICBlbG0uYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBhcnJJbnZva2VyKGN1cikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3VyID0ge2ZuOiBjdXJ9O1xuICAgICAgICBvbltuYW1lXSA9IGN1cjtcbiAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZm5JbnZva2VyKGN1cikpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXMuYXJyYXkob2xkKSkge1xuICAgICAgLy8gRGVsaWJlcmF0ZWx5IG1vZGlmeSBvbGQgYXJyYXkgc2luY2UgaXQncyBjYXB0dXJlZCBpbiBjbG9zdXJlIGNyZWF0ZWQgd2l0aCBgYXJySW52b2tlcmBcbiAgICAgIG9sZC5sZW5ndGggPSBjdXIubGVuZ3RoO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvbGQubGVuZ3RoOyArK2kpIG9sZFtpXSA9IGN1cltpXTtcbiAgICAgIG9uW25hbWVdICA9IG9sZDtcbiAgICB9IGVsc2Uge1xuICAgICAgb2xkLmZuID0gY3VyO1xuICAgICAgb25bbmFtZV0gPSBvbGQ7XG4gICAgfVxuICB9XG4gIGlmIChvbGRPbikge1xuICAgIGZvciAobmFtZSBpbiBvbGRPbikge1xuICAgICAgaWYgKG9uW25hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdmFyIG9sZCA9IG9sZE9uW25hbWVdO1xuICAgICAgICBpZiAoaXMuYXJyYXkob2xkKSkge1xuICAgICAgICAgIG9sZC5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIG9sZC5mbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7Y3JlYXRlOiB1cGRhdGVFdmVudExpc3RlbmVycywgdXBkYXRlOiB1cGRhdGVFdmVudExpc3RlbmVyc307XG4iLCJmdW5jdGlvbiB1cGRhdGVQcm9wcyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIGtleSwgY3VyLCBvbGQsIGVsbSA9IHZub2RlLmVsbSxcbiAgICAgIG9sZFByb3BzID0gb2xkVm5vZGUuZGF0YS5wcm9wcyB8fCB7fSwgcHJvcHMgPSB2bm9kZS5kYXRhLnByb3BzIHx8IHt9O1xuICBmb3IgKGtleSBpbiBvbGRQcm9wcykge1xuICAgIGlmICghcHJvcHNba2V5XSkge1xuICAgICAgZGVsZXRlIGVsbVtrZXldO1xuICAgIH1cbiAgfVxuICBmb3IgKGtleSBpbiBwcm9wcykge1xuICAgIGN1ciA9IHByb3BzW2tleV07XG4gICAgb2xkID0gb2xkUHJvcHNba2V5XTtcbiAgICBpZiAob2xkICE9PSBjdXIgJiYgKGtleSAhPT0gJ3ZhbHVlJyB8fCBlbG1ba2V5XSAhPT0gY3VyKSkge1xuICAgICAgZWxtW2tleV0gPSBjdXI7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlUHJvcHMsIHVwZGF0ZTogdXBkYXRlUHJvcHN9O1xuIiwidmFyIHJhZiA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB8fCBzZXRUaW1lb3V0O1xudmFyIG5leHRGcmFtZSA9IGZ1bmN0aW9uKGZuKSB7IHJhZihmdW5jdGlvbigpIHsgcmFmKGZuKTsgfSk7IH07XG5cbmZ1bmN0aW9uIHNldE5leHRGcmFtZShvYmosIHByb3AsIHZhbCkge1xuICBuZXh0RnJhbWUoZnVuY3Rpb24oKSB7IG9ialtwcm9wXSA9IHZhbDsgfSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVN0eWxlKG9sZFZub2RlLCB2bm9kZSkge1xuICB2YXIgY3VyLCBuYW1lLCBlbG0gPSB2bm9kZS5lbG0sXG4gICAgICBvbGRTdHlsZSA9IG9sZFZub2RlLmRhdGEuc3R5bGUgfHwge30sXG4gICAgICBzdHlsZSA9IHZub2RlLmRhdGEuc3R5bGUgfHwge30sXG4gICAgICBvbGRIYXNEZWwgPSAnZGVsYXllZCcgaW4gb2xkU3R5bGU7XG4gIGZvciAobmFtZSBpbiBvbGRTdHlsZSkge1xuICAgIGlmICghc3R5bGVbbmFtZV0pIHtcbiAgICAgIGVsbS5zdHlsZVtuYW1lXSA9ICcnO1xuICAgIH1cbiAgfVxuICBmb3IgKG5hbWUgaW4gc3R5bGUpIHtcbiAgICBjdXIgPSBzdHlsZVtuYW1lXTtcbiAgICBpZiAobmFtZSA9PT0gJ2RlbGF5ZWQnKSB7XG4gICAgICBmb3IgKG5hbWUgaW4gc3R5bGUuZGVsYXllZCkge1xuICAgICAgICBjdXIgPSBzdHlsZS5kZWxheWVkW25hbWVdO1xuICAgICAgICBpZiAoIW9sZEhhc0RlbCB8fCBjdXIgIT09IG9sZFN0eWxlLmRlbGF5ZWRbbmFtZV0pIHtcbiAgICAgICAgICBzZXROZXh0RnJhbWUoZWxtLnN0eWxlLCBuYW1lLCBjdXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuYW1lICE9PSAncmVtb3ZlJyAmJiBjdXIgIT09IG9sZFN0eWxlW25hbWVdKSB7XG4gICAgICBlbG0uc3R5bGVbbmFtZV0gPSBjdXI7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5RGVzdHJveVN0eWxlKHZub2RlKSB7XG4gIHZhciBzdHlsZSwgbmFtZSwgZWxtID0gdm5vZGUuZWxtLCBzID0gdm5vZGUuZGF0YS5zdHlsZTtcbiAgaWYgKCFzIHx8ICEoc3R5bGUgPSBzLmRlc3Ryb3kpKSByZXR1cm47XG4gIGZvciAobmFtZSBpbiBzdHlsZSkge1xuICAgIGVsbS5zdHlsZVtuYW1lXSA9IHN0eWxlW25hbWVdO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5UmVtb3ZlU3R5bGUodm5vZGUsIHJtKSB7XG4gIHZhciBzID0gdm5vZGUuZGF0YS5zdHlsZTtcbiAgaWYgKCFzIHx8ICFzLnJlbW92ZSkge1xuICAgIHJtKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBuYW1lLCBlbG0gPSB2bm9kZS5lbG0sIGlkeCwgaSA9IDAsIG1heER1ciA9IDAsXG4gICAgICBjb21wU3R5bGUsIHN0eWxlID0gcy5yZW1vdmUsIGFtb3VudCA9IDAsIGFwcGxpZWQgPSBbXTtcbiAgZm9yIChuYW1lIGluIHN0eWxlKSB7XG4gICAgYXBwbGllZC5wdXNoKG5hbWUpO1xuICAgIGVsbS5zdHlsZVtuYW1lXSA9IHN0eWxlW25hbWVdO1xuICB9XG4gIGNvbXBTdHlsZSA9IGdldENvbXB1dGVkU3R5bGUoZWxtKTtcbiAgdmFyIHByb3BzID0gY29tcFN0eWxlWyd0cmFuc2l0aW9uLXByb3BlcnR5J10uc3BsaXQoJywgJyk7XG4gIGZvciAoOyBpIDwgcHJvcHMubGVuZ3RoOyArK2kpIHtcbiAgICBpZihhcHBsaWVkLmluZGV4T2YocHJvcHNbaV0pICE9PSAtMSkgYW1vdW50Kys7XG4gIH1cbiAgZWxtLmFkZEV2ZW50TGlzdGVuZXIoJ3RyYW5zaXRpb25lbmQnLCBmdW5jdGlvbihldikge1xuICAgIGlmIChldi50YXJnZXQgPT09IGVsbSkgLS1hbW91bnQ7XG4gICAgaWYgKGFtb3VudCA9PT0gMCkgcm0oKTtcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlU3R5bGUsIHVwZGF0ZTogdXBkYXRlU3R5bGUsIGRlc3Ryb3k6IGFwcGx5RGVzdHJveVN0eWxlLCByZW1vdmU6IGFwcGx5UmVtb3ZlU3R5bGV9O1xuIiwiLy8ganNoaW50IG5ld2NhcDogZmFsc2Vcbi8qIGdsb2JhbCByZXF1aXJlLCBtb2R1bGUsIGRvY3VtZW50LCBOb2RlICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBWTm9kZSA9IHJlcXVpcmUoJy4vdm5vZGUnKTtcbnZhciBpcyA9IHJlcXVpcmUoJy4vaXMnKTtcbnZhciBkb21BcGkgPSByZXF1aXJlKCcuL2h0bWxkb21hcGknKTtcblxuZnVuY3Rpb24gaXNVbmRlZihzKSB7IHJldHVybiBzID09PSB1bmRlZmluZWQ7IH1cbmZ1bmN0aW9uIGlzRGVmKHMpIHsgcmV0dXJuIHMgIT09IHVuZGVmaW5lZDsgfVxuXG52YXIgZW1wdHlOb2RlID0gVk5vZGUoJycsIHt9LCBbXSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXG5mdW5jdGlvbiBzYW1lVm5vZGUodm5vZGUxLCB2bm9kZTIpIHtcbiAgcmV0dXJuIHZub2RlMS5rZXkgPT09IHZub2RlMi5rZXkgJiYgdm5vZGUxLnNlbCA9PT0gdm5vZGUyLnNlbDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlS2V5VG9PbGRJZHgoY2hpbGRyZW4sIGJlZ2luSWR4LCBlbmRJZHgpIHtcbiAgdmFyIGksIG1hcCA9IHt9LCBrZXk7XG4gIGZvciAoaSA9IGJlZ2luSWR4OyBpIDw9IGVuZElkeDsgKytpKSB7XG4gICAga2V5ID0gY2hpbGRyZW5baV0ua2V5O1xuICAgIGlmIChpc0RlZihrZXkpKSBtYXBba2V5XSA9IGk7XG4gIH1cbiAgcmV0dXJuIG1hcDtcbn1cblxudmFyIGhvb2tzID0gWydjcmVhdGUnLCAndXBkYXRlJywgJ3JlbW92ZScsICdkZXN0cm95JywgJ3ByZScsICdwb3N0J107XG5cbmZ1bmN0aW9uIGluaXQobW9kdWxlcywgYXBpKSB7XG4gIHZhciBpLCBqLCBjYnMgPSB7fTtcblxuICBpZiAoaXNVbmRlZihhcGkpKSBhcGkgPSBkb21BcGk7XG5cbiAgZm9yIChpID0gMDsgaSA8IGhvb2tzLmxlbmd0aDsgKytpKSB7XG4gICAgY2JzW2hvb2tzW2ldXSA9IFtdO1xuICAgIGZvciAoaiA9IDA7IGogPCBtb2R1bGVzLmxlbmd0aDsgKytqKSB7XG4gICAgICBpZiAobW9kdWxlc1tqXVtob29rc1tpXV0gIT09IHVuZGVmaW5lZCkgY2JzW2hvb2tzW2ldXS5wdXNoKG1vZHVsZXNbal1baG9va3NbaV1dKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlbXB0eU5vZGVBdChlbG0pIHtcbiAgICByZXR1cm4gVk5vZGUoYXBpLnRhZ05hbWUoZWxtKS50b0xvd2VyQ2FzZSgpLCB7fSwgW10sIHVuZGVmaW5lZCwgZWxtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVJtQ2IoY2hpbGRFbG0sIGxpc3RlbmVycykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLWxpc3RlbmVycyA9PT0gMCkge1xuICAgICAgICB2YXIgcGFyZW50ID0gYXBpLnBhcmVudE5vZGUoY2hpbGRFbG0pO1xuICAgICAgICBhcGkucmVtb3ZlQ2hpbGQocGFyZW50LCBjaGlsZEVsbSk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUVsbSh2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIGksIGRhdGEgPSB2bm9kZS5kYXRhO1xuICAgIGlmIChpc0RlZihkYXRhKSkge1xuICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLmhvb2spICYmIGlzRGVmKGkgPSBpLmluaXQpKSB7XG4gICAgICAgIGkodm5vZGUpO1xuICAgICAgICBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGVsbSwgY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlbiwgc2VsID0gdm5vZGUuc2VsO1xuICAgIGlmIChpc0RlZihzZWwpKSB7XG4gICAgICAvLyBQYXJzZSBzZWxlY3RvclxuICAgICAgdmFyIGhhc2hJZHggPSBzZWwuaW5kZXhPZignIycpO1xuICAgICAgdmFyIGRvdElkeCA9IHNlbC5pbmRleE9mKCcuJywgaGFzaElkeCk7XG4gICAgICB2YXIgaGFzaCA9IGhhc2hJZHggPiAwID8gaGFzaElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICB2YXIgZG90ID0gZG90SWR4ID4gMCA/IGRvdElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICB2YXIgdGFnID0gaGFzaElkeCAhPT0gLTEgfHwgZG90SWR4ICE9PSAtMSA/IHNlbC5zbGljZSgwLCBNYXRoLm1pbihoYXNoLCBkb3QpKSA6IHNlbDtcbiAgICAgIGVsbSA9IHZub2RlLmVsbSA9IGlzRGVmKGRhdGEpICYmIGlzRGVmKGkgPSBkYXRhLm5zKSA/IGFwaS5jcmVhdGVFbGVtZW50TlMoaSwgdGFnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogYXBpLmNyZWF0ZUVsZW1lbnQodGFnKTtcbiAgICAgIGlmIChoYXNoIDwgZG90KSBlbG0uaWQgPSBzZWwuc2xpY2UoaGFzaCArIDEsIGRvdCk7XG4gICAgICBpZiAoZG90SWR4ID4gMCkgZWxtLmNsYXNzTmFtZSA9IHNlbC5zbGljZShkb3QrMSkucmVwbGFjZSgvXFwuL2csICcgJyk7XG4gICAgICBpZiAoaXMuYXJyYXkoY2hpbGRyZW4pKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICAgIGFwaS5hcHBlbmRDaGlsZChlbG0sIGNyZWF0ZUVsbShjaGlsZHJlbltpXSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoaXMucHJpbWl0aXZlKHZub2RlLnRleHQpKSB7XG4gICAgICAgIGFwaS5hcHBlbmRDaGlsZChlbG0sIGFwaS5jcmVhdGVUZXh0Tm9kZSh2bm9kZS50ZXh0KSk7XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLmNyZWF0ZS5sZW5ndGg7ICsraSkgY2JzLmNyZWF0ZVtpXShlbXB0eU5vZGUsIHZub2RlKTtcbiAgICAgIGkgPSB2bm9kZS5kYXRhLmhvb2s7IC8vIFJldXNlIHZhcmlhYmxlXG4gICAgICBpZiAoaXNEZWYoaSkpIHtcbiAgICAgICAgaWYgKGkuY3JlYXRlKSBpLmNyZWF0ZShlbXB0eU5vZGUsIHZub2RlKTtcbiAgICAgICAgaWYgKGkuaW5zZXJ0KSBpbnNlcnRlZFZub2RlUXVldWUucHVzaCh2bm9kZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsbSA9IHZub2RlLmVsbSA9IGFwaS5jcmVhdGVUZXh0Tm9kZSh2bm9kZS50ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHZub2RlLmVsbTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFZub2RlcyhwYXJlbnRFbG0sIGJlZm9yZSwgdm5vZGVzLCBzdGFydElkeCwgZW5kSWR4LCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICBmb3IgKDsgc3RhcnRJZHggPD0gZW5kSWR4OyArK3N0YXJ0SWR4KSB7XG4gICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKHZub2Rlc1tzdGFydElkeF0sIGluc2VydGVkVm5vZGVRdWV1ZSksIGJlZm9yZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaW52b2tlRGVzdHJveUhvb2sodm5vZGUpIHtcbiAgICB2YXIgaSwgaiwgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgaWYgKGlzRGVmKGRhdGEpKSB7XG4gICAgICBpZiAoaXNEZWYoaSA9IGRhdGEuaG9vaykgJiYgaXNEZWYoaSA9IGkuZGVzdHJveSkpIGkodm5vZGUpO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5kZXN0cm95Lmxlbmd0aDsgKytpKSBjYnMuZGVzdHJveVtpXSh2bm9kZSk7XG4gICAgICBpZiAoaXNEZWYoaSA9IHZub2RlLmNoaWxkcmVuKSkge1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICBpbnZva2VEZXN0cm95SG9vayh2bm9kZS5jaGlsZHJlbltqXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVWbm9kZXMocGFyZW50RWxtLCB2bm9kZXMsIHN0YXJ0SWR4LCBlbmRJZHgpIHtcbiAgICBmb3IgKDsgc3RhcnRJZHggPD0gZW5kSWR4OyArK3N0YXJ0SWR4KSB7XG4gICAgICB2YXIgaSwgbGlzdGVuZXJzLCBybSwgY2ggPSB2bm9kZXNbc3RhcnRJZHhdO1xuICAgICAgaWYgKGlzRGVmKGNoKSkge1xuICAgICAgICBpZiAoaXNEZWYoY2guc2VsKSkge1xuICAgICAgICAgIGludm9rZURlc3Ryb3lIb29rKGNoKTtcbiAgICAgICAgICBsaXN0ZW5lcnMgPSBjYnMucmVtb3ZlLmxlbmd0aCArIDE7XG4gICAgICAgICAgcm0gPSBjcmVhdGVSbUNiKGNoLmVsbSwgbGlzdGVuZXJzKTtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnJlbW92ZS5sZW5ndGg7ICsraSkgY2JzLnJlbW92ZVtpXShjaCwgcm0pO1xuICAgICAgICAgIGlmIChpc0RlZihpID0gY2guZGF0YSkgJiYgaXNEZWYoaSA9IGkuaG9vaykgJiYgaXNEZWYoaSA9IGkucmVtb3ZlKSkge1xuICAgICAgICAgICAgaShjaCwgcm0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBybSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHsgLy8gVGV4dCBub2RlXG4gICAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudEVsbSwgY2guZWxtKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZUNoaWxkcmVuKHBhcmVudEVsbSwgb2xkQ2gsIG5ld0NoLCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICB2YXIgb2xkU3RhcnRJZHggPSAwLCBuZXdTdGFydElkeCA9IDA7XG4gICAgdmFyIG9sZEVuZElkeCA9IG9sZENoLmxlbmd0aCAtIDE7XG4gICAgdmFyIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFswXTtcbiAgICB2YXIgb2xkRW5kVm5vZGUgPSBvbGRDaFtvbGRFbmRJZHhdO1xuICAgIHZhciBuZXdFbmRJZHggPSBuZXdDaC5sZW5ndGggLSAxO1xuICAgIHZhciBuZXdTdGFydFZub2RlID0gbmV3Q2hbMF07XG4gICAgdmFyIG5ld0VuZFZub2RlID0gbmV3Q2hbbmV3RW5kSWR4XTtcbiAgICB2YXIgb2xkS2V5VG9JZHgsIGlkeEluT2xkLCBlbG1Ub01vdmUsIGJlZm9yZTtcblxuICAgIHdoaWxlIChvbGRTdGFydElkeCA8PSBvbGRFbmRJZHggJiYgbmV3U3RhcnRJZHggPD0gbmV3RW5kSWR4KSB7XG4gICAgICBpZiAoaXNVbmRlZihvbGRTdGFydFZub2RlKSkge1xuICAgICAgICBvbGRTdGFydFZub2RlID0gb2xkQ2hbKytvbGRTdGFydElkeF07IC8vIFZub2RlIGhhcyBiZWVuIG1vdmVkIGxlZnRcbiAgICAgIH0gZWxzZSBpZiAoaXNVbmRlZihvbGRFbmRWbm9kZSkpIHtcbiAgICAgICAgb2xkRW5kVm5vZGUgPSBvbGRDaFstLW9sZEVuZElkeF07XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWbm9kZShvbGRTdGFydFZub2RlLCBuZXdTdGFydFZub2RlKSkge1xuICAgICAgICBwYXRjaFZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFsrK29sZFN0YXJ0SWR4XTtcbiAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkRW5kVm5vZGUsIG5ld0VuZFZub2RlKSkge1xuICAgICAgICBwYXRjaFZub2RlKG9sZEVuZFZub2RlLCBuZXdFbmRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgb2xkRW5kVm5vZGUgPSBvbGRDaFstLW9sZEVuZElkeF07XG4gICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3RW5kVm5vZGUpKSB7IC8vIFZub2RlIG1vdmVkIHJpZ2h0XG4gICAgICAgIHBhdGNoVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3RW5kVm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBvbGRTdGFydFZub2RlLmVsbSwgYXBpLm5leHRTaWJsaW5nKG9sZEVuZFZub2RlLmVsbSkpO1xuICAgICAgICBvbGRTdGFydFZub2RlID0gb2xkQ2hbKytvbGRTdGFydElkeF07XG4gICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkRW5kVm5vZGUsIG5ld1N0YXJ0Vm5vZGUpKSB7IC8vIFZub2RlIG1vdmVkIGxlZnRcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRFbmRWbm9kZSwgbmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIG9sZEVuZFZub2RlLmVsbSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICBvbGRFbmRWbm9kZSA9IG9sZENoWy0tb2xkRW5kSWR4XTtcbiAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzVW5kZWYob2xkS2V5VG9JZHgpKSBvbGRLZXlUb0lkeCA9IGNyZWF0ZUtleVRvT2xkSWR4KG9sZENoLCBvbGRTdGFydElkeCwgb2xkRW5kSWR4KTtcbiAgICAgICAgaWR4SW5PbGQgPSBvbGRLZXlUb0lkeFtuZXdTdGFydFZub2RlLmtleV07XG4gICAgICAgIGlmIChpc1VuZGVmKGlkeEluT2xkKSkgeyAvLyBOZXcgZWxlbWVudFxuICAgICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBjcmVhdGVFbG0obmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbG1Ub01vdmUgPSBvbGRDaFtpZHhJbk9sZF07XG4gICAgICAgICAgcGF0Y2hWbm9kZShlbG1Ub01vdmUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgb2xkQ2hbaWR4SW5PbGRdID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBlbG1Ub01vdmUuZWxtLCBvbGRTdGFydFZub2RlLmVsbSk7XG4gICAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvbGRTdGFydElkeCA+IG9sZEVuZElkeCkge1xuICAgICAgYmVmb3JlID0gaXNVbmRlZihuZXdDaFtuZXdFbmRJZHgrMV0pID8gbnVsbCA6IG5ld0NoW25ld0VuZElkeCsxXS5lbG07XG4gICAgICBhZGRWbm9kZXMocGFyZW50RWxtLCBiZWZvcmUsIG5ld0NoLCBuZXdTdGFydElkeCwgbmV3RW5kSWR4LCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgIH0gZWxzZSBpZiAobmV3U3RhcnRJZHggPiBuZXdFbmRJZHgpIHtcbiAgICAgIHJlbW92ZVZub2RlcyhwYXJlbnRFbG0sIG9sZENoLCBvbGRTdGFydElkeCwgb2xkRW5kSWR4KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwYXRjaFZub2RlKG9sZFZub2RlLCB2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIGksIGhvb2s7XG4gICAgaWYgKGlzRGVmKGkgPSB2bm9kZS5kYXRhKSAmJiBpc0RlZihob29rID0gaS5ob29rKSAmJiBpc0RlZihpID0gaG9vay5wcmVwYXRjaCkpIHtcbiAgICAgIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICB9XG4gICAgdmFyIGVsbSA9IHZub2RlLmVsbSA9IG9sZFZub2RlLmVsbSwgb2xkQ2ggPSBvbGRWbm9kZS5jaGlsZHJlbiwgY2ggPSB2bm9kZS5jaGlsZHJlbjtcbiAgICBpZiAob2xkVm5vZGUgPT09IHZub2RlKSByZXR1cm47XG4gICAgaWYgKCFzYW1lVm5vZGUob2xkVm5vZGUsIHZub2RlKSkge1xuICAgICAgdmFyIHBhcmVudEVsbSA9IGFwaS5wYXJlbnROb2RlKG9sZFZub2RlLmVsbSk7XG4gICAgICBlbG0gPSBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgZWxtLCBvbGRWbm9kZS5lbG0pO1xuICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgW29sZFZub2RlXSwgMCwgMCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChpc0RlZih2bm9kZS5kYXRhKSkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy51cGRhdGUubGVuZ3RoOyArK2kpIGNicy51cGRhdGVbaV0ob2xkVm5vZGUsIHZub2RlKTtcbiAgICAgIGkgPSB2bm9kZS5kYXRhLmhvb2s7XG4gICAgICBpZiAoaXNEZWYoaSkgJiYgaXNEZWYoaSA9IGkudXBkYXRlKSkgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgICBpZiAoaXNVbmRlZih2bm9kZS50ZXh0KSkge1xuICAgICAgaWYgKGlzRGVmKG9sZENoKSAmJiBpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKG9sZENoICE9PSBjaCkgdXBkYXRlQ2hpbGRyZW4oZWxtLCBvbGRDaCwgY2gsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKGNoKSkge1xuICAgICAgICBpZiAoaXNEZWYob2xkVm5vZGUudGV4dCkpIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgICAgYWRkVm5vZGVzKGVsbSwgbnVsbCwgY2gsIDAsIGNoLmxlbmd0aCAtIDEsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKG9sZENoKSkge1xuICAgICAgICByZW1vdmVWbm9kZXMoZWxtLCBvbGRDaCwgMCwgb2xkQ2gubGVuZ3RoIC0gMSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKG9sZFZub2RlLnRleHQpKSB7XG4gICAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9sZFZub2RlLnRleHQgIT09IHZub2RlLnRleHQpIHtcbiAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sIHZub2RlLnRleHQpO1xuICAgIH1cbiAgICBpZiAoaXNEZWYoaG9vaykgJiYgaXNEZWYoaSA9IGhvb2sucG9zdHBhdGNoKSkge1xuICAgICAgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbihvbGRWbm9kZSwgdm5vZGUpIHtcbiAgICB2YXIgaSwgZWxtLCBwYXJlbnQ7XG4gICAgdmFyIGluc2VydGVkVm5vZGVRdWV1ZSA9IFtdO1xuICAgIGZvciAoaSA9IDA7IGkgPCBjYnMucHJlLmxlbmd0aDsgKytpKSBjYnMucHJlW2ldKCk7XG5cbiAgICBpZiAoaXNVbmRlZihvbGRWbm9kZS5zZWwpKSB7XG4gICAgICBvbGRWbm9kZSA9IGVtcHR5Tm9kZUF0KG9sZFZub2RlKTtcbiAgICB9XG5cbiAgICBpZiAoc2FtZVZub2RlKG9sZFZub2RlLCB2bm9kZSkpIHtcbiAgICAgIHBhdGNoVm5vZGUob2xkVm5vZGUsIHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbG0gPSBvbGRWbm9kZS5lbG07XG4gICAgICBwYXJlbnQgPSBhcGkucGFyZW50Tm9kZShlbG0pO1xuXG4gICAgICBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG5cbiAgICAgIGlmIChwYXJlbnQgIT09IG51bGwpIHtcbiAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnQsIHZub2RlLmVsbSwgYXBpLm5leHRTaWJsaW5nKGVsbSkpO1xuICAgICAgICByZW1vdmVWbm9kZXMocGFyZW50LCBbb2xkVm5vZGVdLCAwLCAwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgaW5zZXJ0ZWRWbm9kZVF1ZXVlLmxlbmd0aDsgKytpKSB7XG4gICAgICBpbnNlcnRlZFZub2RlUXVldWVbaV0uZGF0YS5ob29rLmluc2VydChpbnNlcnRlZFZub2RlUXVldWVbaV0pO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnBvc3QubGVuZ3RoOyArK2kpIGNicy5wb3N0W2ldKCk7XG4gICAgcmV0dXJuIHZub2RlO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtpbml0OiBpbml0fTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oc2VsLCBkYXRhLCBjaGlsZHJlbiwgdGV4dCwgZWxtKSB7XG4gIHZhciBrZXkgPSBkYXRhID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkYXRhLmtleTtcbiAgcmV0dXJuIHtzZWw6IHNlbCwgZGF0YTogZGF0YSwgY2hpbGRyZW46IGNoaWxkcmVuLFxuICAgICAgICAgIHRleHQ6IHRleHQsIGVsbTogZWxtLCBrZXk6IGtleX07XG59O1xuIiwiY29uc3QgY2FsbGJhY2tzID0gKHsgJGFjdGl2YXRlQnRuIH0pID0+IChjaGFubmVsKSA9PiB7XG4gIGNvbnN0IHsgRWl0aGVyIH0gPSByZXF1aXJlKCdmcC1saWInKVxuICBcbiAgcmV0dXJuIHtcbiAgICAnc3RhcnQnOiAoKSA9PiB7XG4gICAgICAvL1xuICAgIH0sXG4gICAgJ3Jlc3VsdCc6IChyZXN1bHQpID0+IHtcbiAgICAgIC8vY29uc29sZS5sb2cocmVzdWx0KVxuICAgIH0sXG4gICAgJ3Jlc3VsdE1hdGNoJzogKHJlc3VsdCkgPT4ge1xuICAgICAgLy9jb25zb2xlLmxvZyhyZXN1bHQpXG4gICAgfSxcbiAgICAncmVzdWx0Tm9NYXRjaCc6IChyZXN1bHQpID0+IHtcbiAgICAgIGNoYW5uZWwucHVzaChFaXRoZXIuTGVmdChgTm8gY29tbWFuZCBtYXRjaGVzIGZvciAke3Jlc3VsdFswXX1gKSlcbiAgICB9LFxuICAgICdlbmQnOiAoKSA9PiB7XG4gICAgICAkYWN0aXZhdGVCdG4udGV4dENvbnRlbnQgPSAnU3RhcnQnXG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2FsbGJhY2tzIiwiY29uc3QgY29tbWFuZHMgPSAoaG9yaXpvbikgPT4gKG1hbnVhbENvbW1hbmRFbnRyeSkgPT4gKGNoYW5uZWwpID0+IHtcbiAgY29uc3QgZnV6enlzZXQgPSByZXF1aXJlKCdmdXp6eXNldC5qcycpXG4gIGNvbnN0IGggPSByZXF1aXJlKCdzbmFiYmRvbS9oJylcbiAgY29uc3QgeyBFaXRoZXIsIHBsdWNrIH0gPSByZXF1aXJlKCdmcC1saWInKVxuICBcbiAgY29uc3QgbGV0dGVycyA9IGhvcml6b24oJ2xldHRlcnMnKVxuICBjb25zdCBjbGllbnRzID0gaG9yaXpvbignY2xpZW50cycpXG4gIFxuICBsZXQgZnV6enlfY2xpZW50cyA9IGZ1enp5c2V0KFtdKVxuICBsZXQgZnV6enlfYWRkcmVzc2VzID0gZnV6enlzZXQoW10pXG4gIFxuICBjbGllbnRzLndhdGNoKCkuc3Vic2NyaWJlKFxuICAgIChyZXMpID0+IHsgXG4gICAgICBpZiAocmVzLmxlbmd0aCA9PT0gMCkge30gXG4gICAgICBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ3JlY2VpdmVkIHVwZGF0ZScsIHJlcylcbiAgICAgICAgY29uc29sZS5sb2cocGx1Y2soJ25hbWUnKShyZXMpKVxuICAgICAgICBmdXp6eV9jbGllbnRzID0gZnV6enlzZXQocGx1Y2soJ25hbWUnKShyZXMpLCBmYWxzZSwgMSlcbiAgICAgICAgLy9mdXp6eV9hZGRyZXNzZXMgPSBmdXp6eXNldChwbHVjaygnYWRkcmVzcycpKHJlcykpXG4gICAgICB9XG4gICAgfSxcbiAgICAoZXJyKSA9PiBjb25zb2xlLmVycm9yKGBjbGllbnRzLndhdGNoKCk6ICR7ZXJyfWApKVxuICBcbiAgY29uc3QgX2NvbW1hbmRzID0ge1xuICAgICdjbGllbnQgKm5hbWUnOiAobmFtZSkgPT4ge1xuICAgICAgY29uc3QgcmVzID0gZnV6enlfY2xpZW50cy5nZXQobmFtZSlcblxuICAgICAgaWYgKHJlcyAhPT0gbnVsbCkge1xuICAgICAgICBjaGFubmVsLnB1c2goRWl0aGVyLlJpZ2h0KGBmdXp6eSBjbGllbnQgZm91bmQgJHtyZXN9YCkpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaGFubmVsLnB1c2goRWl0aGVyLkxlZnQoYGNsaWVudCAke25hbWV9IG5vdCBmb3VuZCBieSBmdXp6eWApKVxuICAgICAgfVxuICAgIH0sXG4gICAgJ25ldyBjbGllbnQnOiAoKSA9PiB7XG4gICAgICBjb25zdCBuYW1lID0gd2luZG93LnByb21wdChgRW50ZXIgbmV3IGNsaWVudCBuYW1lYClcbiAgICAgIFxuICAgICAgaWYgKG5hbWUgPT09IG51bGwpIHsgLy8gY2FuY2VsbGVkXG4gICAgICAgIHJldHVyblxuICAgICAgfVxuICAgICAgXG4gICAgICBpZiAobmFtZSA9PT0gJycpIHsgLy8gZW1wdHkgbmFtZVxuICAgICAgICBjaGFubmVsLnB1c2goRWl0aGVyLkxlZnQoYEVycm9yIG5ldyBjbGllbnQgLS0gY2Fubm90IGNyZWF0ZSBjbGllbnQgd2l0aCBubyBuYW1lYCkpICBcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBcbiAgICAgIGNsaWVudHMuZmluZCh7IG5hbWUgfSkuZmV0Y2goKS5kZWZhdWx0SWZFbXB0eSgpLnN1YnNjcmliZShcbiAgICAgICAgKG1zZykgPT4ge1xuICAgICAgICAgIGlmIChtc2cgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGNsaWVudHMuc3RvcmUoeyBuYW1lIH0pLnN1YnNjcmliZShcbiAgICAgICAgICAgICAgKHJlcykgPT4gY2hhbm5lbC5wdXNoKEVpdGhlci5SaWdodChgQ3JlYXRlZCBuZXcgY2xpZW50ICR7bmFtZX1gKSksXG4gICAgICAgICAgICAgIChlcnIpID0+IGNoYW5uZWwucHVzaChFaXRoZXIuTGVmdChgRXJyb3IgbmV3IGNsaWVudCAke25hbWV9IC0tICR7ZXJyfWApKSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2hhbm5lbC5wdXNoKEVpdGhlci5MZWZ0KGBFcnJvciBuZXcgY2xpZW50ICR7bmFtZX0gLS0gdGhhdCBuYW1lIGFscmVhZHkgZXhpc3RzYCkpXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICApXG4gICAgfSxcbiAgICBbYHdoYXQncyBuZWFyYnlgXTogKCkgPT4ge30sXG4gICAgJ2NsaWVudCBhZGRyZXNzICphZGRyJzogKGFkZHIpID0+IHtcbiAgICAgICAgICAgIFxuICAgIH0sXG4gICAgJ2luY3JlYXNlIDpsZXR0ZXInOiAobGV0dGVyKSA9PiB7XG4gICAgICBsZXR0ZXJzLmZpbmQobGV0dGVyLnRvTG93ZXJDYXNlKCkpLmZldGNoKCkuZGVmYXVsdElmRW1wdHkoKS5zdWJzY3JpYmUoXG4gICAgICAgIChyZXMpID0+IHtcbiAgICAgICAgICBpZiAocmVzID09PSBudWxsKSB7XG4gICAgICAgICAgICBjaGFubmVsLnB1c2goRWl0aGVyLkxlZnQoYGNhbm5vdCBpbmNyZWFzZSBsZXR0ZXIgJHtsZXR0ZXJ9IC0tIGl0IGRvZXMgbm90IGV4aXN0YCkpIFxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXR0ZXJzLnJlcGxhY2UoeyBpZDogbGV0dGVyLCBjb3VudDogcmVzLmNvdW50ICsgMSB9KS5zdWJzY3JpYmUoXG4gICAgICAgICAgICAgIChpZCkgPT4geyBcbiAgICAgICAgICAgICAgICBjaGFubmVsLnB1c2goRWl0aGVyLlJpZ2h0KGBpbmNyZWFzZWQgbGV0dGVyICR7bGV0dGVyfSB0byAke3Jlcy5jb3VudH1gKSkgXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIChlcnIpID0+IHsgXG4gICAgICAgICAgICAgICAgY2hhbm5lbC5wdXNoKEVpdGhlci5MZWZ0KGBFcnJvciBvbiByZXBsYWNlOiBpbmNyZWFzZSBsZXR0ZXIgJHtsZXR0ZXJ9IC0tICR7ZXJyfSBgKSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKSAgXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICAoZXJyKSA9PiB7XG4gICAgICAgICAgY2hhbm5lbC5wdXNoKEVpdGhlci5MZWZ0KGBFcnJvciBvbiBmaW5kOiBpbmNyZWFzZSBsZXR0ZXIgJHtsZXR0ZXJ9IC0tICR7ZXJyfWApKSBcbiAgICAgICAgfVxuICAgICAgKVxuICAgIH0sXG4gICAgJ3Nob3cgY29tbWFuZHMnOiAoKSA9PiB7XG4gICAgICBjb25zdCBzdGF0ZSA9IChuYW1lcykgPT4ge1xuICAgICAgICByZXR1cm4gW25hbWVzLm1hcChuYW1lID0+IHtcbiAgICAgICAgICByZXR1cm4gaCgnYnV0dG9uJywgeyBvbjogeyBjbGljazogW21hbnVhbENvbW1hbmRFbnRyeSwgbmFtZV0gfSB9LCBuYW1lKVxuICAgICAgICB9KV1cbiAgICAgIH1cbiAgICAgIGNoYW5uZWwucHVzaChFaXRoZXIuUmlnaHQoc3RhdGUoUmVmbGVjdC5vd25LZXlzKF9jb21tYW5kcykpKSlcbiAgICB9XG4gIH1cbiAgLypcbiAgY29uc3Qgd3JhcHBlciA9IChmKSA9PiAoLi4uYXJncykgPT4ge1xuICAgIGNoYW5uZWwucHVzaChmKC4uLmFyZ3MpKVxuICB9XG4gIFxuICBmb3IgKGxldCBuYW1lIG9mIE9iamVjdC5rZXlzKF9jb21tYW5kcykpIHtcbiAgICBfY29tbWFuZHNbbmFtZV0gPSB3cmFwcGVyKF9jb21tYW5kc1tuYW1lXSlcbiAgfVxuICAqL1xuICByZXR1cm4gX2NvbW1hbmRzXG59IFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbW1hbmRzIiwiY29uc3QgZG9tX2V2ZW50cyA9ICh7ICRhY3RpdmF0ZUJ0biwgJHNob3dDb21tYW5kc0J0biB9KSA9PiAoYW5ueWFuZykgPT4ge1xuICByZXR1cm4ge1xuICAgICdjbGljayc6IFt7XG4gICAgICBlbGVtZW50OiAkYWN0aXZhdGVCdG4sXG4gICAgICBjYWxsYmFjazogZnVuY3Rpb24oXykge1xuICAgICAgICBpZiAoYW5ueWFuZy5pc0xpc3RlbmluZygpKSB7XG4gICAgICAgICAgYW5ueWFuZy5hYm9ydCgpXG4gICAgICAgICAgJGFjdGl2YXRlQnRuLnRleHRDb250ZW50ID0gJ1N0YXJ0J1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGFubnlhbmcuc3RhcnQoeyBhdXRvUmVzdGFydDogZmFsc2UsIGNvbnRpbnVvdXM6IHRydWUgfSlcbiAgICAgICAgICAkYWN0aXZhdGVCdG4udGV4dENvbnRlbnQgPSAnU3RvcCdcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sIHtcbiAgICAgIGVsZW1lbnQ6ICRzaG93Q29tbWFuZHNCdG4sXG4gICAgICBjYWxsYmFjazogZnVuY3Rpb24oXykge1xuICAgICAgICBhbm55YW5nLnRyaWdnZXIoJ3Nob3cgY29tbWFuZHMnKVxuICAgICAgfVxuICAgIH1dXG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkb21fZXZlbnRzIiwiY29uc3QgbWFudWFsQ29tbWFuZEVudHJ5ID0gKGFubnlhbmcpID0+IChjaGFubmVsKSA9PiB7XG4gIGNvbnN0IHsgRWl0aGVyIH0gPSByZXF1aXJlKCdmcC1saWInKVxuICBjb25zdCBlcnIgPSB7XG4gICAgMDogKGNtZCkgPT4gYENhbid0IGNvbXBsZXRlIFske2NtZH1dLiBNaXNzaW5nIHJlcXVpcmVkIGlucHV0LmAsXG4gICAgMTogKGNtZCwgbGVuKSA9PiBgQ2FuJ3QgY29tcGxldGUgWyR7Y21kfV0uIEl0IHJlcXVpcmVzIGV4YWN0bHkgJHtsZW59IGlucHV0cy5gXG4gIH1cbiAgY29uc3QgcmVneCA9IHtcbiAgICAwOiBuZXcgUmVnRXhwKC8oOlxcdyt8XFwqXFx3KykvLCAnZ2knKSwgLy8gaGFzIGNvbW1hbmQgYXJndW1lbnRzXG4gICAgMTogbmV3IFJlZ0V4cCgvKDpcXHcrKS8sICdnaScpLCAvLyBjb21tYW5kIGFyZ1xuICAgIDI6IG5ldyBSZWdFeHAoLyhcXCpcXHcrKS8sICdnaScpLCAvLyBjb21tYW5kIHNwbGF0XG4gICAgMzogbmV3IFJlZ0V4cCgvKFxcdyspLywgJ2dpJykgLy8gd29yZHNcbiAgfVxuICBjb25zdCBwcmVkID0ge1xuICAgIDA6ICh4KSA9PiB4ID09PSAnJyxcbiAgICAxOiAoeCwgeSkgPT4geC5sZW5ndGggIT09IHkubGVuZ3RoXG4gIH0gIFxuICBcbiAgLy86OiAoU3RyaW5nLCBTdHJpbmcpIC0+IEVpdGhlciBTdHJpbmcgbnVsbFxuICBjb25zdCBoYXNJbnB1dCA9ICh4LCBjbWQpID0+IHtcbiAgICBsZXQgcmVzdWx0ID0gbnVsbFxuICAgIFxuICAgIGlmIChwcmVkWzBdKHgpKSB7XG4gICAgICByZXN1bHQgPSBFaXRoZXIuTGVmdChlcnJbMF0oY21kKSlcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0ID0gRWl0aGVyLlJpZ2h0KG51bGwpXG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdFxuICB9XG4gIFxuICAvLzo6IChTdHJpbmcsIFN0cmluZykgLT4gRWl0aGVyIFN0cmluZyBudWxsIC0+IEVpdGhlciBTdHJpbmcgU3RyaW5nIFxuICBjb25zdCBoYXNDb3JyZWN0TnVtYmVyT2ZJbnB1dHMgPSAoeCwgY21kKSA9PiAoXykgPT4ge1xuICAgIC8vIGZpcnN0IGNoZWNrIGlmIGl0IGhhcyAnOmFyZ3MnXG4gICAgbGV0IGFyZ3MgPSBjbWQubWF0Y2gocmVneFsxXSlcbiAgICBsZXQgeHNcbiAgICBsZXQgaSA9IDAgIFxuICAgIFxuICAgIGlmIChhcmdzID09PSBudWxsKSB7XG4gICAgICBhcmdzID0gY21kLm1hdGNoKHJlZ3hbMl0pXG4gICAgICB4cyA9IFt4XVxuICAgIH0gZWxzZSB7XG4gICAgICB4cyA9IHgubWF0Y2gocmVneFszXSlcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIChwcmVkWzFdKHhzLCBhcmdzKSlcbiAgICAgID8gRWl0aGVyLkxlZnQoZXJyWzFdKGNtZCwgYXJncy5sZW5ndGgpKVxuICAgICAgOiBFaXRoZXIuUmlnaHQoY21kLnJlcGxhY2UocmVneFswXSwgKG1hdGNoKSA9PiB4c1tpKytdKSlcbiAgfVxuICBcbiAgLy86OiBTdHJpbmcgLT4gRWl0aGVyIFN0cmluZyBTdHJpbmdcbiAgY29uc3QgZ2V0VXNlcklucHV0ID0gKGNtZCkgPT4ge1xuICAgIGNvbnN0IHggPSB3aW5kb3cucHJvbXB0KGNtZClcbiAgICByZXR1cm4gaGFzSW5wdXQoeCwgY21kKS5jaGFpbihoYXNDb3JyZWN0TnVtYmVyT2ZJbnB1dHMoeCwgY21kKSlcbiAgfVxuICBcbiAgLy86OiBTdHJpbmcgLT4gQm9vbFxuICBjb25zdCByZXF1aXJlc0FyZ3VtZW50cyA9IChjbWQpID0+ICB7XG4gICAgcmV0dXJuIHJlZ3hbMF0udGVzdChjbWQpXG4gIH1cbiAgXG4gIC8vOjogU3RyaW5nIC0+IF8gIFxuICByZXR1cm4gKGNtZCkgPT4ge1xuICAgIGlmIChyZXF1aXJlc0FyZ3VtZW50cyhjbWQpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBnZXRVc2VySW5wdXQoY21kKVxuICAgICAgXG4gICAgICBFaXRoZXIuYmltYXBcbiAgICAgICAgKGxlZnQgPT4geyBjaGFubmVsLnB1c2gocmVzdWx0KSB9KVxuICAgICAgICAocmlnaHQgPT4geyBhbm55YW5nLnRyaWdnZXIocmlnaHQpIH0pXG4gICAgICAgIChyZXN1bHQpXG4gICAgICAgIFxuICAgIH0gZWxzZSB7XG4gICAgICBhbm55YW5nLnRyaWdnZXIoY21kKVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1hbnVhbENvbW1hbmRFbnRyeSIsImNvbnN0IHsgRWl0aGVyIH0gPSByZXF1aXJlKCdmcC1saWInKVxuXG5jb25zdCBTdGF0ZUNoYW5nZSA9IChTdGF0ZSkgPT4gKGNoYW5uZWwpID0+IChfKSA9PiB7XG4gIGNvbnN0IGVpdGhlcl9zdGF0ZSA9IGNoYW5uZWwuc2hpZnQoKVxuICBcbiAgaWYgKGVpdGhlcl9zdGF0ZSAhPT0gdW5kZWZpbmVkKSB7IFxuICAgIC8vIHBhc3MgaW50ZXJuYWwgZWl0aGVyIHZhbHVlIHRvIFN0YXRlLmNoYW5nZVxuICAgIEVpdGhlci5iaW1hcFxuICAgICAgKG1zZ3MgPT4geyAvLyBjdXJyZW50bHksIGl0IGlzIHNhbWUgYmVoYXZpb3IgZm9yIGVycm9yIHN0YXRlXG4gICAgICAgIFN0YXRlLmNoYW5nZSh7IGxvZ3M6IG1zZ3MgfSkgXG4gICAgICB9KVxuICAgICAgKG1zZ3MgPT4geyBcbiAgICAgICAgU3RhdGUuY2hhbmdlKHsgbG9nczogbXNncyB9KSBcbiAgICAgIH0pXG4gICAgICAoZWl0aGVyX3N0YXRlKSBcbiAgfVxuICAgIFxuICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKFN0YXRlQ2hhbmdlKFN0YXRlKShjaGFubmVsKSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZUNoYW5nZSIsImNvbnN0IGggPSByZXF1aXJlKCdzbmFiYmRvbS9oJylcbmxldCBfbG9ncyA9IFtdXG5sZXQgX2tleSA9IDBcblxuY29uc3QgbXlTdHlsZXMgPSB7XG4gIGZhZGVJbjoge1xuICAgIG9wYWNpdHk6ICcwJywgXG4gICAgdHJhbnNpdGlvbjogJ29wYWNpdHkgMXMnLCBcbiAgICBkZWxheWVkOiB7IG9wYWNpdHk6ICcxJ31cbiAgfVxufVxuXG5jb25zdCBjcmVhdGVMb2cgPSAobG9nKSA9PiB7XG4gIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZSgpXG4gIGNvbnN0IGxvZ19kYXRlID0gIGAke2RhdGUuZ2V0TW9udGgoKX0tJHtkYXRlLmdldERhdGUoKX0gQCAke2RhdGUuZ2V0SG91cnMoKX06JHtkYXRlLmdldE1pbnV0ZXMoKX1gXG5cbiAgcmV0dXJuIGgoJ2Rpdi5sb2cnLCB7XG4gICAgc3R5bGU6IG15U3R5bGVzLmZhZGVJbixcbiAgICBrZXk6IF9rZXkrK1xuICB9LCBbXG4gICAgaCgnc3Bhbi5sb2dfZGF0ZScsIGxvZ19kYXRlKSwgXG4gICAgaCgnc3Bhbi5sb2dfbXNnJywgbG9nKVxuICBdKVxufVxuXG5jb25zdCBTdGF0ZUNyZWF0b3IgPSAoeyBsb2dzIH0pID0+IHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KGxvZ3MpKSB7XG4gICAgbG9ncyA9IFtsb2dzXVxuICB9XG4gIF9sb2dzID0gbG9ncy5tYXAoY3JlYXRlTG9nKS5jb25jYXQoX2xvZ3MpXG4gIFxuICB3aGlsZSAoX2xvZ3MubGVuZ3RoID4gMzApIHtcbiAgICBfbG9ncy5zaGlmdCgpXG4gIH1cbiAgXG4gIHJldHVybiBoKCdkaXYjY29udGVudCcsIFtcbiAgICBoKCdkaXYjbG9ncycsIF9sb2dzKVxuICBdKVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlQ3JlYXRvciIsImNvbnN0IHNuYWJiZG9tID0gcmVxdWlyZSgnc25hYmJkb20nKVxuY29uc3QgcGF0Y2ggPSBzbmFiYmRvbS5pbml0KFsgLy8gSW5pdCBwYXRjaCBmdW5jdGlvbiB3aXRoIGNob29zZW4gbW9kdWxlc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL2NsYXNzJyksIC8vIG1ha2VzIGl0IGVhc3kgdG8gdG9nZ2xlIGNsYXNzZXNcbiAgcmVxdWlyZSgnc25hYmJkb20vbW9kdWxlcy9wcm9wcycpLCAvLyBmb3Igc2V0dGluZyBwcm9wZXJ0aWVzIG9uIERPTSBlbGVtZW50c1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL3N0eWxlJyksIC8vIGhhbmRsZXMgc3R5bGluZyBvbiBlbGVtZW50cyB3aXRoIHN1cHBvcnQgZm9yIGFuaW1hdGlvbnNcbiAgcmVxdWlyZSgnc25hYmJkb20vbW9kdWxlcy9ldmVudGxpc3RlbmVycycpLCAvLyBhdHRhY2hlcyBldmVudCBsaXN0ZW5lcnNcbl0pXG5cbmNvbnN0IGluaXQgPSAocGFyZW50Tm9kZSkgPT4gKFN0YXRlQ3JlYXRvcikgPT4gKGluaXRfcGFyYW1zKSA9PiB7XG4gIGxldCBfdnRyZWUgPSBwYXJlbnROb2RlXG5cbiAgY29uc3QgY2hhbmdlID0gKHN0YXRlKSA9PiB7XG4gICAgY29uc3QgbmV3X3Z0cmVlID0gU3RhdGVDcmVhdG9yKHN0YXRlKVxuICAgIHBhdGNoKF92dHJlZSwgbmV3X3Z0cmVlKVxuICAgIF92dHJlZSA9IG5ld192dHJlZVxuICB9XG4gIFxuICBjaGFuZ2UoaW5pdF9wYXJhbXMpXG4gIFxuICByZXR1cm4geyBjaGFuZ2UgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgaW5pdCB9IiwiXG5jb25zdCBTdGF0ZVN5c3RlbSA9IChjaGFubmVsKSA9PiB7XG4gIGNvbnN0IFN0YXRlQ2hhbmdlID0gcmVxdWlyZSgnLi9TdGF0ZUNoYW5nZScpXG4gIGNvbnN0IFN0YXRlTWFjaGluZSA9IHJlcXVpcmUoJy4vU3RhdGVNYWNoaW5lJylcbiAgY29uc3QgU3RhdGVDcmVhdG9yID0gcmVxdWlyZSgnLi9TdGF0ZUNyZWF0b3InKVxuICBjb25zdCAkY29udGVudFNwYWNlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NvbnRlbnQnKVxuICBjb25zdCBteVN0YXRlTWFjaGluZSA9IFN0YXRlTWFjaGluZS5pbml0KCRjb250ZW50U3BhY2UpKFN0YXRlQ3JlYXRvcikoeyBsb2dzOiBbXSB9KVxuICBjb25zdCBteVN0YXRlQ2hhbmdlID0gU3RhdGVDaGFuZ2UobXlTdGF0ZU1hY2hpbmUpKGNoYW5uZWwpXG4gIFxuICByZXR1cm4gbXlTdGF0ZUNoYW5nZSAgXG59XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVTeXN0ZW0iLCIvKmdsb2JhbCBIb3Jpem9uKi9cbmNvbnN0IGhvcml6b24gPSBIb3Jpem9uKClcbmNvbnN0IGFubnlhbmcgPSByZXF1aXJlKCdhbm55YW5nJylcbmNvbnN0IGNoYW5uZWwgPSBbXVxuXG5ob3Jpem9uLmNvbm5lY3QoKVxuYW5ueWFuZy5kZWJ1ZygpXG5nbG9iYWwuYW5ueWFuZyA9IGFubnlhbmdcbi8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4vLyBTZXR1cCBob3Jpem9uIHN0YXR1cyBpbmRpY2F0b3JcbntcbiAgY29uc3QgJGhlYWRlciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdoZWFkZXInKVxuICBob3Jpem9uLnN0YXR1cyhzdGF0dXMgPT4ge1xuICAgICRoZWFkZXIuY2xhc3NOYW1lID0gYHN0YXR1cy0ke3N0YXR1cy50eXBlfWBcbiAgfSlcbn1cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbi8vIFNldHVwIGFubnlhbmcgY2FsbGJhY2tzIGFuZCBkb20gZXZlbnRzXG57XG4gIGNvbnN0ICRhY3RpdmF0ZUJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhY3RpdmF0ZS1idG4nKVxuICBjb25zdCAkc2hvd0NvbW1hbmRzQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Nob3ctY29tbWFuZHMtYnRuJylcbiAgXG4gIGNvbnN0IG15Q2FsbGJhY2tzID0gcmVxdWlyZSgnLi9DYWxsYmFja3MnKSh7ICRhY3RpdmF0ZUJ0biB9KShjaGFubmVsKVxuICBjb25zdCBteURvbUV2ZW50cyA9IHJlcXVpcmUoJy4vRG9tRXZlbnRzJykoeyAkYWN0aXZhdGVCdG4sICRzaG93Q29tbWFuZHNCdG4gfSkoYW5ueWFuZylcbiAgXG4gIGZvciAodmFyIGNiIGluIG15Q2FsbGJhY2tzKSB7XG4gICAgYW5ueWFuZy5hZGRDYWxsYmFjayhjYiwgbXlDYWxsYmFja3NbY2JdKVxuICB9XG4gIGZvciAodmFyIHR5cGUgaW4gbXlEb21FdmVudHMpIHtcbiAgICBteURvbUV2ZW50c1t0eXBlXS5mb3JFYWNoKGV2ZW50ID0+IHtcbiAgICAgIGV2ZW50LmVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBldmVudC5jYWxsYmFjaylcbiAgICB9KVxuICB9XG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8gXG5cbi8vIFNldHVwIGFubnlhbmcgY29tbWFuZCBlbnRyeSBhbmQgbWFudWFsIGNvbW1hbmQgZW50cnlcbntcbiAgY29uc3QgbXlNYW51YWxDb21tYW5kRW50cnkgPSByZXF1aXJlKCcuL01hbnVhbENvbW1hbmRFbnRyeScpKGFubnlhbmcpKGNoYW5uZWwpXG4gIGNvbnN0IG15Q29tbWFuZHMgPSByZXF1aXJlKCcuL0NvbW1hbmRzJykoaG9yaXpvbikobXlNYW51YWxDb21tYW5kRW50cnkpKGNoYW5uZWwpXG4gIGFubnlhbmcuYWRkQ29tbWFuZHMobXlDb21tYW5kcylcbiAgZ2xvYmFsLm15Q29tbWFuZHMgPSBteUNvbW1hbmRzXG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8gXG5cbi8vIFNldHVwIHN0YXRlIG1hY2hpbmVcbntcbmNvbnN0IFN0YXRlU3lzdGVtID0gcmVxdWlyZSgnLi9TdGF0ZVN5c3RlbScpXG5jb25zdCBteVN0YXRlQ2hhbmdlID0gU3RhdGVTeXN0ZW0oY2hhbm5lbClcblxud2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShteVN0YXRlQ2hhbmdlKVxufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vICJdfQ==
