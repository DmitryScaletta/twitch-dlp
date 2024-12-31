export const fetchText = async (url: string, description = 'metadata') => {
  console.log(`Downloading ${description}`);
  try {
    const res = await fetch(url);
    return res.text();
  } catch (e) {
    console.error(`Unable to download ${description}`);
    return null;
  }
};
