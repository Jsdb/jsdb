
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
```

Since it's a hybrid type, IDbOperations could be directly implemented by the static db type.

Add another static method for getting the db 
--------------------------------------------

To avoid this:
```
Tsdb.of(this)(this).updated(...);
```

Another method similar to Tsdb.of (could be Tsdb.when(this), about(this) or similar) should
return the db event instead of the db itself. 


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

Support for calling server side methods
--------------------------------------


Auto-binding
------------

While when an entity is loaded from the DB, the binding is automatically done,
when the entity has been created for the first time programmatically, the binding
has to be done manually.

For example:
```
class Ship {
	@Tsdb.reference()
	clazz :ShipClass;
	
	@Tsdb.embedded(Status, Tsdb.bind('_class','clazz'))
	status :Status;
	
	@Tsdb.embedded(BattleStatus, Tsdb.bind('_status','status'))
	battleStatus :BattleStatus;	
}

var ship = new Ship();
ship.clazz = shpiClazz;
ship.status = new Status();
ship.battleStatus = new BattleStatus();

// Binding
ship.status._clazz = ship.clazz;
ship.battleStatus._status = ship.status;
```

Moreover, if after the binding has been done the values are changed,
it is not automatically updated.

```
ship.clazz = anotherClazz;
// status still points to the wrong class
```

It would be nice to :
* Have a method to do the binding programmatically, without loading but based on what we have
* Eventually do it automatically when setters are called


Ambiguity between embedded instances
------------------------------------

Suppose the following
```typescript
class Battle {
	@Tsdb.embedded()
	countdown :Countdown;
}

// On client
var clBattle = db(Battle).load('b1');
clBattle.countdown.registerCallback(this.funct);

// Then, later, on server
var srBattle = db(Battle).load('b1');
srBattle.countdown = new Countdown();
db(srBattle).save();
```

However, on client, since it's an embedded, the same instance will still
be used, eventually updated but still the same instance, which means the callback
will be there.

However, on the server, or on the client that issues te update, and in the intention
of the programmer, the instance should be a new one.

This stems from the fact that embeddeds don't have a key to differentiate, when saving
and then when updating, between two different instances.