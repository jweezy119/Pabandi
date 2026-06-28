import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, Request, Response } from 'express';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Pabandi B2B API',
      version: '1.0.0',
      description: 'API for Pabandi ecosystem integrations (Odoo, Cal.com, etc.)',
    },
    servers: [
      {
        url: 'https://pabandi-backend-97129395003.asia-south1.run.app',
        description: 'Production server'
      },
      {
        url: 'http://localhost:8080',
        description: 'Local development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
        }
      },
    },
    security: [
      {
        bearerAuth: [],
        apiKeyAuth: []
      },
    ],
  },
  // Paths to files containing OpenAPI definitions
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express) => {
  // Swagger Page
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Docs in JSON format
  app.get('/api/docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
};
