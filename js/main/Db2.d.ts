/// <reference path="../../typings/tsd.d.ts" />
export = Db;
declare class Db {
    baseUrl: string;
    cache: {
        [index: string]: Db.Entity<any>;
    };
    constructor(baseUrl: string);
    init(): void;
    load<T>(url: string): Db.Entity<T>;
    reset(): void;
}
declare module Db {
    function entityRoot<E extends Entity<any>>(c: new () => E): internal.IEntityRoot<E>;
    function embedded<E extends Entity<any>>(c: new () => E): E;
    function reference<E extends Entity<any>>(c: new () => E): internal.IReference<E>;
    class Entity<R> {
        load: internal.IEvent<R>;
        then<U>(onFulfilled?: (value: internal.IEventDetails<R>) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
        then<U>(onFulfilled?: (value: internal.IEventDetails<R>) => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U>;
    }
    module internal {
        interface IEntityRoot<E extends Entity<any>> {
            named(name: string): IEntityRoot<E>;
            load(id: string): E;
            save(entity: E): any;
        }
        interface IReference<E extends Entity<any>> {
            load: IEvent<IReference<E>>;
            value: E;
            then<U>(onFulfilled?: (value: internal.IEventDetails<IReference<E>>) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Thenable<U>;
            then<U>(onFulfilled?: (value: internal.IEventDetails<IReference<E>>) => U | Thenable<U>, onRejected?: (error: any) => void): Thenable<U>;
        }
        interface IEvent<V> {
            on(ctx: any, handler: {
                (detail?: IEventDetails<V>): void;
            }): any;
            once(ctx: any, handler: {
                (detail?: IEventDetails<V>): void;
            }): any;
            off(ctx: any): any;
            hasHandlers(): boolean;
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
        class EntityRoot<E extends Entity<any>> implements IEntityRoot<E> {
            constr: new () => E;
            db: Db;
            name: string;
            url: string;
            constructor(c: new () => E);
            named(name: string): EntityRoot<E>;
            initDb(db: Db): void;
            load(id: string): E;
            save(entity: E): void;
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
            _preload: (p: Promise<T>) => Promise<any>;
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
            once(ctx: any, handler: {
                (detail?: EventDetails<T>): void;
            }): void;
            offHandler(h: EventHandler<T>): void;
            protected init(h: EventHandler<T>): void;
            protected setupHref(h: EventHandler<T>): void;
            protected setupEvent(h: EventHandler<T>, name: string): void;
            protected parseValue(val: any, url: string): T;
            off(ctx: any): void;
            static offAll(ctx: any, events: any): void;
            hasHandlers(): boolean;
        }
        class EntityEvent<T> extends Event<T> {
            static getEventFor<T>(x: T): EntityEvent<T>;
            myEntity: Entity<T>;
            constructor(myEntity: Entity<T>);
            dbInit(url: string, db: Db): void;
            parseValue(val: any, url?: string): T;
        }
        class ReferenceEvent<T extends ReferenceImpl<any>> extends EntityEvent<T> {
            constructor(myEntity: ReferenceImpl<any>);
            parseValue(val: any, url?: string): T;
        }
        class ReferenceImpl<E extends Entity<any>> extends Entity<IReference<E>> {
            load: any;
            value: E;
        }
        interface EventDetachable {
            eventAttached(event: Event<any>): any;
        }
    }
}
