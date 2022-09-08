/** Value that is returned from an `autoCatch` call */
export type Result<T> = Success<T> | Failure

/** Successful await from an `autoCatch` call */
export interface Success<T> {
	success: true
	content: T
}
/** Unsuccessful await from an `autoCatch` call */
export interface Failure {
	success: false
	reason: unknown
}

/**
 * Automatically awaits the provided promise and returns the result, or the error thrown by the await
 * @param promise Fallible promise
 */
export async function autoCatch<T>(promise: Promise<T>): Promise<Result<T>> {
	try {
		const content = await promise
		return { success: true, content }
	} catch (reason) {
		return { success: false, reason }
	}
}
