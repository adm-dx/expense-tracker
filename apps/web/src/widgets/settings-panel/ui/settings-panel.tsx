'use client';

import { DEFAULT_CURRENCY } from '@expense-tracker/types';
import type { ReactNode } from 'react';
import { ChangePasswordForm } from '@/features/auth/change-password';
import { CurrencyList } from '@/features/settings/currencies';
import { DefaultCurrencySelect } from '@/features/settings/currency';
import { LocationForm } from '@/features/settings/location';
import { ResetSettingsButton } from '@/features/settings/reset';
import { ThemeSettings } from '@/features/settings/theme';
import { useSettingsStore } from '@/entities/settings';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui';

interface SectionProps {
  title: string;
  description: string;
  children: ReactNode;
}

function Section({ title, description, children }: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SectionSkeleton() {
  return (
    <div
      className="h-10 animate-pulse rounded-md bg-muted"
      aria-hidden="true"
      data-testid="settings-skeleton"
    />
  );
}

/** Every setting of the signed-in user, one card per group. */
export function SettingsPanel() {
  const settings = useSettingsStore((state) => state.settings);
  const status = useSettingsStore((state) => state.status);
  const error = useSettingsStore((state) => state.error);
  const load = useSettingsStore((state) => state.load);

  return (
    <div className="space-y-6">
      {status === 'error' && !settings && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            {error ?? 'Failed to load settings'}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load({ force: true })}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Section
        title="Appearance"
        description="Light or dark, and the color scheme of the app."
      >
        {settings ? (
          <ThemeSettings
            saved={{
              theme: settings.theme,
              colorScheme: settings.colorScheme,
            }}
          />
        ) : (
          <SectionSkeleton />
        )}
      </Section>

      <Section
        title="Currency"
        description="Amounts are shown in it, and new transactions start in it. The switcher in the header changes the same setting."
      >
        {settings ? (
          <div className="space-y-6">
            <DefaultCurrencySelect value={settings.currency} />
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Your currencies</h3>
                <p className="text-sm text-muted-foreground">
                  Transactions can be entered in these. Removing one converts
                  its transactions to {DEFAULT_CURRENCY} at today&apos;s rate.
                </p>
              </div>
              <CurrencyList value={settings.currencies} />
            </div>
          </div>
        ) : (
          <SectionSkeleton />
        )}
      </Section>

      <Section
        title="Location"
        description="The place the weather in the header is shown for."
      >
        {settings ? (
          <LocationForm value={settings.location} />
        ) : (
          <SectionSkeleton />
        )}
      </Section>

      <Section
        title="Password"
        description="Changing it signs you out on every other device."
      >
        <ChangePasswordForm />
      </Section>

      <Section
        title="Reset"
        description="Put the theme, currency and location back to their defaults."
      >
        <ResetSettingsButton />
      </Section>
    </div>
  );
}
