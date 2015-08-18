var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Firebase = require('firebase');
var PromiseModule = require('es6-promise');
var Promise = PromiseModule.Promise;
var defaultDb = null;
var Db;
(function (Db) {
    function configure(conf) {
        defaultDb = Db.Internal.createDb(conf);
        return defaultDb;
    }
    Db.configure = configure;
    function getDefaultDb() {
        return defaultDb;
    }
    Db.getDefaultDb = getDefaultDb;
    var Internal;
    (function (Internal) {
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
                if (typeof param == 'function') {
                    return state.entityRoot(param);
                }
                else if (!e) {
                    e = param;
                }
                var ret = state.createEvent(e, stack);
                return ret;
            };
            return db;
        }
        Internal.createDb = createDb;
        var DbOperations = (function () {
            function DbOperations(state) {
                this.state = state;
            }
            DbOperations.prototype.fork = function (conf) {
                // TODO merge the configurations
                return createDb(conf);
            };
            DbOperations.prototype.load = function (url) {
                return this.state.load(url);
            };
            DbOperations.prototype.reset = function () {
                this.state.reset();
            };
            return DbOperations;
        })();
        Internal.DbOperations = DbOperations;
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
        var EventDetails = (function () {
            function EventDetails() {
                this.payload = null;
                this.populating = false;
                this.projected = false;
                this.listEnd = false;
                this.originalEvent = null;
                this.originalUrl = null;
                this.originalKey = null;
                this.precedingKey = null;
                this.handler = null;
            }
            EventDetails.prototype.setHandler = function (handler) {
                this.handler = handler;
            };
            EventDetails.prototype.offMe = function () {
                this.handler.offMe();
            };
            EventDetails.prototype.clone = function () {
                var ret = new EventDetails();
                ret.payload = this.payload;
                ret.populating = this.populating;
                ret.projected = this.projected;
                ret.listEnd = this.listEnd;
                ret.originalEvent = this.originalEvent;
                ret.originalUrl = this.originalUrl;
                ret.originalKey = this.originalKey;
                ret.precedingKey = this.precedingKey;
                return ret;
            };
            return EventDetails;
        })();
        Internal.EventDetails = EventDetails;
        var EventHandler = (function () {
            function EventHandler(ctx, callback, discriminator) {
                if (discriminator === void 0) { discriminator = null; }
                this.myprog = EventHandler.prog++;
                this.discriminator = null;
                this.canceled = false;
                this.ctx = ctx;
                this.callback = callback;
                this.discriminator = discriminator;
            }
            EventHandler.prototype.equals = function (oth) {
                return this.ctx == oth.ctx && this.callback == oth.callback && this.discriminator == oth.discriminator;
            };
            EventHandler.prototype.decomission = function (remove) {
                // override off, must remove only this instance callbacks, Firebase does not
                if (remove) {
                    this.canceled = true;
                }
                return remove;
            };
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
                if (this.after)
                    this.after(this);
                try {
                    this.callback.call(this.ctx, evd);
                }
                finally {
                }
                //console.log("Then calling", this.after);
            };
            EventHandler.prototype.offMe = function () {
                this.event.offHandler(this);
            };
            EventHandler.prog = 1;
            return EventHandler;
        })();
        Internal.EventHandler = EventHandler;
        var DbEventHandler = (function (_super) {
            __extends(DbEventHandler, _super);
            function DbEventHandler() {
                _super.apply(this, arguments);
                this.cbs = [];
            }
            DbEventHandler.prototype.hook = function (event, fn) {
                // TODO do something on cancelCallback? It's here only because of method signature
                this.cbs.push({ event: event, fn: this.ref.on(event, fn, function (err) { }) });
            };
            DbEventHandler.prototype.decomission = function (remove) {
                // override off, must remove only this instance callbacks, Firebase does not
                if (remove) {
                    for (var i = 0; i < this.cbs.length; i++) {
                        var cb = this.cbs[i];
                        //console.log(this.myprog + " : Listen off " + this._ref.toString() + " " + cb.event, cb.fn);
                        this.ref.off(cb.event, cb.fn);
                    }
                }
                return _super.prototype.decomission.call(this, remove);
            };
            return DbEventHandler;
        })(EventHandler);
        Internal.DbEventHandler = DbEventHandler;
        var GenericEvent = (function () {
            function GenericEvent() {
                this.children = {};
                this.classMeta = null;
                /**
                 * Array of current handlers.
                 */
                this.handlers = [];
            }
            GenericEvent.prototype.setEntity = function (entity) {
                this.entity = entity;
                if (entity && typeof entity == 'object') {
                    var dbacc = this.entity;
                    if (!dbacc.__dbevent)
                        dbacc.__dbevent = this;
                }
            };
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
            GenericEvent.prototype.urlInited = function () {
                for (var i = 0; i < this.handlers.length; i++) {
                    this.init(this.handlers[i]);
                }
                for (var k in this.children) {
                    this.children[k].urlInited();
                }
            };
            GenericEvent.prototype.on = function (handler) {
                this.handlers = this.handlers.filter(function (h) { return !h.decomission(h.equals(handler)); });
                handler.event = this;
                this.handlers.push(handler);
                // At this point the url could not yet have been set
                if (this.getUrl(false)) {
                    this.init(handler);
                }
            };
            GenericEvent.prototype.off = function (ctx, callback) {
                if (callback) {
                    this.handlers = this.handlers.filter(function (h) { return !h.decomission(h.ctx === ctx && h.callback === callback); });
                }
                else {
                    this.handlers = this.handlers.filter(function (h) { return !h.decomission(h.ctx === ctx); });
                }
            };
            GenericEvent.prototype.offHandler = function (h) {
                h.decomission(true);
                this.handlers = this.handlers.filter(function (ch) { return ch !== h; });
            };
            GenericEvent.prototype.init = function (h) {
                throw new Error("Implement init in GenericEvent subclasses");
            };
            GenericEvent.prototype.broadcast = function (ed) {
                this.handlers.filter(function (h) { h.handle(ed); return true; });
            };
            GenericEvent.prototype.findCreateChildFor = function (param, force) {
                if (force === void 0) { force = false; }
                var meta = null;
                if (param instanceof MetaDescriptor) {
                    meta = param;
                }
                else {
                    meta = this.classMeta.descriptors[param];
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
                // TODO save the newly created event on the state cache
                this.children[meta.localName] = ret;
                return ret;
            };
            GenericEvent.prototype.parseValue = function (ds) {
                throw new Error("Please override parseValue in subclasses of GenericEvent");
            };
            GenericEvent.prototype.isTraversingTree = function () {
                return false;
            };
            GenericEvent.prototype.getTraversed = function () {
                return null;
            };
            GenericEvent.prototype.serialize = function (localsOnly) {
                if (localsOnly === void 0) { localsOnly = false; }
                throw new Error("Please override serialize in subclasses of GenericEvent");
            };
            return GenericEvent;
        })();
        Internal.GenericEvent = GenericEvent;
        var SingleDbHandlerEvent = (function (_super) {
            __extends(SingleDbHandlerEvent, _super);
            function SingleDbHandlerEvent() {
                _super.apply(this, arguments);
                this.loaded = false;
                this.dbhandler = null;
                this.lastDetail = null;
            }
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
            SingleDbHandlerEvent.prototype.mockCb = function () { };
            SingleDbHandlerEvent.prototype.off = function (ctx, callback) {
                _super.prototype.off.call(this, ctx, callback);
                this.checkDisconnect();
            };
            SingleDbHandlerEvent.prototype.offHandler = function (h) {
                _super.prototype.offHandler.call(this, h);
                this.checkDisconnect();
            };
            SingleDbHandlerEvent.prototype.checkDisconnect = function () {
                if (this.handlers.length == 0) {
                    if (this.dbhandler) {
                        this.dbhandler.decomission(true);
                        this.dbhandler = null;
                    }
                    this.lastDetail = null;
                }
            };
            SingleDbHandlerEvent.prototype.handleDbEvent = function (ds, prevName) {
                this.parseValue(ds);
                var evd = new EventDetails();
                evd.payload = this.entity;
                evd.originalEvent = 'value';
                evd.originalUrl = ds.ref().toString();
                evd.originalKey = ds.key();
                evd.precedingKey = prevName;
                evd.populating = !this.loaded;
                this.lastDetail = evd;
                this.broadcast(this.lastDetail);
            };
            return SingleDbHandlerEvent;
        })(GenericEvent);
        Internal.SingleDbHandlerEvent = SingleDbHandlerEvent;
        var EntityEvent = (function (_super) {
            __extends(EntityEvent, _super);
            function EntityEvent() {
                _super.apply(this, arguments);
                this.nameOnParent = null;
                this.binding = null;
                this.bindingPromise = null;
                this.discriminator = null;
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
            EntityEvent.prototype.handleDbEvent = function (ds, prevName) {
                this.loaded = true;
                _super.prototype.handleDbEvent.call(this, ds, prevName);
            };
            EntityEvent.prototype.handleProjection = function (ds) {
                // TODO
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
            EntityEvent.prototype.broadcast = function (ed) {
                var _this = this;
                if (!this.bindingPromise) {
                    _super.prototype.broadcast.call(this, ed);
                    return;
                }
                // wait here for resolution of the binding, if any
                this.bindingPromise.then(function (state) {
                    _this.binding.resolve(ed.payload, state);
                    _super.prototype.broadcast.call(_this, ed);
                });
            };
            EntityEvent.prototype.parseValue = function (ds) {
                var val = ds.val();
                if (val) {
                    if (this.discriminator) {
                        var ctor = this.discriminator.discriminate(val);
                        if (!ctor)
                            throw new Error("The discriminator cannot find an entity type for value " + JSON.stringify(val));
                        this.classMeta = this.state.myMeta.findMeta(ctor);
                    }
                    if (!this.entity || !this.classMeta.rightInstance(this.entity)) {
                        this.setEntity(this.classMeta.createInstance());
                    }
                    for (var k in val) {
                        var descr = this.classMeta.descriptors[k];
                        // travel sub entities 
                        if (descr) {
                            var subev = this.findCreateChildFor(descr);
                            subev.parseValue(ds.child(k));
                        }
                        else {
                            this.entity[k] = val[k];
                        }
                    }
                }
                else {
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
            EntityEvent.prototype.isLoaded = function () {
                return this.loaded;
            };
            EntityEvent.prototype.assertLoaded = function () {
                if (!this.loaded)
                    throw new Error("Entity at url " + this.getUrl() + " is not loaded");
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
            EntityEvent.prototype.serialize = function (localsOnly) {
                if (localsOnly === void 0) { localsOnly = false; }
                if (!this.entity)
                    return null;
                if (typeof this.entity['serialize'] === 'function') {
                    return this.entity['serialize'].apply(this.entity, [this]);
                }
                var ret = {};
                for (var k in this.entity) {
                    var val = this.entity[k];
                    if (typeof val === 'function')
                        continue;
                    var evt = this.findCreateChildFor(k);
                    if (evt) {
                        // TODO some events (like ignore or observable) should be called even if on locals only
                        if (localsOnly)
                            continue;
                        ret[k] = evt.serialize();
                    }
                    else {
                        if (k.charAt(0) == '_')
                            continue;
                        ret[k] = val;
                    }
                }
                if (this.discriminator)
                    this.discriminator.decorate(this.entity, ret);
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
                this.url = url + id + '/';
                this.urlInited();
            };
            EntityEvent.prototype.save = function () {
                var _this = this;
                if (this.loaded) {
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
                    var proms = [];
                    // forward to sub events
                    for (var k in this.entity) {
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
                    return Promise.all(proms);
                }
                else {
                    this.assignUrl();
                    // A newly created entity can be considered like a loaded one once it's saved
                    this.loaded = true;
                    return this.save();
                }
            };
            return EntityEvent;
        })(SingleDbHandlerEvent);
        Internal.EntityEvent = EntityEvent;
        var ReferenceEvent = (function (_super) {
            __extends(ReferenceEvent, _super);
            function ReferenceEvent() {
                _super.apply(this, arguments);
                this.classMeta = null;
                this.nameOnParent = null;
                this.pointedEvent = null;
                this.prevPointedEvent = null;
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
            ReferenceEvent.prototype.load = function (ctx) {
                var _this = this;
                return this.dereference(ctx).then(function (ed) {
                    if (_this.pointedEvent)
                        return _this.pointedEvent.load(ctx).then(function (ed) { return ed; });
                    return ed;
                });
            };
            ReferenceEvent.prototype.updated = function (ctx, callback, discriminator) {
                var _this = this;
                if (discriminator === void 0) { discriminator = null; }
                this.referenced(ctx, function (ed) {
                    if (_this.prevPointedEvent)
                        _this.prevPointedEvent.off(ctx, callback);
                    if (_this.pointedEvent) {
                        _this.pointedEvent.updated(ctx, callback);
                    }
                    else {
                        callback(ed);
                    }
                }, callback);
            };
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
            ReferenceEvent.prototype.handleDbEvent = function (ds, prevName) {
                this.loaded = true;
                _super.prototype.handleDbEvent.call(this, ds, prevName);
            };
            ReferenceEvent.prototype.handleProjection = function (ds) {
                // TODO
            };
            ReferenceEvent.prototype.parseValue = function (ds) {
                var val = ds.val();
                if (val && val._ref) {
                    if (this.pointedEvent == null || this.pointedEvent.getUrl() != val._ref) {
                        this.prevPointedEvent = this.pointedEvent;
                        this.pointedEvent = this.state.loadEventWithInstance(val._ref, this.classMeta);
                        this.setEntity(this.pointedEvent.entity);
                    }
                }
                else {
                    this.prevPointedEvent = this.pointedEvent;
                    this.pointedEvent = null;
                    this.setEntity(null);
                }
                // set the value on the parent entity
                if (this.parent && this.nameOnParent) {
                    this.parent.entity[this.nameOnParent] = this.entity;
                }
            };
            ReferenceEvent.prototype.isLoaded = function () {
                return this.loaded;
            };
            ReferenceEvent.prototype.assertLoaded = function () {
                if (!this.loaded)
                    throw new Error("Reference at url " + this.getUrl() + " is not loaded");
            };
            ReferenceEvent.prototype.getReferencedUrl = function () {
                if (!this.pointedEvent)
                    return null;
                return this.pointedEvent.getUrl();
            };
            ReferenceEvent.prototype.serialize = function (localsOnly) {
                if (localsOnly === void 0) { localsOnly = false; }
                if (!this.pointedEvent)
                    return null;
                // TODO add projections
                return {
                    _ref: this.pointedEvent.getUrl()
                };
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
            return ReferenceEvent;
        })(SingleDbHandlerEvent);
        Internal.ReferenceEvent = ReferenceEvent;
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
            ObservableEvent.prototype.handleDbEvent = function (ds, prevName) {
                this.loaded = true;
                _super.prototype.handleDbEvent.call(this, ds, prevName);
            };
            ObservableEvent.prototype.parseValue = function (ds) {
                this.setEntity(ds.val());
                if (this.parent && this.nameOnParent) {
                    this.parent.entity[this.nameOnParent] = this.entity;
                }
            };
            ObservableEvent.prototype.isLoaded = function () {
                return this.loaded;
            };
            ObservableEvent.prototype.assertLoaded = function () {
                if (!this.loaded)
                    throw new Error("Entity at url " + this.getUrl() + " is not loaded");
            };
            ObservableEvent.prototype.serialize = function () {
                return this.entity;
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
            EntityRoot.prototype.load = function (id) {
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
                this.cache = {};
                // TODO automatic off for all handlers?
            };
            DbState.prototype.entityRoot = function (param) {
                var meta = null;
                if (param instanceof ClassMetadata) {
                    meta = param;
                }
                else {
                    meta = this.myMeta.findMeta(param);
                }
                return new EntityRoot(this, meta);
            };
            DbState.prototype.getUrl = function () {
                return this.conf['baseUrl'];
            };
            DbState.prototype.createEvent = function (e, stack) {
                var roote = e.__dbevent;
                if (!roote) {
                    var clmeta = this.myMeta.findMeta(e);
                    var nre = new EntityEvent();
                    nre.state = this;
                    nre.setEntity(e);
                    nre.classMeta = clmeta;
                    roote = nre;
                    e.__dbevent = roote;
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
            DbState.prototype.loadEventWithInstance = function (url, meta) {
                var event = this.loadEvent(url, meta);
                if (event instanceof EntityEvent) {
                    if (!event.entity) {
                        var inst = new meta.ctor();
                        if (inst.dbInit) {
                            inst.dbInit(url, this.db);
                        }
                        inst.__dbevent = event;
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
                this.ctor = null;
                this.discr = null;
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
                if (def['discriminate']) {
                    this.discr = def;
                    this.ctor = this.discr.discriminate({});
                }
                else {
                    var ti = new def();
                    if (ti['discriminate']) {
                        this.discr = ti;
                        this.ctor = this.discr.discriminate({});
                    }
                    else {
                        this.ctor = def;
                    }
                }
            };
            MetaDescriptor.prototype.getCtorFor = function (val) {
                if (this.discr) {
                    return this.discr.discriminate(val);
                }
                return this.ctor;
            };
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
                if (!this.root)
                    this.root = sup.root;
                for (var k in sup.descriptors) {
                    if (this.descriptors[k])
                        continue;
                    this.descriptors[k] = sup.descriptors[k];
                }
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
                ret.discriminator = this.discr;
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
                return ret;
            };
            return ReferenceMetaDescriptor;
        })(MetaDescriptor);
        Internal.ReferenceMetaDescriptor = ReferenceMetaDescriptor;
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
                md.ctor = ctor;
                // TODO parse here the manual static metadata
                var hierarchy = Utils.findHierarchy(ctor);
                for (var i = 0; i < hierarchy.length; i++) {
                    var supmeta = this.findMeta(hierarchy[i]);
                    md.mergeSuper(supmeta);
                }
                this.classes.push(md);
                return md;
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
        function findName(f) {
            if (!f.constructor)
                return null;
            var funcNameRegex = /function (.{1,})\(/;
            var results = (funcNameRegex).exec(f["constructor"].toString());
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
            // Modeled after base64 web-safe chars, but ordered by ASCII.
            // SG : removed - and _
            IdGenerator.PUSH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
            IdGenerator.BASE = IdGenerator.PUSH_CHARS.length;
            // Timestamp of last push, used to prevent local collisions if you push twice in one ms.
            IdGenerator.lastPushTime = 0;
            // We generate 72-bits of randomness which get turned into 14 characters and appended to the
            // timestamp to prevent collisions with other clients.	We store the last characters we
            // generated because in the event of a collision, we'll use those same characters except
            // "incremented" by one.
            IdGenerator.lastRandChars = [];
            return IdGenerator;
        })();
        Utils.IdGenerator = IdGenerator;
    })(Utils = Db.Utils || (Db.Utils = {}));
    function bind(localName, targetName, live) {
        if (live === void 0) { live = true; }
        var ret = new Internal.BindingImpl();
        ret.bind(localName, targetName, live);
        return ret;
    }
    Db.bind = bind;
    // --- Annotations
    function embedded(def, binding) {
        return function (target, propertyKey) {
            var ret = meta.embedded(def, binding);
            addDescriptor(target, propertyKey, ret);
            installMetaGetter(target, propertyKey.toString(), ret);
        };
    }
    Db.embedded = embedded;
    function reference(def, binding) {
        return function (target, propertyKey) {
            var ret = meta.reference(def);
            addDescriptor(target, propertyKey, ret);
            installMetaGetter(target, propertyKey.toString(), ret);
        };
    }
    Db.reference = reference;
    function root(name) {
        return function (target) {
            meta.root(target, name);
        };
    }
    Db.root = root;
    function observable() {
        return function (target, propertyKey) {
            var ret = meta.observable();
            addDescriptor(target, propertyKey, ret);
            installMetaGetter(target, propertyKey.toString(), ret);
        };
    }
    Db.observable = observable;
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
                var mye = this.__dbevent;
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
    (function (meta) {
        function embedded(def, binding) {
            var ret = new Db.Internal.EmbeddedMetaDescriptor();
            ret.setType(def);
            ret.setBinding(binding);
            return ret;
        }
        meta.embedded = embedded;
        function reference(def) {
            var ret = new Db.Internal.ReferenceMetaDescriptor();
            ret.setType(def);
            return ret;
        }
        meta.reference = reference;
        function observable() {
            var ret = new Db.Internal.ObservableMetaDescriptor();
            return ret;
        }
        meta.observable = observable;
        function root(ctor, name) {
            allMetadata.findMeta(ctor).root = name;
        }
        meta.root = root;
    })(meta = Db.meta || (Db.meta = {}));
})(Db || (Db = {}));
module.exports = Db;
//# sourceMappingURL=Db3.js.map