// jsdom does not implement the canvas 2D context. The engine builds a
// procedural terrain canvas at construction time, so provide a no-op stub
// that satisfies every call made by the terrain generator and renderers.
function createStubContext(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  const stub: Record<string, unknown> = {};
  const proxy = new Proxy(stub, {
    get(_target, prop) {
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient' || prop === 'createPattern') {
        return () => gradient;
      }
      if (prop === 'measureText') return () => ({ width: 0 });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      return () => {};
    },
    set(_target, prop, value) {
      stub[prop as string] = value;
      return true;
    },
  });
  return proxy as unknown as CanvasRenderingContext2D;
}

HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement) {
  return createStubContext();
} as unknown as typeof HTMLCanvasElement.prototype.getContext;