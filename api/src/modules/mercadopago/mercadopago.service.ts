import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import MercadoPagoConfig, { PreApproval, PreApprovalPlan, Preference, Payment } from 'mercadopago';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BankAccountsService } from '../bank-accounts/bank-accounts.service.js';

@Injectable()
export class MercadoPagoService {
  private readonly client: MercadoPagoConfig;

  private readonly accessToken   = process.env.MP_ACCESS_TOKEN ?? '';
  private readonly clientId      = process.env.MP_CLIENT_ID ?? '';
  private readonly clientSecret  = process.env.MP_CLIENT_SECRET ?? '';
  private readonly commissionRate = parseFloat(process.env.MP_PLATFORM_COMMISSION_RATE ?? '0.10');
  private readonly minDepositRate = parseFloat(process.env.MP_MIN_DEPOSIT_RATE ?? '0.30');
  private readonly subscriptionAmount = parseFloat(process.env.MP_SUBSCRIPTION_AMOUNT ?? '10000');
  private readonly apiUrl  = process.env.API_URL  ?? 'http://localhost:3000';
  private readonly appUrl  = process.env.APP_URL  ?? 'http://localhost:4200';

  private get publicAppUrl(): string {
    return this.appUrl.includes('localhost') ? (process.env.MP_PUBLIC_URL ?? 'https://turnera.es') : this.appUrl;
  }
  private get publicApiUrl(): string {
    return this.apiUrl.includes('localhost') ? (process.env.MP_PUBLIC_URL ?? 'https://turnera.es') : this.apiUrl;
  }

  constructor(
    private prisma: PrismaService,
    private bankAccountsService: BankAccountsService,
  ) {
    this.client = new MercadoPagoConfig({ accessToken: this.accessToken });
  }

  // ==================== OAUTH (para Marketplace) ====================

  getOAuthUrl(barbershopId: string): string {
    const redirectUri = encodeURIComponent(`${this.publicApiUrl}/api/mp/oauth/callback`);
    return `https://auth.mercadopago.com/authorization?client_id=${this.clientId}&response_type=code&platform_id=mp&state=${barbershopId}&redirect_uri=${redirectUri}`;
  }

  async exchangeOAuthCode(code: string, barbershopId: string) {
    const redirectUri = `${this.publicApiUrl}/api/mp/oauth/callback`;

    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_secret: this.clientSecret,
        client_id: this.clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new BadRequestException(`Error en OAuth de MP: ${error}`);
    }

    const data: any = await response.json();

    await this.bankAccountsService.saveOAuthTokens(
      barbershopId,
      String(data.user_id),
      data.access_token,
      data.refresh_token,
      data.expires_in,
    );

    return { success: true, userId: data.user_id };
  }

  async disconnectOAuth(barbershopId: string) {
    const account = await this.prisma.barbershopBankAccount.findFirst({
      where: { barbershopId, accountType: 'MP_OAUTH', isActive: true },
    });
    if (!account) throw new NotFoundException('No hay cuenta MP conectada');

    return this.prisma.barbershopBankAccount.update({
      where: { id: account.id },
      data: { isActive: false, isPrimary: false },
    });
  }

  // ==================== MODELO 2: SUSCRIPCIÓN ====================

  async createSubscriptionPlan(barbershopName = 'Tu Barbería') {
    console.log('[MP] Creando plan de suscripción, monto:', this.subscriptionAmount);
    try {
      const plan = new PreApprovalPlan(this.client);
      const result = await plan.create({
        body: {
          reason: `${barbershopName} — Suscripción mensual (Turnera)`,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: this.subscriptionAmount,
            currency_id: 'ARS',
          },
          back_url: `${this.publicAppUrl}/admin/suscripcion/resultado`,
        },
      });
      console.log('[MP] Plan creado:', result.id);
      return result;
    } catch (e: any) {
      console.error('[MP] Error creando plan:', e?.message, JSON.stringify(e?.cause ?? ''));
      throw e;
    }
  }

  async subscribeBarber(barbershopId: string, payerEmail: string) {
    const barbershop = await this.prisma.barbershop.findUnique({
      where: { id: barbershopId },
      include: { subscription: true },
    });
    if (!barbershop) throw new NotFoundException('Barbería no encontrada');

    let planId = barbershop.subscription?.mpPlanId ?? process.env.MP_PLAN_ID;
    console.log('[MP] subscribeBarber — planId:', planId);

    let plan: any;
    if (!planId) {
      plan = await this.createSubscriptionPlan(barbershop.name);
      planId = plan.id!;
    }

    const initPoint = plan?.init_point
      ?? `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${planId}`;

    await this.prisma.barbershopSubscription.upsert({
      where: { barbershopId },
      create: { barbershopId, plan: 'SUSCRIPCION', startDate: new Date(), mpPlanId: planId, isActive: false },
      update: { mpPlanId: planId, plan: 'SUSCRIPCION', isActive: false },
    });

    return { initPoint, planId };
  }

  async getSubscriptionStatus(barbershopId: string) {
    const sub = await this.prisma.barbershopSubscription.findUnique({ where: { barbershopId } });
    if (!sub?.mpPreapprovalId) return { plan: sub?.plan ?? 'GRATUITO', isActive: sub?.isActive ?? true };

    const preapproval = new PreApproval(this.client);
    const result = await preapproval.get({ id: sub.mpPreapprovalId });

    return { plan: sub.plan, isActive: sub.isActive, mpStatus: result.status, nextBillingDate: sub.nextBillingDate };
  }

  async cancelSubscription(barbershopId: string) {
    const sub = await this.prisma.barbershopSubscription.findUnique({ where: { barbershopId } });
    if (!sub?.mpPreapprovalId) throw new BadRequestException('No hay suscripción activa');

    const preapproval = new PreApproval(this.client);
    await preapproval.update({ id: sub.mpPreapprovalId, body: { status: 'cancelled' } });

    return this.prisma.barbershopSubscription.update({
      where: { barbershopId },
      data: { isActive: false, plan: 'GRATUITO' },
    });
  }

  // ==================== MODELO 3: PAGO POR RESERVA (HÍBRIDO) ====================

  async createBookingPreference(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        barber: { include: { barbershop: { include: { subscription: true } } } },
        user: true,
      },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');

    const barbershop = booking.barber.barbershop;

    const bankAccount = await this.bankAccountsService.findPrimary(barbershop.id);
    if (!bankAccount) {
      throw new BadRequestException('La barbería no tiene una cuenta de cobro configurada');
    }

    const sub = barbershop.subscription;
    const commissionRate = sub?.commissionRate ?? this.commissionRate;
    const isPlanComision = sub?.plan === 'COMISION';

    // Cálculo unificado: monto fijo o porcentaje según depositType de la barbería
    const depositAmount = (barbershop as any).depositType === 'PERCENTAGE'
      ? Math.ceil(booking.totalPrice * (barbershop as any).depositAmount / 100)
      : Math.ceil((barbershop as any).depositAmount ?? 0);

    console.log('[MP] createBookingPreference — bookingId:', bookingId, 'tipo:', bankAccount.accountType, 'plan:', sub?.plan);

    if (bankAccount.accountType === 'MP_OAUTH' && bankAccount.mpAccessToken && bankAccount.mpUserId) {
      return this.createMarketplacePreference(booking, barbershop, bankAccount, depositAmount, isPlanComision ? commissionRate : 0);
    }

    return this.createStandardPreference(booking, barbershop, bankAccount, depositAmount);
  }

  private async createMarketplacePreference(booking: any, barbershop: any, bankAccount: any, depositAmount: number, commissionRate: number) {
    const marketplaceFee = Math.round(depositAmount * commissionRate);

    const barbershopClient = new MercadoPagoConfig({ accessToken: bankAccount.mpAccessToken });
    const preference = new Preference(barbershopClient);

    let result: any;
    try {
      result = await preference.create({
        body: {
          items: [{
            id: booking.id,
            title: `${barbershop.name} — ${booking.service?.name ?? 'Reserva'}`,
            description: `Seña del turno. Resto se abona en la barbería.`,
            quantity: 1,
            unit_price: depositAmount,
            currency_id: 'ARS',
          }],
          payer: { email: booking.user?.email ?? '', name: booking.user?.firstName ?? '', surname: booking.user?.lastName ?? '' },
          marketplace_fee: marketplaceFee,
          back_urls: {
            success: `${this.appUrl}/booking?status=success&bookingId=${booking.id}`,
            failure: `${this.appUrl}/booking?status=failure&bookingId=${booking.id}`,
            pending: `${this.appUrl}/booking?status=pending&bookingId=${booking.id}`,
          },
          notification_url: `${this.publicApiUrl}/api/mp/webhook`,
          external_reference: booking.id,
        },
      });
    } catch (e: any) {
      console.error('[MP] Error Marketplace preference:', e?.message);
      throw e;
    }

    await this.prisma.booking.update({ where: { id: booking.id }, data: { mpPreferenceId: result.id } });

    console.log('[MP] Preference Marketplace creada — fee:', marketplaceFee, 'initPoint:', result.init_point?.substring(0, 60));
    return { initPoint: result.init_point, preferenceId: result.id, depositAmount, mode: 'marketplace', marketplaceFee };
  }

  private async createStandardPreference(booking: any, barbershop: any, bankAccount: any, depositAmount: number) {
    const preference = new Preference(this.client);

    let result: any;
    try {
      result = await preference.create({
        body: {
          items: [{
            id: booking.id,
            title: `${barbershop.name} — ${booking.service?.name ?? 'Reserva'}`,
            description: `Seña del turno. Resto se abona en la barbería.`,
            quantity: 1,
            unit_price: depositAmount,
            currency_id: 'ARS',
          }],
          payer: { email: booking.user?.email ?? '', name: booking.user?.firstName ?? '', surname: booking.user?.lastName ?? '' },
          back_urls: {
            success: `${this.appUrl}/booking?status=success&bookingId=${booking.id}`,
            failure: `${this.appUrl}/booking?status=failure&bookingId=${booking.id}`,
            pending: `${this.appUrl}/booking?status=pending&bookingId=${booking.id}`,
          },
          notification_url: `${this.publicApiUrl}/api/mp/webhook`,
          external_reference: booking.id,
        },
      });
    } catch (e: any) {
      console.error('[MP] Error Standard preference:', e?.message);
      throw e;
    }

    await this.prisma.booking.update({ where: { id: booking.id }, data: { mpPreferenceId: result.id } });

    console.log('[MP] Preference Standard creada — depositAmount:', depositAmount, 'initPoint:', result.init_point?.substring(0, 60));
    return { initPoint: result.init_point, preferenceId: result.id, depositAmount, mode: 'standard' };
  }

  // ==================== TRANSFER API ====================

  private async transferToBankAccount(bankAccount: any, amount: number, description: string): Promise<string> {
    const body: any = {
      amount,
      currency_id: 'ARS',
      description,
    };

    if (bankAccount.accountType === 'MP_OAUTH' && bankAccount.mpUserId) {
      body.receiver = { type: 'user', id: bankAccount.mpUserId };
    } else {
      body.receiver = {
        type: 'bank_account',
        bank_account: { id: bankAccount.cbuCvu },
      };
    }

    const response = await fetch('https://api.mercadopago.com/v1/account/bank_transfers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${bankAccount.id}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[MP] Error Transfer API:', error);
      throw new Error(`Transfer API falló: ${response.status} — ${error}`);
    }

    const data: any = await response.json();
    console.log('[MP] Transferencia ejecutada — id:', data.id, 'amount:', amount);
    return String(data.id);
  }

  // ==================== VERIFICACIÓN MANUAL ====================

  async verifyBookingPayment(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { barber: { include: { barbershop: { include: { subscription: true, bankAccounts: { where: { isPrimary: true, isActive: true } } } } } } },
    });
    if (!booking) throw new NotFoundException('Reserva no encontrada');
    if (booking.depositPaid) return { status: 'already_paid', depositPaid: true };
    if (!booking.mpPreferenceId) return { status: 'no_preference', depositPaid: false };

    // Buscar pagos aprobados en MP para esta preferencia
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/search?external_reference=${bookingId}&status=approved`,
      { headers: { 'Authorization': `Bearer ${this.accessToken}` } },
    );

    if (!response.ok) throw new Error('Error consultando MP');
    const data: any = await response.json();
    const mpPayment = data.results?.[0];

    if (!mpPayment) return { status: 'not_paid', depositPaid: false };

    // Pago encontrado en MP → procesar igual que el webhook
    console.log('[MP] Verificación manual — pago encontrado:', mpPayment.id);
    await this.handlePaymentWebhook(String(mpPayment.id));
    return { status: 'payment_processed', depositPaid: true, mpPaymentId: mpPayment.id };
  }

  // ==================== WEBHOOK ====================

  async handleWebhook(type: string, data: any) {
    if (type === 'payment') return this.handlePaymentWebhook(data.id);
    if (type === 'subscription_authorized_payment') return this.handleSubscriptionPaymentWebhook(data.id);
    if (type === 'subscription_preapproval') return this.handlePreapprovalWebhook(data.id);
  }

  private async handlePaymentWebhook(mpPaymentId: string) {
    const mpPayment = new Payment(this.client);
    const payment = await mpPayment.get({ id: mpPaymentId });

    if (payment.status !== 'approved') return { received: true };

    const bookingId = payment.external_reference;
    if (!bookingId) return { received: true };

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        barber: {
          include: { barbershop: { include: { subscription: true, bankAccounts: { where: { isPrimary: true, isActive: true } } } } },
        },
      },
    });
    if (!booking) return { received: true };

    const barbershop    = booking.barber.barbershop;
    const sub           = barbershop.subscription;
    const bankAccount   = barbershop.bankAccounts[0] ?? null;
    const grossAmount   = payment.transaction_amount ?? 0;
    const mpFeeAmount   = Math.round(grossAmount * 0.0599 * 100) / 100;
    const isPlanComision = sub?.plan === 'COMISION';
    const commissionRate = sub?.commissionRate ?? this.commissionRate;
    const platformFee    = isPlanComision ? Math.round(grossAmount * commissionRate * 100) / 100 : 0;
    const barbershopNet  = Math.round((grossAmount - mpFeeAmount - platformFee) * 100) / 100;

    // Determinar si requiere transferencia (Flujo B: cuenta CBU/CVU)
    const needsTransfer = bankAccount && bankAccount.accountType !== 'MP_OAUTH';
    // En Marketplace el dinero ya llegó a la barbería automáticamente
    const isMarketplace = bankAccount?.accountType === 'MP_OAUTH';

    let transferStatus: 'NOT_REQUIRED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' =
      isMarketplace ? 'NOT_REQUIRED' : needsTransfer ? 'PENDING' : 'NOT_REQUIRED';

    // Evitar duplicados si el webhook llega más de una vez
    const existing = await this.prisma.payment.findFirst({
      where: { mpPaymentId: String(mpPaymentId) },
    });
    if (existing) return { received: true, duplicate: true };

    const platformTx = await this.prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: { mpPaymentId: String(mpPaymentId), depositPaid: true, status: 'CONFIRMADA' },
      });

      // Crear registro de pago en tabla payments
      await tx.payment.create({
        data: {
          bookingId,
          type:        'SENA',
          method:      'MERCADOPAGO',
          status:      'APROBADO',
          amount:      grossAmount,
          grossAmount,
          mpFee:       Math.round(mpFeeAmount * 100) / 100,
          platformFee: Math.round(platformFee * 100) / 100,
          netAmount:   Math.round(barbershopNet * 100) / 100,
          mpPaymentId: String(mpPaymentId),
          paidAt:      new Date(),
        },
      });

      return tx.platformTransaction.create({
        data: {
          barbershopId: barbershop.id,
          bookingId,
          bankAccountId: bankAccount?.id ?? null,
          type: isPlanComision ? 'commission' : 'subscription_booking',
          grossAmount,
          platformFee,
          barbershopNet,
          mpPaymentId: String(mpPaymentId),
          mpStatus: payment.status,
          status: 'confirmed',
          transferStatus,
        },
      });
    });

    // Ejecutar transferencia inmediata si es Flujo B
    if (needsTransfer && bankAccount) {
      try {
        await this.prisma.platformTransaction.update({
          where: { id: platformTx.id },
          data: { transferStatus: 'PROCESSING' },
        });

        const transferId = await this.transferToBankAccount(
          bankAccount,
          barbershopNet,
          `Turno ${bookingId} — ${barbershop.name}`,
        );

        await this.prisma.platformTransaction.update({
          where: { id: platformTx.id },
          data: { transferStatus: 'COMPLETED', transferredAt: new Date(), mpPaymentId: transferId },
        });

        console.log('[MP] Transferencia completada — barbershopNet:', barbershopNet, 'cbuCvu:', bankAccount.cbuCvu);
      } catch (err: any) {
        console.error('[MP] Transferencia fallida:', err.message);
        await this.prisma.platformTransaction.update({
          where: { id: platformTx.id },
          data: { transferStatus: 'FAILED' },
        });
      }
    }

    return {
      received: true,
      bookingId,
      mode: isMarketplace ? 'marketplace' : 'standard',
      platformFee,
      barbershopNet,
      transferStatus: needsTransfer ? 'executed' : 'not_required',
    };
  }

  private async handleSubscriptionPaymentWebhook(authorizedPaymentId: string) {
    const sub = await this.prisma.barbershopSubscription.findFirst({ where: { mpPreapprovalId: { not: null } } });
    if (!sub) return { received: true };

    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    await this.prisma.$transaction([
      this.prisma.barbershopSubscription.update({
        where: { id: sub.id },
        data: { isActive: true, nextBillingDate: nextBilling },
      }),
      this.prisma.platformTransaction.create({
        data: {
          barbershopId: sub.barbershopId,
          type: 'subscription',
          grossAmount: this.subscriptionAmount,
          platformFee: this.subscriptionAmount,
          mpPaymentId: String(authorizedPaymentId),
          mpStatus: 'approved',
          status: 'confirmed',
          transferStatus: 'NOT_REQUIRED',
        },
      }),
    ]);

    return { received: true };
  }

  private async handlePreapprovalWebhook(preapprovalId: string) {
    const preapproval = new PreApproval(this.client);
    const result = await preapproval.get({ id: preapprovalId });
    const planId = (result as any).preapproval_plan_id;

    const sub = await this.prisma.barbershopSubscription.findFirst({
      where: { OR: [{ mpPreapprovalId: preapprovalId }, ...(planId ? [{ mpPlanId: planId }] : [])] },
    });
    if (!sub) return { received: true };

    const isActive = result.status === 'authorized';
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    await this.prisma.barbershopSubscription.update({
      where: { id: sub.id },
      data: { isActive, mpPreapprovalId: preapprovalId, ...(isActive ? { nextBillingDate: nextBilling } : {}) },
    });

    return { received: true, status: result.status };
  }
}
