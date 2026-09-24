"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// Serve llms.txt
router.get('/llms.txt', (req, res) => {
    const filePath = path_1.default.join(__dirname, '../../public/llms.txt');
    if (fs_1.default.existsSync(filePath)) {
        res.type('text/plain').send(fs_1.default.readFileSync(filePath, 'utf8'));
    }
    else {
        res.status(404).json({ error: 'llms.txt not found' });
    }
});
// Serve agents.json
router.get('/agents.json', (req, res) => {
    const filePath = path_1.default.join(__dirname, '../../public/agents.json');
    if (fs_1.default.existsSync(filePath)) {
        res.type('application/json').send(fs_1.default.readFileSync(filePath, 'utf8'));
    }
    else {
        res.status(404).json({ error: 'agents.json not found' });
    }
});
// Serve openapi.yaml
router.get('/openapi.yaml', (req, res) => {
    const filePath = path_1.default.join(__dirname, '../openapi.yaml');
    if (fs_1.default.existsSync(filePath)) {
        res.type('text/yaml').send(fs_1.default.readFileSync(filePath, 'utf8'));
    }
    else {
        res.status(404).json({ error: 'openapi.yaml not found' });
    }
});
exports.default = router;
//# sourceMappingURL=discovery.routes.js.map