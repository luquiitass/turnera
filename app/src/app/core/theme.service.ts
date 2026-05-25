import { Injectable } from '@angular/core';

export type AppTheme = 'theme-light' | 'theme-gold' | 'theme-light';

export interface ThemeOption {
  id: AppTheme;
  name: string;
  description: string;
  colors: [string, string, string]; // [background, surface, accent]
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'theme-light',
    name: 'Midnight',
    description: 'Oscuro y elegante',
    colors: ['#0d0d14', '#1a1a2e', '#4f8ef7'],
  },
  {
    id: 'theme-gold',
    name: 'Classic Gold',
    description: 'Dorado y lujoso',
    colors: ['#0e0c07', '#1c1a0e', '#d4a017'],
  },
  {
    id: 'theme-light',
    name: 'Clean Light',
    description: 'Claro y moderno',
    colors: ['#f5f5f7', '#ffffff', '#2563eb'],
  },
];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'app_theme';
  private readonly ALL: AppTheme[] = ['theme-light', 'theme-gold', 'theme-light'];

  load(): void {
    const saved = (localStorage.getItem(this.KEY) as AppTheme) || 'theme-light';
    this.apply(saved);
  }

  apply(theme: AppTheme): void {
    document.body.classList.remove(...this.ALL);
    document.body.classList.add(theme);
    localStorage.setItem(this.KEY, theme);
  }

  current(): AppTheme {
    return (localStorage.getItem(this.KEY) as AppTheme) || 'theme-light';
  }
}
