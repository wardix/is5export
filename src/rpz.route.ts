import { FastifyInstance, FastifyRequest } from 'fastify'
import { RowDataPacket } from 'mysql2'

interface Row extends RowDataPacket {
  host: string
  ip: string
}

export const rpzRoute = async (fastify: FastifyInstance) => {
  fastify.get('/', async (request: any, reply) => {
    const rrTemplate = '{host} IN A {ip}'
    if (!request.query.branch || request.query.domain === undefined) {
      return reply
        .status(400)
        .send('Missing required query parameters: branch and domain')
    }
    const { branch: branchParam, domain } = request.query as {
      branch: string
      domain: string
    }
    const connection = await fastify.mysql.getConnection()
    const resourceRecords = []
    const branches = branchParam.split(',').map((x) => x.trim())
    const branchPlaceholder = branches.map((_) => '?').join(', ')

    const apSql = `SELECT TRIM(npa.host) host, TRIM(npa.ip) ip
       FROM noc_pop_ap npa 
       LEFT JOIN noc_pop np ON npa.pop_id = np.id 
       WHERE np.branch_id IN (${branchPlaceholder}) 
       AND TRIM(npa.host) LIKE 'ap___.___' 
       AND npa.shown = 1 
       AND np.shown = 1`
    const [apRows] = await connection.query<Row[]>(apSql, branches)
    for (const { host, ip } of apRows) {
      resourceRecords.push(
        rrTemplate.replace('{host}', `${host}.${domain}`).replace('{ip}', ip)
      )
    }

    const swSql = `SELECT TRIM(nps.host) host, TRIM(nps.ip) ip
       FROM noc_pop_switch nps 
       LEFT JOIN noc_pop np ON nps.pop_id = np.id 
       WHERE np.branch_id IN (${branchPlaceholder}) 
       AND (TRIM(nps.host) LIKE 'sw%.___' OR TRIM(nps.host) LIKE 'pln%.___')
       AND nps.shown = 1 
       AND np.shown = 1`
    const [swRows] = await connection.query<Row[]>(swSql, branches)
    for (const { host, ip } of swRows) {
      resourceRecords.push(
        rrTemplate.replace('{host}', `${host}.${domain}`).replace('{ip}', ip)
      )
    }

    const roSql = `SELECT TRIM(npr.host) host, TRIM(npr.ip) ip
       FROM noc_pop_router npr 
       LEFT JOIN noc_pop np ON npr.pop_id = np.id 
       WHERE np.branch_id IN (${branchPlaceholder}) 
       AND TRIM(npr.host) LIKE '%.___'
       AND npr.shown = 1 
       AND np.shown = 1`
    const [roRows] = await connection.query<Row[]>(roSql, branches)
    for (const { host, ip } of roRows) {
      resourceRecords.push(
        rrTemplate.replace('{host}', `${host}.${domain}`).replace('{ip}', ip)
      )
    }

    connection.release()
    reply.send(resourceRecords.join('\n'))
  })
}
