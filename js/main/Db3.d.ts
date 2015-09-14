declare module Db {
    function configure(conf: any): Internal.IDb3Static;
    function getDefaultDb(): Internal.IDb3Static;
    /**
     * Empty interface, and as such useless in typescript, just to name things.
     */
    interface Entity {
    }
    /**
     * Definition of a constructor, used not to write it always. (could use new "type" keyword)
     */
    interface EntityType<T extends Entity> {
        new (): T;
    }
    module Internal {
        function createDb(conf: any): IDb3Static;
        type nativeArrObj = number | string | boolean | {
            [index: string]: string | number | boolean;
        } | {
            [index: number]: string | number | boolean;
        } | number[] | string[] | boolean[];
        interface IDb3Static {
            (): IDbOperations;
            <T extends Entity>(c: EntityType<T>): IEntityRoot<T>;
            (meta: MetaDescriptor, entity: Entity): any;
            <V extends nativeArrObj>(value: V): IObservableEvent<V>;
            <T extends Entity>(map: {
                [index: string]: T;
            }): IMapEvent<T>;
            <T extends Entity>(list: T[]): IListSetEvent<T>;
            <T extends Entity>(entity: T): IEntityOrReferenceEvent<T>;
        }
        interface IDb3Initable {
            dbInit?(url: string, db: IDb3Static): any;
        }
        interface IDbOperations {
            fork(conf: any): IDb3Static;
            load<T extends Entity>(url: string): T;
            reset(): any;
        }
        class DbOperations implements IDbOperations {
            state: DbState;
            constructor(state: DbState);
            fork(conf: any): IDb3Static;
            load<T extends Entity>(url: string): T;
            reset(): void;
        }
        interface IBinding {
            bind(localName: string, targetName: string, live?: boolean): any;
        }
        interface BindingState {
            vals: any[];
            evts: GenericEvent[];
        }
        class BindingImpl implements IBinding {
            keys: string[];
            bindings: {
                [index: string]: string;
            };
            live: {
                [index: string]: boolean;
            };
            bind(local: string, remote: string, live?: boolean): IBinding;
            startLoads(metadata: ClassMetadata, state: DbState, parent: Entity): Promise<BindingState>;
            resolve(tgt: Entity, result: BindingState): void;
        }
        interface SortingData {
            field: string;
            desc?: boolean;
        }
        interface IUrled {
            getUrl(evenIfIncomplete?: boolean): string;
        }
        enum EventType {
            UNDEFINED = 0,
            UPDATE = 1,
            REMOVED = 2,
            ADDED = 3,
            LIST_END = 4,
        }
        class EventDetails<T> {
            type: EventType;
            payload: T;
            populating: boolean;
            projected: boolean;
            originalEvent: string;
            originalUrl: string;
            originalKey: string;
            precedingKey: string;
            private handler;
            private offed;
            setHandler(handler: EventHandler): void;
            offMe(): void;
            wasOffed(): boolean;
            clone(): EventDetails<T>;
        }
        class EventHandler {
            static prog: number;
            myprog: number;
            ctx: Object;
            event: GenericEvent;
            callback: (ed: EventDetails<any>) => void;
            discriminator: any;
            after: (h?: EventHandler) => any;
            private canceled;
            constructor(ctx?: Object, callback?: (ed: EventDetails<any>) => void, discriminator?: any);
            equals(oth: EventHandler): boolean;
            decomission(remove: boolean): boolean;
            handle(evd: EventDetails<any>): void;
            offMe(): void;
        }
        class DbEventHandler extends EventHandler {
            ref: FirebaseQuery;
            protected cbs: {
                event: string;
                fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void;
            }[];
            hook(event: string, fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void): void;
            decomission(remove: boolean): boolean;
        }
        class GenericEvent implements IUrled {
            entity: Entity;
            url: string;
            state: DbState;
            parent: GenericEvent;
            private children;
            private dependants;
            private _classMeta;
            private _originalClassMeta;
            /**
             * Array of current handlers.
             */
            protected handlers: EventHandler[];
            setEntity(entity: Entity): void;
            classMeta: ClassMetadata;
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
