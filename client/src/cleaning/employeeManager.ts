import { CleaningBusinessSystem } from '../src/cleaning/businessSystem';

export class EmployeeManager {
  private employees: Map<string, any> = new Map();

  init() {
    // Load employees from database or initialize defaults
    this.employees.set('emp-001', {
      id: 'emp-001',
      name: 'Alex Johnson',
      role: 'Senior Cleaner',
      hoursPerDay: 8,
      skills: ['kitchen', 'bathroom', 'general'],
      availability: ['mon', 'wed', 'fri']
    });
    this.employees.set('emp-002', {
      id: 'emp-002',
      name: 'Maria Garcia',
      role: 'Junior Cleaner',
      hoursPerDay: 8,
      skills: ['kitchen', 'living room'],
      availability: ['mon', 'thu']
    });
    this.employees.set('emp-003', {
      id: 'emp-003',
      name: 'James Wilson',
      role: 'Team Lead',
      hoursPerDay: 8,
      skills: ['all'],
      availability: ['mon', 'tue', 'wed', 'thu', 'fri']
    });
  }

  /**
   * Assign an employee to a job
   * @param employeeId - Employee ID
   * @param jobId - Job ID
   * @returns Assignment record
   */
  assignEmployee(employeeId: string, jobId: string): any {
    const employee = this.employees.get(employeeId);
    const job = this.crmService.getJob(jobId);

    if (!employee || !job) {
      throw new Error(`Invalid employee or job ID`);
    }

    const assignment = {
      id: this.generateId(),
      employeeId,
      jobId,
      assignedAt: new Date(),
      status: 'assigned',
      shift: job.shiftId
    };

    this.employees.set(employeeId, { ...employee, assignedJobs: [...(employee.skills || []), job.skills] });
    return assignment;
  }

  getAvailableEmployees(role: string): string[] {
    return Array.from(this.employees.values()).filter(e => e.role.includes(role));
  }

  generateSchedule(date: string): any[] {
    // Generate daily schedule based on employee availability
    const schedule: any[] = [];
    
    for (let day = 1; day <= 7; day++) {
      const dateStr = `${date}-${day}`;
      const employees = this.getAvailableEmployees('cleaner');
      
      for (const emp of employees) {
        const shift = this.findBestShift(emp, dateStr);
        if (shift) {
          schedule.push({
            date: dateStr,
            employeeId: emp.id,
            shift: shift,
            status: 'scheduled'
          });
        }
      }
    }
    
    return schedule;
  }

  private findBestShift(employee: any, date: string): any | null {
    // Find the earliest available shift for this employee on the given date
    // In a real system, this would check against existing assignments
    return {
      employeeId: employee.id,
      shift: {
        start: date.substring(0, 7), // Simplified - would be actual time
        end: date.substring(0, 7) + 'pm',
        zone: 'central'
      }
    };
  }

  generateId() {
    return 'emp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
  }
}

export default EmployeeManager;