// The QCF V2 font of one Mushaf page (p{n}.woff2), loaded only when that page
// is shown: the FontFace API, one load per page per page load (the files
// themselves are cached by the browser), at most two at a time, given up
// after a timeout so the page falls back to the plain text view.

const TIMEOUT_MS = 8000;
const MAX_PARALLEL = 2;

const loaded = new Map<string, Promise<string>>();
let running = 0;
const queue: (() => void)[] = [];

function slot(): Promise<() => void> {
  return new Promise((resolve) => {
    const start = () => {
      running++;
      resolve(() => {
        running--;
        queue.shift()?.();
      });
    };
    if (running < MAX_PARALLEL) start();
    else queue.push(start);
  });
}

/** The CSS font-family of the page's font once it's ready; rejects on failure or timeout. */
export function loadPageFont(fontBase: string, page: number): Promise<string> {
  const family = `qcf-v2-p${page}`;
  const key = `${fontBase}|${page}`;
  let p = loaded.get(key);
  if (!p) {
    p = (async () => {
      if (typeof FontFace === "undefined" || typeof document === "undefined") throw new Error("no FontFace");
      const release = await slot();
      try {
        const face = new FontFace(family, `url(${fontBase}/p${page}.woff2) format("woff2")`, { display: "block" });
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
        });
        try {
          await Promise.race([face.load(), timeout]);
        } finally {
          clearTimeout(timer);
        }
        document.fonts.add(face);
        return family;
      } finally {
        release();
      }
    })();
    // a failed page is tried again on the next mount, not for the rest of the visit
    p.catch(() => loaded.delete(key));
    loaded.set(key, p);
  }
  return p;
}
