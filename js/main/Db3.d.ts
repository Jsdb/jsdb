/**
 * The main Db module.
 */
declare module Db {
    /**
     * Create a database instance using given configuration. The first call to this function
     * will also initialize the {@link defaultDb}.
     *
     * TODO extend on the configuration options
     *
     * @return An initialized and configured db instance
     */
    function configure(conf: any): Db.Internal.IDb3Static;
    function of(e: Entity): Db.Internal.IDb3Static;
    /**
     * Return the {@link defaultDb} if any has been created.
     */
    function getDefaultDb(): Db.Internal.IDb3Static;
    /**
     * Empty interface, and as such useless in typescript, just to name things.
     */
    interface Entity {
    }
    /**
     * Definition of an entity constructor, just to mane things.
     */
    interface EntityType<T extends Entity> {
        new (): T;
    }
    /**
     * Internal module, most of the stuff inside this module are either internal use only or exposed by other methods,
     * they should never be used directly.
     */
    module Internal {
        /**
         * Creates a Db based on the given configuration.
         */
        function createDb(conf: any): IDb3Static;
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
            <E extends GenericEvent>(evt: E): E;
            /**
             * Access to an entity root given the entity class.
             */
            <T extends Entity>(c: EntityType<T>): IEntityRoot<T>;
            /**
             * TBD
             */
            (meta: MetaDescriptor, entity: Entity): any;
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
         * Optional interface that entities can implement to have awareness of the Db.
         */
        interface IDb3Initable {
            dbInit?(url: string, db: IDb3Static): any;
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
            load<T extends Entity>(url: string): T;
            /**
             * Reset the internal state of the db, purging the cache and closing al listeners.
             */
            reset(): any;
            /**
             * Deletes all the data from the db, without sending any event, and resets the internal state.
             */
            erase(): any;
        }
        /**
         * Implementation of {@link IDbOperations}.
         */
        class DbOperations implements IDbOperations {
            state: DbState;
            constructor(state: DbState);
            fork(conf: any): IDb3Static;
            load<T extends Entity>(url: string): T;
            reset(): void;
            erase(): void;
        }
        /**
         * Binding between parent and {@link embedded} entities.
         */
        interface IBinding {
            bind(localName: string, targetName: string, live?: boolean): any;
        }
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
        class BindingImpl implements IBinding {
            keys: string[];
            bindings: {
                [index: string]: string;
            };
            live: {
                [index: string]: boolean;
            };
            bind(local: string, remote: string, live?: boolean): IBinding;
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
            startLoads(metadata: ClassMetadata, state: DbState, parent: Entity): Promise<BindingState>;
            /**
             * Completes the binding once the target entity completed loading and the Promise returned by
             * {@link startLoads} completes.
             *
             * It sets all the values found in the "result", and optionally subscribes to the
             * "updated" event to keep the value live. For references, the updated event is also
             * trigger on reference change, so the value will be kept in sync.
             *
             */
            resolve(tgt: Entity, result: BindingState): void;
        }
        /**
         * Interface for sorting informations.
         */
        interface SortingData {
            field: string;
            desc?: boolean;
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
             * The value has been updated, used on entities when there was a change and on collections when an elements
             * is changed or has been reordered.
             */
            UPDATE = 1,
            /**
             * The value has been removed, used on root entities when they are deleted, embedded and references when
             * they are nulled, references also when the referenced entity has been deleted, and on collections when
             * an element has been removed from the collection.
             */
            REMOVED = 2,
            /**
             * The value has been added, used on collections when a new element has been added.
             */
            ADDED = 3,
            /**
             * Special event used on collection to notify that the collection has finished loading, and following
             * events will be updates to the previous state and not initial population of the collection.
             */
            LIST_END = 4,
        }
        /**
         * Class describing an event from the Db. It is used in every listener callback.
         */
        class EventDetails<T> {
            /**
             * The type of the event, see {@link EventType}.
             */
            type: EventType;
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
            ref: FirebaseQuery;
            /**
             * The callbacks registered by this handler on the underlying database reference.
             */
            protected cbs: {
                event: string;
                fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void;
            }[];
            /**
             * Hooks to the underlying database.
             *
             * @param event the event to hook to
             * @param fn the callback to hook to the database
             */
            hook(event: string, fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void): void;
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
        class GenericEvent implements IUrled {
            /** The entity bound to this event. */
            entity: Entity;
            /** The url for the entity bound to this event. */
            url: string;
            /** The db state this event works in */
            state: DbState;
            /** The parent of this event */
            parent: GenericEvent;
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
            setEntity(entity: Entity): void;
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
            parseValue(ds: FirebaseDataSnapshot): void;
            /**
             * Return true if this event creates a logica "traversal" on the normal tree structure
             * of events. For example, a reference will traverse to another branch of the tree, so it's
             * children will not be grandchildren of its parent.
             */
            isTraversingTree(): boolean;
            /**
             * If {@link isTraversingTree} returns true, then getTraversed returns the event
             * to which this events makes a traversal to.
             *
             * TODO this has not been implemented by relevant subclasses, like ReferenceEvent. Moreover,+
             * until we don't load the reference we don't know how to properly init the event (cause eventually
             * we would need to reuse an existing one from the cache).
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
        }
        /**
         * Database events for {@link embedded} or {@link reference}d entities.
         */
        interface IEntityOrReferenceEvent<E extends Entity> extends IUrled {
            /**
             * Load the entity completely.
             *
             * If it's a reference, the reference will be dereferenced AND the target data will be loaded.
             *
             * Other references will be dereferenced but not loaded.
             *
             * @param ctx the context object, to use with {@link off}
             */
            load(ctx: Object): Promise<EventDetails<E>>;
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
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
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
            dereference(ctx: Object): Promise<EventDetails<E>>;
            /**
             * If the entity is a reference, registers a callback to get notified about a change
             * in the reference pointer.
             *
             * @param ctx the context object, to use with {@link off}
             * @param callback the callback
             */
            referenced(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            /**
             * If the entity is a reference and has been loaded, this method retuns the url this reference is pointing at.
             */
            getReferencedUrl(): string;
            /**
             * Unregisters all callbacks and stops all undergoing operations started with the given context.
<			 *
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
             */
            assignUrl(): void;
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
            remove(): Promise<any>;
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
        class SingleDbHandlerEvent<E> extends GenericEvent {
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
            handleDbEvent(ds: FirebaseDataSnapshot, prevName: string): void;
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
        class EntityEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IEntityOrReferenceEvent<E> {
            /**
             * Local (ram, javascript) name of the entity represented by this event on the parent entity.
             */
            nameOnParent: string;
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
            lastDs: FirebaseDataSnapshot;
            /** a progressive counter used as a discriminator when registering the same callbacks more than once */
            progDiscriminator: number;
            setEntity(entity: Entity): void;
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            handleDbEvent(ds: FirebaseDataSnapshot, prevName: string): void;
            /**
             * Used to receive the projections when {@link ReferenceEvent} is loading the arget
             * event and has found some projections.
             */
            handleProjection(ds: FirebaseDataSnapshot): void;
            init(h: EventHandler): void;
            protected broadcast(ed: EventDetails<E>): void;
            parseValue(ds: FirebaseDataSnapshot): void;
            load(ctx: Object): Promise<EventDetails<E>>;
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
            assignUrl(): void;
            save(): Promise<any>;
            remove(): Promise<any>;
            clone(): E;
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
        class ReferenceEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IEntityOrReferenceEvent<E> {
            /**
             * Local (ram, javascript) name of the entity represented by this event on the parent entity.
             */
            nameOnParent: string;
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
            setEntity(entity: Entity): void;
            /**
             * Load this reference AND the pointed entity.
             */
            load(ctx: Object): Promise<EventDetails<E>>;
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
            handleDbEvent(ds: FirebaseDataSnapshot, prevName: string): void;
            parseValue(ds: FirebaseDataSnapshot): void;
            getReferencedUrl(): string;
            serialize(localsOnly?: boolean): Object;
            assignUrl(): void;
            save(): Promise<any>;
            remove(): Promise<any>;
            clone(): E;
        }
        /**
         * Interface implemented by collections that can be read. These are all the collections
         * but also {@link IQuery}.
         */
        interface IReadableCollection<E extends Entity> {
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
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
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
            added(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            /**
             * Registers a callback to get notified when a value is removed to the collection.
             *
             * @param ctx the context object, to use with {@link off}
             * @param callback the callback
             */
            removed(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            /**
             * Registers a callback to get notified when a value is changed to the collection.
             *
             * @param ctx the context object, to use with {@link off}
             * @param callback the callback
             */
            changed(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            /**
             * Registers a callback to get notified when a value is moved (reordered) to the collection.
             *
             * @param ctx the context object, to use with {@link off}
             * @param callback the callback
             */
            moved(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            /**
             * Unregisters all callbacks and stops all undergoing operations started with the given context.
             *
             * @param ctx the context object used to register callbacks using {@link updated}, {@link added} etc..
             * 		or used on other operations.
             */
            off(ctx: Object): void;
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
             * Fetch the specified key from the collection.
             *
             * TODO does this only dereference or also load the value?
             */
            fetch(ctx: Object, key: string | number | E): Promise<EventDetails<E>>;
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
             * Loads this collection into the parent entity, and also returns the value in the promise.
             *
             * If this is a collection of references, all the references are also loaded.
             */
            load(ctx: Object): Promise<any>;
            /**
             * Loads this collection into the parent entity, only deferencing the references and not
             * loading the referenced entity.
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
            pop(ctx: Object): Promise<EventDetails<E>>;
            /**
             * Fetches the last element of the collection, in current sorting order, without removing it.
             */
            peekTail(ctx: Object): Promise<EventDetails<E>>;
            /**
             * Adds an element to the beginning of the collection, in *key lexicographic* order.
             */
            unshift(value: E): Promise<any>;
            /**
             * Fetches and removes the first element of the collection, in current sorting order.
             */
            shift(ctx: Object): Promise<EventDetails<E>>;
            /**
             * Fetches the first element of the collection, in current sorting order, without removing it.
             */
            peekHead(ctx: Object): Promise<EventDetails<E>>;
            load(ctx: Object): Promise<E[]>;
            dereference(ctx: Object): Promise<E[]>;
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
            hookAll(fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string, event?: string) => void): void;
            hook(event: string, fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string, event?: string) => void): void;
            unhook(event: string): void;
        }
        /**
         * Default implementation of map.
         */
        class MapEvent<E extends Entity> extends GenericEvent implements IMapEvent<E> {
            isReference: boolean;
            nameOnParent: string;
            project: string[];
            binding: BindingImpl;
            sorting: SortingData;
            realField: any;
            loaded: boolean;
            setEntity(entity: Entity): void;
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
            handleDbEvent(handler: CollectionDbEventHandler, event: string, ds: FirebaseDataSnapshot, prevKey: string): void;
            add(key: string | number | Entity, value?: Entity): Promise<any>;
            createKeyFor(value: Entity): string;
            normalizeKey(key: string | number | Entity): string;
            addToInternal(event: string, ds: FirebaseDataSnapshot, val: Entity, det: EventDetails<E>): void;
            remove(keyOrValue: string | number | Entity): Promise<any>;
            fetch(ctx: Object, key: string | number | Entity): Promise<EventDetails<E>>;
            with(key: string | number | Entity): IEntityOrReferenceEvent<E>;
            isLoaded(): boolean;
            assertLoaded(): void;
            save(): Promise<any>;
            serialize(localsOnly?: boolean, fields?: string[]): Object;
            query(): IQuery<E>;
        }
        class EventedArray<E> {
            collection: MapEvent<E>;
            arrayValue: E[];
            keys: string[];
            constructor(collection: MapEvent<E>);
            private findPositionFor(key);
            private findPositionAfter(prev);
            addToInternal(event: string, ds: FirebaseDataSnapshot, val: E, det: EventDetails<E>): void;
            prepareSerializeSet(): void;
            prepareSerializeList(): void;
        }
        class ArrayCollectionEvent<E extends Entity> extends MapEvent<E> {
            protected evarray: EventedArray<E>;
            setEntity(entity: Entity): void;
            add(value?: Entity): Promise<any>;
            intSuperAdd(key: string | number | Entity, value?: Entity): Promise<any>;
            addToInternal(event: string, ds: FirebaseDataSnapshot, val: E, det: EventDetails<E>): void;
            load(ctx: Object): Promise<E[]>;
            dereference(ctx: Object): Promise<E[]>;
        }
        class ListEvent<E extends Entity> extends ArrayCollectionEvent<E> implements IListSetEvent<E> {
            createKeyFor(value: Entity): string;
            normalizeKey(key: string | number | Entity): string;
            serialize(localsOnly?: boolean, fields?: string[]): Object;
            intPeek(ctx: Object, dir: number): Promise<EventDetails<E>>;
            intPeekRemove(ctx: Object, dir: number): Promise<EventDetails<E>>;
            pop(ctx: Object): Promise<EventDetails<E>>;
            peekTail(ctx: Object): Promise<EventDetails<E>>;
            unshift(value: E): Promise<any>;
            shift(ctx: Object): Promise<EventDetails<E>>;
            peekHead(ctx: Object): Promise<EventDetails<E>>;
        }
        class SetEvent<E extends Entity> extends ArrayCollectionEvent<E> {
            createKeyFor(value: Entity): string;
            normalizeKey(key: string | number | Entity): string;
            serialize(localsOnly?: boolean, fields?: string[]): Object;
        }
        interface IObservableEvent<E extends Entity> extends IUrled {
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            live(ctx: Object): void;
            off(ctx: Object): void;
            isLoaded(): boolean;
            assertLoaded(): void;
        }
        class IgnoreEvent<E extends Entity> extends GenericEvent {
            nameOnParent: string;
            val: any;
            setEntity(): void;
            parseValue(ds: FirebaseDataSnapshot): void;
            serialize(): any;
            isLocal(): boolean;
        }
        class ObservableEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IObservableEvent<E> {
            nameOnParent: string;
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            live(ctx: Object): void;
            handleDbEvent(ds: FirebaseDataSnapshot, prevName: string): void;
            parseValue(ds: FirebaseDataSnapshot): void;
            isLoaded(): boolean;
            assertLoaded(): void;
            serialize(): Entity;
            isLocal(): boolean;
        }
        interface IEntityRoot<E extends Entity> extends IUrled {
            get(id: string): E;
            query(): IQuery<E>;
        }
        class EntityRoot<E extends Entity> implements IEntityRoot<E> {
            private state;
            private meta;
            constructor(state: DbState, meta: ClassMetadata);
            get(id: string): E;
            query(): IQuery<E>;
            getUrl(): string;
        }
        interface IQuery<E extends Entity> extends IReadableCollection<E> {
            load(ctx: Object): Promise<E[]>;
            dereference(ctx: Object): Promise<E[]>;
            onField(field: string, desc?: boolean): IQuery<E>;
            limit(limit: number): IQuery<E>;
            range(from: any, to: any): IQuery<E>;
            equals(val: any): IQuery<E>;
        }
        class QueryImpl<E> extends ArrayCollectionEvent<E> implements IQuery<E> {
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
        }
        class DbState {
            cache: {
                [index: string]: GenericEvent;
            };
            conf: any;
            myMeta: Metadata;
            db: IDb3Static;
            configure(conf: any): void;
            reset(): void;
            entityRoot(ctor: EntityType<any>): IEntityRoot<any>;
            entityRoot(meta: ClassMetadata): IEntityRoot<any>;
            entityRootFromUrl(url: string): IEntityRoot<any>;
            getUrl(): string;
            bindEntity(e: Entity, ev: GenericEvent): void;
            createEvent(e: Entity, stack?: MetaDescriptor[]): GenericEvent;
            loadEvent(url: string, meta?: ClassMetadata): GenericEvent;
            storeInCache(evt: GenericEvent): void;
            loadEventWithInstance(url: string, meta?: ClassMetadata): GenericEvent;
            load<T>(url: string, meta?: ClassMetadata): T;
        }
        class MetaDescriptor {
            localName: string;
            remoteName: string;
            ctor: EntityType<any>;
            classMeta: ClassMetadata;
            getTreeChange(md: Metadata): ClassMetadata;
            getRemoteName(): string;
            setType(def: any): void;
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
            createInstance(): Entity;
            rightInstance(entity: Entity): boolean;
            mergeSuper(sup: ClassMetadata): void;
            addSubclass(sub: ClassMetadata): void;
            findForDiscriminator(disc: string): ClassMetadata;
        }
        class EmbeddedMetaDescriptor extends MetaDescriptor {
            binding: IBinding;
            named(name: string): EmbeddedMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
            setBinding(binding: IBinding): void;
        }
        class ReferenceMetaDescriptor extends MetaDescriptor {
            project: string[];
            named(name: string): ReferenceMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class MapMetaDescriptor extends MetaDescriptor {
            isReference: boolean;
            sorting: Internal.SortingData;
            named(name: string): MapMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class SetMetaDescriptor extends MetaDescriptor {
            isReference: boolean;
            sorting: Internal.SortingData;
            named(name: string): SetMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class ListMetaDescriptor extends MetaDescriptor {
            isReference: boolean;
            sorting: Internal.SortingData;
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
            findMeta(param: EntityType<any> | Entity): ClassMetadata;
            findRooted(relurl: string): ClassMetadata;
            findDiscriminated(base: ClassMetadata, dis: string): ClassMetadata;
        }
        function getAllMetadata(): Metadata;
        function getLastEntity(): Entity;
        function getLastMetaPath(): MetaDescriptor[];
        function clearLastStack(): void;
    }
    module Utils {
        function findName(o: any): string;
        function findHierarchy(o: Entity | EntityType<any>): EntityType<any>[];
        function isInlineObject(o: any): boolean;
        function isEmpty(obj: any): boolean;
        function copyObj(from: Object, to: Object): void;
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
            private getOrMake(k);
            get(k: any): V;
            set(k: any, val: V): void;
            delete(k: any): void;
        }
    }
    function bind(localName: string, targetName: string, live?: boolean): Internal.IBinding;
    function sortBy(field: string, desc?: boolean): Internal.SortingData;
    function embedded(def: EntityType<any>, binding?: Internal.IBinding): PropertyDecorator;
    function reference(def: EntityType<any>, project?: string[]): PropertyDecorator;
    function map(valueType: EntityType<any>, reference?: boolean, sorting?: Internal.SortingData): PropertyDecorator;
    function set(valueType: EntityType<any>, reference?: boolean, sorting?: Internal.SortingData): PropertyDecorator;
    function list(valueType: EntityType<any>, reference?: boolean, sorting?: Internal.SortingData): PropertyDecorator;
    function root(name?: string, override?: string): ClassDecorator;
    function discriminator(disc: string): ClassDecorator;
    function override(override?: string): ClassDecorator;
    function observable(): PropertyDecorator;
    function ignore(): PropertyDecorator;
    module meta {
        function embedded(def: any, binding?: Internal.IBinding): Db.Internal.EmbeddedMetaDescriptor;
        function reference(def: any, project?: string[]): Db.Internal.ReferenceMetaDescriptor;
        function map(valuetype: EntityType<any>, reference?: boolean, sorting?: Internal.SortingData): Db.Internal.MapMetaDescriptor;
        function set(valuetype: EntityType<any>, reference?: boolean, sorting?: Internal.SortingData): Db.Internal.SetMetaDescriptor;
        function list(valuetype: EntityType<any>, reference?: boolean, sorting?: Internal.SortingData): Db.Internal.ListMetaDescriptor;
        function observable(): Db.Internal.ObservableMetaDescriptor;
        function ignore(): Db.Internal.IgnoreMetaDescriptor;
        function define(ctor: EntityType<any>, root?: string, discriminator?: string, override?: string): void;
    }
}
export = Db;
