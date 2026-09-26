import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile',
};

export default function ProfilePage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="text-muted-foreground">Your profile is coming soon.</p>
    </div>
  );
}
