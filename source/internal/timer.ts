import { autoCatch, WyvernClient } from ".."

/** Timer callback function */
export type TimerCallback = (client: WyvernClient) => Promise<void>

/** Timer class; handles regular function callback execution */
export class Timer {
	private readonly __client: WyvernClient
	private readonly __callbacks = new Map<symbol, TimerCallback>()
	private __timer?: NodeJS.Timer

	public constructor(client: WyvernClient) {
		this.__client = client
	}

	/** Returns the timer's delay in milliseconds */
	public get delay() {
		return this.__client.timer_delay
	}

	/** Starts the timer */
	public start() {
		this.stop()
		this.__timer = setInterval(() => this.tick(), this.delay)
	}
	/** Stops the timer */
	public stop() {
		clearInterval(this.__timer)
	}
	/** Triggers all timer callbacks */
	public async tick() {
		return await Promise.all([...this.__callbacks.values()].map(async (c) => await autoCatch(c(this.__client))))
	}
	/**
	 * Adds a callback to the timer and returns its identifier
	 * @param callback Timer callback function
	 */
	public add(callback: TimerCallback) {
		const id = Symbol("Timer callback")
		this.__callbacks.set(id, callback)
		return id
	}
	/**
	 * Removes a callback from the timer
	 * @param id Callback identifier
	 */
	public remove(id: symbol) {
		return this.__callbacks.delete(id)
	}
}
