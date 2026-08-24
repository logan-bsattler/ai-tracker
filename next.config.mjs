import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const isStatic = process.env.NEXT_PUBLIC_STATIC_EXPORT === '1';

// GitHub Pages serves a project site under /<repo>, so assets and links need
// that prefix. Overridable for a custom domain, where the prefix is empty.
const basePath = process.env.PAGES_BASE_PATH ?? (isStatic ? '/ai-tracker' : '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: isStatic,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  ...(isStatic
    ? {
        output: 'export',
        basePath,
        // Pages has no rewrite layer, so emit /compare/index.html rather than
        // /compare.html — otherwise nested routes 404.
        trailingSlash: true,
      }
    : {}),

  webpack(config, { webpack }) {
    if (isStatic) {
      // Swap the "use server" module out of the graph entirely; its mere
      // presence fails an export build ("Server Actions are not supported with
      // static export"). resolve.alias loses to the tsconfig-paths resolver
      // that maps "@/*", so intercept the request before resolution instead.
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^@\/lib\/actions$/,
          path.join(dir, 'lib/actions.stub.ts'),
        ),
      );
    }
    return config;
  },
};

export default nextConfig;
