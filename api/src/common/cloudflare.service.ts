import { Injectable } from '@nestjs/common';

@Injectable()
export class CloudflareService {
  private readonly apiToken = process.env.CLOUDFLARE_API_TOKEN || '';
  private readonly accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  private readonly pagesProject = process.env.CLOUDFLARE_PAGES_PROJECT || 'turnera';
  private readonly baseDomain = process.env.CLOUDFLARE_BASE_DOMAIN || 'barberiaalem.com';

  async registerSubdomain(slug: string): Promise<boolean> {
    if (!this.apiToken || !this.accountId) {
      console.warn('Cloudflare not configured, skipping subdomain registration');
      return false;
    }

    const domain = `${slug}.${this.baseDomain}`;
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/pages/projects/${this.pagesProject}/domains`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: domain }),
        },
      );
      const data = await res.json() as any;
      if (data.result) {
        console.log(`Subdomain registered: ${domain}`);
        return true;
      }
      console.error(`Failed to register subdomain ${domain}:`, data.errors);
      return false;
    } catch (err) {
      console.error(`Error registering subdomain ${domain}:`, err);
      return false;
    }
  }
}
