# ReportsApi

All URIs are relative to *http://localhost*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createReport**](ReportsApi.md#createreportoperation) | **POST** /v1/reports | Start generation of a research report. |
| [**deleteReport**](ReportsApi.md#deletereport) | **DELETE** /v1/reports/{report_id} | Delete one owned report. |
| [**getReport**](ReportsApi.md#getreport) | **GET** /v1/reports/{report_id} | Return one report owned by the authenticated user. |
| [**listReports**](ReportsApi.md#listreports) | **GET** /v1/reports | List reports owned by the authenticated user. |



## createReport

> Report createReport(idempotencyKey, createReportRequest)

Start generation of a research report.

### Example

```ts
import {
  Configuration,
  ReportsApi,
} from '';
import type { CreateReportOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReportsApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // CreateReportRequest
    createReportRequest: ...,
  } satisfies CreateReportOperationRequest;

  try {
    const data = await api.createReport(body);
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
| **createReportRequest** | [CreateReportRequest](CreateReportRequest.md) |  | |

### Return type

[**Report**](Report.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **202** | Report generation was accepted. |  * Location -  <br>  |
| **400** | The request is malformed. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |
| **422** | The request is syntactically valid but violates domain rules. |  -  |
| **429** | A request quota was exhausted. |  * Retry-After -  <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteReport

> deleteReport(idempotencyKey, reportId)

Delete one owned report.

### Example

```ts
import {
  Configuration,
  ReportsApi,
} from '';
import type { DeleteReportRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReportsApi(config);

  const body = {
    // string | Unique client-generated key. Reuse with a different payload returns `409`.
    idempotencyKey: idempotencyKey_example,
    // string
    reportId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteReportRequest;

  try {
    const data = await api.deleteReport(body);
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
| **reportId** | `string` |  | [Defaults to `undefined`] |

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
| **204** | The report was deleted. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |
| **409** | The operation conflicts with current state or idempotency history. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getReport

> ReportDetail getReport(reportId)

Return one report owned by the authenticated user.

### Example

```ts
import {
  Configuration,
  ReportsApi,
} from '';
import type { GetReportRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReportsApi(config);

  const body = {
    // string
    reportId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetReportRequest;

  try {
    const data = await api.getReport(body);
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
| **reportId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**ReportDetail**](ReportDetail.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Report metadata and content when available. |  -  |
| **401** | Authentication is absent or invalid. |  -  |
| **404** | The resource does not exist or is not visible to the caller. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listReports

> ReportPage listReports(cursor, pageSize, status)

List reports owned by the authenticated user.

### Example

```ts
import {
  Configuration,
  ReportsApi,
} from '';
import type { ListReportsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReportsApi(config);

  const body = {
    // string | Opaque cursor returned by the previous page. (optional)
    cursor: cursor_example,
    // number | Maximum number of records to return. (optional)
    pageSize: 56,
    // ReportStatus (optional)
    status: ...,
  } satisfies ListReportsRequest;

  try {
    const data = await api.listReports(body);
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
| **status** | `ReportStatus` |  | [Optional] [Defaults to `undefined`] [Enum: queued, generating, completed, failed, cancelled] |

### Return type

[**ReportPage**](ReportPage.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`, `application/problem+json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | A page of reports. |  -  |
| **401** | Authentication is absent or invalid. |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
