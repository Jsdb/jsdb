import Tsdb = require('../main/Tsdb');
import Mock = require('../main/Db3Mock');
import M = require('tsMatchers');
import assert = M.assert;

var conf :Tsdb.Spi.FirebaseConf = {
	baseUrl : 'http://testing.mock/something/'
};
var mock :Mock = null;

describe('Db3Mock >', () => {
	beforeEach(function () {
		mock = Mock.create(conf);
	});
	
	describe('Basic data >', ()=>{
		describe('Reading >',()=>{
			it('Should not find root non existing data', ()=>{
				assert("Should return undefined").when(mock.getData('/node')).is(M.undefinedValue);
			});
			it('Should find root existing data', ()=>{
				mock.data['node'] = 'ciao';
				assert("Should return a string").when(mock.getData('/node')).is('ciao');
			});
			it('Should not find sub non existing data', ()=>{
				assert("Should return undefined").when(mock.getData('/node/subnode')).is(M.undefinedValue);
			});
			it('Should not find sub non existing of primitive', ()=>{
				mock.data['node'] = 'ciao';
				assert("Should return undefined").when(mock.getData('/node/subnode')).is(M.undefinedValue);
			});
			it('Should not find sub non existing of primitive', ()=>{
				mock.data['node'] = 'ciao';
				assert("Should return undefined").when(mock.getData('/node/length')).is(M.undefinedValue);
			});
			it('Should not find sub non existing leaf', ()=>{
				mock.data['node'] = {pippo:'bah'};
				assert("Should return undefined").when(mock.getData('/node/subnode')).is(M.undefinedValue);
			});
			it('Should find leaf existing data', ()=>{
				mock.data['node'] = {subnode:'ciao'};
				assert("Should return a string").when(mock.getData('/node/subnode')).is('ciao');
			});
		});
		
		describe('Writing >',()=>{
			it('Should write root primitive', ()=>{
				mock.setData('/node','ciao');
				assert("Should return string").when(mock.data['node']).is('ciao');
			});
			it('Should callback after write', (done)=>{
				mock.setData('/node','ciao',(err)=>done());
			});
			it('Should write sub primitive', ()=>{
				mock.setData('/node/sub','ciao');
				assert("Should return string").when(mock.data['node']['sub']).is('ciao');
			});
			it('Should write sub primitive with alternative url', ()=>{
				mock.setData('node/sub/','ciao');
				assert("Should return string").when(mock.data['node']['sub']).is('ciao');
			});
			it('Should write object', ()=>{
				mock.setData('/node', {sub1:'ciao',sub2:'altro'});
				assert("Should return plain object").when(mock.data['node']).is(M.objectMatching({
					sub1: 'ciao',
					sub2: 'altro'
				}));
			});
			it('Should merge subs', ()=>{
				mock.setData('/node',{sub1:'ciao'});
				mock.setData('/node/sub2','altro');
				assert("Should return merged object").when(mock.data['node']).is(M.objectMatching({
					sub1: 'ciao',
					sub2: 'altro'
				}));
			});
			it('Should overwrite subs', ()=>{
				mock.setData('/node/sub2','altro');
				mock.setData('/node',{sub1:'ciao'});
				assert("Should return merged object").when(mock.data['node']['sub2']).is(M.undefinedValue);
			});
			
			it('Should merge with update', ()=>{
				mock.setData('/node/sub2','altro');
				mock.updateData('/node',{sub1:'ciao'});
				assert("Should return merged object").when(mock.data['node']).is(M.objectMatching({
					sub1: 'ciao',
					sub2: 'altro'
				}));
			})
		});
		
		describe('Buffering >', ()=>{
			it('Buffers write', ()=>{
				mock.setData('/node/sub','ciao');
				assert("Should return the value").when(mock.data['node']['sub']).is('ciao');

				mock.buffering = true;
				mock.setData('/node/sub','altro');
				assert("Should return the old value").when(mock.data['node']['sub']).is('ciao');
				mock.flush();
				assert("Should return the new value").when(mock.data['node']['sub']).is('altro');
			});
			
			it('Callbacks after flush', (done)=>{
				mock.buffering = true;
				var called = false;
				mock.setData('/node/sub','altro',(err)=>called=true);
				assert("Should have not yet called back").when(called).is(false);
				mock.flush();
				setTimeout(()=>{
					assert("Should have called back").when(called).is(true);
					done();
				},50);
			});
		});
		
		describe('Raw events >', ()=>{
			var gn,go = null;
			var listenCb = (oldVal, newVal) => {
				gn = newVal;
				go = oldVal;
			};
			beforeEach(()=>{
				gn=go=undefined;
			});
			it('Notifies on simple node', ()=>{
				mock.setData('/node/sub','pre');
				var listener = mock.listen('/node/sub');
				listener.add(listenCb);
				mock.setData('/node/sub','ciao');
				assert("Received the old val").when(go).is('pre');
				assert("Received the new val").when(gn).is('ciao');
			});
			it('Removes callbacks', ()=>{
				mock.setData('/node/sub','pre');
				var listener = mock.listen('/node/sub');
				listener.add(listenCb);
				mock.setData('/node/sub','ciao');
				assert("Received the new val").when(gn).is('ciao');
				listener.remove(listenCb);
				mock.setData('/node/sub','more');
				assert("Didn't receive another new val").when(gn).is('ciao');
			});
			it('Notifies end ones last', (done)=>{
				mock.setData('/node/sub','pre');
				var set = false;
				var listener = mock.listen('/node/sub');
				listener.addEnd((o,n)=>{
					if (!set) return;
					assert("First listener received the new val").when(gn).is('ciao');
					done();
				});
				listener.add(listenCb);
				set = true;
				mock.setData('/node/sub','ciao');
			});
			it('Notifies on not yet existing node', ()=>{
				var listener = mock.listen('/node/sub');
				listener.add(listenCb);
				mock.setData('/node/sub','ciao');
				assert("Received the old val").when(go).is(M.undefinedValue);
				assert("Received the new val").when(gn).is('ciao');
			});
			it('Notifies on removal', ()=>{
				mock.setData('/node/sub','pre');
				var listener = mock.listen('/node/sub');
				listener.add(listenCb);
				mock.setData('/node',{});
				assert("Received the old val").when(go).is('pre');
				assert("Received the new val").when(gn).is(M.undefinedValue);
			});
			it('Notifies asap',()=>{
				mock.setData('/node/sub','pre');
				var listener = mock.listen('/node/sub');
				listener.add(listenCb);
				assert("Received the old val").when(go).is(M.undefinedValue);
				assert("Received the new val").when(gn).is('pre');
			});
			
			it('Notifies parent',()=>{
				var listener = mock.listen('/node/sub');
				listener.add(listenCb);
				mock.setData('/node/sub/sub','ciao');
				assert("Received the old val").when(go).is(M.undefinedValue);
				assert("Received the new val").when(gn).is(M.objectMatching({
					sub:'ciao'
				}));
			});
			it('Notifies parents',()=>{
				var listener = mock.listen('/node/sub');
				listener.add(listenCb);
				mock.setData('/node/sub/sub/key','ciao');
				assert("Received the old val").when(go).is(M.undefinedValue);
				assert("Received the new val").when(gn).is(M.objectMatching({
					sub:{key:'ciao'}
				}));
			});
			it('Notifies children',()=>{
				var listener = mock.listen('/node/sub/sub/key');
				listener.add(listenCb);
				mock.setData('/node/sub',{sub:{key:'ciao'}});
				assert("Received the old val").when(go).is(M.undefinedValue);
				assert("Received the new val").when(gn).is('ciao');
			});
			
		});
	});
	
	describe('Higher layer >', ()=>{
		describe('Shapshot >', ()=>{
			it('.exists should work',()=>{
				var snap = new Mock.Db3MockSnap('ciao', mock, '/test/node');
				assert('Should return true for string').when(snap.exists()).is(true);
				
				snap = new Mock.Db3MockSnap(0, mock, '/test/node');
				assert('Should return true for zero').when(snap.exists()).is(true);
								
				snap = new Mock.Db3MockSnap(null, mock, '/test/node');
				assert('Should return false for null').when(snap.exists()).is(false);
				
				snap = new Mock.Db3MockSnap(undefined, mock, '/test/node');
				assert('Should return false for undefined').when(snap.exists()).is(false);
			});
			
			it('.key should work', ()=>{
				var snap = new Mock.Db3MockSnap('ciao', mock, '/test/node');
				assert("Should return last segment").when(snap.key()).is('node');
			});
			
			it('.val should return native value', ()=>{
				var snap = new Mock.Db3MockSnap('ciao', mock, '/test/node');
				assert('Should return string').when(snap.val()).is('ciao');
				
				snap = new Mock.Db3MockSnap(0, mock, '/test/node');
				assert('Should return zero').when(snap.val()).is(0);
			});
			
			it('.val should return object',()=>{
				var snap = new Mock.Db3MockSnap({sub:{val:'ciao'}, oth:1}, mock, '/test/node');
				assert('Should return object').when(snap.val()).is(M.objectMatchingStrictly({sub:{val:'ciao'}, oth:1}));
			});
			it('.val return value is unmodifiable', ()=>{
				var snap = new Mock.Db3MockSnap({sub:{val:'ciao'}, oth:1}, mock, '/test/node');
				var val = snap.val();
				val.sub.val = 'pippo';
				var val2 = snap.val();
				assert('Should return object').when(snap.val()).is(M.objectMatchingStrictly({sub:{val:'ciao'}, oth:1}));
			});
			
			it('.child should return native direct child', ()=>{
				var snap = new Mock.Db3MockSnap({sub:{val:'ciao'}, oth:1}, mock, '/test/node');
				var child = snap.child('oth');
				assert("Should return native child").when(child.val()).is(1);
			});
			it('.child should return object direct child', ()=>{
				var snap = new Mock.Db3MockSnap({sub:{val:'ciao'}, oth:1}, mock, '/test/node');
				var child = snap.child('sub');
				assert("Should return native child").when(child.val()).is(M.objectMatchingStrictly({val:'ciao'}));
			});
			it('.child should return native grand child', ()=>{
				var snap = new Mock.Db3MockSnap({sub:{val:'ciao'}, oth:1}, mock, '/test/node');
				var child = snap.child('sub/val');
				assert("Should return native child").when(child.val()).is('ciao');
			});
			it('.child should return object grand child', ()=>{
				var snap = new Mock.Db3MockSnap({sub:{val:{inner:'ciao'}}}, mock, '/test/node');
				var child = snap.child('sub/val');
				assert("Should return native child").when(child.val()).is(M.objectMatchingStrictly({inner:'ciao'}));
			});
			
			it('.forEach cycles all children', ()=>{
				var snap = new Mock.Db3MockSnap({sub:{val:'ciao'}, oth:1}, mock, '/test/node');
				var subs :Tsdb.Spi.DbTreeSnap[] = [];
				snap.forEach((sub)=>{
					subs.push(sub);
					if (sub.key() == 'sub') {
						assert("Should return native child").when(sub.val()).is(M.objectMatchingStrictly({val:'ciao'}));
					} else if (sub.key() == 'oth') {
						assert("Should return native child").when(sub.val()).is(1);
					} else {
						assert("Should not have returned this key").when(sub.key()).is('_should not be');
					}
				});
				assert("Should cycle on two children").when(subs).is(M.withLength(2));
			});
			
			it('.forEach should stop on true', ()=>{
				var snap = new Mock.Db3MockSnap({sub:{val:'ciao'}, oth:1}, mock, '/test/node');
				var subs :Tsdb.Spi.DbTreeSnap[] = [];
				snap.forEach((sub)=>{
					subs.push(sub);
					return true;
				});
				assert("Should cycle on one child only").when(subs).is(M.withLength(1));
			});
		});
		
		describe('Value event >',()=>{
			it('Should send a value event and off it', ()=>{
				var ref = mock.getUrl('/node/data');
				var snap :Tsdb.Spi.DbTreeSnap;
				var ctx = "ciao";
				var fn = ref.on('value', (data)=>snap = data, null, ctx);
				mock.setData('/node/data','ciao');
				
				assert("Received event").when(snap).is(M.aTruthy);
				assert("Recevied event data").when(snap.val()).is('ciao');
				
				snap = null;
				ref.off('value',fn,ctx);
				mock.setData('/node/data','ciao2');
				assert("Should not receive another event").when(snap).is(M.aFalsey);
			});

			it('Should send a value event for already existing data', ()=>{
				mock.setData('/node/data','ciao');
				var ref = mock.getUrl('/node/data');
				var snap :Tsdb.Spi.DbTreeSnap;
				var fn = ref.on('value', (data)=>snap = data);
				
				assert("Received event").when(snap).is(M.aTruthy);
				assert("Recevied event data").when(snap.val()).is('ciao');
			});

			it('Should send a value event with once', ()=>{
				var ref = mock.getUrl('/node/data');
				var snap :Tsdb.Spi.DbTreeSnap;
				ref.once('value', (data)=>snap = data);
				mock.setData('/node/data','ciao');
				
				assert("Received event").when(snap).is(M.aTruthy);
				assert("Recevied event data").when(snap.val()).is('ciao');
				
				snap = null;
				mock.setData('/node/data','ciao2');
				assert("Should not receive another event").when(snap).is(M.aFalsey);
			});
			
			it('Should send a value event for outer change', ()=>{
				var ref = mock.getUrl('/node/data');
				var snap :Tsdb.Spi.DbTreeSnap;
				ref.on('value', (data)=>snap = data);
				mock.setData('/node',{pippo:'puppo', data:'ciao'});
				
				assert("Received event").when(snap).is(M.aTruthy);
				assert("Event is the second one").when(snap.exists()).is(true);
				assert("Recevied event data").when(snap.val()).is('ciao');
			});
			
			it('Should send a value event for inner changes', ()=>{
				var ref = mock.getUrl('/node');
				var snap :Tsdb.Spi.DbTreeSnap;
				ref.on('value', (data)=>snap = data);
				mock.setData('/node/data','ciao');
				
				assert("Received event").when(snap).is(M.aTruthy);
				assert("Event is the second one").when(snap.exists()).is(true);
				assert("Recevied event data").when(snap.val()).is(M.objectMatchingStrictly({data:'ciao'}));
			});
			
		});
		
		describe('Child diff events >',()=>{
			it('Should send one child_added from empty',()=>{
				var ref = mock.getUrl('/node');
				var snap :Tsdb.Spi.DbTreeSnap;
				ref.on('child_added', (data)=>snap = data);
				mock.setData('/node/data','ciao');
				
				assert("Received event").when(snap).is(M.aTruthy);
				assert("Event is the second one").when(snap.exists()).is(true);
				assert("Recevied event data").when(snap.val()).is('ciao');
				assert("Recevied event data").when(snap.key()).is('data');
			});
			
			it('Should send multiple child_added from empty',()=>{
				var ref = mock.getUrl('/node');
				var snaps :Tsdb.Spi.DbTreeSnap[] = [];
				ref.on('child_added', (data)=>snaps.push(data));
				mock.setData('/node',{data1:'ciao',data2:'riciao'});
				
				assert("Received events").when(snaps).is(M.withLength(2));
			});
			
			it('Should initial child_added from existing',()=>{
				mock.setData('/node/data','ciao');
				var ref = mock.getUrl('/node');
				var snap :Tsdb.Spi.DbTreeSnap;
				ref.on('child_added', (data)=>snap = data);
				
				assert("Received event").when(snap).is(M.aTruthy);
				assert("Event is the second one").when(snap.exists()).is(true);
				assert("Recevied event data").when(snap.val()).is('ciao');
				assert("Recevied event data").when(snap.key()).is('data');
			});
			
			it('Should send child_removed',()=>{
				mock.setData('/node/data','ciao');
				var ref = mock.getUrl('/node');
				var snap :Tsdb.Spi.DbTreeSnap;
				ref.on('child_removed', (data)=>snap = data);
				
				mock.setData('/node',{data2:'ciao'});
				
				assert("Received event").when(snap).is(M.aTruthy);
				assert("Event is the second one").when(snap.exists()).is(true);
				assert("Recevied event data").when(snap.val()).is('ciao');
				assert("Recevied event data").when(snap.key()).is('data');
			});
			
			it('Should combine child added, removed and value',()=>{
				mock.setData('/list',{a:1,b:2,c:3,d:4});

				var ref = mock.getUrl('/list');
				var adds :Tsdb.Spi.DbTreeSnap[] = [];
				var rems :Tsdb.Spi.DbTreeSnap[] = [];
				
				ref.on('child_added', (data)=>adds.push(data));
				ref.on('child_removed', (data)=>rems.push(data));
				
				assert("Received initial child_addeds").when(adds).is(M.withLength(4));
				assert("Received no initial child_removed").when(rems).is(M.withLength(0));
				
				adds = [];
				
				mock.setData('/list',{a:1,c:3,e:5,f:6});
				
				assert("Received new child_addeds").when(adds).is(M.withLength(2));
				assert("Received new child_removed").when(rems).is(M.withLength(2));
			});

			it('Should send child_moved',()=>{
				mock.setData('/list',{a:1,b:2,c:3,d:4});

				var ref = mock.getUrl('/list');
				var movs :Tsdb.Spi.DbTreeSnap[] = [];
				
				ref.on('child_moved', (data)=>movs.push(data));
				
				assert("Received no initial child_moved").when(movs).is(M.withLength(0));
				/*
				mock.setData('/list',{b:2,a:1,c:3,e:5,f:6});
				
				assert("Received new child_moved").when(movs).is(M.withLength(3));
				*/
			});
			
			it('Should send child_changed',()=>{
				mock.setData('/list',{a:1,b:2,c:3});

				var ref = mock.getUrl('/list');
				var movs :Tsdb.Spi.DbTreeSnap[] = [];
				
				ref.on('child_changed', (data)=>movs.push(data));
				
				assert("Received no initial child_changed").when(movs).is(M.withLength(0));
				
				mock.setData('/list',{b:2,a:1,c:4});
				
				assert("Received new child_changed").when(movs).is(M.withLength(1));
			});
			
			it('Should send child_changed for deep change',()=>{
				mock.setData('/list',{a:{val:1},b:{val:2},c:{val:3}});

				var ref = mock.getUrl('/list');
				var movs :Tsdb.Spi.DbTreeSnap[] = [];
				
				ref.on('child_changed', (data)=>movs.push(data));
				
				assert("Received no initial child_changed").when(movs).is(M.withLength(0));
				
				mock.setData('/list',{b:{val:2},a:{val:1},c:{val:4}});
				
				assert("Received new child_changed").when(movs).is(M.withLength(1));
			});
			
		});
		
		describe('Queries >', ()=>{
			
			var testList = {
					'c': {num:3,str:'c',invnum:7,oth:'a'},
					'd': {num:4,str:'d',invnum:6,oth:'a'},
					'a': {num:1,str:'a',invnum:9,oth:'a'},
					'b': {num:2,str:'b',invnum:8,oth:'b'},
					'e': {num:5,str:'e',invnum:5,oth:'b'},
				};
			
			beforeEach(()=>{
				mock.setData('/list', JSON.parse(JSON.stringify(testList)));
			});
			
			describe('Query listener >', ()=>{
				it('Should sort',()=>{
					var ql = new Mock.QueryListener(null);
					ql.orderChild = 'invnum';
					var ret = ql.filter(testList);
					assert("Still has all elements").when(ret).is(M.objectMatching(testList));
					var ds = new Mock.Db3MockSnap(ret,null,null);
					var ks :string[] = [];
					ds.forEach((child)=>{ks.push(child.key())});
					assert("Keys are in right order 0").when(ks[0]).is('e');
					assert("Keys are in right order 1").when(ks[1]).is('d');
					assert("Keys are in right order 2").when(ks[2]).is('c');
				});
				
				it('Should filter on equals', ()=>{
					var ql = new Mock.QueryListener(null);
					ql.orderChild = 'oth';
					ql.equal = 'b';
					var ret = ql.filter(testList);
					assert("Only has filtered elements").when(ret).is(M.objectMatchingStrictly({
						'b' : M.aTruthy,
						'e' : M.aTruthy,
						'$sorter' : M.aFunction
					}));
				});

				it('Should filter on start', ()=>{
					var ql = new Mock.QueryListener(null);
					ql.orderChild = 'num';
					ql.startAt = 3;
					var ret = ql.filter(testList);
					assert("Only has filtered elements").when(ret).is(M.objectMatchingStrictly({
						'c' : M.aTruthy,
						'd' : M.aTruthy,
						'e' : M.aTruthy,
						'$sorter' : M.aFunction
					}));
					assert("Does not contain 'a'").when(ret['a']).is(M.undefinedValue);
					assert("Does not contain 'b'").when(ret['b']).is(M.undefinedValue);
				});
				
				it('Should filter on end', ()=>{
					var ql = new Mock.QueryListener(null);
					ql.orderChild = 'num';
					ql.endAt = 3;
					var ret = ql.filter(testList);
					assert("Only has filtered elements").when(ret).is(M.objectMatchingStrictly({
						'a' : M.aTruthy,
						'b' : M.aTruthy,
						'$sorter' : M.aFunction
					}));
					assert("Does not contain 'c'").when(ret['c']).is(M.undefinedValue);
					assert("Does not contain 'd'").when(ret['d']).is(M.undefinedValue);
					assert("Does not contain 'e'").when(ret['e']).is(M.undefinedValue);
				});
				
				it('Should filter on range', ()=>{
					var ql = new Mock.QueryListener(null);
					ql.orderChild = 'num';
					ql.startAt = 2;
					ql.endAt = 5;
					var ret = ql.filter(testList);
					assert("Only has filtered elements").when(ret).is(M.objectMatchingStrictly({
						'b' : M.aTruthy,
						'c' : M.aTruthy,
						'd' : M.aTruthy,
						'$sorter' : M.aFunction
					}));
					assert("Does not contain 'a'").when(ret['a']).is(M.undefinedValue);
					assert("Does not contain 'e'").when(ret['e']).is(M.undefinedValue);
				});
				
				it('Should limit', ()=>{
					var ql = new Mock.QueryListener(null);
					ql.limit = 3;
					var ret = ql.filter(testList);
					assert("Only has filtered elements").when(ret).is(M.objectMatchingStrictly({
						'a' : M.aTruthy,
						'b' : M.aTruthy,
						'c' : M.aTruthy
					}));
					assert("Does not contain 'd'").when(ret['d']).is(M.undefinedValue);
					assert("Does not contain 'e'").when(ret['e']).is(M.undefinedValue);
				});
				
				it('Should limit last', ()=>{
					var ql = new Mock.QueryListener(null);
					ql.limit = 3;
					ql.limitFromLast = true;
					var ret = ql.filter(testList);
					assert("Only has filtered elements").when(ret).is(M.objectMatchingStrictly({
						'c' : M.aTruthy,
						'd' : M.aTruthy,
						'e' : M.aTruthy
					}));
					assert("Does not contain 'a'").when(ret['a']).is(M.undefinedValue);
					assert("Does not contain 'b'").when(ret['b']).is(M.undefinedValue);
				});
			});
			
			it('Should return value', (done)=>{
				var ref = mock.getUrl('/list');
				ref.orderByChild('invnum').on('value', (ds)=>{
					var val = ds.val();
					assert("Should contain all the values").when(val).is(M.objectMatching(testList));
					done();
				});
			});
			
			it('Should filter', (done)=>{
				var ref = mock.getUrl('/list');
				ref.orderByChild('num').startAt(3).on('value', (ds)=>{
					var ret = ds.val();
					assert("Only has filtered elements").when(ret).is(M.objectMatchingStrictly({
						'c' : M.aTruthy,
						'd' : M.aTruthy,
						'e' : M.aTruthy
					}));
					assert("Does not contain 'a'").when(ret['a']).is(M.undefinedValue);
					assert("Does not contain 'b'").when(ret['b']).is(M.undefinedValue);
					done();
				});
			});
			
			it('Should trigger child_added on static content', (done) =>{
				var ref = mock.getUrl('/list');
				var cnt = 0;
				ref.orderByChild('num').startAt(3).on('child_added', (ds)=>{
					assert("Is one of the allowed elements").when(ds.key()).is(
						M.either('c').or(M.either('d').or('e'))
					)
					cnt++;
					if (cnt == 3) done();
					assert("At most 3 events").when(cnt).is(M.lessThan(4));
				});
			});
			
			it('Should trigger child_added on dynamic add', (done)=>{
				var ref = mock.getUrl('/list');
				var cnt = 0;
				var keys = ['c','d','e','k'];
				ref.orderByChild('num').startAt(3).on('child_added', (ds)=>{
					assert("Is one of the allowed elements").when(keys.indexOf[ds.key()]).is(M.not(M.equalTo(-1)));
					cnt++;
					if (cnt == 4) return done();
					assert("At most 4 events").when(cnt).is(M.lessThan(5));
					if (cnt == 3) {
						mock.getUrl('/list/k').set({num:4, val:'ciao'});
					}
				});
			});
			
			it('Should trigger child_removed on remove', ()=>{
				var ref = mock.getUrl('/list');
				var cnt = 0;
				var keys = ['c'];
				ref.orderByChild('num').startAt(3).on('child_removed', (ds)=>{
					assert("Is one of the allowed elements").when(keys.indexOf[ds.key()]).is(M.not(M.equalTo(-1)));
					cnt++;
					//if (cnt == 1) return done();
					assert("At most 1 event").when(cnt).is(M.lessThan(2));
				});
				var refc = mock.getUrl('/list/c');
				refc.remove();
				assert("At most 1 event").when(cnt).is(M.lessThan(2));
			});
			
			it('Should trigger child_moved', ()=>{
				var ref = mock.getUrl('/list');
				var cnt = 0;
				var keys = ['c','d'];
				ref.orderByChild('num').startAt(3).on('child_removed', (ds)=>{
					assert("Is one of the allowed elements").when(keys.indexOf[ds.key()]).is(M.not(M.equalTo(-1)));
					cnt++;
					//if (cnt == 1) return done();
					assert("At most 2 event").when(cnt).is(M.lessThan(3));
				});
				var refc = mock.getUrl('/list/c');
				refc.update({num:4.5});
				assert("At most 2 event").when(cnt).is(M.lessThan(3));
			});
			
			
		});
		
	});
	
});