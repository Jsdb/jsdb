
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

> There is currently a bug that prevents completely supporting it. If the type is declared later in the file
> (let alone in another file with circular dependency), it will not be resolved. It's already a problem with
> the normal annotations, but there we can replace it with a function returning the type as late as poassible 
> (already done), while here we have to wait for the language to support it properly.


TEST Support binding and prjections on collections
---------------------------------------------

Basic support should already be there, since it's built into the events.


Support automatic pre-resolving for references
--------------------------------------------

Sometimes we might want a reference to be automatically resolved on load, like
a binding is but the other way around.

To explain it better in code :
```typescript
class Ship {
	@Tsdb.reference()
	clazz :ShipClass;

	name: string;

	getTag() {
		return "Ship " + this.name + ", class " + this.clazz.name; 
	}	
}

var sh = Db(Ship).get('s1');
sh.load(this).then(()=>console.log(sh.getTag()));
// Will log "Ship xyz, class undefined", because clazz has not been resolved
// So we have to write (tedious) 
sh.load(this).then(()=>{
	return Db(sh.clazz).load(this);
})
.then(()=>console.log(sh.getTag()));
```

We could instead have the sh.clazz resolved as soon as possible without user
intervention, cause we know it is used a lot in the code so we always want it 
to be resolved, like binding does.

This is somehow an alternative to projections, which are used for the same reason
but with better data access.


Un-evented unboxing
-------------------

Sometimes it's enough to properly "unbox" data, that is parse the json into the right class,
without the need to have "proper" events for it.

Evaluate if it's a good idea to have a specific annotation for this case, if it really can 
reduce the weight of using a normal "embedded" or not.

Eventually, if emitDecoratorMetadata could emit metadata for all the properties of a class,
also non annotated, then we could automatically do the right unboxing for all the non-annotated,
non-primitive types.



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

> !! Need to clarify the semantics a bit, what can be passed, what is serialized and how etc..

> Depends on "Complete loading by url"

 

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

> It could be resolved adding some more saved metadata (we already have 
> the discriminator). Ad additional "instid" could be created for each newly created instance,
> and when loading the instance could be completely replaced if the instid changed.

