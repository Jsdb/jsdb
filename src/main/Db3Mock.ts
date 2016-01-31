
var glb = typeof window !== 'undefined' ? window : global; 
import Tsdb = require('./Tsdb');
var TsdbImpl = glb['Tsdb'] || require('./Tsdb');


interface RawListenerData {
	$listener? :Db3MockRoot.Listener;
}

TsdbImpl.Spi.registry['mock'] = Db3MockRoot.create;


function findChain<T>(url :string|string[], from :T, leaf = true, create = false) :T[] {
	var sp :string[];
	if (typeof(url) === 'string') {
		sp = splitUrl(<string>url);
	} else {
		sp = <string[]>url;
	}
	var to = sp.length;
	if (!leaf) to--;
	var ret :T[] = [];
	var ac = from;
	ret.push(ac);
	for (var i = 0; i < to; i++) {
		if (sp[i].length == 0) continue;
		if (!create && typeof(ac) !== 'object') {
			ret.push(undefined);
			break;
			//return [undefined];
		}
		var pre = ac;
		ac = ac[sp[i]];
		if (typeof(ac) === 'undefined') {
			if (!create) {
				ret.push(undefined);
				break;
				//return [undefined];
			}
			ac = <T>{};
			pre[sp[i]] = ac;
		} 
		ret.push(ac);
	}
	return ret;
}

/**
 * Removes beginning and trailing slashes
 */
function normalizeUrl(url :string) {
	if (url.charAt(url.length - 1) == '/') url = url.substr(0, url.length - 1);
	if (url.charAt(0) == '/') url = url.substr(1);
	return url;
}

function splitUrl(url :string) {
	return normalizeUrl(url).split('/');
}

function callLater(cb : (error: any) => void, err? :any) {
	if (cb) setTimeout(()=>cb(err), 0);
}

function camelCase(str :string) {
	return str.charAt(0).toUpperCase() + 
		str.substr(1).replace(/_(.)/, (all,m1)=>m1.toUpperCase());
}

function deepEquals(a,b) {
	return JSON.stringify(a) == JSON.stringify(b);
}

function getKeysOrdered(obj :any, fn? :(a,b)=>number) :string[] {
	fn = fn || obj['$sorter'] ;
	var sortFn = null;
	if (fn) {
		sortFn = (a,b)=>{
			return fn(obj[a],obj[b]);
		};
	}
	var ks = Object.getOwnPropertyNames(obj);
	var ret = [];
	for (var i = 0; i < ks.length; i++) {
		if (ks[i].charAt(0) == '$') continue;
		ret.push(ks[i]);
	}
	ret = ret.sort(sortFn);
	return ret;
}



class Db3MockRoot implements Tsdb.Spi.DbTreeRoot {

	constructor(public conf :Tsdb.Spi.FirebaseConf) {}
	
	data :any = {};
	
	buffering = false;
	buffer :(()=>any)[] = [];
	
	private listeners :RawListenerData = {};

	private find<T>(url :string|string[], from :T = this.data, leaf = true, create = false) :T {
		var ret = findChain(url, from, leaf, create);
		return ret.pop();
	}
	
	getData(url :string) {
		return this.find(url);
	}
	
	private bufferOp(fn :()=>any) {
		this.buffer.push(fn);
	}
	
	setData(url :string, data :any, cb?: (error: any) => void) {
		if (this.buffering) {
			this.bufferOp(()=>{ this.setData(url, data, cb)});
			return;
		}
		var sp = splitUrl(url);
		// Snapshot all the data (could be waaaaay better)
		var snapShot = JSON.parse(JSON.stringify(this.data));
		// Find old values
		var oldValChain = findChain(sp, snapShot, true, false);
		// Find the data path
		var dataChain = findChain(sp, this.data, false, true);
		// Find all parent listeners
		var listenerChain = findChain(sp, this.listeners, true, true);
		
		// Set the new data
		var ac = dataChain.pop();
		var k = sp[sp.length - 1];
		var oldVal = ac[k];
		if (data == null || typeof(data) == 'undefined') {
			delete ac[k];
		} else {
			ac[k] = data;
		}
		
		// Rebuild full data chain 
		dataChain = findChain(sp, this.data, true, true);
		// Notify parents
		for (var i = 0; i < listenerChain.length - 1; i++) {
			if (listenerChain[i] && listenerChain[i].$listener) {
				listenerChain[i].$listener.trigger(oldValChain[i], dataChain[i]);
			}
		}
		// Notify children 
		this.recurseTrigger(listenerChain.pop(), oldVal, data);
		callLater(cb);
	}
	
	private recurseTrigger(listeners :RawListenerData, oldVal :any, newVal :any) {
		if (!listeners) return;
		if (listeners.$listener) listeners.$listener.trigger(oldVal, newVal);
		var ks = Object.getOwnPropertyNames(listeners);
		for (var i = 0; i < ks.length; i++) {
			var k = ks[i];
			if (k.charAt(0) == '$') continue;
			this.recurseTrigger(listeners[k], oldVal? oldVal[k]:oldVal, newVal?newVal[k]:newVal);
		}
	}
	
	updateData(url, data :any, cb?: (error: any) => void) {
		if (this.buffering) {
			this.bufferOp(()=>{ this.updateData(url, data, cb)});
			return;
		}
		if (typeof(data) !== 'object') {
			return this.setData(url, data);
		}
		url = normalizeUrl(url);
		var ks = Object.getOwnPropertyNames(data);
		for (var i = 0; i < ks.length; i++) {
			var k = ks[i];
			this.setData(url + '/' + k, data[k]);
		}
		callLater(cb);
	}
	
	flush() {
		var prebuf = this.buffering;
		var fn :()=>any = null;
		this.buffering = false;
		try {
			while ((fn = this.buffer.shift())) fn();
		} finally {
			this.buffering = prebuf;
		} 
	}
	
	listen(url :string) :Db3MockRoot.Listener {
		var sp = splitUrl(url);
		var ac = this.find(sp, this.listeners, true, true);
		if (!ac.$listener) {
			ac.$listener = new Db3MockRoot.Listener();
			ac.$listener.trigger(undefined, this.getData(url));
		}
		return ac.$listener;
	}
	
	getUrl(url :string) :Tsdb.Spi.DbTree {
		return new Db3MockRoot.Db3MockTree(this, this.makeRelative(url));
	}
	makeRelative(url :string) :string {
		if (url.indexOf(this.conf.baseUrl) != 0) return url;
		return "/" + url.substr(this.conf.baseUrl.length);
	}
	makeAbsolute(url :string) :string {
		return this.conf.baseUrl + this.makeRelative(url);
	}
	
	isReady() :boolean {
		return true;
	}
	
	whenReady() :Promise<any> {
		return Promise.resolve();
	}

	static create(conf) {
		return new Db3MockRoot(conf);
	} 

	
}

module Db3MockRoot {
	
	export interface RawCallback {
		(oldVal :any, newVal :any):any;
	}
	
	export class Listener {
		cbs :RawCallback[] = [];
		endCbs :RawCallback[] = [];
		last :any;
		
		add(cb :RawCallback) {
			this.cbs.push(cb);
			cb(undefined, this.last);
		}
		
		addEnd(cb :RawCallback) {
			this.endCbs.push(cb);
			cb(undefined, this.last);
		}
		
		remove(cb :RawCallback) {
			this.cbs = this.cbs.filter((ocb)=>ocb!==cb);
			this.endCbs = this.endCbs.filter((ocb)=>ocb!==cb);
		}
		
		trigger(oldVal, newVal) {
			this.last = newVal;
			for (var i = 0; i < this.cbs.length; i++) {
				this.cbs[i](oldVal,newVal);
			}
			for (var i = 0; i < this.endCbs.length; i++) {
				this.endCbs[i](oldVal,newVal);
			}
		}
	}
	
	export class Db3MockSnap implements Tsdb.Spi.DbTreeSnap {
		constructor(
			private data :any,
			private root :Db3MockRoot,
			private url :string
		) {
			if (data != null && typeof(data) !== undefined) {
				this.data = JSON.parse(JSON.stringify(data));
				if (data['$sorter']) this.data['$sorter'] = data['$sorter'];
			} else {
				this.data = data;
			}
		}
		
		exists(): boolean {
			return typeof(this.data) !== 'undefined' && this.data !== null;
		}
		
		val(): any {
			if (!this.exists()) return null;
			return JSON.parse(JSON.stringify(this.data));
		}
		child(childPath: string): Tsdb.Spi.DbTreeSnap {
			var subs = findChain(childPath, this.data, true, false);
			return new Db3MockSnap(subs.pop(), this.root, this.url + '/' + normalizeUrl(childPath));
		}
		
		// TODO ordering
		forEach(childAction: (childSnapshot: Tsdb.Spi.DbTreeSnap) => void): boolean;
		forEach(childAction: (childSnapshot: Tsdb.Spi.DbTreeSnap) => boolean): boolean {
			if (!this.exists()) return;
			var ks = getKeysOrdered(this.data);
			for (var i = 0; i < ks.length; i++) {
				if (childAction(this.child(ks[i]))) return true;
			}
			return false;
		}
		
		key(): string {
			return this.url.split('/').pop() || '';
		}
		
		ref(): Tsdb.Spi.DbTree {
			return this.root.getUrl(this.url);
		}
	}
	
	abstract class CbHandler {
		public eventType :string;
		protected cb :RawCallback = null;
		constructor(
			public callback :(dataSnapshot: Tsdb.Spi.DbTreeSnap, prevChildName?: string) => void,
			public context :Object,
			public tree :Db3MockTree
		) {
			this.cb = (o,n)=>this.trigger(o,n);
			this.hook();
		}
		
		matches(eventType?: string, callback?: (dataSnapshot: Tsdb.Spi.DbTreeSnap, prevChildName?: string) => void, context?: Object) {
			if (context) {
				return this.eventType == eventType && this.callback === callback && this.context === context;
			} else if (callback) {
				return this.eventType == eventType && this.callback === callback;
			} else {
				return this.eventType == eventType;
			}
		}
		
		hook() {
			this.tree.getListener().add(this.cb);
		}
		
		decommission() {
			if (this.cb) {
				this.tree.getListener().remove(this.cb);
			}
			this.cb = null;
		}
		
		abstract trigger(oldVal, newVal);
		
	}
	
	class ValueCbHandler extends CbHandler {
		hook() {
			this.tree.getListener().addEnd(this.cb);
		}
		trigger(oldVal, newVal) {
			this.callback(new Db3MockSnap(newVal, this.tree.root, this.tree.url));
		}
	}
	
	class ChildAddedCbHandler extends CbHandler {
		trigger(oldVal, newVal) {
			if (typeof(newVal) !== 'object') return; 
			var mysnap = new Db3MockSnap(newVal, this.tree.root, this.tree.url);
			var ks = getKeysOrdered(newVal);
			var prek = null;
			for (var i = 0; i < ks.length; i++) {
				var k = ks[i];
				if (!oldVal || !oldVal[k]) this.callback(mysnap.child(k), prek);
				prek = k;
			}
		}
	}
	
	class ChildRemovedCbHandler extends ChildAddedCbHandler {
		trigger(oldVal, newVal) {
			super.trigger(newVal, oldVal);
		}
	}
	
	class ChildMovedCbHandler extends CbHandler {
		trigger(oldVal, newVal) {
			if (typeof(newVal) !== 'object') return;
			if (typeof(oldVal) !== 'object') return;
			
			// TODO ordering
			var oks = getKeysOrdered(oldVal);
			var nks = getKeysOrdered(newVal);
			
			var mysnap = new Db3MockSnap(newVal, this.tree.root, this.tree.url);
			
			var oprek :string = null;
			for (var i = 0; i < oks.length; i++) {
				var k = oks[i];
				var npos = nks.indexOf(k);
				if (npos < 0) continue;
				var nprek = npos == 0 ? null : nks[npos - 1];
				if (nprek != oprek) {
					this.callback(mysnap.child(k), nprek);
				}
				oprek = k;
			}
		}
	}
	
	class ChildChangedCbHandler extends CbHandler {
		trigger(oldVal, newVal) {
			if (typeof(newVal) !== 'object') return;
			if (typeof(oldVal) !== 'object') return;
			
			var nks = Object.getOwnPropertyNames(newVal);
			
			var mysnap = new Db3MockSnap(newVal, this.tree.root, this.tree.url);
			
			for (var i = 0; i < nks.length; i++) {
				var k = nks[i];
				var preVal = oldVal[k];
				if (!preVal) continue;
				var nprek = i == 0 ? null : nks[i-1];
				if (!deepEquals(newVal[k],preVal)) this.callback(mysnap.child(k), nprek);
			}
		}
	}
	
	interface CbHandlerCtor {
		new(
			callback :(dataSnapshot: Tsdb.Spi.DbTreeSnap, prevChildName?: string) => void,
			context :Object,
			tree :Db3MockTree
		):CbHandler;
	}
	
	var cbHandlers = {
		value :ValueCbHandler,
		child_added :ChildAddedCbHandler,
		child_removed :ChildRemovedCbHandler,
		child_moved :ChildMovedCbHandler,
		child_changed :ChildChangedCbHandler
	}
		
	export class Db3MockTree implements Tsdb.Spi.DbTree {
		
		constructor(
			public root :Db3MockRoot,
			public url :string
		) {
			
		}
		
		private cbs :CbHandler[] = [];
		private qlistener :QueryListener = null;
		
		getListener() :Listener {
			return this.qlistener || this.root.listen(this.url);
		}
		
		toString(): string {
			return this.root.makeAbsolute(this.url);
		}
		set(value: any, onComplete?: (error: any) => void): void {
			this.root.setData(this.url, value, onComplete);
		}
		update(value: Object, onComplete?: (error: any) => void): void {
			this.root.updateData(this.url, value, onComplete);
		}
		remove(onComplete?: (error: any) => void): void {
			this.set(null, onComplete);
		}

		on(eventType: string, callback: (dataSnapshot: Tsdb.Spi.DbTreeSnap, prevChildName?: string) => void, cancelCallback?: (error: any) => void, context?: Object): (dataSnapshot: Tsdb.Spi.DbTreeSnap, prevChildName?: string) => void {
			var ctor :CbHandlerCtor = cbHandlers[eventType];
			if (!ctor) throw new Error("Cannot find event " + eventType);
			var handler = new ctor(callback, context, this);
			handler.eventType = eventType;
			this.cbs.push(handler);
			return callback; 
		}
		off(eventType?: string, callback?: (dataSnapshot: Tsdb.Spi.DbTreeSnap, prevChildName?: string) => void, context?: Object): void {
			this.cbs = this.cbs.filter((ach)=>{
				if (ach.matches(eventType, callback, context)) {
					ach.decommission();
					return true;
				}
				return false;
			});
		}
		
		
		once(eventType: string, successCallback: (dataSnapshot: Tsdb.Spi.DbTreeSnap) => void, context?: Object): void;
		once(eventType: string, successCallback: (dataSnapshot: Tsdb.Spi.DbTreeSnap) => void, failureCallback?: (error: any) => void, context?: Object): void {
			var fn = this.on(eventType, (ds)=>{
				this.off(eventType, fn);
				successCallback(ds);
			}, (err)=>{
				if (failureCallback && context) {
					failureCallback(err);
				}
			}, context || failureCallback);
		}
		
		
		private subQuery() {
			var ret = new Db3MockTree(this.root, this.url);
			ret.qlistener = new QueryListener(this.getListener());
			return ret;
		}
		
		/**
		* Generates a new Query object ordered by the specified child key.
		*/
		orderByChild(key: string): Tsdb.Spi.DbTreeQuery {
			var ret = this.subQuery();
			ret.qlistener.orderChild = key;
			return ret;
		}
		/**
		* Generates a new Query object ordered by key name.
		*/
		orderByKey(): Tsdb.Spi.DbTreeQuery {
			var ret = this.subQuery();
			ret.qlistener.orderChild = null;
			return ret;
		}
		
		/**
		* Creates a Query with the specified starting point. 
		* The generated Query includes children which match the specified starting point.
		*/
		startAt(value: string|number, key?: string): Tsdb.Spi.DbTreeQuery {
			var ret = this.subQuery();
			ret.qlistener.startAt = value;
			return ret;
		}
		
		/**
		* Creates a Query with the specified ending point. 
		* The generated Query includes children which match the specified ending point.
		*/
		endAt(value: string|number, key?: string): Tsdb.Spi.DbTreeQuery {
			var ret = this.subQuery();
			ret.qlistener.endAt = value;
			return ret;
		}
		
		/**
		* Creates a Query which includes children which match the specified value.
		*/
		equalTo(value: string|number, key?: string): Tsdb.Spi.DbTreeQuery {
			var ret = this.subQuery();
			ret.qlistener.equal = value;
			return ret;
		}
		/**
		* Generates a new Query object limited to the first certain number of children.
		*/
		limitToFirst(limit: number): Tsdb.Spi.DbTreeQuery {
			var ret = this.subQuery();
			ret.qlistener.limit = limit;
			ret.qlistener.limitFromLast = false;
			return ret;
		}
		/**
		* Generates a new Query object limited to the last certain number of children.
		*/
		limitToLast(limit: number): Tsdb.Spi.DbTreeQuery {
			var ret = this.subQuery();
			ret.qlistener.limit = limit;
			ret.qlistener.limitFromLast = true;
			return ret;
		}
		
	}
	
	export class QueryListener extends Listener {
		
		orderChild :string = null;
		startAt :string|number = null;
		endAt :string|number = null;
		equal :string|number;
		limit :number = null;
		limitFromLast = false;
		
		baseListener :Listener = null;
		
		constructor(oth :QueryListener|Listener) {
			super();
			if (oth instanceof QueryListener) {
				this.orderChild = oth.orderChild;
				this.startAt = oth.startAt;
				this.endAt = oth.endAt;
				this.equal = oth.equal;
				this.limit = oth.limit;
				this.limitFromLast = oth.limitFromLast;
				this.baseListener = oth.baseListener;
			} else {
				this.baseListener = oth;
			}
		}
		
		add(cb :RawCallback) {
			this.baseListener.add((o,n)=>this.trigger(o,n));
			super.add(cb);
		}
		
		addEnd(cb :RawCallback) {
			this.baseListener.add((o,n)=>this.trigger(o,n));
			super.addEnd(cb);
		}
		
		filter(val) {
			if (!val) return val;
			if (typeof(val) != 'object') return val;
			// Clone it
			val = JSON.parse(JSON.stringify(val));
			// Create sorting function
			var order = !this.orderChild ? null : (a,b)=>{
				var va = a[this.orderChild];
				var vb = b[this.orderChild];
				return (va < vb) ? -1 : (va > vb) ? 1 : 0;
			};
			var ks = getKeysOrdered(val, order);
			if (this.orderChild) {
				// Filter if there is an equal
				if (typeof(this.equal) !== 'undefined') {
					for (var i = 0; i < ks.length; i++) {
						var obj = val[ks[i]];
						if (obj[this.orderChild] != this.equal) delete val[ks[i]];
					}
				} else {
					if (this.startAt) {
						for (var i = 0; i < ks.length; i++) {
							var obj = val[ks[i]];
							if (obj[this.orderChild] < this.startAt) {
								delete val[ks[i]];
							} else break;
						}
					}
					if (this.endAt) {
						for (var i = ks.length - 1; i >= 0; i--) {
							var obj = val[ks[i]];
							if (obj[this.orderChild] >= this.endAt) {
								delete val[ks[i]];
							} else break;
						}
					}
				}
			}
			ks = getKeysOrdered(val, order);
			// Remove based on limit
			if (this.limit) {
				if (this.limitFromLast) {
					ks = ks.slice(ks.length - this.limit);
				} else {
					ks = ks.slice(0, this.limit);
				}
				for (var k in val) {
					if (ks.indexOf(k) == -1) delete val[k];
				}
			}
			
			val.$sorter = order;
			return val;
		}
		
		trigger(oldVal, newVal) {
			newVal = this.filter(newVal);
			oldVal = this.filter(oldVal);
			this.last = newVal;
			for (var i = 0; i < this.cbs.length; i++) {
				this.cbs[i](oldVal,newVal);
			}
			for (var i = 0; i < this.endCbs.length; i++) {
				this.endCbs[i](oldVal,newVal);
			}
		}
	}
}



export = Db3MockRoot;