import type { ErrorItem } from './types/index.js'

const DB_PREFIX = '__ErrorCollege_'
const STORE_NAME = 'errors'
const DB_VERSION = 1

function openDB(instanceId: string): Promise<IDBDatabase> {
	const dbName = `${DB_PREFIX}${instanceId}`
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(dbName, DB_VERSION)
		req.onupgradeneeded = () => {
			const db = req.result
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { autoIncrement: true })
			}
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
		req.onblocked = () => reject(new Error('IndexedDB open blocked'))
	})
}

export async function idbAdd(instanceId: string, item: ErrorItem): Promise<IDBValidKey> {
	const db = await openDB(instanceId)
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		const store = tx.objectStore(STORE_NAME)
		const req = store.add(item as unknown as any)
		req.onsuccess = () => resolve(req.result as IDBValidKey)
		req.onerror = () => reject(req.error)
		tx.oncomplete = () => db.close()
		tx.onabort = () => db.close()
	})
}

export async function idbGetAll(instanceId: string): Promise<ErrorItem[]> {
	const db = await openDB(instanceId)
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readonly')
		const store = tx.objectStore(STORE_NAME)
		const req = store.getAll()
		req.onsuccess = () => resolve((req.result || []) as unknown as ErrorItem[])
		req.onerror = () => reject(req.error)
		tx.oncomplete = () => db.close()
		tx.onabort = () => db.close()
	})
}

export async function idbClear(instanceId: string): Promise<void> {
	const db = await openDB(instanceId)
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		const store = tx.objectStore(STORE_NAME)
		const req = store.clear()
		req.onsuccess = () => resolve()
		req.onerror = () => reject(req.error)
		tx.oncomplete = () => db.close()
		tx.onabort = () => db.close()
	})
}

export async function idbClearExpired(instanceId: string, expireMs: number): Promise<void> {
	const db = await openDB(instanceId)
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite')
		const store = tx.objectStore(STORE_NAME)
		const req = store.openCursor()
		const now = Date.now()
		req.onsuccess = () => {
			const cursor = req.result
			if (cursor) {
				const val = cursor.value as unknown as ErrorItem
				const t = Date.parse(val.createTime ?? '')
				if (!Number.isNaN(t) && now - t > expireMs) {
					const delReq = cursor.delete()
					delReq.onsuccess = () => cursor.continue()
					delReq.onerror = () => cursor.continue()
				} else {
					cursor.continue()
				}
			}
		}
		req.onerror = () => reject(req.error)
		tx.oncomplete = () => {
			db.close()
			resolve()
		}
		tx.onabort = () => {
			db.close()
			resolve()
		}
	})
}
