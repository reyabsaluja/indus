
# Position


## Properties

Name | Type
------------ | -------------
`id` | string
`portfolioId` | string
`symbol` | string
`instrumentType` | [InstrumentType](InstrumentType.md)
`quantity` | string
`averageCost` | string
`currency` | string
`createdAt` | Date
`updatedAt` | Date

## Example

```typescript
import type { Position } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "portfolioId": null,
  "symbol": null,
  "instrumentType": null,
  "quantity": null,
  "averageCost": null,
  "currency": null,
  "createdAt": null,
  "updatedAt": null,
} satisfies Position

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Position
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
