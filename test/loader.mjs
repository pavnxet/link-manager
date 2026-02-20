import { pathToFileURL } from 'url';
import path from 'path';

export function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/headers') {
    const mockPath = path.resolve(process.cwd(), 'test/mocks/next-headers.js');
    return {
      shortCircuit: true,
      url: pathToFileURL(mockPath).href,
    };
  }
  if (specifier === 'next/server') {
    return nextResolve(specifier + '.js', context);
  }
  return nextResolve(specifier, context);
}
