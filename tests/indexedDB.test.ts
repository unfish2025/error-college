import { ErrorCollege } from '../src/index.js'
import { describe, it, expect } from 'vitest'

describe('indexedDB Storage', () => {
	it('should add and retrieve errors correctly', async () => {
		const errorCollege1 = new ErrorCollege({
			instanceId: 'test-indexedDB',
			storageType: 'indexedDB'
		})
		await errorCollege1.add({ a: 1 }, 'Test meta 1')
		const errors = await errorCollege1.getAll()
		expect(errors).toHaveLength(1)
		expect({ error: errors[0].error, meta: errors[0].meta }).toEqual({
			error: '{a:1}',
			meta: '"Test meta 1"'
		})
		expect(errors[0].createTime).toBeDefined()
		expect(errors[0].stack).toBeDefined()

		const errorCollege2 = new ErrorCollege({
			instanceId: 'test-indexedDB',
			storageType: 'indexedDB',
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})

		await errorCollege2.add({ a: 2 }, 'Test meta 2')
		expect(await errorCollege1.getAll()).toHaveLength(2)

		await errorCollege1.clear()
		expect(await errorCollege1.getAll()).toHaveLength(0)
	})

	it('should clearExpired correctly', async () => {
		const errorCollege = new ErrorCollege({
			instanceId: 'test-indexedDB-expire',
			storageType: 'indexedDB',
			expireTime: 1000, // 1 second
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})
		await errorCollege.add({ a: 1 }, 'Test meta 1')
		expect(await errorCollege.getAll()).toHaveLength(1)
		await new Promise((resolve) => setTimeout(resolve, 1100))
		await errorCollege.clearExpired()
		expect(await errorCollege.getAll()).toHaveLength(0)
	})

	it('should auto clearExpired on init', async () => {
		const errorCollege1 = new ErrorCollege({
			instanceId: 'test-indexedDB-auto-expire',
			storageType: 'indexedDB',
			expireTime: 1000, // 1 second
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})
		await errorCollege1.add({ a: 1 }, 'Test meta 1')
		expect(await errorCollege1.getAll()).toHaveLength(1)
		await new Promise((resolve) => setTimeout(resolve, 1100))
		const errorCollege2 = new ErrorCollege({
			instanceId: 'test-indexedDB-auto-expire',
			storageType: 'indexedDB',
			expireTime: 1000, // 1 second
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})
		expect(await errorCollege2.getAll()).toHaveLength(0)
	})

	it('should hijack console.error correctly', async () => {
		const errorCollege = new ErrorCollege({
			instanceId: 'test-indexedDB-hijack',
			storageType: 'indexedDB',
			listenWindowError: false,
			listenWindowUnhandledRejection: false,
			hijackConsoleError: true
		})
		console.error('Test console error 1')
		const errors = await errorCollege.getAll()
		expect(errors).toHaveLength(1)
		expect({ error: errors[0].error, meta: errors[0].meta }).toEqual({
			error: '["Test console error 1"]',
			meta: '{from:"console.error"}'
		})
		expect(errors[0].createTime).toBeDefined()
		expect(errors[0].stack).toBeDefined()
	})

	it('should use plugins correctly', async () => {
		const errorCollege1 = new ErrorCollege({
			instanceId: 'test-indexedDB-plugins',
			storageType: 'indexedDB',
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})

		errorCollege1.use((_self, _error, _meta) => {
			return null
		})

		await errorCollege1.add({ a: 1 }, 'Test meta 1')
		const errors = await errorCollege1.getAll()
		expect(errors).toHaveLength(0)

		const errorCollege2 = new ErrorCollege({
			instanceId: 'test-indexedDB-plugins-2',
			storageType: 'indexedDB',
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})

		errorCollege2.use((_self, error, meta) => {
			return [error, meta]
		})

		await errorCollege2.add({ a: 1 }, 'Test meta 1')
		const errors2 = await errorCollege2.getAll()
		expect(errors2).toHaveLength(1)
	})

	it('should onError callback correctly', async () => {
		let flag = false
		const errorCollege = new ErrorCollege({
			instanceId: 'test-indexedDB-onError',
			storageType: 'indexedDB',
			onError: (self, error, meta) => {
				expect(self).toBe(errorCollege)
				expect(error).toEqual({ a: 1 })
				expect(meta).toEqual('Test meta 1')
				flag = true
			}
		})
		await errorCollege.add({ a: 1 }, 'Test meta 1')
		expect(flag).toBe(true)
	})
})
