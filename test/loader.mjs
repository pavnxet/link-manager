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
  if (specifier.startsWith('@/')) {
    const relativePath = specifier.replace(/^@\//, './');
    const absolutePath = path.resolve(process.cwd(), relativePath);
    
    // Add extension if it's missing (assuming .ts)
    let url = pathToFileURL(absolutePath).href;
    if (!url.endsWith('.ts') && !url.endsWith('.tsx') && !url.endsWith('.js') && !url.endsWith('.jsx')) {
      url += '.ts'; // Simplified, assuming typescript source files
    }
    return nextResolve(url, context);
  }
  return nextResolve(specifier, context);
}
