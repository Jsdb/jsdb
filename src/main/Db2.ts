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
		} else if (inst.load && inst.load.dbInit) {
			inst.load.dbInit(url, this);
		}
		// TODO parse the value, in a way similar to dbInit
		this.cache[url] = inst;
		return inst;
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
	
	export function entityRoot<E extends Entity<any>>(c :new ()=>E) :internal.IEntityRoot<E> {
		return new internal.EntityRoot(c);
	}
	
	export function embedded<E extends Entity<any>>(c :new ()=>E) : E {
		var ret = new c();
		return ret;
	}
	
	export function reference<E extends Entity<any>>(c :new ()=>E) : internal.IReference<E> {
		var ret = new internal.ReferenceImpl<E>(c);
		return ret;
	}
	
	export function list<E extends Entity<any>>(c :new ()=>E) : internal.IList<E> {
		return new internal.ListImpl<E>(c);
	}
	
	export function referenceList<E extends Entity<any>>(c :new() => E) : internal.IList<internal.IReference<E>> {
		return list(<new() => internal.ReferenceImpl<E>><any>(function() {
			return new internal.ReferenceImpl<E>(c);
		}));
	}
	
	export class Entity<R> {
		load :internal.IEvent<R> = new internal.EntityEvent<R>(this);
		
		
		then<U>(onFulfilled?: (value: internal.IEventDetails<R>) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
		then<U>(onFulfilled?: (value: internal.IEventDetails<R>) => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U>;
		then<U>(onFulfilled?: (value: internal.IEventDetails<R>) => U | Thenable<U>, onRejected?: (error: any) => any): Thenable<U> {
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
		
		export interface IEntityRoot<E extends Entity<any>> {
			named(name :string):IEntityRoot<E>;
			
			load(id:string):E;
			save(entity :E);
		}
		
		export interface IReference<E extends Entity<any>> {
			load :IEvent<IReference<E>>;
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
		}
		
		export interface IList<E> extends ICollection<E> {
			value :E[];
		}
		
		export interface IMap<E> extends ICollection<E> {
			value : {[index:string]:E};
		}
		
		
		export class EntityRoot<E extends Entity<any>> implements IEntityRoot<E> {
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
			
			load(id:string):E 
			load(url:string) :E {
				if (url.indexOf(this.url) === -1) {
					url = this.url + url;
				}
				return this.db.load(url, this.constr);
			}
			
			
			save(entity :E) {
				// TODO implement
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
				this.method.call(this.ctx, evd);
				//console.log("Then calling", this.after);
				if (this.after) this.after(this);
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
			
			static getEventFor<T>(x:T):EntityEvent<T> {
				return (<EntityEvent<T>>(<Entity<T>><any>x).load);
			}
			
			myEntity :Entity<T> = null;
			
			constructor(myEntity :Entity<T>) {
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
						EntityEvent.getEventFor(prev).parseValue(val[ks[i]]);
					} else {
						// TODO handle collections
						this.myEntity[ks[i]] = val[ks[i]];
					}
				}
				return <T><any>this.myEntity;
			}
		}
		
		export class ReferenceEvent<T extends ReferenceImpl<any>> extends EntityEvent<T> {
			myEntity :ReferenceImpl<T> = null;
			
			constructor(myEntity :ReferenceImpl<any>) {
				super(myEntity);
			}
			
			parseValue(val, url? :string):T {
				if (!val) {
					console.log("Value is ", val, url);
					return;
				}
				if (!val._ref) {
					console.log("No _ref for reference in ", val, url);
					return;
				}
				// TODO passing the constructor here and passing it to the load, we ould have reference to nested objects
				// TODO passing value here can make projections
				this.myEntity.value = this.db.load(val._ref,this.myEntity._ctor);
				return <T><any>this.myEntity;
			}

		}

		
		export class ReferenceImpl<E extends Entity<any>> extends Entity<IReference<E>> {
			_ctor : new() => E;
			load = new ReferenceEvent<ReferenceImpl<E>>(this);
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
				var ev = EntityEvent.getEventFor(e);
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
			add :CollectionEntityEvent<E> = null;
			remove :CollectionEntityEvent<E> = null;
			
			constructor(c :new ()=>E) {
				this.add = new CollectionAddedEntityEvent<E>(c);
				this.remove = new CollectionEntityEvent<E>(c);
				this.remove.events = ['child_removed'];
			}
			
			dbInit(url :string, db :Db) {
				this.add.dbInit(url, db);
				this.remove.dbInit(url, db);
			}
		}
		
		export class ListImpl<E> extends CollectionImpl<E> implements IList<E> {
			// TODO implement correct value handling
			value = [];
		}

		export interface EventDetachable {
			eventAttached(event :Event<any>);
		}

	}
}