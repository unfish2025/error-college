import type { ErrorItem, StorageType, Options } from './types/index.js'
import { idbAdd, idbGetAll, idbClear, idbClearExpired } from './createIndxDB.js'
export type * from './types/index.js'

const storageTypeEnum: Record<StorageType, StorageType> = {
	memory: 'memory',
	localStorage: 'localStorage',
	indexedDB: 'indexedDB'
}

export class ErrorCollege<T extends StorageType = StorageType> {
	private _instanceId: string
	private _expireTime: number = 2 * 24 * 60 * 60 * 1000
	private _storageType: T
	private _onError?: (self: ErrorCollege, error: ErrorEvent | PromiseRejectionEvent | any, meta?: any) => void
	private _errorList: ErrorItem[] = []
	private _plugins: ((error: any, meta?: any) => [error: any, meta?: any] | null | void)[] = []
	private _logError = console.error

	get instanceId() {
		return this._instanceId
	}

	get expireTime() {
		return this._expireTime
	}

	get storageType() {
		return this._storageType
	}

	get onError() {
		return this._onError
	}

	// Overloads for getAll: conditional sync/async based on T
	getAll(this: ErrorCollege<'indexedDB'>): Promise<ErrorItem[]>
	getAll(this: ErrorCollege<'memory' | 'localStorage'>): ErrorItem[]
	getAll(this: ErrorCollege<StorageType>): Promise<ErrorItem[]> | ErrorItem[]
	getAll(this: ErrorCollege<StorageType>) {
		if (this.storageType === 'memory') {
			return this._errorList.slice()
		} else if (this.storageType === 'localStorage') {
			const data = localStorage.getItem(`__ErrorCollege_${this.instanceId}`)
			return data ? JSON.parse(data) : []
		} else {
			return idbGetAll(this.instanceId)
		}
	}

	constructor(op: Options<T>) {
		if (!(typeof op === 'object' && op !== null)) {
			throw new Error('Options must be an object')
		}
		if (typeof op.instanceId !== 'string') {
			throw new Error('instanceId must be a string')
		}
		if (!storageTypeEnum[op.storageType]) {
			throw new Error(`storageType must be one of ${Object.keys(storageTypeEnum).join(', ')}`)
		}
		if (op.onError !== void 0 && typeof op.onError !== 'function') {
			throw new Error('onError must be a function')
		}
		if (op.expireTime !== void 0 && (Number.isNaN(op.expireTime) || op.expireTime <= 0)) {
			throw new Error('expireTime must be a positive number')
		}

		this._instanceId = op.instanceId
		this._storageType = op.storageType
		this._onError = op.onError
		if (op.expireTime) this._expireTime = op.expireTime
		window.addEventListener('error', async (e) => {
			await this.add(e)
			this._onError?.(this, e, { from: 'window.error' })
		})
		window.addEventListener('unhandledrejection', async (e) => {
			await this.add(e)
			this._onError?.(this, e, { from: 'window.unhandledrejection' })
		})
		this.clearExpired()
		if (op.hijackConsoleError) {
			console.error = (...args: any[]) => {
				this._logError(...args)
				this.add(args, { from: 'console.error' })
			}
		}
	}

	use(plugin: (error: any, meta?: any) => [error: any, meta?: any] | null | void) {
		if (typeof plugin !== 'function') {
			throw new Error('plugin must be a function')
		}
		this._plugins.push(plugin)
		return this
	}

	// Overloads for add: chain in sync backends, Promise chain in indexedDB
	add(this: ErrorCollege<'indexedDB'>, error: any, meta?: any): Promise<this>
	add(this: ErrorCollege<'memory' | 'localStorage'>, error: any, meta?: any): this
	add(this: ErrorCollege<StorageType>, error: any, meta?: any): Promise<this> | this
	add(this: ErrorCollege<StorageType>, error: any, meta?: any): any {
		let data = [error, meta]
		for (const plugin of this._plugins) {
			const newData = plugin(data[0], data[1])
			if (newData === null || newData === void 0) {
				return this.storageType === 'indexedDB' ? Promise.resolve(this) : this
			}
			if (Array.isArray(newData)) {
				data = newData
			} else {
				data = [newData]
			}
		}
		if (this._storageType === 'memory') {
			this._errorList.push(this.dataToInfo(data[0], data[1]))
		} else if (this.storageType === 'localStorage') {
			const key = `__ErrorCollege_${this.instanceId}`
			const prev = localStorage.getItem(key)
			const list: ErrorItem[] = prev ? JSON.parse(prev) : []
			localStorage.setItem(key, JSON.stringify([...list, this.dataToInfo(data[0], data[1])]))
		} else {
			return idbAdd(this.instanceId, this.dataToInfo(data[0], data[1])).then(() => this)
		}
		return this
	}

	dataToInfo(error: any, meta?: any): [string, string, string] {
		return [this._dataToString(error), this._dataToString(meta), new Date().toISOString()]
	}

	clear() {
		if (this.storageType === 'memory') {
			this._errorList = []
		} else if (this.storageType === 'localStorage') {
			localStorage.removeItem(`__ErrorCollege_${this.instanceId}`)
		} else {
			return idbClear(this.instanceId)
		}
	}

	clearExpired() {
		const expire = this._expireTime
		if (this.storageType === 'memory') {
			const now = Date.now()
			this._errorList = this._errorList.filter(([, , t]) => {
				const ts = Date.parse(t ?? '')
				return Number.isNaN(ts) ? true : now - ts <= expire
			})
		} else if (this.storageType === 'localStorage') {
			const list = this.getAll() as ErrorItem[]
			const now = Date.now()
			const filtered = list.filter(([, , t]) => {
				const ts = Date.parse(t ?? '')
				return Number.isNaN(ts) ? true : now - ts <= expire
			})
			localStorage.setItem(`__ErrorCollege_${this.instanceId}`, JSON.stringify(filtered))
		} else {
			return idbClearExpired(this.instanceId, expire)
		}
	}

	private _dataToString(data: any): string {
		const weakSet = new WeakSet()
		const handle = (data: any, deep = true): string => {
			// deep is false, return a shallow description
			if (!deep) {
				if (Array.isArray(data)) {
					return `[Array(${data.length})]`
				}
				if (typeof data === 'object' && data !== null) {
					const keys = Object.keys(data)
					const ctor = (data as any)?.constructor?.name || 'Object'
					return `{${ctor} keys:${keys.join(',')}}`
				}
				return String(data)
			}

			if (weakSet.has(data)) {
				return `CircularReference(${handle(data, false)})`
			}
			if (Array.isArray(data)) {
				weakSet.add(data)
				let res = '['
				for (const it of data) {
					res += handle(it) + ','
				}
				return res.slice(0, -1) + ']'
			} else if (typeof data === 'object' && data !== null) {
				weakSet.add(data)
				if (data instanceof Date) {
					return `Date(${data.toISOString()})`
				} else if (data instanceof RegExp) {
					return `RegExp(${data.source})`
				} else if (data instanceof Map) {
					let res = 'Map {'
					for (const [k, v] of data) {
						res += `${handle(k)} => ${handle(v)},`
					}
					return res.slice(0, -1) + '}'
				} else if (data instanceof Set) {
					let res = 'Set {'
					for (const v of data) {
						res += `${handle(v)},`
					}
					return res.slice(0, -1) + '}'
				} else if (data instanceof ArrayBuffer) {
					return `ArrayBuffer(${data.byteLength})`
				} else if (ArrayBuffer.isView(data)) {
					return `${data.constructor.name}(${data.byteLength})`
				} else if (data instanceof Error) {
					// Special handling for Error objects to include name, message, and stack
					return `Error({name:${handle(data.name)},message:${handle(data.message)},stack:${handle(data.stack)}${
						data.cause ? ',cause:' + handle((data as any).cause) : ''
					}${Object.keys(data) ? ',' + Object.entries(data).map(([k, v]) => `${k}: ${handle(v)}`) : ''}})`
				}
				let res = '{'
				const keys = Object.keys(data)
				for (const key of keys) {
					res += `${key}:${handle((data as any)[key])},`
				}
				return res.slice(0, -1) + '}'
			} else if (typeof data === 'string') {
				return `"${data}"`
			} else if (typeof data === 'function') {
				if (/^[A-Z]/.test(data.name)) {
					return `Class(${data.name})`
				}
				return `Function(${data.name})`
			} else if (typeof data === 'bigint') {
				return `${data.toString()}n`
			} else {
				return String(data)
			}
		}
		return handle(data)
	}

	static format(
		errorList: ErrorItem[],
		options?: {
			indent?: number | string
			newline?: '\\n' | '\\r\\n'
			colonSpace?: boolean
		}
	): string {
		const indentUnit =
			typeof options?.indent === 'number'
				? ' '.repeat(Math.max(0, options!.indent as number))
				: typeof options?.indent === 'string'
				? (options!.indent as string)
				: '  '
		const newlineChar = options?.newline ?? '\n'
		const colonSpace = options?.colonSpace ?? true

		// join the Error Item list as a string: each item alone in one row, containing error and meta
		const rows = errorList.map(
			([err, meta, createTime], idx) =>
				`#${idx + 1} ${createTime}:${colonSpace ? ' ' : ''}${err}  \n\nmeta:${
					colonSpace ? ' ' : ''
				}${meta}\n================================================================`
		)
		const raw = rows.join(newlineChar)

		// add line break/indentation to sign {} [], but retain literal in string
		let indent = 0
		let out = ''
		let i = 0
		let inString: false | '"' | "'" | '`' = false
		let escaped = false

		const newline = () => {
			out += newlineChar + indentUnit.repeat(indent)
		}

		while (i < raw.length) {
			const ch = raw[i]

			// handle string context and escaped characters
			if (inString) {
				out += ch
				if (escaped) {
					escaped = false
				} else if (ch === '\\') {
					escaped = true
				} else if (ch === inString) {
					inString = false
				}
				i++
				continue
			} else {
				if (ch === '"' || ch === "'" || ch === '`') {
					inString = ch as '"' | "'" | '`'
					out += ch
					i++
					continue
				}
			}

			// Handle brackets and commas in non-string context
			if (ch === '{' || ch === '[') {
				out += ch
				indent++
				newline()
				i++
				continue
			}
			if (ch === '}' || ch === ']') {
				indent = Math.max(0, indent - 1)
				// Remove trailing whitespace
				out = out.replace(/[ \t]*$/, '')
				newline()
				out += ch
				i++
				continue
			}
			if (ch === ',') {
				out += ch
				newline()
				i++
				continue
			}

			// Add space after colon (non-string context), only when enabled
			if (ch === ':' && colonSpace && !(raw[i - 1].match(/\d/) && raw[i + 1]?.match(/\d/))) {
				out += ': '
				// Skip any existing spaces to avoid duplication
				let j = i + 1
				while (raw[j] === ' ') j++
				i = j
				continue
			}

			// default string
			out += ch
			i++
		}

		return out
	}

	// Overloads for instance format
	format(
		this: ErrorCollege<'indexedDB'>,
		options?: { indent?: number | string; newline?: '\\n' | '\\r\\n'; colonSpace?: boolean }
	): Promise<string>
	format(
		this: ErrorCollege<'memory' | 'localStorage'>,
		options?: { indent?: number | string; newline?: '\\n' | '\\r\\n'; colonSpace?: boolean }
	): string
	format(
		this: ErrorCollege<StorageType>,
		options?: { indent?: number | string; newline?: '\\n' | '\\r\\n'; colonSpace?: boolean }
	): Promise<string> | string {
		const list = this.getAll() as any
		if (this.storageType === 'indexedDB') {
			return (async () => ErrorCollege.format((await list) as ErrorItem[], options))()
		} else {
			return ErrorCollege.format(list as ErrorItem[], options)
		}
	}
}
