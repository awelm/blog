---
title: "How Scala Changed My Perspective on Programming"
date: 2021-12-08T12:35:14-08:00
draft: false
---

My last job required me to learn Scala, which is considered to be a functional-OOP hybrid language. Seeing real-world applications of Scala was what ultimately sold me on the language's concepts, and now I'm very grateful for the big perspective shift Scala has given me. Because I don't often hear engineers using Scala or other functional-leaning languages on the job, I'm excited to share my experiences here. I will introduce specific language features and concepts in Scala that have made a lasting impression in how I translate my thoughts into code.

## Powerful Pattern Matching

Pattern matching in Scala is amazing and extensively used. A pattern match is basically a `switch` statement on steroids that lets you match by value, type, and even nested values. You can also add conditional statements to ensure the match succeeds only when the specified condition is met. The pattern match always returns the value of the last evaluated statement, so pattern matching is also heavily used to create new variables (see below). Because pattern matching is so versatile, I've noticed people tend to prefer it over `if` statements. Let's look at some examples.

```scala
// A case class in Scala is just a typed tuple
case class Person(name: String, title: String)

val person = Person("Joe Smith", "Mr")
val professors = Set("Joe Smith")

val greeting = person match {
	case Person(name, "Dr") =>
		// This block executes if person has the title "Dr"
		s"Welcome Doctor $name"

	case Person(name, _) if professors.contains(name) =>
		// This block executes if person is a professor and doesn't have
		// the title "Dr"
		s"Welcome Professor $name"

	case Person(name, title) =>
		// Otherwise this block executes
		s"Welcome $title $name"
}

println(greeting) // prints "Welcome Professor Joe Smith"
```

## Monads

When writing business logic, there are often necessary special cases or error handling that complicate our code. Monads let you handle these complex scenarios clearly and concisely in a declarative manner. Simply put, a monad is just an interface around some data that forces the programmer to access or mutate the data in certain ways. By adhering to this standardized monad interface, we can cleanly chain multiple data transformations together into a pipeline that performs the computation we want. This declarative programming style lets us compute things by composing functions instead of specifying the computation's implementation details. In other words, monads let the programmer focus on data flow instead of control flow. Below we'll explore my 3 favorite Scala monads.

#### Option

The Option monad is a wrapper around a value that is possibly `null`. For example if you want to store a nullable integer in Scala, you should create a variable with type `Option[Int]`. If the Option contains the integer `5`, then the variable will have the value `Some(5)`. If the Option is empty (aka the integer is `null`), the variable will have the value `None`. `Some` and `None` are both child classes of the Option class. If we store a nullable value in an Option, the compiler will force us to handle null cases when dereferencing the Option. Below are some examples of using Options.

```scala
// Note all variables declared with `val` are immutable
val opt = Some(5) // type: Option[Int], value: Some(5)

/* 
 * map lets you run a transformation function on the value possibly stored
 * inside the Option. If map is called on an empty Option, then map will skip
 * the transformation function and return None. The first map call below prints
 * the stored value and then adds 2 to it. The second map call wraps the stored
 * value inside another Option, which is why the return value has an extra
 * Option layer. The third call always replaces the stored value with None.
 */

// type: Option[Int], value: Some(7)
opt.map { v =>
	println(v)
	v+2
}
opt.map(Some(_)) // type: Option[Option[Int]], value: Some(Some(5))
opt.map(_ => None) // type: Option[Option[Int]], value: Some(None)

/* 
 * flatMap behaves exactly like map, except with 2 differences:
 * 1) flatMap requires that the transformation function returns an Option
 * 2) flatMap will remove the extra Option layer from its return value
 * 
 * Notice how the flatMap calls return the same values as the map calls above,
 * but without the extra Option layer
 */

opt.flatMap(Some(_)) // type: Option[Int], value: Some(5)
opt.flatMap(_ => None) // type: Option[Int], value: None

/*
 * getOrElse will return the stored value or the specified default value if
 * the Option is empty.
 */
opt.getOrElse(10) // type: Int, value: 5
opt.flatMap(_ => None).getOrElse(10) // type: Int, value: 10
```

Options really shine when we want to perform downstream computations using values that are possible null. Let's imagine a real-world scenario where our backend service needs to know the viewer ID to determine if the current user has access to some requested resource. Let's also pretend that premium users get extra access to requested resources, and we use a special viewer ID to provide this extra access. While fetching this special viewer ID, let's say there are possible null cases along the way that force us to fallback to the non-premium experience. Here is how you might accomplish this in an iterative language like Python.

```python
viewerId = None
subscription = user.getSubscription()

if subscription:
	premiumTier = subscription.getPremiumTier()
	if premiumTier:
		premiumId = premiumTier.getPremiumId()
		if premiumId:
			viewerId = premiumId
		else:
			viewerId = user.getId()
	else:
		viewerId = user.getId()
else:
	viewerId = user.getId()
```

Yes we can shorten the code above by eagerly initializing `viewerId = user.getId()` but let's ignore example-specific optimizations because they won't protect us from null-checking hell in general. Below is the Scala version with function return types included for clarity.

```scala
val viewerId = user.getSubscriptionOpt      // type: Option[Subscription]
	.flatMap(_.getPremiumTierOpt)       // type: Option[Tier]
	.flatMap(_.getPremiumIdOpt)         // type: Option[ID]
	.getOrElse(user.getId())            // type: ID
```

If `getSubscriptionOpt`, `getPremiumTierOpt`, or `getPremiumIdOpt` return `None`, then we will safely fallback to the user's ID. Also notice how embedding nullability into the type system forces us to explicitly handle all null cases because otherwise the Option interface won't let us access the stored value. We could stay in the world of Options by continuing to use `flatMap`, but if we ever want to access the value inside we have to provide a fallback value. You might think that [Elvis operators](https://en.wikipedia.org/wiki/Elvis_operator) provide equally powerful functionality, but I disagree because `map` and `flatMap` can also be used to execute more complex multi-line lambda functions.

#### Future

The Future monad is a wrapper around an asynchronous operation that will either succeed or fail sometime in the future. Futures let us easily chain dependent sync or async operations together without blocking. Here are some examples of how to use Futures.

```scala
// type: Future[String]
val stringFut = Future {
	Thread.sleep(1000)
	"Returned string"
}

/*
 * You can call map() to register a synchronous operation
 * to run once this Future completes successfully
 */

// type: Future[Array[String]]
val wordsFut = stringFut.map { str =>
	str.split(" ") // type: Array[String]
}

/*
 * Use flatMap() to register another Future (async operation)
 * to run once this Future completes successfully. Notice how flatMap
 * removes the extra Future wrapper from the return value like in the
 * Option example above
 */

// type: Future[Array[String]]
val updatedWordsFut = wordsFut.flatMap { words =>
	// type: Future[Array[String]]
	Future {
		Thread.sleep(1000)
		val updatedWords = words :+ ("new_word") // Append operation that returns the new array
		println(updatedWords)
		updatedWords
	}
}

// Eventually prints the following array: ["Returned", "string", "new_word"]
// If you want to block until this happens, you can use Await.result, but this is
// considered to be bad practice
```

Notice how the type system helpfully shows us the current type stored in the Future before and after each transformation. Do you see how the Future `flatMap` lets us create Futures based on the return value of other Futures, similar to how we can create Options based the return value of other Options? This similarity exists because Futures and Options are both monads.

Now let's imagine we want to compute some string and then persist that string's words into a database without blocking. Let's assume the string computation and database persist operations are both async. Here is how we might do this using Python's *asyncio* library.

```python
async def storeWords():
    computedString = await computeString() 
    words = computedString.split(" ")
    await persistWords(words)

asyncio.run(storeWords())
```

Here is how we'd do it in Scala.

```scala
computeString.map(_.split(" ")).flatMap(persistWords)
```

Of course we can create intermediate variables if that makes the code more readable, but we aren't forced to. It's worth noting that the `map` and `flatMap` transformations are only applied when the Future completes successfully, just like how they are only applied to non-empty Options. If you want to handle Future failures elegantly, you can use `Future.recover`. Also check out Scala's [for comprehensions](https://www.baeldung.com/scala/for-comprehension) if you're interested in using a more generalized version of the async/await model. For comprehensions are just syntactic sugar for `flatMap` and some other Scala functions, so the underlying concepts remain the same.

#### Try

The Try monad is a wrapper around a code block that will either successfully return a value or throw an exception. It is the monad equivalent of the common try/catch functionality included in most languages. If the Try's code block throws an exception, the monad will return the exception wrapped inside a `Failure` object. If the Try code block executes successfully, the monad returns the value of the last evaluated statement wrapped inside a `Success` object.

Using this monad allows you to decouple running unsafe code from the error handling that typically must follow. This decoupling can be helpful when you want unsafe code execution and recovery coordinated across different functions or classes. And remember because we have `map` and `flatMap`, we can elegantly chain safe or unsafe code execution as shown below.

```scala
// type: Try[Int], value: Success(6)
val toIntTry = Try {
	"6".toInt
}

// type: Try[Int], value: Success(7)
val incrementedIntTry = toIntTry.map(_+1)

// type: Try[Double], value: Success(7.0)
val toDoubleTry = incrementedIntTry.flatMap { integer =>
	// type: Try[Double]
	Try(integer.toDouble)
}

// prints 7.0
println(toDoubleTry.getOrElse(0.0))

//type: Try[Int], value: Failure(java.lang.ArithmeticException: / by zero)
val failedTry = Try {
	6/0
}

// prints "Oops we divided by 0"
failedTry match {
	case Success(quotient) =>
		println(s"Quotient is $quotient")

	case Failure(ex: ArithmeticException) =>
		println(s"Oops we divided by 0")

    case Failure(ex) =>
        println(s"Received unknown exception $ex")
}
```

Let's imagine we want to open a certain file and fallback to opening a different file if an exception occurs. Here is how we'd do this in Python.

```python
try:
  file = open("a.txt", 'rb')
except Exception:
	try:
	  file = open("b.txt", 'rb')
	except Exception:
		pass
```

Here is the Scala version.

```scala
def openFileTry(name: String): Try[Source] = Try(Source.fromFile(name))

val fileTry = openFileTry("a.txt").getOrElse(openFileTry("b.txt"))
```

## Other Nice Things

#### [Immutability](https://alvinalexander.com/scala/scala-idiom-immutable-code-functional-programming-immutability/)

One central Scala idiom is to make all objects immutable unless there is good reason not to. Immutability is partly why the `map` and `flatMap` computation style works so well. If we passed mutable stateful objects through the pipeline, it would defeat the purpose because then we'd have to start keeping track of state again. It's easier to reason about immutable objects because you don't have to keep track of all possible interactions with these objects (see [action at a distance](https://en.wikipedia.org/wiki/Action_at_a_distance_%28computer_programming%29) anti-pattern). Immutability also gives us thread-safety for free, so the compiler can parallelize reads and take better advantage of modern multi-core hardware. But immutability can also lead to increased memory allocation and garbage collection rates, so it's not always the best choice for every application.

#### [Every Expression Returns a Value](https://www.oreilly.com/library/view/learning-scala/9781449368814/ch03.html)

Every expression in Scala returns a value. Functions, pattern matches, if-statements, etc will all implicitly return the value of the last evaluated statement. It's considered best practice to rely on these implicit returns instead of using the `return` keyword. This starts to make sense when we recognize that `return` is used to manage program control-flow. Remember that functional languages like Scala encourage you to focus on data flow via functional composition instead. And because every statement returns a value, we're actually able to create a program by wiring statements together in a functional manner.