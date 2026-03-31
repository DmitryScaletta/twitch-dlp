type EcsStreamPage = {
  id: number;
  live: boolean;
  hasViews: boolean;
  hasChatters: boolean;
  chart: [date: string, number, number | null, number | null][];
  created_at: string;
  finished_at: string;
  avg_viewers: number;
  max_viewers: number;
  titles: { created_at: string; title: string; relative_at: number }[];
  games: { date: string; id: number; name: string }[];
};

const parseEcs = <T extends Record<string, unknown> = Record<string, unknown>>(
  html: string,
) => {
  const m = html.match(/<meta id="ecs" content="([^"]+)">/);
  if (!m) throw new Error(`Element not found: meta#ecs`);
  const ecsString = m[1];
  const ecsRaw = ecsString
    .replaceAll('#', 'W')
    .split('!')
    .map((s) => JSON.parse(atob(s)));
  const ecs: Record<string, unknown> = {};
  const headers = ecsRaw.at(-1);
  for (let i = 0; i < ecsRaw.length - 1; i += 1) {
    ecs[headers[i]] = ecsRaw[i];
  }
  return ecs as T;
};

export const getStreamInfo = (html: string) => parseEcs<EcsStreamPage>(html);
