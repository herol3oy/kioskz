import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/urls', (c) => {
  return c.json([
    { url: 'huffpost.com', lang: 'en' },
    { url: 'sapo.pt', lang: 'pt' },
    { url: 'spiegel.de', lang: 'de' },
    { url: 'radiofarda.com', lang: 'fa' },
  ])
})

export default app
