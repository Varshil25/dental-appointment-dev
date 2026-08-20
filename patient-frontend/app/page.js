import { HeroSection } from '@/components/sections/hero-section';
import { StatsSection } from '@/components/sections/stats-section';
import { DentistsSection } from '@/components/sections/dentists-section';
import { FeaturesSection } from '@/components/sections/features-section';
import { TrustStatementSection } from '@/components/sections/trust-statement-section';
import { TestimonialsSection } from '@/components/sections/testimonials-section';
import { ClinicInfoSection } from '@/components/sections/clinic-info-section';

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <StatsSection />
      <DentistsSection />
      <FeaturesSection />
      <TrustStatementSection />
      <TestimonialsSection />
      <ClinicInfoSection />
    </>
  );
}
