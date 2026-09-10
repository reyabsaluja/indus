# FavoritesApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createFavorite**](FavoritesApi.md#createfavoriteoperation) | **POST** /v1/favorites | Add an instrument to the authenticated user\&#39;s favorites. |
| [**deleteFavorite**](FavoritesApi.md#deletefavorite) | **DELETE** /v1/favorites/{favorite_id} | Remove an instrument from the authenticated user\&#39;s favorites. |
| [**listFavorites**](FavoritesApi.md#listfavorites) | **GET** /v1/favorites | List favorites owned by the authenticated user. |



## createFavorite

> Favorite createFavorite(idempotencyKey, createFavoriteRequest)

Add an instrument to the authenticated user\&#39;s favorites.

### Example

```ts
import {
  Configuration,
  FavoritesApi,
} from '';
import type { CreateFavoriteOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FavoritesApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // CreateFavoriteRequest
    createFavoriteRequest: ...,
  } satisfies CreateFavoriteOperationRequest;

  try {
    const data = await api.createFavorite(body);
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
| **createFavoriteRequest** | [CreateFavoriteRequest](CreateFavoriteRequest.md) |  | |

### Return type

[**Favorite**](Favorite.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | The favorite was created. |  * Location -  <br>  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **403** | The caller lacks the product permission required by this operation. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |
| **422** | The request is syntactically valid but violates domain rules. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteFavorite

> deleteFavorite(favoriteId, idempotencyKey)

Remove an instrument from the authenticated user\&#39;s favorites.

### Example

```ts
import {
  Configuration,
  FavoritesApi,
} from '';
import type { DeleteFavoriteRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FavoritesApi(config);

  const body = {
    // string
    favoriteId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
  } satisfies DeleteFavoriteRequest;

  try {
    const data = await api.deleteFavorite(body);
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
| **favoriteId** | `string` |  | [Defaults to `undefined`] |
| **idempotencyKey** | `string` | Unique client-generated key. Reuse with a different payload returns &#x60;409&#x60;. | [Defaults to `undefined`] |

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
| **204** | The favorite was removed or was already absent. |  -  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **403** | The caller lacks the product permission required by this operation. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listFavorites

> FavoritePage listFavorites(cursor, pageSize)

List favorites owned by the authenticated user.

### Example

```ts
import {
  Configuration,
  FavoritesApi,
} from '';
import type { ListFavoritesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FavoritesApi(config);

  const body = {
    // string | Opaque cursor returned by the previous page. (optional)
    cursor: cursor_example,
    // number | Maximum number of records to return. (optional)
    pageSize: 56,
  } satisfies ListFavoritesRequest;

  try {
    const data = await api.listFavorites(body);
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

[**FavoritePage**](FavoritePage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A page of favorites. |  -  |
| **401** | Authentication is absent or invalid. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
