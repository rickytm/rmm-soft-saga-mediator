export interface ResponseError<T> {
	data: T;
	status: number;
	statusText: string;
}

// Normalized error shape used across the app instead of raw AxiosError
export class CustomResponseError implements ResponseError<any> {
	data: any;
	status: number;
	statusText: string;

	constructor(data: any, status: number, statusText: string) {
		this.data = data;
		this.status = status;
		this.statusText = statusText;
	}
}

function getCustomError(error: unknown): string | undefined {
	console.error('Error received:', error);
	let errorMessage: string | undefined;
	if (error instanceof CustomResponseError) {
		const { data } = error;
		if (data && typeof data === 'string') {
			errorMessage = data;
		} else if (data && data.message) {
			errorMessage = data.message;
		} else if (data && data instanceof Object && !Array.isArray(data)) {
			errorMessage = JSON.stringify(data);
		} else if (data && Array.isArray(data)) {
			errorMessage = data.map((err) => err.description).join(' ');
		} else {
			errorMessage = 'Something went wrong. Please try again later.';
		}
	}

	return errorMessage;
}

function isErrorWithMessage(error: unknown): error is Error & { message: string } {
	return (
		typeof error === 'object' && error !== null && 'message' in error && typeof (error as Error).message === 'string'
	);
}

function toErrorWithMessage(maybeError: unknown): Error {
	if (isErrorWithMessage(maybeError)) return maybeError;

	try {
		return new Error(JSON.stringify(maybeError));
	} catch {
		// Fallback in case there's an error stringifying the maybeError
		// like with circular references for example.
		return new Error(String(maybeError));
	}
}

export default function getErrorMessage(error: unknown): string {
	const errorMessage = getCustomError(error);

	return errorMessage ?? toErrorWithMessage(error).message;
}
