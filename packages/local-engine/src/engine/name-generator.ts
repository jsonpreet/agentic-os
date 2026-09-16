const NAMES = [
  'Tim',
  'Jade',
  'Stark',
  'Nova',
  'Atlas',
  'Echo',
  'Orion',
  'Lyra',
  'Sage',
  'Pixel',
  'Cortex',
  'Vesper',
  'Zenith',
  'Blaze',
  'Frost',
  'Phoenix',
  'Kestrel',
  'Apollo',
  'Athena',
  'Aura',
  'Cygnus',
  'Draco',
  'Helix',
  'Iris',
  'Luna',
  'Mirage',
  'Nexus',
  'Pulsar',
  'Rift',
  'Sol',
  'Vortex'
];

export function generateAgentName(existingNames: string[]): string {
  const lowercaseExisting = new Set(existingNames.map((n) => n.toLowerCase()));

  // Try unused names from primary list
  const available = NAMES.filter((name) => !lowercaseExisting.has(name.toLowerCase()));
  if (available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    return available[idx];
  }

  // If all primary names are used, append a random number
  const base = NAMES[Math.floor(Math.random() * NAMES.length)];
  let counter = 2;
  while (lowercaseExisting.has(`${base}-${counter}`.toLowerCase())) {
    counter++;
  }
  return `${base}-${counter}`;
}
