# PortfoliosApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createPortfolio**](PortfoliosApi.md#createportfoliooperation) | **POST** /v1/portfolios | Create a portfolio for the authenticated user. |
| [**createPosition**](PortfoliosApi.md#createpositionoperation) | **POST** /v1/portfolios/{portfolio_id}/positions | Add an instrument position to an owned portfolio. |
| [**deletePortfolio**](PortfoliosApi.md#deleteportfolio) | **DELETE** /v1/portfolios/{portfolio_id} | Delete an owned portfolio and its positions. |
| [**deletePosition**](PortfoliosApi.md#deleteposition) | **DELETE** /v1/portfolios/{portfolio_id}/positions/{position_id} | Remove a position from an owned portfolio. |
| [**getPortfolio**](PortfoliosApi.md#getportfolio) | **GET** /v1/portfolios/{portfolio_id} | Return one portfolio owned by the authenticated user. |
| [**listPortfolios**](PortfoliosApi.md#listportfolios) | **GET** /v1/portfolios | List portfolios owned by the authenticated user. |
| [**listPositions**](PortfoliosApi.md#listpositions) | **GET** /v1/portfolios/{portfolio_id}/positions | List positions in an owned portfolio. |
| [**updatePortfolio**](PortfoliosApi.md#updateportfoliooperation) | **PATCH** /v1/portfolios/{portfolio_id} | Update one owned portfolio. |
| [**updatePosition**](PortfoliosApi.md#updatepositionoperation) | **PATCH** /v1/portfolios/{portfolio_id}/positions/{position_id} | Update a position in an owned portfolio. |



## createPortfolio

> Portfolio createPortfolio(idempotencyKey, createPortfolioRequest)

Create a portfolio for the authenticated user.

### Example

```ts
import {
  Configuration,
  PortfoliosApi,
} from '';
import type { CreatePortfolioOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PortfoliosApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // CreatePortfolioRequest
    createPortfolioRequest: ...,
  } satisfies CreatePortfolioOperationRequest;

  try {
    const data = await api.createPortfolio(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **idempotencyKey** | `string` | Unique client-generated key. Reuse with a different payload returns &#x60;409&#x60;. | [Defaults to `undefined`] |
| **createPortfolioRequest** | [CreatePortfolioRequest](CreatePortfolioRequest.md) |  | |

### Return type

[**Portfolio**](Portfolio.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | The portfolio was created. |  * Location -  <br>  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |
| **422** | The request is syntactically valid but violates domain rules. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createPosition

> Position createPosition(idempotencyKey, portfolioId, createPositionRequest)

Add an instrument position to an owned portfolio.

### Example

```ts
import {
  Configuration,
  PortfoliosApi,
} from '';
import type { CreatePositionOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PortfoliosApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // string
    portfolioId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CreatePositionRequest
    createPositionRequest: ...,
  } satisfies CreatePositionOperationRequest;

  try {
    const data = await api.createPosition(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **idempotencyKey** | `string` | Unique client-generated key. Reuse with a different payload returns &#x60;409&#x60;. | [Defaults to `undefined`] |
| **portfolioId** | `string` |  | [Defaults to `undefined`] |
| **createPositionRequest** | [CreatePositionRequest](CreatePositionRequest.md) |  | |

### Return type

[**Position**](Position.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | The position was created. |  * Location -  <br>  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |
| **422** | The request is syntactically valid but violates domain rules. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deletePortfolio

> deletePortfolio(idempotencyKey, portfolioId)

Delete an owned portfolio and its positions.

### Example

```ts
import {
  Configuration,
  PortfoliosApi,
} from '';
import type { DeletePortfolioRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PortfoliosApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // string
    portfolioId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeletePortfolioRequest;

  try {
    const data = await api.deletePortfolio(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **idempotencyKey** | `string` | Unique client-generated key. Reuse with a different payload returns &#x60;409&#x60;. | [Defaults to `undefined`] |
| **portfolioId** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | The portfolio was deleted. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deletePosition

> deletePosition(idempotencyKey, portfolioId, positionId)

Remove a position from an owned portfolio.

### Example

```ts
import {
  Configuration,
  PortfoliosApi,
} from '';
import type { DeletePositionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PortfoliosApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // string
    portfolioId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    positionId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeletePositionRequest;

  try {
    const data = await api.deletePosition(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **idempotencyKey** | `string` | Unique client-generated key. Reuse with a different payload returns &#x60;409&#x60;. | [Defaults to `undefined`] |
| **portfolioId** | `string` |  | [Defaults to `undefined`] |
| **positionId** | `string` |  | [Defaults to `undefined`] |

### Return type

`void` (Empty response body)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **204** | The position was removed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getPortfolio

> PortfolioDetail getPortfolio(portfolioId)

Return one portfolio owned by the authenticated user.

### Example

```ts
import {
  Configuration,
  PortfoliosApi,
} from '';
import type { GetPortfolioRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PortfoliosApi(config);

  const body = {
    // string
    portfolioId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetPortfolioRequest;

  try {
    const data = await api.getPortfolio(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **portfolioId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**PortfolioDetail**](PortfolioDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The portfolio and its current positions. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPortfolios

> PortfolioPage listPortfolios(cursor, pageSize)

List portfolios owned by the authenticated user.

### Example

```ts
import {
  Configuration,
  PortfoliosApi,
} from '';
import type { ListPortfoliosRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PortfoliosApi(config);

  const body = {
    // string | Opaque cursor returned by the previous page. (optional)
    cursor: cursor_example,
    // number | Maximum number of records to return. (optional)
    pageSize: 56,
  } satisfies ListPortfoliosRequest;

  try {
    const data = await api.listPortfolios(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **cursor** | `string` | Opaque cursor returned by the previous page. | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` | Maximum number of records to return. | [Optional] [Defaults to `25`] |

### Return type

[**PortfolioPage**](PortfolioPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A page of portfolios. |  -  |
| **401** | Authentication is absent or invalid. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listPositions

> PositionPage listPositions(portfolioId, cursor, pageSize)

List positions in an owned portfolio.

### Example

```ts
import {
  Configuration,
  PortfoliosApi,
} from '';
import type { ListPositionsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PortfoliosApi(config);

  const body = {
    // string
    portfolioId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Opaque cursor returned by the previous page. (optional)
    cursor: cursor_example,
    // number | Maximum number of records to return. (optional)
    pageSize: 56,
  } satisfies ListPositionsRequest;

  try {
    const data = await api.listPositions(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **portfolioId** | `string` |  | [Defaults to `undefined`] |
| **cursor** | `string` | Opaque cursor returned by the previous page. | [Optional] [Defaults to `undefined`] |
| **pageSize** | `number` | Maximum number of records to return. | [Optional] [Defaults to `25`] |

### Return type

[**PositionPage**](PositionPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A page of positions. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updatePortfolio

> Portfolio updatePortfolio(idempotencyKey, portfolioId, updatePortfolioRequest)

Update one owned portfolio.

### Example

```ts
import {
  Configuration,
  PortfoliosApi,
} from '';
import type { UpdatePortfolioOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PortfoliosApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // string
    portfolioId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdatePortfolioRequest
    updatePortfolioRequest: ...,
  } satisfies UpdatePortfolioOperationRequest;

  try {
    const data = await api.updatePortfolio(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **idempotencyKey** | `string` | Unique client-generated key. Reuse with a different payload returns &#x60;409&#x60;. | [Defaults to `undefined`] |
| **portfolioId** | `string` |  | [Defaults to `undefined`] |
| **updatePortfolioRequest** | [UpdatePortfolioRequest](UpdatePortfolioRequest.md) |  | |

### Return type

[**Portfolio**](Portfolio.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The updated portfolio. |  -  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |
| **422** | The request is syntactically valid but violates domain rules. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updatePosition

> Position updatePosition(idempotencyKey, portfolioId, positionId, updatePositionRequest)

Update a position in an owned portfolio.

### Example

```ts
import {
  Configuration,
  PortfoliosApi,
} from '';
import type { UpdatePositionOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new PortfoliosApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // string
    portfolioId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string
    positionId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdatePositionRequest
    updatePositionRequest: ...,
  } satisfies UpdatePositionOperationRequest;

  try {
    const data = await api.updatePosition(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **idempotencyKey** | `string` | Unique client-generated key. Reuse with a different payload returns &#x60;409&#x60;. | [Defaults to `undefined`] |
| **portfolioId** | `string` |  | [Defaults to `undefined`] |
| **positionId** | `string` |  | [Defaults to `undefined`] |
| **updatePositionRequest** | [UpdatePositionRequest](UpdatePositionRequest.md) |  | |

### Return type

[**Position**](Position.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The updated position. |  -  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |
| **422** | The request is syntactically valid but violates domain rules. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
