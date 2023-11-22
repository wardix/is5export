import { FastifyInstance } from 'fastify'

export const rootRoute = async (fastify: FastifyInstance) => {
  fastify.get('/', (_request, reply) => {
    reply.send('OK')
  })
}
