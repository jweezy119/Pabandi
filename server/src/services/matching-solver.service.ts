import { spawn } from 'child_process';
import { logger } from '../utils/logger';
import path from 'path';

export interface Agent {
  id: string;
  name: string;
  location: string;
  skills: string[];
  availabilityBlocks: Array<{ start: number; end: number }>;
  trustScore: number;
}

export interface Venue {
  id: string;
  name: string;
  location: string;
  capacity: number;
  openHours: Array<{ start: number; end: number }>;
  costPerHour: number;
}

export interface Manager {
  id: string;
  name: string;
  shifts: Array<{ start: number; end: number }>;
  skills: string[];
}

export interface Job {
  id: string;
  title: string;
  requiredSkills: string[];
  budgetUsd: number;
  location: string;
  durationHours: number;
  startTime: number; // hour-of-day or epoch minutes
}

export interface MatchResult {
  success: boolean;
  solverStatus?: string;
  objectiveValue?: number;
  assignment?: {
    agent: Agent;
    venue: Venue;
    manager: Manager;
  };
  error?: string;
}

export class MatchingSolverService {
  private pythonScriptPath: string;

  constructor() {
    this.pythonScriptPath = path.join(__dirname, '..', 'scripts', 'matching_solver.py');
  }

  /**
   * Solve the optimal agent-venue-manager assignment using OR-Tools CP-SAT.
   * Runs the Python solver as a subprocess with JSON I/O.
   */
  async solveOptimalMatch(
    job: Job,
    availableAgents: Agent[],
    venues: Venue[],
    managers: Manager[],
  ): Promise<MatchResult> {
    return new Promise((resolve, reject) => {
      const input = {
        job,
        availableAgents,
        venues,
        managers,
      };

      const pythonProcess = spawn('python3', [this.pythonScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      pythonProcess.stdin.write(JSON.stringify(input));
      pythonProcess.stdin.end();

      pythonProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      pythonProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      pythonProcess.on('close', (code: number) => {
        if (code !== 0) {
          logger.error('[MatchingSolver] Python process exited with code', code, stderr);
          reject(new Error(`Solver process failed: ${stderr || 'unknown error'}`));
          return;
        }

        try {
          const result: MatchResult = JSON.parse(stdout);
          resolve(result);
        } catch (parseError) {
          logger.error('[MatchingSolver] Failed to parse solver output:', stdout, stderr);
          reject(new Error(`Failed to parse solver output: ${stdout}`));
        }
      });

      pythonProcess.on('error', (err) => {
        logger.error('[MatchingSolver] Failed to spawn Python process:', err);
        reject(new Error(`Failed to start solver: ${err.message}`));
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        pythonProcess.kill();
        reject(new Error('Solver timeout'));
      }, 60000);
    });
  }
}

export const matchingSolver = new MatchingSolverService();
