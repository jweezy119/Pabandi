"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
// Disable swagger auto-scanning at startup (it eagerly loads all route files, consuming memory)
// Swagger will scan routes on-demand via a lazy endpoint
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Pabandi Live Commerce API',
            version: '1.0.0',
            description: 'Pabandi live commerce API: escrowed bookings, merchant control plane, hosted checkout webhooks, trust passport, and integrations for buyers and sellers.',
        },
        servers: [
            {
                url: 'https://pabandi-backend-97129395003.asia-south1.run.app',
                description: 'Production server'
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
    apis: [], // Lazy: routes loaded on-demand to reduce startup memory
};
const swaggerSpec = (0, swagger_jsdoc_1.default)(options);
const setupSwagger = (app) => {
    // Swagger Page
    app.use('/api/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpec));
    // Docs in JSON format
    app.get('/api/docs.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
};
exports.setupSwagger = setupSwagger;
//# sourceMappingURL=swagger.js.map