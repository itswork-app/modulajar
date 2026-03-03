import { redirect } from 'next/navigation';

export default function GeneratePage() {
    // Deprecated for v1: Legacy generation form has been moved to the structured onboarding wizard.
    redirect('/onboarding');
}
