import { CLIENT_ID } from '../constants.ts';

export const fetchGql = async <T = unknown>(
  body: any,
  resultKey: string,
  description = 'metadata',
) => {
  console.log(`Downloading ${description}`);
  try {
    const res = await fetch('https://gql.twitch.tv/gql', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Client-Id': CLIENT_ID },
    });
    if (!res.ok) throw new Error();
    const json = await res.json();
    return json.data[resultKey] as T;
  } catch (e) {
    console.error(`Unable to download ${description}`);
    return null;
  }
};
