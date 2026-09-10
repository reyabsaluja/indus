# ModelsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createChatCompletion**](ModelsApi.md#createchatcompletion) | **POST** /v1/chat | Create a grounded financial-analysis chat response. |
| [**createExplanations**](ModelsApi.md#createexplanationsoperation) | **POST** /v1/explanations | Explain a bounded set of financial metrics. |



## createChatCompletion

> ChatResponse createChatCompletion(idempotencyKey, chatRequest)

Create a grounded financial-analysis chat response.

### Example

```ts
import {
  Configuration,
  ModelsApi,
} from '';
import type { CreateChatCompletionRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ModelsApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // ChatRequest
    chatRequest: ...,
  } satisfies CreateChatCompletionRequest;

  try {
    const data = await api.createChatCompletion(body);
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
| **chatRequest** | [ChatRequest](ChatRequest.md) |  | |

### Return type

[**ChatResponse**](ChatResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A completed assistant response. |  -  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |
| **422** | The request is syntactically valid but violates domain rules. |  -  |
| **429** | A request quota was exhausted. |  * Retry-After -  <br>  |
| **502** | A required upstream provider failed or returned invalid data. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## createExplanations

> ExplanationResponse createExplanations(idempotencyKey, createExplanationsRequest)

Explain a bounded set of financial metrics.

### Example

```ts
import {
  Configuration,
  ModelsApi,
} from '';
import type { CreateExplanationsOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ModelsApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // CreateExplanationsRequest
    createExplanationsRequest: ...,
  } satisfies CreateExplanationsOperationRequest;

  try {
    const data = await api.createExplanations(body);
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
| **createExplanationsRequest** | [CreateExplanationsRequest](CreateExplanationsRequest.md) |  | |

### Return type

[**ExplanationResponse**](ExplanationResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Metric explanations grounded in the supplied snapshot. |  -  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |
| **422** | The request is syntactically valid but violates domain rules. |  -  |
| **429** | A request quota was exhausted. |  * Retry-After -  <br>  |
| **502** | A required upstream provider failed or returned invalid data. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
