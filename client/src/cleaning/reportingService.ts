import { CleaningBusinessSystem } from '../src/cleaning/businessSystem';

export class ReportingService {
  private reports: Map<string, any> = new Map();

  /**
   * Generate a client health report
   * @param clientId - Client ID
   * @returns Client report summary
   */
  generateClientReport(clientId: string): any {
    const client = this.crmService.getClient(clientId);
    if (!client) throw new Error(`Client ${clientId} not found`);

    const report = {
      clientId,
      name: client.name,
      tenureMonths: client.tenureMonths,
      subscriptionTier: client.subscriptionTier,
      totalSpent: this.subscriptionEngine.getTotalSpent(clientId),
      discountApplied: this.discountEngine.getActiveDiscounts(clientId).length,
      upcomingAppointments: this.crmService.getUpcomingAppointments(clientId).length,
      riskLevel: this.calculateRiskLevel(clientId),
      lastActivity: client.lastActivity
    };

    this.reports.set(clientId, report);
    return report;
  }

  /**
   * Generate a daily productivity report
   * @param date - Date for the report
   * @returns Daily productivity metrics
   */
  generateDailyReport(date: string): any {
    const today = new Date(date);
    const report = {
      date: today.toISOString().split('T')[0],
      totalBookings: this.crmService.getBookingsForDate(date),
      totalHours: this.crmService.getTotalHoursForDate(date),
      completedTasks: this.crmService.getCompletedTasksForDate(date),
      teamPerformance: this.employeeManager.getTeamPerformance(date)
    };

    this.reports.set(report.date, report);
    return report;
  }

  /**
   * Generate a profit and loss summary
   * @returns Financial summary
   */
  generateP&LReport(): any {
    const pnl = {
      totalRevenue: this.crmService.getTotalRevenue(),
      totalExpenses: this.crmService.getTotalExpenses(),
      netProfit: this.crmService.getNetProfit(),
      growthRate: this.crmService.getGrowthRate()
    };

    this.reports.set('p&l', pnl);
    return pnl;
  }

  private calculateRiskLevel(clientId: string): 'low' | 'medium' | 'high' {
    const client = this.crmService.getClient(clientId);
    if (!client) throw new Error(`Client ${clientId} not found`);

    // Risk factors: low tenure, high risk score, few appointments
    if (client.tenureMonths < 3) return 'high';
    if (client.riskScore > 7) return 'high';
    if (client.appointmentCount < 5) return 'medium';
    return 'low';
  }

  private getTeamPerformance(date: string): any[] {
    // Get performance metrics for the team on the given date
    const team = this.employeeManager.getAvailableEmployees('cleaner');
    return team.map(emp => ({
      employeeId: emp.id,
      name: emp.name,
      hoursWorked: this.employeeManager.getHoursWorked(emp.id, date),
      tasksCompleted: this.employeeManager.getTasksCompleted(emp.id, date)
    }));
  }
}

export default ReportingService;