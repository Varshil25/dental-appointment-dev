import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'yaml';
import swaggerUi from 'swagger-ui-express';

const __dirname = dirname(fileURLToPath(import.meta.url));
const specText = readFileSync(join(__dirname, 'openapi.yaml'), 'utf8');
export const openapiSpec = parse(specText);

// Mounts Swagger UI at /api-docs and the raw spec at /api-docs.json —
// documents the gateway's public /api/* surface, which is the same
// contract regardless of which backend service actually handles a route.
export function mountDocs(app) {
  app.get('/api-docs.json', (_req, res) => res.json(openapiSpec));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
}
