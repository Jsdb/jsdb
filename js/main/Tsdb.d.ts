
declare class Tsdb {
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
    static of: Tsdb.Api.IDb3Static;
}
/**
 * The main Db module.
 */
declare module Tsdb {
    /**
     * Create a database instance using given configuration. The first call to this function
     * will also initialize the {@link defaultDb}.
     *
     * TODO extend on the configuration options
     *
     * @return An initialized and configured db instance
     */
    function configure(conf: Api.DatabaseConf): Tsdb.Api.IDb3Static;
    /**
     * Return the {@link defaultDb} if any has been created.
     */
    function getDefaultDb(): Tsdb.Api.IDb3Static;
    module Api {
        /**
         * Empty interface, and as such useless in typescript, just to name things.
         */
        interface Entity {
        }
        /**
         * Definition of an entity constructor, just to name things.
         */
        interface EntityType<T extends Entity> {
            new (): T;
        }
        interface EntityTypeProducer<T extends Entity> {
            (): EntityType<T>;
        }
        interface IEntityHooks {
            postUpdate?(evd?: IEventDetails<any>): void;
            prePersist?(): void;
            preEvict?(): boolean;
        }
        /**
         * A type that describes a native value, an array of native values, or a map of native values.
         */
        type nativeArrObj = number | string | boolean | {
            [index: string]: string | number | boolean;
        } | {
            [index: number]: string | number | boolean;
        } | number[] | string[] | boolean[];
        /**
         * Main interface of the Db.
         */
        interface IDb3Static {
            /**
             * Access to global db operations, see {@link IDbOperations}.
             */
            (): IDbOperations;
            /**
             * Pass-thru for when db(something) is used also when not needed.
             */
            <E extends Internal.GenericEvent>(evt: E): E;
            /**
             * Access to an entity root given the entity class.
             */
            <T extends Entity>(c: EntityType<T>): IEntityRoot<T>;
            /**
             * TBD
             */
            /**
             * Access to an {@link observable} value in an entity.
             */
            <V extends nativeArrObj>(value: V): IObservableEvent<V>;
            /**
             * Access to a {@link map} value in an entity.
             */
            <T extends Entity>(map: {
                [index: string]: T;
            }): IMapEvent<T>;
            /**
             * Access to a {@link list} value in an entity.
             */
            <T extends Entity>(list: T[]): IListSetEvent<T>;
            /**
             * Access to an entity, an {@link embedded} value or a {@link reference} value.
             */
            <T extends Entity>(entity: T): IEntityOrReferenceEvent<T>;
        }
        /**
         * Main interface of the Db.
         */
        interface ChainedIDb3Static<PE> {
            /**
             * Access to an {@link observable} value in an entity.
             */
            <V extends nativeArrObj>(value: V): IObservableEvent<any> | PE;
            /**
             * Access to a {@link map} value in an entity.
             */
            <T extends Entity>(map: {
                [index: string]: T;
            }): IMapEvent<any> | PE;
            /**
             * Access to a {@link list} value in an entity.
             */
            <T extends Entity>(list: T[]): IListSetEvent<any> | PE;
            /**
             * Access to an entity, an {@link embedded} value or a {@link reference} value.
             */
            <T extends Entity>(entity: T): IEntityOrReferenceEvent<any> | PE;
        }
        /**
         * Optional interface that entities can implement to have awareness of the Db.
         */
        interface IDb3Initable {
            dbInit?(url: string, db: IDb3Static): any;
        }
        /**
         * Basic interface for a context for remote calls. Server-side applications
         * will usually extend this to bring other informations, like the curent
         * user or security token and other environmental stuff.
         */
        interface IRemoteCallContext {
            db?: IDb3Static;
            checkExecuting?(entity?: Entity, methodName?: string, stat?: boolean, params?: any[], fn?: Function, payload?: any): boolean | Promise<boolean>;
        }
        /**
         * Operations on a db.
         */
        interface IDbOperations {
            /**
             * Fork another Db instance having a patched configuration.
             */
            fork(conf: any): IDb3Static;
            /**
             * Load an entity by url. The url can point to a root entity, or an {@link embedded} or {@link reference} value.
             */
            load(ctx: Object, url: string): Promise<IEventDetails<any>>;
            /**
             * Reset the internal state of the db, purging the cache and closing al listeners.
             */
            reset(): any;
            /**
             * Deletes all the data from the db, without sending any event, and resets the internal state.
             */
            erase(): any;
            /**
             * Gives access to the underlying DbTree implementation.
             */
            tree(): Spi.DbTreeRoot;
            executeServerMethod(ctx: IRemoteCallContext, payload: any): Promise<any>;
        }
        /**
         * Interface for sorting informations.
         */
        interface SortingData {
            field: string;
            desc?: boolean;
        }
        /**
         * Binding between parent and {@link embedded} entities.
         */
        interface IBinding {
            bind(localName: string, targetName: string, live?: boolean): any;
        }
        /**
         * Interface implemented by all the elements that have an URL.
         */
        interface IUrled {
            getUrl(evenIfIncomplete?: boolean): string;
        }
        /**
         * Various kind of events that can be triggered when using {@link EventDetails}.
         */
        enum EventType {
            /**
             * Unknown event type.
             */
            UNDEFINED = 0,
            /**
             * The value has been loaded, used on entities and on collections on first loading of an entity.
             */
            LOAD = 1,
            /**
             * The value has been updated, used on entities when there was a change and on collections when an elements
             * is changed or has been reordered.
             */
            UPDATE = 2,
            /**
             * The value has been removed, used on root entities when they are deleted, embedded and references when
             * they are nulled, references also when the referenced entity has been deleted, and on collections when
             * an element has been removed from the collection.
             */
            REMOVED = 3,
            /**
             * The value has been added, used on collections when a new element has been added.
             */
            ADDED = 4,
            /**
             * Special event used on collection to notify that the collection has finished loading, and following
             * events will be updates to the previous state and not initial population of the collection.
             */
            LIST_END = 5,
        }
        /**
         * Class describing an event from the Db. It is used in every listener callback.
         */
        interface IEventDetails<T> {
            /**
             * The type of the event, see {@link EventType}.
             */
            type: Api.EventType;
            /**
             * The payload of the event.
             *
             * For entities, it is an instance of the entity. In collections, it is the value that has been
             * added, removed or updated.
             */
            payload: T;
            /**
             * True during initial population of a collection, false when later updating the collection values.
             */
            populating: boolean;
            /**
             * True if an entity has been populated only with projected values (see {@link reference}), false
             * if instead values are fresh from the main entry in the database.
             */
            projected: boolean;
            /**
             * True if this event is not coming from a real DB activity, but was generated locally.
             * Such events are generated by {@link EntityEvent#triggerLocalSave} and similar methods,
             * to anticipate locally a change in the entity that is being persisted on the DB. A
             * real (non synthetic) event will follow when real undergoing operations are completed.
             */
            synthetic: boolean;
            /**
             * Original underlying database event.
             *
             * TODO remove this?, it exposes underlying informations that could not be stable
             */
            originalEvent: string;
            /**
             * Original event url.
             *
             * TODO maybe whe should remove this, as it exposes potentially dangerous informations
             */
            originalUrl: string;
            /**
             * Key on which the event originated. On a root entity, it is the id of the entity; on an embedded
             * it's the name of the field; on a reference it could be the name of the field (if the
             * reference has changed) or the id (or field name) of the referenced entity; on a collection
             * it's the key that has been added, removed or changed.
             */
            originalKey: string;
            /**
             * Preceding key in the current sorting order. This is useful only on collections, and it's mostly
             * useful when the order of the elements in the collection has changed.
             */
            precedingKey: string;
            /**
             * Detaches the current listener, so that the listener will not receive further events
             * and resources can be released.
             */
            offMe(): void;
            /**
             * @returns true if {@link offMe} was called.
             */
            wasOffed(): boolean;
        }
        interface IEvent {
        }
        /**
         * Database events for {@link embedded} or {@link reference}d entities.
         */
        interface IEntityOrReferenceEvent<E extends Entity> extends IUrled, IEvent {
            /**
             * Load the entity completely.
             *
             * If it's a reference, the reference will be dereferenced AND the target data will be loaded.
             *
             * Other references will be dereferenced but not loaded.
             *
             * @param ctx the context object, to use with {@link off}
             */
            load(ctx: Object): Promise<IEventDetails<E>>;
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
            exists(ctx: Object): Promise<boolean>;
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
            updated(ctx: Object, callback: (ed: IEventDetails<E>) => void): void;
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
            live(ctx: Object): void;
            /**
             * If the entity is a reference, this method only dereferences it, applying projections if
             * available, but not loading the target entity.
             *
             * @param ctx the context object, to use with {@link off}
             */
            dereference(ctx: Object): Promise<IEventDetails<E>>;
            /**
             * If the entity is a reference, registers a callback to get notified about a change
             * in the reference pointer.
             *
             * @param ctx the context object, to use with {@link off}
             * @param callback the callback
             */
            referenced(ctx: Object, callback: (ed: IEventDetails<E>) => void): void;
            /**
             * If the entity is a reference and has been loaded, this method retuns the url this reference is pointing at.
             */
            getReferencedUrl(): string;
            /**
             * Unregisters all callbacks and stops all undergoing operations started with the given context.
             *
             * @param ctx the context object used to register callbacks using {@link updated} or {@link referenced},
             * 		or used on operations like {@link load}, {@link live} etc..
             */
            off(ctx: Object): void;
            /**
             * Checks if this entity has been loaded from the database.
             *
             * If this entity is a reference, this method returns true if the reference
             * pointer has been loaded, not necessarily the pointed entity.
             *
             * @return true if the entity or the reference pointer has been loaded.
             */
            isLoaded(): boolean;
            /**
             * Fails with an exception if {@link isLoaded} does not return true.
             */
            assertLoaded(): void;
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
            assignUrl(id?: string): void;
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
            save(): Promise<any>;
            /**
             * Deletes the entity from the database. The returned promise will resolve when
             * the deletion is completed.
             */
            remove(): Promise<any>;
            /**
             * Return the id of this entity, only if this entity is rooted one.
             */
            getId(): string;
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
            clone(): E;
            /**
             * Access to the db instance of this event.
             */
            db: IDb3Static;
            /**
             * Triggers a "mock" update event, as if the data was updated on the database.
             * This is useful when an operation has a long roundtrip before database events will
             * arrive, and an immediate feedback to the user is wanted without duplicating
             * all the event system.
             */
            triggerLocalSave(): any;
            /**
             * Allow for events chaining to reduce the verbosity of calling
             * the same method (for example, load to obtain a promise) on a series
             * of objects.
             */
            and: ChainedIDb3Static<IEntityOrReferenceEvent<any>>;
        }
        /**
         * Entity root gives access to rooted entities.
         */
        interface IEntityRoot<E extends Entity> extends IUrled, IEvent {
            /**
             * Get the instance with the given id. Note that this method is
             * synchronous, and does not load the data from the database.
             */
            get(id: string): E;
            /**
             * Return the "id" part of the given entity.
             */
            idOf(instance: E): string;
            /**
             * Return a {@link IQuery} that operates on all the entities in this entity root.
             */
            query(): IQuery<E>;
        }
        interface IObservableEvent<E extends Entity> extends IUrled, IEvent {
            updated(ctx: Object, callback: (ed: IEventDetails<E>) => void): void;
            live(ctx: Object): void;
            off(ctx: Object): void;
            isLoaded(): boolean;
            assertLoaded(): void;
            /**
             * Allow for events chaining to reduce the verbosity of calling
             * the same method (for example, load to obtain a promise) on a series
             * of objects.
             */
            and: ChainedIDb3Static<IObservableEvent<any>>;
        }
        /**
         * Interface implemented by collections that can be read. These are all the collections
         * but also {@link IQuery}.
         */
        interface IReadableCollection<E extends Entity> extends IEvent {
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
            updated(ctx: Object, callback: (ed: IEventDetails<E>) => void): void;
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
            added(ctx: Object, callback: (ed: IEventDetails<E>) => void): void;
            /**
             * Registers a callback to get notified when a value is removed to the collection.
             *
             * @param ctx the context object, to use with {@link off}
             * @param callback the callback
             */
            removed(ctx: Object, callback: (ed: IEventDetails<E>) => void): void;
            /**
             * Registers a callback to get notified when a value is changed to the collection.
             *
             * @param ctx the context object, to use with {@link off}
             * @param callback the callback
             */
            changed(ctx: Object, callback: (ed: IEventDetails<E>) => void): void;
            /**
             * Registers a callback to get notified when a value is moved (reordered) to the collection.
             *
             * @param ctx the context object, to use with {@link off}
             * @param callback the callback
             */
            moved(ctx: Object, callback: (ed: IEventDetails<E>) => void): void;
            /**
             * Unregisters all callbacks and stops all undergoing operations started with the given context.
             *
             * @param ctx the context object used to register callbacks using {@link updated}, {@link added} etc..
             * 		or used on other operations.
             */
            off(ctx: Object): void;
            /**
             * Access to the db instance of this event.
             */
            db: IDb3Static;
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
        interface IGenericCollection<E extends Entity> extends IReadableCollection<E> {
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
            live(ctx: Object): void;
            /**
             * Removes the specified element from the collection.
             */
            remove(key: string | number | Entity): Promise<any>;
            /**
             * Clears the collection, removing all elements in it.
             */
            clear(): Promise<any>;
            /**
             * Fetch the specified key from the collection.
             *
             * TODO does this only dereference or also load the value?
             */
            fetch(ctx: Object, key: string | number | E): Promise<IEventDetails<E>>;
            /**
             * Gives access to the database event for the given key.
             *
             * TODO provide an example on why this is useful
             */
            with(key: string | number | Entity): IEntityOrReferenceEvent<E>;
            /**
             * Initialize a query on this collection.
             */
            query(): IQuery<E>;
            /**
             * Checks if this collection has been loaded from the database.
             */
            isLoaded(): boolean;
            /**
             * Fails with an exception if {@link isLoaded} does not return true.
             */
            assertLoaded(): void;
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
            save(): Promise<any>;
            /**
             * Loads this collection, both in the parent entity and returning it in the promise.
             * If this is a collection of references, all the references are resolved and referenced entities loaded.
             *
             * @param ctx the context object, to use with {@link off}
             * @return a Promise that will be resolved with the full collection.
             */
            load(ctx: Object): Promise<any>;
            /**
             * Similar to load(), but only dereferences the references in this collection, not loading
             * the referenced entities.
             *
             * @param ctx the context object, to use with {@link off}
             * @return a Promise that will be resolved with the full collection.
             */
            dereference(ctx: Object): Promise<any>;
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
        interface IMapEvent<E extends Entity> extends IGenericCollection<E> {
            /**
             * Adds a value to the map.
             */
            add(key: string | number | Entity, value: E): Promise<any>;
            load(ctx: Object): Promise<{
                [index: string]: E;
            }>;
            dereference(ctx: Object): Promise<{
                [index: string]: E;
            }>;
            /**
             * Allow for events chaining to reduce the verbosity of calling
             * the same method (for example, load to obtain a promise) on a series
             * of objects.
             */
            and: ChainedIDb3Static<IMapEvent<any>>;
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
        interface IListSetEvent<E extends Entity> extends IGenericCollection<E> {
            add(value: E): Promise<any>;
            /**
             * Fetches and removes the last element of the collection, in current sorting order.
             */
            pop(ctx: Object): Promise<IEventDetails<E>>;
            /**
             * Fetches the last element of the collection, in current sorting order, without removing it.
             */
            peekTail(ctx: Object): Promise<IEventDetails<E>>;
            /**
             * Adds an element to the beginning of the collection, in *key lexicographic* order.
             */
            unshift(value: E): Promise<any>;
            /**
             * Fetches and removes the first element of the collection, in current sorting order.
             */
            shift(ctx: Object): Promise<IEventDetails<E>>;
            /**
             * Fetches the first element of the collection, in current sorting order, without removing it.
             */
            peekHead(ctx: Object): Promise<IEventDetails<E>>;
            load(ctx: Object): Promise<E[]>;
            dereference(ctx: Object): Promise<E[]>;
            /**
             * Allow for events chaining to reduce the verbosity of calling
             * the same method (for example, load to obtain a promise) on a series
             * of objects.
             */
            and: ChainedIDb3Static<IListSetEvent<any>>;
        }
        /**
         * A query, performed on a collection or on an entity root.
         */
        interface IQuery<E extends Entity> extends IReadableCollection<E> {
            dereference(ctx: Object): Promise<E[]>;
            load(ctx: Object): Promise<E[]>;
            onField(field: string, desc?: boolean): IQuery<E>;
            limit(limit: number): IQuery<E>;
            range(from: any, to: any): IQuery<E>;
            equals(val: any): IQuery<E>;
            /**
             * Convenience sync method to be used inside the handler for {@link updated} to retrieve all the
             * current elements, in right order.
             *
             * This will work only if updated is called, otherwise use {@link load}.
             */
            getValues(): E[];
            /**
             * Allow for events chaining to reduce the verbosity of calling
             * the same method (for example, load to obtain a promise) on a series
             * of objects.
             */
            and: ChainedIDb3Static<IQuery<any>>;
        }
        interface Socket {
            emit(event: string, ...args: any[]): Socket;
        }
        interface IClientSideSocketFactory {
            connect(conf: DatabaseConf): Socket;
        }
        class DefaultClientSideSocketFactory implements IClientSideSocketFactory {
            connect(conf: DatabaseConf): Socket;
        }
        /**
         * Database configuration, use one subclass like {@link FirebaseConf}.
         */
        interface DatabaseConf {
            adapter?: string | Spi.DbTreeFactory;
            override?: string;
            clientSocket?: IClientSideSocketFactory | string;
        }
        /**
         * Parameters for an entity declaration.
         */
        interface EntityParams {
            /**
             * If the entity is rooted, the root name.
             */
            root?: string;
        }
        /**
         * Parameters for embedded entity declaration.
         */
        interface EmbeddedParams {
            /**
             * Type of the embedded entity.
             */
            type: Api.EntityType<any> | Api.EntityTypeProducer<any>;
            /**
             * Binding to the embedded entity.
             */
            binding?: Api.IBinding;
        }
        /**
         * Parameters for referenced entity declaration.
         */
        interface ReferenceParams {
            /**
             * Type of the referenced entity.
             */
            type?: Api.EntityType<any> | Api.EntityTypeProducer<any>;
            /**
             * Projections of the entity to save embedded in the parent entity document.
             */
            projections?: string[];
        }
        /**
         * Parameters for defition of a collection.
         */
        interface CollectionParams {
            /**
             * Type of the entities in the collection.
             */
            type: Api.EntityType<any> | Api.EntityTypeProducer<any>;
            /**
             * true if this is a collection of references, false (default) for a collection of embedded entities.
             */
            reference?: boolean;
            /**
             * Default sort order of the collection
             */
            sorting?: Api.SortingData;
            /**
             * Binding on the embedded entities of this collection.
             */
            binding?: Api.IBinding;
            /**
             * Projections of the referenced entities of this collection.
             */
            projections?: string[];
        }
        interface RemoteCallParams {
        }
    }
    module Spi {
        interface DbTreeRoot {
            getUrl(url: string): DbTree;
            makeRelative(url: string): string;
            isReady(): boolean;
            whenReady(): Promise<any>;
        }
        interface DbTreeSnap {
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
        interface DbTreeQuery {
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
            startAt(value: string | number, key?: string): DbTreeQuery;
            /**
            * Creates a Query with the specified ending point.
            * The generated Query includes children which match the specified ending point.
            */
            endAt(value: string | number, key?: string): DbTreeQuery;
            /**
            * Creates a Query which includes children which match the specified value.
            */
            equalTo(value: string | number, key?: string): DbTreeQuery;
            /**
            * Generates a new Query object limited to the first certain number of children.
            */
            limitToFirst(limit: number): DbTreeQuery;
            /**
            * Generates a new Query object limited to the last certain number of children.
            */
            limitToLast(limit: number): DbTreeQuery;
        }
        interface DbTree extends DbTreeQuery {
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
        type DbTreeFactory = (conf: Api.DatabaseConf) => DbTreeRoot;
        var registry: {
            [index: string]: DbTreeFactory;
        };
        function getRoot(conf: Api.DatabaseConf): DbTreeRoot;
        /**
         * Database configuration for Firebase backend.
         */
        interface FirebaseConf extends Api.DatabaseConf {
            /**
             * Url of the Firebase server.
             */
            baseUrl: string;
            /**
             * Optional app secret to authernticate servers
             */
            secret?: string;
        }
        class FirebaseDbTreeRoot implements DbTreeRoot {
            private conf;
            constructor(conf: Api.DatabaseConf);
            isReady(): boolean;
            whenReady(): Promise<any>;
            getUrl(url: string): DbTree;
            makeRelative(url: string): string;
            static ready: boolean;
            static readyProm: Promise<any>;
            static create(dbconf: Api.DatabaseConf): FirebaseDbTreeRoot;
            static wrapReady<X extends Function>(f: X): X;
        }
        interface MonitoringConf extends Api.DatabaseConf {
            realConfiguration: Api.DatabaseConf;
            log?: (...args: any[]) => void;
            prefix?: string;
            filter?: {
                [index: string]: string | {
                    types?: string[];
                    dump?: boolean;
                    trace?: boolean;
                };
            };
        }
        class MonitoringDbTreeRoot implements DbTreeRoot {
            static create(conf: Api.DatabaseConf): MonitoringDbTreeRoot;
            static presets: {
                "rw": {
                    types: string[];
                    dump: boolean;
                };
                "r": {
                    types: string[];
                    dump: boolean;
                };
                "w": {
                    types: string[];
                    dump: boolean;
                };
                "full": {
                    types: string[];
                    dump: boolean;
                    trace: boolean;
                };
                "errors": {
                    types: string[];
                    dump: boolean;
                    trace: boolean;
                };
                "none": {
                    types: any[];
                };
                "": {
                    types: string[];
                    dump: boolean;
                };
            };
            conf: MonitoringConf;
            log: (...args: any[]) => void;
            filter: {
                [index: string]: {
                    types?: string[];
                    dump?: boolean;
                    trace?: boolean;
                };
            };
            prefix: string;
            delegateRoot: DbTreeRoot;
            constructor(conf: Api.DatabaseConf);
            isReady(): boolean;
            whenReady(): Promise<any>;
            getUrl(url: string): DbTree;
            makeRelative(url: string): string;
            private dtlog(...args);
            emit(url: string, type: string, name: string, val: any, others: any[]): void;
        }
        class MonitoringDbTreeQuery implements DbTreeQuery {
            private root;
            private delegate;
            private myurl;
            constructor(root: MonitoringDbTreeRoot, delegate: DbTreeQuery);
            emit(type: string, name: string, val?: any, ...others: any[]): void;
            emitAckWrap(fn: (error: any) => void, name: string): (error: any) => void;
            emitDataWrap(fn: (dataSnapshot: DbTreeSnap, prevChildName?: string) => void, name: string): (dataSnapshot: DbTreeSnap, prevChildName?: string) => void;
            unwrapEmitData<T>(fn: T): T;
            toString(): string;
            on(eventType: string, callback: (dataSnapshot: DbTreeSnap, prevChildName?: string) => void, cancelCallback?: (error: any) => void, context?: Object): (dataSnapshot: DbTreeSnap, prevChildName?: string) => void;
            off(eventType?: string, callback?: (dataSnapshot: DbTreeSnap, prevChildName?: string) => void, context?: Object): void;
            once(eventType: string, successCallback: (dataSnapshot: DbTreeSnap) => void, context?: Object): void;
            orderByChild(key: string): DbTreeQuery;
            orderByKey(): DbTreeQuery;
            limit(limit: number): DbTreeQuery;
            startAt(value: string | number, key?: string): DbTreeQuery;
            endAt(value: string | number, key?: string): DbTreeQuery;
            equalTo(value: string | number, key?: string): DbTreeQuery;
            limitToFirst(limit: number): DbTreeQuery;
            limitToLast(limit: number): DbTreeQuery;
        }
        class MonitoringDbTree extends MonitoringDbTreeQuery implements DbTree {
            private tdelegate;
            constructor(root: MonitoringDbTreeRoot, delegate: DbTree);
            set(value: any, onComplete?: (error: any) => void): void;
            update(value: Object, onComplete?: (error: any) => void): void;
            remove(onComplete?: (error: any) => void): void;
        }
    }
    /**
     * Internal module, most of the stuff inside this module are either internal use only or exposed by other methods,
     * they should never be used directly.
     */
    module Internal {
        var VERSION: string;
        /**
         * Creates a Db based on the given configuration.
         */
        function createDb(conf: Api.DatabaseConf): Api.IDb3Static;
        /**
         * Current state of an ongoing binding.
         */
        interface BindingState {
            /** Values of loading/resolving other fields */
            vals: any[];
            /** Events of other entities */
            evts: GenericEvent[];
        }
        /**
         * Implementation of {@link IBinding}.
         */
        class BindingImpl implements Api.IBinding {
            keys: string[];
            bindings: {
                [index: string]: string;
            };
            live: {
                [index: string]: boolean;
            };
            bind(local: string, remote: string, live?: boolean): Api.IBinding;
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
            startLoads(metadata: ClassMetadata, state: DbState, parent: Api.Entity): Promise<BindingState>;
            /**
             * Completes the binding once the target entity completed loading and the Promise returned by
             * {@link startLoads} completes.
             *
             * It sets all the values found in the "result", and optionally subscribes to the
             * "updated" event to keep the value live. For references, the updated event is also
             * trigger on reference change, so the value will be kept in sync.
             *
             */
            resolve(tgt: Api.Entity, result: BindingState): void;
        }
        /**
         * Class describing an event from the Db. It is used in every listener callback.
         */
        class EventDetails<T> implements Api.IEventDetails<T> {
            /**
             * The type of the event, see {@link EventType}.
             */
            type: Api.EventType;
            /**
             * The payload of the event.
             *
             * For entities, it is an instance of the entity. In collections, it is the value that has been
             * added, removed or updated.
             */
            payload: T;
            /**
             * True during initial population of a collection, false when later updating the collection values.
             */
            populating: boolean;
            /**
             * True if an entity has been populated only with projected values (see {@link reference}), false
             * if instead values are fresh from the main entry in the database.
             */
            projected: boolean;
            /**
             * True if this event is not coming from a real DB activity, but was generated locally.
             * Such events are generated by {@link EntityEvent#triggerLocalSave} and similar methods,
             * to anticipate locally a change in the entity that is being persisted on the DB. A
             * real (non synthetic) event will follow when real undergoing operations are completed.
             */
            synthetic: boolean;
            /**
             * Original underlying database event.
             *
             * TODO remove this, it exposes underlying informations that could not be stable
             */
            originalEvent: string;
            /**
             * Original event url.
             *
             * TODO maybe whe should remove this, as it exposes potentially dangerous informations
             */
            originalUrl: string;
            /**
             * Key on which the event originated. On a root entity, it is the id of the entity; on an embedded
             * it's the name of the field; on a reference it could be the name of the field (if the
             * reference has changed) or the id (or field name) of the referenced entity; on a collection
             * it's the key that has been added, removed or changed.
             */
            originalKey: string;
            /**
             * Preceding key in the current sorting order. This is useful only on collections, and it's mostly
             * useful when the order of the elements in the collection has changed.
             */
            precedingKey: string;
            /**
             * The event handler that is broadcasting this event.
             */
            private handler;
            /**
             * True if {@link offMe} was called.
             */
            private offed;
            setHandler(handler: EventHandler): void;
            /**
             * Detaches the current listener, so that the listener will not receive further events
             * and resources can be released.
             */
            offMe(): void;
            /**
             * @returns true if {@link offMe} was called.
             */
            wasOffed(): boolean;
            /**
             * Creates an equivalent copy of this instance.
             */
            clone(): EventDetails<T>;
        }
        /**
         * Generic binding between a {@link GenericEvent} and a callback function that consume {@link EventDetails}.
         */
        class EventHandler {
            /** Holder for progressive number of the handler, for debug purposes */
            static prog: number;
            /** Progressive number of this handler, for debug purposes */
            myprog: number;
            /**
             * Context of this handler. The context is used both as a context for invoking the
             * {@link callback} and as a reference object for turning off all handlers bound to a specific
             * target.
             */
            ctx: Object;
            /**
             * The event this handler is bound to.
             */
            event: GenericEvent;
            /**
             * The callback to dispatch {@link EventDetails} to.
             */
            callback: (ed: EventDetails<any>) => void;
            /**
             * A discriminator, used to differentiate between two different handlers that happen to have
             * the same context and the same callback.
             */
            discriminator: any;
            /**
             * true is this handler was canceled.
             */
            canceled: boolean;
            /**
             * @param ctx the {@link ctx} context object for this handler
             * @param callback the {@link callback} for this handler
             * @param discriminator the optional {@link discriminator} for this handler
             */
            constructor(ctx?: Object, callback?: (ed: EventDetails<any>) => void, discriminator?: any);
            /**
             * @returns true if the given handler has same {@link ctx}, {@link callback} and eventually {@link discrimnator} as this one.
             */
            equals(oth: EventHandler): boolean;
            /**
             * Decommission (cancel) this handler, only if the "remove" parameter is true.
             *
             * @param remove if true decommiission this handler, otherwise not.
             * @return the same value of "remove" parameter.
             */
            decomission(remove: boolean): boolean;
            /**
             * Handles the given {@link EventDetails}.
             *
             * The EventDetails will be cloned, connected to this handler, and the the callback will be invoked.
             */
            handle(evd: EventDetails<any>): void;
            /**
             * Ask to the bound {@link event} to decommission this handler.
             */
            offMe(): void;
        }
        /**
         * A specialized EventHandler that also holds registered callbacks on the underlying database.
         *
         * This handler does not directly react to database events, it simply hooks them to a given callback
         * passed in {@link hook}. However, since usually when a handler is decommissioned also underlying
         * database resources can be released, having them encapsulated in the same instance is easier and
         * less error prone.
         */
        class DbEventHandler extends EventHandler {
            /**
             * The underlying database reference.
             */
            ref: Spi.DbTreeQuery;
            /**
             * The callbacks registered by this handler on the underlying database reference.
             */
            protected cbs: {
                event: string;
                fn: (dataSnapshot: Spi.DbTreeSnap, prevChildName?: string) => void;
            }[];
            /**
             * Hooks to the underlying database.
             *
             * @param event the event to hook to
             * @param fn the callback to hook to the database
             */
            hook(event: string, fn: (dataSnapshot: Spi.DbTreeSnap, prevChildName?: string) => void): void;
            /**
             * Extends the decommission function to also detach database callbacks registered thru {@link hook}.
             */
            decomission(remove: boolean): boolean;
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
        abstract class GenericEvent implements Api.IUrled {
            /** The entity bound to this event. */
            entity: Api.Entity;
            /** The url for the entity bound to this event. */
            url: string;
            /** The db state this event works in */
            state: DbState;
            /** The parent of this event */
            parent: GenericEvent;
            /**
             * Local (ram, javascript) name of the entity represented by this event on the parent entity.
             */
            nameOnParent: string;
            /** The children of this event */
            private children;
            /** Dependant events */
            private dependants;
            /** The class meta data this event operates on */
            private _classMeta;
            /** The declared class meta data for this event, cause {@link _classMeta} could change in case of polimorphic classes */
            private _originalClassMeta;
            /** Array of current registered handlers. */
            protected handlers: EventHandler[];
            /**
             * Set the entity this event works on.
             *
             * The event is registered as pertaining to the given entity using the {@link DbState.entEvent} {@link WeakWrap}.
             */
            setEntity(entity: Api.Entity): void;
            /**
             * Destroy this event, disconnecting it from the parent
             * and from the entity.
             */
            destroy(): void;
            /**
             * Get a value from the entity, triggering the {@link nextInternal}
             * flag to notify meta getters not to track this request.
             */
            getFromEntity(name: string): any;
            /**
             * Set a value on the entity, triggering the {@link nextInternal}
             * flag to notify meta setters not to track this request.
             */
            setOnEntity(name: string, val: any): void;
            protected setEntityOnParent(val?: any): void;
            /**
             * Get the {@link _classMeta} this event works on.
             */
            /**
             * Set the {@link _classMeta} this event works on.
             */
            classMeta: ClassMetadata;
            /**
             * Set the {@link _originalClassMeta} this event works on.
             */
            originalClassMeta: ClassMetadata;
            db: Api.IDb3Static;
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
            getUrl(evenIfIncomplete?: boolean): string;
            /**
             * Triggered when this events has been connected to the events hierarchy (either directly
             * or indirectly by one of its anchestors). After this method is called, calling {@link getUrl}
             * will yield a complete Url.
             */
            urlInited(): void;
            /**
             * Registers an event handler on this event.
             *
             * If there is already an event handler with same ctx, callback and discriminator, it will be removed
             * before the given one is added.
             *
             * If the event is already linked to the events hierarchy, the handler will be inited
             * by {@link init}.
             */
            on(handler: EventHandler): void;
            /**
             * Unregisters and decommissions all the {@link EventHandler}s registered using {@link on} that
             * have the given ctx and 8if specified) the given callback.
             */
            off(ctx: Object, callback?: (ed: EventDetails<any>) => void): void;
            /**
             * Unregisters and decommissions a specific handler.
             */
            offHandler(h: EventHandler): void;
            /**
             * Unregisters and decommissions all the handlers registered on this event.
             */
            offAll(): void;
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
            protected init(h: EventHandler): void;
            /**
             * Utility method to broadcast the given EventDEtails to all the registered
             * {@link EventHandler}s.
             */
            protected broadcast(ed: EventDetails<any>): void;
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
            findCreateChildFor(metaOrkey: string | MetaDescriptor, force?: boolean): GenericEvent;
            /**
             * Save the children of this event to the {@link DbState} cache.
             *
             * @param key if a specific key is given, only that children will be saven in the cache.
             */
            saveChildrenInCache(key?: string): void;
            /**
             * Executes the given function for each already existing children of this event.
             */
            eachChildren(f: (name: string, child: GenericEvent) => void): void;
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
            addDependant(dep: GenericEvent): void;
            /**
             * Parse a value arriving from the Db.
             *
             * This method must be overridden by subclasses.
             *
             * The noral behaviour is to parse the given database data and apply it to
             * the {@link entity} this event is working on.
             */
            parseValue(ds: Spi.DbTreeSnap): void;
            applyHooks(ed: EventDetails<any>): void;
            /**
             * If this event creates a logica "traversal" on the normal tree structure
             * of events, getTraversed returns the event to which this events makes a traversal to.
             *
             * For example, a reference will traverse to another branch of the tree, so it's
             * children will not be grandchildren of its parent.
             */
            getTraversed(): GenericEvent;
            /**
             * Serialize the {@link entity} to persist it on the Db.
             *
             * This method must be overridden by subclasses.
             *
             * This is the logical opposite of {@link parseValue}.
             */
            serialize(localsOnly?: boolean, fields?: string[]): Object;
            /**
             * Denotes that this event represent a "local" value during serialization.
             *
             * A local value is a value that gets saved together with native values on the
             * {@link entity} and not on a separate node of the database tree.
             */
            isLocal(): boolean;
            save(): Promise<any>;
            abstract internalSave(): Promise<any>;
            and: Api.ChainedIDb3Static<any>;
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
        abstract class SingleDbHandlerEvent<E> extends GenericEvent {
            /** true if data has been loaded */
            loaded: boolean;
            /**
             * The only instance of DbEventHandler used, it gets hooked to {@link handleDbEvent} when needed
             * and decommissioned when not needed anymore.
             */
            dbhandler: DbEventHandler;
            /** Most recent EventDetails, used to bootstrap new EventHandlers registered after the first data has been received. */
            lastDetail: EventDetails<E>;
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
            init(h: EventHandler): void;
            /** Useless callback */
            mockCb(): void;
            /**
             * Does what specified in {@link GenericEvent.off}, then invokes {@link checkDisconnect} to
             * decommission the {@link dbhandler}.
             */
            off(ctx: Object, callback?: (ed: EventDetails<E>) => void): void;
            /**
             * Does what specified in {@link GenericEvent.offHandler}, then invokes {@link checkDisconnect} to
             * decommission the {@link dbhandler}.
             */
            offHandler(h: EventHandler): void;
            /**
             * Does what specified in {@link GenericEvent.offAll}, then invokes {@link checkDisconnect} to
             * decommission the {@link dbhandler}.
             */
            offAll(): void;
            /**
             * If there are no more {@link EventHandler}s listening on this event, then it decommissions the
             * {@link dbhandler} and clears {@link lastDetail}.
             */
            checkDisconnect(): void;
            /**
             * Upon receiving data from the database, it creates an {@link EventDetails} object
             * based on current state and received data, and {@link broadcast}s it.
             */
            handleDbEvent(ds: Spi.DbTreeSnap, prevName: string, projected?: boolean): void;
            isLoaded(): boolean;
            assertLoaded(): void;
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
        class EntityEvent<E extends Api.Entity> extends SingleDbHandlerEvent<E> implements Api.IEntityOrReferenceEvent<E> {
            /**
             * If given, binding directives.
             */
            binding: BindingImpl;
            /**
             * If we are loading this entity, this promise is loading the bound entities if eny.
             */
            bindingPromise: Promise<BindingState>;
            /**
             * Latest data from the database, if any, used in {@link clone}.
             */
            lastDs: Spi.DbTreeSnap;
            /** a progressive counter used as a discriminator when registering the same callbacks more than once */
            progDiscriminator: number;
            setEntity(entity: Api.Entity): void;
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            /**
             * Used to receive the projections when {@link ReferenceEvent} is loading the arget
             * event and has found some projections.
             */
            handleProjection(ds: Spi.DbTreeSnap): void;
            init(h: EventHandler): void;
            applyHooks(ed: EventDetails<E>): void;
            protected broadcast(ed: EventDetails<E>): void;
            /**
             * Set to null all the primitive entity fields not named
             * in the set, and triggers a parseValue(null) on all
             * children not named in the set, honouring _fields as
             * ignored.
             */
            protected nullify(set?: {
                [index: string]: boolean;
            }): void;
            parseValue(ds: Spi.DbTreeSnap): void;
            internalApplyBinding(skipMe?: boolean): void;
            load(ctx: Object): Promise<EventDetails<E>>;
            exists(ctx: Object): Promise<boolean>;
            live(ctx: Object): void;
            dereference(ctx: Object): Promise<EventDetails<E>>;
            referenced(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            getReferencedUrl(): string;
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
            serialize(localsOnly?: boolean, fields?: string[]): Object;
            assignUrl(id?: string): void;
            triggerLocalSave(): void;
            internalSave(): Promise<any>;
            remove(): Promise<any>;
            clone(): E;
            getId(): string;
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
        class ReferenceEvent<E extends Api.Entity> extends SingleDbHandlerEvent<E> implements Api.IEntityOrReferenceEvent<E> {
            /**
             * List of fields to save as projections.
             */
            project: string[];
            /**
             * The main event that controls the pointed entity
             */
            pointedEvent: EntityEvent<E>;
            /**
             * The previous pointedEvent, saved here to decomission it when not needed anymore
             */
            prevPointedEvent: EntityEvent<E>;
            /** a progressive counter used as a discriminator when registering the same callbacks more than once */
            progDiscriminator: number;
            setEntity(entity: Api.Entity): void;
            findCreateChildFor(metaOrkey: string | MetaDescriptor, force?: boolean): GenericEvent;
            /**
             * Load this reference AND the pointed entity.
             */
            load(ctx: Object): Promise<EventDetails<E>>;
            exists(ctx: Object): Promise<boolean>;
            private makeCascadingCallback(ed, cb);
            /**
             * Notifies of modifications on the reference AND on the pointed entity.
             */
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            /**
             * Keeps both the reference AND the referenced entity live.
             */
            live(ctx: Object): void;
            dereference(ctx: Object): Promise<EventDetails<E>>;
            referenced(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            parseValue(ds: Spi.DbTreeSnap): void;
            getReferencedUrl(): string;
            serialize(localsOnly?: boolean): Object;
            assignUrl(): void;
            triggerLocalSave(): void;
            internalSave(): Promise<any>;
            save(): Promise<any[]>;
            remove(): Promise<any>;
            clone(): E;
            getTraversed(): GenericEvent;
            getId(): string;
        }
        /**
         * An event handler for collections.
         *
         * It extends the DbEventHandler :
         * - adding automatic multiple db events hooking and unhooking
         * - changing the signature of the callback to also pass the event name
         */
        class CollectionDbEventHandler extends DbEventHandler {
            dbEvents: string[];
            istracking: boolean;
            ispopulating: boolean;
            hookAll(fn: (dataSnapshot: Spi.DbTreeSnap, prevChildName?: string, event?: string) => void): void;
            hook(event: string, fn: (dataSnapshot: Spi.DbTreeSnap, prevChildName?: string, event?: string) => void): void;
            unhook(event: string): void;
        }
        /**
         * Default implementation of map.
         */
        class MapEvent<E extends Api.Entity> extends GenericEvent implements Api.IMapEvent<E> {
            isReference: boolean;
            project: string[];
            binding: BindingImpl;
            sorting: Api.SortingData;
            realField: any;
            collectionLoaded: boolean;
            setEntity(entity: Api.Entity): void;
            added(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            removed(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            changed(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            moved(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            live(ctx: Object): void;
            load(ctx: Object, deref?: boolean): Promise<any>;
            dereference(ctx: Object): Promise<any>;
            init(h: EventHandler): void;
            findCreateChildFor(metaOrkey: string | MetaDescriptor, force?: boolean): GenericEvent;
            handleDbEvent(handler: CollectionDbEventHandler, event: string, ds: Spi.DbTreeSnap, prevKey: string): void;
            add(key: string | number | Api.Entity, value?: Api.Entity): Promise<any>;
            createKeyFor(value: Api.Entity): string;
            normalizeKey(key: string | number | Api.Entity): string;
            addToInternal(event: string, key: string, val: Api.Entity, det: EventDetails<E>): void;
            clearInternal(): void;
            remove(keyOrValue: string | number | Api.Entity): Promise<any>;
            fetch(ctx: Object, key: string | number | Api.Entity): Promise<EventDetails<E>>;
            with(key: string | number | Api.Entity): Api.IEntityOrReferenceEvent<E>;
            isLoaded(): boolean;
            assertLoaded(): void;
            internalSave(): Promise<any>;
            clear(): Promise<any>;
            serialize(localsOnly?: boolean, fields?: string[]): Object;
            parseValue(allds: Spi.DbTreeSnap): void;
            query(): Api.IQuery<E>;
        }
        class EventedArray<E> {
            collection: MapEvent<E>;
            arrayValue: E[];
            keys: string[];
            constructor(collection: MapEvent<E>);
            private findPositionFor(key);
            private findPositionAfter(prev);
            addToInternal(event: string, key: any, val: E, det: EventDetails<E>): void;
            clearInternal(): void;
            prepareSerializeSet(): void;
            prepareSerializeList(): void;
        }
        class ArrayCollectionEvent<E extends Api.Entity> extends MapEvent<E> {
            protected evarray: EventedArray<E>;
            setEntity(entity: Api.Entity): void;
            add(value?: Api.Entity): Promise<any>;
            intSuperAdd(key: string | number | Api.Entity, value?: Api.Entity): Promise<any>;
            addToInternal(event: string, key: string, val: E, det: EventDetails<E>): void;
            clearInternal(): void;
            load(ctx: Object): Promise<E[]>;
            dereference(ctx: Object): Promise<E[]>;
        }
        class ListEvent<E extends Api.Entity> extends ArrayCollectionEvent<E> implements Api.IListSetEvent<E> {
            createKeyFor(value: Api.Entity): string;
            normalizeKey(key: string | number | Api.Entity): string;
            serialize(localsOnly?: boolean, fields?: string[]): Object;
            intPeek(ctx: Object, dir: number): Promise<Api.IEventDetails<E>>;
            intPeekRemove(ctx: Object, dir: number): Promise<Api.IEventDetails<E>>;
            pop(ctx: Object): Promise<EventDetails<E>>;
            peekTail(ctx: Object): Promise<EventDetails<E>>;
            unshift(value: E): Promise<any>;
            shift(ctx: Object): Promise<EventDetails<E>>;
            peekHead(ctx: Object): Promise<EventDetails<E>>;
        }
        class SetEvent<E extends Api.Entity> extends ArrayCollectionEvent<E> {
            createKeyFor(value: Api.Entity): string;
            normalizeKey(key: string | number | Api.Entity): string;
            serialize(localsOnly?: boolean, fields?: string[]): Object;
        }
        class IgnoreEvent<E extends Api.Entity> extends GenericEvent {
            val: any;
            setEntity(): void;
            parseValue(ds: Spi.DbTreeSnap): void;
            serialize(): any;
            isLocal(): boolean;
            internalSave(): any;
        }
        class ObservableEvent<E extends Api.Entity> extends SingleDbHandlerEvent<E> implements Api.IObservableEvent<E> {
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            live(ctx: Object): void;
            parseValue(ds: Spi.DbTreeSnap): void;
            serialize(): Api.Entity;
            isLocal(): boolean;
            internalSave(): any;
        }
        class EntityRoot<E extends Api.Entity> extends GenericEvent implements Api.IEntityRoot<E> {
            constructor(state: DbState, meta: ClassMetadata);
            findCreateChildFor(metaOrkey: string | MetaDescriptor, force?: boolean): GenericEvent;
            getEvent(id: string): EntityEvent<E>;
            get(id: string): E;
            idOf(entity: E): string;
            query(): Api.IQuery<E>;
            getUrl(): string;
            getRemainingUrl(url: string): string;
            internalSave(): any;
        }
        class QueryImpl<E> extends ArrayCollectionEvent<E> implements Api.IQuery<E> {
            private _limit;
            private _rangeFrom;
            private _rangeTo;
            private _equals;
            constructor(ev: GenericEvent);
            getUrl(force: boolean): string;
            onField(field: string, desc?: boolean): QueryImpl<E>;
            limit(limit: number): QueryImpl<E>;
            range(from: any, to: any): QueryImpl<E>;
            equals(val: any): QueryImpl<E>;
            init(gh: EventHandler): void;
            findCreateChildFor(metaOrkey: string | MetaDescriptor, force?: boolean): GenericEvent;
            save(): Promise<any>;
            urlInited(): void;
            getValues(): E[];
        }
        class ChainedEvent {
            private state;
            private events;
            constructor(state: DbState, firstEvent?: Api.IEvent, secondCall?: any);
            and(param: any): ChainedEvent;
            add(evt: Api.IEvent): void;
            private makeProxyMethod(name);
            private proxyCalled(name, args);
        }
        class DbState implements Api.IDbOperations {
            cache: {
                [index: string]: GenericEvent;
            };
            conf: Api.DatabaseConf;
            myMeta: Metadata;
            serverIo: Api.Socket;
            db: Api.IDb3Static;
            treeRoot: Spi.DbTreeRoot;
            constructor();
            configure(conf: Api.DatabaseConf): void;
            getTree(url: string): Spi.DbTree;
            internalDb(param: any): any;
            fork(conf: any): Api.IDb3Static;
            erase(): void;
            reset(): void;
            entityRoot(ctor: Api.EntityType<any>): EntityRoot<any>;
            entityRoot(meta: ClassMetadata): EntityRoot<any>;
            makeRelativeUrl(url: string): string;
            entityRootFromUrl(url: string): EntityRoot<any>;
            getUrl(): string;
            bindEntity(e: Api.Entity, ev: EntityEvent<any>): void;
            createEvent(e: Api.Entity, stack?: MetaDescriptor[] | string[]): GenericEvent;
            loadEvent(url: string): GenericEvent;
            /**
             * Adds an event to the cache.
             */
            storeInCache(evt: GenericEvent): void;
            /**
             * Removes an event from the cache.
             */
            evictFromCache(evt: GenericEvent): void;
            fetchFromCache(url: string): GenericEvent;
            loadEventWithInstance(url: string): GenericEvent;
            load(ctx: Object, url: string): Promise<Api.IEventDetails<any>>;
            tree(): Spi.DbTreeRoot;
            /**
            * Executes a method on server-side. Payload is the only parameter passed to the "method" event
            * from the callServerMethod method.
            *
            * This method will return a Promise to return to the socket when resolved.
            */
            executeServerMethod(ctx: Api.IRemoteCallContext, payload: any): Promise<any>;
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
        function remoteCall(inst: Api.Entity, name: string, params: any[]): Promise<any>;
        function createRemoteCallPayload(inst: any, name: string, params: any[]): {
            entityUrl: string;
            method: string;
            args: any;
        };
        class MetaDescriptor {
            localName: string;
            remoteName: string;
            /**
             * This could be either a class constructor (EntityType), or an anonymous function returning a costructor
             * (EntityTypeProducer). Code for resolving the producer is in the cotr getter. This producer stuff
             * is needed for https://github.com/Microsoft/TypeScript/issues/4888.
             */
            private _ctor;
            classMeta: ClassMetadata;
            getTreeChange(md: Metadata): ClassMetadata;
            getRemoteName(): string;
            setType(def: any): void;
            ctor: Api.EntityType<any>;
            named(name: string): MetaDescriptor;
            setLocalName(name: string): void;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class ClassMetadata extends MetaDescriptor {
            descriptors: {
                [index: string]: MetaDescriptor;
            };
            root: string;
            discriminator: string;
            override: string;
            superMeta: ClassMetadata;
            subMeta: ClassMetadata[];
            add(descr: MetaDescriptor): void;
            getName(): string;
            createInstance(): Api.Entity;
            rightInstance(entity: Api.Entity): boolean;
            isInstance(entity: Api.Entity): boolean;
            mergeSuper(sup: ClassMetadata): void;
            addSubclass(sub: ClassMetadata): void;
            findForDiscriminator(disc: string): ClassMetadata;
            findOverridden(override: string): ClassMetadata;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class EmbeddedMetaDescriptor extends MetaDescriptor {
            binding: Api.IBinding;
            named(name: string): EmbeddedMetaDescriptor;
            createEvent(allMetadata: Metadata): EntityEvent<any>;
            setBinding(binding: Api.IBinding): void;
        }
        class ReferenceMetaDescriptor extends MetaDescriptor {
            project: string[];
            named(name: string): ReferenceMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class CollectionMetaDescriptor extends MetaDescriptor {
            isReference: boolean;
            sorting: Api.SortingData;
            project: string[];
            binding: Api.IBinding;
            configure(allMetadata: Metadata, ret: MapEvent<any>): MapEvent<any>;
        }
        class MapMetaDescriptor extends CollectionMetaDescriptor {
            named(name: string): MapMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class SetMetaDescriptor extends CollectionMetaDescriptor {
            named(name: string): SetMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class ListMetaDescriptor extends CollectionMetaDescriptor {
            named(name: string): SetMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class ObservableMetaDescriptor extends MetaDescriptor {
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class IgnoreMetaDescriptor extends MetaDescriptor {
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class Metadata {
            classes: Internal.ClassMetadata[];
            findMeta(param: Api.EntityType<any> | Api.Entity): ClassMetadata;
            findRooted(relurl: string): ClassMetadata;
            findDiscriminated(base: ClassMetadata, dis: string): ClassMetadata;
            findNamed(name: string): ClassMetadata;
        }
        function getAllMetadata(): Metadata;
        function getLastEntity(): Api.Entity;
        function getLastMetaPath(): MetaDescriptor[];
        function clearLastStack(): void;
    }
    module Utils {
        function findName(o: any): string;
        function findHierarchy(o: Api.Entity | Api.EntityType<any>): Api.EntityType<any>[];
        function findAllMethods(o: Api.Entity | Api.EntityType<any>): {
            [index: string]: Function;
        };
        function findParameterNames(func: Function): string[];
        function isInlineObject(o: any): boolean;
        function isEmpty(obj: any): boolean;
        function copyObj(from: Object, to: Object): void;
        function copyVal(val: any, to?: any): any;
        function serializeRefs(from: any): any;
        function deserializeRefs(db: Api.IDb3Static, ctx: Object, from: any): Promise<any>;
        class IdGenerator {
            static PUSH_CHARS: string;
            static BASE: number;
            static REVPOINT: number;
            static lastPushTime: number;
            static lastRandChars: any[];
            static lastBackRandChars: any[];
            static next(): string;
            static back(): string;
        }
        class WeakWrap<V> {
            private wm;
            private id;
            constructor();
            private getOnly(k);
            private getOrMake(k);
            get(k: any): V;
            set(k: any, val: V): void;
            delete(k: any): void;
        }
    }
    function bind(localName: string, targetName: string, live?: boolean): Api.IBinding;
    function sortBy(field: string, desc?: boolean): Api.SortingData;
    function embedded(def: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.EmbeddedParams, binding?: Api.IBinding): PropertyDecorator;
    function reference(def?: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.ReferenceParams, project?: string[]): PropertyDecorator;
    function map(valueType: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.CollectionParams, reference?: boolean): PropertyDecorator;
    function set(valueType: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.CollectionParams, reference?: boolean): PropertyDecorator;
    function list(valueType: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.CollectionParams, reference?: boolean): PropertyDecorator;
    function root(name?: string, override?: string): ClassDecorator;
    function discriminator(disc: string): ClassDecorator;
    function override(override?: string): ClassDecorator;
    function observable(): PropertyDecorator;
    function ignore(): PropertyDecorator;
    interface TypedMethodDecorator<T> {
        (target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void;
    }
    function remote(settings?: Api.RemoteCallParams): TypedMethodDecorator<(...args: any[]) => Promise<any>>;
    module meta {
        function embedded(def: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.EmbeddedParams, binding?: Api.IBinding): Tsdb.Internal.EmbeddedMetaDescriptor;
        function reference(def?: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.ReferenceParams, project?: string[]): Tsdb.Internal.ReferenceMetaDescriptor;
        function map(def: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.CollectionParams, reference?: boolean): Tsdb.Internal.MapMetaDescriptor;
        function set(def: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.CollectionParams, reference?: boolean): Tsdb.Internal.SetMetaDescriptor;
        function list(def: Api.EntityType<any> | Api.EntityTypeProducer<any> | Api.CollectionParams, reference?: boolean): Tsdb.Internal.ListMetaDescriptor;
        function observable(): Tsdb.Internal.ObservableMetaDescriptor;
        function ignore(): Tsdb.Internal.IgnoreMetaDescriptor;
        function define(ctor: Api.EntityType<any>, root?: string, discriminator?: string, override?: string): void;
    }
    /**
    * Weak association between entities and their database events. Each entity instance can be
    * connected only to a single database event, and as such to a single database.
    */
    var entEvent: Utils.WeakWrap<Internal.EntityEvent<any>>;
}
