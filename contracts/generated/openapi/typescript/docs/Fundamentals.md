
# Fundamentals


## Properties

Name | Type
------------ | -------------
`symbol` | string
`asOf` | Date
`source` | string
`metrics` | [{ [key: string]: FundamentalsMetricsValue; }](FundamentalsMetricsValue.md)

## Example

```typescript
import type { Fundamentals } from ''

// TODO: Update the object below with actual values
const example = {
  "symbol": null,
  "asOf": null,
  "source": null,
  "metrics": null,
} satisfies Fundamentals

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Fundamentals
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
