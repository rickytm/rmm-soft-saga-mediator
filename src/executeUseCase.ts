import { CallEffect, PutEffect, call, put } from 'redux-saga/effects';
import { AsyncAction, IoCContainer, UseCaseInterface, UseCaseOptions } from './types';
import getErrorMessage from './common/errorMessage';

/**
 * Generic saga function to execute a use case and handle its result or error.
 * Dispatches Redux actions (`fulfilled` or `rejected`) based on the outcome and invokes optional callbacks.
 *
 * @typeParam T - The return type of the use case (e.g., `ApiResponse<OrderDto>`).
 * @typeParam P - The parameter type of the use case (e.g., `string` or `undefined`).
 * @param useCase - The use case instance to execute.
 * @param params - The parameters to pass to the use case.
 * @param action - The Redux action that triggered this execution (must include `type` and optional `meta`).
 * @param options - Optional settings to control dispatch behavior and callbacks.
 * @returns The result of the use case or `void` if an error occurs.
 *
 * @example
 * ```typescript
 * interface OrderDto {
 *   id: string;
 *   orderNumber: string;
 * }
 * interface ApiResponse<T> {
 *   data: T;
 * }
 * interface GetOrderByOrderNumberUseCase extends UseCaseInterface<ApiResponse<OrderDto>, string> {
 *   execute(orderNumber: string): Promise<ApiResponse<OrderDto>>;
 * }
 *
 * function* fetchOrderByOrderNumber(action: AsyncAction<string>) {
 *   const successCallback = (result: ApiResponse<OrderDto>) => {
 *     console.log('Order fetched:', result.data.orderNumber);
 *   };
 *   const rejectCallback = (error: any) => {
 *     console.log('Error fetching order:', error);
 *   };
 *   yield executeUseCase(getOrderByOrderNumberUseCase, action.payload, action, {
 *     successCallback,
 *     rejectCallback,
 *   });
 * }
 *
 * // For a use case with no parameters
 * interface GetDashboardInfoUseCase extends UseCaseInterface<ApiResponse<DashboardInfo>, undefined> {
 *   execute(params: undefined): Promise<ApiResponse<DashboardInfo>>;
 * }
 *
 * function* fetchDashboardInfo(action: AsyncAction<undefined>) {
 *   const successCallback = (result: ApiResponse<DashboardInfo>) => {
 *     console.log('Dashboard info:', result.data.totalOrders);
 *   };
 *   yield executeUseCase(getDashboardInfoUseCase, undefined, action, { successCallback });
 * }
 * ```
 */
function* executeUseCase<T, P>(
	useCase: UseCaseInterface<T, P>,
	params: P,
	action: AsyncAction<P>,
	options?: UseCaseOptions<T>,
): Generator<CallEffect | PutEffect, T | void, T> {
	const { type, meta } = action;

	try {
		// Execute the use case
		const result: T = yield call([useCase, useCase.execute], params);

		// Generate the fulfilled type from the pending type
		const fulfilledType = type.replace('_PENDING', '_FULFILLED');

		// Dispatch success callback if provided
		if (options?.successCallback) {
			options.successCallback(result);
		}

		// Dispatch the fulfilled action if not skipped
		if (!options?.skipSuccessDispatch) {
			yield put({
				type: fulfilledType,
				payload: result,
				meta,
			});
		}

		return result;
	} catch (error) {
		const errorMessage = getErrorMessage(error);
		const rejectedType = type.replace('_PENDING', '_REJECTED');

		console.error(`${rejectedType} error: ${errorMessage}`);

		// Call reject callback if provided
		if (options?.rejectCallback) {
			options.rejectCallback(error);
		}

		// Dispatch the rejected action if not skipped
		if (!options?.skipErrorDispatch) {
			yield put({
				type: rejectedType,
				payload: errorMessage,
				error: true,
			});
		}
	}
}

/**
 * Dispatches a Redux action with a rejected state.
 * @param action - The base action type (e.g., 'ORDER_GET_BY_ORDER_NUMBER_PENDING').
 * @param payload - The payload for the rejected action (typically an error message).
 * @returns A generator that yields a put effect for the rejected action.
 */
function* dispatchError(action: string, payload: any) {
	const rejectedType = action.replace('_PENDING', '_REJECTED');
	yield put({
		type: rejectedType,
		payload,
		error: true,
	});
}

/**
 * Dispatches a Redux action with a fulfilled state.
 * @param action - The base action type (e.g., 'ORDER_GET_BY_ORDER_NUMBER_PENDING').
 * @param payload - The payload for the fulfilled action.
 * @returns A generator that yields a put effect for the fulfilled action.
 */
function* dispatchSuccess(action: string, payload: any) {
	const fulfilledType = action.replace('_PENDING', '_FULFILLED');
	yield put({
		type: fulfilledType,
		payload,
	});
}

/**
 * Higher-order function that binds an IoC container instance to the saga watcher factory.
 * Run this once at your application's setup layer to generate your localized `createWatcher` helper.
 *
 * @param container - An object implementing the IoCContainer interface (e.g., TSyringe container).
 * @returns A localized `createWatcher` factory function tied to the provided container.
 *
 * @example
 * ```typescript
 * // src/application/redux/utils/sagaUtils.ts
 * import { container } from 'tsyringe';
 * import { createWatcher as baseCreateWatcher } from '@rmm-soft/saga-mediator';
 *
 * export const createWatcher = baseCreateWatcher(container);
 * ```
 */
function createWatcher(container: IoCContainer) {
	/**
	 * Creates a generic saga watcher for a use case, eliminating boilerplate for the common case
	 * of "resolve use case from container, execute it, dispatch based on result."
	 *
	 * Intended for use cases whose saga has no logic beyond executing the use case and letting
	 * `executeUseCase` handle the pending/fulfilled/rejected dispatch. Use cases that require
	 * extra logic (e.g. guard clauses, conditional dispatch, multiple use case calls) should keep
	 * their own explicit generator function instead of using this helper.
	 *
	 * @typeParam T - The return type of the use case (e.g., `ApiResponse<WarehouseDto>`).
	 * @typeParam P - The parameter type of the use case (e.g., `WarehouseParams` or `undefined`).
	 * @param useCaseClass - The use case class (constructor), resolved from the DI container at
	 * runtime. Must implement `UseCaseInterface<T, P>`.
	 * @returns A saga generator function suitable for passing directly to `takeLatest`,
	 * `takeEvery`, or similar effect creators.
	 *
	 * @example
	 * ```typescript
	 * import { all, takeLatest } from 'redux-saga/effects';
	 * import { createWatcher } from '../utils/sagaUtils'; // Your localized helper
	 * import * as useCase from '@/domain/use-cases/warehouse';
	 * import { warehouseActions } from '../reducers/warehouseReducer';
	 *
	 * export default function* warehouseSaga() {
	 * 	yield all([
	 * 		takeLatest(warehouseActions.createWarehouse.pending.type, createWatcher(useCase.CreateWarehouseUseCase)),
	 * 		takeLatest(warehouseActions.deleteWarehouse.pending.type, createWatcher(useCase.DeleteWarehouseUseCase)),
	 * 		// Use cases with extra logic keep their own explicit generator:
	 * 		takeLatest(warehouseActions.getProductsByWarehouse.pending.type, getProductsByWarehouse),
	 * 	]);
	 * }
	 * ```
	 */
	return function <T, P>(useCaseClass: new (...args: any[]) => UseCaseInterface<T, P>) {
		return function* (action: AsyncAction<P>) {
			const useCaseInstance = container.resolve<UseCaseInterface<T, P>>(useCaseClass);
			yield executeUseCase(useCaseInstance, action.payload, action);
		};
	};
}

export { dispatchSuccess, dispatchError, executeUseCase, createWatcher };
export default executeUseCase;
