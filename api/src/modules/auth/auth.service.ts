import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RegisterDto, LoginDto, RefreshTokenDto } from './dto/auth.dto.js';
import { EmailService } from './email.service.js';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('El email ya esta registrado');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        ...dto,
        password: hashedPassword,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !user.password) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario desactivado');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'barber-refresh-secret-dev-2024',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.refreshToken !== dto.refreshToken) {
        throw new UnauthorizedException('Token invalido');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.roles);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Token invalido o expirado');
    }
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        barbershopAdmins: {
          include: { barbershop: { select: { id: true, name: true } } },
        },
        barberProfiles: { select: { id: true, barbershopId: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.sanitizeUser(user);
  }

  async googleLogin(idToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const client = new OAuth2Client(clientId);

    let payload: any;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Token de Google invalido');
    }

    if (!payload?.email) throw new UnauthorizedException('No se pudo obtener el email de Google');

    // Find or create user
    let user = await this.prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      // Create new user from Google data
      user = await this.prisma.user.create({
        data: {
          email: payload.email,
          firstName: payload.given_name || payload.name?.split(' ')[0] || '',
          lastName: payload.family_name || payload.name?.split(' ').slice(1).join(' ') || '',
          avatarUrl: payload.picture || null,
          googleId: payload.sub,
        },
      });
    } else if (!user.googleId) {
      // Link Google account to existing user
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: payload.sub,
          avatarUrl: user.avatarUrl || payload.picture || null,
        },
      });
    }

    if (!user.isActive) throw new UnauthorizedException('Usuario desactivado');

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Respuesta genérica para no revelar si el email existe
    if (!user) return { message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.' };

    // Token aleatorio de 32 bytes → lo guardamos hasheado, enviamos el raw
    const rawToken = randomBytes(32).toString('hex');
    const hashed   = createHash('sha256').update(rawToken).digest('hex');
    const expiry   = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken: hashed, resetPasswordTokenExpiry: expiry },
    });

    const appUrl = process.env.APP_URL ?? 'http://localhost:4200';
    await this.emailService.sendPasswordReset(email, rawToken, appUrl);

    return { message: 'Si el email existe, recibirás instrucciones para recuperar tu contraseña.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const hashed = createHash('sha256').update(token).digest('hex');

    const user = await this.prisma.user.findFirst({
      where: {
        resetPasswordToken: hashed,
        resetPasswordTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) throw new BadRequestException('El enlace de recuperación es inválido o ha expirado.');

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
      },
    });

    // Retornar tokens para login automático
    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return { message: 'Contraseña actualizada correctamente.', user: this.sanitizeUser(user), ...tokens };
  }

  async generateDevToken(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.roles);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  private async generateTokens(userId: string, email: string, roles: string[]) {
    const payload = { sub: userId, email, roles };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload as any),
      this.jwtService.signAsync(payload as any, {
        secret: process.env.JWT_REFRESH_SECRET || 'barber-refresh-secret-dev-2024',
        expiresIn: '30d' as any,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken },
    });
  }

  private sanitizeUser(user: any) {
    const { password, refreshToken, ...sanitized } = user;
    return sanitized;
  }
}
