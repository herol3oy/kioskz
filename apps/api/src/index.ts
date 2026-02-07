import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/urls', (c) => {
  return c.json([
    { host: 'huffpost.com', lang: 'en' },
    { host: 'sapo.pt', lang: 'pt' },
    { host: 'spiegel.de', lang: 'de' },
    { host: 'radiofarda.com', lang: 'fa' },
  ])
})

export default app
