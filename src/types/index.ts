export type StorageType = 'memory' | 'localStorage' | 'indexedDB'

export interface Options<T extends StorageType = StorageType> {
	instanceId: string
	/** unit: ms, default: 2 days */
	expireTime?: number
	storageType: T
	/** default: true */
	listenWindowError?: boolean
	/** default: true */
	listenWindowUnhandledRejection?: boolean
	/** the existence of listenWindowError or listenWindowUnhandledRejection is only valid. default: false */
	listenAssetError?: boolean
	onError?: (self: any, error: any, meta?: any) => void
	/** default: false */
	hijackConsoleError?: boolean
}

export type Plugin<Self> = (self: Self, error: any, meta?: any) => [any, any?] | null | void

export interface FormatOptions {
	indent?: number | string
	newline?: '\\n' | '\\r\\n'
	colonSpace?: boolean
}

export interface ErrorItemOptions {
	error: any
	meta?: string
	stack?: string
}
export interface ErrorItem {
	error: string
	meta: string
	createTime: string
	stack: string
}
