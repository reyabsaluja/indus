# OperationsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getHealth**](OperationsApi.md#gethealth) | **GET** /healthz | Check whether the process is alive. |
| [**getReadiness**](OperationsApi.md#getreadiness) | **GET** /readyz | Check whether required dependencies can serve traffic. |



## getHealth

> Health getHealth()

Check whether the process is alive.

### Example

```ts
import {
  Configuration,
  OperationsApi,
} from '';
import type { GetHealthRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OperationsApi();

  try {
    const data = await api.getHealth();
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

[**Health**](Health.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The process is alive. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getReadiness

> Readiness getReadiness()

Check whether required dependencies can serve traffic.

### Example

```ts
import {
  Configuration,
  OperationsApi,
} from '';
import type { GetReadinessRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new OperationsApi();

  try {
    const data = await api.getReadiness();
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

[**Readiness**](Readiness.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The service is ready. |  -  |
| **503** | A required dependency is unavailable. |  * Retry-After -  <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
