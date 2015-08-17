/// <reference path="../../typings/tsd.d.ts" />


import Db3 = require('../main/Db3');
import Firebase = require('firebase');
import M = require('tsMatchers');
import assert = M.assert;

var baseUrl :string = "https://swashp.firebaseio.com/test3/"

var Db = Db3.configure({baseUrl:baseUrl});

var lastLocalCallArgs :IArguments = null;

@Db3.root('withProps')
class WithProps {
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

class SubEntity {
	str :string;
	getSomething() {
		return "something";
	}
}

class SubEntityOth extends SubEntity {
	otherData = 1;
	getSomething() {
		return "something else";
	}
}

class SubEntityDiscriminator implements Db3.Discriminator {
	discriminate(val :any) :Db3.EntityType<any> {
		if (val.type == 'oth') return SubEntityOth;
		return SubEntity;
	}
	decorate(entity :Db3.Entity, val :any) {
		delete val.type
		if (entity instanceof SubEntityOth) {
			val.type = 'oth';
		}
	}
}

class ServerSubEntity extends SubEntity {
	serverStuff :string;
}


class OthSubEntity {
	_sub :SubEntity;
	_ref :WithProps;
	_parent :any;
	num :number;
}

@Db3.root('withSubs')
class WithSubentity {
	@Db3.embedded(SubEntityDiscriminator)
	sub :SubEntity; 
	
	@Db3.embedded(WithSubentity)
	nested :WithSubentity;
	
	str :string = null;
}

class ServerWithSubentity extends WithSubentity {
	@Db3.embedded(ServerSubEntity)
	sub :ServerSubEntity; 
}

@Db3.root('withRefs')
class WithRef {
	@Db3.reference(WithProps)
	ref :WithProps;
	@Db3.reference(SubEntity) 
	othSubRef :SubEntity;
	str :string;
}

class ServerWithRef extends WithRef {
	@Db3.reference(ServerWithProps)
	ref :ServerWithProps;
	@Db3.reference(ServerSubEntity)
	othSubRef :ServerSubEntity;
}

@Db3.root('withPre')
class WithPreloads {
	@Db3.embedded(OthSubEntity,Db3.bind('sub','_sub',true).bind('ref','_ref',true).bind('this','_parent',false))
	oth :OthSubEntity;
	
	@Db3.embedded(SubEntity)
	sub :SubEntity;
	
	@Db3.reference(WithProps)
	ref :WithProps;
}


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

describe('Db3 >', () => {
	var root :Firebase;
	
	var wpFb :Firebase;
	var wp1Fb :Firebase;
	var wp2Fb :Firebase;
	
	var wsFb :Firebase;
	var ws1Fb :Firebase;
	var ws2Fb :Firebase;
	var ws3Fb :Firebase;
	var ws4Fb :Firebase;

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
	
	var rooton;
	var progr = 0;
	
	beforeEach(function (done) {
		//console.log("before starts");
		this.timeout(100000);
		
		// TODO reenable this
		Db().reset();
		
		var opcnt = 1;
		function opCnter() { 
			opcnt--
			//console.log('Dones ' + opcnt);
			if (opcnt == 0) done(); 
		};
		
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
					type: 'oth'
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
			othSubRef : {
				_ref: ws1Fb.toString() + '/sub/'
			}
		}, opCnter);

		wr2Fb = wrFb.child('wr2');
		opcnt++;
		wr2Fb.set({
			str: 'String 1',
			ref: {
				_ref: wp1Fb.toString() + '/'
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
		var myp = progr++;
		rooton = root.on('value', () => { /*console.log('ch ' + myp);*/ });
		//console.log("before ends");
		opCnter();
	});
	
	describe('Metadata >', ()=>{
		it('should detect WithSubentity class',()=> {
			var allmeta = Db3.Internal.getAllMetadata();
			var clmeta = allmeta.findMeta(WithSubentity);
			assert('has right url').when(clmeta.root).is('withSubs');
			
			var wpmeta = clmeta.descriptors['sub'];
			assert('class meta has sub property').when(wpmeta).is(M.aTruthy);
			assert('the meta is right').when(wpmeta).is(M.objectMatching({
				localName: 'sub',
				remoteName: M.aFalsey,
				ctor: M.aTruthy,
				discr: M.instanceOf(SubEntityDiscriminator)
			}));
		});
		
		it('should intercept metadata thru getters', () => {
			var we = new WithSubentity();
			var sub = we.sub;
			
			var lastEntity = Db3.Internal.getLastEntity();
			var lastPath = Db3.Internal.getLastMetaPath();
			
			assert("right last entity on length=1").when(lastEntity).is(M.exactly(we));
			assert("right path length on length=1").when(lastPath).is(M.withLength(1));
			assert("right path on length=1").when(lastPath[0]).is(M.objectMatching({
				localName: 'sub'
			}));
			
			Db3.Internal.clearLastStack();
			
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
		
		it("doesn't create problems with getters and setters", () => {
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
			for (var k in e2) ks.push(k);
			//assert("the created __property for meta getters is not visible").when(ks).is(M.not(M.arrayContaining('__sub')));
			assert("the meta getter is visible property").when(ks).is(M.arrayContaining('sub'));
		});
		
		it("builds correct simple event path", () => {
			var ws1 = Db(WithSubentity).load('ws1');
			var ge = <Db3.Internal.GenericEvent><any>Db(ws1.sub);
			assert("returned a generic event").when(ge).is(M.aTruthy);
			var state = ge.state;
			var ws1event = ge.state.cache[baseUrl + 'withSubs/ws1/'];
			assert("found state for main entity").when(ws1event).is(M.aTruthy);
			assert("it's parent is the right one").when(ge.parent).is(M.exactly(ws1event));
			assert("it has the right url").when(ge.getUrl()).is(baseUrl + 'withSubs/ws1/sub/');
			assert("it's right type").when(ge).is(M.instanceOf(Db3.Internal.EntityEvent));
		});
		
		it("avoids getting confused with other calls to getters", () => {
			var wr1 = Db(WithRef).load('wr1');
			var ge = Db(wr1.ref);
			var a = wr1.ref;
			var b = wr1.ref;
			var ge2 = Db(wr1.ref);
			assert("Didn't got confused by repetitive calls").when(ge).is(M.exactly(ge2));
			
			var wr1e = Db(wr1);
			assert("Didn't got confused by subsequent entity only call").when(wr1e).is(M.not(M.exactly(<any>ge2)));
			assert("Returned the right event").when(wr1e.getUrl()).is(baseUrl + 'withRefs/wr1/');
			
			var wp2 = Db(WithProps).load('wp2');
			var ge = Db(wr1.ref);
			var a = wr1.ref;
			var wp2e = Db(wp2);
			assert("Didn't got confused by subsequent entity only call with right type but different instance")
				.when(ge).is(M.not(M.exactly(<any>wp2e)));

		});
		
		// TODO implement the .props property to clean any ambiguity
		
	});
	
	describe('Entity reading >', ()=>{
		it('should return an entity root', () => {
			var er = Db(WithProps);
			assert("returned an entity root").when(er).is(M.objectMatching({load: M.aFunction}));
			assert("root has right url").when(er.getUrl()).is(baseUrl + 'withProps/');
		});
		
		it('should pre-init an entity',() => {
			var er = Db(WithProps);
			var wp1 = er.load('wp1');
			M.assert("Inited entity").when(wp1).is(M.aTruthy);
			var wp2 = er.load('wp1');
			M.assert("Same instance").when(wp2).is(M.exactly(wp1));
			
			M.assert("Has right url").when(Db(wp1).getUrl()).is(baseUrl + 'withProps/wp1/');
		});
		
		it('should load simple entities', (done) => {
			var wp1 = Db(WithProps).load('wp1');
			Db(wp1).load(this)
			.then((det) => {
				M.assert('Data loaded').when(wp1).is(M.objectMatching({
					str: 'String 1',
					num: 200,
					arr: [1,2,3],
					subobj: {
						substr: 'Sub String'
					}
				}));
				return 1;
			})
			.then((n) => {
				M.assert('Chained correctly').when(n).is(1);
				done();
			});
		});
		
		it('should load more times if needed', (done) => {
			// Introduce lag on purpose
			root.off('value', rooton);
			
			var cnt = 0;
			function lastLoad() {
				var wp1 = Db(WithProps).load('wp1');
				Db(wp1).load(this).then((det) => {
					cnt++;
					if (cnt == 4) done();
				});
			}
			setTimeout(() => {
				var wp1 = Db(WithProps).load('wp1');
				Db(wp1).load(this).then((det) => {
					cnt++;
					lastLoad();
				});
				var wp12 = Db(WithProps).load('wp1');
				Db(wp12).updated(this,(det) => {
					cnt++;
					lastLoad();
					det.offMe();
				});
			}, 10);
		});
		
		it('should update data',(done) => {
			var wp1 = Db(WithProps).load('wp1');
			var times = 0;
			Db(wp1).updated(this, (det)=> {
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

		describe('Embeddeds >', ()=>{
			it('should load sub entities with the main one',() => {
				var ws1 = Db(WithSubentity).load('ws1');
				return Db(ws1).load(this).then((det) => {
					M.assert("Loaded main").when(ws1.str).is('String 1');
					M.assert("Sub has right type").when(ws1.sub).is(M.instanceOf(SubEntity));
					M.assert("Loaded subentity").when(ws1.sub.str).is('Sub String 1');
				});
			});
			
			it('should load sub sub entities with the main one',() => {
				var ws1 = Db(WithSubentity).load('ws3');
				return Db(ws1).load(this).then((det) => {
					M.assert("Loaded main").when(ws1.str).is('String 3');
					M.assert("Nested has right type").when(ws1.nested).is(M.instanceOf(WithSubentity));
					M.assert("Loaded subentity").when(ws1.nested.str).is('Sub String 3');
					M.assert("Sub has right type").when(ws1.nested.sub).is(M.instanceOf(SubEntity));
					M.assert("Loaded subsubentity").when(ws1.nested.sub.str).is('Sub Sub String 3');
				});
			});
			
			it('should load sub sub entities discriminating the type',() => {
				var ws1 = Db(WithSubentity).load('ws3');
				return Db(ws1).load(this).then((det) => {
					M.assert("Sub has right type").when(ws1.nested.sub).is(M.instanceOf(SubEntityOth));
					M.assert("Loaded subsubentity").when(ws1.nested.sub.str).is('Sub Sub String 3');
				});
			});
		
			it('should load sub entities withOUT the main one',() => {
				var ws2 = Db(WithSubentity).load('ws2');
				return Db(ws2.sub).load(this).then((det) => {
					M.assert("NOT Loaded main").when(ws2.str).is(M.aFalsey);
					M.assert("Sub has right type").when(ws2.sub).is(M.instanceOf(SubEntity));
					M.assert("Loaded subentity").when(ws2.sub.str).is('Sub String 1');
				});
			});
			
			it('should handle null sub entities when loading withOUT the main one',() => {
				var ws4 = Db(WithSubentity).load('ws4');
				return Db(ws4.sub).load(this).then((det) => {
					M.assert("NOT Loaded main").when(ws4.str).is(M.aFalsey);
					M.assert("Loaded subentity").when(ws4.sub).is(M.exactly(null));
				});
			});
			
			// TODO load embeddeds by direct urls
		});
		
		describe('References >', ()=> {
			it('should dereference a reference', () => {
				var wr1 = Db(WithRef).load('wr1');
				var refevent = <Db3.Internal.ReferenceEvent<any>>Db(wr1.ref);
				return refevent.dereference(this).then((det) => {
					M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
					M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
					M.assert("Right event").when(refevent).is(M.objectMatching({
						nameOnParent: 'ref',
					}));
					M.assert("Right url for ref").when(refevent.getReferencedUrl()).is(baseUrl + 'withProps/wp1/');
				});
			});
			
			it('should notify of referencing', (done) => {
				var wr1 = Db(WithRef).load('wr1');
				var refevent = <Db3.Internal.ReferenceEvent<any>>Db(wr1.ref);
				var cnt = 0;
				var wp1 = null;
				refevent.referenced(this, (det) => {
					cnt++;
					if (cnt == 1) {
						M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
						M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
						wp1 = wr1.ref;
						M.assert("Right url for ref").when(refevent.getReferencedUrl()).is(baseUrl + 'withProps/wp1/');
						wr1Fb.child('ref/_ref').set(baseUrl + 'withProps/wp2/');
					} else if (cnt == 2) {
						M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
						M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
						M.assert("Right url for ref").when(refevent.getReferencedUrl()).is(baseUrl + 'withProps/wp2/');
						M.assert("Changed the entity").when(wr1.ref).is(M.not(M.exactly(wp1)));
						det.offMe();
						done();
					}
				});
			});
			
			it('should load sub entites reference with the main one', () => {
				var wr1 = Db(WithRef).load('wr1');
				
				return Db(wr1).load(this).then((det) => {
					M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
					M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
					// At this point, the reference is loaded but the internal entity is not, which is right
					var refd = wr1.ref;
					Db();
					M.assert("Right url for ref").when(Db(refd).getUrl()).is(baseUrl + 'withProps/wp1/');
				});
			});
		
			it('should load sub entites reference withOUT the main one', () => {
				var wr1 = Db(WithRef).load('wr2');
				
				return Db(wr1.ref).load(this).then((det) => {
					M.assert("Loaded the ref").when(wr1.ref).is(M.aTruthy);
					M.assert("Right type for ref").when(wr1.ref).is(M.instanceOf(WithProps));
					M.assert("Loaded the ref data").when(wr1.ref).is(M.objectMatching({
						str: 'String 1',
						num: 200,
						arr: [1,2,3],
						subobj: {
							substr: 'Sub String'
						}
					}));
					M.assert("Didn't load the main one").when(wr1.str).is(M.undefinedValue);
				});
			});
			
			it('should load reference to other entities sub references', () => {
				var wr1 = Db(WithRef).load('wr1');
				
				return Db(wr1.othSubRef).load(this).then((det) => {
					M.assert("Loaded the ref").when(wr1.othSubRef).is(M.aTruthy);
					M.assert("Right type for ref").when(wr1.othSubRef).is(M.instanceOf(SubEntity));
					M.assert("Resolved the ref").when(wr1.othSubRef.str).is("Sub String 1");
				});
			});
		});
		
		describe('Binding >', () => {
			it('should bind and keep live on subentity and parent', () => {
				var wpl1 = Db(WithPreloads).load('wpl1');
				
				return Db(wpl1.oth).load(this).then(() => {
					M.assert("Inited the subentity").when(wpl1.sub).is(M.aTruthy);
					M.assert("Loaded the subentity").when(wpl1.sub.str).is('abc');
					M.assert("Inited the bound").when(wpl1.oth._sub).is(M.aTruthy);
					M.assert("Bound the subentity").when(wpl1.oth._sub.str).is('abc');
					M.assert("Bound parent").when(wpl1.oth._parent).is(M.exactly(wpl1));
				}).then(() => {
					var fbsub = new Firebase(Db(wpl1.sub).getUrl());
					return new Promise((ok) => {
						fbsub.update({str:'cde'},ok);
					});
				}).then(() => {
					M.assert("Updated the subentity").when(wpl1.oth._sub.str).is('cde');
				});
			});

			// update live when a reference pointer is changed
			it('should bind and keep live on reference pointer', () => {
				var wpl1 = Db(WithPreloads).load('wpl1');
				
				return Db(wpl1.oth).load(this).then(() => {
					M.assert("Loaded the ref").when(wpl1.ref).is(M.aTruthy);
					M.assert("Inited the bound").when(wpl1.oth._ref).is(M.aTruthy);
					M.assert("Bound the subentity").when(wpl1.oth._ref.str).is('String 1');
				}).then(() => {
					var fbsub = new Firebase(Db(wpl1.ref).getUrl());
					return new Promise((ok) => {
						fbsub.update({_ref:wp2Fb.toString()},ok);
					});
				}).then(() => {
					M.assert("Updated the reference pointer").when(wpl1.oth._ref.str).is('String 2');
				});
		
			});
			
			it('should bind and keep live on referenced entity', () => {
				var wpl1 = Db(WithPreloads).load('wpl1');
				
				return Db(wpl1.oth).load(this).then(() => {
					M.assert("Loaded the ref").when(wpl1.ref).is(M.aTruthy);
					M.assert("Inited the bound").when(wpl1.oth._ref).is(M.aTruthy);
					M.assert("Bound the subentity").when(wpl1.oth._ref.str).is('String 1');
					var fbsub = new Firebase(Db(wpl1.ref).getReferencedUrl());
					return new Promise((ok)=> {
						fbsub.update({str:'cde'},ok);
					});
				}).then(()=>{
					M.assert("Updated the subentity").when(wpl1.oth._ref.str).is('cde');
				});
			});
		});
	});
	describe('Entity writing >', ()=>{
		describe('Serialization >', ()=>{
			it('should serialize basic entity correctly', () => {
				var wp = new WithProps();
				wp._local = 5;
				wp.num = 1;
				wp.str = 'abc';
				wp.arr = [1];
				wp.subobj.substr = 'cde';
				
				var ee = <Db3.Internal.GenericEvent><any>Db(wp);
				M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatchingStrictly({
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
				
				var ee = <Db3.Internal.GenericEvent><any>Db(ws);
				M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatchingStrictly({
					str:'abc',
					sub:{str:'cde'}
				}));
			});
			
			it('should serialize correctly lcoalsOnly without sub entities', () => {
				var ws = new WithSubentity();
				ws.str = 'abc';
				var ss = new SubEntity();
				ws.sub = ss;
				ss.str = 'cde';
				
				var ee = <Db3.Internal.GenericEvent><any>Db(ws);
				M.assert("Serialization is correct").when(ee.serialize(true)).is(M.objectMatchingStrictly({
					str:'abc'
				}));
			});
			
			it('should serialize correctly polimorphic sub entities', () => {
				var ws = new WithSubentity();
				ws.str = 'abc';
				var ss = new SubEntityOth();
				ws.sub = ss;
				ss.str = 'cde';
				
				var ee = <Db3.Internal.GenericEvent><any>Db(ws);
				M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatchingStrictly({
					str:'abc',
					sub:{
						str:'cde',
						type: 'oth'
					}
				}));
			});
			
			it('should honour custom serialize', () => {
				var ss = new SubEntity();
				ss.str = 'cde';
				(<any>ss).serialize = () => {
					return { mystr: 'aaa' };
				};
				var ee = <Db3.Internal.GenericEvent><any>Db(ss);
				M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatchingStrictly({
					mystr:'aaa'
				}));
			});
			
			it('should serialize correctly references', () => {
				var wr = new WithRef();
				var wp1 = Db(WithProps).load('wp1');
				wr.ref = wp1;
				
				var ee = <Db3.Internal.GenericEvent><any>Db(wr);
				M.assert("Serialization is correct").when(ee.serialize()).is(M.objectMatching({
					ref: {
						_ref: baseUrl + 'withProps/wp1/'
					}
				}));
			});
		});
		
		describe('Saving new >', ()=> {

			it('should assign right url to a new entity mapped on root', () => {
				var wp = new WithProps();
				Db(wp).assignUrl();
				M.assert("Assigned right url").when(Db(wp).getUrl()).is(M.stringContaining(wpFb.toString()));
			});
			
			it('should throw error an a new entity not mapped on root', () => {
				var wp = new SubEntity();
				var excp = null;
				try {
					Db(wp).assignUrl();
				} catch (e) {
					excp = e;
				}
				M.assert("Exception thrown").when(excp).is(M.aTruthy);
			});
			
			// write new entity
			it('should save a new entity',() => {
				var wp = new WithProps();
				wp.str = 'abcd';
				wp.num = 555;
				wp.arr = [89,72];
				wp.subobj.substr = 'eeee';
				return Db(wp).save()
				.then(() => {
					return new Promise((ok)=> {
						var url = Db(wp).getUrl();
						new Firebase(url).once('value',ok);
					});
				})
				.then((ds:FirebaseDataSnapshot) => {
					M.assert("New entity saved correctly").when(ds.val()).is(M.objectMatching({
						str: 'abcd',
						num: 555,
						arr: [89,72],
						subobj:{substr:'eeee'}
					}));
				});
			});
			
			// write entity in entity, as full object
			it('should save correctly sub entities', () => {
				var ws = new WithSubentity();
				ws.str = 'abc';
				var ss = new SubEntity();
				ws.sub = ss;
				ss.str = 'cde';
				
				return Db(ws).save()
				.then(() => {
					return new Promise((ok)=>{
						new Firebase(Db(ws).getUrl()).once('value', ok);
					});
				})
				.then((ds:FirebaseDataSnapshot) => {
					M.assert("Serialized correctly").when(ds.val()).is(M.objectMatching({
						str:'abc',
						sub:{str:'cde'}
					}));
				});
			});
		
			// write reference
			it('should save a reference correctly', () => {
				var wp1 = Db(WithProps).load('wp1');
				var url = Db(wp1).getUrl();
				var wrn = new WithRef();
				wrn.str = 'abc';
				wrn.ref = wp1; 
				return Db(wrn).save()
				.then(() => {
					return new Promise((ok)=>{
						new Firebase(Db(wrn).getUrl()).once('value', ok);
					});
				})
				.then((ds :FirebaseDataSnapshot) => {
					M.assert("Serialized correctly").when(ds.val()).is(M.objectMatching({
						str:'abc',
						ref:{_ref:url}
					}));
				});
			});
			
		});
		
		describe('Updating >', ()=>{
			it('should update an entity', () => {
				var wp1 = Db(WithProps).load('wp1');
				return Db(wp1).load(this)
				.then(() => {
					wp1.num = 1000;
					wp1.str = 'Updated';
					wp1.arr = [7,8,9];
					wp1.subobj.substr = 'Sub updated';
					//return wp1.save();
					return Db(wp1).save();
				})
				.then(() => {
					return new Promise((ok) => {
						wp1Fb.once('value',ok);
					});
				})
				.then((ds :FirebaseDataSnapshot) => {
					M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
						num : 1000,
						str: 'Updated',
						arr: [7,8,9],
						subobj: { substr : 'Sub updated' }
					}));
				});
			});
			
			it('should correctly update partially loaded entity', ()=>{
				var ws1 = Db(WithSubentity).load('ws2');
				ws1.str = 'saved';
				return Db(ws1.sub).load(this)
				.then(()=>{
					ws1.sub.str = 'this is saved too';
					return Db(ws1).save();
				})
				.then(()=>{
					return new Promise((ok) => {
						ws2Fb.once('value',ok);
					});
				})
				.then((ds :FirebaseDataSnapshot) => {
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
			
			it('should support swapping sub entities', ()=>{
				var ws1 = Db(WithSubentity).load('ws2');
				return Db(ws1).load(this)
				.then(()=>{
					var nsub = new SubEntity();
					nsub.str = 'new sub';
					ws1.sub = nsub;
					return Db(ws1).save();
				})
				.then(()=>{
					return new Promise((ok) => {
						ws2Fb.once('value',ok);
					});
				})
				.then((ds :FirebaseDataSnapshot) => {
					M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
						str: 'String 1',
						sub: {
							str: 'new sub'
						},
					}));
				});
			});
			
			it('should support swapping polimorphic sub entities', ()=>{
				var ws1 = Db(WithSubentity).load('ws2');
				return Db(ws1).load(this)
				.then(()=>{
					var nsub = new SubEntityOth();
					nsub.str = 'new sub';
					ws1.sub = nsub;
					return Db(ws1).save();
				})
				.then(()=>{
					return new Promise((ok) => {
						ws2Fb.once('value',ok);
					});
				})
				.then((ds :FirebaseDataSnapshot) => {
					M.assert('Updated correctly').when(ds.val()).is(M.objectMatching({
						str: 'String 1',
						sub: {
							str: 'new sub',
							otherData:1,
							type: 'oth'
						},
					}));
				});
			});
			
		});
	});

});

