# InstrumentsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**searchInstruments**](InstrumentsApi.md#searchinstruments) | **GET** /v1/instruments/search | Search instruments by ticker symbol or company name. |



## searchInstruments

> InstrumentSearchPage searchInstruments(q, pageSize, cursor)

Search instruments by ticker symbol or company name.

### Example

```ts
import {
  Configuration,
  InstrumentsApi,
} from '';
import type { SearchInstrumentsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new InstrumentsApi(config);

  const body = {
    // string | Case-insensitive ticker symbol or company-name query.
    q: q_example,
    // number | Maximum number of records to return. (optional)
    pageSize: 56,
    // string | Opaque cursor returned by the previous page. (optional)
    cursor: cursor_example,
  } satisfies SearchInstrumentsRequest;

  try {
    const data = await api.searchInstruments(body);
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
| **q** | `string` | Case-insensitive ticker symbol or company-name query. | [Defaults to `undefined`] |
| **pageSize** | `number` | Maximum number of records to return. | [Optional] [Defaults to `25`] |
| **cursor** | `string` | Opaque cursor returned by the previous page. | [Optional] [Defaults to `undefined`] |

### Return type

[**InstrumentSearchPage**](InstrumentSearchPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A bounded page of matching instruments. |  -  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **429** | A request quota was exhausted. |  * Retry-After -  <br>  |
| **502** | A required upstream provider failed or returned invalid data. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
