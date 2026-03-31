type LivewireComponent = Record<string, unknown>;

const LIVEWIRE_COMPONENTS_REGEX =
  /<div\s+[^>]*wire:id="[^"]+"[^>]*wire:initial-data="(?<data>[^"]+)"[^>]*>/g;

export const parseLivewireComponents = (html: string) => {
  const results: LivewireComponent[] = [];
  for (const m of html.matchAll(LIVEWIRE_COMPONENTS_REGEX)) {
    const { data } = m.groups as { data: string };
    const json = data.replaceAll('&quot;', '"').replaceAll('&amp;', '&');
    results.push(JSON.parse(json));
  }
  return results;
};
