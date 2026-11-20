import { readFileSync, writeFileSync } from 'node:fs';

const source = new URL('../../.engines/webgpu-source/', import.meta.url);
function patch(path, before, after) {
  const url = new URL(path, source),
    text = readFileSync(url, 'utf8');
  if (text.includes(after)) return;
  if (!text.includes(before)) throw Error(`Safari patch anchor missing: ${path}`);
  writeFileSync(url, text.replace(before, after));
}

// A memory constructor accepting an option does not prove that modules using
// that option compile. Safari 27 accepts the constructor but rejects memory64.
patch(
  'src/utils.ts',
  `export const isSupportMem64 = (): boolean => {
  try {
    new WebAssembly.Memory({
      address: 'i64',
      initial: 1n, // 1 page (64 KiB)
    } as any);
    return true;
  } catch {
    return false;
  }
};`,
  `export const isSupportMem64 = (): boolean =>
  WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,5,3,1,4,1]));`
);

patch(
  'CMakeLists.txt',
  `    list(APPEND WLLAMA_LINK_OPTIONS
        -fexceptions
        -sASYNCIFY=1
        -sASYNCIFY_ADD=['wllama_start','wllama_action']
    )`,
  `    list(APPEND WLLAMA_LINK_OPTIONS -fexceptions)
    if (WLLAMA_COMPAT_JSPI)
        list(APPEND WLLAMA_COMPILE_OPTIONS -fwasm-exceptions)
        list(APPEND WLLAMA_LINK_OPTIONS -fwasm-exceptions)
        list(APPEND WLLAMA_LINK_OPTIONS
            -sJSPI
            -sJSPI_EXPORTS=['wllama_start','wllama_action']
        )
    else()
        list(APPEND WLLAMA_LINK_OPTIONS
            -sASYNCIFY=1
            -sASYNCIFY_ADD=['wllama_start','wllama_action']
        )
    endif()`
);
