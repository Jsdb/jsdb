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
        this.othSubRef = Db.reference(SubEntity);
    }
    return WithRef;
})(Db.Entity);
var WithCollections = (function (_super) {
    __extends(WithCollections, _super);
    function WithCollections() {
        _super.apply(this, arguments);
        this.list = Db.list(SubEntity);
        this.mainRefList = Db.list(Db.referenceBuilder(WithProps));
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
        this.withCols = Db.entityRoot(WithCollections);
        _super.prototype.init.call(this);
    }
    return TestDb;
})(Db);
var defDb = new TestDb();
describe('Db Tests', function () {
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
    // TODO more tests on queries
    // TODO query on collections
    // TODO read projections
    // Serialization, simple
    it('should serialize basic entity correctly', function () {
        var wp = new WithProps();
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
    it('should update an entity', function (done) {
        var wp1 = defDb.withProps.load('wp1');
        wp1.then(function () {
            console.log("Saving");
            wp1.num = 1000;
            wp1.str = 'Updated';
            wp1.arr = [7, 8, 9];
            wp1.subobj.substr = 'Sub updated';
            //return wp1.save();
            wp1.save();
        }).then(function () {
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
    it('should assign right url to a new entity mapped on root', function () {
        var wp = new WithProps();
        defDb.assignUrl(wp);
        M.assert("Assigned right url").when(wp.load.url).is(M.stringContaining(wpFb.toString()));
    });
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
    it('should save a new entity', function (done) {
        var wp = new WithProps();
        wp.str = 'abcd';
        wp.num = 555;
        wp.arr = [89, 72];
        wp.subobj.substr = 'eeee';
        defDb.save(wp).then(function () {
            var url = wp.load.url;
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
    it('should trow exception if saving new entity not form db', function () {
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
    // TODO write entity in entity, as full object
    // TODO write reference
    // TODO write reference with projections
    // TODO write collections
    // TODO write back-projections
    // TODO preload
    // TODO cache cleaning
    // TODO move promises on events?
});
//# sourceMappingURL=Db2Tests.js.map