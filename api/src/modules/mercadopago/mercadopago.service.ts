import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import MercadoPagoConfig, { PreApproval, PreApprovalPlan, Preference, Payment } from 'mercadopago';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class MercadoPagoService {
  private readonly client: MercadoPagoConfig;

  private readonly accessToken = process.env.MP_ACCESS_TOKEN ?? '';
  private readonly commissionRate = parseFloat(process.env.MP_PLATFORM_COMMISSION_RATE ?? '0.10');
  private readonly minDepositRate = parseFloat(process.env.MP_MIN_DEPOSIT_RATE ?? '0.30');
  private readonly subscriptionAmount = parseFloat(process.env.MP_SUBSCRIPTION_AMOUNT ?? '10000');
  private readonly apiUrl = process.env.API_URL ?? 'http://localhost:3000';
  private readonly appUrl = process.env.APP_URL ?? 'http://localhost:4200';
  // URL pública para callbacks — en dev usar ngrok o URL de producción
  private get publicAppUrl(): string {
    const url = this.appUrl;
    return url.includes('localhost') ? (process.env.MP_PUBLIC_URL ?? 'https://turnera.es') : url;
  }
  private get publicApiUrl(): string {
    const url = this.apiUrl;
    return url.includes('localhost') ? (process.env.MP_PUBLIC_URL ?? 'https://turnera.es') : url;
  }

  constructor(private prisma: PrismaService) {
    this.client = new MercadoPagoConfig({ accessToken: this.accessToken });
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

    // Reusar plan existente o crear uno nuevo por barbería
    let planId = barbershop.subscription?.mpPlanId ?? process.env.MP_PLAN_ID;
    console.log('[MP] subscribeBarber — planId:', planId);

    let plan: any;
    if (!planId) {
      plan = await this.createSubscriptionPlan(barbershop.name);
      planId = plan.id!;
    }

    const initPoint = plan?.init_point
      ?? `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${planId}`;

    console.log('[MP] Plan:', planId, 'initPoint:', initPoint.substring(0, 70));

    // Guardar plan en la suscripción (pendiente de autorización)
    await this.prisma.barbershopSubscription.upsert({
      where: { barbershopId },
      create: {
        barbershopId,
        plan: 'SUSCRIPCION',
        startDate: new Date(),
        mpPlanId: planId,
        isActive: false,
      },
      update: {
        mpPlanId: planId,
        plan: 'SUSCRIPCION',
        isActive: false,
      },
    });

    return { initPoint, planId };
  }

  async getSubscriptionStatus(barbershopId: string) {
    const sub = await this.prisma.barbershopSubscription.findUnique({
      where: { barbershopId },
    });
    if (!sub?.mpPreapprovalId) return { plan: sub?.plan ?? 'GRATUITO', isActive: sub?.isActive ?? true };

    const preapproval = new PreApproval(this.client);
    const result = await preapproval.get({ id: sub.mpPreapprovalId });

    return {
      plan: sub.plan,
      isActive: sub.isActive,
      mpStatus: result.status,
      nextBillingDate: sub.nextBillingDate,
    };
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

  // ==================== MODELO 3: COMISIÓN POR RESERVA ====================

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
    const sub = barbershop.subscription;

    if (!sub || sub.plan !== 'COMISION') {
      throw new BadRequestException('Esta barbería no tiene el plan de comisiones activo');
    }

    const depositRate = sub.minDepositRate;
    const depositAmount = Math.ceil(booking.totalPrice * depositRate);

    console.log('[MP] Creando preferencia — bookingId:', bookingId, 'depositAmount:', depositAmount);

    const preference = new Preference(this.client);
    let result: any;
    try {
      result = await preference.create({
      body: {
        items: [{
          id: bookingId,
          title: `${barbershop.name} — ${booking.service?.name ?? 'Reserva'}`,
          description: `Seña del turno (30%). Resto se abona en la barbería.`,
          quantity: 1,
          unit_price: depositAmount,
          currency_id: 'ARS',
        }],
        payer: {
          email: booking.user?.email ?? '',
          name: booking.user?.firstName ?? '',
          surname: booking.user?.lastName ?? '',
        },
        back_urls: {
          success: `${this.appUrl}/booking?status=success&bookingId=${bookingId}`,
          failure: `${this.appUrl}/booking?status=failure&bookingId=${bookingId}`,
          pending: `${this.appUrl}/booking?status=pending&bookingId=${bookingId}`,
        },
        notification_url: `${this.publicApiUrl}/api/mp/webhook`,
        external_reference: bookingId,
      },
    });
    } catch (mpErr: any) {
      console.error('[MP] Error en preference.create:', mpErr?.message, JSON.stringify(mpErr?.cause ?? mpErr?.response ?? ''));
      throw mpErr;
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { mpPreferenceId: result.id },
    });

    console.log('[MP] Preferencia creada — id:', result.id, 'initPoint:', result.init_point?.substring(0, 60));

    return { initPoint: result.init_point, preferenceId: result.id, depositAmount };
  }

  // ==================== WEBHOOK ====================

  async handleWebhook(type: string, data: any) {
    if (type === 'payment') {
      return this.handlePaymentWebhook(data.id);
    }
    if (type === 'subscription_authorized_payment') {
      return this.handleSubscriptionPaymentWebhook(data.id);
    }
    if (type === 'subscription_preapproval') {
      return this.handlePreapprovalWebhook(data.id);
    }
  }

  private async handlePaymentWebhook(mpPaymentId: string) {
    const mpPayment = new Payment(this.client);
    const payment = await mpPayment.get({ id: mpPaymentId });

    if (payment.status !== 'approved') return { received: true };

    const bookingId = payment.external_reference;
    if (!bookingId) return { received: true };

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { barber: { include: { barbershop: { include: { subscription: true } } } } },
    });
    if (!booking) return { received: true };

    const depositAmount = payment.transaction_amount ?? 0;
    const commissionRate = booking.barber.barbershop.subscription?.commissionRate ?? this.commissionRate;
    const platformFee = Math.round(depositAmount * commissionRate);
    const barbershopNet = depositAmount - platformFee;

    // Confirmar depósito y cambiar estado de reserva
    await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          mpPaymentId: String(mpPaymentId),
          depositPaid: true,
          status: 'CONFIRMADA',
        },
      }),
      this.prisma.platformTransaction.create({
        data: {
          barbershopId: booking.barber.barbershopId,
          bookingId,
          type: 'commission',
          grossAmount: depositAmount,
          platformFee,
          barbershopNet,
          mpPaymentId: String(mpPaymentId),
          mpStatus: payment.status,
          status: 'confirmed',
        },
      }),
    ]);

    return { received: true, bookingId, platformFee, barbershopNet };
  }

  private async handleSubscriptionPaymentWebhook(authorizedPaymentId: string) {
    // MP cobra exitosamente la mensualidad
    // Buscar la suscripción por preapproval y activarla/renovarla
    const sub = await this.prisma.barbershopSubscription.findFirst({
      where: { mpPreapprovalId: { not: null } },
    });
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
        },
      }),
    ]);

    return { received: true };
  }

  private async handlePreapprovalWebhook(preapprovalId: string) {
    const preapproval = new PreApproval(this.client);
    const result = await preapproval.get({ id: preapprovalId });

    const planId = (result as any).preapproval_plan_id;

    // Buscar por preapprovalId o por planId
    const sub = await this.prisma.barbershopSubscription.findFirst({
      where: {
        OR: [
          { mpPreapprovalId: preapprovalId },
          ...(planId ? [{ mpPlanId: planId }] : []),
        ],
      },
    });
    if (!sub) return { received: true };

    const isActive = result.status === 'authorized';
    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    await this.prisma.barbershopSubscription.update({
      where: { id: sub.id },
      data: {
        isActive,
        mpPreapprovalId: preapprovalId,
        ...(isActive ? { nextBillingDate: nextBilling } : {}),
      },
    });

    return { received: true, status: result.status };
  }
}
