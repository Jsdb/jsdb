/// <reference path="../../typings/tsd.d.ts" />
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
    }
})(["require", "exports", '../main/Db2', 'firebase', 'tsMatchers'], function (require, exports) {
    var _this = this;
    var Db = require('../main/Db2');
    var Firebase = require('firebase');
    var M = require('tsMatchers');
    var baseUrl = "https://swashp.firebaseio.com/test2/";
    var lastLocalCallArgs = null;
    var WithProps = (function (_super) {
        __extends(WithProps, _super);
        function WithProps() {
            _super.apply(this, arguments);
            this._local = 1;
            this.str = 'useless';
            this.num = 0;
            this.arr = [];
            this.subobj = {
                substr: ''
            };
        }
        WithProps.prototype.localCall = function () {
            lastLocalCallArgs = arguments;
            return 'localCallAck';
        };
        return WithProps;
    })(Db.Entity);
    var ServerWithProps = (function (_super) {
        __extends(ServerWithProps, _super);
        function ServerWithProps() {
            _super.apply(this, arguments);
        }
        return ServerWithProps;
    })(WithProps);
    var SubEntity = (function (_super) {
        __extends(SubEntity, _super);
        function SubEntity() {
            _super.apply(this, arguments);
        }
        return SubEntity;
    })(Db.Entity);
    var ServerSubEntity = (function (_super) {
        __extends(ServerSubEntity, _super);
        function ServerSubEntity() {
            _super.apply(this, arguments);
        }
        return ServerSubEntity;
    })(SubEntity);
    var OthSubEntity = (function (_super) {
        __extends(OthSubEntity, _super);
        function OthSubEntity() {
            _super.apply(this, arguments);
        }
        return OthSubEntity;
    })(Db.Entity);
    var WithSubentity = (function (_super) {
        __extends(WithSubentity, _super);
        function WithSubentity() {
            _super.apply(this, arguments);
            this.sub = Db.embedded(SubEntity);
        }
        return WithSubentity;
    })(Db.Entity);
    var ServerWithSubentity = (function (_super) {
        __extends(ServerWithSubentity, _super);
        function ServerWithSubentity() {
            _super.apply(this, arguments);
            this.sub = Db.embedded(ServerSubEntity);
        }
        return ServerWithSubentity;
    })(WithSubentity);
    var WithRef = (function (_super) {
        __extends(WithRef, _super);
        function WithRef() {
            _super.apply(this, arguments);
            this.ref = Db.reference(WithProps);
            this.othSubRef = Db.reference(SubEntity);
        }
        return WithRef;
    })(Db.Entity);
    var ServerWithRef = (function (_super) {
        __extends(ServerWithRef, _super);
        function ServerWithRef() {
            _super.apply(this, arguments);
            this.ref = Db.reference(ServerWithProps);
            this.othSubRef = Db.reference(ServerSubEntity);
        }
        return ServerWithRef;
    })(WithRef);
    var WithCollections = (function (_super) {
        __extends(WithCollections, _super);
        function WithCollections() {
            _super.apply(this, arguments);
            this.list = Db.list(SubEntity);
            this.mainRefList = Db.list(Db.referenceBuilder(WithProps));
        }
        return WithCollections;
    })(Db.Entity);
    var WithPreloads = (function (_super) {
        __extends(WithPreloads, _super);
        function WithPreloads() {
            _super.apply(this, arguments);
            this.oth = Db.embedded(OthSubEntity, Db.bind('sub', '_sub', true).bind('ref', '_ref', true).bind('this', '_parent', false));
            this.sub = Db.embedded(SubEntity);
            this.ref = Db.reference(WithProps);
        }
        return WithPreloads;
    })(Db.Entity);
    var WithHooks = (function (_super) {
        __extends(WithHooks, _super);
        function WithHooks() {
            _super.apply(this, arguments);
            this.num = 0;
            this._postLoadCalled = false;
            this._postUpdateCalled = false;
            this._prePersistCalled = false;
        }
        WithHooks.prototype.postLoad = function () {
            this._postLoadCalled = true;
        };
        WithHooks.prototype.postUpdate = function () {
            this._postUpdateCalled = true;
        };
        WithHooks.prototype.prePersist = function () {
            this._prePersistCalled = true;
        };
        return WithHooks;
    })(Db.Entity);
    var TestDb = (function (_super) {
        __extends(TestDb, _super);
        function TestDb() {
            _super.call(this, baseUrl);
            this.withProps = Db.entityRoot(WithProps);
            this.withSubs = Db.entityRoot(WithSubentity);
            this.withRefs = Db.entityRoot(WithRef);
            this.withCols = Db.entityRoot(WithCollections);
            this.withPre = Db.entityRoot(WithPreloads);
            this.withHooks = Db.entityRoot(WithHooks);
            _super.prototype.init.call(this);
        }
        return TestDb;
    })(Db);
    var ServerTestDb = (function (_super) {
        __extends(ServerTestDb, _super);
        function ServerTestDb() {
            _super.call(this);
            this.withProps = Db.entityRoot(ServerWithProps);
            this.withRefs = Db.entityRoot(ServerWithRef);
            this.withSubs = Db.entityRoot(ServerWithSubentity);
            _super.prototype.init.call(this);
        }
        return ServerTestDb;
    })(TestDb);
    var defDb = new TestDb();
    var serDb = new ServerTestDb();
    describe('Db2 Tests', function () {
        var wpFb;
        var wp1Fb;
        var wp2Fb;
        var wsFb;
        var ws1Fb;
        var ws2Fb;
        var wrFb;
        var wr1Fb;
        var wr2Fb;
        var wcFb;
        var wc1Fb;
        var wc2Fb;
        var wplFb;
        var wpl1Fb;
        var wpl2Fb;
        var whFb;
        var wh1Fb;
        beforeEach(function (done) {
            this.timeout(100000);
            defDb.reset();
            //console.log("Starting before each");
            var opcnt = 1;
            function opCnter() {
                opcnt--;
                //console.log('Dones ' + opcnt);
                if (opcnt == 0)
                    done();
            }
            ;
            var root = new Firebase(baseUrl);
            root.remove();
            wpFb = new Firebase(baseUrl + '/withProps');
            wp1Fb = wpFb.child('wp1');
            opcnt++;
            wp1Fb.set({
                str: 'String 1',
                num: 200,
                arr: [1, 2, 3],
                subobj: {
                    substr: 'Sub String'
                }
            }, opCnter);
            wp2Fb = wpFb.child('wp2');
            opcnt++;
            wp2Fb.set({
                str: 'String 2',
                num: 300,
                arr: [2, 3, 4],
                subobj: {
                    substr: 'Sub String'
                }
            }, opCnter);
            wsFb = new Firebase(baseUrl + '/withSubs');
            ws1Fb = wsFb.child('ws1');
            opcnt++;
            ws1Fb.set({
                str: 'String 1',
                sub: {
                    str: 'Sub String 1'
                }
            }, opCnter);
            ws2Fb = wsFb.child('ws2');
            opcnt++;
            ws2Fb.set({
                str: 'String 1',
                sub: {
                    str: 'Sub String 1'
                }
            }, opCnter);
            wrFb = new Firebase(baseUrl + '/withRefs');
            wr1Fb = wrFb.child('wr1');
            opcnt++;
            wr1Fb.set({
                str: 'String 1',
                ref: {
                    _ref: wp1Fb.toString()
                },
                othSubRef: {
                    _ref: ws1Fb.toString() + '/sub'
                }
            }, opCnter);
            wr2Fb = wrFb.child('wr2');
            opcnt++;
            wr2Fb.set({
                str: 'String 1',
                ref: {
                    _ref: wp1Fb.toString()
                }
            }, opCnter);
            wcFb = new Firebase(baseUrl + '/withCols');
            wc1Fb = wcFb.child('wc1');
            opcnt++;
            wc1Fb.set({
                list: [
                    {
                        str: 'Sub1'
                    },
                    {
                        str: 'Sub2'
                    },
                    {
                        str: 'Sub3'
                    }
                ],
                mainRefList: [
                    {
                        _ref: wp1Fb.toString()
                    },
                    {
                        _ref: wp2Fb.toString()
                    },
                ]
            }, opCnter);
            wc2Fb = wcFb.child('wc2');
            opcnt++;
            wc2Fb.set({
                list: [
                    {
                        str: 'Sub1'
                    },
                    {
                        str: 'Sub2'
                    },
                    {
                        str: 'Sub3'
                    }
                ]
            }, opCnter);
            wplFb = new Firebase(baseUrl + '/withPre');
            wpl1Fb = wplFb.child('wpl1');
            opcnt++;
            wpl1Fb.set({
                oth: {
                    num: 123
                },
                ref: {
                    _ref: wp1Fb.toString()
                },
                sub: {
                    str: 'abc'
                }
            }, opCnter);
            whFb = new Firebase(baseUrl + '/withHooks');
            wh1Fb = whFb.child('wh1');
            opcnt++;
            wh1Fb.set({
                num: 123
            }, opCnter);
            // Keep reference alive in ram, faster tests and less side effects
            root.on('value', function () { });
            opCnter();
        });
        // Ported
        it('should pre-init an entity', function () {
            var wp1 = defDb.withProps.load('wp1');
            M.assert("Inited entity").when(wp1).is(M.aTruthy);
            var wp2 = defDb.withProps.load('wp1');
            M.assert("Same instance").when(wp2).is(M.exactly(wp1));
            M.assert("Has right url").when(wp1.load.getUrl()).is(baseUrl + 'withProps/wp1');
        });
        // Ported
        it('should load data', function (done) {
            var wp1 = defDb.withProps.load('wp1');
            wp1.then(function (det) {
                M.assert('Data loaded').when(wp1).is(M.objectMatching({
                    str: 'String 1',
                    num: 200,
                    arr: [1, 2, 3],
                    subobj: {
                        substr: 'Sub String'
                    }
                }));
                return 1;
            }).then(function (n) {
                M.assert('Chained correctly').when(n).is(1);
                done();
            });
        });
        // Ported
        it('should update data', function (done) {
            var wp1 = defDb.withProps.load('wp1');
            var times = 0;
            wp1.load.on(_this, function (det) {
                if (times == 0) {
                    times++;
                    M.assert('First data loaded').when(wp1.str).is('String 1');
                    wp1Fb.update({ str: 'String 2 updated' });
                }
                else if (times == 1) {
                    times++;
                    M.assert('Second data updated').when(wp1.str).is('String 2 updated');
                    det.offMe();
                    done();
                }
                else {
                    M.assert("Got called too many times").when(times).is(M.lessThan(2));
                }
            });
        });
        // Ported - useless
        it('should pre-init sub entities', function () {
            var ws1 = defDb.withSubs.load('ws1');
            M.assert('Inited base entity').when(ws1).is(M.aTruthy);
            M.assert('Inited sub entity').when(ws1.sub).is(M.aTruthy);
        });
        // Ported
        it('should load sub entities with the main one', function (done) {
            var ws1 = defDb.withSubs.load('ws1');
            ws1.then(function (det) {
                M.assert("Loaded main").when(ws1.str).is('String 1');
                M.assert("Loaded subentity").when(ws1.sub.str).is('Sub String 1');
                done();
            });
        });
        // Ported
        it('should load sub entities withOUT the main one', function (done) {
            var ws2 = defDb.withSubs.load('ws2');
            ws2.sub.then(function (det) {
                M.assert("NOT Loaded main").when(ws2.str).is(M.undefinedValue);
                M.assert("Loaded subentity").when(ws2.sub.str).is('Sub String 1');
                done();
            });
        });
        // Ported
        it('should load sub entites reference with the main one', function (done) {
            var wr1 = defDb.withRefs.load('wr1');
            wr1.then(function (det) {
                M.assert("Loaded the ref").when(wr1.ref.value).is(M.aTruthy);
                M.assert("Loaded the ref").when(wr1.ref.value).is(M.instanceOf(WithProps));
                done();
            });
        });
        // Ported
        it('should load sub entites reference withOUT the main one', function (done) {
            var wr1 = defDb.withRefs.load('wr2');
            wr1.ref.then(function (det) {
                M.assert("Loaded the ref").when(wr1.ref.value).is(M.aTruthy);
                M.assert("Loaded the ref").when(wr1.ref.value).is(M.instanceOf(WithProps));
                return wr1.ref.value.then();
            }).then(function () {
                M.assert("Loaded the ref").when(wr1.ref.value).is(M.objectMatching({
                    str: 'String 1',
                    num: 200,
                    arr: [1, 2, 3],
                    subobj: {
                        substr: 'Sub String'
                    }
                }));
                M.assert("Didn't load the main one").when(wr1.str).is(M.undefinedValue);
                done();
            });
        });
        // Ported
        it('should load reference to other entities sub references', function (done) {
            var wr1 = defDb.withRefs.load('wr1');
            wr1.then(function (det) {
                M.assert("Loaded the ref").when(wr1.othSubRef.value).is(M.aTruthy);
                M.assert("Loaded the ref").when(wr1.othSubRef.value).is(M.instanceOf(SubEntity));
                wr1.othSubRef.value.then(function (sdet) {
                    M.assert("Resolved the ref").when(wr1.othSubRef.value.str).is("Sub String 1");
                    done();
                });
            });
        });
        it('should create correct server side method call payload', function () {
            var wr1 = defDb.withRefs.load('wr1');
            var wc1 = defDb.withCols.load('wc1');
            var pld = defDb['createServerMethodCall'].call(defDb, wr1, 'method', ['a', 1, { generic: 'object' }, new WithProps(), wc1]);
            M.assert("Right payload").when(pld).is(M.objectMatchingStrictly({
                entityUrl: wr1.load.getUrl(),
                method: 'method',
                args: [
                    'a',
                    1,
                    { generic: 'object' },
                    {
                        arr: [],
                        num: 0,
                        str: 'useless',
                        subobj: {
                            substr: ''
                        }
                    },
                    { _ref: wc1.load.getUrl() }
                ]
            }));
        });
        it('should execute server side method calls', function () {
            var wc1 = defDb.withCols.load('wc1');
            var pyl = {
                entityUrl: baseUrl + "withProps/wp1",
                method: 'localCall',
                args: [
                    'a',
                    1,
                    { generic: 'object' },
                    {
                        arr: [],
                        num: 0,
                        str: 'useless',
                        subobj: {
                            substr: ''
                        }
                    },
                    { _ref: wc1.load.getUrl() }
                ]
            };
            var ret = defDb.executeServerMethod(pyl);
            M.assert('Returned the method return').when(ret).is('localCallAck');
            M.assert('Call params are right').when(lastLocalCallArgs[0]).is('a');
            M.assert('Call params are right').when(lastLocalCallArgs[1]).is(1);
            M.assert('Call params are right').when(lastLocalCallArgs[2]).is(M.objectMatching({ generic: 'object' }));
            M.assert('Call params are right').when(lastLocalCallArgs[3]).is(M.objectMatching({
                arr: [],
                num: 0,
                str: 'useless',
                subobj: {
                    substr: ''
                }
            }));
            M.assert('Call params are right').when(lastLocalCallArgs[4]).is(M.instanceOf(WithCollections));
        });
        it('should report each element in list as an add event', function (done) {
            var wc1 = defDb.withCols.load('wc1');
            var dets = [];
            wc1.list.add.on(_this, function (det) {
                //console.log("Received event",det);
                if (det.listEnd) {
                    M.assert("Loaded all elements").when(dets).is(M.withLength(3));
                    for (var i = 0; i < dets.length; i++) {
                        M.assert("Right type").when(dets[i].payload).is(M.instanceOf(SubEntity));
                        M.assert("Right deserialization").when(dets[i].payload.str).is("Sub" + (i + 1));
                    }
                    det.offMe();
                    done();
                }
                else {
                    dets.push(det);
                }
            });
        });
        it('should report new elements in list with an add event', function (done) {
            var wc1 = defDb.withCols.load('wc1');
            //var dets :Db.internal.IEventDetails<SubEntity>[] = [];
            var state = 0;
            wc1.list.add.on(_this, function (det) {
                //console.log("Received event on state " + state,det);
                if (det.listEnd) {
                    state = 1;
                    wc1Fb.child('list/3').set({ str: 'Sub4' });
                }
                else {
                    if (state == 1) {
                        state = 2;
                        M.assert("Right type").when(det.payload).is(M.instanceOf(SubEntity));
                        M.assert("Right deserialization").when(det.payload.str).is("Sub4");
                        det.offMe();
                        done();
                    }
                }
            });
        });
        it('should report removal from list', function (done) {
            var wc1 = defDb.withCols.load('wc1');
            //var dets :Db.internal.IEventDetails<SubEntity>[] = [];
            var state = 0;
            wc1.list.remove.on(_this, function (det) {
                M.assert("In right state").when(state).is(1);
                M.assert("Right type").when(det.payload).is(M.instanceOf(SubEntity));
                M.assert("Right deserialization").when(det.payload.str).is("Sub3");
                det.offMe();
                done();
            });
            wc1.list.add.on(_this, function (det) {
                //console.log("Received event on state " + state,det);
                if (det.listEnd) {
                    state = 1;
                    det.offMe();
                    wc1Fb.child('list/2').remove();
                }
            });
        });
        // TODO list change events
        // access to list value array
        it('should work correctly with the "then" on a list', function (done) {
            var wc1 = defDb.withCols.load('wc1');
            var dets = [];
            wc1.list.then(function () {
                M.assert("Loaded all elements").when(wc1.list.value).is(M.withLength(3));
                for (var i = 0; i < wc1.list.value.length; i++) {
                    M.assert("Right type").when(wc1.list.value[i]).is(M.instanceOf(SubEntity));
                    M.assert("Right deserialization").when(wc1.list.value[i].str).is("Sub" + (i + 1));
                }
                done();
            });
        });
        // TODO test map
        // collections of references
        it('should handle a list of references', function (done) {
            var wc1 = defDb.withCols.load('wc1');
            var dets = [];
            wc1.mainRefList.add.on(_this, function (det) {
                //console.log("Received event",det);
                if (det.listEnd) {
                    det.offMe();
                    M.assert("Loaded all elements").when(dets).is(M.withLength(2));
                    var proms = [];
                    for (var i = 0; i < dets.length; i++) {
                        M.assert("Right type").when(dets[i].payload).is(M.instanceOf(Db.internal.ReferenceImpl));
                        M.assert("Right url").when(dets[i].payload.url).is(wpFb.toString() + "/wp" + (i + 1));
                        M.assert("Right instantiation").when(dets[i].payload.value).is(M.instanceOf(WithProps));
                        proms.push(dets[i].payload.then());
                    }
                    // TODO Resolve all and check values 
                    done();
                }
                else {
                    dets.push(det);
                }
            });
        });
        // basic query on entityRoots
        it('should perform query on entity roots', function (done) {
            var query = defDb.withProps.query().sortOn('num').equals(300);
            var dets = [];
            query.add.on(_this, function (det) {
                if (det.listEnd) {
                    M.assert("Found only one element").when(dets).is(M.withLength(1));
                    M.assert("Found right entity").when(dets[0].payload).is(M.objectMatching({
                        str: 'String 2',
                        num: 300,
                        arr: [2, 3, 4],
                        subobj: {
                            substr: 'Sub String'
                        }
                    }));
                    done();
                }
                else {
                    dets.push(det);
                }
            });
        });
        // TODO firebase doesn't support this
        /*
        it('should sort query correctly',(done) => {
            var query = defDb.withProps.query().sortOn('num', false);
            query.then(() => {
                M.assert("Returned right number of elements").when(query.value).is(M.withLength(2));
                M.assert("Returned in right order 0").when(query.value[0].num).is(300);
                M.assert("Returned in right order 1").when(query.value[1].num).is(200);
                done();
            });
            
        });
        */
        // Binding
        // Ported
        it('should bind and keep live on subentity and parent', function (done) {
            var wpl1 = defDb.withPre.load('wpl1');
            wpl1.oth.then(function () {
                M.assert("Loaded the subentity").when(wpl1.sub.str).is('abc');
                M.assert("Inited the bound").when(wpl1.oth._sub).is(M.aTruthy);
                M.assert("Bound the subentity").when(wpl1.oth._sub.str).is('abc');
                M.assert("Bound parent").when(wpl1.oth._parent).is(M.exactly(wpl1));
                var fbsub = new Firebase(wpl1.sub.load.getUrl());
                fbsub.update({ str: 'cde' }, function (ds) {
                    M.assert("Updated the subentity").when(wpl1.oth._sub.str).is('cde');
                    done();
                });
            });
        });
        // update live when a reference pointer is changed
        // Ported
        it('should bind and keep live on reference pointer', function (done) {
            var wpl1 = defDb.withPre.load('wpl1');
            wpl1.oth.then(function () {
                M.assert("Loaded the ref").when(wpl1.ref.value).is(M.aTruthy);
                M.assert("Inited the bound").when(wpl1.oth._ref).is(M.aTruthy);
                M.assert("Bound the subentity").when(wpl1.oth._ref.str).is('String 1');
                var fbsub = new Firebase(wpl1.ref.load.url);
                fbsub.update({ _ref: wp2Fb.toString() }, function (ds) {
                    M.assert("Updated the reference pointer").when(wpl1.oth._ref.str).is('String 2');
                    done();
                });
            });
        });
        // Ported
        it('should bind and keep live on referenced entity', function (done) {
            var wpl1 = defDb.withPre.load('wpl1');
            wpl1.oth.then(function () {
                M.assert("Loaded the ref").when(wpl1.ref.value).is(M.aTruthy);
                M.assert("Inited the bound").when(wpl1.oth._ref).is(M.aTruthy);
                M.assert("Bound the subentity").when(wpl1.oth._ref.str).is('String 1');
                var fbsub = new Firebase(wpl1.ref.url);
                fbsub.update({ str: 'cde' }, function (ds) {
                    M.assert("Updated the subentity").when(wpl1.oth._ref.str).is('cde');
                    done();
                });
            });
        });
        it('should honour postLoad', function (done) {
            var wh1 = defDb.withHooks.load('wh1');
            M.assert("Postload not yet called").when(wh1._postLoadCalled).is(false);
            M.assert("Postupdate not yet called").when(wh1._postUpdateCalled).is(false);
            wh1.then(function (det) {
                M.assert("Postload called").when(wh1._postLoadCalled).is(true);
                M.assert("Postupdate called").when(wh1._postUpdateCalled).is(true);
                done();
            });
        });
        // TODO more tests on queries
        // TODO query on collections
        // TODO read projections
        // Serialization, simple
        // Ported
        it('should serialize basic entity correctly', function () {
            var wp = new WithProps();
            wp._local = 5;
            wp.num = 1;
            wp.str = 'abc';
            wp.arr = [1];
            wp.subobj.substr = 'cde';
            var ret = Db.Utils.entitySerialize(wp);
            M.assert("Serialization is correct").when(ret).is(M.objectMatchingStrictly({
                num: 1,
                str: 'abc',
                arr: [1],
                subobj: { substr: 'cde' }
            }));
        });
        // Ported
        it('should serialize correctly sub entities', function () {
            var ws = new WithSubentity();
            ws.str = 'abc';
            var ss = new SubEntity();
            ws.sub = ss;
            ss.str = 'cde';
            var ret = Db.Utils.entitySerialize(ws);
            M.assert("Serialization is correct").when(ret).is(M.objectMatchingStrictly({
                str: 'abc',
                sub: { str: 'cde' }
            }));
        });
        // Ported
        it('should honour custom serialize', function () {
            var ss = new SubEntity();
            ss.str = 'cde';
            ss.serialize = function () {
                return { mystr: 'aaa' };
            };
            var ret = Db.Utils.entitySerialize(ss);
            M.assert("Serialization is correct").when(ret).is(M.objectMatchingStrictly({
                mystr: 'aaa'
            }));
        });
        // Useless
        it('should honour given fields in serialization', function () {
            var wp = new WithProps();
            wp.num = 1;
            wp.str = 'abc';
            wp.arr = [1];
            wp.subobj.substr = 'cde';
            var ret = Db.Utils.entitySerialize(wp, ['num', 'str']);
            M.assert("Serialization is correct").when(ret).is(M.objectMatchingStrictly({
                num: 1,
                str: 'abc'
            }));
        });
        // write data on existing entity
        // Ported
        it('should update an entity', function (done) {
            var wp1 = defDb.withProps.load('wp1');
            wp1
                .then(function () {
                console.log("Saving");
                wp1.num = 1000;
                wp1.str = 'Updated';
                wp1.arr = [7, 8, 9];
                wp1.subobj.substr = 'Sub updated';
                //return wp1.save();
                wp1.save();
            })
                .then(function () {
                console.log("Checking");
                wp1Fb.once('value', function (ds) {
                    M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
                        num: 1000,
                        str: 'Updated',
                        arr: [7, 8, 9],
                        subobj: { substr: 'Sub updated' }
                    }));
                    done();
                });
            });
            ;
        });
        // Ported
        it('should assign right url to a new entity mapped on root', function () {
            var wp = new WithProps();
            defDb.assignUrl(wp);
            M.assert("Assigned right url").when(wp.load.getUrl()).is(M.stringContaining(wpFb.toString()));
        });
        // Ported
        it('should throw error an a new entity not mapped on root', function () {
            var wp = new SubEntity();
            var excp = null;
            try {
                defDb.assignUrl(wp);
            }
            catch (e) {
                excp = e;
            }
            M.assert("Exception thrown").when(excp).is(M.aTruthy);
        });
        // write new entity
        // Ported
        it('should save a new entity', function (done) {
            var wp = new WithProps();
            wp.str = 'abcd';
            wp.num = 555;
            wp.arr = [89, 72];
            wp.subobj.substr = 'eeee';
            defDb.save(wp).then(function () {
                var url = wp.load.getUrl();
                new Firebase(url).once('value', function (ds) {
                    M.assert("New entity saved correctly").when(ds.val()).is(M.objectMatching({
                        str: 'abcd',
                        num: 555,
                        arr: [89, 72],
                        subobj: { substr: 'eeee' }
                    }));
                    done();
                });
            });
        });
        // Useless
        it('should trow exception if saving new entity not from db', function () {
            var wp = new WithProps();
            var excp = null;
            try {
                wp.save();
            }
            catch (e) {
                excp = e;
            }
            M.assert("Exception thrown").when(excp).is(M.aTruthy);
        });
        // write entity in entity, as full object
        // Ported
        it('should serialize correctly sub entities', function (done) {
            var ws = new WithSubentity();
            ws.str = 'abc';
            var ss = new SubEntity();
            ws.sub = ss;
            ss.str = 'cde';
            defDb.save(ws).then(function () {
                new Firebase(ws.load.getUrl()).once('value', function (ds) {
                    M.assert("Serialized correctly").when(ds.val()).is(M.objectMatching({
                        str: 'abc',
                        sub: { str: 'cde' }
                    }));
                    done();
                });
            });
        });
        // write reference
        // Ported
        it('should write a reference correctly', function (done) {
            var wp1 = defDb.withProps.load('wp1');
            var url = wp1.load.getUrl();
            var wrn = new WithRef();
            wrn.str = 'abc';
            wrn.ref.value = wp1;
            defDb.save(wrn).then(function () {
                new Firebase(wrn.load.getUrl()).once('value', function (ds) {
                    M.assert("Serialized correctly").when(ds.val()).is(M.objectMatching({
                        str: 'abc',
                        ref: { _ref: url }
                    }));
                    done();
                });
            });
        });
        // client/server differences
        it('should properly load root entity for server', function (done) {
            var wp1 = serDb.withProps.load('wp1');
            wp1.then(function (det) {
                M.assert('Right type').when(wp1).is(M.instanceOf(ServerWithProps));
                M.assert('Data loaded').when(wp1).is(M.objectMatching({
                    str: 'String 1',
                    num: 200,
                    arr: [1, 2, 3],
                    subobj: {
                        substr: 'Sub String'
                    }
                }));
                done();
            });
        });
        it('should load sub entities for server', function (done) {
            var ws1 = serDb.withSubs.load('ws1');
            ws1.then(function (det) {
                M.assert("Right type").when(ws1.sub).is(M.instanceOf(ServerSubEntity));
                M.assert("Loaded main").when(ws1.str).is('String 1');
                M.assert("Loaded subentity").when(ws1.sub.str).is('Sub String 1');
                done();
            });
        });
        it('should load sub entites reference withOUT the main one for server', function (done) {
            var wr1 = serDb.withRefs.load('wr2');
            wr1.ref.then(function (det) {
                M.assert("Loaded the ref").when(wr1.ref.value).is(M.aTruthy);
                M.assert("Loaded the ref").when(wr1.ref.value).is(M.instanceOf(ServerWithProps));
                return wr1.ref.value.then();
            }).then(function () {
                M.assert("Loaded the ref").when(wr1.ref.value).is(M.objectMatching({
                    str: 'String 1',
                    num: 200,
                    arr: [1, 2, 3],
                    subobj: {
                        substr: 'Sub String'
                    }
                }));
                M.assert("Didn't load the main one").when(wr1.str).is(M.undefinedValue);
                done();
            });
        });
        it('should load reference to other entities sub references for server', function (done) {
            var wr1 = serDb.withRefs.load('wr1');
            wr1.then(function (det) {
                M.assert("Loaded the ref").when(wr1.othSubRef.value).is(M.aTruthy);
                M.assert("Loaded the ref").when(wr1.othSubRef.value).is(M.instanceOf(ServerSubEntity));
                wr1.othSubRef.value.then(function (sdet) {
                    M.assert("Resolved the ref").when(wr1.othSubRef.value.str).is("Sub String 1");
                    done();
                });
            });
        });
        // TODO cascade of save on non loaded elements
        // To explain better, i have an entity A that has sub entity B and C, only B has been loaded,
        // then calling save on A should not write out all the entity A (that would make all other properties
        // of A including C empty) but issue a save only on B.
        // TODO write reference with projections
        // TODO write full collections
        // TODO read and write unmanaged (native) arrays and maps having entities inside?
        // TODO incremental add on collections
        // TODO incremental remove on collections
        // TODO write back-projections
        // TODO cache cleaning
        // TODO invert IOffable? make every listener check if he's still valid or not and remove those that aren't from event 
        // side instead of relying on a destroy being called on all removed stuff?
        // TODO move promises on events?
        // TODO piggyback on events?
        // TODO prePersist
        // TODO default serialization (and deserialization) fields?
        // TODO decouple deserialization from event handlers
        // Currently, each event handler holds it's firebase reference and hooks itself to the firebase events. As such,
        // if three clients are listening on a single entity update, there will be three handlers hooked, three deserializations,
        // three eventDetails instances, three preUpdate calls and so on. This has been done to make each event handler 
        // independent, so that Firebase handles its internal cache without needing to implement it on our side, but given the
        // multiplication of quite heavy stuff (like deserialization etc..) could be better to hook on the Firebase once
        // PER EVENT and not PER HANDLER, and unsubscribe when all hadlers have been removed. 
        // TODO externalize firebase?
        // TODO use metadata (somehow) instead of real entity or collection instances for embeddeds?
        // The problem is that currently we can't support null on entities and we are obliged to wrap references and
        // collections, while instead we could create mock instances at the beginning, to give proper static typing and create
        // some "markers". After this has been done (when is not clear :D) we could find the markers, connect them with
        // their names and the proper instance. We gain the "nullability", but we loose some syntax, like mainEntity.sub.then() etc.
        // However, such metadata could be used for deserializing correctly, which now does not happen or can't be done
        // in a number of cases.
        // TODO save __entity on the database?
        // This is another solution to static typing, and can also help for polimorfic data and for native collections 
        // --- Needed
        // TODO binding and live update for collections
    });
});

//# sourceMappingURL=Db2Tests.js.map
