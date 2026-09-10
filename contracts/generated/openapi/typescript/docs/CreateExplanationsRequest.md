
# CreateExplanationsRequest


## Properties

Name | Type
------------ | -------------
`symbol` | string
`metrics` | Set&lt;string&gt;
`asOf` | Date

## Example

```typescript
import type { CreateExplanationsRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "symbol": null,
  "metrics": null,
  "asOf": null,
} satisfies CreateExplanationsRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateExplanationsRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
