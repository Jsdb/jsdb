Programmatically trigger an update
----------------------------------

A normal Firebase scenario is that when an entity is updated lcoally and then saved,
the updated events are triggered locally early, and later the database sync is performed.

This is beneficial for the user experience.

However, this is not the case when :
* Another database backend is in use, some of them may be slow to respond
* A server side method is called

In the latter case, the roundtrip can be quite long even when using Firebase :
* The call is made to the server
* The server modifies the data and saves it
* The database backend (Firebase) dispatches the change

So, we should offer a way of programmatically trigger a "save" locally, even if
the data is not really saved on the database. This could be used locally when
server methods are called.

Moreover, the database events could be the only kind of events the application is using,
and there could be local modifications that does not go in parallel with the database
that the application might want to trigger. Having a way to trigger local-only updated
events could mean not having to use two event systems.


Local stub for server side methods
----------------------------------

While the server side method calls are there to grant security and consistency to the 
application, the lag they introduce can be rather long :
* The call is made to the server
* The server executes the method loading, modifiying and saving data
* The database backend dispatches the change

It would be good if the client side version of the method could "stub" the server
side part, when needed and when the assumption that the server side call will succeed
is high enough. 

The promise returned sill still be the server side one, but local modification of
data and local triggering of the update event can "preview" what the server is doing
giving the user an immediate feedback. 


Find a different way of passing a database for static remote calls
-----------------------------------------------------------

Even if the static calls are 99% of times probably made from a client application that
has only one db active, it would be still be good to have a way to pass in the database
on which to execute the call.

Currently, one option is to pass it as a parameter, which works but gives error
from typescript. 

Another options could be :
```typescript

var db = Tsdb.configure();

// The function call is "a classic" but also a burden
db().with(()=>Clazz.static(param,param));

db().useAsDefault();
Clazz.static(param,param); // Should there be no interruption
db().restoreDefault(); // No way to automatically cleanup

// with is a getter, when called sets the "defaultDb" and returns a function
db().with(Clazz.static(param,param));
// after execution cleans behind itself

```


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
> the normal annotations, but there we can replace it with a function returning the type as late as possible 
> (already done), while here we have to wait for the language to support it properly.




TEST Support binding and prjections on collections
---------------------------------------------

Basic support should already be there, since it's built into the events.


Convert EntityRoot to be a GenericEvent
---------------------------------------

This is needed to :
* properly implement the query() method returning a QueryImpl
* uniform cache
* uniform the structure

EntityRoots are not different than a map, they could even extend Map. The only special 
thing they have is that they create instances that are not immediately loaded
(similar to references, could be extended to other events).

If they implement GenericEvent, and use the normal findOrCreateChild, then they would also
keep a list of already created instances, de-facto creating the cache. This would mean :
* Moving the cache inside the entity roots
* Implement there the code for cleanup
* Offer a place for root-based cache settings

> Done minimal support, what needed to support query()





Adapter for socket.io and calls
-----------------------------

For receiving server side remote calls, we need to :
* Have a socketIo receiving the message
* Find the right db based on something (url, whether we prefer share nothing or shared, etc..)
* Initialize the ExecContext with useful stuff

Once we have all of this, we can use the db state to execute the method.

Since all these steps are very "application specific", it would be better to :
* create an interface for a remote calls adapter
* a default implementation with sensible defaults (for example, only the socket in the context, always defaultDb etc..)
* give a way to initialize the server-side of remote calls with a custom implementation of the adapter

Same goes for the client side part.

> Done client side factory for creating the socket connection

> I think that on server-side an adapter is too much, now that the method to handle a remote call is exposed in 
> the IDbOperations, the full code to receive and handle the call should be a few lines. 


Support automatic pre-resolving for references
----------------------------------------------

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

> wrote interfaces, but maybe it's better to use a class or some toher way, cause we have no way at
> runtime to understand which kind of database we want. (right now, it's only firebase so fine).



Cache and cache cleaning
------------------------

A simple initial implementation could be based on roots only, where only rooted entities
are cached and managed, with a periodic pruning of unused children events.

This would automatically grant the peristence of parent events as long as child events are active.

 
Auto-binding
------------

While when an entity is loaded from the DB, the binding is automatically done,
when the entity has been created for the first time programmatically, the binding
has to be done manually.

For example:
```typescript
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

```typescript
ship.clazz = anotherClazz;
// ship.status._clazz still points to the wrong class
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

On client, since it's an embedded, the same instance will still
be used, eventually updated but still the same instance, which means the callback
will be there.

However, on the server, or on the client that issues the update, and in the intention
of the programmer, the instance should be a new one.

This stems from the fact that embeddeds don't have a key to differentiate, when saving
and then when updating, between two different instances.

> It could be resolved adding some more saved metadata (we already have 
> the discriminator). Ad additional "instid" could be created for each newly created instance,
> and when loading the instance could be completely replaced if the instid changed.

> Later, to the metadata we could also add a version to make optimistic locking, since
> Firebase supports in theory optimistic lock (validating the version is previous + 1 for example),
> and Mongo and every other DB supports it.








Done
====


Support for calling server side methods
--------------------------------------

> !! Need to clarify the semantics a bit, what can be passed, what is serialized and how etc..

A method on the client can be called, the call will be forwared to the server, the server will
perform checks and eventually modify data on the database and/ore return a value, the returned value
will resolve a server side promise that will resolve a client side promise.

The method operates on an object, the url of the object will be sent to the server.

The method will take parameters :
* Native parameters will be serialized as is
* Database persisted objects will be serialized as URL only

This implies that the following code will not work as expected :
```typescript
var ship = Db(Ship).get('s1').load(this).then(()=>{
	ship.name = "Something different";
	ship.checkAndPersistName(); // Server method 1
	
	ship.status.holdOpen = true;
	ship.updateStatus(ship.status); // Server method 2
	
	var nstatus = new ShipStatus();
	nstatus.holdOpen = true;
	ship.updateStatus(nstatus);
});
```

Since the ship instance is not serialized the first method will not see the changed name, and since the ship
status is not sent the same applies to the second method. Ironically, the third method would work. 

> So, instead, we need a dirty check and sending differences to the server on method call? And for performance 
> reasons, probably it could be a good idea to have annotations to specify what to serialize and what not
> on a method call.



Remote calls to static methods
------------------------------

Currently, either a URL or the class name is sent in the payload. The URL is easy
to decode, while the class name must be correctly handled :
* find the class based on the name in the metadata of the current database state
* find the correct override, because usually it will be a server side
* find the method and execute as usual

 
Create an ExecContext for server side methods
---------------------------------------------

The context is to be used by the user application, to store things like the current user or similar,
and passed as last parameter if the parameter name is "ctx".

> The parameter must be called "_ctx" (with an underscore) and be the last parameter.
> It can be optional, and parameters before it can be optional (they will be filled with
> undefined if not passed in).
> The interface is Api.IRemoteCallContext, by default it has a db that gets set to the current
> db, but being and interface with an optional property anything can be passed it it will get 
> the db set. Obviously, it can contain anything else useful for the method execution based
> on final application needs. 

