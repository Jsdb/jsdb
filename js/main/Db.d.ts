/// <reference path="../../typings/tsd.d.ts" />
export = Db;
declare class Db {
    baseUrl: string;
    private socket;
    private namesToRoots;
    setSocket(socket: SocketIO.Socket): void;
    sendOnSocket(url: string, payload: any): void;
    private scanRoots();
    private findRoot<T>(url);
    load<T extends Db.Entity>(url: string): T;
    computeUrl(inst: Db.Entity): string;
}
declare module Db {
    var serverMode: boolean;
    function str(): internal.IValueEvent<string>;
    function num(): internal.IValueEvent<number>;
    function data<V extends Data>(c: new () => V): internal.IValueEvent<V>;
    function reference<V extends Entity>(c: new () => V): internal.IValueEvent<V>;
    function dataList<V extends Data>(c: new () => V): internal.IListEvent<V>;
    function referenceList<V extends Entity>(c: new () => V): internal.IListEvent<V>;
    function entityRoot<V extends Entity>(c: new () => V): internal.IEntityRoot<V>;
    function strList(): internal.IListEvent<string>;
    function numList(): internal.IListEvent<number>;
    class Entity {
        url: string;
        protected db: Db;
        dbInit(url: string, db: Db): void;
        equals(oth: Entity): boolean;
        getId(): string;
        serializeProjections(url: string, projections?: any): void;
        protected callRemoteMethod(name: string, params: any[]): void;
        getPromise<T>(def: string): Promise<T>;
    }
    class Data {
        url: string;
        parse(url: string, obj: any, db: Db): void;
        serialize(db?: Db, ret?: any, projections?: any): any;
        static isRef(data: any): boolean;
        static readRef(data: any, db: Db): Entity;
    }
    module internal {
        interface IEventListen<V> {
            on(ctx: any, handler: {
                (data?: V, detail?: IEventDetails<V>): void;
            }): any;
            once(ctx: any, handler: {
                (data?: V, detail?: IEventDetails<V>): void;
            }): any;
            off(ctx: any): any;
            hasHandlers(): boolean;
        }
        interface IEvent<V> extends IEventListen<V> {
            named(name: string): IEvent<V>;
        }
        interface IValueEvent<V> extends IEvent<V>, Thenable<V> {
            named(name: string): IValueEvent<V>;
            broadcast(val: V): void;
            promise(): Promise<V>;
            preLoad(f: (promise: Promise<V>) => void): IValueEvent<V>;
            preLoad(bind: any): IValueEvent<V>;
        }
        interface IArrayValueEvent<V> extends IEvent<V[]>, Thenable<V[]> {
            named(name: string): IArrayValueEvent<V>;
            promise(): Promise<V[]>;
            preLoad(f: (promise: Promise<V[]>) => void): IArrayValueEvent<V>;
            preLoad(bind: any): IArrayValueEvent<V>;
        }
        interface IEntityRoot<T> {
            load(id: string): T;
            named(name: string): IEntityRoot<T>;
        }
        interface IListEvent<T> {
            add: IValueEvent<T>;
            remove: IEvent<T>;
            modify: IEvent<T>;
            all: IEvent<T>;
            full: IArrayValueEvent<T>;
            named(name: string): IListEvent<T>;
            subQuery(): IListEvent<T>;
            sortOn(field: string, desc?: boolean): IListEvent<T>;
            limit(limit: number): IListEvent<T>;
            range(from: any, to: any): IListEvent<T>;
            equals(val: any): IListEvent<T>;
        }
        interface IEventDetails<T> {
            payload: T;
            populating: boolean;
            projected: boolean;
            listEnd: boolean;
            originalEvent: string;
            originalUrl: string;
            originalKey: string;
            precedingKey: string;
            offMe(): void;
        }
        class IdGenerator {
            static PUSH_CHARS: string;
            static BASE: number;
            static lastPushTime: number;
            static lastRandChars: any[];
            static next(): string;
        }
        interface DbObjDescription<X extends Db.Entity> {
            instantiate(url: string): X;
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
            method: (payload?: T, detail?: EventDetails<T>) => void;
            static prog: number;
            myprog: number;
            first: boolean;
            after: (h?: EventHandler<T>) => any;
            _ref: FirebaseQuery;
            private canceled;
            private _cbs;
            constructor(event: Event<T>, ctx: any, method: (payload?: T, detail?: EventDetails<T>) => void);
            hook(event: string, fn: (dataSnapshot: FirebaseDataSnapshot, prevChildName?: string) => void): void;
            decomission(remove: boolean): boolean;
            handle(evd: EventDetails<T>): void;
        }
        class IsEvent {
        }
        /**
         * Db based event.
         *
         * This events are triggered when the sub key passed as name in constructor is modified.
         * Which modifications triggers the event and how they are interpreted is based on the transformer passed to
         * withTransformer.
         *
         * When called on(), the event is triggered as soon as possible (maybe even before returning from
         * the on call if the data is already available). All events are triggered, also those cached before
         * the call to on, that is "on" doesn't mean "call me when something changes from now on", but also
         * pre-existing data is sent as events.
         *
         * To distinguish, when possible, among pre-existing and new data, the event callback has a parameter
         * "first?:boolean", that is set to true for pre-existing data, and false for later updates.
         *
         */
        class Event<T> extends IsEvent implements IEvent<T> {
            /**
             * Name on DB.
             */
            protected name: string;
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
            /**
             * Constructor for the D object, if this event returns a D event
             */
            _ctorD: new () => Data;
            /**
             * If this is a ref
             */
            _isRef: boolean;
            _preload: (p: Promise<T>) => Promise<any>;
            _entity: Entity;
            events: string[];
            protected projVal: T;
            hrefIniter: (h: EventHandler<T>) => void;
            constructor();
            named(name: string): Event<T>;
            objD(c: new () => Data): Event<T>;
            preLoad(f: (promise: Promise<T>) => Promise<any>): any;
            preLoad(f: {
                [index: string]: string;
            }): any;
            /**
             * Called by the ObjC when the url is set.
             */
            dbInit(url: string, db: Db, entity: Entity): void;
            on(ctx: any, handler: {
                (data?: T, detail?: EventDetails<T>): void;
            }): void;
            once(ctx: any, handler: {
                (data?: T, detail?: EventDetails<T>): void;
            }): void;
            promise(): Promise<T>;
            then<U>(onFulfilled: (value: T) => U | Thenable<U>, onRejected?: (error: any) => U | Thenable<U>): Promise<U>;
            offHandler(h: EventHandler<T>): void;
            protected init(h: EventHandler<T>): void;
            protected setupHref(h: EventHandler<T>): void;
            protected setupEvent(h: EventHandler<T>, name: string): void;
            off(ctx: any): void;
            static offAll(ctx: any, events: any): void;
            hasHandlers(): boolean;
            parseValue(val: any, url?: string): any;
            projectValue(val: any): void;
        }
        class ValueEvent<T> extends Event<T> implements IValueEvent<T> {
            private broadcasted;
            private lastBroadcast;
            broadcast(val: T): void;
            named(name: string): ValueEvent<T>;
            preLoad(f: (promise: Promise<T>) => Promise<any>): any;
            preLoad(f: {
                [index: string]: string;
            }): any;
            protected checkBroadcast(): void;
            protected save(val: T): void;
            protected serializeForSave(val: T): any;
            dbInit(url: string, db: Db, entity: Entity): void;
        }
        class ArrayValueEvent<T> extends Event<T[]> implements IArrayValueEvent<T> {
            private broadcasted;
            private lastBroadcast;
            named(name: string): ArrayValueEvent<T>;
            parseValue(val: any, url?: string): any;
            preLoad(f: (promise: Promise<T[]>) => Promise<any>): any;
            preLoad(f: {
                [index: string]: string;
            }): any;
        }
        class AddedListEvent<T> extends ValueEvent<T> {
            constructor();
            projectValue(val: any): void;
            protected init(h: EventHandler<T>): void;
            protected save(val: T): void;
        }
        class EntityRoot<T extends Db.Entity> implements IEntityRoot<T> {
            ctor: new () => T;
            db: Db;
            url: string;
            name: string;
            instances: {
                [index: string]: T;
            };
            constructor(ctor: new () => T);
            private composeMyUrl();
            dbInit(db: Db): void;
            named(name: string): EntityRoot<T>;
            load(id: string): T;
        }
        class ListEvent<T> extends IsEvent implements IListEvent<T> {
            add: AddedListEvent<T>;
            remove: Event<T>;
            modify: Event<T>;
            all: Event<T>;
            full: ArrayValueEvent<T>;
            private name;
            private allEvts;
            private _sortField;
            private _sortDesc;
            private _limit;
            private _rangeFrom;
            private _rangeTo;
            private _equals;
            protected _url: string;
            protected _db: Db;
            protected _entity: Entity;
            protected _ctorD: new () => Data;
            constructor();
            named(name: string): ListEvent<T>;
            objD(c: new () => Data): ListEvent<T>;
            /**
             * Called by the ObjC when the url is set.
             */
            dbInit(url: string, db: Db, entity: Entity): void;
            subQuery(): ListEvent<T>;
            sortOn(field: string, desc?: boolean): ListEvent<T>;
            limit(limit: number): ListEvent<T>;
            range(from: any, to: any): ListEvent<T>;
            equals(val: any): ListEvent<T>;
            protected setupHref(h: EventHandler<T | T[]>): void;
        }
        interface EventDetachable {
            eventAttached(event: Event<any>): any;
        }
    }
}
