import { Router } from 'express';
import path from 'path';
import fs from 'fs';

const router = Router();

// Serve llms.txt
router.get('/llms.txt', (req, res) => {
  const filePath = path.join(__dirname, '../../public/llms.txt');
  if (fs.existsSync(filePath)) {
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf8'));
  } else {
    res.status(404).json({ error: 'llms.txt not found' });
  }
});

// Serve agents.json
router.get('/agents.json', (req, res) => {
  const filePath = path.join(__dirname, '../../public/agents.json');
  if (fs.existsSync(filePath)) {
    res.type('application/json').send(fs.readFileSync(filePath, 'utf8'));
  } else {
    res.status(404).json({ error: 'agents.json not found' });
  }
});

// Serve openapi.yaml
router.get('/openapi.yaml', (req, res) => {
  const filePath = path.join(__dirname, '../openapi.yaml');
  if (fs.existsSync(filePath)) {
    res.type('text/yaml').send(fs.readFileSync(filePath, 'utf8'));
  } else {
    res.status(404).json({ error: 'openapi.yaml not found' });
  }
});

export default router;
