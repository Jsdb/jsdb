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
    Db.prototype.load = function (url) {
        var ret = this.cache[url];
        if (ret)
            return ret;
        var ks = Object.keys(this);
        for (var i = 0; i < ks.length; i++) {
            if (!(this[ks[i]] instanceof Db.internal.EntityRoot))
                continue;
            var er = this[ks[i]];
            if (url.indexOf(er.url) === 0)
                return er.load(url);
        }
        throw "The url " + url + " is not bound by an entity root";
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
    function embedded(c) {
        var ret = new c();
        return ret;
    }
    Db.embedded = embedded;
    function reference(c) {
        var ret = new internal.ReferenceImpl();
        return ret;
    }
    Db.reference = reference;
    var Entity = (function () {
        function Entity() {
            this.load = new internal.EntityEvent(this);
        }
        Entity.prototype.then = function (onFulfilled, onRejected) {
            var fu = null;
            var ret = new Promise(function (res, err) {
                fu = res;
            });
            this.load.once(this, function (detail) {
                if (!detail.projected) {
                    if (onFulfilled) {
                        fu(onFulfilled(detail));
                    }
                    else {
                        fu(null);
                    }
                }
            });
            return ret;
        };
        return Entity;
    })();
    Db.Entity = Entity;
    var internal;
    (function (internal) {
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
            EntityRoot.prototype.load = function (url) {
                if (url.indexOf(this.url) === -1) {
                    url = this.url + url;
                }
                var ret = this.db.cache[url];
                if (ret)
                    return ret;
                ret = new this.constr();
                ret.load.dbInit(url, this.db);
                this.db.cache[url] = ret;
                return ret;
            };
            EntityRoot.prototype.save = function (entity) {
                // TODO implement
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
                this.method.call(this.ctx, evd);
                //console.log("Then calling", this.after);
                if (this.after)
                    this.after(this);
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
                this.myEntity = null;
                this.myEntity = myEntity;
            }
            EntityEvent.getEventFor = function (x) {
                return x.load;
            };
            EntityEvent.prototype.dbInit = function (url, db) {
                _super.prototype.dbInit.call(this, url, db);
                var ks = Object.keys(this.myEntity);
                for (var i = 0; i < ks.length; i++) {
                    var se = this.myEntity[ks[i]];
                    if (!(se instanceof Entity))
                        continue;
                    EntityEvent.getEventFor(se).dbInit(url + '/' + ks[i], db);
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
                        EntityEvent.getEventFor(prev).parseValue(val[ks[i]]);
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
                this.myEntity.value = this.db.load(val._ref);
                return this.myEntity;
            };
            return ReferenceEvent;
        })(EntityEvent);
        internal.ReferenceEvent = ReferenceEvent;
        var ReferenceImpl = (function (_super) {
            __extends(ReferenceImpl, _super);
            function ReferenceImpl() {
                _super.apply(this, arguments);
                this.load = new ReferenceEvent(this);
                this.value = null;
            }
            return ReferenceImpl;
        })(Entity);
        internal.ReferenceImpl = ReferenceImpl;
    })(internal = Db.internal || (Db.internal = {}));
})(Db || (Db = {}));
module.exports = Db;
//# sourceMappingURL=Db2.js.map