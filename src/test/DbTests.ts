/// <reference path="../../typings/tsd.d.ts" />


//declare var MockFirebase;

import Db = require('../main/Db');
import Firebase = require('firebase');
import M = require('tsMatchers');
/*
interface Firebase {
	flush();
}
*/


class InvoiceCoords extends Db.ObjD {
	vatCode :string;
	streetAddress :string;
}

class Company extends Db.ObjC {
	events = {
		invoice : Db.data(InvoiceCoords)
	}
}

class UserAnagraphics extends Db.ObjD {
	name :string;
	surname :string;
	company :Company;
}

class UserAddress extends Db.ObjD {
	email :string;
	priority :number;
}

class User extends Db.ObjC {
	events = {
		anagraphics : Db.data(UserAnagraphics),
		bestFriend : Db.reference(User).named('best'),
		//addresses : new Db.ListEvent<UserAddress>('addresses').objD(UserAddress),
		addresses : Db.dataList(UserAddress),
		prioAddress : Db.dataList(UserAddress).named('addresses').sortOn('priority'),
		previousCompanies : Db.referenceList(Company).named('prevComps'),
		logicId : Db.num()
	}
}

var u = new User();


var baseUrl :string = "https://swashp.firebaseio.com/test"
Db.def.register(baseUrl + "/users/", User); 
Db.def.register(baseUrl + "/companies/", Company); 

describe('Db Tests', () => {
	describe('Reading', () => {
		var compsFb :Firebase;
		var usersFb :Firebase;
		var c1Fb :Firebase;
		var u1Fb :Firebase;
		var u2Fb :Firebase;
		var u :User;
		beforeEach(function (done) {
			this.timeout(10000);
			//console.log("Starting before each");
			var opcnt = 1;
			function opCnter() { 
				opcnt--
				//console.log('Dones ' + opcnt);
				if (opcnt == 0) done(); 
			};
			
			var root = new Firebase(baseUrl);
			root.remove();
			
			compsFb = new Firebase(baseUrl + '/companies');
			c1Fb = compsFb.child('c1');
			opcnt++;
			c1Fb.set({
				invoice: {
					vatCode:'1234567890',
					streetAddress:'nowhere'
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
				addresses: {
					a00 : {
						email: 'simoneg@apache.org',
						priority: 2
					},
					a01 : {
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
			root.on('value', () => {});
			
			u = Db.def.load(baseUrl + '/users/u1');
			M.assert('User is not null').when(u).is(M.aTruthy);
			M.assert('User has right url').when(u.url).is(baseUrl + "/users/u1");
			opCnter();
		});
		it('should read user C and D',(done) => {
			var anag :UserAnagraphics = null;
			u.events.anagraphics.once(this, (a, first)=>{
				anag = a;
				M.assert('User anagraphic loaded').when(anag).is(M.either(M.aTruthy).and(M.objectMatching({name:'Simone',surname:'Gianni'})));
				M.assert('User anagraphic right type').when(anag).is(M.instanceOf(UserAnagraphics));
				done();
			});
		});
		it('should update D',() => {
			var anag :UserAnagraphics = null;
			u.events.anagraphics.on(this, (a, first)=>{
				anag = a;
			});
			
			var preAnag = anag;
			u1Fb.child('anagraphics').set({
					name: 'Simona',
					surname: 'Gianna'
			});
			
			M.assert('User anagraphic loaded').when(anag).is(M.either(M.aTruthy).and(M.objectMatching({name:'Simona',surname:'Gianna'})));
			M.assert('Anagraphic is not the same').when(anag).is(M.not(M.exactly(preAnag)));
		});
		it('should return same C', ()=> {
			var u2 :User = Db.def.load(baseUrl + '/users/u1');
			M.assert('Returned same instance of user').when(u2).is(M.exactly(u));
		});
		it('should deference simple refs', (done)=> {
			var friend :User = null;
			u.events.bestFriend.once(this, (u, first)=>{
				friend = u;
				M.assert('friend found').when(friend).is(M.aTruthy);
				M.assert('friend right type').when(friend).is(M.instanceOf(User));
				M.assert('friend is right one').when(friend.url).is(baseUrl + '/users/u2');
				done();
			});
			
		});
		it('should dereference composed refs', (done)=> {
			var u2 :User = Db.def.load(baseUrl + '/users/u2');
			
			var friend :User = null;
			u2.events.bestFriend.once(this, (u, first)=>{
				friend = u;
				M.assert('friend found').when(friend).is(M.aTruthy);
				M.assert('friend right type').when(friend).is(M.instanceOf(User));
				M.assert('friend is right one').when(friend.url).is(baseUrl + '/users/u1');
				done();
			});
			
		});
		it('should dereference refs nexted in ObjC', (done)=> {
			var u3 :User = Db.def.load(baseUrl + '/users/u3');
			
			var anag :UserAnagraphics = null;
			u3.events.anagraphics.once(this, (a, first)=>{
				anag = a;
				M.assert('company is right instance').when(anag.company).is(M.instanceOf(Company));
				M.assert('company has right url').when(anag.company.url).is(baseUrl + "/companies/c1");
				done();
			});
			
		});
		it('should consider projections first', () => {
			var u3 :User = Db.def.load(baseUrl + '/users/u3');
			
			var friend :User = null;
			u3.events.bestFriend.on(this, (u, first)=>{
				friend = u;
			});
			
			M.assert('friend found').when(friend).is(M.aTruthy);
			M.assert('friend right type').when(friend).is(M.instanceOf(User));
			M.assert('friend is right one').when(friend.url).is(baseUrl + '/users/u4');
			
			var anags = [];
			friend.events.anagraphics.on(this, (a, first)=> {
				anags.push(a);
			});
			
			M.assert('User anagraphic loaded').when(anags[0]).is(M.aTruthy);
			M.assert('User projection').when(anags[0]).is(M.objectMatching({name:'Mimmi',surname:'Gianni'}));
		});
		it('should notify list of D and end of list', (done) => {
			var adds :Db.internal.IEventDetails<UserAddress>[] = [];
			u.events.addresses.add.on(this, (a,det)=> {
				adds.push(det);
			});
			M.assert('Notified all the addresses').when(adds).is(M.withLength(3));
			M.assert('First event details is correct').when(adds[0]).is(M.objectMatching({
				payload: {
					email: 'simoneg@apache.org'
				},
				populating : true,
				listEnd : false,
				originalEvent : 'child_added',
				originalUrl : baseUrl + '/users/u1/addresses/a00',
				originalKey : 'a00'
			}));
			M.assert('Second event details is correct').when(adds[1]).is(M.objectMatching({
				payload: {
					email: 's.gianni@semeru.it'
				},
				populating : true,
				listEnd : false,
				originalEvent : 'child_added',
				originalUrl : baseUrl + '/users/u1/addresses/a01',
				originalKey : 'a01',
				precedingKey : 'a00'
			}));
			M.assert('Last one is only listEnd').when(adds[2]).is(M.objectMatching({
				payload: null,
				populating : false,
				listEnd : true,
				originalEvent : null,
				originalUrl : null,
				originalKey : null,
				precedingKey : null
			}));
			done();
		});
		
		it('should parse correctly a list of Cs', (done) => {
			var comps :Db.internal.IEventDetails<Company>[] = [];
			u.events.previousCompanies.add.on(this, (c, det)=> {
				comps.push(det);
			});
			M.assert('Notified all the addresses').when(comps).is(M.withLength(3));
			M.assert('First event details is correct').when(comps[0]).is(M.objectMatching({
				payload: M.either(M.instanceOf(Company)).and(M.objectMatching({url: baseUrl + '/companies/c1'})),
				populating : true,
				originalKey : 'a00'
			}));
			M.assert('Second event details is correct').when(comps[1]).is(M.objectMatching({
				payload: M.either(M.instanceOf(Company)).and(M.objectMatching({url: baseUrl + '/companies/c2'})),
				populating : true,
				originalKey : 'a01',
				precedingKey : 'a00'
			}));
			M.assert('Last one is only listEnd').when(comps[2]).is(M.objectMatching({
				payload: null,
				listEnd : true,
			}));
			done();
		});
		
		it('should sort the list of Ds', (done) => {
			var adds :Db.internal.IEventDetails<UserAddress>[] = [];
			u.events.prioAddress.add.on(this, (a,det)=> {
				adds.push(det);
			});
			M.assert('Notified all the addresses').when(adds).is(M.withLength(3));
			M.assert('First event details is correct').when(adds[0]).is(M.objectMatching({
				payload: {
					email: 's.gianni@semeru.it'
				},
				populating : true,
				originalKey : 'a01'
			}));
			M.assert('Second event details is correct').when(adds[1]).is(M.objectMatching({
				payload: {
					email: 'simoneg@apache.org'
				},
				populating : true,
				originalKey : 'a00',
				precedingKey : 'a01'
			}));
			M.assert('Last one is only listEnd').when(adds[2]).is(M.objectMatching({
				payload: null,
				listEnd : true,
			}));
			done();
		});
		it('should work on subqueries', (done) => {
			var adds :Db.internal.IEventDetails<UserAddress>[] = [];
			var ne = u.events.addresses.subQuery().sortOn('priority');
			ne.add.on(this, (a,det)=> {
				adds.push(det);
			});
			M.assert('Notified all the addresses').when(adds).is(M.withLength(3));
			M.assert('First event details is correct').when(adds[0]).is(M.objectMatching({
				originalKey : 'a01'
			}));
			M.assert('Second event details is correct').when(adds[1]).is(M.objectMatching({
				originalKey : 'a00',
			}));
			done();
		});
		it('should limit the list of Ds', (done) => {
			var adds :Db.internal.IEventDetails<UserAddress>[] = [];
			var ne = u.events.addresses.subQuery().limit(1);
			ne.add.on(this, (a,det)=> {
				adds.push(det);
			});
			M.assert('Notified all the addresses').when(adds).is(M.withLength(2));
			M.assert('First event details is correct').when(adds[0]).is(M.objectMatching({
				originalKey : 'a00'
			}));
			M.assert('Last one is only listEnd').when(adds[1]).is(M.objectMatching({
				payload: null,
				listEnd : true,
			}));
			done();
		});
		
		// TODO more testing on queries
		// TODO delocalized queries (queries that pertain to this object, but are on a different url, based on current ObjC data
		
		it('should serialize objDs correctly', (done) => {
			var anag :UserAnagraphics = null;
			u.events.anagraphics.on(this, (a, first)=>{
				anag = a;
			});
			
			M.assert("Basic objD serialized correctly").when(anag.serialize()).is(M.objectMatchingStrictly(
				{
					name:'Simone',
					surname:'Gianni'
				}
			));
			done();
		});
		
		it('should serialize objDs with references correctly', (done) => {
			var u3 :User = Db.def.load(baseUrl + '/users/u3');
			
			var anag :UserAnagraphics = null;
			u3.events.anagraphics.on(this, (a, first)=>{
				anag = a;
			});
			
			M.assert("objD with ref serialized correctly").when(anag.serialize()).is(M.objectMatchingStrictly(
				{
					name:'Massimo',
					surname:'Guidi',
					company: {
						_ref: baseUrl + '/companies/c1'
					}
				}
			));
			done();

		});

		it('should generate valid an unique ids', function(done) {
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
			var intH = setInterval(() => {
				checkRnd();
				checkRnd();
				if (cnt > iterations) {
					clearInterval(intH);
					done();
				}
			}, 1);
		});
		
		it('should serialize objCs without an URL and generate proper id and url', (done) => {
			// A new company or example
			var anag = new UserAnagraphics();
			anag.name = 'New';
			anag.surname = 'Anag';
			anag.company = new Company();
			
			var url = Db.def.computeUrl(anag.company);
			M.assert('The new url is correct').when(url).is(M.stringContaining(baseUrl + '/companies/'));
			
			var ser = anag.serialize(Db.def);
			M.assert("objD with ref serialized correctly").when(anag.serialize()).is(M.objectMatchingStrictly(
				{
					name:'New',
					surname:'Anag',
					company: {
						_ref: M.stringContaining(baseUrl + '/companies/')
					}
				}
			));
			done();
		});
		
		it('should save an objD with broadcast', (done) => {
			var anag :UserAnagraphics = null;
			var evtCnt = 0;
			u.events.anagraphics.on(this, (a, det) => {
				//console.log("fired with", a);
				if (anag == null) {
					anag = a;
					evtCnt++; 
				} else {
					det.offMe();
					evtCnt++; 
					M.assert("Changed the name").when(a.name).is('Sempronio');
				}
				check();
			});
			
			var rawCnt = 0;
			var refFb = new Firebase(baseUrl + '/users/u1/anagraphics');
			var rawFb = refFb.on('value', (ds) => {
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
			u.events.anagraphics.broadcast(anag);
		});
		
		it('should add a new ObjD to set', (done) => {
			var adds :Db.internal.IEventDetails<UserAddress>[] = [];
			u.events.addresses.add.on(this, (a,det)=> {
				adds.push(det);
			});
			M.assert('Notified all the addresses').when(adds).is(M.withLength(3));
			
			// clean pre-existing
			adds.splice(0,adds.length);
			
			var naddr = new UserAddress();
			naddr.email = 'altro@boh.it';
			u.events.addresses.add.broadcast(naddr);
			
			M.assert('Notified new address').when(adds).is(M.withLength(1));
			M.assert('Notified new address is right').when(adds[0]).is(M.objectMatching({
				payload: M.either(M.not(M.exactly(naddr))).and(M.instanceOf(UserAddress)),
				originalKey: M.either(M.aString).and(M.withLength(22))
			}));
			
			done();
		});
		

		it('should update an existing ObjD to the set', (done) => {
			
		});
		
		// Remove from collection
		
		// Collection of references
		
		// Collection of base values
		
		
		// Save C with projections (find a way to express projections)
		/*
		it('should remove firebase hooks when no more listeners', (done) => {
			// TODO
			
		});
		*/
	})
});
