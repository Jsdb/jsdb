/// <reference path="../../typings/tsd.d.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Firebase = require('firebase');
var PromiseModule = require('es6-promise');
var Promise = PromiseModule.Promise;
var Db = (function () {
    function Db() {
        this.namesToRoots = {};
    }
    Db.prototype.setSocket = function (socket) {
        this.socket = socket;
    };
    Db.prototype.sendOnSocket = function (url, payload) {
        this.socket.emit(url, payload);
    };
    Db.prototype.scanRoots = function () {
        this.namesToRoots = {};
        var ks = Object.keys(this);
        for (var i = 0; i < ks.length; i++) {
            var root = this[ks[i]];
            if (!(root instanceof Db.internal.EntityRoot))
                continue;
            root.dbInit(this);
            root.named(ks[i]);
            this.namesToRoots[root.name] = root;
        }
    };
    Db.prototype.findRoot = function (url) {
        if (url.charAt(0) === '/')
            url = url.substring(1);
        var ks = Object.keys(this.namesToRoots);
        var matching = '';
        for (var i = 0; i < ks.length; i++) {
            if (url.indexOf(ks[i]) == 0 && ks.length > matching.length)
                matching = ks[i];
        }
        if (matching == '')
            return null;
        return this.namesToRoots[matching];
    };
    Db.prototype.load = function (url) {
        if (url.indexOf(this.baseUrl) === 0)
            url = url.substring(this.baseUrl.length);
        if (url.charAt(0) === '/')
            url = url.substring(1);
        var root = this.findRoot(url);
        if (!root) {
            this.scanRoots();
            root = this.findRoot(url);
        }
        if (!root)
            throw new Error("Cannot find an entity root for " + url + " on " + JSON.stringify(Object.keys(this.namesToRoots)));
        return root.load(url);
    };
    Db.prototype.computeUrl = function (inst) {
        var ctor = inst.constructor;
        var pre = null;
        var ks = Object.keys(this);
        for (var i = 0; i < ks.length; i++) {
            var root = this[ks[i]];
            if (!(root instanceof Db.internal.EntityRoot))
                continue;
            if (root.ctor === ctor)
                pre = root.url;
        }
        if (!pre)
            throw new Error("The constructor " + ctor + " is not bound to an url");
        pre += '/' + Db.internal.IdGenerator.next();
        return pre;
    };
    return Db;
})();
var Db;
(function (Db) {
    Db.serverMode = false;
    function str() {
        var ret = new internal.ValueEvent();
        return ret;
    }
    Db.str = str;
    function num() {
        var ret = new internal.ValueEvent();
        return ret;
    }
    Db.num = num;
    function data(c) {
        var ret = new internal.ValueEvent();
        ret.objD(c);
        return ret;
    }
    Db.data = data;
    function reference(c) {
        var ret = new internal.ValueEvent();
        return ret;
    }
    Db.reference = reference;
    function dataList(c) {
        var ret = new internal.ListEvent();
        ret.objD(c);
        return ret;
    }
    Db.dataList = dataList;
    function referenceList(c) {
        var ret = new internal.ListEvent();
        return ret;
    }
    Db.referenceList = referenceList;
    function entityRoot(c) {
        return new internal.EntityRoot(c);
    }
    Db.entityRoot = entityRoot;
    function strList() {
        var ret = new internal.ListEvent();
        return ret;
    }
    Db.strList = strList;
    function numList() {
        var ret = new internal.ListEvent();
        return ret;
    }
    Db.numList = numList;
    var Entity = (function () {
        function Entity() {
        }
        Entity.prototype.dbInit = function (url, db) {
            this.url = url || this.url || db.computeUrl(this);
            if (db === this.db)
                return;
            this.db = db;
            var evts = Object.keys(this);
            for (var i = 0; i < evts.length; i++) {
                var fld = this[evts[i]];
                if (!(fld instanceof internal.IsEvent))
                    continue;
                var ev = this[evts[i]];
                ev.named(evts[i]);
                // TODO also assign name
                ev.dbInit(url, db, this);
            }
        };
        Entity.prototype.equals = function (oth) {
            return oth.url == this.url;
        };
        Entity.prototype.getId = function () {
            return this.url.substring(this.url.lastIndexOf('/') + 1);
        };
        Entity.prototype.serializeProjections = function (url, projections) {
            if (projections === void 0) { projections = {}; }
            var ks = Object.keys(projections);
            for (var i = 0; i < ks.length; i++) {
                var k = ks[i];
                var proj = projections[k];
            }
        };
        Entity.prototype.callRemoteMethod = function (name, params) {
            this.db.sendOnSocket(this.url, JSON.stringify({ method: name, params: params }, function (key, val) {
                if (val instanceof Entity) {
                    return val.url;
                }
                return val;
            }));
        };
        Entity.prototype.getPromise = function (def) {
            if (def == 'this') {
                return Promise.resolve(this);
            }
            var subd = def.split('.');
            var rest = null;
            if (subd.length > 1) {
                rest = def.substring(subd[0].length + 1);
            }
            var evt = this[subd[0]];
            if (!evt || !(evt instanceof internal.IsEvent))
                throw new Error("No event called " + subd[0]);
            return evt.then(function (v) {
                if (rest && v instanceof Entity) {
                    return v.getPromise(rest);
                }
                else {
                    return v;
                }
            });
        };
        return Entity;
    })();
    Db.Entity = Entity;
    var Data = (function () {
        function Data() {
        }
        Data.prototype.parse = function (url, obj, db) {
            this._url = url;
            var ks = Object.keys(obj);
            for (var i = 0; i < ks.length; i++) {
                var k = ks[i];
                var v = obj[k];
                if (Data.isRef(v)) {
                    v = Data.readRef(v, db);
                }
                this[k] = v;
            }
        };
        Data.prototype.serialize = function (db, ret, projections) {
            if (db === void 0) { db = null; }
            if (ret === void 0) { ret = {}; }
            if (projections === void 0) { projections = {}; }
            var ks = Object.keys(this);
            for (var i = 0; i < ks.length; i++) {
                var k = ks[i];
                if (k.charAt(0) == '_')
                    continue;
                var v = this[k];
                if (v instanceof Entity) {
                    if (db)
                        v.dbInit(null, db);
                    v.serializeProjections(this._url, projections[k]);
                    v = {
                        _ref: v.url
                    };
                }
                else if (v instanceof Data) {
                    ret[k] = v.serialize(db, {}, projections[k]);
                }
                ret[k] = v;
            }
            return ret;
        };
        Data.isRef = function (data) {
            return data && !!data._ref;
        };
        Data.readRef = function (data, db) {
            if (!data)
                return null;
            if (typeof (data) === 'object') {
                var objc = db.load(data._ref);
                for (var k in data) {
                    if (k == '_ref')
                        continue;
                    var proj = data[k];
                    var event = objc[k];
                    if (!event || !(event instanceof internal.IsEvent))
                        continue;
                    event.projectValue(proj);
                }
                return objc;
            }
            else {
                return db.load(data);
            }
        };
        return Data;
    })();
    Db.Data = Data;
    var internal;
    (function (internal) {
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
        internal.IdGenerator = IdGenerator;
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
                this.handler.event.offHandler(this.handler);
            };
            return EventDetails;
        })();
        internal.EventDetails = EventDetails;
        var EventHandler = (function () {
            function EventHandler(event, ctx, method) {
                this.event = event;
                this.ctx = ctx;
                this.method = method;
                this.myprog = EventHandler.prog++;
                this.first = true;
                this.canceled = false;
                this._cbs = [];
            }
            EventHandler.prototype.hook = function (event, fn) {
                this._cbs.push({ event: event, fn: fn });
                // TODO do something on cancelCallback? It's here only because of method signature
                this._ref.on(event, fn, function (err) { }, this);
            };
            EventHandler.prototype.decomission = function (remove) {
                // TODO override off, must remove only this instance callbacks, Firebase does not
                if (remove) {
                    for (var i = 0; i < this._cbs.length; i++) {
                        var cb = this._cbs[i];
                        //console.log(this.myprog + " : Listen off " + this._ref.toString() + " " + cb.event, cb.fn);
                        this._ref.off(cb.event, cb.fn, this);
                    }
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
                evd.setHandler(this);
                this.method.call(this.ctx, evd.payload, evd);
                //console.log("Then calling", this.after);
                if (this.after)
                    this.after(this);
            };
            EventHandler.prog = 1;
            return EventHandler;
        })();
        internal.EventHandler = EventHandler;
        var IsEvent = (function () {
            function IsEvent() {
            }
            return IsEvent;
        })();
        internal.IsEvent = IsEvent;
        /**
         * Db based event.
         *
         * This events are triggered when the sub key passed as name in constructor is modified.
         * Which modifications triggers the event and how they are interpreted is based on the transformer passed to
         * withTransformer.
         *
         * When called on(), the event is triggered as soon as possible (maybe even before returning from
         * the on call if the data is already available). All events are triggered, also those cached before
         * the call to on, that is "on" doesn't mean "call me when something changes from now on", but also
         * pre-existing data is sent as events.
         *
         * To distinguish, when possible, among pre-existing and new data, the event callback has a parameter
         * "first?:boolean", that is set to true for pre-existing data, and false for later updates.
         *
         */
        var Event = (function (_super) {
            __extends(Event, _super);
            function Event() {
                _super.call(this);
                /**
                 * Array of current handlers.
                 */
                this.handlers = [];
                /**
                 * Full url this event is listening to
                 */
                this.url = null;
                /**
                 * Instance of the Db we are using
                 */
                this.db = null;
                /**
                 * Constructor for the D object, if this event returns a D event
                 */
                this._ctorD = null;
                /**
                 * If this is a ref
                 */
                // TODO should not be implicitly true, could be native
                this._isRef = true;
                this._preload = null;
                this._entity = null;
                this.events = ['value'];
                this.projVal = null;
                this.hrefIniter = this.setupHref;
            }
            Event.prototype.named = function (name) {
                if (this.name)
                    return this;
                this.name = name;
                return this;
            };
            Event.prototype.objD = function (c) {
                this._ctorD = c;
                this._isRef = false;
                return this;
            };
            Event.prototype.preLoad = function (f) {
                var _this = this;
                if (typeof f === 'function') {
                    this._preload = f;
                }
                else {
                    this._preload = function (prom) {
                        var ks = Object.keys(f);
                        var pms = [];
                        pms.push(prom);
                        for (var i = 0; i < ks.length; i++) {
                            pms[i + 1] = _this._entity.getPromise(f[ks[i]]);
                        }
                        return Promise.all(pms).then(function (vals) {
                            var data = vals[0];
                            for (var i = 0; i < ks.length; i++) {
                                var k = ks[i];
                                if (data[k] && typeof data[k] === 'function') {
                                    data[k].apply(data, vals[i + 1]);
                                }
                                else {
                                    data[k] = vals[i + 1];
                                }
                            }
                        });
                    };
                }
                return this;
            };
            /**
             * Called by the ObjC when the url is set.
             */
            Event.prototype.dbInit = function (url, db, entity) {
                this.url = url + '/' + this.name;
                this.db = db;
                this._entity = entity;
                // At this point someone could already have registered some handler
                for (var i = 0; i < this.handlers.length; i++) {
                    this.init(this.handlers[i]);
                }
            };
            Event.prototype.on = function (ctx, handler) {
                this.handlers = this.handlers.filter(function (h) { return h.decomission(h.ctx === ctx && h.method === handler); });
                var h = new EventHandler(this, ctx, handler);
                this.handlers.push(h);
                // At this point the url could not yet have been set
                if (typeof ctx.eventAttached != 'undefined') {
                    ctx.eventAttached(this);
                }
                if (this.url) {
                    this.init(h);
                }
            };
            Event.prototype.once = function (ctx, handler) {
                var _this = this;
                var h = new EventHandler(this, ctx, handler);
                this.handlers.push(h);
                h.after = function () {
                    _this.offHandler(h);
                };
                if (typeof ctx.eventAttached != 'undefined') {
                    ctx.eventAttached(this);
                }
                // At this point the url could not yet have been set
                if (this.url)
                    this.init(h);
            };
            Event.prototype.promise = function () {
                return this.then(function (v) { return v; });
            };
            Event.prototype.then = function (onFulfilled, onRejected) {
                var fu = null;
                var ret = new Promise(function (res, err) {
                    fu = res;
                });
                this.once(this, function (data, detail) {
                    if (!detail.projected) {
                        fu(onFulfilled(data));
                    }
                });
                return ret;
            };
            Event.prototype.offHandler = function (h) {
                //console.log("Decommissioning ", handler);
                h.decomission(true);
                this.handlers = this.handlers.filter(function (ch) { return ch !== h; });
            };
            Event.prototype.init = function (h) {
                this.hrefIniter(h);
                // TODO handle the list case
                if (this.projVal) {
                    var evd = new EventDetails();
                    evd.payload = this.projVal;
                    evd.populating = true;
                    evd.projected = true;
                    h.handle(evd);
                }
                for (var i = 0; i < this.events.length; i++) {
                    this.setupEvent(h, this.events[i]);
                }
                h._ref.once('value', function (ds) {
                    h.first = false;
                });
            };
            Event.prototype.setupHref = function (h) {
                h._ref = new Firebase(this.url);
            };
            Event.prototype.setupEvent = function (h, name) {
                var _this = this;
                // TODO what the second time the event fires?
                var proFunc = null;
                var fireprom = null;
                if (this._preload) {
                    var prom = new Promise(function (ok, err) {
                        proFunc = ok;
                    });
                    // Use the returned promise
                    fireprom = this._preload(prom);
                }
                h.hook(name, function (ds, pre) {
                    var evd = new EventDetails();
                    evd.payload = _this.parseValue(ds.val(), ds.ref().toString());
                    if (proFunc) {
                        proFunc(evd.payload);
                    }
                    evd.originalEvent = name;
                    evd.originalUrl = ds.ref().toString();
                    evd.originalKey = ds.key();
                    evd.precedingKey = pre;
                    evd.populating = h.first;
                    if (fireprom) {
                        fireprom.then(function () {
                            h.handle(evd);
                        });
                    }
                    else {
                        h.handle(evd);
                    }
                });
            };
            Event.prototype.off = function (ctx) {
                this.handlers = this.handlers.filter(function (h) { return !h.decomission(h.ctx === ctx); });
            };
            // TODO move to static
            Event.offAll = function (ctx, events) {
                for (var k in events) {
                    var evt = events[k];
                    if (!(evt instanceof Event))
                        continue;
                    evt.off(ctx);
                }
            };
            Event.prototype.hasHandlers = function () {
                return this.handlers.length > 0;
            };
            Event.prototype.parseValue = function (val, url) {
                if (val) {
                    if (this._ctorD) {
                        var objd = new this._ctorD();
                        objd.parse(url, val, this.db);
                        val = objd;
                    }
                    else if (this._isRef || Data.isRef(val)) {
                        val = Data.readRef(val, this.db);
                    }
                }
                return val;
            };
            Event.prototype.projectValue = function (val) {
                // TODO handle list case
                val = this.parseValue(val);
                if (!val)
                    return;
                this.projVal = val;
                var evd = new EventDetails();
                evd.payload = val;
                evd.populating = true;
                for (var i = 0; i < this.handlers.length; i++) {
                    if (!this.handlers[i].first)
                        continue;
                    this.handlers[i].handle(evd);
                }
            };
            return Event;
        })(IsEvent);
        internal.Event = Event;
        var ValueEvent = (function (_super) {
            __extends(ValueEvent, _super);
            function ValueEvent() {
                _super.apply(this, arguments);
                this.broadcasted = false;
            }
            ValueEvent.prototype.broadcast = function (val) {
                this.lastBroadcast = val;
                this.broadcasted = true;
                this.checkBroadcast();
            };
            ValueEvent.prototype.named = function (name) {
                if (this.name)
                    return this;
                _super.prototype.named.call(this, name);
                return this;
            };
            ValueEvent.prototype.preLoad = function (f) {
                _super.prototype.preLoad.call(this, f);
                return this;
            };
            ValueEvent.prototype.checkBroadcast = function () {
                if (!this.url || !this.broadcasted)
                    return;
                this.save(this.lastBroadcast);
                this.broadcasted = false;
                this.lastBroadcast = null;
            };
            ValueEvent.prototype.save = function (val) {
                var ref = new Firebase(this.url);
                var ser = this.serializeForSave(this.lastBroadcast);
                ref.set(ser);
            };
            ValueEvent.prototype.serializeForSave = function (val) {
                if (val instanceof Entity) {
                    // TODO projections
                    val.dbInit(null, this.db);
                    return val.url;
                }
                else if (val instanceof Data) {
                    // TODO projections
                    return val.serialize(this.db);
                }
                else {
                    return val;
                }
            };
            ValueEvent.prototype.dbInit = function (url, db, entity) {
                _super.prototype.dbInit.call(this, url, db, entity);
                this.checkBroadcast();
            };
            return ValueEvent;
        })(Event);
        internal.ValueEvent = ValueEvent;
        var ArrayValueEvent = (function (_super) {
            __extends(ArrayValueEvent, _super);
            function ArrayValueEvent() {
                _super.apply(this, arguments);
                this.broadcasted = false;
            }
            ArrayValueEvent.prototype.named = function (name) {
                if (this.name)
                    return this;
                _super.prototype.named.call(this, name);
                return this;
            };
            ArrayValueEvent.prototype.parseValue = function (val, url) {
                if (val) {
                    var nval = [];
                    var ks = Object.keys(val);
                    for (var i = 0; i < ks.length; i++) {
                        var sval = val[ks[i]];
                        sval = _super.prototype.parseValue.call(this, sval, url + '/' + ks[i]);
                        nval.push(sval);
                    }
                    val = nval;
                }
                return val;
            };
            ArrayValueEvent.prototype.preLoad = function (f) {
                _super.prototype.preLoad.call(this, f);
                return this;
            };
            return ArrayValueEvent;
        })(Event);
        internal.ArrayValueEvent = ArrayValueEvent;
        /*
        export class LoadedEntityEvent extends Event<Entity> implements ILoadedEntityEvent {
            private tosave = false;
            
            constructor(private entity : Entity) {
                super();
            }
            
            save() {
                this.tosave = true;
                this.trySave();
            }
            
            private trySave() {
                if (!this.tosave) return;
                if (!this.db) return;
                // TODO save data entity, will be an update
            }
            
            dbInit(url :string, db :Db) {
                super.dbInit(url, db);
                this.trySave();
            }
        }
        */
        var AddedListEvent = (function (_super) {
            __extends(AddedListEvent, _super);
            function AddedListEvent() {
                _super.call(this);
                this.events = ['child_added'];
            }
            AddedListEvent.prototype.projectValue = function (val) {
                // TODO No support for projection of lists
            };
            AddedListEvent.prototype.init = function (h) {
                this.hrefIniter(h);
                for (var i = 0; i < this.events.length; i++) {
                    this.setupEvent(h, this.events[i]);
                }
                h._ref.once('value', function (ds) {
                    var evd = new EventDetails();
                    evd.listEnd = true;
                    h.handle(evd);
                    h.first = false;
                });
            };
            AddedListEvent.prototype.save = function (val) {
                // We treat them as a set, if it's already there it will be updated
                var ser = this.serializeForSave(val);
                var ref = new Firebase(this.url);
                if (val instanceof Entity) {
                    // In case of objC we use the id ad a key, to assure uniqueness
                    ref.child(val.getId()).set(ser);
                }
                else if (val instanceof Data) {
                    // For objD they don't have an id, if it was previously saved here we update it, otherwise it's considered new
                    var objd = val;
                    if (objd._url && objd._url.indexOf(this.url) == 0 && objd._url.substring(this.url.length).indexOf('/') == -1) {
                        new Firebase(objd._url).set(ser);
                    }
                    else {
                        ref.child(IdGenerator.next()).set(ser);
                    }
                }
                else {
                    // Otherwise we just store it under a random id
                    ref.child(IdGenerator.next()).set(ser);
                }
            };
            return AddedListEvent;
        })(ValueEvent);
        internal.AddedListEvent = AddedListEvent;
        var EntityRoot = (function () {
            function EntityRoot(ctor) {
                this.instances = {};
                this.ctor = ctor;
            }
            EntityRoot.prototype.composeMyUrl = function () {
                if (!this.name || !this.db)
                    return;
                var url = this.db.baseUrl;
                if (url.charAt(url.length - 1) !== '/')
                    url += '/';
                url += this.name;
                this.url = url;
            };
            EntityRoot.prototype.dbInit = function (db) {
                this.db = db;
                this.composeMyUrl();
                //this.url = db.baseUrl + '/' + this.name;
            };
            EntityRoot.prototype.named = function (name) {
                if (this.name)
                    return;
                this.name = name;
                this.composeMyUrl();
                //if (this.db) this.url = this.db.baseUrl + '/' + this.name;
                return this;
            };
            EntityRoot.prototype.load = function (id) {
                if (id.indexOf(this.url) === 0)
                    id = id.substring(this.url.length);
                if (id.indexOf(this.name) === 0)
                    id = id.substring(this.name.length);
                if (id.charAt(0) === '/')
                    id = id.substring(1);
                var ret = this.instances[id];
                if (ret) {
                    return ret;
                }
                ret = new this.ctor();
                ret.dbInit(this.url + '/' + id, this.db);
                // TODO register for cancellation
                this.instances[id] = ret;
                return ret;
            };
            return EntityRoot;
        })();
        internal.EntityRoot = EntityRoot;
        var ListEvent = (function (_super) {
            __extends(ListEvent, _super);
            function ListEvent() {
                var _this = this;
                _super.call(this);
                this.name = null;
                this.allEvts = [];
                this._sortField = null;
                this._sortDesc = false;
                this._limit = 0;
                this._rangeFrom = null;
                this._rangeTo = null;
                this._equals = null;
                this._url = null;
                this._db = null;
                this._entity = null;
                this._ctorD = null;
                this.add = new AddedListEvent();
                this.remove = new Event();
                this.modify = new Event();
                this.all = new AddedListEvent();
                this.full = new ArrayValueEvent();
                this.add.events = ['child_added'];
                this.remove.events = ['child_removed'];
                this.modify.events = ['child_changed', 'child_moved'];
                this.all.events = ['child_added', 'child_removed', 'child_changed', 'child_moved'];
                this.allEvts = [this.add, this.remove, this.modify, this.all, this.full];
                for (var i = 0; i < this.allEvts.length; i++) {
                    var ae = this.allEvts[i];
                    ae.hrefIniter = function (h) { return _this.setupHref(h); };
                }
            }
            ListEvent.prototype.named = function (name) {
                if (this.name)
                    return this;
                this.name = name;
                for (var i = 0; i < this.allEvts.length; i++)
                    this.allEvts[i].named(name);
                return this;
            };
            ListEvent.prototype.objD = function (c) {
                this._ctorD = c;
                for (var i = 0; i < this.allEvts.length; i++) {
                    var ae = this.allEvts[i];
                    ae._ctorD = c;
                    ae._isRef = false;
                }
                return this;
            };
            /**
             * Called by the ObjC when the url is set.
             */
            ListEvent.prototype.dbInit = function (url, db, entity) {
                this._url = url;
                this._db = db;
                this._entity = entity;
                for (var i = 0; i < this.allEvts.length; i++) {
                    this.allEvts[i].dbInit(url, db, entity);
                }
            };
            ListEvent.prototype.subQuery = function () {
                var ret = new ListEvent();
                ret.named(this.name);
                if (this._ctorD) {
                    ret.objD(this._ctorD);
                }
                ret._sortField = this._sortField;
                ret._sortDesc = this._sortDesc;
                ret._limit = this._limit;
                ret._rangeFrom = this._rangeFrom;
                ret._rangeTo = this._rangeTo;
                ret._equals = this._equals;
                ret.dbInit(this._url, this._db, this._entity);
                return ret;
            };
            ListEvent.prototype.sortOn = function (field, desc) {
                if (desc === void 0) { desc = false; }
                this._sortField = field;
                this._sortDesc = desc;
                return this;
            };
            ListEvent.prototype.limit = function (limit) {
                this._limit = limit;
                return this;
            };
            ListEvent.prototype.range = function (from, to) {
                this._rangeFrom = from;
                this._rangeTo = to;
                return this;
            };
            ListEvent.prototype.equals = function (val) {
                this._equals = val;
                return this;
            };
            ListEvent.prototype.setupHref = function (h) {
                h._ref = new Firebase(h.event.url);
                if (this._sortField) {
                    h._ref = h._ref.orderByChild(this._sortField);
                    if (this._rangeFrom) {
                        h._ref = h._ref.startAt(this._rangeFrom);
                    }
                    if (this._rangeTo) {
                        h._ref = h._ref.startAt(this._rangeTo);
                    }
                    if (this._equals) {
                        h._ref = h._ref.equalTo(this._equals);
                    }
                }
                if (this._sortDesc) {
                    if (this._limit) {
                        h._ref = h._ref.limitToLast(this._limit);
                    }
                    else {
                        h._ref = h._ref.limitToLast(Number.MAX_VALUE);
                    }
                }
                else {
                    if (this._limit) {
                        h._ref = h._ref.limitToFirst(this._limit);
                    }
                }
            };
            return ListEvent;
        })(IsEvent);
        internal.ListEvent = ListEvent;
    })(internal = Db.internal || (Db.internal = {}));
})(Db || (Db = {}));
module.exports = Db;
//# sourceMappingURL=Db.js.map