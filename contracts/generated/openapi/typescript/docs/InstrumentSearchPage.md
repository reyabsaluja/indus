
# InstrumentSearchPage


## Properties

Name | Type
------------ | -------------
`nextCursor` | string
`items` | [Array&lt;InstrumentSearchResult&gt;](InstrumentSearchResult.md)

## Example

```typescript
import type { InstrumentSearchPage } from ''

// TODO: Update the object below with actual values
const example = {
  "nextCursor": null,
  "items": null,
} satisfies InstrumentSearchPage

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as InstrumentSearchPage
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
