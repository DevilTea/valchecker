/**
 * The base64url alphabet and length rule, as one definition shared by
 * `isBase64Url` and by `isJwt`'s segments.
 *
 * A base64url string encodes whole bytes, so its length is never `1 (mod 4)`:
 * a final group of one character cannot represent any byte. `isJwt` used to
 * check its segments with an alphabet-only pattern and therefore accepted
 * segments that `isBase64Url` rejected — one library answering "is this
 * base64url?" two ways.
 *
 * Note that the empty string satisfies this pattern, since both quantifiers can
 * match nothing. A caller that also requires content must say so; `isJwt` does
 * for its header and payload.
 */
export const base64UrlPattern = /^(?:[\w-]{4})*(?:[\w-]{2,3})?$/
