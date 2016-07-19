var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") return Reflect.decorate(decorators, target, key, desc);
    switch (arguments.length) {
        case 2: return decorators.reduceRight(function(o, d) { return (d && d(o)) || o; }, target);
        case 3: return decorators.reduceRight(function(o, d) { return (d && d(target, key)), void 0; }, void 0);
        case 4: return decorators.reduceRight(function(o, d) { return (d && d(target, key, o)) || o; }, desc);
    }
};
(function (deps, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        var v = factory(require, exports); if (v !== undefined) module.exports = v;
    }
    else if (typeof define === 'function' && define.amd) {
        define(deps, factory);
    }
})(["require", "exports", '../main/Tsdb', 'firebase', 'tsMatchers'], function (require, exports) {
    var _this = this;
    var Db3 = require('../main/Tsdb');
    var Firebase = require('firebase');
    var M = require('tsMatchers');
    var assert = M.assert;
    var baseUrl = "https://tsdb.firebaseio.com/test3/";
    var Db = Db3.configure({
        baseUrl: baseUrl,
        secret: "5tGSMCySw95AtYBFh3RQSzBw8CfT4WIxSXh6WbB0"
    });
    /*
    var Db = Db3.configure(<Db3.Spi.MonitoringConf>{
        adapter: 'monitor',
        realConfiguration: <Db3.Spi.FirebaseConf>{
            baseUrl:baseUrl,
            secret: "5tGSMCySw95AtYBFh3RQSzBw8CfT4WIxSXh6WbB0"
        }
    });
    */
    var lastRemoteCallArgs = null;
    var lastLocalStubArgs = null;
    var WithProps = (function () {
        function WithProps() {
            this._local = 1;
            this.$moreLocal = 1;
            this.str = 'useless';
            this.num = 0;
            this.bool = false;
            this.arr = [];
            this.subobj = {
                substr: ''
            };
            this.ignored = 'ignored';
        }
        WithProps.prototype.postUpdate = function (ed) {
            this._lastUpdateEv = ed;
        };
        WithProps.prototype.remoteCall = function (p1, p2) {
            lastLocalStubArgs = arguments;
            return null;
        };
        WithProps.statRemoteCall = function (p1, p2) {
            return null;
        };
        Object.defineProperty(WithProps.prototype, "noCall", {
            get: function () {
                throw new Error("Should never call an ignored getter");
            },
            enumerable: true,
            configurable: true
        });
        __decorate([
            Db3.observable()
        ], WithProps.prototype, "num");
        __decorate([
            Db3.ignore()
        ], WithProps.prototype, "ignored");
        Object.defineProperty(WithProps.prototype, "remoteCall",
            __decorate([
                Db3.remote()
            ], WithProps.prototype, "remoteCall", Object.getOwnPropertyDescriptor(WithProps.prototype, "remoteCall")));
        Object.defineProperty(WithProps.prototype, "noCall",
            __decorate([
                Db3.ignore()
            ], WithProps.prototype, "noCall", Object.getOwnPropertyDescriptor(WithProps.prototype, "noCall")));
        Object.defineProperty(WithProps, "statRemoteCall",
            __decorate([
                Db3.remote()
            ], WithProps, "statRemoteCall", Object.getOwnPropertyDescriptor(WithProps, "statRemoteCall")));
        WithProps = __decorate([
            Db3.root(),
            Db3.cacheMax(5)
        ], WithProps);
        return WithProps;
    })();
    var ServerWithProps = (function (_super) {
        __extends(ServerWithProps, _super);
        function ServerWithProps() {
            _super.apply(this, arguments);
        }
        ServerWithProps.prototype.remoteCall = function () {
            lastRemoteCallArgs = arguments;
            return Promise.resolve('localCallAck');
        };
        ServerWithProps.prototype.remoteCtxCall = function (str, num, _ctx) {
            lastRemoteCallArgs = arguments;
            return Promise.resolve('localCallAck');
        };
        ServerWithProps.statRemoteCall = function () {
            lastRemoteCallArgs = arguments;
            return Promise.resolve('localStaticCallAck');
        };
        ServerWithProps = __decorate([
            Db3.override()
        ], ServerWithProps);
        return ServerWithProps;
    })(WithProps);
    var WithMoreProps = (function (_super) {
        __extends(WithMoreProps, _super);
        function WithMoreProps() {
            _super.apply(this, arguments);
            this.moreNum = 1;
        }
        WithMoreProps = __decorate([
            Db3.discriminator('more')
        ], WithMoreProps);
        return WithMoreProps;
    })(WithProps);
    var SubEntity = (function () {
        function SubEntity() {
        }
        SubEntity.prototype.getSomething = function () {
            return "something";
        };
        SubEntity.prototype.postUpdate = function (ed) {
            this._lastUpdateEv = ed;
        };
        return SubEntity;
    })();
    var SubEntityOth = (function (_super) {
        __extends(SubEntityOth, _super);
        function SubEntityOth() {
            _super.apply(this, arguments);
            this.otherData = 1;
        }
        SubEntityOth.prototype.getSomething = function () {
            return "something else";
        };
        __decorate([
            Db3.embedded(SubEntity)
        ], SubEntityOth.prototype, "testOther");
        SubEntityOth = __decorate([
            Db3.discriminator('oth')
        ], SubEntityOth);
        return SubEntityOth;
    })(SubEntity);
    var SubEntityYet = (function (_super) {
        __extends(SubEntityYet, _super);
        function SubEntityYet() {
            _super.apply(this, arguments);
        }
        __decorate([
            Db3.embedded(SubEntity)
        ], SubEntityYet.prototype, "testYetOther");
        SubEntityYet = __decorate([
            Db3.discriminator('yet')
        ], SubEntityYet);
        return SubEntityYet;
    })(SubEntityOth);
    var ServerSubEntity = (function (_super) {
        __extends(ServerSubEntity, _super);
        function ServerSubEntity() {
            _super.apply(this, arguments);
        }
        return ServerSubEntity;
    })(SubEntity);
    var DifferentSubEntity = (function () {
        function DifferentSubEntity() {
        }
        return DifferentSubEntity;
    })();
    var WithSubentity = (function () {
        function WithSubentity() {
            this.str = null;
        }
        __decorate([
            Db3.embedded(SubEntity)
        ], WithSubentity.prototype, "sub");
        __decorate([
            Db3.embedded(WithSubentity)
        ], WithSubentity.prototype, "nested");
        WithSubentity = __decorate([
            Db3.root('withSubs')
        ], WithSubentity);
        return WithSubentity;
    })();
    var ServerWithSubentity = (function (_super) {
        __extends(ServerWithSubentity, _super);
        function ServerWithSubentity() {
            _super.apply(this, arguments);
        }
        __decorate([
            Db3.embedded(ServerSubEntity)
        ], ServerWithSubentity.prototype, "sub");
        ServerWithSubentity = __decorate([
            Db3.override()
        ], ServerWithSubentity);
        return ServerWithSubentity;
    })(WithSubentity);
    var WithRef = (function () {
        function WithRef() {
        }
        __decorate([
            Db3.reference(WithProps)
        ], WithRef.prototype, "ref");
        __decorate([
            Db3.reference(SubEntity)
        ], WithRef.prototype, "othSubRef");
        __decorate([
            Db3.reference(WithRef)
        ], WithRef.prototype, "cross");
        __decorate([
            Db3.reference(null)
        ], WithRef.prototype, "anything");
        WithRef = __decorate([
            Db3.root('withRefs')
        ], WithRef);
        return WithRef;
    })();
    var ServerWithRef = (function (_super) {
        __extends(ServerWithRef, _super);
        function ServerWithRef() {
            _super.apply(this, arguments);
        }
        __decorate([
            Db3.reference(ServerWithProps)
        ], ServerWithRef.prototype, "ref");
        __decorate([
            Db3.reference(ServerSubEntity)
        ], ServerWithRef.prototype, "othSubRef");
        ServerWithRef = __decorate([
            Db3.override()
        ], ServerWithRef);
        return ServerWithRef;
    })(WithRef);
    var WithPreloads = (function () {
        function WithPreloads() {
        }
        __decorate([
            Db3.embedded(DifferentSubEntity, Db3.bind('sub', '_sub', true).bind('ref', '_ref', true).bind('this', '_parent', false))
        ], WithPreloads.prototype, "oth");
        __decorate([
            Db3.embedded(SubEntity)
        ], WithPreloads.prototype, "sub");
        __decorate([
            Db3.reference(WithProps, ['num', 'str'])
        ], WithPreloads.prototype, "ref");
        WithPreloads = __decorate([
            Db3.root('withPre')
        ], WithPreloads);
        return WithPreloads;
    })();
    var WithMap = (function () {
        function WithMap() {
            this.embedMap = {};
            this.refMap = {};
        }
        __decorate([
            Db3.map(SubEntity, false)
        ], WithMap.prototype, "embedMap");
        __decorate([
            Db3.map(WithProps, true)
        ], WithMap.prototype, "refMap");
        WithMap = __decorate([
            Db3.root('withMap')
        ], WithMap);
        return WithMap;
    })();
    var WithSet = (function () {
        function WithSet() {
            this.embedSet = [];
            this.sortedSet = [];
        }
        __decorate([
            Db3.set(SubEntity, false)
        ], WithSet.prototype, "embedSet");
        __decorate([
            Db3.set(WithProps, true)
        ], WithSet.prototype, "refSet");
        __decorate([
            Db3.set({ type: SubEntity, sorting: Db3.sortBy('str') })
        ], WithSet.prototype, "sortedSet");
        WithSet = __decorate([
            Db3.root('withSet')
        ], WithSet);
        return WithSet;
    })();
    var WithList = (function () {
        function WithList() {
            this.embedList = [];
            this.refList = [];
        }
        __decorate([
            Db3.list(SubEntity, false)
        ], WithList.prototype, "embedList");
        __decorate([
            Db3.list(WithProps, true)
        ], WithList.prototype, "refList");
        WithList = __decorate([
            Db3.root('withList')
        ], WithList);
        return WithList;
    })();
    var Complex = (function () {
        function Complex() {
            this.embedList = [];
        }
        __decorate([
            Db3.list(SubEntity, false)
        ], Complex.prototype, "embedList");
        __decorate([
            Db3.reference(WithProps)
        ], Complex.prototype, "ref");
        __decorate([
            Db3.embedded(SubEntity)
        ], Complex.prototype, "sub");
        __decorate([
            Db3.embedded(Complex)
        ], Complex.prototype, "nested");
        __decorate([
            Db3.reference(Complex)
        ], Complex.prototype, "cross");
        Complex = __decorate([
            Db3.root('complex')
        ], Complex);
        return Complex;
    })();
    /*
    class WithCollections extends Db.Entity {
        list = Db.list(SubEntity);
        mainRefList = Db.list(Db.referenceBuilder(WithProps));
    }
    
    class WithHooks extends Db.Entity implements Db.IEntityHooks {
        num :number = 0;
        _postLoadCalled = false;
        _postUpdateCalled = false;
        _prePersistCalled = false;
        
        postLoad() {
            this._postLoadCalled = true;
        }
        postUpdate() {
            this._postUpdateCalled = true;
        }
        prePersist() {
            this._prePersistCalled = true;
        }
    }
    */
    describe('Db3 >', function () {
        var root;
        var wpFb;
        var wp1Fb;
        var wp2Fb;
        var wp3Fb;
        var wp4Fb;
        var wp5Fb;
        var wsFb;
        var ws1Fb;
        var ws2Fb;
        var ws3Fb;
        var ws4Fb;
        var wrFb;
        var wr1Fb;
        var wr2Fb;
        var wr3Fb;
        var wr4Fb;
        var wr5Fb;
        var wr6Fb;
        var wr7Fb;
        var wcFb;
        var wc1Fb;
        var wc2Fb;
        var wplFb;
        var wpl1Fb;
        var wpl2Fb;
        var whFb;
        var wh1Fb;
        var wmFb;
        var wm1Fb;
        var wm2Fb;
        var wm3Fb;
        var wstFb;
        var wst1Fb;
        var wst2Fb;
        var wst3Fb;
        var wltFb;
        var wlt1Fb;
        var wlt2Fb;
        var wlt3Fb;
        var wlt4Fb;
        var complexFb;
        var cp1Fb;
        var cp2Fb;
        var cp3Fb;
        var rooton;
        var progr = 0;
        beforeEach(function (done) {
            //console.log("before starts");
            this.timeout(100000);
            var opcnt = 1;
            function opCnter() {
                opcnt--;
                //console.log('Dones ' + opcnt);
                if (opcnt == 0)
                    done();
            }
            ;
            // TODO reenable this
            Db().reset();
            if (root && rooton) {
                root.off('value', rooton);
                rooton = null;
            }
            if (!root) {
                root = new Firebase(baseUrl);
            }
            root.remove();
            wpFb = new Firebase(baseUrl + '/withProps');
            wp1Fb = wpFb.child('wp1');
            opcnt++;
            wp1Fb.set({
                str: 'String 1',
                num: 200,
                arr: [1, 2, 3],
                bool: false,
                subobj: {
                    substr: 'Sub String'
                },
                ignored: 'never seen'
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
            wp3Fb = wpFb.child('more*wp3');
            opcnt++;
            wp3Fb.set({
                str: 'String 3',
                num: 400,
                moreNum: 401,
                arr: [3, 4, 5],
                bool: true,
                subobj: {
                    substr: 'Sub String'
                },
                _dis: 'more'
            }, opCnter);
            wp4Fb = wpFb.child('wp4');
            opcnt++;
            wp4Fb.set({
                str: 'String 4',
                num: 500,
                arr: [4, 5, 6],
                bool: true,
                subobj: {
                    substr: 'Sub String'
                }
            }, opCnter);
            wp5Fb = wpFb.child('wp5');
            opcnt++;
            wp5Fb.set({
                num: 500,
                bool: true,
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
                },
                nested: {
                    str: 'Sub String 1',
                    sub: {
                        str: 'Sub Sub String 1'
                    }
                }
            }, opCnter);
            ws3Fb = wsFb.child('ws3');
            opcnt++;
            ws3Fb.set({
                str: 'String 3',
                nested: {
                    str: 'Sub String 3',
                    sub: {
                        str: 'Sub Sub String 3',
                        _dis: 'oth'
                    }
                }
            }, opCnter);
            ws4Fb = wsFb.child('ws4');
            opcnt++;
            ws4Fb.set({
                str: 'String 1',
            }, opCnter);
            wrFb = new Firebase(baseUrl + '/withRefs');
            wr1Fb = wrFb.child('wr1');
            opcnt++;
            wr1Fb.set({
                str: 'String 1',
                ref: {
                    _ref: wp1Fb.toString() + '/'
                },
                othSubRef: {
                    _ref: ws1Fb.toString() + '/sub/'
                }
            }, opCnter);
            wr2Fb = wrFb.child('wr2');
            opcnt++;
            wr2Fb.set({
                str: 'String 1',
                ref: {
                    _ref: wp1Fb.toString() + '/',
                    str: 'String 1',
                    num: 200
                }
            }, opCnter);
            wr3Fb = wrFb.child('wr3');
            opcnt++;
            wr3Fb.set({
                str: 'String 3',
                ref: {
                    _ref: wp3Fb.toString() + '/'
                },
                othSubRef: {
                    _ref: ws3Fb.toString() + '/nested/sub/*oth'
                }
            }, opCnter);
            wr4Fb = wrFb.child('wr4');
            opcnt++;
            wr4Fb.set({
                str: 'String 4',
                anything: {
                    _ref: wp1Fb.toString() + '/'
                }
            }, opCnter);
            wr5Fb = wrFb.child('wr5');
            opcnt++;
            wr5Fb.set({
                str: 'String 5',
                anything: {
                    _ref: ws1Fb.toString() + '/'
                }
            }, opCnter);
            wr6Fb = wrFb.child('wr6');
            opcnt++;
            wr6Fb.set({
                str: 'String 6',
                cross: {
                    _ref: wr5Fb.toString() + '/'
                }
            }, opCnter);
            wr7Fb = wrFb.child('wr7');
            opcnt++;
            wr7Fb.set({
                str: 'String 7',
                cross: {
                    _ref: wr6Fb.toString() + '/'
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
            wmFb = new Firebase(baseUrl + '/withMap');
            wm1Fb = wmFb.child('wm1');
            opcnt++;
            wm1Fb.set({
                embedMap: {
                    a: { str: 'aChild' },
                    b: { str: 'bChild' },
                    c: {
                        str: 'cChild',
                        _dis: 'oth'
                    }
                }
            }, opCnter);
            wm2Fb = wmFb.child('wm2');
            opcnt++;
            wm2Fb.set({
                refMap: {
                    a: { _ref: baseUrl + 'withProps/wp1' },
                    b: { _ref: baseUrl + 'withProps/wp2' },
                    c: { _ref: baseUrl + 'withProps/more*wp3' }
                }
            }, opCnter);
            wstFb = new Firebase(baseUrl + '/withSet');
            wst1Fb = wstFb.child('ws1');
            opcnt++;
            wst1Fb.set({
                embedSet: {
                    '00a': { str: '3 a' },
                    '00b': { str: '2 b' },
                    '00c': {
                        str: '1 c',
                        _dis: 'oth'
                    }
                },
                sortedSet: {
                    '00a': { str: '3 a' },
                    '00b': { str: '2 b' },
                    '00c': {
                        str: '1 c',
                        _dis: 'oth'
                    }
                }
            }, opCnter);
            wst2Fb = wstFb.child('ws2');
            opcnt++;
            wst2Fb.set({
                refSet: {
                    'wp1': { _ref: baseUrl + 'withProps/wp1' },
                    'wp2': { _ref: baseUrl + 'withProps/wp2' },
                    'more*wp3': { _ref: baseUrl + 'withProps/more*wp3' }
                }
            }, opCnter);
            wst3Fb = wstFb.child('ws3');
            opcnt++;
            wst3Fb.set({
                refSet: {
                    'wp2': { _ref: baseUrl + 'withProps/wp2' },
                    'wp4': { _ref: baseUrl + 'withProps/wp4' },
                }
            }, opCnter);
            wltFb = new Firebase(baseUrl + '/withList');
            wlt1Fb = wltFb.child('wl1');
            opcnt++;
            wlt1Fb.set({
                embedList: {
                    '0PMg765te9nNvKoP08Ndpa': { str: '3 a' },
                    '0PMg765te9nNvKoP08Ndpb': { str: '2 b' },
                    '0PMg765te9nNvKoP08Ndpc': {
                        str: '1 c',
                        _dis: 'oth'
                    }
                },
                str: 'dummy'
            }, opCnter);
            wlt2Fb = wltFb.child('wl2');
            opcnt++;
            wlt2Fb.set({
                refList: {
                    '0PMg765te9nNvKoP08Ndpa': { _ref: baseUrl + 'withProps/wp1' },
                    '0PMg765te9nNvKoP08Ndpb': { _ref: baseUrl + 'withProps/wp2' },
                    '0PMg765te9nNvKoP08Ndpc': { _ref: baseUrl + 'withProps/more*wp3' }
                },
                str: 'dummy'
            }, opCnter);
            wlt3Fb = wltFb.child('wl3');
            opcnt++;
            wlt3Fb.set({
                embedList: null,
                str: 'dummy'
            }, opCnter);
            wlt4Fb = wltFb.child('wl4');
            opcnt++;
            wlt4Fb.set({
                embedList: [],
                str: 'dummy'
            }, opCnter);
            complexFb = new Firebase(baseUrl + '/complex');
            cp1Fb = complexFb.child('cp1');
            opcnt++;
            cp1Fb.set({
                embedList: {
                    '0PMg765te9nNvKoP08Ndpa': { str: '3 a' },
                    '0PMg765te9nNvKoP08Ndpb': { str: '2 b' },
                    '0PMg765te9nNvKoP08Ndpc': {
                        str: '1 c',
                        _dis: 'oth'
                    }
                },
                ref: {
                    _ref: wp1Fb.toString() + '/'
                },
                sub: {
                    str: 'Sub String 1'
                },
                str: 'dummy'
            }, opCnter);
            cp2Fb = complexFb.child('cp2');
            opcnt++;
            cp2Fb.set({
                embedList: {
                    '0PMg765te9nNvKoP08Ndpa': { str: '3 a' },
                    '0PMg765te9nNvKoP08Ndpb': { str: '2 b' },
                    '0PMg765te9nNvKoP08Ndpc': {
                        str: '1 c',
                        _dis: 'oth'
                    }
                },
                ref: {
                    _ref: wp2Fb.toString() + '/'
                },
                sub: {
                    str: 'Sub String 1'
                },
                cross: {
                    _ref: cp1Fb.toString() + '/'
                },
                str: 'dummy'
            }, opCnter);
            // Keep reference alive in ram, faster tests and less side effects
            var myp = progr++;
            rooton = root.on('value', function () { });
            //console.log("before ends");
            opCnter();
        });
        describe('Utils >', function () {
            it('should copy various type of values', function () {
                assert("copy of null").when(Db3.Utils.copyVal(null)).is(M.exactly(null));
                assert("copy of undefined").when(Db3.Utils.copyVal(undefined)).is(M.exactly(undefined));
                assert("copy of string").when(Db3.Utils.copyVal("str")).is("str");
                assert("copy of number").when(Db3.Utils.copyVal(1)).is(1);
                assert("copy of array").when(Db3.Utils.copyVal([1, 2])).is(M.arrayEquals([1, 2]));
                assert("copy of object").when(Db3.Utils.copyVal({ a: 1, b: 2 })).is(M.objectMatchingStrictly({ a: 1, b: 2 }));
                // works but assertion doesn't
                //assert("copy of array of array").when(Db3.Utils.copyVal([[1,2],[3,4]])).is(M.arrayEquals([[1,2],[3,4]]));
                assert("copy of object of objects").when(Db3.Utils.copyVal({ x: { a: 1, b: 2 }, y: { c: 3, d: 4 } })).is(M.objectMatchingStrictly({ x: M.objectMatchingStrictly({ a: 1, b: 2 }), y: M.objectMatchingStrictly({ c: 3, d: 4 }) }));
            });
            it('should merge objects', function () {
                var obj1 = {
                    a: 'ciao',
                    b: [1, 2, 3],
                    c: {
                        a: 'hello',
                        b: [1, 2, 3]
                    }
                };
                var obj2 = {
                    a: 'bonjour',
                    c: {
                        a: 'shalom'
                    }
                };
                Db3.Utils.copyObj(obj2, obj1);
                assert("objects merged correctly").when(obj1).is(M.objectMatchingStrictly({
                    a: 'bonjour',
                    b: M.arrayEquals([1, 2, 3]),
                    c: M.objectMatchingStrictly({
                        a: 'shalom',
                        b: M.arrayEquals([1, 2, 3])
                    })
                }));
            });
        });
        describe('Metadata >', function () {
            it('should detect WithSubentity class', function () {
                var allmeta = Db3.Internal.getAllMetadata();
                var clmeta = allmeta.findMeta(WithSubentity);
                assert('has right url').when(clmeta.root).is('withSubs');
                var wpmeta = clmeta.descriptors['sub'];
                assert('class meta has sub property').when(wpmeta).is(M.aTruthy);
                assert('the meta is right').when(wpmeta).is(M.objectMatching({
                    localName: 'sub',
                    remoteName: M.aFalsey,
                    ctor: M.aTruthy
                }));
            });
            it('should deal with super/subclasses and discriminators', function () {
                var allmeta = Db3.Internal.getAllMetadata();
                var submeta = allmeta.findMeta(SubEntity);
                var othmeta = allmeta.findMeta(SubEntityOth);
                var yetmeta = allmeta.findMeta(SubEntityYet);
                assert('second one has its the properties').when(yetmeta.descriptors).is(M.objectMatching({
                    testOther: M.aTruthy
                }));
                assert('last one has all the properties').when(yetmeta.descriptors).is(M.objectMatching({
                    testOther: M.aTruthy,
                    testYetOther: M.aTruthy
                }));
                assert('first one has correct subclass').when(submeta.subMeta).is(M.arrayEquals([othmeta]));
                assert('second one has correct subclass').when(othmeta.subMeta).is(M.arrayEquals([yetmeta]));
                assert('second one has correct superclass').when(othmeta.superMeta).is(M.exactly(submeta));
                assert('third one has correct superclass').when(yetmeta.superMeta).is(M.exactly(othmeta));
                assert('second one has discriminator value').when(othmeta.discriminator).is('oth');
                assert('third one has discriminator value').when(yetmeta.discriminator).is('yet');
                assert('find correct discriminated meta for oth').when(submeta.findForDiscriminator('oth')).is(othmeta);
                assert('find correct discriminated meta for yet').when(submeta.findForDiscriminator('yet')).is(yetmeta);
                assert('find correctly itself for oth').when(othmeta.findForDiscriminator('oth')).is(othmeta);
                assert('correctly dont find on super for oth').when(yetmeta.findForDiscriminator('oth')).is(null);
            });
            it('should intercept simple metadata thru getters', function () {
                Db3.Internal.clearLastStack();
                var we = new WithSubentity();
                var sub = we.sub;
                var lastEntity = Db3.Internal.getLastEntity();
                var lastPath = Db3.Internal.getLastMetaPath();
                assert("right last entity on length=1").when(lastEntity).is(M.exactly(we));
                assert("right path length on length=1").when(lastPath).is(M.withLength(1));
                assert("right path on length=1").when(lastPath[0]).is(M.objectMatching({
                    localName: 'sub'
                }));
            });
            it('should intercept observable metadata thru getters', function () {
                Db3.Internal.clearLastStack();
                var wp = new WithProps();
                var sub = wp.num;
                var lastEntity = Db3.Internal.getLastEntity();
                var lastPath = Db3.Internal.getLastMetaPath();
                assert("right last entity on length=1").when(lastEntity).is(M.exactly(wp));
                assert("right path length on length=1").when(lastPath).is(M.withLength(1));
                assert("right path on length=1").when(lastPath[0]).is(M.objectMatching({
                    localName: 'num'
                }));
            });
            it('should intercept longer metadata thru getters', function () {
                Db3.Internal.clearLastStack();
                var we = new WithSubentity();
                we.nested = new WithSubentity();
                var subsub = we.nested.sub;
                var lastEntity = Db3.Internal.getLastEntity();
                var lastPath = Db3.Internal.getLastMetaPath();
                assert("right last entity on length=1").when(lastEntity).is(M.exactly(we));
                assert("right path length on length=1").when(lastPath).is(M.withLength(2));
                assert("right path on length=1").when(lastPath[0]).is(M.objectMatching({
                    localName: 'nested'
                }));
                assert("right path on length=1").when(lastPath[1]).is(M.objectMatching({
                    localName: 'sub'
                }));
            });
            it("doesn't create problems with getters and setters", function () {
                var e1 = new WithSubentity();
                var s1 = new SubEntity();
                s1.str = "aaa";
                e1.sub = s1;
                var e2 = new WithSubentity();
                var s2 = new SubEntity();
                s2.str = "bbb";
                e2.sub = s2;
                assert("don't share the same value").when(e1.sub).is(M.not(M.exactly(e2.sub)));
                var ks = [];
                for (var k in e2)
                    ks.push(k);
                //assert("the created __property for meta getters is not visible").when(ks).is(M.not(M.arrayContaining('__sub')));
                assert("the meta getter is visible property").when(ks).is(M.arrayContaining('sub'));
            });
            it("builds correct simple event path", function () {
                var ws1 = Db(WithSubentity).get('ws1');
                var ge = Db(ws1.sub);
                assert("returned a generic event").when(ge).is(M.aTruthy);
                var er = Db(WithSubentity);
                var ws1event = er.fetchFromCache('ws1');
                assert("found state for main entity").when(ws1event).is(M.aTruthy);
                assert("it's parent is the right one").when(ge.parent).is(M.exactly(ws1event));
                assert("it has the right url").when(ge.getUrl()).is('/withSubs/ws1/sub/');
                assert("it's right type").when(ge).is(M.instanceOf(Db3.Internal.EntityEvent));
                assert("gets correctly the is").when(Db(ws1).getId()).is('ws1');
                assert("refuses to get sub entity id").when(Db(ws1.sub).getId()).is(null);
            });
            it("avoids getting confused with other calls to getters", function () {
                var wr1 = Db(WithRef).get('wr1');
                var ge = Db(wr1.ref);
                var a = wr1.ref;
                var b = wr1.ref;
                var ge2 = Db(wr1.ref);
                assert("Didn't got confused by repetitive calls").when(ge).is(M.exactly(ge2));
                var wr1e = Db(wr1);
                assert("Didn't got confused by subsequent entity only call").when(wr1e).is(M.not(M.exactly(ge2)));
                assert("Returned the right event").when(wr1e.getUrl()).is('/withRefs/wr1/');
                var wp2 = Db(WithProps).get('wp2');
                var ge = Db(wr1.ref);
                var a = wr1.ref;
                var wp2e = Db(wp2);
                assert("Didn't got confused by subsequent entity only call with right type but different instance")
                    .when(ge).is(M.not(M.exactly(wp2e)));
            });
            it('should generate valid unique ids forward', function (done) {
                var iterations = 5000;
                var block = 50;
                this.timeout(iterations * 1.5);
                var ids = {};
                var cnt = 1;
                var lst = '0';
                function checkRnd() {
                    var id = Db3.Utils.IdGenerator.next();
                    M.assert('Id is unique ' + id + ' on ' + cnt).when(ids[id]).is(M.aFalsey);
                    M.assert('Id is progressive').when(id > lst).is(true);
                    ids[id] = cnt++;
                    lst = id;
                    //console.log(id,cnt);
                }
                var intH = setInterval(function () {
                    for (var i = 0; i < block; i++) {
                        checkRnd();
                    }
                    if (cnt > iterations) {
                        clearInterval(intH);
                        done();
                    }
                }, 1);
            });
            it('should generate valid unique ids backward', function (done) {
                var iterations = 5000;
                var block = 50;
                this.timeout(iterations * 1.5);
                var ids = {};
                var cnt = 1;
                var lst = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
                function checkRnd() {
                    var id = Db3.Utils.IdGenerator.back();
                    M.assert('Id is unique ' + id + ' on ' + cnt).when(ids[id]).is(M.aFalsey);
                    M.assert('Id is progressive').when(id < lst).is(true);
                    ids[id] = cnt++;
                    lst = id;
                    //console.log(id,cnt);
                }
                var intH = setInterval(function () {
                    for (var i = 0; i < block; i++) {
                        checkRnd();
                    }
                    if (cnt > iterations) {
                        clearInterval(intH);
                        done();
                    }
                }, 1);
            });
            it('should report broken forward declarations', function () {
                var threw = false;
                try {
                    var mod = require('./Db3ForwardWrong');
                }
                catch (e) {
                    console.log(e);
                    threw = true;
                }
                assert('should throw exception').when(threw).is(true);
            });
            it('should support function based forward declarations', function () {
                var mod = require('./Db3ForwardRight');
                Db3.Internal.clearLastStack();
                var we = new mod.A();
                var sub = we.prop;
                var lastEntity = Db3.Internal.getLastEntity();
                var lastPath = Db3.Internal.getLastMetaPath();
                var lastEle = lastPath[lastPath.length - 1];
                var entityType = lastEle.ctor;
                assert("resolved to right entity type").when(entityType).is(mod.B);
                console.log(lastPath);
            });
            // TODO implement the .props property to clean any ambiguity
        });
        describe('Entity reading >', function () {
            it('should return an entity root', function () {
                var er = Db(WithProps);
                assert("returned an entity root").when(er).is(M.objectMatching({ get: M.aFunction }));
                assert("root has right url").when(er.getUrl()).is('/withProps/');
            });
            it('should pre-init an entity', function () {
                var er = Db(WithProps);
                var wp1 = er.get('wp1');
                M.assert("Inited entity").when(wp1).is(M.aTruthy);
                var wp2 = er.get('wp1');
                M.assert("Same instance").when(wp2).is(M.exactly(wp1));
                M.assert("Has right url").when(Db(wp1).getUrl()).is('/withProps/wp1/');
            });
            it('should load simple entities', function () {
                var wp1 = Db(WithProps).get('wp1');
                return Db(wp1).load(_this)
                    .then(function (det) {
                    M.assert('Data loaded').when(wp1).is(M.objectMatching({
                        str: 'String 1',
                        num: 200,
                        arr: [1, 2, 3],
                        subobj: {
                            substr: 'Sub String'
                        },
                        ignored: 'ignored'
                    }));
                    M.assert("Entity hook respected").when(wp1._lastUpdateEv).is(M.objectMatching({
                        type: Db3.Api.EventType.LOAD,
                        payload: M.exactly(wp1)
                    }));
                    return 1;
                })
                    .then(function (n) {
                    M.assert('Chained correctly').when(n).is(1);
                });
            });
            it('should load more times if needed', function (done) {
                // Introduce lag on purpose
                root.off('value', rooton);
                var cnt = 0;
                function lastLoad() {
                    var wp1 = Db(WithProps).get('wp1');
                    Db(wp1).load(this).then(function (det) {
                        cnt++;
                        if (cnt == 4)
                            done();
                    });
                }
                setTimeout(function () {
                    var wp1 = Db(WithProps).get('wp1');
                    Db(wp1).load(_this).then(function (det) {
                        cnt++;
                        lastLoad();
                    });
                    var wp12 = Db(WithProps).get('wp1');
                    Db(wp12).updated(_this, function (det) {
                        cnt++;
                        lastLoad();
                        det.offMe();
                    });
                }, 10);
            });
            it('should report existing and non existing', function () {
                var wp1 = Db(WithProps).get('wp1');
                var wp100 = Db(WithProps).get('wp100');
                M.assert("Inited existing entity").when(wp1).is(M.aTruthy);
                M.assert("Inited non existing entity").when(wp100).is(M.aTruthy);
                return Db(wp1).exists(_this).then(function (val) {
                    assert('Found existing').when(val).is(true);
                    return Db(wp100).exists(_this);
                }).then(function (val) {
                    assert('Found non existing').when(val).is(false);
                });
            });
            it('should load polimorphic on rooted', function () {
                var wp3 = Db(WithProps).get('more*wp3');
                assert('it\'s right entity type').when(wp3).is(M.instanceOf(WithMoreProps));
            });
            it('should remove null preinited values', function () {
                var wp1 = Db(WithProps).get('wp5');
                return Db(wp1).load(_this).then(function () {
                    assert("the null field is null").when(wp1.str).is(M.aFalsey);
                });
            });
            it('should handle null update on natives', function () {
                var wp1 = Db(WithProps).get('wp1');
                return Db(wp1).load(_this).then(function () {
                    wp1Fb.set({
                        str: 'String 1',
                        num: 200,
                        subobj: {
                            substr: 'Sub String'
                        },
                        ignored: 'never seen'
                    });
                    return Db(wp1).reload(_this);
                }).then(function () {
                    assert("the modified field is now null").when(wp1.arr).is(M.aFalsey);
                });
            });
            it('should update data', function (done) {
                var wp1 = Db(WithProps).get('wp1');
                var times = 0;
                Db(wp1).updated(_this, function (det) {
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
            it('should notify synthetic updates', function (done) {
                var wp1 = Db(WithProps).get('wp1');
                var times = 0;
                Db(wp1).updated(_this, function (det) {
                    times++;
                    if (times == 1) {
                        // Done loading event
                        assert("Should receive done loading event").when(det.type).is(Db3.Api.EventType.LOAD);
                        wp1._local = 5;
                        wp1.$moreLocal = 5;
                        Db(wp1).triggerLocalSave();
                    }
                    else if (times == 2) {
                        assert("Given event should be an update").when(det.type).is(Db3.Api.EventType.UPDATE);
                        assert("Given event is synthetic").when(det.synthetic).is(true);
                        assert("Given event has right payload").when(det.payload).is(wp1);
                        assert("In payload there is modification of _").when(det.payload._local).is(5);
                        assert("In payload there is modification of $").when(det.payload.$moreLocal).is(5);
                        det.offMe();
                        done();
                    }
                    else {
                        assert("Should not call the event more than once").when(times).is(M.lessThan(3));
                    }
                });
            });
            it('should notify synthetic updates on sub entities', function (done) {
                var ws1 = Db(WithSubentity).get('ws1');
                var times = 0;
                Db(ws1.sub).updated(_this, function (det) {
                    times++;
                    if (times == 1) {
                        // Done loading event
                        assert("Should receive done loading event").when(det.type).is(Db3.Api.EventType.LOAD);
                        ws1.str = "synth";
                        Db(ws1).triggerLocalSave();
                    }
                    else if (times == 2) {
                        assert("Given event should be an update").when(det.type).is(Db3.Api.EventType.UPDATE);
                        assert("Given event is synthetic").when(det.synthetic).is(true);
                        assert("Given event has right payload").when(det.payload).is(ws1.sub);
                        det.offMe();
                        done();
                    }
                    else {
                        assert("Should not call the event more than once").when(times).is(M.lessThan(3));
                    }
                });
            });
            it('should update data for observable', function (done) {
                var wp1 = Db(WithProps).get('wp1');
                var times = 0;
                Db(wp1.num).updated(_this, function (det) {
                    if (times == 0) {
                        times++;
                        M.assert('First data loaded').when(wp1.num).is(200);
                        M.assert('Rest of entity not loaded').when(wp1.str).is('useless');
                        wp1Fb.update({ num: '2' });
                    }
                    else if (times == 1) {
                        times++;
                        M.assert('Second data updated').when(wp1.num).is(2);
                        M.assert('Rest of entity not loaded').when(wp1.str).is('useless');
                        det.offMe();
                        done();
                    }
                    else {
                        M.assert("Got called too many times").when(times).is(M.lessThan(2));
                    }
                });
            });
            describe('Embeddeds >', function () {
                it('should load sub entities with the main one', function () {
                    var ws1 = Db(WithSubentity).get('ws1');
                    return Db(ws1).load(_this).then(function (det) {
                        M.assert("Loaded main").when(ws1.str).is('String 1');
                        M.assert("Sub has right type").when(ws1.sub).is(M.instanceOf(SubEntity));
                        M.assert("Loaded subentity").when(ws1.sub.str).is('Sub String 1');
                        M.assert("Called sub entity postUpdate").when(ws1.sub._lastUpdateEv).is(M.aTruthy);
                    });
                });
                it('should load sub sub entities with the main one', function () {
                    var ws1 = Db(WithSubentity).get('ws3');
                    return Db(ws1).load(_this).then(function (det) {
                        M.assert("Loaded main").when(ws1.str).is('String 3');
                        M.assert("Nested has right type").when(ws1.nested).is(M.instanceOf(WithSubentity));
                        M.assert("Loaded subentity").when(ws1.nested.str).is('Sub String 3');
                        M.assert("Sub has right type").when(ws1.nested.sub).is(M.instanceOf(SubEntity));
                        M.assert("Loaded subsubentity").when(ws1.nested.sub.str).is('Sub Sub String 3');
                        M.assert("Called subsubentity postUpdate").when(ws1.nested.sub._lastUpdateEv).is(M.aTruthy);
                    });
                });
                it('should load sub sub entities discriminating the type', function () {
                    var ws1 = Db(WithSubentity).get('ws3');
                    return Db(ws1).load(_this).then(function (det) {
                        M.assert("Sub has right type").when(ws1.nested.sub).is(M.instanceOf(SubEntityOth));
                        M.assert("Loaded subsubentity").when(ws1.nested.sub.str).is('Sub Sub String 3');
                    });
                });
                it('should load sub entities withOUT the main one', function () {
                    var ws2 = Db(WithSubentity).get('ws2');
                    return Db(ws2.sub).load(_this).then(function (det) {
                        M.assert("NOT Loaded main").when(ws2.str).is(M.aFalsey);
                        M.assert("Sub has right type").when(ws2.sub).is(M.instanceOf(SubEntity));
                        M.assert("Loaded subentity").when(ws2.sub.str).is('Sub String 1');
                        M.assert("Called sub entity postUpdate").when(ws2.sub._lastUpdateEv).is(M.aTruthy);
                    });
                });
                it('should handle null sub entities when loading withOUT the main one', function () {
                    var ws4 = Db(WithSubentity).get('ws4');
                    return Db(ws4.sub).load(_this).then(function (det) {
                        M.assert("NOT Loaded main").when(ws4.str).is(M.aFalsey);
                        M.assert("Loaded subentity").when(ws4.sub).is(M.exactly(null));
                    });
                });
            });
            describe('References >', function () {
                it('should dereference a reference', function () {
                    var wr1 = Db(WithRef).get('wr1');
                    var refevent = Db(wr1.ref);
                    return refevent.dereference(_this).then(function (det) {
                        M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
                        M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
                        M.assert("Right event").when(refevent).is(M.objectMatching({
                            nameOnParent: 'ref',
                        }));
                        M.assert("Right url for ref").when(refevent.getReferencedUrl()).is('/withProps/wp1/');
                    });
                });
                it('should dereference a reference with projections', function () {
                    var wr1 = Db(WithRef).get('wr2');
                    var refevent = Db(wr1.ref);
                    return refevent.dereference(_this).then(function (det) {
                        M.assert("Applied projections").when(wr1.ref).is(M.objectMatching({
                            str: 'String 1',
                            num: 200
                        }));
                    });
                });
                it('should dereference a polimorphic reference to root', function () {
                    var wr1 = Db(WithRef).get('wr3');
                    var refevent = Db(wr1.ref);
                    return refevent.dereference(_this).then(function (det) {
                        M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
                        M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithMoreProps));
                        M.assert("Right event").when(refevent).is(M.objectMatching({
                            nameOnParent: 'ref',
                        }));
                        M.assert("Right url for ref").when(refevent.getReferencedUrl()).is('/withProps/more*wp3/');
                    });
                });
                it('should notify of referencing', function (done) {
                    var wr1 = Db(WithRef).get('wr1');
                    var refevent = Db(wr1.ref);
                    var cnt = 0;
                    var wp1 = null;
                    refevent.referenced(_this, function (det) {
                        cnt++;
                        if (cnt == 1) {
                            M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
                            M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
                            wp1 = wr1.ref;
                            M.assert("Right url for ref").when(refevent.getReferencedUrl()).is('/withProps/wp1/');
                            wr1Fb.child('ref/_ref').set('/withProps/wp2/');
                        }
                        else if (cnt == 2) {
                            M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
                            M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
                            M.assert("Right url for ref").when(refevent.getReferencedUrl()).is('/withProps/wp2/');
                            M.assert("Changed the entity").when(wr1.ref).is(M.not(M.exactly(wp1)));
                            det.offMe();
                            done();
                        }
                    });
                });
                it('should load sub entites reference with the main one', function () {
                    var wr1 = Db(WithRef).get('wr1');
                    return Db(wr1).load(_this).then(function (det) {
                        M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
                        M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
                        // At this point, the reference is loaded but the internal entity is not, which is right
                        var refd = wr1.ref;
                        Db();
                        M.assert("Right url for ref").when(Db(refd).getUrl()).is('/withProps/wp1/');
                    });
                });
                it('should load sub entites reference withOUT the main one', function () {
                    var wr1 = Db(WithRef).get('wr2');
                    return Db(wr1.ref).load(_this).then(function (det) {
                        M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
                        M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
                        M.assert("Loaded the ref data").when(wr1.ref).is(M.objectMatching({
                            str: 'String 1',
                            num: 200,
                            arr: [1, 2, 3],
                            subobj: {
                                substr: 'Sub String'
                            }
                        }));
                        M.assert("Didn't load the main one").when(wr1.str).is(M.undefinedValue);
                    });
                });
                it('should load reference to other entities sub references', function () {
                    var wr1 = Db(WithRef).get('wr1');
                    return Db(wr1.othSubRef).load(_this).then(function (det) {
                        M.assert("Loaded the ref").when(wr1.othSubRef).is(M.aTruthy);
                        M.assert("Right type for ref").when(wr1.othSubRef).is(M.instanceOf(SubEntity));
                        M.assert("Resolved the ref").when(wr1.othSubRef.str).is("Sub String 1");
                    });
                });
                it('should load polimorphic reference to other entities sub references', function () {
                    var wr1 = Db(WithRef).get('wr3');
                    return Db(wr1.othSubRef).load(_this).then(function (det) {
                        M.assert("Loaded the ref").when(wr1.othSubRef).is(M.aTruthy);
                        M.assert("Right type for ref").when(wr1.othSubRef).is(M.instanceOf(SubEntityOth));
                    });
                });
                it('should dereference a totally polimorphic reference', function () {
                    var wr1 = Db(WithRef).get('wr4');
                    var refevent = Db(wr1.anything);
                    return refevent.dereference(_this).then(function (det) {
                        M.assert("Loaded the ref").when(wr1.anything).is(M.aTruthy);
                        M.assert("Right type for ref").when(wr1.anything).is(M.instanceOf(WithProps));
                        M.assert("Right event").when(refevent).is(M.objectMatching({
                            nameOnParent: 'anything',
                        }));
                        M.assert("Right url for ref").when(refevent.getReferencedUrl()).is('/withProps/wp1/');
                    });
                });
                it('should load totally polimorphic reference', function () {
                    var wr1 = Db(WithRef).get('wr4');
                    return Db(wr1.anything).load(_this).then(function (det) {
                        M.assert("Loaded the ref").when(wr1.anything).is(M.aTruthy);
                        M.assert("Right type for ref").when(wr1.anything).is(M.instanceOf(WithProps));
                        M.assert("Loaded the ref data").when(wr1.anything).is(M.objectMatching({
                            str: 'String 1',
                            num: 200,
                            arr: [1, 2, 3],
                            subobj: {
                                substr: 'Sub String'
                            }
                        }));
                    });
                });
                it("should cross metadata when encountering references", function () {
                    var wr1 = Db(WithRef).get('wr5');
                    return Db(wr1.anything).load(_this).then(function () {
                        var ot = wr1.anything;
                        var trev = Db(ot.sub);
                        assert("Found the event").when(trev).is(M.aTruthy);
                        assert("It's entity event").when(trev).is(M.instanceOf(Db3.Internal.EntityEvent));
                    });
                });
            });
            describe('Urls >', function () {
                it('should load a root entity', function () {
                    return Db().load(_this, wp1Fb.toString()).then(function (ed) {
                        var wp1 = ed.payload;
                        M.assert('Data is of right type').when(wp1).is(M.instanceOf(WithProps));
                        M.assert('Data loaded').when(wp1).is(M.objectMatching({
                            str: 'String 1',
                            num: 200,
                            arr: [1, 2, 3],
                            subobj: {
                                substr: 'Sub String'
                            },
                            ignored: 'ignored'
                        }));
                        M.assert("Entity hook respected").when(wp1._lastUpdateEv).is(M.objectMatching({
                            type: Db3.Api.EventType.LOAD,
                            payload: M.exactly(wp1)
                        }));
                    });
                });
                it('should load an embedded', function () {
                    return Db().load(_this, ws1Fb.toString() + '/sub').then(function (ed) {
                        var sube = ed.payload;
                        M.assert('Data is of right type').when(sube).is(M.instanceOf(SubEntity));
                        M.assert('Data loaded').when(sube.str).is('Sub String 1');
                    });
                });
                it('should load a nested embedded', function () {
                    return Db().load(_this, ws2Fb.toString() + '/nested/sub').then(function (ed) {
                        var sube = ed.payload;
                        M.assert('Data is of right type').when(sube).is(M.instanceOf(SubEntity));
                        M.assert('Data loaded').when(sube.str).is('Sub Sub String 1');
                    });
                });
            });
            describe('Binding >', function () {
                it('should bind and keep live on subentity and parent', function () {
                    var wpl1 = Db(WithPreloads).get('wpl1');
                    return Db(wpl1.oth).load(_this).then(function () {
                        M.assert("Inited the subentity").when(wpl1.sub).is(M.aTruthy);
                        M.assert("Loaded the subentity").when(wpl1.sub.str).is('abc');
                        M.assert("Inited the bound").when(wpl1.oth._sub).is(M.aTruthy);
                        M.assert("Bound the subentity").when(wpl1.oth._sub.str).is('abc');
                        M.assert("Bound parent").when(wpl1.oth._parent).is(M.exactly(wpl1));
                    }).then(function () {
                        var fbsub = new Firebase(baseUrl + Db(wpl1.sub).getUrl());
                        return new Promise(function (ok) {
                            fbsub.update({ str: 'cde' }, ok);
                        });
                    }).then(function () {
                        M.assert("Updated the subentity").when(wpl1.oth._sub.str).is('cde');
                    });
                });
                // update live when a reference pointer is changed
                it('should bind and keep live on reference pointer', function () {
                    var wpl1 = Db(WithPreloads).get('wpl1');
                    return Db(wpl1.oth).load(_this).then(function () {
                        M.assert("Loaded the ref").when(wpl1.ref).is(M.aTruthy);
                        M.assert("Inited the bound").when(wpl1.oth._ref).is(M.aTruthy);
                        M.assert("Bound the subentity").when(wpl1.oth._ref.str).is('String 1');
                    }).then(function () {
                        var fbsub = new Firebase(baseUrl + Db(wpl1.ref).getUrl());
                        return new Promise(function (ok) {
                            fbsub.update({ _ref: wp2Fb.toString() }, ok);
                        });
                    }).then(function () {
                        M.assert("Updated the reference pointer").when(wpl1.oth._ref.str).is('String 2');
                    });
                });
                it('should bind and keep live on referenced entity', function () {
                    var wpl1 = Db(WithPreloads).get('wpl1');
                    return Db(wpl1.oth).load(_this).then(function () {
                        M.assert("Loaded the ref").when(wpl1.ref).is(M.aTruthy);
                        M.assert("Inited the bound").when(wpl1.oth._ref).is(M.aTruthy);
                        M.assert("Bound the subentity").when(wpl1.oth._ref.str).is('String 1');
                        var fbsub = new Firebase(baseUrl + Db(wpl1.ref).getReferencedUrl());
                        return new Promise(function (ok) {
                            fbsub.update({ str: 'cde' }, ok);
                        });
                    }).then(function () {
                        M.assert("Updated the subentity").when(wpl1.oth._ref.str).is('cde');
                    });
                });
                it('should bind when loading only parent entity', function () {
                    var wpl1 = Db(WithPreloads).get('wpl1');
                    return Db(wpl1).load(_this).then(function () {
                        M.assert("Inited the subentity").when(wpl1.sub).is(M.aTruthy);
                        M.assert("Loaded the subentity").when(wpl1.sub.str).is('abc');
                        M.assert("Inited the bound").when(wpl1.oth._sub).is(M.aTruthy);
                        M.assert("Bound the subentity").when(wpl1.oth._sub.str).is('abc');
                        M.assert("Bound parent").when(wpl1.oth._parent).is(M.exactly(wpl1));
                    });
                });
                it('should bind and keep live when only loading parent entity', function () {
                    var wpl1 = Db(WithPreloads).get('wpl1');
                    return Db(wpl1).load(_this).then(function () {
                        M.assert("Inited the subentity").when(wpl1.sub).is(M.aTruthy);
                        M.assert("Loaded the subentity").when(wpl1.sub.str).is('abc');
                        M.assert("Inited the bound").when(wpl1.oth._sub).is(M.aTruthy);
                        M.assert("Bound the subentity").when(wpl1.oth._sub.str).is('abc');
                        M.assert("Bound parent").when(wpl1.oth._parent).is(M.exactly(wpl1));
                    }).then(function () {
                        var fbsub = new Firebase(baseUrl + Db(wpl1.sub).getUrl());
                        return new Promise(function (ok) {
                            fbsub.update({ str: 'cde' }, ok);
                        });
                    }).then(function () {
                        M.assert("Updated the subentity").when(wpl1.oth._sub.str).is('cde');
                    });
                });
                it('should not trigger useless binding that clears set values', function () {
                    var wpl1 = new WithPreloads();
                    Db(wpl1).assignUrl();
                    wpl1.oth = new DifferentSubEntity();
                    wpl1.ref = new WithProps();
                    wpl1.oth._ref = wpl1.ref;
                    M.assert("Has not incorrectly loaded the binding").when(wpl1.oth._ref).is(M.aTruthy);
                });
            });
        });
        describe('Entity writing >', function () {
            describe('Serialization >', function () {
                it('should serialize basic entity correctly', function () {
                    var wp = new WithProps();
                    wp._local = 5;
                    wp.$moreLocal = 5;
                    wp.num = 1;
                    wp.str = 'abc';
                    wp.arr = [1];
                    wp.subobj.substr = 'cde';
                    wp.ignored = 'ciao';
                    var ee = Db(wp);
                    M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatchingStrictly({
                        num: 1,
                        str: 'abc',
                        arr: [1],
                        subobj: { substr: 'cde' }
                    }));
                });
                it('should serialize basic entity respecting given field names', function () {
                    var wp = new WithProps();
                    wp._local = 5;
                    wp.$moreLocal = 5;
                    wp.num = 1;
                    wp.str = 'abc';
                    wp.arr = [1];
                    wp.subobj.substr = 'cde';
                    wp.ignored = 'ciao';
                    var ee = Db(wp);
                    M.assert("Serialization is correct").when(ee.serialize(false, ['num', 'str'])).is(M.objectMatchingStrictly({
                        num: 1,
                        str: 'abc'
                    }));
                });
                it('should serialize correctly sub entities', function () {
                    var ws = new WithSubentity();
                    ws.str = 'abc';
                    var ss = new SubEntity();
                    ws.sub = ss;
                    ss.str = 'cde';
                    var ee = Db(ws);
                    M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatchingStrictly({
                        str: 'abc',
                        sub: { str: 'cde' }
                    }));
                });
                it('should serialize correctly lcoalsOnly without sub entities', function () {
                    var ws = new WithSubentity();
                    ws.str = 'abc';
                    var ss = new SubEntity();
                    ws.sub = ss;
                    ss.str = 'cde';
                    var ee = Db(ws);
                    M.assert("Serialization is correct").when(ee.serialize(true)).is(M.objectMatchingStrictly({
                        str: 'abc'
                    }));
                });
                it('should serialize correctly polimorphic sub entities', function () {
                    var ws = new WithSubentity();
                    ws.str = 'abc';
                    var ss = new SubEntityOth();
                    ws.sub = ss;
                    ss.str = 'cde';
                    var ee = Db(ws);
                    M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatchingStrictly({
                        str: 'abc',
                        sub: {
                            str: 'cde',
                            _dis: 'oth'
                        }
                    }));
                });
                it('should honour custom serialize', function () {
                    var ss = new SubEntity();
                    ss.str = 'cde';
                    ss.serialize = function () {
                        return { mystr: 'aaa' };
                    };
                    var ee = Db(ss);
                    M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatchingStrictly({
                        mystr: 'aaa'
                    }));
                });
                it('should serialize correctly references', function () {
                    var wr = new WithRef();
                    var wp1 = Db(WithProps).get('wp1');
                    wr.ref = wp1;
                    var ee = Db(wr);
                    M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatching({
                        ref: {
                            _ref: '/withProps/wp1/'
                        }
                    }));
                });
                it('should serialize correctly cross references', function () {
                    var wr1 = new WithRef();
                    var wr2 = new WithRef();
                    Db(wr2).assignUrl('cr2');
                    Db(wr1).assignUrl('cr1');
                    wr1.cross = wr2;
                    wr2.cross = wr1;
                    var ee = Db(wr1);
                    M.assert("Serialization of wr1 is correct").when(ee.serialize()).is(M.objectMatching({
                        cross: {
                            _ref: '/withRefs/cr2/'
                        }
                    }));
                    var ee = Db(wr2);
                    M.assert("Serialization of wr2 is correct").when(ee.serialize()).is(M.objectMatching({
                        cross: {
                            _ref: '/withRefs/cr1/'
                        }
                    }));
                });
                it('should serialize correctly reference projections', function () {
                    var wpr = new WithPreloads();
                    var wp1 = Db(WithProps).get('wp1');
                    return Db(wp1).load(_this).then(function () {
                        wpr.ref = wp1;
                        var ee = Db(wpr);
                        M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatching({
                            ref: {
                                _ref: '/withProps/wp1/',
                                str: 'String 1',
                                num: 200
                            }
                        }));
                    });
                });
                it('should serialize correctly polimorphic root references', function () {
                    var wr = new WithRef();
                    var wp1 = Db(WithProps).get('more*wp3');
                    wr.ref = wp1;
                    var ee = Db(wr);
                    M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatching({
                        ref: {
                            _ref: '/withProps/more*wp3/*more'
                        }
                    }));
                });
                it('should serialize correctly polimorphic sub references', function () {
                    var wr = new WithRef();
                    var ws3 = Db(WithSubentity).get('ws3');
                    return Db(ws3).load(_this).then(function () {
                        wr.othSubRef = ws3.nested.sub;
                        var ee = Db(wr);
                        M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatching({
                            othSubRef: {
                                _ref: M.stringContaining('nested/sub/*oth')
                            }
                        }));
                    });
                });
            });
            describe('Saving new >', function () {
                it('should assign right url to a new entity mapped on root', function () {
                    var wp = new WithProps();
                    Db(wp).assignUrl();
                    M.assert("Assigned right url").when(Db(wp).getUrl()).is(M.stringContaining("withProps/"));
                    M.assert("Url doesnt contain discriminator").when(Db(wp).getUrl()).is(M.not(M.stringContaining("*")));
                });
                it('should assign right url with specified id to a new entity mapped on root', function () {
                    var wp = new WithProps();
                    Db(wp).assignUrl("wp55");
                    M.assert("Assigned right url").when(Db(wp).getUrl()).is('/withProps/wp55/');
                });
                it('should assign right url to a new polimorphic entity mapped on root', function () {
                    var wp = new WithMoreProps();
                    Db(wp).assignUrl();
                    M.assert("Assigned right url").when(Db(wp).getUrl()).is(M.stringContaining("withProps/"));
                    M.assert("Url contains discriminator").when(Db(wp).getUrl()).is(M.stringContaining("more*"));
                });
                it('should throw error an a new entity not mapped on root', function () {
                    var wp = new SubEntity();
                    var excp = null;
                    try {
                        Db(wp).assignUrl();
                    }
                    catch (e) {
                        excp = e;
                    }
                    M.assert("Exception thrown").when(excp).is(M.aTruthy);
                });
                // write new entity
                it('should save a new entity', function () {
                    var wp = new WithProps();
                    wp.str = 'abcd';
                    wp.num = 555;
                    wp.arr = [89, 72];
                    wp.subobj.substr = 'eeee';
                    wp.ignored = 'ciao';
                    return Db(wp).save()
                        .then(function () {
                        return new Promise(function (ok) {
                            var url = Db(wp).getUrl();
                            new Firebase(baseUrl + url).once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        M.assert("New entity saved correctly").when(ds.val()).is(M.objectMatching({
                            str: 'abcd',
                            num: 555,
                            arr: [89, 72],
                            subobj: { substr: 'eeee' },
                            ignored: M.undefinedValue
                        }));
                    });
                });
                it('should save a new entity after checking exist', function () {
                    var wp90 = Db(WithProps).get('wp90');
                    return Db(wp90).exists(_this).then(function (ex) {
                        assert("Entity does not exist already").when(ex).is(false);
                        wp90.num = 100;
                        Db(wp90).assignUrl('wp90');
                        return Db(wp90).save();
                    }).then(function () {
                        assert("Has right url").when(Db(wp90).getUrl()).is('/withProps/wp90/');
                    });
                });
                it('should save a new entity instance after checking exist', function () {
                    var wp90 = Db(WithProps).get('wp90');
                    return Db(wp90).exists(_this).then(function (ex) {
                        assert("Entity does not exist already").when(ex).is(false);
                        wp90 = new WithProps();
                        wp90.num = 100;
                        Db(wp90).assignUrl('wp90');
                        return Db(wp90).save();
                    }).then(function () {
                        assert("Has right url").when(Db(wp90).getUrl()).is('/withProps/wp90/');
                    });
                });
                // write entity in entity, as full object
                it('should save correctly sub entities', function () {
                    var ws = new WithSubentity();
                    ws.str = 'abc';
                    var ss = new SubEntity();
                    ws.sub = ss;
                    ss.str = 'cde';
                    return Db(ws).save()
                        .then(function () {
                        return new Promise(function (ok) {
                            new Firebase(baseUrl + Db(ws).getUrl()).once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        M.assert("Serialized correctly").when(ds.val()).is(M.objectMatching({
                            str: 'abc',
                            sub: { str: 'cde' }
                        }));
                    });
                });
                // write reference
                it('should save a reference correctly', function () {
                    var wp1 = Db(WithProps).get('wp1');
                    var url = Db(wp1).getUrl();
                    var wrn = new WithRef();
                    wrn.str = 'abc';
                    wrn.ref = wp1;
                    return Db(wrn).save()
                        .then(function () {
                        return new Promise(function (ok) {
                            new Firebase(baseUrl + Db(wrn).getUrl()).once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        M.assert("Serialized correctly").when(ds.val()).is(M.objectMatching({
                            str: 'abc',
                            ref: { _ref: url }
                        }));
                    });
                });
                it('should save a reference correctly also on assigned url', function () {
                    var wp1 = Db(WithProps).get('wp1');
                    var url = Db(wp1).getUrl();
                    var wrn = new WithRef();
                    Db(wrn).assignUrl();
                    wrn.str = 'abc';
                    wrn.ref = wp1;
                    return Db(wrn).save()
                        .then(function () {
                        return new Promise(function (ok) {
                            new Firebase(baseUrl + Db(wrn).getUrl()).once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        M.assert("Serialized correctly").when(ds.val()).is(M.objectMatching({
                            str: 'abc',
                            ref: { _ref: url }
                        }));
                    });
                });
                it('should bind correctly existing subentity on assigned url', function () {
                    var ws = new WithSubentity();
                    var se = new SubEntity();
                    ws.sub = se;
                    Db(ws).assignUrl();
                    assert('subentity is bound').when(Db3.of(se)).is(M.aTruthy);
                });
                it('should assign url and save refernced new entity', function () {
                    var wr1 = Db(WithRef).get("wr1");
                    return Db(wr1).load(_this).then(function () {
                        var nwp = new WithProps();
                        nwp.num = 1000;
                        wr1.ref = nwp;
                        return Db(wr1.ref).save();
                    }).then(function () {
                        return new Promise(function (res) {
                            wr1Fb.on('value', function (ds) {
                                res(ds);
                            });
                        });
                    }).then(function (ds) {
                        var val = ds.val();
                        assert("Set the reference correctly").when(val.ref._ref).is(M.stringContaining('/withProps/'));
                    });
                });
            });
            describe('Updating >', function () {
                it('should update an entity', function () {
                    var wp1 = Db(WithProps).get('wp1');
                    return Db(wp1).load(_this)
                        .then(function () {
                        wp1.num = 1000;
                        wp1.str = 'Updated';
                        wp1.arr = [7, 8, 9];
                        wp1.subobj.substr = 'Sub updated';
                        wp1.ignored = 'should not';
                        //return wp1.save();
                        return Db(wp1).save();
                    })
                        .then(function () {
                        return new Promise(function (ok) {
                            wp1Fb.once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
                            num: 1000,
                            str: 'Updated',
                            arr: [7, 8, 9],
                            subobj: { substr: 'Sub updated' },
                            ignored: 'never seen'
                        }));
                    });
                });
                it('should correctly update partially loaded entity', function () {
                    var ws1 = Db(WithSubentity).get('ws2');
                    ws1.str = 'saved';
                    return Db(ws1.sub).load(_this)
                        .then(function () {
                        ws1.sub.str = 'this is saved too';
                        return Db(ws1).save();
                    })
                        .then(function () {
                        return new Promise(function (ok) {
                            ws2Fb.once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
                            str: 'saved',
                            sub: {
                                str: 'this is saved too'
                            },
                            // Untouched
                            nested: {
                                str: 'Sub String 1'
                            }
                        }));
                    });
                });
                it('should support swapping sub entities', function () {
                    var ws1 = Db(WithSubentity).get('ws2');
                    return Db(ws1).load(_this)
                        .then(function () {
                        var nsub = new SubEntity();
                        nsub.str = 'new sub';
                        ws1.sub = nsub;
                        return Db(ws1).save();
                    })
                        .then(function () {
                        return new Promise(function (ok) {
                            ws2Fb.once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
                            str: 'String 1',
                            sub: {
                                str: 'new sub'
                            },
                        }));
                    });
                });
                it('should support swapping also nested sub entities', function () {
                    var ws2 = Db(WithSubentity).get('ws2');
                    return Db(ws2).load(_this)
                        .then(function () {
                        var nsub = new SubEntity();
                        nsub.str = 'new sub';
                        var nwsub = new WithSubentity();
                        nwsub.sub = nsub;
                        nwsub.str = 'new nested';
                        ws2.nested = nwsub;
                        return Db(ws2).save();
                    })
                        .then(function () {
                        return new Promise(function (ok) {
                            ws2Fb.once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
                            str: 'String 1',
                            sub: {
                                str: 'Sub String 1'
                            },
                            nested: {
                                str: 'new nested',
                                sub: {
                                    str: 'new sub'
                                }
                            }
                        }));
                    });
                });
                it('should support swapping polimorphic sub entities', function () {
                    var ws1 = Db(WithSubentity).get('ws2');
                    return Db(ws1).load(_this)
                        .then(function () {
                        var nsub = new SubEntityOth();
                        nsub.str = 'new sub';
                        ws1.sub = nsub;
                        return Db(ws1).save();
                    })
                        .then(function () {
                        return new Promise(function (ok) {
                            ws2Fb.once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
                            str: 'String 1',
                            sub: {
                                str: 'new sub',
                                otherData: 1,
                                _dis: 'oth'
                            },
                        }));
                    });
                });
            });
        });
        describe('Overrides >', function () {
            var serDb = Db().fork({ override: 'server' });
            it('should have proper metadata', function () {
                var wp1 = Db(WithProps).get('wp1');
                var ev = Db(wp1);
                var state = ev.state;
                var meta = state.myMeta.findMeta(WithProps);
                var sermeta = state.myMeta.findMeta(ServerWithProps);
                assert('metadata found').when(meta).is(M.aTruthy);
                assert('server metadata found').when(sermeta).is(M.aTruthy);
                assert('they are connected').when(meta.subMeta).is(M.arrayContaining(M.exactly(sermeta)));
                assert('has override').when(sermeta.override).is('server');
            });
            it('should properly load root entity for server', function () {
                var wp1 = serDb(WithProps).get('wp1');
                assert('entity root returned right overridden type').when(wp1).is(M.instanceOf(ServerWithProps));
                return serDb(wp1).load(_this).then(function (det) {
                    M.assert('Right type').when(wp1).is(M.instanceOf(ServerWithProps));
                    M.assert('Data loaded').when(wp1).is(M.objectMatching({
                        str: 'String 1',
                        num: 200,
                        arr: [1, 2, 3],
                        subobj: {
                            substr: 'Sub String'
                        }
                    }));
                });
            });
            it('should load sub entities for server', function () {
                var ws1 = serDb(WithSubentity).get('ws1');
                return serDb(ws1).load(_this).then(function (det) {
                    M.assert("Right type").when(ws1.sub).is(M.instanceOf(ServerSubEntity));
                    M.assert("Loaded main").when(ws1.str).is('String 1');
                    M.assert("Loaded subentity").when(ws1.sub.str).is('Sub String 1');
                });
            });
            it('should load sub entites reference withOUT the main one for server', function () {
                var wr1 = serDb(WithRef).get('wr2');
                return serDb(wr1.ref).load(_this).then(function (det) {
                    M.assert("Inited the ref").when(wr1.ref).is(M.aTruthy);
                    M.assert("ref right type").when(wr1.ref).is(M.instanceOf(ServerWithProps));
                    M.assert("Loaded the ref").when(wr1.ref).is(M.objectMatching({
                        str: 'String 1',
                        num: 200,
                        arr: [1, 2, 3],
                        subobj: {
                            substr: 'Sub String'
                        }
                    }));
                    M.assert("Didn't load the main one").when(wr1.str).is(M.undefinedValue);
                });
            });
            it('should load reference to other entities sub references for server', function () {
                var wr1 = serDb(WithRef).get('wr1');
                return serDb(wr1.othSubRef).load(_this).then(function (det) {
                    M.assert("inited the ref").when(wr1.othSubRef).is(M.aTruthy);
                    M.assert("ref right type").when(wr1.othSubRef).is(M.instanceOf(ServerSubEntity));
                    M.assert("Resolved the ref").when(wr1.othSubRef.str).is("Sub String 1");
                });
            });
        });
        describe('Collections >', function () {
            describe('Map >', function () {
                it('should notify simple adds for each element', function (done) {
                    var wm1 = Db(WithMap).get('wm1');
                    var recvs = [];
                    Db(wm1.embedMap).added(_this, function (det) {
                        if (det.type != Db3.Api.EventType.LIST_END) {
                            recvs.push(det);
                            return;
                        }
                        assert("received 3 events").when(recvs).is(M.withLength(3));
                        assert("event 0 is right").when(recvs[0]).is(M.objectMatching({
                            type: Db3.Api.EventType.ADDED,
                            populating: true,
                            precedingKey: M.aFalsey,
                            originalKey: 'a',
                            payload: {
                                str: 'aChild'
                            }
                        }));
                        assert("event 1 is right").when(recvs[1]).is(M.objectMatching({
                            type: Db3.Api.EventType.ADDED,
                            populating: true,
                            precedingKey: 'a',
                            originalKey: 'b',
                            payload: {
                                str: 'bChild'
                            }
                        }));
                        assert("event 2 is right").when(recvs[2]).is(M.objectMatching({
                            type: Db3.Api.EventType.ADDED,
                            populating: true,
                            precedingKey: 'b',
                            originalKey: 'c',
                            payload: M.either(M.instanceOf(SubEntityOth)).and(M.objectMatching({
                                str: 'cChild'
                            }))
                        }));
                        assert("end event is right").when(det).is(M.objectMatching({
                            type: Db3.Api.EventType.LIST_END,
                            populating: true,
                        }));
                        assert("field is still empty").when(wm1.embedMap).is(M.objectMatchingStrictly({}));
                        det.offMe();
                        done();
                    });
                });
                it('should notify simple adds for each element on references', function (done) {
                    var wm1 = Db(WithMap).get('wm2');
                    var recvs = [];
                    Db(wm1.refMap).added(_this, function (det) {
                        if (det.type != Db3.Api.EventType.LIST_END) {
                            recvs.push(det);
                            return;
                        }
                        assert("received 3 events").when(recvs).is(M.withLength(3));
                        assert("event 0 is right").when(recvs[0]).is(M.objectMatching({
                            type: Db3.Api.EventType.ADDED,
                            populating: true,
                            precedingKey: M.aFalsey,
                            originalKey: 'a',
                            payload: M.instanceOf(WithProps)
                        }));
                        assert("event 1 is right").when(recvs[1]).is(M.objectMatching({
                            type: Db3.Api.EventType.ADDED,
                            populating: true,
                            precedingKey: 'a',
                            originalKey: 'b',
                            payload: M.instanceOf(WithProps)
                        }));
                        assert("event 2 is right").when(recvs[2]).is(M.objectMatching({
                            type: Db3.Api.EventType.ADDED,
                            populating: true,
                            precedingKey: 'b',
                            originalKey: 'c',
                            payload: M.instanceOf(WithMoreProps)
                        }));
                        assert("end event is right").when(det).is(M.objectMatching({
                            type: Db3.Api.EventType.LIST_END,
                            populating: true,
                        }));
                        assert("field is still empty").when(wm1.refMap).is(M.objectMatchingStrictly({}));
                        det.offMe();
                        done();
                    });
                });
                it('should notify elements removal', function (done) {
                    var wm1 = Db(WithMap).get('wm1');
                    var recvs = [];
                    Db(wm1.embedMap).removed(_this, function (det) {
                        recvs.push(det);
                        det.offMe();
                    });
                    setTimeout(function () {
                        wm1Fb.child('embedMap/b').remove();
                        assert("received one event").when(recvs).is(M.withLength(1));
                        assert("event was right").when(recvs[0]).is(M.objectMatching({
                            type: Db3.Api.EventType.REMOVED,
                            populating: false,
                            originalKey: 'b',
                            payload: {
                                str: 'bChild'
                            }
                        }));
                        done();
                    }, 1000);
                });
                it('should notify elements modification', function (done) {
                    var wm1 = Db(WithMap).get('wm1');
                    var recvs = [];
                    Db(wm1.embedMap).changed(_this, function (det) {
                        recvs.push(det);
                        det.offMe();
                    });
                    setTimeout(function () {
                        wm1Fb.child('embedMap/b/str').set('modified');
                        assert("received one event").when(recvs).is(M.withLength(1));
                        assert("event was right").when(recvs[0]).is(M.objectMatching({
                            type: Db3.Api.EventType.UPDATE,
                            populating: false,
                            originalKey: 'b',
                            payload: {
                                str: 'modified'
                            }
                        }));
                        done();
                    }, 1000);
                });
                it('should keep the field in sync when using update', function (done) {
                    var wm1 = Db(WithMap).get('wm1');
                    var recvs = [];
                    Db(wm1.embedMap).updated(_this, function (det) {
                        if (det.type != Db3.Api.EventType.LIST_END) {
                            recvs.push(det);
                            return;
                        }
                        assert("received 3 events").when(recvs).is(M.withLength(3));
                        assert("field is synched").when(wm1.embedMap).is(M.objectMatchingStrictly({
                            a: { str: 'aChild' },
                            b: { str: 'bChild' },
                            c: { str: 'cChild' }
                        }));
                        det.offMe();
                        done();
                    });
                });
                it('should load all the collection with load', function () {
                    var wm1 = Db(WithMap).get('wm1');
                    return Db(wm1.embedMap).load(_this).then(function () {
                        assert("field is synched").when(wm1.embedMap).is(M.objectMatchingStrictly({
                            a: { str: 'aChild' },
                            b: { str: 'bChild' },
                            c: { str: 'cChild' }
                        }));
                    });
                });
                it('should load all the collection with the parent entity', function () {
                    var wm1 = Db(WithMap).get('wm1');
                    return Db(wm1).load(_this).then(function () {
                        assert("field is synched").when(wm1.embedMap).is(M.objectMatchingStrictly({
                            a: { str: 'aChild' },
                            b: { str: 'bChild' },
                            c: { str: 'cChild' }
                        }));
                    });
                });
                it('should load the collection with the parent entity and preserve it on save', function () {
                    var wm1 = Db(WithMap).get('wm1');
                    return Db(wm1).load(_this).then(function () {
                        wm1.anyOtherProp = 'ciao';
                        return Db(wm1).save();
                    }).then(function () {
                        return new Promise(function (ok) {
                            wm1Fb.child('embedMap').once('value', ok);
                        });
                    }).then(function (ds) {
                        assert("collection was preserved").when(ds.val()).is(M.objectMatchingStrictly({
                            a: { str: 'aChild' },
                            b: { str: 'bChild' },
                            c: { str: 'cChild' }
                        }));
                    });
                });
                it('should load all the collection resolving references with load', function () {
                    var wm1 = Db(WithMap).get('wm2');
                    var recvs = [];
                    return Db(wm1.refMap).load(_this).then(function () {
                        assert("field is synched").when(wm1.refMap).is(M.objectMatchingStrictly({
                            a: M.objectMatching({
                                str: 'String 1',
                                num: 200,
                                arr: [1, 2, 3],
                                subobj: {
                                    substr: 'Sub String'
                                },
                                ignored: 'ignored'
                            }),
                            b: M.objectMatching({
                                str: 'String 2',
                                num: 300,
                                arr: [2, 3, 4],
                                subobj: {
                                    substr: 'Sub String'
                                }
                            }),
                            c: M.objectMatching({
                                str: 'String 3',
                                num: 400,
                                moreNum: 401,
                                arr: [3, 4, 5],
                                subobj: {
                                    substr: 'Sub String'
                                },
                                _dis: 'more'
                            })
                        }));
                    });
                });
                it('should load all the collection only dereferencing references', function () {
                    var wm1 = Db(WithMap).get('wm2');
                    var evt = Db(wm1);
                    var state = evt.state;
                    var recvs = [];
                    return Db(wm1.refMap).dereference(_this).then(function () {
                        assert("field is synched").when(wm1.refMap).is(M.objectMatchingStrictly({
                            a: {
                                ignored: 'ignored',
                                _local: 1,
                                $moreLocal: 1,
                                str: M.undefinedValue,
                            },
                            b: {
                                ignored: 'ignored',
                                _local: 1,
                                $moreLocal: 1,
                                str: M.undefinedValue,
                            },
                            c: {
                                ignored: 'ignored',
                                _local: 1,
                                $moreLocal: 1,
                                str: M.undefinedValue,
                            }
                        }));
                        /*
                        assert("field is synched").when(wm1.refMap).is(M.objectMatchingStrictly({
                            a : {
                                str: 'useless',
                                num: 0,
                                arr: [],
                                subobj: {
                                    substr: ''
                                }
                            },
                            b: {
                                str: 'useless',
                                num: 0,
                                arr: [],
                                subobj: {
                                    substr: ''
                                }
                            },
                            c:{
                                str: 'useless',
                                num: 0,
                                arr: [],
                                subobj: {
                                    substr: ''
                                }
                            }
                        }));
                        */
                    });
                });
                it('should add embedded to the map', function () {
                    var wm1 = Db(WithMap).get('wm1');
                    var sub = new SubEntityOth();
                    sub.str = 'added';
                    return Db(wm1.embedMap).add('d', sub).then(function () {
                        assert("Added to the local map").when(wm1.embedMap['d']).is(sub);
                        return new Promise(function (ok) {
                            wm1Fb.child('embedMap').once('value', ok);
                        });
                    }).then(function (ds) {
                        assert('has added the element').when(ds.val()).is(M.objectMatching({
                            d: {
                                str: 'added',
                                _dis: 'oth'
                            }
                        }));
                    });
                });
                it('should add reference to the map', function () {
                    var wm1 = Db(WithMap).get('wm2');
                    var wp1 = Db(WithProps).get('wp1');
                    return Db(wm1.refMap).add('d', wp1).then(function () {
                        assert("Added to the local map").when(wm1.refMap['d']).is(wp1);
                        return new Promise(function (ok) {
                            wm2Fb.child('refMap').once('value', ok);
                        });
                    }).then(function (ds) {
                        assert('has added the element').when(ds.val()).is(M.objectMatching({
                            d: {
                                _ref: Db(wp1).getUrl()
                            }
                        }));
                    });
                });
                it('should remove a key from the map', function () {
                    var wm1 = Db(WithMap).get('wm1');
                    return Db(wm1.embedMap).load(_this).then(function () {
                        return Db(wm1.embedMap).remove('b');
                    }).then(function () {
                        assert("Removed from the local map").when(wm1.embedMap['b']).is(M.aFalsey);
                        return Db(wm1.embedMap).fetch(_this, 'b');
                    }).then(function (val) {
                        assert("Should not return a removed element when using fetch").when(val.type).is(Db3.Api.EventType.REMOVED);
                        return new Promise(function (ok) {
                            wm1Fb.child('embedMap').once('value', ok);
                        });
                    }).then(function (ds) {
                        assert('has removed the element').when(ds.val()).is(M.objectMatchingStrictly({
                            a: M.aTruthy,
                            c: M.aTruthy
                        }));
                    });
                });
                it('should clear the map', function () {
                    var wm1 = Db(WithMap).get('wm1');
                    return Db(wm1.embedMap).load(_this).then(function () {
                        return Db(wm1.embedMap).clear();
                    }).then(function () {
                        assert("Removed from the local map").when(wm1.embedMap['b']).is(M.aFalsey);
                        return new Promise(function (ok) {
                            wm1Fb.child('embedMap').once('value', ok);
                        });
                    }).then(function (ds) {
                        assert('has removed all elements').when(ds.val()).is(M.objectMatchingStrictly({}));
                    });
                });
                it('should update a cleared map when loading entity', function () {
                    var wm1 = Db(WithMap).get('wm1');
                    return Db(wm1).load(_this).then(function () {
                        var ks = 0;
                        for (var k in wm1.embedMap)
                            ks++;
                        assert("Map is filled").when(ks).is(3);
                        wm1Fb.update({ embedMap: null });
                        return Db(wm1).reload(_this);
                    }).then(function () {
                        var ks = 0;
                        for (var k in wm1.embedMap)
                            ks++;
                        assert("Map is empty").when(ks).is(0);
                    });
                });
                it('should update a cleared map when loading map directly', function () {
                    var wm1 = Db(WithMap).get('wm1');
                    return Db(wm1.embedMap).load(_this).then(function () {
                        var ks = 0;
                        for (var k in wm1.embedMap)
                            ks++;
                        assert("Map is filled").when(ks).is(3);
                        wm1Fb.update({ embedMap: null });
                        return Db(wm1.embedMap).load(_this);
                    }).then(function () {
                        var ks = 0;
                        for (var k in wm1.embedMap)
                            ks++;
                        assert("Map is empty").when(ks).is(0);
                    });
                });
                it('should fetch an embed with a specific key', function () {
                    var wm1 = Db(WithMap).get('wm1');
                    return Db(wm1.embedMap).fetch(_this, 'b').then(function (det) {
                        assert("event is right").when(det).is(M.objectMatching({
                            type: Db3.Api.EventType.LOAD,
                            populating: false,
                            originalKey: 'b',
                            payload: {
                                str: 'bChild'
                            }
                        }));
                    });
                });
                it('should fetch a ref with a specific key and remove it', function () {
                    var wm1 = Db(WithMap).get('wm2');
                    return Db(wm1.refMap).fetch(_this, 'b').then(function (det) {
                        assert("event is right").when(det).is(M.objectMatching({
                            type: Db3.Api.EventType.LOAD,
                            populating: false,
                            // Note : the reference is dereferenced AND loaded, so the key is not the one in the map
                            originalKey: 'wp2',
                            payload: {
                                str: 'String 2',
                                num: 300,
                                arr: [2, 3, 4],
                                subobj: {
                                    substr: 'Sub String'
                                }
                            }
                        }));
                        return Db(wm1.refMap).remove('b');
                    }).then(function () {
                        return Db(wm1.embedMap).fetch(_this, 'b');
                    }).then(function (val) {
                        assert("Should not return a removed element when using fetch").when(val.type).is(Db3.Api.EventType.REMOVED);
                    });
                });
                it('should save a new entity with a manually built map', function () {
                    var nwm = new WithMap();
                    var sub = new SubEntity();
                    sub.str = 'Im new';
                    nwm.embedMap['a'] = sub;
                    return Db(nwm).save()
                        .then(function () {
                        var url = Db(nwm).getUrl();
                        return new Promise(function (ok) {
                            new Firebase(baseUrl + url).once('value', ok);
                        });
                    })
                        .then(function (ds) {
                        assert('saved map looks right').when(ds.val()).is(M.objectMatching({
                            embedMap: {
                                a: {
                                    str: 'Im new'
                                }
                            }
                        }));
                    });
                });
                // TODO entity as key
            });
            describe('Set >', function () {
                it('should load embed set in array', function () {
                    var ws1 = Db(WithSet).get('ws1');
                    return Db(ws1.embedSet).load(_this).then(function () {
                        assert('right length').when(ws1.embedSet).is(M.withLength(3));
                        assert('right type 0').when(ws1.embedSet[0]).is(M.instanceOf(SubEntity));
                        assert('right value 0').when(ws1.embedSet[0]).is(M.objectMatching({
                            str: '3 a'
                        }));
                        assert('right type 1').when(ws1.embedSet[1]).is(M.instanceOf(SubEntity));
                        assert('right value 1').when(ws1.embedSet[1]).is(M.objectMatching({
                            str: '2 b'
                        }));
                        assert('right type 2').when(ws1.embedSet[2]).is(M.instanceOf(SubEntity));
                        assert('right value 2').when(ws1.embedSet[2]).is(M.objectMatching({
                            str: '1 c'
                        }));
                    });
                });
                it('should load ref set in array', function () {
                    var ws1 = Db(WithSet).get('ws2');
                    return Db(ws1.refSet).load(_this).then(function () {
                        assert('right length').when(ws1.refSet).is(M.withLength(3));
                        assert('right type 0').when(ws1.refSet[0]).is(M.instanceOf(WithProps));
                        assert('right type 1').when(ws1.refSet[1]).is(M.instanceOf(WithProps));
                        assert('right type 2').when(ws1.refSet[2]).is(M.instanceOf(WithProps));
                    });
                });
                it('should load embed set in array when loading parent entity', function () {
                    var ws1 = Db(WithSet).get('ws1');
                    return Db(ws1).load(_this).then(function () {
                        assert('right length').when(ws1.embedSet).is(M.withLength(3));
                        assert('right type 0').when(ws1.embedSet[0]).is(M.instanceOf(SubEntity));
                        assert('right value 0').when(ws1.embedSet[0]).is(M.objectMatching({
                            str: '3 a'
                        }));
                        assert('right type 1').when(ws1.embedSet[1]).is(M.instanceOf(SubEntity));
                        assert('right value 1').when(ws1.embedSet[1]).is(M.objectMatching({
                            str: '2 b'
                        }));
                        assert('right type 2').when(ws1.embedSet[2]).is(M.instanceOf(SubEntity));
                        assert('right value 2').when(ws1.embedSet[2]).is(M.objectMatching({
                            str: '1 c'
                        }));
                    });
                });
                it('should load embed set with parent entity and preserve it on save', function () {
                    var ws1 = Db(WithSet).get('ws1');
                    return Db(ws1).load(_this).then(function () {
                        ws1.anyOtherProp = 'ciao';
                        return Db(ws1).save();
                    }).then(function () {
                        return new Promise(function (ok) {
                            wst1Fb.child('embedSet').once('value', ok);
                        });
                    }).then(function (ds) {
                        assert("set was preserved").when(ds.val()).is(M.objectMatchingStrictly({
                            '00a': M.anObject,
                            '00b': M.anObject,
                            '00c': M.anObject
                        }));
                    });
                });
                it('should load ref set in array when loading parent entity', function () {
                    var ws1 = Db(WithSet).get('ws2');
                    return Db(ws1).load(_this).then(function () {
                        assert('right length').when(ws1.refSet).is(M.withLength(3));
                        assert('right type 0').when(ws1.refSet[0]).is(M.instanceOf(WithProps));
                        assert('right type 1').when(ws1.refSet[1]).is(M.instanceOf(WithProps));
                        assert('right type 2').when(ws1.refSet[2]).is(M.instanceOf(WithProps));
                    });
                });
                it('should add new element to the embed set', function () {
                    var ws1 = Db(WithSet).get('ws1');
                    var ns = new SubEntity();
                    ns.str = 'added';
                    return Db(ws1.embedSet).add(ns).then(function () {
                        assert("New element is in the set").when(ws1.embedSet).is(M.arrayContaining(ns));
                        return new Promise(function (ok) {
                            wst1Fb.child('embedSet').on('value', ok);
                        });
                    }).then(function (ds) {
                        var val = ds.val();
                        delete val['00a'];
                        delete val['00b'];
                        delete val['00c'];
                        var k = null;
                        var kval = null;
                        var cnt = 0;
                        for (k in val) {
                            cnt++;
                            kval = val[k];
                        }
                        assert('added one element').when(cnt).is(1);
                        assert('serialized correctly').when(kval).is(M.objectMatchingStrictly({
                            str: 'added'
                        }));
                    });
                });
                it('should add new element to the ref set', function () {
                    var ws1 = Db(WithSet).get('ws2');
                    var wp4 = Db(WithProps).get('wp4');
                    return Db(ws1.refSet).add(wp4).then(function () {
                        assert("New element is in the set").when(ws1.refSet).is(M.arrayContaining(wp4));
                        return new Promise(function (ok) {
                            wst2Fb.child('refSet').on('value', ok);
                        });
                    }).then(function (ds) {
                        var val = ds.val();
                        assert('added one element').when(val['wp4']).is(M.objectMatchingStrictly({
                            _ref: '/withProps/wp4/'
                        }));
                    });
                });
                it('should honour not adding already exiting element to embed set', function () {
                    var ws1 = Db(WithSet).get('ws1');
                    return Db(ws1.embedSet).load(_this).then(function () {
                        return Db(ws1.embedSet).add(ws1.embedSet[0]);
                    }).then(function () {
                        assert('set is the same in ram').when(ws1.embedSet).is(M.withLength(3));
                        return new Promise(function (ok) {
                            wst1Fb.child('embedSet').on('value', ok);
                        });
                    }).then(function (ds) {
                        var val = ds.val();
                        var cnt = 0;
                        for (var k in val) {
                            cnt++;
                        }
                        assert('set is the same').when(cnt).is(3);
                    });
                });
                it('should honour not adding already exiting element to ref set', function () {
                    var ws1 = Db(WithSet).get('ws2');
                    var wp1 = Db(WithProps).get('wp1');
                    return Db(ws1.refSet).load(_this).then(function () {
                        return Db(ws1.refSet).add(wp1);
                    }).then(function () {
                        assert('set is the same in ram').when(ws1.refSet).is(M.withLength(3));
                        return new Promise(function (ok) {
                            wst2Fb.child('refSet').on('value', ok);
                        });
                    }).then(function (ds) {
                        var val = ds.val();
                        var cnt = 0;
                        for (var k in val) {
                            cnt++;
                        }
                        assert('set is the same').when(cnt).is(3);
                    });
                });
                it('should keep the ordering', function () {
                    var ws1 = Db(WithSet).get('ws1');
                    return Db(ws1.sortedSet).load(_this).then(function () {
                        assert('element 0 is right').when(ws1.sortedSet[0].str).is('1 c');
                        assert('element 1 is right').when(ws1.sortedSet[1].str).is('2 b');
                        assert('element 2 is right').when(ws1.sortedSet[2].str).is('3 a');
                    });
                });
                it('should properly update the array on last element', function () {
                    var ws3 = Db(WithSet).get('ws3');
                    return Db(ws3.refSet).load(_this).then(function () {
                        Db(ws3.refSet).live(_this);
                        return new Promise(function (ok) {
                            wst3Fb.child('refSet/wp5').set({ _ref: '/withProps/wp5/' }, ok);
                        });
                    }).then(function () {
                        assert('length is changed').when(ws3.refSet).is(M.withLength(3));
                        assert('element is right').when(Db(ws3.refSet[2]).getUrl()).is('/withProps/wp5/');
                        Db(ws3.refSet).off(_this);
                    });
                });
                it('should properly update the array on first element', function () {
                    var ws3 = Db(WithSet).get('ws3');
                    return Db(ws3.refSet).load(_this).then(function () {
                        Db(ws3.refSet).live(_this);
                        return new Promise(function (ok) {
                            wst3Fb.child('refSet/wp1').set({ _ref: '/withProps/wp1/' }, ok);
                        });
                    }).then(function () {
                        assert('length is changed').when(ws3.refSet).is(M.withLength(3));
                        assert('element is right').when(Db(ws3.refSet[0]).getUrl()).is('/withProps/wp1/');
                        Db(ws3.refSet).off(_this);
                    });
                });
                it('should properly update the array in the middle', function () {
                    var ws3 = Db(WithSet).get('ws3');
                    return Db(ws3.refSet).load(_this).then(function () {
                        Db(ws3.refSet).live(_this);
                        return new Promise(function (ok) {
                            wst3Fb.child('refSet/wp3').set({ _ref: '/withProps/wp3/' }, ok);
                        });
                    }).then(function () {
                        assert('length is changed').when(ws3.refSet).is(M.withLength(3));
                        assert('element is right').when(Db(ws3.refSet[1]).getUrl()).is('/withProps/wp3/');
                        Db(ws3.refSet).off(_this);
                    });
                });
                it('should persist a new entity with an embedded set', function () {
                    var ws = new WithSet();
                    var sub1 = new SubEntity();
                    sub1.str = 'sub1';
                    ws.embedSet.push(sub1);
                    var sub2 = new SubEntity();
                    sub2.str = 'sub2';
                    ws.embedSet.push(sub2);
                    return Db(ws).save().then(function () {
                        return new Promise(function (ok) {
                            new Firebase(baseUrl + Db(ws).getUrl()).once('value', ok);
                        });
                    }).then(function (ds) {
                        var val = ds.val();
                        var embedSet = val['embedSet'];
                        assert('set saved').when(embedSet).is(M.aTruthy);
                        var ks = Object.keys(embedSet);
                        assert('two keys').when(ks).is(M.withLength(2));
                        ks = ks.sort();
                        var vals = [];
                        for (var i = 0; i < ks.length; i++) {
                            vals.push(embedSet[ks[i]]);
                        }
                        assert('right sub 1').when(vals[0]).is(M.objectMatching({
                            str: 'sub1'
                        }));
                        assert('right sub 2').when(vals[1]).is(M.objectMatching({
                            str: 'sub2'
                        }));
                    });
                });
                it('should remove element from the ref set', function () {
                    var ws1 = Db(WithSet).get('ws2');
                    var wp1 = Db(WithProps).get('wp1');
                    return Db(ws1.refSet).load(_this).then(function () {
                        return Db(ws1.refSet).remove(wp1);
                    }).then(function () {
                        assert("Removed from the set").when(ws1.refSet).is(M.not(M.arrayContaining(wp1)));
                    });
                });
                it('should update a cleared set when loading entity', function () {
                    var ws1 = Db(WithSet).get('ws1');
                    return Db(ws1).load(_this).then(function () {
                        assert("Set is filled").when(ws1.embedSet).is(M.withLength(3));
                        wst1Fb.update({ embedSet: null });
                        return Db(ws1).reload(_this);
                    }).then(function () {
                        assert("Set is an array").when(ws1.embedSet).is(M.anArray);
                        assert("Set is empty").when(ws1.embedSet).is(M.withLength(0));
                    });
                });
                it('should update a cleared set when loading set directly', function () {
                    var ws1 = Db(WithSet).get('ws1');
                    return Db(ws1.embedSet).load(_this).then(function () {
                        assert("Set is filled").when(ws1.embedSet).is(M.withLength(3));
                        wst1Fb.update({ embedSet: null });
                        return Db(ws1.embedSet).load(_this);
                    }).then(function () {
                        assert("Set is an array").when(ws1.embedSet).is(M.anArray);
                        assert("Set is empty").when(ws1.embedSet).is(M.withLength(0));
                    });
                });
                it('should not return an empty object when set is not there', function () {
                    var ws2 = Db(WithSet).get('ws2');
                    return Db(ws2.embedSet).load(_this).then(function () {
                        assert("Set is not an object").when(ws2.embedSet).is(M.withLength(0));
                    });
                });
                it('should not return an empty object when set is not there loading parent', function () {
                    var ws2 = Db(WithSet).get('ws2');
                    return Db(ws2).load(_this).then(function () {
                        assert("Set is not an object").when(ws2.embedSet).is(M.withLength(0));
                    });
                });
            });
            describe('List >', function () {
                it('should permit same reference more than once', function () {
                    var wl2 = Db(WithList).get('wl2');
                    var wp1 = Db(WithProps).get('wp1');
                    return Db(wl2.refList).load(_this).then(function () {
                        Db(wl2.refList).live(_this);
                        return Db(wl2.refList).add(wp1);
                    }).then(function () {
                        assert('set has grown in ram').when(wl2.refList).is(M.withLength(4));
                        Db(wl2.refList).off(_this);
                        return new Promise(function (ok) {
                            wlt2Fb.child('refList').on('value', ok);
                        });
                    }).then(function (ds) {
                        var val = ds.val();
                        var cnt = 0;
                        for (var k in val) {
                            cnt++;
                        }
                        assert('list is grown').when(cnt).is(4);
                    });
                });
                it('should be able to clone and readd', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1.embedList).load(_this).then(function () {
                        Db(wl1.embedList).live(_this);
                        var fr = Db(wl1.embedList[1]).clone();
                        return Db(wl1.embedList).add(fr);
                    }).then(function () {
                        assert('set has grown in ram').when(wl1.embedList).is(M.withLength(4));
                        Db(wl1.embedList).off(_this);
                        return new Promise(function (ok) {
                            wlt1Fb.child('embedList').on('value', ok);
                        });
                    }).then(function (ds) {
                        var val = ds.val();
                        var cnt = 0;
                        for (var k in val) {
                            cnt++;
                        }
                        assert('list is grown').when(cnt).is(4);
                    });
                });
                it('should unshift a new value at the head', function () {
                    var wl1 = Db(WithList).get('wl1');
                    var ns = new SubEntity();
                    ns.str = 'zz ahead';
                    return Db(wl1.embedList).unshift(ns).then(function () {
                        return Db(wl1.embedList).load(_this);
                    }).then(function () {
                        assert('list has grown').when(wl1.embedList).is(M.withLength(4));
                        assert('new elements is first').when(wl1.embedList[0].str).is('zz ahead');
                    });
                });
                it('should peek the first element', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1.embedList).peekHead(_this).then(function (det) {
                        assert('it is the right element').when(det.payload.str).is('3 a');
                    });
                });
                it('should shift the first element', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1.embedList).shift(_this).then(function (det) {
                        assert('it is the right element').when(det.payload.str).is('3 a');
                        return Db(wl1.embedList).load(_this);
                    }).then(function () {
                        assert('list has shrinked').when(wl1.embedList).is(M.withLength(2));
                        assert('first is now the second one').when(wl1.embedList[0].str).is('2 b');
                    });
                });
                it('should peek the last element', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1.embedList).peekTail(_this).then(function (det) {
                        assert('it is the right element').when(det.payload.str).is('1 c');
                    });
                });
                it('should pop the last element', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1.embedList).pop(_this).then(function (det) {
                        assert('it is the right element').when(det.payload.str).is('1 c');
                        return Db(wl1.embedList).load(_this);
                    }).then(function () {
                        assert('list has shrinked').when(wl1.embedList).is(M.withLength(2));
                        assert('first is still the first one').when(wl1.embedList[0].str).is('3 a');
                        assert('second is still the second one').when(wl1.embedList[1].str).is('2 b');
                    });
                });
                it('should replace an array with a new one', function () {
                    var wl1 = Db(WithList).get('wl1');
                    var newarr = [];
                    var sub = new SubEntity();
                    sub.str = 'new1';
                    newarr.push(sub);
                    sub = new SubEntity();
                    sub.str = 'new2';
                    newarr.push(sub);
                    return Db(wl1).load(_this).then(function () {
                        assert("Loaded the array").when(wl1.embedList).is(M.withLength(3));
                        wl1.embedList = newarr;
                        return Db(wl1).save();
                    }).then(function () {
                        Db().reset();
                        wl1 = Db(WithList).get('wl1');
                        return Db(wl1).load(_this);
                    }).then(function () {
                        assert('list is the new one').when(wl1.embedList).is(M.withLength(2));
                        assert('first element is new1').when(wl1.embedList[0].str).is('new1');
                        assert('second element is new2').when(wl1.embedList[1].str).is('new2');
                    });
                });
                it('should replace an array with a new one also when saving directly', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1).load(_this).then(function () {
                        assert("Loaded the array").when(wl1.embedList).is(M.withLength(3));
                        var newarr = [];
                        var sub = new SubEntity();
                        sub.str = 'new1';
                        newarr.push(sub);
                        sub = new SubEntity();
                        sub.str = 'new2';
                        newarr.push(sub);
                        wl1.embedList = newarr;
                        return Db(wl1.embedList).save();
                    }).then(function () {
                        Db().reset();
                        wl1 = Db(WithList).get('wl1');
                        return Db(wl1).load(_this);
                    }).then(function () {
                        //assert('list is the new one').when(wl1.embedList).is(M.withLength(2));
                        assert('first element is new1').when(wl1.embedList[0].str).is('new1');
                        assert('second element is new2').when(wl1.embedList[1].str).is('new2');
                    });
                });
                it('should update a cleared list when loading entity', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1).load(_this).then(function () {
                        assert("List is filled").when(wl1.embedList).is(M.withLength(3));
                        wlt1Fb.update({ embedList: null, mockValue: 1 });
                        return Db(wl1).reload(_this);
                    }).then(function () {
                        assert("List is an array").when(wl1.embedList).is(M.anArray);
                        assert("List is empty").when(wl1.embedList).is(M.withLength(0));
                    });
                });
                it('should update a cleared list when loading list directly', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1.embedList).load(_this).then(function () {
                        assert("List is filled").when(wl1.embedList).is(M.withLength(3));
                        wlt1Fb.update({ embedList: null, mockValue: 1 });
                        return Db(wl1.embedList).load(_this);
                    }).then(function () {
                        assert("List is an array").when(wl1.embedList).is(M.anArray);
                        assert("List is empty").when(wl1.embedList).is(M.withLength(0));
                    });
                });
                it('should not return an empty object when list is not there', function () {
                    var wl2 = Db(WithList).get('wl2');
                    return Db(wl2.embedList).load(_this).then(function () {
                        assert("List is not an object").when(wl2.embedList).is(M.withLength(0));
                    });
                });
                it('should not return an empty object when list is not there loading parent', function () {
                    var wl2 = Db(WithList).get('wl2');
                    return Db(wl2).load(_this).then(function () {
                        assert("List is not an object").when(wl2.embedList).is(M.withLength(0));
                    });
                });
            });
            describe('Query >', function () {
                it('should load a query on embedded objects', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1.embedList).query().load(_this).then(function (vals) {
                        assert('the list has right size').when(vals).is(M.withLength(3));
                        assert('the first element is right').when(vals[0].str).is('3 a');
                        assert('field is not inited').when(wl1.embedList).is(M.withLength(0));
                    });
                });
                it('should load a query on ref objects', function () {
                    var wl2 = Db(WithList).get('wl2');
                    return Db(wl2.refList).query().load(_this).then(function (vals) {
                        assert('the list has right size').when(vals).is(M.withLength(3));
                        assert('the first element is right type').when(vals[0]).is(M.instanceOf(WithProps));
                        assert('the first element is resolved').when(vals[0].str).is('String 1');
                        assert('field is not inited').when(wl2.refList).is(M.withLength(0));
                    });
                });
                it('should filter by range', function () {
                    var wl1 = Db(WithList).get('wl1');
                    var query = Db(wl1.embedList).query();
                    query = query.onField('str').range('2', '4');
                    return query.load(_this).then(function (vals) {
                        assert('the list has right size').when(vals).is(M.withLength(2));
                        assert('the first element is right').when(vals[0].str).is('2 b');
                        assert('the second element is right').when(vals[1].str).is('3 a');
                        assert('field is not inited').when(wl1.embedList).is(M.withLength(0));
                    });
                });
                it('should limit', function () {
                    var wl1 = Db(WithList).get('wl1');
                    return Db(wl1.embedList).query().limit(1).load(_this).then(function (vals) {
                        assert('the list has right size').when(vals).is(M.withLength(1));
                        assert('the first element is right').when(vals[0].str).is('3 a');
                        assert('field is not inited').when(wl1.embedList).is(M.withLength(0));
                    });
                });
                it('should work on entity roots', function () {
                    return Db(WithProps).query().onField('num').equals(200).load(_this).then(function (vals) {
                        assert('the list has right size').when(vals).is(M.withLength(1));
                        assert('the first element is right').when(vals[0].str).is('String 1');
                    });
                });
                it('should filter boolean values', function () {
                    return Db(WithProps).query().onField('bool').equals(false).load(_this).then(function (vals) {
                        assert('the false list has right size').when(vals).is(M.withLength(1));
                        assert('the false first element is right').when(vals[0].str).is('String 1');
                        return Db(WithProps).query().onField('bool').equals(true).load(_this);
                    }).then(function (vals) {
                        assert('the true list has right size').when(vals).is(M.withLength(3));
                        assert('the true first element is right').when(vals[0].str).is('String 3');
                        return Db(WithProps).query().onField('bool').equals(null).load(_this);
                    }).then(function (vals) {
                        assert('the true list has right size').when(vals).is(M.withLength(1));
                        assert('the true first element is right').when(vals[0].str).is('String 2');
                    });
                });
                // Tentative approach to find the double-event bug on entity root queries 
                it('should work on entity roots twice', function () {
                    return Db(WithProps).query().onField('num').equals(200).load(_this).then(function (vals) {
                        assert('the list has right size').when(vals).is(M.withLength(1));
                        assert('the first element is right').when(vals[0].str).is('String 1');
                        return Db(WithProps).query().onField('num').equals(200).load(_this);
                    }).then(function (vals) {
                        assert('the list has right size').when(vals).is(M.withLength(1));
                        assert('the first element is right').when(vals[0].str).is('String 1');
                    });
                });
            });
        });
        describe('Server calls >', function () {
            it('should serialize and deserialize refs on native', function () {
                var to = Db3.Utils.serializeRefs(1);
                assert("Serialized correctly").when(to).is(1);
                return Db3.Utils.deserializeRefs(Db, _this, to).then(function (des) {
                    assert("Serialized correctly").when(des).is(1);
                });
            });
            it('should serialize and deserialize refs on entity', function () {
                var wp1 = Db(WithProps).get("wp1");
                var wp1url = Db(wp1).getUrl();
                var to = Db3.Utils.serializeRefs(wp1);
                assert("Serialized correctly").when(to).is(M.objectMatchingStrictly({
                    _ref: wp1url
                }));
                return Db3.Utils.deserializeRefs(Db, _this, to).then(function (des) {
                    assert("Serialized correctly").when(des).is(M.exactly(wp1));
                });
            });
            it('should serialize and deserialize refs on null', function () {
                var to = Db3.Utils.serializeRefs(null);
                assert("Serialized correctly").when(to).is(null);
                return Db3.Utils.deserializeRefs(Db, _this, to).then(function (des) {
                    assert("Serialized correctly").when(des).is(null);
                });
            });
            it('should serialize and deserialize refs on array', function () {
                var wp1 = Db(WithProps).get("wp1");
                var wp1url = Db(wp1).getUrl();
                var to = Db3.Utils.serializeRefs(['a', 1, wp1]);
                assert("Serialized correctly as array").when(to).is(M.anArray);
                assert("Serialized correct length").when(to).is(M.withLength(3));
                assert("Serialized correct element 0").when(to[0]).is('a');
                assert("Serialized correct element 1").when(to[1]).is(1);
                assert("Serialized correct element 2").when(to[2]).is(M.objectMatchingStrictly({
                    _ref: wp1url
                }));
                return Db3.Utils.deserializeRefs(Db, _this, to).then(function (des) {
                    assert("Deserialized correctly as array").when(des).is(M.anArray);
                    assert("Deserialized correct length").when(des).is(M.withLength(3));
                    assert("Deserialized correct element 0").when(des[0]).is('a');
                    assert("Deserialized correct element 1").when(des[1]).is(1);
                    assert("Deserialized correct element 2").when(des[2]).is(M.exactly(wp1));
                });
            });
            it('should serialize and deserialize refs on complex object', function () {
                var wp1 = Db(WithProps).get("wp1");
                var wp1url = Db(wp1).getUrl();
                var from = {
                    str: 'str',
                    num: 1,
                    ent: wp1,
                    arr: [
                        'str',
                        1,
                        wp1
                    ],
                    obj: {
                        str: 'str',
                        num: 1,
                        ent: wp1,
                        dummy: null
                    }
                };
                var to = Db3.Utils.serializeRefs(from);
                assert("serialized correctly").when(to).is(M.objectMatchingStrictly({
                    str: 'str',
                    num: 1,
                    ent: { _ref: wp1url },
                    arr: [
                        'str',
                        1,
                        { _ref: wp1url }
                    ],
                    obj: {
                        str: 'str',
                        num: 1,
                        ent: { _ref: wp1url }
                    }
                }));
                return Db3.Utils.deserializeRefs(Db, _this, to).then(function (des) {
                    assert("deserialized correctly").when(des).is(M.objectMatchingStrictly({
                        str: 'str',
                        num: 1,
                        ent: M.exactly(wp1),
                        arr: [
                            'str',
                            1,
                            M.exactly(wp1)
                        ],
                        obj: {
                            str: 'str',
                            num: 1,
                            ent: M.exactly(wp1)
                        }
                    }));
                    assert("ref entity has been loaded").when(des.ent).is(M.objectMatching({
                        str: 'String 1',
                        num: 200,
                        arr: [1, 2, 3],
                        subobj: {
                            substr: 'Sub String'
                        }
                    }));
                });
            });
            it('should create correct server side method call payload', function () {
                var wp2 = Db(WithProps).get("wp2");
                var wp1 = Db(WithProps).get("wp1");
                var pld = Db3.Internal.createRemoteCallPayload(wp2, 'method', ['a', 1, { generic: 'object' }, wp1]);
                M.assert("Right payload").when(pld).is(M.objectMatchingStrictly({
                    entityUrl: Db(wp2).getUrl(),
                    method: 'method',
                    args: [
                        'a',
                        1,
                        { generic: 'object' },
                        { _ref: Db(wp1).getUrl() }
                    ]
                }));
            });
            it('should create correct server side STATIC method call payload', function () {
                var wp2 = Db(WithProps).get("wp2");
                var wp1 = Db(WithProps).get("wp1");
                var pld = Db3.Internal.createRemoteCallPayload(WithProps, 'method', ['a', 1, { generic: 'object' }, wp1]);
                M.assert("Right payload").when(pld).is(M.objectMatchingStrictly({
                    entityUrl: 'staticCall:WithProps',
                    method: 'method',
                    args: [
                        'a',
                        1,
                        { generic: 'object' },
                        { _ref: Db(wp1).getUrl() }
                    ]
                }));
            });
            it('should execute server side method calls', function () {
                lastRemoteCallArgs = null;
                var serDb = Db().fork({ override: 'server' });
                var wp1 = Db(WithProps).get("wp1");
                var wp2 = serDb(WithProps).get("wp2");
                var pyl = {
                    entityUrl: serDb(wp2).getUrl(),
                    method: 'remoteCall',
                    args: [
                        'a',
                        1,
                        { generic: 'object' },
                        { _ref: Db(wp1).getUrl() }
                    ]
                };
                var state = serDb(wp2).state;
                var ret = state.executeServerMethod(_this, pyl);
                return ret.then(function (val) {
                    M.assert('Returned the method return').when(val).is('localCallAck');
                    M.assert('Call param 0 is right').when(lastRemoteCallArgs[0]).is('a');
                    M.assert('Call param 1 is right').when(lastRemoteCallArgs[1]).is(1);
                    M.assert('Call param 2 is right').when(lastRemoteCallArgs[2]).is(M.objectMatching({ generic: 'object' }));
                    M.assert('Call param 3 is right').when(lastRemoteCallArgs[3]).is(M.instanceOf(WithProps));
                    M.assert('Call param 3 is right').when(lastRemoteCallArgs[3]).is(M.objectMatching({
                        str: 'String 1',
                        num: 200,
                        arr: [1, 2, 3],
                        subobj: {
                            substr: 'Sub String'
                        }
                    }));
                });
            });
            it('should execute STATIC server side method calls', function () {
                lastRemoteCallArgs = null;
                var serDb = Db().fork({ override: 'server' });
                var wp1 = Db(WithProps).get("wp1");
                var wp2 = serDb(WithProps).get("wp2");
                var pyl = {
                    entityUrl: "staticCall:WithProps",
                    method: 'statRemoteCall',
                    args: [
                        'a',
                        1,
                        { generic: 'object' },
                        { _ref: Db(wp1).getUrl() }
                    ]
                };
                var state = serDb(wp2).state;
                var ret = state.executeServerMethod(_this, pyl);
                return ret.then(function (val) {
                    M.assert('Returned the method return').when(val).is('localStaticCallAck');
                    M.assert('Call param 0 is right').when(lastRemoteCallArgs[0]).is('a');
                    M.assert('Call param 1 is right').when(lastRemoteCallArgs[1]).is(1);
                    M.assert('Call param 2 is right').when(lastRemoteCallArgs[2]).is(M.objectMatching({ generic: 'object' }));
                    M.assert('Call param 3 is right').when(lastRemoteCallArgs[3]).is(M.instanceOf(WithProps));
                    M.assert('Call param 3 is right').when(lastRemoteCallArgs[3]).is(M.objectMatching({
                        str: 'String 1',
                        num: 200,
                        arr: [1, 2, 3],
                        subobj: {
                            substr: 'Sub String'
                        }
                    }));
                });
            });
            it('should execute server side method calls with context', function () {
                lastRemoteCallArgs = null;
                var serDb = Db().fork({ override: 'server' });
                var wp1 = Db(WithProps).get("wp1");
                var wp2 = serDb(WithProps).get("wp2");
                var pyl = {
                    entityUrl: serDb(wp2).getUrl(),
                    method: 'remoteCtxCall',
                    args: [
                        'a',
                        1
                    ]
                };
                var state = serDb(wp2).state;
                var ctx = { test: 1 };
                var ret = state.executeServerMethod(ctx, pyl);
                return ret.then(function (val) {
                    M.assert('Returned the method return').when(val).is('localCallAck');
                    M.assert('Call param 0 is right').when(lastRemoteCallArgs[0]).is('a');
                    M.assert('Call param 1 is right').when(lastRemoteCallArgs[1]).is(1);
                    M.assert('Ctx param is right').when(lastRemoteCallArgs[2]).is(M.exactly(ctx));
                });
            });
            it('should execute server side method calls with context and opt params', function () {
                lastRemoteCallArgs = null;
                var serDb = Db().fork({ override: 'server' });
                var wp1 = Db(WithProps).get("wp1");
                var wp2 = serDb(WithProps).get("wp2");
                var pyl = {
                    entityUrl: serDb(wp2).getUrl(),
                    method: 'remoteCtxCall',
                    args: [
                        'a'
                    ]
                };
                var state = serDb(wp2).state;
                var ctx = { test: 1 };
                var ret = state.executeServerMethod(ctx, pyl);
                return ret.then(function (val) {
                    M.assert('Returned the method return').when(val).is('localCallAck');
                    M.assert('Call param 0 is right').when(lastRemoteCallArgs[0]).is('a');
                    M.assert('Call param 1 is right').when(lastRemoteCallArgs[1]).is(M.undefinedValue);
                    M.assert('Ctx param is right').when(lastRemoteCallArgs[2]).is(M.exactly(ctx));
                });
            });
            it('should invoke local stub', function (done) {
                lastLocalStubArgs = null;
                var lastEmitArgs = null;
                var mockDb = Db().fork({
                    clientSocket: {
                        connect: function (conf) {
                            return Promise.resolve({
                                emit: function () {
                                    lastEmitArgs = arguments;
                                }
                            });
                        }
                    }
                });
                var wp1 = mockDb(WithProps).get("wp1");
                setTimeout(function () {
                    wp1.remoteCall('a', 1);
                    assert("local stub executed").when(lastLocalStubArgs).is(M.aTruthy);
                    assert("local stub had right params").when(lastLocalStubArgs[0]).is('a');
                    assert("local stub had right params").when(lastLocalStubArgs[1]).is(1);
                    done();
                }, 50);
            });
        });
        describe('Chained events >', function () {
            it('should chain load promises', function () {
                var wp1 = Db(WithProps).get('wp1');
                var wp2 = Db(WithProps).get('wp2');
                var wp3 = Db(WithProps).get('more*wp3');
                var wp1evt = Db(wp1);
                var wp2chn = wp1evt.and(wp2);
                assert("Returned chained event").when(wp2chn).is(M.instanceOf(Db3.Internal.ChainedEvent));
                assert("Returned chained has load function").when(wp2chn['load']).is(M.aFunction);
                var wp3chn = wp2chn.and(wp3);
                return wp3chn.load(_this).then(function () {
                    assert("wp1 loaded").when(wp1.str).is('String 1');
                    assert("wp2 loaded").when(wp2.str).is('String 2');
                    assert("wp3 loaded").when(wp3.str).is('String 3');
                });
            });
            it('should chain boolean methods', function () {
                var wp1 = Db(WithProps).get('wp1');
                var wp2 = Db(WithProps).get('wp2');
                return Db(wp1).load(_this).then(function () {
                    assert("Chains with false").when(Db(wp1).and(wp2).isLoaded()).is(false);
                    return Db(wp2).load(_this);
                }).then(function () {
                    assert("Chains with true").when(Db(wp1).and(wp2).isLoaded()).is(true);
                });
            });
        });
        describe('Cache >', function () {
            describe('EntityRoot cache >', function () {
                function extractMru(er) {
                    var ret = [];
                    var acentry = er.cacheHead;
                    while (acentry) {
                        ret.push(acentry);
                        acentry = acentry.next;
                    }
                    return ret;
                }
                function extractMruKeys(er) {
                    var entries = extractMru(er);
                    var ret = '';
                    for (var i = 0; i < entries.length; i++) {
                        ret += entries[i].id + ",";
                    }
                    if (ret)
                        ret = ret.substr(0, ret.length - 1);
                    return ret;
                }
                it('should properly populate and update the mru', function () {
                    var er = Db(WithProps);
                    assert("Initial cacheHead is null").when(er.cacheHead).is(M.aFalsey);
                    assert("Initial cache is empty").when(er.cache).is(M.objectMatchingStrictly({}));
                    er.get('C');
                    er.get('B');
                    er.get('A');
                    assert("cacheHead is set").when(er.cacheHead).is(M.aTruthy);
                    assert("cacheHead is on A").when(er.cacheHead.id).is('A');
                    assert("cacheHead next is set").when(er.cacheHead.next).is(M.aTruthy);
                    assert("cacheHead next on B").when(er.cacheHead.next.id).is('B');
                    assert("cacheHead next.prev is set").when(er.cacheHead.next.prev).is(M.aTruthy);
                    assert("cacheHead next.prev on A").when(er.cacheHead.next.prev.id).is('A');
                    assert("cacheHead next.next is set").when(er.cacheHead.next.next).is(M.aTruthy);
                    assert("cacheHead next.next on C").when(er.cacheHead.next.next.id).is('C');
                    assert("cacheHead next.next.prev is set").when(er.cacheHead.next.next.prev).is(M.aTruthy);
                    assert("cacheHead next.next.prev on B").when(er.cacheHead.next.next.prev.id).is('B');
                    er.get('B');
                    assert("after update cacheHead is on B").when(er.cacheHead.id).is('B');
                    assert("after update cacheHead next is set").when(er.cacheHead.next).is(M.aTruthy);
                    assert("after update cacheHead next on A").when(er.cacheHead.next.id).is('A');
                    assert("after update cacheHead next.prev is set").when(er.cacheHead.next.prev).is(M.aTruthy);
                    assert("after update cacheHead next.prev on B").when(er.cacheHead.next.prev.id).is('B');
                    assert("after update cacheHead next.next is set").when(er.cacheHead.next.next).is(M.aTruthy);
                    assert("after update cacheHead next.next on C").when(er.cacheHead.next.next.id).is('C');
                    assert("after update cacheHead next.next.prev is set").when(er.cacheHead.next.next.prev).is(M.aTruthy);
                    assert("after update cacheHead next.next.prev on A").when(er.cacheHead.next.next.prev.id).is('A');
                    assert("right keys").when(extractMruKeys(er)).is('B,A,C');
                });
                it('should properly expunge exceeding elements form the mru', function () {
                    var er = Db(WithProps);
                    assert("Initial cacheHead is null").when(er.cacheHead).is(M.aFalsey);
                    assert("Initial cache is empty").when(er.cache).is(M.objectMatchingStrictly({}));
                    er.get('E');
                    er.get('D');
                    er.get('C');
                    er.get('B');
                    er.get('A');
                    assert("right keys").when(extractMruKeys(er)).is('A,B,C,D,E');
                    er.get('2');
                    assert("expunged one").when(extractMruKeys(er)).is('2,A,B,C,D');
                    er.get('C');
                    assert("raised one").when(extractMruKeys(er)).is('C,2,A,B,D');
                    er.get('1');
                    er.get('0');
                    assert("expunged two").when(extractMruKeys(er)).is('0,1,C,2,A');
                });
            });
            describe('Loaded data cache >', function () {
                it('should not load again a root entity in cache', function () {
                    var _this = this;
                    this.timeout(6000);
                    var wp1 = Db(WithProps).get('wp1');
                    Db(wp1).expiresAfter = 1000;
                    return Db(wp1).load(this).then(function () {
                        assert('Loaded correctly').when(wp1.str).is('String 1');
                        wp1Fb.update({ str: 'str' });
                        return Db(wp1).load(_this);
                    }).then(function () {
                        assert('Kept the old data').when(wp1.str).is('String 1');
                        return new Promise(function (res, rej) { return setTimeout(res, 2000); });
                    }).then(function () {
                        return Db(wp1).load(_this);
                    }).then(function () {
                        assert('Updated the data').when(wp1.str).is('str');
                    });
                });
                it('should load again a root entity with reload', function () {
                    var wp1 = Db(WithProps).get('wp1');
                    return Db(wp1).load(_this).then(function () {
                        assert('Loaded correctly').when(wp1.str).is('String 1');
                        wp1Fb.update({ str: 'str' });
                        return Db(wp1).reload(_this);
                    }).then(function () {
                        assert('Updated the data').when(wp1.str).is('str');
                    });
                });
                it('should not load again an observable in cache', function () {
                    var _this = this;
                    this.timeout(6000);
                    var wp1 = Db(WithProps).get('wp1');
                    Db(wp1).expiresAfter = 1000;
                    return Db(wp1.num).load(this).then(function (ed) {
                        assert('Loaded correctly').when(wp1.num).is(200);
                        wp1Fb.update({ num: 54321 });
                        return Db(wp1.num).load(_this);
                    }).then(function (ed) {
                        assert('Kept the old data').when(wp1.num).is(200);
                        return new Promise(function (res, rej) { return setTimeout(res, 2000); });
                    }).then(function () {
                        return Db(wp1.num).load(_this);
                    }).then(function () {
                        assert('Updated the data').when(wp1.num).is(54321);
                    });
                });
            });
        });
        describe('Bugs >', function () {
            it('should not wipe out collections on a reference', function () {
                var cp2 = Db(Complex).get('cp2');
                var cp3 = new Complex();
                return Db(cp2).load(_this).then(function () {
                    Db(cp3).assignUrl();
                    cp3.cross = cp2.cross;
                    return Db(cp3).save();
                }).then(function () {
                    cp3.cross.str = 'ciao';
                    return Db(cp3.cross).save();
                }).then(function () {
                    return new Promise(function (res) {
                        cp1Fb.on("value", res);
                    });
                }).then(function (ds) {
                    var val = ds.val();
                    assert("Collection still there").when(val['embedList']).is(M.anObject);
                    assert("String changed").when(val['str']).is('ciao');
                });
            });
            it('should not wipe out references in referenced entities', function () {
                var wr7 = Db(WithRef).get('wr7');
                var wr6 = null;
                return Db(wr7).load(_this).then(function () {
                    wr6 = wr7.cross;
                    wr6.str = 'ciao';
                    return Db(wr6).save();
                }).then(function () {
                    return new Promise(function (res) { wr6Fb.on('value', res); });
                }).then(function (ds) {
                    var val = ds.val();
                    assert("String changed").when(val['str']).is('ciao');
                    assert("Reference still there").when(val['cross']).is(M.aTruthy);
                });
            });
        });
    });
});

//# sourceMappingURL=Db3Tests.js.map
