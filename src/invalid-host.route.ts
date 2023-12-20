import { FastifyInstance, FastifyRequest } from 'fastify'
import { RowDataPacket } from 'mysql2'

interface Row extends RowDataPacket {
  host: string
  pop: string
}

export const invalidHostRoute = async (fastify: FastifyInstance) => {
  fastify.get('/', async (request: any, reply) => {
    if (!request.query.branch) {
      return reply.status(400).send('Missing required query parameters: branch')
    }
    const { branch: branchParam } = request.query as {
      branch: string
    }
    const connection = await fastify.mysql.getConnection()
    const invalidHosts = []
    const branches = branchParam.split(',').map((x) => x.trim())
    const branchPlaceholder = branches.map((_) => '?').join(', ')

    const apSql = `SELECT TRIM(npa.host) host, TRIM(npa.ip) ip, npc.value pop
       FROM noc_pop_ap npa 
       LEFT JOIN noc_pop np ON npa.pop_id = np.id 
       LEFT JOIN noc_pop_custom npc ON npc.pop_id = np.id AND npc.attribute = 'Code'
       WHERE np.branch_id IN (${branchPlaceholder}) 
       AND npa.shown = 1 
       AND np.shown = 1`
    const [apRows] = await connection.query<Row[]>(apSql, branches)
    for (const { host, ip, pop } of apRows) {
      if (!host.startsWith('ap')) {
        invalidHosts.push(`invalid_host{host="${host}",pop="${pop}"} 1`)
        continue
      }
      const isHostEndWithThreeLetters = /^[a-z]{3}$/.test(host.substring(6, 9))
      if (!isHostEndWithThreeLetters) {
        invalidHosts.push(`invalid_host{host="${host}",pop="${pop}"} 1`)
        continue
      }
      const ipParts = ip.split('.')
      const ipLastPart = ipParts[ipParts.length - 1]
      const ipPadding =
        ipLastPart.length == 1 ? '00' : ipLastPart.length == 2 ? '0' : ''
      const validHostIpPart = `${ipPadding}${ipLastPart}`
      if (host.substring(2, 5) !== validHostIpPart) {
        invalidHosts.push(
          `invalid_host{host="${host}",ip="${ip}",pop="${pop}"} 1`
        )
      }
    }

    const swSql = `SELECT TRIM(nps.host) host, npc.value pop
       FROM noc_pop_switch nps 
       LEFT JOIN noc_pop np ON nps.pop_id = np.id 
       LEFT JOIN noc_pop_custom npc ON npc.pop_id = np.id AND npc.attribute = 'Code'
       WHERE np.branch_id IN (${branchPlaceholder}) 
       AND NOT (TRIM(nps.host) REGEXP '(olt|sw|pln)[0-9a-z]*\.[a-z]{3}')
       AND nps.shown = 1 
       AND np.shown = 1`
    const [swRows] = await connection.query<Row[]>(swSql, branches)
    for (const { host, pop } of swRows) {
      invalidHosts.push(`invalid_host{host="${host}",pop="${pop}"} 1`)
    }

    const roSql = `SELECT TRIM(npr.host) host, npc.value pop
       FROM noc_pop_router npr 
       LEFT JOIN noc_pop np ON npr.pop_id = np.id 
       LEFT JOIN noc_pop_custom npc ON npc.pop_id = np.id AND npc.attribute = 'Code'
       WHERE np.branch_id IN (${branchPlaceholder}) 
       AND NOT (TRIM(npr.host) REGEXP '(ro|g)[0-9]*\.[a-z]{3}')
       AND npr.shown = 1 
       AND np.shown = 1`
    const [roRows] = await connection.query<Row[]>(roSql, branches)
    for (const { host, pop } of roRows) {
      invalidHosts.push(`invalid_host{host="${host}",pop="${pop}"} 1`)
    }

    connection.release()
    reply.send(invalidHosts.join('\n') + '\n')
  })
}
