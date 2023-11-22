import Fastify from 'fastify'
import { config } from 'dotenv'
import fastifyMySQL from '@fastify/mysql'
import { rpzRoute } from './rpz.route'
import { rootRoute } from './root.route'

config()

const PORT = process.env.PORT! || 3000
const MYSQL_URL = process.env.MYSQL_URL

const fastify = Fastify({ logger: true })

fastify.register(fastifyMySQL, { promise: true, connectionString: MYSQL_URL })

fastify.register(rpzRoute, { prefix: '/noc/rpz' })
fastify.register(rootRoute)

fastify.listen({ port: +PORT }, (err) => {
  if (err) throw err
})
