let instanceCnt = 0;

function FSMInstance (fsm, ctx) {
	this.id = instanceCnt++;
	this.input = fsm.input;
	this.output = fsm.output;
	this.states = fsm.states;
	this.finalHandler = fsm.finalHandler;
	this.fsmName = fsm.fsmName;
	this.log = fsm.log;
	this.ctx = ctx;
	this.msg(this.log.debug, 'Created new instance', {
		message_id: 'fdd14aefc01c4ca8a34bde4cc8f3ede4'
	});
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
		if (!consumed) {
			this.msg(this.log.warn, `Event ${name} had no listeners`, {
				event: name,
				message_id: 'c84984c1816e4bf7b552dd7e638e9fa9'
			});
		}
	};

	// Promise waits for next state
	const leave = new Promise((resolve) => { this.next = resolve; });
	let toHandle;
	this.next.timeout = (msecs, nextState) => {
		toHandle = setTimeout(() => this.next(nextState), msecs);
	};
	this.msg(this.log.debug, `Enter state ${stateName}`, {
		message_id: '4d1314823a494567ba0c24dd74a8285a',
		state: stateName
	});
	this.states[stateName](this.ctx, i, o, this.next);
	leave.then((nextState) => {
		if (toHandle) clearTimeout(toHandle);
		iHandler.forEach((h) => this.input.removeListener(h[0], h[1]));
		if (nextState === null) return this.leave(nextState, stateName);
		if (nextState instanceof Error) return this.leave(nextState, stateName);
		else this.goto(nextState);
	});
};

FSMInstance.prototype.leave = function (err, lastState) {
	this.finalHandler(this.ctx, err, lastState);
	this.msg(this.log.debug, 'Removed instance', {
		message_id: '7be6d26c828240a0bb82fc84e5d6a662'
	});
};

FSMInstance.prototype.msg = function (handler, msg, info) {
	if (!handler) return;
	if (this.fsmName) {
		info.fsm_name = this.fsmName;
		msg = `${this.fsmName}: ${msg}`;
	}
	info.fsm_id = this.id;
	handler(msg, info);
};

function FSM (opts) {
	this.firstState = opts.firstState;
	this.input = opts.input;
	this.output = opts.output;
	this.fsmName = opts.fsmName;
	this.log = {
		debug: opts.log && opts.log.debug ? opts.log.debug : undefined,
		warn: opts.log && opts.log.warn ? opts.log.warn : undefined
	};
	this.finalHandler = () => {};
	this.states = {};
}

FSM.prototype.state = function (name, handler) {
	this.states[name] = handler;
	return this;
};

FSM.prototype.final = function (handler) {
	this.finalHandler = handler;
	return this;
};

FSM.prototype.run = function (ctx) {
	return new FSMInstance(this, ctx);
};

module.exports = (opts) => new FSM(opts);
