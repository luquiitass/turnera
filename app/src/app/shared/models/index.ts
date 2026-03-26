export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  roles: string[];
  isActive: boolean;
  barbershopAdmins?: BarbershopAdmin[];
}

export interface BarbershopAdmin {
  id: string;
  userId: string;
  barbershopId: string;
  role: string;
  barbershop?: { id: string; name: string };
}

export interface Barbershop {
  id: string;
  name: string;
  description?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  coverImage?: string;
  logoImage?: string;
  depositAmount: number;
  cancellationHours: number;
  maxBarbers: number;
  isActive: boolean;
  barbers?: Barber[];
  services?: BarbershopServiceLink[];
  amenities?: BarbershopAmenity[];
  reviews?: Review[];
  offers?: Offer[];
  avgRating?: number;
  totalReviews?: number;
  _count?: { barbers: number; services: number };
}

export interface Barber {
  id: string;
  barbershopId: string;
  firstName: string;
  lastName: string;
  bio?: string;
  avatarUrl?: string;
  phone?: string;
  isActive: boolean;
  services?: BarberService[];
  schedules?: Schedule[];
  images?: BarberImage[];
  barbershop?: { id: string; name: string };
}

export interface BarberImage {
  id: string;
  barberId: string;
  imageUrl: string;
  caption?: string;
  sortOrder: number;
}

export interface BarberService {
  id: string;
  barberId: string;
  serviceId: string;
  price?: number;
  barber?: Barber;
  service?: Service;
}

export interface Service {
  id: string;
  name: string;
  nameNormalized?: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  isActive: boolean;
  barbershops?: BarbershopServiceLink[];
  barbers?: BarberService[];
}

export interface BarbershopServiceLink {
  id: string;
  barbershopId: string;
  serviceId: string;
  price: number;
  durationMin: number;
  isActive: boolean;
  service?: Service;
  barbershop?: { id: string; name: string; address?: string };
}

// Flat service used in booking flow (mapped from BarbershopServiceLink)
export interface FlatService {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  durationMin: number;
  isActive: boolean;
}

export interface Amenity {
  id: string;
  name: string;
  icon?: string;
  category?: string;
  isDefault: boolean;
}

export interface BarbershopAmenity {
  id: string;
  barbershopId: string;
  amenityId: string;
  amenity?: Amenity;
}

export interface Schedule {
  id: string;
  barberId: string;
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
}

export interface TimeSlot {
  time: string;
  endTime: string;
  available: boolean;
}

export interface Booking {
  id: string;
  userId: string;
  barberId: string;
  serviceId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalPrice: number;
  depositPrice: number;
  status: string;
  notes?: string;
  barber?: Barber;
  service?: Service;
  user?: User;
  payments?: Payment[];
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: string;
  type: string;
  status: string;
  registeredBy?: string;
}

export interface Review {
  id: string;
  userId: string;
  barbershopId: string;
  rating: number;
  comment?: string;
  user?: { firstName: string; lastName: string; avatarUrl?: string };
  createdAt: string;
}

export interface Offer {
  id: string;
  barbershopId: string;
  serviceId?: string;
  name: string;
  description?: string;
  discountType: string;
  discountValue: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  barbershop?: { id: string; name: string; logoImage?: string };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
