
# ChatResponse


## Properties

Name | Type
------------ | -------------
`conversationId` | string
`message` | [ChatMessage](ChatMessage.md)
`sources` | [Array&lt;SourceCitation&gt;](SourceCitation.md)
`usage` | [ModelUsage](ModelUsage.md)

## Example

```typescript
import type { ChatResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "conversationId": null,
  "message": null,
  "sources": null,
  "usage": null,
} satisfies ChatResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ChatResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
