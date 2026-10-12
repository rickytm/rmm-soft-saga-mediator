# @rmm-soft/saga-mediator

Lightweight mediator and saga helpers for Clean Architecture in React.

Removes the boilerplate of the `pending → use case → fulfilled / rejected` flow when you use **Redux Toolkit** + **redux-saga** with use cases resolved from an IoC container.

## Installation

```bash
npm install @rmm-soft/saga-mediator
```

Peer dependencies:

```bash
npm install @reduxjs/toolkit redux-saga
```

## How it works

1. A component dispatches `xxx.pending(arg)`.
2. A saga picks it up and executes a **use case** (`UseCaseInterface<T, P>`).
3. `executeUseCase` dispatches `xxx.fulfilled(result)` or `xxx.rejected(message)` for you.

Action types follow the convention `<PREFIX>_PENDING`, `<PREFIX>_FULFILLED` and `<PREFIX>_REJECTED`. The saga derives the fulfilled/rejected types from the pending one, so the pending type **must** end with `_PENDING`.

## Usage

### 1. Define a use case

```typescript
import type { UseCaseInterface } from '@rmm-soft/saga-mediator';

interface OrderDto {
	id: string;
	orderNumber: string;
}

interface ApiResponse<T> {
	data: T;
}

export class GetOrderByOrderNumberUseCase implements UseCaseInterface<ApiResponse<OrderDto>, string> {
	async execute(orderNumber: string): Promise<ApiResponse<OrderDto>> {
		// call your repository / API here
	}
}
```

### 2. Create the async actions

```typescript
import { createAsyncActions } from '@rmm-soft/saga-mediator';

export const getOrderByOrderNumber = createAsyncActions<ApiResponse<OrderDto>>('ORDER_GET_BY_ORDER_NUMBER');

dispatch(getOrderByOrderNumber.pending('12345'));
// { type: 'ORDER_GET_BY_ORDER_NUMBER_PENDING', payload: '12345', meta: { arg: '12345' } }
```

### 3. Run it from a saga with `executeUseCase`

```typescript
import { takeLatest } from 'redux-saga/effects';
import { executeUseCase, type AsyncAction } from '@rmm-soft/saga-mediator';

function* fetchOrderByOrderNumber(action: AsyncAction<string>) {
	yield executeUseCase(getOrderByOrderNumberUseCase, action.payload, action, {
		successCallback: (result) => console.log('Order fetched:', result.data.orderNumber),
		rejectCallback: (error) => console.log('Error fetching order:', error),
	});
}

export default function* orderSaga() {
	yield takeLatest(getOrderByOrderNumber.pending.type, fetchOrderByOrderNumber);
}
```

#### Options

| Option                | Type                  | Description                                      |
| --------------------- | --------------------- | ------------------------------------------------ |
| `skipSuccessDispatch` | `boolean`             | Do not dispatch the `fulfilled` action.          |
| `skipErrorDispatch`   | `boolean`             | Do not dispatch the `rejected` action.           |
| `successCallback`     | `(response: T) => void` | Called with the result when the use case succeeds. |
| `rejectCallback`      | `(error: any) => void`  | Called with the error when the use case fails.     |

### 4. Skip the boilerplate with `createWatcher`

For use cases whose saga only executes the use case, bind your IoC container once and generate watchers directly:

```typescript
// src/application/redux/utils/sagaUtils.ts
import { container } from 'tsyringe';
import { createWatcher as baseCreateWatcher } from '@rmm-soft/saga-mediator';

export const createWatcher = baseCreateWatcher(container);
```

```typescript
import { all, takeLatest } from 'redux-saga/effects';
import { createWatcher } from '../utils/sagaUtils';
import * as useCase from '@/domain/use-cases/warehouse';
import { warehouseActions } from '../reducers/warehouseReducer';

export default function* warehouseSaga() {
	yield all([
		takeLatest(warehouseActions.createWarehouse.pending.type, createWatcher(useCase.CreateWarehouseUseCase)),
		takeLatest(warehouseActions.deleteWarehouse.pending.type, createWatcher(useCase.DeleteWarehouseUseCase)),
		// Use cases with extra logic keep their own explicit generator
		takeLatest(warehouseActions.getProductsByWarehouse.pending.type, getProductsByWarehouse),
	]);
}
```

The container only needs to satisfy `IoCContainer` (`resolve(target)`), so it works with tsyringe, InversifyJS adapters, or your own implementation.

## API

| Export                            | Description                                                                                  |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| `createAsyncActions<S>(prefix)`   | Returns `{ pending, fulfilled, rejected }` action creators for the given prefix.            |
| `executeUseCase(useCase, params, action, options?)` | Saga that executes a use case and dispatches `fulfilled` / `rejected`.   |
| `createWatcher(container)`        | Binds an IoC container and returns a factory that builds saga watchers from use case classes. |
| `dispatchSuccess(type, payload)`  | Saga helper that dispatches the `fulfilled` action for a `_PENDING` type.                    |
| `dispatchError(type, payload)`    | Saga helper that dispatches the `rejected` action for a `_PENDING` type.                     |
| `CustomResponseError`             | Normalized error class (`data`, `status`, `statusText`) recognized by the error handling.    |
| `getErrorMessage(error)`          | Converts any thrown value into a message string; same logic `executeUseCase` uses.          |

### Types

`UseCaseInterface<T, P>`, `UseCaseOptions<T>`, `AsyncAction<P>`, `AsyncActions<S>`, `IoCContainer`.

## Error handling

When a use case throws, the error is converted to a message string and used as the payload of the `rejected` action.

Instances of `CustomResponseError` (a normalized error with `data`, `status` and `statusText`, useful to wrap HTTP errors) are resolved in this order: string `data`, `data.message`, serialized object `data`, array `data` mapped by `description`. Any other error falls back to its `message`.

```typescript
import { CustomResponseError } from '@rmm-soft/saga-mediator';

throw new CustomResponseError({ message: 'Order not found' }, 404, 'Not Found');
// rejected payload: 'Order not found'
```

You can also use the same conversion outside sagas:

```typescript
import { getErrorMessage } from '@rmm-soft/saga-mediator';

try {
	await api.get('/orders');
} catch (error) {
	const message = getErrorMessage(error);
}
```

## License

MIT
