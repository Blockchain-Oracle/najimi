import assert from "node:assert/strict"
import { test } from "node:test"
import { openWith, sealWith } from "./vault"

const seal = (plain: string, bound: string, key: string) => sealWith(key, plain, bound)
const open = (sealed: string, bound: string, key: string) => openWith(key, sealed, bound)

const secret = "a-test-secret-that-is-long-enough-to-use"

test("a sealed session opens with the same secret and binding", () => {
  const sealed = seal("auth_token=abc;ct0=def;", "u1:x:42", secret)
  assert.equal(open(sealed, "u1:x:42", secret), "auth_token=abc;ct0=def;")
  assert.notEqual(seal("same", "u1:x:42", secret), seal("same", "u1:x:42", secret))
})

test("a sealed session won't open on another row or with another secret", () => {
  const sealed = seal("auth_token=abc", "u1:x:42", secret)
  assert.throws(() => open(sealed, "u2:x:42", secret))
  assert.throws(() => open(sealed, "u1:x:42", `${secret}!`))
  const [v, iv, tag, body] = sealed.split(".")
  const flipped = `${v}.${iv}.${tag}.${body?.slice(0, -2)}AA`
  assert.throws(() => open(flipped, "u1:x:42", secret))
})
