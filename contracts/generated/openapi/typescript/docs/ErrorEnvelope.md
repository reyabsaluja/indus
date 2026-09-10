
# ErrorEnvelope


## Properties

Name | Type
------------ | -------------
`type` | string
`title` | string
`status` | number
`detail` | string
`code` | string
`requestId` | string
`errors` | [Array&lt;FieldError&gt;](FieldError.md)

## Example

```typescript
import type { ErrorEnvelope } from ''

// TODO: Update the object below with actual values
const example = {
  "type": null,
  "title": null,
  "status": null,
  "detail": null,
  "code": null,
  "requestId": null,
  "errors": null,
} satisfies ErrorEnvelope

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ErrorEnvelope
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)
