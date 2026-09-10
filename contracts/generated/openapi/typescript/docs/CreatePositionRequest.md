
# CreatePositionRequest


## Properties

Name | Type
------------ | -------------
`symbol` | string
`instrumentType` | [InstrumentType](InstrumentType.md)
`quantity` | string
`averageCost` | string
`currency` | string

## Example

```typescript
import type { CreatePositionRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "symbol": null,
  "instrumentType": null,
  "quantity": null,
  "averageCost": null,
  "currency": null,
} satisfies CreatePositionRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreatePositionRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
