import { CATEGORY_ICONS, type CategoryIcon } from '@expense-tracker/types';
import {
  Apple,
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  CircleEllipsis,
  Clapperboard,
  Coffee,
  CreditCard,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Lightbulb,
  type LucideIcon,
  Music,
  PawPrint,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Receipt,
  Scissors,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Stethoscope,
  TrainFront,
  TrendingUp,
  Tv,
  Utensils,
  Wallet,
  Wifi,
  Wrench,
} from 'lucide-react';

// Keyed by every CategoryIcon, so adding a key to the shared list without an
// icon here fails to compile.
export const CATEGORY_ICON_COMPONENTS: Record<CategoryIcon, LucideIcon> = {
  utensils: Utensils,
  coffee: Coffee,
  pizza: Pizza,
  'shopping-cart': ShoppingCart,
  apple: Apple,
  car: Car,
  bus: Bus,
  'train-front': TrainFront,
  fuel: Fuel,
  plane: Plane,
  house: House,
  lightbulb: Lightbulb,
  wifi: Wifi,
  smartphone: Smartphone,
  receipt: Receipt,
  'heart-pulse': HeartPulse,
  pill: Pill,
  stethoscope: Stethoscope,
  clapperboard: Clapperboard,
  'gamepad-2': Gamepad2,
  music: Music,
  tv: Tv,
  'shopping-bag': ShoppingBag,
  shirt: Shirt,
  gift: Gift,
  scissors: Scissors,
  banknote: Banknote,
  wallet: Wallet,
  'piggy-bank': PiggyBank,
  'credit-card': CreditCard,
  'trending-up': TrendingUp,
  'hand-coins': HandCoins,
  landmark: Landmark,
  briefcase: Briefcase,
  'graduation-cap': GraduationCap,
  'book-open': BookOpen,
  baby: Baby,
  'paw-print': PawPrint,
  dumbbell: Dumbbell,
  wrench: Wrench,
  'circle-ellipsis': CircleEllipsis,
};

export const FALLBACK_CATEGORY_ICON: CategoryIcon = 'circle-ellipsis';

export function isCategoryIcon(value: string): value is CategoryIcon {
  return (CATEGORY_ICONS as readonly string[]).includes(value);
}

/** The icon key to draw: unknown keys get a neutral fallback. */
export function resolveCategoryIcon(icon: string): CategoryIcon {
  return isCategoryIcon(icon) ? icon : FALLBACK_CATEGORY_ICON;
}

/** "shopping-cart" → "Shopping cart", for labels and tooltips. */
export function getCategoryIconLabel(icon: string): string {
  const words = icon.replace(/-\d+$/, '').replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
