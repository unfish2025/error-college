import { ErrorCollege } from '../src/index.js'

const errorCollege = new ErrorCollege({
	instanceId: 'test-instance',
	storageType: 'memory',
	hijackConsoleError: true
})
// @ts-ignore
window.errorCollege = errorCollege
// @ts-ignore
window.say = async function () {
	throw new Error('Test say error')
}

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

async function output() {
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
}
await output()

// @ts-ignore
window.output = output
setTimeout(() => {
	// @ts-ignore
	window.say()
})
