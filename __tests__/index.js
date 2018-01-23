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
		firstState: 'test',
		output: e,
		log: { warn }
	}).state('test', (ctx, i, o) => {
		o('test');
	});
	fsm.run();
	expect(warn.mock.calls[0][0]).toEqual(`Event test had no listeners`);
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
