import Firebase = require('firebase');
import PromiseModule = require('es6-promise');

var Promise = PromiseModule.Promise;

interface WeakMap<K, V> {
	clear(): void;
	delete(key: K): boolean;
	get(key: K): V;
	has(key: K): boolean;
	set(key: K, value?: V): WeakMap<K, V>;
}

interface WeakMapConstructor {
	new (): WeakMap<any, any>;
	new <K, V>(): WeakMap<K, V>;
	prototype: WeakMap<any, any>;
}
declare var WeakMap: WeakMapConstructor;


var defaultDb :Db.Internal.IDb3Static = null;

module Db {
	
	export function configure(conf :any) {
		defaultDb = Db.Internal.createDb(conf);
		return defaultDb;
	}
	
	export function getDefaultDb() {
		return defaultDb;
	}
	
	/**
	 * Empty interface, and as such useless in typescript, just to name things.
	 */
	export interface Entity {}
	
	/**
	 * Definition of a constructor, used not to write it always. (could use new "type" keyword)
	 */
	/*
	export interface EntityType {
		new():Entity;
	}
	*/
	export interface EntityType<T extends Entity> {
		 new(): T;
	}

	export module Internal {
		
		export function createDb(conf:any) :IDb3Static {
			var state = new DbState();
			state.configure(conf);
			var db = <IDb3Static><any>function(param:any):any {
				if (lastExpect === lastCantBe) {
					if (param) clearLastStack();
				} else if (param !== lastExpect) {
					clearLastStack();
				}
				var e = lastEntity;
				var stack = lastMetaPath;
				clearLastStack();
				
				// if no arguments return operations
				if (arguments.length == 0) {
					return new DbOperations(state);
				}
				if (typeof param == 'function') {
					return state.entityRoot(param);
				} else if (!e) {
					e = param;
				}
				
				var ret = state.createEvent(e, stack);
				return ret;
			};
			state.db = db;
			return db;
		}
		
		export type nativeArrObj = 
			number|string|boolean
			|{[index:string]:string|number|boolean}
			|{[index:number]:string|number|boolean}
			|number[]|string[]|boolean[];
		
		export interface IDb3Static {
			():IDbOperations;
			
			<T extends Entity>(c :EntityType<T>) :IEntityRoot<T>;
			
			(meta :MetaDescriptor,entity :Entity):any;

			<V extends nativeArrObj>(value :V) :IObservableEvent<V>;

			// TODO maybe differentiate map and set/list interfaces
			<T extends Entity>(map :{[index:string]:T}) :IMapEvent<T>

			<T extends Entity>(list :T[]) :IListSetEvent<T>;
			
			<T extends Entity>(entity :T) :IEntityOrReferenceEvent<T>;
			
			
		}
		
		export interface IDb3Initable {
			dbInit?(url :string, db :IDb3Static);
		}
		/*
		export interface IDb3Annotated {
			__dbevent :GenericEvent;
		}
		*/
		
		export interface IDbOperations {
			fork(conf :any) :IDb3Static;
			load<T extends Entity>(url :string) :T;
			reset();
		}
		
		export class DbOperations implements IDbOperations {
			constructor(public state:DbState) {
				
			}
			
			fork(conf :any) :IDb3Static {
				var nconf = {};
				Utils.copyObj(this.state.conf, nconf);
				Utils.copyObj(conf, nconf);
				return createDb(nconf);
			}
			
			load<T extends Entity>(url :string) :T {
				return <T>this.state.load(url);
			}
			
			reset() {
				this.state.reset();
			}
		}
		
		export interface IBinding {
			bind(localName :string, targetName :string, live? :boolean);
		}
		
		export interface BindingState {
			vals :any[];
			evts :GenericEvent[];
		}
		
		export class BindingImpl implements IBinding {
			keys :string[] = [];
			bindings : {[index:string]:string} = {};
			live : {[index:string]:boolean} = {};
			bind(local :string, remote :string, live :boolean = true):IBinding {
				this.keys.push(local);
				this.bindings[local] = remote;
				this.live[local] = live;
				return this;
			}
			
			startLoads(metadata :ClassMetadata, state :DbState, parent :Entity) :Promise<BindingState> {
				var proms :Thenable<any>[] = [];
				var evts :GenericEvent[] = [];
				for (var i = 0; i < this.keys.length; i++) {
					var k = this.keys[i];
					if (k === 'this') {
						proms.push(Promise.resolve(parent));
						continue;
					}
					var descr = metadata.descriptors[k];
					if (!descr) throw Error('Cannot find ' + k + ' for binding');
					var evt = state.createEvent(parent, [descr]);
					evts.push(evt);
					if (evt['load']) {
						proms.push((<IEntityOrReferenceEvent<any>><any>evt).load(parent));
					}
					/*
					var val = parent[k];
					if (val instanceof ReferenceImpl) {
						var ri = <ReferenceImpl<any>>val;
						proms.push(ri.then(() => {
							return ri.value;
						}));
						// TODO keep it live if required
					} else if (val instanceof Entity) {
						proms.push(Promise.resolve(<Entity>val));
					} else {
						proms.push(Promise.resolve(val));
					}
					*/
				}
				return Promise.all(proms).then((vals) => {
					return {
						vals : vals,
						evts : evts
					};
				});
			}
			
			resolve(tgt:Entity, result :BindingState) {
				var vals = result.vals;
				var evts = result.evts;
				//console.log("Done values ", vals);
				for (var i = 0; i < this.keys.length; i++) {
					var k = this.keys[i];
					var val = vals[i];
					if (val instanceof EventDetails) {
						val = (<EventDetails<any>>val).payload;
					}
					if (this.live[k]) {
						var evt = evts[i];
						if (!evt['updated']) throw new Error('Cannot find an updated event to keep ' + k + ' live');
						// Wrapping in closure for 'k'
						((k:string) => {
							(<IEntityOrReferenceEvent<any>><any>evt).updated(tgt,(updet) => {
								tgt[this.bindings[k]] = updet.payload;
							});
						})(k);
					} else {
						tgt[this.bindings[k]]= val;
					}
				}
			}
		}
		
		export interface SortingData {
			field :string;
			desc?: boolean;
		}
		
		export interface IUrled {
			getUrl(evenIfIncomplete?:boolean) :string;
		}
		
		export enum EventType {
			UNDEFINED,
			UPDATE,
			REMOVED,
			ADDED,
			LIST_END
		}
		
		export class EventDetails<T> {
			type :EventType = EventType.UNDEFINED; 
			payload :T = null;
			populating = false;
			projected = false;
			originalEvent :string = null;
			originalUrl :string = null;
			originalKey :string = null;
			precedingKey :string = null;
			private handler :EventHandler = null;
			private offed = false;
			
			setHandler(handler :EventHandler) {
				this.handler = handler;
			}
			
			offMe() {
				this.handler.offMe();
				this.offed = true;
			}
			
			wasOffed() :boolean {
				return this.offed;
			}
			
			clone() :EventDetails<T> {
				var ret = new EventDetails<T>();
				ret.type = this.type;
				ret.payload = this.payload;
				ret.populating = this.populating;
				ret.projected = this.projected;
				ret.originalEvent = this.originalEvent;
				ret.originalUrl = this.originalUrl;
				ret.originalKey = this.originalKey;
				ret.precedingKey = this.precedingKey;
				return ret;
			}
		}
 
		export class EventHandler {
			static prog = 1;
			myprog = EventHandler.prog++;

			ctx:Object;
			event :GenericEvent;
			callback :(ed:EventDetails<any>)=>void;
			discriminator :any = null;
			after: (h?:EventHandler)=>any;
			private canceled = false;
			
			constructor(ctx? :Object, callback? :(ed:EventDetails<any>)=>void, discriminator :any = null) {
				this.ctx = ctx;
				this.callback = callback;
				this.discriminator = discriminator;
			}
			
			equals(oth :EventHandler) {
				return this.ctx == oth.ctx && this.callback == oth.callback && this.discriminator == oth.discriminator;
			}
			
			decomission(remove :boolean):boolean {
				// override off, must remove only this instance callbacks, Firebase does not
				if (remove) {
					this.canceled = true;
				}
				return remove;
			}

			handle(evd :EventDetails<any>) {
				if (this.canceled) {
					console.warn(this.myprog + " : Receiving events on canceled handler", evd);
					console.trace();
					return;
				}
				//console.log("Handling", evd);
				//console.trace();
				evd = evd.clone();
				evd.setHandler(this);
				// the after is executed before to avoid bouncing
				if (this.after) this.after(this);
				try {
					this.callback.call(this.ctx, evd);
				} finally {
				}
				//console.log("Then calling", this.after);
			}
			
			offMe() {
				this.event.offHandler(this);
			}
		}
		
		export class DbEventHandler extends EventHandler {
			ref :FirebaseQuery;
			protected cbs :{event:string; fn :(dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void}[] = [];

			hook(event :string, fn :(dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void) {
				this.cbs.push({event:event, fn:fn});
				// TODO do something on cancelCallback? It's here only because of method signature
				this.ref.on(event, fn, (err) => {});
			}
			
			decomission(remove :boolean):boolean {
				// override off, must remove only this instance callbacks, Firebase does not
				if (remove) {
					for (var i = 0; i < this.cbs.length; i++) {
						var cb = this.cbs[i];
						this.ref.off(cb.event, cb.fn);
					}
				}
				return super.decomission(remove);
			}
		}
		
		export class GenericEvent implements IUrled {
			entity :Entity;
			url :string;
			state :DbState;
			parent :GenericEvent;
			private children :{[index:string]:GenericEvent} = {};
			private dependants :GenericEvent[] = [];
			private _classMeta :ClassMetadata = null;
			private _originalClassMeta :ClassMetadata = null;

			/**
			 * Array of current handlers.
			 */
			protected handlers :EventHandler[] = [];
			
			setEntity(entity :Entity) {
				this.entity = entity;
				if (entity && typeof entity == 'object') {
					this.state.entEvent.set(this.entity, this);
					/*
					var dbacc = <IDb3Annotated>this.entity;
					if (!dbacc.__dbevent) {
						Object.defineProperty(dbacc, '__dbevent', {readable:true, writable:true, enumerable:false});
						dbacc.__dbevent = this;
					}
					*/
				}
				// TODO clean the children if entity changed? they could be pointing to old instance data
			}
			
			set classMeta(meta :ClassMetadata) {
				if (!this._originalClassMeta) this._originalClassMeta = meta;
				this._classMeta = meta;
				// TODO clean the children that are not actual anymore now that the type changed?
			}
			
			get classMeta() :ClassMetadata {
				return this._classMeta;
			}
			
			get originalClassMeta() :ClassMetadata {
				return this._originalClassMeta;
			}
			
			getUrl(evenIfIncomplete = false):string {
				if (!this.parent) {
					if (this.url) return this.url;
					if (!evenIfIncomplete) return null;
					if (!this.entity) return "<Unknown instance>";
					return "<Unknown instance of " + Utils.findName(this.entity.constructor) + ">";
				}
				var pre = this.parent.getUrl(evenIfIncomplete);
				if (pre == null) return null;
				return pre + this.url + '/';
			}
			
			urlInited() {
				for (var i = 0; i < this.handlers.length; i++) {
					this.init(this.handlers[i]);
				}
				for (var k in this.children) {
					if (k == 'constructor') continue;
					this.children[k].urlInited();
				}
				for (var i = 0; i < this.dependants.length; i++) {
					this.dependants[i].urlInited();
				}
				this.saveChildrenInCache();
			}
			
			on(handler:EventHandler) {
				this.handlers = this.handlers.filter(h => !h.decomission(h.equals(handler)));
				handler.event = this;
				this.handlers.push(handler);
				// At this point the url could not yet have been set
				if (this.getUrl(false)) {
					this.init(handler);
				}
			}
			
			off(ctx :Object,callback? :(ed:EventDetails<any>)=>void) {
				if (callback) {
					this.handlers = this.handlers.filter(h => !h.decomission(h.ctx === ctx && h.callback === callback));
				} else {
					this.handlers = this.handlers.filter(h => !h.decomission(h.ctx === ctx));
				}
			}
			
			offHandler(h :EventHandler) {
				h.decomission(true);
				this.handlers = this.handlers.filter(ch => ch !== h);
			}
			
			offAll() {
				this.handlers = this.handlers.filter(h => !h.decomission(true));
			}
			
			protected init(h :EventHandler) {
				throw new Error("Implement init in GenericEvent subclasses");
			}
			
			protected broadcast(ed :EventDetails<any>) {
				this.handlers.filter((h) => { h.handle(ed); return true; });
			}

			findCreateChildFor(key :String, force? :boolean):GenericEvent
			findCreateChildFor(meta :MetaDescriptor, force? :boolean):GenericEvent
			findCreateChildFor(param :any, force = false):GenericEvent {
				var meta:MetaDescriptor = null;
				if (param instanceof MetaDescriptor) {
					meta = <MetaDescriptor>param;
				} else {
					meta = this.classMeta.descriptors[param];
				}
				if (!meta) return null;
				var ret = this.children[meta.localName];
				//if (ret && !force) return ret;
				if (ret && this.entity) {
					ret.setEntity(this.entity[meta.localName]);
					return ret;
				}
				ret = meta.createEvent(this.state.myMeta);
				ret.state = this.state;
				ret.parent = this;
				if (this.entity) {
					ret.setEntity(this.entity[meta.localName]);
				}
				this.children[meta.localName] = ret;
				this.saveChildrenInCache();
				return ret;
			}
			
			saveChildrenInCache(key? :string) {
				if (!this.getUrl()) return;
				if (key) {
					this.state.storeInCache(this.children[key]);
				} else {
					for (var k in this.children) {
						this.state.storeInCache(this.children[k]);
					}
				}
			}
			
			parseValue(ds :FirebaseDataSnapshot) {
				throw new Error("Please override parseValue in subclasses of GenericEvent");
			}
			
			isTraversingTree() :boolean {
				return false;
			}
			
			getTraversed() :GenericEvent {
				return null;
			}
			
			serialize(localsOnly:boolean = false, fields? :string[]) :Object {
				throw new Error("Please override serialize in subclasses of GenericEvent");
			}
			
			isLocal() :boolean {
				return false;
			}
		}
		
		export interface IEntityOrReferenceEvent<E extends Entity> extends IUrled {
			// Entity methods
			load(ctx:Object) :Promise<EventDetails<E>>;
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			live(ctx:Object) :void;
			
			
			// Reference methods
			dereference(ctx:Object) :Promise<EventDetails<E>>;
			referenced(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			getReferencedUrl() :string;
			
			// Handling methods
			off(ctx:Object) :void;
			isLoaded():boolean;
			assertLoaded():void;
			assignUrl():void;
			save():Promise<any>;
			clone() :E;
		}
		
		export class SingleDbHandlerEvent<E> extends GenericEvent {
			loaded = false;
			dbhandler :DbEventHandler = null;
			lastDetail :EventDetails<E> = null;
			
			init(h :EventHandler) {
				if (this.dbhandler == null) {
					this.lastDetail = null;
					this.dbhandler = new DbEventHandler(this, this.mockCb);
					// TODO this should not be here, the url could be not yet set
					// TODO are you sure? the init of handlers should be after the url is set
					this.dbhandler.ref = new Firebase(this.getUrl());
					this.dbhandler.hook('value', (ds,prev) => this.handleDbEvent(ds,prev));
				} else {
					if (this.lastDetail) {
						h.handle(this.lastDetail);
					}
				}
			}
			
			mockCb() {}
			
			off(ctx:Object, callback? :(ed:EventDetails<E>)=>void) {
				super.off(ctx, callback);
				this.checkDisconnect();
			}
			
			offHandler(h :EventHandler) {
				super.offHandler(h);
				this.checkDisconnect();
			}
			
			checkDisconnect() {
				if (this.handlers.length == 0) {
					if (this.dbhandler) {
						this.dbhandler.decomission(true);
						this.dbhandler = null;
					}
					this.lastDetail = null;
				}
			}
			
			handleDbEvent(ds :FirebaseDataSnapshot, prevName :string) {
				this.parseValue(ds);
				var evd = new EventDetails<E>();
				evd.type = EventType.UPDATE;
				if (this.entity == null) {
					evd.type = EventType.REMOVED;
				}
				evd.payload = <E>this.entity;
				evd.originalEvent = 'value';
				evd.originalUrl = ds.ref().toString();
				evd.originalKey = ds.key();
				evd.precedingKey = prevName;
				evd.projected = !this.loaded;
				this.lastDetail = evd;
				this.broadcast(this.lastDetail);
			}
			
		}
		
		export class EntityEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IEntityOrReferenceEvent<E> {
			nameOnParent :string = null;
			binding :BindingImpl = null;
			bindingPromise :Promise<BindingState> = null;
			
			lastDs :FirebaseDataSnapshot = null;
			
			progDiscriminator = 1;
			
			setEntity(entity :Entity) {
				super.setEntity(entity);
				// Update the local classMeta if entity type changed
				if (this.entity) {
					this.classMeta = this.state.myMeta.findMeta(this.entity);
				}
			}
			
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void, discriminator :any = null) :void {
				var h = new EventHandler(ctx, callback, discriminator);
				super.on(h);
			}
			
			handleDbEvent(ds :FirebaseDataSnapshot, prevName :string) {
				this.loaded = true;
				super.handleDbEvent(ds,prevName);
			}
			
			handleProjection(ds :FirebaseDataSnapshot) {
				if (this.loaded) return;
				super.handleDbEvent(ds, null);
			}
			
			init(h :EventHandler) {
				if (this.dbhandler == null) {
					// start here the preloading of the binding, if any
					if (this.binding) {
						var eeParent = <EntityEvent<any>>this.parent;
						if (!(eeParent instanceof EntityEvent)) throw Error('Cannot apply binding to ' + this.nameOnParent + ' because parent event is not an entity event');
						this.bindingPromise = this.binding.startLoads(eeParent.classMeta, this.state, eeParent.entity);
					}
				}
				super.init(h);
			}
			
			protected broadcast(ed :EventDetails<E>) {
				if (!this.bindingPromise) {
					super.broadcast(ed);
					return;
				}
				// wait here for resolution of the binding, if any
				this.bindingPromise.then((state) => {
					this.binding.resolve(ed.payload, state);
					super.broadcast(ed);
				});
			}
			

			
			parseValue(ds :FirebaseDataSnapshot) {
				this.loaded = true;
				this.lastDs = ds;
				var val = ds.val();
				if (val) {
					if (val['_dis']) {
						var cm = this.state.myMeta.findDiscriminated(this.originalClassMeta,val['_dis']);
						if (!cm) throw new Error("Cannot find a suitable subclass for discriminator " + val['_dis']);
						this.classMeta = cm;
					} else {
						this.classMeta = this.originalClassMeta;
					}
					// TODO disciminator : change here then this.classMeta
					if (!this.entity || !this.classMeta.rightInstance(this.entity)) {
						this.setEntity(this.classMeta.createInstance());
					}
					for (var k in val) {
						if (k == 'constructor') continue;
						var descr = this.classMeta.descriptors[k];
						// travel sub entities 
						if (descr) {
							var subev = this.findCreateChildFor(descr);
							subev.parseValue(ds.child(k));
							// TODO put this event on the cache
						} else {
							this.entity[k] = val[k];
						}
					}
				} else {
					this.setEntity(null);
				}
				// if it's embedded should set the value on the parent entity
				if (this.parent && this.nameOnParent) {
					this.parent.entity[this.nameOnParent] = this.entity;
				}
			}
			
			load(ctx:Object) :Promise<EventDetails<E>> {
				return new Promise<EventDetails<E>>((resolve,error) => {
					this.updated(ctx, (ed) => {
						ed.offMe();
						resolve(ed);
					}, this.progDiscriminator++);
				});
			}
			
			live(ctx:Object) {
				this.updated(ctx,()=>{});
			}
			
			isLoaded() {
				return this.loaded;
			}
			
			assertLoaded() {
				if (!this.loaded) throw new Error("Entity at url " + this.getUrl() + " is not loaded");
			}
			
			dereference(ctx:Object) :Promise<EventDetails<E>> {
				throw new Error("Can't dereference something that is not a reference");
			}
			
			referenced(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void {
				throw new Error("Can't dereference something that is not a reference");
			}
			
			getReferencedUrl() :string {
				throw new Error("Embedded entities don't have a referenced url");
			}
			
			serialize(localsOnly :boolean = false, fields? :string[]):Object {
				if (!this.entity) return null;
				if (typeof this.entity['serialize'] === 'function') {
					return this.entity['serialize'].apply(this.entity,[this]);
				}
				var ret = {};
				for (var k in this.entity) {
					if (fields && fields.indexOf(k) < 0) continue;
					var val = this.entity[k];
					if (typeof val === 'function') continue;

					var evt = this.findCreateChildFor(k);
					if (evt) {
						// TODO some events (like ignore or observable) should be called even if on locals only
						if (localsOnly && !evt.isLocal()) continue;
						val = evt.serialize();
						if (val !== undefined) {
							ret[k] = val;
						}
					} else {
						if (k.charAt(0) == '_') continue;
						ret[k] = val;
					}
				}
				if (this.classMeta.discriminator != null) {
					ret['_dis'] = this.classMeta.discriminator;
				}
				return ret;
			}
			
			assignUrl() {
				if (this.entity == null) throw new Error("The entity is null, can't assign an url to a null entity");
				if (this.getUrl()) return;
				var er = this.state.entityRoot(this.classMeta);
				if (!er) throw new Error("The entity " + Utils.findName(this.entity.constructor) + " doesn't have a root");
				var url = er.getUrl();
				var id = Db.Utils.IdGenerator.next();
				var disc = this.classMeta.discriminator || '';
				if (disc) disc+= '*';
				this.url = url + disc + id + '/';
				this.urlInited();
			}
			
			save():Promise<any> {
				if (this.loaded) {
					return new Promise<any>((ok,err) => {
						var fb = new Firebase(this.getUrl());
						fb.set(this.serialize(false), (fberr) => {
							if (fberr) {
								err(fberr);
							} else {
								ok(null);
							}
						});
					});
				} else if (this.getUrl()) {
					var proms :Promise<any>[] = [];
					// forward to sub events
					for (var k in this.entity) {
						if (k == 'constructor') continue;
						var se = this.findCreateChildFor(k);
						if (se && se['save']) {
							proms.push((<IEntityOrReferenceEvent<any>><any>se).save());
						}
					}
					// Update local fields if any
					if (this.entity) {
						var upd = this.serialize(true);
						if (!Utils.isEmpty(upd)) {
							proms.push(new Promise<any>((ok,err) => {
								var fb = new Firebase(this.getUrl());
								fb.update(upd, (fberr) => {
									if (fberr) {
										err(fberr);
									} else {
										ok(null);
									}
								});
							}));
						}
					}
					return Promise.all(proms);
				} else {
					this.assignUrl();
					// A newly created entity can be considered like a loaded one once it's saved
					this.loaded = true;
					return this.save();
				}
			}
			
			clone() :E {
				if (!this.loaded) throw new Error('Cannot clone an instance that has not been loaded');
				var nent = this.classMeta.createInstance();
				var evt = <EntityEvent<E>><any>this.state.db(nent);
				evt.parseValue(this.lastDs);
				return <E>evt.entity;
			}
		}
		
		export class ReferenceEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IEntityOrReferenceEvent<E> {
			classMeta :ClassMetadata = null;
			nameOnParent :string = null;
			project :string[] = null;
			
			pointedEvent :EntityEvent<E> = null;
			prevPointedEvent :EntityEvent<E> = null;
			
			progDiscriminator = 1;
			
			// Overridden to : 1) don't install this event 2) get pointedUrl
			setEntity(entity :Entity) {
				this.entity = entity;
				if (entity) {
					this.pointedEvent = <EntityEvent<E>>this.state.createEvent(entity,[]);
				} else {
					this.pointedEvent = null;
				}
			}
			
			load(ctx:Object) :Promise<EventDetails<E>> {
				return this.dereference(ctx).then((ed) => {
					ed.offMe();
					if (this.pointedEvent) return this.pointedEvent.load(ctx).then((ed)=>ed);
					return ed;
				});
			}
			
			private makeCascadingCallback(ed :EventDetails<E>, cb :(ed:EventDetails<E>)=>void) {
				return (subed:EventDetails<E>) => {
					cb(subed);
					if (subed.wasOffed()) {
						ed.offMe();
					}
				};
			}
			
			updated(ctx:Object, callback :(ed:EventDetails<E>)=>void, discriminator :any = null) :void {
				var precb = null;
				this.referenced(ctx, (ed) => {
					if (this.prevPointedEvent && precb) this.prevPointedEvent.off(ctx, precb); //, callback);
					if (this.pointedEvent) {
						precb = this.makeCascadingCallback(ed, callback);
						this.pointedEvent.updated(ctx, precb, callback);
					} else {
						callback(ed);
					}
				}, callback);
			}
			
			live(ctx:Object) {
				this.updated(ctx, () => {});
			}
			
			dereference(ctx:Object) :Promise<EventDetails<E>> {
				return new Promise<EventDetails<E>>((resolve,error) => {
					this.referenced(ctx, (ed) => {
						ed.offMe();
						resolve(ed);
					}, this.progDiscriminator++);
				});
			}
			
			referenced(ctx:Object, callback :(ed:EventDetails<E>)=>void, discriminator :any = null) :void {
				var h = new EventHandler(ctx, callback, discriminator);
				super.on(h);
			}
			
			handleDbEvent(ds :FirebaseDataSnapshot, prevName :string) {
				this.loaded = true;
				super.handleDbEvent(ds,prevName);
			}
			
			parseValue(ds :FirebaseDataSnapshot) {
				var val = ds.val();
				if (val && val._ref) {
					if (this.pointedEvent == null || this.pointedEvent.getUrl() != val._ref) {
						this.prevPointedEvent = this.pointedEvent;
						this.pointedEvent = <EntityEvent<E>>this.state.loadEventWithInstance(val._ref, this.classMeta);
						this.pointedEvent.handleProjection(ds);
						this.setEntity(this.pointedEvent.entity);
					}
				} else {
					this.prevPointedEvent = this.pointedEvent;
					this.pointedEvent = null;
					this.setEntity(null);
				}
				// set the value on the parent entity
				if (this.parent && this.nameOnParent) {
					this.parent.entity[this.nameOnParent] = this.entity;
				}
			}
			
			isLoaded() {
				return this.loaded;
			}
			
			assertLoaded() {
				if (!this.loaded) throw new Error("Reference at url " + this.getUrl() + " is not loaded");
			}
			
			getReferencedUrl() :string {
				if (!this.pointedEvent) return null;
				return this.pointedEvent.getUrl();
			}
			
			serialize(localsOnly :boolean = false):Object {
				if (!this.pointedEvent) return null;
				var obj = null;
				if (this.project) {
					obj = this.pointedEvent.serialize(false, this.project);
				} else {
					obj = {};
				}
				var url = this.pointedEvent.getUrl();
				var disc = this.pointedEvent.classMeta.discriminator || '';
				if (disc) disc = '*' + disc;
				url = url + disc;
				
				obj._ref = url
				return obj;
			}
			
			assignUrl() {
				if (!this.pointedEvent) throw new Error("The reference is null, can't assign an url to a null");
				this.pointedEvent.assignUrl();
			}
			
			save() {
				if (!this.pointedEvent) throw new Error("The reference is null, can't save it");
				return this.pointedEvent.save();
			}
			
			clone() :E {
				return this.pointedEvent.clone();
			}
		}
		
		export interface IReadableCollection<E extends Entity> {
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			live(ctx:Object) :void;
			
			// Collection events
			added(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			removed(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			changed(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			moved(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
		}
		
		export interface IGenericCollection<E extends Entity> extends IReadableCollection<E> {
			load(ctx:Object) :Promise<any>;
			dereference(ctx:Object) :Promise<any>;
			
			// Collection specific methods
			remove(key :string|number|Entity) :Promise<any>;
			fetch(ctx:Object, key :string|number|E) :Promise<EventDetails<E>>;
			with(key :string|number|Entity) :IEntityOrReferenceEvent<E>;
			
			// Handling methods
			off(ctx:Object) :void;
			isLoaded():boolean;
			assertLoaded():void;
			save():Promise<any>;
		}
		
		export interface IMapEvent<E extends Entity> extends IGenericCollection<E> {
			add(key :string|number|Entity, value :E) :Promise<any>;
		}

		export interface IListSetEvent<E extends Entity> extends IGenericCollection<E> {
			add(value :E) :Promise<any>;
			pop() :Promise<EventDetails<E>>;
			peekTail() :Promise<EventDetails<E>>;
			
			unshift(value :E):Promise<any>;
			shift() :Promise<EventDetails<E>>;
			peekHead() :Promise<EventDetails<E>>;
		}
		
		export class CollectionDbEventHandler extends DbEventHandler {
			dbEvents :string[] = null;
			istracking = false;
			ispopulating = false;
			
			hookAll(fn :(dataSnapshot: FirebaseDataSnapshot, prevChildName?: string, event?:string) => void) {
				for (var i = 0; i < this.dbEvents.length; i++) {
					this.hook(this.dbEvents[i], fn);
				}
			}
			
			hook(event :string, fn :(dataSnapshot: FirebaseDataSnapshot, prevChildName?: string,event?:string) => void) {
				super.hook(event, (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => fn(dataSnapshot, prevChildName || '', event));
			}
			
			unhook(event :string) {
				for (var i = 0; i < this.cbs.length; i++) {
					var cb = this.cbs[i];
					if (cb.event != event) continue;
					this.ref.off(cb.event, cb.fn);
				}
			}
			
		}

		export class MapEvent<E extends Entity> extends GenericEvent implements IMapEvent<E> {
			isReference :boolean = false;
			nameOnParent :string = null;
			project :string[] = null;
			binding :BindingImpl = null;
			sorting :SortingData = null;
			
			realField :any = null;
			loaded :boolean = false;
			
			setEntity(entity :Entity) {
				var preEntity = this.entity || {};
				super.setEntity(entity);
				this.realField = entity;
				this.entity = preEntity;
			}
			
			added(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void {
				var h = new CollectionDbEventHandler(ctx, callback);
				h.dbEvents = ['child_added','value'];
				h.ispopulating = true;
				super.on(h);
			}
			
			removed(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void {
				var h = new CollectionDbEventHandler(ctx, callback);
				h.dbEvents = ['child_removed'];
				super.on(h);
			}
			
			changed(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void {
				var h = new CollectionDbEventHandler(ctx, callback);
				h.dbEvents = ['child_changed'];
				super.on(h);
			}
			
			moved(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void {
				var h = new CollectionDbEventHandler(ctx, callback);
				h.dbEvents = ['child_moved'];
				super.on(h);
			}
			
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void, discriminator?:any) :void {
				var h = new CollectionDbEventHandler(ctx, callback, discriminator);
				h.dbEvents = ['child_added','child_removed','child_changed','child_moved','value'];
				h.ispopulating = true;
				h.istracking = true;
				super.on(h);
			}
			
			live(ctx :Object) {
				this.updated(ctx, ()=>{});
			}
			
			load(ctx:Object,deref = true) :Promise<any> {
				return new Promise<EventDetails<E>>((resolve,error) => {
					var allProms :Promise<any>[] = [];
					this.updated(ctx, (det) => {
						if (det.type == EventType.LIST_END) {
							det.offMe();
							if (allProms.length) {
								Promise.all(allProms).then(() => {
									resolve(null);
								});
							} else {
								resolve(null);
							}
						}
						if (det.type != EventType.ADDED) return;
						if (this.isReference && deref) {
							var evt = <ReferenceEvent<E>>this.findCreateChildFor(det.originalKey);
							allProms.push(evt.load(ctx).then(()=>{}));
						}
					})
				});
			}
			
			dereference(ctx:Object) :Promise<any> {
				if (!this.isReference) return this.load(ctx);
				return this.load(ctx,false);
			}
			
			init(h :EventHandler) {
				var sh = <CollectionDbEventHandler>h;
				sh.ref = new Firebase(this.getUrl());
				if (this.sorting) {
					sh.ref = sh.ref.orderByChild(this.sorting.field);
				}
				sh.event = this;
				sh.hookAll((ds,prev,event) => this.handleDbEvent(sh,event,ds,prev));
			}
			
			findCreateChildFor(key :String, force? :boolean):GenericEvent
			findCreateChildFor(meta :MetaDescriptor, force? :boolean):GenericEvent
			findCreateChildFor(param :any, force = false):GenericEvent {
				var meta:MetaDescriptor = null;
				if (!(param instanceof MetaDescriptor)) {
					if (this.isReference) {
						var refmeta = Db.meta.reference(this.classMeta.ctor, this.project);
						refmeta.localName = param;
						param = refmeta;
					} else {
						var embmeta = Db.meta.embedded(this.classMeta.ctor, this.binding);
						embmeta.localName = param;
						param = embmeta;
					}
				}
				return super.findCreateChildFor(param, force);
			}

			
			handleDbEvent(handler :CollectionDbEventHandler, event :string, ds :FirebaseDataSnapshot, prevKey :string) {
				console.log("Got event " + event, " prev " + prevKey + " key " + ds.key(), ds.val());
				var det = new EventDetails<E>();
				det.originalEvent = event;
				det.originalKey = ds.key();
				det.originalUrl = ds.ref().toString();
				det.precedingKey = prevKey;
				det.populating = handler.ispopulating; 
				if (event == 'value') {
					handler.unhook('value');
					if (handler.ispopulating) {
						this.loaded = true;
					}
					handler.ispopulating = false;
					det.type = EventType.LIST_END;
					handler.handle(det);
					return;
				}
				
				var subev = this.findCreateChildFor(ds.key());
				var val :E = null;
				subev.parseValue(ds);
				val = <E>subev.entity;
				if (event == 'child_removed') {
					det.type = EventType.REMOVED;
				} else if (event == 'child_added') {
					det.type = EventType.ADDED;
				} else {
					det.type = EventType.UPDATE;
				}
				det.payload = val;
				
				if (handler.istracking) {
					this.addToInternal(event,ds,val,det);
				}
				
				handler.handle(det);
			}
			
			add(key :string|number|Entity, value? :Entity) :Promise<any> {
				var k :string = null;
				var v = value;
				if (!v) {
					v = key;
					k = this.createKeyFor(v);
				} else {
					k = this.normalizeKey(key);
				}
				var evt = this.findCreateChildFor(k);
				evt.setEntity(v);
				return new Promise<any>((ok,err) => {
					var fb = new Firebase(evt.getUrl());
					fb.set(evt.serialize(false), (fberr) => {
						if (fberr) {
							err(fberr);
						} else {
							ok(null);
						}
					});
				});
				// Can't use save because reference event save does not save the reference
				//return (<IEntityOrReferenceEvent<E>><any>evt).save();
			}
			
			createKeyFor(value :Entity) :string {
				return Utils.IdGenerator.next();
			}
			
			normalizeKey(key :string|number|Entity) :string {
				if (typeof key === 'string') {
					key = <string>key;
				} else if (typeof key === 'number') {
					key = key + '';
				} else {
					var enturl = this.state.createEvent(key).getUrl();
					if (!enturl) throw new Error("The entity used as a key in a map must be already saved elsewhere");
					var entroot = this.state.entityRootFromUrl(enturl);
					enturl = enturl.substr(entroot.getUrl().length);
					key = enturl.replace(/\//g,'');
				}
				return <string>key;
			}
			
			addToInternal(event :string, ds :FirebaseDataSnapshot, val :Entity, det :EventDetails<E>) {
				if (event == 'child_removed') {
					delete this.realField[ds.key()];
				} else {
					this.realField[ds.key()] = val;
				}
				if (this.parent && this.parent.entity) {
					this.parent.entity[this.nameOnParent] = this.realField;
				}
			}

			remove(keyOrValue :string|number|Entity) :Promise<any> {
				var key = this.normalizeKey(keyOrValue);
				return new Promise<any>((ok,err) => {
					var fb = new Firebase(this.getUrl() + key +'/');
					fb.remove((fberr) => {
						if (fberr) {
							err(fberr);
						} else {
							ok(null);
						}
					});
				});
			}
			
			fetch(ctx:Object, key :string|number|Entity) :Promise<EventDetails<E>> {
				var k = this.normalizeKey(key);
				var evt = this.findCreateChildFor(k);
				return (<IEntityOrReferenceEvent<E>><any>evt).load(ctx);
			}
			
			with(key :string|number|Entity) :IEntityOrReferenceEvent<E> {
				var k = this.normalizeKey(key);
				return <IEntityOrReferenceEvent<E>><any>this.findCreateChildFor(k);
			}
			
			isLoaded() {
				return this.loaded;
			}
			
			assertLoaded() {
				if (!this.loaded) throw new Error("Collection at url " + this.getUrl() + " is not loaded");
			}
			
			save() :Promise<any> {
				if (!this.isLoaded) {
					console.log('not saving cause not loaded');
					// TODO maybe we should save children that were loaded anyway
					return;
				}
				return new Promise<any>((ok,err) => {
					var fb = new Firebase(this.getUrl());
					var obj = this.serialize();
					fb.set(obj, (fberr) => {
						if (fberr) {
							err(fberr);
						} else {
							ok(null);
						}
					});
				});
			}
			
			serialize(localsOnly:boolean = false, fields? :string[]) :Object {
				var obj = {};
				var preEntity = this.entity;
				this.entity = this.realField;
				try {
					var ks = Object.keys(this.realField);
					for (var i = 0; i < ks.length; i++) {
						var k = ks[i];
						obj[k] = this.findCreateChildFor(k).serialize();
					}
					return obj;
				} finally {
					this.entity = preEntity;
				}
			}
		}
		
		export class EventedArray<E> {
			arrayValue :E[] = [];
			keys :string[] = [];
			
			constructor(
				public collection :MapEvent<E>
			) {
				
			}

			private findPositionFor(key :string) :number {
				return this.keys.indexOf(key);
			}
			
			private findPositionAfter(prev :string) :number {
				if (!prev) return 0;
				var pos = this.findPositionFor(prev);
				if (pos == -1) return this.arrayValue.length;
				return pos+1;
			}
  			
			
			addToInternal(event :string, ds :FirebaseDataSnapshot, val :E, det :EventDetails<E>) {
				var key = ds.key();
				var curpos = this.findPositionFor(key);
				if (event == 'child_removed') {
					delete this.collection.realField[ds.key()];
					if (curpos > -1) {
						this.arrayValue.splice(curpos,1);
						this.keys.splice(curpos,1);
					}
					return;
				}
				this.collection.realField[ds.key()] = val;

				var newpos = this.findPositionAfter(det.precedingKey);
				
				console.log("cur " + curpos + " newpos " + newpos);
				
				if (curpos == newpos) {
					this.arrayValue[curpos] = val;
					return;
				} else {
					if (curpos > -1) {
						this.arrayValue.splice(curpos,1);
						this.keys.splice(curpos,1);
					}
					this.arrayValue.splice(newpos, 0, val);
					this.keys.splice(newpos, 0, key);
				}
			}
			
			prepareSerializeSet() {
				if (this.arrayValue) {
					// Add all elements found in the array to the map
					var fndkeys = {};
					for (var i = 0; i < this.arrayValue.length; i++) {
						var e = this.arrayValue[i];
						if (!e) continue;
						var k = this.collection.createKeyFor(e);
						this.collection.realField[k] = e;
						fndkeys[k] = true;
					}
					// Remove all those that are not there anymore
					var ks = Object.keys(this.collection.realField);
					for (var i = 0; i < ks.length; i++) {
						if (!fndkeys[ks[i]]) delete this.collection.realField[ks[i]];
					}
				}
			}
			
			prepareSerializeList() {
				if (this.arrayValue) {
					// Find keys in positions
					var keys :string[] = [];
					var ks = Object.keys(this.collection.realField);
					for (var i = 0; i < ks.length; i++) {
						var k = ks[i];
						var rfe = this.collection.realField[k];
						var pos = this.findPositionFor(rfe);
						if (pos == -1) {
							delete this.collection.realField[ks[i]];
						} else {
							keys[pos] = k;
						}
					}
					
					for (var i = 0; i < this.arrayValue.length; i++) {
						var e = this.arrayValue[i];
						if (!e) continue;
						if (!keys[i]) { 
							this.collection.realField[this.collection.createKeyFor(e)] = e;
						}
					}
				}
			}
		}
		
		export class ArrayCollectionEvent<E extends Entity> extends MapEvent<E> {
			protected evarray = new EventedArray<E>(this);

			setEntity(entity :Entity) {
				var preReal = this.realField || {};
				super.setEntity(entity);
				this.realField = preReal;
				this.evarray.arrayValue = <E[]>entity;
			}

			
			add(value? :Entity) :Promise<any> {
				if (arguments.length > 1) throw new Error("Cannot add to set or list specifying a key, add only the entity");
				var v = value;
				var k = this.createKeyFor(v);
				return super.add(k,v);
			}

			addToInternal(event :string, ds :FirebaseDataSnapshot, val :E, det :EventDetails<E>) {
				this.evarray.addToInternal(event, ds, val, det);
				if (this.parent && this.parent.entity) {
					this.parent.entity[this.nameOnParent] = this.evarray.arrayValue;
				}
			}
			
		}
		
		export class ListEvent<E extends Entity> extends ArrayCollectionEvent<E> implements IListSetEvent<E> {
			createKeyFor(value :Entity) :string {
				if (this.isReference) return Utils.IdGenerator.next();
				var enturl = this.state.createEvent(value).getUrl();
				if (!enturl)  return Utils.IdGenerator.next();
				if (!this.getUrl() || enturl.indexOf(this.getUrl()) != 0) {
					throw new Error("Cannot add to a list an embedded entity loaded or saved somewhere else, use .detach() or .clone()");
				}
				enturl = enturl.substr(this.getUrl().length);
				enturl = enturl.replace(/\//g,'');
				return enturl;
			}
			
			normalizeKey(key :string|number|Entity) :string {
				if (typeof key === 'string') {
					key = <string>key;
				} else if (typeof key === 'number') {
					key = key + '';
				}
				return <string>key.toString();
			}
			
			serialize(localsOnly:boolean = false, fields? :string[]) :Object {
				this.evarray.prepareSerializeList();
				return super.serialize(localsOnly, fields);
			}
		}
		
		export class SetEvent<E extends Entity> extends ArrayCollectionEvent<E> {
			
			createKeyFor(value :Entity) :string {
				// get the url
				var enturl = this.state.createEvent(value).getUrl();
				if (this.isReference) {
					// if it is a reference, use path from the root path
					if (!enturl) throw new Error("Cannot add to a set a reference that has not been loaded or not yet been saved");
					var entroot = this.state.entityRootFromUrl(enturl);
					enturl = enturl.substr(entroot.getUrl().length);
				} else {
					// if it's an embedded, check if it has a url and substract my url to obtain id
					if (enturl) {
						if (!this.getUrl() || enturl.indexOf(this.getUrl()) != 0) {
							throw new Error("Cannot add to a set an embedded entity loaded or saved somewhere else, use .detach() or .clone()");
						}
						enturl = enturl.substr(this.getUrl().length);
					} else {
						// if no url, generate a new random id
						return Utils.IdGenerator.next();
					}
				}
				// Remove slashes from the resulting url
				enturl = enturl.replace(/\//g,'');
				return enturl;
			}
			
			normalizeKey(key :string|number|Entity) :string {
				if (typeof key === 'string') {
					key = <string>key;
				} else if (typeof key === 'number') {
					key = key + '';
				} else {
					return this.createKeyFor(<Entity>key);
				}
				return <string>key;
			}
			
			serialize(localsOnly:boolean = false, fields? :string[]) :Object {
				this.evarray.prepareSerializeSet();
				return super.serialize(localsOnly, fields);
			}
			
		}
		
		export interface IObservableEvent<E extends Entity> extends IUrled {
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			live(ctx:Object) :void;
			
			// Handling methods
			off(ctx:Object) :void;
			isLoaded():boolean;
			assertLoaded():void;
		}
		
		export class IgnoreEvent<E extends Entity> extends GenericEvent {
			nameOnParent :string = null;
			val :any;
			
			setEntity() {
				// can't set entity, will refuse it, it's unmutable
			}
			
			parseValue(ds :FirebaseDataSnapshot) {
				this.val = ds.val();
			}
			
			serialize() {
				return this.val;
			}
			
			isLocal() :boolean {
				return true;
			}
		}
		
		export class ObservableEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IObservableEvent<E> {
			
			nameOnParent :string = null;
			
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void, discriminator :any = null) :void {
				var h = new EventHandler(ctx, callback, discriminator);
				super.on(h);
			}
			
			live(ctx:Object) {
				this.updated(ctx,()=>{});
			}
			
			handleDbEvent(ds :FirebaseDataSnapshot, prevName :string) {
				this.loaded = true;
				super.handleDbEvent(ds,prevName);
			}
			
			parseValue(ds :FirebaseDataSnapshot) {
				this.setEntity(ds.val());
				if (this.parent && this.nameOnParent) {
					this.parent.entity[this.nameOnParent] = this.entity;
				}
			}
			
			isLoaded() {
				return this.loaded;
			}
			
			assertLoaded() {
				if (!this.loaded) throw new Error("Entity at url " + this.getUrl() + " is not loaded");
			}
			
			serialize() {
				return this.entity;
			}

			isLocal() :boolean {
				return true;
			}
		}

		
		export interface IEntityRoot<E extends Entity> extends IUrled {
			load(id:string):E;
			query() :IQuery<E>;
		}
		
		export class EntityRoot<E extends Entity> implements IEntityRoot<E> {
			constructor(
				private state :DbState,
				private meta :ClassMetadata
			) {
				if (!meta.root) throw new Error("The entity " + meta.getName() + " is not a root entity");
			}
			
			load(id:string) :E {
				return <E>this.state.load(this.getUrl() + id, this.meta);
			}
			
			query() :IQuery<E> {
				// TODO implement this
				return null;
			}
			
			getUrl() :string {
				return this.state.getUrl() + this.meta.root + '/';
			}
			
		}
		
		export interface IQuery<E extends Entity> extends IReadableCollection<E> {
			sortOn(field :string, desc? :boolean):IQuery<E>;
			limit(limit :number):IQuery<E>;
			range(from :any, to :any):IQuery<E>;
			equals(val :any):IQuery<E>;
		}
		
		export class QueryImpl<E> implements IQuery<E> {
			
			private _sortField :string = null;
			private _sortDesc :boolean = false;
			private _limit :number = 0;
			private _rangeFrom :any = null;
			private _rangeTo :any = null;
			private _equals :any = null;

			constructor(ev :GenericEvent) {
				super();
				//this.
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
			
			init(gh :EventHandler) {
				super.init(gh);
				var h = <CollectionDbEventHandler>gh;
				h.ref = new Firebase(h.event.url);
				if (this._sortField) {
					h.ref = h.ref.orderByChild(this._sortField);
					if (this._rangeFrom) {
						h.ref = h.ref.startAt(this._rangeFrom);
					}
					if (this._rangeTo) {
						h.ref = h.ref.startAt(this._rangeTo);
					}
					if (this._equals) {
						h.ref = h.ref.equalTo(this._equals);
					}
				}
				if (this._sortDesc) {
					if (this._limit) {
						h.ref = h.ref.limitToLast(this._limit);
					} else {
						h.ref = h.ref.limitToLast(Number.MAX_VALUE);
					}
				} else {
					if (this._limit) {
						h.ref = h.ref.limitToFirst(this._limit);
					}
				}
			}
		}
		
		
		export class DbState {
			cache :{[index:string]:GenericEvent} = {};
			conf :any;
			myMeta = allMetadata;
			db :IDb3Static;
			entEvent = new Utils.WeakWrap<GenericEvent>();
			
			configure(conf :any) {
				this.conf = conf;
				// TODO filter metas
				// TODO integrity tests on metas
				// - double roots
			}
			
			reset() {
				// Automatic off for all handlers?
				for (var k in this.cache) {
					var val = this.cache[k];
					if (val instanceof GenericEvent) {
						(<GenericEvent>val).offAll();
					}
				}
				// Clean the cache
				this.cache = {};
			}
			
			entityRoot(ctor :EntityType<any>) :IEntityRoot<any>
			entityRoot(meta :ClassMetadata) :IEntityRoot<any>
			entityRoot(param :any) :IEntityRoot<any> {
				var meta :ClassMetadata = null;
				if (param instanceof ClassMetadata) {
					meta = param;
				} else {
					meta = this.myMeta.findMeta(param);
				}
				// change the meta based on current overrides
				if (meta.override != this.conf.override) {
					for (var i = meta.subMeta.length - 1; i >= 0; i--) {
						var subc = meta.subMeta[i];
						if (subc.override == this.conf.override) {
							meta = subc;
							break;
						}
					}
				}
				return new EntityRoot<any>(this, meta);
			}
			
			entityRootFromUrl(url :string) :IEntityRoot<any> {
				// Check if the given url pertains to me
				if (url.indexOf(this.getUrl()) != 0) return null;
				// Make the url relative
				var relurl = url.substring(this.getUrl().length);
				var meta = this.myMeta.findRooted(relurl);
				if (!meta) throw new Error("No entity root found for url " + url);
				return this.entityRoot(meta); 
			}
			
			getUrl() :string {
				return this.conf['baseUrl'];
			}
			
			createEvent(e :Entity, stack :MetaDescriptor[] = []) :GenericEvent {
				//var roote = (<IDb3Annotated>e).__dbevent;
				var roote = this.entEvent.get(e);
				if (!roote) {
					var clmeta = this.myMeta.findMeta(e);
					var nre = new EntityEvent();
					nre.state = this;
					nre.setEntity(e);
					nre.classMeta = clmeta;
					roote = nre;
					//(<IDb3Annotated>e).__dbevent = roote;
					this.entEvent.set(e, roote);
				}
				// Follow each call stack
				var acp = roote;
				for (var i = 0; i < stack.length; i++) {
					// search child event if any
					var sube = acp.findCreateChildFor(stack[i]);
					sube.state = this;
					if (sube.isTraversingTree()) {
						roote = sube.getTraversed();
						acp = roote;
						continue;
					}
					acp = sube;
				}
				return acp;
			}
			
			loadEvent(url :string, meta? :ClassMetadata) :GenericEvent {
				if (url.charAt(url.length - 1) != '/') url += '/';
				var ret = this.cache[url];
				if (ret) return ret;
				if (!meta) {
					// TODO find meta from url
				}
				if (!meta) {
					throw "The url " + url + " cannot be connected to an entity";
				}
				// TODO the meta should construct this
				var event = new EntityEvent();
				event.url = url;
				event.state = this;
				event.classMeta = meta;
				this.cache[url] = event;
				return event;
			}
			
			storeInCache(evt :GenericEvent) {
				var url = evt.getUrl();
				if (!url) return;
				var pre = this.cache[url];
				if (pre && pre !== evt) {
					throw new Error('Storing in cache two different events for the same key ' + url);
				}
				this.cache[url] = evt;
			}
			
			loadEventWithInstance(url :string, meta? :ClassMetadata) :GenericEvent {
				var dis = null;
				var segs = url.split('/');
				var lastseg = segs.pop();
				if (!lastseg) lastseg = segs.pop();
				var colonpos = lastseg.indexOf('*');
				if (colonpos == 0) {
					dis = lastseg.substring(1);
					url = url.substring(0,url.lastIndexOf('/'));
				} else if (colonpos > 0) {
					dis = lastseg.substring(0,colonpos);
				}
				// clean the url from discriminator
				var event = this.loadEvent(url, meta);
				if (event instanceof EntityEvent) {
					if (!event.entity) {
						// Find right meta if url has a discriminator
						if (dis) {
							var nmeta = this.myMeta.findDiscriminated(meta,dis);
							// TODO issue a warning maybe?
							if (nmeta) meta = nmeta;
						}
						var inst = <any>new meta.ctor();
						if (inst.dbInit) {
							(<IDb3Initable>inst).dbInit(url, this.db);
						}
						/*
						Object.defineProperty(inst, '__dbevent', {readable:true, writable:true, enumerable:false});
						(<IDb3Annotated>inst).__dbevent = event;
						*/
						event.setEntity(inst);
					}
				}
				return event;
			}
			
			load<T>(url :string, meta? :ClassMetadata) :T {
				var event = this.loadEventWithInstance(url, meta);
				return <T>event.entity;
				/*
				if (url.charAt(url.length - 1) != '/') url += '/';
				var ret = this.cache[url];
				if (ret) return <T>ret.entity;
				if (!meta) {
					// TODO find meta from url
				}
				if (!meta) {
					throw "The url " + url + " cannot be connected to an entity";
				}
				var inst = <any>new meta.ctor();
				if (inst.dbInit) {
					(<IDb3Initable>inst).dbInit(url, this.db);
				}
				// TODO the meta should construct this
				var event = new EntityEvent();
				event.url = url;
				event.state = this;
				event.entity = inst;
				event.classMeta = meta;
				(<IDb3Annotated>inst).__dbevent = event;
				this.cache[url] = event;
				return inst;
				*/
			}

		}
		
		export class MetaDescriptor {
			localName :string = null;
			remoteName :string = null;
			ctor :EntityType<any> = null;
			classMeta :ClassMetadata = null;
			
			getTreeChange(md :Metadata) :ClassMetadata {
				return null;
			}
			
			getRemoteName() :string {
				if (this.remoteName) return this.remoteName;
				return this.localName;
			}
			
			setType(def :any) {
				this.ctor = def;
			}
			
			named(name :string) :MetaDescriptor {
				this.remoteName = name;
				return this;
			}
			
			setLocalName(name :string) {
				this.localName = name;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				throw new Error("Please override createEvent method in MetaDescriptor subclasses");
				// TODO this should throw exception and force subclasses to implement
				/*
				var ret = new GenericEvent();
				ret.url = this.getRemoteName();
				return ret;
				*/
			}
		}
		
		export class ClassMetadata extends MetaDescriptor {
			descriptors :{[index:string]:MetaDescriptor} = {};
			root :string = null;
			discriminator :string = null;
			override :string = null;
			superMeta :ClassMetadata = null;
			subMeta :ClassMetadata[] = [];
			
			add(descr :MetaDescriptor) {
				descr.classMeta = this;
				this.descriptors[descr.localName] = descr;
			}
			
			getName() :string {
				return Utils.findName(this.ctor);
			}
			
			createInstance() :Entity {
				return new this.ctor();
			}
			
			rightInstance(entity :Entity) :boolean {
				return entity && entity instanceof this.ctor;
			}
			
			mergeSuper(sup :ClassMetadata) {
				if (!this.root) {
					this.root = sup.root;
				} else if (sup.root) {
					this.discriminator = this.root.replace(/\//,'');
				}
				if (!this.superMeta) {
					this.superMeta = sup;
					sup.addSubclass(this);
				}
				for (var k in sup.descriptors) {
					if (k == 'constructor') continue;
					if (this.descriptors[k]) continue;
					this.descriptors[k] = sup.descriptors[k];
				}
			}
			
			addSubclass(sub :ClassMetadata) {
				this.subMeta.push(sub);
			}
			
			findForDiscriminator(disc :string) :ClassMetadata {
				if (this.discriminator == disc) return this;
				for (var i = 0; i < this.subMeta.length; i++) {
					var ret = this.subMeta[i].findForDiscriminator(disc);
					if (ret) return ret;
				}
				return null;
			}
		}
		

		
		export class EmbeddedMetaDescriptor extends MetaDescriptor {
			binding: IBinding = null;
			
			named(name :string) :EmbeddedMetaDescriptor {
				super.named(name);
				return this;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				var ret = new EntityEvent();
				ret.url = this.getRemoteName();
				// TODO i need this search? can't i cache this?
				// TODO maybe we should assert here that there is a metadata for this type
				ret.classMeta = allMetadata.findMeta(this.ctor);
				ret.nameOnParent = this.localName;
				ret.binding = <BindingImpl>this.binding;
				return ret;
			}
			
			setBinding(binding :IBinding) {
				this.binding = binding;
			}
		}
		
		export class ReferenceMetaDescriptor extends MetaDescriptor {
			project :string[];
			
			named(name :string) :ReferenceMetaDescriptor {
				super.named(name);
				return this;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				var ret = new ReferenceEvent();
				ret.url = this.getRemoteName();
				// TODO i need this search? can't i cache this?
				// TODO maybe we should assert here that there is a metadata for this type
				ret.classMeta = allMetadata.findMeta(this.ctor);
				ret.nameOnParent = this.localName;
				ret.project = this.project;
				return ret;
			}
			
		}
		
		export class MapMetaDescriptor extends MetaDescriptor {
			isReference = false;
			sorting :Internal.SortingData = null;
			
			
			named(name :string) :MapMetaDescriptor {
				super.named(name);
				return this;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				var ret = new MapEvent();
				ret.url = this.getRemoteName();
				// TODO i need this search? can't i cache this?
				// TODO maybe we should assert here that there is a metadata for this type
				ret.classMeta = allMetadata.findMeta(this.ctor);
				ret.nameOnParent = this.localName;
				ret.isReference = this.isReference;
				ret.sorting = this.sorting;
				return ret;
			}
			
		}
		
		export class SetMetaDescriptor extends MetaDescriptor {
			isReference = false;
			sorting :Internal.SortingData = null;
			
			
			named(name :string) :SetMetaDescriptor {
				super.named(name);
				return this;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				var ret = new SetEvent();
				ret.url = this.getRemoteName();
				// TODO i need this search? can't i cache this?
				// TODO maybe we should assert here that there is a metadata for this type
				ret.classMeta = allMetadata.findMeta(this.ctor);
				ret.nameOnParent = this.localName;
				ret.isReference = this.isReference;
				ret.sorting = this.sorting;
				return ret;
			}
			
		}

		export class ListMetaDescriptor extends MetaDescriptor {
			isReference = false;
			sorting :Internal.SortingData = null;
			
			
			named(name :string) :SetMetaDescriptor {
				super.named(name);
				return this;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				var ret = new ListEvent();
				ret.url = this.getRemoteName();
				// TODO i need this search? can't i cache this?
				// TODO maybe we should assert here that there is a metadata for this type
				ret.classMeta = allMetadata.findMeta(this.ctor);
				ret.nameOnParent = this.localName;
				ret.isReference = this.isReference;
				ret.sorting = this.sorting;
				return ret;
			}
			
		}
		
		export class ObservableMetaDescriptor extends MetaDescriptor {
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				var ret = new ObservableEvent();
				ret.url = this.getRemoteName();
				ret.nameOnParent = this.localName;
				return ret;
			}
			
		}
		
		export class IgnoreMetaDescriptor extends MetaDescriptor {
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				var ret = new IgnoreEvent();
				ret.url = this.getRemoteName();
				ret.nameOnParent = this.localName;
				return ret;
			}
			
		}
		
		export class Metadata {
			classes :Internal.ClassMetadata[] = [];
			
			findMeta(param :EntityType<any>|Entity) {
				var ctor :EntityType<any> = null;
				if (typeof param !== 'function') {
					ctor = <EntityType<any>>param.constructor;
				} else {
					ctor = <EntityType<any>>param;
				}
				for (var i = 0; i < this.classes.length; i++) {
					var md = this.classes[i];
					if (md.ctor == ctor) return md;
				}
				var md = new Internal.ClassMetadata();
				md.ctor = ctor;
				// TODO parse here the manual static metadata
				var hierarchy = Utils.findHierarchy(ctor);
				for (var i = 0; i < hierarchy.length; i++) {
					var supmeta = this.findMeta(hierarchy[i]);
					md.mergeSuper(supmeta);
				}
				this.classes.push(md);
				return md;
			}
			
			findRooted(relurl :string) :ClassMetadata {
				for (var i = 0; i < this.classes.length; i++) {
					var acc = this.classes[i];
					var acr = acc.root;
					if (relurl.indexOf(acr) == 0) return acc;
				}
				return null;
			}
			
			findDiscriminated(base :ClassMetadata, dis :string) :ClassMetadata {
				return base.findForDiscriminator(dis);
			}
		}
		
		export function getAllMetadata() :Metadata {
			return allMetadata;
		}
		
		export function getLastEntity() :Entity {
			return lastEntity;
		}
		
		export function getLastMetaPath() :MetaDescriptor[] {
			return lastMetaPath;
		}
		
		export function clearLastStack() {
			lastEntity = null;
			lastMetaPath = [];
			lastExpect = null;
		}
		
	}
	
	export module Utils {
		export function findName(o :any) {
			var firstCtor = o;
			var acproto = (<EntityType<any>>o).prototype;
			if (!acproto) {
				acproto = Object.getPrototypeOf(o);
				firstCtor = o.constructor;
			}
			if (!firstCtor) return null;
			var funcNameRegex = /function (.{1,})\(/;
			var results  = (funcNameRegex).exec(firstCtor.toString());
			return (results && results.length > 1) ? results[1] : null;
		}
		
		export function findHierarchy(o :Entity|EntityType<any>) : EntityType<any>[] {
			var firstCtor = o;
			var acproto = (<EntityType<any>>o).prototype;
			if (!acproto) {
				acproto = Object.getPrototypeOf(o);
				firstCtor = o.constructor;
			}
			if (!acproto) throw new Error("Cannot reconstruct hierarchy following prototype chain of " + o);
			var ret :EntityType<any>[] = [];
			while (acproto) {
				var acctor = acproto.constructor; 
				if (acctor === Object) break;
				acproto = Object.getPrototypeOf(acproto);
				if (acctor === firstCtor) continue;
				ret.push(acctor);
			}
			return ret;
		}
		
		export function isInlineObject(o :any) {
			return typeof o === 'object' && o.constructor === Object;
		}
		
		var hasOwnProperty = Object.prototype.hasOwnProperty;

		export function isEmpty(obj) {
		
			// null and undefined are "empty"
			if (obj == null) return true;
			
			// Assume if it has a length property with a non-zero value
			// that that property is correct.
			if (obj.length > 0)    return false;
			if (obj.length === 0)  return true;
			
			// Otherwise, does it have any properties of its own?
			// Note that this doesn't handle
			// toString and valueOf enumeration bugs in IE < 9
			for (var key in obj) {
				if (hasOwnProperty.call(obj, key)) return false;
			}
			
			return true;
		}
		
		export function copyObj(from :Object, to :Object) {
			for (var k in from) {
				if (k == 'constructor') continue;
				var val = from[k];
				if (typeof val === 'object') {
					var valto = to[k] || {};
					copyObj(val, valto);
					val = valto;
				}
				to[k] = val;
			}
		}
		
		export class IdGenerator {
			// Modeled after base64 web-safe chars, but ordered by ASCII.
			// SG : removed - and _
			static PUSH_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
			
			static BASE = IdGenerator.PUSH_CHARS.length;
			
			static REVPOINT = 1440691098716;
		
			// Timestamp of last push, used to prevent local collisions if you push twice in one ms.
			static lastPushTime = 0;
		
			// We generate 72-bits of randomness which get turned into 14 characters and appended to the
			// timestamp to prevent collisions with other clients.	We store the last characters we
			// generated because in the event of a collision, we'll use those same characters except
			// "incremented" by one.
			static lastRandChars = [];
			static lastBackRandChars = [];
		
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
			
			static back() {
				var now = new Date().getTime();
				var duplicateTime = (now === IdGenerator.lastPushTime);
				IdGenerator.lastPushTime = now;
				
				now = IdGenerator.REVPOINT - (now - IdGenerator.REVPOINT);
		
				var timeStampChars = new Array(8);
				for (var i = 7; i >= 0; i--) {
					timeStampChars[i] = IdGenerator.PUSH_CHARS.charAt(now % IdGenerator.BASE);
					// NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
					now = Math.floor(now / IdGenerator.BASE);
				}
				if (now !== 0) throw new Error('We should have converted the entire timestamp.');
		
				var id = timeStampChars.join('');
		
				if (!duplicateTime || IdGenerator.lastBackRandChars.length == 0) {
					for (i = 0; i < 14; i++) {
						IdGenerator.lastBackRandChars[i] = Math.floor(Math.random() * IdGenerator.BASE);
					}
				} else {
					// If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
					for (i = 13; i >= 0 && IdGenerator.lastBackRandChars[i] === 0; i--) {
						IdGenerator.lastBackRandChars[i] = IdGenerator.BASE-1;
					}
					IdGenerator.lastBackRandChars[i]--;
				}
				for (i = 0; i < 14; i++) {
					id += IdGenerator.PUSH_CHARS.charAt(IdGenerator.lastBackRandChars[i]);
				}
				if (id.length != 22) throw new Error('Length should be 22, but was ' + id.length);
		
				return id;
			}
		}
		
		
		
		export class WeakWrap<V> {
			private wm :WeakMap<any,V> = null;
			private id :string;
			
			constructor() {
				if (typeof WeakMap !== 'undefined') {
					this.wm = new WeakMap<any,V>();
				} else {
					this.id = IdGenerator.next();
				}
			}
			
			private getOrMake(k :Object) {
				if (!k.hasOwnProperty('__weaks')) { 
					Object.defineProperty(k, '__weaks', {readable:true, writable:true, enumerable:false,value:{}});
				}
				return k['__weaks'];
			}
			
			get(k:any) :V {
				if (this.wm) return this.wm.get(k);
				var obj = this.getOrMake(k);
				return obj[this.id];
			}
			
			set(k:any, val :V) {
				if (this.wm) {
					this.wm.set(k,val);
					return;
				}
				var obj = this.getOrMake(k);
				obj[this.id] = val;
			}
			
			delete(k:any) {
				if (this.wm) {
					this.wm.delete(k);
					return;
				}
				var obj = this.getOrMake(k);
				delete obj[this.id];
			}
			
		}

	}
	
	export function bind(localName :string, targetName :string, live :boolean = true) :Internal.IBinding {
		var ret = new Internal.BindingImpl();
		ret.bind(localName, targetName,live);
		return ret;
	}
	
	export function sortBy(field :string, desc = false) : Internal.SortingData {
		return {
			field: field,
			desc :desc
		};
	}
	
	// --- Annotations
	export function embedded(def :EntityType<any>, binding? :Internal.IBinding) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			var ret = meta.embedded(def, binding);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function reference(def :EntityType<any>, project? :string[]) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			var ret = meta.reference(def, project);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function map(valueType :EntityType<any>, reference :boolean = false, sorting? :Internal.SortingData) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			var ret = meta.map(valueType, reference, sorting);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function set(valueType :EntityType<any>, reference :boolean = false, sorting? :Internal.SortingData) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			var ret = meta.set(valueType, reference, sorting);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}

	export function list(valueType :EntityType<any>, reference :boolean = false, sorting? :Internal.SortingData) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			var ret = meta.list(valueType, reference, sorting);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function root(name? :string, override?:string) :ClassDecorator {
		return function (target: Function) {
			var myname = name;
			if (!myname) {
				myname = Utils.findName(target);
				myname = myname.charAt(0).toLowerCase() + myname.slice(1);
				if (myname.charAt(myname.length - 1) != 's') myname += 's';
			}
			meta.define(<EntityType<any>><any>target, myname, null, override);
		}
	}
	
	export function discriminator(disc :string) :ClassDecorator {
		return function (target: Function) {
			meta.define(<EntityType<any>><any>target, null, disc);
		}
	}
	
	export function override(override :string = 'server') :ClassDecorator {
		return function (target: Function) {
			meta.define(<EntityType<any>><any>target, null, null, override);
		}
	}
	
	export function observable() :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			var ret = meta.observable();
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function ignore() :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			var ret = meta.ignore();
			addDescriptor(target, propertyKey, ret);
		}
	}
	
	function addDescriptor(target: Object, propertyKey: string | symbol, ret :Internal.MetaDescriptor) {
		ret.setLocalName(propertyKey.toString());
		var clmeta = allMetadata.findMeta(<EntityType<any>><any>target.constructor);
		clmeta.add(ret);
	}
	
	// --- Metadata stuff
	var allMetadata = new Internal.Metadata();
	
	var lastEntity :Entity = null;
	var lastMetaPath :Internal.MetaDescriptor[] = [];
	var lastCantBe = 'ciao';
	var lastExpect :any = null;
	
	function installMetaGetter(target: Object, propertyKey: string, descr :Internal.MetaDescriptor) {
		var nkey = '__' + propertyKey;
		
		Object.defineProperty(target,propertyKey, {
			enumerable: true,
			set: function(v) {
				this[nkey] = v;
				/*
				var mye = (<Internal.IDb3Annotated>this).__dbevent;
				if (mye) {
					mye.findCreateChildFor(propertyKey, true);
				}
				*/
			},
			get: function() {
				if (lastExpect && this !== lastExpect) {
					Internal.clearLastStack();
				}
				if (!lastEntity) lastEntity = this;
				lastMetaPath.push(descr);
				var ret = this[nkey];
				if (!ret) {
					lastExpect = lastCantBe;
				} else {
					lastExpect = ret;
				}
				return ret;
			}
		});
	}
	

	
	export module meta {
		export function embedded(def :any, binding? :Internal.IBinding) :Db.Internal.EmbeddedMetaDescriptor {
			var ret = new Db.Internal.EmbeddedMetaDescriptor();
			ret.setType(def);
			ret.setBinding(binding);
			return ret;
		}
		
		export function reference(def :any, project? :string[]) :Db.Internal.ReferenceMetaDescriptor {
			var ret = new Db.Internal.ReferenceMetaDescriptor();
			ret.setType(def);
			ret.project = project;
			return ret;
		}
		
		export function map(valuetype: EntityType<any>, reference = false, sorting? :Internal.SortingData) :Db.Internal.MapMetaDescriptor {
			var ret = new Db.Internal.MapMetaDescriptor();
			ret.setType(valuetype);
			ret.isReference = reference;
			ret.sorting = sorting;
			return ret;
		}
		
		export function set(valuetype: EntityType<any>, reference = false, sorting? :Internal.SortingData) :Db.Internal.SetMetaDescriptor {
			var ret = new Db.Internal.SetMetaDescriptor();
			ret.setType(valuetype);
			ret.isReference = reference;
			ret.sorting = sorting;
			return ret;
		}
		
		export function list(valuetype: EntityType<any>, reference = false, sorting? :Internal.SortingData) :Db.Internal.ListMetaDescriptor {
			var ret = new Db.Internal.ListMetaDescriptor();
			ret.setType(valuetype);
			ret.isReference = reference;
			ret.sorting = sorting;
			return ret;
		}
		
		export function observable() :Db.Internal.ObservableMetaDescriptor {
			var ret = new Db.Internal.ObservableMetaDescriptor();
			return ret;
		}
		
		export function ignore() :Db.Internal.IgnoreMetaDescriptor {
			var ret = new Db.Internal.IgnoreMetaDescriptor();
			return ret;
		}
		
		export function define(ctor :EntityType<any>, root? :string, discriminator? :string, override? :string) {
			var meta = allMetadata.findMeta(ctor);
			if (root) {
				meta.root = root;
			}
			if (discriminator) {
				meta.discriminator = discriminator;
			}
			if (override) {
				meta.override = override;
			}
		}
	}
	
}

export = Db;



