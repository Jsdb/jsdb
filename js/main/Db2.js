/// <reference path="../../typings/tsd.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Firebase = require('firebase');
var PromiseModule = require('es6-promise');
var Promise = PromiseModule.Promise;
var Db = (function () {
    function Db(baseUrl) {
        this.cache = {};
        this.baseUrl = baseUrl;
    }
    Db.prototype.init = function () {
        var ks = Object.keys(this);
        for (var i = 0; i < ks.length; i++) {
            if (!(this[ks[i]] instanceof Db.internal.EntityRoot))
                continue;
            var er = this[ks[i]].named(ks[i]);
            er.initDb(this);
        }
    };
    // TODO make sure everything pass thru here
    Db.prototype.load = function (url, ctor) {
        var ret = this.cache[url];
        if (ret)
            return ret;
        if (!ctor) {
            var ks = Object.keys(this);
            for (var i = 0; i < ks.length; i++) {
                if (!(this[ks[i]] instanceof Db.internal.EntityRoot))
                    continue;
                var er = this[ks[i]];
                if (url.indexOf(er.url) === 0) {
                    ctor = er.constr;
                    break;
                }
            }
        }
        if (!ctor) {
            throw "The url " + url + " is not bound by an entity root";
        }
        var inst = new ctor();
        if (inst.dbInit) {
            inst.dbInit(url, this);
        }
        if (inst.load && inst.load.dbInit) {
            inst.load.dbInit(url, this);
        }
        this.cache[url] = inst;
        return inst;
    };
    Db.prototype.save = function (entity) {
        var entityEvent = entity.load;
        if (!entityEvent.url) {
            this.assignUrl(entity);
        }
        return entity.save();
    };
    Db.prototype.assignUrl = function (entity) {
        var entityEvent = entity.load;
        if (entityEvent.url)
            return;
        var ks = Object.keys(this);
        var root = null;
        for (var i = 0; i < ks.length; i++) {
            if (!(this[ks[i]] instanceof Db.internal.EntityRoot))
                continue;
            var er = this[ks[i]];
            if (er.constr == entity.constructor) {
                root = er;
                break;
            }
        }
        if (!root)
            throw "The class " + (entity.constructor) + " is not mapped to an entity root";
        var id = Db.internal.IdGenerator.next();
        entityEvent.dbInit(root.url + '/' + id, this);
    };
    Db.prototype.reset = function () {
        for (var url in this.cache) {
            var e = this.cache[url];
        }
        this.cache = {};
    };
    return Db;
})();
var Db;
(function (Db) {
    function entityRoot(c) {
        return new internal.EntityRoot(c);
    }
    Db.entityRoot = entityRoot;
    function embedded(c, binding) {
        var ret = new c();
        ret.load.bind(binding);
        return ret;
    }
    Db.embedded = embedded;
    function reference(c) {
        var ret = new internal.ReferenceImpl(c);
        return ret;
    }
    Db.reference = reference;
    function referenceBuilder(c) {
        return (function () {
            return new internal.ReferenceImpl(c);
        });
    }
    Db.referenceBuilder = referenceBuilder;
    function list(c) {
        return new internal.ListImpl(c);
    }
    Db.list = list;
    function bind(localName, targetName, live) {
        if (live === void 0) { live = true; }
        var ret = new internal.BindingImpl();
        ret.bind(localName, targetName, live);
        return ret;
    }
    Db.bind = bind;
    var Utils = (function () {
        function Utils() {
        }
        Utils.entitySerialize = function (e, fields) {
            if (e.serialize) {
                return e.serialize();
            }
            return Utils.rawEntitySerialize(e, fields);
        };
        Utils.rawEntitySerialize = function (e, fields) {
            var ret = {};
            fields = fields || Object.keys(e);
            for (var i = 0; i < fields.length; i++) {
                var k = fields[i];
                if (k == 'load')
                    continue;
                var v = e[k];
                if (v == null)
                    continue;
                if (typeof v === 'function')
                    continue;
                if (v instanceof Entity) {
                    v = Utils.entitySerialize(v);
                }
                else if (v['serialize']) {
                    v = v.serialize();
                }
                ret[k] = v;
            }
            return ret;
        };
        return Utils;
    })();
    Db.Utils = Utils;
    var ResolvablePromise = (function () {
        function ResolvablePromise() {
            var _this = this;
            this.promise = null;
            this.promise = new Promise(function (ok, err) {
                _this.resolve = ok;
                _this.error = err;
            });
        }
        return ResolvablePromise;
    })();
    Db.ResolvablePromise = ResolvablePromise;
    var Entity = (function () {
        function Entity() {
            this.load = new internal.EntityEvent(this);
        }
        Entity.prototype.save = function () {
            var resprom = new ResolvablePromise();
            var url = this.load.url;
            if (!url)
                throw "Cannot save entity because it was not loaded from DB, use Db.save() instead";
            new Firebase(url).set(Utils.entitySerialize(this), function (err) {
                if (!err) {
                    resprom.resolve(true);
                }
                else {
                    resprom.error(err);
                }
            });
            return resprom.promise;
        };
        Entity.prototype.then = function (onFulfilled, onRejected) {
            //console.log("Called then on " + this.constructor.name);
            var resprom = new ResolvablePromise();
            this.load.once(this, function (detail) {
                if (!detail.projected) {
                    if (onFulfilled) {
                        resprom.resolve(onFulfilled(detail));
                    }
                    else {
                        resprom.resolve(detail);
                    }
                }
            });
            return resprom.promise;
        };
        return Entity;
    })();
    Db.Entity = Entity;
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
        var EntityRoot = (function () {
            function EntityRoot(c) {
                this.constr = null;
                this.db = null;
                //instances :{[index:string]:E} = {};
                this.name = null;
                this.url = null;
                this.constr = c;
            }
            EntityRoot.prototype.named = function (name) {
                if (this.name)
                    return;
                this.name = name;
                return this;
            };
            EntityRoot.prototype.initDb = function (db) {
                this.db = db;
                this.url = db.baseUrl + this.name + '/';
            };
            EntityRoot.prototype.query = function () {
                var ret = new QueryImpl(this.constr);
                ret.dbInit(this.url, this.db);
                return ret;
            };
            EntityRoot.prototype.load = function (url) {
                if (url.indexOf(this.url) === -1) {
                    url = this.url + url;
                }
                return this.db.load(url, this.constr);
            };
            return EntityRoot;
        })();
        internal.EntityRoot = EntityRoot;
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
            BindingImpl.prototype.resolve = function (parent, entityProm) {
                var _this = this;
                var proms = [];
                proms.push(entityProm);
                for (var i = 0; i < this.keys.length; i++) {
                    var k = this.keys[i];
                    if (k === 'this') {
                        proms.push(Promise.resolve(parent));
                        continue;
                    }
                    var val = parent[k];
                    if (val instanceof ReferenceImpl) {
                        var ri = val;
                        proms.push(ri.then(function () {
                            return ri.value;
                        }));
                    }
                    else if (val instanceof Entity) {
                        proms.push(Promise.resolve(val));
                    }
                    else {
                        proms.push(Promise.resolve(val));
                    }
                }
                return Promise.all(proms).then(function (vals) {
                    //console.log("Done values ", vals);
                    var tgt = vals[0].payload;
                    for (var i = 0; i < _this.keys.length; i++) {
                        var k = _this.keys[i];
                        var val = vals[i + 1];
                        if (val instanceof EventDetails) {
                            val = val.payload;
                        }
                        if (_this.live[k]) {
                            if (val instanceof Entity) {
                                val.load.live(tgt);
                            }
                            // References needs more attention, because they get here already resolved and need a second copy
                            if (parent[k] instanceof ReferenceImpl) {
                                // Wrap in closure for K
                                (function (k) {
                                    var ref = parent[k];
                                    ref.load.on(tgt, function (det) {
                                        tgt[_this.bindings[k]] = ref.value;
                                    });
                                })(k);
                            }
                        }
                        tgt[_this.bindings[k]] = val;
                    }
                });
            };
            return BindingImpl;
        })();
        internal.BindingImpl = BindingImpl;
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
                this._ref.on(event, fn, function (err) {
                }, this);
            };
            EventHandler.prototype.decomission = function (remove) {
                // override off, must remove only this instance callbacks, Firebase does not
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
                // the after is executed before to avoid bouncing
                if (this.after)
                    this.after(this);
                try {
                    this.method.call(this.ctx, evd);
                }
                finally {
                }
                //console.log("Then calling", this.after);
            };
            EventHandler.prog = 1;
            return EventHandler;
        })();
        internal.EventHandler = EventHandler;
        var Event = (function () {
            function Event() {
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
                this._preload = null;
                this.events = ['value'];
                this.projVal = null;
                this.hrefIniter = this.setupHref;
            }
            /**
             * Called by the Entity when the url is set.
             */
            Event.prototype.dbInit = function (url, db) {
                this.url = url;
                this.db = db;
                for (var i = 0; i < this.handlers.length; i++) {
                    this.init(this.handlers[i]);
                }
            };
            Event.prototype.on = function (ctx, handler) {
                this.handlers = this.handlers.filter(function (h) { return h.decomission(h.ctx === ctx && h.method === handler); });
                var h = new EventHandler(this, ctx, handler);
                this.handlers.push(h);
                // At this point the url could not yet have been set
                if (typeof ctx.attached != 'undefined') {
                    ctx.attached(this);
                }
                if (this.url) {
                    this.init(h);
                }
            };
            Event.prototype.liveMarkerHandler = function () {
            };
            Event.prototype.live = function (ctx) {
                this.on(ctx, this.liveMarkerHandler);
            };
            Event.prototype.once = function (ctx, handler) {
                var _this = this;
                var h = new EventHandler(this, ctx, handler);
                this.handlers.push(h);
                h.after = function () {
                    _this.offHandler(h);
                };
                if (typeof ctx.attached != 'undefined') {
                    ctx.attached(this);
                }
                // At this point the url could not yet have been set
                if (this.url)
                    this.init(h);
            };
            Event.prototype.offHandler = function (h) {
                //console.log("Decommissioning ", handler);
                h.decomission(true);
                this.handlers = this.handlers.filter(function (ch) { return ch !== h; });
            };
            Event.prototype.init = function (h) {
                this.hrefIniter(h);
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
                //console.log("Setting up event");
                //console.trace();
                // TODO what the second time the event fires?
                var resprom = null;
                var fireprom = null;
                if (this._preload) {
                    resprom = new ResolvablePromise();
                    // Use the returned promise
                    fireprom = this._preload(resprom.promise);
                }
                h.hook(name, function (ds, pre) {
                    var evd = new EventDetails();
                    evd.payload = _this.parseValue(ds.val(), ds.ref().toString());
                    if (resprom) {
                        resprom.resolve(evd);
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
            Event.prototype.parseValue = function (val, url) {
                throw "Default parse value is not implemented";
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
            return Event;
        })();
        internal.Event = Event;
        var EntityEvent = (function (_super) {
            __extends(EntityEvent, _super);
            function EntityEvent(myEntity) {
                _super.call(this);
                /*
                static getEventFor<T>(x:T):EntityEvent<T> {
                    return (<EntityEvent<T>>(<Entity><any>x).load);
                }
                */
                this.myEntity = null;
                this.parentEntity = null;
                this.binding = null;
                this.myEntity = myEntity;
            }
            EntityEvent.prototype.bind = function (binding) {
                var _this = this;
                if (!binding)
                    return;
                this.binding = binding;
                this._preload = function (p) {
                    return _this.binding.resolve(_this.parentEntity, p);
                };
            };
            EntityEvent.prototype.setParentEntity = function (parent) {
                this.parentEntity = parent;
            };
            EntityEvent.prototype.dbInit = function (url, db) {
                _super.prototype.dbInit.call(this, url, db);
                var ks = Object.keys(this.myEntity);
                for (var i = 0; i < ks.length; i++) {
                    var se = this.myEntity[ks[i]];
                    if (se == null)
                        continue;
                    // Avoid looping on myself
                    if (se === this)
                        continue;
                    if (typeof se === 'object') {
                        if (se.dbInit) {
                            se.dbInit(url + '/' + ks[i], db);
                            if (se.setParentEntity) {
                                se.setParentEntity(this.myEntity);
                            }
                        }
                        else if (se.load && se.load != null && se.load.dbInit) {
                            se.load.dbInit(url + '/' + ks[i], db);
                            if (se.load.setParentEntity) {
                                se.load.setParentEntity(this.myEntity);
                            }
                        }
                    }
                }
            };
            EntityEvent.prototype.parseValue = function (val, url) {
                if (!val) {
                    console.log("Value is ", val);
                    return;
                }
                var ks = Object.keys(val);
                for (var i = 0; i < ks.length; i++) {
                    var prev = this.myEntity[ks[i]];
                    if (prev instanceof Entity) {
                        prev.load.parseValue(val[ks[i]]);
                    }
                    else {
                        // TODO handle collections
                        this.myEntity[ks[i]] = val[ks[i]];
                    }
                }
                return this.myEntity;
            };
            return EntityEvent;
        })(Event);
        internal.EntityEvent = EntityEvent;
        var ReferenceEvent = (function (_super) {
            __extends(ReferenceEvent, _super);
            function ReferenceEvent(myEntity) {
                _super.call(this, myEntity);
            }
            ReferenceEvent.prototype.parseValue = function (val, url) {
                if (!val) {
                    console.log("Value is ", val, url);
                    return;
                }
                if (!val._ref) {
                    console.log("No _ref for reference in ", val, url);
                    return;
                }
                // passing the constructor here to the db.load method, we have reference to nested objects
                this.myEntity.value = this.db.load(val._ref, this.myEntity._ctor);
                this.myEntity.url = val._ref;
                // TODO parse the value for projections
                return this.myEntity;
            };
            return ReferenceEvent;
        })(EntityEvent);
        internal.ReferenceEvent = ReferenceEvent;
        var ReferenceImpl = (function (_super) {
            __extends(ReferenceImpl, _super);
            function ReferenceImpl(c) {
                var _this = this;
                _super.call(this);
                this.load = new ReferenceEvent(this);
                this.value = null;
                this.serialize = function () {
                    var url = null;
                    if (_this.value === null) {
                        url = _this.load.url;
                    }
                    else {
                        url = _this.value.load.url;
                    }
                    if (url === null)
                        return null;
                    return {
                        _ref: url
                    };
                };
                this._ctor = c;
            }
            return ReferenceImpl;
        })(Entity);
        internal.ReferenceImpl = ReferenceImpl;
        var CollectionEntityEvent = (function (_super) {
            __extends(CollectionEntityEvent, _super);
            function CollectionEntityEvent(c) {
                _super.call(this);
                this.ctor = c;
            }
            CollectionEntityEvent.prototype.parseValue = function (val, url) {
                // TODO should pass val here, for projections and to handle refs
                var e = this.db.load(url, this.ctor);
                //var e = new this.ctor();
                // TODO mess here, value returned form db.load is almost certainly an entity, and collections also handle entities, but it's not stated in generics
                var ev = e.load;
                ev.parseValue(val, url);
                return e;
            };
            return CollectionEntityEvent;
        })(Event);
        internal.CollectionEntityEvent = CollectionEntityEvent;
        var CollectionAddedEntityEvent = (function (_super) {
            __extends(CollectionAddedEntityEvent, _super);
            function CollectionAddedEntityEvent(c) {
                _super.call(this, c);
                this.events = ['child_added'];
            }
            CollectionAddedEntityEvent.prototype.init = function (h) {
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
            return CollectionAddedEntityEvent;
        })(CollectionEntityEvent);
        internal.CollectionAddedEntityEvent = CollectionAddedEntityEvent;
        var CollectionImpl = (function () {
            function CollectionImpl(c) {
                var _this = this;
                this.add = null;
                this.remove = null;
                this.ctor = c;
                this.add = new CollectionAddedEntityEvent(c);
                this.remove = new CollectionEntityEvent(c);
                this.remove.events = ['child_removed'];
                this.add.hrefIniter = function (h) { return _this.setupHref(h); };
                this.remove.hrefIniter = function (h) { return _this.setupHref(h); };
            }
            CollectionImpl.prototype.dbInit = function (url, db) {
                this.db = db;
                this.url = url;
                this.add.dbInit(url, db);
                this.remove.dbInit(url, db);
            };
            CollectionImpl.prototype.query = function () {
                var ret = new QueryImpl(this.ctor);
                ret.dbInit(this.url, this.db);
                return ret;
            };
            CollectionImpl.prototype.setupHref = function (h) {
                h._ref = new Firebase(h.event.url);
            };
            return CollectionImpl;
        })();
        internal.CollectionImpl = CollectionImpl;
        var ListImpl = (function (_super) {
            __extends(ListImpl, _super);
            function ListImpl() {
                _super.apply(this, arguments);
                this.value = [];
            }
            ListImpl.prototype.then = function (onFulfilled, onRejected) {
                var _this = this;
                var resprom = new ResolvablePromise();
                var vals = [];
                this.add.on(this, function (detail) {
                    if (detail.listEnd) {
                        detail.offMe();
                        _this.value = vals;
                        if (onFulfilled) {
                            resprom.resolve(onFulfilled());
                        }
                        else {
                            resprom.resolve(null);
                        }
                    }
                    else {
                        vals.push(detail.payload);
                    }
                });
                return resprom.promise;
            };
            return ListImpl;
        })(CollectionImpl);
        internal.ListImpl = ListImpl;
        var QueryImpl = (function (_super) {
            __extends(QueryImpl, _super);
            function QueryImpl() {
                _super.apply(this, arguments);
                this._sortField = null;
                this._sortDesc = false;
                this._limit = 0;
                this._rangeFrom = null;
                this._rangeTo = null;
                this._equals = null;
            }
            QueryImpl.prototype.sortOn = function (field, desc) {
                if (desc === void 0) { desc = false; }
                this._sortField = field;
                this._sortDesc = desc;
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
            QueryImpl.prototype.setupHref = function (h) {
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
            return QueryImpl;
        })(ListImpl);
        internal.QueryImpl = QueryImpl;
    })(internal = Db.internal || (Db.internal = {}));
})(Db || (Db = {}));
module.exports = Db;
//# sourceMappingURL=Db2.js.map