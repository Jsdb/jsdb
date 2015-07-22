/// <reference path="../../typings/tsd.d.ts" />


import Firebase = require('firebase');
import Io = require('socket.io');
import PromiseModule = require('es6-promise');

var Promise = PromiseModule.Promise;


export = Db;

class Db {
	baseUrl :string;
	
	cache :{[index:string]:any} = {};
	
	constructor(baseUrl :string) {
		this.baseUrl = baseUrl;
	}
	
	init() {
		var ks = Object.keys(this);
		for (var i = 0; i < ks.length; i++) {
			if (!(this[ks[i]] instanceof Db.internal.EntityRoot)) continue;
			var er = (<Db.internal.EntityRoot<any>>this[ks[i]]).named(ks[i]);
			er.initDb(this);
		}
	}
	
	// TODO make sure everything pass thru here
	load<T>(url :string, ctor? :new() => T) :T {
		var ret = this.cache[url];
		if (ret) return ret;
		if (!ctor) {
			var ks = Object.keys(this);
			for (var i = 0; i < ks.length; i++) {
				if (!(this[ks[i]] instanceof Db.internal.EntityRoot)) continue;
				var er = (<Db.internal.EntityRoot<any>>this[ks[i]]);
				if (url.indexOf(er.url) === 0) {
					ctor = er.constr;
					break;
				}
			}
		}
		if (!ctor) {
			throw "The url " + url + " is not bound by an entity root";
		}
		var inst = <any>new ctor();
		if (inst.dbInit) {
			inst.dbInit(url, this);
		}
		if (inst.load && inst.load.dbInit) {
			inst.load.dbInit(url, this);
		}
		this.cache[url] = inst;
		return inst;
	}
	
	save<E extends Db.Entity>(entity :E) {
		var entityEvent = (<Db.internal.EntityEvent<E>>entity.load); 
		if (!entityEvent.url) {
			this.assignUrl(entity);
		}
		return entity.save();
	}
	
	assignUrl<E extends Db.Entity>(entity :E) {
		var entityEvent = (<Db.internal.EntityEvent<E>>entity.load); 
		if (entityEvent.url) return;
		var ks = Object.keys(this);
		var root :Db.internal.EntityRoot<E> = null;
		for (var i = 0; i < ks.length; i++) {
			if (!(this[ks[i]] instanceof Db.internal.EntityRoot)) continue;
			var er = (<Db.internal.EntityRoot<any>>this[ks[i]]);
			if (er.constr == entity.constructor) {
				root = er;
				break;
			}
		}
		if (!root) throw "The class " + (entity.constructor) + " is not mapped to an entity root";
		var id = Db.internal.IdGenerator.next();
		entityEvent.dbInit(root.url + '/' + id, this);
	}
	
	reset() {
		for (var url in this.cache) {
			var e = this.cache[url];
			// TODO implement this total unhook?
			//e.load.offAll();
		}
		this.cache = {};
	}
}

module Db {
	
	export function entityRoot<E extends Entity>(c :new ()=>E) :internal.IEntityRoot<E> {
		return new internal.EntityRoot(c);
	}
	
	export function embedded<E extends Entity>(c :new ()=>E) : E {
		var ret = new c();
		return ret;
	}
	
	export function reference<E extends Entity>(c :new ()=>E) : internal.IReference<E> {
		var ret = new internal.ReferenceImpl<E>(c);
		return ret;
	}
	
	export function referenceBuilder<E extends Entity>(c :new()=>E) : new()=>internal.ReferenceImpl<E> {
		return <new() => internal.ReferenceImpl<E>><any>(function() {
			return new internal.ReferenceImpl<E>(c);
		});
	}
	
	export function list<E extends Entity>(c :new ()=>E) : internal.IList<E> {
		return new internal.ListImpl<E>(c);
	}
	
	export class Utils {
		static entitySerialize(e :Entity, fields? :string[]):any {
			if (e.serialize) {
				return e.serialize();
			}
			return Utils.rawEntitySerialize(e,fields);
		}
		static rawEntitySerialize(e :Entity, fields? :string[]):any {
			var ret = {};
			fields = fields || Object.keys(e);
			for (var i = 0; i < fields.length; i++) {
				var k = fields[i];
				if (k == 'load') continue;
				var v = e[k];
				if (typeof v === 'function') continue;
				if (v instanceof Entity) {
					v = Utils.entitySerialize(v);
				} else if (v.serialize) {
					v = v.serialize();
				}
				ret[k] = v;
			}
			return ret;
		}
	}
	
	export class Entity {
		load :internal.IEvent<any> = new internal.EntityEvent<any>(this);
		
		serialize : () => any;
		
		save() :Thenable<boolean> {
			var fu :(data:boolean|Thenable<boolean>)=>void = null;
			var fe :(err?:any)=>void;
			var ret = new Promise<boolean>((res,err) => {
				fu = res;
				fe = err;
			});

			var url = (<internal.EntityEvent<any>>this.load).url;
			if (!url) throw "Cannot save entity because it was not loaded from DB, use Db.save() instead";
			new Firebase(url).set(Utils.entitySerialize(this), (err) => {
				if (!err) {
					fu(true);
				} else {
					fe(err);
				}
			});
			
			return ret;
		}
		
		then<U>(onFulfilled?: (value: internal.IEventDetails<any>) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
		then<U>(onFulfilled?: (value: internal.IEventDetails<any>) => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U>;
		then<U>(onFulfilled?: (value: internal.IEventDetails<any>) => U | Thenable<U>, onRejected?: (error: any) => any): Thenable<U> {
			var fu :(data:U|Thenable<U>)=>void = null;
			var ret = new Promise<U>((res,err) => {
				fu = res;
			});
			this.load.once(this, (detail) => {
				if (!detail.projected) {
					if (onFulfilled) {
						fu(onFulfilled(detail));
					} else {
						fu(null);
					}
				}
			});
			return ret;
		}

	}
	
	export module internal {
		
		export interface IEntityRoot<E extends Entity> {
			named(name :string):IEntityRoot<E>;
			
			load(id:string):E;
			
			query() :IQuery<E>;
		}
		
		export interface IReference<E extends Entity> {
			load :IEvent<IReference<E>>;
			url :string;
			value :E;
			then<U>(onFulfilled?: (value: internal.IEventDetails<IReference<E>>) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
			then<U>(onFulfilled?: (value: internal.IEventDetails<IReference<E>>) => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U>;
		}
		
		export interface IEvent<V> {
			on(ctx :any, handler: { (detail?:IEventDetails<V>): void });
			once(ctx :any, handler: { (detail?:IEventDetails<V>): void });
			off(ctx :any):any;
			hasHandlers() :boolean;
		}
	
		
		export interface IEventDetails<V> {
			payload :V;
			populating :boolean;
			projected :boolean;
			listEnd :boolean;
			originalEvent :string;
			originalUrl :string;
			originalKey :string;
			precedingKey :string;
			
			offMe():void;
		}

		export interface ICollection<E> {
			// TODO load with specific event
			add :IEvent<E>;
			remove :IEvent<E>;
			//modify :IEvent<E>;
			
			query() :IQuery<E>;
		}
		
		export interface IList<E> extends ICollection<E> {
			value :E[];
			
			then<U>(onFulfilled?: () => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
			then<U>(onFulfilled?: () => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U>;
		}
		
		export interface IMap<E> extends ICollection<E> {
			value : {[index:string]:E};
		}
		
		export interface IQuery<E> extends IList<E> {
			sortOn(field :string, desc? :boolean):IQuery<E>;
			limit(limit :number):IQuery<E>;
			range(from :any, to :any):IQuery<E>;
			equals(val :any):IQuery<E>;
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

		
		export class EntityRoot<E extends Entity> implements IEntityRoot<E> {
			constr :new() => E = null;
			db :Db = null;
			//instances :{[index:string]:E} = {};
			name :string = null;
			url :string = null;
			
			constructor(c :new() => E) {
				this.constr = c;
			}
			
			named(name :string) {
				if (this.name) return;
				this.name = name;
				return this;
			}
			
			initDb(db :Db) {
				this.db = db;
				this.url = db.baseUrl + this.name + '/';
			}
			
			query() {
				var ret = new QueryImpl(this.constr);
				ret.dbInit(this.url, this.db);
				return ret;
			}

			
			load(id:string):E 
			load(url:string) :E {
				if (url.indexOf(this.url) === -1) {
					url = this.url + url;
				}
				return this.db.load(url, this.constr);
			}
			
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
				public method :(detail?:EventDetails<T>)=>void
			) {}
			
			hook(event :string, fn :(dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void) {
				this._cbs.push({event:event, fn:fn});
				// TODO do something on cancelCallback? It's here only because of method signature
				this._ref.on(event, fn, (err) => {}, this);
			}
			
			decomission(remove :boolean):boolean {
				// override off, must remove only this instance callbacks, Firebase does not
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
				// the after is executed before to avoid bouncing
				if (this.after) this.after(this);
				try {
					this.method.call(this.ctx, evd);
				} finally {
				}
				//console.log("Then calling", this.after);
			}
			
		}
		
		export class Event<T> implements IEvent<T> {
			
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
			
			_preload :(p:Promise<T>)=>Promise<any> = null;
			
			events = ['value'];
			
			protected projVal :T = null;
			
			hrefIniter :(h :EventHandler<T>)=>void = this.setupHref;
			
			constructor() {
			}
			
			/**
			 * Called by the Entity when the url is set.
			 */
			dbInit(url :string, db :Db) {
				this.url = url;
				this.db = db;
				// At this point someone could already have registered some handler
				for (var i = 0; i < this.handlers.length; i++) {
					this.init(this.handlers[i]);
				}
			}
			
			public on(ctx :any, handler: { (detail?:EventDetails<T>): void }) {
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
			
			public once(ctx :any, handler: { (detail?:EventDetails<T>): void }) {
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
			
			offHandler(h :EventHandler<T>) {
				//console.log("Decommissioning ", handler);
				h.decomission(true);
				this.handlers = this.handlers.filter(ch => ch !== h);
			}
			
			protected init(h :EventHandler<T>) {
				this.hrefIniter(h);
				// TODO rewrite projections
				/*
				if (this.projVal) {
					var evd = new EventDetails<T>();
					evd.payload = this.projVal;
					evd.populating = true;
					evd.projected = true;
					h.handle(evd);
				}
				*/
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
			
			protected parseValue(val, url :string):T {
				throw "Default parse value is not implemented";
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
			
			// TODO rewrite projections
			/*
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
			*/
		}
		
		export class EntityEvent<T> extends Event<T> {
			
			/*
			static getEventFor<T>(x:T):EntityEvent<T> {
				return (<EntityEvent<T>>(<Entity><any>x).load);
			}
			*/
			
			myEntity :T = null;
			
			constructor(myEntity :T) {
				super();
				this.myEntity = myEntity;
			}
			
			dbInit(url :string, db :Db) {
				super.dbInit(url,db);
				var ks = Object.keys(this.myEntity);
				for (var i = 0; i < ks.length; i++) {
					var se = this.myEntity[ks[i]];
					if (se == null) continue;
					// Avoid looping on myself
					if (se === this) continue;
					if (typeof se === 'object') {
						if (se.dbInit) {
							se.dbInit(url +'/' + ks[i], db);
						} else if (se.load && se.load != null && se.load.dbInit) {
							se.load.dbInit(url +'/' + ks[i], db);
						}
					}
				}
			}

			parseValue(val, url? :string):T {
				if (!val) {
					console.log("Value is ", val);
					return;
				}
				var ks = Object.keys(val);
				for (var i = 0; i < ks.length; i++) {
					var prev = this.myEntity[ks[i]];
					if (prev instanceof Entity) {
						(<EntityEvent<any>>(<Entity>prev).load).parseValue(val[ks[i]]);
					} else {
						// TODO handle collections
						this.myEntity[ks[i]] = val[ks[i]];
					}
				}
				return <T><any>this.myEntity;
			}
		}
		
		export class ReferenceEvent<E extends Entity> extends EntityEvent<ReferenceImpl<E>> {
			constructor(myEntity :ReferenceImpl<any>) {
				super(myEntity);
			}
			
			parseValue(val, url? :string):ReferenceImpl<E> {
				if (!val) {
					console.log("Value is ", val, url);
					return;
				}
				if (!val._ref) {
					console.log("No _ref for reference in ", val, url);
					return;
				}
				// passing the constructor here to the db.load method, we have reference to nested objects
				this.myEntity.value = this.db.load(val._ref,this.myEntity._ctor);
				this.myEntity.url = val._ref;
				
				// TODO parse the value for projections

				return this.myEntity;
			}

		}

		
		export class ReferenceImpl<E extends Entity> extends Entity implements IReference<E> {
			_ctor : new() => E;
			load = new ReferenceEvent<E>(this);
			url: string;
			value: E = null;
			constructor(c : new() => E) {
				super();
				this._ctor = c;
			}
		}
		
		export class CollectionEntityEvent<E> extends Event<E> { 
			ctor :new ()=>E;
			
			constructor(c :new ()=>E) {
				super();
				this.ctor = c;
			}
			
			parseValue(val, url? :string):E {
				// TODO should pass val here, for projections and to handle refs
				var e = this.db.load(url, this.ctor);
				//var e = new this.ctor();
				// TODO mess here, value returned form db.load is almost certainly an entity, and collections also handle entities, but it's not stated in generics
				var ev = (<EntityEvent<any>>(<any>e).load);
				ev.parseValue(val, url);
				return e;
			}
		}
		
		export class CollectionAddedEntityEvent<E> extends CollectionEntityEvent<E> {
			constructor(c :new ()=>E) {
				super(c);
				this.events = ['child_added'];
			}
			
			protected init(h :EventHandler<E>) {
				this.hrefIniter(h);
				for (var i = 0; i < this.events.length; i++) {
					this.setupEvent(h, this.events[i]);
				}
				h._ref.once('value', (ds) => {
					var evd = new EventDetails<E>();
					evd.listEnd = true;
					h.handle(evd);
					h.first = false
				});
			}

			
		}
		
		export class CollectionImpl<E> implements ICollection<E> {
			ctor :new ()=>E;
			db :Db;
			url :string;
			
			add :CollectionEntityEvent<E> = null;
			remove :CollectionEntityEvent<E> = null;
			
			constructor(c :new ()=>E) {
				this.ctor = c;
				this.add = new CollectionAddedEntityEvent<E>(c);
				this.remove = new CollectionEntityEvent<E>(c);
				this.remove.events = ['child_removed'];
				
				this.add.hrefIniter = (h) => this.setupHref(h);
				this.remove.hrefIniter = (h) => this.setupHref(h);
			}
			
			dbInit(url :string, db :Db) {
				this.db = db;
				this.url = url;
				this.add.dbInit(url, db);
				this.remove.dbInit(url, db);
			}
			
			query() {
				var ret = new QueryImpl(this.ctor);
				ret.dbInit(this.url, this.db);
				return ret;
			}
			
			protected setupHref(h :EventHandler<E>) {
				h._ref = new Firebase(h.event.url);
			}
		}
		
		export class ListImpl<E> extends CollectionImpl<E> implements IList<E> {
			value :E[] = [];
			
			then<U>(onFulfilled?: () => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>
			then<U>(onFulfilled?: () => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U> {
				var fu :(data:U|Thenable<U>)=>void = null;
				var ret = new Promise<U>((res,err) => {
					fu = res;
				});
				var vals :E[] = [];
				this.add.on(this, (detail) => {
					if (detail.listEnd) {
						detail.offMe();
						this.value = vals;
						if (onFulfilled) {
							fu(onFulfilled());
						} else {
							fu(null);
						}
					} else {
						vals.push(detail.payload);
					}
				});
				return ret;

			}

		}
		
		export class QueryImpl<E> extends ListImpl<E> implements IQuery<E> {
			
			private _sortField :string = null;
			private _sortDesc :boolean = false;
			private _limit :number = 0;
			private _rangeFrom :any = null;
			private _rangeTo :any = null;
			private _equals :any = null;

			
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
			
			protected setupHref(h :EventHandler<E>) {
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