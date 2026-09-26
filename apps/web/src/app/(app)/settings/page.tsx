import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-muted-foreground">Settings are coming soon.</p>
    </div>
  );
}
