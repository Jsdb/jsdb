/// <reference path="../../typings/tsd.d.ts" />


import Firebase = require('firebase');
import Io = require('socket.io');
import PromiseModule = require('es6-promise');

var Promise = PromiseModule.Promise;


export = Db;
class Db {
	private descriptions :{[index:string]:new ()=>Db.Entity} = {};
	private instances :{[index:string]:Db.Entity} = {};
	private socket :SocketIO.Socket;
	
	setSocket(socket :SocketIO.Socket) {
		this.socket = socket;
	}
	
	sendOnSocket(url :string, payload :any) {
		this.socket.emit(url, payload);
	}
	
	load(url :string):Db.Entity {
		var ret = this.instances[url];
		if (ret) {
			return ret;
		}
		var preurl = url.substring(0, url.lastIndexOf('/')+1);
		var ctor = this.descriptions[preurl];
		if (!ctor) {
			throw new Error("The url " + preurl + " is not bound to a C object");
		}
		ret = new ctor();
		ret.dbInit(url, this);
		
		// TODO register for cancellation
		
		this.instances[url] = ret;
		return ret;
	}
	
	register(baseUrl :string, ctor :new ()=>Db.Entity) {
		this.descriptions[baseUrl] = ctor;
	}
	
	computeUrl(inst :Db.Entity) {
		var ctor = inst.constructor;
		var pre :string = null;
		var pres = Object.keys(this.descriptions);
		for (var i = 0; i < pres.length; i++) {
			if (this.descriptions[pres[i]] === ctor) {
				pre = pres[i];
				break;
			}
		}
		if (!pre) throw new Error("The constructor " + ctor + " is not bound to an url");
		pre += Db.internal.IdGenerator.next();
		return pre;
	}
}

module Db {
	
	export var serverMode = false;
		
	// TODO can't be like this, but ok for now
	export var def = new Db();
	
	
	export function str() :internal.IValueEvent<string> {
		var ret = new internal.ValueEvent<string>();
		return ret;
	}
	export function num() :internal.IValueEvent<number> {
		var ret = new internal.ValueEvent<number>();
		return ret;
	}
	export function data<V extends Data>(c :new ()=>V) :internal.IValueEvent<V> {
		var ret = new internal.ValueEvent<V>();
		ret.objD(c);
		return ret;
	}
	export function reference<V extends Entity>(c :new ()=>V) :internal.IValueEvent<V> {
		var ret = new internal.ValueEvent<V>();
		return ret;
	}
	
	export function dataList<V extends Data>(c :new ()=>V) :internal.IListEvent<V> {
		var ret = new internal.ListEvent<V>();
		ret.objD(c);
		return ret;
	}
	export function referenceList<V extends Entity>(c :new ()=>V) :internal.IListEvent<V> {
		var ret = new internal.ListEvent<V>();
		return ret;
	}
	export function strList() :internal.IListEvent<string> {
		var ret = new internal.ListEvent<string>();
		return ret;
	}
	export function numList() :internal.IListEvent<number> {
		var ret = new internal.ListEvent<number>();
		return ret;
	}
	
	export class Entity {
		url :string;
		protected db :Db;
		public events :any;
		
		dbInit(url :string, db :Db) {
			this.url = url || this.url || db.computeUrl(this);
			if (db === this.db) return;
			this.db = db;
			var evts = Object.keys(this.events);
			for (var i = 0; i < evts.length; i++) {
				var ev = <internal.Event<any>>this.events[evts[i]];
				ev.named(evts[i]);
				// TODO also assign name
				ev.dbInit(url,db, this);
			}
		}
		
		equals(oth :Entity) {
			return oth.url == this.url;
		}
		
		getId():string {
			return this.url.substring(this.url.lastIndexOf('/') + 1);
		}
		
		serializeProjections(url :string, projections: any = {}) {
			var ks = Object.keys(projections);
			for (var i = 0; i < ks.length; i++) {
				var k = ks[i];
				var proj = projections[k];
				// TODO serialize projections, will be a direct write, could be done async
			}
		}
		
		protected callRemoteMethod(name :string, params :any[]):void {
			this.db.sendOnSocket(this.url, 
				JSON.stringify({method: name, params: params}, 
					function(key,val) {
						if (val instanceof Entity) {
							return <Entity>val.url;
						}
						return val;
					}
				)
			);
		}
		
		getPromise<T>(def :string) :Promise<T> {
			var subd = def.split('.');
			var rest = null;
			if (subd.length > 1) {
				rest = def.substring(subd[0].length + 1);
			}
			var evt :internal.Event<any> = this.events[subd[0]];
			if (!evt) throw new Error("No event called " + subd[0]);
			return evt.then((v :any) => {
				if (rest && v instanceof Entity) {
					return (<Entity>v).getPromise(rest);
				} else {
					return <T>v;
				}
			});
		}
		
	}
	
	export class Data {
		url: string;
		
		parse(url:string, obj :any, db :Db) {
			this.url = url;
			var ks = Object.keys(obj);
			for (var i = 0; i < ks.length; i++) {
				var k = ks[i];
				var v = obj[k];
				if (Data.isRef(v)) {
					v = Data.readRef(v, db);
				}
				this[k] = v;
			}
		}
		
		serialize(db :Db = null, ret :any = {}, projections :any = {}) {
			var ks = Object.keys(this);
			for (var i = 0; i < ks.length; i++) {
				var k = ks[i];
				if (k == 'url') continue;
				if (k.charAt(0) == '_') continue;
				var v = this[k];
				if (v instanceof Entity) {
					if (db) (<Entity>v).dbInit(null,db);
					(<Entity>v).serializeProjections(this.url, projections[k]);
					v = {
						_ref: (<Entity>v).url
					};
				} else if (v instanceof Data) {
					ret[k] = (<Data>v).serialize(db, {}, projections[k]);
				}
				ret[k] = v;
			}
			return ret;
		}
		
		static isRef(data) :boolean {
			return data && !!data._ref;
		}
		
		static readRef(data:any, db:Db) :Entity {
			if (!data) return null;
			if (typeof(data) === 'object') {
				var objc = db.load(data._ref);
				for (var k in data) {
					if (k == '_ref') continue;
					var proj = data[k];
					var event = <Db.internal.Event<any>>objc.events[k];
					event.projectValue(proj);
				}
				return objc;
			} else {
				return db.load(data);
			}
		}
	}
	
	export module internal {
		export interface IEventListen<V> {
			on(ctx :any, handler: { (data?: V, detail?:IEventDetails<V>): void });
			once(ctx :any, handler: { (data?: V, detail?:IEventDetails<V>): void });
			off(ctx :any):any;
			hasHandlers() :boolean;
		}
		
		export interface IEvent<V> extends IEventListen<V> {
			named(name :string) :IEvent<V>;
		}
		
		export interface IValueEvent<V> extends IEvent<V>, Thenable<V> {
			named(name :string) :IValueEvent<V>;
			broadcast(val :V):void;
			promise() :Promise<V>;
			preLoad(f :(promise :Promise<V>)=>void) :IValueEvent<V>;
			preLoad(bind :any) :IValueEvent<V>;
		}
		
		export interface IArrayValueEvent<V> extends IEvent<V[]>, Thenable<V[]> {
			named(name :string) :IArrayValueEvent<V>;
			promise() :Promise<V[]>;
			preLoad(f :(promise :Promise<V[]>)=>void) :IArrayValueEvent<V>;
			preLoad(bind :any) :IArrayValueEvent<V>;
		}
		
		
		export interface IListEvent<T> {
			add :IValueEvent<T>;
			remove :IEvent<T>;
			modify :IEvent<T>;
			all :IEvent<T>;
			full: IArrayValueEvent<T>;

			named(name :string) :IListEvent<T>;
			subQuery() :IListEvent<T>;
			sortOn(field :string, desc? :boolean):IListEvent<T>;
			limit(limit :number):IListEvent<T>;
			range(from :any, to :any):IListEvent<T>;
			equals(val :any):IListEvent<T>;
		}
		
		export interface IEventDetails<T> {
			payload :T;
			populating :boolean;
			projected :boolean;
			listEnd :boolean;
			originalEvent :string;
			originalUrl :string;
			originalKey :string;
			precedingKey :string;
			
			offMe():void;
		}
	
		export class IdGenerator {
			// Modeled after base64 web-safe chars, but ordered by ASCII.
			// SG : removed - and _
			static PUSH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
			
			static BASE = IdGenerator.PUSH_CHARS.length;
		
			// Timestamp of last push, used to prevent local collisions if you push twice in one ms.
			static lastPushTime = 0;
		
			// We generate 72-bits of randomness which get turned into 14 characters and appended to the
			// timestamp to prevent collisions with other clients.	We store the last characters we
			// generated because in the event of a collision, we'll use those same characters except
			// "incremented" by one.
			static lastRandChars = [];
		
			static next() {
				var now = new Date().getTime();
				var duplicateTime = (now === IdGenerator.lastPushTime);
				IdGenerator.lastPushTime = now;
		
				var timeStampChars = new Array(8);
				for (var i = 7; i >= 0; i--) {
					timeStampChars[i] = IdGenerator.PUSH_CHARS.charAt(now % IdGenerator.BASE);
					// NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
					now = Math.floor(now / IdGenerator.BASE);
				}
				if (now !== 0) throw new Error('We should have converted the entire timestamp.');
		
				var id = timeStampChars.join('');
		
				if (!duplicateTime) {
					for (i = 0; i < 14; i++) {
						IdGenerator.lastRandChars[i] = Math.floor(Math.random() * IdGenerator.BASE);
					}
				} else {
					// If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
					for (i = 13; i >= 0 && IdGenerator.lastRandChars[i] === IdGenerator.BASE-1; i--) {
						IdGenerator.lastRandChars[i] = 0;
					}
					IdGenerator.lastRandChars[i]++;
				}
				for (i = 0; i < 14; i++) {
					id += IdGenerator.PUSH_CHARS.charAt(IdGenerator.lastRandChars[i]);
				}
				if (id.length != 22) throw new Error('Length should be 22, but was ' + id.length);
		
				return id;
			}
		}
		
		export interface DbObjDescription<X extends Db.Entity> {
			instantiate(url :string):X;
		}
		
		
		export class EventDetails<T> implements IEventDetails<T> {
			payload :T = null;
			populating = false;
			projected = false;
			listEnd = false;
			originalEvent :string = null;
			originalUrl :string = null;
			originalKey :string = null;
			precedingKey :string = null;
			
			private handler :EventHandler<T> = null;
			
			setHandler(handler :EventHandler<T>) {
				this.handler = handler;
			}
			
			offMe() {
				this.handler.event.offHandler(this.handler);
			}
		}
		
		export class EventHandler<T> {
			static prog = 1;
			myprog = EventHandler.prog++;
			first: boolean = true;
			after: (h?:EventHandler<T>)=>any;
			_ref :FirebaseQuery;
			private canceled = false;
			private _cbs :{event:string; fn :(dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void}[] = [];
			
			constructor(
				public event :Event<T>,
				public ctx :any,
				public method :(payload?:T, detail?:EventDetails<T>)=>void
			) {}
			
			hook(event :string, fn :(dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void) {
				this._cbs.push({event:event, fn:fn});
				// TODO do something on cancelCallback? It's here only because of method signature
				this._ref.on(event, fn, (err) => {}, this);
			}
			
			decomission(remove :boolean):boolean {
				// TODO override off, must remove only this instance callbacks, Firebase does not
				if (remove) {
					for (var i = 0; i < this._cbs.length; i++) {
						var cb = this._cbs[i];
						//console.log(this.myprog + " : Listen off " + this._ref.toString() + " " + cb.event, cb.fn);
						this._ref.off(cb.event, cb.fn, this);
					}
					this.canceled = true;
				}
				return remove;
			}
			
			handle(evd :EventDetails<T>) {
				if (this.canceled) {
					console.warn(this.myprog + " : Receiving events on canceled handler", evd);
					console.trace();
					return;
				}
				//console.log("Handling", evd);
				//console.trace();
				evd.setHandler(this);
				this.method.call(this.ctx, evd.payload, evd);
				//console.log("Then calling", this.after);
				if (this.after) this.after(this);
			}
			
		}
		
		/**
		 * Db based event. 
		 * 
		 * This events are triggered when the sub key passed as name in constructor is modified.
		 * Which modifications triggers the event and how they are interpreted is based on the transformer passed to
		 * withTransformer.
		 * 
		 * When called on(), the event is triggered as soon as possible (maybe even before returning from
		 * the on call if the data is already available). All events are triggered, also those cached before
		 * the call to on, that is "on" doesn't mean "call me when something changes from now on", but also
		 * pre-existing data is sent as events.
		 * 
		 * To distinguish, when possible, among pre-existing and new data, the event callback has a parameter
		 * "first?:boolean", that is set to true for pre-existing data, and false for later updates.
		 * 
		 */
		export class Event<T> implements IEvent<T> {
			
			/**
			 * Name on DB.
			 */
			protected name :string
			/**
			 * Array of current handlers.
			 */
			protected handlers :EventHandler<T>[] = [];
			/**
			 * Full url this event is listening to
			 */
			url :string = null;
			/**
			 * Instance of the Db we are using
			 */
			protected db :Db = null;
			/**
			 * Constructor for the D object, if this event returns a D event
			 */
			_ctorD :new ()=>Data = null;
			/**
			 * If this is a ref
			 */
			// TODO should not be implicitly true, could be native
			_isRef :boolean = true;
			
			_preload :(p:Promise<T>)=>Promise<any> = null;
			
			_entity :Entity = null;

			events = ['value'];
			
			protected projVal :T = null;
			
			hrefIniter :(h :EventHandler<T>)=>void = this.setupHref;
			
			constructor() {
			}
			
			named(name :string) {
				if (this.name) return this;
				this.name = name;
				return this;
			}
			
			objD(c :new ()=>Data) {
				this._ctorD = c;
				this._isRef = false;
				return this;
			}
			preLoad(f :(promise :Promise<T>)=>Promise<any>);
			preLoad(f :{[index:string]:string});
			preLoad(f :any) {
				if (typeof f === 'function') {
					this._preload = f;
				} else {
					this._preload = (prom) => {
						var ks = Object.keys(f);
						var pms :Promise<any>[] = [];
						pms.push(prom);
						for (var i = 0; i < ks.length; i++) {
							pms[i+1] = this._entity.getPromise(f[ks[i]]); 
						}
						return Promise.all(pms).then((vals) => {
							var data = vals[0];
							for (var i = 0; i < ks.length; i++) {
								var k = ks[i];
								if (data[k] && typeof data[k] === 'function') {
									(<()=>any>data[k]).apply(data,vals[i+1]);
								} else {
									data[k] = vals[i+1]
								}
							}
						});
					};
				}
				return this;
			}

			
			/**
			 * Called by the ObjC when the url is set.
			 */
			dbInit(url :string, db :Db, entity :Entity) {
				this.url = url + '/' + this.name;
				this.db = db;
				this._entity = entity;
				// At this point someone could already have registered some handler
				for (var i = 0; i < this.handlers.length; i++) {
					this.init(this.handlers[i]);
				}
			}
			
			public on(ctx :any, handler: { (data?: T, detail?:EventDetails<T>): void }) {
				this.handlers = this.handlers.filter(h => h.decomission(h.ctx === ctx && h.method === handler));
				var h = new EventHandler<T>(this, ctx, handler);
				this.handlers.push(h);
				// At this point the url could not yet have been set
				if (typeof ctx.eventAttached != 'undefined') {
					(<EventDetachable>ctx).eventAttached(this);
				}
				if (this.url) {
					this.init(h);
				}
			}
			
			public once(ctx :any, handler: { (data?: T, detail?:EventDetails<T>): void }) {
				var h = new EventHandler<T>(this, ctx, handler);
				this.handlers.push(h);
				h.after = ()=> {
					this.offHandler(h);
				};
				if (typeof ctx.eventAttached != 'undefined') {
					(<EventDetachable>ctx).eventAttached(this);
				}
				// At this point the url could not yet have been set
				if (this.url) this.init(h);
			}
			
			promise() :Promise<T> {
				return this.then((v) => v);
			}
			
			then<U>(onFulfilled: (value: T) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Promise<U>;
			then<U>(onFulfilled: (value: T) => U | Thenable<U>, onRejected?: (error: any) => void): Promise<U>
			{
				var fu :(data:U|Thenable<U>)=>void = null;
				var ret = new Promise<U>((res,err) => {
					fu = res;
				});
				this.once(this, (data,detail) => {
					if (!detail.projected) {
						fu(onFulfilled(data));
					}
				});
				return ret;
			}
			
			offHandler(h :EventHandler<T>) {
				//console.log("Decommissioning ", handler);
				h.decomission(true);
				this.handlers = this.handlers.filter(ch => ch !== h);
			}
			
			protected init(h :EventHandler<T>) {
				this.hrefIniter(h);
				// TODO handle the list case
				if (this.projVal) {
					var evd = new EventDetails<T>();
					evd.payload = this.projVal;
					evd.populating = true;
					evd.projected = true;
					h.handle(evd);
				}
				for (var i = 0; i < this.events.length; i++) {
					this.setupEvent(h, this.events[i]);
				}
				h._ref.once('value', (ds) => {
					h.first = false
				});
			}
			
			protected setupHref(h :EventHandler<T>) {
				h._ref = new Firebase(this.url);
			}
			
			protected setupEvent(h :EventHandler<T>, name :string) {
				// TODO what the second time the event fires?
				var proFunc:(value:T)=>void = null;
				var fireprom = null;
				if (this._preload) {
					var prom = new Promise<T>((ok,err) => {
						proFunc = ok;
					});
					// Use the returned promise
					fireprom = this._preload(prom);
				}
				h.hook(name, (ds, pre) => {
					var evd = new EventDetails<T>();
					evd.payload = this.parseValue(ds.val(), ds.ref().toString());
					if (proFunc) {
						proFunc(evd.payload);
					}
					evd.originalEvent = name;
					evd.originalUrl = ds.ref().toString();
					evd.originalKey = ds.key();
					evd.precedingKey = pre;
					evd.populating = h.first;
					if (fireprom) {
						fireprom.then(()=> {
							h.handle(evd);
						});
					} else {
						h.handle(evd);
					}
				});
			}
			
			public off(ctx :any) {
				this.handlers = this.handlers.filter(h => !h.decomission(h.ctx === ctx));
			}
			
			// TODO move to static
			public static offAll(ctx :any, events :any) {
				for (var k in events) {
					var evt = events[k];
					if (!(evt instanceof Event)) continue;
					(<Event<any>>evt).off(ctx);
				}
			}
			
			public hasHandlers() :boolean {
				return this.handlers.length > 0;
			}
			
			parseValue(val, url? :string) {
				if (val) {
					if (this._ctorD) {
						var objd = new this._ctorD();
						objd.parse(url, val, this.db); 
						val = objd;
					} else if (this._isRef || Data.isRef(val)) {
						val = Data.readRef(val, this.db);
					}
					// TODO handle native
				}
				return val;
			}
			
			projectValue(val) {
				// TODO handle list case
				val = this.parseValue(val);
				if (!val) return;
				this.projVal = val;
				var evd = new EventDetails<T>();
				evd.payload = val;
				evd.populating = true;
				for (var i = 0; i < this.handlers.length; i++) {
					if (!this.handlers[i].first) continue;
					this.handlers[i].handle(evd);
				}
			}
		}
		
		export class ValueEvent<T> extends Event<T> implements IValueEvent<T> {
			private broadcasted = false;
			private lastBroadcast :T;
			
			broadcast(val :T) {
				this.lastBroadcast = val;
				this.broadcasted = true;
				this.checkBroadcast();
			}
			
			named(name :string) :ValueEvent<T> {
				if (this.name) return this;
				super.named(name);
				return this;
			}
			
			preLoad(f :(promise :Promise<T>)=>Promise<any>);
			preLoad(f :{[index:string]:string});
			preLoad(f :any) {
				super.preLoad(f);
				return this;
			}
			
			protected checkBroadcast() {
				if (!this.url || !this.broadcasted) return;
				this.save(this.lastBroadcast);
				this.broadcasted = false;
				this.lastBroadcast = null;
			}
			
			protected save(val :T) {
				var ref = new Firebase(this.url);
				var ser = this.serializeForSave(this.lastBroadcast);
				ref.set(ser);
			}
			
			protected serializeForSave(val :T) {
				if (val instanceof Entity) {
					// TODO projections
					(<Entity><any>val).dbInit(null, this.db);
					return (<Entity><any>val).url;
				} else if (val instanceof Data) {
					// TODO projections
					return (<Data><any>val).serialize(this.db);
				} else {
					return val;
				}
			}
			
			dbInit(url :string, db :Db, entity :Entity) {
				super.dbInit(url, db, entity);
				this.checkBroadcast();
			}
		}
		
		export class ArrayValueEvent<T> extends Event<T[]> implements IArrayValueEvent<T> {
			private broadcasted = false;
			private lastBroadcast :T;
			
			named(name :string) {
				if (this.name) return this;
				super.named(name);
				return this;
			}
			
			parseValue(val, url? :string) {
				if (val) {
					var nval = [];
					var ks = Object.keys(val);
					for (var i = 0; i < ks.length; i++) {
						var sval = val[ks[i]];
						sval = super.parseValue(sval, url + '/' + ks[i]);
						nval.push(sval);
					}
					val = nval;
				}
				return val;
			}
			
			preLoad(f :(promise :Promise<T[]>)=>Promise<any>);
			preLoad(f :{[index:string]:string});
			preLoad(f :any) {
				super.preLoad(f);
				return this;
			}
		}
		
		
		/*
		export class LoadedEntityEvent extends Event<Entity> implements ILoadedEntityEvent {
			private tosave = false;
			
			constructor(private entity : Entity) {
				super();
			}
			
			save() {
				this.tosave = true;
				this.trySave();
			}
			
			private trySave() {
				if (!this.tosave) return;
				if (!this.db) return;
				// TODO save data entity, will be an update
			}
			
			dbInit(url :string, db :Db) {
				super.dbInit(url, db);
				this.trySave();
			}
		}
		*/
		
		export class AddedListEvent<T> extends ValueEvent<T> {
			constructor() {
				super();
				this.events = ['child_added'];
			}
			
			projectValue(val) {
				// TODO No support for projection of lists
			}
			
			protected init(h :EventHandler<T>) {
				this.hrefIniter(h);
				for (var i = 0; i < this.events.length; i++) {
					this.setupEvent(h, this.events[i]);
				}
				h._ref.once('value', (ds) => {
					var evd = new EventDetails<T>();
					evd.listEnd = true;
					h.handle(evd);
					h.first = false
				});
			}
			
			protected save(val :T) {
				// We treat them as a set, if it's already there it will be updated
				var ser = this.serializeForSave(val);
				var ref = new Firebase(this.url);
				if (val instanceof Entity) {
					// In case of objC we use the id ad a key, to assure uniqueness
					ref.child((<Entity><any>val).getId()).set(ser);
				} else if (val instanceof Data) {
					// For objD they don't have an id, if it was previously saved here we update it, otherwise it's considered new
					var objd = (<Data><any>val);
					if (objd.url && objd.url.indexOf(this.url) == 0 && objd.url.substring(this.url.length).indexOf('/') == -1) {
						new Firebase(objd.url).set(ser);
					} else {
						ref.child(IdGenerator.next()).set(ser);
					}
				} else {
					// Otherwise we just store it under a random id
					ref.child(IdGenerator.next()).set(ser);
				}
			}
		}
		
		export class ListEvent<T> implements IListEvent<T> {
			public add :AddedListEvent<T>;
			public remove :Event<T>;
			public modify :Event<T>;
			public all :Event<T>;
			public full :ArrayValueEvent<T>;
			
			private name :string = null;
			private allEvts :Event<T|T[]>[] = [];
			
			private _sortField :string = null;
			private _sortDesc :boolean = false;
			private _limit :number = 0;
			private _rangeFrom :any = null;
			private _rangeTo :any = null;
			private _equals :any = null;
			
			protected _url :string = null;
			protected _db :Db = null;
			protected _entity :Entity = null;
			
			protected _ctorD :new ()=>Data = null;
			
			constructor() {
				this.add = new AddedListEvent<T>();
				this.remove = new Event<T>();
				this.modify = new Event<T>();
				this.all = new AddedListEvent<T>();
				this.full = new ArrayValueEvent<T>();
				this.add.events = ['child_added'];
				this.remove.events = ['child_removed'];
				this.modify.events = ['child_changed','child_moved'];
				this.all.events = ['child_added','child_removed','child_changed','child_moved'];
				this.allEvts = [this.add, this.remove, this.modify, this.all, this.full];
				for (var i = 0; i < this.allEvts.length; i++) {
					var ae = this.allEvts[i];
					ae.hrefIniter = (h) => this.setupHref(h);
				}
			}
			
			named(name :string) {
				if (this.name) return this;
				this.name = name;
				for (var i = 0; i < this.allEvts.length; i++) this.allEvts[i].named(name);
				return this;
			}
			
			objD(c :new ()=>Data) {
				this._ctorD = c;
				for (var i = 0; i < this.allEvts.length; i++) {
					var ae = this.allEvts[i];
					ae._ctorD = c;
					ae._isRef = false;
				}
				return this;
			}
			
			/**
			 * Called by the ObjC when the url is set.
			 */
			dbInit(url :string, db :Db, entity :Entity) {
				this._url = url;
				this._db = db;
				this._entity = entity;
				for (var i = 0; i < this.allEvts.length; i++) {
					this.allEvts[i].dbInit(url, db, entity);
				}
			}
			
			subQuery() :ListEvent<T> {
				var ret = new ListEvent<T>();
				ret.named(this.name);
				if (this._ctorD) {
					ret.objD(this._ctorD);
				}
				ret._sortField = this._sortField;
				ret._sortDesc = this._sortDesc;
				ret._limit = this._limit;
				ret._rangeFrom = this._rangeFrom;
				ret._rangeTo = this._rangeTo;
				ret._equals = this._equals;
				ret.dbInit(this._url, this._db, this._entity);
				return ret;
			}
			
			sortOn(field :string, desc = false) {
				this._sortField = field;
				this._sortDesc = desc;
				return this;
			}
			
			limit(limit :number) {
				this._limit = limit;
				return this; 
			}
			
			range(from :any, to :any) {
				this._rangeFrom = from;
				this._rangeTo = to;
				return this;
			}
			
			equals(val :any) {
				this._equals = val;
				return this;
			}
			
			
			protected setupHref(h :EventHandler<T|T[]>) {
				h._ref = new Firebase(h.event.url);
				if (this._sortField) {
					h._ref = h._ref.orderByChild(this._sortField);
					if (this._rangeFrom) {
						h._ref = h._ref.startAt(this._rangeFrom);
					}
					if (this._rangeTo) {
						h._ref = h._ref.startAt(this._rangeTo);
					}
					if (this._equals) {
						h._ref = h._ref.equalTo(this._equals);
					}
				}
				if (this._sortDesc) {
					if (this._limit) {
						h._ref = h._ref.limitToLast(this._limit);
					} else {
						h._ref = h._ref.limitToLast(Number.MAX_VALUE);
					}
				} else {
					if (this._limit) {
						h._ref = h._ref.limitToFirst(this._limit);
					}
				}
			}
	
		}
	
		export interface EventDetachable {
			eventAttached(event :Event<any>);
		}
	}
}
