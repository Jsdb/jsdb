Un-evented unboxing
-------------------

Sometimes it's enough to properly "unbox" data, that is parse the json into the right class,
without the need to have "proper" events for it, and most importantly not wanting them to
be "proper" entities.

For example, the Move or the HexCoords are good examples. We don't want the to be updated, they
can be replaced. We don't want the side effects of a correspondence beetween URL and instance, we 
want to use it as throw away.

Eventually, if emitDecoratorMetadata could emit metadata for all the properties of a class,
also non annotated, then we could automatically do the right unboxing for all the non-annotated,
non-primitive types.





Setting an array leads to duplication on database
--------------------------------------------------------

Observed in BattleStatus.moves, creating an array with 4 new moves and settings
them and then saving, when on the database there were already 4 old moves,
lead to duplication on the database and 8 moves being there.

This is because the ids can't match, however since the field was explicitly set
the collections should have been considered loaded and serialized as-is with a set
and not updated adding the new values.

More in general:
- if expicit modifier are called, the modification is progressive, and the in ram 
collection is modified in a plausible way (does not need to be entirely loaded).
- if a collection is set using the setter, it has to be considered valid in ram as if just loaded
- if a collection is loaded, must be saved (and serialized) with a SET

> the problem was a bit different : setting an array to empty, caused the entire
> tree on Firebase to disappear, so when parsing the old value was untouched.

> moreover, now the collections are cleared both completely (in parseValue) and
> incrementally when "value" events are received.  


Number of possible weaknesses
-----------------------------

If I dereference a reference, I have the entity initialized with the default values 
from the constructor, then I save it, it will serialize default values to the db,
overwriting actual values. It should not save locals at all if they were not loaded
previously. (we need an isFromDb:boolean, checking only the url is not enought,
cause the url could be there because of a reference or an assignUrl)

> this has been changed, now everything not found on the database is set to undefined,
> except ignored (@ignore and _*) fields.

If I load an entity with a collection, then modify the collection using appropriate 
methods, the save the collection, it will serialize the collection again overwriting
my changes. Moreover, changes made by methods to the collection are not reflected
on the instance (but they would if it was with a .live), but they could an quite easily.

> now modifications with local methods are reflected on the local (ram) collection.

If I load an entity, then later on I modify it and save it back, I could overwrite 
data written by others. Keeping it live (partially) prevents this. (but, to be honest,
this is what scalable dbs do anyway, so may not be a concern). On the other end,
having it live can lead to incoherent data (for example, i check A, and based on the 
check I modify B async and the save, but while I was in the process of modifying
B someone changed A, so now there is a combination of A and B that could not be).


Rename "dereference" to "get"
-----------------------------

Uniform with EntityRoot.


Context should be optioanl for methods that return promises
-----------------------------------------------------------

While technically is still important to have a context to cancel pending operations,
methods that return promises are registering their listeners only for the time
strictly needed to receive the answer, and then resolve, so having always to specify
a context is probably useless.


Test loading an embedded referenced directly by a url
-----------------------------------------------------

It should instantiate all preceding entities, and load/resolve what needed for binding.
Not sure it does. 

Moreover, if i load an embedded, then load the parent entity, it should bind the
two, meaning it should set on the parent entity the previously loaded embedded
entity.


Piggyback loading
-----------------

In a number of places the DB loads an entity, for example in remote method execution
and in binding. While this is ok, a load is a real "load", meaning "hit the db". If 
it happens that someone else places a listener on such object, then Firebase cached
the json, but if it was not then it goes and load the entity.

However, most often than not, the entity is already in the db cache. So, we need
a piggyback loading, that is not a simple get, but is not a complete loading, and
sounds like "if you have it in cache, get it, if you don't go and load from the db".


Serialize references in a way that's possible to query
------------------------------------------------------

Currently references are objects, containing a _ref field and eventually 
projections. This is done to minimize the database roundtrips, but comes
at a real cost, because missing queries is a problem.

Adding a @Tsdb.indexed annotation would benefit both :
* normal fields, cause it would create indexes on the database (maybe also on firebase)
* references, cause it would create a copy of the ref for indexing only purposes 
(at least on firebase)


Add a named annotation
----------------------

If the code is uglified, names could not match with those on the database or
with those on the server.

While using the names cache in uglify could help, having an explicitly "named"
annotation to use on methods and properties could be another option.

Check if exists, otherwise create it
-----------------------------------

Currently, this can't be done :
* Doing a get, returns an instance, that then is removed from the event when 
doing .exists (or .load), so subsequently saving saves again null.
* Creating a new instance and assigning url, gives error because there is 
already an event in the cache due to the previous exists.

The main problem seems to be how to deal with a .get that returns a local-only
instance, followed by a .load or .exists that find a NULL on the DB. 

Currently the event sets its entity to "null" so that, if it's an embedded, it 
sets null on the parent. However, this is unacceptable for root entities,
cause it creates the situation in which the cache is polluted, the entity
seems to be bound to an event, but the event does not have a bound entity.

This latter incoherency may happen also on non-rooted entities.  

> Solved by disconnecting the event when entity is null, and reconciling two events when 
> assigning the same url explicitly.

> This means that when an event receive an order to assignUrl with a specific id,
> it will check if there is another event already in cache for that url,
> in that case it will de-assign itself from the entity, and assign the entity
> to the previously existing event.

> I don't think this is a solution, it's reather a monkey patch. The situations 
> involving discrepancies between instances and events and cache must be
> handled better.

> I still think that having the event set it's instance to null is dangerous,
> apart from this case, also in an embedded there could still be the instance floating
> around, which could by mistake end up being a new row on the db if saved.


Global error handling / retrying / notification on anomalous situations
-----------------------------------------------------------------------

While we can chain promises and/or return errors to callbacks, usually we will
have a ton of callbacks in place, and maybe also a few promises running at the same time,
so notifying errors there is a good thing, but only for local error handling.

On the opposite, if the user application wants to display a banner to inform
the user that the DB is not responding, to check the connection, to retry etc..,
doing it on the local error handling is hard.

That's why we should provide :
* A global (per db) error handling callback, to which we report database and/or remote calls problems
* An automatic retry strategy, configurable and sensitive, that notifies that a retry is in progress
* Automatic monitoring for slow operations, before the operation actually fails if it takes more than
a configurable amount of time for no apparent reason, a callback should be notified.   


Find a different way of passing a database for static remote calls
-----------------------------------------------------------

Even if the static calls are 99% of times probably made from a client application that
has only one db active, it would be still be good to have a way to pass in the database
on which to execute the call.

Currently, one option is to pass it as a parameter, which works but gives compile
time error from typescript because of the different signature. 

Other options could be :
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

> Note that in the meantime, references does not need to specify a type anymore,
> so this would apply to embeddeds only, which is still a great part of the use
> cases anyway.



TEST Support binding and projections on collections
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

> I hit this on user application.



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
perform checks and eventually modify data on the database and/or return a value, the returned value
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



Programmatically trigger an update
----------------------------------

A normal Firebase scenario is that when an entity is updated locally and then saved,
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

> Done for entities and references. In entities it forwards to sub entities and other references,
> like a normal "value" events on the root entity would. 
> It is triggered only if the entity was loaded, or the reference was referenced.
> Not yet implemented for collections.


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

> Done in very simple way. 


Error when querying on an entity root
--------------------------------------

Steps to reproduce :
* Start the swashp server
* Create a new user and pirate
* Refresh the page
* Try to login with that same user

The stacktrace will be :

```
Error: Storing in cache two different events for the same key https://swashp.firebaseio.com/testServ/login/0PSnvuFn5jTXHjnshxZsct/player/
    at DbState.storeInCache (/home/sym/workspaces/pp3d/jsdb/js/main/Db3.js:2387:27)
    at EntityEvent.GenericEvent.saveChildrenInCache (/home/sym/workspaces/pp3d/jsdb/js/main/Db3.js:686:36)
    at EntityEvent.GenericEvent.findCreateChildFor (/home/sym/workspaces/pp3d/jsdb/js/main/Db3.js:670:22)
    at EntityEvent.parseValue (/home/sym/workspaces/pp3d/jsdb/js/main/Db3.js:1033:46)
    at QueryImpl.MapEvent.handleDbEvent (/home/sym/workspaces/pp3d/jsdb/js/main/Db3.js:1599:23)
    at /home/sym/workspaces/pp3d/jsdb/js/main/Db3.js:2204:69
    at /home/sym/workspaces/pp3d/jsdb/js/main/Db3.js:1458:105
```

Which is actually the player of that user. 



References are not saved
------------------------

The save() method of ReferenceEvent does not save "the reference", and that's partially right maybe; at the
same time the save() method of EntityEvent delegates to ReferenceEvent.save(), except if the entity
is new or previously loaded. Moreover, the "new" is done checking if it has a url, which is not the case
because of the assignUrl method.

> Separated external save and internalsave, the internalsave is the one used for internal propagation.
> They are the same for most of events except for references: the external save must not traverse 
> references, so the internalsave will only save the reference but not the referenced entity, while the
> external save now saves both, and does not complain in case the reference is null. 


Sets are not loaded
-------------------

When loading an entity that has a set inside, the load method was never implemented.

Even worse, loading an entity with a set returns error.

> Forgot to implement the parseValue, so all the collections were loaded if loaded explicity,
> but not if part of a main entity. 


Do we need a type for references?
---------------------------------

When there is a reference, either it's null, or it has a URL, or it has a local
instance (if it's not saved yet). Since the URL is annotated with the discriminator, 
in all the three cases, we could determine the runtime type without having to know.

However, right now, references require a type, because discriminator alone is not enough
without a base class.

Not requiring a type would :
* reduce the amout of typing in the system, in general
* permit to have polimorphic references on interfaces
* same goes for collections of references 

> In fact, in ReferenceEvent classMeta is never used, in anchestors is used only in GenericEvent 
> and only in findCreateChild that is overridden by ReferenceEvent with a no-op.

> The discriminator is enough, because the URL is first resolved, thus yielding the base type. 

> Type for references is now optional, everything seems to work even without



Binding does not work as expected when loading an entire entity
---------------------------------------------------------------

Seems like if a main entity has two embeddeds, which have bindings between them,
loading the entire entity does not trigger binding as it should.
 
> this could also be the base for automatic binding.


Create a static IDb3Static
--------------------------

Currintly, if I have a "ship" object, and want to be nitified of changes
in it's "anagraphic" embedded, i have to write :

```typescript
Tsdb.of(ship).db(ship.anagraphic).updated(....)
```

This is long and cumbersome. Using the metadata getters we could write simply :

```typescript
Tsdb.of(ship.anagraphic).updated...
```

The only difference from a normal "db" is taking the db from the main entity
of the metadata getter chain, and then passing the rest.



Find an easier solution for Promise.all
---------------------------------------

Often, in user application, we want to perform some operation
after making sure a number of entities are fully loaded.

Currently this can be obtained with this, rather cumbersome, code :

```typescript
Promise.all<any>([
	Tsdb.of(entityA).load(this),
	Tsdb.of(entityB.ref).load(this),
	Tsdb.of(entityC).load(this),
]).then(()=>{
	// freely use the entities here
});
```

A better support/syntax could be nice, something like :

```typescript
Tsdb.on(entityA).and(entityB.ref).and(entityC).load(this).then(()=>{
	
});
```

We would need a way to build a "proxy" with all the possible functions
on the events of the given entities, that then desugars into :

```typescript
var proms :Promise<any>[] = [];
for (var i = 0; i < this.events.length; i++) {
	proms.push(this.events[i][methodName](ctx));
}
return Promise.all(proms);
```

> It could be a composing of events, adding an "and" method on any event that
> returns an IDb3Static that adds the events to a list.



Problem with db binding of new instances
----------------------------------------

The following code does not work :

```typescript
var ship = new Ship();
var status = new Ship.Status();
ship.status = status;
cdb(ship).assignUrl();

// Later, inside some other method
Tsdb.of(status).triggerLocalSave();
```

While the following does :

```typescript
var ship = new Ship();
cdb(ship).assignUrl();
var status = new Ship.Status();
ship.status = status;

// Later, inside some other method
Tsdb.of(status).triggerLocalSave();
```

What happens, in the working case, is that there is an event when status is set
on the ship, so the setter triggers the findCreateEvent, while there is no event
in the first case so nothing is triggered.

It is right for the server not to trigger, but then when a new netity is bound to
the database it's "possible" children should be explored, and if a value is present
they should be created.


Handle situation in which an entity has been deleted
----------------------------------------------------

Right now, loading again an entity that has been in the meanwhile
deleted from the database gives no error, no warning, returns
the entity as is.

This is because EntityEvent.parseValue called with an empty value 
does nothing.

> Now entity event nullifies the entity also in this case.
