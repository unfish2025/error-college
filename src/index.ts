import type { ErrorItem, StorageType, Options, ErrorItemOptions, Plugin, FormatOptions } from './types/index.js'
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
	private _onError?: (self: ErrorCollege, error: any, meta?: any) => void
	private _errorList: ErrorItem[] = []
	private _plugins: Plugin<ErrorCollege>[] = []
	private _logError = console.error
	private _useCapture: boolean = false
	private _hijacked: boolean = false
	private _onWindowError?: (e: ErrorEvent) => void
	private _onUnhandledRejection?: (e: PromiseRejectionEvent) => void

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
		this._useCapture = !!op.listenAssetError
		if (op.listenWindowError || op.listenWindowError === void 0) {
			this._onWindowError = (e: ErrorEvent) => {
				Promise.resolve(this.add(e, { from: 'window.error' })).then(() => {
					this._onError?.(this, e, { from: 'window.error' })
				})
			}
			window.addEventListener('error', this._onWindowError, this._useCapture)
		}
		if (op.listenWindowUnhandledRejection || op.listenWindowUnhandledRejection === void 0) {
			this._onUnhandledRejection = (e: PromiseRejectionEvent) => {
				Promise.resolve(this.add(e, { from: 'window.unhandledrejection' })).then(() => {
					this._onError?.(this, e, { from: 'window.unhandledrejection' })
				})
			}
			window.addEventListener('unhandledrejection', this._onUnhandledRejection)
		}
		// @ts-ignore
		this.clearExpired()
		if (op.hijackConsoleError) {
			this._hijacked = true
			console.error = (...args: any[]) => {
				this._logError(...args)
				void this.add(args, { from: 'console.error' })
			}
		}
	}

	use(plugin: Plugin<ErrorCollege>) {
		if (typeof plugin !== 'function') {
			throw new Error('plugin must be a function')
		}
		this._plugins.push(plugin)
		return this
	}

	add(this: ErrorCollege<'indexedDB'>, error: any, meta?: any): Promise<this>
	add(this: ErrorCollege<'memory' | 'localStorage'>, error: any, meta?: any): this
	add(this: ErrorCollege<StorageType>, error: any, meta?: any): Promise<this> | this
	add(this: ErrorCollege<StorageType>, error: any, meta?: any): any {
		let data = [error, meta]
		for (const plugin of this._plugins) {
			const newData = plugin(this, data[0], data[1])
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
			this._errorList.push(this.dataToInfo({ error: data[0], meta: data[1], stack: new Error().stack || '' }))
		} else if (this.storageType === 'localStorage') {
			const key = `__ErrorCollege_${this.instanceId}`
			const prev = localStorage.getItem(key)
			const list: ErrorItem[] = prev ? JSON.parse(prev) : []
			localStorage.setItem(
				key,
				JSON.stringify([...list, this.dataToInfo({ error: data[0], meta: data[1], stack: new Error().stack || '' })])
			)
		} else {
			return idbAdd(
				this.instanceId,
				this.dataToInfo({ error: data[0], meta: data[1], stack: new Error().stack || '' })
			).then(() => {
				this._onError?.(this, data[0], data[1])
				return this
			})
		}
		this._onError?.(this, data[0], data[1])
		return this
	}

	dataToInfo(data: ErrorItemOptions): ErrorItem {
		return {
			error: this._dataToString(data.error),
			meta: this._dataToString(data.meta),
			createTime: new Date().toISOString(),
			stack: this._dataToString(data.stack ?? (new Error().stack || ''), false)
		}
	}

	clear(this: ErrorCollege<'indexedDB'>): Promise<void>
	clear(this: ErrorCollege<'memory' | 'localStorage'>): void
	clear() {
		if (this.storageType === 'memory') {
			this._errorList = []
		} else if (this.storageType === 'localStorage') {
			localStorage.removeItem(`__ErrorCollege_${this.instanceId}`)
		} else {
			return idbClear(this.instanceId)
		}
	}

	clearExpired(this: ErrorCollege<'indexedDB'>): Promise<void>
	clearExpired(this: ErrorCollege<'memory' | 'localStorage'>): void
	clearExpired() {
		const expire = this._expireTime
		if (this.storageType === 'memory') {
			const now = Date.now()
			this._errorList = this._errorList.filter((info) => {
				const ts = Date.parse(info.createTime ?? '')
				return Number.isNaN(ts) ? true : now - ts <= expire
			})
		} else if (this.storageType === 'localStorage') {
			const list = this.getAll() as ErrorItem[]
			const now = Date.now()
			const filtered = list.filter((info) => {
				const ts = Date.parse(info.createTime ?? '')
				return Number.isNaN(ts) ? true : now - ts <= expire
			})
			localStorage.setItem(`__ErrorCollege_${this.instanceId}`, JSON.stringify(filtered))
		} else {
			return idbClearExpired(this.instanceId, expire)
		}
	}

	private _dataToString(data: any, stringAddQuotationMarks = true): string {
		const weakSet = new WeakSet()
		const handle = (data: any, deep = true): string => {
			// deep is false, return a shallow description
			if (!deep) {
				if (Array.isArray(data)) {
					return `Array(length:${data.length})`
				}
				if (typeof data === 'object' && data !== null) {
					const keys = Object.keys(data)
					const ctor = (data as any)?.constructor?.name || 'Object'
					return `Object(${ctor ? `class:${ctor}` : ''} keys:${keys.join(',')})`
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
				} else if (data instanceof ErrorEvent) {
					return `ErrorEvent({type:${handle(data.type)},message:${handle(data.message)},filename:${handle(
						data.filename
					)},lineno:${handle(data.lineno)},colno:${handle(data.colno)},error:${handle(data.error)}})`
				} else if (data instanceof PromiseRejectionEvent) {
					return `PromiseRejectionEvent({type:${handle(data.type)},reason:${handle(data.reason)}})`
				}
				let res = '{'
				const keys = Object.keys(data)
				for (const key of keys) {
					res += `${key}:${handle((data as any)[key])},`
				}
				return res.slice(0, -1) + '}'
			} else if (typeof data === 'string') {
				if (stringAddQuotationMarks) {
					return `"${data}"`
				} else {
					return data
				}
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

	// Overloads for instance format
	format(this: ErrorCollege<'indexedDB'>, options?: FormatOptions): Promise<string>
	format(this: ErrorCollege<'memory' | 'localStorage'>, options?: FormatOptions): string
	format(this: ErrorCollege<StorageType>, options?: FormatOptions): Promise<string> | string {
		const list = this.getAll()
		if (this.storageType === 'indexedDB') {
			return (async () => ErrorCollege.format((await list) as ErrorItem[], options))()
		} else {
			return ErrorCollege.format(list as ErrorItem[], options)
		}
	}

	destroy() {
		if (this._onWindowError) {
			window.removeEventListener('error', this._onWindowError, this._useCapture)
			this._onWindowError = void 0
		}
		if (this._onUnhandledRejection) {
			window.removeEventListener('unhandledrejection', this._onUnhandledRejection)
			this._onUnhandledRejection = void 0
		}
		if (this._hijacked) {
			console.error = this._logError
			this._hijacked = false
		}
		return this
	}

	static format(errorList: ErrorItem[], options?: FormatOptions): string {
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
			(info, idx) =>
				`#${idx + 1} ${info.createTime}\n\nstack:${colonSpace ? ' ' : ''}${info.stack}\n\nerror:${
					colonSpace ? ' ' : ''
				}${info.error}  \n\nmeta:${colonSpace ? ' ' : ''}${
					info.meta
				}\n================================================================`
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

	static formatOne(errorItem: ErrorItem, options?: FormatOptions) {
		return ErrorCollege.format([errorItem], options)
	}
}
