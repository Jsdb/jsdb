/**
 * TSDB version : VERSION_TAG
 */
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Firebase = require('firebase');
var PromiseModule = require('es6-promise');
var Promise = PromiseModule.Promise;
var Version = 'VERSION_TAG';
/**
 * The main Db module.
 */
var Db;
(function (Db) {
    /**
     * Create a database instance using given configuration. The first call to this function
     * will also initialize the {@link defaultDb}.
     *
     * TODO extend on the configuration options
     *
     * @return An initialized and configured db instance
     */
    function configure(conf) {
        if (!defaultDb) {
            defaultDb = Db.Internal.createDb(conf);
            return defaultDb;
        }
        else {
            return Db.Internal.createDb(conf);
        }
    }
    Db.configure = configure;
    function of(e) {
        var ge = entEvent.get(e);
        if (!ge)
            return null;
        return ge.state.db;
    }
    Db.of = of;
    /**
     * Return the {@link defaultDb} if any has been created.
     */
    function getDefaultDb() {
        return defaultDb;
    }
    Db.getDefaultDb = getDefaultDb;
    var Api;
    (function (Api) {
        /**
         * Various kind of events that can be triggered when using {@link EventDetails}.
         */
        (function (EventType) {
            /**
             * Unknown event type.
             */
            EventType[EventType["UNDEFINED"] = 0] = "UNDEFINED";
            /**
             * The value has been loaded, used on entities and on collections on first loading of an entity.
             */
            EventType[EventType["LOAD"] = 1] = "LOAD";
            /**
             * The value has been updated, used on entities when there was a change and on collections when an elements
             * is changed or has been reordered.
             */
            EventType[EventType["UPDATE"] = 2] = "UPDATE";
            /**
             * The value has been removed, used on root entities when they are deleted, embedded and references when
             * they are nulled, references also when the referenced entity has been deleted, and on collections when
             * an element has been removed from the collection.
             */
            EventType[EventType["REMOVED"] = 3] = "REMOVED";
            /**
             * The value has been added, used on collections when a new element has been added.
             */
            EventType[EventType["ADDED"] = 4] = "ADDED";
            /**
             * Special event used on collection to notify that the collection has finished loading, and following
             * events will be updates to the previous state and not initial population of the collection.
             */
            EventType[EventType["LIST_END"] = 5] = "LIST_END";
        })(Api.EventType || (Api.EventType = {}));
        var EventType = Api.EventType;
    })(Api = Db.Api || (Db.Api = {}));
    /**
     * Internal module, most of the stuff inside this module are either internal use only or exposed by other methods,
     * they should never be used directly.
     */
    var Internal;
    (function (Internal) {
        /**
         * Creates a Db based on the given configuration.
         */
        function createDb(conf) {
            var state = new DbState();
            state.configure(conf);
            var db = function (param) {
                if (lastExpect === lastCantBe) {
                    if (param)
                        clearLastStack();
                }
                else if (param !== lastExpect) {
                    clearLastStack();
                }
                var e = lastEntity;
                var stack = lastMetaPath;
                clearLastStack();
                // if no arguments return operations
                if (arguments.length == 0) {
                    return new DbOperations(state);
                }
                // Pass-thru for when db(something) is used also when not needed
                if (param instanceof GenericEvent)
                    return param;
                if (typeof param == 'function') {
                    return state.entityRoot(param);
                }
                else if (!e) {
                    e = param;
                }
                var ret = state.createEvent(e, stack);
                return ret;
            };
            state.db = db;
            return db;
        }
        Internal.createDb = createDb;
        /**
         * Implementation of {@link IDbOperations}.
         */
        var DbOperations = (function () {
            function DbOperations(state) {
                this.state = state;
            }
            DbOperations.prototype.fork = function (conf) {
                var nconf = {};
                Utils.copyObj(this.state.conf, nconf);
                Utils.copyObj(conf, nconf);
                return createDb(nconf);
            };
            DbOperations.prototype.load = function (url) {
                return this.state.load(url);
            };
            DbOperations.prototype.reset = function () {
                this.state.reset();
            };
            DbOperations.prototype.erase = function () {
                this.reset();
                new Firebase(this.state.getUrl()).remove();
            };
            return DbOperations;
        })();
        Internal.DbOperations = DbOperations;
        /**
         * Implementation of {@link IBinding}.
         */
        var BindingImpl = (function () {
            function BindingImpl() {
                this.keys = [];
                this.bindings = {};
                this.live = {};
            }
            BindingImpl.prototype.bind = function (local, remote, live) {
                if (live === void 0) { live = true; }
                this.keys.push(local);
                this.bindings[local] = remote;
                this.live[local] = live;
                return this;
            };
            /**
             * Start pre-loading bound fields.
             *
             * It will search on the parent the required fields and trigger a "load". Load is implemented in
             * {@link IEntityOrReferenceEvent}, {@link IMapEvent} and {@link IListSetEvent}, and in all of them it
             * returns a promise that is fulfilled when the given field is completely loaded.
             *
             * All the returned promises are then executed in parallel using Promise.all and the results
             * combined in the {@link BindingState} of the returned promise.
             *
             * This phase executes in parallel with the loading of the target entity.
             *
             * @param metadata the class metadata of the parent entity
             * @param state the db state to operate on
             * @param parent the parent entity instance
             */
            BindingImpl.prototype.startLoads = function (metadata, state, parent) {
                var proms = [];
                var evts = [];
                for (var i = 0; i < this.keys.length; i++) {
                    var k = this.keys[i];
                    if (k === 'this') {
                        proms.push(Promise.resolve(parent));
                        continue;
                    }
                    var descr = metadata.descriptors[k];
                    if (!descr)
                        throw Error('Cannot find ' + k + ' for binding');
                    var evt = state.createEvent(parent, [descr]);
                    evts.push(evt);
                    if (evt['load']) {
                        proms.push(evt.load(parent));
                    }
                }
                return Promise.all(proms).then(function (vals) {
                    return {
                        vals: vals,
                        evts: evts
                    };
                });
            };
            /**
             * Completes the binding once the target entity completed loading and the Promise returned by
             * {@link startLoads} completes.
             *
             * It sets all the values found in the "result", and optionally subscribes to the
             * "updated" event to keep the value live. For references, the updated event is also
             * trigger on reference change, so the value will be kept in sync.
             *
             */
            BindingImpl.prototype.resolve = function (tgt, result) {
                var _this = this;
                var vals = result.vals;
                var evts = result.evts;
                //console.log("Done values ", vals);
                for (var i = 0; i < this.keys.length; i++) {
                    var k = this.keys[i];
                    var val = vals[i];
                    if (val instanceof EventDetails) {
                        val = val.payload;
                    }
                    if (this.live[k]) {
                        var evt = evts[i];
                        if (!evt['updated'])
                            throw new Error('Cannot find an updated event to keep ' + k + ' live');
                        // Wrapping in closure for 'k'
                        (function (k) {
                            evt.updated(tgt, function (updet) {
                                // TODO if the target event is a collection, updated payload will not contain the full collection
                                tgt[_this.bindings[k]] = updet.payload;
                            });
                        })(k);
                    }
                    else {
                        tgt[this.bindings[k]] = val;
                    }
                }
            };
            return BindingImpl;
        })();
        Internal.BindingImpl = BindingImpl;
        /**
         * Class describing an event from the Db. It is used in every listener callback.
         */
        var EventDetails = (function () {
            function EventDetails() {
                /**
                 * The type of the event, see {@link EventType}.
                 */
                this.type = Api.EventType.UNDEFINED;
                /**
                 * The payload of the event.
                 *
                 * For entities, it is an instance of the entity. In collections, it is the value that has been
                 * added, removed or updated.
                 */
                this.payload = null;
                /**
                 * True during initial population of a collection, false when later updating the collection values.
                 */
                this.populating = false;
                /**
                 * True if an entity has been populated only with projected values (see {@link reference}), false
                 * if instead values are fresh from the main entry in the database.
                 */
                this.projected = false;
                /**
                 * Original underlying database event.
                 *
                 * TODO remove this, it exposes underlying informations that could not be stable
                 */
                this.originalEvent = null;
                /**
                 * Original event url.
                 *
                 * TODO maybe whe should remove this, as it exposes potentially dangerous informations
                 */
                this.originalUrl = null;
                /**
                 * Key on which the event originated. On a root entity, it is the id of the entity; on an embedded
                 * it's the name of the field; on a reference it could be the name of the field (if the
                 * reference has changed) or the id (or field name) of the referenced entity; on a collection
                 * it's the key that has been added, removed or changed.
                 */
                this.originalKey = null;
                /**
                 * Preceding key in the current sorting order. This is useful only on collections, and it's mostly
                 * useful when the order of the elements in the collection has changed.
                 */
                this.precedingKey = null;
                /**
                 * The event handler that is broadcasting this event.
                 */
                this.handler = null;
                /**
                 * True if {@link offMe} was called.
                 */
                this.offed = false;
            }
            EventDetails.prototype.setHandler = function (handler) {
                this.handler = handler;
            };
            /**
             * Detaches the current listener, so that the listener will not receive further events
             * and resources can be released.
             */
            EventDetails.prototype.offMe = function () {
                this.handler.offMe();
                this.offed = true;
            };
            /**
             * @returns true if {@link offMe} was called.
             */
            EventDetails.prototype.wasOffed = function () {
                return this.offed;
            };
            /**
             * Creates an equivalent copy of this instance.
             */
            EventDetails.prototype.clone = function () {
                var ret = new EventDetails();
                ret.type = this.type;
                ret.payload = this.payload;
                ret.populating = this.populating;
                ret.projected = this.projected;
                ret.originalEvent = this.originalEvent;
                ret.originalUrl = this.originalUrl;
                ret.originalKey = this.originalKey;
                ret.precedingKey = this.precedingKey;
                return ret;
            };
            return EventDetails;
        })();
        Internal.EventDetails = EventDetails;
        /**
         * Generic binding between a {@link GenericEvent} and a callback function that consume {@link EventDetails}.
         */
        var EventHandler = (function () {
            /**
             * @param ctx the {@link ctx} context object for this handler
             * @param callback the {@link callback} for this handler
             * @param discriminator the optional {@link discriminator} for this handler
             */
            function EventHandler(ctx, callback, discriminator) {
                if (discriminator === void 0) { discriminator = null; }
                /** Progressive number of this handler, for debug purposes */
                this.myprog = EventHandler.prog++;
                /**
                 * A discriminator, used to differentiate between two different handlers that happen to have
                 * the same context and the same callback.
                 */
                this.discriminator = null;
                //after: (h?:EventHandler)=>any;
                /**
                 * true is this handler was canceled.
                 */
                this.canceled = false;
                this.ctx = ctx;
                this.callback = callback;
                this.discriminator = discriminator;
            }
            /**
             * @returns true if the given handler has same {@link ctx}, {@link callback} and eventually {@link discrimnator} as this one.
             */
            EventHandler.prototype.equals = function (oth) {
                return this.ctx == oth.ctx && this.callback == oth.callback && this.discriminator == oth.discriminator;
            };
            /**
             * Decommission (cancel) this handler, only if the "remove" parameter is true.
             *
             * @param remove if true decommiission this handler, otherwise not.
             * @return the same value of "remove" parameter.
             */
            EventHandler.prototype.decomission = function (remove) {
                // override off, must remove only this instance callbacks, Firebase does not
                if (remove) {
                    this.canceled = true;
                }
                return remove;
            };
            /**
             * Handles the given {@link EventDetails}.
             *
             * The EventDetails will be cloned, connected to this handler, and the the callback will be invoked.
             */
            EventHandler.prototype.handle = function (evd) {
                if (this.canceled) {
                    console.warn(this.myprog + " : Receiving events on canceled handler", evd);
                    console.trace();
                    return;
                }
                //console.log("Handling", evd);
                //console.trace();
                evd = evd.clone();
                evd.setHandler(this);
                // the after is executed before to avoid bouncing
                //if (this.after) this.after(this);
                try {
                    this.callback.call(this.ctx, evd);
                }
                finally {
                }
                //console.log("Then calling", this.after);
            };
            /**
             * Ask to the bound {@link event} to decommission this handler.
             */
            EventHandler.prototype.offMe = function () {
                this.event.offHandler(this);
            };
            /** Holder for progressive number of the handler, for debug purposes */
            EventHandler.prog = 1;
            return EventHandler;
        })();
        Internal.EventHandler = EventHandler;
        /**
         * A specialized EventHandler that also holds registered callbacks on the underlying database.
         *
         * This handler does not directly react to database events, it simply hooks them to a given callback
         * passed in {@link hook}. However, since usually when a handler is decommissioned also underlying
         * database resources can be released, having them encapsulated in the same instance is easier and
         * less error prone.
         */
        var DbEventHandler = (function (_super) {
            __extends(DbEventHandler, _super);
            function DbEventHandler() {
                _super.apply(this, arguments);
                /**
                 * The callbacks registered by this handler on the underlying database reference.
                 */
                this.cbs = [];
            }
            /**
             * Hooks to the underlying database.
             *
             * @param event the event to hook to
             * @param fn the callback to hook to the database
             */
            DbEventHandler.prototype.hook = function (event, fn) {
                if (this.canceled)
                    return;
                this.cbs.push({ event: event, fn: fn });
                // TODO do something on cancelCallback? It's here only because of method signature
                this.ref.on(event, fn, function (err) { });
            };
            /**
             * Extends the decommission function to also detach database callbacks registered thru {@link hook}.
             */
            DbEventHandler.prototype.decomission = function (remove) {
                // override off, must remove only this instance callbacks, Firebase does not
                if (remove) {
                    for (var i = 0; i < this.cbs.length; i++) {
                        var cb = this.cbs[i];
                        this.ref.off(cb.event, cb.fn);
                    }
                }
                return _super.prototype.decomission.call(this, remove);
            };
            return DbEventHandler;
        })(EventHandler);
        Internal.DbEventHandler = DbEventHandler;
        /**
         * Base class of all events.
         *
         * Events are responsible of :
         * - Holding informations about the current state of part of the underlying Db
         * - Managing a list of {@link EventHandler}s interested in that part of the Db.
         * - Generating {@link EventDetails} when something happens on that part of the Db
         * - Dispatch the EventDetails to all the EventHandlers in the list.
         *
         * Events are organized in a hierarchy, having multiple {@link EntityRoot} as roots.
         *
         */
        var GenericEvent = (function () {
            function GenericEvent() {
                /** The children of this event */
                this.children = {};
                /** Dependant events */
                this.dependants = [];
                /** The class meta data this event operates on */
                this._classMeta = null;
                /** The declared class meta data for this event, cause {@link _classMeta} could change in case of polimorphic classes */
                this._originalClassMeta = null;
                /** Array of current registered handlers. */
                this.handlers = [];
            }
            /**
             * Set the entity this event works on.
             *
             * The event is registered as pertaining to the given entity using the {@link DbState.entEvent} {@link WeakWrap}.
             */
            GenericEvent.prototype.setEntity = function (entity) {
                this.entity = entity;
                if (entity && typeof entity == 'object') {
                    this.state.bindEntity(this.entity, this);
                }
                // TODO clean the children if entity changed? they could be pointing to old instance data
            };
            Object.defineProperty(GenericEvent.prototype, "classMeta", {
                /**
                 * Get the {@link _classMeta} this event works on.
                 */
                get: function () {
                    return this._classMeta;
                },
                /**
                 * Set the {@link _classMeta} this event works on.
                 */
                set: function (meta) {
                    if (!this._originalClassMeta)
                        this._originalClassMeta = meta;
                    this._classMeta = meta;
                    // TODO clean the children that are not actual anymore now that the type changed?
                },
                enumerable: true,
                configurable: true
            });
            Object.defineProperty(GenericEvent.prototype, "originalClassMeta", {
                /**
                 * Set the {@link _originalClassMeta} this event works on.
                 */
                get: function () {
                    return this._originalClassMeta;
                },
                enumerable: true,
                configurable: true
            });
            /**
             * Return this url this event is relative to.
             *
             * Each event is relative to a path segment, and combining this segment
             * with anchestor events (up to the {@link EntityRoot}) yields the complete url.
             *
             * However, events could be initially not connected to the full hierarchy (also see
             * {@link urlInited}), but still have a partial url fragment.
             *
             * Normally this method return null if the event is not connected to the
             * full events hierarchy. If however the "evenIfIncomplete" parameter is true it
             * will return the partial path fragment.
             *
             * @param evenIfIncomplete if true will return the partial fragment even if the event is not
             * 			connected to the complete events hierarchy.
             */
            GenericEvent.prototype.getUrl = function (evenIfIncomplete) {
                if (evenIfIncomplete === void 0) { evenIfIncomplete = false; }
                if (!this.parent) {
                    if (this.url)
                        return this.url;
                    if (!evenIfIncomplete)
                        return null;
                    if (!this.entity)
                        return "<Unknown instance>";
                    return "<Unknown instance of " + Utils.findName(this.entity.constructor) + ">";
                }
                var pre = this.parent.getUrl(evenIfIncomplete);
                if (pre == null)
                    return null;
                return pre + this.url + '/';
            };
            /**
             * Triggered when this events has been connected to the events hierarchy (either directly
             * or indirectly by one of its anchestors). After this method is called, calling {@link getUrl}
             * will yield a complete Url.
             */
            GenericEvent.prototype.urlInited = function () {
                for (var i = 0; i < this.handlers.length; i++) {
                    this.init(this.handlers[i]);
                }
                for (var k in this.children) {
                    if (k == 'constructor')
                        continue;
                    this.children[k].urlInited();
                }
                // Propagate also to dependants
                for (var i = 0; i < this.dependants.length; i++) {
                    this.dependants[i].urlInited();
                }
                // Dependants are not needed after the url init has been propagated
                this.dependants = [];
                this.saveChildrenInCache();
            };
            /**
             * Registers an event handler on this event.
             *
             * If there is already an event handler with same ctx, callback and discriminator, it will be removed
             * before the given one is added.
             *
             * If the event is already linked to the events hierarchy, the handler will be inited
             * by {@link init}.
             */
            GenericEvent.prototype.on = function (handler) {
                this.handlers = this.handlers.filter(function (h) { return !h.decomission(h.equals(handler)); });
                handler.event = this;
                this.handlers.push(handler);
                // At this point the url could not yet have been set
                if (this.getUrl(false)) {
                    this.init(handler);
                }
            };
            /**
             * Unregisters and decommissions all the {@link EventHandler}s registered using {@link on} that
             * have the given ctx and 8if specified) the given callback.
             */
            GenericEvent.prototype.off = function (ctx, callback) {
                if (callback) {
                    this.handlers = this.handlers.filter(function (h) { return !h.decomission(h.ctx === ctx && h.callback === callback); });
                }
                else {
                    this.handlers = this.handlers.filter(function (h) { return !h.decomission(h.ctx === ctx); });
                }
            };
            /**
             * Unregisters and decommissions a specific handler.
             */
            GenericEvent.prototype.offHandler = function (h) {
                h.decomission(true);
                this.handlers = this.handlers.filter(function (ch) { return ch !== h; });
            };
            /**
             * Unregisters and decommissions all the handlers registered on this event.
             */
            GenericEvent.prototype.offAll = function () {
                this.handlers = this.handlers.filter(function (h) { return !h.decomission(true); });
            };
            /**
             * Initializes an EventHandler that hs been registered with this event.
             *
             * This initialization will occurr as soon as the handler is registered using
             * {@link on} or it could be delayed to when this events gets connected to the
             * events hierarchy.
             *
             * This method must be overridden in subclasses, depending on the kind of event
             * and event handler they use.
             */
            GenericEvent.prototype.init = function (h) {
                throw new Error("Implement init in GenericEvent subclasses");
            };
            /**
             * Utility method to broadcast the given EventDEtails to all the registered
             * {@link EventHandler}s.
             */
            GenericEvent.prototype.broadcast = function (ed) {
                this.handlers.filter(function (h) { h.handle(ed); return true; });
            };
            /**
             * Find or create a child event.
             *
             * Given the name or the {@link MetaDescriptor} of the child, an existing children
             * will be searched in {@link children}.
             *
             * If not found:
             * - a new event will be created calling {@link MetaDescriptor.createEvent}
             * - it will be wired to this event setting its {@link parent}
             * - if this event is working on an entity the new event's {@link setEntity} method will be called
             * with the pertaining field, if any.
             */
            GenericEvent.prototype.findCreateChildFor = function (metaOrkey, force) {
                if (force === void 0) { force = false; }
                var meta = null;
                if (metaOrkey instanceof MetaDescriptor) {
                    meta = metaOrkey;
                }
                else {
                    meta = this.classMeta.descriptors[metaOrkey];
                }
                if (!meta)
                    return null;
                var ret = this.children[meta.localName];
                if (ret && !force)
                    return ret;
                if (ret && this.entity) {
                    ret.setEntity(this.entity[meta.localName]);
                    return ret;
                }
                ret = meta.createEvent(this.state.myMeta);
                ret.state = this.state;
                ret.parent = this;
                if (this.entity) {
                    ret.setEntity(this.entity[meta.localName]);
                }
                this.children[meta.localName] = ret;
                // TODO should we give then urlInited if the url is already present?
                this.saveChildrenInCache();
                return ret;
            };
            /**
             * Save the children of this event to the {@link DbState} cache.
             *
             * @param key if a specific key is given, only that children will be saven in the cache.
             */
            GenericEvent.prototype.saveChildrenInCache = function (key) {
                if (!this.getUrl())
                    return;
                if (key) {
                    this.state.storeInCache(this.children[key]);
                }
                else {
                    for (var k in this.children) {
                        this.state.storeInCache(this.children[k]);
                    }
                }
            };
            /**
             * Adds a dependant event.
             *
             * Dependants, like children events, depenend on their parent for proper initialization,
             * Url resolution and other functionalities.
             *
             * Unlike children events, however, they are not attached permanently to their parent.
             *
             * This method stores them in the {@link dependants} array only if {@link getUrl} is currently
             * returning null, and only up to when the {@link urlInited} method gets called, which usually
             * means this event is properly initialized and children and dependant events can initialize
             * themselves accordingly.
             */
            GenericEvent.prototype.addDependant = function (dep) {
                dep.parent = this;
                dep.state = this.state;
                // We don't need to save dependants if we already have an url, just send them the urlInited
                if (!this.getUrl()) {
                    this.dependants.push(dep);
                }
                else {
                    dep.urlInited();
                }
            };
            /**
             * Parse a value arriving from the Db.
             *
             * This method must be overridden by subclasses.
             *
             * The noral behaviour is to parse the given database data and apply it to
             * the {@link entity} this event is working on.
             */
            GenericEvent.prototype.parseValue = function (ds) {
                throw new Error("Please override parseValue in subclasses of GenericEvent");
            };
            /**
             * Return true if this event creates a logica "traversal" on the normal tree structure
             * of events. For example, a reference will traverse to another branch of the tree, so it's
             * children will not be grandchildren of its parent.
             */
            GenericEvent.prototype.isTraversingTree = function () {
                return false;
            };
            /**
             * If {@link isTraversingTree} returns true, then getTraversed returns the event
             * to which this events makes a traversal to.
             *
             * TODO this has not been implemented by relevant subclasses, like ReferenceEvent. Moreover,+
             * until we don't load the reference we don't know how to properly init the event (cause eventually
             * we would need to reuse an existing one from the cache).
             */
            GenericEvent.prototype.getTraversed = function () {
                return null;
            };
            /**
             * Serialize the {@link entity} to persist it on the Db.
             *
             * This method must be overridden by subclasses.
             *
             * This is the logical opposite of {@link parseValue}.
             */
            GenericEvent.prototype.serialize = function (localsOnly, fields) {
                if (localsOnly === void 0) { localsOnly = false; }
                throw new Error("Please override serialize in subclasses of GenericEvent");
            };
            /**
             * Denotes that this event represent a "local" value during serialization.
             *
             * A local value is a value that gets saved together with native values on the
             * {@link entity} and not on a separate node of the database tree.
             */
            GenericEvent.prototype.isLocal = function () {
                return false;
            };
            return GenericEvent;
        })();
        Internal.GenericEvent = GenericEvent;
        /**
         * An utility base class for events that deal with a single databse reference.
         *
         * It spawns a single {@link DbEventHandler} hooking database events to the {@link handleDbEvent} function.
         * This function does a default parsing of the data, delegating to {@link parseValue}, and creates
         * an {@link EventDetails} that is then dispatched to registered {@link EventHandler}s.
         *
         * It stores most recent EventDetails to quickly dispatch it to handler that gets registered
         * after the db has already been hooked.
         *
         * It also keeps the {@link loaded} boolean and offer base implementation of {@link isLoaded} and {@link assertLoaded}.
         */
        var SingleDbHandlerEvent = (function (_super) {
            __extends(SingleDbHandlerEvent, _super);
            function SingleDbHandlerEvent() {
                _super.apply(this, arguments);
                /** true if data has been loaded */
                this.loaded = false;
                /**
                 * The only instance of DbEventHandler used, it gets hooked to {@link handleDbEvent} when needed
                 * and decommissioned when not needed anymore.
                 */
                this.dbhandler = null;
                /** Most recent EventDetails, used to bootstrap new EventHandlers registered after the first data has been received. */
                this.lastDetail = null;
            }
            /**
             * Initializes the given handler.
             *
             * If the {@link dbHandler} has not yet been initialized, it gets initialized and hooked to the db. It
             * will later trigger {@link handleDbevent} which will create and dispach an {@link EventDetails} to
             * registered handlers.
             *
             * If instead it is already hooked to the db, and has already received db events and created an EventDetails,
             * it reuses it (from {@link lastDetail}) to bootstrap the newly added handler.
             */
            SingleDbHandlerEvent.prototype.init = function (h) {
                var _this = this;
                if (this.dbhandler == null) {
                    this.lastDetail = null;
                    this.dbhandler = new DbEventHandler(this, this.mockCb);
                    // TODO this should not be here, the url could be not yet set
                    // TODO are you sure? the init of handlers should be after the url is set
                    this.dbhandler.ref = new Firebase(this.getUrl());
                    this.dbhandler.hook('value', function (ds, prev) { return _this.handleDbEvent(ds, prev); });
                }
                else {
                    if (this.lastDetail) {
                        h.handle(this.lastDetail);
                    }
                }
            };
            /** Useless callback */
            SingleDbHandlerEvent.prototype.mockCb = function () { };
            /**
             * Does what specified in {@link GenericEvent.off}, then invokes {@link checkDisconnect} to
             * decommission the {@link dbhandler}.
             */
            SingleDbHandlerEvent.prototype.off = function (ctx, callback) {
                _super.prototype.off.call(this, ctx, callback);
                this.checkDisconnect();
            };
            /**
             * Does what specified in {@link GenericEvent.offHandler}, then invokes {@link checkDisconnect} to
             * decommission the {@link dbhandler}.
             */
            SingleDbHandlerEvent.prototype.offHandler = function (h) {
                _super.prototype.offHandler.call(this, h);
                this.checkDisconnect();
            };
            /**
             * Does what specified in {@link GenericEvent.offAll}, then invokes {@link checkDisconnect} to
             * decommission the {@link dbhandler}.
             */
            SingleDbHandlerEvent.prototype.offAll = function () {
                _super.prototype.offAll.call(this);
                this.checkDisconnect();
            };
            /**
             * If there are no more {@link EventHandler}s listening on this event, then it decommissions the
             * {@link dbhandler} and clears {@link lastDetail}.
             */
            SingleDbHandlerEvent.prototype.checkDisconnect = function () {
                if (this.handlers.length == 0) {
                    if (this.dbhandler) {
                        this.dbhandler.decomission(true);
                        this.dbhandler = null;
                    }
                    this.lastDetail = null;
                }
            };
            /**
             * Upon receiving data from the database, it creates an {@link EventDetails} object
             * based on current state and received data, and {@link broadcast}s it.
             */
            SingleDbHandlerEvent.prototype.handleDbEvent = function (ds, prevName, projected) {
                if (projected === void 0) { projected = false; }
                var evd = new EventDetails();
                evd.type = Api.EventType.UPDATE;
                if (!this.loaded) {
                    evd.type = Api.EventType.LOAD;
                }
                this.parseValue(ds);
                if (this.entity == null) {
                    evd.type = Api.EventType.REMOVED;
                }
                evd.payload = this.entity;
                evd.originalEvent = 'value';
                evd.originalUrl = ds.ref().toString();
                evd.originalKey = ds.key();
                evd.precedingKey = prevName;
                evd.projected = projected;
                if (!projected)
                    this.loaded = true;
                this.lastDetail = evd;
                this.broadcast(this.lastDetail);
            };
            SingleDbHandlerEvent.prototype.isLoaded = function () {
                return this.loaded;
            };
            SingleDbHandlerEvent.prototype.assertLoaded = function () {
                if (!this.loaded)
                    throw new Error("Data at url " + this.getUrl() + " is not loaded");
            };
            return SingleDbHandlerEvent;
        })(GenericEvent);
        Internal.SingleDbHandlerEvent = SingleDbHandlerEvent;
        /**
         * Implementation of IEntityOrReferenceEvent for root and {@link embedded} entities.
         *
         * It handles the most important parts of entity serialization, deserialization and synchronization :
         * - correctly parsing and materializing an entity in local ram, in {@link parseValue}
         * - correctly serializing an entity, taking into consideration what was loaded and what not in (@link serialize}
         * - issue a complete load or a partial update in {@link save}
         * - honour the {@link bind} directives using {@link BindingImpl}
         * - assign a generated id to {@link root} entities in {@link assignUrl}
         */
        var EntityEvent = (function (_super) {
            __extends(EntityEvent, _super);
            function EntityEvent() {
                _super.apply(this, arguments);
                /**
                 * Local (ram, javascript) name of the entity represented by this event on the parent entity.
                 */
                this.nameOnParent = null;
                /**
                 * If given, binding directives.
                 */
                this.binding = null;
                /**
                 * If we are loading this entity, this promise is loading the bound entities if eny.
                 */
                this.bindingPromise = null;
                /**
                 * Latest data from the database, if any, used in {@link clone}.
                 */
                this.lastDs = null;
                /** a progressive counter used as a discriminator when registering the same callbacks more than once */
                this.progDiscriminator = 1;
            }
            EntityEvent.prototype.setEntity = function (entity) {
                _super.prototype.setEntity.call(this, entity);
                // Update the local classMeta if entity type changed
                if (this.entity) {
                    this.classMeta = this.state.myMeta.findMeta(this.entity);
                }
            };
            EntityEvent.prototype.updated = function (ctx, callback, discriminator) {
                if (discriminator === void 0) { discriminator = null; }
                var h = new EventHandler(ctx, callback, discriminator);
                _super.prototype.on.call(this, h);
            };
            /**
             * Used to receive the projections when {@link ReferenceEvent} is loading the arget
             * event and has found some projections.
             */
            EntityEvent.prototype.handleProjection = function (ds) {
                if (this.loaded)
                    return;
                _super.prototype.handleDbEvent.call(this, ds, null, true);
            };
            EntityEvent.prototype.init = function (h) {
                if (this.dbhandler == null) {
                    // start here the preloading of the binding, if any
                    if (this.binding) {
                        var eeParent = this.parent;
                        if (!(eeParent instanceof EntityEvent))
                            throw Error('Cannot apply binding to ' + this.nameOnParent + ' because parent event is not an entity event');
                        this.bindingPromise = this.binding.startLoads(eeParent.classMeta, this.state, eeParent.entity);
                    }
                }
                _super.prototype.init.call(this, h);
            };
            EntityEvent.prototype.applyHooks = function (ed) {
                if (this.entity && this.entity['postUpdate']) {
                    this.entity.postUpdate(ed);
                }
            };
            EntityEvent.prototype.broadcast = function (ed) {
                var _this = this;
                if (!this.bindingPromise) {
                    this.applyHooks(ed);
                    _super.prototype.broadcast.call(this, ed);
                    return;
                }
                // wait here for resolution of the binding, if any
                this.bindingPromise.then(function (state) {
                    _this.binding.resolve(ed.payload, state);
                    _this.applyHooks(ed);
                    _super.prototype.broadcast.call(_this, ed);
                });
            };
            EntityEvent.prototype.parseValue = function (ds) {
                this.loaded = true;
                // Save last data for use in clone later
                this.lastDs = ds;
                var val = ds.val();
                if (val) {
                    // Check if we have a discriminator
                    if (val['_dis']) {
                        // Find <nd set the correct metadata
                        var cm = this.state.myMeta.findDiscriminated(this.originalClassMeta, val['_dis']);
                        if (!cm)
                            throw new Error("Cannot find a suitable subclass for discriminator " + val['_dis']);
                        this.classMeta = cm;
                    }
                    else {
                        // If we don't have a discriminator, reset the original metadata
                        // resetting it is important because this could be an update
                        this.classMeta = this.originalClassMeta;
                    }
                    // TODO?? disciminator : change here then this.classMeta
                    // If we do't have created the entity instance yet, or the entity we have is not the right
                    // type (which could happen if this is an updated and the discriminator changed,
                    // create an instance of the right type.
                    if (!this.entity || !this.classMeta.rightInstance(this.entity)) {
                        this.setEntity(this.classMeta.createInstance());
                    }
                    for (var k in val) {
                        if (k == 'constructor')
                            continue;
                        // find a descriptor if any, a descriptor is there if the 
                        // property has been annotated somehow (embedded, reference, observable etc..)
                        var descr = this.classMeta.descriptors[k];
                        if (descr) {
                            // if we have a descriptor, find/create the event and delegate to it 
                            var subev = this.findCreateChildFor(descr);
                            subev.parseValue(ds.child(k));
                        }
                        else {
                            // otherwise, simply copy the value in the proper field
                            this.entity[k] = val[k];
                        }
                    }
                }
                else {
                    // if value is null, then set the entity null
                    this.setEntity(null);
                }
                // if it's embedded should set the value on the parent entity
                if (this.parent && this.nameOnParent) {
                    this.parent.entity[this.nameOnParent] = this.entity;
                }
            };
            EntityEvent.prototype.load = function (ctx) {
                var _this = this;
                return new Promise(function (resolve, error) {
                    _this.updated(ctx, function (ed) {
                        ed.offMe();
                        resolve(ed);
                    }, _this.progDiscriminator++);
                });
            };
            EntityEvent.prototype.live = function (ctx) {
                this.updated(ctx, function () { });
            };
            EntityEvent.prototype.dereference = function (ctx) {
                throw new Error("Can't dereference something that is not a reference");
            };
            EntityEvent.prototype.referenced = function (ctx, callback) {
                throw new Error("Can't dereference something that is not a reference");
            };
            EntityEvent.prototype.getReferencedUrl = function () {
                throw new Error("Embedded entities don't have a referenced url");
            };
            /**
             * Serializes the entity in a way suitable for database update.
             *
             * If the entity has a "serialize" method, that method will be invoked instead of performing
             * the normal serialization.
             *
             * If "localsOnly" is true, then only "local" values will be serialized. Local values are :
             * - native values, not annotated at all (not {@link embedded}, not {@link reference} etc..)
             * - values annotate for which {@link GenericEvent.isLocal} returns true.
             *
             * For example, an {@link observable} is considered a local value during serizalization, so
             * {@link ObservableEvent} will return true on "isLocal".
             *
             * If a list of field names is given in "fields", then only those fields will be serialized.
             *
             * Otherwise, all the properties that whose name doesn't start with an underscore are serialized. If
             * they are annotated, a corresponding event is found using {@link findCreateChildFor} and its "serialize"
             * method is called, recursively.
             *
             * @return a js object with data to serialize, or null to explicitly serialize a null, or undefined
             * 		to leave the eventually existing value completely untouched.
             */
            EntityEvent.prototype.serialize = function (localsOnly, fields) {
                if (localsOnly === void 0) { localsOnly = false; }
                // No entity : serialize a null
                if (!this.entity)
                    return null;
                // Honour the "serialize" method, if present
                if (typeof this.entity['serialize'] === 'function') {
                    return this.entity['serialize'].apply(this.entity, [this]);
                }
                var ret = {};
                for (var k in this.entity) {
                    if (fields && fields.indexOf(k) < 0)
                        continue;
                    var val = this.entity[k];
                    if (typeof val === 'function')
                        continue;
                    // Look if the property is annotated
                    var evt = this.findCreateChildFor(k);
                    if (evt) {
                        // If localsOnly skip this value, however some events (like ignore or observable) 
                        // are called even if on locals only if their isLocal return true
                        if (localsOnly && !evt.isLocal())
                            continue;
                        // Delegate serialization to the child event
                        val = evt.serialize();
                        // Ignore the undefined
                        if (val !== undefined) {
                            ret[k] = val;
                        }
                    }
                    else {
                        // Skip every property starting with "_"
                        if (k.charAt(0) == '_')
                            continue;
                        ret[k] = val;
                    }
                }
                // Set the discriminator if needed
                if (this.classMeta.discriminator != null) {
                    ret['_dis'] = this.classMeta.discriminator;
                }
                return ret;
            };
            EntityEvent.prototype.assignUrl = function () {
                if (this.entity == null)
                    throw new Error("The entity is null, can't assign an url to a null entity");
                if (this.getUrl())
                    return;
                var er = this.state.entityRoot(this.classMeta);
                if (!er)
                    throw new Error("The entity " + Utils.findName(this.entity.constructor) + " doesn't have a root");
                var url = er.getUrl();
                var id = Db.Utils.IdGenerator.next();
                var disc = this.classMeta.discriminator || '';
                if (disc)
                    disc += '*';
                this.url = url + disc + id + '/';
                this.urlInited();
            };
            EntityEvent.prototype.save = function () {
                var _this = this;
                // If this entity was previously loaded or saved, then perform a serialize and save
                if (this.loaded) {
                    if (this.entity && this.entity['prePersist']) {
                        this.entity.prePersist();
                    }
                    return new Promise(function (ok, err) {
                        var fb = new Firebase(_this.getUrl());
                        fb.set(_this.serialize(false), function (fberr) {
                            if (fberr) {
                                err(fberr);
                            }
                            else {
                                ok(null);
                            }
                        });
                    });
                }
                else if (this.getUrl()) {
                    // Otherwise, if we already have an URL, delegate saving to child events.
                    // Save promises of child events
                    var proms = [];
                    for (var k in this.entity) {
                        if (k == 'constructor')
                            continue;
                        var se = this.findCreateChildFor(k);
                        if (se && se['save']) {
                            proms.push(se.save());
                        }
                    }
                    // Update local fields if any
                    if (this.entity) {
                        var upd = this.serialize(true);
                        if (!Utils.isEmpty(upd)) {
                            proms.push(new Promise(function (ok, err) {
                                var fb = new Firebase(_this.getUrl());
                                fb.update(upd, function (fberr) {
                                    if (fberr) {
                                        err(fberr);
                                    }
                                    else {
                                        ok(null);
                                    }
                                });
                            }));
                        }
                    }
                    // When all child events have performed their save, we can resolve our promise
                    return Promise.all(proms);
                }
                else {
                    this.assignUrl();
                    // A newly created entity can be considered like a loaded one once it's saved
                    this.loaded = true;
                    return this.save();
                }
            };
            EntityEvent.prototype.remove = function () {
                var _this = this;
                if (this.getUrl()) {
                    return new Promise(function (ok, err) {
                        var fb = new Firebase(_this.getUrl());
                        fb.set(null, function (fberr) {
                            if (fberr) {
                                err(fberr);
                            }
                            else {
                                ok(null);
                            }
                        });
                    });
                }
            };
            EntityEvent.prototype.clone = function () {
                if (!this.loaded)
                    throw new Error('Cannot clone an instance that has not been loaded');
                var nent = this.classMeta.createInstance();
                var evt = this.state.db(nent);
                evt.parseValue(this.lastDs);
                return evt.entity;
            };
            return EntityEvent;
        })(SingleDbHandlerEvent);
        Internal.EntityEvent = EntityEvent;
        /**
         * Implementation of IEntityOrReferenceEvent for {@link reference}s.
         *
         * It wraps an {@link EntityEvent} (in {@link pointedEvent}) to which it delegates
         * most methods. The pointedEvent is loaded or created based on the pointer found in the reference,
         * and is recreated if the reference pointer gets changed.
         *
         * Main functionalities are :
         * - when reading, it creates the pointedEvent and eventually forwards projections in {@link parseValue}
         * - when saving, it saves the pointed url, eventually annotated with the discriminator, and saves the projections, in {@link serialize}.
         */
        var ReferenceEvent = (function (_super) {
            __extends(ReferenceEvent, _super);
            function ReferenceEvent() {
                _super.apply(this, arguments);
                //classMeta :ClassMetadata = null;
                /**
                 * Local (ram, javascript) name of the entity represented by this event on the parent entity.
                 */
                this.nameOnParent = null;
                /**
                 * List of fields to save as projections.
                 */
                this.project = null;
                /**
                 * The main event that controls the pointed entity
                 */
                this.pointedEvent = null;
                /**
                 * The previous pointedEvent, saved here to decomission it when not needed anymore
                 */
                this.prevPointedEvent = null;
                /** a progressive counter used as a discriminator when registering the same callbacks more than once */
                this.progDiscriminator = 1;
            }
            // Overridden to : 1) don't install this event 2) get pointedUrl
            ReferenceEvent.prototype.setEntity = function (entity) {
                this.entity = entity;
                if (entity) {
                    this.pointedEvent = this.state.createEvent(entity, []);
                }
                else {
                    this.pointedEvent = null;
                }
            };
            /**
             * Load this reference AND the pointed entity.
             */
            ReferenceEvent.prototype.load = function (ctx) {
                var _this = this;
                return this.dereference(ctx).then(function (ed) {
                    ed.offMe();
                    if (_this.pointedEvent)
                        return _this.pointedEvent.load(ctx).then(function (ed) { return ed; });
                    return ed;
                });
            };
            ReferenceEvent.prototype.makeCascadingCallback = function (ed, cb) {
                return function (subed) {
                    cb(subed);
                    if (subed.wasOffed()) {
                        ed.offMe();
                    }
                };
            };
            /**
             * Notifies of modifications on the reference AND on the pointed entity.
             */
            ReferenceEvent.prototype.updated = function (ctx, callback, discriminator) {
                var _this = this;
                if (discriminator === void 0) { discriminator = null; }
                var precb = null;
                this.referenced(ctx, function (ed) {
                    if (_this.prevPointedEvent && precb)
                        _this.prevPointedEvent.off(ctx, precb); //, callback);
                    if (_this.pointedEvent) {
                        precb = _this.makeCascadingCallback(ed, callback);
                        _this.pointedEvent.updated(ctx, precb, callback);
                    }
                    else {
                        callback(ed);
                    }
                }, callback);
            };
            /**
             * Keeps both the reference AND the referenced entity live.
             */
            ReferenceEvent.prototype.live = function (ctx) {
                this.updated(ctx, function () { });
            };
            ReferenceEvent.prototype.dereference = function (ctx) {
                var _this = this;
                return new Promise(function (resolve, error) {
                    _this.referenced(ctx, function (ed) {
                        ed.offMe();
                        resolve(ed);
                    }, _this.progDiscriminator++);
                });
            };
            ReferenceEvent.prototype.referenced = function (ctx, callback, discriminator) {
                if (discriminator === void 0) { discriminator = null; }
                var h = new EventHandler(ctx, callback, discriminator);
                _super.prototype.on.call(this, h);
            };
            ReferenceEvent.prototype.parseValue = function (ds) {
                var val = ds.val();
                if (val && val._ref) {
                    // We have a value, and the value is a reference.
                    // If there is no pointedEvent, or it was pointing to another entity ..
                    if (this.pointedEvent == null || this.pointedEvent.getUrl() != val._ref) {
                        //  .. create a new pointed event
                        this.prevPointedEvent = this.pointedEvent;
                        this.pointedEvent = this.state.loadEventWithInstance(val._ref, this.classMeta);
                        // Forward the projection
                        this.pointedEvent.handleProjection(ds);
                        this.setEntity(this.pointedEvent.entity);
                    }
                }
                else {
                    // Otherwise, consider it null
                    this.prevPointedEvent = this.pointedEvent;
                    this.pointedEvent = null;
                    this.setEntity(null);
                }
                // set the value on the parent entity
                if (this.parent && this.nameOnParent) {
                    this.parent.entity[this.nameOnParent] = this.entity;
                }
            };
            ReferenceEvent.prototype.getReferencedUrl = function () {
                if (!this.pointedEvent)
                    return null;
                return this.pointedEvent.getUrl();
            };
            ReferenceEvent.prototype.serialize = function (localsOnly) {
                if (localsOnly === void 0) { localsOnly = false; }
                // No event, serialize null
                if (!this.pointedEvent)
                    return null;
                var obj = null;
                if (this.project) {
                    // use the pointed event serialize method to serialize projections, if any
                    obj = this.pointedEvent.serialize(false, this.project);
                }
                else {
                    obj = {};
                }
                // Decorate the url with the discriminator
                var url = this.pointedEvent.getUrl();
                var disc = this.pointedEvent.classMeta.discriminator || '';
                if (disc)
                    disc = '*' + disc;
                url = url + disc;
                // Set the _ref property on the serialized object
                obj._ref = url;
                return obj;
            };
            ReferenceEvent.prototype.assignUrl = function () {
                if (!this.pointedEvent)
                    throw new Error("The reference is null, can't assign an url to a null");
                this.pointedEvent.assignUrl();
            };
            ReferenceEvent.prototype.save = function () {
                if (!this.pointedEvent)
                    throw new Error("The reference is null, can't save it");
                return this.pointedEvent.save();
            };
            ReferenceEvent.prototype.remove = function () {
                if (!this.pointedEvent)
                    throw new Error("The reference is null, can't remove it");
                return this.pointedEvent.remove();
            };
            ReferenceEvent.prototype.clone = function () {
                return this.pointedEvent.clone();
            };
            return ReferenceEvent;
        })(SingleDbHandlerEvent);
        Internal.ReferenceEvent = ReferenceEvent;
        /**
         * An event handler for collections.
         *
         * It extends the DbEventHandler :
         * - adding automatic multiple db events hooking and unhooking
         * - changing the signature of the callback to also pass the event name
         */
        var CollectionDbEventHandler = (function (_super) {
            __extends(CollectionDbEventHandler, _super);
            function CollectionDbEventHandler() {
                _super.apply(this, arguments);
                this.dbEvents = null;
                this.istracking = false;
                this.ispopulating = false;
            }
            CollectionDbEventHandler.prototype.hookAll = function (fn) {
                for (var i = 0; i < this.dbEvents.length; i++) {
                    this.hook(this.dbEvents[i], fn);
                }
            };
            CollectionDbEventHandler.prototype.hook = function (event, fn) {
                _super.prototype.hook.call(this, event, function (dataSnapshot, prevChildName) { return fn(dataSnapshot, prevChildName || '', event); });
            };
            CollectionDbEventHandler.prototype.unhook = function (event) {
                for (var i = 0; i < this.cbs.length; i++) {
                    var cb = this.cbs[i];
                    if (cb.event != event)
                        continue;
                    this.ref.off(cb.event, cb.fn);
                }
            };
            return CollectionDbEventHandler;
        })(DbEventHandler);
        Internal.CollectionDbEventHandler = CollectionDbEventHandler;
        /**
         * Default implementation of map.
         */
        var MapEvent = (function (_super) {
            __extends(MapEvent, _super);
            function MapEvent() {
                _super.apply(this, arguments);
                this.isReference = false;
                this.nameOnParent = null;
                this.project = null;
                this.binding = null;
                this.sorting = null;
                this.realField = null;
                this.loaded = false;
            }
            MapEvent.prototype.setEntity = function (entity) {
                var preEntity = this.entity || {};
                _super.prototype.setEntity.call(this, entity);
                this.realField = entity;
                this.entity = preEntity;
            };
            MapEvent.prototype.added = function (ctx, callback) {
                var h = new CollectionDbEventHandler(ctx, callback);
                h.dbEvents = ['child_added', 'value'];
                h.ispopulating = true;
                _super.prototype.on.call(this, h);
            };
            MapEvent.prototype.removed = function (ctx, callback) {
                var h = new CollectionDbEventHandler(ctx, callback);
                h.dbEvents = ['child_removed'];
                _super.prototype.on.call(this, h);
            };
            MapEvent.prototype.changed = function (ctx, callback) {
                var h = new CollectionDbEventHandler(ctx, callback);
                h.dbEvents = ['child_changed'];
                _super.prototype.on.call(this, h);
            };
            MapEvent.prototype.moved = function (ctx, callback) {
                var h = new CollectionDbEventHandler(ctx, callback);
                h.dbEvents = ['child_moved'];
                _super.prototype.on.call(this, h);
            };
            MapEvent.prototype.updated = function (ctx, callback, discriminator) {
                var h = new CollectionDbEventHandler(ctx, callback, discriminator);
                h.dbEvents = ['child_added', 'child_removed', 'child_changed', 'child_moved', 'value'];
                h.ispopulating = true;
                h.istracking = true;
                _super.prototype.on.call(this, h);
            };
            MapEvent.prototype.live = function (ctx) {
                this.updated(ctx, function () { });
            };
            MapEvent.prototype.load = function (ctx, deref) {
                var _this = this;
                if (deref === void 0) { deref = true; }
                return new Promise(function (resolve, error) {
                    var allProms = [];
                    _this.updated(ctx, function (det) {
                        if (det.type == Api.EventType.LIST_END) {
                            det.offMe();
                            if (allProms.length) {
                                Promise.all(allProms).then(function () {
                                    resolve(_this.realField);
                                });
                            }
                            else {
                                resolve(_this.realField);
                            }
                        }
                        if (det.type != Api.EventType.ADDED)
                            return;
                        if (_this.isReference && deref) {
                            var evt = _this.findCreateChildFor(det.originalKey);
                            allProms.push(evt.load(ctx).then(function () { }));
                        }
                    });
                });
            };
            MapEvent.prototype.dereference = function (ctx) {
                if (!this.isReference)
                    return this.load(ctx);
                return this.load(ctx, false);
            };
            MapEvent.prototype.init = function (h) {
                var _this = this;
                var sh = h;
                sh.ref = new Firebase(this.getUrl());
                if (this.sorting) {
                    sh.ref = sh.ref.orderByChild(this.sorting.field);
                }
                sh.event = this;
                sh.hookAll(function (ds, prev, event) { return _this.handleDbEvent(sh, event, ds, prev); });
            };
            MapEvent.prototype.findCreateChildFor = function (metaOrkey, force) {
                if (force === void 0) { force = false; }
                var meta = metaOrkey;
                if (!(metaOrkey instanceof MetaDescriptor)) {
                    if (this.isReference) {
                        var refmeta = Db.meta.reference(this.classMeta.ctor, this.project);
                        refmeta.localName = metaOrkey;
                        meta = refmeta;
                    }
                    else {
                        var embmeta = Db.meta.embedded(this.classMeta.ctor, this.binding);
                        embmeta.localName = metaOrkey;
                        meta = embmeta;
                    }
                }
                return _super.prototype.findCreateChildFor.call(this, meta, force);
            };
            MapEvent.prototype.handleDbEvent = function (handler, event, ds, prevKey) {
                console.log("Got event " + event, " prev " + prevKey + " key " + ds.key(), ds.val());
                var det = new EventDetails();
                det.originalEvent = event;
                det.originalKey = ds.key();
                det.originalUrl = ds.ref().toString();
                det.precedingKey = prevKey;
                det.populating = handler.ispopulating;
                if (event == 'value') {
                    handler.unhook('value');
                    if (handler.ispopulating) {
                        this.loaded = true;
                    }
                    handler.ispopulating = false;
                    det.type = Api.EventType.LIST_END;
                    handler.handle(det);
                    return;
                }
                var subev = this.findCreateChildFor(ds.key());
                var val = null;
                subev.parseValue(ds);
                val = subev.entity;
                if (event == 'child_removed') {
                    det.type = Api.EventType.REMOVED;
                }
                else if (event == 'child_added') {
                    det.type = Api.EventType.ADDED;
                }
                else {
                    det.type = Api.EventType.UPDATE;
                }
                det.payload = val;
                if (handler.istracking) {
                    this.addToInternal(event, ds, val, det);
                }
                handler.handle(det);
            };
            MapEvent.prototype.add = function (key, value) {
                var k = null;
                var v = value;
                if (!v) {
                    v = key;
                    k = this.createKeyFor(v);
                }
                else {
                    k = this.normalizeKey(key);
                }
                var evt = this.findCreateChildFor(k);
                evt.setEntity(v);
                return new Promise(function (ok, err) {
                    var fb = new Firebase(evt.getUrl());
                    fb.set(evt.serialize(false), function (fberr) {
                        if (fberr) {
                            err(fberr);
                        }
                        else {
                            ok(null);
                        }
                    });
                });
                // Can't use save because reference event save does not save the reference
                //return (<IEntityOrReferenceEvent<E>><any>evt).save();
            };
            MapEvent.prototype.createKeyFor = function (value) {
                return Utils.IdGenerator.next();
            };
            MapEvent.prototype.normalizeKey = function (key) {
                if (typeof key === 'string') {
                    key = key;
                }
                else if (typeof key === 'number') {
                    key = key + '';
                }
                else {
                    var enturl = this.state.createEvent(key).getUrl();
                    if (!enturl)
                        throw new Error("The entity used as a key in a map must be already saved elsewhere");
                    var entroot = this.state.entityRootFromUrl(enturl);
                    enturl = enturl.substr(entroot.getUrl().length);
                    key = enturl.replace(/\//g, '');
                }
                return key;
            };
            MapEvent.prototype.addToInternal = function (event, ds, val, det) {
                if (event == 'child_removed') {
                    delete this.realField[ds.key()];
                }
                else {
                    this.realField[ds.key()] = val;
                }
                if (this.parent && this.parent.entity) {
                    this.parent.entity[this.nameOnParent] = this.realField;
                }
            };
            MapEvent.prototype.remove = function (keyOrValue) {
                var _this = this;
                var key = this.normalizeKey(keyOrValue);
                return new Promise(function (ok, err) {
                    var fb = new Firebase(_this.getUrl() + key + '/');
                    fb.remove(function (fberr) {
                        if (fberr) {
                            err(fberr);
                        }
                        else {
                            ok(null);
                        }
                    });
                });
            };
            MapEvent.prototype.fetch = function (ctx, key) {
                var k = this.normalizeKey(key);
                var evt = this.findCreateChildFor(k);
                return evt.load(ctx);
            };
            MapEvent.prototype.with = function (key) {
                var k = this.normalizeKey(key);
                return this.findCreateChildFor(k);
            };
            MapEvent.prototype.isLoaded = function () {
                return this.loaded;
            };
            MapEvent.prototype.assertLoaded = function () {
                if (!this.loaded)
                    throw new Error("Collection at url " + this.getUrl() + " is not loaded");
            };
            MapEvent.prototype.save = function () {
                var _this = this;
                if (!this.isLoaded) {
                    console.log('not saving cause not loaded');
                    // TODO maybe we should save children that were loaded anyway
                    return;
                }
                return new Promise(function (ok, err) {
                    var fb = new Firebase(_this.getUrl());
                    var obj = _this.serialize();
                    fb.set(obj, function (fberr) {
                        if (fberr) {
                            err(fberr);
                        }
                        else {
                            ok(null);
                        }
                    });
                });
            };
            MapEvent.prototype.serialize = function (localsOnly, fields) {
                if (localsOnly === void 0) { localsOnly = false; }
                var obj = {};
                var preEntity = this.entity;
                this.entity = this.realField;
                try {
                    var ks = Object.keys(this.realField);
                    for (var i = 0; i < ks.length; i++) {
                        var k = ks[i];
                        obj[k] = this.findCreateChildFor(k).serialize();
                    }
                    return obj;
                }
                finally {
                    this.entity = preEntity;
                }
            };
            MapEvent.prototype.query = function () {
                var ret = new QueryImpl(this);
                ret.isReference = this.isReference;
                ret.sorting = this.sorting;
                ret.classMeta = this.classMeta;
                this.addDependant(ret);
                return ret;
            };
            return MapEvent;
        })(GenericEvent);
        Internal.MapEvent = MapEvent;
        var EventedArray = (function () {
            function EventedArray(collection) {
                this.collection = collection;
                this.arrayValue = [];
                this.keys = [];
            }
            EventedArray.prototype.findPositionFor = function (key) {
                return this.keys.indexOf(key);
            };
            EventedArray.prototype.findPositionAfter = function (prev) {
                if (!prev)
                    return 0;
                var pos = this.findPositionFor(prev);
                if (pos == -1)
                    return this.arrayValue.length;
                return pos + 1;
            };
            EventedArray.prototype.addToInternal = function (event, ds, val, det) {
                var key = ds.key();
                var curpos = this.findPositionFor(key);
                if (event == 'child_removed') {
                    delete this.collection.realField[ds.key()];
                    if (curpos > -1) {
                        this.arrayValue.splice(curpos, 1);
                        this.keys.splice(curpos, 1);
                    }
                    return;
                }
                this.collection.realField[ds.key()] = val;
                var newpos = this.findPositionAfter(det.precedingKey);
                console.log("cur " + curpos + " newpos " + newpos);
                if (curpos == newpos) {
                    this.arrayValue[curpos] = val;
                    return;
                }
                else {
                    if (curpos > -1) {
                        this.arrayValue.splice(curpos, 1);
                        this.keys.splice(curpos, 1);
                    }
                    this.arrayValue.splice(newpos, 0, val);
                    this.keys.splice(newpos, 0, key);
                }
            };
            EventedArray.prototype.prepareSerializeSet = function () {
                if (this.arrayValue) {
                    // Add all elements found in the array to the map
                    var fndkeys = {};
                    for (var i = 0; i < this.arrayValue.length; i++) {
                        var e = this.arrayValue[i];
                        if (!e)
                            continue;
                        var k = this.collection.createKeyFor(e);
                        this.collection.realField[k] = e;
                        fndkeys[k] = true;
                    }
                    // Remove all those that are not there anymore
                    var ks = Object.keys(this.collection.realField);
                    for (var i = 0; i < ks.length; i++) {
                        if (!fndkeys[ks[i]])
                            delete this.collection.realField[ks[i]];
                    }
                }
            };
            EventedArray.prototype.prepareSerializeList = function () {
                if (this.arrayValue) {
                    // Find keys in positions
                    var keys = [];
                    var ks = Object.keys(this.collection.realField);
                    for (var i = 0; i < ks.length; i++) {
                        var k = ks[i];
                        var rfe = this.collection.realField[k];
                        var pos = this.findPositionFor(rfe);
                        if (pos == -1) {
                            delete this.collection.realField[ks[i]];
                        }
                        else {
                            keys[pos] = k;
                        }
                    }
                    for (var i = 0; i < this.arrayValue.length; i++) {
                        var e = this.arrayValue[i];
                        if (!e)
                            continue;
                        if (!keys[i]) {
                            this.collection.realField[this.collection.createKeyFor(e)] = e;
                        }
                    }
                }
            };
            return EventedArray;
        })();
        Internal.EventedArray = EventedArray;
        var ArrayCollectionEvent = (function (_super) {
            __extends(ArrayCollectionEvent, _super);
            function ArrayCollectionEvent() {
                _super.apply(this, arguments);
                this.evarray = new EventedArray(this);
            }
            ArrayCollectionEvent.prototype.setEntity = function (entity) {
                var preReal = this.realField || {};
                _super.prototype.setEntity.call(this, entity);
                this.realField = preReal;
                this.evarray.arrayValue = entity;
            };
            ArrayCollectionEvent.prototype.add = function (value) {
                if (arguments.length > 1)
                    throw new Error("Cannot add to set or list specifying a key, add only the entity");
                var v = value;
                var k = this.createKeyFor(v);
                return _super.prototype.add.call(this, k, v);
            };
            ArrayCollectionEvent.prototype.intSuperAdd = function (key, value) {
                return _super.prototype.add.call(this, key, value);
            };
            ArrayCollectionEvent.prototype.addToInternal = function (event, ds, val, det) {
                this.evarray.addToInternal(event, ds, val, det);
                if (this.parent && this.parent.entity) {
                    this.parent.entity[this.nameOnParent] = this.evarray.arrayValue;
                }
            };
            ArrayCollectionEvent.prototype.load = function (ctx) {
                var _this = this;
                return _super.prototype.load.call(this, ctx).then(function () { return _this.evarray.arrayValue; });
            };
            ArrayCollectionEvent.prototype.dereference = function (ctx) {
                var _this = this;
                return _super.prototype.dereference.call(this, ctx).then(function () { return _this.evarray.arrayValue; });
            };
            return ArrayCollectionEvent;
        })(MapEvent);
        Internal.ArrayCollectionEvent = ArrayCollectionEvent;
        var ListEvent = (function (_super) {
            __extends(ListEvent, _super);
            function ListEvent() {
                _super.apply(this, arguments);
            }
            ListEvent.prototype.createKeyFor = function (value) {
                if (this.isReference)
                    return Utils.IdGenerator.next();
                var enturl = this.state.createEvent(value).getUrl();
                if (!enturl)
                    return Utils.IdGenerator.next();
                if (!this.getUrl() || enturl.indexOf(this.getUrl()) != 0) {
                    throw new Error("Cannot add to a list an embedded entity loaded or saved somewhere else, use .clone()");
                }
                enturl = enturl.substr(this.getUrl().length);
                enturl = enturl.replace(/\//g, '');
                return enturl;
            };
            ListEvent.prototype.normalizeKey = function (key) {
                if (typeof key === 'string') {
                    key = key;
                }
                else if (typeof key === 'number') {
                    key = key + '';
                }
                return key.toString();
            };
            ListEvent.prototype.serialize = function (localsOnly, fields) {
                if (localsOnly === void 0) { localsOnly = false; }
                this.evarray.prepareSerializeList();
                return _super.prototype.serialize.call(this, localsOnly, fields);
            };
            ListEvent.prototype.intPeek = function (ctx, dir) {
                var _this = this;
                return new Promise(function (ok, err) {
                    _this.query().limit(dir).added(ctx, function (det) {
                        det.offMe();
                        ok(det);
                    });
                });
            };
            ListEvent.prototype.intPeekRemove = function (ctx, dir) {
                var _this = this;
                var fnd;
                return this.intPeek(ctx, dir).then(function (det) {
                    fnd = det;
                    return _super.prototype.remove.call(_this, det.originalKey);
                }).then(function () { return fnd; });
            };
            ListEvent.prototype.pop = function (ctx) {
                return this.intPeekRemove(ctx, -1);
            };
            ListEvent.prototype.peekTail = function (ctx) {
                return this.intPeek(ctx, -1);
            };
            ListEvent.prototype.unshift = function (value) {
                return _super.prototype.intSuperAdd.call(this, Utils.IdGenerator.back(), value);
            };
            ListEvent.prototype.shift = function (ctx) {
                return this.intPeekRemove(ctx, 1);
            };
            ListEvent.prototype.peekHead = function (ctx) {
                return this.intPeek(ctx, 1);
            };
            return ListEvent;
        })(ArrayCollectionEvent);
        Internal.ListEvent = ListEvent;
        var SetEvent = (function (_super) {
            __extends(SetEvent, _super);
            function SetEvent() {
                _super.apply(this, arguments);
            }
            SetEvent.prototype.createKeyFor = function (value) {
                // get the url
                var enturl = this.state.createEvent(value).getUrl();
                if (this.isReference) {
                    // if it is a reference, use path from the root path
                    if (!enturl)
                        throw new Error("Cannot add to a set a reference that has not been loaded or not yet been saved");
                    var entroot = this.state.entityRootFromUrl(enturl);
                    enturl = enturl.substr(entroot.getUrl().length);
                }
                else {
                    // if it's an embedded, check if it has a url and substract my url to obtain id
                    if (enturl) {
                        if (!this.getUrl() || enturl.indexOf(this.getUrl()) != 0) {
                            throw new Error("Cannot add to a set an embedded entity loaded or saved somewhere else, use .clone()");
                        }
                        enturl = enturl.substr(this.getUrl().length);
                    }
                    else {
                        // if no url, generate a new random id
                        return Utils.IdGenerator.next();
                    }
                }
                // Remove slashes from the resulting url
                enturl = enturl.replace(/\//g, '');
                return enturl;
            };
            SetEvent.prototype.normalizeKey = function (key) {
                if (typeof key === 'string') {
                    key = key;
                }
                else if (typeof key === 'number') {
                    key = key + '';
                }
                else {
                    return this.createKeyFor(key);
                }
                return key;
            };
            SetEvent.prototype.serialize = function (localsOnly, fields) {
                if (localsOnly === void 0) { localsOnly = false; }
                this.evarray.prepareSerializeSet();
                return _super.prototype.serialize.call(this, localsOnly, fields);
            };
            return SetEvent;
        })(ArrayCollectionEvent);
        Internal.SetEvent = SetEvent;
        var IgnoreEvent = (function (_super) {
            __extends(IgnoreEvent, _super);
            function IgnoreEvent() {
                _super.apply(this, arguments);
                this.nameOnParent = null;
            }
            IgnoreEvent.prototype.setEntity = function () {
                // can't set entity, will refuse it, it's unmutable
            };
            IgnoreEvent.prototype.parseValue = function (ds) {
                this.val = ds.val();
            };
            IgnoreEvent.prototype.serialize = function () {
                return this.val;
            };
            IgnoreEvent.prototype.isLocal = function () {
                return true;
            };
            return IgnoreEvent;
        })(GenericEvent);
        Internal.IgnoreEvent = IgnoreEvent;
        var ObservableEvent = (function (_super) {
            __extends(ObservableEvent, _super);
            function ObservableEvent() {
                _super.apply(this, arguments);
                this.nameOnParent = null;
            }
            ObservableEvent.prototype.updated = function (ctx, callback, discriminator) {
                if (discriminator === void 0) { discriminator = null; }
                var h = new EventHandler(ctx, callback, discriminator);
                _super.prototype.on.call(this, h);
            };
            ObservableEvent.prototype.live = function (ctx) {
                this.updated(ctx, function () { });
            };
            ObservableEvent.prototype.parseValue = function (ds) {
                this.setEntity(ds.val());
                if (this.parent && this.nameOnParent) {
                    this.parent.entity[this.nameOnParent] = this.entity;
                }
            };
            ObservableEvent.prototype.serialize = function () {
                return this.entity;
            };
            ObservableEvent.prototype.isLocal = function () {
                return true;
            };
            return ObservableEvent;
        })(SingleDbHandlerEvent);
        Internal.ObservableEvent = ObservableEvent;
        var EntityRoot = (function () {
            function EntityRoot(state, meta) {
                this.state = state;
                this.meta = meta;
                if (!meta.root)
                    throw new Error("The entity " + meta.getName() + " is not a root entity");
            }
            EntityRoot.prototype.get = function (id) {
                return this.state.load(this.getUrl() + id, this.meta);
            };
            EntityRoot.prototype.query = function () {
                // TODO implement this
                return null;
            };
            EntityRoot.prototype.getUrl = function () {
                return this.state.getUrl() + this.meta.root + '/';
            };
            return EntityRoot;
        })();
        Internal.EntityRoot = EntityRoot;
        var QueryImpl = (function (_super) {
            __extends(QueryImpl, _super);
            function QueryImpl(ev) {
                _super.call(this);
                this._limit = 0;
                this._rangeFrom = null;
                this._rangeTo = null;
                this._equals = null;
                this.realField = {};
                //this.
            }
            QueryImpl.prototype.getUrl = function (force) {
                return this.parent.getUrl(force);
            };
            QueryImpl.prototype.onField = function (field, desc) {
                if (desc === void 0) { desc = false; }
                this.sorting = {
                    field: field,
                    desc: desc
                };
                return this;
            };
            QueryImpl.prototype.limit = function (limit) {
                this._limit = limit;
                return this;
            };
            QueryImpl.prototype.range = function (from, to) {
                this._rangeFrom = from;
                this._rangeTo = to;
                return this;
            };
            QueryImpl.prototype.equals = function (val) {
                this._equals = val;
                return this;
            };
            QueryImpl.prototype.init = function (gh) {
                var _this = this;
                var h = gh;
                h.ref = new Firebase(this.parent.getUrl());
                if (this.sorting) {
                    h.ref = h.ref.orderByChild(this.sorting.field);
                    if (this._equals) {
                        h.ref = h.ref.equalTo(this._equals);
                    }
                    else {
                        if (this._rangeFrom) {
                            h.ref = h.ref.startAt(this._rangeFrom);
                        }
                        if (this._rangeTo) {
                            h.ref = h.ref.endAt(this._rangeTo);
                        }
                    }
                }
                var limVal = this._limit || 0;
                if (limVal != 0) {
                    var limLast = this.sorting && this.sorting.desc;
                    if (limVal < 0) {
                        limVal = Math.abs(limVal);
                        limLast = !limLast;
                    }
                    if (limLast) {
                        h.ref = h.ref.limitToLast(limVal);
                    }
                    else {
                        h.ref = h.ref.limitToFirst(limVal);
                    }
                }
                /*
                if (this.sorting && this.sorting.desc) {
                    if (this._limit) {
                        h.ref = h.ref.limitToLast(this._limit);
                    } else {
                        h.ref = h.ref.limitToLast(Number.MAX_VALUE);
                    }
                } else {
                    if (this._limit) {
                        h.ref = h.ref.limitToFirst(this._limit);
                    }
                }
                */
                h.event = this;
                h.hookAll(function (ds, prev, event) { return _this.handleDbEvent(h, event, ds, prev); });
            };
            QueryImpl.prototype.findCreateChildFor = function (metaOrkey, force) {
                if (force === void 0) { force = false; }
                return this.parent.findCreateChildFor(metaOrkey, force);
            };
            QueryImpl.prototype.save = function () {
                throw new Error("Can't save a query");
            };
            return QueryImpl;
        })(ArrayCollectionEvent);
        Internal.QueryImpl = QueryImpl;
        var DbState = (function () {
            function DbState() {
                this.cache = {};
                this.myMeta = allMetadata;
            }
            DbState.prototype.configure = function (conf) {
                this.conf = conf;
                // TODO filter metas
                // TODO integrity tests on metas
                // - double roots
            };
            DbState.prototype.reset = function () {
                // Automatic off for all handlers?
                for (var k in this.cache) {
                    var val = this.cache[k];
                    if (val instanceof GenericEvent) {
                        val.offAll();
                    }
                }
                // Clean the cache
                this.cache = {};
            };
            DbState.prototype.entityRoot = function (param) {
                var meta = null;
                if (param instanceof ClassMetadata) {
                    meta = param;
                }
                else {
                    meta = this.myMeta.findMeta(param);
                }
                // change the meta based on current overrides
                if (meta.override != this.conf.override) {
                    for (var i = meta.subMeta.length - 1; i >= 0; i--) {
                        var subc = meta.subMeta[i];
                        if (subc.override == this.conf.override) {
                            meta = subc;
                            break;
                        }
                    }
                }
                return new EntityRoot(this, meta);
            };
            DbState.prototype.entityRootFromUrl = function (url) {
                // Check if the given url pertains to me
                if (url.indexOf(this.getUrl()) != 0)
                    return null;
                // Make the url relative
                var relurl = url.substring(this.getUrl().length);
                var meta = this.myMeta.findRooted(relurl);
                if (!meta)
                    throw new Error("No entity root found for url " + url);
                return this.entityRoot(meta);
            };
            DbState.prototype.getUrl = function () {
                return this.conf['baseUrl'];
            };
            DbState.prototype.bindEntity = function (e, ev) {
                // TODO probably we should check and raise an error is the entity was already bound
                entEvent.set(e, ev);
            };
            DbState.prototype.createEvent = function (e, stack) {
                if (stack === void 0) { stack = []; }
                //var roote = (<IDb3Annotated>e).__dbevent;
                var roote = entEvent.get(e);
                if (!roote) {
                    var clmeta = this.myMeta.findMeta(e);
                    var nre = new EntityEvent();
                    nre.state = this;
                    nre.setEntity(e);
                    nre.classMeta = clmeta;
                    roote = nre;
                    //(<IDb3Annotated>e).__dbevent = roote;
                    entEvent.set(e, roote);
                }
                else {
                    if (roote.state != this)
                        throw new Error("The entity " + roote.getUrl(true) + " is already attached to another database, not to " + this.getUrl());
                }
                // Follow each call stack
                var acp = roote;
                for (var i = 0; i < stack.length; i++) {
                    // search child event if any
                    var sube = acp.findCreateChildFor(stack[i]);
                    sube.state = this;
                    if (sube.isTraversingTree()) {
                        roote = sube.getTraversed();
                        acp = roote;
                        continue;
                    }
                    acp = sube;
                }
                return acp;
            };
            DbState.prototype.loadEvent = function (url, meta) {
                if (url.charAt(url.length - 1) != '/')
                    url += '/';
                var ret = this.cache[url];
                if (ret)
                    return ret;
                if (!meta) {
                }
                if (!meta) {
                    throw "The url " + url + " cannot be connected to an entity";
                }
                // TODO the meta should construct this
                var event = new EntityEvent();
                event.url = url;
                event.state = this;
                event.classMeta = meta;
                this.cache[url] = event;
                return event;
            };
            DbState.prototype.storeInCache = function (evt) {
                var url = evt.getUrl();
                if (!url)
                    return;
                var pre = this.cache[url];
                if (pre && pre !== evt) {
                    throw new Error('Storing in cache two different events for the same key ' + url);
                }
                this.cache[url] = evt;
            };
            DbState.prototype.loadEventWithInstance = function (url, meta) {
                var dis = null;
                var segs = url.split('/');
                var lastseg = segs.pop();
                if (!lastseg)
                    lastseg = segs.pop();
                var colonpos = lastseg.indexOf('*');
                if (colonpos == 0) {
                    dis = lastseg.substring(1);
                    url = url.substring(0, url.lastIndexOf('/'));
                }
                else if (colonpos > 0) {
                    dis = lastseg.substring(0, colonpos);
                }
                // clean the url from discriminator
                var event = this.loadEvent(url, meta);
                if (event instanceof EntityEvent) {
                    if (!event.entity) {
                        // Find right meta if url has a discriminator
                        if (dis) {
                            var nmeta = this.myMeta.findDiscriminated(meta, dis);
                            // TODO issue a warning maybe?
                            if (nmeta)
                                meta = nmeta;
                        }
                        var inst = new meta.ctor();
                        if (inst.dbInit) {
                            inst.dbInit(url, this.db);
                        }
                        /*
                        Object.defineProperty(inst, '__dbevent', {readable:true, writable:true, enumerable:false});
                        (<IDb3Annotated>inst).__dbevent = event;
                        */
                        event.setEntity(inst);
                    }
                }
                return event;
            };
            DbState.prototype.load = function (url, meta) {
                var event = this.loadEventWithInstance(url, meta);
                return event.entity;
                /*
                if (url.charAt(url.length - 1) != '/') url += '/';
                var ret = this.cache[url];
                if (ret) return <T>ret.entity;
                if (!meta) {
                    // TODO find meta from url
                }
                if (!meta) {
                    throw "The url " + url + " cannot be connected to an entity";
                }
                var inst = <any>new meta.ctor();
                if (inst.dbInit) {
                    (<IDb3Initable>inst).dbInit(url, this.db);
                }
                // TODO the meta should construct this
                var event = new EntityEvent();
                event.url = url;
                event.state = this;
                event.entity = inst;
                event.classMeta = meta;
                (<IDb3Annotated>inst).__dbevent = event;
                this.cache[url] = event;
                return inst;
                */
            };
            return DbState;
        })();
        Internal.DbState = DbState;
        var MetaDescriptor = (function () {
            function MetaDescriptor() {
                this.localName = null;
                this.remoteName = null;
                /**
                 * This could be either a class constructor (EntityType), or an anonymous function returning a costructor
                 * (EntityTypeProducer). Code for resolving the producer is in the cotr getter. This producer stuff
                 * is needed for https://github.com/Microsoft/TypeScript/issues/4888.
                 */
                this._ctor = null;
                this.classMeta = null;
            }
            MetaDescriptor.prototype.getTreeChange = function (md) {
                return null;
            };
            MetaDescriptor.prototype.getRemoteName = function () {
                if (this.remoteName)
                    return this.remoteName;
                return this.localName;
            };
            MetaDescriptor.prototype.setType = function (def) {
                this._ctor = def;
            };
            Object.defineProperty(MetaDescriptor.prototype, "ctor", {
                get: function () {
                    if (this._ctor == null) {
                        return null;
                    }
                    var ret = null;
                    if (!Utils.findName(this._ctor)) {
                        ret = this._ctor();
                        this._ctor = ret;
                    }
                    else {
                        ret = this._ctor;
                    }
                    return ret;
                },
                enumerable: true,
                configurable: true
            });
            MetaDescriptor.prototype.named = function (name) {
                this.remoteName = name;
                return this;
            };
            MetaDescriptor.prototype.setLocalName = function (name) {
                this.localName = name;
            };
            MetaDescriptor.prototype.createEvent = function (allMetadata) {
                throw new Error("Please override createEvent method in MetaDescriptor subclasses");
                // TODO this should throw exception and force subclasses to implement
                /*
                var ret = new GenericEvent();
                ret.url = this.getRemoteName();
                return ret;
                */
            };
            return MetaDescriptor;
        })();
        Internal.MetaDescriptor = MetaDescriptor;
        var ClassMetadata = (function (_super) {
            __extends(ClassMetadata, _super);
            function ClassMetadata() {
                _super.apply(this, arguments);
                this.descriptors = {};
                this.root = null;
                this.discriminator = null;
                this.override = null;
                this.superMeta = null;
                this.subMeta = [];
            }
            ClassMetadata.prototype.add = function (descr) {
                descr.classMeta = this;
                this.descriptors[descr.localName] = descr;
            };
            ClassMetadata.prototype.getName = function () {
                return Utils.findName(this.ctor);
            };
            ClassMetadata.prototype.createInstance = function () {
                return new this.ctor();
            };
            ClassMetadata.prototype.rightInstance = function (entity) {
                return entity && entity instanceof this.ctor;
            };
            ClassMetadata.prototype.mergeSuper = function (sup) {
                if (!this.root) {
                    this.root = sup.root;
                }
                else if (sup.root) {
                    this.discriminator = this.root.replace(/\//, '');
                }
                if (!this.superMeta) {
                    this.superMeta = sup;
                    sup.addSubclass(this);
                }
                for (var k in sup.descriptors) {
                    if (k == 'constructor')
                        continue;
                    if (this.descriptors[k])
                        continue;
                    this.descriptors[k] = sup.descriptors[k];
                }
            };
            ClassMetadata.prototype.addSubclass = function (sub) {
                this.subMeta.push(sub);
            };
            ClassMetadata.prototype.findForDiscriminator = function (disc) {
                if (this.discriminator == disc)
                    return this;
                for (var i = 0; i < this.subMeta.length; i++) {
                    var ret = this.subMeta[i].findForDiscriminator(disc);
                    if (ret)
                        return ret;
                }
                return null;
            };
            return ClassMetadata;
        })(MetaDescriptor);
        Internal.ClassMetadata = ClassMetadata;
        var EmbeddedMetaDescriptor = (function (_super) {
            __extends(EmbeddedMetaDescriptor, _super);
            function EmbeddedMetaDescriptor() {
                _super.apply(this, arguments);
                this.binding = null;
            }
            EmbeddedMetaDescriptor.prototype.named = function (name) {
                _super.prototype.named.call(this, name);
                return this;
            };
            EmbeddedMetaDescriptor.prototype.createEvent = function (allMetadata) {
                var ret = new EntityEvent();
                ret.url = this.getRemoteName();
                // TODO i need this search? can't i cache this?
                // TODO maybe we should assert here that there is a metadata for this type
                ret.classMeta = allMetadata.findMeta(this.ctor);
                ret.nameOnParent = this.localName;
                ret.binding = this.binding;
                return ret;
            };
            EmbeddedMetaDescriptor.prototype.setBinding = function (binding) {
                this.binding = binding;
            };
            return EmbeddedMetaDescriptor;
        })(MetaDescriptor);
        Internal.EmbeddedMetaDescriptor = EmbeddedMetaDescriptor;
        var ReferenceMetaDescriptor = (function (_super) {
            __extends(ReferenceMetaDescriptor, _super);
            function ReferenceMetaDescriptor() {
                _super.apply(this, arguments);
            }
            ReferenceMetaDescriptor.prototype.named = function (name) {
                _super.prototype.named.call(this, name);
                return this;
            };
            ReferenceMetaDescriptor.prototype.createEvent = function (allMetadata) {
                var ret = new ReferenceEvent();
                ret.url = this.getRemoteName();
                // TODO i need this search? can't i cache this?
                // TODO maybe we should assert here that there is a metadata for this type
                ret.classMeta = allMetadata.findMeta(this.ctor);
                ret.nameOnParent = this.localName;
                ret.project = this.project;
                return ret;
            };
            return ReferenceMetaDescriptor;
        })(MetaDescriptor);
        Internal.ReferenceMetaDescriptor = ReferenceMetaDescriptor;
        var MapMetaDescriptor = (function (_super) {
            __extends(MapMetaDescriptor, _super);
            function MapMetaDescriptor() {
                _super.apply(this, arguments);
                this.isReference = false;
                this.sorting = null;
            }
            MapMetaDescriptor.prototype.named = function (name) {
                _super.prototype.named.call(this, name);
                return this;
            };
            MapMetaDescriptor.prototype.createEvent = function (allMetadata) {
                var ret = new MapEvent();
                ret.url = this.getRemoteName();
                // TODO i need this search? can't i cache this?
                // TODO maybe we should assert here that there is a metadata for this type
                ret.classMeta = allMetadata.findMeta(this.ctor);
                ret.nameOnParent = this.localName;
                ret.isReference = this.isReference;
                ret.sorting = this.sorting;
                return ret;
            };
            return MapMetaDescriptor;
        })(MetaDescriptor);
        Internal.MapMetaDescriptor = MapMetaDescriptor;
        var SetMetaDescriptor = (function (_super) {
            __extends(SetMetaDescriptor, _super);
            function SetMetaDescriptor() {
                _super.apply(this, arguments);
                this.isReference = false;
                this.sorting = null;
            }
            SetMetaDescriptor.prototype.named = function (name) {
                _super.prototype.named.call(this, name);
                return this;
            };
            SetMetaDescriptor.prototype.createEvent = function (allMetadata) {
                var ret = new SetEvent();
                ret.url = this.getRemoteName();
                // TODO i need this search? can't i cache this?
                // TODO maybe we should assert here that there is a metadata for this type
                ret.classMeta = allMetadata.findMeta(this.ctor);
                ret.nameOnParent = this.localName;
                ret.isReference = this.isReference;
                ret.sorting = this.sorting;
                return ret;
            };
            return SetMetaDescriptor;
        })(MetaDescriptor);
        Internal.SetMetaDescriptor = SetMetaDescriptor;
        var ListMetaDescriptor = (function (_super) {
            __extends(ListMetaDescriptor, _super);
            function ListMetaDescriptor() {
                _super.apply(this, arguments);
                this.isReference = false;
                this.sorting = null;
            }
            ListMetaDescriptor.prototype.named = function (name) {
                _super.prototype.named.call(this, name);
                return this;
            };
            ListMetaDescriptor.prototype.createEvent = function (allMetadata) {
                var ret = new ListEvent();
                ret.url = this.getRemoteName();
                // TODO i need this search? can't i cache this?
                // TODO maybe we should assert here that there is a metadata for this type
                ret.classMeta = allMetadata.findMeta(this.ctor);
                ret.nameOnParent = this.localName;
                ret.isReference = this.isReference;
                ret.sorting = this.sorting;
                return ret;
            };
            return ListMetaDescriptor;
        })(MetaDescriptor);
        Internal.ListMetaDescriptor = ListMetaDescriptor;
        var ObservableMetaDescriptor = (function (_super) {
            __extends(ObservableMetaDescriptor, _super);
            function ObservableMetaDescriptor() {
                _super.apply(this, arguments);
            }
            ObservableMetaDescriptor.prototype.createEvent = function (allMetadata) {
                var ret = new ObservableEvent();
                ret.url = this.getRemoteName();
                ret.nameOnParent = this.localName;
                return ret;
            };
            return ObservableMetaDescriptor;
        })(MetaDescriptor);
        Internal.ObservableMetaDescriptor = ObservableMetaDescriptor;
        var IgnoreMetaDescriptor = (function (_super) {
            __extends(IgnoreMetaDescriptor, _super);
            function IgnoreMetaDescriptor() {
                _super.apply(this, arguments);
            }
            IgnoreMetaDescriptor.prototype.createEvent = function (allMetadata) {
                var ret = new IgnoreEvent();
                ret.url = this.getRemoteName();
                ret.nameOnParent = this.localName;
                return ret;
            };
            return IgnoreMetaDescriptor;
        })(MetaDescriptor);
        Internal.IgnoreMetaDescriptor = IgnoreMetaDescriptor;
        var Metadata = (function () {
            function Metadata() {
                this.classes = [];
            }
            Metadata.prototype.findMeta = function (param) {
                var ctor = null;
                if (typeof param !== 'function') {
                    ctor = param.constructor;
                }
                else {
                    ctor = param;
                }
                for (var i = 0; i < this.classes.length; i++) {
                    var md = this.classes[i];
                    if (md.ctor == ctor)
                        return md;
                }
                var md = new Internal.ClassMetadata();
                md.setType(ctor);
                // TODO parse here the manual static metadata
                var hierarchy = Utils.findHierarchy(ctor);
                for (var i = 0; i < hierarchy.length; i++) {
                    var supmeta = this.findMeta(hierarchy[i]);
                    md.mergeSuper(supmeta);
                }
                this.classes.push(md);
                return md;
            };
            Metadata.prototype.findRooted = function (relurl) {
                for (var i = 0; i < this.classes.length; i++) {
                    var acc = this.classes[i];
                    var acr = acc.root;
                    if (relurl.indexOf(acr) == 0)
                        return acc;
                }
                return null;
            };
            Metadata.prototype.findDiscriminated = function (base, dis) {
                return base.findForDiscriminator(dis);
            };
            return Metadata;
        })();
        Internal.Metadata = Metadata;
        function getAllMetadata() {
            return allMetadata;
        }
        Internal.getAllMetadata = getAllMetadata;
        function getLastEntity() {
            return lastEntity;
        }
        Internal.getLastEntity = getLastEntity;
        function getLastMetaPath() {
            return lastMetaPath;
        }
        Internal.getLastMetaPath = getLastMetaPath;
        function clearLastStack() {
            lastEntity = null;
            lastMetaPath = [];
            lastExpect = null;
        }
        Internal.clearLastStack = clearLastStack;
    })(Internal = Db.Internal || (Db.Internal = {}));
    var Utils;
    (function (Utils) {
        function findName(o) {
            var firstCtor = o;
            var acproto = o.prototype;
            if (!acproto) {
                acproto = Object.getPrototypeOf(o);
                firstCtor = o.constructor;
            }
            if (!firstCtor)
                return null;
            var funcNameRegex = /function (.{1,})\(/;
            var results = (funcNameRegex).exec(firstCtor.toString());
            return (results && results.length > 1) ? results[1] : null;
        }
        Utils.findName = findName;
        function findHierarchy(o) {
            var firstCtor = o;
            var acproto = o.prototype;
            if (!acproto) {
                acproto = Object.getPrototypeOf(o);
                firstCtor = o.constructor;
            }
            if (!acproto)
                throw new Error("Cannot reconstruct hierarchy following prototype chain of " + o);
            var ret = [];
            while (acproto) {
                var acctor = acproto.constructor;
                if (acctor === Object)
                    break;
                acproto = Object.getPrototypeOf(acproto);
                if (acctor === firstCtor)
                    continue;
                ret.push(acctor);
            }
            return ret;
        }
        Utils.findHierarchy = findHierarchy;
        function isInlineObject(o) {
            return typeof o === 'object' && o.constructor === Object;
        }
        Utils.isInlineObject = isInlineObject;
        var hasOwnProperty = Object.prototype.hasOwnProperty;
        function isEmpty(obj) {
            // null and undefined are "empty"
            if (obj == null)
                return true;
            // Assume if it has a length property with a non-zero value
            // that that property is correct.
            if (obj.length > 0)
                return false;
            if (obj.length === 0)
                return true;
            // Otherwise, does it have any properties of its own?
            // Note that this doesn't handle
            // toString and valueOf enumeration bugs in IE < 9
            for (var key in obj) {
                if (hasOwnProperty.call(obj, key))
                    return false;
            }
            return true;
        }
        Utils.isEmpty = isEmpty;
        function copyObj(from, to) {
            for (var k in from) {
                if (k == 'constructor')
                    continue;
                var val = from[k];
                if (typeof val === 'object') {
                    var valto = to[k] || {};
                    copyObj(val, valto);
                    val = valto;
                }
                to[k] = val;
            }
        }
        Utils.copyObj = copyObj;
        var IdGenerator = (function () {
            function IdGenerator() {
            }
            IdGenerator.next = function () {
                var now = new Date().getTime();
                var duplicateTime = (now === IdGenerator.lastPushTime);
                IdGenerator.lastPushTime = now;
                var timeStampChars = new Array(8);
                for (var i = 7; i >= 0; i--) {
                    timeStampChars[i] = IdGenerator.PUSH_CHARS.charAt(now % IdGenerator.BASE);
                    // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
                    now = Math.floor(now / IdGenerator.BASE);
                }
                if (now !== 0)
                    throw new Error('We should have converted the entire timestamp.');
                var id = timeStampChars.join('');
                if (!duplicateTime) {
                    for (i = 0; i < 14; i++) {
                        IdGenerator.lastRandChars[i] = Math.floor(Math.random() * IdGenerator.BASE);
                    }
                }
                else {
                    // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
                    for (i = 13; i >= 0 && IdGenerator.lastRandChars[i] === IdGenerator.BASE - 1; i--) {
                        IdGenerator.lastRandChars[i] = 0;
                    }
                    IdGenerator.lastRandChars[i]++;
                }
                for (i = 0; i < 14; i++) {
                    id += IdGenerator.PUSH_CHARS.charAt(IdGenerator.lastRandChars[i]);
                }
                if (id.length != 22)
                    throw new Error('Length should be 22, but was ' + id.length);
                return id;
            };
            IdGenerator.back = function () {
                var now = new Date().getTime();
                var duplicateTime = (now === IdGenerator.lastPushTime);
                IdGenerator.lastPushTime = now;
                now = IdGenerator.REVPOINT - (now - IdGenerator.REVPOINT);
                var timeStampChars = new Array(8);
                for (var i = 7; i >= 0; i--) {
                    timeStampChars[i] = IdGenerator.PUSH_CHARS.charAt(now % IdGenerator.BASE);
                    // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
                    now = Math.floor(now / IdGenerator.BASE);
                }
                if (now !== 0)
                    throw new Error('We should have converted the entire timestamp.');
                var id = timeStampChars.join('');
                if (!duplicateTime || IdGenerator.lastBackRandChars.length == 0) {
                    for (i = 0; i < 14; i++) {
                        IdGenerator.lastBackRandChars[i] = Math.floor(Math.random() * IdGenerator.BASE);
                    }
                }
                else {
                    // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
                    for (i = 13; i >= 0 && IdGenerator.lastBackRandChars[i] === 0; i--) {
                        IdGenerator.lastBackRandChars[i] = IdGenerator.BASE - 1;
                    }
                    IdGenerator.lastBackRandChars[i]--;
                }
                for (i = 0; i < 14; i++) {
                    id += IdGenerator.PUSH_CHARS.charAt(IdGenerator.lastBackRandChars[i]);
                }
                if (id.length != 22)
                    throw new Error('Length should be 22, but was ' + id.length);
                return id;
            };
            // Modeled after base64 web-safe chars, but ordered by ASCII.
            // SG : removed - and _
            IdGenerator.PUSH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
            IdGenerator.BASE = IdGenerator.PUSH_CHARS.length;
            IdGenerator.REVPOINT = 1440691098716;
            // Timestamp of last push, used to prevent local collisions if you push twice in one ms.
            IdGenerator.lastPushTime = 0;
            // We generate 72-bits of randomness which get turned into 14 characters and appended to the
            // timestamp to prevent collisions with other clients.	We store the last characters we
            // generated because in the event of a collision, we'll use those same characters except
            // "incremented" by one.
            IdGenerator.lastRandChars = [];
            IdGenerator.lastBackRandChars = [];
            return IdGenerator;
        })();
        Utils.IdGenerator = IdGenerator;
        var WeakWrap = (function () {
            function WeakWrap() {
                this.wm = null;
                if (typeof WeakMap !== 'undefined') {
                    this.wm = new WeakMap();
                }
                else {
                    this.id = IdGenerator.next();
                }
            }
            WeakWrap.prototype.getOrMake = function (k) {
                if (!k.hasOwnProperty('__weaks')) {
                    Object.defineProperty(k, '__weaks', { writable: true, enumerable: false, value: {} });
                }
                return k['__weaks'];
            };
            WeakWrap.prototype.get = function (k) {
                if (this.wm)
                    return this.wm.get(k);
                var obj = this.getOrMake(k);
                return obj[this.id];
            };
            WeakWrap.prototype.set = function (k, val) {
                if (this.wm) {
                    this.wm.set(k, val);
                    return;
                }
                var obj = this.getOrMake(k);
                obj[this.id] = val;
            };
            WeakWrap.prototype.delete = function (k) {
                if (this.wm) {
                    this.wm.delete(k);
                    return;
                }
                var obj = this.getOrMake(k);
                delete obj[this.id];
            };
            return WeakWrap;
        })();
        Utils.WeakWrap = WeakWrap;
    })(Utils = Db.Utils || (Db.Utils = {}));
    function bind(localName, targetName, live) {
        if (live === void 0) { live = true; }
        var ret = new Internal.BindingImpl();
        ret.bind(localName, targetName, live);
        return ret;
    }
    Db.bind = bind;
    function sortBy(field, desc) {
        if (desc === void 0) { desc = false; }
        return {
            field: field,
            desc: desc
        };
    }
    Db.sortBy = sortBy;
    // --- Annotations
    function embedded(def, binding) {
        return function (target, propertyKey) {
            if (!def)
                throw new Error("Cannot find embedded class for " + propertyKey.toString());
            var ret = meta.embedded(def, binding);
            addDescriptor(target, propertyKey, ret);
            installMetaGetter(target, propertyKey.toString(), ret);
        };
    }
    Db.embedded = embedded;
    function reference(def, project) {
        return function (target, propertyKey) {
            if (!def)
                throw new Error("Cannot find referenced class for " + propertyKey.toString());
            var ret = meta.reference(def, project);
            addDescriptor(target, propertyKey, ret);
            installMetaGetter(target, propertyKey.toString(), ret);
        };
    }
    Db.reference = reference;
    function map(valueType, reference, sorting) {
        if (reference === void 0) { reference = false; }
        return function (target, propertyKey) {
            if (!valueType)
                throw new Error("Cannot find map value type for " + propertyKey.toString());
            var ret = meta.map(valueType, reference, sorting);
            addDescriptor(target, propertyKey, ret);
            installMetaGetter(target, propertyKey.toString(), ret);
        };
    }
    Db.map = map;
    function set(valueType, reference, sorting) {
        if (reference === void 0) { reference = false; }
        return function (target, propertyKey) {
            if (!valueType)
                throw new Error("Cannot find set value type for " + propertyKey.toString());
            var ret = meta.set(valueType, reference, sorting);
            addDescriptor(target, propertyKey, ret);
            installMetaGetter(target, propertyKey.toString(), ret);
        };
    }
    Db.set = set;
    function list(valueType, reference, sorting) {
        if (reference === void 0) { reference = false; }
        return function (target, propertyKey) {
            if (!valueType)
                throw new Error("Cannot find list value type for " + propertyKey.toString());
            var ret = meta.list(valueType, reference, sorting);
            addDescriptor(target, propertyKey, ret);
            installMetaGetter(target, propertyKey.toString(), ret);
        };
    }
    Db.list = list;
    function root(name, override) {
        return function (target) {
            var myname = name;
            if (!myname) {
                myname = Utils.findName(target);
                myname = myname.charAt(0).toLowerCase() + myname.slice(1);
                if (myname.charAt(myname.length - 1) != 's')
                    myname += 's';
            }
            meta.define(target, myname, null, override);
        };
    }
    Db.root = root;
    function discriminator(disc) {
        return function (target) {
            meta.define(target, null, disc);
        };
    }
    Db.discriminator = discriminator;
    function override(override) {
        if (override === void 0) { override = 'server'; }
        return function (target) {
            meta.define(target, null, null, override);
        };
    }
    Db.override = override;
    function observable() {
        return function (target, propertyKey) {
            var ret = meta.observable();
            addDescriptor(target, propertyKey, ret);
            installMetaGetter(target, propertyKey.toString(), ret);
        };
    }
    Db.observable = observable;
    function ignore() {
        return function (target, propertyKey) {
            var ret = meta.ignore();
            addDescriptor(target, propertyKey, ret);
        };
    }
    Db.ignore = ignore;
    function addDescriptor(target, propertyKey, ret) {
        ret.setLocalName(propertyKey.toString());
        var clmeta = allMetadata.findMeta(target.constructor);
        clmeta.add(ret);
    }
    // --- Metadata stuff
    var allMetadata = new Internal.Metadata();
    var lastEntity = null;
    var lastMetaPath = [];
    var lastCantBe = 'ciao';
    var lastExpect = null;
    function installMetaGetter(target, propertyKey, descr) {
        var nkey = '__' + propertyKey;
        Object.defineProperty(target, propertyKey, {
            enumerable: true,
            set: function (v) {
                this[nkey] = v;
                var mye = entEvent.get(this);
                if (mye) {
                    mye.findCreateChildFor(propertyKey, true);
                }
            },
            get: function () {
                if (lastExpect && this !== lastExpect) {
                    Internal.clearLastStack();
                }
                if (!lastEntity)
                    lastEntity = this;
                lastMetaPath.push(descr);
                var ret = this[nkey];
                if (!ret) {
                    lastExpect = lastCantBe;
                }
                else {
                    lastExpect = ret;
                }
                return ret;
            }
        });
    }
    var meta;
    (function (meta_1) {
        function embedded(def, binding) {
            if (!def)
                throw new Error("Cannot find embedded class");
            var ret = new Db.Internal.EmbeddedMetaDescriptor();
            ret.setType(def);
            ret.setBinding(binding);
            return ret;
        }
        meta_1.embedded = embedded;
        function reference(def, project) {
            if (!def)
                throw new Error("Cannot find referenced class");
            var ret = new Db.Internal.ReferenceMetaDescriptor();
            ret.setType(def);
            ret.project = project;
            return ret;
        }
        meta_1.reference = reference;
        function map(valuetype, reference, sorting) {
            if (reference === void 0) { reference = false; }
            if (!valuetype)
                throw new Error("Cannot find map value type");
            var ret = new Db.Internal.MapMetaDescriptor();
            ret.setType(valuetype);
            ret.isReference = reference;
            ret.sorting = sorting;
            return ret;
        }
        meta_1.map = map;
        function set(valuetype, reference, sorting) {
            if (reference === void 0) { reference = false; }
            if (!valuetype)
                throw new Error("Cannot find set value type");
            var ret = new Db.Internal.SetMetaDescriptor();
            ret.setType(valuetype);
            ret.isReference = reference;
            ret.sorting = sorting;
            return ret;
        }
        meta_1.set = set;
        function list(valuetype, reference, sorting) {
            if (reference === void 0) { reference = false; }
            if (!valuetype)
                throw new Error("Cannot find list value type");
            var ret = new Db.Internal.ListMetaDescriptor();
            ret.setType(valuetype);
            ret.isReference = reference;
            ret.sorting = sorting;
            return ret;
        }
        meta_1.list = list;
        function observable() {
            var ret = new Db.Internal.ObservableMetaDescriptor();
            return ret;
        }
        meta_1.observable = observable;
        function ignore() {
            var ret = new Db.Internal.IgnoreMetaDescriptor();
            return ret;
        }
        meta_1.ignore = ignore;
        function define(ctor, root, discriminator, override) {
            var meta = allMetadata.findMeta(ctor);
            if (root) {
                meta.root = root;
            }
            if (discriminator) {
                meta.discriminator = discriminator;
            }
            if (override) {
                meta.override = override;
            }
        }
        meta_1.define = define;
    })(meta = Db.meta || (Db.meta = {}));
})(Db || (Db = {}));
/**
 * The default db, will be the first database created, handy since most projects will only use one db.
 */
var defaultDb = null;
/**
 * Weak association between entities and their database events. Each entity instance can be
 * connected only to a single database event, and as such to a single database.
 */
var entEvent = new Db.Utils.WeakWrap();
module.exports = Db;
//# sourceMappingURL=Db3.js.map