import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, DollarSign, TrendingUp, AlertTriangle, Calendar,
  CheckSquare, BarChart3, Star, Clock, Target
} from 'lucide-react';
import { RevenueWidget } from './RevenueWidget';
import { PipelineFunnelWidget } from './PipelineFunnelWidget';
import { ClientHealthWidget } from './ClientHealthWidget';
import { ActivityMetricsWidget } from './ActivityMetricsWidget';
import { TaskBoard } from './TaskBoard';
import { JobCalendar } from './JobCalendar';
import {
  StatsOverviewWidget, AlertsWidget, TeamWidget, GoalsWidget,
} from './dashboardWidgets';
import type { DashboardData } from './useDashboardData';

/**
 * WIDGET COMPONENTS
 *
 * Every entry here was `component: () => null`. The registry rendered a bordered
 * box per widget with a title and an empty interior, so the whole body of the
 * Contact OS dashboard was blank — which reads from outside as a page that is not
 * loading, and cost three separate reports before anyone read it as "the widgets
 * were never implemented" rather than "the page is broken".
 *
 * The components below are the ones the reports page has been rendering all along
 * (ReportWidgetGrid); they were never imported here. Each adapter pulls its own
 * slice out of the single `data` prop and forwards it, because these widgets take
 * their props positionally and the registry passes one object.
 *
 * `WidgetDefinition.component` stays `ComponentType<{ data?: Record<string, unknown> }>`
 * rather than being widened to DashboardData: the saved layout on a server is a
 * list of ids, so any widget can appear against any data, and a narrow cast at the
 * boundary keeps that from becoming a compile error at every call site.
 *
 * The registry hands over `Record<string, unknown>`; at runtime it is always
 * DashboardData.
 */
const asData = (data?: Record<string, unknown>) => data as unknown as DashboardData;

/**
 * TaskBoard and JobCalendar take an `onClick` callback, so they cannot be wired
 * as bare expressions the way the rest are — they need a component to hold the
 * navigate hook. Both navigate to the real detail route; the dashboard is a
 * window onto those pages, not a dead end.
 */
function TasksWidget({ data }: { data?: Record<string, unknown> }) {
  const navigate = useNavigate();
  return (
    <TaskBoard
      tasks={asData(data)?.tasks ?? []}
      onTaskClick={() => navigate('/contact/tasks')}
    />
  );
}

function CalendarWidget({ data }: { data?: Record<string, unknown> }) {
  const navigate = useNavigate();
  return (
    <JobCalendar
      jobs={asData(data)?.jobs ?? []}
      onJobClick={(id) => navigate(`/contact/jobs/${id}`)}
    />
  );
}

export interface WidgetDefinition {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  category: 'stats' | 'pipeline' | 'activity' | 'financial' | 'team';
  defaultWidth: 'half' | 'full';
  defaultVisible: boolean;
  component: React.ComponentType<{ data?: Record<string, unknown> }>;
}

export interface WidgetInstance {
  id: string;
  widgetId: string;
  visible: boolean;
  width: 'half' | 'full';
  position: number;
}

export interface DashboardTheme {
  accentColor: string;
  bannerColor: string;
  density: 'compact' | 'comfortable' | 'spacious';
  borderRadius: 'sharp' | 'rounded' | 'pill';
}

export const DEFAULT_THEME: DashboardTheme = {
  accentColor: '#C97B5A',
  bannerColor: '#C97B5A',
  density: 'comfortable',
  borderRadius: 'rounded',
};

export const WIDGET_REGISTRY: WidgetDefinition[] = [
  {
    id: 'stats-overview',
    title: 'Stats Overview',
    description: 'Key business metrics at a glance',
    icon: BarChart3,
    category: 'stats',
    defaultWidth: 'full',
    defaultVisible: true,
    component: ({ data }) => <StatsOverviewWidget data={asData(data)} />,
  },
  {
    id: 'revenue',
    title: 'Revenue',
    description: 'Billed, collected, and outstanding',
    icon: DollarSign,
    category: 'financial',
    defaultWidth: 'half',
    defaultVisible: true,
    component: ({ data }) => <RevenueWidget hideHeader data={asData(data)?.revenue} loading={!!asData(data)?.loading} />,
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    description: 'Deals by stage with conversion rates',
    icon: TrendingUp,
    category: 'pipeline',
    defaultWidth: 'full',
    defaultVisible: true,
    component: ({ data }) => <PipelineFunnelWidget hideHeader data={asData(data)?.pipeline ?? []} loading={!!asData(data)?.loading} />,
  },
  {
    id: 'clients',
    title: 'Client Health',
    description: 'At-risk, new, and VIP clients',
    icon: Users,
    category: 'stats',
    defaultWidth: 'half',
    defaultVisible: true,
    component: ({ data }) => <ClientHealthWidget hideHeader data={asData(data)?.clientHealth} loading={!!asData(data)?.loading} />,
  },
  {
    id: 'activities',
    title: 'Activity Feed',
    description: 'Recent calls, emails, and meetings',
    icon: Clock,
    category: 'activity',
    defaultWidth: 'half',
    defaultVisible: true,
    component: ({ data }) => <ActivityMetricsWidget hideHeader data={asData(data)?.activity} loading={!!asData(data)?.loading} />,
  },
  {
    id: 'tasks',
    title: 'Tasks',
    description: 'Open and completed tasks',
    icon: CheckSquare,
    category: 'activity',
    defaultWidth: 'half',
    defaultVisible: false,
    component: ({ data }) => <TasksWidget data={data} />,
  },
  {
    id: 'alerts',
    title: 'Alerts',
    description: 'Trust and revenue alerts',
    icon: AlertTriangle,
    category: 'stats',
    defaultWidth: 'half',
    defaultVisible: true,
    component: ({ data }) => <AlertsWidget data={asData(data)} />,
  },
  {
    id: 'calendar',
    title: 'Calendar',
    description: 'Upcoming jobs and appointments',
    icon: Calendar,
    category: 'activity',
    defaultWidth: 'half',
    defaultVisible: false,
    component: ({ data }) => <CalendarWidget data={data} />,
  },
  {
    id: 'team',
    title: 'Team Performance',
    description: 'Employee stats and leaderboard',
    icon: Star,
    category: 'team',
    defaultWidth: 'half',
    defaultVisible: false,
    component: ({ data }) => <TeamWidget data={asData(data)} />,
  },
  {
    id: 'goals',
    title: 'Goals',
    description: 'Revenue and growth targets',
    icon: Target,
    category: 'financial',
    defaultWidth: 'half',
    defaultVisible: false,
    component: ({ data }) => <GoalsWidget data={asData(data)} />,
  },
];

export function getDefaultLayout(): WidgetInstance[] {
  return WIDGET_REGISTRY.map((w, i) => ({
    id: `widget-${w.id}`,
    widgetId: w.id,
    visible: w.defaultVisible,
    width: w.defaultWidth,
    position: i,
  }));
}

export function getWidgetDefinition(widgetId: string): WidgetDefinition | undefined {
  return WIDGET_REGISTRY.find(w => w.id === widgetId);
}
