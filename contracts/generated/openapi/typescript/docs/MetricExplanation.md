
# MetricExplanation


## Properties

Name | Type
------------ | -------------
`metric` | string
`explanation` | string
`sources` | [Array&lt;SourceCitation&gt;](SourceCitation.md)

## Example

```typescript
import type { MetricExplanation } from ''

// TODO: Update the object below with actual values
const example = {
  "metric": null,
  "explanation": null,
  "sources": null,
} satisfies MetricExplanation

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as MetricExplanation
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
