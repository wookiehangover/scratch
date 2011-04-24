(function(global, document) {

  //  Cache refs to speed up calls to native utils
  var
  forEach = Array.prototype.forEach,
  hasOwn = Object.prototype.hasOwnProperty,
  slice = Array.prototype.slice,
  toString = Object.prototype.toString,

  //  ID string matching
  rIdExp  = /^(#([\w\-\_\.]+))$/,

  //  Ready fn cache
  readyStack = [],
  readyBound = false,
  readyFired = false,


  //  Declare constructor
  //  Returns an instance object.
  Popcorn = function( entity, options ) {
    //  Return new Popcorn object
    return new Popcorn.p.init( entity, options || null );
  };

  //  Instance caching
  Popcorn.instances = [];
  Popcorn.instanceIds = {};

  Popcorn.removeInstance = function( instance ) {
    //  If called prior to any instances being created
    //  Return early to avoid splicing on nothing
    if ( !Popcorn.instances.length ) {
      return;
    }

    //  Remove instance from Popcorn.instances
    Popcorn.instances.splice( Popcorn.instanceIds[ instance.id ], 1 );

    //  Delete the instance id key
    delete Popcorn.instanceIds[ instance.id ];

    //  Return current modified instances
    return Popcorn.instances;
  };

  //  Addes a Popcorn instance to the Popcorn instance array
  Popcorn.addInstance = function( instance ) {

    var instanceLen = Popcorn.instances.length,
        instanceId = instance.media.id && instance.media.id;

    //  If the media element has its own `id` use it, otherwise provide one
    //  Ensure that instances have unique ids and unique entries
    //  Uses `in` operator to avoid false positives on 0
    instance.id = !( instanceId in Popcorn.instanceIds ) && instanceId ||
                      "__popcorn" + instanceLen;

    //  Create a reference entry for this instance
    Popcorn.instanceIds[ instance.id ] = instanceLen;

    //  Add this instance to the cache
    Popcorn.instances.push( instance );

    //  Return the current modified instances
    return Popcorn.instances;
  };

  //  Request Popcorn object instance by id
  Popcorn.getInstanceById = function( id ) {
    return Popcorn.instances[ Popcorn.instanceIds[ id ] ];
  };

  //  Remove Popcorn object instance by id
  Popcorn.removeInstanceById = function( id ) {
    return Popcorn.removeInstance( Popcorn.instances[ Popcorn.instanceIds[ id ] ] );
  };

  //  Declare a shortcut (Popcorn.p) to and a definition of
  //  the new prototype for our Popcorn constructor
  Popcorn.p = Popcorn.prototype = {

    init: function( entity, options ) {

      var matches;

      //  Supports Popcorn(function () { /../ })
      //  Originally proposed by Daniel Brooks

      if ( typeof entity === "function" ) {

        //  If document ready has already fired
        if ( document.readyState === "interactive" || document.readyState === "complete" ) {

          entity(document, Popcorn);

          return;
        }
        //  Add `entity` fn to ready stack
        readyStack.push( entity );

        //  This process should happen once per page load
        if ( !readyBound ) {

          //  set readyBound flag
          readyBound = true;

          var DOMContentLoaded  = function () {

            readyFired = true;

            //  Remove global DOM ready listener
            document.removeEventListener( "DOMContentLoaded", DOMContentLoaded, false );

            //  Execute all ready function in the stack
            for ( var i = 0; i < readyStack.length; i++ ) {

              readyStack[i].call( document, Popcorn );

            }
            //  GC readyStack
            readyStack = null;
          };

          //  Register global DOM ready listener
          document.addEventListener( "DOMContentLoaded", DOMContentLoaded, false);
        }

        return;
      }

      //  Check if entity is a valid string id
      matches = rIdExp.exec( entity );

      //  Get media element by id or object reference
      this.media = matches && matches.length && matches[ 2 ] ?
                    document.getElementById( matches[ 2 ] ) :
                    entity;

      //  Create an audio or video element property reference
      this[ ( this.media.tagName && this.media.tagName.toLowerCase() ) || "video" ] = this.media;

      //  Register new instance
      Popcorn.addInstance( this );

      this.options = options || { };
      this.data = {
        history: [],
        events: {},
        trackEvents: {
          byStart: [{
            start: -1,
            end: -1
          }],
          byEnd:   [{
            start: -1,
            end: -1
          }],
          startIndex: 0,
          endIndex:   0,
          previousUpdateTime: 0
        }
      };

      //  Wrap true ready check
      var isReady = function( that ) {

        if ( that.media.readyState >= 2 ) {
          //  Adding padding to the front and end of the arrays
          //  this is so we do not fall off either end

          var duration = that.media.duration,
              //  Check for no duration info (NaN)
              videoDurationPlus = duration != duration ? Number.MAX_VALUE : duration + 1;

          Popcorn.addTrackEvent( that, {
            start: videoDurationPlus,
            end: videoDurationPlus
          });

          that.media.addEventListener( "timeupdate", function( event ) {

            var currentTime    = this.currentTime,
                previousTime   = that.data.trackEvents.previousUpdateTime,
                tracks         = that.data.trackEvents,
                tracksByEnd    = tracks.byEnd,
                tracksByStart  = tracks.byStart;

            //  Playbar advancing
            if ( previousTime < currentTime ) {

              while ( tracksByEnd[ tracks.endIndex ] && tracksByEnd[ tracks.endIndex ].end <= currentTime ) {
                //  If plugin does not exist on this instance, remove it
                if ( !tracksByEnd[ tracks.endIndex ]._natives || !!that[ tracksByEnd[ tracks.endIndex ]._natives.type ] ) {
                  if ( tracksByEnd[ tracks.endIndex ]._running === true ) {
                    tracksByEnd[ tracks.endIndex ]._running = false;
                    tracksByEnd[ tracks.endIndex ]._natives.end.call( that, event, tracksByEnd[ tracks.endIndex ] );
                  }
                  tracks.endIndex++;
                } else {
                  // remove track event
                  Popcorn.removeTrackEvent( that, tracksByEnd[ tracks.endIndex ]._id );
                  return;
                }
              }

              while ( tracksByStart[ tracks.startIndex ] && tracksByStart[ tracks.startIndex ].start <= currentTime ) {
                //  If plugin does not exist on this instance, remove it
                if ( !tracksByStart[ tracks.startIndex ]._natives || !!that[ tracksByStart[ tracks.startIndex ]._natives.type ] ) {
                  if ( tracksByStart[ tracks.startIndex ].end > currentTime && tracksByStart[ tracks.startIndex ]._running === false ) {
                    tracksByStart[ tracks.startIndex ]._running = true;
                    tracksByStart[ tracks.startIndex ]._natives.start.call( that, event, tracksByStart[ tracks.startIndex ] );
                  }
                  tracks.startIndex++;
                } else {
                  // remove track event
                  Popcorn.removeTrackEvent( that, tracksByStart[ tracks.startIndex ]._id );
                  return;
                }
              }

            // Playbar receding
            } else if ( previousTime > currentTime ) {

              while ( tracksByStart[ tracks.startIndex ] && tracksByStart[ tracks.startIndex ].start > currentTime ) {
                // if plugin does not exist on this instance, remove it
                if ( !tracksByStart[ tracks.startIndex ]._natives || !!that[ tracksByStart[ tracks.startIndex ]._natives.type ] ) {
                  if ( tracksByStart[ tracks.startIndex ]._running === true ) {
                    tracksByStart[ tracks.startIndex ]._running = false;
                    tracksByStart[ tracks.startIndex ]._natives.end.call( that, event, tracksByStart[ tracks.startIndex ] );
                  }
                  tracks.startIndex--;
                } else {
                  // remove track event
                  Popcorn.removeTrackEvent( that, tracksByStart[ tracks.startIndex ]._id );
                  return;
                }
              }

              while ( tracksByEnd[ tracks.endIndex ] && tracksByEnd[ tracks.endIndex ].end > currentTime ) {
                // if plugin does not exist on this instance, remove it
                if ( !tracksByEnd[ tracks.endIndex ]._natives || !!that[ tracksByEnd[ tracks.endIndex ]._natives.type ] ) {
                  if ( tracksByEnd[ tracks.endIndex ].start <= currentTime && tracksByEnd[ tracks.endIndex ]._running === false ) {
                    tracksByEnd[ tracks.endIndex ]._running = true;
                    tracksByEnd[ tracks.endIndex ]._natives.start.call( that, event, tracksByEnd[tracks.endIndex] );
                  }
                  tracks.endIndex--;
                } else {
                  // remove track event
                  Popcorn.removeTrackEvent( that, tracksByEnd[ tracks.endIndex ]._id );
                  return;
                }
              }
            }

            tracks.previousUpdateTime = currentTime;

          }, false);
        } else {
          global.setTimeout( function() {
            isReady( that );
          }, 1);
        }
      };

      isReady( this );

      return this;
    }
  };

  //  Extend constructor prototype to instance prototype
  //  Allows chaining methods to instances
  Popcorn.p.init.prototype = Popcorn.p;

  Popcorn.forEach = function( obj, fn, context ) {

    if ( !obj || !fn ) {
      return {};
    }

    context = context || this;
    // Use native whenever possible
    if ( forEach && obj.forEach === forEach ) {
      return obj.forEach(fn, context);
    }

    for ( var key in obj ) {
      if ( hasOwn.call(obj, key) ) {
        fn.call(context, obj[key], key, obj);
      }
    }

    return obj;
  };

  Popcorn.extend = function( obj ) {
    var dest = obj, src = slice.call(arguments, 1);

    Popcorn.forEach( src, function( copy ) {
      for ( var prop in copy ) {
        dest[prop] = copy[prop];
      }
    });
    return dest;
  };


  // A Few reusable utils, memoized onto Popcorn
  Popcorn.extend( Popcorn, {
    error: function( msg ) {
      throw new Error( msg );
    },
    guid: function( prefix ) {
      Popcorn.guid.counter++;
      return  ( prefix ? prefix : "" ) + ( +new Date() + Popcorn.guid.counter );
    },
    sizeOf: function ( obj ) {
      var size = 0;

      for ( var prop in obj  ) {
        size++;
      }

      return size;
    },
    isArray: Array.isArray || function( array ) {
      return toString.call( array ) === "[object Array]";
    }, 

    nop: function () {},

    position: function( elem ) {

      var clientRect = elem.getBoundingClientRect(),
          bounds = {}, 
          doc = elem.ownerDocument,
          docElem = document.documentElement,
          body = document.body,
          clientTop, clientLeft, scrollTop, scrollLeft, top, left;

      //  Determine correct clientTop/Left
      clientTop  = docElem.clientTop  || body.clientTop  || 0;
      clientLeft = docElem.clientLeft || body.clientLeft || 0;

      //  Determine correct scrollTop/Left
      scrollTop  = ( global.pageYOffset && docElem.scrollTop || body.scrollTop );
      scrollLeft = ( global.pageXOffset && docElem.scrollLeft || body.scrollLeft );

      //  Temp top/left
      top  = Math.ceil( clientRect.top  + scrollTop - clientTop );
      left = Math.ceil( clientRect.left + scrollLeft - clientLeft );

      for ( var p in clientRect ) {
        bounds[ p ] = Math.round( clientRect[ p ] );
      }

      return Popcorn.extend({}, bounds, { top: top, left: left });     
    }
  });

  //  Memoized GUID Counter
  Popcorn.guid.counter  = 1;

  //  Factory to implement getters, setters and controllers
  //  as Popcorn instance methods. The IIFE will create and return
  //  an object with defined methods
  Popcorn.extend(Popcorn.p, (function () {

      var methods = "load play pause currentTime playbackRate mute volume duration",
          ret = {};


      //  Build methods, store in object that is returned and passed to extend
      Popcorn.forEach( methods.split(/\s+/g), function( name ) {

        ret[ name ] = function( arg ) {

          if ( typeof this.media[name] === "function" ) {
            this.media[ name ]();

            return this;
          }


          if ( arg !== false && arg !== null && typeof arg !== "undefined" ) {

            this.media[ name ] = arg;

            return this;
          }

          return this.media[ name ];
        };
      });

      return ret;

    })()
  );

  Popcorn.extend(Popcorn.p, {

    //  Rounded currentTime
    roundTime: function () {
      return -~this.media.currentTime;
    },

    //  Attach an event to a single point in time
    exec: function ( time, fn ) {

      //  Creating a one second track event with an empty end
      Popcorn.addTrackEvent( this, {
        start: time,
        end: time + 1,
        _running: false,
        _natives: {
          start: fn || Popcorn.nop,
          end: Popcorn.nop,
          type: "exec"
        }
      });

      return this;
    },
    position: function() {
      return Popcorn.position( this.media );
    }
  });

  Popcorn.Events  = {
    UIEvents: "blur focus focusin focusout load resize scroll unload  ",
    MouseEvents: "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave click dblclick",
    Events: "loadstart progress suspend emptied stalled play pause " +
           "loadedmetadata loadeddata waiting playing canplay canplaythrough " +
           "seeking seeked timeupdate ended ratechange durationchange volumechange"
  };

  Popcorn.Events.Natives = Popcorn.Events.UIEvents + " " +
                            Popcorn.Events.MouseEvents + " " +
                              Popcorn.Events.Events;

  Popcorn.events  = {


    isNative: function( type ) {

      var checks = Popcorn.Events.Natives.split( /\s+/g );

      for ( var i = 0; i < checks.length; i++ ) {
        if ( checks[i] === type ) {
          return true;
        }
      }

      return false;
    },
    getInterface: function( type ) {

      if ( !Popcorn.events.isNative( type ) ) {
        return false;
      }

      var natives = Popcorn.Events,
          proto;

      for ( var p in natives ) {
        if ( p !== "Natives" && natives[ p ].indexOf( type ) > -1 ) {
          proto = p;
        }
      }

      return proto;
    },
    //  Compile all native events to single array
    all: Popcorn.Events.Natives.split(/\s+/g),
    //  Defines all Event handling static functions
    fn: {
      trigger: function ( type, data ) {

        //  setup checks for custom event system
        if ( this.data.events[ type ] && Popcorn.sizeOf( this.data.events[ type ] ) ) {

          var eventInterface  = Popcorn.events.getInterface( type );

          if ( eventInterface ) {

            var evt = document.createEvent( eventInterface );
                evt.initEvent(type, true, true, global, 1);

            this.media.dispatchEvent(evt);

            return this;
          }

          //  Custom events
          Popcorn.forEach(this.data.events[ type ], function ( obj, key ) {

            obj.call( this, data );

          }, this);

        }

        return this;
      },
      listen: function ( type, fn ) {

        var self = this, hasEvents = true;

        if ( !this.data.events[type] ) {
          this.data.events[type] = {};
          hasEvents = false;
        }

        //  Register
        this.data.events[ type ][ fn.name || ( fn.toString() + Popcorn.guid() ) ] = fn;

        // only attach one event of any type
        if ( !hasEvents && Popcorn.events.all.indexOf( type ) > -1 ) {

          this.media.addEventListener( type, function( event ) {

            Popcorn.forEach( self.data.events[type], function ( obj, key ) {
              if ( typeof obj === "function" ) {
                obj.call(self, event);
              }

            });

            //fn.call( self, event );

          }, false);
        }
        return this;
      },
      unlisten: function( type, fn ) {

        if ( this.data.events[type] && this.data.events[type][fn] ) {

          delete this.data.events[type][ fn ];

          return this;
        }

        this.data.events[type] = null;

        return this;
      }
    }
  };

  //  Extend Popcorn.events.fns (listen, unlisten, trigger) to all Popcorn instances
  Popcorn.forEach( ["trigger", "listen", "unlisten"], function ( key ) {
    Popcorn.p[ key ] = Popcorn.events.fn[ key ];
  });
  //  Protected API methods
  Popcorn.protect = {
    natives: "load play pause currentTime playbackRate mute volume duration removePlugin roundTime trigger listen unlisten".toLowerCase().split(/\s+/)
  };

  //  Internal Only
  Popcorn.addTrackEvent = function( obj, track ) {

    if ( track._natives ) {
      //  Supports user defined track event id
      track._id = !track.id ? Popcorn.guid( track._natives.type ) : track.id;

      //  Push track event ids into the history
      obj.data.history.push( track._id );

      track._natives.start = track._natives.start || Popcorn.nop;
      track._natives.end = track._natives.end || Popcorn.nop;
    }

    track.start = Popcorn.util.toSeconds( track.start, obj.options.framerate );
    track.end = Popcorn.util.toSeconds( track.end, obj.options.framerate );

    //  Store this definition in an array sorted by times
    obj.data.trackEvents.byStart.push( track );
    obj.data.trackEvents.byEnd.push( track );
    obj.data.trackEvents.byStart.sort( function( a, b ){
      return ( a.start - b.start );
    });
    obj.data.trackEvents.byEnd.sort( function( a, b ){
      return ( a.end - b.end );
    });

  };

  //  removePlugin( type ) removes all tracks of that from all instances of popcorn
  //  removePlugin( obj, type ) removes all tracks of type from obj, where obj is a single instance of popcorn
  Popcorn.removePlugin = function( obj, name ) {

    //  Check if we are removing plugin from an instance or from all of Popcorn
    if ( !name ) {

      //  Fix the order
      name = obj;
      obj = Popcorn.p;

      var registryLen = Popcorn.registry.length,
          registryIdx;

      // remove plugin reference from registry
      for ( registryIdx = 0; registryIdx < registryLen; registryIdx++ ) {
        if ( Popcorn.registry[ registryIdx ].name === name ) {
          Popcorn.registry.splice( registryIdx, 1 );
          delete Popcorn.registryByName[ name ];

          // delete the plugin
          delete obj[ name ];

          // plugin found and removed, stop checking, we are done
          return;
        }
      }

    }

    var byStart = obj.data.trackEvents.byStart,
        byEnd = obj.data.trackEvents.byEnd,
        idx, sl;

    // remove all trackEvents
    for ( idx = 0, sl = byStart.length; idx < sl; idx++ ) {

      if ( ( byStart[ idx ] && byStart[ idx ]._natives && byStart[ idx ]._natives.type === name ) &&
                ( byEnd[ idx ] && byEnd[ idx ]._natives && byEnd[ idx ]._natives.type === name ) ) {

        byStart.splice( idx, 1 );
        byEnd.splice( idx, 1 );

        // update for loop if something removed, but keep checking
        idx--; sl--;
        if ( obj.data.trackEvents.startIndex <= idx ) {
          obj.data.trackEvents.startIndex--;
          obj.data.trackEvents.endIndex--;
        }
      }
    }
  };

  Popcorn.removeTrackEvent  = function( obj, trackId ) {

    var historyLen = obj.data.history.length,
        indexWasAt = 0,
        byStart = [],
        byEnd = [],
        history = [];


    Popcorn.forEach( obj.data.trackEvents.byStart, function( o, i, context ) {
      // Preserve the original start/end trackEvents
      if ( !o._id ) {
        byStart.push( obj.data.trackEvents.byStart[i] );
        byEnd.push( obj.data.trackEvents.byEnd[i] );
      }

      // Filter for user track events (vs system track events)
      if ( o._id ) {

        // Filter for the trackevent to remove
        if ( o._id !== trackId ) {
          byStart.push( obj.data.trackEvents.byStart[i] );
          byEnd.push( obj.data.trackEvents.byEnd[i] );
        }

        //  Capture the position of the track being removed.
        if ( o._id === trackId ) {
          indexWasAt = i;
          o._natives._teardown && o._natives._teardown.call( obj, o );
        }
      }
    });


    //  Update
    if ( indexWasAt <= obj.data.trackEvents.startIndex ) {
      obj.data.trackEvents.startIndex--;
    }

    if ( indexWasAt <= obj.data.trackEvents.endIndex ) {
      obj.data.trackEvents.endIndex--;
    }


    obj.data.trackEvents.byStart = byStart;
    obj.data.trackEvents.byEnd = byEnd;


    for ( var i = 0; i < historyLen; i++ ) {
      if ( obj.data.history[i] !== trackId ) {
        history.push( obj.data.history[i] );
      }
    }

    obj.data.history = history;

  };

  Popcorn.getTrackEvents = function( obj ) {

    var trackevents = [];

    Popcorn.forEach( obj.data.trackEvents.byStart, function( o, i, context ) {
      if ( o._id ) {
        trackevents.push(o);
      }
    });

    return trackevents;
  };


  Popcorn.getLastTrackEventId = function( obj ) {
    return obj.data.history[ obj.data.history.length - 1 ];
  };

  //  Map and Extend TrackEvent functions to all Popcorn instances
  Popcorn.extend( Popcorn.p, {

    getTrackEvents: function() {
      return Popcorn.getTrackEvents.call( null, this );
    },

    getLastTrackEventId: function() {
      return Popcorn.getLastTrackEventId.call( null, this );
    },

    removeTrackEvent: function( id ) {
      Popcorn.removeTrackEvent.call( null, this, id );
      return this;
    },

    removePlugin: function( name ) {
      Popcorn.removePlugin.call( null, this, name );
      return this;
    }

  });

  //  Plugin manifests
  Popcorn.manifest = {};
  //  Plugins are registered
  Popcorn.registry = [];
  Popcorn.registryByName = {};
  //  An interface for extending Popcorn
  //  with plugin functionality
  Popcorn.plugin = function( name, definition, manifest ) {

    if ( Popcorn.protect.natives.indexOf( name.toLowerCase() ) >= 0 ) {
      Popcorn.error("'" + name + "' is a protected function name");
      return;
    }

    //  Provides some sugar, but ultimately extends
    //  the definition into Popcorn.p
    var reserved = [ "start", "end" ],
        plugin = {},
        setup,
        isfn = typeof definition === "function";

    //  If `manifest` arg is undefined, check for manifest within the `definition` object
    //  If no `definition.manifest`, an empty object is a sufficient fallback
    if ( !manifest ) {
      manifest = definition.manifest || {};
    }

    var pluginFn = function( setup, options ) {

      if ( !options ) {
        return this;
      }

      //  Storing the plugin natives
      options._natives = setup;
      options._natives.type = name;
      options._running = false;

      //  Ensure a manifest object, an empty object is a sufficient fallback
      options._natives.manifest = manifest;

      //  Checks for expected properties
      if ( !( "start" in options ) ) {
        options.start = 0;
      }

      if ( !( "end" in options ) ) {
        options.end = this.duration();
      }

      //  If a _setup was declared, then call it before
      //  the events commence
      if ( "_setup" in setup && typeof setup._setup === "function" ) {

        // Resolves 239, 241, 242
        if ( !options.target ) {

          //  Sometimes the manifest may be missing entirely
          //  or it has an options object that doesn't have a `target` property

          var manifestopts = "options" in manifest && manifest.options;

          options.target = manifestopts && "target" in manifestopts && manifestopts.target;
        }

        setup._setup.call( this, options );
      }

      Popcorn.addTrackEvent( this, options );

      //  Future support for plugin event definitions
      //  for all of the native events
      Popcorn.forEach( setup, function ( callback, type ) {

        if ( type !== "type" ) {

          if ( reserved.indexOf( type ) === -1 ) {

            this.listen( type, callback );
          }
        }

      }, this);

      return this;
    };

    //  Augment the manifest object
    if ( manifest || ( "manifest" in definition ) ) {
      Popcorn.manifest[ name ] = manifest || definition.manifest;
    }

    //  Assign new named definition
    plugin[ name ] = function( options ) {
      return pluginFn.call( this, isfn ? definition.call( this, options ) : definition,
                                  options );
    };

    //  Extend Popcorn.p with new named definition
    Popcorn.extend( Popcorn.p, plugin );

    //  Push into the registry
    var entry = {
      fn: plugin[ name ],
      definition: definition,
      base: definition,
      parents: [],
      name: name
    };
    Popcorn.registry.push(
       Popcorn.extend( plugin, entry, {
        type: name
      })
    );
    Popcorn.registryByName[ name ] = entry;

    return plugin;
  };

  //  Popcorn Plugin Inheritance Helper Methods
  //  Internal use only
  Popcorn.plugin.getDefinition = function( name ) {

    var registry = Popcorn.registryByName;
    
    if ( registry[ name ] ) {
      return registry[ name ];
    }

    Popcorn.error( "Cannot inherit from "+ name +"; Object does not exist" );
  };

  //  Internal use only
  Popcorn.plugin.delegate = function( instance, name, plugins ) {

    return function() {
      var args = arguments;
      plugins.forEach( function( plugin ) {
        // The new plugin simply calls the delegated methods on
        // all of its parents in the order they were specified.
        plugin[ name ] && plugin[ name ].apply( instance, args );
      });
    };
  };

  //  Plugin inheritance
  Popcorn.plugin.inherit = function( name, parents, definition, manifest ) {


    // Get the names of all of the ancestor classes, in the order that
    // we will be calling them. The override is for the class we're
    // currently defining, since it's not in the registry yet.
    var ancestors = [], 
        pluginFn, entry;

    function getAncestors( name, override ) {
      var parents = override || Popcorn.plugin.getDefinition( name ).parents;
      for ( var i in parents ) {
        if ( hasOwn.call( parents, i ) ) {
          var p = parents[ i ];
          getAncestors( p );
          if ( ancestors.indexOf( p ) === -1 ) {
            ancestors.push( p );
          }
        }
      }
    }

    getAncestors( name, Popcorn.isArray( parents ) ? parents : [ parents ] );
    ancestors.push( name );

    // Now create the requested plugin under the reqested name.
    pluginFn = Popcorn.plugin( name, function( options ) {

      var self = this, 
          plugins;

      function instantiate( definition ) {
        return definition.call && definition.call( self, options ) || definition;
      }

      // When the newly-defined plugin is instantiated, it must
      // explicitly instantiate all of its ancestors.
      plugins = ancestors.map( function( name ) {
        return instantiate( Popcorn.plugin.getDefinition( name ).base );
      });

      return {
        _setup: Popcorn.plugin.delegate( self, "_setup", plugins ),
        start: Popcorn.plugin.delegate( self, "start", plugins ),
        end: Popcorn.plugin.delegate( self, "end", plugins )
      };
      
    }, manifest || definition.manifest );

    entry = Popcorn.plugin.getDefinition( name );
    entry.base = definition;
    entry.parents = parents;

    return pluginFn;
  };

  // Augment Popcorn; 
  Popcorn.inherit = Popcorn.plugin.inherit;

  // stores parsers keyed on filetype
  Popcorn.parsers = {};

  // An interface for extending Popcorn
  // with parser functionality
  Popcorn.parser = function( name, type, definition ) {

    if ( Popcorn.protect.natives.indexOf( name.toLowerCase() ) >= 0 ) {
      Popcorn.error("'" + name + "' is a protected function name");
      return;
    }

    // fixes parameters for overloaded function call
    if ( typeof type === "function" && !definition ) {
      definition = type;
      type = "";
    }

    if ( typeof definition !== "function" || typeof type !== "string" ) {
      return;
    }

    // Provides some sugar, but ultimately extends
    // the definition into Popcorn.p

    var natives = Popcorn.events.all,
        parseFn,
        parser = {};

    parseFn = function ( filename, callback ) {

      if ( !filename ) {
        return this;
      }

      var that = this;

      Popcorn.xhr({
        url: filename,
        dataType: type,
        success: function( data ) {

          var tracksObject = definition( data ),
              tracksData,
              tracksDataLen,
              tracksDef,
              idx = 0;

          tracksData = tracksObject.data || [];
          tracksDataLen = tracksData.length;
          tracksDef = null;

          //  If no tracks to process, return immediately
          if ( !tracksDataLen ) {
            return;
          }

          //  Create tracks out of parsed object
          for ( ; idx < tracksDataLen; idx++ ) {

            tracksDef = tracksData[ idx ];

            for ( var key in tracksDef ) {

              if ( hasOwn.call( tracksDef, key ) && !!that[ key ] ) {

                that[ key ]( tracksDef[ key ] );
              }
            }
          }
          if ( callback ) {
            callback();
          }
        }
      });

      return this;
    };

    // Assign new named definition
    parser[ name ] = parseFn;

    // Extend Popcorn.p with new named definition
    Popcorn.extend( Popcorn.p, parser );

    // keys the function name by filetype extension
    //Popcorn.parsers[ name ] = true;

    return parser;
  };


  //  Cache references to reused RegExps
  var rparams = /\?/,
  //  XHR Setup object
  setup = {
    url: '',
    data: '',
    dataType: '',
    success: Popcorn.nop,
    type: 'GET',
    async: true,
    xhr: function()  {
      return new global.XMLHttpRequest();
    }
  };

  Popcorn.xhr = function ( options ) {

    options.dataType = options.dataType && options.dataType.toLowerCase() || null;
    
    if ( options.dataType &&
            ( options.dataType === "jsonp" ||
                options.dataType === "script" ) ) {

      Popcorn.xhr.getJSONP(
        options.url,
        options.success,
        options.dataType === "script"
      );
      return;
    }

    var settings = Popcorn.extend( {}, setup, options );

    //  Create new XMLHttpRequest object
    settings.ajax  = settings.xhr();

    if ( settings.ajax ) {

      if ( settings.type === "GET" && settings.data ) {

        //  append query string
        settings.url += ( rparams.test( settings.url ) ? "&" : "?" ) + settings.data;

        //  Garbage collect and reset settings.data
        settings.data = null;
      }


      settings.ajax.open( settings.type, settings.url, settings.async );
      settings.ajax.send( settings.data || null );

      return Popcorn.xhr.httpData( settings );
    }
  };


  Popcorn.xhr.httpData = function ( settings ) {

    var data, json = null;

    settings.ajax.onreadystatechange = function() {

      if ( settings.ajax.readyState === 4 ) {

        try {
          json = JSON.parse(settings.ajax.responseText);
        } catch(e) {
          //suppress
        }

        data = {
          xml: settings.ajax.responseXML,
          text: settings.ajax.responseText,
          json: json
        };

        //  If a dataType was specified, return that type of data
        if ( settings.dataType ) {
          data = data[ settings.dataType ];
        }


        settings.success.call( settings.ajax, data );

      }
    };
    return data;
  };

  Popcorn.xhr.getJSONP = function ( url, success, isScript ) {

    //  If this is a script request, ensure that we do not call something that has already been loaded
    if ( isScript ) {

      var scripts = document.querySelectorAll('script[src="' + url + '"]');

      //  If there are scripts with this url loaded, early return
      if ( scripts.length ) {

        //  Execute success callback and pass "exists" flag
        success && success( true );

        return;
      }
    }

    var head = document.head || document.getElementsByTagName("head")[0] || document.documentElement,
      script = document.createElement("script"),
      paramStr = url.split("?")[1],
      isFired = false,
      params = [],
      callback, parts, callparam;

    if ( paramStr && !isScript ) {
      params = paramStr.split("&");
    }

    if ( params.length ) {
      parts = params[ params.length - 1 ].split("=");
    }

    callback = params.length ? ( parts[1] ? parts[1] : parts[0]  ) : "jsonp";

    if ( !paramStr && !isScript ) {
      url += "?callback=" + callback;
    }

    if ( callback && !isScript ) {

      //  If a callback name already exists
      if ( !!window[ callback ] ) {

        //  Create a new unique callback name
        callback = Popcorn.guid( callback );
      }

      //  Define the JSONP success callback globally
      window[ callback ] = function ( data ) {

        success && success( data );
        isFired = true;

      };

      //  Replace callback param and callback name
      url = url.replace( parts.join("="), parts[0] + "=" + callback );

    }

    script.onload = script.onreadystatechange = function() {

      if ( !script.readyState || /loaded|complete/.test( script.readyState ) ) {

        //  Handling remote script loading callbacks
        if ( isScript ) {

          //  getScript
          success && success();
        }

        //  Executing for JSONP requests
        if ( isFired ) {

          //  Garbage collect the callback
          delete window[ callback ];

          //  Garbage collect the script resource
          head.removeChild( script );
        }
      }
    };

    script.src = url;

    head.insertBefore( script, head.firstChild );

    return;
  };

  Popcorn.getJSONP = Popcorn.xhr.getJSONP;

  Popcorn.getScript = Popcorn.xhr.getScript = function( url, success ) {

    return Popcorn.xhr.getJSONP( url, success, true );
  };

  Popcorn.util = {
    // Simple function to parse a timestamp into seconds
    // Acceptable formats are:
    // HH:MM:SS.MMM
    // HH:MM:SS;FF
    // Hours and minutes are optional. They default to 0
    toSeconds: function( timeStr, framerate ) {
        //Hours and minutes are optional
        //Seconds must be specified
        //Seconds can be followed by milliseconds OR by the frame information
        var validTimeFormat = /^([0-9]+:){0,2}[0-9]+([.;][0-9]+)?$/,
            errorMessage = "Invalid time format";

        if ( typeof timeStr === "number" ) {
          return timeStr;
        } else if ( typeof timeStr === "string" ) {
          if ( ! validTimeFormat.test( timeStr ) ) {
            Popcorn.error( errorMessage );
          }
        } else {
          Popcorn.error( errorMessage );
        }

        var t = timeStr.split( ":" ),
            lastIndex = t.length - 1,
            lastElement = t[ lastIndex ];

        //Fix last element:
        if ( lastElement.indexOf( ";" ) > -1 ) {
          var frameInfo = lastElement.split( ";" ),
              frameTime = 0;

          if ( framerate && ( typeof framerate === "number" ) ) {
              frameTime = parseFloat( frameInfo[ 1 ], 10 ) / framerate;
          }

          t[ lastIndex ] =
            parseInt( frameInfo[ 0 ], 10 ) + frameTime;
        }

        if ( t.length === 1 ) {
          return parseFloat( t[ 0 ], 10 );
        } else if ( t.length === 2 ) {
          return ( parseInt( t[ 0 ], 10 ) * 60 ) + parseFloat( t[ 1 ], 10 );
        } else if ( t.length === 3 ) {
          return ( parseInt( t[ 0 ], 10 ) * 3600 ) +
                 ( parseInt( t[ 1 ], 10 ) * 60 ) +
                 parseFloat( t[ 2 ], 10 );
        }
    }
  };

  //  Exposes Popcorn to global context
  global.Popcorn = Popcorn;

  document.addEventListener( "DOMContentLoaded", function() {

    //  Supports non-specific elements
    var dataAttr = "data-timeline-sources",
        medias = document.querySelectorAll( "[" + dataAttr + "]" );

    Popcorn.forEach( medias, function( idx, key ) {

      var media = medias[ key ],
          hasDataSources = false,
          dataSources, data, popcornMedia;

      //  Ensure that the DOM has an id
      if ( !media.id ) {

        media.id = Popcorn.guid( "__popcorn" );

      }

      //  Ensure we're looking at a dom node
      if ( media.nodeType && media.nodeType === 1 ) {

        popcornMedia = Popcorn( "#" + media.id );

        dataSources = ( media.getAttribute( dataAttr ) || "" ).split(",");

        if ( dataSources[ 0 ] ) {

          Popcorn.forEach( dataSources, function( source ) {

            // split the parser and data as parser:file
            data = source.split( ":" );

            // if no parser is defined for the file, assume "parse" + file extension
            if ( data.length === 1 ) {

              data = source.split( "." );
              data[ 0 ] = "parse" + data[ data.length - 1 ].toUpperCase();
              data[ 1 ] = source;

            }

            //  If the media has data sources and the correct parser is registered, continue to load
            if ( dataSources[ 0 ] && popcornMedia[ data[ 0 ] ] ) {

              //  Set up the media and load in the datasources
              popcornMedia[ data[ 0 ] ]( data[ 1 ] );

            }
          });

        }

        //  Only play the media if it was specified to do so
        if ( !!popcornMedia.autoplay ) {
          popcornMedia.play();
        }

      }
    });
  }, false );

})(window, window.document);

// PLUGIN: Attribution

(function (Popcorn) {
  
  /**
   * Attribution popcorn plug-in 
   * Adds text to an element on the page.
   * Options parameter will need a mandatory start, end, target.
   * Optional parameters include nameofwork, NameOfWorkUrl, CopyrightHolder, CopyrightHolderUrl, license & licenseUrl.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing 
   * Target is the id of the document element that the text needs to be attached to, this target element must exist on the DOM
   * nameofwork is the title of the attribution 
   * NameOfWorkUrl is a url that provides more details about the attribution
   * CopyrightHolder is the name of the person/institution that holds the rights to the attribution
   * CopyrightHolderUrl is the url that provides more details about the copyrightholder
   * license is the type of license that the work is copyrighted under
   * LicenseUrl is the url that provides more details about the ticense type
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .attribution({
          start: 5, // seconds
          end: 15, // seconds
          target: 'attributiondiv'
        } )
   *
   */
  Popcorn.plugin( "attribution" , (function(){ 
    var licenses = {
      "cc-by": 'data:image/png;base64,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',
      "cc-by-sa": 'data:image/png;base64,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',
      "cc-by-nd": 'data:image/png;base64,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',
      "cc-by-nc": 'data:image/png;base64,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',
      "cc-by-nc-sa": 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAfCAYAAABjyArgAAAACXBIWXMAAAsTAAALEwEAmpwYAAAKT2lDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjanVNnVFPpFj333vRCS4iAlEtvUhUIIFJCi4AUkSYqIQkQSoghodkVUcERRUUEG8igiAOOjoCMFVEsDIoK2AfkIaKOg6OIisr74Xuja9a89+bN/rXXPues852zzwfACAyWSDNRNYAMqUIeEeCDx8TG4eQuQIEKJHAAEAizZCFz/SMBAPh+PDwrIsAHvgABeNMLCADATZvAMByH/w/qQplcAYCEAcB0kThLCIAUAEB6jkKmAEBGAYCdmCZTAKAEAGDLY2LjAFAtAGAnf+bTAICd+Jl7AQBblCEVAaCRACATZYhEAGg7AKzPVopFAFgwABRmS8Q5ANgtADBJV2ZIALC3AMDOEAuyAAgMADBRiIUpAAR7AGDIIyN4AISZABRG8lc88SuuEOcqAAB4mbI8uSQ5RYFbCC1xB1dXLh4ozkkXKxQ2YQJhmkAuwnmZGTKBNA/g88wAAKCRFRHgg/P9eM4Ors7ONo62Dl8t6r8G/yJiYuP+5c+rcEAAAOF0ftH+LC+zGoA7BoBt/qIl7gRoXgugdfeLZrIPQLUAoOnaV/Nw+H48PEWhkLnZ2eXk5NhKxEJbYcpXff5nwl/AV/1s+X48/Pf14L7iJIEyXYFHBPjgwsz0TKUcz5IJhGLc5o9H/LcL//wd0yLESWK5WCoU41EScY5EmozzMqUiiUKSKcUl0v9k4t8s+wM+3zUAsGo+AXuRLahdYwP2SycQWHTA4vcAAPK7b8HUKAgDgGiD4c93/+8//UegJQCAZkmScQAAXkQkLlTKsz/HCAAARKCBKrBBG/TBGCzABhzBBdzBC/xgNoRCJMTCQhBCCmSAHHJgKayCQiiGzbAdKmAv1EAdNMBRaIaTcA4uwlW4Dj1wD/phCJ7BKLyBCQRByAgTYSHaiAFiilgjjggXmYX4IcFIBBKLJCDJiBRRIkuRNUgxUopUIFVIHfI9cgI5h1xGupE7yAAygvyGvEcxlIGyUT3UDLVDuag3GoRGogvQZHQxmo8WoJvQcrQaPYw2oefQq2gP2o8+Q8cwwOgYBzPEbDAuxsNCsTgsCZNjy7EirAyrxhqwVqwDu4n1Y8+xdwQSgUXACTYEd0IgYR5BSFhMWE7YSKggHCQ0EdoJNwkDhFHCJyKTqEu0JroR+cQYYjIxh1hILCPWEo8TLxB7iEPENyQSiUMyJ7mQAkmxpFTSEtJG0m5SI+ksqZs0SBojk8naZGuyBzmULCAryIXkneTD5DPkG+Qh8lsKnWJAcaT4U+IoUspqShnlEOU05QZlmDJBVaOaUt2ooVQRNY9aQq2htlKvUYeoEzR1mjnNgxZJS6WtopXTGmgXaPdpr+h0uhHdlR5Ol9BX0svpR+iX6AP0dwwNhhWDx4hnKBmbGAcYZxl3GK+YTKYZ04sZx1QwNzHrmOeZD5lvVVgqtip8FZHKCpVKlSaVGyovVKmqpqreqgtV81XLVI+pXlN9rkZVM1PjqQnUlqtVqp1Q61MbU2epO6iHqmeob1Q/pH5Z/YkGWcNMw09DpFGgsV/jvMYgC2MZs3gsIWsNq4Z1gTXEJrHN2Xx2KruY/R27iz2qqaE5QzNKM1ezUvOUZj8H45hx+Jx0TgnnKKeX836K3hTvKeIpG6Y0TLkxZVxrqpaXllirSKtRq0frvTau7aedpr1Fu1n7gQ5Bx0onXCdHZ4/OBZ3nU9lT3acKpxZNPTr1ri6qa6UbobtEd79up+6Ynr5egJ5Mb6feeb3n+hx9L/1U/W36p/VHDFgGswwkBtsMzhg8xTVxbzwdL8fb8VFDXcNAQ6VhlWGX4YSRudE8o9VGjUYPjGnGXOMk423GbcajJgYmISZLTepN7ppSTbmmKaY7TDtMx83MzaLN1pk1mz0x1zLnm+eb15vft2BaeFostqi2uGVJsuRaplnutrxuhVo5WaVYVVpds0atna0l1rutu6cRp7lOk06rntZnw7Dxtsm2qbcZsOXYBtuutm22fWFnYhdnt8Wuw+6TvZN9un2N/T0HDYfZDqsdWh1+c7RyFDpWOt6azpzuP33F9JbpL2dYzxDP2DPjthPLKcRpnVOb00dnF2e5c4PziIuJS4LLLpc+Lpsbxt3IveRKdPVxXeF60vWdm7Obwu2o26/uNu5p7ofcn8w0nymeWTNz0MPIQ+BR5dE/C5+VMGvfrH5PQ0+BZ7XnIy9jL5FXrdewt6V3qvdh7xc+9j5yn+M+4zw33jLeWV/MN8C3yLfLT8Nvnl+F30N/I/9k/3r/0QCngCUBZwOJgUGBWwL7+Hp8Ib+OPzrbZfay2e1BjKC5QRVBj4KtguXBrSFoyOyQrSH355jOkc5pDoVQfujW0Adh5mGLw34MJ4WHhVeGP45wiFga0TGXNXfR3ENz30T6RJZE3ptnMU85ry1KNSo+qi5qPNo3ujS6P8YuZlnM1VidWElsSxw5LiquNm5svt/87fOH4p3iC+N7F5gvyF1weaHOwvSFpxapLhIsOpZATIhOOJTwQRAqqBaMJfITdyWOCnnCHcJnIi/RNtGI2ENcKh5O8kgqTXqS7JG8NXkkxTOlLOW5hCepkLxMDUzdmzqeFpp2IG0yPTq9MYOSkZBxQqohTZO2Z+pn5mZ2y6xlhbL+xW6Lty8elQfJa7OQrAVZLQq2QqboVFoo1yoHsmdlV2a/zYnKOZarnivN7cyzytuQN5zvn//tEsIS4ZK2pYZLVy0dWOa9rGo5sjxxedsK4xUFK4ZWBqw8uIq2Km3VT6vtV5eufr0mek1rgV7ByoLBtQFr6wtVCuWFfevc1+1dT1gvWd+1YfqGnRs+FYmKrhTbF5cVf9go3HjlG4dvyr+Z3JS0qavEuWTPZtJm6ebeLZ5bDpaql+aXDm4N2dq0Dd9WtO319kXbL5fNKNu7g7ZDuaO/PLi8ZafJzs07P1SkVPRU+lQ27tLdtWHX+G7R7ht7vPY07NXbW7z3/T7JvttVAVVN1WbVZftJ+7P3P66Jqun4lvttXa1ObXHtxwPSA/0HIw6217nU1R3SPVRSj9Yr60cOxx++/p3vdy0NNg1VjZzG4iNwRHnk6fcJ3/ceDTradox7rOEH0x92HWcdL2pCmvKaRptTmvtbYlu6T8w+0dbq3nr8R9sfD5w0PFl5SvNUyWna6YLTk2fyz4ydlZ19fi753GDborZ752PO32oPb++6EHTh0kX/i+c7vDvOXPK4dPKy2+UTV7hXmq86X23qdOo8/pPTT8e7nLuarrlca7nuer21e2b36RueN87d9L158Rb/1tWeOT3dvfN6b/fF9/XfFt1+cif9zsu72Xcn7q28T7xf9EDtQdlD3YfVP1v+3Njv3H9qwHeg89HcR/cGhYPP/pH1jw9DBY+Zj8uGDYbrnjg+OTniP3L96fynQ89kzyaeF/6i/suuFxYvfvjV69fO0ZjRoZfyl5O/bXyl/erA6xmv28bCxh6+yXgzMV70VvvtwXfcdx3vo98PT+R8IH8o/2j5sfVT0Kf7kxmTk/8EA5jz/GMzLdsAAAAEZ0FNQQAAsY58+1GTAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAApvSURBVHja7FptbFPXGX7utYlGJzz/2yYHYYQ2xZFWHAq0dLSx161TS9NcLylfocNmWtuVdUlKCNvIl4FAY0Id91Ob1sRrV7VaqTBfaxc6fEPQ4sRJbEaL82OVjZKoVJvm4KCpxB/vflzfE9/EThxo1Y72lY7v8T3nPPfc57znPe95z+WISMNx3FV8JZ+6EBHHASAAON19CjzPg+d5qFQq8LwKKp4Hr0pfeR4cx4PnOHAcB3CcjAICgVKEFKWQSkkpmUxK11QSyWQKqVSSlaUoxeoTkdwZlr8V5JHyjQAADgDJ5KpUKinxqum8SiWV8ao0yRw4js/kN01OmtiURGYymU6Z+aSS5FQqxYjNJPpWIlkNQEmuSg214iqlk8dPwev1YmBgAJOxSQXQEs0SrF27FuYfmFH28ENIplTg+YQ0IEkeHLj0WGZMnxRJMwHpOcRJ5A77A/C87UEoFFLUNxgMECoErFpTktfLfVFwOAD017PvQq1WM1LVarWUVGr0iOfgeMaB8fHxvDqk0+lQ/5t6lJbei0QyiWQygUQinZIJJBJJpuGZmvzR+Ed4vuMFjIRGAAAmkwlGoxEAEAwGIYoiAKDIUISd1TvxrW9/M+vzr3z0MV50vfiFwHmkfKNE8Hs9Z6BWqaeJVS/CIrUazY0t8BzzsAZarRaCIECv16O0tBQA0NPTg0gkAo/Hg4mJCVZXsAioq9+FxbctRiKRQDyRQCIRRyKRUJoMSuFq9Cp++cRTiMViEAQBTqcTer1e0dlIJILa2lp4PB5oNBq0OlpnvdS12DVU76z5wuDIdpjO9p6l3r5z1Ofvo8Ggny68HyTBIlB68pJWq6WWlhaKRqM0l3R1dZFWq2XtigxFdL6vlwaDg+Qb7KPevnPk7T1LZ8Ruevdv79Dp7lN04p3jZDAYCABZrVYFnowz8xky9lvH/6xIRYairDgup5O2btp8Uzijo6Pk6+sjX18fjY6O5oUDgHgAUKVtsFqlglql1Fyj0YhAIIDm5mZotdo5zYPVakU4HGZTaSQ0gnbHEYUt55lHInkjfp8foVAIgiCgfvfueU2Q1WqFIAgYCY1g2B9Q2MqR0AhWlZTg7rvWsfvPdXTgGYcDJ0+fxp663RgbG8sLJ7M/f3r1VZjW34OqzVtQtXkLTOvvwZnu7jlxFOtNr6+XfIM+Gr4wRK7nXUxzjEbjvFqbTaLRKBmNRobjesFFw/8Ypv4hH5339ZL3vKTF77z3FzIUS9obDofzxg+HwwSADAYD0xZ5FhR957u0YpmeSr+/np74+WMEgFpaWujQwUMEgI6+9VZeOHJ/fH19Et6d6+hn221Uv6uOVizT04plenI5nTlxsmiwpMWOZxzM3nZ1dc2rtdlEq9XC6/Wyto5DjrQvndZgLu1T8zxCl0IwmUyzbJzNZmNabrPZFGV6vR4mk0mxsodCEk5ZWRke2bgRY2NjONPdjRXL9Pjv5DVse3QbLn3wASoqK/PC0ev1iMViCAUuAgDKhZ/gD+5OtLUfxt6mRgCAu7MrJ44svOym8bzkisneQk1NDZvqNyJarRZOpxMAMD4+jpMnTrENi0Qyx9y0bM9xu91Z87Jka2M0GuE40o5Djja8/uYbqKisxIeXI3AcacfSpUvh7uxC6NKlvHBkaX1WUrjf//EVdu9H998PAIjFYvj4ypWcOIxgWZu8Xi8jp7q6mlUSRREWiwVmsxlmsxl2uz1nWUdHh8JeylrsPevN0F4OHD9N8Gchd951F9raD2N0dBT1u+pQ8r3b8fbRoyh7cAOqNm9hNnQu0Wg0cLlcuE2zBC+//HLWOp98cn1ODGmjwXHgOQ4DAwOSiyUIjBhRFGE2mxWNRFGEKIqorq6GxWKZVXbhwgV0dXUxLLfbjYGBAWkHmCZWIpdjfmW2xUzWXKvVOqs8W5uZ92KxGM50d6Ot/TCsl2woe3ADAKDf50O/z4fCwkJwi9Rz4ixSq1FfV4fbFi9m9/p9PpZfpl+Wsz8ZGiy9sLxDW7lyJatQW1vL7Ew4HIbX64Ver8f27duZJhuNRoTDYRw7dkzhIwNg+cnYpPQccBlXoLi4GKIoIhKJKDomD9DMvOyDiqIIg8Gg2FnNxPnFY4+jdd9+rLp9Jao2b8GHlyOoqKxEW/thVG3blhfO2NgYWpqasXXTZrTu24/WffvR1NAAANi9Z0/O/igIBgfFdM20J/LIWK1WZszD4TCsVisrkzcfgiCwssyFhG0bOfYz7YxvqlQMZD4i1xUqhOmNTTqfidPWfhi2HTtw5d//wj/DYbicTuxtakRFZSXsB/ajZM3qeXFsO3bAtmOHNNCdnejq7MT1T65jQ9lD2FK1NWd/FCbi85R169fBUGyAx+OBzWabpa3ZyPV4PCgyFCniAKvWlKDIUKTAKSwsxN6mRnxt8WIMDw3hVzU1N4Szt6kRP37gAVy+LGl1cXExDMXFc+IoNZiUUaxMeyJrs9vtxsTEBILBIJYvXw673c7K5G1yZlnmdJ6Oj7IfRScaWxqh0WjgdrthsVhYm8woWyQSgcViQUdHBzQaDXZW75z1Mnt+W58VZ9fuOrz+5hs3hbN6zWpUVFaiorIShuLivHBYsMc/PICCggKsv/seTMYmYbVamSZ5PJ5ZC5lsMsrLy3OWye1ra2vR0dGBJZolOP/3XkxNTWEqPoV4Io54PCEFg5IJRP8zgYP2g8yXNBqNMBqN0Gq1EEWRDfp8QZprsWtoO+hgQZrPE4cFe/qH+lFQUAB7kx2eYx5otVpEo1GFZ+ByuVgwx2Qyobm5mQ2Ay+VidTPLAGD58uWIRCK474f34YizHdenphCfQbAcN04lU/D3+3Hs6K0RrmQE+wb7sGhRAc6fO4/qpyT/1+l0oibDZt2IuN1utgs7cPAAHtzwAKbiU5iKx5GIxxFPzCA4SwD+/z3gzgNgRzomcyl0Oh0AwG63z3KdFiITExNsddXpdOlAfPoUI5VCKm2LKX3kdKsKDwApSiGZlM7R9rfuYwRZLBZFjHch5JrNZta2/tf16QB7cprkjCMjtsjSrXVkxBZ3ANTQ3ED+4QEKXgzQoz99VBFRCwQCC4p0ZUbSBItAwYsB8g8P0L7Wfez+lyhN/6l5upoGA34K3kDAPRqNUktLiyLgvmbtGrrwfpAGg35qaG74MpJL3EyntLG5AeUWAWq1GkccR/Daq6/d8JGRfX8LEokE+vsH8OTjT+bzHUHGro9j9zJ3mTP/58LJ1UZ+Rr6Bplx9WhDGzNTY3CBp8sUAdbpfIZ1Ol/eI6XQ6cj3vouDFAA0G/fTS717Ku+3MY6KZ+cx78+HM1z4frGx1FooxS4NlqXm6GlXbqthRj+jtwYnjJ+Y8tn9YeBgmUyk70Dx+/AQO2A8s5EuYWdqyEM2dWTfXdYFf52TV3lz9zLqTy1W46o4SNDY3oXCpLuM0IjPcCIXfKn94Mj42hmfbnTjXc27BL3MzpmE+kzAX/kIHLV+MOQmW5d7Se7GhbAPuWH0HvqHRpD+dmjYwRISrsRiGBodw+uTpBRP7WWnwzdrg+daET43gr+QmNhpE9PWvaPiMNhhE3P8GAG3CFDKJWtqSAAAAAElFTkSuQmCC',
      "cc-by-nc-nd": 'data:image/png;base64,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'
    };
    return {
      manifest: {
        about:{
          name: "Popcorn Attribution Plugin",
          version: "0.1",
          author: "@annasob",
          website: "annasob.wordpress.com"
        },
        options:{
          start              : {elem:'input', type:'text', label:'In'},
          end                : {elem:'input', type:'text', label:'Out'},
          nameofwork         : {elem:'input', type:'text', label:'Name of Work'},
          nameofworkurl      : {elem:'input', type:'text', label:'Url of Work'},
          copyrightholder    : {elem:'input', type:'text', label:'Copyright Holder'},
          copyrightholderurl : {elem:'input', type:'text', label:'Copyright Holder Url'},
          license            : {elem:'input', type:'text', label:'License type'},
          licenseurl         : {elem:'input', type:'text', label:'License URL'},
          target             : 'attribution-container'
        }
      },
      _setup: function(options) {
        var attrib = ""; 
        // make a div to put the information into
        options._container = document.createElement( 'div' );
        options._container.style.display = "none";
              
        if (options.nameofworkurl) {
          attrib += "<a href='" + options.nameofworkurl + "' target='_blank'>";
        }
        if (options.nameofwork) {
          attrib += options.nameofwork;
        }
        if (options.nameofworkurl) {
          attrib += "</a>";
        }
        if (options.copyrightholderurl) {
          attrib += "<a href='" + options.copyrightholderurl + "' target='_blank'>";
        }
        if (options.copyrightholder) {
          attrib += ", " + options.copyrightholder;
        }
        if (options.copyrightholderurl) {
          attrib += "</a>";
        }

        //if the user did not specify any parameters just pull the text from the tag
        if ( attrib === "" ) {
          attrib = options.text;
        }

        if (options.license) {
          if (licenses[options.license.toLowerCase()]) {
            if (options.licenseurl) {
              attrib = "<a href='" + options.licenseurl + "' target='_blank'><img src='"+ licenses[options.license.toLowerCase()] +"' border='0'/></a> " + attrib;
            } else {
              attrib = "<img src='"+ licenses[options.license.toLowerCase()] +"' />" + attrib;
            }
          } else {
            if (options.licenseurl) {
              attrib += ", license: <a href='" + options.licenseurl + "' target='_blank'>" + options.license + "</a> ";
            } else {
              attrib += ", license: " + options.license;
            }
          } 
        } else if (options.licenseurl) {
          attrib += ", <a href='" + options.licenseurl + "' target='_blank'>license</a> ";
        }
        options._container.innerHTML  = attrib;
        if ( document.getElementById( options.target ) ) {
          document.getElementById( options.target ).appendChild( options._container );
        }
      },
      /**
       * @member attribution 
       * The start function will be executed when the currentTime 
       * of the video  reaches the start time provided by the 
       * options variable
       */
      start: function(event, options){
        options._container.style.display = "inline";
      },
      /**
       * @member attribution 
       * The end function will be executed when the currentTime 
       * of the video  reaches the end time provided by the 
       * options variable
       */
      end: function(event, options){
        options._container.style.display = "none";
      }
    };
  })());
})( Popcorn );
// PLUGIN: Code

(function (Popcorn) {

  /**
   * Code Popcorn Plug-in
   *
   * Adds the ability to run arbitrary code (JavaScript functions) according to video timing.
   *
   * @param {Object} options
   *
   * Required parameters: start, end, template, data, and target.
   * Optional parameter: static.
   *
   *   start: the time in seconds when the mustache template should be rendered
   *          in the target div.
   *
   *   end: the time in seconds when the rendered mustache template should be
   *        removed from the target div.
   *
   *   onStart: the function to be run when the start time is reached.
   *
   *   onFrame: [optional] a function to be run on each paint call
   *            (e.g., called ~60 times per second) between the start and end times.
   *
   *   onEnd: [optional] a function to be run when the end time is reached.
   *
   * Example:
     var p = Popcorn('#video')

        // onStart function only
        .code({
          start: 1,
          end: 4,
          onStart: function( options ) {
            // called on start
          }
        })

        // onStart + onEnd only
        .code({
          start: 6,
          end: 8,
          onStart: function( options ) {
            // called on start
          },
          onEnd: function ( options ) {
            // called on end
          }
        })

        // onStart, onEnd, onFrame
        .code({
          start: 10,
          end: 14,
          onStart: function( options ) {
            // called on start
          },
          onFrame: function ( options ) {
            // called on every paint frame between start and end.
            // uses mozRequestAnimationFrame, webkitRequestAnimationFrame,
            // or setTimeout with 16ms window.
          },
          onEnd: function ( options ) {
            // called on end
          }
        });
  *
  */

  Popcorn.plugin( 'code' , function(options) {
    var running = false;
  
    // Setup a proper frame interval function (60fps), favouring paint events.
    var step = ( function() {
    
      var buildFrameRunner = function( runner ) {
        return function( f, options ) {
    
          var _f = function() {
            f();
            if ( running ) {
              runner( _f );
            }
          };
    
          _f();
        };
      };
    
      // Figure out which level of browser support we have for this
      if ( window.webkitRequestAnimationFrame ) {
        return buildFrameRunner( window.webkitRequestAnimationFrame );
      } else if ( window.mozRequestAnimationFrame ) {
        return buildFrameRunner( window.mozRequestAnimationFrame );
      } else {
        return buildFrameRunner( function( f ) {
          window.setTimeout( f, 16 );
        } );
      }
    
    } )();

    if ( !options.onStart || typeof options.onStart !== 'function' ) {
      throw 'Popcorn Code Plugin Error: onStart must be a function.';
    }

    if ( options.onEnd && typeof options.onEnd !== 'function' ) {
      throw 'Popcorn Code Plugin Error: onEnd  must be a function.';
    }

    if ( options.onFrame && typeof options.onFrame !== 'function' ) {
      throw 'Popcorn Code Plugin Error: onFrame  must be a function.';
    }

    return {
      start: function( event, options ) {
        options.onStart( options );

        if ( options.onFrame ) {
          running = true;
          step( options.onFrame, options );
        }
      },

      end: function( event, options ) {
        if ( options.onFrame ) {
          running = false;
        }

        if ( options.onEnd ) {
          options.onEnd( options );
        }
      }
    };
  },
  {
    about: {
      name: 'Popcorn Code Plugin',
      version: '0.1',
      author: 'David Humphrey (@humphd)',
      website: 'http://vocamus.net/dave'
    },
    options: {
      start: {elem:'input', type:'text', label:'In'},
      end: {elem:'input', type:'text', label:'Out'},
      // TODO: how to deal with functions, eval strings?
      onStart: {elem:'input', type:'text', label:'onStart'},
      onFrame: {elem:'input', type:'text', label:'onFrame'},
      onEnd: {elem:'input', type:'text', label:'onEnd'}
    }
  });
})( Popcorn );
// PLUGIN: Flickr
(function (Popcorn) {
  
  /**
   * Flickr popcorn plug-in 
   * Appends a users Flickr images to an element on the page.
   * Options parameter will need a start, end, target and userid or username and api_key.
   * Optional parameters are numberofimages, height, width, padding, and border
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing
   * Userid is the id of who's Flickr images you wish to show
   * Tags is a mutually exclusive list of image descriptor tags
   * Username is the username of who's Flickr images you wish to show 
   *  using both userid and username is redundant
   *  an api_key is required when using username
   * Apikey is your own api key provided by Flickr 
   * Target is the id of the document element that the images are
   *  appended to, this target element must exist on the DOM
   * Numberofimages specify the number of images to retreive from flickr, defaults to 4
   * Height the height of the image, defaults to '50px'
   * Width the width of the image, defaults to '50px'
   * Padding number of pixels between images, defaults to '5px'
   * Border border size in pixels around images, defaults to '0px'
   * 
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .footnote({
          start:          5,                 // seconds, mandatory
          end:            15,                // seconds, mandatory
          userid:         '35034346917@N01', // optional
          tags:           'dogs,cats',       // optional
          numberofimages: '8',               // optional
          height:         '50px',            // optional
          width:          '50px',            // optional
          padding:        '5px',             // optional
          border:         '0px',             // optional
          target:         'flickrdiv'        // mandatory
        } )
   *
   */
  Popcorn.plugin( "flickr" , function( options ) {
    var containerDiv,
        _userid,
        _uri,
        _link,
        _image,
        _count   = options.numberofimages || 4 ,
        _height  = options.height || "50px",
        _width   = options.width || "50px",
        _padding = options.padding || "5px",
        _border  = options.border || "0px",
        i;

    // create a new div this way anything in the target div is left intact
    // this is later populated with Flickr images
    containerDiv               = document.createElement( "div" );
    containerDiv.id            = "flickr"+ i;
    containerDiv.style.width   = "100%";
    containerDiv.style.height  = "100%";
    containerDiv.style.display = "none";
    i++;
    
    // ensure the target container the user chose exists
    if ( document.getElementById( options.target ) ) {
      document.getElementById( options.target ).appendChild( containerDiv );
    } else { 
      throw ( "flickr target container doesn't exist" ); 
    }
    
    // get the userid from Flickr API by using the username and apikey
    var isUserIDReady = function() {
      if ( !_userid ) {
        _uri  = "http://api.flickr.com/services/rest/?method=flickr.people.findByUsername&";        
        _uri += "username=" + options.username + "&api_key=" + options.apikey + "&format=json&jsoncallback=flickr";
        Popcorn.xhr.getJSONP( _uri, function(data) {
          _userid = data.user.nsid;
          getFlickrData();
        });
      } else {
        setTimeout(function () {
          isUserIDReady();
        }, 5);
      }
    };
    // get the photos from Flickr API by using the user_id and/or tags
    var getFlickrData = function() { 
      _uri  = "http://api.flickr.com/services/feeds/photos_public.gne?";        
      _uri += "id=" + _userid + "&";
      if ( options.tags ) {
        _uri += "tags=" + options.tags + "&";
      }
      _uri += "lang=en-us&format=json&jsoncallback=flickr";
      
      Popcorn.xhr.getJSONP( _uri, function( data ) {
        containerDiv.innerHTML = "<p style='padding:" + _padding + ";'>" + data.title + "<p/>";
        
        Popcorn.forEach( data.items, function ( item, i ) {
          if ( i < _count ) {
            _link = document.createElement( 'a' );
            _link.setAttribute( 'href', item.link );
            _link.setAttribute( "target", "_blank" );
            _image = document.createElement( 'img' );
            _image.setAttribute( 'src', item.media.m );
            _image.setAttribute( 'height',_height );
            _image.setAttribute( 'width', _width );
            _image.setAttribute( 'style', 'border:' + _border + ';padding:' + _padding );
            _link.appendChild( _image );         
            containerDiv.appendChild( _link );
          } else {
            return false;
          }
        });
      });
    };
    if ( options.userid ) {
      _userid = options.userid;
      getFlickrData();
      
    } else if ( options.username && options.apikey ) {
      isUserIDReady();
    }
    return {
      /**
       * @member flickr
       * The start function will be executed when the currentTime
       * of the video reaches the start time provided by the
       * options variable
       */
      start: function( event, options ){
        containerDiv.style.display = "inline";
      },
      /**
       * @member flickr
       * The end function will be executed when the currentTime
       * of the video reaches the end time provided by the
       * options variable
       */
      end: function( event, options ){      
          containerDiv.style.display = "none";       
      }
    };
  },
  {
    about:{
      name:    "Popcorn Flickr Plugin",
      version: "0.2",
      author:  "Scott Downe, Steven Weerdenburg, Annasob",
      website: "http://scottdowne.wordpress.com/"
    },
    options:{
      start          : {elem:'input', type:'number', label:'In'},
      end            : {elem:'input', type:'number', label:'Out'},
      userid         : {elem:'input', type:'text',   label:'UserID'},
      tags           : {elem:'input', type:'text',   label:'Tags'},
      username       : {elem:'input', type:'text',   label:'Username'},
      apikey        : {elem:'input', type:'text',   label:'Api_key'},
      target         :  'Flickr-container',
      height         : {elem:'input', type:'text', label:'Height'},
      width          : {elem:'input', type:'text', label:'Width'},
      padding        : {elem:'input', type:'text', label:'Padding'},
      border         : {elem:'input', type:'text', label:'Border'},
      numberofimages : {elem:'input', type:'text', label:'Number of Images'}
    }
  });
})( Popcorn );
// PLUGIN: Footnote

(function (Popcorn) {
  
  /**
   * Footnote popcorn plug-in 
   * Adds text to an element on the page.
   * Options parameter will need a start, end, target and text.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing 
   * Text is the text that you want to appear in the target
   * Target is the id of the document element that the text needs to be 
   * attached to, this target element must exist on the DOM
   * 
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .footnote({
          start: 5, // seconds
          end: 15, // seconds
          text: 'This video made exclusively for drumbeat.org',
          target: 'footnotediv'
        } )
   *
   */
  Popcorn.plugin( "footnote" , {
    
    manifest: {
      about:{
        name: "Popcorn Footnote Plugin",
        version: "0.1",
        author: "@annasob",
        website: "annasob.wordpress.com"
      },
      options:{
        start    : {elem:'input', type:'text', label:'In'},
        end      : {elem:'input', type:'text', label:'Out'},
        target   : 'footnote-container',
        text     : {elem:'input', type:'text', label:'Text'}
      }
    },
    _setup: function(options) {
      options._container = document.createElement( 'div' );
      options._container.style.display = "none";
      options._container.innerHTML  = options.text;
      if ( document.getElementById( options.target ) ) {
        document.getElementById( options.target ).appendChild( options._container );
      }
    },
    /**
     * @member footnote 
     * The start function will be executed when the currentTime 
     * of the video  reaches the start time provided by the 
     * options variable
     */
    start: function(event, options){
      options._container.style.display = "inline";
    },
    /**
     * @member footnote 
     * The end function will be executed when the currentTime 
     * of the video  reaches the end time provided by the 
     * options variable
     */
    end: function(event, options){
      options._container.style.display = "none";
    }
   
  });

})( Popcorn );// PLUGIN: Google Feed
(function (Popcorn) {

  var i = 1,
      scriptLoading = false,
      scriptLoaded  = false,
      callBack      = function( data ) {

        if ( typeof google !== 'undefined' && google.load ) {

          google.load( "feeds", "1", { callback: function () { scriptLoaded = true; } } );
        } else {

          setTimeout( function() {

            callBack( data );
          }, 1);
        }
      };

  /**
   * googlefeed popcorn plug-in
   * Adds a feed from the specified blog url at the target div
   * Options parameter will need a start, end, target, url and title
   * -Start is the time that you want this plug-in to execute
   * -End is the time that you want this plug-in to stop executing
   * -Target is the id of the DOM element that you want the map to appear in. This element must be in the DOM
   * -Url is the url of the blog's feed you are trying to access
   * -Title is the title of the blog you want displayed above the feed
   * -Orientation is the orientation of the blog, accepts either Horizontal or Vertical, defaults to Vertical
   * @param {Object} options
   *
   * Example:
    var p = Popcorn("#video")
      .googlefeed({
       start: 5, // seconds
       end: 15, // seconds
       target: "map",
       url: "http://zenit.senecac.on.ca/~chris.tyler/planet/rss20.xml",
       title: "Planet Feed"
    } )
  *
  */

  Popcorn.plugin( "googlefeed" , function( options ) {
    // create a new div and append it to the parent div so nothing
    // that already exists in the parent div gets overwritten
    var newdiv = document.createElement( "div" );
    newdiv.style.display = "none";
    newdiv.id = "_feed"+i;
    newdiv.style.width = "100%";
    newdiv.style.height = "100%";
    i++;
    if ( document.getElementById( options.target ) ) {
      document.getElementById( options.target ).appendChild( newdiv );
    }

    var initialize = function() {
      //ensure that the script has been loaded
      if ( !scriptLoaded ) {
        setTimeout(function () {
          initialize();
        }, 5);
      } else {
        // Create the feed control using the user entered url and title
        var tmp = new GFdynamicFeedControl( options.url, newdiv, {
          vertical:   options.orientation.toLowerCase() == "vertical" ? true : false,
          horizontal: options.orientation.toLowerCase() == "horizontal" ? true : false,
          title:      options.title = options.title || "Blog"
        });
      }
    };
    
    if ( !scriptLoading ) {

      scriptLoading = true;
    
      Popcorn.getScript( "http://www.google.com/jsapi", callBack );
      Popcorn.getScript( "http://www.google.com/uds/solutions/dynamicfeed/gfdynamicfeedcontrol.js" );

      //Doing this because I cannot find something similar to getScript() for css files
      var head = document.getElementsByTagName("head")[0];
      var css = document.createElement('link');
      css.type = "text/css";
      css.rel = "stylesheet";
      css.href =  "http://www.google.com/uds/solutions/dynamicfeed/gfdynamicfeedcontrol.css";
      head.insertBefore( css, head.firstChild );
    }

    initialize();
    
    return {
      /**
       * @member webpage
       * The start function will be executed when the currentTime
       * of the video reaches the start time provided by the
       * options variable
       */
      start: function( event, options ){
        newdiv.setAttribute( "style", "display:inline" );
        // Default to vertical orientation if empty or incorrect input
        if( !options.orientation || ( options.orientation.toLowerCase() != "vertical" &&
          options.orientation.toLowerCase() != "horizontal" ) ) {
          options.orientation = "vertical";
        }
      },
      /**
       * @member webpage
       * The end function will be executed when the currentTime
       * of the video reaches the end time provided by the
       * options variable
       */
      end: function(event, options){
        newdiv.setAttribute( "style", "display:none" );
      }
    };
  },
  {
    about: {
      name: "Popcorn Google Feed Plugin",
      version: "0.1",
      author: "David Seifried",
      website: "dseifried.wordpress.com"
    },
    options: {
      start          : { elem:"input", type:"text", label:"In" },
      end            : { elem:"input", type:"text", label:"Out" },
      target         : "feed-container",
      url            : { elem:"input", type:"text", label:"url" },
      title          : { elem:"input", type:"text", label:"title" },
      orientation    : {elem:"select", options:["Vertical","Horizontal"], label:"orientation"}
    }
  });
  
})( Popcorn );
// PLUGIN: Google Maps
var googleCallback;
(function (Popcorn) {

  var i = 1,
      _mapFired = false,
      _mapLoaded = false,
      geocoder,
      loadMaps;
  //google api callback 
  googleCallback  = function( data ) {
    // ensure all of the maps functions needed are loaded 
    // before setting _maploaded to true
    if ( typeof google !== "undefined" && google.maps && google.maps.Geocoder && google.maps.LatLng ) {
      geocoder = new google.maps.Geocoder();
      _mapLoaded = true;
    } else {
      setTimeout( function() {
        googleCallback( data );
      }, 1);
    }
  };
  // function that loads the google api
  loadMaps = function () {
    // for some reason the Google Map API adds content to the body
    if ( document.body ) {
      _mapFired = true;
      Popcorn.getScript( "http://maps.google.com/maps/api/js?sensor=false&callback=googleCallback" );
    } else {
      setTimeout( function() {
          loadMaps( );
        }, 1);
    }
  };

  /**
   * googlemap popcorn plug-in
   * Adds a map to the target div centered on the location specified by the user
   * Options parameter will need a start, end, target, type, zoom, lat and lng, and location
   * -Start is the time that you want this plug-in to execute
   * -End is the time that you want this plug-in to stop executing
   * -Target is the id of the DOM element that you want the map to appear in. This element must be in the DOM
   * -Type [optional] either: HYBRID (default), ROADMAP, SATELLITE, TERRAIN, STREETVIEW
   * -Zoom [optional] defaults to 0
   * -Heading [optional] STREETVIEW orientation of camera in degrees relative to true north (0 north, 90 true east, ect)
   * -Pitch [optional] STREETVIEW vertical orientation of the camera (between 1 and 3 is recommended)
   * -Lat and Lng: the coordinates of the map must be present if location is not specified.
   * -Location: the adress you want the map to display, bust be present if lat and log are not specified.
   * Note: using location requires extra loading time, also not specifying both lat/lng and location will
   * cause and error.
   * @param {Object} options
   *
   * Example:
    var p = Popcorn("#video")
      .googlemap({
       start: 5, // seconds
       end: 15, // seconds
       type: "ROADMAP",
       target: "map",
       lat: 43.665429,
       lng: -79.403323
    } )
  *
  */
  Popcorn.plugin( "googlemap" , function( options ) {
    var newdiv,
        map,
        location;
        
    // if this is the firest time running the plugins
    // call the function that gets the sctipt
    if ( !_mapFired ) {
      loadMaps();
    }

    // create a new div this way anything in the target div is left intact
    // this is later passed on to the maps api
    newdiv              = document.createElement( "div" );
    newdiv.id           = "actualmap" + i;
    newdiv.style.width  = "100%";
    newdiv.style.height = "100%";
    i++;
    
    // ensure the target container the user chose exists
    if ( document.getElementById( options.target ) ) {
      document.getElementById(options.target).appendChild(newdiv);
    } else { 
      throw ( "map target container doesn't exist" ); 
    }
    
    // ensure that google maps and its functions are loaded
    // before setting up the map parameters
    var isMapReady = function() {
      if ( _mapLoaded ) {
        if ( options.location ) {
          // calls an anonymous google function called on separate thread
          geocoder.geocode( { "address": options.location }, function( results, status ) {
            if ( status === google.maps.GeocoderStatus.OK ) {
              options.lat = results[0].geometry.location.lat();
              options.lng = results[0].geometry.location.lng();
              location    = new google.maps.LatLng( options.lat, options.lng );
              map         = new google.maps.Map( newdiv, { mapTypeId: google.maps.MapTypeId[ options.type ] || google.maps.MapTypeId.HYBRID } );
              map.getDiv().style.display = "none";
            }
          } );
        } else {
          location = new google.maps.LatLng( options.lat, options.lng );
          map      = new google.maps.Map( newdiv, { mapTypeId: google.maps.MapTypeId[ options.type ] || google.maps.MapTypeId.HYBRID } );
          map.getDiv().style.display = "none";
        }        
      } else {
        setTimeout(function () {
          isMapReady();
        }, 5);
      }
    };
    
    isMapReady();

    return {
      /**
       * @member webpage
       * The start function will be executed when the currentTime
       * of the video reaches the start time provided by the
       * options variable
       */
      start: function(event, options){
        // ensure the map has been initialized in the setup function above
        var isMapSetup = function () {
          if ( map ) {
            map.getDiv().style.display = "block";
            // reset the location and zoom just in case the user plaid with the map
            map.setCenter(location);

            // make sure options.zoom is a number
            if ( options.zoom && typeof options.zoom !== "number" ) {
              options.zoom = +options.zoom;
            }

            options.zoom = options.zoom || 0; // default to 0
            map.setZoom( options.zoom );

            //Make sure heading is a number
            if ( options.heading && typeof options.heading !== "number" ) {
              options.heading = +options.heading;
            }
            //Make sure pitch is a number
            if ( options.pitch && typeof options.pitch !== "number" ) {
              options.pitch = +options.pitch;
            }

            google.maps.event.trigger(map, 'resize');

            if ( options.type === "STREETVIEW" ) {
              // Switch this map into streeview mode
              map.setStreetView(
                // Pass a new StreetViewPanorama instance into our map
                new google.maps.StreetViewPanorama( newdiv, {
                  position: location,
                  pov: {
                    heading: options.heading = options.heading || 0,
                    pitch: options.pitch     = options.pitch || 0,
                    zoom: options.zoom
                  }
                } )
              );
            }
          } else {
            setTimeout( function () {
              isMapSetup();
            }, 13);
          }
        };

        isMapSetup();
      },
      /**
       * @member webpage
       * The end function will be executed when the currentTime
       * of the video reaches the end time provided by the
       * options variable
       */
      end: function(event, options){
        // if the map exists hide it do not delete the map just in
        // case the user seeks back to time b/w start and end
        if (map) {
          map.getDiv().style.display = "none";
        }
      },
      _teardown: function( options ) {
        // the map must be manually removed
        document.getElementById( options.target ).removeChild( newdiv );
        newdiv = map = location = null;
      }
    };
  },
  {
    about: {
      name: "Popcorn Google Map Plugin",
      version: "0.1",
      author: "@annasob",
      website: "annasob.wordpress.com"
    },
    options: {
      start    : {elem:"input", type:"text", label:"In"},
      end      : {elem:"input", type:"text", label:"Out"},
      target   : "map-container",
      type     : {elem:"select", options:["ROADMAP","SATELLITE", "STREETVIEW", "HYBRID", "TERRAIN"], label:"Type"},
      zoom     : {elem:"input", type:"text", label:"Zoom"},
      lat      : {elem:"input", type:"text", label:"Lat"},
      lng      : {elem:"input", type:"text", label:"Lng"},
      location : {elem:"input", type:"text", label:"Location"},
      heading  : {elem:"input", type:"text", label:"Heading"},
      pitch    : {elem:"input", type:"text", label:"Pitch"}
    }
  });
})( Popcorn );
// PLUGIN: Google News

(function (Popcorn) {

  var scriptLoaded = false,
      scriptLoading = false,
      callBack     = function( data ) {

        if ( typeof google !== 'undefined' && google.load ) {

          google.load("elements", "1", {packages : ["newsshow"], callback: function() {scriptLoaded = true;}});
        } else {

          setTimeout( function() {

            callBack( data );
          }, 1);
        }
      };

  /**
   * Google News popcorn plug-in 
   * Displays Google News information on a topic in a targeted div.
   * Options parameter will need a start, end and target.
   * Optional parameters are topic. topic defaults to "top stories"
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing
   * Target is the id of the document element that the content is
   *  appended to, this target element must exist on the DOM
   * Topic is the topic of news articles you want to display.
   * 
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .footnote({
          start:          5,                 // seconds, mandatory
          end:            15,                // seconds, mandatory
          topic:          'oil spill',       // optional
          target:         'newsdiv'        // mandatory
        } )
   *
   */
  Popcorn.plugin( "googlenews" , {

      manifest: {
        about:{
          name:    "Popcorn Google News Plugin",
          version: "0.1",
          author:  "Scott Downe",
          website: "http://scottdowne.wordpress.com/"
        },
        options:{
          start    : {elem:'input', type:'text', label:'In'},
          end      : {elem:'input', type:'text', label:'Out'},
          target   : 'news-container',
          topic     : {elem:'select', type:'text', label:'Type'}
        }
      },
      _setup : function( options ) {
      
        if ( !scriptLoading ) {

          scriptLoading = true;
          Popcorn.getScript( "http://www.google.com/jsapi", callBack );
        }

        options.container = document.createElement( 'div' );
        if ( document.getElementById( options.target ) ) {
          document.getElementById( options.target ).appendChild( options.container );
        }

        var readyCheck = setInterval(function() {
          if ( !scriptLoaded ) {
            return;
          }
          clearInterval(readyCheck);

          var newsShow = new google.elements.NewsShow( options.container, {
            format : "300x250",
            queryList : [
              { q: options.topic || "Top Stories" }
            ]
          } );

        }, 5);

        options.container.style.display = "none";

      },
      /**
       * @member googlenews 
       * The start function will be executed when the currentTime 
       * of the video  reaches the start time provided by the 
       * options variable
       */
      start: function( event, options ){
        options.container.setAttribute( 'style', 'display:inline' );
      },
      /**
       * @member googlenews 
       * The end function will be executed when the currentTime 
       * of the video  reaches the end time provided by the 
       * options variable
       */
      end: function( event, options ){
        options.container.setAttribute( 'style', 'display:none' );
      }

  });

})( Popcorn );
// PLUGIN: IMAGE

(function (Popcorn) {
  
  /**
   * Images popcorn plug-in 
   * Shows an image element
   * Options parameter will need a start, end, href, target and src.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing 
   * href is the url of the destination of a link - optional 
   * Target is the id of the document element that the iframe needs to be attached to, 
   * this target element must exist on the DOM
   * Src is the url of the image that you want to display
   * text is the overlayed text on the image - optional  
   *
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .image({
          start: 5, // seconds
          end: 15, // seconds
          href: 'http://www.drumbeat.org/',
          src: 'http://www.drumbeat.org/sites/default/files/domain-2/drumbeat_logo.png',
          text: 'DRUMBEAT',
          target: 'imagediv'
        } )
   *
   */
  Popcorn.plugin( "image", {

      manifest: {
        about:{
          name: "Popcorn image Plugin",
          version: "0.1",
          author: "Scott Downe",
          website: "http://scottdowne.wordpress.com/"
        },
        options:{
          start :  {elem:'input', type:'number', label:'In'},
          end :    {elem:'input', type:'number', label:'Out'},
          href :   {elem:'input', type:'text',   label:'Link URL'},
          target : 'Image-container',
          src :    {elem:'input', type:'text',   label:'Source URL'},
          text:    {elem:'input', type:'text',   label:'TEXT'}
        }
      },

      _setup: function( options ) {

        options.link = document.createElement( 'a' );
        options.link.style.position = "relative";
        options.link.style.textDecoration = "none";

        var img = document.createElement( 'img' );
        img.addEventListener( "load", function() {
          img.style.borderStyle = "none"; // borders look really bad, if someone wants it they can put it on their div target
          
          if ( options.href ) {
            options.link.href = options.href;
          }
          options.link.target = "_blank";
          if ( document.getElementById( options.target ) ) {
            document.getElementById( options.target ).appendChild( options.link ); // add the widget's div to the target div
          }
          
          var fontHeight = ( img.height / 12 ) + "px";
          
          var divText = document.createElement( 'div' );
          divTextStyle = {
              position: "relative",
              width: img.width + "px",
              textAlign: "center",
              fontSize: fontHeight,
              color: "black",
              fontWeight : "bold",
              zIndex: "10"
          };
          for ( var st in divTextStyle ) {
            divText.style[ st ] = divTextStyle[ st ];
          }
          
          divText.innerHTML = options.text || "";
          options.link.appendChild( divText );
          options.link.appendChild( img );
          divText.style.top = ( img.height / 2 ) - ( divText.offsetHeight / 2 ) + "px"; 
          options.link.style.display = "none";
        }, false );
        img.src = options.src;
      },

      /**
       * @member image 
       * The start function will be executed when the currentTime 
       * of the video  reaches the start time provided by the 
       * options variable
       */
      start: function( event, options ) {
        options.link.style.display = "block";
      },
      /**
       * @member image 
       * The end function will be executed when the currentTime 
       * of the video  reaches the end time provided by the 
       * options variable
       */
      end: function( event, options ) {
        options.link.style.display = "none";
      }
          
  });

})( Popcorn );
// PLUGIN: LASTFM

(function (Popcorn) {

  var _artists = [],
      lastFMcallback = function(data){
        if (data.artist) {
          var htmlString = '<h3>'+data.artist.name+'</h3>';
          htmlString += '<a href="'+data.artist.url+'" target="_blank" style="float:left;margin:0 10px 0 0;"><img src="'+ data.artist.image[2]['#text'] +'" alt=""></a>';
          htmlString += '<p>'+ data.artist.bio.summary +'</p>';
          htmlString += '<hr /><p><h4>Tags</h4><ul>';

          Popcorn.forEach( data.artist.tags.tag, function( val, i) {
            htmlString += '<li><a href="'+ val.url +'">'+ val.name +'</a></li>';
          });

          htmlString += '</ul></p>';
          htmlString += '<hr /><p><h4>Similar</h4><ul>';

          Popcorn.forEach( data.artist.similar.artist, function( val, i) {
            htmlString += '<li><a href="'+ val.url +'">'+ val.name +'</a></li>';
          });

          htmlString += '</ul></p>';

          _artists[data.artist.name.toLowerCase()] = htmlString;
        }
      };

  /**
   * LastFM popcorn plug-in
   * Appends information about a LastFM artist to an element on the page.
   * Options parameter will need a start, end, target, artist and apikey.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing
   * Artist is the name of who's LastFM information you wish to show
   * Target is the id of the document element that the images are
   *  appended to, this target element must exist on the DOM
   * ApiKey is the API key registered with LastFM for use with their API
   * 
   * @param {Object} options
   *  
   * Example:
     var p = Popcorn('#video')
        .lastfm({
          start:          5,                                    // seconds, mandatory
          end:            15,                                   // seconds, mandatory
          artist:         'yacht',                              // mandatory
          target:         'lastfmdiv',                          // mandatory
          apikey:         '1234567890abcdef1234567890abcdef'    // mandatory
        } )
   *
   */
  Popcorn.plugin( "lastfm" , (function(){
      
    
    return {
      manifest: {
        about:{
          name:    "Popcorn LastFM Plugin",
          version: "0.1",
          author:  "Steven Weerdenburg",
          website: "http://sweerdenburg.wordpress.com/"
        },
        options:{
          start    : {elem:'input', type:'text', label:'In'},
          end      : {elem:'input', type:'text', label:'Out'},
          target   : 'lastfm-container',
          artist   : {elem:'input', type:'text', label:'Artist'}
        }
      },

      _setup: function( options ) {
        options._container = document.createElement( 'div' );
        options._container.style.display = "none";
        options._container.innerHTML = "";
        
        options.artist = options.artist.toLowerCase();
        
        if ( document.getElementById( options.target ) ) {
          document.getElementById( options.target ).appendChild( options._container );
        }
        
        if(!_artists[options.artist]) {

          _artists[options.artist] = "Unknown Artist";
          Popcorn.getJSONP("http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist="+ options.artist +"&api_key="+options.apikey+"&format=json&callback=lastFMcallback", lastFMcallback, false );
          
        }
        
      },
      /**
       * @member LastFM 
       * The start function will be executed when the currentTime 
       * of the video  reaches the start time provided by the 
       * options variable
       */
      start: function( event, options ) {
        options._container.innerHTML = _artists[options.artist];
        options._container.style.display = "inline";
      },
      /**
       * @member LastFM 
       * The end function will be executed when the currentTime 
       * of the video  reaches the end time provided by the 
       * options variable
       */
      end: function( event, options ) {
        options._container.style.display = "none";
        options._container.innerHTML = "";
      }
    };
  })());

})( Popcorn );
// PLUGIN: lowerthird

(function (Popcorn) {
  
  /**
   * Lower Third popcorn plug-in 
   * Displays information about a speaker over the video, or in the target div
   * Options parameter will need a start, and end.
   * Optional parameters are target, salutation, name and role.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing
   * Target is the id of the document element that the content is
   *  appended to, this target element must exist on the DOM
   * salutation is the speaker's Mr. Ms. Dr. etc.
   * name is the speaker's name.
   * role is information about the speaker, example Engineer.
   * 
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .footnote({
          start:          5,                 // seconds, mandatory
          end:            15,                // seconds, mandatory
          salutation:     'Mr',              // optional
          name:           'Scott Downe',     // optional
          role:           'Programmer',      // optional
          target:         'subtitlediv'      // optional
        } )
   *
   */

  Popcorn.plugin( "lowerthird" , {
    
      manifest: {
        about:{
          name: "Popcorn lowerthird Plugin",
          version: "0.1",
          author: "Scott Downe",
          website: "http://scottdowne.wordpress.com/"
        },
        options:{
          start : {elem:'input', type:'text', label:'In'},
          end : {elem:'input', type:'text', label:'Out'},
          target : 'lowerthird-container',
          salutation : {elem:'input', type:'text', label:'Text'},
          name : {elem:'input', type:'text', label:'Text'},
          role : {elem:'input', type:'text', label:'Text'}
        }
      },

      _setup: function( options ) {

        // Creates a div for all Lower Thirds to use
        if ( !this.container ) {
          this.container = document.createElement('div');

          this.container.style.position = "absolute";
          this.container.style.color = "white";
          this.container.style.textShadow = "black 2px 2px 6px";
          this.container.style.fontSize = "24px";
          this.container.style.fontWeight = "bold";
          this.container.style.paddingLeft = "40px";

          // the video element must have height and width defined
          this.container.style.width = this.video.offsetWidth + "px";
          this.container.style.left = this.position().left + "px";

          this.video.parentNode.appendChild( this.container );
        }

        // if a target is specified, use that
        if ( options.target && options.target !== 'lowerthird-container' ) {
          options.container = document.getElementById( options.target );
        } else { // use shared default container
          options.container = this.container;
        }



      },
      /**
       * @member lowerthird
       * The start function will be executed when the currentTime
       * of the video reaches the start time provided by the
       * options variable
       */
      start: function(event, options){
        options.container.innerHTML = ( options.salutation ? options.salutation + " " : "" ) + options.name + ( options.role ? "<br />" + options.role : "" );
        this.container.style.top = this.position().top + this.video.offsetHeight - ( 40 + this.container.offsetHeight ) + "px";
      },
      /**
       * @member lowerthird
       * The end function will be executed when the currentTime
       * of the video reaches the end time provided by the
       * options variable
       */
      end: function(event, options){
        options.container.innerHTML = "";
      }
   
  } );

})( Popcorn );
// PLUGIN: Mustache

(function (Popcorn) {

  /**
   * Mustache Popcorn Plug-in
   *
   * Adds the ability to render JSON using templates via the Mustache templating library.
   *
   * @param {Object} options
   *
   * Required parameters: start, end, template, data, and target.
   * Optional parameter: static.
   *
   *   start: the time in seconds when the mustache template should be rendered
   *          in the target div.
   *
   *   end: the time in seconds when the rendered mustache template should be
   *        removed from the target div.
   *
   *   target: a String -- the target div's id.
   *
   *   template: the mustache template for the plugin to use when rendering.  This can be
   *             a String containing the template, or a Function that returns the template's
   *             String.
   *
   *   data: the data to be rendered using the mustache template.  This can be a JSON String,
   *         a JavaScript Object literal, or a Function returning a String or Literal.
   *
   *   dynamic: an optional argument indicating that the template and json data are dynamic
   *            and need to be loaded dynamically on every use.  Defaults to True.
   *
   * Example:
     var p = Popcorn('#video')

        // Example using template and JSON strings.
        .mustache({
          start: 5, // seconds
          end:  15,  // seconds
          target: 'mustache',
          template: '<h1>{{header}}</h1>'                         +
                    '{{#bug}}'                                    +
                    '{{/bug}}'                                    +
                    ''                                            +
                    '{{#items}}'                                  +
                    '  {{#first}}'                                +
                    '    <li><strong>{{name}}</strong></li>'      +
                    '  {{/first}}'                                +
                    '  {{#link}}'                                 +
                    '    <li><a href="{{url}}">{{name}}</a></li>' +
                    '  {{/link}}'                                 +
                    '{{/items}}'                                  +
                    ''                                            +
                    '{{#empty}}'                                  +
                    '  <p>The list is empty.</p>'                 +
                    '{{/empty}}'                                  ,

          data:     '{'                                                        +
                    '  "header": "Colors", '                                   +
                    '  "items": [ '                                            +
                    '      {"name": "red", "first": true, "url": "#Red"}, '    +
                    '      {"name": "green", "link": true, "url": "#Green"}, ' +
                    '      {"name": "blue", "link": true, "url": "#Blue"} '    +
                    '  ],'                                                     +
                    '  'empty': false'                                         +
                    '}',
          dynamic: false // The json is not going to change, load it early.
        } )

        // Example showing Functions instead of Strings.
        .mustache({
          start: 20,  // seconds
          end:   25,  // seconds
          target: 'mustache',
          template: function(instance, options) {
                      var template = // load your template file here...
                      return template;
                    },
          data:     function(instance, options) {
                      var json = // load your json here...
                      return json;
                    }
        } );
  *
  */

  Popcorn.plugin( 'mustache' , function( options ) {

    Popcorn.getScript('https://github.com/janl/mustache.js/raw/master/mustache.js');

    var getData, data, getTemplate, template;

    var shouldReload = !!options.dynamic,
        typeOfTemplate = typeof options.template,
        typeOfData = typeof options.data;

    if ( typeOfTemplate === 'function' ) {
      if ( !shouldReload ) {
        template = options.template( options );
      } else {
        getTemplate = options.template;
      }
    } else if ( typeOfTemplate === 'string' ) {
      template = options.template;
    } else {
      throw 'Mustache Plugin Error: options.template must be a String or a Function.';
    }

    if ( typeOfData === 'function' ) {
      if ( !shouldReload ) {
        data = options.data(options);
      } else {
        getData = options.data;
      }
    } else if ( typeOfData === 'string' ) {
      data = JSON.parse( options.data );
    } else if ( typeOfData === 'object' ) {
      data = options.data;
    } else {
      throw 'Mustache Plugin Error: options.data must be a String, Object, or Function.';
    }

    return {
      start: function( event, options ) {
        // if dynamic, freshen json data on every call to start, just in case.
        if ( getData ) {
          data = getData( options );
        }

        if ( getTemplate ) {
          template = getTemplate( options );
        }

        var html = Mustache.to_html( template,
                                     data
                                   ).replace( /^\s*/mg, '' );
        document.getElementById( options.target ).innerHTML = html;
      },

      end: function( event, options ) {
        document.getElementById( options.target ).innerHTML = '';
      }
    };
  },
  {
    about: {
      name: 'Popcorn Mustache Plugin',
      version: '0.1',
      author: 'David Humphrey (@humphd)',
      website: 'http://vocamus.net/dave'
    },
    options: {
      start: {elem:'input', type:'text', label:'In'},
      end: {elem:'input', type:'text', label:'Out'},
      target: 'mustache-container',
      template: {elem:'input', type:'text', label:'Template'},
      data: {elem:'input', type:'text', label:'Data'},
      /* TODO: how to show a checkbox/boolean? */
      dynamic: {elem:'input', type:'text', label:'Dynamic'}
    }
  });
})( Popcorn );
// PLUGIN: OPENMAP
var openmapCallback;
( function ( Popcorn ) {
  
  /**
   * openmap popcorn plug-in 
   * Adds an OpenLayers + OpenStreetMap map to the target div centered on the location specified by the user
   * Based on the googlemap popcorn plug-in. No StreetView support
   * Options parameter will need a start, end, target, type, zoom, lat and lng
   * -Start is the time that you want this plug-in to execute
   * -End is the time that you want this plug-in to stop executing 
   * -Target is the id of the DOM element that you want the map to appear in. This element must be in the DOM
   * -Type [optional] either: ROADMAP (OpenStreetMap), SATELLITE (NASA WorldWind / LandSat), or TERRAIN (USGS)
   * -Zoom [optional] defaults to 2
   * -Lat and Lng are the coordinates of the map if location is not named
   * -Location is a name of a place to center the map, geocoded to coordinates using TinyGeocoder.com
   * -Markers [optional] is an array of map marker objects, with the following properties:
   * --Icon is the URL of a map marker image
   * --Size [optional] is the radius in pixels of the scaled marker image (default is 14)
   * --Text [optional] is the HTML content of the map marker -- if your popcorn instance is named 'popped', use <script>popped.currentTime(10);</script> to control the video
   * --Lat and Lng are coordinates of the map marker if location is not specified
   * --Location is a name of a place for the map marker, geocoded to coordinates using TinyGeocoder.com
   *  Note: using location requires extra loading time, also not specifying both lat/lng and location will
   * cause a JavaScript error. 
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn( '#video' )
        .openmap({
          start: 5,
          end: 15,
          type: 'ROADMAP',
          target: 'map',
          lat: 43.665429,
          lng: -79.403323
        } )
   *
   */
  var newdiv,
      i = 1,
      _mapFired = false,
      _mapLoaded = false;

  Popcorn.plugin( "openmap" , function( options ){
    var newdiv,
        map,
        centerlonlat,
        projection,
        displayProjection,
        pointLayer,
        selectControl,
        popup;

    // insert openlayers api script once
    if ( !_mapFired ) {
      _mapFired = true;
      Popcorn.getScript('http://openlayers.org/api/OpenLayers.js',
      function() {
        _mapLoaded = true;
      } );
    }

    // create a new div within the target div
    // this is later passed on to the maps api
    newdiv               = document.createElement( 'div' );
    newdiv.id            = "actualmap" + i;
    newdiv.style.width   = "100%";
    newdiv.style.height  = "100%";
    i++;
    if ( document.getElementById( options.target ) ) {
      document.getElementById( options.target ).appendChild( newdiv );
    }
    // callback function fires when the script is run
    var isGeoReady = function() {
      if ( !_mapLoaded ) {
        setTimeout( function () {
          isGeoReady();
        }, 50);
      } else {
        if( options.location ){
          // set a dummy center at start
          location = new OpenLayers.LonLat( 0, 0 );
          // query TinyGeocoder and re-center in callback
          Popcorn.getJSONP(
            "http://tinygeocoder.com/create-api.php?q=" + options.location + "&callback=jsonp",
            function( latlng ) {
              centerlonlat = new OpenLayers.LonLat( latlng[1], latlng[0] );
              map.setCenter( centerlonlat );
            }
          );
        } else {
          centerlonlat = new OpenLayers.LonLat( options.lng, options.lat );
        }
        if( options.type == "ROADMAP" ) {
          // add OpenStreetMap layer
          projection = new OpenLayers.Projection( 'EPSG:900913' );
          displayProjection = new OpenLayers.Projection( 'EPSG:4326' );
          centerlonlat = centerlonlat.transform( displayProjection, projection );
          map = new OpenLayers.Map( { div: newdiv, projection: projection, "displayProjection": displayProjection } );
          var osm = new OpenLayers.Layer.OSM();
          map.addLayer( osm );
        }
        else if( options.type == "SATELLITE" ) {
          // add NASA WorldWind / LANDSAT map
          map = new OpenLayers.Map( { div: newdiv, "maxResolution": 0.28125, tileSize: new OpenLayers.Size( 512, 512 ) } );
          var worldwind = new OpenLayers.Layer.WorldWind( "LANDSAT", "http://worldwind25.arc.nasa.gov/tile/tile.aspx", 2.25, 4, { T: "105" } );
          map.addLayer( worldwind );
          displayProjection = new OpenLayers.Projection( "EPSG:4326" );
          projection = new OpenLayers.Projection( "EPSG:4326" );
        }
        else if( options.type == "TERRAIN" ) {
          // add terrain map ( USGS )
          displayProjection = new OpenLayers.Projection( "EPSG:4326" );
          projection = new OpenLayers.Projection( "EPSG:4326" );
          map = new OpenLayers.Map( {div: newdiv, projection: projection } );
          var relief = new OpenLayers.Layer.WMS( "USGS Terraserver", "http://terraserver-usa.org/ogcmap.ashx?", { layers: 'DRG' } ); 
          map.addLayer( relief );
        }
        map.div.style.display = "none";
      }
    };
    isGeoReady();

    return {
      /**
       * @member openmap 
       * The start function will be executed when the currentTime 
       * of the video  reaches the start time provided by the 
       * options variable
       */
      start: function( event, options ) {
        var isReady = function () {
          // wait until OpenLayers has been loaded, and the start function is run, before adding map
          if ( !map ) {
            setTimeout( function () {
              isReady();
            }, 13 );
          } else {
            map.div.style.display = "block";
            // make sure options.zoom is a number
            if ( options.zoom && typeof options.zoom !== "number" ) {
              options.zoom = +options.zoom;
            }
            // default zoom is 2
            options.zoom = options.zoom || 2;

            // reset the location and zoom just in case the user played with the map
            map.setCenter( centerlonlat, options.zoom );
            if( options.markers ){
              var layerStyle = OpenLayers.Util.extend( {} , OpenLayers.Feature.Vector.style[ 'default' ] );
              pointLayer = new OpenLayers.Layer.Vector( "Point Layer", { style: layerStyle } );
              map.addLayer( pointLayer );
              for( var m = 0; m < options.markers.length; m++ ) {
                var myMarker = options.markers[ m ];
                if( myMarker.text ){
                  if( !selectControl ){
                    selectControl = new OpenLayers.Control.SelectFeature( pointLayer );
                    map.addControl( selectControl );
                    selectControl.activate();
                    pointLayer.events.on( {
                      "featureselected": function( clickInfo ) {
                        clickedFeature = clickInfo.feature;
                        if( !clickedFeature.attributes.text ){
                          return;
                        }
                        popup = new OpenLayers.Popup.FramedCloud(
                          "featurePopup",
                          clickedFeature.geometry.getBounds().getCenterLonLat(),
                          new OpenLayers.Size( 120, 250 ),
                          clickedFeature.attributes.text,
                          null,
                          true,
                          function( closeInfo ) {
                            selectControl.unselect( this.feature );
                          }
                        );
                        clickedFeature.popup = popup;
                        popup.feature = clickedFeature;
                        map.addPopup( popup );
                      },
                      "featureunselected": function( clickInfo ) {
                        feature = clickInfo.feature;
                        if ( feature.popup ) {
                          popup.feature = null;
                          map.removePopup( feature.popup );
                          feature.popup.destroy();
                          feature.popup = null;
                        }
                      }
                    } );
                  }
                }
                if( myMarker.location ){
                  var geocodeThenPlotMarker = function( myMarker ){
                    Popcorn.getJSONP(
                      "http://tinygeocoder.com/create-api.php?q=" + myMarker.location + "&callback=jsonp",
                      function( latlng ){
                        var myPoint = new OpenLayers.Geometry.Point( latlng[1], latlng[0] ).transform( displayProjection, projection ),
                            myPointStyle = OpenLayers.Util.extend( {}, layerStyle );
                        if( !myMarker.size || isNaN( myMarker.size ) ) {
                          myMarker.size = 14;
                        }
                        myPointStyle.pointRadius = myMarker.size;
                        myPointStyle.graphicOpacity = 1;
                        myPointStyle.externalGraphic = myMarker.icon;
                        var myPointFeature = new OpenLayers.Feature.Vector( myPoint, null, myPointStyle );
                        if( myMarker.text ) {
                          myPointFeature.attributes = { 
                            text: myMarker.text
                          };
                        }
                        pointLayer.addFeatures( [ myPointFeature ] );
                      }
                    );
                  };
                  geocodeThenPlotMarker(myMarker);
                } else {
                  var myPoint = new OpenLayers.Geometry.Point( myMarker.lng, myMarker.lat ).transform( displayProjection, projection ),
                      myPointStyle = OpenLayers.Util.extend( {}, layerStyle );
                  if( !myMarker.size || isNaN( myMarker.size ) ) {
                    myMarker.size = 14;
                  }
                  myPointStyle.pointRadius = myMarker.size;
                  myPointStyle.graphicOpacity = 1;
                  myPointStyle.externalGraphic = myMarker.icon;
                  var myPointFeature = new OpenLayers.Feature.Vector( myPoint, null, myPointStyle );
                  if( myMarker.text ) {
                    myPointFeature.attributes = { 
                      text: myMarker.text
                    };
                  }
                  pointLayer.addFeatures( [ myPointFeature ] );
                }
              }
            }
          }
        };
        
        isReady();
      },
      /**
       * @member openmap
       * The end function will be executed when the currentTime 
       * of the video reaches the end time provided by the 
       * options variable
       */
      end: function( event, options ) {
        // if the map exists hide it do not delete the map just in 
        // case the user seeks back to time b/w start and end
        if ( map ) {
          map.div.style.display = 'none';          
        }
      }

    };
  },
  {
    about:{
      name: "Popcorn OpenMap Plugin",
      version: "0.3",
      author: "@mapmeld",
      website: "mapadelsur.blogspot.com"
    },
    options:{
      start    : { elem: 'input', type: 'text', label: 'In'},
      end      : { elem: 'input', type: 'text', label: 'Out'},
      target   : 'map-container',
      type     : { elem: 'select', options:[ 'ROADMAP', 'SATELLITE', 'TERRAIN' ], label: 'Type' },
      zoom     : { elem: 'input', type: 'text', label: 'Zoom'},
      lat      : { elem: 'input', type: 'text', label: 'Lat'},
      lng      : { elem: 'input', type: 'text', label: 'Lng'},
      location : { elem: 'input', type: 'text', label: 'Location'},
      markers  : { elem: 'input', type: 'text', label: 'List Markers'}
    }
  } );
} ) ( Popcorn );
// PLUGIN: Subtitle

(function (Popcorn) {

  var scriptLoaded = false,
      callBack     = function( data ) {

        if ( typeof google !== 'undefined' && google.load ) {

          google.load("language", "1", {callback: function() {scriptLoaded = true;}});
        } else {

          setTimeout( function() {

            callBack( data );
          }, 1);
        }
      };

  Popcorn.getScript( "http://www.google.com/jsapi", callBack );

  /**
   * Subtitle popcorn plug-in 
   * Displays a subtitle over the video, or in the target div
   * Options parameter will need a start, and end.
   * Optional parameters are target and text.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing
   * Target is the id of the document element that the content is
   *  appended to, this target element must exist on the DOM
   * Text is the text of the subtitle you want to display.
   *
   * Language is the expected language the subtitle text is in
   * Languagesrc is the target id of the element that contains 
   *  the language value ("en", "fr", etc.) to translate the text into
   *  example:
   *  <select id="language">
   *    <option value="zh" selected="selected">Chinese</option>
   *    <option value="en">English</option>
   *    <option value="fr">French</option>
   *    <option value="de">German</option>
   *    <option value="it">Italian</option>
   *    <option value="ja">Japanese</option>
   *    <option value="ko">Korean</option>
   *    <option value="fa">Persian</option>
   *    <option value="pl">Polish</option>
   *    <option value="pt">Portuguese</option>
   *    <option value="es">Spanish</option>
   *  </select>
   * Accessibilitysrc is the target id of a checkbox element
   *  checked means show all subtitles regardless of language and languagesrc
   *  not checked means only translate if language and languagesrc are different
   *  if no accessibilitysrc exists, default is to display all subtitles regardless
   * 
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .footnote({
          start:            5,                 // seconds, mandatory
          end:              15,                // seconds, mandatory
          text:             'Hellow world',    // optional
          target:           'subtitlediv',     // optional
          language:         'en',              // optional
          languagesrc:      'language',        // optional
          accessibilitysrc: 'accessibility'    // optional
        } )
   *
   */

  // translates whatever is in options.container into selected language
  var translate = function( options, text ) {

    options.selectedLanguage = options.languageSrc.options[ options.languageSrc.selectedIndex ].value;

    google.language.translate( text, '', options.selectedLanguage, function( result ) {

      options.container.innerHTML = result.translation;

    } );
  };

  Popcorn.plugin( "subtitle" , {
    
      manifest: {
        about:{
          name: "Popcorn Subtitle Plugin",
          version: "0.1",
          author:  "Scott Downe",
          website: "http://scottdowne.wordpress.com/"
        },
        options:{
          start    : {elem:'input', type:'text', label:'In'},
          end      : {elem:'input', type:'text', label:'Out'},
          target  :  'Subtitle-container',
          text     : {elem:'input', type:'text', label:'Text'}
        }
      },

      _setup: function( options ) {

        // Creates a div for all subtitles to use
        if ( !this.container ) {
          this.container = document.createElement('div');
          this.container.id = "subtitlediv";
          this.container.style.position   = "absolute";
          this.container.style.color      = "white";
          this.container.style.textShadow = "black 2px 2px 6px";
          this.container.style.fontSize   = "18px";
          this.container.style.fontWeight = "bold";
          this.container.style.textAlign  = "center";

          // the video element must have height and width defined
          this.container.style.width      = this.media.offsetWidth + "px";
          this.container.style.top        = this.position().top + this.media.offsetHeight - 65 + "px";
          this.container.style.left       = this.position().left + "px";

          document.body.appendChild( this.container );
        }

        // if a target is specified, use that
        if ( options.target && options.target !== 'Subtitle-container' ) {
          options.container = document.getElementById( options.target );
        } else { // use shared default container
          options.container = this.container;
        }

        var accessibility = document.getElementById( options.accessibilitysrc ),
            that = this;

        options.showSubtitle = function() {
          options.container.innerHTML = options.text;
        };
        options.toggleSubtitles = function() {};
        options.that = this;
        
        var readyCheck = setInterval(function() {
          if ( !scriptLoaded ) {
            return;
          }
          clearInterval(readyCheck);

          if ( options.languagesrc ) {
            options.showSubtitle = translate;
            options.languageSrc = document.getElementById( options.languagesrc );
            options.selectedLanguage = options.languageSrc.options[ options.languageSrc.selectedIndex ].value;

            if ( !this.languageSources ) {
              this.languageSources = {};
            }

            if ( !this.languageSources[ options.languagesrc ] ) {
              this.languageSources[ options.languagesrc ] = {};
            
            }

            if ( !this.languageSources[ options.languagesrc ][ options.target ] ) {
              this.languageSources[ options.languagesrc ][ options.target ] = true;

              options.languageSrc.addEventListener( "change", function() {

                options.toggleSubtitles();
                options.showSubtitle( options, options.container.innerHTML );

              }, false );

            }

          }
          if ( accessibility ) {
            options.accessibility = accessibility;

            options.toggleSubtitles = function() {
              options.selectedLanguage = options.languageSrc.options[ options.languageSrc.selectedIndex ].value;
              if ( options.accessibility.checked || options.selectedLanguage !== ( options.language || "") ) {
                options.display = "inline";
                options.container.style.display = options.display;
              } else if ( options.selectedLanguage === ( options.language || "") ) {
                options.display = "none";
                options.container.style.display = options.display;
              }

            };

            options.accessibility.addEventListener( "change", options.toggleSubtitles, false );

            // initiate it once to set starting state
            options.toggleSubtitles();
          }
        }, 5);






      },
      /**
       * @member subtitle 
       * The start function will be executed when the currentTime 
       * of the video  reaches the start time provided by the 
       * options variable
       */
      start: function(event, options){
        options.container.style.display = options.display;
        options.showSubtitle( options, options.text );
      },
      /**
       * @member subtitle 
       * The end function will be executed when the currentTime 
       * of the video  reaches the end time provided by the 
       * options variable
       */
      end: function(event, options){
        options.container.style.display = options.display;
        options.container.innerHTML = "";
      }
   
  } );

})( Popcorn );
// PLUGIN: tagthisperson

(function (Popcorn) {
  
  /**
   * tagthisperson popcorn plug-in 
   * Adds people's names to an element on the page.
   * Options parameter will need a start, end, target, image and person.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing 
   * Person is the name of the person who you want to tag
   * Image is the url to the image of the person - optional
   * href is the url to the webpage of the person - optional   
   * Target is the id of the document element that the text needs to be 
   * attached to, this target element must exist on the DOM
   * 
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .tagthisperson({
          start: 5, // seconds
          end: 15, // seconds
          person: '@annasob',
          image:  'http://newshour.s3.amazonaws.com/photos%2Fspeeches%2Fguests%2FRichardNSmith_thumbnail.jpg',
          href:   'http://annasob.wordpress.com',
          target: 'tagdiv'
        } )
   *
   */
  Popcorn.plugin( "tagthisperson" , ( function() {
    
    var peopleArray = [];
    // one People object per options.target
    var People = function() {
      this.name = "";
      this.contains = { };
      this.toString = function() {
        var r = [];
        for ( var j in this.contains ) {
          if ( this.contains.hasOwnProperty( j ) ) {
            r.push( " " + this.contains[ j ] );
          }
        }
        return r.toString();
      };
    };
    
    return {
      manifest: {
        about:{
          name: "Popcorn tagthisperson Plugin",
          version: "0.1",
          author: "@annasob",
          website: "annasob.wordpress.com"
        },
        options:{
          start    : {elem:'input', type:'text', label:'In'},
          end      : {elem:'input', type:'text', label:'Out'},
          target   : 'tag-container',
          person   : {elem:'input', type:'text', label:'Name'},
          image    : {elem:'input', type:'text', label:'Image Src'},
          href     : {elem:'input', type:'text', label:'URL'}   
        }
      },
      _setup: function( options ) {
        var exists = false;
        // loop through the existing objects to ensure no duplicates
        // the idea here is to have one object per unique options.target
        for ( var i = 0; i < peopleArray.length; i++ ) {
          if ( peopleArray[ i ].name === options.target ) {
            options._p = peopleArray[ i ];  
            exists = true;
            break;
          }
        }
        if ( !exists ) {
          options._p = new People();
          options._p.name = options.target;
          peopleArray.push( options._p );
        }
      },
      /**
       * @member tagthisperson 
       * The start function will be executed when the currentTime 
       * of the video  reaches the start time provided by the 
       * options variable
       */
      start: function( event, options ){
        options._p.contains[ options.person ] = ( options.image ) ? "<img src='" + options.image + "'/> " : "" ;
        options._p.contains[ options.person ] += ( options.href ) ? "<a href='" + options.href + "' target='_blank'> " + options.person + "</a>" : options.person ;

        if ( document.getElementById( options.target ) ) {
          document.getElementById( options.target ).innerHTML = options._p.toString();
        }
      },
      /**
       * @member tagthisperson 
       * The end function will be executed when the currentTime 
       * of the video  reaches the end time provided by the 
       * options variable
       */
      end: function( event, options ){
        delete options._p.contains[ options.person ];
        if ( document.getElementById( options.target ) ) {
          document.getElementById( options.target ).innerHTML = options._p.toString();
        }
      }
   };
  })());

})( Popcorn );
// PLUGIN: TWITTER

(function (Popcorn) {
  var scriptLoading = false;

  /**
   * Twitter popcorn plug-in 
   * Appends a Twitter widget to an element on the page.
   * Options parameter will need a start, end, target and source.
   * Optional parameters are height and width.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing
   * Src is the hash tag or twitter user to get tweets from
   * Target is the id of the document element that the images are
   *  appended to, this target element must exist on the DOM
   * Height is the height of the widget, defaults to 200
   * Width is the width of the widget, defaults to 250
   * 
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .twitter({
          start:          5,                // seconds, mandatory
          end:            15,               // seconds, mandatory
          src:            '@stevesong',     // mandatory, also accepts hash tags
          height:         200,              // optional
          width:          250,              // optional
          target:         'twitterdiv'      // mandatory
        } )
   *
   */

  Popcorn.plugin( "twitter" , {

      manifest: {
        about:{
          name:    "Popcorn Twitter Plugin",
          version: "0.1",
          author:  "Scott Downe",
          website: "http://scottdowne.wordpress.com/"
        },
        options:{
          start   : {elem:'input', type:'number', label:'In'},
          end     : {elem:'input', type:'number', label:'Out'},
          src     : {elem:'input', type:'text',   label:'Source'},
          target  : 'Twitter-container',
          height  : {elem:'input', type:'number', label:'Height'},
          width   : {elem:'input', type:'number', label:'Width'}
        }
      },

      _setup: function( options ) {

        if ( !window.TWTR && !scriptLoading ) {
          scriptLoading = true;
          Popcorn.getScript("http://widgets.twimg.com/j/2/widget.js");
        }

        // setup widget div that is unique per track
        options.container = document.createElement( 'div' ); // create the div to store the widget
        options.container.setAttribute('id', Popcorn.guid()); // use this id to connect it to the widget
        options.container.style.display = "none"; // display none by default
        if ( document.getElementById( options.target ) ) {
          document.getElementById( options.target ).appendChild( options.container ); // add the widget's div to the target div
        }
        // setup info for the widget
        var src     = options.src || "",
            width   = options.width || 250,
            height  = options.height || 200,
            profile = /^@/.test( src ),
            hash    = /^#/.test( src ),
            widgetOptions = {
              version: 2,
              id: options.container.getAttribute( 'id' ),  // use this id to connect it to the div
              rpp: 30,
              width: width,
              height: height,
              interval: 6000,
              theme: {
                shell: {
                  background: '#ffffff',
                  color: '#000000'
                },
                tweets: {
                  background: '#ffffff',
                  color: '#444444',
                  links: '#1985b5'
                }
              },
              features: {
                loop: true,
                timestamp: true,
                avatars: true,
                hashtags: true,
                toptweets: true,
                live: true,
                scrollbar: false,
                behavior: 'default'
              }
            };

        // create widget
        var isReady = function( that ) {
          if ( window.TWTR ) {
            if ( profile ) {

              widgetOptions.type = "profile";

              new TWTR.Widget( widgetOptions ).render().setUser( src ).start();

            } else if ( hash ) {

              widgetOptions.type = "search";
              widgetOptions.search = src;
              widgetOptions.subject = src;

              new TWTR.Widget( widgetOptions ).render().start();

            }
          } else {
            setTimeout( function() {
              isReady( that );
            }, 1);
          }
        };

        isReady( this );
      },

      /**
       * @member Twitter 
       * The start function will be executed when the currentTime 
       * of the video  reaches the start time provided by the 
       * options variable
       */
      start: function( event, options ) {
        options.container.style.display = "inline";
      },

      /**
       * @member Twitter 
       * The end function will be executed when the currentTime 
       * of the video  reaches the end time provided by the 
       * options variable
       */
      end: function( event, options ) {
        options.container.style.display = "none";
      }
    });

})( Popcorn );
// PLUGIN: WEBPAGE

(function (Popcorn) {
  
  /**
   * Webpages popcorn plug-in 
   * Creates an iframe showing a website specified by the user
   * Options parameter will need a start, end, id, target and src.
   * Start is the time that you want this plug-in to execute
   * End is the time that you want this plug-in to stop executing 
   * Id is the id that you want assigned to the iframe
   * Target is the id of the document element that the iframe needs to be attached to, 
   * this target element must exist on the DOM
   * Src is the url of the website that you want the iframe to display
   *
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .webpage({
          id: "webpages-a", 
          start: 5, // seconds
          end: 15, // seconds
          src: 'http://www.webmademovies.org',
          target: 'webpagediv'
        } )
   *
   */
  Popcorn.plugin( "webpage" , {
    manifest: {
      about:{
        name: "Popcorn Webpage Plugin",
        version: "0.1",
        author: "@annasob",
        website: "annasob.wordpress.com"
      },
      options:{
        id     : {elem:'input', type:'text', label:'Id'},
        start  : {elem:'input', type:'text', label:'In'},
        end    : {elem:'input', type:'text', label:'Out'},
        src    : {elem:'input', type:'text', label:'Src'},
        target : 'iframe-container'
      }
    },
    _setup : function( options ) {
      // make an iframe 
      options._iframe  = document.createElement( 'iframe' );
      options._iframe.setAttribute('width', "100%");
      options._iframe.setAttribute('height', "100%");
      options._iframe.id  = options.id;
      options._iframe.src = options.src;
      options._iframe.style.display = 'none';
      // add the hidden iframe to the DOM
      if ( document.getElementById( options.target ) ) {
        document.getElementById( options.target ).appendChild(options._iframe);
      }
      
    },
    /**
     * @member webpage 
     * The start function will be executed when the currentTime 
     * of the video  reaches the start time provided by the 
     * options variable
     */
    start: function(event, options){
      // make the iframe visible
      options._iframe.src = options.src;
      options._iframe.style.display = 'inline';
    },
    /**
     * @member webpage 
     * The end function will be executed when the currentTime 
     * of the video  reaches the end time provided by the 
     * options variable
     */
    end: function(event, options){
      // make the iframe invisible
      options._iframe.style.display = 'none';
    }
    
  });
})( Popcorn );
// PLUGIN: WIKIPEDIA


var wikiCallback;

(function (Popcorn) {
  
  /**
   * Wikipedia popcorn plug-in 
   * Displays a wikipedia aricle in the target specified by the user by using
   * new DOM element instead overwriting them
   * Options parameter will need a start, end, target, lang, src, title and numberofwords.
   * -Start is the time that you want this plug-in to execute
   * -End is the time that you want this plug-in to stop executing 
   * -Target is the id of the document element that the text from the article needs to be  
   * attached to, this target element must exist on the DOM
   * -Lang (optional, defaults to english) is the language in which the article is in.
   * -Src is the url of the article 
   * -Title (optional) is the title of the article
   * -numberofwords (optional, defaults to 200) is  the number of words you want displaid.  
   *
   * @param {Object} options
   * 
   * Example:
     var p = Popcorn('#video')
        .wikipedia({
          start: 5, // seconds
          end: 15, // seconds
          src: 'http://en.wikipedia.org/wiki/Cape_Town',
          target: 'wikidiv'
        } )
   *
   */
  Popcorn.plugin( "wikipedia" , {
      
    manifest: {
      about:{
        name: "Popcorn Wikipedia Plugin",
        version: "0.1",
        author: "@annasob",
        website: "annasob.wordpress.com"
      },
      options:{
        start         : {elem:'input', type:'text', label:'In'},
        end           : {elem:'input', type:'text', label:'Out'},
        lang          : {elem:'input', type:'text', label:'Language'},
        src           : {elem:'input', type:'text', label:'Src'},
        title         : {elem:'input', type:'text', label:'Title'},
        numberofwords : {elem:'input', type:'text', label:'Num Of Words'},
        target        : 'wiki-container'
      }
    },
    /**
     * @member wikipedia 
     * The setup function will get all of the needed 
     * items in place before the start function is called. 
     * This includes getting data from wikipedia, if the data
     * is not received and processed before start is called start 
     * will not do anything
     */
    _setup : function( options ) {
      // declare needed variables
      // get a guid to use for the global wikicallback function
      var  _text, _guid = Popcorn.guid(); 
      
      // if the user didn't specify a language default to english
      if (typeof options.lang === 'undefined') { options.lang ="en"; }
      // if the user didn't specify number of words to use default to 200 
      options.numberofwords  = options.numberofwords || 200;
            
      // wiki global callback function with a unique id
      // function gets the needed information from wikipedia
      // and stores it by appending values to the options object
      window["wikiCallback"+ _guid]  = function ( data ) { 
        options._link = document.createElement( 'a' );
        options._link.setAttribute( 'href', options.src );
        options._link.setAttribute( 'target', '_blank' );
        // add the title of the article to the link
        options._link.innerHTML = options.title || data.parse.displaytitle;
        // get the content of the wiki article
        options._desc = document.createElement( 'p' );
        // get the article text and remove any special characters
        _text = data.parse.text[ "*" ].substr( data.parse.text[ "*" ].indexOf('<p>') );
        _text = _text.replace(/((<(.|\n)+?>)|(\((.*?)\) )|(\[(.*?)\]))/g, "");
        options._desc.innerHTML = _text.substr( 0,  options.numberofwords ) + " ...";
        
        options._fired = true;
      };
      
      if ( options.src ) {
        Popcorn.getScript("http://" + options.lang + ".wikipedia.org/w/api.php?action=parse&props=text&page=" + options.src.slice( options.src.lastIndexOf("/")+1)  + "&format=json&callback=wikiCallback" + _guid);
      } else {
        throw ("Wikipedia plugin needs a 'src'");
      }

    },
    /**
     * @member wikipedia 
     * The start function will be executed when the currentTime 
     * of the video  reaches the start time provided by the 
     * options variable
     */
    start: function( event, options ){
      // dont do anything if the information didn't come back from wiki
      var isReady = function () {
        
        if ( !options._fired ) {
          setTimeout( function () {
            isReady();
          }, 13);
        } else {
      
          if ( options._link && options._desc ) {
            if ( document.getElementById( options.target ) ) {
              document.getElementById( options.target ).appendChild( options._link );
              document.getElementById( options.target ).appendChild( options._desc );
              options._added = true;
            }
          }
        }
      };
      
      isReady();
    },
    /**
     * @member wikipedia 
     * The end function will be executed when the currentTime 
     * of the video  reaches the end time provided by the 
     * options variable
     */
    end: function( event, options ){
      // ensure that the data was actually added to the 
      // DOM before removal
      if ( options._added ) {
        document.getElementById( options.target ).removeChild( options._link );
        document.getElementById( options.target ).removeChild( options._desc );
      }
    }
     
  });

})( Popcorn );
// PARSER: 0.3 JSON

(function (Popcorn) {
  Popcorn.parser( "parseJSON", "JSON", function( data ) {

    // declare needed variables
    var retObj = {
          title: "",
          remote: "",
          data: []
        },
        manifestData = {}, 
        dataObj = data;
    
    
    /*
      TODO: add support for filling in source children of the video element
      
      
      remote: [
        { 
          src: "whatever.mp4", 
          type: 'video/mp4; codecs="avc1, mp4a"'
        }, 
        { 
          src: "whatever.ogv", 
          type: 'video/ogg; codecs="theora, vorbis"'
        }
      ]

    */
    
        
    Popcorn.forEach( dataObj.data, function ( obj, key ) {
      retObj.data.push( obj );
    });

    return retObj;
  });

})( Popcorn );
// PARSER: 0.1 SBV

(function (Popcorn) {

  /**
   * SBV popcorn parser plug-in 
   * Parses subtitle files in the SBV format.
   * Times are expected in H:MM:SS.MIL format, with hours optional
   * Subtitles which don't match expected format are ignored
   * Data parameter is given by Popcorn, will need a text.
   * Text is the file contents to be parsed
   * 
   * @param {Object} data
   * 
   * Example:
    0:00:02.400,0:00:07.200
    Senator, we're making our final approach into Coruscant.
   */
  Popcorn.parser( "parseSBV", function( data ) {
  
    // declare needed variables
    var retObj = {
          title: "",
          remote: "",
          data: []
        },
        subs = [],
        lines,
        i = 0,
        len = 0,
        idx = 0;
    
    // [H:]MM:SS.MIL string to SS.MIL
    // Will thrown exception on bad time format
    var toSeconds = function( t_in ) {
      var t = t_in.split( ":" ),
          l = t.length-1,
          time;
      
      try {
        time = parseInt( t[l-1], 10 )*60 + parseFloat( t[l], 10 );
        
        // Hours optionally given
        if ( l === 2 ) { 
          time += parseInt( t[0], 10 )*3600;
        }
      } catch ( e ) {
        throw "Bad cue";
      }
      
      return time;
    };
    
    var createTrack = function( name, attributes ) {
      var track = {};
      track[name] = attributes;
      return track;
    };
  
    // Here is where the magic happens
    // Split on line breaks
    lines = data.text.split( /(?:\r\n|\r|\n)/gm );
    len = lines.length;
    
    while ( i < len ) {
      var sub = {},
          text = [],
          time = lines[i++].split( "," );
      
      try {
        sub.start = toSeconds( time[0] );
        sub.end = toSeconds( time[1] );
        
        // Gather all lines of text
        while ( i < len && lines[i] ) {
          text.push( lines[i++] );
        }
        
        // Join line breaks in text
        sub.text = text.join( "<br />" );
        subs.push( createTrack( "subtitle", sub ) );
      } catch ( e ) {
        // Bad cue, advance to end of cue
        while ( i < len && lines[i] ) {
          i++;
        }
      }
      
      // Consume empty whitespace
      while ( i < len && !lines[i] ) {
        i++;
      }
    }
    
    retObj.data = subs;

    return retObj;
  });

})( Popcorn );
// PARSER: 0.3 SRT

(function (Popcorn) {
  /**
   * SRT popcorn parser plug-in 
   * Parses subtitle files in the SRT format.
   * Times are expected in HH:MM:SS,MIL format, though HH:MM:SS.MIL also supported
   * Ignore styling, which may occur after the end time or in-text
   * While not part of the "official" spec, majority of players support HTML and SSA styling tags
   * SSA-style tags are stripped, HTML style tags are left for the browser to handle:
   *    HTML: <font>, <b>, <i>, <u>, <s>
   *    SSA:  \N or \n, {\cmdArg1}, {\cmd(arg1, arg2, ...)}
   
   * Data parameter is given by Popcorn, will need a text.
   * Text is the file contents to be parsed
   * 
   * @param {Object} data
   * 
   * Example:
    1
    00:00:25,712 --> 00:00:30.399
    This text is <font color="red">RED</font> and has not been {\pos(142,120)} positioned.
    This takes \Nup three \nentire lines.
    This contains nested <b>bold, <i>italic, <u>underline</u> and <s>strike-through</s></u></i></b> HTML tags
    Unclosed but <b>supported tags are left in
    <ggg>Unsupported</ggg> HTML tags are left in, even if <hhh>not closed.
    SSA tags with {\i1} would open and close italicize {\i0}, but are stripped
    Multiple {\pos(142,120)\b1}SSA tags are stripped
   */
  Popcorn.parser( "parseSRT", function( data ) {

    // declare needed variables
    var retObj = {
          title: "",
          remote: "",
          data: []
        },
        subs = [],
        i = 0,
        len = 0,
        idx = 0,
        lines,
        time,
        text,
        sub;
    
    // Simple function to convert HH:MM:SS,MMM or HH:MM:SS.MMM to SS.MMM
    // Assume valid, returns 0 on error
    var toSeconds = function( t_in ) {
      var t = t_in.split( ':' );
      
      try {
        var s = t[2].split( ',' );
        
        // Just in case a . is decimal seperator
        if ( s.length === 1 ) {
          s = t[2].split( '.' );
        }
        
        return parseFloat( t[0], 10 )*3600 + parseFloat( t[1], 10 )*60 + parseFloat( s[0], 10 ) + parseFloat( s[1], 10 )/1000;
      } catch ( e ) {
        return 0;
      }
    };
    
    var createTrack = function( name, attributes ) {
      var track = {};
      track[name] = attributes;
      return track;
    };
  
    // Here is where the magic happens
    // Split on line breaks
    lines = data.text.split( /(?:\r\n|\r|\n)/gm );
    len = lines.length;
    
    for( i=0; i < len; i++ ) {
      sub = {};
      text = [];
      
      sub.id = parseInt( lines[i++], 10 );
      
      // Split on '-->' delimiter, trimming spaces as well
      time = lines[i++].split( /[\t ]*-->[\t ]*/ );
      
      sub.start = toSeconds( time[0] );
      
      // So as to trim positioning information from end
      idx = time[1].indexOf( " " );
      if ( idx !== -1) {
        time[1] = time[1].substr( 0, idx );
      }
      sub.end = toSeconds( time[1] );
      
      // Build single line of text from multi-line subtitle in file
      while ( i < len && lines[i] ) {
        text.push( lines[i++] );
      }
      
      // Join into 1 line, SSA-style linebreaks
      // Strip out other SSA-style tags
      sub.text = text.join( "\\N" ).replace( /\{(\\[\w]+\(?([\w\d]+,?)+\)?)+\}/gi, "" );
      
      // Escape HTML entities
      sub.text = sub.text.replace( /</g, "&lt;" ).replace( />/g, "&gt;" );
      
      // Unescape great than and less than when it makes a valid html tag of a supported style (font, b, u, s, i)
      // Modified version of regex from Phil Haack's blog: http://haacked.com/archive/2004/10/25/usingregularexpressionstomatchhtml.aspx
      // Later modified by kev: http://kevin.deldycke.com/2007/03/ultimate-regular-expression-for-html-tag-parsing-with-php/
      sub.text = sub.text.replace( /&lt;(\/?(font|b|u|i|s))((\s+(\w|\w[\w\-]*\w)(\s*=\s*(?:\".*?\"|'.*?'|[^'\">\s]+))?)+\s*|\s*)(\/?)&gt;/gi, "<$1$3$7>" );
      sub.text = sub.text.replace( /\\N/gi, "<br />" );
      subs.push( createTrack( "subtitle", sub ) );
    }
    
    retObj.data = subs;
    return retObj;
  });

})( Popcorn );
// PARSER: 0.3 SSA/ASS

(function (Popcorn) {
  /**
   * SSA/ASS popcorn parser plug-in 
   * Parses subtitle files in the identical SSA and ASS formats.
   * Style information is ignored, and may be found in these
   * formats: (\N    \n    {\pos(400,570)}     {\kf89})
   * Out of the [Script Info], [V4 Styles], [Events], [Pictures],
   * and [Fonts] sections, only [Events] is processed.
   * Data parameter is given by Popcorn, will need a text.
   * Text is the file contents to be parsed
   * 
   * @param {Object} data
   * 
   * Example:
     [Script Info]
      Title: Testing subtitles for the SSA Format
      [V4 Styles]
      Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, AlphaLevel, Encoding
      Style: Default,Arial,20,65535,65535,65535,-2147483640,-1,0,1,3,0,2,30,30,30,0,0
      [Events]
      Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
      Dialogue: 0,0:00:02.40,0:00:07.20,Default,,0000,0000,0000,,Senator, {\kf89}we're \Nmaking our final \napproach into Coruscant.
      Dialogue: 0,0:00:09.71,0:00:13.39,Default,,0000,0000,0000,,{\pos(400,570)}Very good, Lieutenant.
      Dialogue: 0,0:00:15.04,0:00:18.04,Default,,0000,0000,0000,,It's \Na \ntrap!
   *
   */
  
  // Register for SSA extensions
  Popcorn.parser( "parseSSA", function( data ) {
  
    // declare needed variables
    var retObj = {
          title: "",
          remote: "",
          data: []
        },
        subs = [],
        startIdx,
        endIdx,
        textIdx,
        lines,
        fields,
        numFields,
        sub,
        text,
        i = 0,
        j = 0,
        len = 0,
        fieldLen = 0;
    
    // h:mm:ss.cc (centisec) string to SS.mmm
    // Returns -1 if invalid
    var toSeconds = function( t_in ) {
      var t = t_in.split( ":" ),
          l = t.length - 1;
      
      // Not all there
      if ( t_in.length !== 10 ) {
        return -1;
      }
      
      return parseInt( t[0], 10 )*3600 + parseInt( t[l-1], 10 )*60 + parseFloat( t[l], 10 );
    };
    
    var createTrack = function( name, attributes ) {
      var track = {};
      track[name] = attributes;
      return track;
    };
  
    // Here is where the magic happens
    // Split on line breaks
    lines = data.text.split( /(?:\r\n|\r|\n)/gm );
    len = lines.length;
    
    // Ignore non-textual info
    while ( i < len && lines[i] !== "[Events]" ) {
      i++;
    }
    
    fields = lines[++i].substr( 8 ).split( ", " ); // Trim 'Format: ' off front, split on delim
    numFields = fields.length;
    
    //Find where in Dialogue string the start, end and text info is
    for ( ; j < numFields; j++ ) {
      if ( fields[j] === "Start" ) {
        startIdx = j;
      } else if ( fields[j] === "End" ) {
        endIdx = j;
      } else if ( fields[j] === "Text" ) {
        textIdx = j;
      }
    }
    
    while ( ++i < len && lines[i] && lines[i][0] !== "[" ) {
      sub = {};
      
      // Trim beginning 'Dialogue: ' and split on delim
      fields = lines[i].substr( 10 ).split( "," );
      
      sub.start = toSeconds( fields[startIdx] );
      sub.end = toSeconds( fields[endIdx] );
      
      // Invalid time, skip
      if ( sub.start === -1 || sub.end === -1 ) {
        continue;
      }
      
      if ( ( fieldLen = fields.length ) === numFields ) {
        sub.text = fields[textIdx];
      } else {
        // There were commas in the text which were split, append back together into one line
        text = [];
        
        for( j = textIdx; j < fieldLen; j++ ) {
          text.push( fields[j] );
        }
        sub.text = text.join( "," );
      }
      
      // Eliminate advanced styles and convert forced line breaks
      sub.text = sub.text.replace( /\{(\\[\w]+\(?([\w\d]+,?)+\)?)+\}/gi, "" ).replace( /\\N/gi, "<br />" );
      subs.push( createTrack( "subtitle", sub ) );
    }
    
    retObj.data = subs;
    return retObj;
  });

})( Popcorn );
// PARSER: 0.3 TTML

(function (Popcorn) {

  /**
   * TTML popcorn parser plug-in 
   * Parses subtitle files in the TTML format.
   * Times may be absolute to the timeline or relative
   *   Absolute times are ISO 8601 format (hh:mm:ss[.mmm])
   *   Relative times are a fraction followed by a unit metric (d.ddu)
   *     Relative times are relative to the time given on the parent node
   * Styling information is ignored
   * Data parameter is given by Popcorn, will need an xml.
   * Xml is the file contents to be processed
   * 
   * @param {Object} data
   * 
   * Example:
    <tt xmlns:tts="http://www.w3.org/2006/04/ttaf1#styling" xmlns="http://www.w3.org/2006/04/ttaf1">
      <body region="subtitleArea">
        <div>
          <p xml:id="subtitle1" begin="0.76s" end="3.45s">
            It seems a paradox, does it not,
          </p>
        </div>
      </body>
    </tt>
   */
  Popcorn.parser( "parseTTML", function( data ) {

    // declare needed variables
    var returnData = {
          title: "",
          remote: "",
          data: []
        },
        node,
        numTracks = 0,
        region;
    
    // Convert time expression to SS.mmm
    // Expression may be absolute to timeline (hh:mm:ss.ms)
    //   or relative ( fraction followedd by metric ) ex: 3.4s, 5.7m
    // Returns -1 if invalid    
    var toSeconds = function ( t_in, offset ) {
      if ( !t_in ) {
        return -1;
      }
      
      var t = t_in.split( ":" ),
          l = t.length - 1,
          metric,
          multiplier,
          i;
          
      // Try clock time
      if ( l >= 2 ) {
        return parseInt( t[0], 10 )*3600 + parseInt( t[l-1], 10 )*60 + parseFloat( t[l], 10 );
      }
      
      // Was not clock time, assume relative time
      // Take metric from end of string (may not be single character)
      // First find metric
      for( i = t_in.length - 1; i >= 0; i-- ) {
        if ( t_in[i] <= "9" && t_in[i] >= "0" ) {
          break;
        }
      }
      
      // Point i at metric and normalize offsete time
      i++;
      metric = t_in.substr( i );
      offset = offset || 0;
      
      // Determine multiplier for metric relative to seconds
      if ( metric === "h" ) {
        multiplier = 3600;
      } else if ( metric === "m" ) {
        multiplier = 60;
      } else if ( metric === "s" ) {
        multiplier = 1;
      } else if ( metric === "ms" ) {
        multiplier = 0.001;
      } else {
        return -1;
      }
      
      // Valid multiplier
      return parseFloat( t_in.substr( 0, i ) ) * multiplier + offset;
    };

    // creates an object of all atrributes keyd by name
    var createTrack = function( name, attributes ) {
      var track = {};
      track[name] = attributes;
      return track;
    };
    
    // Parse a node for text content
    var parseNode = function( node, timeOffset ) {
      var sub = {};
      
      // Trim left and right whitespace from text and change non-explicit line breaks to spaces
      sub.text = node.textContent.replace(/^[\s]+|[\s]+$/gm, "").replace(/(?:\r\n|\r|\n)/gm, "<br />");
      sub.id = node.getAttribute( "xml:id" );
      sub.start = toSeconds ( node.getAttribute( "begin" ), timeOffset );
      sub.end = toSeconds( node.getAttribute( "end" ), timeOffset );
      sub.target = region;
      
      if ( sub.end < 0 ) {
        // No end given, infer duration if possible
        // Otherwise, give end as MAX_VALUE
        sub.end = toSeconds( node.getAttribute( "duration" ), 0 );
        
        if ( sub.end >= 0 ) {
          sub.end += sub.start;
        } else {
          sub.end = Number.MAX_VALUE;
        }
      }
      
      return sub;
    };
    
    // Parse the children of the given node
    var parseChildren = function( node, timeOffset ) {
      var currNode = node.firstChild,
          sub,
          newOffset;
      
      while ( currNode ) {
        if ( currNode.nodeType === 1 ) {
          if ( currNode.nodeName === "p" ) {
            // p is a teextual node, process contents as subtitle
            sub = parseNode( currNode, timeOffset );
            returnData.data.push( createTrack( "subtitle", sub ) );
            numTracks++;
          } else if ( currNode.nodeName === "div" ) {
            // div is container for subtitles, recurse
            newOffset = toSeconds( currNode.getAttribute("begin") );
            
            if (newOffset < 0 ) {
              newOffset = timeOffset;
            }
           
            parseChildren( currNode, newOffset );
          }
        }
        
        currNode = currNode.nextSibling;
      }
    };
    
    // Null checks
    if ( !data.xml || !data.xml.documentElement || !( node = data.xml.documentElement.firstChild ) ) {
      return returnData;
    }
    
    // Find body tag
    while ( node.nodeName !== "body" ) {
      node = node.nextSibling;
    }
    
    region = "";
    parseChildren( node, 0 );

    return returnData;
  });

})( Popcorn );
// PARSER: 0.1 TTXT

(function (Popcorn) {

  /**
   * TTXT popcorn parser plug-in 
   * Parses subtitle files in the TTXT format.
   * Style information is ignored.
   * Data parameter is given by Popcorn, will need an xml.
   * Xml is the file contents to be parsed as a DOM tree
   * 
   * @param {Object} data
   * 
   * Example:
     <TextSample sampleTime="00:00:00.000" text=""></TextSample>
   */
  Popcorn.parser( "parseTTXT", function( data ) {

    // declare needed variables
    var returnData = {
          title: "",
          remote: "",
          data: []
        };

    // Simple function to convert HH:MM:SS.MMM to SS.MMM
    // Assume valid, returns 0 on error
    var toSeconds = function(t_in) {
      var t = t_in.split(":");
      var time = 0;
      
      try {        
        return parseFloat(t[0], 10)*60*60 + parseFloat(t[1], 10)*60 + parseFloat(t[2], 10);
      } catch (e) { time = 0; }
      
      return time;
    };

    // creates an object of all atrributes keyed by name
    var createTrack = function( name, attributes ) {
      var track = {};
      track[name] = attributes;
      return track;
    };

    // this is where things actually start
    var node = data.xml.lastChild.lastChild; // Last Child of TextStreamHeader
    var lastStart = Number.MAX_VALUE;
    var cmds = [];
    
    // Work backwards through DOM, processing TextSample nodes
    while (node) {
      if ( node.nodeType === 1 && node.nodeName === "TextSample") {
        var sub = {};
        sub.start = toSeconds(node.getAttribute('sampleTime'));
        sub.text = node.getAttribute('text');
      
        if (sub.text) { // Only process if text to display
          // Infer end time from prior element, ms accuracy
          sub.end = lastStart - 0.001;
          cmds.push( createTrack("subtitle", sub) );
        }
        lastStart = sub.start;
      }
      node = node.previousSibling;
    }
    
    returnData.data = cmds.reverse();

    return returnData;
  });

})( Popcorn );
// PARSER: 0.3 WebSRT/VTT

(function ( Popcorn ) {
  /**
   * WebSRT/VTT popcorn parser plug-in 
   * Parses subtitle files in the WebSRT/VTT format.
   * Styles which appear after timing information are ignored.
   * Inline styling tags follow HTML conventions and are left in for the browser to handle
   * TrackEvents (cues) which are malformed are ignored.
   * Data parameter is given by Popcorn, will need a text.
   * Text is the file contents to be parsed
   * 
   * @param {Object} data
   * 
   * Example:
    Track-3
    00:00:15.542 --> 00:00:18.542 A:start D:vertical L:98%
    It's a <i>trap!</i>
   */
  Popcorn.parser( "parseVTT", function( data ) {
  
    // declare needed variables
    var retObj = {
          title: "",
          remote: "",
          data: []
        },
        subs = [],        
        i = 0,
        len = 0,
        idx = 0,
        lines,
        time,
        text,
        sub;
    
    // [HH:]MM:SS.mmm string to SS.mmm float
    // Throws exception if invalid
    var toSeconds = function( t_in ) {
      var t = t_in.split( ":" ),
          l = t_in.length,
          time;
      
      // Invalid time string provided
      if ( l !== 12 && l !== 9 ) {
        throw "Bad cue";
      }
      
      l = t.length - 1;
      
      try {        
        time = parseInt( t[l-1], 10 )*60 + parseFloat( t[l], 10 );
        
        // Hours were given
        if ( l === 2 ) {
          time += parseInt( t[0], 10 )*3600;
        }
      } catch ( e ) {
        throw "Bad cue";
      }
      
      return time;
    };
    
    var createTrack = function( name, attributes ) {
      var track = {};
      track[name] = attributes;
      return track;
    };
  
    // Here is where the magic happens
    // Split on line breaks
    lines = data.text.split( /(?:\r\n|\r|\n)/gm );
    len = lines.length;
    
    while ( i < len ) {
      sub = {};
      text = [];
      
      try {
        sub.id = lines[i++];
        // Ignore if id contains "-->"
        if ( !sub.id || sub.id.indexOf( "-->" ) !== -1 ) {
          throw "Bad cue";
        }
        
        time = lines[i++].split( /[\t ]*-->[\t ]*/ );
        
        sub.start = toSeconds(time[0]);
        
        // Filter out any trailing styling info
        idx = time[1].indexOf( " " );
        if ( idx !== -1 ) {
          time[1] = time[1].substr( 0, idx );
        }
        
        sub.end = toSeconds( time[1] );
        
        // Build single line of text from multi-line subtitle in file
        while ( i < len && lines[i] ) {
          text.push( lines[i++] );
        }
        
        // Join lines together to one and build subtitle
        sub.text = text.join( "<br />" );
        subs.push( createTrack( "subtitle", sub ) );
      } catch ( e ) {
         // Bad cue, advance to end of cue
        while ( i < len && lines[i] ) {
          i++;
        }
      }
      
      // Consume empty whitespace after a cue
      while ( i < len && !lines[i] ) {
        i++;
      }
    }
    
    retObj.data = subs;
    return retObj;
  });

})( Popcorn );
// PARSER: 0.1 XML

(function (Popcorn) {

  /**
   *
   *
   */
  Popcorn.parser( "parseXML", "XML", function( data ) {

    // declare needed variables
    var returnData = {
          title: "",
          remote: "",
          data: []
        },
        manifestData = {};

    // Simple function to convert 0:05 to 0.5 in seconds
    // acceptable formats are HH:MM:SS:MM, MM:SS:MM, SS:MM, SS
    var toSeconds = function(time) {
      var t = time.split(":");
      if (t.length === 1) {
        return parseFloat(t[0], 10);
      } else if (t.length === 2) {
        return parseFloat(t[0], 10) + parseFloat(t[1] / 12, 10);
      } else if (t.length === 3) {
        return parseInt(t[0] * 60, 10) + parseFloat(t[1], 10) + parseFloat(t[2] / 12, 10);
      } else if (t.length === 4) {
        return parseInt(t[0] * 3600, 10) + parseInt(t[1] * 60, 10) + parseFloat(t[2], 10) + parseFloat(t[3] / 12, 10);
      }
    };

    // turns a node tree element into a straight up javascript object
    // also converts in and out to start and end
    // also links manifest data with ids
    var objectifyAttributes = function ( nodeAttributes ) {

      var returnObject = {};

      for ( var i = 0, nal = nodeAttributes.length; i < nal; i++ ) {

        var key  = nodeAttributes.item(i).nodeName,
            data = nodeAttributes.item(i).nodeValue;

        // converts in into start
        if (key === "in") {
          returnObject.start = toSeconds( data );
        // converts out into end
        } else if ( key === "out" ){
          returnObject.end = toSeconds( data );
        // this is where ids in the manifest are linked
        } else if ( key === "resourceid" ) {
          Popcorn.extend( returnObject, manifestData[data] );
        // everything else
        } else {
          returnObject[key] = data;
        }

      }

      return returnObject;
    };

    // creates an object of all atrributes keyd by name
    var createTrack = function( name, attributes ) {
      var track = {};
      track[name] = attributes;
      return track;
    };

    // recursive function to process a node, or process the next child node
    var parseNode = function ( node, allAttributes, manifest ) {
      var attributes = {};
      Popcorn.extend( attributes, allAttributes, objectifyAttributes( node.attributes ), { text: node.textContent } );

      var childNodes = node.childNodes;

      // processes the node
      if ( childNodes.length < 1 || ( childNodes.length === 1 && childNodes[0].nodeType === 3 ) ) {

        if ( !manifest ) {
          returnData.data.push( createTrack( node.nodeName, attributes ) );
        } else {
          manifestData[attributes.id] = attributes;
        }

      // process the next child node
      } else {

        for ( var i = 0; i < childNodes.length; i++ ) {

          if ( childNodes[i].nodeType === 1 ) {
            parseNode( childNodes[i], attributes, manifest );
          }

        }
      }
    };

    // this is where things actually start
    var x = data.documentElement.childNodes;

    for ( var i = 0, xl = x.length; i < xl; i++ ) {

      if ( x[i].nodeType === 1 ) {

        // start the process of each main node type, manifest or timeline
        if ( x[i].nodeName === "manifest" ) {
          parseNode( x[i], {}, true );
        } else { // timeline
          parseNode( x[i], {}, false );
        }

      }
    }

    return returnData;
  });

})( Popcorn );
// Popcorn Vimeo Player Wrapper
( function( Popcorn, global ) {
  /**
  * Vimeo wrapper for Popcorn.
  * This player adds enables Popcorn.js to handle Vimeo videos. It does so by masking an embedded Vimeo video Flash object
  * as a video and implementing the HTML5 Media Element interface.
  *
  * You can specify the video in four ways:
  *  1. Use the embed code path supplied by Vimeo as a div's src, and pass the div id into a new Popcorn.vimeo object
  *
  *    <div id="player_1" width="500" height="281" src="http://player.vimeo.com/video/11127501" ></div>
  *    <script type="text/javascript">
  *      document.addEventListener("DOMContentLoaded", function() {
  *        var popcorn = Popcorn( Popcorn.vimeo( "player_1" ) );
  *      }, false);
  *    </script>
  &
  *  2. Pass the div id and the embed code path supplied by Vimeo into a new Popcorn.vimeo object
  *
  *    <div id="player_1" width="500" height="281" ></div>
  *    <script type="text/javascript">
  *      document.addEventListener("DOMContentLoaded", function() {
  *        var popcorn = Popcorn( Popcorn.vimeo( "player_1", "http://player.vimeo.com/video/11127501" ) );
  *      }, false);
  *    </script>
  *
  *  3. Use a web url as a div's src, and pass the div id into a new Popcorn.vimeo object
  *
  *    <div id="player_1" width="500" height="281" src="http://vimeo.com/11127501" ></div>
  *    <script type="text/javascript">
  *      document.addEventListener("DOMContentLoaded", function() {
  *        var popcorn = Popcorn( Popcorn.vimeo( "player_1" ) );
  *      }, false);
  *    </script>
  *
  *  4. Pass the div id and the web url into a new Popcorn.vimeo object
  *
  *    <div id="player_1" width="500" height="281" ></div>
  *    <script type="text/javascript">
  *      document.addEventListener("DOMContentLoaded", function() {
  *        var popcorn = Popcorn( Popcorn.vimeo( "player_1", "http://vimeo.com/11127501" ) );
  *      }, false);
  *    </script>
  *
  * Due to Vimeo's API, certain events must be subscribed to at different times, and some not at all.
  * These events are completely custom-implemented and may be subscribed to at any time:
  *   canplaythrough
  *   durationchange
  *   load
  *   loadedmetadata
  *   loadstart
  *   play
  *   readystatechange
  *   volumechange
  *
  * These events are related to player functionality and must be subscribed to during or after the load event:
  *   abort
  *   emptied
  *   ended
  *   pause
  *   playing
  *   progress
  *   seeked
  *   timeupdate
  *
  * These events are not supported:
  *   canplay
  *   error
  *   loadeddata
  *   ratechange
  *   seeking
  *   stalled
  *   suspend
  *   waiting
  *
  * Due to Vimeo's API, some attributes are be supported while others are not.
  * Supported media attributes:
  *   autoplay ( via Popcorn )
  *   currentTime
  *   duration ( get only )
  *   ended ( get only )
  *   initialTime ( get only, always 0 )
  *   loop ( get only, set by calling setLoop() )
  *   muted ( get only )
  *   paused ( get only )
  *   readyState ( get only )
  *   volume
  *
  *   load() function
  *   mute() function ( toggles on/off )
  *
  * Unsupported media attributes:
  *   buffered
  *   defaultPlaybackRate
  *   networkState
  *   playbackRate
  *   played
  *   preload
  *   seekable
  *   seeking
  *   src
  *   startOffsetTime
  */
  
  // Trackers
  var timeupdateInterval = 33,
      timeCheckInterval = 0.75,
      abs = Math.abs,
      registry = {};
  
  // base object for DOM-related behaviour like events
  var EventManager = function ( owner ) {
    var evts = {};
    
    function makeHandler( evtName ) {
      if ( !evts[evtName] ) {
        evts[evtName] = [];
        
        // Create a wrapper function to all registered listeners
        this["on"+evtName] = function( args ) {
          Popcorn.forEach( evts[evtName], function( fn ) {
            if ( fn ) {
              fn.call( owner, args );
            }
          });
        };
      }
    }
    
    return {
      addEventListener: function( evtName, fn, doFire ) {
        evtName = evtName.toLowerCase();
        
        makeHandler.call( this, evtName );
        evts[evtName].push( fn );
        
        if ( doFire ) {
          dispatchEvent( evtName );
        }
        
        return fn;
      },
      // Add many listeners for a single event
      // Takes an event name and array of functions
      addEventListeners: function( evtName, events ) {
        evtName = evtName.toLowerCase();
        
        makeHandler.call( this, evtName );
        evts[evtName] = evts[evtName].concat( events );
      },
      removeEventListener: function( evtName, fn ) {
        var evtArray = this.getEventListeners( evtName ),
            i,
            l;
        
        // Find and remove from events array
        for ( i = 0, l = evtArray.length; i < l; i++) {
          if ( evtArray[i] === fn ) {
            var removed = evtArray[i];
            evtArray[i] = 0;
            return removed;
          }
        }
      },
      getEventListeners: function( evtName ) {
        if( evtName ) {
          return evts[ evtName.toLowerCase() ] || [];
        } else {
          return evts;
        }
      },
      dispatchEvent: function( evt, args ) {        
        // If event object was passed in, toString will yield event type as string (timeupdate)
        // If a string, toString() will return the string itself (timeupdate)
        evt = "on"+evt.toString().toLowerCase();
        this[evt] && this[evt]( args );
      }
    };
  };
      
  Popcorn.vimeo = function( mediaId, list, options ) {
    return new Popcorn.vimeo.init( mediaId, list, options );
  };
  
  Popcorn.vimeo.onLoad = function( playerId ) {
    var player = registry[ playerId ];
    
    player.swfObj = document.getElementById( playerId );
    
    // For calculating position relative to video (like subtitles)
    player.offsetWidth = player.swfObj.offsetWidth;
    player.offsetHeight = player.swfObj.offsetHeight;
    player.offsetParent = player.swfObj.offsetParent;
    player.offsetLeft = player.swfObj.offsetLeft;
    player.offsetTop = player.swfObj.offsetTop;
    
    player.dispatchEvent( "load" );
  };
  
  Popcorn.getScript( "http://ajax.googleapis.com/ajax/libs/swfobject/2.2/swfobject.js" );
  
  // A constructor, but we need to wrap it to allow for "static" functions
  Popcorn.vimeo.init = (function() {
    var rPlayerUri = /^http:\/\/player\.vimeo\.com\/video\/[\d]+/i,
        rWebUrl = /vimeo\.com\/[\d]+/,
        hasAPILoaded = false;
    
    // Extract the numeric video id from container uri: 'http://player.vimeo.com/video/11127501' or 'http://player.vimeo.com/video/4282282'
    // Expect id to be a valid 32/64-bit unsigned integer
    // Returns string, empty string if could not match
    function extractIdFromUri( uri ) {
      if ( !uri ) {
        return;
      }
      
      var matches = uri.match( rPlayerUri );
      return matches ? matches[0].substr(30) : "";
    }
    
    // Extract the numeric video id from url: 'http://vimeo.com/11127501' or simply 'vimeo.com/4282282'
    // Ignores protocol and subdomain, but one would expecct it to be http://www.vimeo.com/#######
    // Expect id to be a valid 32/64-bit unsigned integer
    // Returns string, empty string if could not match
    function extractIdFromUrl( url ) {
      if ( !url ) {
        return;
      }
      
      var matches = url.match( rWebUrl );
      return matches ? matches[0].substr(10) : "";
    }
    
    // Gets the style for the given element
    function getStyle( elem, styleProp ) {
      return elem.style[styleProp];
    }
      
    function makeSwf( self, vidId, containerId ) {
      if ( !window.swfobject ) {
        setTimeout( function() {
          makeSwf( self, vidId, containerId );
        }, 1);
        return;
      }
      
      var params,
          flashvars,
          attributes = {};
          
      flashvars = {
        clip_id: vidId,
        show_portrait: 1,
        show_byline: 1,
        show_title: 1,
        // required in order to use the Javascript API
        js_api: 1,
        // moogaloop will call this JS function when it's done loading (optional)
        js_onLoad: 'Popcorn.vimeo.onLoad',
        // this will be passed into all event methods so you can keep track of multiple moogaloops (optional)
        js_swf_id: containerId
      };
      params = {
        allowscriptaccess: 'always',
        allowfullscreen: 'true',
        // This is so we can overlay html ontop o fFlash
        wmode: 'transparent'
      };
      
      swfobject.embedSWF( "http://vimeo.com/moogaloop.swf", containerId, self.offsetWidth, self.offsetHeight, "9.0.0", "expressInstall.swf", flashvars, params, attributes );
    }
    
    // If container id is not supplied, assumed to be same as player id
    var ctor = function ( containerId, videoUrl, options ) {
      if ( !containerId ) {
        throw "Must supply an id!";
      } else if ( /file/.test( location.protocol ) ) {
        throw "Must run from a web server!";
      }
      
      var vidId,
          that = this,
          tmp,
          container = this.container = document.getElementById( containerId );
      
      options = options || {};
      
      this.addEventFn;
      this.evtHolder;
      this.paused = true;
      this.duration = Number.MAX_VALUE;
      this.ended = 0;
      this.currentTime = 0;
      this.volume = 1;
      this.loop = 0;
      this.initialTime = 0;
      this.played = 0;
      this.readyState = 0;
      
      this.previousCurrentTime = this.currentTime;
      this.previousVolume = this.volume;
      this.evtHolder = new EventManager( this );
      
      this._container =  document.getElementById( containerId );
      bounds = this._container.getBoundingClientRect();
      
      // For calculating position relative to video (like subtitles)
      this.width = options.width || getStyle( container, "width" ) || "504px";
      this.height = options.height || getStyle( container, "height" ) || "340px";
      
      if ( !/[\d]%/.test( this.width ) ) {
        this.offsetWidth = parseInt( this.width, 10 );
      } else {
        // convert from pct to abs pixels
        tmp = container.style.width;
        container.style.width = this.width;
        this.offsetWidth = container.offsetWidth;
        container.style.width = tmp;
      }
      
      if ( !/[\d]%/.test( this.height ) ) {
        this.offsetHeight = parseInt( this.height, 10 );
      } else {
        // convert from pct to abs pixels
        tmp = container.style.height;
        container.style.height = this.height;
        this.offsetHeight = container.offsetHeight;
        container.style.height = tmp;
      }
      
      this.offsetLeft = 0;
      this.offsetTop = 0;
      
      // Try and get a video id from a vimeo site url
      // Try either from ctor param or from iframe itself
      vidId = extractIdFromUrl( videoUrl ) || extractIdFromUri( videoUrl );
      
      if ( !vidId ) {
        throw "No video id";
      }
      
      registry[ containerId ] = this;
      
      makeSwf( this, vidId, containerId );
      
      // Set up listeners to internally track state as needed
      this.addEventListener( "load", function() {
        var hasLoaded = false;
        
        that.duration = that.swfObj.api_getDuration();
        that.evtHolder.dispatchEvent( "durationchange" );
        that.evtHolder.dispatchEvent( "loadedmetadata" );
        
        // Chain events and calls together so that this.currentTime reflects the current time of the video
        // Done by Getting the Current Time while the video plays
        that.addEventListener( "timeupdate", function() {
          that.currentTime = that.swfObj.api_getCurrentTime();
        });
        
        // Add pause listener to keep track of playing state
        
        that.addEventListener( "pause", function() {
          that.paused = true;
        });
        
        // Add play listener to keep track of playing state
        that.addEventListener( "playing", function() {
          that.paused = false;
          that.ended = 0;
        });
        
        // Add ended listener to keep track of playing state
        that.addEventListener( "ended", function() {
          if ( that.loop !== "loop" ) {
            that.paused = true;
            that.ended = 1;
          }
        });
        
        // Add progress listener to keep track of ready state
        that.addEventListener( "progress", function( data ) {
          if ( !hasLoaded ) {
            hasLoaded = 1;
            that.readyState = 3;
            that.evtHolder.dispatchEvent( "readystatechange" );
          }
          
          // Check if fully loaded
          if ( data.percent === 100 ) {
            that.readyState = 4;
            that.evtHolder.dispatchEvent( "readystatechange" );
            that.evtHolder.dispatchEvent( "canplaythrough" );
          }
        });
      });
    };
    return ctor;
  })();
  
  Popcorn.vimeo.init.prototype = Popcorn.vimeo.prototype;
  
  // Sequence object prototype
  Popcorn.extend( Popcorn.vimeo.prototype, {
    // Do everything as functions instead of get/set
    setLoop: function( val ) {
      if ( !val ) {
        return;
      }
      
      this.loop = val;
      var isLoop = val === "loop" ? 1 : 0;
      // HTML convention says to loop if value is 'loop'
      this.swfObj.api_setLoop( isLoop );
    },
    // Set the volume as a value between 0 and 1
    setVolume: function( val ) {
      if ( !val && val !== 0 ) {
        return;
      }
      
      // Normalize in case outside range of expected values
      if ( val < 0 ) {
        val = -val;
      }
      
      if ( val > 1 ) {
        val %= 1;
      }
      
      // HTML video expects to be 0.0 -> 1.0, Vimeo expects 0-100
      this.volume = this.previousVolume = val;
      this.swfObj.api_setVolume( val*100 );
      this.evtHolder.dispatchEvent( "volumechange" );
    },
    // Seeks the video
    setCurrentTime: function ( time ) {
      if ( !time && time !== 0 ) {
        return;
      }
      
      this.currentTime = this.previousCurrentTime = time;
      this.ended = time >= this.duration;
      this.swfObj.api_seekTo( time );
      
      // Fire events for seeking and time change
      this.evtHolder.dispatchEvent( "seeked" );
      this.evtHolder.dispatchEvent( "timeupdate" );
    },
    // Play the video
    play: function() {
      // In case someone is cheeky enough to try this before loaded
      if ( !this.swfObj ) {
        this.addEventListener( "load", this.play );
        return;
      }
      
      if ( !this.played ) {
        this.played = 1;
        this.startTimeUpdater();
        this.evtHolder.dispatchEvent( "loadstart" );
      }
      
      this.evtHolder.dispatchEvent( "play" );
      this.swfObj.api_play();
    },
    // Pause the video
    pause: function() {
      // In case someone is cheeky enough to try this before loaded
      if ( !this.swfObj ) {
        this.addEventListener( "load", this.pause );
        return;
      }
      
      this.swfObj.api_pause();
    },
    // Toggle video muting
    // Unmuting will leave it at the old value
    mute: function() {
      // In case someone is cheeky enough to try this before loaded
      if ( !this.swfObj ) {
        this.addEventListener( "load", this.mute );
        return;
      }
      
      if ( !this.muted() ) {
        this.oldVol = this.volume;
        
        if ( this.paused ) {
          this.setVolume( 0 );
        } else {
          this.volume = 0;
        }
      } else {
        if ( this.paused ) {
          this.setVolume( this.oldVol );
        } else {
          this.volume = this.oldVol;
        }
      }
    },
    muted: function() {
      return this.volume === 0;
    },
    // Force loading by playing the player. Pause afterwards
    load: function() {
      // In case someone is cheeky enough to try this before loaded
      if ( !this.swfObj ) {
        this.addEventListener( "load", this.load );
        return;
      }
      
      this.play();
      this.pause();
    },
    unload: function() {
      // In case someone is cheeky enough to try this before loaded
      if ( !this.swfObj ) {
        this.addEventListener( "load", this.unload );
        return;
      }
      
      this.pause();
      
      this.swfObj.api_unload();
      this.evtHolder.dispatchEvent( "abort" );
      this.evtHolder.dispatchEvent( "emptied" );
    },
    // Hook an event listener for the player event into internal event system
    // Stick to HTML conventions of add event listener and keep lowercase, without prependinng "on"
    addEventListener: function( evt, fn ) {
      var playerEvt,
          that = this;
      
      // In case event object is passed in
      evt = evt.type || evt.toLowerCase();
      
      // If it's an HTML media event supported by player, map
      if ( evt === "seeked" ) {
        playerEvt = "onSeek";
      } else if ( evt === "timeupdate" ) {
        playerEvt = "onProgress";
      } else if ( evt === "progress" ) {
        playerEvt = "onLoading";
      } else if ( evt === "ended" ) {
        playerEvt = "onFinish";
      } else if ( evt === "playing" ) {
        playerEvt = "onPlay";
      } else if ( evt === "pause" ) {
        // Direct mapping, CamelCase the event name as vimeo API expects
        playerEvt = "on"+evt[0].toUpperCase() + evt.substr(1);
      }
      
      // Vimeo only stores 1 callback per event
      // Have vimeo call internal collection of callbacks
      this.evtHolder.addEventListener( evt, fn, false );
      
      // Link manual event structure with Vimeo's if not already
      if( playerEvt && this.evtHolder.getEventListeners( evt ).length === 1 ) {
        // Setup global functions on Popcorn.vimeo to sync player events to an internal collection
        // Some events expect 2 args, some only one (the player id)
        if ( playerEvt === "onSeek" || playerEvt === "onProgress" || playerEvt === "onLoading" ) {
          Popcorn.vimeo[playerEvt] = function( arg1, arg2 ) {
            var player = registry[arg2];
            
            player.evtHolder.dispatchEvent( evt, arg1 );
          };
        } else {
          Popcorn.vimeo[playerEvt] = function( arg1 ) {
            var player = registry[arg1];
            player.evtHolder.dispatchEvent( evt );
          };
        }
        
        this.swfObj.api_addEventListener( playerEvt, "Popcorn.vimeo."+playerEvt );
      }
    },
    removeEventListener: function( evtName, fn ) {
      return this.evtHolder.removeEventListener( evtName, fn );
    },
    dispatchEvent: function( evtName ) {
      return this.evtHolder.dispatchEvent( evtName );
    },
    getBoundingClientRect: function() {
      return this.container.getBoundingClientRect();
    },
    startTimeUpdater: function() {
      var self = this,
          seeked = 0;
      
      if ( abs( this.currentTime - this.previousCurrentTime ) > timeCheckInterval ) {
        // Has programatically set the currentTime
        this.setCurrentTime( this.currentTime );
        seeked = 1;
      } else {
        this.previousCurrentTime = this.currentTime;
      }
      
      if ( this.volume !== this.previousVolume ) {
        this.setVolume( this.volume );
      }
      
      if ( !self.paused || seeked ) {
        this.dispatchEvent( 'timeupdate' );
      }
      
      if( !self.ended ) {
        setTimeout( function() {
          self.startTimeUpdater.call(self);
        }, timeupdateInterval);
      }
    }
  });
})( Popcorn, window );
// Popcorn Youtube Player Wrapper

var onYouTubePlayerReady;

( function( Popcorn ) {
  /**
   * Youtube wrapper for popcorn.
   * This plug-in adds capability for Popcorn.js to deal with Youtube
   * videos. This plug-in also doesn't use Popcorn's plugin() API and
   * instead hacks directly into Popcorn's core.
   *
   * To use this plug-in, onYouTubePlayerReady() event handler needs to be
   * called by the Youtube video player, before videos can be registered.
   * Once videos are registered, calls to them can be made the same way as
   * regular Popcorn objects. Also note that enablejsapi=1 needs to be added
   * to the embed code, in order for Youtube's JavaScript API to work.
   *
   * Note that there are a few methods, properties and events that are not
   * supported. See the bottom of this plug-in for a complete list.
   */

  // Intended
  var undef;

  // Config parameters
  // 33 ms per update is suitable for 30 fps
  // 0.05 sec tolerance between old and new times to determine if currentTime has been set programatically
  // 250 ms progress interval as specified by WHATWG
  var timeupdateInterval = 33,
      timeCheckInterval = 0.5,
      progressInterval = 250;

  // Ready State Constants
  var READY_STATE_HAVE_NOTHING = 0,
      READY_STATE_HAVE_METADATA = 1,
      READY_STATE_HAVE_CURRENT_DATA = 2,
      READY_STATE_HAVE_FUTURE_DATA = 3,
      READY_STATE_HAVE_ENOUGH_DATA = 4;

  // Youtube State Constants
  var YOUTUBE_STATE_UNSTARTED = -1,
      YOUTUBE_STATE_ENDED = 0,
      YOUTUBE_STATE_PLAYING = 1,
      YOUTUBE_STATE_PAUSED = 2,
      YOUTUBE_STATE_BUFFERING = 3,
      YOUTUBE_STATE_CUED = 5;
  
  // Collection of all Youtube players
  var registry = {},
      loadedPlayers = {};
      
  var abs = Math.abs;
  
  Popcorn.getScript( "http://ajax.googleapis.com/ajax/libs/swfobject/2.2/swfobject.js" );
  
  // Extract the id from a web url
  function extractIdFromUrl( url ) {
    if ( !url ) {
      return;
    }
    
    var matches = url.match( /((http:\/\/)?www\.)?youtube\.[a-z]+\/watch\?v\=[a-z0-9]+/i );    
    // Return id, which comes after first equals sign
    return matches ? matches[0].split( "=" )[1] : "";
  }
  
  // Extract the id from a player url
  function extractIdFromUri( url ) {
    if ( !url ) {
      return;
    }
    
    var matches = url.match( /^http:\/\/?www\.youtube\.[a-z]+\/e\/[a-z0-9]+/i );
    
    // Return id, which comes after first equals sign
    return matches ? matches[0].split( "/e/" )[1] : "";
  }
  
  function getPlayerAddress( vidId, playerId ) {
    if( !vidId ) {
      return;
    }
    
    return "http://www.youtube.com/e/" + id;
  }
  
  function makeSWF( url, container ) {
    var bounds,
        params,
        flashvars,
        attributes,
        self = this;
        
    if ( !window.swfobject ) {
      setTimeout( function() {
        makeSWF.call( self, url, container );
      }, 1 );
      return;
    }
    
    bounds = container.getBoundingClientRect();
    
    // Determine width/height/etc based on container
    this.width = container.style.width || 460;
    this.height = container.style.height || 350;
    
    // Just in case we got the attributes as strings. We'll need to do math with these later
    this.width = parseFloat(this.width);
    this.height = parseFloat(this.height);
    
    // For calculating position relative to video (like subtitles)
    this.offsetWidth = this.width;
    this.offsetHeight = this.height;
    this.offsetLeft = bounds.left;
    this.offsetTop = bounds.top;
    
    this.offsetParent = container.offsetParent;
    
    flashvars = {
      playerapiid: this.playerId
    };
    params = {
      allowscriptaccess: 'always',
      allowfullscreen: 'true',
      // This is so we can overlay html on top of Flash
      wmode: 'transparent'
    };
    
    attributes = {
      id: this.playerId
    };
    
    swfobject.embedSWF( "http://www.youtube.com/e/" + this.vidId +"?enablejsapi=1&playerapiid=" + this.playerId + "&verion=3", 
                      this.playerId, this.width, this.height, "8", null, flashvars, params, attributes );
  }
  
  // Called when a player is loaded
  // Playerid must match the element id
  onYouTubePlayerReady = function ( playerId ) {
    var vid = registry[playerId];
    
    loadedPlayers[playerId] = 1;
    
    // Video hadn't loaded yet when ctor was called
    vid.video = document.getElementById( playerId );
    vid.duration = vid.video.getDuration();
    
    // Issue load event
    vid.dispatchEvent( 'load' );
    vid.dispatchEvent( "durationchange" );
  };

  Popcorn.youtube = function( elementId, url, options ) {
    return new Popcorn.youtube.init( elementId, url, options );
  };

  Popcorn.youtube.init = function( elementId, url, options ) {
    if ( !elementId ) {
      throw "Element id is invalid.";
    } else if ( /file/.test( location.protocol ) ) {
      throw "This must be run from a web server.";
    }
    
    options = options || {};
    
    var self = this;
    
    this.playerId = elementId + Popcorn.guid();
    this.readyState = READY_STATE_HAVE_NOTHING;
    this._eventListeners = {};
    this.loadStarted = false;
    this.loadedData = false;
    this.fullyLoaded = false;
    
    // If supplied as number, append  'px' on end
    // If suppliied as '###' or '###px', convert to number and append 'px' back on end
    options.width = options.width && (+options.width)+"px";
    options.height = options.height && (+options.height)+"px";
    
    this._target = document.getElementById( elementId );
    this._container = document.createElement( "div" );
    this._container.id = this.playerId;
    this._container.style.height = this._target.style.height = options.height || this._target.style.height || "350px";
    this._container.style.width  = this._target.style.width  = options.width || this._target.style.width  || "460px";
    this._target.appendChild( this._container );

    this.offsetHeight = +this._target.offsetHeight;
    this.offsetWidth = +this._target.offsetWidth;
    
    this.currentTime = this.previousCurrentTime = 0;
    this.volume = this.previousVolume = this.preMuteVol = 1;
    this.duration = 0;
    
    this.vidId = extractIdFromUrl( url ) || extractIdFromUri( url );
    
    if ( !this.vidId ) {
      throw "Could not find video id";
    }
    
    this.addEventListener( "load", function() {
      // For calculating position relative to video (like subtitles)
      this.offsetWidth = this.video.offsetWidth;
      this.offsetHeight = this.video.offsetHeight;
      this.offsetParent = this.video.offsetParent;
      
      // Set up stuff that requires the API to be loaded
      this.registerYoutubeEventHandlers();
      this.registerInternalEventHandlers();
    });
    
    (function() {
      var hasBeenCalled = 0;
      
      self.addEventListener( "playing", function() {
        if (hasBeenCalled) {
          return;
        }
        
        hasBeenCalled = 1;
        self.duration = self.video.getDuration();
        self.dispatchEvent( "durationchange" );
        
      });
    })();
    
    if ( loadedPlayers[this.playerId] ) {
      this.video = registry[this.playerId].video;
      
      this.vidId = this.vidId || extractIdFromUrl( this._container.getAttribute( "src" ) ) || extractIdFromUri( this._container.getAttribute( "src" ) );
      
      if (this.vidId !== registry[this.playerId].vidId ) {
        this.video.cueVideoById( this.vidId );
      } else {
        // Same video, new ctor. Force a seek to the beginning
        this.previousCurrentTime = 1;
      }
      
      this.dispatchEvent( 'load' );
    } else if ( this._container ) {
      makeSWF.call( this, url, this._container );
    } else {
      // Container not yet loaded, get it on DOMDontentLoad
      document.addEventListener( "DOMContentLoaded", function() {
        self._container = document.getElementById( elementId );
        
        if ( !self._container ) {
          throw "Could not find container!";
        }
        
        makeSWF.call( self, url, self._container );
      }, false);
    }
    
    registry[this.playerId] = this;
  };
  // end Popcorn.youtube.init

  Popcorn.extend( Popcorn.youtube.init.prototype, {

    // For internal use only.
    // Register handlers to YouTube events.
    registerYoutubeEventHandlers: function() {
      var youcorn = this,
          stateChangeHandler = 'Popcorn.youtube.stateChangeEventHandler',
          errorHandler = 'Popcorn.youtube.errorEventHandler';
          
      this.video.addEventListener( 'onStateChange', stateChangeHandler );
      this.video.addEventListener( 'onError', errorHandler );

      /**
       * Since Flash can only call named functions, they are declared
       * separately here.
       */
      Popcorn.youtube.stateChangeEventHandler = function( state ) {
        // In case ctor has been called many times for many ctors
        // Only use latest ctor call for each player id        
        var self = registry[youcorn.playerId];
        
        if ( state === YOUTUBE_STATE_UNSTARTED ) {
          self.readyState = READY_STATE_HAVE_METADATA;
          self.dispatchEvent( 'loadedmetadata' );
        } else if ( state === YOUTUBE_STATE_ENDED ) {
          self.dispatchEvent( 'ended' );
        } else if ( state === YOUTUBE_STATE_PLAYING ) {
          // Being able to play means current data is loaded.
          if ( !this.loadedData ) {
            this.loadedData = true;
            self.dispatchEvent( 'loadeddata' );
          }

          self.readyState = READY_STATE_HAVE_CURRENT_DATA;
          self.dispatchEvent( 'playing' );
        } else if ( state === YOUTUBE_STATE_PAUSED ) {
          self.dispatchEvent( 'pause' );
        } else if ( state === YOUTUBE_STATE_BUFFERING ) {
          self.dispatchEvent( 'waiting' );
        } else if ( state === YOUTUBE_STATE_CUED ) {
          // not handled
        }
      };

      Popcorn.youtube.errorEventHandler = function( state ) {
        youcorn.dispatchEvent( 'error' );
      };
    },

    // For internal use only.
    // Start current time and loading progress syncing intervals.
    registerInternalEventHandlers: function() {
      this.addEventListener( 'playing', function() {
        this.startTimeUpdater();
      });
      this.addEventListener( 'loadedmetadata', function() {
        this.startProgressUpdater();
      });
    },

    play: function() {
      // In case called before video is loaded, defer acting
      if ( !loadedPlayers[this.playerId] ) {
        this.addEventListener( "load", function() {
          this.play();
        });
        return;
      }
      
      this.dispatchEvent( 'play' );
      this.video.playVideo();
    },

    pause: function() {
      // In case called before video is loaded, defer acting
      if ( !loadedPlayers[this.playerId] ) {
        this.addEventListener( "load", this.pause );
        return;
      }
      
      this.video.pauseVideo();
      // pause event is raised by Youtube.
    },

    load: function() {
      // In case called before video is loaded, defer acting
      if ( !loadedPlayers[this.playerId] ) {
        this.addEventListener( "load", function() {
          this.load();
        });
        return;
      }
      
      this.video.playVideo();
      this.video.pauseVideo();
    },

    seekTo: function( time ) {      
      var playing = this.video.getPlayerState() == YOUTUBE_STATE_PLAYING;
      this.video.seekTo( time, true );

      // Prevent Youtube's behaviour to start playing video after seeking.
      if ( !playing ) {
        this.video.pauseVideo();
      }

      // Data need to be loaded again.
      if ( !this.fullyLoaded ) {
        this.loadedData = false;
      }

      // Raise event.
      this.dispatchEvent( 'seeked' );
    },

    // Mute is toggleable
    mute: function() {
      // In case called before video is loaded, defer acting
      if ( !loadedPlayers[this.playerId] ) {
        this.addEventListener( "load", this.mute );
        return;
      }
      
      if ( this.volume !== 0 ) {
        this.preMuteVol = this.volume;        
        this.setVolume( 0 );
      } else {
        this.setVolume( this.preMuteVol );
      }
    },

    // Expects beteween 0 and 1
    setVolume: function( vol ) {
      this.volume = this.previousVolume = vol;
      this.video.setVolume( vol * 100 );
      this.dispatchEvent( 'volumechange' );
    },

    addEventListener: function( evt, func ) {
      var evtName = evt.type || evt;
      
      if ( !this._eventListeners[evtName] ) {
        this._eventListeners[evtName] = [];
      }
      
      this._eventListeners[evtName].push( func );
    },

    /**
     * Notify event listeners about an event.
     */
    dispatchEvent: function( name ) {
      var evtName = name.type || name;
      if ( !this._eventListeners[evtName] ) {
        return;
      }
      
      var self = this;
      
      Popcorn.forEach( this._eventListeners[evtName], function( evt ) {
        evt.call( self, null );
      });
    },

    /* Unsupported methods. */

    defaultPlaybackRate: function( arg ) {
    },

    playbackRate: function( arg ) {
    },
    
    getBoundingClientRect: function() {
      var b,
          self = this;
          
      if ( this.video ) {
        b = this.video.getBoundingClientRect();
        
        return {
          bottom: b.bottom,
          left: b.left,
          right: b.right,
          top: b.top,
          
          //  These not guaranteed to be in there
          width: b.width || ( b.right - b.left ),
          height: b.height || ( b.bottom - b.top )
        };
      } else {
        b = self._container.getBoundingClientRect();
        
        // Update bottom, right for expected values once the container loads
        return {
          left: b.left,
          top: b.top,
          width: self._target.offsetWidth,
          height: self._target.offsetHeight,
          bottom: b.top + self._target.offsetWidth,
          right: b.left + self._target.offsetHeight
        };
      }
    },
    
    startTimeUpdater: function() {
      var state = this.video.getPlayerState(),
          self = this,
          seeked = 0;
      
      if ( abs( this.currentTime - this.previousCurrentTime ) > timeCheckInterval ) {
        // Has programatically set the currentTime
        this.previousCurrentTime = this.currentTime - timeCheckInterval;
        this.seekTo( this.currentTime );
        seeked = 1;
      } else {
        this.previousCurrentTime = this.currentTime;
        this.currentTime = this.video.getCurrentTime();
      }
      
      if ( this.volume !== this.previousVolume ) {
        this.setVolume( this.volume );
      }
      
      if ( state !== YOUTUBE_STATE_ENDED && state !== YOUTUBE_STATE_PAUSED || seeked ) {
        this.dispatchEvent( 'timeupdate' );
      }
      
      if( state !== YOUTUBE_STATE_ENDED ) {
        setTimeout( function() {
          self.startTimeUpdater.call(self);
        }, timeupdateInterval);
      }
    },
    
    startProgressUpdater: function() {
      var bytesLoaded = this.video.getVideoBytesLoaded(),
          bytesToLoad = this.video.getVideoBytesTotal(),
          self = this;

      // do nothing if size is not yet determined
      if ( bytesToLoad === 0 ) {
        return;
      }

      // raise an event if load has just started
      if ( !this.loadStarted ) {
        this.loadStarted = true;
        this.dispatchEvent( 'loadstart' );
      }

      // fully loaded
      if ( bytesLoaded >= bytesToLoad ) {
        this.fullyLoaded = true;
        this.readyState = READY_STATE_HAVE_ENOUGH_DATA;
        this.dispatchEvent( 'canplaythrough' );
        return;
      }

      this.dispatchEvent( 'progress' );
        
      setTimeout( function() {
        self.startProgressUpdater.call( self );
      }, progressInterval);
    }
  }); // end Popcorn.extend

  /* Unsupported properties and events. */

  /**
   * Unsupported events are:
   * * suspend
   * * abort
   * * emptied
   * * stalled
   * * canplay
   * * seeking
   * * ratechange
   */

})( Popcorn );

(function( global, doc ) {
  Popcorn.baseplayer = function() {
    return new Popcorn.baseplayer.init();
  };

  Popcorn.baseplayer.init = function() {
    this.readyState = 0;
    this.currentTime = 0;
    this.duration = 0;
    this.paused = 1;
    this.ended = 0;
    this.volume = 1;
    this.muted = 0;
    this.playbackRate = 1;

    // These are considered to be "on" by being defined. Initialize to undefined
    this.autoplay;
    this.loop;
    
    // List of events
    this._events = {};
    
    // The underlying player resource. May be <canvas>, <iframe>, <object>, array, etc
    this._resource;
    // The container div of the resource
    this._container;
    
    this.offsetWidth = this.width = 0;
    this.offsetHeight = this.height = 0;
    this.offsetLeft = 0;
    this.offsetTop = 0;
    this.offsetParent;
  };

  Popcorn.baseplayer.init.prototype = {
    load: function() {},
    
    play: function() {
      this.paused = 0;
      this.timeupdate();
    },
    
    pause: function() {
      this.paused = 1;
    },
    
    timeupdate: function() {
      // The player was paused since the last time update
      if ( this.paused ) {
        return;
      }

      // So we can refer to the instance when setTimeout is run
      var self = this;
      this.currentTime += 0.015;
      
      this.dispatchEvent( "timeupdate" );
      setTimeout( function() {
        self.timeupdate.call( self );
      }, 15 );
    },
    
    // By default, assumes this.resource is a DOM Element
    // Changing the type of this.resource requires this method to be overridden
    getBoundingClientRect: function() {
      var b,
          self = this;
          
      if ( this._resource ) {
        b = this._resource.getBoundingClientRect();
        
        return {
          bottom: Math.ceil( b.bottom ),
          left: Math.ceil( b.left ),
          right: Math.ceil( b.right ),
          top: Math.ceil( b.top ),
          
          //  These not guaranteed to be in there
          width: b.width || ( b.right - b.left ),
          height: b.height || ( b.bottom - b.top )
        };
      } else {
        b = this._container.getBoundingClientRect();
        
        // Update bottom, right for expected values once the container loads
        return {
          left: b.left,
          top: b.top,
          width: self.offsetWidth,
          height: self.offsetHeight,
          bottom: b.top + this.width,
          right: b.top + this.height
        };
      }
    },
    
    // Add an event listener to the object
    addEventListener: function( evtName, fn ) {
      if ( !this._events[evtName] ) {
        this._events[evtName] = [];
      }
      
      this._events[evtName].push( fn );
      return fn;
    },
    
    // Can take event object or simple string
    dispatchEvent: function( oEvent ) {
      var evt,
          self = this,
          eventInterface,
          eventName = oEvent.type;
          
      // A string was passed, create event object
      if ( !eventName ) {
        eventName = oEvent;
        eventInterface  = Popcorn.events.getInterface( eventName );
        
        if ( eventInterface ) {
          evt = document.createEvent( eventInterface );
          evt.initEvent( eventName, true, true, window, 1 );
        }
      }
      
      Popcorn.forEach( this._events[eventName], function( val ) {
        val.call( self, evt, self );
      });
    },
    
    // Extracts values from container onto this object
    extractContainerValues: function( id ) {
      this._container = document.getElementById( id );
      
      if ( !this._container ) {
        return;
      }
      
      var bounds = this._container.getBoundingClientRect();
      
      this.offsetWidth = this.width = container.getAttribute( "width" ) || getStyle( "width" ) || 0;
      this.offsetHeight = this.height = container.getAttribute( "height" ) || getStyle( "height" ) || 0;
      this.offsetLeft = bounds.left;
      this.offsetTop = bound.top;
      this.offsetParent = this._container.offsetParent;
      
      return this._container;
    },
    
    // By default, assumes this.resource is a DOM Element
    // Changing the type of this.resource requires this method to be overridden
    // Returns the computed value for CSS style 'prop' as computed by the browser
    getStyle: function( prop ) {
      var elem = this._resource;
      
      if ( elem.currentStyle ) {
        // IE syntax
        return elem.currentStyle[prop];
      } else if ( global.getComputedStyle ) {
        // Firefox, Chrome et. al
        return doc.defaultView.getComputedStyle( elem, null ).getPropertyValue( prop );
      } else {
        // Fallback, just in case
        return elem.style[prop];
      }
    }
  };
})( window, document );
// Popcorn Soundcloud Player Wrapper
( function( Popcorn, global ) {
  /**
  * Soundcloud wrapper for Popcorn.
  * This player adds enables Popcorn.js to handle Soundcloud audio. It does so by masking an embedded Soundcloud Flash object
  * as a video and implementing the HTML5 Media Element interface.
  *
  * You can configure the video source and dimensions in two ways:
  *  1. Use the embed code path supplied by Soundcloud the id of the desired location into a new Popcorn.soundcloud object.
  *     Width and height can be configured throughh CSS.
  *
  *    <div id="player_1" style="width: 500px; height: 81px"></div>
  *    <script type="text/javascript">
  *      document.addEventListener("DOMContentLoaded", function() {
  *        var popcorn = Popcorn( Popcorn.soundcloud( "player_1", "http://soundcloud.com/forss/flickermood" ));
  *      }, false);
  *    </script>
  *
  *  2. Width and height may also be configured directly with the player; this will override any CSS. This is useful for
  *     when different sizes are desired. for multiple players within the same parent container.
  *
  *     <div id="player_1"></div>
  *     <script type="text/javascript">
  *       document.addEventListener("DOMContentLoaded", function() {
  *       var popcorn = Popcorn( Popcorn.soundcloud( "player_1", "http://soundcloud.com/forss/flickermood", {
  *         width: "500",                                     // Optional, will default to CSS values
  *         height: "81"                                      // Optional, will default to CSS values
  *       }));
  *       }, false);
  *     </script>
  *
  * The player can be further configured to integrate with the SoundCloud API:
  *
  * var popcorn = Popcorn( Popcorn.soundcloud( "player_1", "http://soundcloud.com/forss/flickermood", {
  *   width: "100%",                                    // Optional, the width for the player. May also be as '##px'
  *                                                     //           Defaults to the maximum possible width
  *   height: "81px",                                   // Optional, the height for the player. May also be as '###%'
  *                                                     //           Defaults to 81px
  *   api: {                                            // Optional, information for Soundcloud API interaction
  *     key: "abcdefsdfsdf",                            // Required for API interaction. The Soundcloud API key
  *     commentdiv: "divId_for_output",                 // Required for comment retrieval, the Div Id for outputting comments.
  *     commentformat: function( comment ) {}           // Optional, a function to format a comment. Returns HTML string
  *   }
  * }));
  *
  * Comments are retrieved from Soundcloud when the player is registered with Popcorn by calling the registerWithPopcorn()
  * function. For this to work, the api_key and commentdiv attributes must be set. Comments are output by default similar to
  * how Soundcloud formats them in-player, but a custom formatting function may be supplied. It receives a comment object and
  * the current date. A comment object has:
  *
  * var comment = {
  *   start: 0,                           // Required. Start time in ms.
  *   date: new Date(),                   // Required. Date comment wasa posted.
  *   text: "",                           // Required. Comment text
  *   user: {                             // Required. Describes the user who posted the comment
  *     name: "",                         // Required. User name
  *     profile: "",                      // Required. User profile link
  *     avatar: ""                        // Required. User avatar link
  *   }
  * }
  *
  * These events are completely custom-implemented and may be subscribed to at any time:
  *   canplaythrough
  *   durationchange
  *   load
  *   loadedmetadata
  *   loadstart
  *   play
  *   readystatechange
  *   volumechange
  *
  * These events are related to player functionality and must be subscribed to during or after the load event:
  *   canplay
  *   ended
  *   error
  *   pause
  *   playing
  *   progress
  *   seeked
  *   timeupdate
  *
  * These events are not supported:
  *   abort
  *   emptied
  *   loadeddata
  *   ratechange
  *   seeking
  *   stalled
  *   suspend
  *   waiting
  *
  * Supported media attributes:
  *   autoplay ( via Popcorn )
  *   currentTime
  *   defaultPlaybackRate ( get only )
  *   duration ( get only )
  *   ended ( get only )
  *   initialTime ( get only, always 0 )
  *   loop ( get only, set by calling setLoop() )
  *   muted ( get only )
  *   paused ( get only )
  *   playbackRate ( get only )
  *   played ( get only, 0/1 only )
  *   readyState ( get only )
  *   src ( get only )
  *   volume
  *
  *   load() function
  *   mute() function ( toggles on/off )
  *   play() function
  *   pause() function
  *
  * Unsupported media attributes:
  *   buffered
  *   networkState
  *   preload
  *   seekable
  *   seeking
  *   startOffsetTime
  *
  *   canPlayType() function
  */
  
  // Trackers
  var timeupdateInterval = 33,
      timeCheckInterval = 0.25,
      abs = Math.abs,
      floor = Math.floor,
      round = Math.round,
      registry = {};
  
  function hasAllDependencies() {
    return global.swfobject && global.soundcloud;
  }
  
  // Borrowed from: http://www.quirksmode.org/dom/getstyles.html
  // Gets the style for the given element
  function getStyle( elem, styleProp ) {
    if ( elem.currentStyle ) {
      // IE way
      return elem.currentStyle[styleProp];
    } else if ( global.getComputedStyle ) {
      // Firefox, Chrome, et. al
      return document.defaultView.getComputedStyle( elem, null ).getPropertyValue( styleProp );
    }
  }
  
  function formatComment( comment ) {
    // Calclate the difference between d and now, express as "n units ago"
    function ago( d ) {
      var diff = ( ( new Date() ).getTime() - d.getTime() )/1000;
      
      function pluralize( value, unit ) {
        return value + " " + unit + ( value > 1 ? "s" : "") + " ago";
      }
      
      if ( diff < 60 ) {
        return pluralize( round( diff ), "second" );
      }    
      diff /= 60;
      
      if ( diff < 60 ) {
        return pluralize( round( diff ), "minute" );
      }    
      diff /= 60;
      
      if ( diff < 24 ) {
        return pluralize( round( diff ), "hour" );
      }
      diff /= 24;
      
      // Rough approximation of months
      if ( diff < 30 ) {
        return pluralize( round( diff ), "day" );
      }
      
      if ( diff < 365 ) {
        return pluralize( round( diff/30 ), "month" );
      }
      
      return pluralize( round( diff/365 ), "year" );
    }
    
    // Converts sec to min.sec
    function timeToFraction ( totalSec ) {
      var min = floor( totalSec / 60 ),
          sec = round( totalSec % 60 );
      
      return min + "." + ( sec < 10 ? "0" : "" ) + sec;
    }
    
    return '<div><a href="' + comment.user.profile + '">' +
           '<img width="16px height="16px" src="' + comment.user.avatar + '"></img>' +
           comment.user.name + '</a> at ' + timeToFraction( comment.start ) + ' '  +
           ago( comment.date )  +
           '<br />' + comment.text + '</span>';
  }
  
  function isReady( self ) {
    if ( !hasAllDependencies() ) {      
      setTimeout( function() {
        isReady( self );
      }, 15 );
      return;
    }
    
    var flashvars = {
      enable_api: true, 
      object_id: self._playerId,
      url: self.src,
      // Hide comments in player if showing them elsewhere
      show_comments: !self._options.api.key && !self._options.api.commentdiv
    },
    params = {
      allowscriptaccess: "always",
      // This is so we can overlay html ontop of Flash
      wmode: 'transparent'
    },
    attributes = {
      id: self._playerId,
      name: self._playerId
    },
    actualTarget = document.createElement( 'div' );
    
    actualTarget.setAttribute( "id", self._playerId );
    self._container.appendChild( actualTarget );
    
    swfobject.embedSWF( "http://player.soundcloud.com/player.swf", self._playerId, self.offsetWidth, self.height, "9.0.0", "expressInstall.swf", flashvars, params, attributes );
  }
  
  Popcorn.getScript( "http://ajax.googleapis.com/ajax/libs/swfobject/2.2/swfobject.js" );
  
  // Source file originally from 'https://github.com/soundcloud/Widget-JS-API/raw/master/soundcloud.player.api.js'
  Popcorn.getScript( "lib/soundcloud.player.api.js", function() {
    // Play event is fired twice when player is first started. Ignore second one
    var ignorePlayEvt = 1;
    
    // Register the wrapper's load event with the player
    soundcloud.addEventListener( 'onPlayerReady', function( object, data ) {
      var wrapper = registry[object.api_getFlashId()];
      
      wrapper.swfObj = object;
      wrapper.duration = object.api_getTrackDuration();
      wrapper.currentTime = object.api_getTrackPosition();
      // This eliminates volumechangee event from firing on load
      wrapper.volume = wrapper.previousVolume =  object.api_getVolume()/100;
      
      // The numeric id of the track for use with Soundcloud API
      wrapper._mediaId = data.mediaId;
      
      wrapper.dispatchEvent( 'load' );
      wrapper.dispatchEvent( 'canplay' );
      wrapper.dispatchEvent( 'durationchange' );
      
      wrapper.timeupdate();
    });
    
    // Register events for when the flash player plays a track for the first time
    soundcloud.addEventListener( 'onMediaStart', function( object, data ) {
      var wrapper = registry[object.api_getFlashId()];
      wrapper.played = 1;
      wrapper.dispatchEvent( 'playing' );
    });
    
    // Register events for when the flash player plays a track
    soundcloud.addEventListener( 'onMediaPlay', function( object, data ) {
      if ( ignorePlayEvt ) {
        ignorePlayEvt = 0;
        return;
      }
      
      var wrapper = registry[object.api_getFlashId()];
      wrapper.dispatchEvent( 'play' );
    });
    
    // Register events for when the flash player pauses a track
    soundcloud.addEventListener( 'onMediaPause', function( object, data ) {
      var wrapper = registry[object.api_getFlashId()];
      wrapper.dispatchEvent( 'pause' );
    });
    
    // Register events for when the flash player is buffering
    soundcloud.addEventListener( 'onMediaBuffering', function( object, data ) {
      var wrapper = registry[object.api_getFlashId()];
      
      wrapper.dispatchEvent( 'progress' );
      
      if ( wrapper.readyState === 0 ) { 
        wrapper.readyState = 3;
        wrapper.dispatchEvent( "readystatechange" );
      }
    });
    
    // Register events for when the flash player is done buffering
    soundcloud.addEventListener( 'onMediaDoneBuffering', function( object, data ) {
      var wrapper = registry[object.api_getFlashId()];
      wrapper.dispatchEvent( 'canplaythrough' );
    });
    
    // Register events for when the flash player has finished playing
    soundcloud.addEventListener( 'onMediaEnd', function( object, data ) {
      var wrapper = registry[object.api_getFlashId()];
      wrapper.paused = 1;
      //wrapper.pause();
      wrapper.dispatchEvent( 'ended' );
    });
    
    // Register events for when the flash player has seeked
    soundcloud.addEventListener( 'onMediaSeek', function( object, data ) {
      var wrapper = registry[object.api_getFlashId()];
      
      wrapper.setCurrentTime( object.api_getTrackPosition() );
      
      if ( wrapper.paused ) {
        wrapper.dispatchEvent( "timeupdate" );
      }
    });
    
    // Register events for when the flash player has errored
    soundcloud.addEventListener( 'onPlayerError', function( object, data ) {
      var wrapper = registry[object.api_getFlashId()];
      wrapper.dispatchEvent( 'error' );
    });
  });
  
  Popcorn.soundcloud = function( containerId, src, options ) {
    return new Popcorn.soundcloud.init( containerId, src, options );
  };
  
  // A constructor, but we need to wrap it to allow for "static" functions
  Popcorn.soundcloud.init = (function() {
    function pullFromContainer( that ) {      
      var options = that._options,
          container = that._container,
          bounds = container.getBoundingClientRect(),
          tmp,
          undef;
      
      that.width = options.width || getStyle( container, "width" ) || "100%";
      that.height = options.height || getStyle( container, "height" ) || "81px";
      that.src = options.src;
      that.autoplay = options.autoplay;
      
      if ( parseFloat( that.height, 10 ) !== 81 ) {
        that.height = "81px";
      }
      
      that.offsetLeft = bounds.left;
      that.offsetTop = bounds.top;
      that.offsetHeight = parseFloat( that.height, 10 );
      that.offsetWidth = parseFloat( that.width, 10 );
      
      // Width and height may've been specified as a %, find the value now in case a plugin needs it (like subtitle)
      if ( /[\d]+%/.test( that.width ) ) {
        tmp = getStyle( container, "width" );
        that._container.style.width = that.width;
        that.offsetWidth = that._container.offsetWidth;
        that._container.style.width = tmp;
      }
      
      if ( /[\d]+%/.test( that.height ) ) {
        tmp = getStyle( container, "height" );
        that._container.style.height = that.height;
        that.offsetHeight = that._container.offsetHeight;
        that._container.style.height = tmp;
      }
    }
  
    // If container id is not supplied, assumed to be same as player id
    var ctor = function ( containerId, src, options ) {
      if ( !containerId ) {
        throw "Must supply an id!";
      } else if ( !src ) {
        throw "Must supply a source!";
      } else if ( /file/.test( location.protocol ) ) {
        throw "Must run from a web server!";
      }
      
      var container = this._container = document.getElementById( containerId );
      
      if ( !container ) {
        throw "Could not find that container in the DOM!";
      }
      
      options = options || {};
      options.api = options.api || {};
      options.target = containerId;
      options.src = src;
      options.api.commentformat = options.api.commentformat || formatComment;
      
      this._mediaId = 0;
      this._listeners = {};
      this._playerId = Popcorn.guid( options.target );
      this._containerId = options.target;
      this._options = options;
      this._comments = [];
      this._popcorn;
      
      pullFromContainer( this );
      
      this.duration = 0;
      this.volume = 1;
      this.currentTime = 0;
      this.ended = 0;
      this.paused = 1;
      this.readyState = 0;
      this.playbackRate = 1;
      
      this.top = 0;
      this.left = 0;
      
      this.autoplay;
      this.played = 0;
      
      this.addEventListener( "load", function() {
        var boundRect = this.getBoundingClientRect();
    
        this.top = boundRect.top;
        this.left = boundRect.left;
        
        this.offsetWidth = this.swfObj.offsetWidth;
        this.offsetHeight = this.swfObj.offsetHeight;
        this.offsetLeft = this.swfObj.offsetLeft;
        this.offsetTop = this.swfObj.offsetTop;
      });
      
      registry[ this._playerId ] = this;
      isReady( this );
    };
    return ctor;
  })();
  
  Popcorn.soundcloud.init.prototype = Popcorn.soundcloud.prototype;
  
  // Sequence object prototype
  Popcorn.extend( Popcorn.soundcloud.prototype, {
    // Set the volume as a value between 0 and 1
    setVolume: function( val ) {
      if ( !val && val !== 0 ) {
        return;
      }
      
      // Normalize in case outside range of expected values of 0 .. 1
      if ( val < 0 ) {
        val = -val;
      }
      
      if ( val > 1 ) {
        val %= 1;
      }
      
      // HTML video expects to be 0.0 -> 1.0, Flash object expects 0-100
      this.volume = this.previousVolume = val;
      this.swfObj.api_setVolume( val*100 );
      this.dispatchEvent( "volumechange" );
    },
    // Seeks the video
    setCurrentTime: function ( time ) {
      if ( !time && time !== 0 ) {
        return;
      }
      
      this.currentTime = this.previousCurrentTime = time;
      this.ended = time >= this.duration;
      
      // Fire events for seeking and time change
      this.dispatchEvent( "seeked" );
    },
    // Play the video
    play: function() {
      // In case someone is cheeky enough to try this before loaded
      if ( !this.swfObj ) {
        this.addEventListener( "load", this.play );
        return;
      } else if ( !this.paused ) {
        // No need to process if already playing
        return;
      }
      
      this.paused = 0;
      this.swfObj.api_play();
    },
    // Pause the video
    pause: function() {
      // In case someone is cheeky enough to try this before loaded
      if ( !this.swfObj ) {
        this.addEventListener( "load", this.pause );
        return;
      } else if ( this.paused ) {
        // No need to process if already playing
        return;
      }
      
      this.paused = 1;
      this.swfObj.api_pause();
    },
    // Toggle video muting
    // Unmuting will leave it at the old value
    mute: function() {
      // In case someone is cheeky enough to try this before loaded
      if ( !this.swfObj ) {
        this.addEventListener( "load", this.mute );
        return;
      }
      
      if ( !this.muted() ) {
        this.oldVol = this.volume;
        
        if ( this.paused ) {
          this.setVolume( 0 );
        } else {
          this.volume = 0;
        }
      } else {
        if ( this.paused ) {
          this.setVolume( this.oldVol );
        } else {
          this.volume = this.oldVol;
        }
      }
    },
    muted: function() {
      return this.volume === 0;
    },
    // Force loading by playing the player. Pause afterwards
    load: function() {
      // In case someone is cheeky enough to try this before loaded
      if ( !this.swfObj ) {
        this.addEventListener( "load", this.load );
        return;
      }
      
      this.play();
      this.pause();
    },
    // Hook an event listener for the player event into internal event system
    // Stick to HTML conventions of add event listener and keep lowercase, without prepending "on"
    addEventListener: function( evt, fn ) {
      if ( !this._listeners[evt] ) {
        this._listeners[evt] = [];
      }
      
      this._listeners[evt].push( fn );
      return fn;
    },
    dispatchEvent: function( evt ) {
      var self = this,
          evtName = evt.type || evt;
          
      // Manually triggered a UI event, have it invoke rather than just the event handlers
      if ( evtName === "play" && this.paused || evtName === "pause" && !this.paused ) {
        this[evtName]();
        return;
      }
      
      Popcorn.forEach( this._listeners[evtName], function( fn ) {
        fn.call( self );
      });
    },
    timeupdate: function() {
      var self = this,
          checkedVolume = this.swfObj.api_getVolume()/100,
          seeked = 0;
      
      // If has been changed through setting currentTime attribute
      if ( abs( this.currentTime - this.previousCurrentTime ) > timeCheckInterval ) {
        // Has programatically set the currentTime
        this.swfObj.api_seekTo( this.currentTime );
        seeked = 1;
      } else {
        this.previousCurrentTime = this.currentTime = this.swfObj.api_getTrackPosition();
      }
      
      // If has been changed throughh volume attribute
      if ( checkedVolume !== this.previousVolume ) {
        this.setVolume( checkedVolume );
      } else if ( this.volume !== this.previousVolume ) {
        this.setVolume( this.volume );
      }
      
      if ( !this.paused ) {
        this.dispatchEvent( 'timeupdate' );
      }
      
      if( !self.ended ) {
        setTimeout( function() {
          self.timeupdate.call( self );
        }, timeupdateInterval);
      }
    },
    
    getBoundingClientRect: function() {
      var b,
          self = this;
          
      if ( this.swfObj ) {
        b = this.swfObj.getBoundingClientRect();
        
        return {
          bottom: b.bottom,
          left: b.left,
          right: b.right,
          top: b.top,
          
          //  These not guaranteed to be in there
          width: b.width || ( b.right - b.left ),
          height: b.height || ( b.bottom - b.top )
        };
      } else {
        //container = document.getElementById( this.playerId );
        tmp = this._container.getBoundingClientRect();
        
        // Update bottom, right for expected values once the container loads
        return {
          left: tmp.left,
          top: tmp.top,
          width: self.offsetWidth,
          height: self.offsetHeight,
          bottom: tmp.top + this.width,
          right: tmp.top + this.height
        };
      }
    },
    
    registerPopcornWithPlayer: function( popcorn ) {
      if ( !this.swfObj ) {
        this.addEventListener( "load", function() {
          this.registerPopcornWithPlayer( popcorn );
        });
        return;
      }
      
      this._popcorn = popcorn;
      
      var api = this._options.api;
      
      if ( api.key && api.commentdiv ) {
        var self = this;
        
        Popcorn.xhr({
          url: "http://api.soundcloud.com/tracks/" + self._mediaId + "/comments.js?consumer_key=" + api.key,
          success: function( data ) {
            Popcorn.forEach( data.json, function ( obj ) {
              self.addComment({
                start: obj.timestamp/1000,
                date: new Date( obj.created_at ),
                text: obj.body,
                user: {
                  name: obj.user.username,
                  profile: obj.user.permalink_url,
                  avatar: obj.user.avatar_url
                }
              });
            });
          }
        });
      }
    }
  });
  
  Popcorn.extend( Popcorn.soundcloud.prototype, {
    addComment: function( obj, displayFn ) {
      var self = this,
          comment = {
            start: obj.start || 0,
            date: obj.date || new Date(),
            text: obj.text || "",
            user: {
              name: obj.user.name || "",
              profile: obj.user.profile || "",
              avatar: obj.user.avatar || ""
            },
            display: function() {
              return ( displayFn || self._options.api.commentformat )( comment );
            }
          };
      
      this._comments.push( comment );
      
      if ( !this._popcorn ) {
        return;
      }
      
      this._popcorn.subtitle({
        start: comment.start,
        target: this._options.api.commentdiv,
        display: 'inline',
        language: 'en',
        text: comment.display()
      });
    }
  });
})( Popcorn, window );