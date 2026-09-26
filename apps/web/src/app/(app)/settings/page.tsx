import type { Metadata } from 'next';
import { SettingsPanel } from '@/widgets/settings-panel';

export const metadata: Metadata = {
  title: 'Settings',
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <SettingsPanel />
    </div>
  );
}
