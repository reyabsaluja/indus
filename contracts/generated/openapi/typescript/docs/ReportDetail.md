
# ReportDetail


## Properties

Name | Type
------------ | -------------
`id` | string
`symbol` | string
`portfolioId` | string
`title` | string
`status` | [ReportStatus](ReportStatus.md)
`failureCode` | string
`createdAt` | Date
`updatedAt` | Date
`summary` | string
`content` | string
`sources` | [Array&lt;SourceCitation&gt;](SourceCitation.md)

## Example

```typescript
import type { ReportDetail } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "symbol": null,
  "portfolioId": null,
  "title": null,
  "status": null,
  "failureCode": null,
  "createdAt": null,
  "updatedAt": null,
  "summary": null,
  "content": null,
  "sources": null,
} satisfies ReportDetail

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ReportDetail
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
