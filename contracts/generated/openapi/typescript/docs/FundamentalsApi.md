# FundamentalsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getFundamentals**](FundamentalsApi.md#getfundamentals) | **GET** /v1/fundamentals/{symbol} | Return a bounded fundamentals snapshot for an instrument. |



## getFundamentals

> Fundamentals getFundamentals(symbol)

Return a bounded fundamentals snapshot for an instrument.

### Example

```ts
import {
  Configuration,
  FundamentalsApi,
} from '';
import type { GetFundamentalsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new FundamentalsApi(config);

  const body = {
    // string
    symbol: symbol_example,
  } satisfies GetFundamentalsRequest;

  try {
    const data = await api.getFundamentals(body);
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
| **symbol** | `string` |  | [Defaults to `undefined`] |

### Return type

[**Fundamentals**](Fundamentals.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | The latest available fundamentals snapshot. |  -  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |
| **429** | A request quota was exhausted. |  * Retry-After -  <br>  |
| **502** | A required upstream provider failed or returned invalid data. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
