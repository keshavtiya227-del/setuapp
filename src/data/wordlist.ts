/**
 * Built-in 256-word curated list for one-time 6-word pairing codes and
 * 3-word SAS (Short Authentication String) verification phrases.
 *
 * Design criteria:
 * - Short (4-7 letters), concrete, phonetically distinct, easy to read aloud.
 * - 256 words = 8 bits per word -> 6-word pairing code yields 48 bits of entropy
 *   combined with strict 5-minute expiry and single-use consumption.
 * - 3-word SAS phrase yields 24 bits (~16.7 million combinations) for human MITM checks.
 */
export const WORD_LIST: readonly string[] = [
  'acorn', 'amber', 'anchor', 'anvil', 'apple', 'apron', 'arch', 'arrow',
  'aspen', 'atlas', 'autumn', 'badge', 'baker', 'bamboo', 'banjo', 'banyan',
  'barley', 'barrel', 'basil', 'basket', 'beacon', 'beaver', 'berry', 'birch',
  'bison', 'blade', 'blanket', 'blossom', 'boulder', 'branch', 'breeze', 'bridge',
  'bronze', 'brook', 'brush', 'bucket', 'cactus', 'camel', 'candle', 'cannon',
  'canopy', 'canyon', 'canvas', 'carbon', 'carpet', 'carrot', 'castle', 'cedar',
  'cellar', 'chalk', 'cherry', 'chisel', 'cider', 'cinder', 'citrus', 'clover',
  'cobalt', 'coffee', 'collar', 'comet', 'compass', 'copper', 'coral', 'cotton',
  'cradle', 'crane', 'crater', 'creek', 'cricket', 'crown', 'crystal', 'cypress',
  'dagger', 'dahlia', 'daisy', 'dancer', 'dawn', 'delta', 'desert', 'diamond',
  'dolphin', 'donkey', 'dragon', 'drift', 'drizzle', 'drum', 'eagle', 'ember',
  'emerald', 'engine', 'falcon', 'fennel', 'fern', 'fiddle', 'field', 'fig',
  'finch', 'fjord', 'flame', 'flint', 'flora', 'flute', 'forest', 'fossil',
  'fountain', 'fox', 'frost', 'funnel', 'galaxy', 'garden', 'garnet', 'gazelle',
  'geyser', 'ginger', 'glacier', 'glider', 'goblet', 'granite', 'grape', 'gravel',
  'griffin', 'grove', 'guitar', 'harbor', 'harvest', 'hawk', 'hazel', 'hearth',
  'heather', 'helmet', 'heron', 'hickory', 'hollow', 'honey', 'horizon', 'hornet',
  'indigo', 'island', 'ivory', 'jackal', 'jacket', 'jade', 'jaguar', 'jasmine',
  'jasper', 'juniper', 'kayak', 'kelp', 'kettle', 'kestrel', 'kingdom', 'kite',
  'ladder', 'lagoon', 'lantern', 'larch', 'lark', 'laurel', 'lava', 'lemon',
  'leopard', 'lichen', 'lilac', 'linden', 'linen', 'lizard', 'locket', 'lotus',
  'lumber', 'lynx', 'magnet', 'magpie', 'mango', 'mantle', 'maple', 'marble',
  'marigold', 'market', 'marmot', 'marsh', 'meadow', 'melon', 'mesa', 'meteor',
  'mill', 'mineral', 'mint', 'mirror', 'monarch', 'monsoon', 'moss', 'muffin',
  'mulberry', 'mustard', 'nebula', 'nectar', 'needle', 'nickel', 'nutmeg', 'oak',
  'oasis', 'obsidian', 'ocean', 'ochre', 'olive', 'onyx', 'opal', 'orange',
  'orchard', 'orchid', 'oriole', 'osprey', 'otter', 'owl', 'oyster', 'paddle',
  'palace', 'palm', 'panther', 'papaya', 'parcel', 'parrot', 'pebble', 'pecan',
  'pelican', 'pencil', 'pepper', 'perch', 'petal', 'pewter', 'phoenix', 'piano',
  'pigeon', 'pillar', 'pine', 'planet', 'plaza', 'plover', 'plum', 'pocket',
  'poplar', 'poppy', 'portal', 'prairie', 'prism', 'puffin', 'pumpkin', 'quartz',
] as const;
