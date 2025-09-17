import { ErrorCollege } from '../src/index.js'
import { describe, it, expect } from 'vitest'

describe('localStorage Storage', () => {
	it('should add and retrieve errors correctly', async () => {
		const errorCollege1 = new ErrorCollege({
			instanceId: 'test-localStorage',
			storageType: 'localStorage'
		})
		errorCollege1.add({ a: 1 }, 'Test meta 1')
		const errors = errorCollege1.getAll()
		expect(errors).toHaveLength(1)
		expect({ error: errors[0].error, meta: errors[0].meta }).toEqual({
			error: '{a:1}',
			meta: '"Test meta 1"'
		})
		expect(errors[0].createTime).toBeDefined()
		expect(errors[0].stack).toBeDefined()

		const errorCollege2 = new ErrorCollege({
			instanceId: 'test-localStorage',
			storageType: 'localStorage',
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})

		errorCollege2.add({ a: 2 }, 'Test meta 2')
		expect(errorCollege1.getAll()).toHaveLength(2)

		errorCollege1.clear()
		expect(errorCollege1.getAll()).toHaveLength(0)
	})

	it('should clearExpired correctly', async () => {
		const errorCollege = new ErrorCollege({
			instanceId: 'test-localStorage-expire',
			storageType: 'localStorage',
			expireTime: 1000, // 1 second
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})
		errorCollege.add({ a: 1 }, 'Test meta 1')
		expect(errorCollege.getAll()).toHaveLength(1)
		await new Promise((resolve) => setTimeout(resolve, 1100))
		errorCollege.clearExpired()
		expect(errorCollege.getAll()).toHaveLength(0)
	})

	it('should auto clearExpired on init', async () => {
		const errorCollege1 = new ErrorCollege({
			instanceId: 'test-localStorage-auto-expire',
			storageType: 'localStorage',
			expireTime: 1000, // 1 second
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})
		errorCollege1.add({ a: 1 }, 'Test meta 1')
		expect(errorCollege1.getAll()).toHaveLength(1)
		await new Promise((resolve) => setTimeout(resolve, 1100))
		const errorCollege2 = new ErrorCollege({
			instanceId: 'test-localStorage-auto-expire',
			storageType: 'localStorage',
			expireTime: 1000, // 1 second
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})
		expect(errorCollege2.getAll()).toHaveLength(0)
	})

	it('should hijack console.error correctly', async () => {
		const errorCollege = new ErrorCollege({
			instanceId: 'test-localStorage-hijack',
			storageType: 'localStorage',
			listenWindowError: false,
			listenWindowUnhandledRejection: false,
			hijackConsoleError: true
		})
		console.error('Test console error 1')
		const errors = errorCollege.getAll()
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
			instanceId: 'test-localStorage-plugins',
			storageType: 'localStorage',
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})

		errorCollege1.use((_self, _error, _meta) => {
			return null
		})

		errorCollege1.add({ a: 1 }, 'Test meta 1')
		const errors = errorCollege1.getAll()
		expect(errors).toHaveLength(0)

		const errorCollege2 = new ErrorCollege({
			instanceId: 'test-localStorage-plugins-2',
			storageType: 'localStorage',
			listenWindowError: false,
			listenWindowUnhandledRejection: false
		})

		errorCollege2.use((_self, error, meta) => {
			return [error, meta]
		})

		errorCollege2.add({ a: 1 }, 'Test meta 1')
		const errors2 = errorCollege2.getAll()
		expect(errors2).toHaveLength(1)
	})

	it('should onError callback correctly', async () => {
		let flag = false
		const errorCollege = new ErrorCollege({
			instanceId: 'test-localStorage-onError',
			storageType: 'localStorage',
			onError: (self, error, meta) => {
				expect(self).toBe(errorCollege)
				expect(error).toEqual({ a: 1 })
				expect(meta).toEqual('Test meta 1')
				flag = true
			}
		})
		errorCollege.add({ a: 1 }, 'Test meta 1')
		expect(flag).toBe(true)
	})
})
