# IdentityApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getCurrentUser**](IdentityApi.md#getcurrentuser) | **GET** /v1/me | Return the authenticated application profile. |
| [**updateCurrentUser**](IdentityApi.md#updatecurrentuser) | **PATCH** /v1/me | Update the authenticated application profile. |



## getCurrentUser

> User getCurrentUser()

Return the authenticated application profile.

### Example

```ts
import {
  Configuration,
  IdentityApi,
} from '';
import type { GetCurrentUserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new IdentityApi(config);

  try {
    const data = await api.getCurrentUser();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**User**](User.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The current user\&#39;s profile. |  -  |
| **401** | Authentication is absent or invalid. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateCurrentUser

> User updateCurrentUser(idempotencyKey, updateUserRequest)

Update the authenticated application profile.

### Example

```ts
import {
  Configuration,
  IdentityApi,
} from '';
import type { UpdateCurrentUserRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new IdentityApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // UpdateUserRequest
    updateUserRequest: ...,
  } satisfies UpdateCurrentUserRequest;

  try {
    const data = await api.updateCurrentUser(body);
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
| **updateUserRequest** | [UpdateUserRequest](UpdateUserRequest.md) |  | |

### Return type

[**User**](User.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The updated profile. |  -  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **403** | The caller lacks the product permission required by this operation. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |
| **422** | The request is syntactically valid but violates domain rules. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
