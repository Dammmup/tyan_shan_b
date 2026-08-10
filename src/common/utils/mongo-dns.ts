import dns from 'node:dns';

/**
 * Node on some Windows/router DNS setups fails SRV lookup for mongodb+srv
 * (`querySrv ECONNREFUSED`) even when nslookup works. Prefer public resolvers
 * before any mongoose / mongodb+srv connection.
 */
export function preferPublicDns(): void {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
}
