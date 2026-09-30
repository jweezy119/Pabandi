import React from 'react';
import {
  Users, DollarSign, TrendingUp, AlertTriangle, Calendar,
  CheckSquare, BarChart3, Star, Clock, Target
} from 'lucide-react';

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
    component: () => null,
  },
  {
    id: 'revenue',
    title: 'Revenue',
    description: 'Billed, collected, and outstanding',
    icon: DollarSign,
    category: 'financial',
    defaultWidth: 'half',
    defaultVisible: true,
    component: () => null,
  },
  {
    id: 'pipeline',
    title: 'Pipeline',
    description: 'Deals by stage with conversion rates',
    icon: TrendingUp,
    category: 'pipeline',
    defaultWidth: 'full',
    defaultVisible: true,
    component: () => null,
  },
  {
    id: 'clients',
    title: 'Client Health',
    description: 'At-risk, new, and VIP clients',
    icon: Users,
    category: 'stats',
    defaultWidth: 'half',
    defaultVisible: true,
    component: () => null,
  },
  {
    id: 'activities',
    title: 'Activity Feed',
    description: 'Recent calls, emails, and meetings',
    icon: Clock,
    category: 'activity',
    defaultWidth: 'half',
    defaultVisible: true,
    component: () => null,
  },
  {
    id: 'tasks',
    title: 'Tasks',
    description: 'Open and completed tasks',
    icon: CheckSquare,
    category: 'activity',
    defaultWidth: 'half',
    defaultVisible: false,
    component: () => null,
  },
  {
    id: 'alerts',
    title: 'Alerts',
    description: 'Trust and revenue alerts',
    icon: AlertTriangle,
    category: 'stats',
    defaultWidth: 'half',
    defaultVisible: true,
    component: () => null,
  },
  {
    id: 'calendar',
    title: 'Calendar',
    description: 'Upcoming jobs and appointments',
    icon: Calendar,
    category: 'activity',
    defaultWidth: 'half',
    defaultVisible: false,
    component: () => null,
  },
  {
    id: 'team',
    title: 'Team Performance',
    description: 'Employee stats and leaderboard',
    icon: Star,
    category: 'team',
    defaultWidth: 'half',
    defaultVisible: false,
    component: () => null,
  },
  {
    id: 'goals',
    title: 'Goals',
    description: 'Revenue and growth targets',
    icon: Target,
    category: 'financial',
    defaultWidth: 'half',
    defaultVisible: false,
    component: () => null,
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
