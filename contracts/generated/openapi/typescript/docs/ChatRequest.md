
# ChatRequest


## Properties

Name | Type
------------ | -------------
`conversationId` | string
`symbol` | string
`portfolioId` | string
`messages` | [Array&lt;ChatMessage&gt;](ChatMessage.md)

## Example

```typescript
import type { ChatRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "conversationId": null,
  "symbol": null,
  "portfolioId": null,
  "messages": null,
} satisfies ChatRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ChatRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
