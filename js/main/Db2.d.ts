/// <reference path="../../typings/tsd.d.ts" />
export = Db;
declare class Db {
    baseUrl: string;
    cache: {
        [index: string]: any;
    };
    constructor(baseUrl: string);
    init(): void;
    load<T>(url: string, ctor?: new () => T): T;
    save<E extends Db.Entity>(entity: E): Thenable<boolean>;
    assignUrl<E extends Db.Entity>(entity: E): void;
    reset(): void;
}
declare module Db {
    function entityRoot<E extends Entity>(c: new () => E): internal.IEntityRoot<E>;
    function embedded<E extends Entity>(c: new () => E, binding?: internal.IBinding): E;
    function reference<E extends Entity>(c: new () => E): internal.IReference<E>;
    function referenceBuilder<E extends Entity>(c: new () => E): new () => internal.ReferenceImpl<E>;
    function list<E extends Entity>(c: new () => E): internal.IList<E>;
    function bind(localName: string, targetName: string, live?: boolean): internal.IBinding;
    class Utils {
        static entitySerialize(e: Entity, fields?: string[]): any;
        static rawEntitySerialize(e: Entity, fields?: string[]): any;
    }
    class ResolvablePromise<X> {
        promise: Promise<X>;
        resolve: (val: X | Thenable<X>) => void;
        error: (err?: any) => void;
        constructor();
    }
    class Entity implements Thenable<internal.IEventDetails<any>> {
        load: internal.IEvent<any>;
        serialize: () => any;
        save(): Thenable<boolean>;
        then(): Thenable<internal.IEventDetails<any>>;
        then<U>(onFulfilled?: (value: internal.IEventDetails<any>) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
        then<U>(onFulfilled?: (value: internal.IEventDetails<any>) => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U>;
    }
    interface IEntityHooks {
        postLoad?(evd?: internal.EventDetails<any>): void;
        postUpdate?(evd?: internal.EventDetails<any>): void;
        prePersist?(evd?: internal.EventDetails<any>): void;
    }
    interface IOffable {
        off(ctx: any): any;
    }
    interface ISelfOffable {
        attached(event: IOffable): any;
    }
    module internal {
        interface IEntityRoot<E extends Entity> {
            named(name: string): IEntityRoot<E>;
            load(id: string): E;
            query(): IQuery<E>;
        }
        interface IReference<E extends Entity> {
            load: IEvent<IReference<E>>;
            url: string;
            value: E;
            then<U>(onFulfilled?: (value: internal.IEventDetails<IReference<E>>) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
            then<U>(onFulfilled?: (value: internal.IEventDetails<IReference<E>>) => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U>;
        }
        interface IEvent<V> extends IOffable {
            on(ctx: any, handler: {
                (detail?: IEventDetails<V>): void;
            }): any;
            once(ctx: any, handler: {
                (detail?: IEventDetails<V>): void;
            }): any;
            live(ctx: any): any;
            off(ctx: any): any;
            hasHandlers(): boolean;
        }
        interface IBinding {
            bind(localName: string, targetName: string, live?: boolean): any;
        }
        interface IEventDetails<V> {
            payload: V;
            populating: boolean;
            projected: boolean;
            listEnd: boolean;
            originalEvent: string;
            originalUrl: string;
            originalKey: string;
            precedingKey: string;
            offMe(): void;
        }
        interface ICollection<E> {
            add: IEvent<E>;
            remove: IEvent<E>;
            query(): IQuery<E>;
        }
        interface IList<E> extends ICollection<E> {
            value: E[];
            then<U>(onFulfilled?: () => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
            then<U>(onFulfilled?: () => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U>;
        }
        interface IMap<E> extends ICollection<E> {
            value: {
                [index: string]: E;
            };
        }
        interface IQuery<E> extends IList<E> {
            sortOn(field: string, desc?: boolean): IQuery<E>;
            limit(limit: number): IQuery<E>;
            range(from: any, to: any): IQuery<E>;
            equals(val: any): IQuery<E>;
        }
        class IdGenerator {
            static PUSH_CHARS: string;
            static BASE: number;
            static lastPushTime: number;
            static lastRandChars: any[];
            static next(): string;
        }
        class EntityRoot<E extends Entity> implements IEntityRoot<E> {
            constr: new () => E;
            db: Db;
            name: string;
            url: string;
            constructor(c: new () => E);
            named(name: string): EntityRoot<E>;
            initDb(db: Db): void;
            query(): QueryImpl<E>;
            load(id: string): E;
        }
        class EventDetails<T> implements IEventDetails<T> {
            payload: T;
            populating: boolean;
            projected: boolean;
            listEnd: boolean;
            originalEvent: string;
            originalUrl: string;
            originalKey: string;
            precedingKey: string;
            private handler;
            setHandler(handler: EventHandler<T>): void;
            offMe(): void;
        }
        class BindingImpl implements IBinding {
            keys: string[];
            bindings: {
                [index: string]: string;
            };
            live: {
                [index: string]: boolean;
            };
            bind(local: string, remote: string, live?: boolean): BindingImpl;
            resolve(parent: Entity, entityProm: Promise<IEventDetails<any>>): Promise<any>;
        }
        class EventHandler<T> {
            event: Event<T>;
            ctx: any;
            method: (detail?: EventDetails<T>) => void;
            static prog: number;
            myprog: number;
            first: boolean;
            after: (h?: EventHandler<T>) => any;
            _ref: FirebaseQuery;
            private canceled;
            private _cbs;
            constructor(event: Event<T>, ctx: any, method: (detail?: EventDetails<T>) => void);
            hook(event: string, fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void): void;
            decomission(remove: boolean): boolean;
            handle(evd: EventDetails<T>): void;
        }
        class Event<T> implements IEvent<T> {
            /**
             * Array of current handlers.
             */
            protected handlers: EventHandler<T>[];
            /**
             * Full url this event is listening to
             */
            url: string;
            /**
             * Instance of the Db we are using
             */
            protected db: Db;
            _preload: (p: Promise<EventDetails<T>>) => Promise<any>;
            events: string[];
            protected projVal: T;
            hrefIniter: (h: EventHandler<T>) => void;
            constructor();
            /**
             * Called by the Entity when the url is set.
             */
            dbInit(url: string, db: Db): void;
            on(ctx: any, handler: {
                (detail?: EventDetails<T>): void;
            }): void;
            private liveMarkerHandler();
            live(ctx: any): void;
            once(ctx: any, handler: {
                (detail?: EventDetails<T>): void;
            }): void;
            offHandler(h: EventHandler<T>): void;
            protected init(h: EventHandler<T>): void;
            protected setupHref(h: EventHandler<T>): void;
            protected setupEvent(h: EventHandler<T>, name: string): void;
            protected preTrigger(evd: EventDetails<T>): void;
            protected postTrigger(evd: EventDetails<T>): void;
            protected parseValue(val: any, url: string): T;
            off(ctx: any): void;
            static offAll(ctx: any, events: any): void;
            hasHandlers(): boolean;
        }
        class EntityEvent<T extends Entity> extends Event<T> {
            myEntity: T;
            parentEntity: any;
            binding: BindingImpl;
            loaded: boolean;
            constructor(myEntity: T);
            bind(binding: BindingImpl): void;
            setParentEntity(parent: any): void;
            dbInit(url: string, db: Db): void;
            parseValue(val: any, url?: string): T;
            protected preTrigger(evd: EventDetails<T>): void;
        }
        class ReferenceEvent<E extends Entity> extends EntityEvent<ReferenceImpl<E>> {
            constructor(myEntity: ReferenceImpl<any>);
            parseValue(val: any, url?: string): ReferenceImpl<E>;
        }
        class ReferenceImpl<E extends Entity> extends Entity implements IReference<E> {
            _ctor: new () => E;
            load: ReferenceEvent<E>;
            url: string;
            value: E;
            constructor(c: new () => E);
            serialize: () => {
                _ref: any;
            };
        }
        class CollectionEntityEvent<E> extends Event<E> {
            ctor: new () => E;
            constructor(c: new () => E);
            parseValue(val: any, url?: string): E;
        }
        class CollectionAddedEntityEvent<E> extends CollectionEntityEvent<E> {
            constructor(c: new () => E);
            protected init(h: EventHandler<E>): void;
        }
        class CollectionImpl<E> implements ICollection<E> {
            ctor: new () => E;
            db: Db;
            url: string;
            add: CollectionEntityEvent<E>;
            remove: CollectionEntityEvent<E>;
            constructor(c: new () => E);
            dbInit(url: string, db: Db): void;
            query(): QueryImpl<E>;
            protected setupHref(h: EventHandler<E>): void;
        }
        class ListImpl<E> extends CollectionImpl<E> implements IList<E> {
            value: E[];
            then<U>(onFulfilled?: () => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
        }
        class QueryImpl<E> extends ListImpl<E> implements IQuery<E> {
            private _sortField;
            private _sortDesc;
            private _limit;
            private _rangeFrom;
            private _rangeTo;
            private _equals;
            sortOn(field: string, desc?: boolean): QueryImpl<E>;
            limit(limit: number): QueryImpl<E>;
            range(from: any, to: any): QueryImpl<E>;
            equals(val: any): QueryImpl<E>;
            protected setupHref(h: EventHandler<E>): void;
        }
    }
}