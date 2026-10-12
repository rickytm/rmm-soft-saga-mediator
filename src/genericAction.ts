import { createAction } from '@reduxjs/toolkit';
import type { AsyncActions } from './types';
/**
 * Creates a set of asynchronous actions (`pending`, `fulfilled`, `rejected`) for handling asynchronous operations in Redux.
 * The actions include a `meta.arg` field that reflects the original argument passed to `pending` (or `undefined` if none provided).
 *
 * @typeParam S - The type of the payload for the `fulfilled` action (e.g., `ApiResponse<OrderDto>`).
 * @param prefix - The prefix for the action types (e.g., 'ORDER_GET_BY_ORDER_NUMBER').
 *                 Concatenated with '_PENDING', '_FULFILLED', or '_REJECTED' to form the full action types.
 * @returns An object containing the `pending`, `fulfilled`, and `rejected` actions.
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
 *
 * // Define an action for fetching dashboard info (no pending payload)
 * const getDashboardInfo = createAsyncActions<ApiResponse<DashboardInfo>>('DASHBOARD_GET_INFO');
 *
 * // Dispatch pending action without arguments
 * dispatch(getDashboardInfo.pending());
 * // Generated action: { type: 'DASHBOARD_GET_INFO_PENDING', payload: undefined, meta: { arg: undefined } }
 *
 * // Define an action for fetching an order by number
 * const getOrderByOrderNumber = createAsyncActions<ApiResponse<OrderDto>>('ORDER_GET_BY_ORDER_NUMBER');
 *
 * // Dispatch pending action with a string
 * dispatch(getOrderByOrderNumber.pending('12345'));
 * // Generated action: { type: 'ORDER_GET_BY_ORDER_NUMBER_PENDING', payload: '12345', meta: { arg: '12345' } }
 *
 * // Dispatch fulfilled action (typically from a saga)
 * dispatch(getOrderByOrderNumber.fulfilled({ data: { id: '1', orderNumber: '12345' } }));
 * // Generated action: { type: 'ORDER_GET_BY_ORDER_NUMBER_FULFILLED', payload: { data: { id: '1', orderNumber: '12345' } }, meta: { arg: undefined } }
 * ```
 */
const createAsyncActions = <S = any>(prefix: string): AsyncActions<S> => {
	return {
		pending: createAction(
			`${prefix}_PENDING`,
			(arg?: any): { payload: any | undefined; meta: { arg: any | undefined } } => ({
				payload: arg,
				meta: { arg },
			}),
		),
		fulfilled: createAction(`${prefix}_FULFILLED`, (arg: S): { payload: S; meta: { arg: any | undefined } } => ({
			payload: arg,
			meta: { arg: undefined },
		})),
		rejected: createAction(
			`${prefix}_REJECTED`,
			(arg: string): { payload: string; error: true; meta: { arg: any | undefined } } => ({
				payload: arg,
				error: true,
				meta: { arg: undefined },
			}),
		),
	};
};

export default createAsyncActions;
