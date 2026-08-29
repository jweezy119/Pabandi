"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
// Regenerate the Prisma client at runtime BEFORE the @prisma/client singleton
// is constructed (must be the first import). See file for why.
require("./ensurePrisma");
const client_1 = require("@prisma/client");
const logger_1 = require("./logger");
const prismaClientSingleton = () => {
    return new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['query', 'error', 'warn']
            : ['error'],
    });
};
exports.prisma = globalThis.prismaGlobal ?? prismaClientSingleton();
if (process.env.NODE_ENV !== 'production') {
    globalThis.prismaGlobal = exports.prisma;
}
// Graceful shutdown
process.on('beforeExit', async () => {
    await exports.prisma.$disconnect();
    logger_1.logger.info('Database connection closed');
});
exports.default = exports.prisma;
//# sourceMappingURL=database.js.map