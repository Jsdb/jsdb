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
    interface Discriminator {
        discriminate(val: any): EntityType<any>;
        decorate(entity: Entity, val: any): any;
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
            <T extends Entity>(entity: T): IEntityOrReferenceEvent<T>;
            <T extends Entity>(map: {
                [index: string]: T;
            }): number;
            <T extends Entity>(list: T[]): number;
        }
        interface IDb3Initable {
            dbInit?(url: string, db: IDb3Static): any;
        }
        interface IDb3Annotated {
            __dbevent: GenericEvent;
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
        interface IUrled {
            getUrl(evenIfIncomplete?: boolean): string;
        }
        class EventDetails<T> {
            payload: T;
            populating: boolean;
            projected: boolean;
            listEnd: boolean;
            originalEvent: string;
            originalUrl: string;
            originalKey: string;
            precedingKey: string;
            private handler;
            setHandler(handler: EventHandler): void;
            offMe(): void;
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
            private cbs;
            hook(event: string, fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void): void;
            decomission(remove: boolean): boolean;
        }
        class GenericEvent implements IUrled {
            entity: Entity;
            url: string;
            state: DbState;
            parent: GenericEvent;
            private children;
            classMeta: ClassMetadata;
            /**
             * Array of current handlers.
             */
            protected handlers: EventHandler[];
            setEntity(entity: Entity): void;
            getUrl(evenIfIncomplete?: boolean): any;
            urlInited(): void;
            on(handler: EventHandler): void;
            off(ctx: Object, callback?: (ed: EventDetails<any>) => void): void;
            offHandler(h: EventHandler): void;
            protected init(h: EventHandler): void;
            protected broadcast(ed: EventDetails<any>): void;
            findCreateChildFor(key: String, force?: boolean): GenericEvent;
            findCreateChildFor(meta: MetaDescriptor, force?: boolean): GenericEvent;
            parseValue(ds: FirebaseDataSnapshot): void;
            isTraversingTree(): boolean;
            getTraversed(): GenericEvent;
            serialize(localsOnly?: boolean): Object;
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
            discriminator: Discriminator;
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
            serialize(localsOnly?: boolean): Object;
            assignUrl(): void;
            save(): Promise<any>;
        }
        class ReferenceEvent<E extends Entity> extends SingleDbHandlerEvent<E> implements IEntityOrReferenceEvent<E> {
            classMeta: ClassMetadata;
            nameOnParent: string;
            pointedEvent: EntityEvent<E>;
            prevPointedEvent: EntityEvent<E>;
            progDiscriminator: number;
            setEntity(entity: Entity): void;
            load(ctx: Object): Promise<EventDetails<E>>;
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            live(ctx: Object): void;
            dereference(ctx: Object): Promise<EventDetails<E>>;
            referenced(ctx: Object, callback: (ed: EventDetails<E>) => void, discriminator?: any): void;
            handleDbEvent(ds: FirebaseDataSnapshot, prevName: string): void;
            handleProjection(ds: FirebaseDataSnapshot): void;
            parseValue(ds: FirebaseDataSnapshot): void;
            isLoaded(): boolean;
            assertLoaded(): void;
            getReferencedUrl(): string;
            serialize(localsOnly?: boolean): Object;
            assignUrl(): void;
            save(): Promise<any>;
        }
        interface IObservableEvent<E extends Entity> extends IUrled {
            updated(ctx: Object, callback: (ed: EventDetails<E>) => void): void;
            live(ctx: Object): void;
            off(ctx: Object): void;
            isLoaded(): boolean;
            assertLoaded(): void;
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
        interface IQuery<E extends Entity> {
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
            getUrl(): string;
            createEvent(e: Entity, stack: MetaDescriptor[]): GenericEvent;
            loadEvent(url: string, meta?: ClassMetadata): GenericEvent;
            loadEventWithInstance(url: string, meta?: ClassMetadata): GenericEvent;
            load<T>(url: string, meta?: ClassMetadata): T;
        }
        class MetaDescriptor {
            localName: string;
            remoteName: string;
            ctor: EntityType<any>;
            discr: Discriminator;
            classMeta: ClassMetadata;
            getTreeChange(md: Metadata): ClassMetadata;
            getRemoteName(): string;
            setType(def: any): void;
            getCtorFor(val: any): EntityType<any>;
            named(name: string): MetaDescriptor;
            setLocalName(name: string): void;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class ClassMetadata extends MetaDescriptor {
            descriptors: {
                [index: string]: MetaDescriptor;
            };
            root: string;
            add(descr: MetaDescriptor): void;
            getName(): string;
            createInstance(): Entity;
            rightInstance(entity: Entity): boolean;
        }
        class EmbeddedMetaDescriptor extends MetaDescriptor {
            binding: IBinding;
            named(name: string): EmbeddedMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
            setBinding(binding: IBinding): void;
        }
        class ReferenceMetaDescriptor extends MetaDescriptor {
            named(name: string): ReferenceMetaDescriptor;
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class ObservableMetaDescriptor extends MetaDescriptor {
            createEvent(allMetadata: Metadata): GenericEvent;
        }
        class Metadata {
            classes: Internal.ClassMetadata[];
            findMeta(param: EntityType<any> | Entity): ClassMetadata;
        }
        function getAllMetadata(): Metadata;
        function getLastEntity(): Entity;
        function getLastMetaPath(): MetaDescriptor[];
        function clearLastStack(): void;
    }
    module Utils {
        function findName(f: Function): string;
        function isEmpty(obj: any): boolean;
        class IdGenerator {
            static PUSH_CHARS: string;
            static BASE: number;
            static lastPushTime: number;
            static lastRandChars: any[];
            static next(): string;
        }
    }
    function bind(localName: string, targetName: string, live?: boolean): Internal.IBinding;
    function embedded(def: EntityType<any> | Discriminator, binding?: Internal.IBinding): PropertyDecorator;
    function reference(def: EntityType<any> | Discriminator, binding?: Internal.IBinding): PropertyDecorator;
    function root(name: string): ClassDecorator;
    function observable(): PropertyDecorator;
    module meta {
        function embedded(def: any, binding?: Internal.IBinding): Db.Internal.EmbeddedMetaDescriptor;
        function reference(def: any): Db.Internal.ReferenceMetaDescriptor;
        function observable(): Db.Internal.ObservableMetaDescriptor;
        function root(ctor: EntityType<any>, name: string): void;
    }
}
export = Db;
