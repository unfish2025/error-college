import { ErrorCollege } from '../src/main.js'

const errorCollege = new ErrorCollege({
	instanceId: 'test-instance',
	storageType: 'memory',
	expireTime: 2 * 1000
})

await errorCollege.add(new Error('Test error 1'), { info: 'meta1' })
await errorCollege.add(
	{
		str: '123',
		num: 456,
		bool: true,
		nil: null,
		arr: [1, 2, 3],
		obj: { a: 1, b: 2 },
		fn() {
			console.log('哈哈')
		},
		bigint: BigInt(12345678901234567890),
		symbol: Symbol('sym'),
		date: new Date(),
		regexp: /abc/gi,
		map: new Map([
			['key1', 'value1'],
			['key2', 'value2']
		]),
		set: new Set([1, 2, 3]),
		error: new Error('Inner error'),
		class: ErrorCollege
	},
	{ info: 'meta2' }
)

class CustomError extends Error {
	custom1 = '123'
	custom2 = 456
}
await errorCollege.add(new CustomError('Test CustomError'))

const container = document.querySelector('.container')
if (container) {
	const format = await errorCollege.format()
	container.innerHTML = '<pre>' + format + '</pre>'
	console.log(format)
} else {
	const container = document.createElement('div')
	container.className = 'container'
	const format = await errorCollege.format()
	container.innerHTML = '<pre>' + format + '</pre>'
	document.body.appendChild(container)
	console.log(format)
}

const list = await errorCollege.getAll()
console.log('All errors:', list.length)
