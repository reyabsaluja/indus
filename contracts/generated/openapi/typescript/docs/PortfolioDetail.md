
# PortfolioDetail


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`baseCurrency` | string
`createdAt` | Date
`updatedAt` | Date
`positions` | [Array&lt;Position&gt;](Position.md)

## Example

```typescript
import type { PortfolioDetail } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "baseCurrency": null,
  "createdAt": null,
  "updatedAt": null,
  "positions": null,
} satisfies PortfolioDetail

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as PortfolioDetail
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
