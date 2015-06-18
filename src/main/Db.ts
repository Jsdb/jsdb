/// <reference path="../../typings/tsd.d.ts" />


import Firebase = require('firebase');
import Io = require('socket.io');


export = Db;
class Db {
	private descriptions :{[index:string]:new ()=>Db.ObjC<any>} = {};
	private instances :{[index:string]:Db.ObjC<any>} = {};
	private socket :SocketIO.Socket;
	
	setSocket(socket :SocketIO.Socket) {
		this.socket = socket;
	}
	
	sendOnSocket(url :string, payload :any) {
		this.socket.emit(url, payload);
	}
	
	load(url :string):Db.ObjC<any> {
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
	
	register(baseUrl :string, ctor :new ()=>Db.ObjC<any>) {
		this.descriptions[baseUrl] = ctor;
	}
	
	computeUrl(inst :Db.ObjC<any>) {
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
	export function data<V extends ObjD<any>>(c :new ()=>V) :internal.IValueEvent<V> {
		var ret = new internal.ValueEvent<V>();
		ret.objD(c);
		return ret;
	}
	export function reference<V extends ObjC<any>>(c :new ()=>V) :internal.IValueEvent<V> {
		var ret = new internal.ValueEvent<V>();
		return ret;
	}
	
	export function dataList<V extends ObjD<any>>(c :new ()=>V) :internal.IListEvent<V> {
		var ret = new internal.ListEvent<V>();
		ret.objD(c);
		return ret;
	}
	export function referenceList<V extends ObjC<any>>(c :new ()=>V) :internal.IListEvent<V> {
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
	
	export class ObjC<T> {
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
				ev.dbInit(url,db);
			}
		}
		
		equals(oth :ObjC<any>) {
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
						if (val instanceof ObjC) {
							return <ObjC<any>>val.url;
						}
						return val;
					}
				)
			);
		}
		
	}
	
	export class ObjD<T> {
		url: string;
		
		parse(url:string, obj :any, db :Db) {
			this.url = url;
			var ks = Object.keys(obj);
			for (var i = 0; i < ks.length; i++) {
				var k = ks[i];
				var v = obj[k];
				if (ObjD.isRef(v)) {
					v = ObjD.readRef(v, db);
				}
				this[k] = v;
			}
		}
		
		serialize(db :Db = null, ret :any = {}, projections :any = {}) {
			var ks = Object.keys(this);
			for (var i = 0; i < ks.length; i++) {
				var k = ks[i];
				if (k == 'url') continue;
				var v = this[k];
				if (v instanceof ObjC) {
					if (db) (<ObjC<any>>v).dbInit(null,db);
					(<ObjC<any>>v).serializeProjections(this.url, projections[k]);
					v = {
						_ref: (<ObjC<any>>v).url
					};
				} else if (v instanceof ObjD) {
					ret[k] = (<ObjD<any>>v).serialize(db, {}, projections[k]);
				}
				ret[k] = v;
			}
			return ret;
		}
		
		static isRef(data) :boolean {
			return data && !!data._ref;
		}
		
		static readRef<X>(data:any, db:Db) :ObjC<X> {
			if (!data) return null;
			if (typeof(data) === 'object') {
				var objc = db.load(data._ref);
				for (var k in data) {
					if (k == '_ref') continue;
					var proj = data[k];
					var event = <Db.internal.AccessEvent>objc.events[k];
					event.projectValue(proj);
				}
				return objc;
			} else {
				return db.load(data);
			}
		}
		
	}
	
	export module internal {
		export interface IEvent<V> {
			named(name :string) :IEvent<V>;
			on(ctx :any, handler: { (data?: V, detail?:IEventDetails<V>): void });
			once(ctx :any, handler: { (data?: V, detail?:IEventDetails<V>): void });
			off(ctx :any):any;
			hasHandlers() :boolean;
		}
		export interface IValueEvent<V> extends IEvent<V> {
			named(name :string) :IValueEvent<V>;
			broadcast(val :V):void;
		}
		
		export interface IListEvent<T> {
			add :IValueEvent<T>;
			remove :IEvent<T>;
			modify :IEvent<T>;
			all :IEvent<T>;

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
		
		export interface DbObjDescription<X extends Db.ObjC<any>> {
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
				(<AccessEvent><any>this.handler.event).offHandler(this.handler);
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
				//console.log(this.myprog + " : Listening on " + this._ref.toString() + " " + event, fn);
				//console.trace();
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
			protected url :string = null;
			/**
			 * Instance of the Db we are using
			 */
			protected db :Db = null;
			/**
			 * Constructor for the D object, if this event returns a D event
			 */
			protected _ctorD :new ()=>ObjD<any> = null;
			/**
			 * If this is a ref
			 */
			protected _isRef :boolean = true;
			
			protected events = ['value'];
			
			protected projVal :T = null;
			
			protected hrefIniter :(h :EventHandler<T>)=>void = this.setupHref;
			
			constructor() {
			}
			
			named(name :string) {
				if (this.name) return this;
				this.name = name;
				return this;
			}
			
			objD(c :new ()=>ObjD<any>) {
				this._ctorD = c;
				this._isRef = false;
				return this;
			}
			
			/**
			 * Called by the ObjC when the url is set.
			 */
			dbInit(url :string, db :Db) {
				this.url = url + '/' + this.name;
				this.db = db;
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
			
			protected offHandler(h :EventHandler<T>) {
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
				h.hook(name, (ds, pre) => {
					var evd = new EventDetails<T>();
					evd.payload = this.parseValue(ds.val(), ds.ref().toString());
					evd.originalEvent = name;
					evd.originalUrl = ds.ref().toString();
					evd.originalKey = ds.key();
					evd.precedingKey = pre;
					evd.populating = h.first;
					h.handle(evd);
				});
			}
			
			public off(ctx :any) {
				this.handlers = this.handlers.filter(h => !h.decomission(h.ctx === ctx));
			}
			
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
			
			protected parseValue(val, url? :string) {
				if (val) {
					if (this._ctorD) {
						var objd = new this._ctorD();
						objd.parse(url, val, this.db); 
						val = objd;
					} else if (this._isRef || ObjD.isRef(val)) {
						val = ObjD.readRef(val, this.db);
					}
				}
				return val;
			}
			
			protected projectValue(val) {
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
			
			named(name :string) {
				if (this.name) return this;
				super.named(name);
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
				if (val instanceof ObjC) {
					// TODO projections
					(<ObjC<any>><any>val).dbInit(null, this.db);
					return (<ObjC<any>><any>val).url;
				} else if (val instanceof ObjD) {
					// TODO projections
					return (<ObjD<any>><any>val).serialize(this.db);
				} else {
					return val;
				}
			}
			
			dbInit(url :string, db :Db) {
				super.dbInit(url, db);
				this.checkBroadcast;
			}
		}
		
		export class AddedListEvent<T> extends ValueEvent<T> {
			constructor() {
				super();
				this.events = ['child_added'];
			}
			
			protected projectValue(val) {
				// No support for projection of lists
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
				if (val instanceof ObjC) {
					// In case of objC we use the id ad a key, to assure uniqueness
					ref.child((<ObjC<any>><any>val).getId()).set(ser);
				} else if (val instanceof ObjD) {
					// For objD they don't have an id, if it was previously saved here we update it, otherwise it's considered new
					var objd = (<ObjD<any>><any>val);
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
			
			private name :string = null;
			private allEvts :Event<T>[] = [];
			
			private _sortField :string = null;
			private _sortDesc :boolean = false;
			private _limit :number = 0;
			private _rangeFrom :any = null;
			private _rangeTo :any = null;
			private _equals :any = null;
			
			protected _url :string = null;
			protected _db :Db = null;
			
			protected _ctorD :new ()=>ObjD<any> = null;
			
			constructor() {
				this.add = new AddedListEvent<T>();
				this.remove = new Event<T>();
				this.modify = new Event<T>();
				this.all = new AddedListEvent<T>();
				(<AccessEvent><any>this.add).events = ['child_added'];
				(<AccessEvent><any>this.remove).events = ['child_removed'];
				(<AccessEvent><any>this.modify).events = ['child_changed','child_moved'];
				(<AccessEvent><any>this.all).events = ['child_added','child_removed','child_changed','child_moved'];
				this.allEvts = [this.add, this.remove, this.modify, this.all];
				for (var i = 0; i < this.allEvts.length; i++) {
					var ae = (<AccessEvent><any>this.allEvts[i]);
					ae.hrefIniter = (h) => this.setupHref(h);
				}
			}
			
			named(name :string) {
				if (this.name) return this;
				this.name = name;
				for (var i = 0; i < this.allEvts.length; i++) this.allEvts[i].named(name);
				return this;
			}
			
			objD(c :new ()=>ObjD<any>) {
				this._ctorD = c;
				for (var i = 0; i < this.allEvts.length; i++) {
					var ae = (<AccessEvent><any>this.allEvts[i]);
					ae._ctorD = c;
					ae._isRef = false;
				}
				return this;
			}
			
			/**
			 * Called by the ObjC when the url is set.
			 */
			dbInit(url :string, db :Db) {
				this._url = url;
				this._db = db;
				for (var i = 0; i < this.allEvts.length; i++) {
					this.allEvts[i].dbInit(url, db);
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
				ret.dbInit(this._url, this._db);
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
			
			
			protected setupHref(h :EventHandler<T>) {
				h._ref = new Firebase((<AccessEvent><any>h.event).url);
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
		
		// TODO remove this
		export interface AccessEvent {
			url :string;
			parseValue(val :any):any;
			projectValue(val :any):any;
			_ctorD :new ()=>ObjD<any>;
			_isRef :boolean;
			events :string[];
			hrefIniter :(h :EventHandler<any>)=>void;
			offHandler(h :EventHandler<any>);
		}
	
		export interface EventDetachable {
			eventAttached(event :Event<any>);
		}
	}
}
