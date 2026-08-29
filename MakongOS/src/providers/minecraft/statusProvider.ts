import { status, statusBedrock } from 'minecraft-server-util';

export interface MinecraftStatusResult {
  online: boolean;
  players: { online: number; max: number; sample: string[] };
  version?: string;
  motd?: string;
  latencyMs?: number;
}

export async function queryMinecraftServer(host: string, port: number, edition: 'java' | 'bedrock'): Promise<MinecraftStatusResult> {
  const start = Date.now();
  try {
    if (edition === 'bedrock') {
      const result = await statusBedrock(host, port, { timeout: 5000 });
      return {
        online: true,
        players: { online: result.players.online, max: result.players.max, sample: [] },
        version: result.version.name,
        motd: result.motd.clean,
        latencyMs: Date.now() - start
      };
    }

    const result = await status(host, port, { timeout: 5000 });
    return {
      online: true,
      players: {
        online: result.players.online,
        max: result.players.max,
        sample: result.players.sample?.map((p) => p.name) ?? []
      },
      version: result.version.name,
      motd: result.motd.clean,
      latencyMs: Date.now() - start
    };
  } catch {
    return { online: false, players: { online: 0, max: 0, sample: [] } };
  }
}
