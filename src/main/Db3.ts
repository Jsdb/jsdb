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

class Db {
	/**
	 * Static way of accessing the database. This works only
	 * if the entity passed in was already connected to a database,
	 * so it can't be used for saving. However, it is very useful for
	 * libraries that wants to interact with the database regarding an 
	 * entity, and does not want to pollute all method calls with a "db"
	 * parameter. This method is preferrable to {@link getDefaultDb} in a library
	 * context, because different entities could be bound to different
	 * database instances, especially in a server side environment that
	 * opts for a share-nothing architecture.
	 */
	static get of():Db.Api.IDb3Static {
		Db.Internal.clearLastStack();
		return function(param? :any) {
			var e = Db.Internal.getLastEntity();
			if (!e) {
				if (!param) throw new Error("A parameter is needed to find the database");	
				return entEvent.get(param);
			}
			
			var evt = entEvent.get(e);
			if (!evt) return null;
			var db = evt.db;
			return db.apply(db, arguments); 
		};
	}
}

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
	export function configure(conf :Api.DatabaseConf) :Db.Api.IDb3Static {
		if (!defaultDb) {
			defaultDb = Db.Internal.createDb(conf);
			return defaultDb;
		} else {
			return Db.Internal.createDb(conf);
		}
	}
	
	/*
	export var of :Api.IDb3Static = function(param? :any) {
		var e = lastEntity;
		if (!e) {
			if (!param) throw new Error("A parameter is needed to find the database");	
			return entEvent.get(param);
		}
		
		var evt = entEvent.get(e);
		if (!evt) return null;
		var db = evt.db;
		return db.apply(db, arguments); 
	}
	*/
	
	/**
	 * Return the {@link defaultDb} if any has been created.
	 */
	export function getDefaultDb() :Db.Api.IDb3Static {
		return defaultDb;
	}
	
	
	export module Api {
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
	
		export interface IEntityHooks {
			postUpdate?(evd? :IEventDetails<any>):void
			prePersist?():void
			preEvict?():boolean;
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
			<E extends Internal.GenericEvent>(evt :E):E;
			
			/**
			 * Access to an entity root given the entity class.
			 */
			<T extends Entity>(c :EntityType<T>) :IEntityRoot<T>;
			
			/**
			 * TBD
			 */
			/*
			(meta :MetaDescriptor,entity :Entity):any;
			*/

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
		 * Main interface of the Db.
		 */
		export interface ChainedIDb3Static<PE> {
			/**
			 * Pass-thru for when db(something) is used also when not needed. 
			 */
			/*
			<E extends Internal.GenericEvent>(evt :E):E|PE;
			*/
		
			
			/**
			 * Access to an entity root given the entity class.
			 */
			/*
			<T extends Entity>(c :EntityType<T>) :IEntityRoot<any>|PE;
			*/
			
			/**
			 * TBD
			 */
			/*
			(meta :MetaDescriptor,entity :Entity):any;
			*/

			/**
			 * Access to an {@link observable} value in an entity.
			 */
			<V extends nativeArrObj>(value :V) :IObservableEvent<any>|PE;
			
			/**
			 * Access to a {@link map} value in an entity.
			 */
			<T extends Entity>(map :{[index:string]:T}) :IMapEvent<any>|PE;

			/**
			 * Access to a {@link list} value in an entity.
			 */
			<T extends Entity>(list :T[]) :IListSetEvent<any>|PE;
			
			/**
			 * Access to an entity, an {@link embedded} value or a {@link reference} value.
			 */
			<T extends Entity>(entity :T) :IEntityOrReferenceEvent<any>|PE;
			
			
		}
		
		/**
		 * Optional interface that entities can implement to have awareness of the Db.
		 */
		export interface IDb3Initable {
			dbInit?(url :string, db :IDb3Static);
		}
		
		/**
		 * Basic interface for a context for remote calls. Server-side applications
		 * will usually extend this to bring other informations, like the curent
		 * user or security token and other environmental stuff.
		 */
		export interface IRemoteCallContext {
			db? :IDb3Static;
			checkExecuting?(entity? :Entity, methodName? :string, stat? :boolean, params? :any[], fn? :Function, payload? :any) :boolean|Promise<boolean>;
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
			load(ctx :Object, url :string) :Promise<IEventDetails<any>>;
			
			/**
			 * Reset the internal state of the db, purging the cache and closing al listeners.
			 */
			reset();
			
			/**
			 * Deletes all the data from the db, without sending any event, and resets the internal state.
			 */
			erase();
			
			/**
			 * Gives access to the underlying DbTree implementation.
			 */
			tree() :Spi.DbTreeRoot;
			
			executeServerMethod(ctx :IRemoteCallContext, payload :any) :Promise<any>;
		}
		
		/**
		 * Interface for sorting informations.
		 */
		export interface SortingData {
			field :string;
			desc?: boolean;
		}
		
		/**
		 * Binding between parent and {@link embedded} entities.
		 */
		export interface IBinding {
			bind(localName :string, targetName :string, live? :boolean);
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
			UNDEFINED = 0,
			
			/**
			 * The value has been loaded, used on entities and on collections on first loading of an entity.
			 */
			LOAD,
			
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
		export interface IEventDetails<T> {
			/**
			 * The type of the event, see {@link EventType}.
			 */
			type :Api.EventType;
			
			/**
			 * The payload of the event.
			 * 
			 * For entities, it is an instance of the entity. In collections, it is the value that has been
			 * added, removed or updated. 
			 */
			payload :T;
			
			/**
			 * True during initial population of a collection, false when later updating the collection values.
			 */
			populating :boolean;
			
			/**
			 * True if an entity has been populated only with projected values (see {@link reference}), false
			 * if instead values are fresh from the main entry in the database.
			 */
			projected :boolean;
			
			/**
			 * True if this event is not coming from a real DB activity, but was generated locally.
			 * Such events are generated by {@link EntityEvent#triggerLocalSave} and similar methods,
			 * to anticipate locally a change in the entity that is being persisted on the DB. A
			 * real (non synthetic) event will follow when real undergoing operations are completed.
			 */
			synthetic :boolean;
			
			/**
			 * Original underlying database event.
			 * 
			 * TODO remove this?, it exposes underlying informations that could not be stable
			 */
			originalEvent :string;
			
			/**
			 * Original event url.
			 * 
			 * TODO maybe whe should remove this, as it exposes potentially dangerous informations
			 */
			originalUrl :string;
			
			/**
			 * Key on which the event originated. On a root entity, it is the id of the entity; on an embedded
			 * it's the name of the field; on a reference it could be the name of the field (if the
			 * reference has changed) or the id (or field name) of the referenced entity; on a collection
			 * it's the key that has been added, removed or changed.
			 */
			originalKey :string;
			
			/**
			 * Preceding key in the current sorting order. This is useful only on collections, and it's mostly
			 * useful when the order of the elements in the collection has changed.
			 */
			precedingKey :string;
			
			/**
			 * Detaches the current listener, so that the listener will not receive further events
			 * and resources can be released.
			 */
			offMe():void;
			
			/**
			 * @returns true if {@link offMe} was called.
			 */
			wasOffed() :boolean;
			
		}
		
		export interface IEvent {
			
		}
		
		/**
		 * Database events for {@link embedded} or {@link reference}d entities.
		 */
		export interface IEntityOrReferenceEvent<E extends Entity> extends IUrled, IEvent {
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
			load(ctx:Object) :Promise<IEventDetails<E>>;
			
			/**
			 * Check if the entity, or the reference, or the referenced entity, exists on the database.
			 * 
			 * On entities, it return true if on the database there is some data.
			 * 
			 * On references, it returns true if on the database there is a reference, and the
			 * referenced entity also exists.
			 * 
			 * In all other cases, it returns false.
			 * 
			 * Note that an entity that does not exists can be loaded anyway, simply will have all
			 * it's fields set to default values or undefined.
			 */
			exists(ctx:Object) :Promise<boolean>;
			
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
			updated(ctx:Object,callback :(ed:IEventDetails<E>)=>void) :void;
			
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
			dereference(ctx:Object) :Promise<IEventDetails<E>>;
			
			/**
			 * If the entity is a reference, registers a callback to get notified about a change
			 * in the reference pointer.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			referenced(ctx:Object,callback :(ed:IEventDetails<E>)=>void) :void;
			
			/**
			 * If the entity is a reference and has been loaded, this method retuns the url this reference is pointing at.
			 */
			getReferencedUrl() :string;
			
			// Handling methods
			/**
			 * Unregisters all callbacks and stops all undergoing operations started with the given context.
			 * 
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
			 * 
			 * The dafult id is automatically computer in an URL-friendly, mostly unique, time-progressing id, 
			 * otherwise an id can be given as a parameter.
			 * 
			 * Note that in both case, if the class is polimorphic and this instance being saved is of a subclass,
			 * the string "*" followed by the class discriminator will be added to the id.
			 * 
			 * @param id If passed, this will be the id of the new entity, otherwise an automatic id is computed.
			 */
			assignUrl(id?:string):void;
			
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
			
			/**
			 * Deletes the entity from the database. The returned promise will resolve when
			 * the deletion is completed.
			 */
			remove():Promise<any>;
			
			/**
			 * Return the id of this entity, only if this entity is rooted one.
			 */
			getId():string;
			
			
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
			
			/**
			 * Access to the db instance of this event.
			 */
			db :IDb3Static;
			
			/**
			 * Triggers a "mock" update event, as if the data was updated on the database.
			 * This is useful when an operation has a long roundtrip before database events will
			 * arrive, and an immediate feedback to the user is wanted without duplicating
			 * all the event system. 
			 */
			triggerLocalSave();
			
			/**
			 * Allow for events chaining to reduce the verbosity of calling 
			 * the same method (for example, load to obtain a promise) on a series
			 * of objects.
			 */
			and :ChainedIDb3Static<IEntityOrReferenceEvent<any>>;
		}
		
		/**
		 * Entity root gives access to rooted entities.
		 */
		export interface IEntityRoot<E extends Entity> extends IUrled, IEvent {
			/**
			 * Get the instance with the given id. Note that this method is
			 * synchronous, and does not load the data from the database.
			 */
			get(id:string):E;
			
			/**
			 * Return the "id" part of the given entity. 
			 */
			idOf(instance :E) :string;
			
			/**
			 * Return a {@link IQuery} that operates on all the entities in this entity root.
			 */
			query() :IQuery<E>;
		}
		
		export interface IObservableEvent<E extends Entity> extends IUrled, IEvent {
			updated(ctx:Object,callback :(ed:IEventDetails<E>)=>void) :void;
			live(ctx:Object) :void;
			
			// Handling methods
			off(ctx:Object) :void;
			isLoaded():boolean;
			assertLoaded():void;
			
			/**
			 * Allow for events chaining to reduce the verbosity of calling 
			 * the same method (for example, load to obtain a promise) on a series
			 * of objects.
			 */
			and :ChainedIDb3Static<IObservableEvent<any>>;
		}
		

		/**
		 * Interface implemented by collections that can be read. These are all the collections
		 * but also {@link IQuery}.
		 */
		export interface IReadableCollection<E extends Entity> extends IEvent {
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
			updated(ctx:Object,callback :(ed :IEventDetails<E>)=>void) :void;
			
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
			added(ctx:Object,callback :(ed :IEventDetails<E>)=>void) :void;
			/**
			 * Registers a callback to get notified when a value is removed to the collection.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			removed(ctx:Object,callback :(ed :IEventDetails<E>)=>void) :void;
			/**
			 * Registers a callback to get notified when a value is changed to the collection.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			changed(ctx:Object,callback :(ed :IEventDetails<E>)=>void) :void;
			/**
			 * Registers a callback to get notified when a value is moved (reordered) to the collection.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @param callback the callback 
			 */
			moved(ctx:Object,callback :(ed :IEventDetails<E>)=>void) :void;

			/**
			 * Unregisters all callbacks and stops all undergoing operations started with the given context.
			 * 
			 * @param ctx the context object used to register callbacks using {@link updated}, {@link added} etc.. 
			 * 		or used on other operations. 
			 */
			off(ctx:Object) :void;
			
			/**
			 * Access to the db instance of this event.
			 */
			db :IDb3Static;
			
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
			 * Clears the collection, removing all elements in it.
			 */
			clear() :Promise<any>;
			
			/**
			 * Fetch the specified key from the collection.  
			 * 
			 * TODO does this only dereference or also load the value?
			 */
			fetch(ctx:Object, key :string|number|E) :Promise<IEventDetails<E>>;
			
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
			 * Loads this collection, both in the parent entity and returning it in the promise. 
			 * If this is a collection of references, all the references are resolved and referenced entities loaded.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @return a Promise that will be resolved with the full collection. 
			 */
			load(ctx:Object) :Promise<any>;
			
			/**
			 * Similar to load(), but only dereferences the references in this collection, not loading 
			 * the referenced entities.
			 * 
			 * @param ctx the context object, to use with {@link off}
			 * @return a Promise that will be resolved with the full collection. 
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

			// Inherits docs
			load(ctx:Object) :Promise<{[index:string]:E}>;

			// Inherits docs
			dereference(ctx:Object) :Promise<{[index:string]:E}>;
			
			/**
			 * Allow for events chaining to reduce the verbosity of calling 
			 * the same method (for example, load to obtain a promise) on a series
			 * of objects.
			 */
			and :ChainedIDb3Static<IMapEvent<any>>;

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
			
			// Inherits docs
			add(value :E) :Promise<any>;
			
			/**
			 * Fetches and removes the last element of the collection, in current sorting order.
			 */
			pop(ctx:Object) :Promise<IEventDetails<E>>;
			/**
			 * Fetches the last element of the collection, in current sorting order, without removing it.
			 */
			peekTail(ctx:Object) :Promise<IEventDetails<E>>;
			
			/**
			 * Adds an element to the beginning of the collection, in *key lexicographic* order.
			 */
			unshift(value :E):Promise<any>;
			/**
			 * Fetches and removes the first element of the collection, in current sorting order.
			 */
			shift(ctx:Object) :Promise<IEventDetails<E>>;
			/**
			 * Fetches the first element of the collection, in current sorting order, without removing it.
			 */
			peekHead(ctx:Object) :Promise<IEventDetails<E>>;

			// Inherits docs
			load(ctx:Object) :Promise<E[]>;

			// Inherits docs
			dereference(ctx:Object) :Promise<E[]>;
			
			/**
			 * Allow for events chaining to reduce the verbosity of calling 
			 * the same method (for example, load to obtain a promise) on a series
			 * of objects.
			 */
			and :ChainedIDb3Static<IListSetEvent<any>>;

		}
		
		/**
		 * A query, performed on a collection or on an entity root.
		 */
		export interface IQuery<E extends Entity> extends IReadableCollection<E> {
			// Inherits docs
			dereference(ctx:Object) :Promise<E[]>;
			// Inherits docs
			load(ctx:Object) :Promise<E[]>;
			
			onField(field :string, desc? :boolean):IQuery<E>;
			limit(limit :number):IQuery<E>;
			range(from :any, to :any):IQuery<E>;
			equals(val :any):IQuery<E>;
			
			/**
			 * Allow for events chaining to reduce the verbosity of calling 
			 * the same method (for example, load to obtain a promise) on a series
			 * of objects.
			 */
			and :ChainedIDb3Static<IQuery<any>>;

		}
		
		export interface Socket {
			emit(event :string, ...args: any[]) :Socket;
		}
				
		export interface IClientSideSocketFactory {
			connect(conf :DatabaseConf) :Socket;
		}
			
		export class DefaultClientSideSocketFactory implements IClientSideSocketFactory {
			connect(conf :DatabaseConf) :Socket {
				if (typeof io === 'function') {
					return io();
				}
				var n = 'socket.io-client';
				return require(n)();
			}
		}
		
		/**
		 * Database configuration, use one subclass like {@link FirebaseConf}.
		 */
		export interface DatabaseConf {
			adapter? :string|Spi.DbTreeFactory;
			override? :string;
			clientSocket? :IClientSideSocketFactory|string;
		}
		
		/**
		 * Parameters for an entity declaration.
		 */
		export interface EntityParams {
			/**
			 * If the entity is rooted, the root name.
			 */
			root? :string;
		}
		
		/**
		 * Parameters for embedded entity declaration.
		 */
		export interface EmbeddedParams {
			/**
			 * Type of the embedded entity.
			 */
			type :Api.EntityType<any>|Api.EntityTypeProducer<any>;
			/**
			 * Binding to the embedded entity.
			 */
			binding? :Api.IBinding;
		}

		/**
		 * Parameters for referenced entity declaration.
		 */
		export interface ReferenceParams {
			/**
			 * Type of the referenced entity.
			 */
			type? :Api.EntityType<any>|Api.EntityTypeProducer<any>;
			/**
			 * Projections of the entity to save embedded in the parent entity document.
			 */
			projections? :string[];
		}
		
		/**
		 * Parameters for defition of a collection.
		 */
		export interface CollectionParams {
			/**
			 * Type of the entities in the collection.
			 */
			type: Api.EntityType<any>|Api.EntityTypeProducer<any>;
			/**
			 * true if this is a collection of references, false (default) for a collection of embedded entities.
			 */
			reference?: boolean;
			/**
			 * Default sort order of the collection
			 */
			sorting? :Api.SortingData
			/**
			 * Binding on the embedded entities of this collection.
			 */
			binding? :Api.IBinding;
			/**
			 * Projections of the referenced entities of this collection.
			 */
			projections? :string[];
		}
		
		export interface RemoteCallParams {
			// TODO what we need here?
			
			// TODO a presave, that saves the object before calling, syncronizing the promises ?
			
			// TODO a waitupdate, that waits for following object update before resolving the promise? but what if the called method does not modify/save the promise?

		}
	}
	
	export module Spi {
		export interface DbTreeRoot {
			getUrl(url :string) :DbTree;
			makeRelative(url :string) :string;
		}
		
		export interface DbTreeSnap {
			/**
			* Returns true if this DbTreeSnap contains any data.
			* It is slightly more efficient than using snapshot.val() !== null.
			*/
			exists(): boolean;
			/**
			* Gets the JavaScript object representation of the DbTreeSnap.
			*/
			val(): any;
			/**
			* Gets a DbTreeSnapt for the location at the specified relative path.
			*/
			child(childPath: string): DbTreeSnap;
			/**
			* Enumerates through the DbTreeSnap’s children (in the default order).
			*/
			forEach(childAction: (childSnapshot: DbTreeSnap) => void): boolean;
			forEach(childAction: (childSnapshot: DbTreeSnap) => boolean): boolean;
			/**
			* Gets the key name of the location that generated this DbTreeSnap.
			*/
			key(): string;
			
			ref(): DbTree;
		}
		
		export interface DbTreeQuery {
			/**
			* Listens for data changes at a particular location.
			*/
			on(eventType: string, callback: (dataSnapshot: DbTreeSnap, prevChildName?: string) => void, cancelCallback?: (error: any) => void, context?: Object): (dataSnapshot: DbTreeSnap, prevChildName?: string) => void;
			/**
			* Detaches a callback previously attached with on().
			*/
			off(eventType?: string, callback?: (dataSnapshot: DbTreeSnap, prevChildName?: string) => void, context?: Object): void;
			/**
			* Listens for exactly one event of the specified event type, and then stops listening.
			*/
			once(eventType: string, successCallback: (dataSnapshot: DbTreeSnap) => void, context?: Object): void;
			once(eventType: string, successCallback: (dataSnapshot: DbTreeSnap) => void, failureCallback?: (error: any) => void, context?: Object): void;
			
			/**
			* Generates a new Query object ordered by the specified child key.
			*/
			orderByChild(key: string): DbTreeQuery;
			/**
			* Generates a new Query object ordered by key name.
			*/
			orderByKey(): DbTreeQuery;
			
			/**
			* @deprecated Use limitToFirst() and limitToLast() instead.
			* Generates a new Query object limited to the specified number of children.
			*/
			limit(limit: number): DbTreeQuery;
			/**
			* Creates a Query with the specified starting point. 
			* The generated Query includes children which match the specified starting point.
			*/
			startAt(value: string|number, key?: string): DbTreeQuery;
			/**
			* Creates a Query with the specified ending point. 
			* The generated Query includes children which match the specified ending point.
			*/
			endAt(value: string|number, key?: string): DbTreeQuery;
			/**
			* Creates a Query which includes children which match the specified value.
			*/
			equalTo(value: string|number, key?: string): DbTreeQuery;
			/**
			* Generates a new Query object limited to the first certain number of children.
			*/
			limitToFirst(limit: number): DbTreeQuery;
			/**
			* Generates a new Query object limited to the last certain number of children.
			*/
			limitToLast(limit: number): DbTreeQuery;
		}
		
		export interface DbTree extends DbTreeQuery {
			/**
			* Gets the absolute URL corresponding to this DbTree reference's location.
			*/
			toString(): string;
			/**
			* Writes data to this DbTree location.
			*/
			set(value: any, onComplete?: (error: any) => void): void;
			/**
			* Writes the enumerated children to this DbTree location.
			*/
			update(value: Object, onComplete?: (error: any) => void): void;
			/**
			* Removes the data at this DbTree location.
			*/
			remove(onComplete?: (error: any) => void): void;
		}
		
		export type DbTreeFactory = (conf:Api.DatabaseConf)=>DbTreeRoot;
		
		export var registry :{[index:string]:DbTreeFactory} = {};
		
		export function getRoot(conf :Api.DatabaseConf) {			
			var adapter = conf.adapter || 'firebase';
			var fact :DbTreeFactory;
			if (typeof adapter === 'string') {
				fact = registry[adapter];
				if (!fact) {
					try {
						fact = require(adapter);
					} catch (e) {
						
					}
				}
			} else {
				fact = adapter;
			}
			if (!fact) throw new Error("Can't find adapter " + adapter);
			return fact(conf);
		}
		
		
		// Firebase support
		
		/**
		 * Database configuration for Firebase backend.
		 */
		export interface FirebaseConf extends Api.DatabaseConf {
			/**
			 * Url of the Firebase server.
			 */
			baseUrl :string;
		}
		
		export class FirebaseDbTreeRoot implements DbTreeRoot {
			private conf :FirebaseConf;
			constructor(conf :Api.DatabaseConf) {
				this.conf = <FirebaseConf>conf;
				if (this.conf.baseUrl.charAt(this.conf.baseUrl.length - 1) != '/') {
					this.conf.baseUrl += '/';
				}
			}
			getUrl(url :string) :DbTree {
				return new Firebase(this.conf.baseUrl + url);
			}
			makeRelative(url :string):string {
				if (url.indexOf(this.conf.baseUrl) != 0) return null;
				return "/" + url.substr(this.conf.baseUrl.length);
			}
			static create(conf :Api.DatabaseConf) {
				return new FirebaseDbTreeRoot(conf);
			}
		}
		
		registry['firebase'] = FirebaseDbTreeRoot.create;
		
		// Monitoring adapter
		
		
		export interface MonitoringConf extends Api.DatabaseConf {
			realConfiguration :Api.DatabaseConf;
			log? :(...args :any[])=>void;
			prefix? :string;
			filter? :{[index:string]:string|{types?:string[], dump?:boolean, trace?:boolean}};
		}

		export class MonitoringDbTreeRoot implements DbTreeRoot {
			
			static create(conf :Api.DatabaseConf) {
				return new MonitoringDbTreeRoot(conf);
			}
			
			static presets = {
				"rw" : {types:['RCV','WRT','ERR'],dump:true},
				"r" : {types:['RCV','ERR'],dump:true},
				"w" : {types:['WRT','ERR'],dump:true},
				"full" : {types:['RCV','WRT','TRC','ACK','ERR'],dump:true,trace:true},
				"errors" : {types:['ERR'],dump:true,trace:true},
				"none" : {types:[]},
				"" : {types:['RCV','WRT','TRC','ACK','ERR'],dump:true}
			}
			
			conf :MonitoringConf;
			log :(...args :any[])=>void;
			filter :{[index:string]:{types?:string[], dump?:boolean, trace?:boolean}};
			prefix :string;
			
			delegateRoot :DbTreeRoot;
			
			constructor(conf :Api.DatabaseConf) {
				this.conf = <MonitoringConf>conf;
				this.delegateRoot = getRoot(this.conf.realConfiguration);
				this.log = this.conf.log || function () {console.log.apply(console, arguments)};
				this.filter = this.conf.filter || {'.*':{types:['RCV','WRT','TRC','ACK','ERR'],dump:true}};
				for (var k in this.filter) {
					if (typeof this.filter[k] === 'string') {
						var preset = MonitoringDbTreeRoot.presets[<string>this.filter[k]];
						if (!preset) throw new Error("Unknown monitoring preset '" + preset + "'");
						this.filter[k] = preset;
					}
				}
				this.prefix = this.conf.prefix;
				this.dtlog("Starting monitor:");
				this.dtlog("\tunderlying conf", this.conf.realConfiguration);
			}
			getUrl(url :string) :DbTree {
				return new MonitoringDbTree(this, this.delegateRoot.getUrl(url));
			}
			makeRelative(url :string) :string {
				return this.delegateRoot.makeRelative(url);
			}
			
			private dtlog(...args :any[]) {
				var allargs :any[] = [new Date().toISOString()];
				if (this.prefix) allargs.unshift(this.prefix);
				allargs = allargs.concat(args);
				this.log.apply(this, allargs);
			}
			
			emit(url :string, type :string, name :string, val :any, others :any[]) {
				for (var flt in this.filter) {
					var re = new RegExp(flt);
					if (!re.test(url)) continue;
					var rec = this.filter[flt];
					var typs = rec.types;
					if (typs && typs.indexOf(type) == -1) break;
					this.dtlog.apply(this,[type, name, url].concat(others));
					if (rec.dump && val) this.log(val);
					if (rec.trace) {
						var err = new Error();
						var stack = err['stack'] || 'stack not available';
						this.dtlog(stack);
					}
				}
			}
			
		}
		
		export class MonitoringDbTreeQuery implements DbTreeQuery {
			private myurl :string;
			constructor(private root :MonitoringDbTreeRoot, private delegate :DbTreeQuery) {
				this.myurl = delegate.toString();
			}
			
			emit(type :string, name :string, val? :any, ...others :any[]) {
				this.root.emit(this.myurl, type, name, val, others);
			}

			emitAckWrap(fn :(error: any) => void, name :string) :(error: any) => void {
				return (error:any) => {
					if (error) {
						this.emit('ERR', name);
					} else {
						this.emit('ACK', name);
					}
					if (fn) fn(error);
				}
			}
			
			emitDataWrap(fn :(dataSnapshot: DbTreeSnap, prevChildName?: string) => void, name :string) {
				var ret = (dataSnapshot: DbTreeSnap, prevChildName?: string) => {
					this.emit('RCV', name, dataSnapshot.val(), prevChildName ? "prev name " + prevChildName : '');
					fn(dataSnapshot, prevChildName);	
				};
				fn['__monitorcb'] = ret;
				return ret;
			}
			
			unwrapEmitData<T>(fn :T) :T {
				if (!fn) return undefined;
				return <T>fn['__monitorcb'] || fn;
			}
			
			toString(): string {
				return this.delegate.toString();
			}
			
			on(eventType: string, callback: (dataSnapshot: DbTreeSnap, prevChildName?: string) => void, cancelCallback?: (error: any) => void, context?: Object): (dataSnapshot: DbTreeSnap, prevChildName?: string) => void {
				var name = 'on ' + eventType;
				this.emit('TRC',name);
				return this.delegate.on(eventType, this.emitDataWrap(callback,name), this.emitAckWrap(cancelCallback,name + " cancel"), context);
			}
			
			off(eventType?: string, callback?: (dataSnapshot: DbTreeSnap, prevChildName?: string) => void, context?: Object): void {
				this.emit('TRC','off ' + eventType);
				this.delegate.off(eventType, this.unwrapEmitData(callback), context);
			}
			
			once(eventType: string, successCallback: (dataSnapshot: DbTreeSnap) => void, context?: Object): void;
			once(eventType: string, successCallback: (dataSnapshot: DbTreeSnap) => void, failureCallback?: (error: any) => void, context?: Object): void {
				var name = 'once ' + eventType;
				this.emit('TRC',name);
				this.delegate.once(eventType, this.emitDataWrap(successCallback, name), this.emitAckWrap(failureCallback, name + " failure"), context);
			}
			
			orderByChild(key: string): DbTreeQuery {
				this.emit('TRC','orderByChild',null,key);
				return new MonitoringDbTreeQuery(this.root,this.delegate.orderByChild(key));
			}

			orderByKey(): DbTreeQuery {
				this.emit('TRC','orderByKey');
				return new MonitoringDbTreeQuery(this.root,this.delegate.orderByKey());
			}
			
			limit(limit: number): DbTreeQuery {
				this.emit('TRC','limit',null,limit);
				return new MonitoringDbTreeQuery(this.root,this.delegate.limit(limit));
			}

			startAt(value: string|number, key?: string): DbTreeQuery {
				this.emit('TRC','startAt',null,value,key);
				return new MonitoringDbTreeQuery(this.root,this.delegate.startAt(value, key));
			}

			endAt(value: string|number, key?: string): DbTreeQuery {
				this.emit('TRC','endAt',null,value,key);
				return new MonitoringDbTreeQuery(this.root,this.delegate.endAt(value, key));
			}

			equalTo(value: string|number, key?: string): DbTreeQuery {
				this.emit('TRC','equalTo',null,value,key);
				return new MonitoringDbTreeQuery(this.root,this.delegate.equalTo(value,key));
			}

			limitToFirst(limit: number): DbTreeQuery {
				this.emit('TRC','limitToFirst',null,limit);
				return new MonitoringDbTreeQuery(this.root,this.delegate.limitToFirst(limit));
			}

			limitToLast(limit: number): DbTreeQuery {
				this.emit('TRC','limitToLast',null,limit);
				return new MonitoringDbTreeQuery(this.root,this.delegate.limitToLast(limit));
			}
			
		}

		export class MonitoringDbTree extends MonitoringDbTreeQuery implements DbTree {
			private tdelegate :DbTree;
			constructor(root :MonitoringDbTreeRoot, delegate :DbTree) {
				super(root, delegate);
				this.tdelegate = delegate;
			}
			set(value: any, onComplete?: (error: any) => void): void {
				this.emit('WRT','set',value);
				this.tdelegate.set(value, this.emitAckWrap(onComplete,'set'));
			}
			
			update(value: Object, onComplete?: (error: any) => void): void {
				this.emit('WRT','update',value);
				this.tdelegate.update(value, this.emitAckWrap(onComplete,'update'));
			}
			
			remove(onComplete?: (error: any) => void): void {
				this.emit('WRT','remove');
				this.tdelegate.remove(this.emitAckWrap(onComplete,'remove'));
			}
		}
		
		registry['monitor'] = MonitoringDbTreeRoot.create;
	}
	
	
	/**
	 * Internal module, most of the stuff inside this module are either internal use only or exposed by other methods,
	 * they should never be used directly.
	 */
	export module Internal {
		
		export var VERSION = Version;
		
		/**
		 * Creates a Db based on the given configuration.
		 */
		export function createDb(conf:Api.DatabaseConf) :Api.IDb3Static {
			var state = new DbState();
			state.configure(conf);
			return <Api.IDb3Static><any>state.db;
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
		export class BindingImpl implements Api.IBinding {
			keys :string[] = [];
			bindings : {[index:string]:string} = {};
			live : {[index:string]:boolean} = {};
			bind(local :string, remote :string, live :boolean = true):Api.IBinding {
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
			startLoads(metadata :ClassMetadata, state :DbState, parent :Api.Entity) :Promise<BindingState> {
				var proms :Thenable<any>[] = [];
				var evts :GenericEvent[] = [];
				for (var i = 0; i < this.keys.length; i++) {
					var k = this.keys[i];
					if (k === 'this') {
						proms.push(Promise.resolve(parent));
						evts.push(state.createEvent(parent,[]));
						continue;
					}
					var descr = metadata.descriptors[k];
					if (!descr) throw Error('Cannot find ' + k + ' for binding');
					var evt = state.createEvent(parent, [descr]);
					evts.push(evt);
					if (evt['load']) {
						proms.push((<Api.IEntityOrReferenceEvent<any>><any>evt).load(parent));
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
			resolve(tgt :Api.Entity, result :BindingState) {
				var vals = result.vals;
				var evts = result.evts;
				//console.log("Done values ", vals);
				for (var i = 0; i < this.keys.length; i++) {
					var k = this.keys[i];
					var val = vals[i];
					if (val instanceof EventDetails) {
						val = (<EventDetails<any>>val).payload;
					}
					tgt[this.bindings[k]]= val;
					if (this.live[k]) {
						var evt = evts[i];
						if (!evt['updated']) throw new Error('Cannot find an updated event to keep ' + k + ' live');
						// Wrapping in closure for 'k'
						((k:string) => {
							(<Api.IEntityOrReferenceEvent<any>><any>evt).updated(tgt,(updet) => {
								// TODO if the target event is a collection, updated payload will not contain the full collection
								tgt[this.bindings[k]] = updet.payload;
							});
						})(k);
					}
				}
			}
		}
		
		
		/**
		 * Class describing an event from the Db. It is used in every listener callback.
		 */
		export class EventDetails<T> implements Api.IEventDetails<T> {
			/**
			 * The type of the event, see {@link EventType}.
			 */
			type :Api.EventType = Api.EventType.UNDEFINED;
			
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
			 * True if this event is not coming from a real DB activity, but was generated locally.
			 * Such events are generated by {@link EntityEvent#triggerLocalSave} and similar methods,
			 * to anticipate locally a change in the entity that is being persisted on the DB. A
			 * real (non synthetic) event will follow when real undergoing operations are completed.
			 */
			synthetic = false;
			
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
				ret.synthetic = this.synthetic;
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
			ref :Spi.DbTreeQuery;
			
			/**
			 * The callbacks registered by this handler on the underlying database reference.
			 */
			protected cbs :{event:string; fn :(dataSnapshot: Spi.DbTreeSnap, prevChildName?: string) => void}[] = [];

			/**
			 * Hooks to the underlying database.
			 * 
			 * @param event the event to hook to
			 * @param fn the callback to hook to the database
			 */
			hook(event :string, fn :(dataSnapshot: Spi.DbTreeSnap, prevChildName?: string) => void) {
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
		export abstract class GenericEvent implements Api.IUrled {
			/** The entity bound to this event. */
			entity :Api.Entity;
			
			/** The url for the entity bound to this event. */
			url :string;
			
			/** The db state this event works in */
			state :DbState;
			
			/** The parent of this event */
			parent :GenericEvent;
			
			/**
			 * Local (ram, javascript) name of the entity represented by this event on the parent entity.
			 */
			nameOnParent :string = null;
						
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
			setEntity(entity :Api.Entity) {
				this.entity = entity;
				// clean the children if entity changed? they could be pointing to old instance data
				// TODO maybe to this only if the entity has actually changed!
				this.eachChildren((name,child)=>{ child.destroy() });
				this.children = {};
			}
			
			/**
			 * Destroy this event, disconnecting it from the parent
			 * and from the entity.
			 */
			destroy() {
				this.state.evictFromCache(this);
				this.setEntity(null);
				for (var i = 0; i < this.dependants.length; i++) {
					this.dependants[i].destroy();
				}
				this.parent = null;
			}
			
			/**
			 * Get a value from the entity, triggering the {@link nextInternal}
			 * flag to notify meta getters not to track this request.
			 */
			getFromEntity(name :string) {
				nextInternal = true;
				try {
					return this.entity[name];
				} catch (e) {
					throw e;
				} finally {
					nextInternal = false;
				}
			}
			
			/**
			 * Set a value on the entity, triggering the {@link nextInternal}
			 * flag to notify meta setters not to track this request.
			 */
			setOnEntity(name :string, val :any) {
				nextInternal = true;
				try {
					this.entity[name] = val;
				} catch (e) {
					throw e;
				} finally {
					nextInternal = false;
				}
			}
			
			protected setEntityOnParent(val? :any) {
				val = val || this.entity;
				if (this.parent && this.nameOnParent && this.parent.entity) {
					this.parent.setOnEntity(this.nameOnParent, val);
				}
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
			
			get db() {
				return this.state.db;
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
				// Since this is probably a new entity, check if some sub-entities are already there
				if (this.entity) {
					for (var k in this.classMeta.descriptors) {
						var subdes = this.classMeta.descriptors[k];
						if (subdes.localName && typeof this.getFromEntity(subdes.localName) !== 'undefined') {
							this.findCreateChildFor(k,true);
						}
					}
				}
				// Propagate also to dependants
				for (var i = 0; i < this.dependants.length; i++) {
					this.dependants[i].urlInited();
				}
				// Dependants are not needed after the url init has been propagated
				this.dependants = [];
				this.state.storeInCache(this);
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
					ret.setEntity(this.getFromEntity(meta.localName));
					return ret;
				}
				ret = meta.createEvent(this.state.myMeta);
				ret.state = this.state;
				ret.parent = this;
				if (this.entity) {
					ret.setEntity(this.getFromEntity(meta.localName));
				}
				this.children[meta.localName] = ret;
				// TODO should we give then urlInited if the url is already present?
				this.saveChildrenInCache();
				Internal.clearLastStack();
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
			 * Executes the given function for each already existing children of this event.
			 */
			eachChildren(f :(name :string, child :GenericEvent) => void) {
				for (var k in this.children) {
					f(k, this.children[k]);
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
			parseValue(ds :Spi.DbTreeSnap) {
				throw new Error("Please override parseValue in subclasses of GenericEvent");
			}
			
			applyHooks(ed :EventDetails<any>) {
				for (var k in this.children) {
					this.children[k].applyHooks(ed);
				}
			}
				
			/**
			 * If this event creates a logica "traversal" on the normal tree structure 
			 * of events, getTraversed returns the event to which this events makes a traversal to.
			 * 
			 * For example, a reference will traverse to another branch of the tree, so it's
			 * children will not be grandchildren of its parent. 
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
			
			save() :Promise<any> {
				return this.internalSave();
			}
			
			abstract internalSave() :Promise<any>;
			
			and :Api.ChainedIDb3Static<any> = (param:any) => {
				return new ChainedEvent(this.state, this, param);
			}
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
		export abstract class SingleDbHandlerEvent<E> extends GenericEvent {
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
					this.dbhandler.ref = this.state.getTree(this.getUrl());
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
			handleDbEvent(ds :Spi.DbTreeSnap, prevName :string, projected = false) {
				var evd = new EventDetails<E>();
				evd.type = Api.EventType.UPDATE;
				if (!this.loaded) {
					evd.type = Api.EventType.LOAD;
				}
				this.parseValue(ds);
				if (this.entity == null) {
					evd.type = Api.EventType.REMOVED;
				} 
				evd.payload = <E>this.entity;
				evd.originalEvent = 'value';
				evd.originalUrl = ds.ref().toString();
				evd.originalKey = ds.key();
				evd.precedingKey = prevName;
				evd.projected = projected;
				if (!projected) this.loaded = true;
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
		export class EntityEvent<E extends Api.Entity> extends SingleDbHandlerEvent<E> implements Api.IEntityOrReferenceEvent<E> {
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
			lastDs :Spi.DbTreeSnap = null;
			
			/** a progressive counter used as a discriminator when registering the same callbacks more than once */
			progDiscriminator = 1;
			
			setEntity(entity :Api.Entity) {
				if (this.entity) {
					this.state.bindEntity(this.entity, null);
				}
				super.setEntity(entity);
				// Update the local classMeta if entity type changed
				if (this.entity) {
					this.classMeta = this.state.myMeta.findMeta(this.entity);
					this.state.bindEntity(this.entity, this);
				}
			}
			
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void, discriminator :any = null) :void {
				var h = new EventHandler(ctx, callback, discriminator);
				super.on(h);
			}
			
			/**
			 * Used to receive the projections when {@link ReferenceEvent} is loading the arget 
			 * event and has found some projections.
			 */
			handleProjection(ds :Spi.DbTreeSnap) {
				if (this.loaded) return;
				super.handleDbEvent(ds, null, true);
				this.loaded = false;
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

			applyHooks(ed :EventDetails<E>) {
				if (this.entity && this.entity['postUpdate']) {
					(<Api.IEntityHooks>this.entity).postUpdate(ed);
				}
				// cascade hooks to sub entities
				super.applyHooks(ed);
			}
			
			protected broadcast(ed :EventDetails<E>) {
				if (!this.bindingPromise) {
					this.internalApplyBinding(true);
					this.applyHooks(ed);
					super.broadcast(ed);
					return;
				}
				// wait here for resolution of the binding, if any
				this.bindingPromise.then((state) => {
					this.binding.resolve(ed.payload, state);
					this.internalApplyBinding(true);
					this.applyHooks(ed);
					super.broadcast(ed);
				});
			}
			
			/**
			 * Set to null all the primitive entity fields not named 
			 * in the set, and triggers a parseValue(null) on all
			 * children not named in the set, honouring _fields as
			 * ignored.  
			 */
			protected nullify(set :{[index:string]:boolean} = {}) {
				// Nullify anything on the entity not found on the databse
				for (var k in this.entity) {
					if (k == 'constructor') continue;
					// Respect ignored fields
					if (k.charAt(0) == '_') continue;
					if (set[k]) continue; 
					var val = this.getFromEntity(k);
					if (!val) continue;
					if (typeof val === 'function') continue;
					// If there is a child, delegate to it
					var descr = this.classMeta.descriptors[k];
					if (descr) {
						var subev = this.findCreateChildFor(descr);
						subev.parseValue(null);
					} else {
						this.setOnEntity(k,undefined);
					}
				}
			}

			
			parseValue(ds :Spi.DbTreeSnap) {
				this.loaded = true;
				// Save last data for use in clone later
				this.lastDs = ds;
				var val = ds && ds.val();
				if (val) {
					// Avoid messing with the entity if we are processing a reference
					if (!val._ref) {  
						// Check if we have a discriminator
						if (val['_dis']) {
							// Find and set the correct metadata
							var cm = this.state.myMeta.findDiscriminated(this.originalClassMeta,val['_dis']);
							if (!cm) throw new Error("Cannot find a suitable subclass for discriminator " + val['_dis']);
							this.classMeta = cm;
						} else {
							// If we don't have a discriminator, reset the original metadata
							// resetting it is important because this could be an update
							this.classMeta = this.originalClassMeta;
						}
						// TODO?? disciminator : change here then this.classMeta
						// If we haven't yet created the entity instance, or the entity we have is not the right
						// type (which could happen if this is an updated and the discriminator changed,
						// create an instance of the right type.
						if (!this.entity || !this.classMeta.rightInstance(this.entity)) {
							this.setEntity(this.classMeta.createInstance());
						}
					} else {
						delete val._ref;
					}
					var set :{[index:string]:boolean} = {};
					for (var k in val) {
						if (k == 'constructor') continue;
						// find a descriptor if any, a descriptor is there if the 
						// property has been annotated somehow (embedded, reference, observable etc..)
						var descr = this.classMeta.descriptors[k];
						if (descr) {
							// if we have a descriptor, find/create the event and delegate to it 
							var subev = this.findCreateChildFor(descr);
							subev.parseValue(ds.child(k));
							set[k] = true;
						} else {
							// otherwise, simply copy the value in the proper field
							this.setOnEntity(k,val[k]);
							set[k] = true;
						}
					}
					this.nullify(set);
				} else {
					// if value is null, then nullify and set the entity null
					this.nullify();
					this.setEntity(null);
				}
				// if it's embedded should set the value on the parent entity
				this.setEntityOnParent();
			}
			
			internalApplyBinding(skipMe = false) {
				if (!skipMe && this.binding && this.entity && this.parent) {
					var mockState :BindingState = {
						vals:[],
						evts:[]
					};
					
					for (var i = 0; i < this.binding.keys.length; i++) {
						var k = this.binding.keys[i];
						var evt :GenericEvent;
						if (k == 'this') {
							evt = this.parent;
						} else {
							evt = this.parent.findCreateChildFor(k);
						}
						mockState.evts[i] = evt;
						mockState.vals[i] = evt.entity;
					}
					
					this.binding.resolve(this.entity, mockState);
				}
				// Propagate to children
				this.eachChildren((name,child)=>{
					if (child instanceof EntityEvent) child.internalApplyBinding();
				})				
			}
			
			load(ctx:Object) :Promise<EventDetails<E>> {
				return new Promise<EventDetails<E>>((resolve,error) => {
					this.updated(ctx, (ed) => {
						ed.offMe();
						resolve(ed);
					}, this.progDiscriminator++);
				});
			}
			
			exists(ctx:Object) :Promise<boolean> {
				return this.load(ctx).then(()=>this.lastDs.exists());
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
					var val = this.getFromEntity(k);
					if (typeof val === 'function') continue;
					if (typeof val === 'undefined') continue;

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
				Internal.clearLastStack();
				return ret;
			}
			
			assignUrl(id? :string) {
				if (this.entity == null) throw new Error("The entity is null, can't assign an url to a null entity");
				if (this.getUrl()) {
					if (id) throw new Error("Can't assign specific url to an entity that already has an url");
					return;
				}
				var er = this.state.entityRoot(this.classMeta);
				if (!er) throw new Error("The entity " + Utils.findName(this.entity.constructor) + " doesn't have a root");
				var url = er.getUrl();
				var nid = id || Db.Utils.IdGenerator.next();
				var disc = this.classMeta.discriminator || '';
				if (disc) disc+= '*';
				this.url = url + disc + nid + '/';
				if (id) {
					var oth = this.state.fetchFromCache(this.url);
					if (oth && oth !== this) {
						var ent = this.entity;
						this.setEntity(null);
						oth.setEntity(ent);
						return;
					}
				}
				// Since it's a new entity, then it can be considered loaded from this point on
				this.loaded = true;
				this.urlInited();
			}
			
			triggerLocalSave() {
				if (this.loaded) {
					var evd = new EventDetails<E>();
					evd.type = Api.EventType.UPDATE;
					evd.payload = <E>this.entity;
					evd.originalEvent = 'value';
					evd.originalUrl = this.getUrl();
					evd.originalKey = null;
					evd.synthetic = true;
					super.broadcast(evd);
				}
				this.eachChildren((k,child) => {
					if (child['triggerLocalSave']) {
						child['triggerLocalSave']();
					}
				});
			}
			
			
			internalSave():Promise<any> {
				// If this entity was previously loaded or saved, then perform a serialize and save
				if (this.loaded) {
					if (this.entity && this.entity['prePersist']) {
						(<Api.IEntityHooks>this.entity).prePersist();
					}
					return new Promise<any>((ok,err) => {
						var fb = this.state.getTree(this.getUrl());
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
						if (!se) continue;
						if (se['internalSave']) {
							proms.push((<GenericEvent>se).internalSave());
						} else if (se['save']) {
							proms.push((<Api.IEntityOrReferenceEvent<any>><any>se).save());
						}
					}
					// Update local fields if any
					if (this.entity) {
						var upd = this.serialize(true);
						if (!Utils.isEmpty(upd)) {
							proms.push(new Promise<any>((ok,err) => {
								var fb = this.state.getTree(this.getUrl());
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
					return this.internalSave();
				}
			}
			
			remove():Promise<any> {
				if (this.getUrl()) {
					return new Promise<any>((ok,err) => {
						var fb = this.state.getTree(this.getUrl());
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
			
			getId() :string {
				var url = this.getUrl();
				if (!url) return null;
				var er = this.state.entityRootFromUrl(url);
				url = er.getRemainingUrl(url);
				if (url.split('/').length > 2) return null;
				return url.replace('/','');;
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
		export class ReferenceEvent<E extends Api.Entity> extends SingleDbHandlerEvent<E> implements Api.IEntityOrReferenceEvent<E> {
			//classMeta :ClassMetadata = null;
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
			setEntity(entity :Api.Entity) {
				this.entity = entity;
				if (entity) {
					this.pointedEvent = <EntityEvent<E>>this.state.createEvent(entity,[]);
				} else {
					this.pointedEvent = null;
				}
			}
			
			findCreateChildFor(metaOrkey :string|MetaDescriptor, force :boolean = false):GenericEvent {
				throw new Error("Should never arrive here");	
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
			
			exists(ctx:Object) :Promise<boolean> {
				return this.load(ctx).then(()=>{
					if (!this.pointedEvent) return false;
					return this.pointedEvent.exists(ctx);
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
			
			parseValue(ds :Spi.DbTreeSnap) {
				var val = ds && ds.val();
				if (val && val._ref) {
					// We have a value, and the value is a reference.
					// If there is no pointedEvent, or it was pointing to another entity ..
					if (this.pointedEvent == null || this.pointedEvent.getUrl() != val._ref) {
						//  .. create a new pointed event
						this.prevPointedEvent = this.pointedEvent;
						this.pointedEvent = <EntityEvent<E>>this.state.loadEventWithInstance(val._ref);
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
				this.setEntityOnParent();
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
			
			triggerLocalSave() {
				if (!this.pointedEvent) return;
				var evd = new EventDetails<E>();
				evd.type = Api.EventType.UPDATE;
				evd.payload = <E>this.entity;
				evd.originalEvent = 'value';
				evd.originalUrl = this.getUrl();
				evd.originalKey = null;
				evd.synthetic = true;
				super.broadcast(evd);
			}
			
			internalSave() {
				return new Promise<any>((ok,err) => {
					var fb = this.state.getTree(this.getUrl());
					fb.set(this.serialize(false), (fberr) => {
						if (fberr) {
							err(fberr);
						} else {
							ok(null);
						}
					});
				});
			}
			
			save() {
				var proms = [this.internalSave()];
				if (this.pointedEvent) {
					proms.push(this.pointedEvent.save());
				}
				return Promise.all(proms);
			}
			
			remove() {
				if (this.pointedEvent) {
					return this.pointedEvent.remove();
				} else {
					return Promise.resolve(null);
				}
			}
			
			clone() :E {
				return this.pointedEvent.clone();
			}
			
			getTraversed() :GenericEvent {
				if (!this.pointedEvent) throw new Error("Cannot traverse reference '" + this.nameOnParent + "' cause it's null or has not yet been loaded");
				return this.pointedEvent;
			}
			
			getId() :string {
				if (!this.pointedEvent) return null;
				return this.pointedEvent.getId();
			}
			
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
			
			hookAll(fn :(dataSnapshot: Spi.DbTreeSnap, prevChildName?: string, event?:string) => void) {
				for (var i = 0; i < this.dbEvents.length; i++) {
					this.hook(this.dbEvents[i], fn);
				}
			}
			
			hook(event :string, fn :(dataSnapshot: Spi.DbTreeSnap, prevChildName?: string,event?:string) => void) {
				super.hook(event, (dataSnapshot: Spi.DbTreeSnap, prevChildName?: string) => fn(dataSnapshot, prevChildName || '', event));
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
		export class MapEvent<E extends Api.Entity> extends GenericEvent implements Api.IMapEvent<E> {
			isReference :boolean = false;
			project :string[] = null;
			binding :BindingImpl = null;
			sorting :Api.SortingData = null;
			
			realField :any = null;
			collectionLoaded :boolean = false;
			
			setEntity(entity :Api.Entity) {
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
						if (det.type == Api.EventType.LIST_END) {
							det.offMe();
							if (allProms.length) {
								Promise.all(allProms).then(() => {
									resolve(this.realField);
								});
							} else {
								resolve(this.realField);
							}
						}
						if (det.type != Api.EventType.ADDED) return;
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
				sh.ref = this.state.getTree(this.getUrl());
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

			
			handleDbEvent(handler :CollectionDbEventHandler, event :string, ds :Spi.DbTreeSnap, prevKey :string) {
				var det = new EventDetails<E>();
				det.originalEvent = event;
				det.originalKey = ds.key();
				det.originalUrl = ds.ref().toString();
				det.precedingKey = prevKey;
				det.populating = handler.ispopulating; 
				if (event == 'value') {
					handler.unhook('value');
					if (handler.ispopulating) {
						this.collectionLoaded = true;
						// Incrementally clean not found elements
						var dval = ds.val();
						if (!dval) {
							this.clearInternal();
						} else {
							for (var k in this.realField) {
								if (typeof dval[k] === undefined) {
									this.addToInternal('child_removed',k,null,null);
								}
							}
						}
					}
					handler.ispopulating = false;
					det.type = Api.EventType.LIST_END;
					handler.handle(det);
					return;
				}
				
				var subev = this.findCreateChildFor(ds.key());
				var val :E = null;
				subev.parseValue(ds);
				val = <E>subev.entity;
				if (event == 'child_removed') {
					det.type = Api.EventType.REMOVED;
				} else if (event == 'child_added') {
					det.type = Api.EventType.ADDED;
				} else {
					det.type = Api.EventType.UPDATE;
				}
				det.payload = val;
				subev.applyHooks(det);
				
				if (handler.istracking) {
					this.addToInternal(event,ds.key(),val,det);
				}
				
				handler.handle(det);
			}
			
			add(key :string|number|Api.Entity, value? :Api.Entity) :Promise<any> {
				var k :string = null;
				var v = value;
				if (!v) {
					v = <Api.Entity>key;
					k = this.createKeyFor(v);
				} else {
					k = this.normalizeKey(key);
				}
				var evt = this.findCreateChildFor(k);
				evt.setEntity(v);

				this.addToInternal('child_added', k, v, null);				
				
				if (this.getUrl()) {
					return new Promise<any>((ok,err) => {
						var fb = this.state.getTree(evt.getUrl());
						fb.set(evt.serialize(false), (fberr) => {
							if (fberr) {
								err(fberr);
							} else {
								ok(null);
							}
						});
					});
				}
				// Can't use save because reference event save does not save the reference
				//return (<IEntityOrReferenceEvent<E>><any>evt).save();
			}
			
			createKeyFor(value :Api.Entity) :string {
				return Utils.IdGenerator.next();
			}
			
			normalizeKey(key :string|number|Api.Entity) :string {
				if (typeof key === 'string') {
					key = <string>key;
				} else if (typeof key === 'number') {
					key = key + '';
				} else {
					var enturl = this.state.createEvent(<Api.Entity>key).getUrl();
					if (!enturl) throw new Error("The entity used as a key in a map must be already saved elsewhere");
					var entroot = this.state.entityRootFromUrl(enturl);
					enturl = entroot.getRemainingUrl(enturl);
					key = enturl.replace(/\//g,'');
				}
				return <string>key;
			}
			
			addToInternal(event :string, key :string, val :Api.Entity, det :EventDetails<E>) {
				if (event == 'child_removed' || val === null || typeof val === 'undefined') {
					if (this.realField) {
						delete this.realField[key];
					}
				} else {
					this.realField = this.realField || {};
					this.realField[key] = val;
				}
				this.setEntityOnParent(this.realField);
			}
			
			clearInternal() {
				if (this.realField) {
					this.realField = {};
					this.setEntityOnParent(this.realField);
				}
			}

			remove(keyOrValue :string|number|Api.Entity) :Promise<any> {
				var key = this.normalizeKey(keyOrValue);
				
				this.addToInternal('child_removed', key, null, null);
								
				return new Promise<any>((ok,err) => {
					var fb = this.state.getTree(this.getUrl() + key +'/');
					fb.remove((fberr) => {
						if (fberr) {
							err(fberr);
						} else {
							ok(null);
						}
					});
				});
			}
			
			fetch(ctx:Object, key :string|number|Api.Entity) :Promise<EventDetails<E>> {
				var k = this.normalizeKey(key);
				var evt = this.findCreateChildFor(k);
				return (<Api.IEntityOrReferenceEvent<E>><any>evt).load(ctx);
			}
			
			with(key :string|number|Api.Entity) :Api.IEntityOrReferenceEvent<E> {
				var k = this.normalizeKey(key);
				return <Api.IEntityOrReferenceEvent<E>><any>this.findCreateChildFor(k);
			}
			
			isLoaded() {
				return this.collectionLoaded;
			}
			
			assertLoaded() {
				if (!this.collectionLoaded) throw new Error("Collection at url " + this.getUrl() + " is not loaded");
			}
			
			internalSave() :Promise<any> {
				if (!this.isLoaded()) {
					//console.log('not saving cause not loaded');
					// TODO maybe we should save children that were loaded anyway
					return;
				}
				return new Promise<any>((ok,err) => {
					var fb = this.state.getTree(this.getUrl());
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
			
			clear() :Promise<any> {
				this.clearInternal();
				return new Promise<any>((ok,err) => {
					var fb = this.state.getTree(this.getUrl());
					var obj = {};
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
			
			parseValue(allds :Spi.DbTreeSnap) {
				var prevKey = null;
				var det = new EventDetails<E>();
				det.originalEvent = "child_added";
				det.populating = true; 
				det.type = Api.EventType.ADDED;
				// we have to clear the pre-existing data
				this.clearInternal();
				if (allds) {
					allds.forEach((ds)=>{
						var subev = this.findCreateChildFor(ds.key());
						var val :E = null;
						subev.parseValue(ds);
						val = <E>subev.entity;
						det.originalKey = ds.key();
						det.originalUrl = ds.ref().toString();
						det.precedingKey = prevKey;
						det.payload = val;
						prevKey = ds.key();
						subev.applyHooks(det);
						
						this.addToInternal('child_added',ds.key(),val,det);
					});
				}
				this.collectionLoaded = true;		
			}
			
			query() :Api.IQuery<E> {
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
  			
			
			addToInternal(event :string, key, val :E, det :EventDetails<E>) {
				var key = key;
				if (!this.keys || !this.arrayValue || !this.collection.realField) {
					this.keys = [];
					this.arrayValue = [];
					this.collection.realField = {};
				}
				var curpos = this.findPositionFor(key);
				if (event == 'child_removed') {
					delete this.collection.realField[key];
					if (curpos > -1) {
						this.arrayValue.splice(curpos,1);
						this.keys.splice(curpos,1);
					}
					return;
				}
				this.collection.realField[key] = val;

				// TODO this does not keep sorting
				var newpos = det ? this.findPositionAfter(det.precedingKey) : 0;
				
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
			
			clearInternal() {
				this.keys = [];
				this.arrayValue = [];
				this.collection.realField = {};
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
		
		export class ArrayCollectionEvent<E extends Api.Entity> extends MapEvent<E> {
			protected evarray = new EventedArray<E>(this);

			setEntity(entity :Api.Entity) {
				var preReal = this.realField || {};
				super.setEntity(entity);
				this.realField = preReal;
				this.evarray.arrayValue = <E[]>entity;
			}

			
			add(value? :Api.Entity) :Promise<any> {
				if (arguments.length > 1) throw new Error("Cannot add to set or list specifying a key, add only the entity");
				var v = value;
				var k = this.createKeyFor(v);
				return super.add(k,v);
			}
			
			intSuperAdd(key :string|number|Api.Entity, value? :Api.Entity) :Promise<any> {
				return super.add(key,value);
			}

			addToInternal(event :string, key :string, val :E, det :EventDetails<E>) {
				this.evarray.addToInternal(event, key, val, det);
				this.setEntityOnParent(this.evarray.arrayValue);
			}
			
			clearInternal() {
				this.evarray.clearInternal();
				this.setEntityOnParent(this.evarray.arrayValue);
			}
			

			load(ctx:Object) :Promise<E[]> {
				return super.load(ctx).then(()=>this.evarray.arrayValue);
			}
			
			dereference(ctx:Object) :Promise<E[]> {
				return super.dereference(ctx).then(()=>this.evarray.arrayValue);
			}
			
		}
		
		export class ListEvent<E extends Api.Entity> extends ArrayCollectionEvent<E> implements Api.IListSetEvent<E> {
			createKeyFor(value :Api.Entity) :string {
				if (this.isReference) return Utils.IdGenerator.next();
				var enturl = this.state.createEvent(value).getUrl();
				if (!enturl)  return Utils.IdGenerator.next();
				if (!this.getUrl() || enturl.indexOf(this.getUrl()) != 0) {
					throw new Error("Cannot add to a list (" + this.getUrl() + ") the embedded entity loaded or saved somewhere else (" + enturl + "), use .clone()");
				}
				enturl = enturl.substr(this.getUrl().length);
				enturl = enturl.replace(/\//g,'');
				return enturl;
			}
			
			normalizeKey(key :string|number|Api.Entity) :string {
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
			
			intPeek(ctx:Object, dir :number) :Promise<Api.IEventDetails<E>> {
				return new Promise<Api.IEventDetails<E>>((ok,err)=>{
					this.query().limit(dir).added(ctx, (det)=>{
						det.offMe();
						ok(det);
					});
				});
			}
			
			intPeekRemove(ctx:Object, dir:number) :Promise<Api.IEventDetails<E>> {
				var fnd :Api.IEventDetails<E>;
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
		
		export class SetEvent<E extends Api.Entity> extends ArrayCollectionEvent<E> {
			
			createKeyFor(value :Api.Entity) :string {
				// get the url
				var enturl = this.state.createEvent(value).getUrl();
				if (this.isReference) {
					// if it is a reference, use path from the root path
					if (!enturl) throw new Error("Cannot add to a set a reference that has not been loaded or not yet been saved");
					var entroot = this.state.entityRootFromUrl(enturl);
					enturl = entroot.getRemainingUrl(enturl);
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
			
			normalizeKey(key :string|number|Api.Entity) :string {
				if (typeof key === 'string') {
					key = <string>key;
				} else if (typeof key === 'number') {
					key = key + '';
				} else {
					return this.createKeyFor(<Api.Entity>key);
				}
				return <string>key;
			}
			
			serialize(localsOnly:boolean = false, fields? :string[]) :Object {
				this.evarray.prepareSerializeSet();
				return super.serialize(localsOnly, fields);
			}
			
		}
		
		export class IgnoreEvent<E extends Api.Entity> extends GenericEvent {
			val :any;
			
			setEntity() {
				// can't set entity, will refuse it, it's unmutable
			}
			
			parseValue(ds :Spi.DbTreeSnap) {
				this.val = ds && ds.val();
			}
			
			serialize() {
				return this.val;
			}
			
			isLocal() :boolean {
				return true;
			}
			
			internalSave() {
				return null;
			}
		}
		
		export class ObservableEvent<E extends Api.Entity> extends SingleDbHandlerEvent<E> implements Api.IObservableEvent<E> {
			
			updated(ctx:Object,callback :(ed:EventDetails<E>)=>void, discriminator :any = null) :void {
				var h = new EventHandler(ctx, callback, discriminator);
				super.on(h);
			}
			
			live(ctx:Object) {
				this.updated(ctx,()=>{});
			}
			
			parseValue(ds :Spi.DbTreeSnap) {
				this.setEntity(ds && ds.val());
				this.setEntityOnParent();
			}
			
			serialize() {
				return this.entity;
			}

			isLocal() :boolean {
				return true;
			}
			
			internalSave() {
				return null;
			}
		}

		
		export class EntityRoot<E extends Api.Entity> extends GenericEvent implements Api.IEntityRoot<E> {
			constructor(
				state :DbState,
				meta :ClassMetadata
			) {
				super();
				if (!meta.root) throw new Error("The entity " + meta.getName() + " is not a root entity");
				this.state = state;
				this.classMeta = meta;
			}
			
			findCreateChildFor(metaOrkey :string|MetaDescriptor, force :boolean = false):GenericEvent {
				var meta:MetaDescriptor = null;
				if (metaOrkey instanceof MetaDescriptor) {
					throw new Error("EntityRoot does not support children using MetaDescriptors");
				}
				return this.getEvent(<string>metaOrkey);
			}
			
			getEvent(id:string) :EntityEvent<E> {
				var url = this.getUrl() + id + "/";
				var event = <EntityEvent<E>>this.state.fetchFromCache(url);
				if (event) return event;
				
				var dis = null;
				var colonpos = id.indexOf('*');
				if (colonpos == 0) {
					dis = id.substring(1);
				} else if (colonpos > 0) {
					dis = id.substring(0,colonpos);
				}
				
				var meta = this.classMeta;
				if (dis) {
					var nmeta = this.state.myMeta.findDiscriminated(this.classMeta,dis);
					// TODO issue a warning if the discriminator can't be resolved, maybe?
					if (nmeta) meta = nmeta;
				}
				event = <EntityEvent<E>>meta.createEvent(this.state.myMeta);
				event.url = url;
				event.state = this.state;
				
				var inst = meta.createInstance();
				if (inst['dbInit']) {
					(<Api.IDb3Initable>inst).dbInit(url, this.state.db);
				}
				event.setEntity(inst);
				
				this.state.storeInCache(event);
				this.state.bindEntity(inst, event);
				
				return event;
			} 
			
			get(id:string) :E {
				var evt = this.getEvent(id);
				return <E>evt.entity;
			}
			
			idOf(entity :E) :string {
				if (!this.classMeta.isInstance(entity)) throw new Error("Instance is not of the right type");
				var ev = this.state.createEvent(entity);
				if (!ev) return null;
				var eu = ev.getUrl();
				if (!eu) return null;
				return eu.substr(this.getUrl().length).replace('/','');
			}
			
			query() :Api.IQuery<E> {
				var ret = new QueryImpl<E>(this);
				ret.classMeta = this.classMeta;
				this.addDependant(ret);
				return ret;
			}
			
			getUrl() :string {
				return this.state.getUrl() + this.classMeta.root + '/';
			}
			
			getRemainingUrl(url :string) :string {
				url = this.state.makeRelativeUrl(url);
				if (!url) return null;
				return url.substr(this.getUrl().length);
			}
			
			internalSave() {
				return null;
			}
		}
		
		export class QueryImpl<E> extends ArrayCollectionEvent<E> implements Api.IQuery<E> {
			
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
				h.ref = this.state.getTree(this.parent.getUrl());
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
				h.event = this;
				h.hookAll((ds,prev,event) => this.handleDbEvent(h,event,ds,prev));
			}

			findCreateChildFor(metaOrkey :string|MetaDescriptor, force :boolean = false):GenericEvent {
				return this.parent.findCreateChildFor(metaOrkey, force);
			}
			
			save() :Promise<any> {
				throw new Error("Can't save a query");
			}
			
			urlInited() {
				// Do nothing, we are not a proper event, should not be stored in cache or something
			}
		}
		
		export class ChainedEvent {
			private events :Api.IEvent[] = [];
			
			constructor(private state :DbState, firstEvent? :Api.IEvent, secondCall? :any) {
				if (firstEvent) this.add(firstEvent);
				if (secondCall) this.and(secondCall);
			}
			
			and(param:any):ChainedEvent {
				var evt = <Api.IEvent>this.state.internalDb(param);
				this.add(evt);
				return this;
			}
			
			add(evt :Api.IEvent) {
				this.events.push(evt);
				var methods = Utils.findAllMethods(evt);
				for (var name in methods) {
					if (name === 'constructor') continue;
					this.makeProxyMethod(name);
				}
			}
			
			private makeProxyMethod(name :string) {
				var me = this;
				this[name] = function() {
					var args = Array.prototype.slice.apply(arguments);
					return me.proxyCalled(name, args);
				};
			}
			
			private proxyCalled(name :string, args :any[]):any {
				var proms :Thenable<any>[] = [];
				var anded = true;
				var other :any;
				for (var i = 0; i < this.events.length; i++) {
					var evt = this.events[i];
					var fn = <Function>evt[name];
					var ret = fn.apply(evt, args);
					if (typeof ret === 'boolean') {
						anded = anded && ret;
					} else if (typeof ret === 'object') {
						if (typeof ret['then'] === 'function') {
							proms.push(<Thenable<any>>ret);
						}
					} else {
						other = ret;
					}
				}
				if (proms.length > 0) {
					return Promise.all(proms);
				} else if (typeof other !== 'undefined') {
					return other;
				} else {
					return anded;
				}
			}
		}
		
		
		export class DbState implements Api.IDbOperations {
			cache :{[index:string]:GenericEvent} = {};
			conf :Api.DatabaseConf;
			myMeta = allMetadata;
			serverIo :Api.Socket;
			db :Api.IDb3Static;
			treeRoot :Spi.DbTreeRoot;
			
			constructor() {
				var me = this;
				this.db = <Api.IDb3Static><any>function() { return me.internalDb.apply(me,arguments); };
			}
			
			configure(conf :Api.DatabaseConf) {
				this.conf = conf;
				if (conf.clientSocket) {
					var csf :Api.IClientSideSocketFactory = null;
					if (conf.clientSocket === 'default') {
						csf = new Api.DefaultClientSideSocketFactory();
					} else if (typeof conf.clientSocket === 'string') {
						// TODO what to do with it? eval? require?
					} else {
						csf = <Api.IClientSideSocketFactory>conf.clientSocket;
					}
					this.serverIo = csf.connect(conf);
				}
				this.treeRoot = Spi.getRoot(conf);
				// TODO filter metas
				// TODO integrity tests on metas
				// - double roots
			}
			
			getTree(url:string) :Spi.DbTree {
				return this.treeRoot.getUrl(url);
			}
			
			internalDb(param:any):any {
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
					return this;
				}
				// Pass-thru for when db(something) is used also when not needed
				if (param instanceof GenericEvent) return param;
				
				if (typeof param == 'function') {
					return this.entityRoot(param);
				} else if (!e) {
					e = param;
				}
				
				var ret = this.createEvent(e, stack);
				return ret;
			}
			
			fork(conf :any) :Api.IDb3Static {
				var nconf = {};
				Utils.copyObj(this.conf, nconf);
				Utils.copyObj(conf, nconf);
				return createDb(nconf);
			}
			
			erase() {
				this.reset();
				this.treeRoot.getUrl(this.getUrl()).remove();
			}
			
			reset() {
				// Automatic off for all handlers
				for (var k in this.cache) {
					var val = this.cache[k];
					if (val instanceof GenericEvent) {
						(<GenericEvent>val).offAll();
					}
				}
				// Clean the cache
				this.cache = {};
			}
			
			entityRoot(ctor :Api.EntityType<any>) :EntityRoot<any>;
			entityRoot(meta :ClassMetadata) :EntityRoot<any>;
			entityRoot(param :any) :EntityRoot<any> {
				var meta :ClassMetadata = null;
				if (param instanceof ClassMetadata) {
					meta = param;
				} else {
					meta = this.myMeta.findMeta(param);
				}
				// change the meta based on current overrides
				meta = meta.findOverridden(this.conf.override);
				return new EntityRoot<any>(this, meta);
			}
			
			makeRelativeUrl(url :string) :string {
				if (url.indexOf(this.getUrl()) != 0) {
					url = this.treeRoot.makeRelative(url);
					if (!url) return null;
				}
				return url;
			}
			
			entityRootFromUrl(url :string) :EntityRoot<any> {
				// Check if the given url pertains to me
				url = this.makeRelativeUrl(url);
				if (!url) return null;
				if (url.indexOf(this.getUrl()) != 0) return null;
				// Make the url relative
				var relurl = url.substring(this.getUrl().length);
				var meta = this.myMeta.findRooted(relurl);
				if (!meta) throw new Error("No entity root found for url " + url);
				return this.entityRoot(meta); 
			}
			
			getUrl() :string {
				return '/';
			}
			
			bindEntity(e :Api.Entity, ev :EntityEvent<any>) {
				// TODO probably we should check and raise an error is the entity was already bound
				entEvent.set(e, ev);
			}
			
			createEvent(e :Api.Entity, stack :MetaDescriptor[]|string[] = []) :GenericEvent {
				var roote :GenericEvent = entEvent.get(e);
				if (!roote) {
					var clmeta = this.myMeta.findMeta(e);
					var nre = new EntityEvent();
					nre.state = this;
					nre.setEntity(e);
					nre.classMeta = clmeta;
					roote = nre;
					entEvent.set(e, <EntityEvent<any>>roote);
				} else {
					if (roote.state != this) throw new Error("The entity " + roote.getUrl(true) + " is already attached to another database, not to " + this.getUrl());
				}
				// Follow each call stack
				var acp = roote;
				for (var i = 0; i < stack.length; i++) {
					// check if we have to traverse first
					acp = acp.getTraversed() || acp;
					// search child event if any
					var sube = acp.findCreateChildFor(stack[i]);
					if (!sube) throw new Error("Cannot find an event for " + stack[i]);
					sube.state = this;
					acp = sube;
				}
				return acp;
			}
			
			loadEvent(url :string) :GenericEvent {
				
				if (url.charAt(url.length - 1) != '/') url += '/';
				var ret = this.cache[url];
				if (ret) return ret;
				
				// Find the entity root
				var entroot = this.entityRootFromUrl(url);
				if (!entroot) {
					throw "The url " + url + " cannot be connected to an entity";
				}
				var remurl = entroot.getRemainingUrl(url);
				
				// Tokenize the url
				var toks = remurl.split("/");
				while (!toks[toks.length - 1]) toks.pop();
				
				// Get the root event
				var roote = entroot.getEvent(toks[0]);
				if (toks.length > 1) {
					// Use the rest to recursively create events
					var evt = this.createEvent(roote.entity, toks.slice(1));
					return evt;
				} else {
					return roote;
				}
			}
			
			/**
			 * Adds an event to the cache.
			 */
			storeInCache(evt :GenericEvent) {
				var url = evt.getUrl();
				if (!url) return;
				var pre = this.cache[url];
				if (pre && pre !== evt) {
					throw new Error('Storing in cache two different events for the same key ' + url);
				}
				this.cache[url] = evt;
			}
			
			/**
			 * Removes an event from the cache.
			 */
			evictFromCache(evt :GenericEvent) {
				var url = evt.getUrl();
				if (!url) return;
				delete this.cache[url];
			}
			
			fetchFromCache(url :string) {
				return this.cache[url];
			}
			
			loadEventWithInstance(url :string) :GenericEvent {
				var dis = null;
				var segs = url.split('/');
				var lastseg = segs.pop();
				if (!lastseg) lastseg = segs.pop();
				var colonpos = lastseg.indexOf('*');
				if (colonpos == 0) {
					dis = lastseg.substring(1);
					url = url.substring(0,url.lastIndexOf('/') + 1);
				} else if (colonpos > 0) {
					dis = lastseg.substring(0,colonpos);
				}
				// clean the url from discriminator
				var event = this.loadEvent(url);
				var meta = event.classMeta;
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
							(<Api.IDb3Initable>inst).dbInit(url, this.db);
						}
						event.setEntity(inst);
					}
				}
				return event;
			}
			
			load(ctx :Object, url :string) :Promise<Api.IEventDetails<any>> {
				var evt = this.loadEvent(url);
				if (evt['load']) {
					return evt['load'](ctx);
				}
				throw new Error("The url " + url + " cannot be loaded");
			}
			
			tree() :Spi.DbTreeRoot {
				return this.treeRoot;
			}
			
			
			/**
			* Executes a method on server-side. Payload is the only parameter passed to the "method" event
			* from the callServerMethod method. 
			* 
			* This method will return a Promise to return to the socket when resolved. 
			*/
			executeServerMethod(ctx :Api.IRemoteCallContext, payload :any) :Promise<any> {
				if (!ctx.db) ctx.db = this.db;
				try {
					var promises :Promise<any>[] = [];
					var fn :Function = null;
					var stat = false;
					if (payload.entityUrl.indexOf('staticCall:') === 0) {
						stat = true;
						var clname = payload.entityUrl.substr(11);
						var meta = this.myMeta.findNamed(clname);
						if (!meta) throw new Error("Can't find class named " + clname);
						meta = meta.findOverridden(this.conf.override);
						if (!meta) throw new Error("Can't find override of class " + clname + " for " + this.conf.override);
						fn = <Function>meta.ctor[payload.method];
						if (!fn) throw new Error("Can't find method");
						promises.push(Promise.resolve(meta.ctor));
					} else {
						var entevt = this.loadEventWithInstance(payload.entityUrl);
						if (!entevt) throw new Error("Can't find entity");
						fn = <Function>entevt.entity[payload.method];
						if (!fn) throw new Error("Can't find method");
						// Disabled automatic loading of target entity, the method will do what needed if needed
						if (entevt['load']) {
							promises.push(<Promise<any>>entevt['load'](ctx));
						} else {
							promises.push(Promise.resolve(entevt.entity));
						}
						/*
						promises.push(Promise.resolve(entevt.entity));
						*/
					}
					
					var parnames = Utils.findParameterNames(fn);
					var appendCtx = (parnames.length > 0 && parnames[parnames.length - 1] == '_ctx') ? parnames.length - 1 : -1;  
						
					promises.push(Utils.deserializeRefs(this.db, ctx,<any[]>payload.args));
					
					var entity :any;
					var params :any[];
					return Promise.all(promises).then((values) => {
						entity = values[0].payload;
						params = values[1];
						// Inject the ctx, if any
						if (appendCtx > -1) {
							while (params.length < appendCtx) params.push(undefined);
							params.push(ctx);
						}
						if (ctx.checkExecuting) {
							return ctx.checkExecuting(entity, payload.method, stat, params, fn, payload);
						} else {
							return true;
						}
					}).then((exec)=>{
						if (exec) {
							return <Promise<any>>fn.apply(entity,params);
						} else {
							throw new Error("Context check failed");
						}
					}).then((ret) => {
						return Utils.serializeRefs(ret);
					});
				} catch (e) {
					console.log("Error executing remote invocation", e);
					return Promise.resolve({error: e.toString()});
				}
			}
		}
		
		/**
		* Send to the server a server-side method call. 
		* 
		* The protocol is very simply this :
		* 	- A "method" event is send to th server
		*  - The only parameter is an object with the following fields :
		*  - "entityUrl" is the url of the entity the method was called on
		*  - "method" is the method name
		*  - "args" is the arguments of the call
		* 
		* If in the arguments there is a saved entity (one with a URL), the url will be sent,
		* so that the server will operate on database data.
		* 
		* The server can return data or simply aknowledge the execution. When this happens the
		* promise will be fulfilled.
		* 
		* The server can return an error by returning an object with an "error" field
		* containing a string describing the error. In that case the promise will be failed.  
		*/
		export function remoteCall(inst :Api.Entity, name :string, params :any[]) {
			var state :DbState = defaultDb['state'];
			if (typeof(inst) === 'function') {
				// It's a static call, try to find a database instance
				for (var i = 0; i < params.length; i++) {
					if (typeof(params[i]) === 'function' && params[i]['state']) {
						state = params[i]['state'];
						params.splice(i,1);
						break;
					}
				}
				if (!state) {
					if (!defaultDb) throw Error("No db given as parameter, and no default db, create a db before invoking a static remote method, while invoking " + Utils.findName(inst) + "." + name);
					state = <DbState>defaultDb();
				}
			} else {
				var ev = <GenericEvent><any>Db.of(inst);
				if (!ev) throw new Error("The object is not bound to a database, cannot invoke remote method, while invoking " + Utils.findName(inst) + "." + name);
				if (!ev.getUrl()) throw new Error("The object is not saved on the database, cannot invoke remote method, while invoking " + Utils.findName(inst) + "." + name);
				state = ev.state;
			}
			
			var msg = createRemoteCallPayload(inst, name, params);
			
			var io = state.serverIo;
			if (!io) throw new Error("Database is not configured for remote method call, while invoking " + Utils.findName(inst) + "." + name);
			return new Promise<any>((res,err) => {
				io.emit('method', msg, function(resp) {
					if (resp && resp.error) {
						err(resp);
					} else {
						// If the return value is an entity, it will be serialized as a _ref
						Utils.deserializeRefs(state.db, inst, resp).then((val)=>{
							res(val);
						});
					}
				});
			});
		}
		
		export function createRemoteCallPayload(inst :any, name :string, params :any[]) {
			var ident = "";
			if (typeof(inst) === 'function') {
				ident = "staticCall:" + Utils.findName(inst);
			} else {
				var ev = <GenericEvent><any>Db.of(inst);
				ident = ev.getUrl();
			}
			
			return {
				entityUrl: ident,
				method: name,
				args: Utils.serializeRefs(params)
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
			
			get ctor():Api.EntityType<any> {
				if (this._ctor == null) {
					return null;
				}
				var ret :Api.EntityType<any> = null;
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
			
			createInstance() :Api.Entity {
				return new this.ctor();
			}
			
			rightInstance(entity :Api.Entity) :boolean {
				// TODO maybe should do a stricter check here?
				return entity && entity instanceof this.ctor;
			}
			
			isInstance(entity :Api.Entity) :boolean {
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
			
			findOverridden(override :string) :ClassMetadata {
				if (!override) return this;
				if (this.override == override) return this;
				for (var i = this.subMeta.length - 1; i >= 0; i--) {
					var subc = this.subMeta[i];
					if (subc.override == override) {
						return subc;
						break;
					}
				}
				return this;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				var ret = new EntityEvent();
				ret.url = this.getRemoteName();
				ret.classMeta = this;
				return ret;
			}
		}
		

		
		export class EmbeddedMetaDescriptor extends MetaDescriptor {
			binding: Api.IBinding = null;
			
			named(name :string) :EmbeddedMetaDescriptor {
				super.named(name);
				return this;
			}
			
			createEvent(allMetadata :Metadata) :EntityEvent<any> {
				var ret = new EntityEvent();
				ret.url = this.getRemoteName();
				// TODO i need this search? can't i cache this?
				// TODO maybe we should assert here that there is a metadata for this type
				ret.classMeta = allMetadata.findMeta(this.ctor);
				ret.nameOnParent = this.localName;
				ret.binding = <BindingImpl>this.binding;
				return ret;
			}
			
			setBinding(binding :Api.IBinding) {
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
				if (this.ctor) {
					ret.classMeta = allMetadata.findMeta(this.ctor);
				}
				ret.nameOnParent = this.localName;
				ret.project = this.project;
				return ret;
			}
			
		}
		
		export class CollectionMetaDescriptor extends MetaDescriptor {
			isReference = false;
			sorting :Api.SortingData = null;
			project :string[];
			binding :Api.IBinding;
			
			configure(allMetadata :Metadata, ret :MapEvent<any>) :MapEvent<any> {
				ret.url = this.getRemoteName();
				// TODO i need this search? can't i cache this?
				// TODO maybe we should assert here that there is a metadata for this type
				ret.classMeta = allMetadata.findMeta(this.ctor);
				ret.nameOnParent = this.localName;
				ret.isReference = this.isReference;
				ret.sorting = this.sorting;
				ret.project = this.project;
				ret.binding = <BindingImpl>this.binding;
				return ret;
			}
		}
		
		export class MapMetaDescriptor extends CollectionMetaDescriptor {
			named(name :string) :MapMetaDescriptor {
				super.named(name);
				return this;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				return super.configure(allMetadata, new MapEvent());
			}
		}
		
		export class SetMetaDescriptor extends CollectionMetaDescriptor {
			named(name :string) :SetMetaDescriptor {
				super.named(name);
				return this;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				return super.configure(allMetadata, new SetEvent());
			}
		}

		export class ListMetaDescriptor extends CollectionMetaDescriptor {
			named(name :string) :SetMetaDescriptor {
				super.named(name);
				return this;
			}
			
			createEvent(allMetadata :Metadata) :GenericEvent {
				return super.configure(allMetadata, new ListEvent());
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
			
			findMeta(param :Api.EntityType<any>|Api.Entity) {
				var ctor :Api.EntityType<any> = null;
				if (typeof param !== 'function') {
					ctor = <Api.EntityType<any>>param.constructor;
				} else {
					ctor = <Api.EntityType<any>>param;
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
			
			findNamed(name :string) :ClassMetadata {
				for (var i = 0; i < this.classes.length; i++) {
					if (this.classes[i].getName() == name) return this.classes[i];
				}
				return null;
			}
		}
		
		export function getAllMetadata() :Metadata {
			return allMetadata;
		}
		
		export function getLastEntity() :Api.Entity {
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
			var acproto = (<Api.EntityType<any>>o).prototype;
			if (!acproto) {
				acproto = Object.getPrototypeOf(o);
				firstCtor = o.constructor;
			}
			if (!firstCtor) return null;
			var funcNameRegex = /function (.{1,})\(/;
			var results  = (funcNameRegex).exec(firstCtor.toString());
			return (results && results.length > 1) ? results[1] : null;
		}
		
		export function findHierarchy(o :Api.Entity|Api.EntityType<any>) : Api.EntityType<any>[] {
			var firstCtor = o;
			var acproto = (<Api.EntityType<any>>o).prototype;
			if (!acproto) {
				acproto = Object.getPrototypeOf(o);
				firstCtor = <Api.Entity>o.constructor;
			}
			if (!acproto) throw new Error("Cannot reconstruct hierarchy following prototype chain of " + o);
			var ret :Api.EntityType<any>[] = [];
			while (acproto) {
				var acctor = acproto.constructor; 
				if (acctor === Object) break;
				acproto = Object.getPrototypeOf(acproto);
				if (acctor === firstCtor) continue;
				ret.push(acctor);
			}
			return ret;
		}
		
		export function findAllMethods(o :Api.Entity|Api.EntityType<any>) :{[index:string]:Function} {
			var hier = findHierarchy(o);
			var firstCtor = <Api.EntityType<any>>o;
			var acproto = (<Api.EntityType<any>>o).prototype;
			if (!acproto) {
				acproto = Object.getPrototypeOf(o);
				firstCtor = <Api.EntityType<any>>o.constructor;
			}
			hier.unshift(firstCtor);
			var ret :{[index:string]:Function} = {};
			for (var i = 0; i < hier.length; i++) {
				var acproto = hier[i].prototype;
				for (var name in acproto) {
					if (ret[name]) continue;
					var val = o[name];
					if (typeof val !== 'function') continue;
					ret[name] = val;
				}
			}
			return ret;
		}
		
		var STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
		var ARGUMENT_NAMES = /([^\s,]+)/g;
		
		export function findParameterNames(func :Function) :string[] {
			var fnStr = func.toString().replace(STRIP_COMMENTS, '');
			var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
			if(result === null)
				result = [];
			return result;
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
				to[k] = copyVal(val, to[k]);
			}
		}
		
		export function copyVal(val :any, to?:any):any {
			if (val === null) return null;
			if (typeof val === 'undefined') return;
			if (Object.prototype.toString.call(val) === '[object Array]') {
				var arrto = to || [];
				var arrfrom = <any[]>val;
				for (var i = 0; i < arrfrom.length; i++) {
					arrto[i] = (copyVal(arrfrom[i], arrto[i]));
				}
			} else if (typeof val === 'object') {
				var valto = to || {};
				copyObj(val, valto);
				return valto;
			}
			return val;
		}
		
		export function serializeRefs(from :any) :any {
			if (from === null || typeof from === 'undefined') return null;
			if (Array.isArray(from)) {
				var retArr = [];
				for (var i = 0; i < from.length; i++) {
					retArr[i] = serializeRefs(from[i]);
				}
				return retArr;
			}
			if (typeof(from) === 'object') {
				// Check if it's an entity
				var ev = Db.of(from);
				if (ev && ev.getUrl()) {
					return {_ref:ev.getUrl()};
				}
				var ks = Object.keys(from);
				var retObj = {};
				for (var i = 0; i < ks.length; i++) {
					retObj[ks[i]] = serializeRefs(from[ks[i]]);
				}
				return retObj;
			}
			return from;
		}
		
		export function deserializeRefs(db :Api.IDb3Static, ctx :Object, from :any) :Promise<any> {
			if (from === null || typeof from === 'undefined') return Promise.resolve(null);
			var ret = {};
			var promises :Promise<any>[] = [];
			intDeserializeRefs(db, ctx, promises, {base:from}, ret, 'base');
			return Promise.all(promises).then((vals) => {
				return ret['base'];
			});
		}
		
		function intDeserializeRefs(db :Api.IDb3Static, ctx :Object, promises :Promise<any>[], src :any, to :any, key :number|string) {
			var from = src[key];
			if (Array.isArray(from)) {
				var retArr = [];
				to[key] = retArr;
				for (var i = 0; i < from.length; i++) {
					intDeserializeRefs(db, ctx, promises, from, retArr, i);
				}
			} else if (typeof(from) === 'object') {
				if (from._ref) {
					var prom = db().load(ctx, from._ref);
					promises.push(prom);
					to[key] = null;
					prom.then((det)=>{
						to[key] = det.payload;
					});
				} else {
					var retObj = {};
					to[key] = retObj;
					var ks = Object.keys(from);
					for (var i = 0; i < ks.length; i++) {
						intDeserializeRefs(db, ctx, promises, from, retObj, ks[i]);
					}
				}
			} else {
				to[key] = from;
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
			
			private getOnly(k :Object) {
				return k['__weaks'];
			}
			
			private getOrMake(k :Object) {
				if (!k.hasOwnProperty('__weaks')) { 
					Object.defineProperty(k, '__weaks', {writable:true, enumerable:false,value:{}});
				}
				return k['__weaks'];
			}
			
			get(k:any) :V {
				if (this.wm) return this.wm.get(k);
				var obj = this.getOnly(k);
				if (!obj) return undefined;
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
	
	export function bind(localName :string, targetName :string, live :boolean = true) :Api.IBinding {
		var ret = new Internal.BindingImpl();
		ret.bind(localName, targetName,live);
		return ret;
	}
	
	export function sortBy(field :string, desc = false) : Api.SortingData {
		return {
			field: field,
			desc :desc
		};
	}
	
	// --- Annotations
	export function embedded(def :Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.EmbeddedParams, binding? :Api.IBinding) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			if (!def) throw new Error("Cannot find embedded class for " + propertyKey.toString());
			var ret = meta.embedded(def, binding);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function reference(def? :Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.ReferenceParams, project? :string[]) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			//if (!def) throw new Error("Cannot find referenced class for " + propertyKey.toString());
			var ret = meta.reference(def, project);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function map(valueType :Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.CollectionParams, reference :boolean = false) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			if (!valueType) throw new Error("Cannot find map value type for " + propertyKey.toString());
			var ret = meta.map(valueType, reference);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}
	
	export function set(valueType :Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.CollectionParams, reference :boolean = false) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			if (!valueType) throw new Error("Cannot find set value type for " + propertyKey.toString());
			var ret = meta.set(valueType, reference);
			addDescriptor(target, propertyKey, ret);
			installMetaGetter(target, propertyKey.toString(), ret);
		}
	}

	export function list(valueType :Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.CollectionParams, reference :boolean = false) :PropertyDecorator {
		return function(target: Object, propertyKey: string | symbol) {
			if (!valueType) throw new Error("Cannot find list value type for " + propertyKey.toString());
			var ret = meta.list(valueType, reference);
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
			meta.define(<Api.EntityType<any>><any>target, myname, null, override);
		}
	}
	
	export function discriminator(disc :string) :ClassDecorator {
		return function (target: Function) {
			meta.define(<Api.EntityType<any>><any>target, null, disc);
		}
	}
	
	export function override(override :string = 'server') :ClassDecorator {
		return function (target: Function) {
			meta.define(<Api.EntityType<any>><any>target, null, null, override);
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
	
	export interface TypedMethodDecorator<T> {
		(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>) : TypedPropertyDescriptor<T> | void;
	}

	
	export function remote(settings? :Api.RemoteCallParams) :TypedMethodDecorator<(...args :any[]) => Promise<any>> {
		return function(target :Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<(...args :any[]) => Promise<any>>) {
			var localStub = descriptor.value;
			descriptor.value = function (...args :any[]) {
				var prom = Internal.remoteCall(this, propertyKey.toString(), args);
				if (localStub) localStub.apply(this, args);
				return prom;
			}
		}
	}
	
	function addDescriptor(target: Object, propertyKey: string | symbol, ret :Internal.MetaDescriptor) {
		ret.setLocalName(propertyKey.toString());
		var clmeta = allMetadata.findMeta(<Api.EntityType<any>><any>target.constructor);
		clmeta.add(ret);
	}
	
	// --- Metadata stuff
	var allMetadata = new Internal.Metadata();
	
	var lastEntity :Api.Entity = null;
	var lastMetaPath :Internal.MetaDescriptor[] = [];
	var lastCantBe = 'ciao';
	var lastExpect :any = null;
	
	var nextInternal = false;

	function getProp(target :Object, name: string) {
		var map = props.get(target);
		if (!map) return;
		return map[name];
	}
	
	function setProp(target :Object, name :string, val :any) {
		var map = props.get(target);
		if (!map) {
			map = {};
			props.set(target, map);
		}
		map[name] = val;
	}
	
	function installMetaGetter(target: Object, propertyKey: string, descr :Internal.MetaDescriptor) {
		//var nkey = '__' + propertyKey;

		Object.defineProperty(target,propertyKey, {
			enumerable: true,
			set: function(v) {
				if (nextInternal) {
					nextInternal = false;
					setProp(this, propertyKey, v);
					//this[nkey] = v;
					return;
				}
				Internal.clearLastStack();
				setProp(this, propertyKey, v);
				//this[nkey] = v;
				var mye = entEvent.get(this);
				if (mye) {
					mye.findCreateChildFor(propertyKey, true);
				}
			},
			get: function() {
				if (nextInternal) {
					nextInternal = false;
					return getProp(this, propertyKey);
					//return this[nkey];
				}
				if (lastExpect && this !== lastExpect) {
					Internal.clearLastStack();
				}
				if (!lastEntity) lastEntity = this;
				lastMetaPath.push(descr);
				//var ret = this[nkey];
				var ret = getProp(this, propertyKey);
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
		export function embedded(def :Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.EmbeddedParams, binding? :Api.IBinding) :Db.Internal.EmbeddedMetaDescriptor {
			if ((<Api.EmbeddedParams>def).type) {
				binding = binding || (<Api.EmbeddedParams>def).binding;
				def = (<Api.EmbeddedParams>def).type;
			}
			if (!def) throw new Error("Cannot find embedded class");
			var ret = new Db.Internal.EmbeddedMetaDescriptor();
			ret.setType(def);
			ret.setBinding(binding);
			return ret;
		}
		
		export function reference(def :Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.ReferenceParams, project? :string[]) :Db.Internal.ReferenceMetaDescriptor {
			if (arguments.length == 1 && def && ((<Api.ReferenceParams>def).type || (<Api.ReferenceParams>def).projections)) {
				project = project || (<Api.ReferenceParams>def).projections;
				def = (<Api.ReferenceParams>def).type;
			}
			//if (!def) throw new Error("Cannot find referenced class");
			var ret = new Db.Internal.ReferenceMetaDescriptor();
			ret.setType(def);
			ret.project = project;
			return ret;
		}
		
		function configureCollectionMeta<X extends Db.Internal.CollectionMetaDescriptor>(ret :X, def: Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.CollectionParams, reference? :boolean) :X {
			var sorting :Api.SortingData;
			var project :string[];
			var binding :Api.IBinding;
			if ((<Api.CollectionParams>def).type) {
				reference = typeof reference !== 'undefined' ? reference : (<Api.CollectionParams>def).reference;
				sorting = (<Api.CollectionParams>def).sorting;
				project = (<Api.CollectionParams>def).projections;
				binding = (<Api.CollectionParams>def).binding;
				def = (<Api.CollectionParams>def).type;
			}
			if (!def) throw new Error("Cannot find map value type");
			ret.setType(def);
			ret.isReference = reference;
			ret.sorting = sorting;
			ret.project = project;
			ret.binding = binding;
			return ret;
		}
		
		export function map(def: Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.CollectionParams, reference? :boolean) :Db.Internal.MapMetaDescriptor {
			return configureCollectionMeta(new Db.Internal.MapMetaDescriptor(), def, reference);
		}
		
		export function set(def: Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.CollectionParams, reference? :boolean) :Db.Internal.SetMetaDescriptor {
			return configureCollectionMeta(new Db.Internal.SetMetaDescriptor(), def, reference);
		}
		
		export function list(def: Api.EntityType<any>|Api.EntityTypeProducer<any>|Api.CollectionParams, reference? :boolean) :Db.Internal.ListMetaDescriptor {
			return configureCollectionMeta(new Db.Internal.ListMetaDescriptor(), def, reference);
		}
		
		export function observable() :Db.Internal.ObservableMetaDescriptor {
			var ret = new Db.Internal.ObservableMetaDescriptor();
			return ret;
		}
		
		export function ignore() :Db.Internal.IgnoreMetaDescriptor {
			var ret = new Db.Internal.IgnoreMetaDescriptor();
			return ret;
		}
		
		export function define(ctor :Api.EntityType<any>, root? :string, discriminator? :string, override? :string) {
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
var defaultDb :Db.Api.IDb3Static = null;

/**
 * Weak association between entities and their database events. Each entity instance can be 
 * connected only to a single database event, and as such to a single database.
 */
var entEvent = new Db.Utils.WeakWrap<Db.Internal.EntityEvent<any>>();


/**
 * Weak association for properties handled by meta getters and setters.
 */
var props = new Db.Utils.WeakWrap<{[index:string]:any}>();

export = Db;



