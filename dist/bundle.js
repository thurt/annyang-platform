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
const { Either } = require('fp-lib')

const StateChange = (channel) => (State) => (_) => {
  const either_state = channel.shift()
  
  if (either_state !== undefined) { 
    // pass internal either value to State.change
    Either.bimap
      (err_state => { // same behavior for error state
        State.change(err_state) 
      })
      (state => { 
        State.change(state) 
      })
      (either_state) 
  }
    
  window.requestAnimationFrame(StateChange(channel)(State))
}

module.exports = StateChange
},{"fp-lib":2}],15:[function(require,module,exports){
const h = require('snabbdom/h')

const StateCreator = ({
  errMsg,
  clogs
}) => {
  while (clogs.length > 30) {
    clogs.shift()
  }
  return h('div#content', [
      h('div#err', [errMsg||'']),
      h('div#clog', clogs ? clogs.map(log => h('span', [log])) : '')
    ])
}


module.exports = StateCreator
},{"snabbdom/h":5}],16:[function(require,module,exports){
const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with choosen modules
  require('snabbdom/modules/class'), // makes it easy to toggle classes
  require('snabbdom/modules/props'), // for setting properties on DOM elements
  require('snabbdom/modules/style'), // handles styling on elements with support for animations
  require('snabbdom/modules/eventlisteners'), // attaches event listeners
])

const init = (parentNode) => (StateCreator) => (init_params) => {
  var _vtree = parentNode

  const change = (state) => {

    const new_vtree = StateCreator(state)
    
    patch(_vtree, new_vtree)
    _vtree = new_vtree
  }
  
  change(init_params)
  
  return { change }
}

module.exports = { init }
},{"snabbdom":12,"snabbdom/modules/class":8,"snabbdom/modules/eventlisteners":9,"snabbdom/modules/props":10,"snabbdom/modules/style":11}],17:[function(require,module,exports){
const { pipe, Either } = require('fp-lib')
const fuzzyset = require('fuzzyset.js')
const annyang = require('annyang')
const channel = []

const $activateBtn = document.getElementById('activate-btn')
const $showCommandsBtn = document.getElementById('show-commands-btn')

const dom_events = {
  'click': [{
    element: $activateBtn,
    callback: function(_) {
      annyang.start({ autoRestart: false, continuous: false })
    }
  }, {
    element: $showCommandsBtn,
    callback: function(_) {
      annyang.trigger('show commands')
    }
  }]
}

const callbacks = {
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
 'resultNoMatch': (result) => {
   channel.push(Either.Left({ errMsg: `No command matches for ${result[0]}` }))
 },
 'end': () => {
   $activateBtn.disabled = false
   $activateBtn.textContent = 'Start'
 }
}

const commands = (data) => (horizon) => {
  const fuzzy_clients = fuzzyset(Object.keys(data.clients))
  const letters = horizon('letters')

 
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
    'increase :letter': (letter) => {
      letter = letter.toLowerCase()
      
      letters.find(letter).fetch().forEach(res => {
        console.log(res)
        if (res !== null) {
          letters.replace({ id: letter, count: res.count + 1 })
          return Either.Right(`increased letter ${letter} to ${res.count}`)
        } else {
          return Either.Left(`cannot increase letter ${letter} -- it does not exist`)
        }
      })
    },
    'show commands': () => {
      var clogs = data.clogs.slice()
      clogs.push(Reflect.ownKeys(_commands).join(', ') + '\n')
      return Either.Right({ clogs })
    },
    'clear screen': () => {
      return Either.Right({ clogs: [] })
    },
    'get current user': () => {
      letters.find('a').fetch().defaultIfEmpty().subscribe(res => {
        if (res !== null) {
          res.count++
          console.log(res)
        }
      })
    }
  }
  
  const wrapper = (f) => (...args) => {
    channel.push(f(...args))
  }
  
  for (let name of Object.keys(_commands)) {
    _commands[name] = wrapper(_commands[name])
  }
  return _commands
}

module.exports = { annyang, dom_events, callbacks, commands, channel }
},{"annyang":1,"fp-lib":2,"fuzzyset.js":3}],18:[function(require,module,exports){
(function (global){
/*global Horizon*/
const env = require('./annyangEnv')

const StateMachine = require('./StateMachine')
const StateChange = require('./StateChange')
const StateCreator = require('./StateCreator')
const data = {
  clients: {
     'Bob Jones': {},
     'Greg Harmon': {},
     'Leann Lewis': {},
     'Harmony Chostwitz': {}
   },
   clogs: []
}

const horizon = Horizon()
horizon.status(status => {
  document.getElementById('header').className = `status-${status.type}`
})
horizon.connect()


/////////////////////
const myCommands = env.commands(data)(horizon)
global.myCommands = myCommands
global.horizon = horizon
global.annyang = env.annyang

for (var cb in env.callbacks) {
  env.annyang.addCallback(cb, env.callbacks[cb])
}
for (var type in env.dom_events) {
  env.dom_events[type].forEach(event => {
    event.element.addEventListener(type, event.callback)
  })
}

/////////////////// 

const myState = StateMachine.init(document.getElementById('content'))(StateCreator)({
  errMsg: 'Poo',
  clogs: data.clogs
})


const myStateChange = StateChange(env.channel)(myState)

env.annyang.addCommands(myCommands)
env.annyang.debug()
window.requestAnimationFrame(myStateChange)

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./StateChange":14,"./StateCreator":15,"./StateMachine":16,"./annyangEnv":17}]},{},[18])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYW5ueWFuZy9hbm55YW5nLmpzIiwibm9kZV9tb2R1bGVzL2ZwLWxpYi9mcC1saWIuanMiLCJub2RlX21vZHVsZXMvZnV6enlzZXQuanMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZnV6enlzZXQuanMvbGliL2Z1enp5c2V0LmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2guanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaHRtbGRvbWFwaS5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9pcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL2NsYXNzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL21vZHVsZXMvZXZlbnRsaXN0ZW5lcnMuanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vbW9kdWxlcy9wcm9wcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL3N0eWxlLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3NuYWJiZG9tLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3Zub2RlLmpzIiwic3JjL1N0YXRlQ2hhbmdlLmpzIiwic3JjL1N0YXRlQ3JlYXRvci5qcyIsInNyYy9TdGF0ZU1hY2hpbmUuanMiLCJzcmMvYW5ueWFuZ0Vudi5qcyIsInNyYy9wbGF0Zm9ybS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDandCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFJBO0FBQ0E7O0FDREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaFNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8hIGFubnlhbmdcbi8vISB2ZXJzaW9uIDogMi40LjBcbi8vISBhdXRob3IgIDogVGFsIEF0ZXIgQFRhbEF0ZXJcbi8vISBsaWNlbnNlIDogTUlUXG4vLyEgaHR0cHM6Ly93d3cuVGFsQXRlci5jb20vYW5ueWFuZy9cbihmdW5jdGlvbiAocm9vdCwgZmFjdG9yeSkge1xuICBcInVzZSBzdHJpY3RcIjtcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkgeyAvLyBBTUQgKyBnbG9iYWxcbiAgICBkZWZpbmUoW10sIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiAocm9vdC5hbm55YW5nID0gZmFjdG9yeShyb290KSk7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIG1vZHVsZSA9PT0gJ29iamVjdCcgJiYgbW9kdWxlLmV4cG9ydHMpIHsgLy8gQ29tbW9uSlNcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3Rvcnkocm9vdCk7XG4gIH0gZWxzZSB7IC8vIEJyb3dzZXIgZ2xvYmFsc1xuICAgIHJvb3QuYW5ueWFuZyA9IGZhY3Rvcnkocm9vdCk7XG4gIH1cbn0odHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB0aGlzLCBmdW5jdGlvbiAocm9vdCwgdW5kZWZpbmVkKSB7XG4gIFwidXNlIHN0cmljdFwiO1xuXG4gIC8qKlxuICAgKiAjIFF1aWNrIFR1dG9yaWFsLCBJbnRybyBhbmQgRGVtb3NcbiAgICpcbiAgICogVGhlIHF1aWNrZXN0IHdheSB0byBnZXQgc3RhcnRlZCBpcyB0byB2aXNpdCB0aGUgW2FubnlhbmcgaG9tZXBhZ2VdKGh0dHBzOi8vd3d3LnRhbGF0ZXIuY29tL2FubnlhbmcvKS5cbiAgICpcbiAgICogRm9yIGEgbW9yZSBpbi1kZXB0aCBsb29rIGF0IGFubnlhbmcsIHJlYWQgb24uXG4gICAqXG4gICAqICMgQVBJIFJlZmVyZW5jZVxuICAgKi9cblxuICB2YXIgYW5ueWFuZztcblxuICAvLyBHZXQgdGhlIFNwZWVjaFJlY29nbml0aW9uIG9iamVjdCwgd2hpbGUgaGFuZGxpbmcgYnJvd3NlciBwcmVmaXhlc1xuICB2YXIgU3BlZWNoUmVjb2duaXRpb24gPSByb290LlNwZWVjaFJlY29nbml0aW9uIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJvb3Qud2Via2l0U3BlZWNoUmVjb2duaXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5tb3pTcGVlY2hSZWNvZ25pdGlvbiB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICByb290Lm1zU3BlZWNoUmVjb2duaXRpb24gfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcm9vdC5vU3BlZWNoUmVjb2duaXRpb247XG5cbiAgLy8gQ2hlY2sgYnJvd3NlciBzdXBwb3J0XG4gIC8vIFRoaXMgaXMgZG9uZSBhcyBlYXJseSBhcyBwb3NzaWJsZSwgdG8gbWFrZSBpdCBhcyBmYXN0IGFzIHBvc3NpYmxlIGZvciB1bnN1cHBvcnRlZCBicm93c2Vyc1xuICBpZiAoIVNwZWVjaFJlY29nbml0aW9uKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2YXIgY29tbWFuZHNMaXN0ID0gW107XG4gIHZhciByZWNvZ25pdGlvbjtcbiAgdmFyIGNhbGxiYWNrcyA9IHsgc3RhcnQ6IFtdLCBlcnJvcjogW10sIGVuZDogW10sIHJlc3VsdDogW10sIHJlc3VsdE1hdGNoOiBbXSwgcmVzdWx0Tm9NYXRjaDogW10sIGVycm9yTmV0d29yazogW10sIGVycm9yUGVybWlzc2lvbkJsb2NrZWQ6IFtdLCBlcnJvclBlcm1pc3Npb25EZW5pZWQ6IFtdIH07XG4gIHZhciBhdXRvUmVzdGFydDtcbiAgdmFyIGxhc3RTdGFydGVkQXQgPSAwO1xuICB2YXIgZGVidWdTdGF0ZSA9IGZhbHNlO1xuICB2YXIgZGVidWdTdHlsZSA9ICdmb250LXdlaWdodDogYm9sZDsgY29sb3I6ICMwMGY7JztcbiAgdmFyIHBhdXNlTGlzdGVuaW5nID0gZmFsc2U7XG4gIHZhciBpc0xpc3RlbmluZyA9IGZhbHNlO1xuXG4gIC8vIFRoZSBjb21tYW5kIG1hdGNoaW5nIGNvZGUgaXMgYSBtb2RpZmllZCB2ZXJzaW9uIG9mIEJhY2tib25lLlJvdXRlciBieSBKZXJlbXkgQXNoa2VuYXMsIHVuZGVyIHRoZSBNSVQgbGljZW5zZS5cbiAgdmFyIG9wdGlvbmFsUGFyYW0gPSAvXFxzKlxcKCguKj8pXFwpXFxzKi9nO1xuICB2YXIgb3B0aW9uYWxSZWdleCA9IC8oXFwoXFw/OlteKV0rXFwpKVxcPy9nO1xuICB2YXIgbmFtZWRQYXJhbSAgICA9IC8oXFwoXFw/KT86XFx3Ky9nO1xuICB2YXIgc3BsYXRQYXJhbSAgICA9IC9cXCpcXHcrL2c7XG4gIHZhciBlc2NhcGVSZWdFeHAgID0gL1tcXC17fVxcW1xcXSs/LixcXFxcXFxeJHwjXS9nO1xuICB2YXIgY29tbWFuZFRvUmVnRXhwID0gZnVuY3Rpb24oY29tbWFuZCkge1xuICAgIGNvbW1hbmQgPSBjb21tYW5kLnJlcGxhY2UoZXNjYXBlUmVnRXhwLCAnXFxcXCQmJylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKG9wdGlvbmFsUGFyYW0sICcoPzokMSk/JylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKG5hbWVkUGFyYW0sIGZ1bmN0aW9uKG1hdGNoLCBvcHRpb25hbCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gb3B0aW9uYWwgPyBtYXRjaCA6ICcoW15cXFxcc10rKSc7XG4gICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgLnJlcGxhY2Uoc3BsYXRQYXJhbSwgJyguKj8pJylcbiAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKG9wdGlvbmFsUmVnZXgsICdcXFxccyokMT9cXFxccyonKTtcbiAgICByZXR1cm4gbmV3IFJlZ0V4cCgnXicgKyBjb21tYW5kICsgJyQnLCAnaScpO1xuICB9O1xuXG4gIC8vIFRoaXMgbWV0aG9kIHJlY2VpdmVzIGFuIGFycmF5IG9mIGNhbGxiYWNrcyB0byBpdGVyYXRlIG92ZXIsIGFuZCBpbnZva2VzIGVhY2ggb2YgdGhlbVxuICB2YXIgaW52b2tlQ2FsbGJhY2tzID0gZnVuY3Rpb24oY2FsbGJhY2tzKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgIGNhbGxiYWNrcy5mb3JFYWNoKGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjay5jYWxsYmFjay5hcHBseShjYWxsYmFjay5jb250ZXh0LCBhcmdzKTtcbiAgICB9KTtcbiAgfTtcblxuICB2YXIgaXNJbml0aWFsaXplZCA9IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiByZWNvZ25pdGlvbiAhPT0gdW5kZWZpbmVkO1xuICB9O1xuXG4gIHZhciBpbml0SWZOZWVkZWQgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAoIWlzSW5pdGlhbGl6ZWQoKSkge1xuICAgICAgYW5ueWFuZy5pbml0KHt9LCBmYWxzZSk7XG4gICAgfVxuICB9O1xuXG4gIHZhciByZWdpc3RlckNvbW1hbmQgPSBmdW5jdGlvbihjb21tYW5kLCBjYiwgcGhyYXNlKSB7XG4gICAgY29tbWFuZHNMaXN0LnB1c2goeyBjb21tYW5kOiBjb21tYW5kLCBjYWxsYmFjazogY2IsIG9yaWdpbmFsUGhyYXNlOiBwaHJhc2UgfSk7XG4gICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdDb21tYW5kIHN1Y2Nlc3NmdWxseSBsb2FkZWQ6ICVjJytwaHJhc2UsIGRlYnVnU3R5bGUpO1xuICAgIH1cbiAgfTtcblxuICB2YXIgcGFyc2VSZXN1bHRzID0gZnVuY3Rpb24ocmVzdWx0cykge1xuICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3MucmVzdWx0LCByZXN1bHRzKTtcbiAgICB2YXIgY29tbWFuZFRleHQ7XG4gICAgLy8gZ28gb3ZlciBlYWNoIG9mIHRoZSA1IHJlc3VsdHMgYW5kIGFsdGVybmF0aXZlIHJlc3VsdHMgcmVjZWl2ZWQgKHdlJ3ZlIHNldCBtYXhBbHRlcm5hdGl2ZXMgdG8gNSBhYm92ZSlcbiAgICBmb3IgKHZhciBpID0gMDsgaTxyZXN1bHRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAvLyB0aGUgdGV4dCByZWNvZ25pemVkXG4gICAgICBjb21tYW5kVGV4dCA9IHJlc3VsdHNbaV0udHJpbSgpO1xuICAgICAgaWYgKGRlYnVnU3RhdGUpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1NwZWVjaCByZWNvZ25pemVkOiAlYycrY29tbWFuZFRleHQsIGRlYnVnU3R5bGUpO1xuICAgICAgfVxuXG4gICAgICAvLyB0cnkgYW5kIG1hdGNoIHJlY29nbml6ZWQgdGV4dCB0byBvbmUgb2YgdGhlIGNvbW1hbmRzIG9uIHRoZSBsaXN0XG4gICAgICBmb3IgKHZhciBqID0gMCwgbCA9IGNvbW1hbmRzTGlzdC5sZW5ndGg7IGogPCBsOyBqKyspIHtcbiAgICAgICAgdmFyIGN1cnJlbnRDb21tYW5kID0gY29tbWFuZHNMaXN0W2pdO1xuICAgICAgICB2YXIgcmVzdWx0ID0gY3VycmVudENvbW1hbmQuY29tbWFuZC5leGVjKGNvbW1hbmRUZXh0KTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgIHZhciBwYXJhbWV0ZXJzID0gcmVzdWx0LnNsaWNlKDEpO1xuICAgICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnY29tbWFuZCBtYXRjaGVkOiAlYycrY3VycmVudENvbW1hbmQub3JpZ2luYWxQaHJhc2UsIGRlYnVnU3R5bGUpO1xuICAgICAgICAgICAgaWYgKHBhcmFtZXRlcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCd3aXRoIHBhcmFtZXRlcnMnLCBwYXJhbWV0ZXJzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gZXhlY3V0ZSB0aGUgbWF0Y2hlZCBjb21tYW5kXG4gICAgICAgICAgY3VycmVudENvbW1hbmQuY2FsbGJhY2suYXBwbHkodGhpcywgcGFyYW1ldGVycyk7XG4gICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5yZXN1bHRNYXRjaCwgY29tbWFuZFRleHQsIGN1cnJlbnRDb21tYW5kLm9yaWdpbmFsUGhyYXNlLCByZXN1bHRzKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5yZXN1bHROb01hdGNoLCByZXN1bHRzKTtcbiAgfTtcblxuICBhbm55YW5nID0ge1xuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZSBhbm55YW5nIHdpdGggYSBsaXN0IG9mIGNvbW1hbmRzIHRvIHJlY29nbml6ZS5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiB2YXIgY29tbWFuZHMgPSB7J2hlbGxvIDpuYW1lJzogaGVsbG9GdW5jdGlvbn07XG4gICAgICogdmFyIGNvbW1hbmRzMiA9IHsnaGknOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKlxuICAgICAqIC8vIGluaXRpYWxpemUgYW5ueWFuZywgb3ZlcndyaXRpbmcgYW55IHByZXZpb3VzbHkgYWRkZWQgY29tbWFuZHNcbiAgICAgKiBhbm55YW5nLmluaXQoY29tbWFuZHMsIHRydWUpO1xuICAgICAqIC8vIGFkZHMgYW4gYWRkaXRpb25hbCBjb21tYW5kIHdpdGhvdXQgcmVtb3ZpbmcgdGhlIHByZXZpb3VzIGNvbW1hbmRzXG4gICAgICogYW5ueWFuZy5pbml0KGNvbW1hbmRzMiwgZmFsc2UpO1xuICAgICAqIGBgYGBcbiAgICAgKiBBcyBvZiB2MS4xLjAgaXQgaXMgbm8gbG9uZ2VyIHJlcXVpcmVkIHRvIGNhbGwgaW5pdCgpLiBKdXN0IHN0YXJ0KCkgbGlzdGVuaW5nIHdoZW5ldmVyIHlvdSB3YW50LCBhbmQgYWRkQ29tbWFuZHMoKSB3aGVuZXZlciwgYW5kIGFzIG9mdGVuIGFzIHlvdSBsaWtlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IGNvbW1hbmRzIC0gQ29tbWFuZHMgdGhhdCBhbm55YW5nIHNob3VsZCBsaXN0ZW4gdG9cbiAgICAgKiBAcGFyYW0ge2Jvb2xlYW59IFtyZXNldENvbW1hbmRzPXRydWVdIC0gUmVtb3ZlIGFsbCBjb21tYW5kcyBiZWZvcmUgaW5pdGlhbGl6aW5nP1xuICAgICAqIEBtZXRob2QgaW5pdFxuICAgICAqIEBkZXByZWNhdGVkXG4gICAgICogQHNlZSBbQ29tbWFuZHMgT2JqZWN0XSgjY29tbWFuZHMtb2JqZWN0KVxuICAgICAqL1xuICAgIGluaXQ6IGZ1bmN0aW9uKGNvbW1hbmRzLCByZXNldENvbW1hbmRzKSB7XG5cbiAgICAgIC8vIHJlc2V0Q29tbWFuZHMgZGVmYXVsdHMgdG8gdHJ1ZVxuICAgICAgaWYgKHJlc2V0Q29tbWFuZHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXNldENvbW1hbmRzID0gdHJ1ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc2V0Q29tbWFuZHMgPSAhIXJlc2V0Q29tbWFuZHM7XG4gICAgICB9XG5cbiAgICAgIC8vIEFib3J0IHByZXZpb3VzIGluc3RhbmNlcyBvZiByZWNvZ25pdGlvbiBhbHJlYWR5IHJ1bm5pbmdcbiAgICAgIGlmIChyZWNvZ25pdGlvbiAmJiByZWNvZ25pdGlvbi5hYm9ydCkge1xuICAgICAgICByZWNvZ25pdGlvbi5hYm9ydCgpO1xuICAgICAgfVxuXG4gICAgICAvLyBpbml0aWF0ZSBTcGVlY2hSZWNvZ25pdGlvblxuICAgICAgcmVjb2duaXRpb24gPSBuZXcgU3BlZWNoUmVjb2duaXRpb24oKTtcblxuICAgICAgLy8gU2V0IHRoZSBtYXggbnVtYmVyIG9mIGFsdGVybmF0aXZlIHRyYW5zY3JpcHRzIHRvIHRyeSBhbmQgbWF0Y2ggd2l0aCBhIGNvbW1hbmRcbiAgICAgIHJlY29nbml0aW9uLm1heEFsdGVybmF0aXZlcyA9IDU7XG5cbiAgICAgIC8vIEluIEhUVFBTLCB0dXJuIG9mZiBjb250aW51b3VzIG1vZGUgZm9yIGZhc3RlciByZXN1bHRzLlxuICAgICAgLy8gSW4gSFRUUCwgIHR1cm4gb24gIGNvbnRpbnVvdXMgbW9kZSBmb3IgbXVjaCBzbG93ZXIgcmVzdWx0cywgYnV0IG5vIHJlcGVhdGluZyBzZWN1cml0eSBub3RpY2VzXG4gICAgICByZWNvZ25pdGlvbi5jb250aW51b3VzID0gcm9vdC5sb2NhdGlvbi5wcm90b2NvbCA9PT0gJ2h0dHA6JztcblxuICAgICAgLy8gU2V0cyB0aGUgbGFuZ3VhZ2UgdG8gdGhlIGRlZmF1bHQgJ2VuLVVTJy4gVGhpcyBjYW4gYmUgY2hhbmdlZCB3aXRoIGFubnlhbmcuc2V0TGFuZ3VhZ2UoKVxuICAgICAgcmVjb2duaXRpb24ubGFuZyA9ICdlbi1VUyc7XG5cbiAgICAgIHJlY29nbml0aW9uLm9uc3RhcnQgICA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBpc0xpc3RlbmluZyA9IHRydWU7XG4gICAgICAgIGludm9rZUNhbGxiYWNrcyhjYWxsYmFja3Muc3RhcnQpO1xuICAgICAgfTtcblxuICAgICAgcmVjb2duaXRpb24ub25lcnJvciAgID0gZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvcik7XG4gICAgICAgIHN3aXRjaCAoZXZlbnQuZXJyb3IpIHtcbiAgICAgICAgY2FzZSAnbmV0d29yayc6XG4gICAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lcnJvck5ldHdvcmspO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdub3QtYWxsb3dlZCc6XG4gICAgICAgIGNhc2UgJ3NlcnZpY2Utbm90LWFsbG93ZWQnOlxuICAgICAgICAgIC8vIGlmIHBlcm1pc3Npb24gdG8gdXNlIHRoZSBtaWMgaXMgZGVuaWVkLCB0dXJuIG9mZiBhdXRvLXJlc3RhcnRcbiAgICAgICAgICBhdXRvUmVzdGFydCA9IGZhbHNlO1xuICAgICAgICAgIC8vIGRldGVybWluZSBpZiBwZXJtaXNzaW9uIHdhcyBkZW5pZWQgYnkgdXNlciBvciBhdXRvbWF0aWNhbGx5LlxuICAgICAgICAgIGlmIChuZXcgRGF0ZSgpLmdldFRpbWUoKS1sYXN0U3RhcnRlZEF0IDwgMjAwKSB7XG4gICAgICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLmVycm9yUGVybWlzc2lvbkJsb2NrZWQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnZva2VDYWxsYmFja3MoY2FsbGJhY2tzLmVycm9yUGVybWlzc2lvbkRlbmllZCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICByZWNvZ25pdGlvbi5vbmVuZCAgICAgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgaXNMaXN0ZW5pbmcgPSBmYWxzZTtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2tzKGNhbGxiYWNrcy5lbmQpO1xuICAgICAgICAvLyBhbm55YW5nIHdpbGwgYXV0byByZXN0YXJ0IGlmIGl0IGlzIGNsb3NlZCBhdXRvbWF0aWNhbGx5IGFuZCBub3QgYnkgdXNlciBhY3Rpb24uXG4gICAgICAgIGlmIChhdXRvUmVzdGFydCkge1xuICAgICAgICAgIC8vIHBsYXkgbmljZWx5IHdpdGggdGhlIGJyb3dzZXIsIGFuZCBuZXZlciByZXN0YXJ0IGFubnlhbmcgYXV0b21hdGljYWxseSBtb3JlIHRoYW4gb25jZSBwZXIgc2Vjb25kXG4gICAgICAgICAgdmFyIHRpbWVTaW5jZUxhc3RTdGFydCA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpLWxhc3RTdGFydGVkQXQ7XG4gICAgICAgICAgaWYgKHRpbWVTaW5jZUxhc3RTdGFydCA8IDEwMDApIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoYW5ueWFuZy5zdGFydCwgMTAwMC10aW1lU2luY2VMYXN0U3RhcnQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBhbm55YW5nLnN0YXJ0KCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICByZWNvZ25pdGlvbi5vbnJlc3VsdCAgPSBmdW5jdGlvbihldmVudCkge1xuICAgICAgICBpZihwYXVzZUxpc3RlbmluZykge1xuICAgICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU3BlZWNoIGhlYXJkLCBidXQgYW5ueWFuZyBpcyBwYXVzZWQnKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gTWFwIHRoZSByZXN1bHRzIHRvIGFuIGFycmF5XG4gICAgICAgIHZhciBTcGVlY2hSZWNvZ25pdGlvblJlc3VsdCA9IGV2ZW50LnJlc3VsdHNbZXZlbnQucmVzdWx0SW5kZXhdO1xuICAgICAgICB2YXIgcmVzdWx0cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBrID0gMDsgazxTcGVlY2hSZWNvZ25pdGlvblJlc3VsdC5sZW5ndGg7IGsrKykge1xuICAgICAgICAgIHJlc3VsdHNba10gPSBTcGVlY2hSZWNvZ25pdGlvblJlc3VsdFtrXS50cmFuc2NyaXB0O1xuICAgICAgICB9XG5cbiAgICAgICAgcGFyc2VSZXN1bHRzKHJlc3VsdHMpO1xuICAgICAgfTtcblxuICAgICAgLy8gYnVpbGQgY29tbWFuZHMgbGlzdFxuICAgICAgaWYgKHJlc2V0Q29tbWFuZHMpIHtcbiAgICAgICAgY29tbWFuZHNMaXN0ID0gW107XG4gICAgICB9XG4gICAgICBpZiAoY29tbWFuZHMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuYWRkQ29tbWFuZHMoY29tbWFuZHMpO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdGFydCBsaXN0ZW5pbmcuXG4gICAgICogSXQncyBhIGdvb2QgaWRlYSB0byBjYWxsIHRoaXMgYWZ0ZXIgYWRkaW5nIHNvbWUgY29tbWFuZHMgZmlyc3QsIGJ1dCBub3QgbWFuZGF0b3J5LlxuICAgICAqXG4gICAgICogUmVjZWl2ZXMgYW4gb3B0aW9uYWwgb3B0aW9ucyBvYmplY3Qgd2hpY2ggc3VwcG9ydHMgdGhlIGZvbGxvd2luZyBvcHRpb25zOlxuICAgICAqXG4gICAgICogLSBgYXV0b1Jlc3RhcnRgIChib29sZWFuLCBkZWZhdWx0OiB0cnVlKSBTaG91bGQgYW5ueWFuZyByZXN0YXJ0IGl0c2VsZiBpZiBpdCBpcyBjbG9zZWQgaW5kaXJlY3RseSwgYmVjYXVzZSBvZiBzaWxlbmNlIG9yIHdpbmRvdyBjb25mbGljdHM/XG4gICAgICogLSBgY29udGludW91c2AgIChib29sZWFuLCBkZWZhdWx0OiB1bmRlZmluZWQpIEFsbG93IGZvcmNpbmcgY29udGludW91cyBtb2RlIG9uIG9yIG9mZi4gQW5ueWFuZyBpcyBwcmV0dHkgc21hcnQgYWJvdXQgdGhpcywgc28gb25seSBzZXQgdGhpcyBpZiB5b3Uga25vdyB3aGF0IHlvdSdyZSBkb2luZy5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiAvLyBTdGFydCBsaXN0ZW5pbmcsIGRvbid0IHJlc3RhcnQgYXV0b21hdGljYWxseVxuICAgICAqIGFubnlhbmcuc3RhcnQoeyBhdXRvUmVzdGFydDogZmFsc2UgfSk7XG4gICAgICogLy8gU3RhcnQgbGlzdGVuaW5nLCBkb24ndCByZXN0YXJ0IGF1dG9tYXRpY2FsbHksIHN0b3AgcmVjb2duaXRpb24gYWZ0ZXIgZmlyc3QgcGhyYXNlIHJlY29nbml6ZWRcbiAgICAgKiBhbm55YW5nLnN0YXJ0KHsgYXV0b1Jlc3RhcnQ6IGZhbHNlLCBjb250aW51b3VzOiBmYWxzZSB9KTtcbiAgICAgKiBgYGBgXG4gICAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSAtIE9wdGlvbmFsIG9wdGlvbnMuXG4gICAgICogQG1ldGhvZCBzdGFydFxuICAgICAqL1xuICAgIHN0YXJ0OiBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICBwYXVzZUxpc3RlbmluZyA9IGZhbHNlO1xuICAgICAgaW5pdElmTmVlZGVkKCk7XG4gICAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICAgIGlmIChvcHRpb25zLmF1dG9SZXN0YXJ0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYXV0b1Jlc3RhcnQgPSAhIW9wdGlvbnMuYXV0b1Jlc3RhcnQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhdXRvUmVzdGFydCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZiAob3B0aW9ucy5jb250aW51b3VzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmVjb2duaXRpb24uY29udGludW91cyA9ICEhb3B0aW9ucy5jb250aW51b3VzO1xuICAgICAgfVxuXG4gICAgICBsYXN0U3RhcnRlZEF0ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gICAgICB0cnkge1xuICAgICAgICByZWNvZ25pdGlvbi5zdGFydCgpO1xuICAgICAgfSBjYXRjaChlKSB7XG4gICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coZS5tZXNzYWdlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTdG9wIGxpc3RlbmluZywgYW5kIHR1cm4gb2ZmIG1pYy5cbiAgICAgKlxuICAgICAqIEFsdGVybmF0aXZlbHksIHRvIG9ubHkgdGVtcG9yYXJpbHkgcGF1c2UgYW5ueWFuZyByZXNwb25kaW5nIHRvIGNvbW1hbmRzIHdpdGhvdXQgc3RvcHBpbmcgdGhlIFNwZWVjaFJlY29nbml0aW9uIGVuZ2luZSBvciBjbG9zaW5nIHRoZSBtaWMsIHVzZSBwYXVzZSgpIGluc3RlYWQuXG4gICAgICogQHNlZSBbcGF1c2UoKV0oI3BhdXNlKVxuICAgICAqXG4gICAgICogQG1ldGhvZCBhYm9ydFxuICAgICAqL1xuICAgIGFib3J0OiBmdW5jdGlvbigpIHtcbiAgICAgIGF1dG9SZXN0YXJ0ID0gZmFsc2U7XG4gICAgICBpZiAoaXNJbml0aWFsaXplZCgpKSB7XG4gICAgICAgIHJlY29nbml0aW9uLmFib3J0KCk7XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFBhdXNlIGxpc3RlbmluZy4gYW5ueWFuZyB3aWxsIHN0b3AgcmVzcG9uZGluZyB0byBjb21tYW5kcyAodW50aWwgdGhlIHJlc3VtZSBvciBzdGFydCBtZXRob2RzIGFyZSBjYWxsZWQpLCB3aXRob3V0IHR1cm5pbmcgb2ZmIHRoZSBicm93c2VyJ3MgU3BlZWNoUmVjb2duaXRpb24gZW5naW5lIG9yIHRoZSBtaWMuXG4gICAgICpcbiAgICAgKiBBbHRlcm5hdGl2ZWx5LCB0byBzdG9wIHRoZSBTcGVlY2hSZWNvZ25pdGlvbiBlbmdpbmUgYW5kIGNsb3NlIHRoZSBtaWMsIHVzZSBhYm9ydCgpIGluc3RlYWQuXG4gICAgICogQHNlZSBbYWJvcnQoKV0oI2Fib3J0KVxuICAgICAqXG4gICAgICogQG1ldGhvZCBwYXVzZVxuICAgICAqL1xuICAgIHBhdXNlOiBmdW5jdGlvbigpIHtcbiAgICAgIHBhdXNlTGlzdGVuaW5nID0gdHJ1ZTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVzdW1lcyBsaXN0ZW5pbmcgYW5kIHJlc3RvcmVzIGNvbW1hbmQgY2FsbGJhY2sgZXhlY3V0aW9uIHdoZW4gYSByZXN1bHQgbWF0Y2hlcy5cbiAgICAgKiBJZiBTcGVlY2hSZWNvZ25pdGlvbiB3YXMgYWJvcnRlZCAoc3RvcHBlZCksIHN0YXJ0IGl0LlxuICAgICAqXG4gICAgICogQG1ldGhvZCByZXN1bWVcbiAgICAgKi9cbiAgICByZXN1bWU6IGZ1bmN0aW9uKCkge1xuICAgICAgYW5ueWFuZy5zdGFydCgpO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBUdXJuIG9uIG91dHB1dCBvZiBkZWJ1ZyBtZXNzYWdlcyB0byB0aGUgY29uc29sZS4gVWdseSwgYnV0IHN1cGVyLWhhbmR5IVxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbbmV3U3RhdGU9dHJ1ZV0gLSBUdXJuIG9uL29mZiBkZWJ1ZyBtZXNzYWdlc1xuICAgICAqIEBtZXRob2QgZGVidWdcbiAgICAgKi9cbiAgICBkZWJ1ZzogZnVuY3Rpb24obmV3U3RhdGUpIHtcbiAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMCkge1xuICAgICAgICBkZWJ1Z1N0YXRlID0gISFuZXdTdGF0ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlYnVnU3RhdGUgPSB0cnVlO1xuICAgICAgfVxuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIGxhbmd1YWdlIHRoZSB1c2VyIHdpbGwgc3BlYWsgaW4uIElmIHRoaXMgbWV0aG9kIGlzIG5vdCBjYWxsZWQsIGRlZmF1bHRzIHRvICdlbi1VUycuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gbGFuZ3VhZ2UgLSBUaGUgbGFuZ3VhZ2UgKGxvY2FsZSlcbiAgICAgKiBAbWV0aG9kIHNldExhbmd1YWdlXG4gICAgICogQHNlZSBbTGFuZ3VhZ2VzXSgjbGFuZ3VhZ2VzKVxuICAgICAqL1xuICAgIHNldExhbmd1YWdlOiBmdW5jdGlvbihsYW5ndWFnZSkge1xuICAgICAgaW5pdElmTmVlZGVkKCk7XG4gICAgICByZWNvZ25pdGlvbi5sYW5nID0gbGFuZ3VhZ2U7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZCBjb21tYW5kcyB0aGF0IGFubnlhbmcgd2lsbCByZXNwb25kIHRvLiBTaW1pbGFyIGluIHN5bnRheCB0byBpbml0KCksIGJ1dCBkb2Vzbid0IHJlbW92ZSBleGlzdGluZyBjb21tYW5kcy5cbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiB2YXIgY29tbWFuZHMgPSB7J2hlbGxvIDpuYW1lJzogaGVsbG9GdW5jdGlvbiwgJ2hvd2R5JzogaGVsbG9GdW5jdGlvbn07XG4gICAgICogdmFyIGNvbW1hbmRzMiA9IHsnaGknOiBoZWxsb0Z1bmN0aW9ufTtcbiAgICAgKlxuICAgICAqIGFubnlhbmcuYWRkQ29tbWFuZHMoY29tbWFuZHMpO1xuICAgICAqIGFubnlhbmcuYWRkQ29tbWFuZHMoY29tbWFuZHMyKTtcbiAgICAgKiAvLyBhbm55YW5nIHdpbGwgbm93IGxpc3RlbiB0byBhbGwgdGhyZWUgY29tbWFuZHNcbiAgICAgKiBgYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gY29tbWFuZHMgLSBDb21tYW5kcyB0aGF0IGFubnlhbmcgc2hvdWxkIGxpc3RlbiB0b1xuICAgICAqIEBtZXRob2QgYWRkQ29tbWFuZHNcbiAgICAgKiBAc2VlIFtDb21tYW5kcyBPYmplY3RdKCNjb21tYW5kcy1vYmplY3QpXG4gICAgICovXG4gICAgYWRkQ29tbWFuZHM6IGZ1bmN0aW9uKGNvbW1hbmRzKSB7XG4gICAgICB2YXIgY2I7XG5cbiAgICAgIGluaXRJZk5lZWRlZCgpO1xuXG4gICAgICBmb3IgKHZhciBwaHJhc2UgaW4gY29tbWFuZHMpIHtcbiAgICAgICAgaWYgKGNvbW1hbmRzLmhhc093blByb3BlcnR5KHBocmFzZSkpIHtcbiAgICAgICAgICBjYiA9IHJvb3RbY29tbWFuZHNbcGhyYXNlXV0gfHwgY29tbWFuZHNbcGhyYXNlXTtcbiAgICAgICAgICBpZiAodHlwZW9mIGNiID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAvLyBjb252ZXJ0IGNvbW1hbmQgdG8gcmVnZXggdGhlbiByZWdpc3RlciB0aGUgY29tbWFuZFxuICAgICAgICAgICAgcmVnaXN0ZXJDb21tYW5kKGNvbW1hbmRUb1JlZ0V4cChwaHJhc2UpLCBjYiwgcGhyYXNlKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBjYiA9PT0gJ29iamVjdCcgJiYgY2IucmVnZXhwIGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgICAgICAvLyByZWdpc3RlciB0aGUgY29tbWFuZFxuICAgICAgICAgICAgcmVnaXN0ZXJDb21tYW5kKG5ldyBSZWdFeHAoY2IucmVnZXhwLnNvdXJjZSwgJ2knKSwgY2IuY2FsbGJhY2ssIHBocmFzZSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdDYW4gbm90IHJlZ2lzdGVyIGNvbW1hbmQ6ICVjJytwaHJhc2UsIGRlYnVnU3R5bGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZSBleGlzdGluZyBjb21tYW5kcy4gQ2FsbGVkIHdpdGggYSBzaW5nbGUgcGhyYXNlLCBhcnJheSBvZiBwaHJhc2VzLCBvciBtZXRob2RpY2FsbHkuIFBhc3Mgbm8gcGFyYW1zIHRvIHJlbW92ZSBhbGwgY29tbWFuZHMuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogdmFyIGNvbW1hbmRzID0geydoZWxsbyc6IGhlbGxvRnVuY3Rpb24sICdob3dkeSc6IGhlbGxvRnVuY3Rpb24sICdoaSc6IGhlbGxvRnVuY3Rpb259O1xuICAgICAqXG4gICAgICogLy8gUmVtb3ZlIGFsbCBleGlzdGluZyBjb21tYW5kc1xuICAgICAqIGFubnlhbmcucmVtb3ZlQ29tbWFuZHMoKTtcbiAgICAgKlxuICAgICAqIC8vIEFkZCBzb21lIGNvbW1hbmRzXG4gICAgICogYW5ueWFuZy5hZGRDb21tYW5kcyhjb21tYW5kcyk7XG4gICAgICpcbiAgICAgKiAvLyBEb24ndCByZXNwb25kIHRvIGhlbGxvXG4gICAgICogYW5ueWFuZy5yZW1vdmVDb21tYW5kcygnaGVsbG8nKTtcbiAgICAgKlxuICAgICAqIC8vIERvbid0IHJlc3BvbmQgdG8gaG93ZHkgb3IgaGlcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNvbW1hbmRzKFsnaG93ZHknLCAnaGknXSk7XG4gICAgICogYGBgYFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfEFycmF5fFVuZGVmaW5lZH0gW2NvbW1hbmRzVG9SZW1vdmVdIC0gQ29tbWFuZHMgdG8gcmVtb3ZlXG4gICAgICogQG1ldGhvZCByZW1vdmVDb21tYW5kc1xuICAgICAqL1xuICAgIHJlbW92ZUNvbW1hbmRzOiBmdW5jdGlvbihjb21tYW5kc1RvUmVtb3ZlKSB7XG4gICAgICBpZiAoY29tbWFuZHNUb1JlbW92ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbW1hbmRzTGlzdCA9IFtdO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjb21tYW5kc1RvUmVtb3ZlID0gQXJyYXkuaXNBcnJheShjb21tYW5kc1RvUmVtb3ZlKSA/IGNvbW1hbmRzVG9SZW1vdmUgOiBbY29tbWFuZHNUb1JlbW92ZV07XG4gICAgICBjb21tYW5kc0xpc3QgPSBjb21tYW5kc0xpc3QuZmlsdGVyKGZ1bmN0aW9uKGNvbW1hbmQpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGk8Y29tbWFuZHNUb1JlbW92ZS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmIChjb21tYW5kc1RvUmVtb3ZlW2ldID09PSBjb21tYW5kLm9yaWdpbmFsUGhyYXNlKSB7XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSk7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIEFkZCBhIGNhbGxiYWNrIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBpbiBjYXNlIG9uZSBvZiB0aGUgZm9sbG93aW5nIGV2ZW50cyBoYXBwZW5zOlxuICAgICAqXG4gICAgICogKiBgc3RhcnRgIC0gRmlyZWQgYXMgc29vbiBhcyB0aGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pdGlvbiBlbmdpbmUgc3RhcnRzIGxpc3RlbmluZ1xuICAgICAqICogYGVycm9yYCAtIEZpcmVkIHdoZW4gdGhlIGJyb3dzZXIncyBTcGVlY2ggUmVjb2dudGlvbiBlbmdpbmUgcmV0dXJucyBhbiBlcnJvciwgdGhpcyBnZW5lcmljIGVycm9yIGNhbGxiYWNrIHdpbGwgYmUgZm9sbG93ZWQgYnkgbW9yZSBhY2N1cmF0ZSBlcnJvciBjYWxsYmFja3MgKGJvdGggd2lsbCBmaXJlIGlmIGJvdGggYXJlIGRlZmluZWQpXG4gICAgICogKiBgZXJyb3JOZXR3b3JrYCAtIEZpcmVkIHdoZW4gU3BlZWNoIFJlY29nbml0aW9uIGZhaWxzIGJlY2F1c2Ugb2YgYSBuZXR3b3JrIGVycm9yXG4gICAgICogKiBgZXJyb3JQZXJtaXNzaW9uQmxvY2tlZGAgLSBGaXJlZCB3aGVuIHRoZSBicm93c2VyIGJsb2NrcyB0aGUgcGVybWlzc2lvbiByZXF1ZXN0IHRvIHVzZSBTcGVlY2ggUmVjb2duaXRpb24uXG4gICAgICogKiBgZXJyb3JQZXJtaXNzaW9uRGVuaWVkYCAtIEZpcmVkIHdoZW4gdGhlIHVzZXIgYmxvY2tzIHRoZSBwZXJtaXNzaW9uIHJlcXVlc3QgdG8gdXNlIFNwZWVjaCBSZWNvZ25pdGlvbi5cbiAgICAgKiAqIGBlbmRgIC0gRmlyZWQgd2hlbiB0aGUgYnJvd3NlcidzIFNwZWVjaCBSZWNvZ25pdGlvbiBlbmdpbmUgc3RvcHNcbiAgICAgKiAqIGByZXN1bHRgIC0gRmlyZWQgYXMgc29vbiBhcyBzb21lIHNwZWVjaCB3YXMgaWRlbnRpZmllZC4gVGhpcyBnZW5lcmljIGNhbGxiYWNrIHdpbGwgYmUgZm9sbG93ZWQgYnkgZWl0aGVyIHRoZSBgcmVzdWx0TWF0Y2hgIG9yIGByZXN1bHROb01hdGNoYCBjYWxsYmFja3MuXG4gICAgICogICAgIENhbGxiYWNrIGZ1bmN0aW9ucyByZWdpc3RlcmVkIHRvIHRoaXMgZXZlbnQgd2lsbCBpbmNsdWRlIGFuIGFycmF5IG9mIHBvc3NpYmxlIHBocmFzZXMgdGhlIHVzZXIgc2FpZCBhcyB0aGUgZmlyc3QgYXJndW1lbnRcbiAgICAgKiAqIGByZXN1bHRNYXRjaGAgLSBGaXJlZCB3aGVuIGFubnlhbmcgd2FzIGFibGUgdG8gbWF0Y2ggYmV0d2VlbiB3aGF0IHRoZSB1c2VyIHNhaWQgYW5kIGEgcmVnaXN0ZXJlZCBjb21tYW5kXG4gICAgICogICAgIENhbGxiYWNrIGZ1bmN0aW9ucyByZWdpc3RlcmVkIHRvIHRoaXMgZXZlbnQgd2lsbCBpbmNsdWRlIHRocmVlIGFyZ3VtZW50cyBpbiB0aGUgZm9sbG93aW5nIG9yZGVyOlxuICAgICAqICAgICAgICogVGhlIHBocmFzZSB0aGUgdXNlciBzYWlkIHRoYXQgbWF0Y2hlZCBhIGNvbW1hbmRcbiAgICAgKiAgICAgICAqIFRoZSBjb21tYW5kIHRoYXQgd2FzIG1hdGNoZWRcbiAgICAgKiAgICAgICAqIEFuIGFycmF5IG9mIHBvc3NpYmxlIGFsdGVybmF0aXZlIHBocmFzZXMgdGhlIHVzZXIgbWlnaHQndmUgc2FpZFxuICAgICAqICogYHJlc3VsdE5vTWF0Y2hgIC0gRmlyZWQgd2hlbiB3aGF0IHRoZSB1c2VyIHNhaWQgZGlkbid0IG1hdGNoIGFueSBvZiB0aGUgcmVnaXN0ZXJlZCBjb21tYW5kcy5cbiAgICAgKiAgICAgQ2FsbGJhY2sgZnVuY3Rpb25zIHJlZ2lzdGVyZWQgdG8gdGhpcyBldmVudCB3aWxsIGluY2x1ZGUgYW4gYXJyYXkgb2YgcG9zc2libGUgcGhyYXNlcyB0aGUgdXNlciBtaWdodCd2ZSBzYWlkIGFzIHRoZSBmaXJzdCBhcmd1bWVudFxuICAgICAqXG4gICAgICogIyMjIyBFeGFtcGxlczpcbiAgICAgKiBgYGBgamF2YXNjcmlwdFxuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2Vycm9yJywgZnVuY3Rpb24oKSB7XG4gICAgICogICAkKCcubXlFcnJvclRleHQnKS50ZXh0KCdUaGVyZSB3YXMgYW4gZXJyb3IhJyk7XG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBhbm55YW5nLmFkZENhbGxiYWNrKCdyZXN1bHRNYXRjaCcsIGZ1bmN0aW9uKHVzZXJTYWlkLCBjb21tYW5kVGV4dCwgcGhyYXNlcykge1xuICAgICAqICAgY29uc29sZS5sb2codXNlclNhaWQpOyAvLyBzYW1wbGUgb3V0cHV0OiAnaGVsbG8nXG4gICAgICogICBjb25zb2xlLmxvZyhjb21tYW5kVGV4dCk7IC8vIHNhbXBsZSBvdXRwdXQ6ICdoZWxsbyAodGhlcmUpJ1xuICAgICAqICAgY29uc29sZS5sb2cocGhyYXNlcyk7IC8vIHNhbXBsZSBvdXRwdXQ6IFsnaGVsbG8nLCAnaGFsbycsICd5ZWxsb3cnLCAncG9sbycsICdoZWxsbyBraXR0eSddXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBwYXNzIGxvY2FsIGNvbnRleHQgdG8gYSBnbG9iYWwgZnVuY3Rpb24gY2FsbGVkIG5vdENvbm5lY3RlZFxuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2Vycm9yTmV0d29yaycsIG5vdENvbm5lY3RlZCwgdGhpcyk7XG4gICAgICogYGBgYFxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIC0gTmFtZSBvZiBldmVudCB0aGF0IHdpbGwgdHJpZ2dlciB0aGlzIGNhbGxiYWNrXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgLSBUaGUgZnVuY3Rpb24gdG8gY2FsbCB3aGVuIGV2ZW50IGlzIHRyaWdnZXJlZFxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBbY29udGV4dF0gLSBPcHRpb25hbCBjb250ZXh0IGZvciB0aGUgY2FsbGJhY2sgZnVuY3Rpb25cbiAgICAgKiBAbWV0aG9kIGFkZENhbGxiYWNrXG4gICAgICovXG4gICAgYWRkQ2FsbGJhY2s6IGZ1bmN0aW9uKHR5cGUsIGNhbGxiYWNrLCBjb250ZXh0KSB7XG4gICAgICBpZiAoY2FsbGJhY2tzW3R5cGVdICA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHZhciBjYiA9IHJvb3RbY2FsbGJhY2tdIHx8IGNhbGxiYWNrO1xuICAgICAgaWYgKHR5cGVvZiBjYiAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBjYWxsYmFja3NbdHlwZV0ucHVzaCh7Y2FsbGJhY2s6IGNiLCBjb250ZXh0OiBjb250ZXh0IHx8IHRoaXN9KTtcbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlIGNhbGxiYWNrcyBmcm9tIGV2ZW50cy5cbiAgICAgKlxuICAgICAqIC0gUGFzcyBhbiBldmVudCBuYW1lIGFuZCBhIGNhbGxiYWNrIGNvbW1hbmQgdG8gcmVtb3ZlIHRoYXQgY2FsbGJhY2sgY29tbWFuZCBmcm9tIHRoYXQgZXZlbnQgdHlwZS5cbiAgICAgKiAtIFBhc3MganVzdCBhbiBldmVudCBuYW1lIHRvIHJlbW92ZSBhbGwgY2FsbGJhY2sgY29tbWFuZHMgZnJvbSB0aGF0IGV2ZW50IHR5cGUuXG4gICAgICogLSBQYXNzIHVuZGVmaW5lZCBhcyBldmVudCBuYW1lIGFuZCBhIGNhbGxiYWNrIGNvbW1hbmQgdG8gcmVtb3ZlIHRoYXQgY2FsbGJhY2sgY29tbWFuZCBmcm9tIGFsbCBldmVudCB0eXBlcy5cbiAgICAgKiAtIFBhc3Mgbm8gcGFyYW1zIHRvIHJlbW92ZSBhbGwgY2FsbGJhY2sgY29tbWFuZHMgZnJvbSBhbGwgZXZlbnQgdHlwZXMuXG4gICAgICpcbiAgICAgKiAjIyMjIEV4YW1wbGVzOlxuICAgICAqIGBgYGBqYXZhc2NyaXB0XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnc3RhcnQnLCBteUZ1bmN0aW9uMSk7XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnc3RhcnQnLCBteUZ1bmN0aW9uMik7XG4gICAgICogYW5ueWFuZy5hZGRDYWxsYmFjaygnZW5kJywgbXlGdW5jdGlvbjEpO1xuICAgICAqIGFubnlhbmcuYWRkQ2FsbGJhY2soJ2VuZCcsIG15RnVuY3Rpb24yKTtcbiAgICAgKlxuICAgICAqIC8vIFJlbW92ZSBhbGwgY2FsbGJhY2tzIGZyb20gYWxsIGV2ZW50czpcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNhbGxiYWNrKCk7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgYWxsIGNhbGxiYWNrcyBhdHRhY2hlZCB0byBlbmQgZXZlbnQ6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjaygnZW5kJyk7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgbXlGdW5jdGlvbjIgZnJvbSBiZWluZyBjYWxsZWQgb24gc3RhcnQ6XG4gICAgICogYW5ueWFuZy5yZW1vdmVDYWxsYmFjaygnc3RhcnQnLCBteUZ1bmN0aW9uMik7XG4gICAgICpcbiAgICAgKiAvLyBSZW1vdmUgbXlGdW5jdGlvbjEgZnJvbSBiZWluZyBjYWxsZWQgb24gYWxsIGV2ZW50czpcbiAgICAgKiBhbm55YW5nLnJlbW92ZUNhbGxiYWNrKHVuZGVmaW5lZCwgbXlGdW5jdGlvbjEpO1xuICAgICAqIGBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0eXBlIE5hbWUgb2YgZXZlbnQgdHlwZSB0byByZW1vdmUgY2FsbGJhY2sgZnJvbVxuICAgICAqIEBwYXJhbSBjYWxsYmFjayBUaGUgY2FsbGJhY2sgZnVuY3Rpb24gdG8gcmVtb3ZlXG4gICAgICogQHJldHVybnMgdW5kZWZpbmVkXG4gICAgICogQG1ldGhvZCByZW1vdmVDYWxsYmFja1xuICAgICAqL1xuICAgIHJlbW92ZUNhbGxiYWNrOiBmdW5jdGlvbih0eXBlLCBjYWxsYmFjaykge1xuICAgICAgdmFyIGNvbXBhcmVXaXRoQ2FsbGJhY2tQYXJhbWV0ZXIgPSBmdW5jdGlvbihjYikge1xuICAgICAgICByZXR1cm4gY2IuY2FsbGJhY2sgIT09IGNhbGxiYWNrO1xuICAgICAgfTtcbiAgICAgIC8vIEdvIG92ZXIgZWFjaCBjYWxsYmFjayB0eXBlIGluIGNhbGxiYWNrcyBzdG9yZSBvYmplY3RcbiAgICAgIGZvciAodmFyIGNhbGxiYWNrVHlwZSBpbiBjYWxsYmFja3MpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrcy5oYXNPd25Qcm9wZXJ0eShjYWxsYmFja1R5cGUpKSB7XG4gICAgICAgICAgLy8gaWYgdGhpcyBpcyB0aGUgdHlwZSB1c2VyIGFza2VkIHRvIGRlbGV0ZSwgb3IgaGUgYXNrZWQgdG8gZGVsZXRlIGFsbCwgZ28gYWhlYWQuXG4gICAgICAgICAgaWYgKHR5cGUgPT09IHVuZGVmaW5lZCB8fCB0eXBlID09PSBjYWxsYmFja1R5cGUpIHtcbiAgICAgICAgICAgIC8vIElmIHVzZXIgYXNrZWQgdG8gZGVsZXRlIGFsbCBjYWxsYmFja3MgaW4gdGhpcyB0eXBlIG9yIGFsbCB0eXBlc1xuICAgICAgICAgICAgaWYgKGNhbGxiYWNrID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFja3NbY2FsbGJhY2tUeXBlXSA9IFtdO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBhbGwgbWF0Y2hpbmcgY2FsbGJhY2tzXG4gICAgICAgICAgICAgICAgY2FsbGJhY2tzW2NhbGxiYWNrVHlwZV0gPSBjYWxsYmFja3NbY2FsbGJhY2tUeXBlXS5maWx0ZXIoY29tcGFyZVdpdGhDYWxsYmFja1BhcmFtZXRlcik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdHJ1ZSBpZiBzcGVlY2ggcmVjb2duaXRpb24gaXMgY3VycmVudGx5IG9uLlxuICAgICAqIFJldHVybnMgZmFsc2UgaWYgc3BlZWNoIHJlY29nbml0aW9uIGlzIG9mZiBvciBhbm55YW5nIGlzIHBhdXNlZC5cbiAgICAgKlxuICAgICAqIEByZXR1cm4gYm9vbGVhbiB0cnVlID0gU3BlZWNoUmVjb2duaXRpb24gaXMgb24gYW5kIGFubnlhbmcgaXMgbGlzdGVuaW5nXG4gICAgICogQG1ldGhvZCBpc0xpc3RlbmluZ1xuICAgICAqL1xuICAgIGlzTGlzdGVuaW5nOiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBpc0xpc3RlbmluZyAmJiAhcGF1c2VMaXN0ZW5pbmc7XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIGluc3RhbmNlIG9mIHRoZSBicm93c2VyJ3MgU3BlZWNoUmVjb2duaXRpb24gb2JqZWN0IHVzZWQgYnkgYW5ueWFuZy5cbiAgICAgKiBVc2VmdWwgaW4gY2FzZSB5b3Ugd2FudCBkaXJlY3QgYWNjZXNzIHRvIHRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbml0aW9uIGVuZ2luZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm5zIFNwZWVjaFJlY29nbml0aW9uIFRoZSBicm93c2VyJ3MgU3BlZWNoIFJlY29nbml6ZXIgY3VycmVudGx5IHVzZWQgYnkgYW5ueWFuZ1xuICAgICAqIEBtZXRob2QgZ2V0U3BlZWNoUmVjb2duaXplclxuICAgICAqL1xuICAgIGdldFNwZWVjaFJlY29nbml6ZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHJlY29nbml0aW9uO1xuICAgIH0sXG5cbiAgICAvKipcbiAgICAgKiBTaW11bGF0ZSBzcGVlY2ggYmVpbmcgcmVjb2duaXplZC4gVGhpcyB3aWxsIHRyaWdnZXIgdGhlIHNhbWUgZXZlbnRzIGFuZCBiZWhhdmlvciBhcyB3aGVuIHRoZSBTcGVlY2ggUmVjb2duaXRpb25cbiAgICAgKiBkZXRlY3RzIHNwZWVjaC5cbiAgICAgKlxuICAgICAqIENhbiBhY2NlcHQgZWl0aGVyIGEgc3RyaW5nIGNvbnRhaW5pbmcgYSBzaW5nbGUgc2VudGVuY2UsIG9yIGFuIGFycmF5IGNvbnRhaW5pbmcgbXVsdGlwbGUgc2VudGVuY2VzIHRvIGJlIGNoZWNrZWRcbiAgICAgKiBpbiBvcmRlciB1bnRpbCBvbmUgb2YgdGhlbSBtYXRjaGVzIGEgY29tbWFuZCAoc2ltaWxhciB0byB0aGUgd2F5IFNwZWVjaCBSZWNvZ25pdGlvbiBBbHRlcm5hdGl2ZXMgYXJlIHBhcnNlZClcbiAgICAgKlxuICAgICAqICMjIyMgRXhhbXBsZXM6XG4gICAgICogYGBgYGphdmFzY3JpcHRcbiAgICAgKiBhbm55YW5nLnRyaWdnZXIoJ1RpbWUgZm9yIHNvbWUgdGhyaWxsaW5nIGhlcm9pY3MnKTtcbiAgICAgKiBhbm55YW5nLnRyaWdnZXIoXG4gICAgICogICAgIFsnVGltZSBmb3Igc29tZSB0aHJpbGxpbmcgaGVyb2ljcycsICdUaW1lIGZvciBzb21lIHRocmlsbGluZyBhZXJvYmljcyddXG4gICAgICogICApO1xuICAgICAqIGBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSBzdHJpbmd8YXJyYXkgc2VudGVuY2VzIEEgc2VudGVuY2UgYXMgYSBzdHJpbmcgb3IgYW4gYXJyYXkgb2Ygc3RyaW5ncyBvZiBwb3NzaWJsZSBzZW50ZW5jZXNcbiAgICAgKiBAcmV0dXJucyB1bmRlZmluZWRcbiAgICAgKiBAbWV0aG9kIHRyaWdnZXJcbiAgICAgKi9cbiAgICB0cmlnZ2VyOiBmdW5jdGlvbihzZW50ZW5jZXMpIHtcbiAgICAgIC8qXG4gICAgICBpZighYW5ueWFuZy5pc0xpc3RlbmluZygpKSB7XG4gICAgICAgIGlmIChkZWJ1Z1N0YXRlKSB7XG4gICAgICAgICAgaWYgKCFpc0xpc3RlbmluZykge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ0Nhbm5vdCB0cmlnZ2VyIHdoaWxlIGFubnlhbmcgaXMgYWJvcnRlZCcpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnU3BlZWNoIGhlYXJkLCBidXQgYW5ueWFuZyBpcyBwYXVzZWQnKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgKi9cblxuICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHNlbnRlbmNlcykpIHtcbiAgICAgICAgc2VudGVuY2VzID0gW3NlbnRlbmNlc107XG4gICAgICB9XG5cbiAgICAgIHBhcnNlUmVzdWx0cyhzZW50ZW5jZXMpO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gYW5ueWFuZztcblxufSkpO1xuXG4vKipcbiAqICMgR29vZCB0byBLbm93XG4gKlxuICogIyMgQ29tbWFuZHMgT2JqZWN0XG4gKlxuICogQm90aCB0aGUgW2luaXQoKV0oKSBhbmQgYWRkQ29tbWFuZHMoKSBtZXRob2RzIHJlY2VpdmUgYSBgY29tbWFuZHNgIG9iamVjdC5cbiAqXG4gKiBhbm55YW5nIHVuZGVyc3RhbmRzIGNvbW1hbmRzIHdpdGggYG5hbWVkIHZhcmlhYmxlc2AsIGBzcGxhdHNgLCBhbmQgYG9wdGlvbmFsIHdvcmRzYC5cbiAqXG4gKiAqIFVzZSBgbmFtZWQgdmFyaWFibGVzYCBmb3Igb25lIHdvcmQgYXJndW1lbnRzIGluIHlvdXIgY29tbWFuZC5cbiAqICogVXNlIGBzcGxhdHNgIHRvIGNhcHR1cmUgbXVsdGktd29yZCB0ZXh0IGF0IHRoZSBlbmQgb2YgeW91ciBjb21tYW5kIChncmVlZHkpLlxuICogKiBVc2UgYG9wdGlvbmFsIHdvcmRzYCBvciBwaHJhc2VzIHRvIGRlZmluZSBhIHBhcnQgb2YgdGhlIGNvbW1hbmQgYXMgb3B0aW9uYWwuXG4gKlxuICogIyMjIyBFeGFtcGxlczpcbiAqIGBgYGBodG1sXG4gKiA8c2NyaXB0PlxuICogdmFyIGNvbW1hbmRzID0ge1xuICogICAvLyBhbm55YW5nIHdpbGwgY2FwdHVyZSBhbnl0aGluZyBhZnRlciBhIHNwbGF0ICgqKSBhbmQgcGFzcyBpdCB0byB0aGUgZnVuY3Rpb24uXG4gKiAgIC8vIGUuZy4gc2F5aW5nIFwiU2hvdyBtZSBCYXRtYW4gYW5kIFJvYmluXCIgd2lsbCBjYWxsIHNob3dGbGlja3IoJ0JhdG1hbiBhbmQgUm9iaW4nKTtcbiAqICAgJ3Nob3cgbWUgKnRhZyc6IHNob3dGbGlja3IsXG4gKlxuICogICAvLyBBIG5hbWVkIHZhcmlhYmxlIGlzIGEgb25lIHdvcmQgdmFyaWFibGUsIHRoYXQgY2FuIGZpdCBhbnl3aGVyZSBpbiB5b3VyIGNvbW1hbmQuXG4gKiAgIC8vIGUuZy4gc2F5aW5nIFwiY2FsY3VsYXRlIE9jdG9iZXIgc3RhdHNcIiB3aWxsIGNhbGwgY2FsY3VsYXRlU3RhdHMoJ09jdG9iZXInKTtcbiAqICAgJ2NhbGN1bGF0ZSA6bW9udGggc3RhdHMnOiBjYWxjdWxhdGVTdGF0cyxcbiAqXG4gKiAgIC8vIEJ5IGRlZmluaW5nIGEgcGFydCBvZiB0aGUgZm9sbG93aW5nIGNvbW1hbmQgYXMgb3B0aW9uYWwsIGFubnlhbmcgd2lsbCByZXNwb25kXG4gKiAgIC8vIHRvIGJvdGg6IFwic2F5IGhlbGxvIHRvIG15IGxpdHRsZSBmcmllbmRcIiBhcyB3ZWxsIGFzIFwic2F5IGhlbGxvIGZyaWVuZFwiXG4gKiAgICdzYXkgaGVsbG8gKHRvIG15IGxpdHRsZSkgZnJpZW5kJzogZ3JlZXRpbmdcbiAqIH07XG4gKlxuICogdmFyIHNob3dGbGlja3IgPSBmdW5jdGlvbih0YWcpIHtcbiAqICAgdmFyIHVybCA9ICdodHRwOi8vYXBpLmZsaWNrci5jb20vc2VydmljZXMvcmVzdC8/dGFncz0nK3RhZztcbiAqICAgJC5nZXRKU09OKHVybCk7XG4gKiB9XG4gKlxuICogdmFyIGNhbGN1bGF0ZVN0YXRzID0gZnVuY3Rpb24obW9udGgpIHtcbiAqICAgJCgnI3N0YXRzJykudGV4dCgnU3RhdGlzdGljcyBmb3IgJyttb250aCk7XG4gKiB9XG4gKlxuICogdmFyIGdyZWV0aW5nID0gZnVuY3Rpb24oKSB7XG4gKiAgICQoJyNncmVldGluZycpLnRleHQoJ0hlbGxvIScpO1xuICogfVxuICogPC9zY3JpcHQ+XG4gKiBgYGBgXG4gKlxuICogIyMjIFVzaW5nIFJlZ3VsYXIgRXhwcmVzc2lvbnMgaW4gY29tbWFuZHNcbiAqIEZvciBhZHZhbmNlZCBjb21tYW5kcywgeW91IGNhbiBwYXNzIGEgcmVndWxhciBleHByZXNzaW9uIG9iamVjdCwgaW5zdGVhZCBvZlxuICogYSBzaW1wbGUgc3RyaW5nIGNvbW1hbmQuXG4gKlxuICogVGhpcyBpcyBkb25lIGJ5IHBhc3NpbmcgYW4gb2JqZWN0IGNvbnRhaW5pbmcgdHdvIHByb3BlcnRpZXM6IGByZWdleHBgLCBhbmRcbiAqIGBjYWxsYmFja2AgaW5zdGVhZCBvZiB0aGUgZnVuY3Rpb24uXG4gKlxuICogIyMjIyBFeGFtcGxlczpcbiAqIGBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgY2FsY3VsYXRlRnVuY3Rpb24gPSBmdW5jdGlvbihtb250aCkgeyBjb25zb2xlLmxvZyhtb250aCk7IH1cbiAqIHZhciBjb21tYW5kcyA9IHtcbiAqICAgLy8gVGhpcyBleGFtcGxlIHdpbGwgYWNjZXB0IGFueSB3b3JkIGFzIHRoZSBcIm1vbnRoXCJcbiAqICAgJ2NhbGN1bGF0ZSA6bW9udGggc3RhdHMnOiBjYWxjdWxhdGVGdW5jdGlvbixcbiAqICAgLy8gVGhpcyBleGFtcGxlIHdpbGwgb25seSBhY2NlcHQgbW9udGhzIHdoaWNoIGFyZSBhdCB0aGUgc3RhcnQgb2YgYSBxdWFydGVyXG4gKiAgICdjYWxjdWxhdGUgOnF1YXJ0ZXIgc3RhdHMnOiB7J3JlZ2V4cCc6IC9eY2FsY3VsYXRlIChKYW51YXJ5fEFwcmlsfEp1bHl8T2N0b2Jlcikgc3RhdHMkLywgJ2NhbGxiYWNrJzogY2FsY3VsYXRlRnVuY3Rpb259XG4gKiB9XG4gYGBgYFxuICpcbiAqICMjIExhbmd1YWdlc1xuICpcbiAqIFdoaWxlIHRoZXJlIGlzbid0IGFuIG9mZmljaWFsIGxpc3Qgb2Ygc3VwcG9ydGVkIGxhbmd1YWdlcyAoY3VsdHVyZXM/IGxvY2FsZXM/KSwgaGVyZSBpcyBhIGxpc3QgYmFzZWQgb24gW2FuZWNkb3RhbCBldmlkZW5jZV0oaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL2EvMTQzMDIxMzQvMzM4MDM5KS5cbiAqXG4gKiAqIEFmcmlrYWFucyBgYWZgXG4gKiAqIEJhc3F1ZSBgZXVgXG4gKiAqIEJ1bGdhcmlhbiBgYmdgXG4gKiAqIENhdGFsYW4gYGNhYFxuICogKiBBcmFiaWMgKEVneXB0KSBgYXItRUdgXG4gKiAqIEFyYWJpYyAoSm9yZGFuKSBgYXItSk9gXG4gKiAqIEFyYWJpYyAoS3V3YWl0KSBgYXItS1dgXG4gKiAqIEFyYWJpYyAoTGViYW5vbikgYGFyLUxCYFxuICogKiBBcmFiaWMgKFFhdGFyKSBgYXItUUFgXG4gKiAqIEFyYWJpYyAoVUFFKSBgYXItQUVgXG4gKiAqIEFyYWJpYyAoTW9yb2NjbykgYGFyLU1BYFxuICogKiBBcmFiaWMgKElyYXEpIGBhci1JUWBcbiAqICogQXJhYmljIChBbGdlcmlhKSBgYXItRFpgXG4gKiAqIEFyYWJpYyAoQmFocmFpbikgYGFyLUJIYFxuICogKiBBcmFiaWMgKEx5YmlhKSBgYXItTFlgXG4gKiAqIEFyYWJpYyAoT21hbikgYGFyLU9NYFxuICogKiBBcmFiaWMgKFNhdWRpIEFyYWJpYSkgYGFyLVNBYFxuICogKiBBcmFiaWMgKFR1bmlzaWEpIGBhci1UTmBcbiAqICogQXJhYmljIChZZW1lbikgYGFyLVlFYFxuICogKiBDemVjaCBgY3NgXG4gKiAqIER1dGNoIGBubC1OTGBcbiAqICogRW5nbGlzaCAoQXVzdHJhbGlhKSBgZW4tQVVgXG4gKiAqIEVuZ2xpc2ggKENhbmFkYSkgYGVuLUNBYFxuICogKiBFbmdsaXNoIChJbmRpYSkgYGVuLUlOYFxuICogKiBFbmdsaXNoIChOZXcgWmVhbGFuZCkgYGVuLU5aYFxuICogKiBFbmdsaXNoIChTb3V0aCBBZnJpY2EpIGBlbi1aQWBcbiAqICogRW5nbGlzaChVSykgYGVuLUdCYFxuICogKiBFbmdsaXNoKFVTKSBgZW4tVVNgXG4gKiAqIEZpbm5pc2ggYGZpYFxuICogKiBGcmVuY2ggYGZyLUZSYFxuICogKiBHYWxpY2lhbiBgZ2xgXG4gKiAqIEdlcm1hbiBgZGUtREVgXG4gKiAqIEhlYnJldyBgaGVgXG4gKiAqIEh1bmdhcmlhbiBgaHVgXG4gKiAqIEljZWxhbmRpYyBgaXNgXG4gKiAqIEl0YWxpYW4gYGl0LUlUYFxuICogKiBJbmRvbmVzaWFuIGBpZGBcbiAqICogSmFwYW5lc2UgYGphYFxuICogKiBLb3JlYW4gYGtvYFxuICogKiBMYXRpbiBgbGFgXG4gKiAqIE1hbmRhcmluIENoaW5lc2UgYHpoLUNOYFxuICogKiBUcmFkaXRpb25hbCBUYWl3YW4gYHpoLVRXYFxuICogKiBTaW1wbGlmaWVkIENoaW5hIHpoLUNOIGA/YFxuICogKiBTaW1wbGlmaWVkIEhvbmcgS29uZyBgemgtSEtgXG4gKiAqIFl1ZSBDaGluZXNlIChUcmFkaXRpb25hbCBIb25nIEtvbmcpIGB6aC15dWVgXG4gKiAqIE1hbGF5c2lhbiBgbXMtTVlgXG4gKiAqIE5vcndlZ2lhbiBgbm8tTk9gXG4gKiAqIFBvbGlzaCBgcGxgXG4gKiAqIFBpZyBMYXRpbiBgeHgtcGlnbGF0aW5gXG4gKiAqIFBvcnR1Z3Vlc2UgYHB0LVBUYFxuICogKiBQb3J0dWd1ZXNlIChCcmFzaWwpIGBwdC1CUmBcbiAqICogUm9tYW5pYW4gYHJvLVJPYFxuICogKiBSdXNzaWFuIGBydWBcbiAqICogU2VyYmlhbiBgc3ItU1BgXG4gKiAqIFNsb3ZhayBgc2tgXG4gKiAqIFNwYW5pc2ggKEFyZ2VudGluYSkgYGVzLUFSYFxuICogKiBTcGFuaXNoIChCb2xpdmlhKSBgZXMtQk9gXG4gKiAqIFNwYW5pc2ggKENoaWxlKSBgZXMtQ0xgXG4gKiAqIFNwYW5pc2ggKENvbG9tYmlhKSBgZXMtQ09gXG4gKiAqIFNwYW5pc2ggKENvc3RhIFJpY2EpIGBlcy1DUmBcbiAqICogU3BhbmlzaCAoRG9taW5pY2FuIFJlcHVibGljKSBgZXMtRE9gXG4gKiAqIFNwYW5pc2ggKEVjdWFkb3IpIGBlcy1FQ2BcbiAqICogU3BhbmlzaCAoRWwgU2FsdmFkb3IpIGBlcy1TVmBcbiAqICogU3BhbmlzaCAoR3VhdGVtYWxhKSBgZXMtR1RgXG4gKiAqIFNwYW5pc2ggKEhvbmR1cmFzKSBgZXMtSE5gXG4gKiAqIFNwYW5pc2ggKE1leGljbykgYGVzLU1YYFxuICogKiBTcGFuaXNoIChOaWNhcmFndWEpIGBlcy1OSWBcbiAqICogU3BhbmlzaCAoUGFuYW1hKSBgZXMtUEFgXG4gKiAqIFNwYW5pc2ggKFBhcmFndWF5KSBgZXMtUFlgXG4gKiAqIFNwYW5pc2ggKFBlcnUpIGBlcy1QRWBcbiAqICogU3BhbmlzaCAoUHVlcnRvIFJpY28pIGBlcy1QUmBcbiAqICogU3BhbmlzaCAoU3BhaW4pIGBlcy1FU2BcbiAqICogU3BhbmlzaCAoVVMpIGBlcy1VU2BcbiAqICogU3BhbmlzaCAoVXJ1Z3VheSkgYGVzLVVZYFxuICogKiBTcGFuaXNoIChWZW5lenVlbGEpIGBlcy1WRWBcbiAqICogU3dlZGlzaCBgc3YtU0VgXG4gKiAqIFR1cmtpc2ggYHRyYFxuICogKiBadWx1IGB6dWBcbiAqXG4gKiAjIyBEZXZlbG9waW5nXG4gKlxuICogUHJlcmVxdWlzaXRpZXM6IG5vZGUuanNcbiAqXG4gKiBGaXJzdCwgaW5zdGFsbCBkZXBlbmRlbmNpZXMgaW4geW91ciBsb2NhbCBhbm55YW5nIGNvcHk6XG4gKlxuICogICAgIG5wbSBpbnN0YWxsXG4gKlxuICogTWFrZSBzdXJlIHRvIHJ1biB0aGUgZGVmYXVsdCBncnVudCB0YXNrIGFmdGVyIGVhY2ggY2hhbmdlIHRvIGFubnlhbmcuanMuIFRoaXMgY2FuIGFsc28gYmUgZG9uZSBhdXRvbWF0aWNhbGx5IGJ5IHJ1bm5pbmc6XG4gKlxuICogICAgIGdydW50IHdhdGNoXG4gKlxuICogWW91IGNhbiBhbHNvIHJ1biBhIGxvY2FsIHNlcnZlciBmb3IgdGVzdGluZyB5b3VyIHdvcmsgd2l0aDpcbiAqXG4gKiAgICAgZ3J1bnQgZGV2XG4gKlxuICogUG9pbnQgeW91ciBicm93c2VyIHRvIGBodHRwczovL2xvY2FsaG9zdDo4NDQzL2RlbW8vYCB0byBzZWUgdGhlIGRlbW8gcGFnZS5cbiAqIFNpbmNlIGl0J3MgdXNpbmcgc2VsZi1zaWduZWQgY2VydGlmaWNhdGUsIHlvdSBtaWdodCBuZWVkIHRvIGNsaWNrICpcIlByb2NlZWQgQW55d2F5XCIqLlxuICpcbiAqIEZvciBtb3JlIGluZm8sIGNoZWNrIG91dCB0aGUgW0NPTlRSSUJVVElOR10oaHR0cHM6Ly9naXRodWIuY29tL1RhbEF0ZXIvYW5ueWFuZy9ibG9iL21hc3Rlci9DT05UUklCVVRJTkcubWQpIGZpbGVcbiAqXG4gKi9cbiIsIi8vIEZVTkNUSU9OUyAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4vLzo6IGEgLT4gYVxuY29uc3QgdHJhY2UgPSAoeCkgPT4ge1xuICBjb25zb2xlLmxvZyh4KVxuICByZXR1cm4geFxufVxuXG4vLzo6ICgoYSwgYiwgLi4uIC0+IGUpLCAoZSAtPiBmKSwgLi4uLCAoeSAtPiB6KSkgLT4gKGEsIGIsIC4uLikgLT4gelxuY29uc3QgcGlwZSA9ICguLi5mbnMpID0+ICguLi54cykgPT4ge1xuICByZXR1cm4gZm5zXG4gICAgLnNsaWNlKDEpXG4gICAgLnJlZHVjZSgoeCwgZm4pID0+IGZuKHgpLCBmbnNbMF0oLi4ueHMpKVxufVxuY29uc3QgcGlwZVAgPSAoLi4uZm5zKSA9PiAoLi4ueHMpID0+IHtcbiAgcmV0dXJuIGZuc1xuICAgIC5zbGljZSgxKVxuICAgIC5yZWR1Y2UoKHhQLCBmbikgPT4geFAudGhlbihmbiksIFByb21pc2UucmVzb2x2ZShmbnNbMF0oLi4ueHMpKSlcbn1cblxuLy86OiAoYSAtPiBiKSAtPiBbYV0gLT4gW2JdXG5jb25zdCBtYXAgPSAoZm4pID0+IChmKSA9PiB7XG4gIHJldHVybiBmLm1hcChmbilcbn1cblxuLy86OiBbYV0gLT4gW2FdIC0+IFthXVxuY29uc3QgaW50ZXJzZWN0aW9uID0gKHhzKSA9PiAoeHMyKSA9PiB7XG4gIHJldHVybiB4cy5maWx0ZXIoeCA9PiB4czIuaW5jbHVkZXMoeCkpXG59XG5cbi8vOjogW2FdIC0+IFthXSAtPiBbYV1cbmNvbnN0IGRpZmZlcmVuY2UgPSAoeHMpID0+ICh4czIpID0+IHtcbiAgcmV0dXJuIHhzLmZpbHRlcih4ID0+ICF4czIuaW5jbHVkZXMoeCkpXG59XG5cbi8vOjogWyhhLCBiLCAuLi4pIC0+IG5dIC0+IFthLCBiLCAuLi5dIC0+IFtuXVxuY29uc3QgYXBwbHlGdW5jdGlvbnMgPSAoZm5zKSA9PiAoeHMpID0+IHtcbiAgcmV0dXJuIGZucy5tYXAoZm4gPT5cbiAgICB4cy5zbGljZSgxKS5yZWR1Y2UoKHBhcnRpYWwsIHgpID0+IHBhcnRpYWwoeCksIGZuKHhzWzBdKSkpXG59XG5cbi8vOjogW2FdIC0+IGFcbmNvbnN0IGxhc3QgPSAoeHMpID0+IHtcbiAgcmV0dXJuIHhzW3hzLmxlbmd0aCAtIDFdXG59XG5cbi8vOjogKGEgLT4gYiAtPiBjKSAtPiBiIC0+IGEgLT4gY1xuY29uc3QgZmxpcCA9IChmbikgPT4gKGIpID0+IChhKSA9PiB7XG4gIHJldHVybiBmbihhKShiKVxufVxuXG5jb25zdCBjdXJyeSA9IChmbikgPT4ge1xuICB2YXIgX2FyZ3MgPSBbXVxuICBjb25zdCBjb3VudEFyZ3MgPSAoLi4ueHMpID0+IHtcbiAgICBfYXJncyA9IF9hcmdzLmNvbmNhdCh4cylcbiAgICByZXR1cm4gKF9hcmdzLmxlbmd0aCA+PSBmbi5sZW5ndGgpXG4gICAgICA/IGZuLmFwcGx5KHRoaXMsIF9hcmdzKVxuICAgICAgOiBjb3VudEFyZ3NcbiAgfVxuICByZXR1cm4gY291bnRBcmdzXG59XG5cbi8vOjogSW50IC0+IFthXSAtPiBhXG5jb25zdCBudGggPSAobikgPT4gKHhzKSA9PiB7XG4gIHJldHVybiB4c1tuXVxufVxuXG4vLzo6IChhIC0+IGEpIC0+IE51bWJlciAtPiBbYV0gLT4gW2FdXG5jb25zdCBhZGp1c3QgPSAoZm4pID0+IChpKSA9PiAobGlzdCkgPT4ge1xuICB2YXIgY29weSA9IGxpc3Quc2xpY2UoKVxuICBjb3B5LnNwbGljZShpLCAxLCBmbihsaXN0W2ldKSlcbiAgcmV0dXJuIGNvcHlcbn1cblxuLy86OiBPYmplY3QgLT4gQXJyYXlcbmNvbnN0IHRvUGFpcnMgPSAob2JqKSA9PiB7XG4gIHJldHVybiBSZWZsZWN0Lm93bktleXMob2JqKS5tYXAoa2V5ID0+IFtrZXksIG9ialtrZXldXSlcbn1cblxuLy86OiAoYSAtPiBCb29sKSAtPiAoYSAtPiBiKSAtPiAoYSAtPiBiKSAtPiBhIC0+IGJcbmNvbnN0IGlmRWxzZSA9IChwcmVkRm4pID0+ICh3aGVuVHJ1ZUZuKSA9PiAod2hlbkZhbHNlRm4pID0+IChhKSA9PntcbiAgcmV0dXJuIHByZWRGbihhKVxuICAgID8gd2hlblRydWVGbihhKVxuICAgIDogd2hlbkZhbHNlRm4oYSlcbn1cblxuXG4vLyB0aGlzIGlzbid0IGluIGV4cG9ydHMsIGl0IGlzIHVzZWQgYnkgSU8uc2VxdWVuY2UgLy8vLy8vLy8vLy8vLy9cbmNvbnN0IEdlbmVyYXRvciA9IE9iamVjdC5mcmVlemUoe1xuICAvLzo6IChhIC0+IGIpIC0+IChHZW5lcmF0b3IgKFthXSAtPiBiKSlcbiAgLyogcmV0dXJucyBhIGdlbmVyYXRvciB3aGljaCB3aWxsIGFwcGx5XG4gICAgIGFjdGlvbiB0byBlYSB2YWx1ZSBzZXF1ZW50aWFsbHkgaW4geHNcbiAgICovXG4gIHNlcShhY3Rpb24pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24qIGFwcGx5QWN0aW9uKHhzKSB7XG4gICAgICBmb3IgKHZhciB4IG9mIHhzKSB7XG4gICAgICAgIHlpZWxkIGFjdGlvbih4KVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgLy86OiBHZW5lcmF0b3IgLT4gX1xuICAvKiBhdXRvbWF0aWNhbGx5IHN0ZXBzIGdlbmVyYXRvciBldmVyeSB+eCBtc1xuICAgICB1bnRpbCB0aGUgZ2VuZXJhdG9yIGlzIGV4aGF1c3RlZFxuICAgKi9cbiAgYXV0bzogKG1zKSA9PiAoZ2VuKSA9PiB7XG4gICAgaWYgKCFnZW4ubmV4dCgpLmRvbmUpIHtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gR2VuZXJhdG9yLmF1dG8obXMpKGdlbiksIG1zKVxuICAgIH1cbiAgfVxufSlcblxuXG4vLyBNT05BRFMgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4vLyBNYXliZSB0eXBlXG5jb25zdCBNYXliZSA9ICgoKSA9PiB7XG4gIGNvbnN0IG5ld00gPSAodHlwZSkgPT4gKHZhbHVlKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5mcmVlemUoT2JqZWN0LmNyZWF0ZSh0eXBlLCB7IF9fdmFsdWU6IHsgdmFsdWU6IHZhbHVlIH19KSlcbiAgfVxuXG4gIGNvbnN0IE5vdGhpbmcgPSBPYmplY3QuZnJlZXplKHtcbiAgICBtYXAoXykge1xuICAgICAgcmV0dXJuIG5ld00oTm90aGluZykobnVsbClcbiAgICB9LFxuICAgIGlzTm90aGluZzogdHJ1ZSxcbiAgICBpc0p1c3Q6IGZhbHNlXG4gIH0pXG5cbiAgY29uc3QgSnVzdCA9IE9iamVjdC5mcmVlemUoe1xuICAgIG1hcChmbikge1xuICAgICAgcmV0dXJuIG5ld00oSnVzdCkoZm4odGhpcy5fX3ZhbHVlKSlcbiAgICB9LFxuICAgIGlzTm90aGluZzogZmFsc2UsXG4gICAgaXNKdXN0OiB0cnVlXG4gIH0pXG5cbiAgY29uc3QgTWF5YmUgPSAoeCkgPT4ge1xuICAgIHJldHVybiAoeCA9PSBudWxsKVxuICAgICAgPyBuZXdNKE5vdGhpbmcpKG51bGwpXG4gICAgICA6IG5ld00oSnVzdCkoeClcbiAgfVxuXG4gIE1heWJlLmlzTm90aGluZyA9IChNKSA9PiB7XG4gICAgcmV0dXJuIE5vdGhpbmcuaXNQcm90b3R5cGVPZihNKVxuICB9XG5cbiAgTWF5YmUuaXNKdXN0ID0gKE0pID0+IHtcbiAgICByZXR1cm4gSnVzdC5pc1Byb3RvdHlwZU9mKE0pXG4gIH1cblxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShNYXliZSlcbn0pKClcblxuLy8gRWl0aGVyIHR5cGVcbmNvbnN0IEVpdGhlciA9ICgoKSA9PiB7XG4gIGNvbnN0IG5ld0UgPSAodHlwZSkgPT4gKHZhbHVlKSA9PiB7XG4gICAgcmV0dXJuIE9iamVjdC5mcmVlemUoT2JqZWN0LmNyZWF0ZSh0eXBlLCB7IF9fdmFsdWU6IHsgdmFsdWU6IHZhbHVlIH0gfSkpXG4gIH1cblxuICBjb25zdCBMZWZ0ID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgbWFwKF8pIHtcbiAgICAgIHJldHVybiB0aGlzXG4gICAgfSxcbiAgICBiaW1hcChmbikge1xuICAgICAgY29uc3QgbWUgPSB0aGlzXG4gICAgICByZXR1cm4gKF8pID0+IHtcbiAgICAgICAgcmV0dXJuIG5ld0UoTGVmdCkoZm4obWUuX192YWx1ZSkpXG4gICAgICB9XG4gICAgfSxcbiAgICBpc0xlZnQ6IHRydWUsXG4gICAgaXNSaWdodDogZmFsc2VcbiAgfSlcblxuICBjb25zdCBSaWdodCA9IE9iamVjdC5mcmVlemUoe1xuICAgIG1hcChmbikge1xuICAgICAgcmV0dXJuIG5ld0UoUmlnaHQpKGZuKHRoaXMuX192YWx1ZSkpXG4gICAgfSxcbiAgICBiaW1hcChfKSB7XG4gICAgICBjb25zdCBtZSA9IHRoaXNcbiAgICAgIHJldHVybiAoZm4pID0+IHtcbiAgICAgICAgcmV0dXJuIG1lLm1hcChmbilcbiAgICAgIH1cbiAgICB9LFxuICAgIGlzTGVmdDogZmFsc2UsXG4gICAgaXNSaWdodDogdHJ1ZVxuICB9KVxuXG4gIGNvbnN0IEVpdGhlciA9IE9iamVjdC5mcmVlemUoe1xuICAgIExlZnQoeCkge1xuICAgICAgcmV0dXJuIG5ld0UoTGVmdCkoeClcbiAgICB9LFxuICAgIFJpZ2h0KHgpIHtcbiAgICAgIHJldHVybiBuZXdFKFJpZ2h0KSh4KVxuICAgIH0sXG4gICAgaXNSaWdodChFKSB7XG4gICAgICByZXR1cm4gUmlnaHQuaXNQcm90b3R5cGVPZihFKVxuICAgIH0sXG4gICAgaXNMZWZ0KEUpIHtcbiAgICAgIHJldHVybiBMZWZ0LmlzUHJvdG90eXBlT2YoRSlcbiAgICB9LFxuICAgIGJpbWFwOiAobGVmdEZuKSA9PiAocmlnaHRGbikgPT4gKEUpID0+IHtcbiAgICAgIHJldHVybiBFLmJpbWFwKGxlZnRGbikocmlnaHRGbilcbiAgICB9XG4gIH0pXG5cbiAgcmV0dXJuIEVpdGhlclxufSkoKVxuXG4vLyBJTyB0eXBlXG5jb25zdCBJTyA9ICgoKSA9PiB7XG4gIGNvbnN0IG5ld19pbyA9IChmbikgPT4ge1xuICAgIHJldHVybiBPYmplY3QuZnJlZXplKE9iamVjdC5jcmVhdGUoaW8sIHsgX192YWx1ZTogeyB2YWx1ZTogZm4gfX0pKVxuICB9XG5cbiAgY29uc3QgaW8gPSB7XG4gICAgcnVuSU8odmFsdWUpIHtcbiAgICAgIHJldHVybiB0aGlzLl9fdmFsdWUodmFsdWUpXG4gICAgfSxcbiAgICBtYXAoZm4pIHtcbiAgICAgIHJldHVybiBuZXdfaW8oKCkgPT4gZm4odGhpcy5fX3ZhbHVlKCkpKVxuICAgIH0sXG4gICAgam9pbigpIHtcbiAgICAgIHJldHVybiBuZXdfaW8oKCkgPT4ge1xuICAgICAgICByZXR1cm4gdGhpcy5ydW5JTygpLnJ1bklPKClcbiAgICAgIH0pXG4gICAgfSxcbiAgICBjaGFpbihpb19yZXR1cm5pbmdfZm4pIHtcbiAgICAgIHJldHVybiB0aGlzLm1hcChpb19yZXR1cm5pbmdfZm4pLmpvaW4oKVxuICAgIH0sXG4gICAgYXAoaW9fdmFsdWUpIHtcbiAgICAgIHJldHVybiBpb192YWx1ZS5tYXAodGhpcy5fX3ZhbHVlKVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IElPID0gKGZuKSA9PiB7XG4gICAgaWYgKGZuIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICAgIHJldHVybiBuZXdfaW8oZm4pXG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoYElPIGNvbnN0cnVjdG9yIGV4cGVjdGVkIGluc3RhbmNlIG9mIEZ1bmN0aW9uYClcbiAgICB9XG4gIH1cblxuICBJTy5vZiA9ICh4KSA9PiB7XG4gICAgcmV0dXJuIG5ld19pbygoKSA9PiB4KVxuICB9XG5cbiAgSU8ucnVuID0gKGlvKSA9PiB7XG4gICAgcmV0dXJuIGlvLnJ1bklPKClcbiAgfVxuXG4gIC8vOjogKGEgLT4gYikgLT4gYSAtPiBJTyBiXG4gIElPLndyYXAgPSAoZm4pID0+IChfdmFsdWUpID0+IHtcbiAgICByZXR1cm4gSU8ub2YoX3ZhbHVlKS5tYXAoZm4pXG4gIH1cblxuICAvLzo6IFtJT10gLT4gSU8gX1xuICBJTy5zZXF1ZW5jZSA9IElPLndyYXAoXG4gICAgcGlwZShcbiAgICAgIEdlbmVyYXRvci5zZXEoSU8ucnVuKSxcbiAgICAgIEdlbmVyYXRvci5hdXRvKDApXG4gICAgKSlcblxuICByZXR1cm4gT2JqZWN0LmZyZWV6ZShJTylcbn0pKClcblxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgdHJhY2UsIHBpcGUsIHBpcGVQLCBtYXAsIGludGVyc2VjdGlvbiwgZGlmZmVyZW5jZSwgYXBwbHlGdW5jdGlvbnMsXG4gIGxhc3QsIGZsaXAsIGN1cnJ5LCBudGgsIGFkanVzdCwgdG9QYWlycywgaWZFbHNlLFxuICBNYXliZSwgRWl0aGVyLCBJT1xufVxuXG5cblxuXG5cbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvZnV6enlzZXQuanMnKTtcbiIsIihmdW5jdGlvbigpIHtcblxudmFyIEZ1enp5U2V0ID0gZnVuY3Rpb24oYXJyLCB1c2VMZXZlbnNodGVpbiwgZ3JhbVNpemVMb3dlciwgZ3JhbVNpemVVcHBlcikge1xuICAgIHZhciBmdXp6eXNldCA9IHtcbiAgICAgICAgdmVyc2lvbjogJzAuMC4xJ1xuICAgIH07XG5cbiAgICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgICBhcnIgPSBhcnIgfHwgW107XG4gICAgZnV6enlzZXQuZ3JhbVNpemVMb3dlciA9IGdyYW1TaXplTG93ZXIgfHwgMjtcbiAgICBmdXp6eXNldC5ncmFtU2l6ZVVwcGVyID0gZ3JhbVNpemVVcHBlciB8fCAzO1xuICAgIGZ1enp5c2V0LnVzZUxldmVuc2h0ZWluID0gdXNlTGV2ZW5zaHRlaW4gfHwgdHJ1ZTtcblxuICAgIC8vIGRlZmluZSBhbGwgdGhlIG9iamVjdCBmdW5jdGlvbnMgYW5kIGF0dHJpYnV0ZXNcbiAgICBmdXp6eXNldC5leGFjdFNldCA9IHt9XG4gICAgZnV6enlzZXQubWF0Y2hEaWN0ID0ge307XG4gICAgZnV6enlzZXQuaXRlbXMgPSB7fTtcblxuICAgIC8vIGhlbHBlciBmdW5jdGlvbnNcbiAgICB2YXIgbGV2ZW5zaHRlaW4gPSBmdW5jdGlvbihzdHIxLCBzdHIyKSB7XG4gICAgICAgIHZhciBjdXJyZW50ID0gW10sIHByZXYsIHZhbHVlO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDw9IHN0cjIubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICBmb3IgKHZhciBqID0gMDsgaiA8PSBzdHIxLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICBpZiAoaSAmJiBqKVxuICAgICAgICAgICAgICAgIGlmIChzdHIxLmNoYXJBdChqIC0gMSkgPT09IHN0cjIuY2hhckF0KGkgLSAxKSlcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHByZXY7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgIHZhbHVlID0gTWF0aC5taW4oY3VycmVudFtqXSwgY3VycmVudFtqIC0gMV0sIHByZXYpICsgMTtcbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGkgKyBqO1xuXG4gICAgICAgICAgICBwcmV2ID0gY3VycmVudFtqXTtcbiAgICAgICAgICAgIGN1cnJlbnRbal0gPSB2YWx1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICByZXR1cm4gY3VycmVudC5wb3AoKTtcbiAgICB9O1xuXG4gICAgLy8gcmV0dXJuIGFuIGVkaXQgZGlzdGFuY2UgZnJvbSAwIHRvIDFcbiAgICB2YXIgX2Rpc3RhbmNlID0gZnVuY3Rpb24oc3RyMSwgc3RyMikge1xuICAgICAgICBpZiAoc3RyMSA9PSBudWxsICYmIHN0cjIgPT0gbnVsbCkgdGhyb3cgJ1RyeWluZyB0byBjb21wYXJlIHR3byBudWxsIHZhbHVlcydcbiAgICAgICAgaWYgKHN0cjEgPT0gbnVsbCB8fCBzdHIyID09IG51bGwpIHJldHVybiAwO1xuICAgICAgICBzdHIxID0gU3RyaW5nKHN0cjEpOyBzdHIyID0gU3RyaW5nKHN0cjIpO1xuXG4gICAgICAgIHZhciBkaXN0YW5jZSA9IGxldmVuc2h0ZWluKHN0cjEsIHN0cjIpO1xuICAgICAgICBpZiAoc3RyMS5sZW5ndGggPiBzdHIyLmxlbmd0aCkge1xuICAgICAgICAgICAgcmV0dXJuIDEgLSBkaXN0YW5jZSAvIHN0cjEubGVuZ3RoO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIDEgLSBkaXN0YW5jZSAvIHN0cjIubGVuZ3RoO1xuICAgICAgICB9XG4gICAgfTtcbiAgICB2YXIgX25vbldvcmRSZSA9IC9bXlxcdywgXSsvO1xuXG4gICAgdmFyIF9pdGVyYXRlR3JhbXMgPSBmdW5jdGlvbih2YWx1ZSwgZ3JhbVNpemUpIHtcbiAgICAgICAgZ3JhbVNpemUgPSBncmFtU2l6ZSB8fCAyO1xuICAgICAgICB2YXIgc2ltcGxpZmllZCA9ICctJyArIHZhbHVlLnRvTG93ZXJDYXNlKCkucmVwbGFjZShfbm9uV29yZFJlLCAnJykgKyAnLScsXG4gICAgICAgICAgICBsZW5EaWZmID0gZ3JhbVNpemUgLSBzaW1wbGlmaWVkLmxlbmd0aCxcbiAgICAgICAgICAgIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgaWYgKGxlbkRpZmYgPiAwKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbkRpZmY7ICsraSkge1xuICAgICAgICAgICAgICAgIHZhbHVlICs9ICctJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNpbXBsaWZpZWQubGVuZ3RoIC0gZ3JhbVNpemUgKyAxOyArK2kpIHtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChzaW1wbGlmaWVkLnNsaWNlKGksIGkgKyBncmFtU2l6ZSkpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfTtcblxuICAgIHZhciBfZ3JhbUNvdW50ZXIgPSBmdW5jdGlvbih2YWx1ZSwgZ3JhbVNpemUpIHtcbiAgICAgICAgZ3JhbVNpemUgPSBncmFtU2l6ZSB8fCAyO1xuICAgICAgICB2YXIgcmVzdWx0ID0ge30sXG4gICAgICAgICAgICBncmFtcyA9IF9pdGVyYXRlR3JhbXModmFsdWUsIGdyYW1TaXplKSxcbiAgICAgICAgICAgIGkgPSAwO1xuICAgICAgICBmb3IgKGk7IGkgPCBncmFtcy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgaWYgKGdyYW1zW2ldIGluIHJlc3VsdCkge1xuICAgICAgICAgICAgICAgIHJlc3VsdFtncmFtc1tpXV0gKz0gMTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0W2dyYW1zW2ldXSA9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgLy8gdGhlIG1haW4gZnVuY3Rpb25zXG4gICAgZnV6enlzZXQuZ2V0ID0gZnVuY3Rpb24odmFsdWUsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gdGhpcy5fZ2V0KHZhbHVlKTtcbiAgICAgICAgaWYgKCFyZXN1bHQgJiYgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgICAgICByZXR1cm4gZGVmYXVsdFZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGZ1enp5c2V0Ll9nZXQgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB2YXIgbm9ybWFsaXplZFZhbHVlID0gdGhpcy5fbm9ybWFsaXplU3RyKHZhbHVlKSxcbiAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMuZXhhY3RTZXRbbm9ybWFsaXplZFZhbHVlXTtcbiAgICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICAgICAgcmV0dXJuIFtbMSwgcmVzdWx0XV07XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgZ3JhbVNpemUgPSB0aGlzLmdyYW1TaXplVXBwZXI7IGdyYW1TaXplID4gdGhpcy5ncmFtU2l6ZUxvd2VyOyAtLWdyYW1TaXplKSB7XG4gICAgICAgICAgICByZXN1bHRzID0gdGhpcy5fX2dldCh2YWx1ZSwgZ3JhbVNpemUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdHMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcmVzdWx0cztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9O1xuXG4gICAgZnV6enlzZXQuX19nZXQgPSBmdW5jdGlvbih2YWx1ZSwgZ3JhbVNpemUpIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRWYWx1ZSA9IHRoaXMuX25vcm1hbGl6ZVN0cih2YWx1ZSksXG4gICAgICAgICAgICBtYXRjaGVzID0ge30sXG4gICAgICAgICAgICBncmFtQ291bnRzID0gX2dyYW1Db3VudGVyKG5vcm1hbGl6ZWRWYWx1ZSwgZ3JhbVNpemUpLFxuICAgICAgICAgICAgaXRlbXMgPSB0aGlzLml0ZW1zW2dyYW1TaXplXSxcbiAgICAgICAgICAgIHN1bU9mU3F1YXJlR3JhbUNvdW50cyA9IDAsXG4gICAgICAgICAgICBncmFtLFxuICAgICAgICAgICAgZ3JhbUNvdW50LFxuICAgICAgICAgICAgaSxcbiAgICAgICAgICAgIGluZGV4LFxuICAgICAgICAgICAgb3RoZXJHcmFtQ291bnQ7XG5cbiAgICAgICAgZm9yIChncmFtIGluIGdyYW1Db3VudHMpIHtcbiAgICAgICAgICAgIGdyYW1Db3VudCA9IGdyYW1Db3VudHNbZ3JhbV07XG4gICAgICAgICAgICBzdW1PZlNxdWFyZUdyYW1Db3VudHMgKz0gTWF0aC5wb3coZ3JhbUNvdW50LCAyKTtcbiAgICAgICAgICAgIGlmIChncmFtIGluIHRoaXMubWF0Y2hEaWN0KSB7XG4gICAgICAgICAgICAgICAgZm9yIChpID0gMDsgaSA8IHRoaXMubWF0Y2hEaWN0W2dyYW1dLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ID0gdGhpcy5tYXRjaERpY3RbZ3JhbV1baV1bMF07XG4gICAgICAgICAgICAgICAgICAgIG90aGVyR3JhbUNvdW50ID0gdGhpcy5tYXRjaERpY3RbZ3JhbV1baV1bMV07XG4gICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCBpbiBtYXRjaGVzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVzW2luZGV4XSArPSBncmFtQ291bnQgKiBvdGhlckdyYW1Db3VudDtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZXNbaW5kZXhdID0gZ3JhbUNvdW50ICogb3RoZXJHcmFtQ291bnQ7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmdW5jdGlvbiBpc0VtcHR5T2JqZWN0KG9iaikge1xuICAgICAgICAgICAgZm9yKHZhciBwcm9wIGluIG9iaikge1xuICAgICAgICAgICAgICAgIGlmKG9iai5oYXNPd25Qcm9wZXJ0eShwcm9wKSlcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNFbXB0eU9iamVjdChtYXRjaGVzKSkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgdmVjdG9yTm9ybWFsID0gTWF0aC5zcXJ0KHN1bU9mU3F1YXJlR3JhbUNvdW50cyksXG4gICAgICAgICAgICByZXN1bHRzID0gW10sXG4gICAgICAgICAgICBtYXRjaFNjb3JlO1xuICAgICAgICAvLyBidWlsZCBhIHJlc3VsdHMgbGlzdCBvZiBbc2NvcmUsIHN0cl1cbiAgICAgICAgZm9yICh2YXIgbWF0Y2hJbmRleCBpbiBtYXRjaGVzKSB7XG4gICAgICAgICAgICBtYXRjaFNjb3JlID0gbWF0Y2hlc1ttYXRjaEluZGV4XTtcbiAgICAgICAgICAgIHJlc3VsdHMucHVzaChbbWF0Y2hTY29yZSAvICh2ZWN0b3JOb3JtYWwgKiBpdGVtc1ttYXRjaEluZGV4XVswXSksIGl0ZW1zW21hdGNoSW5kZXhdWzFdXSk7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIHNvcnREZXNjZW5kaW5nID0gZnVuY3Rpb24oYSwgYikge1xuICAgICAgICAgICAgaWYgKGFbMF0gPCBiWzBdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGFbMF0gPiBiWzBdKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIC0xO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgcmVzdWx0cy5zb3J0KHNvcnREZXNjZW5kaW5nKTtcbiAgICAgICAgaWYgKHRoaXMudXNlTGV2ZW5zaHRlaW4pIHtcbiAgICAgICAgICAgIHZhciBuZXdSZXN1bHRzID0gW10sXG4gICAgICAgICAgICAgICAgZW5kSW5kZXggPSBNYXRoLm1pbig1MCwgcmVzdWx0cy5sZW5ndGgpO1xuICAgICAgICAgICAgLy8gdHJ1bmNhdGUgc29tZXdoYXQgYXJiaXRyYXJpbHkgdG8gNTBcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgZW5kSW5kZXg7ICsraSkge1xuICAgICAgICAgICAgICAgIG5ld1Jlc3VsdHMucHVzaChbX2Rpc3RhbmNlKHJlc3VsdHNbaV1bMV0sIG5vcm1hbGl6ZWRWYWx1ZSksIHJlc3VsdHNbaV1bMV1dKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJlc3VsdHMgPSBuZXdSZXN1bHRzO1xuICAgICAgICAgICAgcmVzdWx0cy5zb3J0KHNvcnREZXNjZW5kaW5nKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmV3UmVzdWx0cyA9IFtdO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJlc3VsdHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIGlmIChyZXN1bHRzW2ldWzBdID09IHJlc3VsdHNbMF1bMF0pIHtcbiAgICAgICAgICAgICAgICBuZXdSZXN1bHRzLnB1c2goW3Jlc3VsdHNbaV1bMF0sIHRoaXMuZXhhY3RTZXRbcmVzdWx0c1tpXVsxXV1dKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3UmVzdWx0cztcbiAgICB9O1xuXG4gICAgZnV6enlzZXQuYWRkID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIG5vcm1hbGl6ZWRWYWx1ZSA9IHRoaXMuX25vcm1hbGl6ZVN0cih2YWx1ZSk7XG4gICAgICAgIGlmIChub3JtYWxpemVkVmFsdWUgaW4gdGhpcy5leGFjdFNldCkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGkgPSB0aGlzLmdyYW1TaXplTG93ZXI7XG4gICAgICAgIGZvciAoaTsgaSA8IHRoaXMuZ3JhbVNpemVVcHBlciArIDE7ICsraSkge1xuICAgICAgICAgICAgdGhpcy5fYWRkKHZhbHVlLCBpKTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBmdXp6eXNldC5fYWRkID0gZnVuY3Rpb24odmFsdWUsIGdyYW1TaXplKSB7XG4gICAgICAgIHZhciBub3JtYWxpemVkVmFsdWUgPSB0aGlzLl9ub3JtYWxpemVTdHIodmFsdWUpLFxuICAgICAgICAgICAgaXRlbXMgPSB0aGlzLml0ZW1zW2dyYW1TaXplXSB8fCBbXSxcbiAgICAgICAgICAgIGluZGV4ID0gaXRlbXMubGVuZ3RoO1xuXG4gICAgICAgIGl0ZW1zLnB1c2goMCk7XG4gICAgICAgIHZhciBncmFtQ291bnRzID0gX2dyYW1Db3VudGVyKG5vcm1hbGl6ZWRWYWx1ZSwgZ3JhbVNpemUpLFxuICAgICAgICAgICAgc3VtT2ZTcXVhcmVHcmFtQ291bnRzID0gMCxcbiAgICAgICAgICAgIGdyYW0sIGdyYW1Db3VudDtcbiAgICAgICAgZm9yICh2YXIgZ3JhbSBpbiBncmFtQ291bnRzKSB7XG4gICAgICAgICAgICBncmFtQ291bnQgPSBncmFtQ291bnRzW2dyYW1dO1xuICAgICAgICAgICAgc3VtT2ZTcXVhcmVHcmFtQ291bnRzICs9IE1hdGgucG93KGdyYW1Db3VudCwgMik7XG4gICAgICAgICAgICBpZiAoZ3JhbSBpbiB0aGlzLm1hdGNoRGljdCkge1xuICAgICAgICAgICAgICAgIHRoaXMubWF0Y2hEaWN0W2dyYW1dLnB1c2goW2luZGV4LCBncmFtQ291bnRdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5tYXRjaERpY3RbZ3JhbV0gPSBbW2luZGV4LCBncmFtQ291bnRdXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB2YXIgdmVjdG9yTm9ybWFsID0gTWF0aC5zcXJ0KHN1bU9mU3F1YXJlR3JhbUNvdW50cyk7XG4gICAgICAgIGl0ZW1zW2luZGV4XSA9IFt2ZWN0b3JOb3JtYWwsIG5vcm1hbGl6ZWRWYWx1ZV07XG4gICAgICAgIHRoaXMuaXRlbXNbZ3JhbVNpemVdID0gaXRlbXM7XG4gICAgICAgIHRoaXMuZXhhY3RTZXRbbm9ybWFsaXplZFZhbHVlXSA9IHZhbHVlO1xuICAgIH07XG5cbiAgICBmdXp6eXNldC5fbm9ybWFsaXplU3RyID0gZnVuY3Rpb24oc3RyKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwoc3RyKSAhPT0gJ1tvYmplY3QgU3RyaW5nXScpIHRocm93ICdNdXN0IHVzZSBhIHN0cmluZyBhcyBhcmd1bWVudCB0byBGdXp6eVNldCBmdW5jdGlvbnMnXG4gICAgICAgIHJldHVybiBzdHIudG9Mb3dlckNhc2UoKTtcbiAgICB9O1xuXG4gICAgLy8gcmV0dXJuIGxlbmd0aCBvZiBpdGVtcyBpbiBzZXRcbiAgICBmdXp6eXNldC5sZW5ndGggPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGNvdW50ID0gMCxcbiAgICAgICAgICAgIHByb3A7XG4gICAgICAgIGZvciAocHJvcCBpbiB0aGlzLmV4YWN0U2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leGFjdFNldC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgIGNvdW50ICs9IDE7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNvdW50O1xuICAgIH07XG5cbiAgICAvLyByZXR1cm4gaXMgc2V0IGlzIGVtcHR5XG4gICAgZnV6enlzZXQuaXNFbXB0eSA9IGZ1bmN0aW9uKCkge1xuICAgICAgICBmb3IgKHZhciBwcm9wIGluIHRoaXMuZXhhY3RTZXQpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmV4YWN0U2V0Lmhhc093blByb3BlcnR5KHByb3ApKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH07XG5cbiAgICAvLyByZXR1cm4gbGlzdCBvZiB2YWx1ZXMgbG9hZGVkIGludG8gc2V0XG4gICAgZnV6enlzZXQudmFsdWVzID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciB2YWx1ZXMgPSBbXSxcbiAgICAgICAgICAgIHByb3A7XG4gICAgICAgIGZvciAocHJvcCBpbiB0aGlzLmV4YWN0U2V0KSB7XG4gICAgICAgICAgICBpZiAodGhpcy5leGFjdFNldC5oYXNPd25Qcm9wZXJ0eShwcm9wKSkge1xuICAgICAgICAgICAgICAgIHZhbHVlcy5wdXNoKHRoaXMuZXhhY3RTZXRbcHJvcF0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHZhbHVlcztcbiAgICB9O1xuXG5cbiAgICAvLyBpbml0aWFsaXphdGlvblxuICAgIHZhciBpID0gZnV6enlzZXQuZ3JhbVNpemVMb3dlcjtcbiAgICBmb3IgKGk7IGkgPCBmdXp6eXNldC5ncmFtU2l6ZVVwcGVyICsgMTsgKytpKSB7XG4gICAgICAgIGZ1enp5c2V0Lml0ZW1zW2ldID0gW107XG4gICAgfVxuICAgIC8vIGFkZCBhbGwgdGhlIGl0ZW1zIHRvIHRoZSBzZXRcbiAgICBmb3IgKGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIGZ1enp5c2V0LmFkZChhcnJbaV0pO1xuICAgIH1cblxuICAgIHJldHVybiBmdXp6eXNldDtcbn07XG5cbnZhciByb290ID0gdGhpcztcbi8vIEV4cG9ydCB0aGUgZnV6enlzZXQgb2JqZWN0IGZvciAqKkNvbW1vbkpTKiosIHdpdGggYmFja3dhcmRzLWNvbXBhdGliaWxpdHlcbi8vIGZvciB0aGUgb2xkIGByZXF1aXJlKClgIEFQSS4gSWYgd2UncmUgbm90IGluIENvbW1vbkpTLCBhZGQgYF9gIHRvIHRoZVxuLy8gZ2xvYmFsIG9iamVjdC5cbmlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gRnV6enlTZXQ7XG4gICAgcm9vdC5GdXp6eVNldCA9IEZ1enp5U2V0O1xufSBlbHNlIHtcbiAgICByb290LkZ1enp5U2V0ID0gRnV6enlTZXQ7XG59XG5cbn0pKCk7XG4iLCJ2YXIgVk5vZGUgPSByZXF1aXJlKCcuL3Zub2RlJyk7XG52YXIgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG5cbmZ1bmN0aW9uIGFkZE5TKGRhdGEsIGNoaWxkcmVuKSB7XG4gIGRhdGEubnMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xuICBpZiAoY2hpbGRyZW4gIT09IHVuZGVmaW5lZCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIGFkZE5TKGNoaWxkcmVuW2ldLmRhdGEsIGNoaWxkcmVuW2ldLmNoaWxkcmVuKTtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBoKHNlbCwgYiwgYykge1xuICB2YXIgZGF0YSA9IHt9LCBjaGlsZHJlbiwgdGV4dCwgaTtcbiAgaWYgKGMgIT09IHVuZGVmaW5lZCkge1xuICAgIGRhdGEgPSBiO1xuICAgIGlmIChpcy5hcnJheShjKSkgeyBjaGlsZHJlbiA9IGM7IH1cbiAgICBlbHNlIGlmIChpcy5wcmltaXRpdmUoYykpIHsgdGV4dCA9IGM7IH1cbiAgfSBlbHNlIGlmIChiICE9PSB1bmRlZmluZWQpIHtcbiAgICBpZiAoaXMuYXJyYXkoYikpIHsgY2hpbGRyZW4gPSBiOyB9XG4gICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGIpKSB7IHRleHQgPSBiOyB9XG4gICAgZWxzZSB7IGRhdGEgPSBiOyB9XG4gIH1cbiAgaWYgKGlzLmFycmF5KGNoaWxkcmVuKSkge1xuICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgaWYgKGlzLnByaW1pdGl2ZShjaGlsZHJlbltpXSkpIGNoaWxkcmVuW2ldID0gVk5vZGUodW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY2hpbGRyZW5baV0pO1xuICAgIH1cbiAgfVxuICBpZiAoc2VsWzBdID09PSAncycgJiYgc2VsWzFdID09PSAndicgJiYgc2VsWzJdID09PSAnZycpIHtcbiAgICBhZGROUyhkYXRhLCBjaGlsZHJlbik7XG4gIH1cbiAgcmV0dXJuIFZOb2RlKHNlbCwgZGF0YSwgY2hpbGRyZW4sIHRleHQsIHVuZGVmaW5lZCk7XG59O1xuIiwiZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh0YWdOYW1lKXtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgcXVhbGlmaWVkTmFtZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRleHROb2RlKHRleHQpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCk7XG59XG5cblxuZnVuY3Rpb24gaW5zZXJ0QmVmb3JlKHBhcmVudE5vZGUsIG5ld05vZGUsIHJlZmVyZW5jZU5vZGUpe1xuICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShuZXdOb2RlLCByZWZlcmVuY2VOb2RlKTtcbn1cblxuXG5mdW5jdGlvbiByZW1vdmVDaGlsZChub2RlLCBjaGlsZCl7XG4gIG5vZGUucmVtb3ZlQ2hpbGQoY2hpbGQpO1xufVxuXG5mdW5jdGlvbiBhcHBlbmRDaGlsZChub2RlLCBjaGlsZCl7XG4gIG5vZGUuYXBwZW5kQ2hpbGQoY2hpbGQpO1xufVxuXG5mdW5jdGlvbiBwYXJlbnROb2RlKG5vZGUpe1xuICByZXR1cm4gbm9kZS5wYXJlbnRFbGVtZW50O1xufVxuXG5mdW5jdGlvbiBuZXh0U2libGluZyhub2RlKXtcbiAgcmV0dXJuIG5vZGUubmV4dFNpYmxpbmc7XG59XG5cbmZ1bmN0aW9uIHRhZ05hbWUobm9kZSl7XG4gIHJldHVybiBub2RlLnRhZ05hbWU7XG59XG5cbmZ1bmN0aW9uIHNldFRleHRDb250ZW50KG5vZGUsIHRleHQpe1xuICBub2RlLnRleHRDb250ZW50ID0gdGV4dDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGNyZWF0ZUVsZW1lbnQ6IGNyZWF0ZUVsZW1lbnQsXG4gIGNyZWF0ZUVsZW1lbnROUzogY3JlYXRlRWxlbWVudE5TLFxuICBjcmVhdGVUZXh0Tm9kZTogY3JlYXRlVGV4dE5vZGUsXG4gIGFwcGVuZENoaWxkOiBhcHBlbmRDaGlsZCxcbiAgcmVtb3ZlQ2hpbGQ6IHJlbW92ZUNoaWxkLFxuICBpbnNlcnRCZWZvcmU6IGluc2VydEJlZm9yZSxcbiAgcGFyZW50Tm9kZTogcGFyZW50Tm9kZSxcbiAgbmV4dFNpYmxpbmc6IG5leHRTaWJsaW5nLFxuICB0YWdOYW1lOiB0YWdOYW1lLFxuICBzZXRUZXh0Q29udGVudDogc2V0VGV4dENvbnRlbnRcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgYXJyYXk6IEFycmF5LmlzQXJyYXksXG4gIHByaW1pdGl2ZTogZnVuY3Rpb24ocykgeyByZXR1cm4gdHlwZW9mIHMgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBzID09PSAnbnVtYmVyJzsgfSxcbn07XG4iLCJmdW5jdGlvbiB1cGRhdGVDbGFzcyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIGN1ciwgbmFtZSwgZWxtID0gdm5vZGUuZWxtLFxuICAgICAgb2xkQ2xhc3MgPSBvbGRWbm9kZS5kYXRhLmNsYXNzIHx8IHt9LFxuICAgICAga2xhc3MgPSB2bm9kZS5kYXRhLmNsYXNzIHx8IHt9O1xuICBmb3IgKG5hbWUgaW4gb2xkQ2xhc3MpIHtcbiAgICBpZiAoIWtsYXNzW25hbWVdKSB7XG4gICAgICBlbG0uY2xhc3NMaXN0LnJlbW92ZShuYW1lKTtcbiAgICB9XG4gIH1cbiAgZm9yIChuYW1lIGluIGtsYXNzKSB7XG4gICAgY3VyID0ga2xhc3NbbmFtZV07XG4gICAgaWYgKGN1ciAhPT0gb2xkQ2xhc3NbbmFtZV0pIHtcbiAgICAgIGVsbS5jbGFzc0xpc3RbY3VyID8gJ2FkZCcgOiAncmVtb3ZlJ10obmFtZSk7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlQ2xhc3MsIHVwZGF0ZTogdXBkYXRlQ2xhc3N9O1xuIiwidmFyIGlzID0gcmVxdWlyZSgnLi4vaXMnKTtcblxuZnVuY3Rpb24gYXJySW52b2tlcihhcnIpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgIGlmICghYXJyLmxlbmd0aCkgcmV0dXJuO1xuICAgIC8vIFNwZWNpYWwgY2FzZSB3aGVuIGxlbmd0aCBpcyB0d28sIGZvciBwZXJmb3JtYW5jZVxuICAgIGFyci5sZW5ndGggPT09IDIgPyBhcnJbMF0oYXJyWzFdKSA6IGFyclswXS5hcHBseSh1bmRlZmluZWQsIGFyci5zbGljZSgxKSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGZuSW52b2tlcihvKSB7XG4gIHJldHVybiBmdW5jdGlvbihldikgeyBcbiAgICBpZiAoby5mbiA9PT0gbnVsbCkgcmV0dXJuO1xuICAgIG8uZm4oZXYpOyBcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRXZlbnRMaXN0ZW5lcnMob2xkVm5vZGUsIHZub2RlKSB7XG4gIHZhciBuYW1lLCBjdXIsIG9sZCwgZWxtID0gdm5vZGUuZWxtLFxuICAgICAgb2xkT24gPSBvbGRWbm9kZS5kYXRhLm9uIHx8IHt9LCBvbiA9IHZub2RlLmRhdGEub247XG4gIGlmICghb24pIHJldHVybjtcbiAgZm9yIChuYW1lIGluIG9uKSB7XG4gICAgY3VyID0gb25bbmFtZV07XG4gICAgb2xkID0gb2xkT25bbmFtZV07XG4gICAgaWYgKG9sZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBpZiAoaXMuYXJyYXkoY3VyKSkge1xuICAgICAgICBlbG0uYWRkRXZlbnRMaXN0ZW5lcihuYW1lLCBhcnJJbnZva2VyKGN1cikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3VyID0ge2ZuOiBjdXJ9O1xuICAgICAgICBvbltuYW1lXSA9IGN1cjtcbiAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZm5JbnZva2VyKGN1cikpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXMuYXJyYXkob2xkKSkge1xuICAgICAgLy8gRGVsaWJlcmF0ZWx5IG1vZGlmeSBvbGQgYXJyYXkgc2luY2UgaXQncyBjYXB0dXJlZCBpbiBjbG9zdXJlIGNyZWF0ZWQgd2l0aCBgYXJySW52b2tlcmBcbiAgICAgIG9sZC5sZW5ndGggPSBjdXIubGVuZ3RoO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvbGQubGVuZ3RoOyArK2kpIG9sZFtpXSA9IGN1cltpXTtcbiAgICAgIG9uW25hbWVdICA9IG9sZDtcbiAgICB9IGVsc2Uge1xuICAgICAgb2xkLmZuID0gY3VyO1xuICAgICAgb25bbmFtZV0gPSBvbGQ7XG4gICAgfVxuICB9XG4gIGlmIChvbGRPbikge1xuICAgIGZvciAobmFtZSBpbiBvbGRPbikge1xuICAgICAgaWYgKG9uW25hbWVdID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgdmFyIG9sZCA9IG9sZE9uW25hbWVdO1xuICAgICAgICBpZiAoaXMuYXJyYXkob2xkKSkge1xuICAgICAgICAgIG9sZC5sZW5ndGggPSAwO1xuICAgICAgICB9XG4gICAgICAgIGVsc2Uge1xuICAgICAgICAgIG9sZC5mbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7Y3JlYXRlOiB1cGRhdGVFdmVudExpc3RlbmVycywgdXBkYXRlOiB1cGRhdGVFdmVudExpc3RlbmVyc307XG4iLCJmdW5jdGlvbiB1cGRhdGVQcm9wcyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIGtleSwgY3VyLCBvbGQsIGVsbSA9IHZub2RlLmVsbSxcbiAgICAgIG9sZFByb3BzID0gb2xkVm5vZGUuZGF0YS5wcm9wcyB8fCB7fSwgcHJvcHMgPSB2bm9kZS5kYXRhLnByb3BzIHx8IHt9O1xuICBmb3IgKGtleSBpbiBvbGRQcm9wcykge1xuICAgIGlmICghcHJvcHNba2V5XSkge1xuICAgICAgZGVsZXRlIGVsbVtrZXldO1xuICAgIH1cbiAgfVxuICBmb3IgKGtleSBpbiBwcm9wcykge1xuICAgIGN1ciA9IHByb3BzW2tleV07XG4gICAgb2xkID0gb2xkUHJvcHNba2V5XTtcbiAgICBpZiAob2xkICE9PSBjdXIgJiYgKGtleSAhPT0gJ3ZhbHVlJyB8fCBlbG1ba2V5XSAhPT0gY3VyKSkge1xuICAgICAgZWxtW2tleV0gPSBjdXI7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlUHJvcHMsIHVwZGF0ZTogdXBkYXRlUHJvcHN9O1xuIiwidmFyIHJhZiA9ICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKSB8fCBzZXRUaW1lb3V0O1xudmFyIG5leHRGcmFtZSA9IGZ1bmN0aW9uKGZuKSB7IHJhZihmdW5jdGlvbigpIHsgcmFmKGZuKTsgfSk7IH07XG5cbmZ1bmN0aW9uIHNldE5leHRGcmFtZShvYmosIHByb3AsIHZhbCkge1xuICBuZXh0RnJhbWUoZnVuY3Rpb24oKSB7IG9ialtwcm9wXSA9IHZhbDsgfSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVN0eWxlKG9sZFZub2RlLCB2bm9kZSkge1xuICB2YXIgY3VyLCBuYW1lLCBlbG0gPSB2bm9kZS5lbG0sXG4gICAgICBvbGRTdHlsZSA9IG9sZFZub2RlLmRhdGEuc3R5bGUgfHwge30sXG4gICAgICBzdHlsZSA9IHZub2RlLmRhdGEuc3R5bGUgfHwge30sXG4gICAgICBvbGRIYXNEZWwgPSAnZGVsYXllZCcgaW4gb2xkU3R5bGU7XG4gIGZvciAobmFtZSBpbiBvbGRTdHlsZSkge1xuICAgIGlmICghc3R5bGVbbmFtZV0pIHtcbiAgICAgIGVsbS5zdHlsZVtuYW1lXSA9ICcnO1xuICAgIH1cbiAgfVxuICBmb3IgKG5hbWUgaW4gc3R5bGUpIHtcbiAgICBjdXIgPSBzdHlsZVtuYW1lXTtcbiAgICBpZiAobmFtZSA9PT0gJ2RlbGF5ZWQnKSB7XG4gICAgICBmb3IgKG5hbWUgaW4gc3R5bGUuZGVsYXllZCkge1xuICAgICAgICBjdXIgPSBzdHlsZS5kZWxheWVkW25hbWVdO1xuICAgICAgICBpZiAoIW9sZEhhc0RlbCB8fCBjdXIgIT09IG9sZFN0eWxlLmRlbGF5ZWRbbmFtZV0pIHtcbiAgICAgICAgICBzZXROZXh0RnJhbWUoZWxtLnN0eWxlLCBuYW1lLCBjdXIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuYW1lICE9PSAncmVtb3ZlJyAmJiBjdXIgIT09IG9sZFN0eWxlW25hbWVdKSB7XG4gICAgICBlbG0uc3R5bGVbbmFtZV0gPSBjdXI7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5RGVzdHJveVN0eWxlKHZub2RlKSB7XG4gIHZhciBzdHlsZSwgbmFtZSwgZWxtID0gdm5vZGUuZWxtLCBzID0gdm5vZGUuZGF0YS5zdHlsZTtcbiAgaWYgKCFzIHx8ICEoc3R5bGUgPSBzLmRlc3Ryb3kpKSByZXR1cm47XG4gIGZvciAobmFtZSBpbiBzdHlsZSkge1xuICAgIGVsbS5zdHlsZVtuYW1lXSA9IHN0eWxlW25hbWVdO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFwcGx5UmVtb3ZlU3R5bGUodm5vZGUsIHJtKSB7XG4gIHZhciBzID0gdm5vZGUuZGF0YS5zdHlsZTtcbiAgaWYgKCFzIHx8ICFzLnJlbW92ZSkge1xuICAgIHJtKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBuYW1lLCBlbG0gPSB2bm9kZS5lbG0sIGlkeCwgaSA9IDAsIG1heER1ciA9IDAsXG4gICAgICBjb21wU3R5bGUsIHN0eWxlID0gcy5yZW1vdmUsIGFtb3VudCA9IDAsIGFwcGxpZWQgPSBbXTtcbiAgZm9yIChuYW1lIGluIHN0eWxlKSB7XG4gICAgYXBwbGllZC5wdXNoKG5hbWUpO1xuICAgIGVsbS5zdHlsZVtuYW1lXSA9IHN0eWxlW25hbWVdO1xuICB9XG4gIGNvbXBTdHlsZSA9IGdldENvbXB1dGVkU3R5bGUoZWxtKTtcbiAgdmFyIHByb3BzID0gY29tcFN0eWxlWyd0cmFuc2l0aW9uLXByb3BlcnR5J10uc3BsaXQoJywgJyk7XG4gIGZvciAoOyBpIDwgcHJvcHMubGVuZ3RoOyArK2kpIHtcbiAgICBpZihhcHBsaWVkLmluZGV4T2YocHJvcHNbaV0pICE9PSAtMSkgYW1vdW50Kys7XG4gIH1cbiAgZWxtLmFkZEV2ZW50TGlzdGVuZXIoJ3RyYW5zaXRpb25lbmQnLCBmdW5jdGlvbihldikge1xuICAgIGlmIChldi50YXJnZXQgPT09IGVsbSkgLS1hbW91bnQ7XG4gICAgaWYgKGFtb3VudCA9PT0gMCkgcm0oKTtcbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlU3R5bGUsIHVwZGF0ZTogdXBkYXRlU3R5bGUsIGRlc3Ryb3k6IGFwcGx5RGVzdHJveVN0eWxlLCByZW1vdmU6IGFwcGx5UmVtb3ZlU3R5bGV9O1xuIiwiLy8ganNoaW50IG5ld2NhcDogZmFsc2Vcbi8qIGdsb2JhbCByZXF1aXJlLCBtb2R1bGUsIGRvY3VtZW50LCBOb2RlICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBWTm9kZSA9IHJlcXVpcmUoJy4vdm5vZGUnKTtcbnZhciBpcyA9IHJlcXVpcmUoJy4vaXMnKTtcbnZhciBkb21BcGkgPSByZXF1aXJlKCcuL2h0bWxkb21hcGknKTtcblxuZnVuY3Rpb24gaXNVbmRlZihzKSB7IHJldHVybiBzID09PSB1bmRlZmluZWQ7IH1cbmZ1bmN0aW9uIGlzRGVmKHMpIHsgcmV0dXJuIHMgIT09IHVuZGVmaW5lZDsgfVxuXG52YXIgZW1wdHlOb2RlID0gVk5vZGUoJycsIHt9LCBbXSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXG5mdW5jdGlvbiBzYW1lVm5vZGUodm5vZGUxLCB2bm9kZTIpIHtcbiAgcmV0dXJuIHZub2RlMS5rZXkgPT09IHZub2RlMi5rZXkgJiYgdm5vZGUxLnNlbCA9PT0gdm5vZGUyLnNlbDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlS2V5VG9PbGRJZHgoY2hpbGRyZW4sIGJlZ2luSWR4LCBlbmRJZHgpIHtcbiAgdmFyIGksIG1hcCA9IHt9LCBrZXk7XG4gIGZvciAoaSA9IGJlZ2luSWR4OyBpIDw9IGVuZElkeDsgKytpKSB7XG4gICAga2V5ID0gY2hpbGRyZW5baV0ua2V5O1xuICAgIGlmIChpc0RlZihrZXkpKSBtYXBba2V5XSA9IGk7XG4gIH1cbiAgcmV0dXJuIG1hcDtcbn1cblxudmFyIGhvb2tzID0gWydjcmVhdGUnLCAndXBkYXRlJywgJ3JlbW92ZScsICdkZXN0cm95JywgJ3ByZScsICdwb3N0J107XG5cbmZ1bmN0aW9uIGluaXQobW9kdWxlcywgYXBpKSB7XG4gIHZhciBpLCBqLCBjYnMgPSB7fTtcblxuICBpZiAoaXNVbmRlZihhcGkpKSBhcGkgPSBkb21BcGk7XG5cbiAgZm9yIChpID0gMDsgaSA8IGhvb2tzLmxlbmd0aDsgKytpKSB7XG4gICAgY2JzW2hvb2tzW2ldXSA9IFtdO1xuICAgIGZvciAoaiA9IDA7IGogPCBtb2R1bGVzLmxlbmd0aDsgKytqKSB7XG4gICAgICBpZiAobW9kdWxlc1tqXVtob29rc1tpXV0gIT09IHVuZGVmaW5lZCkgY2JzW2hvb2tzW2ldXS5wdXNoKG1vZHVsZXNbal1baG9va3NbaV1dKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlbXB0eU5vZGVBdChlbG0pIHtcbiAgICByZXR1cm4gVk5vZGUoYXBpLnRhZ05hbWUoZWxtKS50b0xvd2VyQ2FzZSgpLCB7fSwgW10sIHVuZGVmaW5lZCwgZWxtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVJtQ2IoY2hpbGRFbG0sIGxpc3RlbmVycykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLWxpc3RlbmVycyA9PT0gMCkge1xuICAgICAgICB2YXIgcGFyZW50ID0gYXBpLnBhcmVudE5vZGUoY2hpbGRFbG0pO1xuICAgICAgICBhcGkucmVtb3ZlQ2hpbGQocGFyZW50LCBjaGlsZEVsbSk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUVsbSh2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIGksIGRhdGEgPSB2bm9kZS5kYXRhO1xuICAgIGlmIChpc0RlZihkYXRhKSkge1xuICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLmhvb2spICYmIGlzRGVmKGkgPSBpLmluaXQpKSB7XG4gICAgICAgIGkodm5vZGUpO1xuICAgICAgICBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGVsbSwgY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlbiwgc2VsID0gdm5vZGUuc2VsO1xuICAgIGlmIChpc0RlZihzZWwpKSB7XG4gICAgICAvLyBQYXJzZSBzZWxlY3RvclxuICAgICAgdmFyIGhhc2hJZHggPSBzZWwuaW5kZXhPZignIycpO1xuICAgICAgdmFyIGRvdElkeCA9IHNlbC5pbmRleE9mKCcuJywgaGFzaElkeCk7XG4gICAgICB2YXIgaGFzaCA9IGhhc2hJZHggPiAwID8gaGFzaElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICB2YXIgZG90ID0gZG90SWR4ID4gMCA/IGRvdElkeCA6IHNlbC5sZW5ndGg7XG4gICAgICB2YXIgdGFnID0gaGFzaElkeCAhPT0gLTEgfHwgZG90SWR4ICE9PSAtMSA/IHNlbC5zbGljZSgwLCBNYXRoLm1pbihoYXNoLCBkb3QpKSA6IHNlbDtcbiAgICAgIGVsbSA9IHZub2RlLmVsbSA9IGlzRGVmKGRhdGEpICYmIGlzRGVmKGkgPSBkYXRhLm5zKSA/IGFwaS5jcmVhdGVFbGVtZW50TlMoaSwgdGFnKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogYXBpLmNyZWF0ZUVsZW1lbnQodGFnKTtcbiAgICAgIGlmIChoYXNoIDwgZG90KSBlbG0uaWQgPSBzZWwuc2xpY2UoaGFzaCArIDEsIGRvdCk7XG4gICAgICBpZiAoZG90SWR4ID4gMCkgZWxtLmNsYXNzTmFtZSA9IHNlbC5zbGljZShkb3QrMSkucmVwbGFjZSgvXFwuL2csICcgJyk7XG4gICAgICBpZiAoaXMuYXJyYXkoY2hpbGRyZW4pKSB7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgICAgIGFwaS5hcHBlbmRDaGlsZChlbG0sIGNyZWF0ZUVsbShjaGlsZHJlbltpXSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoaXMucHJpbWl0aXZlKHZub2RlLnRleHQpKSB7XG4gICAgICAgIGFwaS5hcHBlbmRDaGlsZChlbG0sIGFwaS5jcmVhdGVUZXh0Tm9kZSh2bm9kZS50ZXh0KSk7XG4gICAgICB9XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLmNyZWF0ZS5sZW5ndGg7ICsraSkgY2JzLmNyZWF0ZVtpXShlbXB0eU5vZGUsIHZub2RlKTtcbiAgICAgIGkgPSB2bm9kZS5kYXRhLmhvb2s7IC8vIFJldXNlIHZhcmlhYmxlXG4gICAgICBpZiAoaXNEZWYoaSkpIHtcbiAgICAgICAgaWYgKGkuY3JlYXRlKSBpLmNyZWF0ZShlbXB0eU5vZGUsIHZub2RlKTtcbiAgICAgICAgaWYgKGkuaW5zZXJ0KSBpbnNlcnRlZFZub2RlUXVldWUucHVzaCh2bm9kZSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsbSA9IHZub2RlLmVsbSA9IGFwaS5jcmVhdGVUZXh0Tm9kZSh2bm9kZS50ZXh0KTtcbiAgICB9XG4gICAgcmV0dXJuIHZub2RlLmVsbTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFZub2RlcyhwYXJlbnRFbG0sIGJlZm9yZSwgdm5vZGVzLCBzdGFydElkeCwgZW5kSWR4LCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICBmb3IgKDsgc3RhcnRJZHggPD0gZW5kSWR4OyArK3N0YXJ0SWR4KSB7XG4gICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKHZub2Rlc1tzdGFydElkeF0sIGluc2VydGVkVm5vZGVRdWV1ZSksIGJlZm9yZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaW52b2tlRGVzdHJveUhvb2sodm5vZGUpIHtcbiAgICB2YXIgaSwgaiwgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgaWYgKGlzRGVmKGRhdGEpKSB7XG4gICAgICBpZiAoaXNEZWYoaSA9IGRhdGEuaG9vaykgJiYgaXNEZWYoaSA9IGkuZGVzdHJveSkpIGkodm5vZGUpO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5kZXN0cm95Lmxlbmd0aDsgKytpKSBjYnMuZGVzdHJveVtpXSh2bm9kZSk7XG4gICAgICBpZiAoaXNEZWYoaSA9IHZub2RlLmNoaWxkcmVuKSkge1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICBpbnZva2VEZXN0cm95SG9vayh2bm9kZS5jaGlsZHJlbltqXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmVWbm9kZXMocGFyZW50RWxtLCB2bm9kZXMsIHN0YXJ0SWR4LCBlbmRJZHgpIHtcbiAgICBmb3IgKDsgc3RhcnRJZHggPD0gZW5kSWR4OyArK3N0YXJ0SWR4KSB7XG4gICAgICB2YXIgaSwgbGlzdGVuZXJzLCBybSwgY2ggPSB2bm9kZXNbc3RhcnRJZHhdO1xuICAgICAgaWYgKGlzRGVmKGNoKSkge1xuICAgICAgICBpZiAoaXNEZWYoY2guc2VsKSkge1xuICAgICAgICAgIGludm9rZURlc3Ryb3lIb29rKGNoKTtcbiAgICAgICAgICBsaXN0ZW5lcnMgPSBjYnMucmVtb3ZlLmxlbmd0aCArIDE7XG4gICAgICAgICAgcm0gPSBjcmVhdGVSbUNiKGNoLmVsbSwgbGlzdGVuZXJzKTtcbiAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnJlbW92ZS5sZW5ndGg7ICsraSkgY2JzLnJlbW92ZVtpXShjaCwgcm0pO1xuICAgICAgICAgIGlmIChpc0RlZihpID0gY2guZGF0YSkgJiYgaXNEZWYoaSA9IGkuaG9vaykgJiYgaXNEZWYoaSA9IGkucmVtb3ZlKSkge1xuICAgICAgICAgICAgaShjaCwgcm0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBybSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHsgLy8gVGV4dCBub2RlXG4gICAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudEVsbSwgY2guZWxtKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZUNoaWxkcmVuKHBhcmVudEVsbSwgb2xkQ2gsIG5ld0NoLCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICB2YXIgb2xkU3RhcnRJZHggPSAwLCBuZXdTdGFydElkeCA9IDA7XG4gICAgdmFyIG9sZEVuZElkeCA9IG9sZENoLmxlbmd0aCAtIDE7XG4gICAgdmFyIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFswXTtcbiAgICB2YXIgb2xkRW5kVm5vZGUgPSBvbGRDaFtvbGRFbmRJZHhdO1xuICAgIHZhciBuZXdFbmRJZHggPSBuZXdDaC5sZW5ndGggLSAxO1xuICAgIHZhciBuZXdTdGFydFZub2RlID0gbmV3Q2hbMF07XG4gICAgdmFyIG5ld0VuZFZub2RlID0gbmV3Q2hbbmV3RW5kSWR4XTtcbiAgICB2YXIgb2xkS2V5VG9JZHgsIGlkeEluT2xkLCBlbG1Ub01vdmUsIGJlZm9yZTtcblxuICAgIHdoaWxlIChvbGRTdGFydElkeCA8PSBvbGRFbmRJZHggJiYgbmV3U3RhcnRJZHggPD0gbmV3RW5kSWR4KSB7XG4gICAgICBpZiAoaXNVbmRlZihvbGRTdGFydFZub2RlKSkge1xuICAgICAgICBvbGRTdGFydFZub2RlID0gb2xkQ2hbKytvbGRTdGFydElkeF07IC8vIFZub2RlIGhhcyBiZWVuIG1vdmVkIGxlZnRcbiAgICAgIH0gZWxzZSBpZiAoaXNVbmRlZihvbGRFbmRWbm9kZSkpIHtcbiAgICAgICAgb2xkRW5kVm5vZGUgPSBvbGRDaFstLW9sZEVuZElkeF07XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWbm9kZShvbGRTdGFydFZub2RlLCBuZXdTdGFydFZub2RlKSkge1xuICAgICAgICBwYXRjaFZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFsrK29sZFN0YXJ0SWR4XTtcbiAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkRW5kVm5vZGUsIG5ld0VuZFZub2RlKSkge1xuICAgICAgICBwYXRjaFZub2RlKG9sZEVuZFZub2RlLCBuZXdFbmRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgb2xkRW5kVm5vZGUgPSBvbGRDaFstLW9sZEVuZElkeF07XG4gICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3RW5kVm5vZGUpKSB7IC8vIFZub2RlIG1vdmVkIHJpZ2h0XG4gICAgICAgIHBhdGNoVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3RW5kVm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBvbGRTdGFydFZub2RlLmVsbSwgYXBpLm5leHRTaWJsaW5nKG9sZEVuZFZub2RlLmVsbSkpO1xuICAgICAgICBvbGRTdGFydFZub2RlID0gb2xkQ2hbKytvbGRTdGFydElkeF07XG4gICAgICAgIG5ld0VuZFZub2RlID0gbmV3Q2hbLS1uZXdFbmRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkRW5kVm5vZGUsIG5ld1N0YXJ0Vm5vZGUpKSB7IC8vIFZub2RlIG1vdmVkIGxlZnRcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRFbmRWbm9kZSwgbmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIG9sZEVuZFZub2RlLmVsbSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICBvbGRFbmRWbm9kZSA9IG9sZENoWy0tb2xkRW5kSWR4XTtcbiAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKGlzVW5kZWYob2xkS2V5VG9JZHgpKSBvbGRLZXlUb0lkeCA9IGNyZWF0ZUtleVRvT2xkSWR4KG9sZENoLCBvbGRTdGFydElkeCwgb2xkRW5kSWR4KTtcbiAgICAgICAgaWR4SW5PbGQgPSBvbGRLZXlUb0lkeFtuZXdTdGFydFZub2RlLmtleV07XG4gICAgICAgIGlmIChpc1VuZGVmKGlkeEluT2xkKSkgeyAvLyBOZXcgZWxlbWVudFxuICAgICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBjcmVhdGVFbG0obmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBlbG1Ub01vdmUgPSBvbGRDaFtpZHhJbk9sZF07XG4gICAgICAgICAgcGF0Y2hWbm9kZShlbG1Ub01vdmUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgICAgb2xkQ2hbaWR4SW5PbGRdID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBlbG1Ub01vdmUuZWxtLCBvbGRTdGFydFZub2RlLmVsbSk7XG4gICAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvbGRTdGFydElkeCA+IG9sZEVuZElkeCkge1xuICAgICAgYmVmb3JlID0gaXNVbmRlZihuZXdDaFtuZXdFbmRJZHgrMV0pID8gbnVsbCA6IG5ld0NoW25ld0VuZElkeCsxXS5lbG07XG4gICAgICBhZGRWbm9kZXMocGFyZW50RWxtLCBiZWZvcmUsIG5ld0NoLCBuZXdTdGFydElkeCwgbmV3RW5kSWR4LCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgIH0gZWxzZSBpZiAobmV3U3RhcnRJZHggPiBuZXdFbmRJZHgpIHtcbiAgICAgIHJlbW92ZVZub2RlcyhwYXJlbnRFbG0sIG9sZENoLCBvbGRTdGFydElkeCwgb2xkRW5kSWR4KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwYXRjaFZub2RlKG9sZFZub2RlLCB2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIGksIGhvb2s7XG4gICAgaWYgKGlzRGVmKGkgPSB2bm9kZS5kYXRhKSAmJiBpc0RlZihob29rID0gaS5ob29rKSAmJiBpc0RlZihpID0gaG9vay5wcmVwYXRjaCkpIHtcbiAgICAgIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICB9XG4gICAgdmFyIGVsbSA9IHZub2RlLmVsbSA9IG9sZFZub2RlLmVsbSwgb2xkQ2ggPSBvbGRWbm9kZS5jaGlsZHJlbiwgY2ggPSB2bm9kZS5jaGlsZHJlbjtcbiAgICBpZiAob2xkVm5vZGUgPT09IHZub2RlKSByZXR1cm47XG4gICAgaWYgKCFzYW1lVm5vZGUob2xkVm5vZGUsIHZub2RlKSkge1xuICAgICAgdmFyIHBhcmVudEVsbSA9IGFwaS5wYXJlbnROb2RlKG9sZFZub2RlLmVsbSk7XG4gICAgICBlbG0gPSBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgZWxtLCBvbGRWbm9kZS5lbG0pO1xuICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgW29sZFZub2RlXSwgMCwgMCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChpc0RlZih2bm9kZS5kYXRhKSkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy51cGRhdGUubGVuZ3RoOyArK2kpIGNicy51cGRhdGVbaV0ob2xkVm5vZGUsIHZub2RlKTtcbiAgICAgIGkgPSB2bm9kZS5kYXRhLmhvb2s7XG4gICAgICBpZiAoaXNEZWYoaSkgJiYgaXNEZWYoaSA9IGkudXBkYXRlKSkgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgICBpZiAoaXNVbmRlZih2bm9kZS50ZXh0KSkge1xuICAgICAgaWYgKGlzRGVmKG9sZENoKSAmJiBpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKG9sZENoICE9PSBjaCkgdXBkYXRlQ2hpbGRyZW4oZWxtLCBvbGRDaCwgY2gsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKGNoKSkge1xuICAgICAgICBpZiAoaXNEZWYob2xkVm5vZGUudGV4dCkpIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgICAgYWRkVm5vZGVzKGVsbSwgbnVsbCwgY2gsIDAsIGNoLmxlbmd0aCAtIDEsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKG9sZENoKSkge1xuICAgICAgICByZW1vdmVWbm9kZXMoZWxtLCBvbGRDaCwgMCwgb2xkQ2gubGVuZ3RoIC0gMSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKG9sZFZub2RlLnRleHQpKSB7XG4gICAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9sZFZub2RlLnRleHQgIT09IHZub2RlLnRleHQpIHtcbiAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sIHZub2RlLnRleHQpO1xuICAgIH1cbiAgICBpZiAoaXNEZWYoaG9vaykgJiYgaXNEZWYoaSA9IGhvb2sucG9zdHBhdGNoKSkge1xuICAgICAgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbihvbGRWbm9kZSwgdm5vZGUpIHtcbiAgICB2YXIgaSwgZWxtLCBwYXJlbnQ7XG4gICAgdmFyIGluc2VydGVkVm5vZGVRdWV1ZSA9IFtdO1xuICAgIGZvciAoaSA9IDA7IGkgPCBjYnMucHJlLmxlbmd0aDsgKytpKSBjYnMucHJlW2ldKCk7XG5cbiAgICBpZiAoaXNVbmRlZihvbGRWbm9kZS5zZWwpKSB7XG4gICAgICBvbGRWbm9kZSA9IGVtcHR5Tm9kZUF0KG9sZFZub2RlKTtcbiAgICB9XG5cbiAgICBpZiAoc2FtZVZub2RlKG9sZFZub2RlLCB2bm9kZSkpIHtcbiAgICAgIHBhdGNoVm5vZGUob2xkVm5vZGUsIHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbG0gPSBvbGRWbm9kZS5lbG07XG4gICAgICBwYXJlbnQgPSBhcGkucGFyZW50Tm9kZShlbG0pO1xuXG4gICAgICBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG5cbiAgICAgIGlmIChwYXJlbnQgIT09IG51bGwpIHtcbiAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnQsIHZub2RlLmVsbSwgYXBpLm5leHRTaWJsaW5nKGVsbSkpO1xuICAgICAgICByZW1vdmVWbm9kZXMocGFyZW50LCBbb2xkVm5vZGVdLCAwLCAwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgaW5zZXJ0ZWRWbm9kZVF1ZXVlLmxlbmd0aDsgKytpKSB7XG4gICAgICBpbnNlcnRlZFZub2RlUXVldWVbaV0uZGF0YS5ob29rLmluc2VydChpbnNlcnRlZFZub2RlUXVldWVbaV0pO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnBvc3QubGVuZ3RoOyArK2kpIGNicy5wb3N0W2ldKCk7XG4gICAgcmV0dXJuIHZub2RlO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtpbml0OiBpbml0fTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oc2VsLCBkYXRhLCBjaGlsZHJlbiwgdGV4dCwgZWxtKSB7XG4gIHZhciBrZXkgPSBkYXRhID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkYXRhLmtleTtcbiAgcmV0dXJuIHtzZWw6IHNlbCwgZGF0YTogZGF0YSwgY2hpbGRyZW46IGNoaWxkcmVuLFxuICAgICAgICAgIHRleHQ6IHRleHQsIGVsbTogZWxtLCBrZXk6IGtleX07XG59O1xuIiwiY29uc3QgeyBFaXRoZXIgfSA9IHJlcXVpcmUoJ2ZwLWxpYicpXG5cbmNvbnN0IFN0YXRlQ2hhbmdlID0gKGNoYW5uZWwpID0+IChTdGF0ZSkgPT4gKF8pID0+IHtcbiAgY29uc3QgZWl0aGVyX3N0YXRlID0gY2hhbm5lbC5zaGlmdCgpXG4gIFxuICBpZiAoZWl0aGVyX3N0YXRlICE9PSB1bmRlZmluZWQpIHsgXG4gICAgLy8gcGFzcyBpbnRlcm5hbCBlaXRoZXIgdmFsdWUgdG8gU3RhdGUuY2hhbmdlXG4gICAgRWl0aGVyLmJpbWFwXG4gICAgICAoZXJyX3N0YXRlID0+IHsgLy8gc2FtZSBiZWhhdmlvciBmb3IgZXJyb3Igc3RhdGVcbiAgICAgICAgU3RhdGUuY2hhbmdlKGVycl9zdGF0ZSkgXG4gICAgICB9KVxuICAgICAgKHN0YXRlID0+IHsgXG4gICAgICAgIFN0YXRlLmNoYW5nZShzdGF0ZSkgXG4gICAgICB9KVxuICAgICAgKGVpdGhlcl9zdGF0ZSkgXG4gIH1cbiAgICBcbiAgd2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShTdGF0ZUNoYW5nZShjaGFubmVsKShTdGF0ZSkpXG59XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVDaGFuZ2UiLCJjb25zdCBoID0gcmVxdWlyZSgnc25hYmJkb20vaCcpXG5cbmNvbnN0IFN0YXRlQ3JlYXRvciA9ICh7XG4gIGVyck1zZyxcbiAgY2xvZ3Ncbn0pID0+IHtcbiAgd2hpbGUgKGNsb2dzLmxlbmd0aCA+IDMwKSB7XG4gICAgY2xvZ3Muc2hpZnQoKVxuICB9XG4gIHJldHVybiBoKCdkaXYjY29udGVudCcsIFtcbiAgICAgIGgoJ2RpdiNlcnInLCBbZXJyTXNnfHwnJ10pLFxuICAgICAgaCgnZGl2I2Nsb2cnLCBjbG9ncyA/IGNsb2dzLm1hcChsb2cgPT4gaCgnc3BhbicsIFtsb2ddKSkgOiAnJylcbiAgICBdKVxufVxuXG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVDcmVhdG9yIiwiY29uc3Qgc25hYmJkb20gPSByZXF1aXJlKCdzbmFiYmRvbScpXG5jb25zdCBwYXRjaCA9IHNuYWJiZG9tLmluaXQoWyAvLyBJbml0IHBhdGNoIGZ1bmN0aW9uIHdpdGggY2hvb3NlbiBtb2R1bGVzXG4gIHJlcXVpcmUoJ3NuYWJiZG9tL21vZHVsZXMvY2xhc3MnKSwgLy8gbWFrZXMgaXQgZWFzeSB0byB0b2dnbGUgY2xhc3Nlc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL3Byb3BzJyksIC8vIGZvciBzZXR0aW5nIHByb3BlcnRpZXMgb24gRE9NIGVsZW1lbnRzXG4gIHJlcXVpcmUoJ3NuYWJiZG9tL21vZHVsZXMvc3R5bGUnKSwgLy8gaGFuZGxlcyBzdHlsaW5nIG9uIGVsZW1lbnRzIHdpdGggc3VwcG9ydCBmb3IgYW5pbWF0aW9uc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJyksIC8vIGF0dGFjaGVzIGV2ZW50IGxpc3RlbmVyc1xuXSlcblxuY29uc3QgaW5pdCA9IChwYXJlbnROb2RlKSA9PiAoU3RhdGVDcmVhdG9yKSA9PiAoaW5pdF9wYXJhbXMpID0+IHtcbiAgdmFyIF92dHJlZSA9IHBhcmVudE5vZGVcblxuICBjb25zdCBjaGFuZ2UgPSAoc3RhdGUpID0+IHtcblxuICAgIGNvbnN0IG5ld192dHJlZSA9IFN0YXRlQ3JlYXRvcihzdGF0ZSlcbiAgICBcbiAgICBwYXRjaChfdnRyZWUsIG5ld192dHJlZSlcbiAgICBfdnRyZWUgPSBuZXdfdnRyZWVcbiAgfVxuICBcbiAgY2hhbmdlKGluaXRfcGFyYW1zKVxuICBcbiAgcmV0dXJuIHsgY2hhbmdlIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7IGluaXQgfSIsImNvbnN0IHsgcGlwZSwgRWl0aGVyIH0gPSByZXF1aXJlKCdmcC1saWInKVxuY29uc3QgZnV6enlzZXQgPSByZXF1aXJlKCdmdXp6eXNldC5qcycpXG5jb25zdCBhbm55YW5nID0gcmVxdWlyZSgnYW5ueWFuZycpXG5jb25zdCBjaGFubmVsID0gW11cblxuY29uc3QgJGFjdGl2YXRlQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGl2YXRlLWJ0bicpXG5jb25zdCAkc2hvd0NvbW1hbmRzQnRuID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Nob3ctY29tbWFuZHMtYnRuJylcblxuY29uc3QgZG9tX2V2ZW50cyA9IHtcbiAgJ2NsaWNrJzogW3tcbiAgICBlbGVtZW50OiAkYWN0aXZhdGVCdG4sXG4gICAgY2FsbGJhY2s6IGZ1bmN0aW9uKF8pIHtcbiAgICAgIGFubnlhbmcuc3RhcnQoeyBhdXRvUmVzdGFydDogZmFsc2UsIGNvbnRpbnVvdXM6IGZhbHNlIH0pXG4gICAgfVxuICB9LCB7XG4gICAgZWxlbWVudDogJHNob3dDb21tYW5kc0J0bixcbiAgICBjYWxsYmFjazogZnVuY3Rpb24oXykge1xuICAgICAgYW5ueWFuZy50cmlnZ2VyKCdzaG93IGNvbW1hbmRzJylcbiAgICB9XG4gIH1dXG59XG5cbmNvbnN0IGNhbGxiYWNrcyA9IHtcbiAnc3RhcnQnOiAoKSA9PiB7XG4gICAkYWN0aXZhdGVCdG4uZGlzYWJsZWQgPSB0cnVlXG4gICAkYWN0aXZhdGVCdG4udGV4dENvbnRlbnQgPSAnTGlzdGVuaW5nJ1xuIH0sXG4gJ3Jlc3VsdCc6IChyZXN1bHQpID0+IHtcbiAgIC8vY29uc29sZS5sb2cocmVzdWx0KVxuIH0sXG4gJ3Jlc3VsdE1hdGNoJzogKHJlc3VsdCkgPT4ge1xuICAgLy9jb25zb2xlLmxvZyhyZXN1bHQpXG4gfSxcbiAncmVzdWx0Tm9NYXRjaCc6IChyZXN1bHQpID0+IHtcbiAgIGNoYW5uZWwucHVzaChFaXRoZXIuTGVmdCh7IGVyck1zZzogYE5vIGNvbW1hbmQgbWF0Y2hlcyBmb3IgJHtyZXN1bHRbMF19YCB9KSlcbiB9LFxuICdlbmQnOiAoKSA9PiB7XG4gICAkYWN0aXZhdGVCdG4uZGlzYWJsZWQgPSBmYWxzZVxuICAgJGFjdGl2YXRlQnRuLnRleHRDb250ZW50ID0gJ1N0YXJ0J1xuIH1cbn1cblxuY29uc3QgY29tbWFuZHMgPSAoZGF0YSkgPT4gKGhvcml6b24pID0+IHtcbiAgY29uc3QgZnV6enlfY2xpZW50cyA9IGZ1enp5c2V0KE9iamVjdC5rZXlzKGRhdGEuY2xpZW50cykpXG4gIGNvbnN0IGxldHRlcnMgPSBob3Jpem9uKCdsZXR0ZXJzJylcblxuIFxuICBjb25zdCBfY29tbWFuZHMgPSB7XG4gICAgJ2NsaWVudCAqbmFtZSc6IHBpcGUoXG4gICAgICAobmFtZSkgPT4ge1xuICAgICAgICBjb25zdCByZXMgPSBmdXp6eV9jbGllbnRzLmdldChuYW1lKVxuICAgICAgICBjb25zb2xlLmxvZyhuYW1lLHJlcylcbiAgICAgICAgaWYgKHJlcyAhPT0gbnVsbCkge1xuICAgICAgICAgIHJldHVybiBFaXRoZXIuUmlnaHQoYGZ1enp5IGNsaWVudCBmb3VuZCAke3Jlc31gKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBFaXRoZXIuTGVmdChgY2xpZW50ICR7bmFtZX0gbm90IGZvdW5kIGJ5IGZ1enp5YClcbiAgICAgICAgfVxuICAgICAgfSwgXG4gICAgICBFaXRoZXIuYmltYXBcbiAgICAgICAgKGVyck1zZyA9PiB7IHJldHVybiB7IGVyck1zZyB9IH0pXG4gICAgICAgIChzdWNjZXNzTXNnID0+IHsgXG4gICAgICAgICAgY29uc3QgY2xvZ3MgPSBkYXRhLmNsb2dzLnNsaWNlKClcbiAgICAgICAgICBjbG9ncy5wdXNoKHN1Y2Nlc3NNc2cpXG4gICAgICAgICAgcmV0dXJuIHsgY2xvZ3MgfVxuICAgICAgICB9KVxuICAgICksXG4gICAgJ2luY3JlYXNlIDpsZXR0ZXInOiAobGV0dGVyKSA9PiB7XG4gICAgICBsZXR0ZXIgPSBsZXR0ZXIudG9Mb3dlckNhc2UoKVxuICAgICAgXG4gICAgICBsZXR0ZXJzLmZpbmQobGV0dGVyKS5mZXRjaCgpLmZvckVhY2gocmVzID0+IHtcbiAgICAgICAgY29uc29sZS5sb2cocmVzKVxuICAgICAgICBpZiAocmVzICE9PSBudWxsKSB7XG4gICAgICAgICAgbGV0dGVycy5yZXBsYWNlKHsgaWQ6IGxldHRlciwgY291bnQ6IHJlcy5jb3VudCArIDEgfSlcbiAgICAgICAgICByZXR1cm4gRWl0aGVyLlJpZ2h0KGBpbmNyZWFzZWQgbGV0dGVyICR7bGV0dGVyfSB0byAke3Jlcy5jb3VudH1gKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBFaXRoZXIuTGVmdChgY2Fubm90IGluY3JlYXNlIGxldHRlciAke2xldHRlcn0gLS0gaXQgZG9lcyBub3QgZXhpc3RgKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0sXG4gICAgJ3Nob3cgY29tbWFuZHMnOiAoKSA9PiB7XG4gICAgICB2YXIgY2xvZ3MgPSBkYXRhLmNsb2dzLnNsaWNlKClcbiAgICAgIGNsb2dzLnB1c2goUmVmbGVjdC5vd25LZXlzKF9jb21tYW5kcykuam9pbignLCAnKSArICdcXG4nKVxuICAgICAgcmV0dXJuIEVpdGhlci5SaWdodCh7IGNsb2dzIH0pXG4gICAgfSxcbiAgICAnY2xlYXIgc2NyZWVuJzogKCkgPT4ge1xuICAgICAgcmV0dXJuIEVpdGhlci5SaWdodCh7IGNsb2dzOiBbXSB9KVxuICAgIH0sXG4gICAgJ2dldCBjdXJyZW50IHVzZXInOiAoKSA9PiB7XG4gICAgICBsZXR0ZXJzLmZpbmQoJ2EnKS5mZXRjaCgpLmRlZmF1bHRJZkVtcHR5KCkuc3Vic2NyaWJlKHJlcyA9PiB7XG4gICAgICAgIGlmIChyZXMgIT09IG51bGwpIHtcbiAgICAgICAgICByZXMuY291bnQrK1xuICAgICAgICAgIGNvbnNvbGUubG9nKHJlcylcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICB9XG4gIH1cbiAgXG4gIGNvbnN0IHdyYXBwZXIgPSAoZikgPT4gKC4uLmFyZ3MpID0+IHtcbiAgICBjaGFubmVsLnB1c2goZiguLi5hcmdzKSlcbiAgfVxuICBcbiAgZm9yIChsZXQgbmFtZSBvZiBPYmplY3Qua2V5cyhfY29tbWFuZHMpKSB7XG4gICAgX2NvbW1hbmRzW25hbWVdID0gd3JhcHBlcihfY29tbWFuZHNbbmFtZV0pXG4gIH1cbiAgcmV0dXJuIF9jb21tYW5kc1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgYW5ueWFuZywgZG9tX2V2ZW50cywgY2FsbGJhY2tzLCBjb21tYW5kcywgY2hhbm5lbCB9IiwiLypnbG9iYWwgSG9yaXpvbiovXG5jb25zdCBlbnYgPSByZXF1aXJlKCcuL2FubnlhbmdFbnYnKVxuXG5jb25zdCBTdGF0ZU1hY2hpbmUgPSByZXF1aXJlKCcuL1N0YXRlTWFjaGluZScpXG5jb25zdCBTdGF0ZUNoYW5nZSA9IHJlcXVpcmUoJy4vU3RhdGVDaGFuZ2UnKVxuY29uc3QgU3RhdGVDcmVhdG9yID0gcmVxdWlyZSgnLi9TdGF0ZUNyZWF0b3InKVxuY29uc3QgZGF0YSA9IHtcbiAgY2xpZW50czoge1xuICAgICAnQm9iIEpvbmVzJzoge30sXG4gICAgICdHcmVnIEhhcm1vbic6IHt9LFxuICAgICAnTGVhbm4gTGV3aXMnOiB7fSxcbiAgICAgJ0hhcm1vbnkgQ2hvc3R3aXR6Jzoge31cbiAgIH0sXG4gICBjbG9nczogW11cbn1cblxuY29uc3QgaG9yaXpvbiA9IEhvcml6b24oKVxuaG9yaXpvbi5zdGF0dXMoc3RhdHVzID0+IHtcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2hlYWRlcicpLmNsYXNzTmFtZSA9IGBzdGF0dXMtJHtzdGF0dXMudHlwZX1gXG59KVxuaG9yaXpvbi5jb25uZWN0KClcblxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbmNvbnN0IG15Q29tbWFuZHMgPSBlbnYuY29tbWFuZHMoZGF0YSkoaG9yaXpvbilcbmdsb2JhbC5teUNvbW1hbmRzID0gbXlDb21tYW5kc1xuZ2xvYmFsLmhvcml6b24gPSBob3Jpem9uXG5nbG9iYWwuYW5ueWFuZyA9IGVudi5hbm55YW5nXG5cbmZvciAodmFyIGNiIGluIGVudi5jYWxsYmFja3MpIHtcbiAgZW52LmFubnlhbmcuYWRkQ2FsbGJhY2soY2IsIGVudi5jYWxsYmFja3NbY2JdKVxufVxuZm9yICh2YXIgdHlwZSBpbiBlbnYuZG9tX2V2ZW50cykge1xuICBlbnYuZG9tX2V2ZW50c1t0eXBlXS5mb3JFYWNoKGV2ZW50ID0+IHtcbiAgICBldmVudC5lbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZXZlbnQuY2FsbGJhY2spXG4gIH0pXG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8gXG5cbmNvbnN0IG15U3RhdGUgPSBTdGF0ZU1hY2hpbmUuaW5pdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGVudCcpKShTdGF0ZUNyZWF0b3IpKHtcbiAgZXJyTXNnOiAnUG9vJyxcbiAgY2xvZ3M6IGRhdGEuY2xvZ3Ncbn0pXG5cblxuY29uc3QgbXlTdGF0ZUNoYW5nZSA9IFN0YXRlQ2hhbmdlKGVudi5jaGFubmVsKShteVN0YXRlKVxuXG5lbnYuYW5ueWFuZy5hZGRDb21tYW5kcyhteUNvbW1hbmRzKVxuZW52LmFubnlhbmcuZGVidWcoKVxud2luZG93LnJlcXVlc3RBbmltYXRpb25GcmFtZShteVN0YXRlQ2hhbmdlKVxuIl19
