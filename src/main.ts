import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import { config } from 'dotenv'
import fastifyMySQL from '@fastify/mysql'
import { rpzRoute } from './rpz.route'
import { invalidHostRoute } from './invalid-host.route'
import { rootRoute } from './root.route'

config()

const PORT = process.env.PORT! || 3000
const MYSQL_URL = process.env.MYSQL_URL!
const API_KEYS = process.env.API_KEYS! || '[]'

const apiKeys = JSON.parse(API_KEYS)
const validateApiKey = async (request: FastifyRequest, reply: FastifyReply) => {
  const apiKey = request.headers['x-api-key']
  if (!apiKey || !apiKeys.includes(apiKey)) {
    reply.code(401).send({ error: 'Unauthorized: Invalid API Key' })
  }
}

const fastify = Fastify({ logger: true })

fastify.addHook('preValidation', async (request, reply) => {
  if (request.routeOptions.url.startsWith('/noc/')) {
    await validateApiKey(request, reply)
  }
})

fastify.register(fastifyMySQL, { promise: true, connectionString: MYSQL_URL })

fastify.register(rpzRoute, { prefix: '/noc/rpz' })
fastify.register(invalidHostRoute, { prefix: '/noc/invalid-host' })
fastify.register(rootRoute)

fastify.listen({ port: +PORT }, (err) => {
  if (err) throw err
})
