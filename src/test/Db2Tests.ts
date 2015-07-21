/// <reference path="../../typings/tsd.d.ts" />


import Db = require('../main/Db2');
import Firebase = require('firebase');
import M = require('tsMatchers');

var baseUrl :string = "https://swashp.firebaseio.com/test2/"

class WithProps extends Db.Entity<WithProps> {
	str :string;
	num :number;
	arr :number[];
	subobj = {
		substr : ''
	}
}

class SubEntity extends Db.Entity<SubEntity> {
	str :string;
}

class WithSubentity extends Db.Entity<WithSubentity> {
	sub = Db.embedded(SubEntity);
	str :string;
}

class WithRef extends Db.Entity<WithRef> {
	ref = Db.reference(WithProps);
	str :string;
}

class WithCollections extends Db.Entity<WithCollections> {
	list = Db.list(SubEntity);
}

class TestDb extends Db {
	withProps = Db.entityRoot(WithProps);
	withSubs = Db.entityRoot(WithSubentity);
	withRefs = Db.entityRoot(WithRef);
	withCols = Db.entityRoot(WithCollections);
	
	constructor() {
		super(baseUrl);
		super.init();
	}
}

var defDb = new TestDb();

describe('Db Tests', () => {
	var wpFb :Firebase;
	var wp1Fb :Firebase;
	
	var wsFb :Firebase;
	var ws1Fb :Firebase;
	var ws2Fb :Firebase;

	var wrFb :Firebase;
	var wr1Fb :Firebase;
	var wr2Fb :Firebase;
	
	var wcFb :Firebase;
	var wc1Fb :Firebase;
	var wc2Fb :Firebase;
	
	
	beforeEach(function (done) {
		this.timeout(100000);
		
		defDb.reset();
		
		//console.log("Starting before each");
		var opcnt = 1;
		function opCnter() { 
			opcnt--
			//console.log('Dones ' + opcnt);
			if (opcnt == 0) done(); 
		};
		
		var root = new Firebase(baseUrl);
		root.remove();
		
		wpFb = new Firebase(baseUrl + '/withProps');
		wp1Fb = wpFb.child('wp1');
		opcnt++;
		wp1Fb.set({
			str: 'String 1',
			num: 200,
			arr: [1,2,3],
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
		root.on('value', () => {});
		
		opCnter();
	});

	it('should pre-init an entity',() => {
		var wp1 = defDb.withProps.load('wp1');
		M.assert("Inited entity").when(wp1).is(M.aTruthy);
		var wp2 = defDb.withProps.load('wp1');
		M.assert("Same instance").when(wp2).is(M.exactly(wp1));
		
		M.assert("Has right url").when((<Db.internal.EntityEvent<any>>wp1.load).url).is(baseUrl + 'withProps/wp1');
	});
	
	it('should load data',(done) => {
		var wp1 = defDb.withProps.load('wp1');
		wp1.then((det) => {
			M.assert('Data loaded').when(wp1).is(M.objectMatching({
				str: 'String 1',
				num: 200,
				arr: [1,2,3],
				subobj: {
					substr: 'Sub String'
				}
			}));
			return 1;
		}).then((n) => {
			M.assert('Chained correctly').when(n).is(1);
			done();
		});
	});
	
	it('should update data',(done) => {
		var wp1 = defDb.withProps.load('wp1');
		var times = 0;
		wp1.load.on(this, (det)=> {
			if (times == 0) {
				times++;
				M.assert('First data loaded').when(wp1.str).is('String 1');
				wp1Fb.update({str:'String 2 updated'});
			} else if (times == 1) {
				times++;
				M.assert('Second data updated').when(wp1.str).is('String 2 updated');
				det.offMe();
				done();
			} else {
				M.assert("Got called too many times").when(times).is(M.lessThan(2));
			}
		});
	});
	
	it('should pre-init sub entities',() => {
		var ws1 = defDb.withSubs.load('ws1');
		
		M.assert('Inited base entity').when(ws1).is(M.aTruthy);
		M.assert('Inited sub entity').when(ws1.sub).is(M.aTruthy);
	});
	
	it('should load sub entities with the main one',(done) => {
		var ws1 = defDb.withSubs.load('ws1');
		ws1.then((det) => {
			M.assert("Loaded main").when(ws1.str).is('String 1');
			M.assert("Loaded subentity").when(ws1.sub.str).is('Sub String 1');
			done();
		});
	});

	it('should load sub entities withOUT the main one',(done) => {
		var ws2 = defDb.withSubs.load('ws2');
		ws2.sub.then((det) => {
			M.assert("NOT Loaded main").when(ws2.str).is(M.undefinedValue);
			M.assert("Loaded subentity").when(ws2.sub.str).is('Sub String 1');
			done();
		});
	});
	
	it('should load sub entites reference with the main one', (done) => {
		var wr1 = defDb.withRefs.load('wr1');
		
		wr1.then((det) => {
			M.assert("Loaded the ref").when(wr1.ref.value).is(M.aTruthy);
			M.assert("Loaded the ref").when(wr1.ref.value).is(M.instanceOf(WithProps));
			done();
		});
		
	});

	it('should load sub entites reference withOUT the main one', (done) => {
		var wr1 = defDb.withRefs.load('wr2');
		
		wr1.ref.then((det) => {
			M.assert("Loaded the ref").when(wr1.ref.value).is(M.aTruthy);
			M.assert("Loaded the ref").when(wr1.ref.value).is(M.instanceOf(WithProps));
			return wr1.ref.value.then();
		}).then(() => {
			M.assert("Loaded the ref").when(wr1.ref.value).is(M.objectMatching({
				str: 'String 1',
				num: 200,
				arr: [1,2,3],
				subobj: {
					substr: 'Sub String'
				}
			}));
			M.assert("Didn't load the main one").when(wr1.str).is(M.undefinedValue);
			done();
		});
		
	});
	
	it('should report each element in list as an add event',(done) => {
		var wc1 = defDb.withCols.load('wc1');
		
		var dets :Db.internal.IEventDetails<SubEntity>[] = [];
		wc1.list.add.on(this, (det) => {
			//console.log("Received event",det);
			if (det.listEnd) {
				M.assert("Loaded all elements").when(dets).is(M.withLength(3));
				for (var i = 0; i < dets.length; i++) {
					M.assert("Right type").when(dets[i].payload).is(M.instanceOf(SubEntity));
					M.assert("Right deserialization").when(dets[i].payload.str).is("Sub" + (i+1));
				}
				det.offMe();
				done();
			} else {
				dets.push(det);
			}
		});
		
	});
	
	it('should report new elements in list with an add event',(done) => {
		var wc1 = defDb.withCols.load('wc1');
		
		//var dets :Db.internal.IEventDetails<SubEntity>[] = [];
		var state = 0;
		wc1.list.add.on(this, (det) => {
			//console.log("Received event on state " + state,det);
			if (det.listEnd) {
				state = 1;
				wc1Fb.child('list/3').set({str:'Sub4'});
			} else {
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
	
	it('should report removal from list', (done) => {
		var wc1 = defDb.withCols.load('wc1');
		
		//var dets :Db.internal.IEventDetails<SubEntity>[] = [];
		var state = 0;
		wc1.list.remove.on(this, (det) => {
			M.assert("In right state").when(state).is(1);
			M.assert("Right type").when(det.payload).is(M.instanceOf(SubEntity));
			M.assert("Right deserialization").when(det.payload.str).is("Sub3");
			det.offMe();
			done();
		});
		wc1.list.add.on(this, (det) => {
			//console.log("Received event on state " + state,det);
			if (det.listEnd) {
				state = 1;
				det.offMe();
				wc1Fb.child('list/2').remove();
			}
		});
		
		
	});
	
	
	// TODO list change events
	
	// TODO access to list value array
	
	// TODO test map
	
	// TODO collections of references
	
	// TODO read a sub entity as reference
	// TODO right now references to other entity sub entities are not supported because the URL is not mounted on an entity root, but since the reference already has the type informations needed, it could be supported
	
	
	// TODO write data on existing entity
	
	// TODO write new entity
	
	// TODO write entity in entity, as full object
	
	// TODO read and write entity in entity, as reference
	
	// TODO write collections

	// TODO preload
	
	// TODO cache cleaning
	
	// TODO move promises on events
});
