# MarketApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getMarketSummary**](MarketApi.md#getmarketsummary) | **GET** /v1/market/summary | Return index quotes and the authenticated user\&#39;s watchlist snapshot. |



## getMarketSummary

> MarketSummary getMarketSummary()

Return index quotes and the authenticated user\&#39;s watchlist snapshot.

### Example

```ts
import {
  Configuration,
  MarketApi,
} from '';
import type { GetMarketSummaryRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new MarketApi(config);

  try {
    const data = await api.getMarketSummary();
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

[**MarketSummary**](MarketSummary.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A bounded dashboard market snapshot. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **429** | A request quota was exhausted. |  * Retry-After -  <br>  |
| **502** | A required upstream provider failed or returned invalid data. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
