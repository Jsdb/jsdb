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
            getUrl(evenIfIncomplete?: boolean): string;
            urlInited(): void;
            on(handler: EventHandler): void;
            off(ctx: Object, callback?: (ed: EventDetails<any>) => void): void;
            offHandler(h: EventHandler): void;
            offAll(): void;
            protected init(h: EventHandler): void;
            protected broadcast(ed: EventDetails<any>): void;
            findCreateChildFor(key: String, force?: boolean): GenericEvent;
            findCreateChildFor(meta: MetaDescriptor, force?: boolean): GenericEvent;
            saveChildrenInCache(key?: string): void;
            addDependant(dep: GenericEvent): void;
            parseValue(ds: FirebaseDataSnapshot): void;
            isTraversingTree(): boolean;
            getTraversed(): GenericEvent;
            serialize(localsOnly?: boolean, fields?: string[]): Object;
            isLocal(): boolean;
        }
        interface IEntityOrReferenceEvent<E extends Entity> extends IUrled {
            load(ctx: Object): Promise<EventDetails<E>>;
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            live(ctx: Object): void;
            dereference(ctx: Object): Promise<EventDetails<E>>;
            referenced(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            getReferencedUrl(): string;
            off(ctx: Object): void;
            isLoaded(): boolean;
            assertLoaded(): void;
            assignUrl(): void;
            save(): Promise<any>;
            clone(): E;
        }
        class SingleDbHandlerEvent<E> extends GenericEvent {
            loaded: boolean;
            dbhandler: DbEventHandler;
            lastDetail: EventDetails<E>;
            init(h: EventHandler): void;
            mockCb(): void;
            off(ctx: Object, callback?: (ed: EventDetails<E>) => void): void;
            offHandler(h: EventHandler): void;
            checkDisconnect(): void;
            handleDbEvent(ds: FirebaseDataSnapshot, prevName: string): void;
        }
        class EntityEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IEntityOrReferenceEvent<E> {
            nameOnParent: string;
            binding: BindingImpl;
            bindingPromise: Promise<BindingState>;
            lastDs: FirebaseDataSnapshot;
            progDiscriminator: number;
            setEntity(entity: Entity): void;
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            handleDbEvent(ds: FirebaseDataSnapshot, prevName: string): void;
            handleProjection(ds: FirebaseDataSnapshot): void;
            init(h: EventHandler): void;
            protected broadcast(ed: EventDetails<E>): void;
            parseValue(ds: FirebaseDataSnapshot): void;
            load(ctx: Object): Promise<EventDetails<E>>;
            live(ctx: Object): void;
            isLoaded(): boolean;
            assertLoaded(): void;
            dereference(ctx: Object): Promise<EventDetails<E>>;
            referenced(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            getReferencedUrl(): string;
            serialize(localsOnly?: boolean, fields?: string[]): Object;
            assignUrl(): void;
            save(): Promise<any>;
            clone(): E;
        }
        class ReferenceEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IEntityOrReferenceEvent<E> {
            classMeta: ClassMetadata;
            nameOnParent: string;
            project: string[];
            pointedEvent: EntityEvent<E>;
            prevPointedEvent: EntityEvent<E>;
            progDiscriminator: number;
            setEntity(entity: Entity): void;
            load(ctx: Object): Promise<EventDetails<E>>;
            private makeCascadingCallback(ed, cb);
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            live(ctx: Object): void;
            dereference(ctx: Object): Promise<EventDetails<E>>;
            referenced(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            handleDbEvent(ds: FirebaseDataSnapshot, prevName: string): void;
            parseValue(ds: FirebaseDataSnapshot): void;
            isLoaded(): boolean;
            assertLoaded(): void;
            getReferencedUrl(): string;
            serialize(localsOnly?: boolean): Object;
            assignUrl(): void;
            save(): Promise<any>;
            clone(): E;
        }
        interface IReadableCollection<E extends Entity> {
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            added(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            removed(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            changed(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            moved(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            off(ctx: Object): void;
        }
        interface IGenericCollection<E extends Entity> extends IReadableCollection<E> {
            live(ctx: Object): void;
            remove(key: string | number | Entity): Promise<any>;
            fetch(ctx: Object, key: string | number | E): Promise<EventDetails<E>>;
            with(key: string | number | Entity): IEntityOrReferenceEvent<E>;
            query(): IQuery<E>;
            isLoaded(): boolean;
            assertLoaded(): void;
            save(): Promise<any>;
        }
        interface IMapEvent<E extends Entity> extends IGenericCollection<E> {
            add(key: string | number | Entity, value: E): Promise<any>;
            load(ctx: Object): Promise<{
                [index: string]: E;
            }>;
            dereference(ctx: Object): Promise<{
                [index: string]: E;
            }>;
        }
        interface IListSetEvent<E extends Entity> extends IGenericCollection<E> {
            add(value: E): Promise<any>;
            pop(ctx: Object): Promise<EventDetails<E>>;
            peekTail(ctx: Object): Promise<EventDetails<E>>;
            unshift(value: E): Promise<any>;
            shift(ctx: Object): Promise<EventDetails<E>>;
            peekHead(ctx: Object): Promise<EventDetails<E>>;
            load(ctx: Object): Promise<E[]>;
            dereference(ctx: Object): Promise<E[]>;
        }
        class CollectionDbEventHandler extends DbEventHandler {
            dbEvents: string[];
            istracking: boolean;
            ispopulating: boolean;
            hookAll(fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string, event?: string) => void): void;
            hook(event: string, fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string, event?: string) => void): void;
            unhook(event: string): void;
        }
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
            findCreateChildFor(key: String, force?: boolean): GenericEvent;
            findCreateChildFor(meta: MetaDescriptor, force?: boolean): GenericEvent;
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
            load(id: string): E;
            query(): IQuery<E>;
        }
        class EntityRoot<E extends Entity> implements IEntityRoot<E> {
            private state;
            private meta;
            constructor(state: DbState, meta: ClassMetadata);
            load(id: string): E;
            query(): IQuery<E>;
            getUrl(): string;
        }
        interface IQuery<E extends Entity> extends IReadableCollection<E> {
            load(ctx: Object): Promise<E[]>;
            dereference(ctx: Object): Promise<E[]>;
            sortOn(field: string, desc?: boolean): IQuery<E>;
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
            sortOn(field: string, desc?: boolean): QueryImpl<E>;
            limit(limit: number): QueryImpl<E>;
            range(from: any, to: any): QueryImpl<E>;
            equals(val: any): QueryImpl<E>;
            init(gh: EventHandler): void;
            findCreateChildFor(key: String, force?: boolean): GenericEvent;
            findCreateChildFor(meta: MetaDescriptor, force?: boolean): GenericEvent;
            save(): Promise<any>;
        }
        class DbState {
            cache: {
                [index: string]: GenericEvent;
            };
            conf: any;
            myMeta: Metadata;
            db: IDb3Static;
            entEvent: Utils.WeakWrap<GenericEvent>;
            configure(conf: any): void;
            reset(): void;
            entityRoot(ctor: EntityType<any>): IEntityRoot<any>;
            entityRoot(meta: ClassMetadata): IEntityRoot<any>;
            entityRootFromUrl(url: string): IEntityRoot<any>;
            getUrl(): string;
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
