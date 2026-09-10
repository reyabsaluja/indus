
# ExplanationResponse


## Properties

Name | Type
------------ | -------------
`symbol` | string
`asOf` | Date
`explanations` | [Array&lt;MetricExplanation&gt;](MetricExplanation.md)
`usage` | [ModelUsage](ModelUsage.md)

## Example

```typescript
import type { ExplanationResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "symbol": null,
  "asOf": null,
  "explanations": null,
  "usage": null,
} satisfies ExplanationResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExplanationResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
