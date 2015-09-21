/**
 * TSDB version : VERSION_TAG
 */


import Firebase = require('firebase');
import PromiseModule = require('es6-promise');

var Promise = PromiseModule.Promise;

var Version = 'VERSION_TAG';

/**
 * Imported into TypeScript the WeakMap definition
 */
interface WeakMap<K, V> {
	clear(): void;
	delete(key: K): boolean;
	get(key: K): V;
	has(key: K): boolean;
	set(key: K, value?: V): WeakMap<K, V>;
}

/**
 * Imported into TypeScript the WeakMap constructor definition
 */
interface WeakMapConstructor {
	new (): WeakMap<any, any>;
	new <K, V>(): WeakMap<K, V>;
	prototype: WeakMap<any, any>;
}
declare var WeakMap: WeakMapConstructor;

/**
 * The main Db module.
 */
module Db {
	
	/**
	 * Create a database instance using given configuration. The first call to this function
	 * will also initialize the {@link defaultDb}.
	 * 
	 * TODO extend on the configuration options
	 * 
	 * @return An initialized and configured db instance
	 */
	export function configure(conf :any) :Db.Internal.IDb3Static {
		if (!defaultDb) {
			defaultDb = Db.Internal.createDb(conf);
			return defaultDb;
		} else {
			return Db.Internal.createDb(conf);
		}
	}
	
	export function of(e :Entity) :Db.Internal.IDb3Static {
		var ge = entEvent.get(e);
		if (!ge) return null;
		return ge.state.db;
	}
	
	/**
	 * Return the {@link defaultDb} if any has been created.
	 */
	export function getDefaultDb() :Db.Internal.IDb3Static {
		return defaultDb;
	}
	
	/**
	 * Empty interface, and as such useless in typescript, just to name things.
	 */
	export interface Entity {}
	
	/**
	 * Definition of an entity constructor, just to name things.
	 */
	export interface EntityType<T extends Entity> {
		 new() :T;
	}
	
	export interface EntityTypeProducer<T extends Entity> {
		() :EntityType<T>;
	}

	/**
	 * Internal module, most of the stuff inside this module are either internal use only or exposed by other methods,
	 * they should never be used directly.
	 */
	export module Internal {
		
		/**
		 * Creates a Db based on the given configuration.
		 */
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
				// Pass-thru for when db(something) is used also when not needed
				if (param instanceof GenericEvent) return param;
				
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
		
		/**
		 * A type that describes a native value, an array of native values, or a map of native values.
		 */
		export type nativeArrObj = 
			number|string|boolean
			|{[index:string]:string|number|boolean}
			|{[index:number]:string|number|boolean}
			|number[]|string[]|boolean[];
		
		/**
		 * Main interface of the Db.
		 */
		export interface IDb3Static {
			/**
			 * Access to global db operations, see {@link IDbOperations}.
			 */
			():IDbOperations;
			
			/**
			 * Pass-thru for when db(something) is used also when not needed. 
			 */
			<E extends GenericEvent>(evt :E):E;
			
			/**
			 * Access to an entity root given the entity class.
			 */
			<T extends Entity>(c :EntityType<T>) :IEntityRoot<T>;
			
			/**
			 * TBD
			 */
			(meta :MetaDescriptor,entity :Entity):any;

			/**
			 * Access to an {@link observable} value in an entity.
			 */
			<V extends nativeArrObj>(value :V) :IObservableEvent<V>;
			
			/**
			 * Access to a {@link map} value in an entity.
			 */
			<T extends Entity>(map :{[index:string]:T}) :IMapEvent<T>

			/**
			 * Access to a {@link list} value in an entity.
			 */
			<T extends Entity>(list :T[]) :IListSetEvent<T>;
			
			/**
			 * Access to an entity, an {@link embedded} value or a {@link reference} value.
			 */
			<T extends Entity>(entity :T) :IEntityOrReferenceEvent<T>;
			
			
		}
		
		/**
		 * Optional interface that entities can implement to have awareness of the Db.
		 */
		export interface IDb3Initable {
			dbInit?(url :string, db :IDb3Static);
		}

		/**
		 * Operations on a db.
		 */
		export interface IDbOperations {
			/**
			 * Fork another Db instance having a patched configuration.
			 */
			fork(conf :any) :IDb3Static;
			
			/**
			 * Load an entity by url. The url can point to a root entity, or an {@link embedded} or {@link reference} value.
			 */
			load<T extends Entity>(url :string) :T;
			
			/**
			 * Reset the internal state of the db, purging the cache and closing al listeners.
			 */
			reset();
			
			/**
			 * Deletes all the data from the db, without sending any event, and resets the internal state.
			 */
			erase();
		}
		
		/**
		 * Implementation of {@link IDbOperations}.
		 */
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
			
			erase() {
				this.reset();
				new Firebase(this.state.getUrl()).remove();
			}
		}
		
		/**
		 * Binding between parent and {@link embedded} entities.
		 */
		export interface IBinding {
			bind(localName :string, targetName :string, live? :boolean);
		}
		
		/**
		 * Current state of an ongoing binding.
		 */
		export interface BindingState {
			/** Values of loading/resolving other fields */
			vals :any[];
			/** Events of other entities */
			evts :GenericEvent[];
		}
		
		/**
		 * Implementation of {@link IBinding}.
		 */
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
			
			/**
			 * Start pre-loading bound fields.
			 * 
			 * It will search on the parent the required fields and trigger a "load". Load is implemented in
			 * {@link IEntityOrReferenceEvent}, {@link IMapEvent} and {@link IListSetEvent}, and in all of them it
			 * returns a promise that is fulfilled when the given field is completely loaded.
			 * 
			 * All the returned promises are then executed in parallel using Promise.all and the results
			 * combined in the {@link BindingState} of the returned promise.
			 * 
			 * This phase executes in parallel with the loading of the target entity.
			 * 
			 * @param metadata the class metadata of the parent entity
			 * @param state the db state to operate on
			 * @param parent the parent entity instance
			 */
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
			
			/**
			 * Completes the binding once the target entity completed loading and the Promise returned by
			 * {@link startLoads} completes.
			 * 
			 * It sets all the values found in the "result", and optionally subscribes to the 
			 * "updated" event to keep the value live. For references, the updated event is also
			 * trigger on reference change, so the value will be kept in sync.
			 * 
			 */
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
								// TODO if the target event is a collection, updated payload will not contain the full collection
								tgt[this.bindings[k]] = updet.payload;
							});
						})(k);
					} else {
						tgt[this.bindings[k]]= val;
					}
				}
			}
		}
		
		/**
		 * Interface for sorting informations.
		 */
		export interface SortingData {
			field :string;
			desc?: boolean;
		}
		
		/**
		 * Interface implemented by all the elements that have an URL.
		 */
		export interface IUrled {
			getUrl(evenIfIncomplete?:boolean) :string;
		}
		
		/**
		 * Various kind of events that can be triggered when using {@link EventDetails}.
		 */
		export enum EventType {
			/**
			 * Unknown event type.
			 */
			UNDEFINED,
			
			/**
			 * The value has been updated, used on entities when there was a change and on collections when an elements
			 * is changed or has been reordered.
			 */
			UPDATE,
			
			/**
			 * The value has been removed, used on root entities when they are deleted, embedded and references when 
			 * they are nulled, references also when the referenced entity has been deleted, and on collections when
			 * an element has been removed from the collection.
			 */
			REMOVED,
			
			/**
			 * The value has been added, used on collections when a new element has been added.
			 */
			ADDED,
			
			/**
			 * Special event used on collection to notify that the collection has finished loading, and following 
			 * events will be updates to the previous state and not initial population of the collection.
			 */
			LIST_END
		}
		
		/**
		 * Class describing an event from the Db. It is used in every listener callback.
		 */
		export class EventDetails<T> {
			/**
			 * The type of the event, see {@link EventType}.
			 */
			type :EventType = EventType.UNDEFINED;
			
			/**
			 * The payload of the event.
			 * 
			 * For entities, it is an instance of the entity. In collections, it is the value that has been
			 * added, removed or updated. 
			 */
			payload :T = null;
			
			/**
			 * True during initial population of a collection, false when later updating the collection values.
			 */
			populating = false;
			
			/**
			 * True if an entity has been populated only with projected values (see {@link reference}), false
			 * if instead values are fresh from the main entry in the database.
			 */
			projected = false;
			
			/**
			 * Original underlying database event.
			 * 
			 * TODO remove this, it exposes underlying informations that could not be stable
			 */
			originalEvent :string = null;
			
			/**
			 * Original event url.
			 * 
			 * TODO maybe whe should remove this, as it exposes potentially dangerous informations
			 */
			originalUrl :string = null;
			
			/**
			 * Key on which the event originated. On a root entity, it is the id of the entity; on an embedded
			 * it's the name of the field; on a reference it could be the name of the field (if the
			 * reference has changed) or the id (or field name) of the referenced entity; on a collection
			 * it's the key that has been added, removed or changed.
			 */
			originalKey :string = null;
			
			/**
			 * Preceding key in the current sorting order. This is useful only on collections, and it's mostly
			 * useful when the order of the elements in the collection has changed.
			 */
			precedingKey :string = null;
			
			/**
			 * The event handler that is broadcasting this event.
			 */
			private handler :EventHandler = null;
			
			/**
			 * True if {@link offMe} was called.
			 */
			private offed = false;
			
			setHandler(handler :EventHandler) {
				this.handler = handler;
			}
			
			/**
			 * Detaches the current listener, so that the listener will not receive further events
			 * and resources can be released.
			 */
			offMe() {
				this.handler.offMe();
				this.offed = true;
			}
			
			/**
			 * @returns true if {@link offMe} was called.
			 */
			wasOffed() :boolean {
				return this.offed;
			}
			
			/**
			 * Creates an equivalent copy of this instance.
			 */
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
 
		/**
		 * Generic binding between a {@link GenericEvent} and a callback function that consume {@link EventDetails}.
		 */
		export class EventHandler {
			/** Holder for progressive number of the handler, for debug purposes */
			static prog = 1;
			/** Progressive number of this handler, for debug purposes */
			myprog = EventHandler.prog++;

			/**
			 * Context of this handler. The context is used both as a context for invoking the 
			 * {@link callback} and as a reference object for turning off all handlers bound to a specific
			 * target.
			 */
			ctx:Object;
			
			/**
			 * The event this handler is bound to.
			 */
			event :GenericEvent;
			
			/**
			 * The callback to dispatch {@link EventDetails} to.
			 */
			callback :(ed:EventDetails<any>)=>void;
			
			/**
			 * A discriminator, used to differentiate between two different handlers that happen to have
			 * the same context and the same callback.
			 */
			discriminator :any = null;
			
			//after: (h?:EventHandler)=>any;
			/**
			 * true is this handler was canceled.
			 */
			canceled = false;
			
			/**
			 * @param ctx the {@link ctx} context object for this handler
			 * @param callback the {@link callback} for this handler
			 * @param discriminator the optional {@link discriminator} for this handler
			 */
			constructor(ctx? :Object, callback? :(ed:EventDetails<any>)=>void, discriminator :any = null) {
				this.ctx = ctx;
				this.callback = callback;
				this.discriminator = discriminator;
			}
			
			/**
			 * @returns true if the given handler has same {@link ctx}, {@link callback} and eventually {@link discrimnator} as this one.
			 */
			equals(oth :EventHandler) {
				return this.ctx == oth.ctx && this.callback == oth.callback && this.discriminator == oth.discriminator;
			}
			
			/**
			 * Decommission (cancel) this handler, only if the "remove" parameter is true.
			 * 
			 * @param remove if true decommiission this handler, otherwise not.
			 * @return the same value of "remove" parameter.
			 */
			decomission(remove :boolean):boolean {
				// override off, must remove only this instance callbacks, Firebase does not
				if (remove) {
					this.canceled = true;
				}
				return remove;
			}

			/**
			 * Handles the given {@link EventDetails}.
			 * 
			 * The EventDetails will be cloned, connected to this handler, and the the callback will be invoked.
			 */
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
				//if (this.after) this.after(this);
				try {
					this.callback.call(this.ctx, evd);
				} finally {
				}
				//console.log("Then calling", this.after);
			}
			
			/**
			 * Ask to the bound {@link event} to decommission this handler. 
			 */
			offMe() {
				this.event.offHandler(this);
			}
		}
		
		/**
		 * A specialized EventHandler that also holds registered callbacks on the underlying database.
		 * 
		 * This handler does not directly react to database events, it simply hooks them to a given callback 
		 * passed in {@link hook}. However, since usually when a handler is decommissioned also underlying
		 * database resources can be released, having them encapsulated in the same instance is easier and
		 * less error prone.
		 */
		export class DbEventHandler extends EventHandler {
			/**
			 * The underlying database reference.
			 */
			ref :FirebaseQuery;
			
			/**
			 * The callbacks registered by this handler on the underlying database reference.
			 */
			protected cbs :{event:string; fn :(dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void}[] = [];

			/**
			 * Hooks to the underlying database.
			 * 
			 * @param event the event to hook to
			 * @param fn the callback to hook to the database
			 */
			hook(event :string, fn :(dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void) {
				if (this.canceled) return;
				this.cbs.push({event:event, fn:fn});
				// TODO do something on cancelCallback? It's here only because of method signature
				this.ref.on(event, fn, (err) => {});
			}
			
			/**
			 * Extends the decommission function to also detach database callbacks registered thru {@link hook}.
			 */
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
		
		/**
		 * Base class of all events.
		 * 
		 * Events are responsible of :
		 * - Holding informations about the current state of part of the underlying Db
		 * - Managing a list of {@link EventHandler}s interested in that part of the Db.
		 * - Generating {@link EventDetails} when something happens on that part of the Db
		 * - Dispatch the EventDetails to all the EventHandlers in the list.
		 * 
		 * Events are organized in a hierarchy, having multiple {@link EntityRoot} as roots.
		 * 
		 */
		export class GenericEvent implements IUrled {
			/** The entity bound to this event. */
			entity :Entity;
			
			/** The url for the entity bound to this event. */
			url :string;
			
			/** The db state this event works in */
			state :DbState;
			
			/** The parent of this event */
			parent :GenericEvent;
			
			/** The children of this event */
			private children :{[index:string]:GenericEvent} = {};
			
			/** Dependant events */
			private dependants :GenericEvent[] = [];
			
			/** The class meta data this event operates on */
			private _classMeta :ClassMetadata = null;
			
			/** The declared class meta data for this event, cause {@link _classMeta} could change in case of polimorphic classes */
			private _originalClassMeta :ClassMetadata = null;

			/** Array of current registered handlers. */
			protected handlers :EventHandler[] = [];
			
			/**
			 * Set the entity this event works on.
			 * 
			 * The event is registered as pertaining to the given entity using the {@link DbState.entEvent} {@link WeakWrap}.
			 */
			setEntity(entity :Entity) {
				this.entity = entity;
				if (entity && typeof entity == 'object') {
					this.state.bindEntity(this.entity, this);
				}
				// TODO clean the children if entity changed? they could be pointing to old instance data
			}
			
			/**
			 * Set the {@link _classMeta} this event works on.
			 */
			set classMeta(meta :ClassMetadata) {
				if (!this._originalClassMeta) this._originalClassMeta = meta;
				this._classMeta = meta;
				// TODO clean the children that are not actual anymore now that the type changed?
			}
			
			/**
			 * Get the {@link _classMeta} this event works on.
			 */
			get classMeta() :ClassMetadata {
				return this._classMeta;
			}
			
			/**
			 * Set the {@link _originalClassMeta} this event works on.
			 */
			get originalClassMeta() :ClassMetadata {
				return this._originalClassMeta;
			}
			
			/**
			 * Return this url this event is relative to.
			 * 
			 * Each event is relative to a path segment, and combining this segment
			 * with anchestor events (up to the {@link EntityRoot}) yields the complete url.
			 * 
			 * However, events could be initially not connected to the full hierarchy (also see
			 * {@link urlInited}), but still have a partial url fragment.
			 * 
			 * Normally this method return null if the event is not connected to the
			 * full events hierarchy. If however the "evenIfIncomplete" parameter is true it
			 * will return the partial path fragment.
			 * 
			 * @param evenIfIncomplete if true will return the partial fragment even if the event is not 
			 * 			connected to the complete events hierarchy.
			 */
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
			
			/**
			 * Triggered when this events has been connected to the events hierarchy (either directly
			 * or indirectly by one of its anchestors). After this method is called, calling {@link getUrl}
			 * will yield a complete Url.
			 */
			urlInited() {
				for (var i = 0; i < this.handlers.length; i++) {
					this.init(this.handlers[i]);
				}
				for (var k in this.children) {
					if (k == 'constructor') continue;
					this.children[k].urlInited();
				}
				// Propagate also to dependants
				for (var i = 0; i < this.dependants.length; i++) {
					this.dependants[i].urlInited();
				}
				// Dependants are not needed after the url init has been propagated
				this.dependants = [];
				
				this.saveChildrenInCache();
			}
			
			/**
			 * Registers an event handler on this event.
			 * 
			 * If there is already an event handler with same ctx, callback and discriminator, it will be removed
			 * before the given one is added.
			 * 
			 * If the event is already linked to the events hierarchy, the handler will be inited
			 * by {@link init}.
			 */
			on(handler:EventHandler) {
				this.handlers = this.handlers.filter(h => !h.decomission(h.equals(handler)));
				handler.event = this;
				this.handlers.push(handler);
				// At this point the url could not yet have been set
				if (this.getUrl(false)) {
					this.init(handler);
				}
			}
			
			/**
			 * Unregisters and decommissions all the {@link EventHandler}s registered using {@link on} that
			 * have the given ctx and 8if specified) the given callback.
			 */
			off(ctx :Object,callback? :(ed:EventDetails<any>)=>void) {
				if (callback) {
					this.handlers = this.handlers.filter(h => !h.decomission(h.ctx === ctx && h.callback === callback));
				} else {
					this.handlers = this.handlers.filter(h => !h.decomission(h.ctx === ctx));
				}
			}
			
			/**
			 * Unregisters and decommissions a specific handler.
			 */
			offHandler(h :EventHandler) {
				h.decomission(true);
				this.handlers = this.handlers.filter(ch => ch !== h);
			}
			
			/**
			 * Unregisters and decommissions all the handlers registered on this event.
			 */
			offAll() {
				this.handlers = this.handlers.filter(h => !h.decomission(true));
			}
			
			/**
			 * Initializes an EventHandler that hs been registered with this event.
			 * 
			 * This initialization will occurr as soon as the handler is registered using
			 * {@link on} or it could be delayed to when this events gets connected to the
			 * events hierarchy.
			 * 
			 * This method must be overridden in subclasses, depending on the kind of event
			 * and event handler they use.
			 */
			protected init(h :EventHandler) {
				throw new Error("Implement init in GenericEvent subclasses");
			}
			
			/**
			 * Utility method to broadcast the given EventDEtails to all the registered
			 * {@link EventHandler}s.
			 */
			protected broadcast(ed :EventDetails<any>) {
				this.handlers.filter((h) => { h.handle(ed); return true; });
			}

			/**
			 * Find or create a child event.
			 * 
			 * Given the name or the {@link MetaDescriptor} of the child, an existing children
			 * will be searched in {@link children}. 
			 * 
			 * If not found:
			 * - a new event will be created calling {@link MetaDescriptor.createEvent}
			 * - it will be wired to this event setting its {@link parent}
			 * - if this event is working on an entity the new event's {@link setEntity} method will be called
			 * with the pertaining field, if any.
			 */
			findCreateChildFor(metaOrkey :string|MetaDescriptor, force :boolean = false):GenericEvent {
				var meta:MetaDescriptor = null;
				if (metaOrkey instanceof MetaDescriptor) {
					meta = <MetaDescriptor>metaOrkey;
				} else {
					meta = this.classMeta.descriptors[<string>metaOrkey];
				}
				if (!meta) return null;
				var ret = this.children[meta.localName];
				if (ret && !force) return ret;
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
				// TODO should we give then urlInited if the url is already present?
				this.saveChildrenInCache();
				return ret;
			}
			
			/**
			 * Save the children of this event to the {@link DbState} cache.
			 * 
			 * @param key if a specific key is given, only that children will be saven in the cache.
			 */
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
			
			/**
			 * Adds a dependant event.
			 * 
			 * Dependants, like children events, depenend on their parent for proper initialization,
			 * Url resolution and other functionalities.
			 * 
			 * Unlike children events, however, they are not attached permanently to their parent. 
			 * 
			 * This method stores them in the {@link dependants} array only if {@link getUrl} is currently
			 * returning null, and only up to when the {@link urlInited} method gets called, which usually 
			 * means this event is properly initialized and children and dependant events can initialize
			 * themselves accordingly. 
			 */
			addDependant(dep :GenericEvent) {
				dep.parent = this;
				dep.state = this.state;
				// We don't need to save dependants if we already have an url, just send them the urlInited
				if (!this.getUrl()) {
					this.dependants.push(dep);
				} else {
					dep.urlInited();
				}
			}
			
			/**
			 * Parse a value arriving from the Db.
			 * 
			 * This method must be overridden by subclasses.
			 * 
			 * The noral behaviour is to parse the given database data and apply it to
			 * the {@link entity} this event is working on. 
			 */
			parseValue(ds :FirebaseDataSnapshot) {
				throw new Error("Please override parseValue in subclasses of GenericEvent");
			}
			
			/**
			 * Return true if this event creates a logica "traversal" on the normal tree structure 
			 * of events. For example, a reference will traverse to another branch of the tree, so it's
			 * children will not be grandchildren of its parent.
			 */
			isTraversingTree() :boolean {
				return false;
			}
			
			/**
			 * If {@link isTraversingTree} returns true, then getTraversed returns the event 
			 * to which this events makes a traversal to.
			 * 
			 * TODO this has not been implemented by relevant subclasses, like ReferenceEvent. Moreover,+
			 * until we don't load the reference we don't know how to properly init the event (cause eventually
			 * we would need to reuse an existing one from the cache).
			 */
			getTraversed() :GenericEvent {
				return null;
			}
			
			/**
			 * Serialize the {@link entity} to persist it on the Db. 
			 * 
			 * This method must be overridden by subclasses.
			 * 
			 * This is the logical opposite of {@link parseValue}.
			 */
			serialize(localsOnly:boolean = false, fields? :string[]) :Object {
				throw new Error("Please override serialize in subclasses of GenericEvent");
			}
			
			/**
			 * Denotes that this event represent a "local" value during serialization.
			 * 
			 * A local value is a value that gets saved together with native values on the 
			 * {@link entity} and not on a separate node of the database tree.
			 */
			isLocal() :boolean {
				return false;
			}
		}
		
		/**
		 * Database events for {@link embedded} or {@link reference}d entities.
		 */
		export interface IEntityOrReferenceEvent<E extends Entity> extends IUrled {
			// Entity methods
			
			/**
			 * Load the entity completely. 
			 * 
			 * If it's a reference, the reference will be dereferenced AND the target data will be loaded.
			 * 
			 * Other references will be dereferenced but not loaded.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 */
			load(ctx:Object) :Promise<EventDetails<E>>;
			
			/**
			 * Registers a callback to get notified about updates to the entity.
			 * 
			 * The callback will be called when :
			 * - a value on the entity get changed or removed
			 * - a value on an {@link embedded} sub entity gets changed or removed
			 * - a value in a collection ({@link map}, {@link set} or {ļink list}) is added, removed or modified
			 * - the entity gets deleted
			 * - a {@link reference} pointer is changed AND when a referenced entity value is changed
			 * 
			 * When the callback gets called, the local instance of the entity has been already updated with
			 * the received database modifications.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			
			/**
			 * Keeps the local instance of the entity updated in real time with changes from the db,
			 * without registering a callback.
			 * 
			 * Technically, is equivalent to :
			 * ```
			 *   .updated(ctx, ()=>{});
			 * ```
			 * 
			 * Note that on references, the live state involves both the reference pointer and the referenced
			 * entity.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 */
			live(ctx:Object) :void;
			
			
			// Reference methods
			/**
			 * If the entity is a reference, this method only dereferences it, applying projections if
			 * available, but not loading the target entity.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 */
			dereference(ctx:Object) :Promise<EventDetails<E>>;
			
			/**
			 * If the entity is a reference, registers a callback to get notified about a change
			 * in the reference pointer.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			referenced(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			
			/**
			 * If the entity is a reference and has been loaded, this method retuns the url this reference is pointing at.
			 */
			getReferencedUrl() :string;
			
			// Handling methods
			/**
			 * Unregisters all callbacks and stops all undergoing operations started with the given context.
<			 * 
			 * @param ctx the context object used to register callbacks using {@link updated} or {@link referenced}, 
			 * 		or used on operations like {@link load}, {@link live} etc.. 
			 */
			off(ctx:Object) :void;
			
			/**
			 * Checks if this entity has been loaded from the database.
			 * 
			 * If this entity is a reference, this method returns true if the reference
			 * pointer has been loaded, not necessarily the pointed entity. 
			 * 
			 * @return true if the entity or the reference pointer has been loaded.
			 */
			isLoaded():boolean;
			
			/**
			 * Fails with an exception if {@link isLoaded} does not return true.
			 */
			assertLoaded():void;
			
			/**
			 * If this entity is a new entity, not loaded and not yet persisted on the database,
			 * and the entity is a {@link root} entity, this method assign an id and computes the
			 * complete and final url of the entity, which can then be retrieved with {@link getUrl}.
			 */
			assignUrl():void;
			
			/**
			 * Save this entity on the database. If this entity is a new entity and has a {@link root}, then
			 * it will first call {@link assignUrl} and then persist the new entity. If the entity was loaded from the 
			 * database or was already saved before, this method will perform an update of the existing entity.
			 * 
			 * The semantics of a save are that :
			 * - all native (string, number, inline objects etc..) of the entity are saved/updated
			 * - all {@link embedded} entities, new or already loaded, are recursively saved
			 * - all collections ({@link map}, {@link set} or {@link list}), new or already loaded, are recursively saved
			 * - {@link reference} pointers are saved; however, the save is not cascaded to referenced entities.
			 * 
			 * Saving an entity triggers all the callbacks registered with {@link updated} or {@link referenced} and 
			 * the like, on this entity or embedded sub-entities and collections, if modifications happened in their 
			 * respective scopes.
			 * 
			 * The returned Promise will be fulfilled when data has been persisted in the database, which could potentially
			 * be a slow operation. With most databases, the event callbacks will instead be fired instantly.
			 */
			save():Promise<any>;
			
			remove():Promise<any>;
			
			
			/**
			 * Creates a clone of this entity, using the most recent data from the database.
			 * 
			 * The entity must have been loaded (or saved if it's a new entity) before calling clone (that is,
			 * {@link isLoaded} must return true).
			 * 
			 * The {@link embedded} sub-entities and the collections are also cloned in the new instance.
			 * 
			 * {@link reference} pointers are cloned, but not the referenced entities, which usually is the expected
			 * behavior.
			 */
			clone() :E;
		}
		
		/**
		 * An utility base class for events that deal with a single databse reference.
		 * 
		 * It spawns a single {@link DbEventHandler} hooking database events to the {@link handleDbEvent} function.
		 * This function does a default parsing of the data, delegating to {@link parseValue}, and creates
		 * an {@link EventDetails} that is then dispatched to registered {@link EventHandler}s.
		 * 
		 * It stores most recent EventDetails to quickly dispatch it to handler that gets registered
		 * after the db has already been hooked.
		 * 
		 * It also keeps the {@link loaded} boolean and offer base implementation of {@link isLoaded} and {@link assertLoaded}.
		 */
		export class SingleDbHandlerEvent<E> extends GenericEvent {
			/** true if data has been loaded */ 
			loaded = false;
			/** 
			 * The only instance of DbEventHandler used, it gets hooked to {@link handleDbEvent} when needed
			 * and decommissioned when not needed anymore.
			 */
			dbhandler :DbEventHandler = null;
			
			/** Most recent EventDetails, used to bootstrap new EventHandlers registered after the first data has been received. */
			lastDetail :EventDetails<E> = null;
			
			/**
			 * Initializes the given handler.
			 * 
			 * If the {@link dbHandler} has not yet been initialized, it gets initialized and hooked to the db. It
			 * will later trigger {@link handleDbevent} which will create and dispach an {@link EventDetails} to 
			 * registered handlers.
			 * 
			 * If instead it is already hooked to the db, and has already received db events and created an EventDetails,
			 * it reuses it (from {@link lastDetail}) to bootstrap the newly added handler.
			 */
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
			
			/** Useless callback */
			mockCb() {}
			
			/**
			 * Does what specified in {@link GenericEvent.off}, then invokes {@link checkDisconnect} to
			 * decommission the {@link dbhandler}.
			 */
			off(ctx:Object, callback? :(ed:EventDetails<E>)=>void) {
				super.off(ctx, callback);
				this.checkDisconnect();
			}
			
			/**
			 * Does what specified in {@link GenericEvent.offHandler}, then invokes {@link checkDisconnect} to
			 * decommission the {@link dbhandler}.
			 */
			offHandler(h :EventHandler) {
				super.offHandler(h);
				this.checkDisconnect();
			}
			
			/**
			 * Does what specified in {@link GenericEvent.offAll}, then invokes {@link checkDisconnect} to
			 * decommission the {@link dbhandler}.
			 */
			offAll() {
				super.offAll();
				this.checkDisconnect();	
			}
			
			/**
			 * If there are no more {@link EventHandler}s listening on this event, then it decommissions the
			 * {@link dbhandler} and clears {@link lastDetail}.
			 */
			checkDisconnect() {
				if (this.handlers.length == 0) {
					if (this.dbhandler) {
						this.dbhandler.decomission(true);
						this.dbhandler = null;
					}
					this.lastDetail = null;
				}
			}
			
			/**
			 * Upon receiving data from the database, it creates an {@link EventDetails} object
			 * based on current state and received data, and {@link broadcast}s it.
			 */
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
			
			isLoaded() {
				return this.loaded;
			}
			
			assertLoaded() {
				if (!this.loaded) throw new Error("Data at url " + this.getUrl() + " is not loaded");
			}
			
		}
		
		/**
		 * Implementation of IEntityOrReferenceEvent for root and {@link embedded} entities. 
		 * 
		 * It handles the most important parts of entity serialization, deserialization and synchronization :
		 * - correctly parsing and materializing an entity in local ram, in {@link parseValue}
		 * - correctly serializing an entity, taking into consideration what was loaded and what not in (@link serialize}
		 * - issue a complete load or a partial update in {@link save}
		 * - honour the {@link bind} directives using {@link BindingImpl}
		 * - assign a generated id to {@link root} entities in {@link assignUrl}
		 */
		export class EntityEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IEntityOrReferenceEvent<E> {
			/**
			 * Local (ram, javascript) name of the entity represented by this event on the parent entity.
			 */
			nameOnParent :string = null;
			
			/**
			 * If given, binding directives.
			 */
			binding :BindingImpl = null;
			
			/**
			 * If we are loading this entity, this promise is loading the bound entities if eny.
			 */
			bindingPromise :Promise<BindingState> = null;
			
			/**
			 * Latest data from the database, if any, used in {@link clone}.
			 */
			lastDs :FirebaseDataSnapshot = null;
			
			/** a progressive counter used as a discriminator when registering the same callbacks more than once */
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
			
			/**
			 * Used to receive the projections when {@link ReferenceEvent} is loading the arget 
			 * event and has found some projections.
			 */
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
				// Save last data for use in clone later
				this.lastDs = ds;
				var val = ds.val();
				if (val) {
					// Check if we have a discriminator
					if (val['_dis']) {
						// Find <nd set the correct metadata
						var cm = this.state.myMeta.findDiscriminated(this.originalClassMeta,val['_dis']);
						if (!cm) throw new Error("Cannot find a suitable subclass for discriminator " + val['_dis']);
						this.classMeta = cm;
					} else {
						// If we don't have a discriminator, reset the original metadata
						// resetting it is important because this could be an update
						this.classMeta = this.originalClassMeta;
					}
					// TODO?? disciminator : change here then this.classMeta
					// If we do't have created the entity instance yet, or the entity we have is not the right
					// type (which could happen if this is an updated and the discriminator changed,
					// create an instance of the right type.
					if (!this.entity || !this.classMeta.rightInstance(this.entity)) {
						this.setEntity(this.classMeta.createInstance());
					}
					for (var k in val) {
						if (k == 'constructor') continue;
						// find a descriptor if any, a descriptor is there if the 
						// property has been annotated somehow (embedded, reference, observable etc..)
						var descr = this.classMeta.descriptors[k];
						if (descr) {
							// if we have a descriptor, find/create the event and delegate to it 
							var subev = this.findCreateChildFor(descr);
							subev.parseValue(ds.child(k));
						} else {
							// otherwise, simply copy the value in the proper field
							this.entity[k] = val[k];
						}
					}
				} else {
					// if value is null, then set the entity null
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
			
			dereference(ctx:Object) :Promise<EventDetails<E>> {
				throw new Error("Can't dereference something that is not a reference");
			}
			
			referenced(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void {
				throw new Error("Can't dereference something that is not a reference");
			}
			
			getReferencedUrl() :string {
				throw new Error("Embedded entities don't have a referenced url");
			}
			
			/**
			 * Serializes the entity in a way suitable for database update.
			 * 
			 * If the entity has a "serialize" method, that method will be invoked instead of performing
			 * the normal serialization.
			 * 
			 * If "localsOnly" is true, then only "local" values will be serialized. Local values are :
			 * - native values, not annotated at all (not {@link embedded}, not {@link reference} etc..)
			 * - values annotate for which {@link GenericEvent.isLocal} returns true.
			 * 
			 * For example, an {@link observable} is considered a local value during serizalization, so 
			 * {@link ObservableEvent} will return true on "isLocal".
			 * 
			 * If a list of field names is given in "fields", then only those fields will be serialized.
			 * 
			 * Otherwise, all the properties that whose name doesn't start with an underscore are serialized. If
			 * they are annotated, a corresponding event is found using {@link findCreateChildFor} and its "serialize"
			 * method is called, recursively.
			 * 
			 * @return a js object with data to serialize, or null to explicitly serialize a null, or undefined
			 * 		to leave the eventually existing value completely untouched. 
			 */
			serialize(localsOnly :boolean = false, fields? :string[]):Object {
				// No entity : serialize a null
				if (!this.entity) return null;
				// Honour the "serialize" method, if present
				if (typeof this.entity['serialize'] === 'function') {
					return this.entity['serialize'].apply(this.entity,[this]);
				}
				
				var ret = {};
				for (var k in this.entity) {
					if (fields && fields.indexOf(k) < 0) continue;
					var val = this.entity[k];
					if (typeof val === 'function') continue;

					// Look if the property is annotated
					var evt = this.findCreateChildFor(k);
					if (evt) {
						// If localsOnly skip this value, however some events (like ignore or observable) 
						// are called even if on locals only if their isLocal return true
						if (localsOnly && !evt.isLocal()) continue;
						// Delegate serialization to the child event
						val = evt.serialize();
						// Ignore the undefined
						if (val !== undefined) {
							ret[k] = val;
						}
					} else {
						// Skip every property starting with "_"
						if (k.charAt(0) == '_') continue;
						ret[k] = val;
					}
				}
				// Set the discriminator if needed
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
				// If this entity was previously loaded or saved, then perform a serialize and save
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
					// Otherwise, if we already have an URL, delegate saving to child events.
					// Save promises of child events
					var proms :Promise<any>[] = [];
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
					// When all child events have performed their save, we can resolve our promise
					return Promise.all(proms);
				} else {
					this.assignUrl();
					// A newly created entity can be considered like a loaded one once it's saved
					this.loaded = true;
					return this.save();
				}
			}
			
			remove():Promise<any> {
				if (this.getUrl()) {
					return new Promise<any>((ok,err) => {
						var fb = new Firebase(this.getUrl());
						fb.set(null, (fberr) => {
							if (fberr) {
								err(fberr);
							} else {
								ok(null);
							}
						});
					});
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
		
		/**
		 * Implementation of IEntityOrReferenceEvent for {@link reference}s.
		 * 
		 * It wraps an {@link EntityEvent} (in {@link pointedEvent}) to which it delegates
		 * most methods. The pointedEvent is loaded or created based on the pointer found in the reference, 
		 * and is recreated if the reference pointer gets changed.
		 * 
		 * Main functionalities are :
		 * - when reading, it creates the pointedEvent and eventually forwards projections in {@link parseValue}
		 * - when saving, it saves the pointed url, eventually annotated with the discriminator, and saves the projections, in {@link serialize}. 
		 */
		export class ReferenceEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IEntityOrReferenceEvent<E> {
			//classMeta :ClassMetadata = null;
			/**
			 * Local (ram, javascript) name of the entity represented by this event on the parent entity.
			 */
			nameOnParent :string = null;
			/**
			 * List of fields to save as projections.
			 */
			project :string[] = null;
			
			/**
			 * The main event that controls the pointed entity
			 */
			pointedEvent :EntityEvent<E> = null;
			
			/**
			 * The previous pointedEvent, saved here to decomission it when not needed anymore
			 */
			prevPointedEvent :EntityEvent<E> = null;
			
			/** a progressive counter used as a discriminator when registering the same callbacks more than once */
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
			
			/**
			 * Load this reference AND the pointed entity.
			 */
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
			
			/**
			 * Notifies of modifications on the reference AND on the pointed entity.
			 */
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
			
			/**
			 * Keeps both the reference AND the referenced entity live.
			 */
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
					// We have a value, and the value is a reference.
					// If there is no pointedEvent, or it was pointing to another entity ..
					if (this.pointedEvent == null || this.pointedEvent.getUrl() != val._ref) {
						//  .. create a new pointed event
						this.prevPointedEvent = this.pointedEvent;
						this.pointedEvent = <EntityEvent<E>>this.state.loadEventWithInstance(val._ref, this.classMeta);
						// Forward the projection
						this.pointedEvent.handleProjection(ds);
						this.setEntity(this.pointedEvent.entity);
					}
				} else {
					// Otherwise, consider it null
					this.prevPointedEvent = this.pointedEvent;
					this.pointedEvent = null;
					this.setEntity(null);
				}
				// set the value on the parent entity
				if (this.parent && this.nameOnParent) {
					this.parent.entity[this.nameOnParent] = this.entity;
				}
			}
			
			getReferencedUrl() :string {
				if (!this.pointedEvent) return null;
				return this.pointedEvent.getUrl();
			}
			
			serialize(localsOnly :boolean = false):Object {
				// No event, serialize null
				if (!this.pointedEvent) return null;
				var obj = null;
				if (this.project) {
					// use the pointed event serialize method to serialize projections, if any
					obj = this.pointedEvent.serialize(false, this.project);
				} else {
					obj = {};
				}
				// Decorate the url with the discriminator
				var url = this.pointedEvent.getUrl();
				var disc = this.pointedEvent.classMeta.discriminator || '';
				if (disc) disc = '*' + disc;
				url = url + disc;
				
				// Set the _ref property on the serialized object
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
			
			remove() {
				if (!this.pointedEvent) throw new Error("The reference is null, can't remove it");
				return this.pointedEvent.remove();
			}
			
			clone() :E {
				return this.pointedEvent.clone();
			}
		}
		
		/**
		 * Interface implemented by collections that can be read. These are all the collections
		 * but also {@link IQuery}.
		 */
		export interface IReadableCollection<E extends Entity> {
			/**
			 * Registers a callback to get notified about updates to the collection.
			 * 
			 * The callback will be called when :
			 * - a value is added, removed, or reorded in the collection
			 * - if the collection is of embedded entities, an entity in the collection is changed
			 * - if the collection is of references, a reference or it's projections changed
			 * 
			 * When the callback gets called, the local (in ram) collection has been already updated with
			 * the received database modifications.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			
			// Collection events
			/**
			 * Registers a callback to get notified when elements of the collection are loaded,
			 * or later when a value is added to the collection.
			 * 
			 * The callback will be called :
			 * - once for each entity found in the collection, in sorting order
			 * - once with an {@link EventType.LIST_END} when finished loading the collection
			 * - again for each further addition to the collection
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			added(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			/**
			 * Registers a callback to get notified when a value is removed to the collection.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			removed(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			/**
			 * Registers a callback to get notified when a value is changed to the collection.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			changed(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;
			/**
			 * Registers a callback to get notified when a value is moved (reordered) to the collection.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			moved(ctx:Object,callback :(ed:EventDetails<E>)=>void) :void;

			/**
			 * Unregisters all callbacks and stops all undergoing operations started with the given context.
			 * 
			 * @param ctx the context object used to register callbacks using {@link updated}, {@link added} etc.. 
			 * 		or used on other operations. 
			 */
			off(ctx:Object) :void;
		}
		
		/**
		 * Interface implemented by collections that can also be written to and used 
		 * as a field in an entity.
		 * 
		 * Methods that deal with keys accept the following :
		 * - a string key, for maps that use string keys or for sets and lists using the {@link EventDetails.originalKey}
		 * - a numeric key, which is simply converted to a string, it is *not* an array index on sets or lists.
		 * - an entity, for maps that use entity references as keys or for sets, not supported on lists 
		 */
		export interface IGenericCollection<E extends Entity> extends IReadableCollection<E> {
			/**
			 * Keeps the local instance of the collection updated in real time with changes from the db,
			 * without registering a callback.
			 * 
			 * Technically, is equivalent to :
			 * ```
			 *   .updated(ctx, ()=>{});
			 * ```
			 * 
			 * Note that, as opposed to {@link IEntityOrReferenceEvent.live}, on references the live state involves ONLY 
			 * the reference pointer, and not the referenced entity.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 */
			live(ctx:Object) :void;
			
			// Collection specific methods
			/**
			 * Removes the specified element from the collection.
			 */
			remove(key :string|number|Entity) :Promise<any>;
			
			/**
			 * Fetch the specified key from the collection.  
			 * 
			 * TODO does this only dereference or also load the value?
			 */
			fetch(ctx:Object, key :string|number|E) :Promise<EventDetails<E>>;
			
			/**
			 * Gives access to the database event for the given key.
			 * 
			 * TODO provide an example on why this is useful 
			 */
			with(key :string|number|Entity) :IEntityOrReferenceEvent<E>;
			
			/**
			 * Initialize a query on this collection.
			 */
			query() :IQuery<E>;
			
			// Handling methods
			/**
			 * Checks if this collection has been loaded from the database.
			 */
			isLoaded():boolean;
			
			/**
			 * Fails with an exception if {@link isLoaded} does not return true.
			 */
			assertLoaded():void;
			
			/**
			 * Save this collection on the database. The collection must have been loaded 
			 * ({@link isLoaded} must return true).
			 * 
			 * When saving a new entity, the {@link IEntityOrReferenceEvent.save} method takes care of 
			 * saving the collection.
			 *  
			 * The semantics of a save are that :
			 * - the local (ram) representation of the collection is used
			 * - for each element in the collection, the relative {@link IEntityOrReferenceEvent.save} method is called
			 * 
			 * Saving a collection triggers all the callbacks registered with {@link updated}, {@link added} and 
			 * the like on this collection.
			 * 
			 * The returned Promise will be fulfilled when data has been persisted in the database, which could potentially
			 * be a slow operation. With most databases, the event callbacks will instead be fired instantly.
			 */
			save():Promise<any>;
			
			/**
			 * Loads this collection into the parent entity, and also returns the value in the promise.
			 * 
			 * If this is a collection of references, all the references are also loaded.
			 */
			load(ctx:Object) :Promise<any>;
			
			/**
			 * Loads this collection into the parent entity, only deferencing the references and not
			 * loading the referenced entity.
			 */
			dereference(ctx:Object) :Promise<any>;
		}
		
		/**
		 * Collection of type map, a map binds keys to values.
		 * 
		 * Keys can be :
		 * - strings
		 * - numbers, which simply get converted to strings
		 * - entities
		 * 
		 * When using entities as keys, note that :
		 * - the entity must be saved somewhere else, cause the key is actually a reference to the entity
		 * - when looking up to find the entry, an entity loaded forom the same url must be used
		 * - the key entity will not be saved when saving the collection, cause it's a reference
		 * 
		 * If no sorting if given, a map is implicitly sorted in key lexicographic order.
		 */
		export interface IMapEvent<E extends Entity> extends IGenericCollection<E> {
			/**
			 * Adds a value to the map.
			 */
			add(key :string|number|Entity, value :E) :Promise<any>;

			load(ctx:Object) :Promise<{[index:string]:E}>;
			dereference(ctx:Object) :Promise<{[index:string]:E}>;
		}

		/**
		 * Collection of type list or set.
		 * 
		 * Lists and sets can add entities to the collection without specifying a key, however
		 * removal or direct retrival is still performed by key.
		 * 
		 * Lists and sets can also be used as queues, where {@link add} is equivalent to "push", 
		 * using the {@link pop}, {@link shift} and {@link unshift} methods which are equivalent to 
		 * JavaScript array methods, and {@link peekHead} and {@link peekTail}.
		 */
		export interface IListSetEvent<E extends Entity> extends IGenericCollection<E> {
			
			add(value :E) :Promise<any>;
			
			/**
			 * Fetches and removes the last element of the collection, in current sorting order.
			 */
			pop(ctx:Object) :Promise<EventDetails<E>>;
			/**
			 * Fetches the last element of the collection, in current sorting order, without removing it.
			 */
			peekTail(ctx:Object) :Promise<EventDetails<E>>;
			
			/**
			 * Adds an element to the beginning of the collection, in *key lexicographic* order.
			 */
			unshift(value :E):Promise<any>;
			/**
			 * Fetches and removes the first element of the collection, in current sorting order.
			 */
			shift(ctx:Object) :Promise<EventDetails<E>>;
			/**
			 * Fetches the first element of the collection, in current sorting order, without removing it.
			 */
			peekHead(ctx:Object) :Promise<EventDetails<E>>;

			load(ctx:Object) :Promise<E[]>;
			dereference(ctx:Object) :Promise<E[]>;
		}
		
		/**
		 * An event handler for collections. 
		 * 
		 * It extends the DbEventHandler :
		 * - adding automatic multiple db events hooking and unhooking
		 * - changing the signature of the callback to also pass the event name
		 */
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

		/**
		 * Default implementation of map.
		 */
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
				return new Promise<any>((resolve,error) => {
					var allProms :Promise<any>[] = [];
					this.updated(ctx, (det) => {
						if (det.type == EventType.LIST_END) {
							det.offMe();
							if (allProms.length) {
								Promise.all(allProms).then(() => {
									resolve(this.realField);
								});
							} else {
								resolve(this.realField);
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
			
			findCreateChildFor(metaOrkey :string|MetaDescriptor, force :boolean = false):GenericEvent {
				var meta:MetaDescriptor = <MetaDescriptor>metaOrkey;
				if (!(metaOrkey instanceof MetaDescriptor)) {
					if (this.isReference) {
						var refmeta = Db.meta.reference(this.classMeta.ctor, this.project);
						refmeta.localName = <string>metaOrkey;
						meta = refmeta;
					} else {
						var embmeta = Db.meta.embedded(this.classMeta.ctor, this.binding);
						embmeta.localName = <string>metaOrkey;
						meta = embmeta;
					}
				}
				return super.findCreateChildFor(meta, force);
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
					v = <Entity>key;
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
					var enturl = this.state.createEvent(<Entity>key).getUrl();
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
			
			query() :IQuery<E> {
				var ret = new QueryImpl<E>(this);
				ret.isReference = this.isReference;
				ret.sorting = this.sorting;
				ret.classMeta = this.classMeta;
				this.addDependant(ret);
				return ret;
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
			
			intSuperAdd(key :string|number|Entity, value? :Entity) :Promise<any> {
				return super.add(key,value);
			}

			addToInternal(event :string, ds :FirebaseDataSnapshot, val :E, det :EventDetails<E>) {
				this.evarray.addToInternal(event, ds, val, det);
				if (this.parent && this.parent.entity) {
					this.parent.entity[this.nameOnParent] = this.evarray.arrayValue;
				}
			}

			load(ctx:Object) :Promise<E[]> {
				return super.load(ctx).then(()=>this.evarray.arrayValue);
			}
			
			dereference(ctx:Object) :Promise<E[]> {
				return super.dereference(ctx).then(()=>this.evarray.arrayValue);
			}
			
		}
		
		export class ListEvent<E extends Entity> extends ArrayCollectionEvent<E> implements IListSetEvent<E> {
			createKeyFor(value :Entity) :string {
				if (this.isReference) return Utils.IdGenerator.next();
				var enturl = this.state.createEvent(value).getUrl();
				if (!enturl)  return Utils.IdGenerator.next();
				if (!this.getUrl() || enturl.indexOf(this.getUrl()) != 0) {
					throw new Error("Cannot add to a list an embedded entity loaded or saved somewhere else, use .clone()");
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
			
			intPeek(ctx:Object, dir :number) :Promise<EventDetails<E>> {
				return new Promise<EventDetails<E>>((ok,err)=>{
					this.query().limit(dir).added(ctx, (det)=>{
						det.offMe();
						ok(det);
					});
				});
			}
			
			intPeekRemove(ctx:Object, dir:number) :Promise<EventDetails<E>> {
				var fnd :EventDetails<E>;
				return this.intPeek(ctx,dir).then((det)=>{
					fnd = det;
					return super.remove(det.originalKey);
				}).then(()=>fnd);
			}
			
			pop(ctx:Object) :Promise<EventDetails<E>> {
				return this.intPeekRemove(ctx,-1);
			}
			
			peekTail(ctx :Object) :Promise<EventDetails<E>> {
				return this.intPeek(ctx,-1);
			}
			
			unshift(value :E):Promise<any> {
				return super.intSuperAdd(Utils.IdGenerator.back(), value);
			}
			
			shift(ctx :Object) :Promise<EventDetails<E>> {
				return this.intPeekRemove(ctx,1);
			}
			
			peekHead(ctx :Object) :Promise<EventDetails<E>> {
				return this.intPeek(ctx,1);
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
							throw new Error("Cannot add to a set an embedded entity loaded or saved somewhere else, use .clone()");
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
			get(id:string):E;
			query() :IQuery<E>;
		}
		
		export class EntityRoot<E extends Entity> implements IEntityRoot<E> {
			constructor(
				private state :DbState,
				private meta :ClassMetadata
			) {
				if (!meta.root) throw new Error("The entity " + meta.getName() + " is not a root entity");
			}
			
			get(id:string) :E {
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
			load(ctx:Object) :Promise<E[]>;
			dereference(ctx:Object) :Promise<E[]>;
			
			onField(field :string, desc? :boolean):IQuery<E>;
			limit(limit :number):IQuery<E>;
			range(from :any, to :any):IQuery<E>;
			equals(val :any):IQuery<E>;
		}
		
		export class QueryImpl<E> extends ArrayCollectionEvent<E> implements IQuery<E> {
			
			private _limit :number = 0;
			private _rangeFrom :any = null;
			private _rangeTo :any = null;
			private _equals :any = null;

			constructor(ev :GenericEvent) {
				super();
				this.realField = {};
				//this.
			}
			
			getUrl(force :boolean) :string {
				return this.parent.getUrl(force);
			}
			
			onField(field :string, desc = false) {
				this.sorting = {
					field: field,
					desc :desc
				};
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
				var h = <CollectionDbEventHandler>gh;
				h.ref = new Firebase(this.parent.getUrl());
				if (this.sorting) {
					h.ref = h.ref.orderByChild(this.sorting.field);
					if (this._equals) {
						h.ref = h.ref.equalTo(this._equals);
					} else {
						if (this._rangeFrom) {
							h.ref = h.ref.startAt(this._rangeFrom);
						}
						if (this._rangeTo) {
							h.ref = h.ref.endAt(this._rangeTo);
						}
					}
				}
				var limVal = this._limit || 0;
				if (limVal != 0) {
					var limLast = this.sorting && this.sorting.desc;
					if (limVal < 0) {
						limVal = Math.abs(limVal);
						limLast = !limLast;
					}
					if (limLast) {
						h.ref = h.ref.limitToLast(limVal);
					} else {
						h.ref = h.ref.limitToFirst(limVal);
					}
				}
				/*
				if (this.sorting && this.sorting.desc) {
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
				*/
				h.event = this;
				h.hookAll((ds,prev,event) => this.handleDbEvent(h,event,ds,prev));
			}

			findCreateChildFor(metaOrkey :string|MetaDescriptor, force :boolean = false):GenericEvent {
				return this.parent.findCreateChildFor(metaOrkey, force);
			}
			
			save() :Promise<any> {
				throw new Error("Can't save a query");
			}
		}
		
		
		export class DbState {
			cache :{[index:string]:GenericEvent} = {};
			conf :any;
			myMeta = allMetadata;
			db :IDb3Static;
			
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
			
			entityRoot(ctor :EntityType<any>) :IEntityRoot<any>;
			entityRoot(meta :ClassMetadata) :IEntityRoot<any>;
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
			
			bindEntity(e :Entity, ev :GenericEvent) {
				// TODO probably we should check and raise an error is the entity was already bound
				entEvent.set(e, ev);
			}
			
			createEvent(e :Entity, stack :MetaDescriptor[] = []) :GenericEvent {
				//var roote = (<IDb3Annotated>e).__dbevent;
				var roote = entEvent.get(e);
				if (!roote) {
					var clmeta = this.myMeta.findMeta(e);
					var nre = new EntityEvent();
					nre.state = this;
					nre.setEntity(e);
					nre.classMeta = clmeta;
					roote = nre;
					//(<IDb3Annotated>e).__dbevent = roote;
					entEvent.set(e, roote);
				} else {
					if (roote.state != this) throw new Error("The entity " + roote.getUrl(true) + " is already attached to another database, not to " + this.getUrl());
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
			/**
			 * This could be either a class constructor (EntityType), or an anonymous function returning a costructor 
			 * (EntityTypeProducer). Code for resolving the producer is in the cotr getter. This producer stuff
			 * is needed for https://github.com/Microsoft/TypeScript/issues/4888.
			 */ 
			private _ctor :any = null;
			classMeta :ClassMetadata = null;
			
			getTreeChange(md :Metadata) :ClassMetadata {
				return null;
			}
			
			getRemoteName() :string {
				if (this.remoteName) return this.remoteName;
				return this.localName;
			}
			
			setType(def :any) {
				this._ctor = def;
			}
			
			get ctor():EntityType<any> {
				if (this._ctor == null) {
					return null;
				}
				var ret :EntityType<any> = null;
				if (!Utils.findName(this._ctor)) {
					ret = this._ctor();
					this._ctor = ret;
				} else {
					ret = this._ctor;
				}
				return ret;
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
				md.setType(ctor);
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
				firstCtor = <Entity>o.constructor;
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
					Object.defineProperty(k, '__weaks', {writable:true, enumerable:false,value:{}});
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
	export function embedded(def :EntityType<any>|EntityTypeProducer<any>, binding? :Internal.IBinding) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			if (!def) throw new Error("Cannot find embedded class for " + propertyKey.toString());
			var ret = meta.embedded(def, binding);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function reference(def :EntityType<any>|EntityTypeProducer<any>, project? :string[]) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			if (!def) throw new Error("Cannot find referenced class for " + propertyKey.toString());
			var ret = meta.reference(def, project);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function map(valueType :EntityType<any>|EntityTypeProducer<any>, reference :boolean = false, sorting? :Internal.SortingData) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			if (!valueType) throw new Error("Cannot find map value type for " + propertyKey.toString());
			var ret = meta.map(valueType, reference, sorting);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function set(valueType :EntityType<any>|EntityTypeProducer<any>, reference :boolean = false, sorting? :Internal.SortingData) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			if (!valueType) throw new Error("Cannot find set value type for " + propertyKey.toString());
			var ret = meta.set(valueType, reference, sorting);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}

	export function list(valueType :EntityType<any>|EntityTypeProducer<any>, reference :boolean = false, sorting? :Internal.SortingData) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			if (!valueType) throw new Error("Cannot find list value type for " + propertyKey.toString());
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
				var mye = entEvent.get(this);
				if (mye) {
					mye.findCreateChildFor(propertyKey, true);
				}
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
		export function embedded(def :EntityType<any>|EntityTypeProducer<any>, binding? :Internal.IBinding) :Db.Internal.EmbeddedMetaDescriptor {
			if (!def) throw new Error("Cannot find embedded class");
			var ret = new Db.Internal.EmbeddedMetaDescriptor();
			ret.setType(def);
			ret.setBinding(binding);
			return ret;
		}
		
		export function reference(def :EntityType<any>|EntityTypeProducer<any>, project? :string[]) :Db.Internal.ReferenceMetaDescriptor {
			if (!def) throw new Error("Cannot find referenced class");
			var ret = new Db.Internal.ReferenceMetaDescriptor();
			ret.setType(def);
			ret.project = project;
			return ret;
		}
		
		export function map(valuetype: EntityType<any>|EntityTypeProducer<any>, reference = false, sorting? :Internal.SortingData) :Db.Internal.MapMetaDescriptor {
			if (!valuetype) throw new Error("Cannot find map value type");
			var ret = new Db.Internal.MapMetaDescriptor();
			ret.setType(valuetype);
			ret.isReference = reference;
			ret.sorting = sorting;
			return ret;
		}
		
		export function set(valuetype: EntityType<any>|EntityTypeProducer<any>, reference = false, sorting? :Internal.SortingData) :Db.Internal.SetMetaDescriptor {
			if (!valuetype) throw new Error("Cannot find set value type");
			var ret = new Db.Internal.SetMetaDescriptor();
			ret.setType(valuetype);
			ret.isReference = reference;
			ret.sorting = sorting;
			return ret;
		}
		
		export function list(valuetype: EntityType<any>|EntityTypeProducer<any>, reference = false, sorting? :Internal.SortingData) :Db.Internal.ListMetaDescriptor {
			if (!valuetype) throw new Error("Cannot find list value type");
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

/**
 * The default db, will be the first database created, handy since most projects will only use one db.
 */
var defaultDb :Db.Internal.IDb3Static = null;

/**
 * Weak association between entities and their database events. Each entity instance can be 
 * connected only to a single database event, and as such to a single database.
 */
var entEvent = new Db.Utils.WeakWrap<Db.Internal.GenericEvent>();


export = Db;



