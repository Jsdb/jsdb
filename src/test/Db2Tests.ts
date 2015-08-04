/// <reference path="../../typings/tsd.d.ts" />


import Db = require('../main/Db2');
import Firebase = require('firebase');
import M = require('tsMatchers');

var baseUrl :string = "https://swashp.firebaseio.com/test2/"

var lastLocalCallArgs :IArguments = null;

class WithProps extends Db.Entity {
	_local :number = 1;
	str :string = 'useless';
	num :number = 0;
	arr :number[] = [];
	subobj = {
		substr : ''
	}
	
	localCall() {
		lastLocalCallArgs = arguments;
		return 'localCallAck';
	}
}

class ServerWithProps extends WithProps {
	serverStuff :string;
}

class SubEntity extends Db.Entity {
	str :string;
}

class ServerSubEntity extends SubEntity {
	serverStuff :string;
}


class OthSubEntity extends Db.Entity {
	_sub :SubEntity;
	_ref :WithProps;
	_parent :any;
	num :number;
}

class WithSubentity extends Db.Entity {
	sub = Db.embedded(SubEntity);
	str :string;
}

class ServerWithSubentity extends WithSubentity {
	sub = Db.embedded(ServerSubEntity);
}

class WithRef extends Db.Entity {
	ref = Db.reference(WithProps);
	othSubRef = Db.reference(SubEntity);
	str :string;
}

class ServerWithRef extends WithRef {
	ref = Db.reference(ServerWithProps);
	othSubRef = Db.reference(ServerSubEntity);
}

class WithCollections extends Db.Entity {
	list = Db.list(SubEntity);
	mainRefList = Db.list(Db.referenceBuilder(WithProps));
}

class WithPreloads extends Db.Entity {
	oth = Db.embedded(OthSubEntity,Db.bind('sub','_sub',true).bind('ref','_ref',true).bind('this','_parent',false));
	sub = Db.embedded(SubEntity);
	ref = Db.reference(WithProps);
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

class TestDb extends Db {
	withProps = Db.entityRoot(WithProps);
	withSubs = Db.entityRoot(WithSubentity);
	withRefs = Db.entityRoot(WithRef);
	withCols = Db.entityRoot(WithCollections);
	withPre = Db.entityRoot(WithPreloads);
	withHooks = Db.entityRoot(WithHooks);
	
	constructor() {
		super(baseUrl);
		super.init();
	}
}

class ServerTestDb extends TestDb {
	withProps = Db.entityRoot(ServerWithProps);
	withRefs = Db.entityRoot(ServerWithRef);
	withSubs = Db.entityRoot(ServerWithSubentity);
	
	constructor() {
		super();
		super.init();
	}

}

var defDb = new TestDb();
var serDb = new ServerTestDb();

describe('Db2 Tests', () => {
	var wpFb :Firebase;
	var wp1Fb :Firebase;
	var wp2Fb :Firebase;
	
	var wsFb :Firebase;
	var ws1Fb :Firebase;
	var ws2Fb :Firebase;

	var wrFb :Firebase;
	var wr1Fb :Firebase;
	var wr2Fb :Firebase;
	
	var wcFb :Firebase;
	var wc1Fb :Firebase;
	var wc2Fb :Firebase;
	
	var wplFb :Firebase;
	var wpl1Fb :Firebase;
	var wpl2Fb :Firebase;
	
	var whFb :Firebase;
	var wh1Fb :Firebase;
	
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
		
		wp2Fb = wpFb.child('wp2');
		opcnt++;
		wp2Fb.set({
			str: 'String 2',
			num: 300,
			arr: [2,3,4],
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
			othSubRef : {
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
			mainRefList : [
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
		root.on('value', () => {});
		
		opCnter();
	});

	it('should pre-init an entity',() => {
		var wp1 = defDb.withProps.load('wp1');
		M.assert("Inited entity").when(wp1).is(M.aTruthy);
		var wp2 = defDb.withProps.load('wp1');
		M.assert("Same instance").when(wp2).is(M.exactly(wp1));
		
		M.assert("Has right url").when(wp1.load.getUrl()).is(baseUrl + 'withProps/wp1');
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
	
	it('should load reference to other entities sub references', (done) => {
		var wr1 = defDb.withRefs.load('wr1');
		
		wr1.then((det) => {
			M.assert("Loaded the ref").when(wr1.othSubRef.value).is(M.aTruthy);
			M.assert("Loaded the ref").when(wr1.othSubRef.value).is(M.instanceOf(SubEntity));
			wr1.othSubRef.value.then((sdet) => {
				M.assert("Resolved the ref").when(wr1.othSubRef.value.str).is("Sub String 1");
				done();
			});
		});

	});
	
	it('should create correct server side method call payload', () => {
		var wr1 = defDb.withRefs.load('wr1');
		var wc1 = defDb.withCols.load('wc1');
		
		var pld = defDb['createServerMethodCall'].call(defDb, wr1, 'method', ['a', 1, {generic:'object'}, new WithProps(), wc1]);
		M.assert("Right payload").when(pld).is(M.objectMatchingStrictly({
			entityUrl: wr1.load.getUrl(),
			method: 'method',
			args: 
				[
					'a',
					1,
					{ generic:'object' },
					{
						arr: [],
						num: 0,
						str: 'useless',
						subobj: {
							substr: ''
						}
					},
					{_ref:wc1.load.getUrl()}
				]
		}));
	});
	
	it('should execute server side method calls', () => {
		var wc1 = defDb.withCols.load('wc1');
		
		var pyl = {
			entityUrl : baseUrl + "withProps/wp1",
			method: 'localCall',
			args:
				[
					'a',
					1,
					{ generic:'object' },
					{
						arr: [],
						num: 0,
						str: 'useless',
						subobj: {
							substr: ''
						}
					},
					{_ref:wc1.load.getUrl()}
				]
		};
		
		var ret = defDb.executeServerMethod(pyl);
		M.assert('Returned the method return').when(ret).is('localCallAck');
		M.assert('Call params are right').when(lastLocalCallArgs[0]).is('a');
		M.assert('Call params are right').when(lastLocalCallArgs[1]).is(1);
		M.assert('Call params are right').when(lastLocalCallArgs[2]).is(M.objectMatching({ generic:'object' }));
		M.assert('Call params are right').when(lastLocalCallArgs[3]).is(M.objectMatching(
			{
				arr: [],
				num: 0,
				str: 'useless',
				subobj: {
					substr: ''
				}
			}
		));
		M.assert('Call params are right').when(lastLocalCallArgs[4]).is(M.instanceOf(WithCollections));
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
	
	// access to list value array
	it('should work correctly with the "then" on a list',(done) => {
		var wc1 = defDb.withCols.load('wc1');
		
		var dets :Db.internal.IEventDetails<SubEntity>[] = [];
		wc1.list.then(() => {
			M.assert("Loaded all elements").when(wc1.list.value).is(M.withLength(3));
			for (var i = 0; i < wc1.list.value.length; i++) {
				M.assert("Right type").when(wc1.list.value[i]).is(M.instanceOf(SubEntity));
				M.assert("Right deserialization").when(wc1.list.value[i].str).is("Sub" + (i+1));
			}
			done();
		});

	});
	
	// TODO test map

	// collections of references
	it('should handle a list of references',(done) => {
		var wc1 = defDb.withCols.load('wc1');
		
		var dets :Db.internal.IEventDetails<Db.internal.ReferenceImpl<WithProps>>[] = [];
		wc1.mainRefList.add.on(this, (det) => {
			//console.log("Received event",det);
			if (det.listEnd) {
				det.offMe();
				M.assert("Loaded all elements").when(dets).is(M.withLength(2));
				var proms :Thenable<any>[] = [];
				for (var i = 0; i < dets.length; i++) {
					M.assert("Right type").when(dets[i].payload).is(M.instanceOf(Db.internal.ReferenceImpl));
					M.assert("Right url").when(dets[i].payload.url).is(wpFb.toString() + "/wp" + (i+1));
					M.assert("Right instantiation").when(dets[i].payload.value).is(M.instanceOf(WithProps));
					proms.push(dets[i].payload.then());
				}
				// TODO Resolve all and check values 
				done();
			} else {
				dets.push(det);
			}
		});

	});

	// basic query on entityRoots
	it('should perform query on entity roots',(done) => {
		var query = defDb.withProps.query().sortOn('num').equals(300);
		var dets :Db.internal.IEventDetails<WithProps>[] = [];
		query.add.on(this, (det) => {
			if (det.listEnd) {
				M.assert("Found only one element").when(dets).is(M.withLength(1));
				M.assert("Found right entity").when(dets[0].payload).is(M.objectMatching({
					str: 'String 2',
					num: 300,
					arr: [2,3,4],
					subobj: {
						substr: 'Sub String'
					}
				}));
				done();
			} else {
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
	it('should bind and keep live on subentity and parent', (done) => {
		var wpl1 = defDb.withPre.load('wpl1');
		
		wpl1.oth.then(() => {
			M.assert("Loaded the subentity").when(wpl1.sub.str).is('abc');
			M.assert("Inited the bound").when(wpl1.oth._sub).is(M.aTruthy);
			M.assert("Bound the subentity").when(wpl1.oth._sub.str).is('abc');
			M.assert("Bound parent").when(wpl1.oth._parent).is(M.exactly(wpl1));
			var fbsub = new Firebase(wpl1.sub.load.getUrl());
			fbsub.update({str:'cde'},function(ds) {
				M.assert("Updated the subentity").when(wpl1.oth._sub.str).is('cde');
				done();
			});
		});
	});

	// update live when a reference pointer is changed
	it('should bind and keep live on reference pointer', (done) => {
		var wpl1 = defDb.withPre.load('wpl1');
		
		wpl1.oth.then(() => {
			M.assert("Loaded the ref").when(wpl1.ref.value).is(M.aTruthy);
			M.assert("Inited the bound").when(wpl1.oth._ref).is(M.aTruthy);
			M.assert("Bound the subentity").when(wpl1.oth._ref.str).is('String 1');
			var fbsub = new Firebase((<Db.internal.EntityEvent<any>>wpl1.ref.load).url);
			fbsub.update({_ref:wp2Fb.toString()},function(ds) {
				M.assert("Updated the reference pointer").when(wpl1.oth._ref.str).is('String 2');
				done();
			});
		});

	});
		
	it('should bind and keep live on referenced entity', (done) => {
		var wpl1 = defDb.withPre.load('wpl1');
		
		wpl1.oth.then(() => {
			M.assert("Loaded the ref").when(wpl1.ref.value).is(M.aTruthy);
			M.assert("Inited the bound").when(wpl1.oth._ref).is(M.aTruthy);
			M.assert("Bound the subentity").when(wpl1.oth._ref.str).is('String 1');
			var fbsub = new Firebase(wpl1.ref.url);
			fbsub.update({str:'cde'},function(ds) {
				M.assert("Updated the subentity").when(wpl1.oth._ref.str).is('cde');
				done();
			});
		});
	});
	
	it('should honour postLoad', (done) => {
		var wh1 = defDb.withHooks.load('wh1');
		M.assert("Postload not yet called").when(wh1._postLoadCalled).is(false);
		M.assert("Postupdate not yet called").when(wh1._postUpdateCalled).is(false);
		wh1.then((det)=> {
			M.assert("Postload called").when(wh1._postLoadCalled).is(true);
			M.assert("Postupdate called").when(wh1._postUpdateCalled).is(true);
			done();
		});
	});
	
	
	// TODO more tests on queries
	
	// TODO query on collections
	
	// TODO read projections
	
	// Serialization, simple
	it('should serialize basic entity correctly', () => {
		var wp = new WithProps();
		wp._local = 5;
		wp.num = 1;
		wp.str = 'abc';
		wp.arr = [1];
		wp.subobj.substr = 'cde';
		
		var ret = Db.Utils.entitySerialize(wp);
		M.assert("Serialization is correct").when(ret).is(M.objectMatchingStrictly({
			num:1,
			str:'abc',
			arr:[1],
			subobj:{substr:'cde'}
		}));
		
	});
	
	it('should serialize correctly sub entities', () => {
		var ws = new WithSubentity();
		ws.str = 'abc';
		var ss = new SubEntity();
		ws.sub = ss;
		ss.str = 'cde';
		
		var ret = Db.Utils.entitySerialize(ws);
		M.assert("Serialization is correct").when(ret).is(M.objectMatchingStrictly({
			str:'abc',
			sub:{str:'cde'}
		}));
	});
	
	it('should honour custom serialize', () => {
		var ss = new SubEntity();
		ss.str = 'cde';
		ss.serialize = () => {
			return { mystr: 'aaa' };
		};
		var ret = Db.Utils.entitySerialize(ss);
		M.assert("Serialization is correct").when(ret).is(M.objectMatchingStrictly({
			mystr:'aaa'
		}));
	});
	
	it('should honour given fields in serialization', () => {
		var wp = new WithProps();
		wp.num = 1;
		wp.str = 'abc';
		wp.arr = [1];
		wp.subobj.substr = 'cde';
		
		var ret = Db.Utils.entitySerialize(wp, ['num','str']);
		M.assert("Serialization is correct").when(ret).is(M.objectMatchingStrictly({
			num: 1,
			str:'abc'
		}));
	});
	
	// write data on existing entity
	it('should update an entity', (done) => {
		var wp1 = defDb.withProps.load('wp1');
		wp1
		.then(() => {
			console.log("Saving");
			wp1.num = 1000;
			wp1.str = 'Updated';
			wp1.arr = [7,8,9];
			wp1.subobj.substr = 'Sub updated';
			//return wp1.save();
			wp1.save();
		})
		.then(() => {
			console.log("Checking");
			wp1Fb.once('value',(ds) => {
				M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
					num : 1000,
					str: 'Updated',
					arr: [7,8,9],
					subobj: { substr : 'Sub updated' }
				}));
				done();
			});
		});
		;
	});
	
	it('should assign right url to a new entity mapped on root', () => {
		var wp = new WithProps();
		defDb.assignUrl(wp);
		M.assert("Assigned right url").when(wp.load.getUrl()).is(M.stringContaining(wpFb.toString()));
	});
	
	it('should throw error an a new entity not mapped on root', () => {
		var wp = new SubEntity();
		var excp = null;
		try {
			defDb.assignUrl(wp);
		} catch (e) {
			excp = e;
		}
		M.assert("Exception thrown").when(excp).is(M.aTruthy);
	});
	
	// write new entity
	it('should save a new entity',(done) => {
		var wp = new WithProps();
		wp.str = 'abcd';
		wp.num = 555;
		wp.arr = [89,72];
		wp.subobj.substr = 'eeee';
		defDb.save(wp).then(() => {
			var url = wp.load.getUrl();
			new Firebase(url).once('value',(ds) => {
				M.assert("New entity saved correctly").when(ds.val()).is(M.objectMatching({
					str: 'abcd',
					num: 555,
					arr: [89,72],
					subobj:{substr:'eeee'}
				}));
				done();
			});
			
		});
	});
	
	it('should trow exception if saving new entity not from db', () => {
		var wp = new WithProps();
		var excp = null;
		try {
			wp.save();
		} catch (e) {
			excp = e;
		}
		M.assert("Exception thrown").when(excp).is(M.aTruthy);
	});
	
	// write entity in entity, as full object
	it('should serialize correctly sub entities', (done) => {
		var ws = new WithSubentity();
		ws.str = 'abc';
		var ss = new SubEntity();
		ws.sub = ss;
		ss.str = 'cde';
		
		defDb.save(ws).then(() => {
			new Firebase(ws.load.getUrl()).once('value', (ds) => {
				M.assert("Serialized correctly").when(ds.val()).is(M.objectMatching({
					str:'abc',
					sub:{str:'cde'}
				}));
				done();
			});
		});
	});

	// write reference
	it('should write a reference correctly', (done) => {
		var wp1 = defDb.withProps.load('wp1');
		var url = wp1.load.getUrl();
		var wrn = new WithRef();
		wrn.str = 'abc';
		wrn.ref.value = wp1; 
		defDb.save(wrn).then(() => {
			new Firebase(wrn.load.getUrl()).once('value', (ds) => {
				M.assert("Serialized correctly").when(ds.val()).is(M.objectMatching({
					str:'abc',
					ref:{_ref:url}
				}));
				done();
			});
		});
	});
	
	// client/server differences
	it('should properly load root entity for server',(done) => {
		var wp1 = serDb.withProps.load('wp1');
		wp1.then((det) => {
			M.assert('Right type').when(wp1).is(M.instanceOf(ServerWithProps));
			M.assert('Data loaded').when(wp1).is(M.objectMatching({
				str: 'String 1',
				num: 200,
				arr: [1,2,3],
				subobj: {
					substr: 'Sub String'
				}
			}));
			done();
		});
	});
	
	it('should load sub entities for server',(done) => {
		var ws1 = serDb.withSubs.load('ws1');
		ws1.then((det) => {
			M.assert("Right type").when(ws1.sub).is(M.instanceOf(ServerSubEntity));
			M.assert("Loaded main").when(ws1.str).is('String 1');
			M.assert("Loaded subentity").when(ws1.sub.str).is('Sub String 1');
			done();
		});
	});

	it('should load sub entites reference withOUT the main one for server', (done) => {
		var wr1 = serDb.withRefs.load('wr2');
		
		wr1.ref.then((det) => {
			M.assert("Loaded the ref").when(wr1.ref.value).is(M.aTruthy);
			M.assert("Loaded the ref").when(wr1.ref.value).is(M.instanceOf(ServerWithProps));
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

	
	it('should load reference to other entities sub references for server', (done) => {
		var wr1 = serDb.withRefs.load('wr1');
		
		wr1.then((det) => {
			M.assert("Loaded the ref").when(wr1.othSubRef.value).is(M.aTruthy);
			M.assert("Loaded the ref").when(wr1.othSubRef.value).is(M.instanceOf(ServerSubEntity));
			wr1.othSubRef.value.then((sdet) => {
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

