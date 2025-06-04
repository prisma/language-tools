import getPort from 'get-port';

export async function getUniquePorts(count: number): Promise<number[]> {
  const ports = new Set<number>();

  while (ports.size < count) {
    const port = await getPort();
    ports.add(port);
  }

  return Array.from(ports);
}
