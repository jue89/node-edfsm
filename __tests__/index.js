jest.useFakeTimers();

jest.mock('events');
const EventEmitter = require('events');

const FSM = require('../index.js');

test('call first state', (done) => {
	const fsm = FSM({
		firstState: 'test'
	}).state('test', () => done());
	fsm.run();
});

test('set firstState implcitly to the first defined state', (done) => {
	const fsm = FSM({}).state('test', () => done());
	fsm.run();
});

test('expose on method of input bus', () => {
	const EVENT = 'e';
	const HANDLER = () => {};
	const e = EventEmitter();
	const fsm = FSM({
		firstState: 'test',
		input: e
	}).state('test', (ctx, i) => {
		i(EVENT, HANDLER);
	});
	fsm.run();
	expect(e.on.mock.calls[0][0]).toBe(EVENT);
	expect(e.on.mock.calls[0][1]).toBe(HANDLER);
});

test('expose on method of input busses', () => {
	const EVENT_A = 'a';
	const HANDLER_A = () => {};
	const EVENT_B = 'b';
	const HANDLER_B = () => {};
	const a = EventEmitter();
	const b = EventEmitter();
	const fsm = FSM({
		firstState: 'test',
		inputs: {a, b}
	}).state('test', (ctx, i) => {
		i.a(EVENT_A, HANDLER_A);
		i.b(EVENT_B, HANDLER_B);
	});
	fsm.run();
	expect(a.on.mock.calls[0][0]).toBe(EVENT_A);
	expect(a.on.mock.calls[0][1]).toBe(HANDLER_A);
	expect(b.on.mock.calls[0][0]).toBe(EVENT_B);
	expect(b.on.mock.calls[0][1]).toBe(HANDLER_B);
});

test('expose emit method of output bus', () => {
	const EVENT = 'e';
	const ARG1 = 'a1';
	const ARG2 = 'a2';
	const e = EventEmitter();
	const fsm = FSM({
		firstState: 'test',
		output: e
	}).state('test', (ctx, i, o) => {
		o(EVENT, ARG1, ARG2);
	});
	fsm.run();
	expect(e.emit.mock.calls[0][0]).toEqual(EVENT);
	expect(e.emit.mock.calls[0][1]).toBe(ARG1);
	expect(e.emit.mock.calls[0][2]).toBe(ARG2);
});

test('expose emit method of output busses', () => {
	const EVENT_A = 'a';
	const OBJ_A = {};
	const EVENT_B = 'b';
	const OBJ_B = {};
	const a = EventEmitter();
	const b = EventEmitter();
	const fsm = FSM({
		firstState: 'test',
		outputs: {a, b}
	}).state('test', (ctx, i, o) => {
		o.a(EVENT_A, OBJ_A);
		o.b(EVENT_B, OBJ_B);
	});
	fsm.run();
	expect(a.emit.mock.calls[0][0]).toEqual(EVENT_A);
	expect(a.emit.mock.calls[0][1]).toBe(OBJ_A);
	expect(b.emit.mock.calls[0][0]).toEqual(EVENT_B);
	expect(b.emit.mock.calls[0][1]).toBe(OBJ_B);
});

test('warn about not consumed events', () => {
	const e = EventEmitter();
	e.emit.mockReturnValueOnce(false);
	const warn = jest.fn();
	const fsm = FSM({
		fsmName: 'testFSM',
		firstState: 'test',
		output: e,
		log: { warn }
	}).state('test', (ctx, i, o) => {
		o('testEvent');
	});
	fsm.run();
	expect(warn.mock.calls[0][0]).toEqual(`testFSM: Event testEvent on bus main had no listeners`);
	expect(warn.mock.calls[0][1]).toMatchObject({
		message_id: 'c84984c1816e4bf7b552dd7e638e9fa9',
		fsm_name: 'testFSM',
		event: 'testEvent'
	});
});

test('head over to next state', (done) => {
	const fsm = FSM({
		firstState: 'test1'
	}).state('test1', (ctx, i, o, next) => {
		next('test2');
	}).state('test2', () => {
		done();
	});
	fsm.run();
});

test('suppress further calls of next callback', (done) => {
	const fsm = FSM({
		firstState: 'test1'
	}).state('test1', (ctx, i, o, next) => {
		next('test2');
		next('test3');
	}).state('test2', () => {
		done();
	}).state('test3', () => {
		done(new Error('wrong state'));
	});
	fsm.run();
});

test('remove event listeners when leaving state', (done) => {
	const EVENT = 'test';
	const HANDLER = () => {};
	const e = EventEmitter();
	const fsm = FSM({
		firstState: 'test1',
		input: e
	}).state('test1', (ctx, i, o, next) => {
		i(EVENT, HANDLER);
		next('test2');
	}).state('test2', () => {
		try {
			expect(e.removeListener.mock.calls[0][0]).toEqual(EVENT);
			expect(e.removeListener.mock.calls[0][1]).toBe(HANDLER);
			done();
		} catch (e) { done(e); }
	});
	fsm.run();
});

test('head over to next state after timeout', (done) => {
	const fsm = FSM({
		firstState: 'test1'
	}).state('test1', (ctx, i, o, next) => {
		next.timeout(10000, 'test2');
	}).state('test2', () => {
		done();
	});
	fsm.run();
	jest.advanceTimersByTime(10000);
});

test('retrigger timeout', (done) => {
	const fsm = FSM({
		firstState: 'test1'
	}).state('test1', (ctx, i, o, next) => {
		next.timeout(10000, 'test2');
		next.timeout(20000, 'test3');
	}).state('test2', () => {
		done(new Error('Wrong state'));
	}).state('test3', () => {
		done();
	});
	fsm.run();
	jest.advanceTimersByTime(10000);
	jest.advanceTimersByTime(10000);
});

test('run final handler if null is passed into next', (done) => {
	const fsm = FSM({
		firstState: 'test'
	}).state('test', (ctx, i, o, next) => {
		next(null);
	}).final(() => {
		done();
	});
	fsm.run();
});

test('hand over ctx to final handler', (done) => {
	const CTX = {};
	const fsm = FSM({
		firstState: 'test'
	}).state('test', (ctx, i, o, next) => {
		next(null);
	}).final((ctx) => {
		try {
			expect(ctx).toBe(CTX);
			done();
		} catch (e) { done(e); }
	});
	fsm.run(CTX);
});

test('hand over last state name to final handler', (done) => {
	const fsm = FSM({
		firstState: 'test'
	}).state('test', (ctx, i, o, next) => {
		next(null);
	}).final((ctx, i, o, end, err, lastState) => {
		try {
			expect(lastState).toEqual('test');
			done();
		} catch (e) { done(e); }
	});
	fsm.run();
});

test('run final handler if instance of Error is passed into next', (done) => {
	const fsm = FSM({
		firstState: 'test'
	}).state('test', (ctx, i, o, next) => {
		next(new Error('testErr'));
	}).final((ctx, i, o, end, err) => {
		try {
			expect(err.message).toEqual('testErr');
			done();
		} catch (e) { done(e); }
	});
	fsm.run();
});

test('run final handler if errors are thrown', (done) => {
	const fsm = FSM({
		firstState: 'test'
	}).state('test', (ctx, i, o, next) => {
		throw new Error('testErr');
	}).final((ctx, i, o, end, err) => {
		try {
			expect(err.message).toEqual('testErr');
			done();
		} catch (e) { done(e); }
	});
	fsm.run();
});

test('return the result of final handler', (done) => {
	const CTX = {};
	const RESULT = {};
	const fsm = FSM({
		firstState: 'test'
	}).state('test', (ctx, i, o, next) => {
		next(null);
	}).final((ctx, i, o, end) => {
		end(RESULT);
	});
	const onEnd = jest.fn();
	fsm.run(CTX, onEnd);
	try {
		expect(onEnd.mock.calls[0][0]).toBe(RESULT);
		done();
	} catch (e) {
		done(e);
	}
});

test('call onEnd handler even if no final handler has been defined', (done) => {
	const CTX = {};
	const fsm = FSM({
		firstState: 'test'
	}).state('test', (ctx, i, o, next) => {
		next(new Error('errTest'));
	});
	const onEnd = jest.fn();
	fsm.run(CTX, onEnd);
	try {
		expect(onEnd.mock.calls[0][0].message).toEqual('errTest');
		done();
	} catch (e) {
		done(e);
	}
});

test('error log Errors from final handler', (done) => {
	const error = jest.fn();
	const fsm = FSM({
		fsmName: 'testFSM',
		firstState: 'test',
		log: { error }
	}).state('test', (ctx, i, o, next) => {
		next(new Error('testErr'));
	}).final((ctx, i, o, end, err) => {
		end(err);
	});
	fsm.run();
	try {
		expect(error.mock.calls[0][0]).toEqual('testFSM: testErr');
		done();
	} catch (e) { done(e); }
});

test('expose next handler', (done) => {
	const fsm = FSM({
		firstState: 'test'
	}).state('test', (ctx, i, o, next) => {
		// NOP
	}).final(() => {
		done();
	});
	fsm.run().next(null);
});

test('debug log fsm construction', () => {
	const debug = jest.fn();
	const fsm = FSM({
		fsmName: 'testFSM',
		firstState: 'test',
		log: { debug }
	}).state('test', () => {});
	fsm.run();
	expect(debug.mock.calls[0][0]).toEqual(`testFSM: Created new instance`);
	expect(debug.mock.calls[0][1]).toMatchObject({
		message_id: 'fdd14aefc01c4ca8a34bde4cc8f3ede4',
		fsm_name: 'testFSM'
	});
});

test('debug log fsm state enter', () => {
	const debug = jest.fn();
	const fsm = FSM({
		fsmName: 'testFSM',
		firstState: 'test',
		log: { debug }
	}).state('test', () => {});
	fsm.run();
	expect(debug.mock.calls[1][0]).toEqual(`testFSM: Enter state test`);
	expect(debug.mock.calls[1][1]).toMatchObject({
		message_id: '4d1314823a494567ba0c24dd74a8285a',
		fsm_name: 'testFSM'
	});
});

test('debug log fsm destruction', (done) => {
	const debug = jest.fn();
	const fsm = FSM({
		fsmName: 'testFSM',
		firstState: 'test',
		log: { debug }
	}).state('test', (ctx, i, o, next) => {
		next(null);
	});
	fsm.run();
	try {
		expect(debug.mock.calls[3][0]).toEqual(`testFSM: Removed instance`);
		expect(debug.mock.calls[3][1]).toMatchObject({
			message_id: '7be6d26c828240a0bb82fc84e5d6a662',
			fsm_name: 'testFSM'
		});
		done();
	} catch (e) { done(e); }
});

test('complain about non-existing states', (done) => {
	const error = jest.fn();
	const fsm = FSM({
		fsmName: 'testFSM',
		firstState: 'nope',
		log: { error }
	});
	fsm.run({}, (err) => {
		try {
			expect(err.message).toEqual('No state named nope is defined');
			expect(error.mock.calls[0][0]).toEqual('testFSM: No state named nope is defined');
			expect(error.mock.calls[0][1]).toMatchObject({
				message_id: '42df5fdea6fe4bf29332e2d6b0fbd9d9',
				fsm_name: 'testFSM'
			});
			done();
		} catch (e) {
			done(e);
		}
	});
});
