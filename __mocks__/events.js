const EventEmitter = () => ({
	on: jest.fn(),
	emit: jest.fn(() => true),
	removeListener: jest.fn()
});

module.exports = EventEmitter;
