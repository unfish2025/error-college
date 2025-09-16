
export type StorageType = 'memory' | 'localStorage' | 'indexedDB'

export interface Options<T extends StorageType = StorageType> {
	instanceId: string
	/** unit: ms, default: 2 days */
	expireTime?: number
	storageType: T
	onError?: (
		self: any,
		error: ErrorEvent | PromiseRejectionEvent | string | any,
		meta?: any
	) => void
	/** default: false */
	hijackConsoleError?: boolean
}

/** [error, meta, createTime] */
export type ErrorItem = [string, string, string]
