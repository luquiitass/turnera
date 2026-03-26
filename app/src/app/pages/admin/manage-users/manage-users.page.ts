import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  standalone: false,
  selector: 'app-manage-users',
  templateUrl: './manage-users.page.html',
  styleUrls: ['./manage-users.page.scss'],
})
export class ManageUsersPage implements OnInit {
  users: any[] = [];
  isLoading = false;
  total = 0;
  page = 1;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading = true;
    this.http.get<any>(`${environment.apiUrl}/users?page=${this.page}&limit=20`).subscribe({
      next: (res) => {
        this.users = res.data.data;
        this.total = res.data.total;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  getRoleLabel(roles: string[]): string {
    const labels: Record<string, string> = {
      ADMIN_GENERAL: 'Admin General',
      ADMIN_BARBERSHOP: 'Admin Barberia',
      SUB_ADMIN: 'Sub-Admin',
      USUARIO: 'Usuario',
    };
    return roles.map(r => labels[r] || r).join(', ');
  }
}
