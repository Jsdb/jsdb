
Support emitted metadata
------------------------

TypeScript supports emitting metadata for annotated entries (methods, properties etc..), using
``emitDecoratorMetadata=true`` .

This metadata contains already the type, so the following code could be possible :

```
@Tsdb.embedded
emb :TheType

@Tsdb.reference
ref :TheType
```


Un-evented unboxing
-------------------

Sometimes it's enough to properly "unbox" data, that is parse the json into the right class,
without the need to have "proper" events for it.

Evaluate if it's a good idea to have a specific annotation for this case, if it really can 
reduce the weight of using a normal "embedded" or not.

Eventually, if emitDecoratorMetadata could emit metadata for all the properties of a class,
also non annotated, then we could automatically do the right unboxing for all the non-annotated,
non-primitive types.


Move IDbOperations on the hybrid type itself
--------------------------------------------

Currently, to load from a url, we have to write :

```
Db().load(str);
```

Also, if the db is obtained with the ``of``, we have to write the following (horrible) stuff:

```
Tsdb.of(this)().load(str);
Tsdb.of(this)(this).updated(...);
```

Since it's a hybrid type, IDbOperations could be directly implemented by the static db type.


Write an interface for database configuration
---------------------------------------------


Complete loading by url
-----------------------

It could use the existing methods, simply needs to build the metadata chain from url segments
rather than from calls to getters. This however limits the scope, cause for example it could be
hard to go inside a collection (true also for metadata navigation).

Otherwise, it could work like the current one based on metadata, calling child creation.

Otherwise, it could be the current one that become string based (to create children it only needs
the name, that is a string and is also the path segment of the url).


Cache and cache cleaning
------------------------

A simple initial implementation could be based on roots only, where only rooted entities
are cached and managed, with a periodic pruning of unused children events.

This would automatically grant the peristence of parent events as long as child events are active.

