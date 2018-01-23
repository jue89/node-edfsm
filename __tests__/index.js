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
	expect(e.on.mock.calls[0][0]).toEqual(EVENT);
	expect(e.on.mock.calls[0][1]).toBe(HANDLER);
});

test('expose emit method of output bus', () => {
	const EVENT = 'e';
	const OBJ = {};
	const e = EventEmitter();
	const fsm = FSM({
		firstState: 'test',
		output: e
	}).state('test', (ctx, i, o) => {
		o(EVENT, OBJ);
	});
	fsm.run();
	expect(e.emit.mock.calls[0][0]).toEqual(EVENT);
	expect(e.emit.mock.calls[0][1]).toBe(OBJ);
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
	expect(warn.mock.calls[0][0]).toEqual(`testFSM: Event testEvent had no listeners`);
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
	}).final(() => {});
	fsm.run();
	setImmediate(() => {
		try {
			expect(debug.mock.calls[2][0]).toEqual(`testFSM: Removed instance`);
			expect(debug.mock.calls[2][1]).toMatchObject({
				message_id: '7be6d26c828240a0bb82fc84e5d6a662',
				fsm_name: 'testFSM'
			});
			done();
		} catch (e) { done(e); }
	});
});
