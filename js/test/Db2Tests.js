/// <reference path="../../typings/tsd.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var _this = this;
var Db = require('../main/Db2');
var Firebase = require('firebase');
var M = require('tsMatchers');
var baseUrl = "https://swashp.firebaseio.com/test2/";
var WithProps = (function (_super) {
    __extends(WithProps, _super);
    function WithProps() {
        _super.apply(this, arguments);
        this.subobj = {
            substr: ''
        };
    }
    return WithProps;
})(Db.Entity);
var SubEntity = (function (_super) {
    __extends(SubEntity, _super);
    function SubEntity() {
        _super.apply(this, arguments);
    }
    return SubEntity;
})(Db.Entity);
var WithSubentity = (function (_super) {
    __extends(WithSubentity, _super);
    function WithSubentity() {
        _super.apply(this, arguments);
        this.sub = Db.embedded(SubEntity);
    }
    return WithSubentity;
})(Db.Entity);
var WithRef = (function (_super) {
    __extends(WithRef, _super);
    function WithRef() {
        _super.apply(this, arguments);
        this.ref = Db.reference(WithProps);
    }
    return WithRef;
})(Db.Entity);
var WithCollections = (function (_super) {
    __extends(WithCollections, _super);
    function WithCollections() {
        _super.apply(this, arguments);
    }
    return WithCollections;
})(Db.Entity);
var TestDb = (function (_super) {
    __extends(TestDb, _super);
    function TestDb() {
        _super.call(this, baseUrl);
        this.withProps = Db.entityRoot(WithProps);
        this.withSubs = Db.entityRoot(WithSubentity);
        this.withRefs = Db.entityRoot(WithRef);
        _super.prototype.init.call(this);
    }
    return TestDb;
})(Db);
var defDb = new TestDb();
describe('Db Tests', function () {
    var wpFb;
    var wp1Fb;
    var wsFb;
    var ws1Fb;
    var ws2Fb;
    var wrFb;
    var wr1Fb;
    var wr2Fb;
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
        // Keep reference alive in ram, faster tests and less side effects
        root.on('value', function () {
        });
        opCnter();
    });
    it('should pre-init an entity', function () {
        var wp1 = defDb.withProps.load('wp1');
        M.assert("Inited entity").when(wp1).is(M.aTruthy);
        var wp2 = defDb.withProps.load('wp1');
        M.assert("Same instance").when(wp2).is(M.exactly(wp1));
        M.assert("Has right url").when(wp1.load.url).is(baseUrl + 'withProps/wp1');
    });
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
    it('should pre-init sub entities', function () {
        var ws1 = defDb.withSubs.load('ws1');
        M.assert('Inited base entity').when(ws1).is(M.aTruthy);
        M.assert('Inited sub entity').when(ws1.sub).is(M.aTruthy);
    });
    it('should load sub entities with the main one', function (done) {
        var ws1 = defDb.withSubs.load('ws1');
        ws1.then(function (det) {
            M.assert("Loaded main").when(ws1.str).is('String 1');
            M.assert("Loaded subentity").when(ws1.sub.str).is('Sub String 1');
            done();
        });
    });
    it('should load sub entities withOUT the main one', function (done) {
        var ws2 = defDb.withSubs.load('ws2');
        ws2.sub.then(function (det) {
            M.assert("NOT Loaded main").when(ws2.str).is(M.undefinedValue);
            M.assert("Loaded subentity").when(ws2.sub.str).is('Sub String 1');
            done();
        });
    });
    it('should load sub entites reference with the main one', function (done) {
        var wr1 = defDb.withRefs.load('wr1');
        wr1.then(function (det) {
            M.assert("Loaded the ref").when(wr1.ref.value).is(M.aTruthy);
            M.assert("Loaded the ref").when(wr1.ref.value).is(M.instanceOf(WithProps));
            done();
        });
    });
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
    // TODO collections
    // TODO preload
    // TODO read a sub entity as reference
    // TODO right now references to other entity su entities are not supported because the URL is not mounted on an entity root, but since the reference already has the type informations needed, it could be supported
    // TODO write data on existing entity
    // TODO write new entity
    // TODO write entity in entity, as full object
    // TODO read and write entity in entity, as reference
    // TODO cache cleaning
});
//# sourceMappingURL=Db2Tests.js.map