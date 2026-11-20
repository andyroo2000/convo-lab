import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adaptModel } from './model-adapter.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, '.engines/browser-assets');
mkdirSync(output, { recursive: true });
const model = JSON.parse(readFileSync(resolve(root, 'neural-model.json')));
writeFileSync(
  resolve(output, 'model.gguf'),
  adaptModel(readFileSync(resolve(root, '.engines/zenz-v3-small', model.filename)), model.sha256)
);
const resources = resolve(
  root,
  '.engines/AzooKeyKanaKanjiConverter/Sources/KanaKanjiConverterModuleWithDefaultDictionary'
);
const chunks = [],
  entries = [];
let offset = 0;
function pack(directory, name) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, item.name),
      relative = `${name}/${item.name}`;
    if (item.isDirectory()) pack(path, relative);
    else {
      const bytes = readFileSync(path);
      entries.push([relative, offset, bytes.length]);
      chunks.push(bytes);
      offset += bytes.length;
    }
  }
}
pack(resolve(resources, 'azooKey_dictionary_storage/Dictionary'), 'Dictionary');
pack(resolve(resources, 'azooKey_emoji_dictionary_storage/EmojiDictionary'), 'EmojiDictionary');
writeFileSync(resolve(output, 'dictionary.bin'), Buffer.concat(chunks));
writeFileSync(resolve(output, 'dictionary.json'), JSON.stringify(entries));
console.log(
  `Packed ${entries.length} dictionary files (${offset} bytes), model weights unchanged.`
);
