import Tsdb = require('./Tsdb');
declare class Db3MockRoot implements Tsdb.Spi.DbTreeRoot {
    conf: Tsdb.Spi.FirebaseConf;
    constructor(conf: Tsdb.Spi.FirebaseConf);
    data: any;
    buffering: boolean;
    buffer: (() => any)[];
    private listeners;
    private find<T>(url, from?, leaf?, create?);
    getData(url: string): {};
    private bufferOp(fn);
    setData(url: string, data: any, cb?: (error: any) => void): void;
    private recurseTrigger(listeners, oldVal, newVal);
    updateData(url: any, data: any, cb?: (error: any) => void): void;
    flush(): void;
    listen(url: string): Db3MockRoot.Listener;
    getUrl(url: string): Tsdb.Spi.DbTree;
    makeRelative(url: string): string;
    makeAbsolute(url: string): string;
    isReady(): boolean;
    whenReady(): Promise<any>;
    static create(conf: any): Db3MockRoot;
}
declare module Db3MockRoot {
    interface RawCallback {
        (oldVal: any, newVal: any): any;
    }
    class Listener {
        cbs: RawCallback[];
        endCbs: RawCallback[];
        last: any;
        add(cb: RawCallback): void;
        addEnd(cb: RawCallback): void;
        remove(cb: RawCallback): void;
        trigger(oldVal: any, newVal: any): void;
    }
    class Db3MockSnap implements Tsdb.Spi.DbTreeSnap {
        private data;
        private root;
        private url;
        constructor(data: any, root: Db3MockRoot, url: string);
        exists(): boolean;
        val(): any;
        child(childPath: string): Tsdb.Spi.DbTreeSnap;
        forEach(childAction: (childSnapshot: Tsdb.Spi.DbTreeSnap) => void): boolean;
        key(): string;
        ref(): Tsdb.Spi.DbTree;
    }
    class Db3MockTree implements Tsdb.Spi.DbTree {
        root: Db3MockRoot;
        url: string;
        constructor(root: Db3MockRoot, url: string);
        private cbs;
        private qlistener;
        getListener(): Listener;
        toString(): string;
        set(value: any, onComplete?: (error: any) => void): void;
        update(value: Object, onComplete?: (error: any) => void): void;
        remove(onComplete?: (error: any) => void): void;
        on(eventType: string, callback: (dataSnapshot: Tsdb.Spi.DbTreeSnap, prevChildName?: string) => void, cancelCallback?: (error: any) => void, context?: Object): (dataSnapshot: Tsdb.Spi.DbTreeSnap, prevChildName?: string) => void;
        off(eventType?: string, callback?: (dataSnapshot: Tsdb.Spi.DbTreeSnap, prevChildName?: string) => void, context?: Object): void;
        once(eventType: string, successCallback: (dataSnapshot: Tsdb.Spi.DbTreeSnap) => void, context?: Object): void;
        private subQuery();
        /**
        * Generates a new Query object ordered by the specified child key.
        */
        orderByChild(key: string): Tsdb.Spi.DbTreeQuery;
        /**
        * Generates a new Query object ordered by key name.
        */
        orderByKey(): Tsdb.Spi.DbTreeQuery;
        /**
        * Creates a Query with the specified starting point.
        * The generated Query includes children which match the specified starting point.
        */
        startAt(value: string | number, key?: string): Tsdb.Spi.DbTreeQuery;
        /**
        * Creates a Query with the specified ending point.
        * The generated Query includes children which match the specified ending point.
        */
        endAt(value: string | number, key?: string): Tsdb.Spi.DbTreeQuery;
        /**
        * Creates a Query which includes children which match the specified value.
        */
        equalTo(value: string | number, key?: string): Tsdb.Spi.DbTreeQuery;
        /**
        * Generates a new Query object limited to the first certain number of children.
        */
        limitToFirst(limit: number): Tsdb.Spi.DbTreeQuery;
        /**
        * Generates a new Query object limited to the last certain number of children.
        */
        limitToLast(limit: number): Tsdb.Spi.DbTreeQuery;
        valueIn(values: string[] | number[], key?: string): Tsdb.Spi.DbTreeQuery;
        sortByChild(key: string): Tsdb.Spi.DbTreeQuery;
        child(path: string): Db3MockTree;
    }
    class QueryListener extends Listener {
        orderChild: string;
        startAt: string | number;
        endAt: string | number;
        equal: string | number;
        limit: number;
        limitFromLast: boolean;
        baseListener: Listener;
        constructor(oth: QueryListener | Listener);
        add(cb: RawCallback): void;
        addEnd(cb: RawCallback): void;
        filter(val: any): any;
        trigger(oldVal: any, newVal: any): void;
    }
}
export = Db3MockRoot;
