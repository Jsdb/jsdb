var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
        else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    } else {
        var glb = typeof window !== 'undefined' ? window : global;
        glb['Db3Mock'] = factory(null, {});
    }

})(["require", "exports"], function (require, exports) {
    var glb = typeof window !== 'undefined' ? window : global;
    var TsdbImpl = glb['Tsdb'] || require('./Tsdb');
    function findChain(url, from, leaf, create) {
        if (leaf === void 0) { leaf = true; }
        if (create === void 0) { create = false; }
        var sp;
        if (typeof (url) === 'string') {
            sp = splitUrl(url);
        }
        else {
            sp = url;
        }
        var to = sp.length;
        if (!leaf)
            to--;
        var ret = [];
        var ac = from;
        ret.push(ac);
        for (var i = 0; i < to; i++) {
            if (sp[i].length == 0)
                continue;
            if (!create && typeof (ac) !== 'object') {
                ret.push(undefined);
                break;
            }
            var pre = ac;
            ac = ac[sp[i]];
            if (typeof (ac) === 'undefined') {
                if (!create) {
                    ret.push(undefined);
                    break;
                }
                ac = {};
                pre[sp[i]] = ac;
            }
            ret.push(ac);
        }
        return ret;
    }
    /**
     * Removes beginning and trailing slashes
     */
    function normalizeUrl(url) {
        if (url.charAt(url.length - 1) == '/')
            url = url.substr(0, url.length - 1);
        if (url.charAt(0) == '/')
            url = url.substr(1);
        return url;
    }
    function splitUrl(url) {
        return normalizeUrl(url).split('/');
    }
    function callLater(cb, err) {
        if (cb)
            setTimeout(function () { return cb(err); }, 0);
    }
    function camelCase(str) {
        return str.charAt(0).toUpperCase() +
            str.substr(1).replace(/_(.)/, function (all, m1) { return m1.toUpperCase(); });
    }
    function deepEquals(a, b) {
        return JSON.stringify(a) == JSON.stringify(b);
    }
    function getKeysOrdered(obj, fn) {
        fn = fn || obj['$sorter'];
        var sortFn = null;
        if (fn) {
            sortFn = function (a, b) {
                return fn(obj[a], obj[b]);
            };
        }
        var ks = Object.getOwnPropertyNames(obj);
        var ret = [];
        for (var i = 0; i < ks.length; i++) {
            if (ks[i].charAt(0) == '$')
                continue;
            ret.push(ks[i]);
        }
        ret = ret.sort(sortFn);
        return ret;
    }
    var Db3MockRoot = (function () {
        function Db3MockRoot(conf) {
            this.conf = conf;
            this.data = {};
            this.buffering = false;
            this.buffer = [];
            this.listeners = {};
        }
        Db3MockRoot.prototype.find = function (url, from, leaf, create) {
            if (from === void 0) { from = this.data; }
            if (leaf === void 0) { leaf = true; }
            if (create === void 0) { create = false; }
            var ret = findChain(url, from, leaf, create);
            return ret.pop();
        };
        Db3MockRoot.prototype.getData = function (url) {
            return this.find(url);
        };
        Db3MockRoot.prototype.bufferOp = function (fn) {
            this.buffer.push(fn);
        };
        Db3MockRoot.prototype.setData = function (url, data, cb) {
            var _this = this;
            if (this.buffering) {
                this.bufferOp(function () { _this.setData(url, data, cb); });
                return;
            }
            var sp = splitUrl(url);
            // Snapshot all the data (could be waaaaay better)
            var snapShot = JSON.parse(JSON.stringify(this.data));
            // Find old values
            var oldValChain = findChain(sp, snapShot, true, false);
            // Find the data path
            var dataChain = findChain(sp, this.data, false, true);
            // Find all parent listeners
            var listenerChain = findChain(sp, this.listeners, true, true);
            // Set the new data
            var ac = dataChain.pop();
            var k = sp[sp.length - 1];
            var oldVal = ac[k];
            if (data == null || typeof (data) == 'undefined') {
                delete ac[k];
            }
            else {
                ac[k] = data;
            }
            // Rebuild full data chain 
            dataChain = findChain(sp, this.data, true, true);
            // Notify parents
            for (var i = 0; i < listenerChain.length - 1; i++) {
                if (listenerChain[i] && listenerChain[i].$listener) {
                    listenerChain[i].$listener.trigger(oldValChain[i], dataChain[i]);
                }
            }
            // Notify children 
            this.recurseTrigger(listenerChain.pop(), oldVal, data);
            callLater(cb);
        };
        Db3MockRoot.prototype.recurseTrigger = function (listeners, oldVal, newVal) {
            if (!listeners)
                return;
            if (listeners.$listener)
                listeners.$listener.trigger(oldVal, newVal);
            var ks = Object.getOwnPropertyNames(listeners);
            for (var i = 0; i < ks.length; i++) {
                var k = ks[i];
                if (k.charAt(0) == '$')
                    continue;
                this.recurseTrigger(listeners[k], oldVal ? oldVal[k] : oldVal, newVal ? newVal[k] : newVal);
            }
        };
        Db3MockRoot.prototype.updateData = function (url, data, cb) {
            var _this = this;
            if (this.buffering) {
                this.bufferOp(function () { _this.updateData(url, data, cb); });
                return;
            }
            if (typeof (data) !== 'object') {
                return this.setData(url, data);
            }
            url = normalizeUrl(url);
            var ks = Object.getOwnPropertyNames(data);
            for (var i = 0; i < ks.length; i++) {
                var k = ks[i];
                this.setData(url + '/' + k, data[k]);
            }
            callLater(cb);
        };
        Db3MockRoot.prototype.flush = function () {
            var prebuf = this.buffering;
            var fn = null;
            this.buffering = false;
            try {
                while ((fn = this.buffer.shift()))
                    fn();
            }
            finally {
                this.buffering = prebuf;
            }
        };
        Db3MockRoot.prototype.listen = function (url) {
            var sp = splitUrl(url);
            var ac = this.find(sp, this.listeners, true, true);
            if (!ac.$listener) {
                ac.$listener = new Db3MockRoot.Listener();
                ac.$listener.trigger(undefined, this.getData(url));
            }
            return ac.$listener;
        };
        Db3MockRoot.prototype.getUrl = function (url) {
            return new Db3MockRoot.Db3MockTree(this, this.makeRelative(url));
        };
        Db3MockRoot.prototype.makeRelative = function (url) {
            if (url.indexOf(this.conf.baseUrl) != 0)
                return url;
            return "/" + url.substr(this.conf.baseUrl.length);
        };
        Db3MockRoot.prototype.makeAbsolute = function (url) {
            return this.conf.baseUrl + this.makeRelative(url);
        };
        Db3MockRoot.prototype.isReady = function () {
            return true;
        };
        Db3MockRoot.prototype.whenReady = function () {
            return Promise.resolve();
        };
        Db3MockRoot.create = function (conf) {
            return new Db3MockRoot(conf);
        };
        return Db3MockRoot;
    })();
    var Db3MockRoot;
    (function (Db3MockRoot) {
        var Listener = (function () {
            function Listener() {
                this.cbs = [];
                this.endCbs = [];
            }
            Listener.prototype.add = function (cb) {
                this.cbs.push(cb);
                cb(undefined, this.last);
            };
            Listener.prototype.addEnd = function (cb) {
                this.endCbs.push(cb);
                cb(undefined, this.last);
            };
            Listener.prototype.remove = function (cb) {
                this.cbs = this.cbs.filter(function (ocb) { return ocb !== cb; });
                this.endCbs = this.endCbs.filter(function (ocb) { return ocb !== cb; });
            };
            Listener.prototype.trigger = function (oldVal, newVal) {
                this.last = newVal;
                for (var i = 0; i < this.cbs.length; i++) {
                    this.cbs[i](oldVal, newVal);
                }
                for (var i = 0; i < this.endCbs.length; i++) {
                    this.endCbs[i](oldVal, newVal);
                }
            };
            return Listener;
        })();
        Db3MockRoot.Listener = Listener;
        var Db3MockSnap = (function () {
            function Db3MockSnap(data, root, url) {
                this.data = data;
                this.root = root;
                this.url = url;
                if (data != null && typeof (data) !== undefined) {
                    this.data = JSON.parse(JSON.stringify(data));
                    if (data['$sorter'])
                        this.data['$sorter'] = data['$sorter'];
                }
                else {
                    this.data = data;
                }
            }
            Db3MockSnap.prototype.exists = function () {
                return typeof (this.data) !== 'undefined' && this.data !== null;
            };
            Db3MockSnap.prototype.val = function () {
                if (!this.exists())
                    return null;
                return JSON.parse(JSON.stringify(this.data));
            };
            Db3MockSnap.prototype.child = function (childPath) {
                var subs = findChain(childPath, this.data, true, false);
                return new Db3MockSnap(subs.pop(), this.root, this.url + '/' + normalizeUrl(childPath));
            };
            Db3MockSnap.prototype.forEach = function (childAction) {
                if (!this.exists())
                    return;
                var ks = getKeysOrdered(this.data);
                for (var i = 0; i < ks.length; i++) {
                    if (childAction(this.child(ks[i])))
                        return true;
                }
                return false;
            };
            Db3MockSnap.prototype.key = function () {
                return this.url.split('/').pop() || '';
            };
            Db3MockSnap.prototype.ref = function () {
                return this.root.getUrl(this.url);
            };
            return Db3MockSnap;
        })();
        Db3MockRoot.Db3MockSnap = Db3MockSnap;
        var CbHandler = (function () {
            function CbHandler(callback, context, tree) {
                var _this = this;
                this.callback = callback;
                this.context = context;
                this.tree = tree;
                this.cb = null;
                this.cb = function (o, n) { return _this.trigger(o, n); };
                this.hook();
            }
            CbHandler.prototype.matches = function (eventType, callback, context) {
                if (context) {
                    return this.eventType == eventType && this.callback === callback && this.context === context;
                }
                else if (callback) {
                    return this.eventType == eventType && this.callback === callback;
                }
                else {
                    return this.eventType == eventType;
                }
            };
            CbHandler.prototype.hook = function () {
                this.tree.getListener().add(this.cb);
            };
            CbHandler.prototype.decommission = function () {
                this.tree.getListener().remove(this.cb);
            };
            return CbHandler;
        })();
        var ValueCbHandler = (function (_super) {
            __extends(ValueCbHandler, _super);
            function ValueCbHandler() {
                _super.apply(this, arguments);
            }
            ValueCbHandler.prototype.hook = function () {
                this.tree.getListener().addEnd(this.cb);
            };
            ValueCbHandler.prototype.trigger = function (oldVal, newVal) {
                this.callback(new Db3MockSnap(newVal, this.tree.root, this.tree.url));
            };
            return ValueCbHandler;
        })(CbHandler);
        var ChildAddedCbHandler = (function (_super) {
            __extends(ChildAddedCbHandler, _super);
            function ChildAddedCbHandler() {
                _super.apply(this, arguments);
            }
            ChildAddedCbHandler.prototype.trigger = function (oldVal, newVal) {
                if (typeof (newVal) !== 'object')
                    return;
                var mysnap = new Db3MockSnap(newVal, this.tree.root, this.tree.url);
                var ks = getKeysOrdered(newVal);
                var prek = null;
                for (var i = 0; i < ks.length; i++) {
                    var k = ks[i];
                    if (!oldVal || !oldVal[k])
                        this.callback(mysnap.child(k), prek);
                    prek = k;
                }
            };
            return ChildAddedCbHandler;
        })(CbHandler);
        var ChildRemovedCbHandler = (function (_super) {
            __extends(ChildRemovedCbHandler, _super);
            function ChildRemovedCbHandler() {
                _super.apply(this, arguments);
            }
            ChildRemovedCbHandler.prototype.trigger = function (oldVal, newVal) {
                _super.prototype.trigger.call(this, newVal, oldVal);
            };
            return ChildRemovedCbHandler;
        })(ChildAddedCbHandler);
        var ChildMovedCbHandler = (function (_super) {
            __extends(ChildMovedCbHandler, _super);
            function ChildMovedCbHandler() {
                _super.apply(this, arguments);
            }
            ChildMovedCbHandler.prototype.trigger = function (oldVal, newVal) {
                if (typeof (newVal) !== 'object')
                    return;
                if (typeof (oldVal) !== 'object')
                    return;
                // TODO ordering
                var oks = getKeysOrdered(oldVal);
                var nks = getKeysOrdered(newVal);
                var mysnap = new Db3MockSnap(newVal, this.tree.root, this.tree.url);
                var oprek = null;
                for (var i = 0; i < oks.length; i++) {
                    var k = oks[i];
                    var npos = nks.indexOf(k);
                    if (npos < 0)
                        continue;
                    var nprek = npos == 0 ? null : nks[npos - 1];
                    if (nprek != oprek) {
                        this.callback(mysnap.child(k), nprek);
                    }
                    oprek = k;
                }
            };
            return ChildMovedCbHandler;
        })(CbHandler);
        var ChildChangedCbHandler = (function (_super) {
            __extends(ChildChangedCbHandler, _super);
            function ChildChangedCbHandler() {
                _super.apply(this, arguments);
            }
            ChildChangedCbHandler.prototype.trigger = function (oldVal, newVal) {
                if (typeof (newVal) !== 'object')
                    return;
                if (typeof (oldVal) !== 'object')
                    return;
                var nks = Object.getOwnPropertyNames(newVal);
                var mysnap = new Db3MockSnap(newVal, this.tree.root, this.tree.url);
                for (var i = 0; i < nks.length; i++) {
                    var k = nks[i];
                    var preVal = oldVal[k];
                    if (!preVal)
                        continue;
                    var nprek = i == 0 ? null : nks[i - 1];
                    if (!deepEquals(newVal[k], preVal))
                        this.callback(mysnap.child(k), nprek);
                }
            };
            return ChildChangedCbHandler;
        })(CbHandler);
        var cbHandlers = {
            value: ValueCbHandler,
            child_added: ChildAddedCbHandler,
            child_removed: ChildRemovedCbHandler,
            child_moved: ChildMovedCbHandler,
            child_changed: ChildChangedCbHandler
        };
        var Db3MockTree = (function () {
            function Db3MockTree(root, url) {
                this.root = root;
                this.url = url;
                this.cbs = [];
                this.qlistener = null;
            }
            Db3MockTree.prototype.getListener = function () {
                return this.qlistener || this.root.listen(this.url);
            };
            Db3MockTree.prototype.toString = function () {
                return this.root.makeAbsolute(this.url);
            };
            Db3MockTree.prototype.set = function (value, onComplete) {
                this.root.setData(this.url, value, onComplete);
            };
            Db3MockTree.prototype.update = function (value, onComplete) {
                this.root.updateData(this.url, value, onComplete);
            };
            Db3MockTree.prototype.remove = function (onComplete) {
                this.set(null, onComplete);
            };
            Db3MockTree.prototype.on = function (eventType, callback, cancelCallback, context) {
                var ctor = cbHandlers[eventType];
                if (!ctor)
                    throw new Error("Cannot find event " + eventType);
                var handler = new ctor(callback, context, this);
                handler.eventType = eventType;
                this.cbs.push(handler);
                return callback;
            };
            Db3MockTree.prototype.off = function (eventType, callback, context) {
                this.cbs = this.cbs.filter(function (ach) {
                    if (ach.matches(eventType, callback, context)) {
                        ach.decommission();
                        return true;
                    }
                    return false;
                });
            };
            Db3MockTree.prototype.once = function (eventType, successCallback, failureCallback, context) {
                var _this = this;
                var fn = this.on(eventType, function (ds) {
                    _this.off(eventType, fn);
                    successCallback(ds);
                }, function (err) {
                    if (failureCallback && context) {
                        failureCallback(err);
                    }
                }, context || failureCallback);
            };
            Db3MockTree.prototype.subQuery = function () {
                var ret = new Db3MockTree(this.root, this.url);
                ret.qlistener = new QueryListener(this.getListener());
                return ret;
            };
            /**
            * Generates a new Query object ordered by the specified child key.
            */
            Db3MockTree.prototype.orderByChild = function (key) {
                var ret = this.subQuery();
                ret.qlistener.orderChild = key;
                return ret;
            };
            /**
            * Generates a new Query object ordered by key name.
            */
            Db3MockTree.prototype.orderByKey = function () {
                var ret = this.subQuery();
                ret.qlistener.orderChild = null;
                return ret;
            };
            /**
            * Creates a Query with the specified starting point.
            * The generated Query includes children which match the specified starting point.
            */
            Db3MockTree.prototype.startAt = function (value, key) {
                var ret = this.subQuery();
                ret.qlistener.startAt = value;
                return ret;
            };
            /**
            * Creates a Query with the specified ending point.
            * The generated Query includes children which match the specified ending point.
            */
            Db3MockTree.prototype.endAt = function (value, key) {
                var ret = this.subQuery();
                ret.qlistener.endAt = value;
                return ret;
            };
            /**
            * Creates a Query which includes children which match the specified value.
            */
            Db3MockTree.prototype.equalTo = function (value, key) {
                var ret = this.subQuery();
                ret.qlistener.equal = value;
                return ret;
            };
            /**
            * Generates a new Query object limited to the first certain number of children.
            */
            Db3MockTree.prototype.limitToFirst = function (limit) {
                var ret = this.subQuery();
                ret.qlistener.limit = limit;
                ret.qlistener.limitFromLast = false;
                return ret;
            };
            /**
            * Generates a new Query object limited to the last certain number of children.
            */
            Db3MockTree.prototype.limitToLast = function (limit) {
                var ret = this.subQuery();
                ret.qlistener.limit = limit;
                ret.qlistener.limitFromLast = true;
                return ret;
            };
            Db3MockTree.prototype.valueIn = function (values, key) {
                var ret = this.subQuery();
                // TODO implement this
                return ret;
            };
            Db3MockTree.prototype.sortByChild = function (key) {
                var ret = this.subQuery();
                // TODO implement this
                return ret;
            };
            Db3MockTree.prototype.child = function (path) {
                return new Db3MockTree(this.root, this.url + '/' + normalizeUrl(path));
            };
            return Db3MockTree;
        })();
        Db3MockRoot.Db3MockTree = Db3MockTree;
        var QueryListener = (function (_super) {
            __extends(QueryListener, _super);
            function QueryListener(oth) {
                _super.call(this);
                this.orderChild = null;
                this.startAt = null;
                this.endAt = null;
                this.limit = null;
                this.limitFromLast = false;
                this.baseListener = null;
                if (oth instanceof QueryListener) {
                    this.orderChild = oth.orderChild;
                    this.startAt = oth.startAt;
                    this.endAt = oth.endAt;
                    this.equal = oth.equal;
                    this.limit = oth.limit;
                    this.limitFromLast = oth.limitFromLast;
                    this.baseListener = oth.baseListener;
                }
                else {
                    this.baseListener = oth;
                }
            }
            QueryListener.prototype.add = function (cb) {
                var _this = this;
                this.baseListener.add(function (o, n) { return _this.trigger(o, n); });
                _super.prototype.add.call(this, cb);
            };
            QueryListener.prototype.addEnd = function (cb) {
                var _this = this;
                this.baseListener.add(function (o, n) { return _this.trigger(o, n); });
                _super.prototype.addEnd.call(this, cb);
            };
            QueryListener.prototype.filter = function (val) {
                var _this = this;
                if (!val)
                    return val;
                if (typeof (val) != 'object')
                    return val;
                // Clone it
                val = JSON.parse(JSON.stringify(val));
                // Create sorting function
                var order = !this.orderChild ? null : function (a, b) {
                    var va = a[_this.orderChild];
                    var vb = b[_this.orderChild];
                    return (va < vb) ? -1 : (va > vb) ? 1 : 0;
                };
                var ks = getKeysOrdered(val, order);
                if (this.orderChild) {
                    // Filter if there is an equal
                    if (typeof (this.equal) !== 'undefined') {
                        for (var i = 0; i < ks.length; i++) {
                            var obj = val[ks[i]];
                            if (obj[this.orderChild] != this.equal)
                                delete val[ks[i]];
                        }
                    }
                    else {
                        if (this.startAt) {
                            for (var i = 0; i < ks.length; i++) {
                                var obj = val[ks[i]];
                                if (obj[this.orderChild] < this.startAt) {
                                    delete val[ks[i]];
                                }
                                else
                                    break;
                            }
                        }
                        if (this.endAt) {
                            for (var i = ks.length - 1; i >= 0; i--) {
                                var obj = val[ks[i]];
                                if (obj[this.orderChild] >= this.endAt) {
                                    delete val[ks[i]];
                                }
                                else
                                    break;
                            }
                        }
                    }
                }
                ks = getKeysOrdered(val, order);
                // Remove based on limit
                if (this.limit) {
                    if (this.limitFromLast) {
                        ks = ks.slice(ks.length - this.limit);
                    }
                    else {
                        ks = ks.slice(0, this.limit);
                    }
                    for (var k in val) {
                        if (ks.indexOf(k) == -1)
                            delete val[k];
                    }
                }
                val.$sorter = order;
                return val;
            };
            QueryListener.prototype.trigger = function (oldVal, newVal) {
                newVal = this.filter(newVal);
                oldVal = this.filter(oldVal);
                this.last = newVal;
                for (var i = 0; i < this.cbs.length; i++) {
                    this.cbs[i](oldVal, newVal);
                }
                for (var i = 0; i < this.endCbs.length; i++) {
                    this.endCbs[i](oldVal, newVal);
                }
            };
            return QueryListener;
        })(Listener);
        Db3MockRoot.QueryListener = QueryListener;
    })(Db3MockRoot || (Db3MockRoot = {}));
    TsdbImpl.Spi.registry['mock'] = Db3MockRoot.create;
    return Db3MockRoot;
});

//# sourceMappingURL=Db3Mock.js.map
