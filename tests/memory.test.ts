import { ErrorCollege } from '../src/index.js'
import { describe, it, expect } from 'vitest'

describe('memory Storage', () => {
	it('should add and retrieve errors correctly', async () => {
		const errorCollege = new ErrorCollege({
			instanceId: 'test-memory',
			storageType: 'memory'
		})
		errorCollege.add({ a: 1 }, 'Test meta 1')
		const errors = errorCollege.getAll()
		expect(errors).toHaveLength(1)
		expect({ error: errors[0].error, meta: errors[0].meta }).toEqual({
			error: '{a:1}',
			meta: '"Test meta 1"'
		})
		expect(errors[0].createTime).toBeDefined()
		expect(errors[0].stack).toBeDefined()
		errorCollege.clear()
		expect(errorCollege.getAll()).toHaveLength(0)
	})

	it('should clearExpired correctly', async () => {
		const errorCollege = new ErrorCollege({
			instanceId: 'test-memory-expire',
			storageType: 'memory',
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

	it('should hijack console.error correctly', async () => {
		const errorCollege = new ErrorCollege({
			instanceId: 'test-memory-hijack',
			storageType: 'memory',
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
})
