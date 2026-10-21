import assert from "node:assert/strict"
import { test } from "node:test"
import { parseProduct } from "./jsonld"

const page = (ld: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(ld)}</script></head></html>`

test("a plain Product with one offer", () => {
  const p = parseProduct(
    page({
      "@type": "Product",
      name: "PH 5 Pendant",
      image: "/img/ph5.jpg",
      offers: { price: "1,095.00", priceCurrency: "USD" },
    }),
    "https://www.louispoulsen.com/ph-5",
  )
  assert.deepEqual(p, {
    name: "PH 5 Pendant",
    image: "https://www.louispoulsen.com/img/ph5.jpg",
    price: 1095,
    currency: "USD",
    url: "https://www.louispoulsen.com/ph-5",
  })
})

test("a Product inside @graph with an image object and an offers list", () => {
  const p = parseProduct(
    page({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "WebPage" },
        {
          "@type": ["Product"],
          name: "  Akari 1A  ",
          image: [{ url: "https://x.test/a.png" }],
          offers: [{ lowPrice: 230, priceCurrency: "EUR" }],
        },
      ],
    }),
    "https://x.test/akari",
  )
  assert.equal(p?.name, "Akari 1A")
  assert.equal(p?.image, "https://x.test/a.png")
  assert.equal(p?.price, 230)
  assert.equal(p?.currency, "EUR")
})

test("Open Graph fallback, and nothing for a page that isn't a product", () => {
  const og = `<meta property="og:type" content="product"><meta property="og:title" content="Table lamp"><meta property="product:price:amount" content="89.5"><meta property="product:price:currency" content="GBP">`
  assert.equal(parseProduct(og, "https://shop.test/p")?.price, 89.5)
  assert.equal(
    parseProduct("<html><title>Our story</title></html>", "https://shop.test/about"),
    null,
  )
  assert.equal(
    parseProduct(`<script type="application/ld+json">{not json</script>`, "https://shop.test/x"),
    null,
  )
})
