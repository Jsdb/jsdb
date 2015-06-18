Js DB
=====

Js DB is a simple, fully event oriented, DB abstraction for JavaScript.


Reading data
============

ObjC
----

**ObjC** are the "entities" of the DB. For example, a User should be an ObjC. Each ObjC has a unique URL, usually composed by *path/id*, where path is usually connected to the class of the ObjC, so for example */users/12312*.

ObjCs however don't give direct access to data, they expose events to access those data.

For example, if a User ObjC is like the following :

```javascript
12312 : {
	name: 'Simone',
	surname: 'Gianni'
}
```

In TypeScript it would be represented as :

```typescript
class User extends ObjC<User> {
	events: {
		name: new Db.ValueEvent<String>('name'),
		surname: new Db.ValueEvent<String>('surname')
	}
}
```

The ObjC is not loaded right away, data is actually fetched only when someone is listening on the events, for example :

```typescript
u = <User>db.load('/users/12312');
u.events.name.on(this, (name) => {
	console.log("User name is " + name);
});
```

If the name of the user is updated somewhere else, the change will be broadcasted to all those who are listening on that event.

Moreover :
 
* An ObjC is a full fledged object, can have its own methods
* Given the same urls to the DB, it will return the same instance of ObjC
* ObjC implements an equals() method, based on the url
* ObjC also implements a getId() method, also based on the url

ObjD
----

Since accessing each single property of an ObjC by itself is cumbersome, properties can be grouped in **ObjD** s:

```json
12312 : {
	anagraphic : {
		name: 'Simone',
		surname: 'Gianni
	}
}
```

```typescript
class AnagraphicData extends ObjD<AnagraphicData> {
	name :string,
	surname :string
}

class User extends ObjC<User> {
	events: {
		anagraphic: new Db.ValueEvent<AnagraphicData>('anagraphic').objd(AnagraphicData)
	}
}

u.events.anagraphic.on(this, (data) => {
	console.log("User is " + data.name + " " + data.surname);
});

```

Moreover :

* Also ObjD are full fledged objects, and can have their own methods.
* ObjD instances are not to be considered shared, at each event trigger a different instance will be created.
* ObjD has an url, but not an id, they exist only inside an ObjC

Lists
-----

ObjCs can also contain lists of ObjDs, for example:

```typescript
class InternetSite {
	link :string,
	name :string,
	adult :boolean
}

class User extends ObjC<User> {
	events: {
		sites : new Db.ListEvent<InternetSite>('sites').objd(InternetSite)
	}
}

u.events.sites.add.on(this, (site) => {
	if (!site) return; // See the "end of list" event later
	$('#list').append('<li><a href="' + site.link + '">' + site.name + '</a></li>');
});
```

The ListEvent groups the following events :

* add : triggered once for each element already in the list, and the triggered when an element is added to the list later
* remove : triggered when an element is removed from the list
* modify : triggered when an element is modified
* all : triggered each time add, remove or modify are triggered

More on handling events
-----------------------

Events are triggered both the first time the exsting data are received (once for normal data, once for each existing element for lists), and when a value is later modified. To differentiate between the two, the event callback gets passed a second optional parameter containing a detail of the event.

```typescript
u.events.anagraphic.on(this, (data, detail) => {
	if (detail.populating) {
		console.log("User is " + data.name + " " + data.surname);
	} else {
		console.warn("The user data has been updated! Now the user is " + data.name + " " + data.surname);
	}
});

u.events.sites.add.on(this, (site, detail) => {
	if (!site) return;
	var li = $('<li><a href="' + site.link + '">' + site.name + '</a></li>');
	$('#list').append(li);
	if (!detail.populating) {
		li.addClass('listUpdated')
	}
});
```

When it comes to lists, the detail also permits to determine when a list has been completed, list sorting (see queries later), access to the list key (useful for later removal or resorting).

The detail object has the following properties :

* payload : the value of the event, same as the first parameter
* populating : true if the event is about stored data, false if it's an update
* projected : true if populating and the data is not from the formal object but from a projection (see later)
* listEnd : set to true on the "list end" event (see below)
* originalEvent : original event name, can in some cases be useful for fin tuning
* originalUrl : complete url (including list key and full path) of the payload
* originalKey : the key of the payload (usually is the last segment of the originalUrl)
* precedingKey : if the list is sorted, the key of the preceding element in sort order


Subscribing and unsubscribing to events
---------------------------------------

To subscribe to an event, use the `on(contex,callback)` method. It takes two arguments :

* context : is the context you're binding for, it will be used as `this` in the callback, is mandatory for off
* callback : is a (value :T, details :EventDetails< T>) that gets called when the event triggers.

To unsubscribe from an event, there are a few ways :

* event.off(ctx) : will unregister all events registered by this context on this specific event, more often than not a given context will have only one callback registered to a single event.
* details.offMe() : used inside the callback will unregister only this callback, this is useful when the callback need to fire only a few times (for example, filling a list but not being interested in updates).
* Db.Event.offAll(ctx, events) : unregisters this context from all given events
* use once(ctx,callback) instead than on(..) if you need to fetch the value only once. 


References
----------

ObjC and ObjD can contain references to other ObjC. For example, a user can have a partner, a list of friends, and a list of ObjD job positions that refer to some companies :

```typescript
class Company extends ObjC<Company> {
	// ...
}

class JobPosition extends ObjD<JobPosition> {
	company :Company,
	role :string,
	// ...
}

class User extends ObjC<User> {
	events = {
		partner : new ValueEvent<User>('partner'),
		friends : new ListEvent<User>('friends'),
		jobs : new ListEvent<JobPosition>('jobs').objd(JobPosition)
	}
}
```

References are loaded from the DB, so they share the same instance and a graph representation is totally possible.

Recap of data structure
-----------------------

So, to summarize :
* ObjC does not have data, they only have events
* Events can yield single values, references to ObjC, ObjD, or lists of these.
* ObjD can contain any kind of data, other ObjDs and references to ObjCs


Customising lists
-----------------

ListEvents normally yield all the elements in the list, in the order the underlying storage returns them. However it can often be beneficial to have list elements sorted, or limit their number, or filter out some of them.

On a ListEvents of ObjD, the following methods can be used :

* `sortOn(field :string, desc = true)` : sorts the list on the given field, sorting depends on the type of the field.
* `limit(num :number)` : limits the number of elements returned in the list.
* `range(from :any, to :any)` : used together with `sortOn()` limits the elements returned by the list to those having the specified field in the given range.
* `equals(val :any)` : used together with `sortOn()` limits the elements to only those having the specified field with the given value.

An example of a reason to use these methods could be a blog post having comments, and being the comments potentially hundreds we want to display the last 5 avoiding to load all of them.

```typescript
class Comment extends ObjD<Comment> {
	dateTime :number,
	author: string,
	text: string,
	// ...
}

class BlogPost extends ObjC<BlogPost> {
	events = {
		comments : new ListEvent<Comment>('posts').objd(Comment),
		lastComments : new ListEvent<Comment>('posts')
			.objd(Comment)
			.sortOn('dateTime', true)
			.limit(10)
	}
}
```

Queries
-------

While it's useful to have static restrictions on lists, like in the `lastPosts` example above, it's even more useful to be able to run queries on your lists.

It's possible to "fork" a query from a list and set query parameters at runtime.

```typescript
class CommentsByUser extends VisualComponent {
	show(post :BlogPost, author :string) {
		var query = post.comments.subQuery();
		query.sortOn('author').equals(author);
		query.add.on(this, showComment);
	}

	showComment(comment :Comment) {
		// Display the comment somehow
	}
}
```


Projections
-----------

Getting data from a key/value store is always a roundtrip operation. For example, if our users have friends in our db, and we have to often display this list with their names and surnames, we could benefit in having a copy of these data :

```javascript
user12345 : {
	friends: [
		{
			_ref: "/users/user492391",
			anagraphic : {
				name: "Friendly",
				surname: "Jordan"
			}
		},
		{
			_ref: "/users/user88324134",
			anagraphic : {
				name: "Nice",
				surname: "Brown"
			}
		},
		// Many other friends here
	]
}

```

A projection is a (possibly reduced) copy of an ObjD, placed in another part of the tree so that it can be fetched faster.

TODO Query on ObjC
------------------

Writing
=======


Server methods
==============




Advanced
========

Automatic event off
-------------------

Firebase considerations
-----------------------








 

 