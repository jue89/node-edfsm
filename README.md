# Event-driven Finite State Machine

This is a helper module for implementing finite state machines that react to events on an event bus.

The event bus is provided externally and must have implemented the following methods:
 * ```emit(event, arg)```
 * ```on(event, handler)``` with handle: ```(arg) => {...}```
 * ```removeListener(event, handler)```

For further details have a look into the documentation of native events provided by NodeJS.

## Example

A little guessing game:

```js
// Input event bus
const rl = require('readline');
const input = rl.createInterface({ input: process.stdin });

// Output event bus
const EventEmitter = require('events');
const output = new EventEmitter();
output.on('log', (line) => console.log(line));
output.on('err', (line) => console.error(line));

// FSM
const EDFSM = require('edfsm');
EDFSM({
	fsmName: 'guess',
	input: input,
	output: output,
	firstState: 'getName'
}).state('getName', (ctx, i, o, next) => {
	// Get the user's name
	o('log', 'Hi! What\'s your name?');
	i('line', (name) => {
		ctx.name = name;
		if (name === 'Chuck Norris') {
			next('win');
		} else {
			next('guess');
		}
	});
}).state('guess', (ctx, i, o, next) => {
	// Generate an random number
	const no = Math.floor(Math.random() * 16);

	// Let the user guess a number
	o('log', 'Guess a number between 0 and 15');
	i('line', (number) => {
		number = parseInt(number);
		if (number === no) {
			next('win');
		} else {
			next('loose');
		}
	});

	// The user has to answer within 3s
	next.timeout(3000, 'timeout');
}).state('win', (ctx, i, o, next) => {
	o('log', `You won, ${ctx.name}`);
	next('getName');
}).state('loose', (ctx, i, o, next) => {
	o('log', `You lost, ${ctx.name}`);
	next('getName');
}).state('timeout', (ctx, i, o, next) => {
	o('error', 'You are too slow!');
	next('getName');
}).run({});
```

## API

Creating a new FSM factory:

```js
const EDFSM = require('edfsm');
const edfsmFactory = EDFSM(opts);
```

Creates a new FSM factory with given ```opts```:
 * ```fsmName```: Human-readable name describing the FSM. Used for logging.
 * ```inputs```: Object containing multiple input busses. Their ```on()``` methods are accessible by calling ```i[key](event, () => {...})``` inside the states.
 * ```outputs```: Object containing multiple output busses. Events are emitted by calling ```o[key](event, () => {...})``` inside the states.
 * ```input```: Instance of the main input event bus. Can be used instead of the ```inputs``` option. Event listeners are installed by calling ```i(event, () => {...})``` inside the state.
 * ```output```: Instance of the output event bus. Can be used instead of the ```outputs``` option. Can be the same instance as ```input```. Events can be emitted by calling ```o(event, arg)``` inside the states.
 * ```firstState```: The name of the entry state. If not given, the first state will become the entry state.
 * ```log```: Object containing logging callbacks. All callbacks have this interface: ```(msg, obj) => {}```, whereas ```msg``` is the log message and ```obj``` contains further machine-readable details.
   * ```debug```: Message about FMS construction, destruction and state changes
   * ```warn```: Warnings about unconsumed output messages
   * ```error```: Error log.

States are defined and attached like this:

```js
edfsmFactory.state(name, (ctx, i, o, next) => {...});
```

 * ```name```: The state's name for addressing it.
 * ```ctx```: Context object of the current instance of the FSM. You can store any kind of information in there.
 * ```i```: *This interface is used if the FSM option ```input``` is set.* Helper method for setting up listeners to input events: ```i(event, (arg) => {...})```.  The listener will be removed automatically when the state is left. You do not have to take care about that.
 * ```i[key]```: *This interface is used if the FSM option ```inputs``` is set.* Helper method for setting up listeners to input events: ```i[key](event, (arg) => {...})```. ```key``` is the respective input item. The listener will be removed automatically when the state is left. You do not have to take care about that.
 * ```o```: *This interface is used if the FSM option ```output``` is set.* Helper method for emitting events on the output event bus: ```o(event, arg)```.
 * ```o[key]```: *This interface is used if the FSM option ```outputs``` is set.* Helper method for emitting events on the output event bus: ```o[key](event, arg)```. ```key``` is the respective output item.
 * ```next```: Method to be called if the current state shall be left: ```next(state)```. For transitioning to another state, put the state's name in the argument. If you want to destroy the current FSM instance, state ```null``` or an instance of ```Error``` as the first argument.
 * ```next.timeout```: Like ```next``` but delayed by ```timeout``` milliseconds: ```next.timeout(timeout, state)```. If the current state is left before the timeout elapsed, it will be cleared automatically. The timeout can be retriggered by calling this method again.

You can define a special state that will be entered before the FSM instance gets destroyed:

```js
edfsmFactory.final((ctx, i, o, next, err, lastState) => {...});
```

In addition to the handler's arguments as they are described above, these arugments are handed over to the handler:
 * ```err```: Will contain the error if the ```next``` call in the previous state contained an error. Otherwise this is ```undefined```.
 * ```lastState```: The name of the previous state.

Instances can be created by calling:

```js
edfsmFactory.run(ctx[, onEnd]);
```

 * ```ctx```: Object containing the context that the state handlers will access and use for storing instance-related information.
 * ```onEnd```: Callback that will be called once the FSM instance has been destroyed.
