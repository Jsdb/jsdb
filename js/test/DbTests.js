/// <reference path="../../typings/tsd.d.ts" />
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var _this = this;
//declare var MockFirebase;
var Db = require('../main/Db');
var Firebase = require('firebase');
var M = require('tsMatchers');
/*
interface Firebase {
    flush();
}
*/
var UserQuota = (function (_super) {
    __extends(UserQuota, _super);
    function UserQuota() {
        _super.apply(this, arguments);
        this.maxMessages = 100;
        this.maxInvoices = 10;
    }
    return UserQuota;
})(Db.Data);
var UserPolicy = (function (_super) {
    __extends(UserPolicy, _super);
    function UserPolicy() {
        _super.apply(this, arguments);
        this.quota = Db.data(UserQuota);
    }
    return UserPolicy;
})(Db.Entity);
var UserFolder = (function (_super) {
    __extends(UserFolder, _super);
    function UserFolder() {
        _super.apply(this, arguments);
        this.usedMessages = 0;
        this.usedInvoices = 0;
    }
    UserFolder.prototype.getAvailableMessage = function () {
        return this._quotas.maxMessages - this.usedMessages;
    };
    return UserFolder;
})(Db.Data);
var InvoiceCoords = (function (_super) {
    __extends(InvoiceCoords, _super);
    function InvoiceCoords() {
        _super.apply(this, arguments);
    }
    return InvoiceCoords;
})(Db.Data);
var Company = (function (_super) {
    __extends(Company, _super);
    function Company() {
        _super.apply(this, arguments);
        this.invoice = Db.data(InvoiceCoords);
    }
    return Company;
})(Db.Entity);
var UserAnagraphics = (function (_super) {
    __extends(UserAnagraphics, _super);
    function UserAnagraphics() {
        _super.apply(this, arguments);
    }
    return UserAnagraphics;
})(Db.Data);
var UserAddress = (function (_super) {
    __extends(UserAddress, _super);
    function UserAddress() {
        _super.apply(this, arguments);
    }
    return UserAddress;
})(Db.Data);
var User = (function (_super) {
    __extends(User, _super);
    function User() {
        _super.apply(this, arguments);
        this.anagraphics = Db.data(UserAnagraphics);
        this.policy = Db.reference(UserPolicy);
        this.folder = Db.data(UserFolder).preLoad({ _quotas: 'policy.quota' });
        this.bestFriend = new Db.internal.ValueEvent().named('best');
        //addresses : new Db.ListEvent<UserAddress>('addresses').objD(UserAddress),
        this.addresses = Db.dataList(UserAddress);
        this.prioAddress = Db.dataList(UserAddress).named('addresses').sortOn('priority');
        this.previousCompanies = Db.referenceList(Company).named('prevComps');
        this.logicId = Db.num();
    }
    return User;
})(Db.Entity);
var baseUrl = "https://swashp.firebaseio.com/test";
var TestDb = (function (_super) {
    __extends(TestDb, _super);
    function TestDb() {
        _super.call(this);
        this.users = Db.entityRoot(User);
        this.companies = Db.entityRoot(Company);
        this.policies = Db.entityRoot(UserPolicy);
        this.baseUrl = baseUrl;
    }
    return TestDb;
})(Db);
var defDb = new TestDb();
var u = new User();
describe('Db Tests', function () {
    var compsFb;
    var usersFb;
    var c1Fb;
    var u1Fb;
    var u2Fb;
    var u;
    beforeEach(function (done) {
        this.timeout(100000);
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
        compsFb = new Firebase(baseUrl + '/companies');
        c1Fb = compsFb.child('c1');
        opcnt++;
        c1Fb.set({
            invoice: {
                vatCode: '1234567890',
                streetAddress: 'nowhere'
            }
        }, opCnter);
        var polsFb = new Firebase(baseUrl + '/policies');
        opcnt++;
        polsFb.child('po1').set({
            quota: {
                maxMessages: 20,
                maxInvoices: 10
            }
        }, opCnter);
        usersFb = new Firebase(baseUrl + '/users');
        u1Fb = usersFb.child('u1');
        opcnt++;
        u1Fb.set({
            anagraphics: {
                name: 'Simone',
                surname: 'Gianni'
            },
            best: baseUrl + '/users/u2',
            policy: baseUrl + '/policies/po1',
            folder: {
                usedMessages: 5,
                usedInvoices: 10
            },
            addresses: {
                a00: {
                    email: 'simoneg@apache.org',
                    priority: 2
                },
                a01: {
                    email: 's.gianni@semeru.it',
                    priority: 1
                }
            },
            prevComps: {
                a00: baseUrl + '/companies/c1',
                a01: baseUrl + '/companies/c2',
            }
        }, opCnter);
        u2Fb = usersFb.child('u2');
        opcnt++;
        u2Fb.set({
            anagraphics: {
                name: 'Giulio',
                surname: 'Chidini'
            },
            best: {
                _ref: baseUrl + '/users/u1'
            }
        }, opCnter);
        var u3Fb = usersFb.child('u3');
        opcnt++;
        u3Fb.set({
            anagraphics: {
                name: 'Massimo',
                surname: 'Guidi',
                company: {
                    _ref: baseUrl + '/companies/c1'
                }
            },
            best: {
                _ref: baseUrl + '/users/u4',
                anagraphics: {
                    name: 'Mimmi',
                    surname: 'Gianni'
                }
            }
        }, opCnter);
        // Keep reference alive in ram, faster tests and less side effects
        root.on('value', function () { });
        u = defDb.load(baseUrl + '/users/u1');
        M.assert('User is not null').when(u).is(M.aTruthy);
        M.assert('User has right url').when(u.url).is(baseUrl + "/users/u1");
        opCnter();
    });
    // TODO nested Data objects
    it('should read user C and D', function (done) {
        var anag = null;
        u.anagraphics.once(_this, function (a, first) {
            anag = a;
            M.assert('User anagraphic loaded').when(anag).is(M.either(M.aTruthy).and(M.objectMatching({ name: 'Simone', surname: 'Gianni' })));
            M.assert('User anagraphic right type').when(anag).is(M.instanceOf(UserAnagraphics));
            done();
        });
    });
    it('should update D', function () {
        var anag = null;
        u.anagraphics.on(_this, function (a, first) {
            anag = a;
        });
        var preAnag = anag;
        u1Fb.child('anagraphics').set({
            name: 'Simona',
            surname: 'Gianna'
        });
        M.assert('User anagraphic loaded').when(anag).is(M.either(M.aTruthy).and(M.objectMatching({ name: 'Simona', surname: 'Gianna' })));
        M.assert('Anagraphic is not the same').when(anag).is(M.not(M.exactly(preAnag)));
    });
    it('should return same C', function () {
        var u2 = defDb.load(baseUrl + '/users/u1');
        M.assert('Returned same instance of user').when(u2).is(M.exactly(u));
    });
    it('should deference simple refs', function (done) {
        var friend = null;
        u.bestFriend.once(_this, function (u, first) {
            friend = u;
            M.assert('friend found').when(friend).is(M.aTruthy);
            M.assert('friend right type').when(friend).is(M.instanceOf(User));
            M.assert('friend is right one').when(friend.url).is(baseUrl + '/users/u2');
            done();
        });
    });
    it('should dereference composed refs', function (done) {
        var u2 = defDb.load(baseUrl + '/users/u2');
        var friend = null;
        u2.bestFriend.once(_this, function (u, first) {
            friend = u;
            M.assert('friend found').when(friend).is(M.aTruthy);
            M.assert('friend right type').when(friend).is(M.instanceOf(User));
            M.assert('friend is right one').when(friend.url).is(baseUrl + '/users/u1');
            done();
        });
    });
    it('should dereference refs nexted in ObjC', function (done) {
        var u3 = defDb.load(baseUrl + '/users/u3');
        var anag = null;
        u3.anagraphics.once(_this, function (a, first) {
            anag = a;
            M.assert('company is right instance').when(anag.company).is(M.instanceOf(Company));
            M.assert('company has right url').when(anag.company.url).is(baseUrl + "/companies/c1");
            done();
        });
    });
    it('should consider projections first', function () {
        var u3 = defDb.load(baseUrl + '/users/u3');
        var friend = null;
        u3.bestFriend.on(_this, function (u, first) {
            friend = u;
        });
        M.assert('friend found').when(friend).is(M.aTruthy);
        M.assert('friend right type').when(friend).is(M.instanceOf(User));
        M.assert('friend is right one').when(friend.url).is(baseUrl + '/users/u4');
        var anags = [];
        friend.anagraphics.on(_this, function (a, first) {
            anags.push(a);
        });
        M.assert('User anagraphic loaded').when(anags[0]).is(M.aTruthy);
        M.assert('User projection').when(anags[0]).is(M.objectMatching({ name: 'Mimmi', surname: 'Gianni' }));
    });
    it('should notify list of D and end of list', function (done) {
        var adds = [];
        u.addresses.add.on(_this, function (a, det) {
            adds.push(det);
        });
        M.assert('Notified all the addresses').when(adds).is(M.withLength(3));
        M.assert('First event details is correct').when(adds[0]).is(M.objectMatching({
            payload: {
                email: 'simoneg@apache.org'
            },
            populating: true,
            listEnd: false,
            originalEvent: 'child_added',
            originalUrl: baseUrl + '/users/u1/addresses/a00',
            originalKey: 'a00'
        }));
        M.assert('Second event details is correct').when(adds[1]).is(M.objectMatching({
            payload: {
                email: 's.gianni@semeru.it'
            },
            populating: true,
            listEnd: false,
            originalEvent: 'child_added',
            originalUrl: baseUrl + '/users/u1/addresses/a01',
            originalKey: 'a01',
            precedingKey: 'a00'
        }));
        M.assert('Last one is only listEnd').when(adds[2]).is(M.objectMatching({
            payload: null,
            populating: false,
            listEnd: true,
            originalEvent: null,
            originalUrl: null,
            originalKey: null,
            precedingKey: null
        }));
        done();
    });
    it('should notify list of D as array with full', function (done) {
        var adds = [];
        u.addresses.full.on(_this, function (a, det) {
            adds.push(det);
        });
        M.assert('Sent only once').when(adds).is(M.withLength(1));
        M.assert('Contains all elements').when(adds[0].payload).is(M.withLength(2));
        done();
    });
    it('should parse correctly a list of Cs', function (done) {
        var comps = [];
        u.previousCompanies.add.on(_this, function (c, det) {
            comps.push(det);
        });
        M.assert('Notified all the addresses').when(comps).is(M.withLength(3));
        M.assert('First event details is correct').when(comps[0]).is(M.objectMatching({
            payload: M.either(M.instanceOf(Company)).and(M.objectMatching({ url: baseUrl + '/companies/c1' })),
            populating: true,
            originalKey: 'a00'
        }));
        M.assert('Second event details is correct').when(comps[1]).is(M.objectMatching({
            payload: M.either(M.instanceOf(Company)).and(M.objectMatching({ url: baseUrl + '/companies/c2' })),
            populating: true,
            originalKey: 'a01',
            precedingKey: 'a00'
        }));
        M.assert('Last one is only listEnd').when(comps[2]).is(M.objectMatching({
            payload: null,
            listEnd: true,
        }));
        done();
    });
    it('should sort the list of Ds', function (done) {
        var adds = [];
        u.prioAddress.add.on(_this, function (a, det) {
            adds.push(det);
        });
        M.assert('Notified all the addresses').when(adds).is(M.withLength(3));
        M.assert('First event details is correct').when(adds[0]).is(M.objectMatching({
            payload: {
                email: 's.gianni@semeru.it'
            },
            populating: true,
            originalKey: 'a01'
        }));
        M.assert('Second event details is correct').when(adds[1]).is(M.objectMatching({
            payload: {
                email: 'simoneg@apache.org'
            },
            populating: true,
            originalKey: 'a00',
            precedingKey: 'a01'
        }));
        M.assert('Last one is only listEnd').when(adds[2]).is(M.objectMatching({
            payload: null,
            listEnd: true,
        }));
        done();
    });
    it('should work on subqueries', function (done) {
        var adds = [];
        var ne = u.addresses.subQuery().sortOn('priority');
        ne.add.on(_this, function (a, det) {
            adds.push(det);
        });
        M.assert('Notified all the addresses').when(adds).is(M.withLength(3));
        M.assert('First event details is correct').when(adds[0]).is(M.objectMatching({
            originalKey: 'a01'
        }));
        M.assert('Second event details is correct').when(adds[1]).is(M.objectMatching({
            originalKey: 'a00',
        }));
        done();
    });
    it('should limit the list of Ds', function (done) {
        var adds = [];
        var ne = u.addresses.subQuery().limit(1);
        ne.add.on(_this, function (a, det) {
            adds.push(det);
        });
        M.assert('Notified all the addresses').when(adds).is(M.withLength(2));
        M.assert('First event details is correct').when(adds[0]).is(M.objectMatching({
            originalKey: 'a00'
        }));
        M.assert('Last one is only listEnd').when(adds[1]).is(M.objectMatching({
            payload: null,
            listEnd: true,
        }));
        done();
    });
    // TODO more testing on queries
    // TODO delocalized queries (queries that pertain to this object, but are on a different url, based on current ObjC data
    it('should read a promise', function (done) {
        u.anagraphics
            .then(function (d) {
            M.assert('valorized').when(d).is(M.aTruthy);
            M.assert('correct name').when(d.name).is('Simone');
            return "ciao";
        })
            .then(function (s) {
            M.assert('chained').when(s).is('ciao');
            done();
        });
    });
    it('should handle multiple promises', function (done) {
        var pAnag = u.anagraphics.promise();
        var pFriend = u.bestFriend.promise();
        Promise.all([pAnag, pFriend]).then(function (vs) {
            M.assert('Both promises fullfilled').when(vs).is(M.withLength(2));
            M.assert('Got anagraphics').when(vs[0]).is(M.instanceOf(UserAnagraphics));
            M.assert('Got friend').when(vs[1]).is(M.instanceOf(User));
            done();
        });
    });
    it('should resolve stringified promises', function (done) {
        var pFriendAnag = u.getPromise('bestFriend.anagraphics');
        pFriendAnag.then(function (fa) {
            M.assert("Loaded something").when(fa).is(M.aTruthy);
            M.assert("Is an anagraphic").when(fa).is(M.instanceOf(UserAnagraphics));
            M.assert("Is right anagraphic").when(fa).is(M.objectMatching({
                name: 'Giulio',
                surname: 'Chidini'
            }));
            done();
        });
    });
    it('should honour preload', function (done) {
        u.folder.once(_this, function (fld) {
            M.assert("loaded quota").when(fld._quotas).is(M.aTruthy);
            M.assert("Right computation").when(fld.getAvailableMessage()).is(15);
            done();
        });
    });
    it('should serialize objDs correctly', function (done) {
        var anag = null;
        u.anagraphics.on(_this, function (a, first) {
            anag = a;
        });
        M.assert("Basic objD serialized correctly").when(anag.serialize()).is(M.objectMatchingStrictly({
            name: 'Simone',
            surname: 'Gianni'
        }));
        done();
    });
    it('should serialize objDs with references correctly', function (done) {
        var u3 = defDb.load(baseUrl + '/users/u3');
        var anag = null;
        u3.anagraphics.on(_this, function (a, first) {
            anag = a;
        });
        M.assert("objD with ref serialized correctly").when(anag.serialize()).is(M.objectMatchingStrictly({
            name: 'Massimo',
            surname: 'Guidi',
            company: {
                _ref: baseUrl + '/companies/c1'
            }
        }));
        done();
    });
    it('should generate valid an unique ids', function (done) {
        var iterations = 5000;
        this.timeout(iterations * 1.5);
        var ids = {};
        var cnt = 1;
        var lst = '0';
        function checkRnd() {
            var id = Db.internal.IdGenerator.next();
            M.assert('Id is unique ' + id + ' on ' + cnt).when(ids[id]).is(M.aFalsey);
            M.assert('Id is progressive').when(id > lst).is(true);
            ids[id] = cnt++;
            lst = id;
            //console.log(id,cnt);
        }
        var intH = setInterval(function () {
            checkRnd();
            checkRnd();
            if (cnt > iterations) {
                clearInterval(intH);
                done();
            }
        }, 1);
    });
    it('should serialize objCs without an URL and generate proper id and url', function (done) {
        // A new company or example
        var anag = new UserAnagraphics();
        anag.name = 'New';
        anag.surname = 'Anag';
        anag.company = new Company();
        var url = defDb.computeUrl(anag.company);
        M.assert('The new url is correct').when(url).is(M.stringContaining(baseUrl + '/companies/'));
        var ser = anag.serialize(defDb);
        M.assert("objD with ref serialized correctly").when(anag.serialize()).is(M.objectMatchingStrictly({
            name: 'New',
            surname: 'Anag',
            company: {
                _ref: M.stringContaining(baseUrl + '/companies/')
            }
        }));
        done();
    });
    it('should save an objD with broadcast', function (done) {
        var anag = null;
        var evtCnt = 0;
        u.anagraphics.on(_this, function (a, det) {
            //console.log("fired with", a);
            if (anag == null) {
                anag = a;
                evtCnt++;
            }
            else {
                det.offMe();
                evtCnt++;
                M.assert("Changed the name").when(a.name).is('Sempronio');
            }
            check();
        });
        var rawCnt = 0;
        var refFb = new Firebase(baseUrl + '/users/u1/anagraphics');
        var rawFb = refFb.on('value', function (ds) {
            //console.log("raw fired with " + ds.ref().toString(), ds.val());
            var val = ds.val();
            if (val != null) {
                M.assert("Right name in raw event").when(val.name).is(M.either('Simone').or('Sempronio'));
            }
            rawCnt++;
            check();
        });
        function check() {
            //console.log("Check, evt " + evtCnt + "  raw " + rawCnt);
            if (evtCnt == 2 && rawCnt == 2) {
                refFb.off('value', rawFb);
                done();
            }
        }
        anag.name = "Sempronio";
        u.anagraphics.broadcast(anag);
    });
    it('should add a new ObjD to set', function (done) {
        var adds = [];
        u.addresses.add.on(_this, function (a, det) {
            adds.push(det);
        });
        M.assert('Notified all the addresses').when(adds).is(M.withLength(3));
        // clean pre-existing
        adds.splice(0, adds.length);
        var naddr = new UserAddress();
        naddr.email = 'altro@boh.it';
        u.addresses.add.broadcast(naddr);
        M.assert('Notified new address').when(adds).is(M.withLength(1));
        M.assert('Notified new address is right').when(adds[0]).is(M.objectMatching({
            payload: M.either(M.not(M.exactly(naddr))).and(M.instanceOf(UserAddress)),
            originalKey: M.either(M.aString).and(M.withLength(22))
        }));
        done();
    });
    /*
    it('should update an existing ObjD to the set', (done) => {
        
    });
    */
    // Remove from collection
    // Collection of references
    // Collection of base values
    // Save C with projections (find a way to express projections)
    /*
    it('should remove firebase hooks when no more listeners', (done) => {
        // TODO
        
    });
    */
});
