import FS from "fs/promises"
import { Awaitable } from "discord.js"
import { autoCatch } from "../utility"

/** Data action callback */
export type DataAction<T> = (data: T, key: string, storage: BaseStorage) => Awaitable<void>
/** Data modifier callback */
export type DataModifier<T> = (data: T, key: string, storage: BaseStorage) => Awaitable<T>
/** Data predicate callback */
export type DataPredicate<T> = (data: T, key: string, storage: BaseStorage) => Awaitable<boolean>

/** Storage request settings object */
export interface RequestSettings {
	/** If set to `true`, the request may not read from storage; defaults to `false` */
	deny_read?: boolean
	/** If set to `true`, the request may not write to storage; defaults to `false` */
	deny_write?: boolean
	/** Changes the file extension of the request; defaults to `"json"` */
	data_type?: string
	/** Ignore data within the cache; defaults to `false` */
	ignore_cache?: boolean
	/** Ignore data within the file system; defaults to `false` */
	ignore_files?: boolean
}

/** Default data storage location */
const DEFAULT_DATA_ROOT = "data"
/** Default storage request settings */
const DEFAULT_REQUEST_SETTINGS: RequestSettings = {
	deny_read: false,
	deny_write: false,
	data_type: "json",
	ignore_cache: false,
	ignore_files: false,
}

/**
 * Converts a raw directory string into a directory file path
 * @param raw Raw directory
 * @param root Root folder
 */
function __into_dir_path(raw: string, root = DEFAULT_DATA_ROOT) {
	raw = raw.replace(/\\/g, "/")
	if (raw.startsWith("/")) raw = raw.slice(1)
	if (!raw.endsWith("/")) raw += "/"
	return `${root}/${raw}`
}
/**
 * Converts a raw file path string into a directory file path
 * @param raw Raw file path
 * @param root Root folder
 */
function __into_file_path(raw: string, ext = DEFAULT_REQUEST_SETTINGS.data_type, root = DEFAULT_DATA_ROOT) {
	raw = raw.replace(/\\/g, "/")
	if (raw.startsWith("/")) raw = raw.slice(1)
	if (!raw.endsWith(`.${ext}`)) raw += `.${ext}`
	return `${root}/${raw}`
}

/** Base storage interface */
export interface BaseStorage {
	/**
	 * Returns a list of every data key-value pair within storage
	 * @param dir Data key starting directory
	 * @param settings Request settings
	 */
	pairs<T = unknown>(dir: string, settings?: RequestSettings): Awaitable<[string, T][]>

	/**
	 * Checks whether data exists at the given key
	 * @param key Data key
	 * @param settings Request settings
	 */
	has(key: string, settings?: RequestSettings): Awaitable<boolean>
	/**
	 * Checks whether data exists at all of the given keys
	 * @param keys Data keys
	 * @param settings Request settings
	 */
	has_all(keys: string[], settings?: RequestSettings): Awaitable<boolean>
	/**
	 * Checks whether data exists at any of the given keys
	 * @param keys Data keys
	 * @param settings Request settings
	 */
	has_any(keys: string[], settings?: RequestSettings): Awaitable<boolean>

	/**
	 * Fetches the data at the given data key, if it exists
	 * @param key Data key
	 * @param settings Request settings
	 */
	get<T = unknown>(key: string, settings?: RequestSettings): Awaitable<T | undefined>
	/**
	 * Fetches the data at all of the given data keys, if it exists
	 * @param keys Data keys
	 * @param settings Request settings
	 */
	get_all<T = unknown>(keys: string[], settings?: RequestSettings): Awaitable<T[]>

	/**
	 * Stores the provided data at the given data key
	 * @param key Data key
	 * @param data Data value
	 * @param settings Request settings
	 */
	set<T = unknown>(key: string, data: T, settings?: RequestSettings): Awaitable<boolean>
	/**
	 * Stores all of the provided data pairs
	 * @param pairs Data key-value pairs
	 * @param settings Request settings
	 */
	set_all<T = unknown>(pairs: [string, T][], settings?: RequestSettings): Awaitable<boolean>

	/**
	 * Deletes the data at the given data key
	 * @param key Data key
	 * @param settings Request settings
	 */
	del(key: string, settings?: RequestSettings): Awaitable<boolean>
	/**
	 * Deletes the data at all of the given data keys
	 * @param keys Data keys
	 * @param settings Request settings
	 */
	del_all(keys: string[], settings?: RequestSettings): Awaitable<boolean>

	/**
	 * Returns the data at the given data key, setting it to the fallback value if absent
	 * @param key Data key
	 * @param fallback Fallback data value
	 * @param settings Request settings
	 */
	ensure<T>(key: string, fallback: T, settings?: RequestSettings): Awaitable<T>
	/**
	 * Returns all of the data at the given data keys, setting it to the fallback value if absent
	 * @param keys Data keys
	 * @param fallback Fallback data value
	 * @param settings Request settings
	 */
	ensure_all<T>(keys: string[], fallback: T, settings?: RequestSettings): Awaitable<T[]>

	/**
	 * Returns whether the data at the given data key matches the provided predicate
	 * @param key Data key
	 * @param callback Data predicate callback
	 * @param settings Request settings
	 */
	assert<T>(key: string, callback: DataPredicate<T>, settings?: RequestSettings): Awaitable<boolean>
	/**
	 * Returns whether the data at all of the given data keys matches the provided predicate
	 * @param keys Data keys
	 * @param callback Data predicate callback
	 * @param settings Request settings
	 */
	assert_all<T>(keys: string[], callback: DataPredicate<T>, settings?: RequestSettings): Awaitable<boolean>
	/**
	 * Returns whether the data at any of the given data keys matches the provided predicate
	 * @param keys Data keys
	 * @param callback Data predicate callback
	 * @param settings Request settings
	 */
	assert_any<T>(keys: string[], callback: DataPredicate<T>, settings?: RequestSettings): Awaitable<boolean>

	/**
	 * Applies the provided data action to the data at the given data key
	 * @param key Data key
	 * @param callback Data action callback
	 * @param settings Request settings
	 */
	action<T>(key: string, callback: DataAction<T>, settings?: RequestSettings): Awaitable<void>
	/**
	 * Applies the provided data action to the data at the given data keys
	 * @param keys Data keys
	 * @param callback Data action callback
	 * @param settings Request settings
	 */
	action_all<T>(keys: string[], callback: DataAction<T>, settings?: RequestSettings): Awaitable<void>
	/**
	 * Applies the provided data action to the data at the given data key if it matches the provided predicate
	 * @param key Data key
	 * @param callback Data action callback
	 * @param predicate Action predicate callback
	 * @param settings Request settings
	 */
	action_if<T>(
		key: string,
		callback: DataAction<T>,
		predicate: DataPredicate<T>,
		settings?: RequestSettings
	): Awaitable<void>
	/**
	 * Applies the provided data action to the data at the given data keys if it matches the provided predicate
	 * @param keys Data keys
	 * @param callback Data action callback
	 * @param predicate Action predicate callback
	 * @param settings Request settings
	 */
	action_all_if<T>(
		keys: string[],
		callback: DataAction<T>,
		predicate: DataPredicate<T>,
		settings?: RequestSettings
	): Awaitable<void>

	/**
	 * Applies the provided data modifier to the data at the given data key
	 * @param key Data key
	 * @param callback Data modifier callback
	 * @param settings Request settings
	 */
	modify<T>(key: string, callback: DataModifier<T>, settings?: RequestSettings): Awaitable<boolean>
	/**
	 * Applies the provided data modifier to the data at the given data keys
	 * @param keys Data keys
	 * @param callback Data modifier callback
	 * @param settings Request settings
	 */
	modify_all<T>(keys: string[], callback: DataModifier<T>, settings?: RequestSettings): Awaitable<boolean>
	/**
	 * Applies the provided data modifier to the data at the given data key
	 * @param key Data key
	 * @param callback Data modifier callback
	 * @param predicate Data predicate callback
	 * @param settings Request settings
	 */
	modify_if<T>(
		key: string,
		callback: DataModifier<T>,
		predicate: DataPredicate<T>,
		settings?: RequestSettings
	): Awaitable<boolean>
	/**
	 * Applies the provided data modifier to the data at the given data keys
	 * @param keys Data keys
	 * @param callback Data modifier callback
	 * @param predicate Data predicate callback
	 * @param settings Request settings
	 */
	modify_all_if<T>(
		keys: string[],
		callback: DataModifier<T>,
		predicate: DataPredicate<T>,
		settings?: RequestSettings
	): Awaitable<boolean>
}

/** Synchronous storage class */
export abstract class SyncStorage implements BaseStorage {
	public abstract pairs<T = unknown>(dir: string, settings?: RequestSettings): [string, T][]
	public abstract has(key: string, settings?: RequestSettings): boolean
	public abstract get<T = unknown>(key: string, settings?: RequestSettings): T | undefined
	public abstract set<T = unknown>(key: string, data: T, settings?: RequestSettings): boolean
	public abstract del(key: string, settings?: RequestSettings): boolean

	/**
	 * Returns a list of every data key within storage
	 * @param dir Data key starting directory
	 * @param settings Request settings
	 */
	public keys(dir: string, settings?: RequestSettings) {
		return this.pairs(dir, settings).map(([k, _]) => k)
	}
	/**
	 * Returns a list of every data value within storage
	 * @param dir Data key starting directory
	 * @param settings Request settings
	 */
	public values<T = unknown>(dir: string, settings?: RequestSettings) {
		return this.pairs<T>(dir, settings).map(([_, v]) => v)
	}

	public has_all(keys: string[], settings = DEFAULT_REQUEST_SETTINGS) {
		return keys.every((key) => this.has(key, settings))
	}
	public has_any(keys: string[], settings = DEFAULT_REQUEST_SETTINGS) {
		return keys.some((key) => this.has(key, settings))
	}

	public get_all<T = unknown>(keys: string[], settings = DEFAULT_REQUEST_SETTINGS) {
		return keys
			.map((key) => this.get<T>(key, settings))
			.filter((v) => !!v)
			.map((v) => v!)
	}

	public set_all<T = unknown>(pairs: [string, T][], settings = DEFAULT_REQUEST_SETTINGS) {
		return pairs.every(([key, val]) => this.set(key, val, settings))
	}

	public del_all(keys: string[], settings = DEFAULT_REQUEST_SETTINGS) {
		return keys.every((key) => this.del(key, settings))
	}

	public ensure<T>(key: string, fallback: T, settings = DEFAULT_REQUEST_SETTINGS) {
		if (this.has(key, settings)) {
			return this.get<T>(key, settings)!
		} else {
			this.set(key, fallback, settings)
			return fallback
		}
	}
	public ensure_all<T>(keys: string[], fallback: T, settings = DEFAULT_REQUEST_SETTINGS) {
		return keys.map((key) => this.ensure(key, fallback, settings))
	}

	public async assert<T>(
		key: string,
		callback: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	): Promise<boolean> {
		return this.has(key, settings) && (await callback(this.get(key, settings)!, key, this))
	}
	public async assert_all<T>(keys: string[], callback: DataPredicate<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		let result = true
		for (const key of keys) result &&= await this.assert(key, callback, settings)
		return result
	}
	public async assert_any<T>(keys: string[], callback: DataPredicate<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		let result = false
		for (const key of keys) result ||= await this.assert(key, callback, settings)
		return result
	}

	public async action<T>(key: string, callback: DataAction<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		if (this.has(key, settings)) await callback(this.get<T>(key, settings)!, key, this)
	}
	public async action_all<T>(keys: string[], callback: DataAction<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		keys.forEach((key) => this.action(key, callback, settings))
	}
	public async action_if<T>(
		key: string,
		callback: DataAction<T>,
		predicate: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	) {
		if (await this.assert(key, predicate, settings)) await callback(this.get(key, settings)!, key, this)
	}
	public async action_all_if<T>(
		keys: string[],
		callback: DataAction<T>,
		predicate: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	) {
		keys.forEach((key) => this.action_if(key, callback, predicate, settings))
	}

	public async modify<T>(
		key: string,
		callback: DataModifier<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	): Promise<boolean> {
		return this.has(key, settings) && this.set(key, await callback(this.get(key, settings)!, key, this))
	}
	public async modify_all<T>(keys: string[], callback: DataModifier<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		let result = true
		for (const key of keys) result &&= await this.modify(key, callback, settings)
		return result
	}
	public async modify_if<T>(
		key: string,
		callback: DataModifier<T>,
		predicate: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	) {
		return (await this.assert(key, predicate, settings)) && (await this.modify(key, callback, settings))
	}
	public async modify_all_if<T>(
		keys: string[],
		callback: DataModifier<T>,
		predicate: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	) {
		let result = true
		for (const key of keys) result &&= await this.modify_if(key, callback, predicate, settings)
		return result
	}
}

/** Asynchronous storage class */
export abstract class AsyncStorage implements BaseStorage {
	public abstract pairs<T = unknown>(dir: string, settings?: RequestSettings): Promise<[string, T][]>
	public abstract has(key: string, settings?: RequestSettings): Promise<boolean>
	public abstract get<T = unknown>(key: string, settings?: RequestSettings): Promise<T | undefined>
	public abstract set<T = unknown>(key: string, data: T, settings?: RequestSettings): Promise<boolean>
	public abstract del(key: string, settings?: RequestSettings): Promise<boolean>

	/**
	 * Returns a list of every data key within storage
	 * @param dir Data key starting directory
	 * @param settings Request settings
	 */
	public async keys(dir: string, settings?: RequestSettings) {
		return (await this.pairs(dir, settings)).map(([k, _]) => k)
	}
	/**
	 * Returns a list of every data value within storage
	 * @param dir Data key starting directory
	 * @param settings Request settings
	 */
	public async values<T = unknown>(dir: string, settings?: RequestSettings) {
		return (await this.pairs<T>(dir, settings)).map(([_, v]) => v)
	}

	public async has_all(keys: string[], settings = DEFAULT_REQUEST_SETTINGS) {
		let result = true
		for (const key of keys) result &&= await this.has(key, settings)
		return result
	}
	public async has_any(keys: string[], settings = DEFAULT_REQUEST_SETTINGS) {
		let result = false
		for (const key of keys) result ||= await this.has(key, settings)
		return result
	}

	public async get_all<T = unknown>(keys: string[], settings = DEFAULT_REQUEST_SETTINGS) {
		const result = [] as T[]

		for (const key of keys) {
			const val = await this.get<T>(key, settings)
			if (!!val) result.push(val)
		}

		return result
	}

	public async set_all<T = unknown>(pairs: [string, T][], settings = DEFAULT_REQUEST_SETTINGS) {
		let result = true
		for (const [key, val] of pairs) result &&= await this.set<T>(key, val, settings)
		return result
	}

	public async del_all(keys: string[], settings = DEFAULT_REQUEST_SETTINGS) {
		let result = true
		for (const key of keys) result &&= await this.del(key, settings)
		return result
	}

	public async ensure<T>(key: string, fallback: T, settings = DEFAULT_REQUEST_SETTINGS) {
		if (await this.has(key, settings)) {
			return (await this.get<T>(key, settings))!
		} else {
			await this.set(key, fallback, settings)
			return fallback
		}
	}
	public async ensure_all<T>(keys: string[], fallback: T, settings = DEFAULT_REQUEST_SETTINGS) {
		let result = []
		for (const key of keys) result.push(await this.ensure<T>(key, fallback, settings))
		return result
	}

	public async assert<T>(
		key: string,
		callback: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	): Promise<boolean> {
		return (await this.has(key, settings)) && (await callback((await this.get(key, settings))!, key, this))
	}
	public async assert_all<T>(keys: string[], callback: DataPredicate<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		let result = true
		for (const key of keys) result &&= await this.assert(key, callback, settings)
		return result
	}
	public async assert_any<T>(keys: string[], callback: DataPredicate<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		let result = false
		for (const key of keys) result ||= await this.assert(key, callback, settings)
		return result
	}

	public async action<T>(key: string, callback: DataAction<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		if (await this.has(key, settings)) await callback((await this.get<T>(key, settings))!, key, this)
	}
	public async action_all<T>(keys: string[], callback: DataAction<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		for (const key of keys) await this.action(key, callback, settings)
	}
	public async action_if<T>(
		key: string,
		callback: DataAction<T>,
		predicate: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	) {
		if (await this.assert(key, predicate, settings)) await callback((await this.get(key, settings))!, key, this)
	}
	public async action_all_if<T>(
		keys: string[],
		callback: DataAction<T>,
		predicate: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	) {
		for (const key of keys) await this.action_if(key, callback, predicate, settings)
	}

	public async modify<T>(
		key: string,
		callback: DataModifier<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	): Promise<boolean> {
		return (
			(await this.has(key, settings)) &&
			(await this.set(key, await callback((await this.get(key, settings))!, key, this)))
		)
	}
	public async modify_all<T>(keys: string[], callback: DataModifier<T>, settings = DEFAULT_REQUEST_SETTINGS) {
		let result = true
		for (const key of keys) result &&= await this.modify(key, callback, settings)
		return result
	}
	public async modify_if<T>(
		key: string,
		callback: DataModifier<T>,
		predicate: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	) {
		return (await this.assert(key, predicate, settings)) && (await this.modify(key, callback, settings))
	}
	public async modify_all_if<T>(
		keys: string[],
		callback: DataModifier<T>,
		predicate: DataPredicate<T>,
		settings = DEFAULT_REQUEST_SETTINGS
	) {
		let result = true
		for (const key of keys) result &&= await this.modify_if(key, callback, predicate, settings)
		return result
	}
}

/** Cache-based storage class */
export class CacheStorage extends SyncStorage {
	private readonly __storage = new Map<string, unknown>()

	public pairs<T>(dir: string, settings = DEFAULT_REQUEST_SETTINGS): [string, T][] {
		if (settings.ignore_cache || settings.deny_read) return []
		return [...this.__storage.entries()].filter(([k, _]) => k.startsWith(dir)).map(([k, v]) => [k, v as T])
	}
	public has(key: string, settings = DEFAULT_REQUEST_SETTINGS) {
		if (settings.ignore_cache) return false
		return this.__storage.has(key)
	}
	public get<T = unknown>(key: string, settings = DEFAULT_REQUEST_SETTINGS) {
		if (settings.ignore_cache || settings.deny_read) return
		return this.__storage.get(key) as T
	}
	public set<T = unknown>(key: string, data: T, settings = DEFAULT_REQUEST_SETTINGS) {
		if (settings.ignore_cache || settings.deny_write) return false
		return this.__storage.set(key, data).get(key) === data
	}
	public del(key: string, settings = DEFAULT_REQUEST_SETTINGS) {
		if (settings.ignore_cache || settings.deny_write) return false
		return this.__storage.delete(key)
	}
}

/** File system-based storage class */
export class FileStorage extends AsyncStorage {
	public async pairs<T = unknown>(dir: string, settings = DEFAULT_REQUEST_SETTINGS) {
		if (settings.ignore_files || settings.deny_read) return []
		const path = __into_dir_path(dir, DEFAULT_DATA_ROOT)
		const result = await autoCatch(FS.readdir(path, { withFileTypes: true }))
		if (!result.success) return []

		const output: [string, T][] = []

		for (const dirent of result.content) {
			if (!dirent.isFile()) continue
			const key = `${path}${dirent.name}`
			const val = (await this.get<T>(key, settings))!

			output.push([key, val])
		}

		return output
	}
	public async has(key: string, settings = DEFAULT_REQUEST_SETTINGS) {
		if (settings.ignore_files || settings.deny_read) return false
		const path = __into_file_path(key, settings.data_type)
		return (await autoCatch(FS.readFile(path))).success!
	}
	public async get<T = unknown>(key: string, settings = DEFAULT_REQUEST_SETTINGS) {
		if (settings.ignore_files || settings.deny_read) return
		const path = __into_file_path(key, settings.data_type)
		const result = await autoCatch(FS.readFile(path, "utf8"))

		if (!result.success) return
		return settings.data_type === "json" ? (JSON.parse(result.content) as T) : (result.content as unknown as T)
	}
	public async set<T = unknown>(key: string, data: T, settings = DEFAULT_REQUEST_SETTINGS) {
		if (settings.ignore_files || settings.deny_write) return false
		const path = __into_file_path(key, settings.data_type)
		const raw = settings.data_type === "json" ? JSON.stringify(data, null, "\t") : `${data}`

		await autoCatch(FS.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true }))
		return (await autoCatch(FS.writeFile(path, raw, "utf8"))).success
	}
	public async del(key: string, settings = DEFAULT_REQUEST_SETTINGS) {
		if (settings.ignore_files || settings.deny_write) return false
		const path = __into_file_path(key, settings.data_type)
		return (await autoCatch(FS.rm(path))).success
	}
}

/** Storage class that contains both a cache and a file storage instance */
export class DualStorage extends AsyncStorage {
	private readonly __cache = new CacheStorage()
	private readonly __files = new FileStorage()

	public async pairs<T = unknown>(dir: string, settings = DEFAULT_REQUEST_SETTINGS) {
		return [...new Set([...this.__cache.pairs<T>(dir, settings), ...(await this.__files.pairs<T>(dir, settings))])]
	}
	public async has(key: string, settings = DEFAULT_REQUEST_SETTINGS) {
		return this.__cache.has(key, settings) || (await this.__files.has(key, settings))
	}
	public async get<T = unknown>(key: string, settings = DEFAULT_REQUEST_SETTINGS) {
		const cache = this.__cache.get<T>(key, settings)
		const files = cache === undefined ? await this.__files.get<T>(key, settings) : undefined
		if (cache === undefined && files !== undefined) this.__cache.set<T>(key, files, settings)
		return (cache ?? files) as T | undefined
	}
	public async set<T = unknown>(key: string, data: T, settings = DEFAULT_REQUEST_SETTINGS) {
		const cache = this.__cache.set(key, data, settings) || (settings.ignore_cache ?? false)
		const files = (await this.__files.set(key, data, settings)) || (settings.ignore_files ?? false)
		return cache && files
	}
	public async del(key: string, settings = DEFAULT_REQUEST_SETTINGS) {
		const cache = this.__cache.del(key, settings) || (settings.ignore_cache ?? false)
		const files = (await this.__files.del(key, settings)) || (settings.ignore_files ?? false)
		return cache && files
	}
}
