
# MarketSummary


## Properties

Name | Type
------------ | -------------
`indices` | [Array&lt;MarketQuote&gt;](MarketQuote.md)
`watchlist` | [Array&lt;WatchlistQuote&gt;](WatchlistQuote.md)

## Example

```typescript
import type { MarketSummary } from ''

// TODO: Update the object below with actual values
const example = {
  "indices": null,
  "watchlist": null,
} satisfies MarketSummary

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as MarketSummary
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
