function FSMInstance (fsm, ctx) {
	this.input = fsm.input;
	this.output = fsm.output;
	this.states = fsm.states;
	this.log = fsm.log;
	this.ctx = ctx;
	this.goto(fsm.firstState);
}

FSMInstance.prototype.goto = function (stateName) {
	// Expose input bus
	const iHandler = [];
	const i = (name, handler) => {
		iHandler.push([name, handler]);
		this.input.on(name, handler);
	};

	// Expose output bus
	const o = (name, arg) => {
		const consumed = this.output.emit(name, arg);
		if (!consumed) this.log.warn(`Event ${name} had no listeners`);
	};

	// Promise waits for next state
	let next;
	const leave = new Promise((resolve) => { next = resolve; });
	let toHandle;
	next.timeout = (msecs, nextState) => {
		toHandle = setTimeout(() => next(nextState), msecs);
	};
	this.states[stateName](this.ctx, i, o, next);
	leave.then((nextState) => {
		if (toHandle) clearTimeout(toHandle);
		iHandler.forEach((h) => this.input.removeListener(h[0], h[1]));
		this.goto(nextState);
	});
};

function FSM (opts) {
	this.firstState = opts.firstState;
	this.input = opts.input;
	this.output = opts.output;
	this.log = {
		warn: opts.log && opts.log.warn ? opts.log.warn : () => {}
	};
	this.states = {};
}

FSM.prototype.state = function (name, handler) {
	this.states[name] = handler;
	return this;
};

FSM.prototype.run = function (ctx) {
	return new FSMInstance(this, ctx);
};

module.exports = (opts) => new FSM(opts);
