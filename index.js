let instanceCnt = 0;

const FINAL = '$final';

function FSMInstance (fsm, ctx, onEnd) {
	this.id = instanceCnt++;
	this.inputs = fsm.inputs;
	this.outputs = fsm.outputs;
	this.states = fsm.states;
	this.finalHandler = fsm.finalHandler;
	this.fsmName = fsm.fsmName;
	this.log = fsm.log;
	this.ctx = ctx;
	this.onEnd = onEnd;
	this.msg(this.log.debug, 'Created new instance', {
		message_id: 'fdd14aefc01c4ca8a34bde4cc8f3ede4'
	});
	this.goto(fsm.firstState);
}

FSMInstance.prototype.goto = function (stateName, err, lastState) {
	// Expose input bus
	const iHandler = [];
	const iHandlerGen = (key) => (name, handler) => {
		iHandler.push([this.inputs[key], name, handler]);
		this.inputs[key].on(name, handler);
	};
	const i = iHandlerGen('main');
	Object.keys(this.inputs).forEach((key) => {
		i[key] = iHandlerGen(key);
	});

	// Expose output bus
	const oHandlerGen = (key) => (...args) => {
		const name = args[0];
		const consumed = this.outputs[key].emit.apply(this.outputs[key], args);
		if (!consumed) {
			this.msg(this.log.warn, `Event ${name} on bus ${key} had no listeners`, {
				event: name,
				bus: key,
				message_id: 'c84984c1816e4bf7b552dd7e638e9fa9'
			});
		}
	};
	const o = oHandlerGen('main');
	Object.keys(this.outputs).forEach((key) => {
		o[key] = oHandlerGen(key);
	});

	// Make sure given event is defined
	if (!this.states[stateName]) {
		err = new Error(`No state named ${stateName} is defined`);
		stateName = FINAL;
	}

	// Setup state switch function
	let toHandle;
	this.next = (ret) => {
		// Make sure we are still in the current state
		if (stateName !== this.currentState) return;

		// Clean up state related stuffe
		if (toHandle) clearTimeout(toHandle);
		iHandler.forEach((h) => h[0].removeListener(h[1], h[2]));

		// If we were in end state, we want to call onEnd handler
		if (stateName === FINAL) return this.leave(ret);

		// Otherwise goto the next state
		let err;
		let nextState;
		if (ret === null) {
			nextState = FINAL;
		} else if (ret instanceof Error) {
			err = ret;
			nextState = FINAL;
		} else {
			nextState = ret;
		}
		this.goto(nextState, err, stateName);
	};
	this.next.timeout = (msecs, nextState) => {
		if (stateName !== this.currentState) return;
		if (toHandle) clearTimeout(toHandle);
		toHandle = setTimeout(() => this.next(nextState), msecs);
	};

	// Store current state
	this.currentState = stateName;

	// Call state
	this.msg(this.log.debug, `Enter state ${stateName}`, {
		message_id: '4d1314823a494567ba0c24dd74a8285a',
		state: stateName
	});
	try {
		this.states[stateName](this.ctx, i, o, this.next, err, lastState);
	} catch (err) {
		this.next(err);
	}
};

FSMInstance.prototype.leave = function (ret) {
	if (ret instanceof Error) {
		this.msg(this.log.error, ret.message, {
			message_id: '42df5fdea6fe4bf29332e2d6b0fbd9d9',
			stack: ret.stack
		});
	}
	this.msg(this.log.debug, 'Removed instance', {
		message_id: '7be6d26c828240a0bb82fc84e5d6a662'
	});
	if (typeof this.onEnd === 'function') this.onEnd(ret);
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
	this.inputs = opts.inputs || {};
	this.outputs = opts.outputs || {};
	if (opts.input) this.inputs.main = opts.input;
	if (opts.output) this.outputs.main = opts.output;
	this.fsmName = opts.fsmName;
	this.log = {
		debug: opts.log && opts.log.debug ? opts.log.debug : undefined,
		warn: opts.log && opts.log.warn ? opts.log.warn : undefined,
		error: opts.log && opts.log.error ? opts.log.error : undefined
	};
	this.states = {};
	// By default bypass errors
	this.states[FINAL] = (ctx, i, o, end, err) => end(err);
}

FSM.prototype.state = function (name, handler) {
	if (this.firstState === undefined) this.firstState = name;
	this.states[name] = handler;
	return this;
};

FSM.prototype.final = function (handler) {
	this.states[FINAL] = handler;
	return this;
};

FSM.prototype.run = function (ctx, onEnd) {
	return new FSMInstance(this, ctx, onEnd);
};

module.exports = (opts) => new FSM(opts);
