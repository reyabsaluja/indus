
# CreateFavoriteRequest


## Properties

Name | Type
------------ | -------------
`symbol` | string
`instrumentType` | [InstrumentType](InstrumentType.md)

## Example

```typescript
import type { CreateFavoriteRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "symbol": null,
  "instrumentType": null,
} satisfies CreateFavoriteRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateFavoriteRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
